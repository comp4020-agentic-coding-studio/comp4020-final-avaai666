// Sound for /play: effects and a little music, all made here with Web Audio
// (no audio files, nothing generated at run time from outside). One page-level
// thing: room.js makes it once and every mode script gets it as `sound`.
//
// The music is a calm pentatonic tune on a plucked string over a soft drone and
// the sound of water; music("play") adds notes, music("rush") speeds it up for a
// final rush, music("calm") is for the end screen. It decides nothing.
//
// The button shows the current state ("Sound: on" / "Sound: off", aria-pressed).
// Sound is on unless the player turned it off; a browser lets audio start only
// after the first tap or key, so it starts then.

const PENTA = [0, 2, 4, 7, 9]; // gong shang jue zhi yu
const ROOT = 62; // D4
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export function createSound(button, words = { on: "Sound: on", off: "Sound: off", label: "Sound" }) {
  let on = true;
  try { on = localStorage.getItem("play-sound") !== "off"; } catch {}
  let ac = null, master = null, sfxBus = null, musicBus = null, comp = null;

  function ctx() {
    if (!on) return null;
    if (ac) { if (ac.state === "suspended") ac.resume().catch(() => {}); return ac; }
    try {
      ac = new AudioContext();
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
      master = ac.createGain(); master.gain.value = 0.9; master.connect(comp).connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = 0.0; musicBus.connect(master);
    } catch { ac = null; }
    return ac;
  }
  const label = () => {
    if (!button) return;
    button.textContent = on ? words.on : words.off;
    button.setAttribute("aria-pressed", String(on));
    if (words.label) button.setAttribute("aria-label", words.label);
  };
  label();
  button?.addEventListener("click", () => {
    on = !on;
    try { localStorage.setItem("play-sound", on ? "on" : "off"); } catch {}
    if (on) { ctx(); if (mood) startMusic(mood); } else stopMusic(true);
    label();
  });
  // a browser lets audio start only after a gesture
  const wake = () => { if (on && ctx() && mood && !musicT) startMusic(mood); };
  addEventListener("pointerdown", wake, { passive: true }); addEventListener("keydown", wake);

  // ---- building blocks ----
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(freq, type, t, peak, a, d, bus = sfxBus, detune = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    env(g, t, peak, a, d); o.connect(g).connect(bus); o.start(t); o.stop(t + a + d + 0.05); return o;
  }
  // a plucked string (a guzheng-like tone): a bright attack that darkens as it rings
  function pluck(freq, t, peak = 0.18, d = 1.2, bus = sfxBus) {
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(Math.min(9000, freq * 9), t); f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), t + d * 0.6);
    const g = ac.createGain(); env(g, t, peak, 0.004, d); f.connect(g).connect(bus);
    for (const [type, mul, det] of [["triangle", 1, 0], ["sawtooth", 1, 6], ["sine", 2, -4]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = freq * mul; o.detune.value = det;
      const og = ac.createGain(); og.gain.value = type === "sawtooth" ? 0.25 : type === "sine" ? 0.3 : 0.6;
      o.connect(og).connect(f); o.start(t); o.stop(t + d + 0.1);
    }
  }
  // a bell or a gong: a few inharmonic partials
  function bell(freq, t, peak = 0.12, d = 1.6, parts = [1, 2.76, 5.4]) { parts.forEach((p, i) => osc(freq * p, "sine", t, peak / (i + 1), 0.005, d / (i + 1))); }
  let noiseBuf = null;
  function noise(t, d, peak, type, freq, q = 1, bus = sfxBus) {
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); env(g, t, peak, 0.01, d); src.connect(f).connect(g).connect(bus); src.start(t, Math.random()); src.stop(t + d + 0.1);
    return { f, g };
  }
  const play = (fn) => () => { const c = ctx(); if (!c) return; fn(c.currentTime + 0.01); };
  const note = (step, oct = 0) => hz(ROOT + PENTA[((step % 5) + 5) % 5] + 12 * (oct + Math.floor(step / 5)));

  // ---- music ----
  let mood = null, musicT = 0, nextAt = 0, step = 0, walk = 2, drone = null, water = null;
  const MOODS = { calm: { bpm: 72, density: 0.35, vol: 0.32 }, play: { bpm: 92, density: 0.55, vol: 0.28 }, rush: { bpm: 132, density: 0.8, vol: 0.34 } };
  function startDrone() {
    if (drone) return;
    const g = ac.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 2);
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600; g.connect(f).connect(musicBus);
    const os = [hz(ROOT - 24), hz(ROOT - 17), hz(ROOT - 12)].map((fr, i) => { const o = ac.createOscillator(); o.type = i === 1 ? "triangle" : "sine"; o.frequency.value = fr; o.detune.value = i * 3; o.connect(g); o.start(); return o; });
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.02; lfo.connect(lg).connect(g.gain); lfo.start();
    drone = { g, os: [...os, lfo] };
    // water: soft filtered noise that swells and falls
    if (!noiseBuf) noise(ac.currentTime, 0.01, 0.0001, "lowpass", 100); // makes the noise buffer
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 500; wf.Q.value = 0.6;
    const wgain = ac.createGain(); wgain.gain.value = 0.018; src.connect(wf).connect(wgain).connect(musicBus); src.start();
    const wl = ac.createOscillator(), wg = ac.createGain(); wl.frequency.value = 0.11; wg.gain.value = 250; wl.connect(wg).connect(wf.frequency); wl.start();
    water = { src, wl };
  }
  function schedule() {
    const m = MOODS[mood]; if (!m || !ac) return;
    const beat = 60 / m.bpm / 2; // eighth notes
    while (nextAt < ac.currentTime + 0.35) {
      const bar = step % 16;
      if (bar === 0) pluck(note(0, -1), nextAt, 0.11, 2.4, musicBus); // the root, low, at each bar
      if (bar === 8 && Math.random() < 0.7) pluck(note(3, -1), nextAt, 0.08, 2, musicBus);
      if (Math.random() < m.density * (bar % 2 === 0 ? 1 : 0.5)) {
        walk = Math.max(0, Math.min(9, walk + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        pluck(note(walk, 0), nextAt, 0.07 + Math.random() * 0.04, mood === "rush" ? 0.6 : 1.3, musicBus);
      }
      if (mood === "rush" && bar % 4 === 0) noise(nextAt, 0.06, 0.05, "highpass", 6000, 0.7, musicBus); // a quick tick, for the rush
      if (bar === 12 && Math.random() < 0.25) bell(note(4, 1), nextAt, 0.025, 2.2); // a far chime, now and then
      nextAt += beat; step++;
    }
  }
  function startMusic(m) {
    mood = m;
    const c = ctx(); if (!c) return;
    startDrone();
    musicBus.gain.cancelScheduledValues(c.currentTime); musicBus.gain.setTargetAtTime(MOODS[m].vol, c.currentTime, 0.8);
    if (!musicT) { nextAt = c.currentTime + 0.1; musicT = setInterval(schedule, 100); }
  }
  function stopMusic(off = false) {
    clearInterval(musicT); musicT = 0;
    if (ac && musicBus) musicBus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
    if (off && drone) { const d = drone, w = water; setTimeout(() => { d.os.forEach((o) => { try { o.stop(); } catch {} }); try { w.src.stop(); w.wl.stop(); } catch {} }, 1500); drone = null; water = null; }
  }

  return {
    // music("calm" | "play" | "rush"), or music(null) to stop
    music(m) { if (m === null) { mood = null; stopMusic(); return; } if (m === mood && musicT) return; mood = m; if (on) startMusic(m); },
    catch: (n = 1) => { const c = ctx(); if (!c) return; const t = c.currentTime + 0.01; for (let i = 0; i < Math.min(n, 5); i++) pluck(note(2 + i, 1), t + i * 0.055, 0.14, 0.5); },
    coin: play((t) => { bell(hz(88), t, 0.07, 0.35, [1, 2.4]); bell(hz(93), t + 0.07, 0.07, 0.5, [1, 2.4]); }),
    bank: play((t) => { [0, 2, 4].forEach((s, i) => pluck(note(s, 1), t + i * 0.08, 0.15, 0.7)); bell(note(4, 1), t + 0.24, 0.05, 1); }),
    hit: play((t) => { osc(90, "sine", t, 0.4, 0.005, 0.35); osc(140, "triangle", t, 0.15, 0.005, 0.18); noise(t, 0.2, 0.25, "lowpass", 900); }),
    miss: play((t) => { pluck(note(0, 0), t, 0.08, 0.35); osc(hz(ROOT - 5), "sine", t + 0.06, 0.06, 0.01, 0.3); }),
    horn: play((t) => { bell(hz(43), t, 0.35, 3.2, [1, 1.48, 2.02, 2.74]); noise(t, 0.6, 0.06, "bandpass", 300, 2); }), // a gong
    big: play((t) => { [0, 2, 3, 5].forEach((s, i) => pluck(note(s, 1), t + i * 0.09, 0.15, 0.9)); bell(note(0, 2), t + 0.36, 0.05, 1.4); }),
    tick: play((t) => { osc(1800, "square", t, 0.03, 0.002, 0.03); }),
    splash: play((t) => { const n = noise(t, 0.35, 0.18, "bandpass", 1400, 0.8); n.f.frequency.exponentialRampToValueAtTime(400, t + 0.3); }),
    chime: play((t) => { bell(note(3, 1), t, 0.06, 1.6); bell(note(0, 2), t + 0.12, 0.04, 1.8); }),
  };
}
