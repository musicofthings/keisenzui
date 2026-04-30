export async function callGPT(params: {
  apiKey: string;
  system: string;
  user: string;
  model?: string;
  json?: boolean;
  stream?: boolean;
}): Promise<Response> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model ?? "gpt-5.5",
      stream: params.stream ?? false,
      text: params.json ? { format: { type: "json_object" } } : undefined,
      input: [
        { role: "system", content: [{ type: "input_text", text: params.system }] },
        { role: "user", content: [{ type: "input_text", text: params.user }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`GPT call failed: ${res.status}`);
  return res;
}

export async function callClaude(params: {
  apiKey: string;
  system: string;
  user: string;
  model?: string;
  stream?: boolean;
}): Promise<Response> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model ?? "claude-3-7-sonnet-latest",
      max_tokens: 1000,
      stream: params.stream ?? false,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude call failed: ${res.status}`);
  return res;
}
