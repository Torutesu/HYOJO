import OpenAI from "openai";
import { z } from "zod";

const memorySchema = z.object({ summary: z.string().trim().min(1).max(500), decisions: z.array(z.string().trim().min(1).max(500)).max(20), todos: z.array(z.object({ owner: z.string().trim().min(1).max(120), text: z.string().trim().min(1).max(500) })).max(50) });
type HuddleMemoryDraft = z.infer<typeof memorySchema>;

export async function generateHuddleMemory(input: { transcript: string; decisions: string[]; todos: Array<{ owner: string; text: string }> }, env = process.env): Promise<HuddleMemoryDraft> {
  const fallback: HuddleMemoryDraft = { summary: input.transcript.slice(0, 500), decisions: input.decisions, todos: input.todos };
  if (env.HYOJO_MEMORY_PROVIDER !== "openai" || !env.OPENAI_API_KEY || !env.OPENAI_MODEL) return fallback;
  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      store: false,
      input: [
        { role: "developer", content: "You extract institutional memory from a Huddle transcript. Respond in Japanese. Only use facts present in the transcript. Return a concise summary, explicit decisions, and concrete todos. Do not invent owners or decisions. Return JSON only." },
        { role: "user", content: input.transcript }
      ],
      text: { format: { type: "json_schema", name: "hyojo_huddle_memory", strict: true, schema: { type: "object", additionalProperties: false, required: ["summary", "decisions", "todos"], properties: { summary: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, todos: { type: "array", items: { type: "object", additionalProperties: false, required: ["owner", "text"], properties: { owner: { type: "string" }, text: { type: "string" } } } } } } } }
    });
    const output = memorySchema.safeParse(JSON.parse(response.output_text));
    return output.success ? output.data : fallback;
  } catch {
    return fallback;
  }
}
