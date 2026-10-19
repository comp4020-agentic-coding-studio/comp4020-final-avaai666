import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";
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
    const hold = await importJs("../../src/static/play/hold.js");
    for (const lang of ["en", "zh"] as const) {
      dom();
      const { api, banners } = ui(lang);
      const sent: unknown[] = [];
      const world = fakeWorld();
      const mode = hold.mount({ world, sound: api.sound, ui: api, send: (x: unknown) => sent.push(x), view: () => ({ mySeat: 0, seats: [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }] }) });
      // one tile at the tap point, owned by seat 0; the player holds a hand but has not picked a card
      const tile = [0, 500, 350, 0, -1, -1, 0, 0, 0, 0];
      mode.start({ tiles: [tile], schools: [], hand: ["net", "pond", "claim"], harvest: [0, 0], held: [1, 0], tide: 0, tides: 12, next: 15, left: 180, hands: [3, 3], fish: 0 }, { seats: [] });
      const canvas = document.getElementById("gl")!;
      expect(() => canvas.dispatchEvent(new window.Event("pointerdown", { bubbles: true }) as never)).not.toThrow();
      expect(banners).toEqual([[DICT[lang].h_pick_first, DICT[lang].h_pick_first_s]]);
      expect(sent).toEqual([]); // nothing was sent: no card, no play
    }
  });
});

describe("Who's Poaching", () => {
  beforeEach(() => { dom(); });

  it("drawing a frame in which a boat is out does not throw (the label for a boat that is out is worded from the dictionary)", async () => {
    const poach = await importJs("../../src/static/play/poach.js");
    dom();
    const { api } = ui("en");
    const world = fakeWorld();
    let draw: (dt: number, time: number) => void = () => {};
    world.onFrame = ((fn: typeof draw) => { draw = fn; }) as never;
    document.body.appendChild(Object.assign(document.createElement("div"), { id: "p-pads" }));
    const mode = poach.mount({ world, sound: api.sound, ui: api, send: () => {}, view: () => ({ mySeat: 0, seats: [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }] }) });
    const frame = { t: 0, phase: "day", day: 1, days: 3, left: 70, health: 100, line: 40, quota: 0, quotaGoal: 60, role: "fisher", partners: [], known: [], out: [0, 1], mine: { fish: 0, fry: 0, buoyUsed: false, patrolled: false, inspecting: null, planting: null }, b: [[0, 100, 100, 0, 0], [1, 300, 300, 0, 1]], f: [], buoys: [], said: [], voted: [], canSkip: true, history: [] };
    mode.start(frame, { seats: [{ name: "Ava", character: "mei" }, { name: "Bo", character: "jin" }] });
    expect(() => draw(0.05, 12.5)).not.toThrow();
  });
});
