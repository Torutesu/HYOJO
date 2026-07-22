import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { isAllowedSurface } from "@hyojo/adaptive-ui";
import type { AuditEvent, Huddle, HuddleMemory, RecordingPolicy, SpeakResponse } from "@hyojo/domain";
import { createRecordingProvider } from "./recording.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const events: AuditEvent[] = [];
  const huddles = new Map<string, Huddle>();
  const memories = new Map<string, HuddleMemory>();
  const recordingProvider = createRecordingProvider();
  const speakSchema = z.object({ text: z.string().trim().min(1).max(2_000), actorId: z.string().min(1) });
  const huddleSchema = z.object({ title: z.string().trim().min(1).max(160), participants: z.array(z.string().min(1)).min(1), spaceId: z.string().min(1), recordingPolicy: z.enum(["required", "optional", "off"]).default("required") });
  const completeSchema = z.object({ transcript: z.string().trim().min(1).max(50_000) });

  app.get("/health", async () => ({ ok: true, service: "hyojo-api" }));
  app.get("/v1/audit-events", async () => ({ events }));
  app.get("/v1/huddles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = huddles.get(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    return { huddle, memory: memories.get(id) ?? null };
  });
  app.post("/v1/huddles", async (request, reply) => {
    const parsed = huddleSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid Huddle payload" });
    const now = new Date().toISOString();
    const policy: RecordingPolicy = { mode: parsed.data.recordingPolicy, videoRetentionDays: 30, transcriptRetentionDays: 365, allowMemoryIndexing: parsed.data.recordingPolicy !== "off" };
    const huddle: Huddle = {
      id: crypto.randomUUID(), spaceId: parsed.data.spaceId, title: parsed.data.title, participants: parsed.data.participants,
      status: policy.mode === "off" ? "recording_off" : "proposed", recordingPolicy: policy,
      recordingDisclosure: policy.mode === "off" ? "このハドルは記録されません。" : "録画・文字起こし中。参加者全員に表示されます。",
      recording: { provider: policy.mode === "off" ? "none" : recordingProvider.name, state: "not_started" },
      createdAt: now
    };
    huddles.set(huddle.id, huddle);
    events.unshift({ id: crypto.randomUUID(), action: "huddle_recording_started", actorId: "ai", occurredAt: now, reversible: true, metadata: { huddleId: huddle.id, recordingMode: policy.mode } });
    return reply.status(201).send({ huddle });
  });
  app.post("/v1/huddles/:id/join", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = huddles.get(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    if (huddle.status === "proposed" && huddle.recordingPolicy.mode !== "off") {
      try {
        const recording = await recordingProvider.start(huddle);
        huddle.recording = { provider: recording.provider, state: "recording", externalId: recording.externalId };
      } catch (error) {
        return reply.status(503).send({ error: error instanceof Error ? error.message : "Recording provider unavailable" });
      }
    }
    huddle.status = huddle.recordingPolicy.mode === "off" ? "recording_off" : "active";
    return { huddle };
  });
  app.post("/v1/huddles/:id/complete", async (request, reply) => {
    const { id } = request.params as { id: string };
    const huddle = huddles.get(id);
    if (!huddle) return reply.status(404).send({ error: "Huddle not found" });
    const parsed = completeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid completion payload" });
    huddle.status = "completed";
    if (huddle.recording.state === "recording") { await recordingProvider.stop(huddle.recording.externalId); huddle.recording.state = "stopped"; }
    // The summarizer seam deliberately receives transcript text only. Video stays evidence, not AI context.
    const memory: HuddleMemory = { huddleId: id, summary: "Sarahが48時間案に合意。残る論点は返金起点です。", decisions: ["決済完了から48時間以内は全額返金"], todos: [{ owner: "AI", text: "CSマニュアルの更新依頼を送る" }], source: "transcript", createdAt: new Date().toISOString() };
    if (huddle.recordingPolicy.allowMemoryIndexing) memories.set(id, memory);
    return { huddle, memory: huddle.recordingPolicy.allowMemoryIndexing ? memory : null };
  });
  app.post("/v1/speak", async (request, reply) => {
    const parsed = speakSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid Speak payload" });
    const now = new Date().toISOString();
    const received: AuditEvent = { id: crypto.randomUUID(), action: "speak_received", actorId: parsed.data.actorId, occurredAt: now, reversible: false, metadata: { textLength: String(parsed.data.text.length) } };
    const routed: AuditEvent = { id: crypto.randomUUID(), action: "routing_decided", actorId: "ai", occurredAt: now, reversible: true, metadata: { destination: "Product / Refund policy", confidence: "medium" } };
    events.unshift(received, routed);
    const surface = { kind: "approval" as const, id: "refund-48h", title: "返金ポリシーは、いま声で決められます。", rationale: "Sarahも合意済みです。AIが論点と過去の判断をまとめました。", primaryLabel: "判断を聞く", secondaryLabel: "30秒だけ聞く" };
    if (!isAllowedSurface(surface)) return reply.status(500).send({ error: "Unsupported surface" });
    const response: SpeakResponse = { narration: { id: crypto.randomUUID(), greeting: "受け取りました。", title: "次に進める形にしています。", body: "宛先を選ばずに話した内容を整理し、必要な人と次の判断を見つけます。", surface }, auditEvents: [received, routed] };
    return response;
  });
  return app;
}
