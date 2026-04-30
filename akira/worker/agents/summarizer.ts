import { callClaude } from "../utils/llm";

const PROMPT = `Summarize the following live meeting transcript segment into:
- key topics
- decisions made
- open questions
Be concise, structured, and factual.`;

export async function summarize(anthropicKey: string, transcript: string): Promise<string> {
  const res = await callClaude({ apiKey: anthropicKey, system: "You are a meeting summarization agent.", user: `${PROMPT}\n\n${transcript}` });
  const data = (await res.json()) as any;
  return data?.content?.map((c: any) => c.text).join("\n") ?? "";
}
