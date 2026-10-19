import { describe, expect, it } from "vitest";
import {
  ALLEE, DOCK_ANGLES, ICE_K, ISLAND, K, LAKE_X, LAKE_Y, TIERS, adultsYoungFromNext, blockedAt, breed, dockPos, forecast, iceBlocks, nextSpring, nr, outline, shapeR, shape, tierOf, worldForPage,
} from "../../src/lib/lake-world.ts";

// The lake every /play mode shares (DESIGN.md v5.0, "The world"): its outline,
// island, places, docks, K, breeding and tiers, in one server module. The
// numbers below are written out from the design text, not computed with the
// module's own functions, so a change to the module that changes the lake
// shows up here.

describe("the shape", () => {
  it("is 92 by 64, with K = 340 and the island at (10, -15), radius 7.5", () => {
    expect([LAKE_X, LAKE_Y, K]).toEqual([92, 64, 340]);
    expect(ISLAND).toEqual({ x: 10, y: -15, r: 7.5 });
  });

  it("the shore's radius at eight angles is 1 + .09 sin(2a+.6) + .06 sin(3a+2.1) + .035 sin(5a+.3)", () => {
    // a in degrees -> the radius from the formula, evaluated separately (4 decimals) and written out here
    const want: [number, number][] = [[0, 1.113], [45, 0.9853], [90, 1.0129], [135, 0.9246], [180, 0.9887], [225, 1.1633], [270, 0.8855], [315, 0.9268]];
    for (const [deg, r] of want) expect(shapeR((deg * Math.PI) / 180), `${deg} degrees`).toBeCloseTo(r, 3);
  });

  it("nr() is 0 in the middle and about 1 on the shore", () => {
    expect(nr(0, 0)).toBe(0);
    const [x, y] = shape(0, 1); // a point on the shore at angle 0
    expect(nr(x, y)).toBeCloseTo(1, 6);
    const [x2, y2] = shape(200, 0.5);
    expect(nr(x2, y2)).toBeCloseTo(0.5, 6);
  });

  it("outline() samples n points right round the shore, each at nr() = k, so the client draws the real shape and keeps no formula", () => {
    const pts = outline(1, 72);
    expect(pts.length).toBe(72);
    for (const [x, y] of pts) expect(nr(x, y)).toBeCloseTo(1, 6);
    const bank = outline(1.075, 40);
    for (const [x, y] of bank) expect(nr(x, y)).toBeCloseTo(1.075, 6);
  });

  it("worldForPage() sends the outline so the client never re-derives shapeR()", () => {
    const w = worldForPage();
    expect(w.outline.length).toBe(180);
    expect(w.outlineBank.length).toBe(180);
    for (const [x, y] of w.outline) expect(nr(x, y)).toBeCloseTo(1, 6);
  });
});

describe("the island and the ice", () => {
  it("a point on the island is blocked, and open water is not", () => {
    expect(blockedAt(ISLAND.x, ISLAND.y, 0)).toBe(true);
    expect(blockedAt(ISLAND.x + ISLAND.r - 1, ISLAND.y, 0)).toBe(true);
    expect(blockedAt(0, 20, 0)).toBe(false);
    expect(blockedAt(ISLAND.x + ISLAND.r + 8, ISLAND.y, 0)).toBe(false);
  });

  it("winter ice blocks water beyond 0.86 of the shore, except within 14 units of a dock", () => {
    expect(ICE_K).toBe(0.86);
    const [fx, fy] = shape(200, 0.95); // far from every dock, out near the shore
    expect(iceBlocks(fx, fy, 3)).toBe(true); // winter
    expect(iceBlocks(fx, fy, 0)).toBe(false); // spring
    expect(iceBlocks(fx, fy, 1)).toBe(false); // summer
    expect(iceBlocks(fx, fy, 2)).toBe(false); // autumn
    const [mx, my] = shape(200, 0.5); // deep water in winter
    expect(iceBlocks(mx, my, 3)).toBe(false);
    // the exception: beyond 0.86 but within 14 units of a dock stays open; just past 14 it freezes.
    // (Along the line from the dock toward the middle, where the shore distance shrinks, so move
    // sideways along the shore instead: that keeps the point beyond 0.86.)
    const d = dockPos(0, 4); // the first seat's dock, on the shore (nr = 1)
    expect(nr(d.x, d.y)).toBeCloseTo(1, 6);
    expect(iceBlocks(d.x, d.y, 3)).toBe(false); // the dock's own water is kept open
    const side = d.inward + Math.PI / 2; // along the shore
    const near = [d.x + Math.cos(side) * 8, d.y + Math.sin(side) * 8]; // 8 units away
    const far = [d.x + Math.cos(side) * 17, d.y + Math.sin(side) * 17]; // 17 units away: past 14 from this dock
    expect(nr(near[0], near[1])).toBeGreaterThan(0.86);
    expect(nr(far[0], far[1])).toBeGreaterThan(0.86);
    expect(Math.hypot(far[0] - d.x, far[1] - d.y)).toBeGreaterThan(14);
    expect(iceBlocks(near[0], near[1], 3)).toBe(false);
    // the far point is 17 from this dock; it must also be 14 or more from every other dock for the test to mean anything
    const others = [1, 2, 3, 4, 5].map((i) => dockPos(i, 6)).every((o) => Math.hypot(o.x - far[0], o.y - far[1]) >= 14);
    expect(others, "pick a point away from every dock").toBe(true);
    expect(iceBlocks(far[0], far[1], 3)).toBe(true);
    expect(blockedAt(fx, fy, 3)).toBe(true);
  });

  it("docks sit at 66, 114, 42, 138, 90 and 18 degrees, on the shore, facing in", () => {
    expect(DOCK_ANGLES).toEqual([66, 114, 42, 138, 90, 18]);
    for (let i = 0; i < 6; i++) {
      const d = dockPos(i, 6);
      expect(nr(d.x, d.y), `dock ${i}`).toBeCloseTo(1, 6);
      expect(d.inward).toBeCloseTo(Math.atan2(-d.y, -d.x), 9);
    }
  });
});

