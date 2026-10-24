// Following one fish from frame to frame.
//
// A frame carries the fish as a list, and that list changes: in Boat Rush a netted fish
// leaves it, in Fishing Party and Who's Poaching fish swim in and out of the light. The
// mode scripts used to take the fish in place i of the last frame as the same fish as the
// one in place i of this frame, so one fish caught in the middle made every fish after it
// jump to its neighbour's spot, and swap colour with it (world5.js colours a fish by the
// slot it is drawn in). Ava, 25 October: "the fish flicker, and suddenly vanish or appear".
//
// The server now names each fish (the last number of its row). This keeps every name in
// one drawing slot for as long as it is on screen: a fish moves smoothly between the two
// frames that hold it, keeps its colour, and only a fish that is really new appears. A
// slot nobody is using is drawn at scale 0, which world5.js's setFish() does not show.
//
// It decides nothing: it reads the two frames the server sent and places what is in them.
export function makeFishView() {
  const slotOf = new Map(); // fish id -> the slot it is drawn in
  const free = []; // slots whose fish has gone, to be used again
  let slots = 0;
  return {
    // the list for world.setFish(): this frame's fish, each eased k of the way from where
    // the frame before had it. Rows are [x*10, y*10, h*100, adult, id], as the server sends.
    list(cur, prev, k) {
      const out = [], here = new Set();
      const was = new Map();
      for (const f of prev ?? []) was.set(f[4], f);
      for (const f of cur ?? []) {
        const id = f[4];
        let slot = slotOf.get(id);
        if (slot === undefined) { slot = free.length ? free.pop() : slots++; slotOf.set(id, slot); }
        here.add(id);
        const p = was.get(id);
        const x = p ? p[0] + (f[0] - p[0]) * k : f[0];
        const y = p ? p[1] + (f[1] - p[1]) * k : f[1];
        out[slot] = [x / 10, y / 10, f[2] / 100, f[3] ? 1 : 0.6];
      }
      for (const [id, slot] of slotOf) if (!here.has(id)) { slotOf.delete(id); free.push(slot); }
      for (let i = 0; i < slots; i++) if (!out[i]) out[i] = [0, 0, 0, 0]; // an empty slot: drawn at scale 0
      return out;
    },
    clear() { slotOf.clear(); free.length = 0; slots = 0; },
  };
}
