import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DICT, t } from "../../src/lib/i18n.ts";

// The /play game scripts (src/static/play/*.js) are plain browser modules that
// draw what the server sends. These load the real files with a fake `world`
// (the real three.js, nothing that needs a GPU) and drive them with taps and
// frames, to catch the kind of mistake the server tests cannot: a script that
// throws while drawing. They decide nothing and check no rule.

// the browser modules are plain JS with no declarations: type them loosely, here, where they are loaded
const importJs = (path: string): Promise<any> => import(/* @vite-ignore */ path);
const THREE = await importJs("../../src/static/vendor/three.module.js");

function dom() {
  const d = new JSDOM(`<!doctype html><canvas id="gl"></canvas><div id="stage"></div><div id="hud"></div><div id="goal"></div>`, { pretendToBeVisual: true });
  Object.assign(globalThis, { document: d.window.document, window: d.window, addEventListener: d.window.addEventListener.bind(d.window), removeEventListener: d.window.removeEventListener.bind(d.window) });
  return d;
}

function fakeWorld() {
  const noop = () => {};
  const scene = new THREE.Scene();
  return {
    THREE, scene, camera: new THREE.PerspectiveCamera(), setCamera: noop, setDocks: noop, setFish: noop, setKoi: noop, setLabels: noop, setLanterns: noop, setNight: noop,
    onFrame: noop, floatText: noop, ripple: noop, netDrop: noop, shake: noop, sweepProps: noop, prop: () => new THREE.Group(), makeLantern: () => new THREE.Group(),
    toon: (c: string) => new THREE.MeshBasicMaterial({ color: c }), boat: () => ({ tag: { classList: { toggle: noop } }, mesh: { visible: true } }), drawBoat: noop,
    screenToSim: () => [500, 350] as [number, number], clearBoats: noop, clearProps: noop, setFish_: noop,
  };
}

// rush.js (rush 2.0) draws through world5.js's API, not world.js's: a
// different fake, matching world5.js's createWorld5() return shape.
function fakeWorld5() {
  const noop = () => {};
  const scene = new THREE.Scene();
  return {
    THREE, scene, camera: new THREE.PerspectiveCamera(), toon: (c: string) => new THREE.MeshBasicMaterial({ color: c }),
    makeLantern: () => new THREE.Group(), makeRing: () => { const g = new THREE.Group(), mat = () => new THREE.MeshBasicMaterial(); g.userData = { gold: new THREE.Mesh(undefined, mat()), halo: new THREE.Mesh(undefined, mat()) }; return g; }, toWorld: (x: number, y: number) => [x, y], toSim: (x: number, y: number) => [x, y],
    zones: {}, island: { x: 10, y: -15, r: 7.5 }, docks: [{ x: 0, z: 10, wx: 0, wz: 10 }],
    setSeason: noop, setNight: noop, setLanterns: noop, setDocks: noop,
    boat: () => ({ tag: { classList: { toggle: noop } }, mesh: { visible: true, userData: { pile: { children: [] } } } }), drawBoat: noop,
    clearBoats: noop, setFish: noop, setKoi: noop, prop: () => new THREE.Group(), sweepProps: noop, clearProps: noop,
    ripple: noop, netDrop: noop, floatText: noop, setLabels: noop, screenToSim: () => [0, 0] as [number, number],
    setCameraMode: noop, viewSpan: () => 118, iceBlocks: () => false, growHouse: noop, resetHouses: noop, minimapEl: null,
    onFrame: noop, pointAt: noop, wantDir: () => null, setTap: noop, setSteerMode: noop, shake: noop,
    canvas: document.getElementById("gl5"), end: noop,
  };
}

function ui(lang: "en" | "zh") {
  const banners: [string, string][] = [];
  return {
    banners,
    api: {
      hud: document.getElementById("hud")!, goalEl: document.getElementById("goal")!, stage: document.getElementById("stage")!,
      t: (k: string, v: Record<string, string | number> = {}) => t(lang, k, v), seatName: (s: { name: string } | null) => s?.name ?? null,
      banner: (a: string, b: string) => banners.push([a, b]), setClock: () => {}, coach: () => {}, did: () => {}, rearm: () => {}, esc: (s: string) => String(s),
      crewOf: () => ({}), portrait: () => "", overlay: document.createElement("div"), sound: new Proxy({}, { get: () => () => {} }),
    },
  };
}

