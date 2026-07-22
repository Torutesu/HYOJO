import type { SpeakResponse } from "@hyojo/domain";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export async function speak(text: string): Promise<SpeakResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/speak`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, actorId: "toru" })
  });
  if (!response.ok) throw new Error("Speak request failed");
  return response.json() as Promise<SpeakResponse>;
}

export async function createHuddle() {
  const response = await fetch(`${apiBaseUrl}/v1/huddles`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "返金ポリシーを決める", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" }) });
  if (!response.ok) throw new Error("Huddle request failed");
  return response.json() as Promise<{ huddle: { id: string; recordingDisclosure: string } }>;
}
