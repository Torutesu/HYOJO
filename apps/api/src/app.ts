import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { isAllowedSurface } from "@hyojo/adaptive-ui";
import type { AuditEvent, SpeakResponse } from "@hyojo/domain";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const events: AuditEvent[] = [];
  const speakSchema = z.object({ text: z.string().trim().min(1).max(2_000), actorId: z.string().min(1) });

  app.get("/health", async () => ({ ok: true, service: "hyojo-api" }));
  app.get("/v1/audit-events", async () => ({ events }));
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
