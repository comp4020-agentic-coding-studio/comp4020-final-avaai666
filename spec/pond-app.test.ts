import { randomUUID } from "node:crypto";
import { describe, expect, inject, it } from "vitest";

// The app over HTTP (DESIGN.md, Routes and Live events), against the RUNNING
// app that spec/global-setup.ts finds. Each test digs its own pond. Never
// point APP_URL at production (CLAUDE.md).
const baseUrl = inject("baseUrl");
const at = (path: string): URL => new URL(path, baseUrl);

async function dig(headers: Record<string, string> = {}): Promise<number> {
  const res = await fetch(at("/dig"), { method: "POST", redirect: "manual", headers });
  expect(res.status).toBe(303);
  const match = res.headers.get("location")?.match(/^\/p\/(\d+)$/);
  expect(match, `dig redirected to ${res.headers.get("location")}`).toBeTruthy();
  return Number(match![1]);
}

async function join(pond: number, name: string, headers: Record<string, string> = {}) {
  const res = await fetch(at(`/p/${pond}/join`), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ name }),
  });
  const setCookie = res.headers.getSetCookie()[0] ?? "";
  return { status: res.status, setCookie, cookie: setCookie.split(";")[0] };
}

async function joinOk(pond: number, name: string): Promise<string> {
  const { status, cookie } = await join(pond, name);
  expect(status).toBe(303);
  return cookie;
}

