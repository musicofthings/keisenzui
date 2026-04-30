import { callGPT } from "../utils/llm";

const PROMPT = `Analyze the meeting for:
- contradictions
- risks
- missed opportunities
- unclear decisions
Output actionable insights.`;

export async function insight(apiKey: string, transcript: string): Promise<string> {
  const res = await callGPT({ apiKey, system: PROMPT, user: transcript });
  const data = (await res.json()) as any;
  return data.output_text ?? "";
}
