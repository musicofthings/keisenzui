import { callGPT } from "../utils/llm";

const PROMPT = `Identify factual claims in the transcript. For each:
- classify: true / uncertain / false
- provide reasoning
- suggest verification sources
Output structured JSON.`;

export async function factCheck(apiKey: string, transcript: string): Promise<any> {
  const res = await callGPT({ apiKey, system: PROMPT, user: transcript, json: true });
  return res.json();
}
