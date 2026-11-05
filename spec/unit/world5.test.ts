import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { worldForPage } from "../../src/lib/lake-world.ts";

// The v5 shared 3D world (src/static/play/world5.js), loaded as a plain
// browser module with no GPU (as spec/unit/play-client.test.ts does for the
// mode scripts): it should build the whole scene from the server's boot
// JSON without throwing, in jsdom, where WebGLRenderer itself cannot start
// (caught the same way a real browser without WebGL is handled).
const importJs = (path: string): Promise<any> => import(/* @vite-ignore */ path);

// jsdom has no real <canvas> (no "canvas" npm package here, and this repo's
// Dockerfile doesn't install one): a fake 2D context lets world5.js build
// its baked textures (the lantern glow, the falling-particle dot) and draw
// the minimap without a GPU, same spirit as fakeWorld() in play-client.test.ts.
function fake2d() {
  const noop = () => {};
  return { createRadialGradient: () => ({ addColorStop: noop }), fillRect: noop, clearRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop, set fillStyle(_v: unknown) {}, set strokeStyle(_v: unknown) {}, set lineWidth(_v: unknown) {} };
}
function dom() {
  const d = new JSDOM(
    `<!doctype html><div id="stage"><canvas id="gl5"></canvas><div id="tags5"></div><div id="floats5"></div><canvas id="mini"></canvas></div>`,
    { pretendToBeVisual: true },
  );
  d.window.HTMLCanvasElement.prototype.getContext = function (kind: string) { return kind === "2d" ? fake2d() : null; } as never;
  Object.assign(globalThis, {
    document: d.window.document, window: d.window,
    addEventListener: d.window.addEventListener.bind(d.window), removeEventListener: d.window.removeEventListener.bind(d.window),
    requestAnimationFrame: () => 0, ResizeObserver: class { observe() {} }, matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem: () => {} },
  });
  return d;
}

describe("createWorld5()", () => {
  it("builds the whole v5 scene from worldForPage()'s boot JSON without throwing", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    expect(api.scene).toBeDefined();
    expect(typeof api.drawBoat).toBe("function");
    expect(typeof api.screenToSim).toBe("function");
    api.end();
  });

  it("places the page's four docks on the shore (nr close to 1) and the island is inside the lake (rule change 11: a dock per boat)", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    expect(api.docks.length).toBe(4); // the page's lake is the four-boat lake; a match's frame brings its own (setLake)
    for (const d of api.docks) expect(Math.hypot(d.wx, d.wz)).toBeGreaterThan(20); // well out from the centre, on the shore (40 at the prototype's scale; rule change 10: x 0.5)
    api.end();
  });

  it("setLake() takes a match's lake from its frame: the scene scales by k, the docks move to the frame's, the island grows (rule change 11)", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const { makeLake } = await import("../../src/lib/lake-world.ts");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    const L6 = makeLake(6), r0 = api.island.r;
    api.setLake(L6.meta());
    expect(api.docks.length).toBe(6);
    api.docks.forEach((d: { x: number; z: number }, i: number) => { expect(d.x).toBeCloseTo(L6.docks[i].x, 1); expect(d.z).toBeCloseTo(L6.docks[i].y, 1); });
    expect(api.island.r).toBeCloseTo(r0 * L6.k, 6);
    expect(api.shoreShare(L6.docks[0].x, L6.docks[0].y)).toBeCloseTo(1, 1); // the page's shore, scaled, is the match's shore
    api.setHome(2, "#d6473a", "Your home"); // and your home can be marked on it
    api.end();
  });

  // Rule change 14 (Ava, 29 Oct: "the circle round home is too small -- I get there and it will not
  // unload, the hold stays full"): the ring used to be a fixed 3.2 while unloading started at DOCK_R
  // (6.5), twice as far out. setHome's fourth argument draws the ring at the real radius a caller gives
  // it, scaled with the match's lake, not a number baked into this file.
  it("setHome draws its ring at the radius it is given (DOCK_R from the boot data), not a fixed picture", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    const ringGroupOf = (seat: number) => api.scene.children.find((o: any) => o.position.x === api.docks[seat].wx && o.position.z === api.docks[seat].wz);
    api.setHome(0, "#d6473a", "Your home", 6.5);
    const g1 = ringGroupOf(0);
    const r1 = g1.userData.ring.scale.x;
    api.setHome(0, "#d6473a", "Your home", 13);
    const r2 = g1.userData.ring.scale.x;
    expect(r2).toBeCloseTo(r1 * 2, 5); // twice the radius scales the ring twice as wide
    api.end();
  });

  // Ava, 6 Nov: "only this far in will it put the fish down -- touching the outer edge of the
  // ring does nothing." makeRing's halo (the dark edge the eye actually reads as the ring's
  // boundary) is 0.7 units wider than the gold band it surrounds; scaling the whole group by
  // ringR against the band's own radius left the halo's outer edge ringR * 1.21875 out --
  // about 1.4 units past DOCK_R at ringR=6.5 -- promising unloading somewhere it doesn't
  // happen yet. The edge of this circle is a promise: inside it, fish go home, so the
  // halo's own outer edge, not the gold band's, must land on ringR.
  it("the ring's outer edge (its dark halo, not just the gold band) lands exactly on the radius it is given", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    const ringGroupOf = (seat: number) => api.scene.children.find((o: any) => o.position.x === api.docks[seat].wx && o.position.z === api.docks[seat].wz);
    api.setHome(0, "#d6473a", "Your home", 6.5);
    const g = ringGroupOf(0), ring = g.userData.ring;
    const haloOuter = ring.userData.halo.geometry.parameters.outerRadius * ring.scale.x;
    expect(haloOuter).toBeCloseTo(6.5, 5);
    api.end();
  });

  it("drawing a boat and setting fish, in every season, does not throw", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    const b = api.boat(0, "#d6473a", "Ava");
    for (let season = 0; season < 4; season++) {
      api.setSeason(season);
      expect(() => api.drawBoat(b, 0, 0, 0, 1, { hold: 3 })).not.toThrow();
      expect(() => api.setFish([[0, 0, 0, 1]], 1)).not.toThrow();
    }
    api.end();
  });

  it("screenToSim and wantDir() do not throw with no input yet", async () => {
    dom();
    const { createWorld5 } = await importJs("../../src/static/play/world5.js");
    const stage = document.getElementById("stage")!, canvas = document.getElementById("gl5")! as HTMLCanvasElement;
    const api = createWorld5(canvas, stage, worldForPage());
    expect(() => api.wantDir()).not.toThrow();
    api.end();
  });
});
