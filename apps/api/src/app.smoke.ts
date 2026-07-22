import { buildApp } from "./app.js";

const app = await buildApp();
const response = await app.inject({ method: "POST", url: "/v1/speak", payload: { text: "Sarah と5分話したい", actorId: "toru" } });
if (response.statusCode !== 200) throw new Error(`Speak failed: ${response.statusCode}`);
const payload = response.json();
if (payload.narration?.surface?.kind !== "approval" || payload.auditEvents?.length !== 2) throw new Error("Unexpected Speak response");
const proposed = await app.inject({ method: "POST", url: "/v1/huddles", payload: { title: "返金ポリシーを決める", participants: ["toru", "sarah"], spaceId: "product", recordingPolicy: "required" } });
if (proposed.statusCode !== 201 || proposed.json().huddle.status !== "proposed") throw new Error("Huddle proposal failed");
const huddleId = proposed.json().huddle.id;
const completed = await app.inject({ method: "POST", url: `/v1/huddles/${huddleId}/complete`, payload: { transcript: "Sarah agrees to a full refund within 48 hours from checkout." } });
if (completed.statusCode !== 200 || completed.json().memory?.source !== "transcript") throw new Error("Huddle memory failed");
console.log("Speak smoke test passed");
await app.close();
