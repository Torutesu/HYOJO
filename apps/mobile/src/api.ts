import type { SpeakResponse } from "@hyojo/domain";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export async function speak(text: string): Promise<SpeakResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/speak`, {
    method: "POST", headers: { "content-type": "application/json", "x-hyojo-actor": "toru" },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error("Speak request failed");
  return response.json() as Promise<SpeakResponse>;
}

export async function createHuddle() {
  const response = await fetch(`${apiBaseUrl}/v1/huddles`, { method: "POST", headers: { "content-type": "application/json", "x-hyojo-actor": "toru" }, body: JSON.stringify({ title: "返金ポリシーを決める", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" }) });
  if (!response.ok) throw new Error("Huddle request failed");
  return response.json() as Promise<{ huddle: { id: string; recordingDisclosure: string } }>;
}

export async function joinHuddle(id: string) {
  const response = await fetch(`${apiBaseUrl}/v1/huddles/${id}/join`, { method: "POST", headers: { "x-hyojo-actor": "toru" } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Huddle join failed");
  return response.json() as Promise<{ huddle: { id: string; recordingDisclosure: string } }>;
}

export async function getHuddleConnection(id: string) {
  const response = await fetch(`${apiBaseUrl}/v1/huddles/${id}/token`, { method: "POST", headers: { "x-hyojo-actor": "toru" } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "LiveKit connection failed");
  return response.json() as Promise<{ connection: { serverUrl: string; token: string } }>;
}

export async function completeHuddle(id: string) {
  const response = await fetch(`${apiBaseUrl}/v1/huddles/${id}/complete`, { method: "POST", headers: { "x-hyojo-actor": "toru" } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Huddle completion failed");
  return response.json() as Promise<{ huddle: { id: string }; memory: { summary: string } | null }>;
}

export async function getHuddle(id: string) {
  const response = await fetch(`${apiBaseUrl}/v1/huddles/${id}`, { headers: { "x-hyojo-actor": "toru" } });
  if (!response.ok) throw new Error("Huddle could not be loaded");
  return response.json() as Promise<{ huddle: { title: string; transcript: { state: "not_requested" | "pending" | "received" } }; memory: { summary: string; decisions: string[]; todos: Array<{ owner: string; text: string }> } | null }>;
}

export type HuddleListItem = { id: string; title: string; status: "proposed" | "active" | "completed" | "recording_off"; transcript: { state: "not_requested" | "pending" | "received" }; createdAt: string };

export async function listHuddles() {
  const response = await fetch(`${apiBaseUrl}/v1/huddles`, { headers: { "x-hyojo-actor": "toru" } });
  if (!response.ok) throw new Error("Huddles could not be loaded");
  return response.json() as Promise<{ huddles: HuddleListItem[] }>;
}
