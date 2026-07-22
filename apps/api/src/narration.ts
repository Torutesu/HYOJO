import OpenAI from "openai";
import { z } from "zod";
import type { Narration } from "@hyojo/domain";

const outputSchema = z.object({ greeting: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(800) });

const surface = { kind: "approval" as const, id: "refund-48h", title: "返金ポリシーは、いま声で決められます。", rationale: "AIが論点と過去の判断をまとめました。", primaryLabel: "判断を聞く", secondaryLabel: "30秒だけ聞く" };

export function fallbackNarration(): Narration {
  return { id: crypto.randomUUID(), greeting: "受け取りました。", title: "次に進める形にしています。", body: "宛先を選ばずに話した内容を整理し、必要な人と次の判断を見つけます。", surface };
}

export async function generateNarration(text: string, env = process.env): Promise<Narration> {
  if (env.HYOJO_NARRATION_PROVIDER !== "openai" || !env.OPENAI_API_KEY || !env.OPENAI_MODEL) return fallbackNarration();
  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      store: false,
      input: [
        { role: "developer", content: "You are HYOJO, an internal-company decision assistant. Respond in Japanese. Do not claim actions you did not take. Return a concise JSON object with greeting, title, and body. Never include personal, secret, or unprovided information." },
        { role: "user", content: text }
      ],
      text: { format: { type: "json_schema", name: "hyojo_narration", strict: true, schema: { type: "object", additionalProperties: false, required: ["greeting", "title", "body"], properties: { greeting: { type: "string" }, title: { type: "string" }, body: { type: "string" } } } } }
    });
    const output = outputSchema.safeParse(JSON.parse(response.output_text));
    if (!output.success) return fallbackNarration();
    return { id: crypto.randomUUID(), ...output.data, surface };
  } catch {
    return fallbackNarration();
  }
}
