import { callGPT } from "../utils/llm";

const ORCHESTRATOR_PROMPT =
  "You are an AI orchestration engine for a live meeting assistant. Route tasks to specialized agents. Maintain structured outputs. Prioritize low latency for real-time responses.";

export async function orchestrate(apiKey: string, input: string): Promise<any> {
  const res = await callGPT({ apiKey, system: ORCHESTRATOR_PROMPT, user: input, json: true });
  return res.json();
}
