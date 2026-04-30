import type { Env } from "../index";
import type { TranscriptEvent } from "../deepgram";
import { summarize } from "../agents/summarizer";
import { factCheck } from "../agents/factcheck";
import { insight } from "../agents/insight";

export async function consumeTranscripts(batch: MessageBatch<TranscriptEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
  for (const msg of batch.messages) {
    const event = msg.body;
    const id = env.SESSIONS.idFromName(event.session_id);
    const stub = env.SESSIONS.get(id);
    await stub.fetch("https://session/append", { method: "POST", body: JSON.stringify(event) });

    if (event.type === "final") {
      ctx.waitUntil(
        (async () => {
          const stateRes = await stub.fetch("https://session/state");
          const state = (await stateRes.json()) as any;
          const recentText = state.transcript.slice(-80).map((t: any) => `${t.speaker}: ${t.text}`).join("\n");
          const bucket = Math.floor(Date.now() / 30000);
          const key = `summary:${event.session_id}:${bucket}`;
          const existing = await env.AKIRA_KV.get(key);
          if (!existing) {
            const summary = await summarize(env.ANTHROPIC_API_KEY, recentText);
            await stub.fetch("https://session/summary", { method: "POST", body: JSON.stringify({ summary }) });
            await env.AKIRA_KV.put(key, "1", { expirationTtl: 45 });
          }
          await Promise.all([
            factCheck(env.OPENAI_API_KEY, recentText).then((f) => env.AKIRA_R2.put(`factcheck/${event.session_id}/${Date.now()}.json`, JSON.stringify(f))),
            insight(env.OPENAI_API_KEY, recentText).then((i) => env.AKIRA_R2.put(`insights/${event.session_id}/${Date.now()}.txt`, i)),
          ]);
        })(),
      );
    }
    msg.ack();
  }
}
