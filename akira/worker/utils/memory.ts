export type TranscriptChunk = {
  timestamp: string;
  speaker: string;
  text: string;
  type: "partial" | "final";
};

export type SessionState = {
  transcript: TranscriptChunk[];
  summary: string;
  key_points: string[];
  decisions: string[];
  last_updated: string;
};

export const defaultSessionState = (): SessionState => ({
  transcript: [],
  summary: "",
  key_points: [],
  decisions: [],
  last_updated: new Date().toISOString(),
});

export function recentContext(chunks: TranscriptChunk[], windowMs: number): TranscriptChunk[] {
  const now = Date.now();
  return chunks.filter((chunk) => {
    const ts = new Date(chunk.timestamp).getTime();
    return Number.isFinite(ts) && now - ts <= windowMs;
  });
}