describe("Lake Holdings", () => {
  beforeEach(() => { dom(); });

  it("tapping the board before a card is picked shows the banner, in either language, and does not throw", async () => {
    // Lake Holdings 2.0 (rule change 1): hold.js draws through world5.js, with 2.0's frame
    const hold = await importJs("../../src/static/play/hold.js");
    for (const lang of ["en", "zh"] as const) {
      dom();
      const { api, banners } = ui(lang);
      const sent: unknown[] = [];
      let tap: (x: number, y: number) => void = () => {};
      const world = Object.assign(fakeWorld5(), { setTap: (f: typeof tap) => { tap = f; }, canvas: document.createElement("canvas") });
      const mode = hold.mount({ world, sound: api.sound, ui: api, send: (x: unknown) => sent.push(x), post: () => {}, view: () => ({ mySeat: 0, seats: [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }] }) });
      // one tile at the tap point, owned by seat 0; the player holds a hand but has not picked a card
      const tile = [0, 0, 0, 0, 40, "open", 10, 6, 0, "", 0, 0];
      mode.start({ phase: "pick", season: 1, seasons: 4, action: 1, actions: 3, left: 20, t: [tile], p: [{ seat: 0, fish: 0, tiles: 1, picked: false }], lake: 6, next: 7, tier: "none", start: 6, reveal: null, harvestStep: null, me: { hand: ["claim", "net", "pond"], pick: null } }, { seats: [] });
      expect(() => tap(0, 4)).not.toThrow();
      expect(banners).toEqual([[DICT[lang].h2_pick_first, DICT[lang].h2_pick_first_s]]);
      expect(sent).toEqual([]); // nothing was sent: no card, no place
    }
  });
});

describe("Lake Holdings' ceremony", () => {
  beforeEach(() => { dom(); });

  it("says the tier multiplies fish and tiles, not fish home, in either language", async () => {
    const hold = await importJs("../../src/static/play/hold.js");
    for (const lang of ["en", "zh"] as const) {
      dom();
      const { api } = ui(lang);
      const seats = [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }];
      const world = Object.assign(fakeWorld5(), { canvas: document.createElement("canvas") });
      const mode = hold.mount({ world, sound: api.sound, ui: api, send: () => {}, post: () => {}, view: () => ({ mySeat: 0, seats, code: "ABCD" }) });
      const overlay = document.createElement("div");
      mode.results({ results: { seats: [{ seat: 0, score: 12, base: 10, fish: 7, tiles: 3 }, { seat: 1, score: 6, base: 5, fish: 3, tiles: 2 }], lakeAfter: 200, highlights: [], extra: { next: 230, left: { a: 180 }, ledger: [{ seat: 0, home: 7 }, { seat: 1, home: 3 }] } }, code: "ABCD" }, overlay);
      overlay.querySelector<HTMLElement>("[data-cer-skip]")?.click();
      expect(overlay.textContent).toContain(t(lang, "h2_cer_mult", { mult: 1.2, tier: t(lang, "cer_v_rich") }).slice(0, 4));
      expect(overlay.textContent).not.toContain(t(lang, "cer_step3_mult", { mult: 1.2, tier: t(lang, "cer_v_rich") }));
    }
  });
});

describe("Who's Poaching", () => {
  beforeEach(() => { dom(); });

  it("drawing a frame in which a boat is out does not throw (the label for a boat that is out is worded from the dictionary)", async () => {
    // Who's Poaching 2.0 (rule change 1): poach.js draws through world5.js, with 2.0's frame
    const poach = await importJs("../../src/static/play/poach.js");
    dom();
    const { api } = ui("en");
    const world = Object.assign(fakeWorld5(), { boats: new Map() });
    let draw: (dt: number, time: number) => void = () => {};
    world.onFrame = ((fn: typeof draw) => { draw = fn; }) as never;
    const mode = poach.mount({ world, sound: api.sound, ui: api, send: () => {}, post: () => {}, view: () => ({ mySeat: 0, seats: [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }] }) });
    const frame = { phase: "day", day: 1, days: 3, left: 70, health: 100, line: 40, role: "fisher", partners: [], out: [1],
      b: [[0, 100, 100, 0, 0]], f: [], ev: [],
      me: { netCd: 0, fineCd: 0, fineMax: 13, fry: 0, caught: 0, taskFish: 0, tasks: [["t1", "net", "north", -160, -420, 0, 0]], buoy: false, buoyAt: null, insp: null, canInspect: false, canReport: false, seen: 0 } };
    mode.start(frame, { seats: [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }] });
    expect(() => draw(0.05, 12.5)).not.toThrow();
  });
});

