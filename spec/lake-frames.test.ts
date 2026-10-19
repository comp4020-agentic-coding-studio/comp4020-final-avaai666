import { randomUUID } from "node:crypto";
import { expect, inject, it } from "vitest";

// Lake test 3 (the frames), moved out of spec/lake-app.test.ts unchanged.
// It runs in its own vitest project with its own fresh server, one file at a
// time, because it counts frames in a one-second window and failed
// intermittently on the shared app (environmental, see
// docs/checks/flaky-lake-app.md). The helpers below are copies of
// lake-app.test.ts's, and the test body is word for word what it was.
const baseUrl = inject("ownServerUrl");
const at = (path: string): URL => new URL(path, baseUrl);

async function openLake(): Promise<string> {
  const res = await fetch(at("/lakes"), { method: "POST", redirect: "manual" });
  expect(res.status).toBe(303);
  const match = res.headers.get("location")?.match(/^\/l\/([A-Z]{4})$/);
  expect(match, `open redirected to ${res.headers.get("location")}`).toBeTruthy();
  return match![1];
}

async function join(code: string, name: string, headers: Record<string, string> = {}) {
  const res = await fetch(at(`/l/${code}/join`), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ name }),
  });
  const setCookie = res.headers.getSetCookie()[0] ?? "";
  return { status: res.status, setCookie, cookie: setCookie.split(";")[0] };
}

async function joinOk(code: string, name: string): Promise<string> {
  const { status, cookie } = await join(code, name);
  expect(status).toBe(303);
  return cookie;
}

async function start(code: string, cookie: string) {
  return fetch(at(`/l/${code}/start`), { method: "POST", redirect: "manual", headers: { cookie } });
}

async function throwNet(code: string, cookie: string, body: Record<string, unknown>) {
  const res = await fetch(at(`/l/${code}/throw`), {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

interface SseEvent {
  event: string;
  id: string | null;
  data: string;
  arrived: number;
}

function openStream(code: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  let seen = 0;
  let wake = (): void => {};
  const done = (async () => {
    const res = await fetch(at(`/l/${code}/events`), { headers, signal: controller.signal });
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

it("3. the second client's stream sees the first client's throw row within 1 s, and at least four frames in the next second", async () => {
  const code = await openLake();
  const ava = await joinOk(code, "Ava");
  const bo = await joinOk(code, "Bo");
  expect((await start(code, ava)).status).toBe(303);

  const stream = openStream(code, { cookie: bo });
  try {
    await stream.next((e) => e.event === "snapshot");
    const sent = performance.now();
    const { status, body } = await throwNet(code, ava, { x: 500, y: 350, net: "coarse", key: randomUUID() });
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    const row = await stream.next((e) => e.event === "row" && JSON.parse(e.data).kind === "throw");
    const latency = row.arrived - sent;
    console.log(`lake live latency, POST sent -> row event arrived: ${latency.toFixed(1)} ms`);
    expect(latency).toBeLessThan(1000);
    const data = JSON.parse(row.data);
    expect(data).not.toHaveProperty("token");
    expect(data).not.toHaveProperty("key");
    expect(data.data).not.toHaveProperty("secret");

    const before = stream.events.filter((e) => e.event === "frame").length;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const after = stream.events.filter((e) => e.event === "frame").length;
    expect(after - before).toBeGreaterThanOrEqual(4);
  } finally {
    await stream.close();
  }
});
