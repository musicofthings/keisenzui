# Akira - Real-time AI Meeting Intelligence (Cloudflare Edge MVP)

Akira is an edge-native, streaming-first meeting intelligence system built on Cloudflare Workers.
It ingests live meeting audio, transcribes with Deepgram Nova-3, stores rolling meeting memory in Durable Objects,
and runs AI agents for summary, Q&A, fact-checking, and insights.

## What you get
- **Live transcript pipeline** (`/stream` → Deepgram → Queue → Durable Object)
- **Rolling meeting memory** (transcript, summary, key points, decisions)
- **Agent fanout**
  - Claude summarizer (periodic, async)
  - GPT Q&A (interactive)
  - GPT fact-check + insight (background, non-blocking)
- **Cloudflare-native architecture** (Workers + Durable Objects + Queues + KV + R2)

---

## 1) Prerequisites
- Cloudflare account with Workers enabled.
- Node.js 20+ and npm.
- API keys:
  - `DEEPGRAM_API_KEY`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
- A browser with microphone permission (Chrome/Edge recommended).

Install Wrangler:
```bash
npm install -g wrangler
```

Authenticate:
```bash
wrangler login
```

---

## 2) Cloudflare resource setup
From the repository root, create required resources.

### Queue
```bash
wrangler queues create akira-transcripts
```

### KV
```bash
wrangler kv namespace create AKIRA_KV
```
Copy the returned namespace id into `wrangler.toml` under `[[kv_namespaces]].id`.

### R2
```bash
wrangler r2 bucket create akira-artifacts
```

### Durable Object migration
`wrangler.toml` already contains migration tag/class for `SessionDO`.

---

## 3) Configure environment
Set secrets (recommended instead of plain vars):
```bash
wrangler secret put DEEPGRAM_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

Validate `wrangler.toml` bindings:
- `SESSIONS` Durable Object
- `TRANSCRIPT_QUEUE` producer + consumer
- `AKIRA_KV` namespace id
- `AKIRA_R2` bucket name

---

## 4) Deploy
```bash
wrangler deploy
```
Wrangler prints your worker URL, for example:
`https://akira.<subdomain>.workers.dev`

Save it as `WORKER_URL` for the browser client steps below.

---

## 5) Browser client for real meetings (Zoom/Meet/Teams)

> This MVP accepts **frequent audio chunks** over HTTP (`POST /stream`).
> In a real call, you run a browser page that captures your microphone (or selected input),
> chunk-encodes audio, and continuously posts to Akira.

### Important audio capture note
Web apps cannot directly capture another app's output in all OS/browser combinations.
For real Zoom usage, use one of these:
1. **Join Zoom from same browser tab context** and capture mic directly.
2. **Use OS virtual audio cable** (BlackHole/Loopback/VB-Cable) and set it as input device.
3. **Use conference room mic feed** as browser input device.

### Minimal browser client (copy into `client.html`)
This client:
- starts a session,
- captures microphone audio,
- sends chunks every 500ms,
- lets you query `/ask`,
- polls `/state` for live transcript/summary.

```html
<!doctype html>
<html>
  <body>
    <h2>Akira Browser Client</h2>
    <button id="start">Start Session</button>
    <button id="stop">Stop Stream</button>
    <input id="q" placeholder="Ask question" />
    <button id="ask">Ask</button>
    <pre id="out"></pre>
    <script>
      const WORKER_URL = "https://YOUR_WORKER.workers.dev";
      let mediaRecorder, sessionId, pollTimer;
      const out = document.getElementById("out");

      function log(x){ out.textContent = `${x}\n${out.textContent}`; }

      document.getElementById("start").onclick = async () => {
        const s = await fetch(`${WORKER_URL}/session/start`, { method: "POST" }).then(r => r.json());
        sessionId = s.session_id;
        log(`session: ${sessionId}`);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        mediaRecorder.ondataavailable = async (e) => {
          if (!sessionId || e.data.size === 0) return;
          const buf = await e.data.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const audio_base64 = btoa(binary);

          await fetch(`${WORKER_URL}/stream`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, audio_base64 })
          });
        };

        mediaRecorder.start(500);
        pollTimer = setInterval(async () => {
          const st = await fetch(`${WORKER_URL}/state?session_id=${sessionId}`).then(r => r.json());
          log(`summary: ${st.summary || "(pending)"}`);
          const last = (st.transcript || []).slice(-3).map(t => `${t.speaker}: ${t.text}`).join("\n");
          if (last) log(last);
        }, 3000);
      };

      document.getElementById("stop").onclick = () => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        if (pollTimer) clearInterval(pollTimer);
        log("stream stopped");
      };

      document.getElementById("ask").onclick = async () => {
        if (!sessionId) return log("start session first");
        const question = document.getElementById("q").value;
        const a = await fetch(`${WORKER_URL}/ask`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, question })
        }).then(r => r.json());
        log(`answer: ${a.answer}`);
      };
    </script>
  </body>
</html>
```

Open it locally from the repository root:
```bash
python3 -m http.server 8080
```
Then browse to `http://localhost:8080/client.html`.

---

## 6) Using it in a real Zoom meeting
1. Start Akira client page before meeting starts.
2. Select the microphone/input source that carries meeting audio.
3. Click **Start Session**.
4. During meeting:
   - watch transcript updates,
   - ask live questions in the input box,
   - review rolling summary.
5. After meeting:
   - call `/state` for final transcript/summary,
   - review `factcheck/` + `insights/` artifacts in R2.

---

## 7) API reference
- `POST /session/start` → `{ session_id }`
- `POST /stream` body `{ session_id, audio_base64 }`
- `GET /state?session_id=...`
- `POST /ask` body `{ session_id, question }`

---

## 8) Operational notes for production hardening
- Add auth (JWT/API gateway) in front of routes.
- Encrypt or redact sensitive transcripts before archival.
- Add per-session retention/TTL and deletion endpoint.
- Add observability (Workers Analytics Engine, logs, tracing).
- Replace polling client with WebSocket push for transcript/state updates.