describe("Fishing Party", () => {
  beforeEach(() => { dom(); });

  it("drawing every phase of a whole party from real 2.0 frames, then the results, does not throw and shows no raw key, in either language", async () => {
    // Fishing Party 2.0 (rule change 1): party.js draws through world5.js, with 2.0's frame
    const party = await importJs("../../src/static/play/party.js");
    const { party: mode2 } = await import("../../src/lib/modes/party.ts");
    const { eventsFor } = await import("../../src/lib/game-platform.ts");
    for (const lang of ["en", "zh"] as const) {
      dom();
      const { api } = ui(lang);
      const seats = [{ seat: 0, name: "Ava", bot: null, character: "mei" as const }, { seat: 1, name: "Bo", bot: null, character: "jin" as const }];
      let draw: (dt: number, time: number) => void = () => {};
      // prop() builds what the mode asks for, as world5.js does, so the mode can colour it
      const world = Object.assign(fakeWorld5(), { boats: new Map(), prop: (_id: string, make: () => unknown) => make(), onFrame: (fn: typeof draw) => { draw = fn; } });
      const m = party.mount({ world, sound: api.sound, ui: api, send: () => {}, post: () => {}, view: () => ({ mySeat: 0, seats, code: "ABCD" }) });
      const s = mode2.make(`client-${lang}`, seats, { fish: 280, adults: 224, young: 56 });
      m.start(mode2.frameFor(s, 0), { seats });
      const seen = new Set<string>();
      for (let k = 0; k < 40000 && !mode2.over(s); k++) {
        const inputs = s.phase === "intro" ? s.boats.map((b) => ({ seat: b.seat, i: { k: "ready" } }))
          : s.phase === "shop" ? s.boats.filter((b) => !s.done[b.seat]).map((b) => ({ seat: b.seat, i: { k: "done" } }))
          : s.phase === "pick" ? s.boats.filter((b) => s.last!.picks[b.seat] === null).map((b) => ({ seat: b.seat, i: { k: "pick", n: 3 } })) : [];
        const ev = mode2.step(s, inputs as never);
        if (k % 4 === 0 || ev.length) {
          m.frame(mode2.frameFor(s, 0), eventsFor(ev, 0));
          draw(0.05, k * 0.05);
          seen.add(`${s.phase}:${s.game}`);
          expect(api.overlay.innerHTML + api.hud.innerHTML, `${lang} ${s.phase} ${s.game}`).not.toMatch(/y2_|undefined|NaN/);
        }
      }
      expect(seen).toContain("play:night"); expect(seen).toContain("shop:scramble"); expect(seen).toContain("reveal:last");
      const r = mode2.results(s), { seats: rs, lakeLeft, highlights, ...extra } = r;
      const overlay = document.createElement("div");
      expect(() => m.results({ results: { seats: rs, lakeAfter: lakeLeft, highlights, extra }, code: "ABCD" }, overlay)).not.toThrow();
      expect(overlay.innerHTML).not.toMatch(/y2_|undefined|NaN/);
      m.end();
    }
  }, 60000);
});

