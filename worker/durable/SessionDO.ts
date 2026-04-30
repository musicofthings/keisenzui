import { defaultSessionState, recentContext, SessionState, TranscriptChunk } from "../utils/memory";

export class SessionDO {
  constructor(private state: DurableObjectState) {}

  private async loadState(): Promise<SessionState> {
    return (await this.state.storage.get<SessionState>("session")) ?? defaultSessionState();
  }

  private async saveState(session: SessionState): Promise<void> {
    session.last_updated = new Date().toISOString();
    await this.state.storage.put("session", session);
  }

  async appendTranscript(chunk: TranscriptChunk): Promise<SessionState> {
    return this.state.storage.transaction(async () => {
      const session = await this.loadState();
      session.transcript.push(chunk);
      if (session.transcript.length > 5000) session.transcript = session.transcript.slice(-5000);
      await this.saveState(session);
      return session;
    });
  }

  async getRecentContext(windowMinutes = 2): Promise<TranscriptChunk[]> {
    const session = await this.loadState();
    return recentContext(session.transcript, windowMinutes * 60 * 1000);
  }

  async updateSummary(summary: string, keyPoints: string[] = [], decisions: string[] = []): Promise<SessionState> {
    return this.state.storage.transaction(async () => {
      const session = await this.loadState();
      session.summary = summary;
      session.key_points = keyPoints;
      session.decisions = decisions;
      await this.saveState(session);
      return session;
    });
  }

  async getFullState(): Promise<SessionState> {
    return this.loadState();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/append")) {
      const chunk = (await request.json()) as TranscriptChunk;
      const result = await this.appendTranscript(chunk);
      return Response.json(result);
    }

    if (request.method === "GET" && url.pathname.endsWith("/recent")) {
      const window = Number(url.searchParams.get("window") ?? "2");
      const result = await this.getRecentContext(window);
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname.endsWith("/summary")) {
      const body = (await request.json()) as { summary: string; key_points?: string[]; decisions?: string[] };
      const result = await this.updateSummary(body.summary, body.key_points ?? [], body.decisions ?? []);
      return Response.json(result);
    }

    if (request.method === "GET" && url.pathname.endsWith("/state")) {
      return Response.json(await this.getFullState());
    }

    return new Response("Not found", { status: 404 });
  }
}
