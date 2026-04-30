import { callGPT } from "../utils/llm";

const PROMPT = `You are a real-time meeting assistant. Answer user questions based on:
1. recent transcript
2. session memory
Be concise and accurate.`;

export async function answerQuestion(apiKey: string, context: string, question: string): Promise<string> {
  const res = await callGPT({ apiKey, system: PROMPT, user: `Context:\n${context}\n\nQuestion: ${question}` });
  const data = (await res.json()) as any;
  return data.output_text ?? "";
}
