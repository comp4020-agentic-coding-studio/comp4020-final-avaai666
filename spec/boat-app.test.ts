import { expect, inject, it } from "vitest";

// The boat game over HTTP (experimental; docs/boats/RULES.md), against the
// RUNNING app that spec/global-setup.ts finds. Each test opens its own room.
// Never point APP_URL at production (CLAUDE.md).
const baseUrl = inject("baseUrl");
const at = (path: string): URL => new URL(path, baseUrl);

async function openRoom(): Promise<string> {
  const res = await fetch(at("/b"), { method: "POST", redirect: "manual" });
  expect(res.status).toBe(303);
  return res.headers.get("location")!.match(/^\/b\/([A-Z]{4})$/)![1];
}
async function join(code: string, name: string): Promise<string> {
  const res = await fetch(at(`/b/${code}/join`), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name }) });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie()[0].split(";")[0];
}
const post = (code: string, sub: string, cookie: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(at(`/b/${code}/${sub}`), { method: "POST", headers: { "content-type": "application/json", cookie, ...headers }, body: JSON.stringify(body) });

interface SseEvent {
  event: string;
  id: string | null;
  data: string;
  arrived: number;
}

function openStream(path: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  let seen = 0;
  let wake = (): void => {};
  const done = (async () => {
    const res = await fetch(at(path), { headers, signal: controller.signal });
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const e: SseEvent = { event: "message", id: null, data: "", arrived: performance.now() };
        let fields = 0;
        for (const line of block.split("\n")) {
          const [, field, val] = line.match(/^([a-z]+): ?(.*)$/) ?? [];
          if (field === "event") e.event = val;
          else if (field === "id") e.id = val;
          else if (field === "data") e.data += val;
          else continue;
          fields++;
        }
        if (fields > 0) events.push(e);
        wake();
      }
    }
  })().catch((err) => {
    if (!controller.signal.aborted) throw err;
  });

  async function next(match: (e: SseEvent) => boolean, timeoutMs = 3000): Promise<SseEvent> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      while (seen < events.length) {
        const e = events[seen++];
        if (match(e)) return e;
      }
      const left = deadline - performance.now();
      if (left <= 0) throw new Error(`no matching event within ${timeoutMs} ms`);
      await new Promise<void>((resolve) => {
        wake = resolve;
        setTimeout(resolve, left);
      });
    }
  }

  return {
    events,
    next,
    close: async () => {
      controller.abort();
      await done;
    },
  };
}

it("boats 1. two people join a room and each sees the other arrive", async () => {
  const code = await openRoom();
  const a = await join(code, "Ava");
  const sa = openStream(`/b/${code}/events`, { cookie: a });
  await sa.next((e) => e.event === "room");
  await join(code, "Bill");
  const e = await sa.next((e) => e.event === "room" && (JSON.parse(e.data).players as unknown[]).length === 2, 1000);
  expect(JSON.parse(e.data).players.map((p: { name: string }) => p.name)).toEqual(["Ava", "Bill"]);
  await sa.close();
});

it("boats 2. one person's steer reaches the other's stream within a second, decided by the server", async () => {
  const code = await openRoom();
  const a = await join(code, "Ava");
  const b = await join(code, "Bill");
  const sb = openStream(`/b/${code}/events`, { cookie: b });
  await sb.next((e) => e.event === "room");
  expect((await post(code, "start", a, { bots: false })).status).toBe(200);
  const go = JSON.parse((await sb.next((e) => e.event === "go", 2000)).data);
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 200));
  const sent = performance.now();
  expect((await post(code, "in", a, { k: "steer", x: 321, y: 234 })).status).toBe(200);
  const f = await sb.next((e) => e.event === "frame" && JSON.parse(e.data).b.some((x: number[]) => x[0] === 0 && x[8] === 321 && x[9] === 234), 1000);
  console.log(`boat steer -> the other stream: ${(f.arrived - sent).toFixed(1)} ms`);
  expect(f.arrived - sent).toBeLessThan(1000);
  await sb.close();
});

it("boats 3. a stranger cannot steer, and a cross-origin POST is refused", async () => {
  const code = await openRoom();
  const a = await join(code, "Ava");
  expect((await post(code, "start", a, { bots: true })).status).toBe(200);
  expect((await post(code, "in", "boat_XXXX=nope", { k: "cast" })).status).toBe(403);
  expect((await post(code, "in", a, { k: "cast" }, { origin: "https://evil.example" })).status).toBe(403);
});

it("boats 4. a fifth person cannot join, and a bot's name is refused", async () => {
  const code = await openRoom();
  for (const n of ["A1", "A2", "A3", "A4"]) await join(code, n);
  const full = await fetch(at(`/b/${code}/join`), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name: "A5" }) });
  expect(full.status).toBe(409);
  const code2 = await openRoom();
  const bot = await fetch(at(`/b/${code2}/join`), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name: "jin" }) });
  expect(bot.status).toBe(409);
});
