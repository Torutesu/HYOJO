import postgres from "postgres";
import type { AuditEvent, Huddle, HuddleMemory, HuddleTranscript, RecordingPolicy } from "@hyojo/domain";

export interface HyojoStore {
  getPolicy(spaceId: string): Promise<RecordingPolicy | undefined>;
  savePolicy(spaceId: string, policy: RecordingPolicy): Promise<void>;
  getHuddle(id: string): Promise<Huddle | undefined>;
  saveHuddle(huddle: Huddle): Promise<void>;
  getMemory(huddleId: string): Promise<HuddleMemory | undefined>;
  saveMemory(memory: HuddleMemory): Promise<void>;
  getTranscript(huddleId: string): Promise<HuddleTranscript | undefined>;
  saveTranscript(transcript: HuddleTranscript): Promise<void>;
  addAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(): Promise<AuditEvent[]>;
  close(): Promise<void>;
}

class MemoryStore implements HyojoStore {
  private policies = new Map<string, RecordingPolicy>([["product", { mode: "required", videoRetentionDays: 30, transcriptRetentionDays: 365, allowMemoryIndexing: true }]]);
  private huddles = new Map<string, Huddle>();
  private memories = new Map<string, HuddleMemory>();
  private transcripts = new Map<string, HuddleTranscript>();
  private events: AuditEvent[] = [];
  async getPolicy(id: string) { return this.policies.get(id); }
  async savePolicy(id: string, value: RecordingPolicy) { this.policies.set(id, value); }
  async getHuddle(id: string) { return this.huddles.get(id); }
  async saveHuddle(value: Huddle) { this.huddles.set(value.id, value); }
  async getMemory(id: string) { return this.memories.get(id); }
  async saveMemory(value: HuddleMemory) { this.memories.set(value.huddleId, value); }
  async getTranscript(id: string) { return this.transcripts.get(id); }
  async saveTranscript(value: HuddleTranscript) { this.transcripts.set(value.huddleId, value); }
  async addAuditEvent(value: AuditEvent) { this.events.unshift(value); }
  async listAuditEvents() { return this.events; }
  async close() {}
}

class PostgresStore implements HyojoStore {
  constructor(private readonly sql: postgres.Sql) {}
  private async getDocument<T>(table: "space_policies" | "huddles" | "huddle_memories" | "huddle_transcripts", key: string): Promise<T | undefined> {
    const column = table === "space_policies" ? "space_id" : table === "huddles" ? "id" : "huddle_id";
    const rows = await this.sql.unsafe(`select document from ${table} where ${column} = $1`, [key]) as Array<{ document: T }>;
    return rows[0]?.document;
  }
  private async saveDocument(table: "space_policies" | "huddles" | "huddle_memories" | "huddle_transcripts", keyColumn: string, key: string, document: object, spaceId?: string) {
    if (spaceId) await this.sql.unsafe(`insert into ${table} (${keyColumn}, space_id, document) values ($1, $2, $3::jsonb) on conflict (${keyColumn}) do update set document = excluded.document, space_id = excluded.space_id, updated_at = now()`, [key, spaceId, JSON.stringify(document)]);
    else await this.sql.unsafe(`insert into ${table} (${keyColumn}, document) values ($1, $2::jsonb) on conflict (${keyColumn}) do update set document = excluded.document, updated_at = now()`, [key, JSON.stringify(document)]);
  }
  async getPolicy(id: string) { return this.getDocument<RecordingPolicy>("space_policies", id); }
  async savePolicy(id: string, value: RecordingPolicy) { await this.saveDocument("space_policies", "space_id", id, value); }
  async getHuddle(id: string) { return this.getDocument<Huddle>("huddles", id); }
  async saveHuddle(value: Huddle) { await this.saveDocument("huddles", "id", value.id, value, value.spaceId); }
  async getMemory(id: string) { return this.getDocument<HuddleMemory>("huddle_memories", id); }
  async saveMemory(value: HuddleMemory) { await this.saveDocument("huddle_memories", "huddle_id", value.huddleId, value); }
  async getTranscript(id: string) { return this.getDocument<HuddleTranscript>("huddle_transcripts", id); }
  async saveTranscript(value: HuddleTranscript) { await this.saveDocument("huddle_transcripts", "huddle_id", value.huddleId, value); }
  async addAuditEvent(value: AuditEvent) { await this.sql`insert into audit_events (id, space_id, document) values (${value.id}, ${(value.metadata.spaceId ?? "system")}, ${this.sql.json(value)})`; }
  async listAuditEvents() { const rows = await this.sql`select document from audit_events order by created_at desc`; return rows.map((row) => row.document as AuditEvent); }
  async close() { await this.sql.end(); }
}

export function createStore(env = process.env): HyojoStore {
  return env.DATABASE_URL ? new PostgresStore(postgres(env.DATABASE_URL, { max: 10 })) : new MemoryStore();
}
