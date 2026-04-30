import { routeRequest } from "./router";
import { SessionDO } from "./durable/SessionDO";
import { consumeTranscripts } from "./queues/transcriptConsumer";

export interface Env {
  DEEPGRAM_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  SESSIONS: DurableObjectNamespace;
  TRANSCRIPT_QUEUE: Queue;
  AKIRA_KV: KVNamespace;
  AKIRA_R2: R2Bucket;
}

export { SessionDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return routeRequest(request, env, ctx);
  },

  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    await consumeTranscripts(batch, env, ctx);
  },
};
