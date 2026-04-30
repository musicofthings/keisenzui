# Akira - Real-time AI Meeting Intelligence (Cloudflare Edge MVP)

## Features
- Live audio ingestion via `/stream`.
- Deepgram Nova-3 transcription events pushed to Cloudflare Queue.
- Durable Object session memory with rolling transcript and summary.
- Multi-agent pipeline:
  - Claude summarizer (every ~30s on final chunks)
  - GPT Q&A (`/ask`)
  - GPT fact-check + insights async into R2
- Basic IP rate limiting and API key validation.

## Structure
See `worker/` for runtime code:
- `index.ts`: Worker entrypoint + queue handler.
- `router.ts`: HTTP API.
- `deepgram.ts`: ASR integration and queue event emit.
- `durable/SessionDO.ts`: concurrency-safe session store.
- `queues/transcriptConsumer.ts`: async agent fanout.
- `agents/*`: orchestrator/summarizer/qa/factcheck/insight agents.
- `utils/llm.ts`: GPT + Claude wrappers.

## API
- `POST /session/start` → `{ session_id }`
- `POST /stream` body `{ session_id, audio_base64 }`
- `GET /state?session_id=...`
- `POST /ask` body `{ session_id, question }`

## Run
1. Fill `wrangler.toml` bindings and API keys.
2. Create queue/KV/R2 in Cloudflare account.
3. Deploy:
```bash
cd akira
npx wrangler deploy
```

## Minimal WebSocket client note
This MVP uses HTTP chunk upload endpoint (`/stream`) for compatibility; a browser/client can still stream by sending frequent audio chunks.
