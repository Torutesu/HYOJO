import { AccessToken } from "livekit-server-sdk";

export type LiveKitConnection = { serverUrl: string; token: string };

/** Mints short-lived, room-scoped credentials. Secrets never leave the API. */
export async function createLiveKitConnection(input: { room: string; identity: string }, env = process.env): Promise<LiveKitConnection> {
  const required = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`LiveKit connection is not configured: ${missing.join(", ")}`);

  const accessToken = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: input.identity,
    name: input.identity,
    ttl: "15m"
  });
  accessToken.addGrant({ roomJoin: true, room: input.room, canPublish: true, canSubscribe: true, canPublishData: true });
  return { serverUrl: env.LIVEKIT_URL!, token: await accessToken.toJwt() };
}
