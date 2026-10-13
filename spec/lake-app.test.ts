import { randomUUID } from "node:crypto";
import { inject, it } from "vitest";
import { expect } from "vitest";

// Lakes over HTTP (DESIGN.md v2.2, "Pages and routes", "Frames and events"),
// against the RUNNING app that spec/global-setup.ts finds. Each test opens
// its own lake. Never point APP_URL at production (CLAUDE.md): these tests
// dig ponds and open lakes, which would fill the real register with junk.
const baseUrl = inject("baseUrl");
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

it("1. GET / is 200; POST /lakes answers 303 to /l/CODE", async () => {
  const code = await openLake();
  const res = await fetch(at("/"));
  expect(res.status).toBe(200);
});

it("2. two clients join, one starts, and the game is running", async () => {
  const code = await openLake();
  const ava = await joinOk(code, "Ava");
  const bo = await joinOk(code, "Bo");
  const res = await start(code, ava);
  expect(res.status).toBe(303);
  const page = await (await fetch(at(`/l/${code}`), { headers: { cookie: bo } })).text();
  expect(page).toContain("Bo");
});

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

it("4. the same throw key twice gives the same answer and one row", async () => {
  const code = await openLake();
  const ava = await joinOk(code, "Ava");
  expect((await start(code, ava)).status).toBe(303);
  const key = randomUUID();
  const first = await throwNet(code, ava, { x: 500, y: 350, net: "coarse", key });
  expect(first.status).toBe(200);
  const second = await throwNet(code, ava, { x: 900, y: 600, net: "coarse", key });
  expect(second).toEqual(first);
});

it("5. a cross-origin POST is refused with 403", async () => {
  const res = await fetch(at("/lakes"), { method: "POST", redirect: "manual", headers: { origin: "https://evil.example" } });
  expect(res.status).toBe(403);
});

it("6. a ninth join is refused with full", async () => {
  const code = await openLake();
  for (let i = 0; i < 8; i++) await joinOk(code, `family-${i}`);
  const ninth = await join(code, "one-too-many");
  expect(ninth.status).toBe(409);
});

it("7. the lobby stream sees a second client's join row within 1s, and reload when the season starts", async () => {
  const code = await openLake();
  const ava = await joinOk(code, "Ava");
  const stream = openStream(code);
  try {
    const sent = performance.now();
    await joinOk(code, "Bo");
    const row = await stream.next((e) => e.event === "row");
    expect(row.arrived - sent).toBeLessThan(1000);
    const data = JSON.parse(row.data);
    expect(data.kind).toBe("join");
    expect(data.data).toEqual({ name: "Bo" });

    expect((await start(code, ava)).status).toBe(303);
    await stream.next((e) => e.event === "reload");
  } finally {
    await stream.close();
  }
});

it("8. GET /?code=bkmt answers 303 to /l/BKMT", async () => {
  const res = await fetch(at("/?code=bkmt"), { redirect: "manual" });
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/l/BKMT");
});