describe("breeding and the tiers", () => {
  it("breed(): below 36 adults, born = round(adults x 0.1); at or above, 1.55 x adults x (1 - (adults + young)/K) x (1 + bonus)", () => {
    expect(breed(30, 10)).toEqual({ adults: 40, born: 3 });
    expect(breed(35, 0)).toEqual({ adults: 35, born: 4 }); // round(3.5) = 4
    expect(ALLEE).toBe(36);
    // 230 adults and 50 young: 1.55 x 230 x (1 - 280/340) = 62.9..., round 63
    expect(breed(230, 50)).toEqual({ adults: 280, born: 63 });
    // a bonus of 0.15 (one Fish Ladder): 62.9 x 1.15 = 72.3..., round 72
    expect(breed(230, 50, 0.15)).toEqual({ adults: 280, born: 72 });
    // a full lake breeds nothing
    expect(breed(300, 40).born).toBe(0);
    expect(breed(340, 20).born).toBe(0); // never negative
  });

  it("next spring = adults + young + round(0.6 x (born + reed-bed fish))", () => {
    // 230 + 50 + round(0.6 x 63) = 280 + 38 = 318
    expect(forecast(230, 50)).toBe(318);
    // with 10 reed-bed fish: 280 + round(0.6 x 73) = 280 + 44 = 324
    expect(forecast(230, 50, 0, 10)).toBe(324);
  });

  it("the tiers are Bountiful at 60% of K and up (x1.2), Fair from 35% (x1), Lean from 15% (x0.8), else No fish (x0.5)", () => {
    expect(TIERS).toEqual([[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]]);
    expect(tierOf(204)).toEqual({ id: "rich", mult: 1.2 }); // 0.6 x 340
    expect(tierOf(203)).toEqual({ id: "fair", mult: 1 });
    expect(tierOf(119)).toEqual({ id: "fair", mult: 1 }); // 0.35 x 340 = 119 (119 / 340 is 0.35 in a float only by luck: the module compares fish, not ratios)
    expect(tierOf(118)).toEqual({ id: "lean", mult: 0.8 });
    expect(tierOf(51)).toEqual({ id: "lean", mult: 0.8 }); // 0.15 x 340 = 51
    expect(tierOf(50)).toEqual({ id: "none", mult: 0.5 });
    expect(tierOf(0)).toEqual({ id: "none", mult: 0.5 });
  });
});

describe("what the room stores for next spring", () => {
  it("adults = min(K, 0.8 x next) and young = 0.2 x next, rounded", () => {
    expect(adultsYoungFromNext(318)).toEqual({ adults: 254, young: 64 }); // 0.8 x 318 = 254.4, 0.2 x 318 = 63.6
    expect(adultsYoungFromNext(100)).toEqual({ adults: 80, young: 20 });
    expect(adultsYoungFromNext(0)).toEqual({ adults: 0, young: 0 });
  });

  it("adults never pass K", () => {
    expect(adultsYoungFromNext(500).adults).toBe(340);
    expect(adultsYoungFromNext(425).adults).toBe(340); // 0.8 x 425 = 340
    expect(adultsYoungFromNext(426).adults).toBe(340); // 340.8 capped
  });

  it("a new room starts with 230 adults and 50 young fish", async () => {
    const { A0, Y0 } = await import("../../src/lib/lake-world.ts");
    expect([A0, Y0]).toEqual([230, 50]);
  });
});

describe("nextSpring(): every mode writes next spring this way, with no separate regrowth", () => {
  it("splits what is left 0.8/0.2, breeds once, and that is next spring", () => {
    // 280 left: adults 224, young 56; breed(224,56) = born round(1.55x224x(1-280/340)) = 61;
    // next spring = 280 + round(61 x 0.6) = 280 + 37 = 317
    expect(nextSpring(280)).toBe(317);
    // 100 left: adults 80, young 20; born = round(1.55x80x(1-100/340)) = 88; next = 100 + 53 = 153
    expect(nextSpring(100)).toBe(153);
  });

  it("never exceeds K", () => {
    expect(nextSpring(500)).toBe(K);
  });

  it("zero stays zero", () => {
    expect(nextSpring(0)).toBe(0);
  });
});
