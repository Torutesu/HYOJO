import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { isAllowedSurface } from "@hyojo/adaptive-ui";
import type { AuditEvent, Huddle, HuddleMemory, HuddleTranscript, RecordingPolicy, SpeakResponse } from "@hyojo/domain";
import { createRecordingProvider } from "./recording.js";
import { canAccessSpace, principalFrom } from "./access.js";
import { createLiveKitConnection } from "./livekit.js";
import { createStore } from "./store.js";
import { expireHuddleRecords } from "./retention.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const store = createStore();
  const recordingProvider = createRecordingProvider();
  const speakSchema = z.object({ text: z.string().trim().min(1).max(2_000) });
  const huddleSchema = z.object({ title: z.string().trim().min(1).max(160), participants: z.array(z.string().min(1)).min(1), spaceId: z.string().min(1), recordingPolicy: z.enum(["required", "optional", "off"]).default("required") });
  const transcriptSchema = z.object({ text: z.string().trim().min(1).max(50_000), language: z.string().trim().min(2).max(16).optional(), decisions: z.array(z.string().trim().min(1).max(500)).max(20).default([]), todos: z.array(z.object({ owner: z.string().trim().min(1).max(120), text: z.string().trim().min(1).max(500) })).max(50).default([]) });

  function canIngestTranscript(request: { headers: Record<string, unknown> }) {
    const ingestKey = process.env.HYOJO_TRANSCRIPT_INGEST_KEY;
    return Boolean(ingestKey && request.headers["x-hyojo-ingest-key"] === ingestKey);
  }

  app.get("/health", async () => ({ ok: true, service: "hyojo-api" }));
  app.get("/readyz", async (_request, reply) => {
    const storage = await store.health();
    const production = process.env.HYOJO_AUTH_MODE === "production" || process.env.NODE_ENV === "production";
    const config = {
      database: Boolean(process.env.DATABASE_URL),
      signedAuth: Boolean(process.env.HYOJO_JWT_SECRET),
      livekit: Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
      recording: process.env.HYOJO_RECORDING_PROVIDER === "livekit" ? "livekit" : "development-memory"
    };
    const ready = storage.ok && (!production || (config.database && config.signedAuth));
    return reply.status(ready ? 200 : 503).send({ ok: ready, service: "hyojo-api", storage, config });
  });
  app.addHook("onClose", async () => { await store.close(); });
  app.get("/v1/audit-events", async () => ({ events: await store.listAuditEvents() }));
  app.post("/v1/approvals/:id/approve", async (request, reply) => {
    const principal = await principalFrom(request);
    if (!principal) return reply.status(401).send({ error: "Authentication required" });
    const { id } = request.params as { id: string };
    if (!id.trim()) return reply.status(400).send({ error: "Approval id is required" });
    const event: AuditEvent = { id: crypto.randomUUID(), action: "surface_approved", actorId: principal.id, occurredAt: new Date().toISOString(), reversible: true, metadata: { surfaceId: id } };
    await store.addAuditEvent(event);
    return { approval: { id, approvedBy: principal.id, approvedAt: event.occurredAt }, auditEvent: event };
  });
  app.get("/v1/huddles", async (request, reply) => {
    const principal = await principalFrom(request);
    if (!principal) return reply.status(401).send({ error: "Authentication required" });
    const huddles = (await store.listHuddles()).filter((huddle) => canAccessSpace(principal, huddle.spaceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { huddles: huddles.map((huddle) => ({ id: huddle.id, title: huddle.title, status: huddle.status, transcript: huddle.transcript, createdAt: huddle.createdAt })) };
  });
  app.get("/v1/spaces/:spaceId/recording-policy", async (request, reply) => {
    const principal = await principalFrom(request); const { spaceId } = request.params as { spaceId: string };
    if (!principal || !canAccessSpace(principal, spaceId)) return reply.status(403).send({ error: "Space access denied" });
    return { policy: await store.getPolicy(spaceId) ?? { mode: "optional", videoRetentionDays: 30, transcriptRetentionDays: 365, allowMemoryIndexing: true } };
  });
  app.patch("/v1/spaces/:spaceId/recording-policy", async (request, reply) => {
    const principal = await principalFrom(request); const { spaceId } = request.params as { spaceId: string };
    if (!principal || principal.role !== "admin" || !canAccessSpace(principal, spaceId)) return reply.status(403).send({ error: "Admin space access required" });
    const parsed = z.object({ mode: z.enum(["required", "optional", "off"]), videoRetentionDays: z.number().int().min(0).max(3650), transcriptRetentionDays: z.number().int().min(0).max(3650), allowMemoryIndexing: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid recording policy" });
    await store.savePolicy(spaceId, parsed.data);
    await store.addAuditEvent({ id: crypto.randomUUID(), action: "routing_decided", actorId: principal.id, occurredAt: new Date().toISOString(), reversible: true, metadata: { operation: "recording_policy_changed", spaceId } });
    return { policy: parsed.data };
  });
  app.get("/v1/huddles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = await store.getHuddle(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const principal = await principalFrom(request); if (!principal || !canAccessSpace(principal, huddle.spaceId)) return reply.status(403).send({ error: "Space access denied" });
    const transcript = await store.getTranscript(id);
    return { huddle, memory: await store.getMemory(id) ?? null, transcript: transcript ? { state: "received", receivedAt: transcript.receivedAt } : huddle.transcript };
  });
  app.post("/v1/huddles", async (request, reply) => {
    const parsed = huddleSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid Huddle payload" });
    const principal = await principalFrom(request); if (!principal || !canAccessSpace(principal, parsed.data.spaceId)) return reply.status(403).send({ error: "Space access denied" });
    const now = new Date().toISOString();
    const policy = await store.getPolicy(parsed.data.spaceId) ?? { mode: parsed.data.recordingPolicy, videoRetentionDays: 30, transcriptRetentionDays: 365, allowMemoryIndexing: parsed.data.recordingPolicy !== "off" };
    const huddle: Huddle = {
      id: crypto.randomUUID(), spaceId: parsed.data.spaceId, title: parsed.data.title, participants: parsed.data.participants,
      status: policy.mode === "off" ? "recording_off" : "proposed", recordingPolicy: policy,
      recordingDisclosure: policy.mode === "off" ? "このハドルは記録されません。" : "録画・文字起こし中。参加者全員に表示されます。",
      recording: { provider: policy.mode === "off" ? "none" : recordingProvider.name, state: "not_started" },
      transcript: { state: policy.mode === "off" ? "not_requested" : "pending" },
      createdAt: now
    };
    await store.saveHuddle(huddle);
    await store.addAuditEvent({ id: crypto.randomUUID(), action: "huddle_recording_started", actorId: "ai", occurredAt: now, reversible: true, metadata: { huddleId: huddle.id, recordingMode: policy.mode, spaceId: huddle.spaceId } });
    return reply.status(201).send({ huddle });
  });
  app.post("/v1/huddles/:id/join", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = await store.getHuddle(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const principal = await principalFrom(request); if (!principal || !canAccessSpace(principal, huddle.spaceId)) return reply.status(403).send({ error: "Space access denied" });
    if (huddle.status === "proposed" && huddle.recordingPolicy.mode !== "off") {
      try {
        const recording = await recordingProvider.start(huddle);
        huddle.recording = { provider: recording.provider, state: "recording", externalId: recording.externalId };
      } catch (error) {
        return reply.status(503).send({ error: error instanceof Error ? error.message : "Recording provider unavailable" });
      }
    }
    huddle.status = huddle.recordingPolicy.mode === "off" ? "recording_off" : "active";
    await store.saveHuddle(huddle);
    return { huddle };
  });
  app.post("/v1/huddles/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = await store.getHuddle(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const principal = await principalFrom(request);
    if (!principal || !canAccessSpace(principal, huddle.spaceId)) return reply.status(403).send({ error: "Space access denied" });
    if (huddle.status !== "proposed") return reply.status(409).send({ error: "Only an unjoined Huddle can be cancelled" });
    await store.deleteHuddle(id);
    await store.addAuditEvent({ id: crypto.randomUUID(), action: "routing_decided", actorId: principal.id, occurredAt: new Date().toISOString(), reversible: true, metadata: { operation: "huddle_cancelled_before_consent", huddleId: id, spaceId: huddle.spaceId } });
    return reply.status(204).send();
  });
  app.post("/v1/huddles/:id/token", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = await store.getHuddle(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const principal = await principalFrom(request); if (!principal || !canAccessSpace(principal, huddle.spaceId)) return reply.status(403).send({ error: "Space access denied" });
    if (huddle.status === "proposed") return reply.status(409).send({ error: "Join the Huddle before requesting a connection token" });
    if (huddle.status === "completed") return reply.status(409).send({ error: "This Huddle has already ended" });
    try {
      return { connection: await createLiveKitConnection({ room: huddle.id, identity: principal.id }) };
    } catch (error) {
      return reply.status(503).send({ error: error instanceof Error ? error.message : "LiveKit connection unavailable" });
    }
  });
  app.post("/v1/huddles/:id/complete", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = await store.getHuddle(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const principal = await principalFrom(request); if (!principal || !canAccessSpace(principal, huddle.spaceId)) return reply.status(403).send({ error: "Space access denied" });
    if (huddle.status === "completed") return { huddle, memory: await store.getMemory(id) ?? null };
    huddle.status = "completed";
    if (huddle.recording.state === "recording") { await recordingProvider.stop(huddle.recording.externalId); huddle.recording.state = "stopped"; }
    await store.saveHuddle(huddle);
    await store.addAuditEvent({ id: crypto.randomUUID(), action: "huddle_completed", actorId: principal.id, occurredAt: new Date().toISOString(), reversible: false, metadata: { huddleId: id, spaceId: huddle.spaceId } });
    return { huddle, memory: await store.getMemory(id) ?? null };
  });
  app.post("/v1/huddles/:id/transcript", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = await store.getHuddle(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const principal = await principalFrom(request);
    const trustedIngest = canIngestTranscript(request);
    if (!trustedIngest && (!principal || principal.role !== "admin" || !canAccessSpace(principal, huddle.spaceId))) return reply.status(403).send({ error: "Transcript ingest access denied" });
    if (huddle.status !== "completed") return reply.status(409).send({ error: "Complete the Huddle before indexing its transcript" });
    if (!huddle.recordingPolicy.allowMemoryIndexing) return reply.status(409).send({ error: "Institutional Memory indexing is disabled for this Space" });
    const parsed = transcriptSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid transcript payload" });
    const transcript: HuddleTranscript = { huddleId: id, text: parsed.data.text, language: parsed.data.language, receivedAt: new Date().toISOString() };
    await store.saveTranscript(transcript);
    huddle.transcript = { state: "received", receivedAt: transcript.receivedAt };
    // Video remains evidence. Only transcript text is allowed into the memory generation seam.
    const memory: HuddleMemory = { huddleId: id, summary: transcript.text.slice(0, 500), decisions: parsed.data.decisions, todos: parsed.data.todos, source: "transcript", createdAt: transcript.receivedAt };
    await store.saveHuddle(huddle);
    await store.saveMemory(memory);
    await store.addAuditEvent({ id: crypto.randomUUID(), action: "huddle_transcript_received", actorId: trustedIngest ? "transcript-worker" : principal!.id, occurredAt: transcript.receivedAt, reversible: false, metadata: { huddleId: id, language: transcript.language ?? "und", spaceId: huddle.spaceId } });
    return { huddle, memory };
  });
  app.post("/v1/admin/retention/run", async (request, reply) => {
    const principal = await principalFrom(request);
    if (!principal || principal.role !== "admin") return reply.status(403).send({ error: "Admin access required" });
    return expireHuddleRecords(store, new Date(), principal.spaceIds);
  });
  app.post("/v1/speak", async (request, reply) => {
    const parsed = speakSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid Speak payload" });
    const principal = await principalFrom(request);
    if (!principal) return reply.status(401).send({ error: "Authentication required" });
    const now = new Date().toISOString();
    const received: AuditEvent = { id: crypto.randomUUID(), action: "speak_received", actorId: principal.id, occurredAt: now, reversible: false, metadata: { textLength: String(parsed.data.text.length) } };
    const routed: AuditEvent = { id: crypto.randomUUID(), action: "routing_decided", actorId: "ai", occurredAt: now, reversible: true, metadata: { destination: "Product / Refund policy", confidence: "medium" } };
    await store.addAuditEvent(routed);
    await store.addAuditEvent(received);
    const surface = { kind: "approval" as const, id: "refund-48h", title: "返金ポリシーは、いま声で決められます。", rationale: "Sarahも合意済みです。AIが論点と過去の判断をまとめました。", primaryLabel: "判断を聞く", secondaryLabel: "30秒だけ聞く" };
    if (!isAllowedSurface(surface)) return reply.status(500).send({ error: "Unsupported surface" });
    const response: SpeakResponse = { narration: { id: crypto.randomUUID(), greeting: "受け取りました。", title: "次に進める形にしています。", body: "宛先を選ばずに話した内容を整理し、必要な人と次の判断を見つけます。", surface }, auditEvents: [received, routed] };
    return response;
  });
  return app;
}
