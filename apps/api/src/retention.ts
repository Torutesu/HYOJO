import type { AuditEvent, Huddle } from "@hyojo/domain";
import type { HyojoStore } from "./store.js";

export async function expireHuddleRecords(store: HyojoStore, now = new Date(), allowedSpaceIds?: string[]) {
  const huddles = await store.listHuddles();
  const expired: string[] = [];
  for (const huddle of huddles) {
    if (allowedSpaceIds && !allowedSpaceIds.includes(huddle.spaceId)) continue;
    if (huddle.status !== "completed" || huddle.transcript.state !== "received") continue;
    const expiresAt = Date.parse(huddle.createdAt) + huddle.recordingPolicy.transcriptRetentionDays * 86_400_000;
    if (expiresAt > now.getTime()) continue;
    await store.deleteTranscript(huddle.id);
    await store.deleteMemory(huddle.id);
    huddle.transcript = { state: "not_requested" };
    await store.saveHuddle(huddle);
    const event: AuditEvent = { id: crypto.randomUUID(), action: "routing_decided", actorId: "retention-worker", occurredAt: now.toISOString(), reversible: false, metadata: { operation: "transcript_and_memory_expired", huddleId: huddle.id, spaceId: huddle.spaceId } };
    await store.addAuditEvent(event);
    expired.push(huddle.id);
  }
  return { expiredHuddleIds: expired };
}
