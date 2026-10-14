import { expect } from "vitest";

// Shared by the /play app tests: open a room, join with a cookie, post, and
// read a stream of server-sent events. Never point APP_URL at production.
export async function openRoom(base: string, mode: string): Promise<string> {
  const res = await fetch(new URL("/play", base), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ mode }) });
  expect(res.status).toBe(303);
  return res.headers.get("location")!.match(/^\/play\/([A-Z]{4})$/)![1];
}
export async function joinRoom(base: string, code: string, name: string, character: string): Promise<string> {
  const res = await fetch(new URL(`/play/${code}/join`, base), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name, character }) });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie()[0].split(";")[0];
}
export const post = (base: string, code: string, sub: string, cookie: string, body: unknown) =>
  fetch(new URL(`/play/${code}/${sub}`, base), { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

export interface SseEvent { event: string; data: string; arrived: number }
export function openStream(base: string, path: string, cookie?: string) {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  let raw = "";
  let seen = 0;
  let wake = (): void => {};
  const done = (async () => {
    const res = await fetch(new URL(path, base), { headers: cookie ? { cookie } : {}, signal: controller.signal });
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      raw += value;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const e: SseEvent = { event: "message", data: "", arrived: performance.now() };
        let fields = 0;
        for (const line of block.split("\n")) {
          const [, field, val] = line.match(/^([a-z]+): ?(.*)$/) ?? [];
          if (field === "event") e.event = val;
          else if (field === "data") e.data += val;
          else continue;
          fields++;
        }
        if (fields > 0) events.push(e);
        wake();
      }
    }
  })().catch((err) => { if (!controller.signal.aborted) throw err; });

  async function next(match: (e: SseEvent) => boolean, timeoutMs = 5000): Promise<SseEvent> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      while (seen < events.length) { const e = events[seen++]; if (match(e)) return e; }
      const left = deadline - performance.now();
      if (left <= 0) throw new Error(`no matching event within ${timeoutMs} ms`);
      await new Promise<void>((resolve) => { wake = resolve; setTimeout(resolve, Math.min(left, 1000)); });
    }
  }
  return { events, next, raw: () => raw, close: async () => { controller.abort(); await done; } };
}
