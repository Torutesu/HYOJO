export type AuditAction = "speak_received" | "routing_decided" | "surface_approved" | "huddle_recording_started";

export type AuditEvent = {
  id: string;
  action: AuditAction;
  actorId: string;
  occurredAt: string;
  reversible: boolean;
  metadata: Record<string, string>;
};

export type RecordingPolicy = {
  mode: "required" | "optional" | "off";
  videoRetentionDays: number;
  transcriptRetentionDays: number;
  allowMemoryIndexing: boolean;
};

export type AdaptiveSurface =
  | { kind: "approval"; id: string; title: string; rationale: string; primaryLabel: string; secondaryLabel: string }
  | { kind: "comparison"; id: string; title: string; options: Array<{ label: string; detail: string; recommended?: boolean }> }
  | { kind: "summary"; id: string; title: string; body: string };

export type Narration = {
  id: string;
  greeting: string;
  title: string;
  body: string;
  surface?: AdaptiveSurface;
};

export type SpeakRequest = { text: string; actorId: string };

export type SpeakResponse = { narration: Narration; auditEvents: AuditEvent[] };

export type HuddleStatus = "proposed" | "active" | "completed" | "recording_off";

export type Huddle = {
  id: string;
  spaceId: string;
  title: string;
  participants: string[];
  status: HuddleStatus;
  recordingPolicy: RecordingPolicy;
  recordingDisclosure: string;
  recording: { provider: "memory" | "livekit" | "none"; state: "not_started" | "recording" | "stopped"; externalId?: string };
  createdAt: string;
};

export type HuddleMemory = {
  huddleId: string;
  summary: string;
  decisions: string[];
  todos: Array<{ owner: string; text: string }>;
  source: "transcript" | "manual";
  createdAt: string;
};