async function cast(pond: number, cookie: string | null, key: string = randomUUID()) {
  const res = await fetch(at(`/p/${pond}/catch`), {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ key }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

interface SseEvent {
  event: string;
  id: string | null;
  data: string;
  arrived: number; // performance.now() when parsed
}

// Reads a live stream with fetch. `next` waits for the next event matching
// `match`, in arrival order.
function openStream(pond: number, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  let seen = 0;
  let wake = (): void => {};
  const done = (async () => {
    const res = await fetch(at(`/p/${pond}/events`), { headers, signal: controller.signal });
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

// Nothing secret may leave the server on a stream.
function expectNoSecrets(data: string): void {
  expect(data).not.toMatch(/"(key|token|netId|net|idem_key)"/);
}

it("1. GET / is 200 and lists a pond after POST /dig, which answers 303 to /p/{id}", async () => {
  const pond = await dig();
  const res = await fetch(at("/"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain(`href="/p/${pond}"`);
});

describe("2. join", () => {
  it("sets a net_{id} cookie (HttpOnly, SameSite=Lax, Path=/p/{id}) and the page says You are", async () => {
    const pond = await dig();
    const { status, setCookie, cookie } = await join(pond, "Ava");
    expect(status).toBe(303);
    expect(setCookie).toMatch(new RegExp(`^net_${pond}=[A-Za-z0-9_-]{22};`));
    expect(setCookie).toMatch(/; HttpOnly/);
    expect(setCookie).toMatch(/; SameSite=Lax/);
    expect(setCookie).toMatch(new RegExp(`; Path=/p/${pond}(;|$)`));
    const page = await (await fetch(at(`/p/${pond}`), { headers: { cookie } })).text();
    expect(page).toContain("You are <strong>Ava</strong>");
  });

  it("answers 400 to a bad name and 409 to a taken one", async () => {
    const pond = await dig();
    expect((await join(pond, "   ")).status).toBe(400);
    await joinOk(pond, "Ava");
    expect((await join(pond, "ava")).status).toBe(409);
  });
});

describe("3. requests from other sites, and the dig limit", () => {
  it("refuses a POST from another origin with 403 and writes nothing", async () => {
    const evil = { origin: "https://evil.example" };
    const before = await dig();
    const res = await fetch(at("/dig"), { method: "POST", redirect: "manual", headers: evil });
    expect(res.status).toBe(403);
    expect((await join(before, "Mallory", evil)).status).toBe(403);
    const after = await dig();
    expect(after).toBe(before + 1);
    expect(await (await fetch(at(`/p/${before}`))).text()).not.toContain("Mallory");
  });

  it("allows one dig per 10 s per Fly-Client-IP, and does not limit requests without it", async () => {
    const ip = { "fly-client-ip": `198.51.100.${Math.floor(Math.random() * 250) + 1}` };
    await dig(ip);
    const second = await fetch(at("/dig"), { method: "POST", redirect: "manual", headers: ip });
    expect(second.status).toBe(429);
    await dig();
    await dig();
  });
});

it("4. catch answers: 200, 429 with retryInMs, 200 again for the same key, 400 for a bad key, 403 without a cookie", async () => {
  const pond = await dig();
  const cookie = await joinOk(pond, "Ava");
  const key = randomUUID();

  const first = await cast(pond, cookie, key);
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ ok: true, available: 299 });

  const soon = await cast(pond, cookie);
  expect(soon.status).toBe(429);
  expect(soon.body.retryInMs).toBeGreaterThan(0);
  expect(soon.body.retryInMs).toBeLessThanOrEqual(1000);

  const again = await cast(pond, cookie, key);
  expect(again).toEqual({ status: 200, body: first.body });

  expect((await cast(pond, cookie, "not-a-key")).status).toBe(400);
  expect((await cast(pond, cookie, key.toUpperCase())).status).toBe(400);
  expect((await cast(pond, null)).status).toBe(403);
});

it("5. live: another net's catch reaches an open stream within 1000 ms", async () => {
  const pond = await dig();
  const watcher = await joinOk(pond, "Ava");
  const caster = await joinOk(pond, "Bo");
  const stream = openStream(pond, { cookie: watcher });
  try {
    await stream.next((e) => e.event === "snapshot");
    const sent = performance.now();
    const { status, body } = await cast(pond, caster);
    expect(status).toBe(200);
    const row = await stream.next((e) => e.event === "row" && e.id === String(body.id));
    const latency = row.arrived - sent;
    console.log(`live latency, POST sent → row event arrived: ${latency.toFixed(1)} ms`);
    expect(latency).toBeLessThan(1000);
    expect(JSON.parse(row.data)).toEqual({ id: body.id, kind: "catch", at: expect.any(Number), name: "Bo", available: 299 });
    expectNoSecrets(row.data);
  } finally {
    await stream.close();
  }
});

it("6. reconnect with Last-Event-ID replays exactly the rows after it, then a snapshot", async () => {
  const pond = await dig();
  const a = await joinOk(pond, "Ava");
  const b = await joinOk(pond, "Bo");
  const c = await joinOk(pond, "Cy");
  const last = (await cast(pond, a)).body.id as number;
  const ids = [(await cast(pond, b)).body.id, (await cast(pond, c)).body.id];

  const stream = openStream(pond, { "last-event-id": String(last) });
  try {
    await stream.next((e) => e.event === "snapshot");
    expect(stream.events.map((e) => [e.event, e.id])).toEqual([
      ["row", String(ids[0])],
      ["row", String(ids[1])],
      ["snapshot", null],
    ]);
  } finally {
    await stream.close();
  }
});

it("7. snapshots: at least two in 2.5 s with nobody tapping, and none carries a key, token or net id", async () => {
  const pond = await dig();
  const cookie = await joinOk(pond, "Ava");
  const stream = openStream(pond, { cookie });
  try {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const snapshots = stream.events.filter((e) => e.event === "snapshot");
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    for (const s of snapshots) {
      expectNoSecrets(s.data);
      const data = JSON.parse(s.data);
      expect(Object.keys(data).sort()).toEqual(["at", "available", "dead", "diedAt", "nets", "regrowthPerMin", "viewers"]);
      for (const n of data.nets) expect(Object.keys(n).sort()).toEqual(["catches", "name", "present"]);
    }
    expect(JSON.parse(snapshots.at(-1)!.data)).toMatchObject({ viewers: 1, nets: [{ name: "Ava", catches: 0, present: true }] });
  } finally {
    await stream.close();
  }
});

// 8. Persistence across a restart cannot be done from here (the app is
// started outside the tests); scripts/restart-check.sh does it.

it("9. /readme/ is README.md rendered as HTML, not left as text", async () => {
  const res = await fetch(at("/readme/"));
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/<h1[^>]*>/);
  expect(html).not.toContain("<pre>\n#");
});
