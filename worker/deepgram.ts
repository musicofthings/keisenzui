import type { Env } from "./index";

export type TranscriptEvent = {
  session_id: string;
  timestamp: string;
  speaker: string;
  text: string;
  type: "partial" | "final";
};

export async function streamToDeepgram(env: Env, sessionId: string, audioBase64: string): Promise<void> {
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&diarize=true", {
    method: "POST",
    headers: {
      Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/wav",
    },
    body: Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0)),
  });

  if (!res.ok) throw new Error(`Deepgram error: ${res.status}`);

  const data = (await res.json()) as any;
  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  if (!alt?.transcript) return;

  const event: TranscriptEvent = {
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    speaker: String(alt.words?.[0]?.speaker ?? "unknown"),
    text: alt.transcript,
    type: data?.is_final ? "final" : "partial",
  };
  await env.TRANSCRIPT_QUEUE.send(event);
}