describe("Boat Rush's practice", () => {
  beforeEach(() => { dom(); });
  afterEach(() => { vi.useRealTimers(); });

  it("sails to the ring, nets the school, takes it home and offers the real game, in either language, and sends nothing", async () => {
    // DESIGN.md "Practice runs in the browser only": never sent, stored or scored
    const rush = await importJs("../../src/static/play/rush.js");
    for (const lang of ["en", "zh"] as const) {
      dom(); vi.useFakeTimers();
      const { api, banners } = ui(lang);
      const sent: unknown[] = [];
      let tap: (x: number, y: number) => void = () => {};
      const pointed: unknown[] = [];
      // one dock on the shore at (0, 28), facing up into the lake
      const world = Object.assign(fakeWorld5(), { docks: [{ x: 0, z: 28, inward: -Math.PI / 2 }], boats: new Map(), setTap: (f: typeof tap) => { tap = f; }, pointAt: (x: number | null, y?: number) => { pointed.push(x === null ? null : [Math.round(x), Math.round(y!)]); } });
      const mode = rush.mount({ world, sound: api.sound, ui: api, send: (x: unknown) => sent.push(x), post: () => {}, view: () => ({ mySeat: null, me: 0, players: [{ name: "Ava", character: "lu" }], seats: null, code: "ABCD" }) });
      let done: unknown = null;
      mode.practice.start((why: unknown) => { done = why; });
      expect(pointed[0]).toEqual([0, 4]); // step 1: the arrow points at the gold ring
      expect(banners[0][0]).toBe(DICT[lang].r_p1k);
      tap(0, 4); vi.advanceTimersByTime(5000);
      expect(banners[1][0]).toBe(DICT[lang].r_p2k); // step 2: net the school
      const cast = document.getElementById("r-cast")!;
      for (let k = 0; k < 4 && !banners.some((b) => b[0] === DICT[lang].r_p3); k++) { cast.dispatchEvent(new window.Event("pointerdown")); cast.dispatchEvent(new window.Event("pointerup")); vi.advanceTimersByTime(1000); }
      expect(banners.some((b) => b[0] === DICT[lang].r_p3)).toBe(true); // step 3: home
      expect(Number(document.getElementById("r-hold")!.textContent!.split(" ")[0])).toBeGreaterThanOrEqual(3);
      tap(0, 25); vi.advanceTimersByTime(6000);
      expect(api.overlay.textContent).toContain(DICT[lang].r_p_done);
      (api.overlay.querySelector("#r-p-start") as HTMLButtonElement).click();
      expect(done).toBe("start");
      expect(sent).toEqual([]);
      mode.end();
    }
  });
});

describe("Boat Rush's keys", () => {
  beforeEach(() => { dom(); });
  afterEach(() => { vi.useRealTimers(); });

  it("W sails up the screen: the steer it sends moves y, not only x", async () => {
    // world5.js's wantDir() answers {x, z}; rush.js once read dir.y (undefined), so every key
    // steer went out with y: null and the boat only ever headed for the middle line
    const rush = await importJs("../../src/static/play/rush.js");
    vi.useFakeTimers();
    const { api } = ui("en");
    const sent: { k: string; x?: number; y?: number }[] = [];
    const world = Object.assign(fakeWorld5(), { boats: new Map(), wantDir: () => ({ x: 0, z: -1, mag: 1 }) });
    const mode = rush.mount({ world, sound: api.sound, ui: api, send: (x: { k: string }) => sent.push(x), post: () => {}, view: () => ({ mySeat: 0, seats: [{ name: "Ava", character: "mei" }] }) });
    mode.start({ phase: "sail", season: 0, left: 45, market: null, n: [], l: [], k: null, f: [], b: [[0, 0, 100, 0, 0, 12, 0, 0, 0, 0, [], 0, 100]] }, { seats: [{ name: "Ava", character: "mei" }] });
    vi.advanceTimersByTime(200);
    const steer = sent.find((s) => s.k === "steer")!;
    expect(steer).toEqual({ k: "steer", x: 0, y: -2 });
    mode.end();
  });
});

describe("the sound button", () => {
  beforeEach(() => { dom(); });

  it("shows the current state (Sound: on / off) with aria-pressed, flips on a click, and every effect and the music are safe with no audio device", async () => {
    // Codex review: "sound on" read as an action, not a state; the button now says which it is
    const { createSound } = await importJs("../../src/static/play/sound.js");
    for (const lang of ["en", "zh"] as const) {
      dom();
      const btn = document.createElement("button");
      const sound = createSound(btn, { on: t(lang, "g_sound_on"), off: t(lang, "g_sound_off"), label: t(lang, "g_sound") });
      expect(btn.textContent).toBe(DICT[lang].g_sound_on);
      expect(btn.getAttribute("aria-pressed")).toBe("true");
      btn.click();
      expect(btn.textContent).toBe(DICT[lang].g_sound_off);
      expect(btn.getAttribute("aria-pressed")).toBe("false");
      btn.click();
      // jsdom has no AudioContext: nothing may throw
      for (const k of ["catch", "coin", "bank", "hit", "miss", "horn", "big", "tick", "splash", "chime"]) expect(() => sound[k](2)).not.toThrow();
      expect(() => { sound.music("play"); sound.music("rush"); sound.music("calm"); sound.music(null); }).not.toThrow();
    }
  });
});
