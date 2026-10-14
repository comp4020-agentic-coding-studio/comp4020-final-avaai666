// The /play lobby: the 3D lake behind the panel, the mode card and the
// fisher's portrait for whatever is picked, and "Join with a code". The form
// posts to the server; this script only shows and hides.
import { createWorld } from "./world.js";

const $ = (s) => document.querySelector(s);
const world = createWorld($("#gl"), $("#stage"), { panel: true });
world.setCamera([0, 50, 62], [0, 0, 4]);
world.setDocks([200, -20, 112, 290].map((d, i) => { const a = d * Math.PI / 180; return { x: 500 + Math.cos(a) * 414, y: 350 + Math.sin(a) * 284, color: ["#d6473a", "#4a7d9c", "#e0a93a", "#2f9a8f"][i] }; }));
// scenery fish that circle slowly; they stand for no game state
const decor = Array.from({ length: 90 }, (_, i) => ({ s: i % 6, a: (i * 2.39) % 6.28, r: 10 + (i * 37) % 40 }));
world.onFrame((dt, t) => {
  world.setFish(decor.map((f) => {
    const cx = 500 + Math.cos(f.s * 1.05 + t * .05) * 220, cy = 350 + Math.sin(f.s * 1.05 + t * .05) * 140, a = f.a + t * .4;
    return [cx + Math.cos(a) * f.r, cy + Math.sin(a) * f.r * .7, a + Math.PI / 2];
  }), t);
});

// a stand-in per mode: its camera and light (drawing only)
const STAND = { rush: [[0, 50, 62], [0, 0, 4], 0], poach: [[-34, 30, 50], [0, 0, 0], .8], party: [[0, 40, 56], [0, 0, 2], .3], hold: [[0, 78, 30], [0, 0, 1], 0] };
function show() {
  const mode = $('input[name="mode"]:checked')?.value;
  const st = STAND[mode]; if (st) { world.setCamera(st[0], st[1]); world.setNight(st[2]); }
  const me = $('input[name="character"]:checked')?.value;
  document.querySelectorAll(".mode-info").forEach((el) => { el.hidden = el.dataset.mode !== mode; });
  document.querySelectorAll(".hero").forEach((el) => { el.hidden = el.dataset.me !== me; });
  const live = document.querySelector(`.mode-btn[data-mode="${mode}"] small.live`);
  $("#create").textContent = live ? "Open a room" : "Open a room (this game is coming)";
  try { localStorage.setItem("play-lobby", JSON.stringify({ mode, me })); } catch {}
}
try {
  const s = JSON.parse(localStorage.getItem("play-lobby") || "{}");
  if (s.mode) { const r = document.querySelector(`input[name="mode"][value="${s.mode}"]`); if (r) r.checked = true; }
  if (s.me) { const r = document.querySelector(`input[name="character"][value="${s.me}"]`); if (r) r.checked = true; }
} catch {}
$("#open").addEventListener("change", show);
$("#joinbtn").addEventListener("click", () => {
  const c = (prompt("Room code (4 letters)") || "").trim().toUpperCase();
  if (/^[A-Z]{4}$/.test(c)) location.href = `/play/${c}`;
  else if (c) $("#toast").textContent = "A room code is four letters.";
});
show();
