import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from "livekit-server-sdk";
import type { Huddle, RecordingPolicy } from "@hyojo/domain";

export type RecordingStart = { externalId?: string; provider: Huddle["recording"]["provider"] };

export interface RecordingProvider {
  readonly name: Huddle["recording"]["provider"];
  start(huddle: Pick<Huddle, "id" | "recordingPolicy">): Promise<RecordingStart>;
  stop(externalId?: string): Promise<void>;
}

class MemoryRecordingProvider implements RecordingProvider {
  readonly name = "memory" as const;
  async start(): Promise<RecordingStart> { return { provider: this.name, externalId: `local-${crypto.randomUUID()}` }; }
  async stop(): Promise<void> {}
}

class LiveKitRecordingProvider implements RecordingProvider {
  readonly name = "livekit" as const;
  private readonly client: EgressClient;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secret: string;

  constructor(env: NodeJS.ProcessEnv) {
    const required = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "RECORDING_S3_BUCKET", "RECORDING_S3_REGION", "RECORDING_S3_ACCESS_KEY", "RECORDING_S3_SECRET"] as const;
    const missing = required.filter((key) => !env[key]);
    if (missing.length) throw new Error(`LiveKit recording is not configured: ${missing.join(", ")}`);
    this.client = new EgressClient(env.LIVEKIT_URL!.replace("wss://", "https://"), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
    this.bucket = env.RECORDING_S3_BUCKET!; this.region = env.RECORDING_S3_REGION!; this.accessKey = env.RECORDING_S3_ACCESS_KEY!; this.secret = env.RECORDING_S3_SECRET!;
  }

  async start(huddle: Pick<Huddle, "id" | "recordingPolicy">): Promise<RecordingStart> {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `hyojo/huddles/${huddle.id}/recording.mp4`,
      output: { case: "s3", value: new S3Upload({ accessKey: this.accessKey, secret: this.secret, bucket: this.bucket, region: this.region }) }
    });
    const info = await this.client.startRoomCompositeEgress(huddle.id, { file: output }, { layout: "grid", audioOnly: false });
    return { provider: this.name, externalId: info.egressId };
  }

  async stop(externalId?: string): Promise<void> { if (externalId) await this.client.stopEgress(externalId); }
}

export function createRecordingProvider(env = process.env): RecordingProvider {
  if (env.HYOJO_RECORDING_PROVIDER === "livekit") return new LiveKitRecordingProvider(env);
  return new MemoryRecordingProvider();
}
