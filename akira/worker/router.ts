import type { Env } from "./index";
import { answerQuestion } from "./agents/qa";
import { streamToDeepgram } from "./deepgram";

const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 120;

async function rateLimit(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
  const key = `rl:${ip}:${Math.floor(Date.now() / (RATE_LIMIT_WINDOW * 1000))}`;
  const count = Number((await env.AKIRA_KV.get(key)) ?? "0") + 1;
  await env.AKIRA_KV.put(key, String(count), { expirationTtl: RATE_LIMIT_WINDOW + 5 });
  return count <= RATE_LIMIT_MAX;
}

function validateKeys(env: Env): void {
  if (!env.DEEPGRAM_API_KEY || !env.OPENAI_API_KEY || !env.ANTHROPIC_API_KEY) {
    throw new Error("Missing required API keys");
  }
}

export async function routeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    validateKeys(env);
    if (!(await rateLimit(request, env))) return new Response("Rate limit exceeded", { status: 429 });

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/session/start") {
      const sessionId = crypto.randomUUID();
      const id = env.SESSIONS.idFromName(sessionId);
      env.SESSIONS.get(id);
      return Response.json({ session_id: sessionId });
    }

    if (request.method === "POST" && url.pathname === "/stream") {
      const { session_id, audio_base64 } = (await request.json()) as { session_id: string; audio_base64: string };
      ctx.waitUntil(streamToDeepgram(env, session_id, audio_base64));
      return Response.json({ accepted: true });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) return new Response("session_id required", { status: 400 });
      const stub = env.SESSIONS.get(env.SESSIONS.idFromName(sessionId));
      return stub.fetch("https://session/state");
    }

    if (request.method === "POST" && url.pathname === "/ask") {
      const { session_id, question } = (await request.json()) as { session_id: string; question: string };
      const stub = env.SESSIONS.get(env.SESSIONS.idFromName(session_id));
      const recent = await stub.fetch("https://session/recent?window=2");
      const state = await stub.fetch("https://session/state");
      const recentData = (await recent.json()) as any[];
      const stateData = (await state.json()) as any;
      const context = `${recentData.map((r) => `${r.speaker}: ${r.text}`).join("\n")}\n\nSummary:${stateData.summary}`;
      const answer = await answerQuestion(env.OPENAI_API_KEY, context, question);
      return Response.json({ answer });
    }

    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "internal error" }, { status: 500 });
  }
}
