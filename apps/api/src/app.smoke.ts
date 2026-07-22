import { buildApp } from "./app.js";

const app = await buildApp();
const response = await app.inject({ method: "POST", url: "/v1/speak", payload: { text: "Sarah と5分話したい", actorId: "toru" } });
if (response.statusCode !== 200) throw new Error(`Speak failed: ${response.statusCode}`);
const payload = response.json();
if (payload.narration?.surface?.kind !== "approval" || payload.auditEvents?.length !== 2) throw new Error("Unexpected Speak response");
console.log("Speak smoke test passed");
await app.close();
