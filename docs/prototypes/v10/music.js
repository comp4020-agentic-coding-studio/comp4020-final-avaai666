/* ================================================================ sound: an original score in D gong mode, played by code */
const Music = (() => {
  let ctx = null, master, music, sfx, amb, on = true, timer = null, nextT = 0, step = 0, mood = "calm", bpm = 84;
  try { const v = localStorage.getItem("nynf-sound"); if (v === "off") on = false; } catch (e) {}
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const GONG = [62, 64, 66, 69, 71], YU = [59, 62, 64, 66, 69]; // D E F# A B / B D E F# A
  const scaleNote = (sc, deg) => sc[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);
  const ks = new Map();
  function pluckBuf(f) {
    const key = Math.round(f); if (ks.has(key)) return ks.get(key);
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.2), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), N = Math.max(2, Math.round(sr / f));
    const line = new Float32Array(N); for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
    let p = 0; const decay = .996;
    for (let i = 0; i < len; i++) { const a = line[p], b = line[(p + 1) % N]; d[i] = a; line[p] = (a + b) * .5 * decay; p = (p + 1) % N; }
    ks.set(key, buf); return buf;
  }
  function pluck(n, when, vel = .5, dest = music) {
    const s = ctx.createBufferSource(); s.buffer = pluckBuf(midi(n)); const g = ctx.createGain(); g.gain.value = vel;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; s.connect(lp).connect(g).connect(dest); s.start(when);
  }
  function flute(n, when, dur, vel = .14) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "triangle"; o2.type = "sine"; o.frequency.value = midi(n); o2.frequency.value = midi(n) * 2; lfo.frequency.value = 5.2; lg.gain.value = midi(n) * .006;
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const g2 = ctx.createGain(); g2.gain.value = .25; o2.connect(g2).connect(g); o.connect(g); g.connect(music);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vel, when + .09); g.gain.setValueAtTime(vel, when + dur - .12); g.gain.linearRampToValueAtTime(0, when + dur + .15);
    [o, o2, lfo].forEach(x => { x.start(when); x.stop(when + dur + .2); });
  }
  function block(when, vel = .25, f = 1100) { // 木鱼, the wooden fish
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f, when); o.frequency.exponentialRampToValueAtTime(f * .6, when + .06);
    g.gain.setValueAtTime(vel, when); g.gain.exponentialRampToValueAtTime(.001, when + .09); o.connect(g).connect(music); o.start(when); o.stop(when + .1);
  }
  function drum(when, vel = .5) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, when); o.frequency.exponentialRampToValueAtTime(48, when + .22);
    g.gain.setValueAtTime(vel, when); g.gain.exponentialRampToValueAtTime(.001, when + .4); o.connect(g).connect(music); o.start(when); o.stop(when + .45);
  }
  function gong(when, vel = .5) { // 锣
    [1, 1.47, 2.09, 2.76, 3.4].forEach((r, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 196 * r; o.frequency.exponentialRampToValueAtTime(196 * r * .985, when + 3);
      g.gain.setValueAtTime(vel / (i + 1.3), when); g.gain.exponentialRampToValueAtTime(.0005, when + 3.2 - i * .3); o.connect(g).connect(sfx); o.start(when); o.stop(when + 3.3); });
  }
  let noiseBuf = null;
  function noise(when, dur, f, q, vel, dest = sfx) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, when); g.gain.exponentialRampToValueAtTime(.001, when + dur); s.connect(bp).connect(g).connect(dest); s.start(when, Math.random()); s.stop(when + dur + .05);
  }
  function startAmbience() {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = .045; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .13; lg.gain.value = .025; lfo.connect(lg).connect(g.gain);
    s.connect(lp).connect(g).connect(amb); s.start(); lfo.start();
    const pad = [38, 45, 50].map((n) => { const o = ctx.createOscillator(), pg = ctx.createGain(); o.type = "sine"; o.frequency.value = midi(n); pg.gain.value = .018; o.connect(pg).connect(music); o.start(); return o; });
  }
  function bird(when) { const o = ctx.createOscillator(), g = ctx.createGain(), f = 2600 + Math.random() * 900; o.frequency.setValueAtTime(f, when); o.frequency.exponentialRampToValueAtTime(f * 1.35, when + .07); o.frequency.exponentialRampToValueAtTime(f * .9, when + .13);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(.03, when + .02); g.gain.exponentialRampToValueAtTime(.001, when + .16); o.connect(g).connect(amb); o.start(when); o.stop(when + .2); }
  // phrases (scale degrees) for the flute, written by hand
  const MOTIFS = [[0, 1, 2, 4, 3, 2], [2, 4, 5, 4, 2, 1], [4, 5, 7, 5, 4, 2], [2, 1, 0, -1, 0]];
  const BAD = [[4, 3, 2, 0], [2, 1, 0, -1], [0, -1, -3, -2]];
  const CHORDS = [[0, 2, 4], [-1, 2, 4], [1, 3, 5], [0, 3, 4]];
  function tick() {
    const spb = 60 / bpm / 2; // eighth notes
    while (nextT < ctx.currentTime + .15) {
      const s = step, bar = Math.floor(s / 8), i = s % 8, sc = mood === "bad" ? YU : GONG, ch = CHORDS[bar % 4];
      if (mood === "calm" || mood === "market" || mood === "spring") {
        const deg = ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + (i >= 4 ? 5 : 0);
        if (mood !== "spring" || i % 2 === 0) pluck(scaleNote(sc, deg) - (mood === "spring" ? -12 : 0), nextT, mood === "market" ? .32 : .26);
        if (i === 0) pluck(scaleNote(sc, ch[0]) - 12, nextT, .4);
        if (mood === "market" && i % 2 === 1) block(nextT, .1, 1500);
        if (mood === "calm" && bar % 2 === 1 && i === 0) { const m = MOTIFS[(bar >> 1) % MOTIFS.length]; m.forEach((d, k) => flute(scaleNote(sc, d + 5), nextT + k * spb, spb * .95, .1)); }
        if (mood === "spring" && Math.random() < .25) bird(nextT + Math.random() * spb);
      } else if (mood === "rush") {
        const deg = ch[i % 3] + (i % 4 === 3 ? 5 : 0); pluck(scaleNote(sc, deg) + 12, nextT, .3);
        if (i % 2 === 0) drum(nextT, i === 0 ? .55 : .3); block(nextT + spb / 2, .14);
      } else if (mood === "tension" || mood === "meeting") {
        const yu = YU; if (i === 0 || i === 3) drum(nextT, i === 0 ? .42 : .22);
        if (mood === "meeting" && i % 2 === 0) block(nextT, .12, 900);
        if (i === 4 && bar % 2 === 0) pluck(scaleNote(yu, [0, 2, 1, -1][bar % 4]) - 12, nextT, .35);
        if (mood === "tension" && i === 6 && bar % 4 === 3) flute(scaleNote(yu, 7), nextT, spb * 3, .07);
      } else if (mood === "party") {
        const deg = ch[[0, 1, 2, 1][i % 4]] + (i >= 4 ? 5 : 0); pluck(scaleNote(sc, deg) + 12, nextT, .28);
        if (i % 4 === 0) drum(nextT, .4); if (i % 2 === 1) block(nextT, .12, 1400);
      } else if (mood === "night") {
        if (i === 0) { pluck(scaleNote(sc, ch[0]) - 12, nextT, .35); const m = MOTIFS[bar % 4]; if (bar % 2 === 0) m.forEach((d, k) => flute(scaleNote(sc, d + 5), nextT + k * spb * 2, spb * 1.9, .08)); }
      } else if (mood === "good" || mood === "bad") {
        if (i === 0) { pluck(scaleNote(sc, ch[0]) - 12, nextT, .45); const m = (mood === "bad" ? BAD : MOTIFS)[bar % (mood === "bad" ? 3 : 4)]; m.forEach((d, k) => flute(scaleNote(sc, d + 5), nextT + k * spb * 2, spb * 1.9, .1)); }
        if (i % 2 === 0) pluck(scaleNote(sc, ch[(i / 2) % 3] + 5), nextT, .18);
      }
      nextT += spb; step++;
    }
  }
  return {
    get on() { return on; },
    start() {
      if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ctx.createGain(); master.gain.value = on ? .9 : 0; master.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = .55; music.connect(master); sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master); amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 + (Math.random() * 2 - 1) * .15; }
      startAmbience(); nextT = ctx.currentTime + .1; timer = setInterval(tick, 30);
    },
    toggle() { on = !on; try { localStorage.setItem("nynf-sound", on ? "on" : "off"); } catch (e) {} if (master) master.gain.setTargetAtTime(on ? .9 : 0, ctx.currentTime, .05); return on; },
    mood(m) { if (m === mood) return; mood = m; bpm = { calm: 84, rush: 132, market: 100, spring: 72, good: 66, bad: 56, tension: 70, meeting: 92, party: 120, night: 60 }[m] ?? 84; },
    catchNote(k) { if (!ctx) return; const n = scaleNote(GONG, 5 + Math.min(k, 9)); pluck(n + 12, ctx.currentTime, .45, sfx); },
    splash() { if (ctx) noise(ctx.currentTime, .25, 900, .7, .35); },
    thud() { if (ctx) { drum(ctx.currentTime, .9); noise(ctx.currentTime, .2, 300, .8, .5); } },
    coin(k) { if (ctx) pluck(scaleNote(GONG, 7 + (k % 5)) + 12, ctx.currentTime, .3, sfx); },
    gong() { if (ctx) gong(ctx.currentTime, .6); },
    chime() { if (!ctx) return; [0, 2, 4].forEach((d, k) => pluck(scaleNote(GONG, d + 10), ctx.currentTime + k * .08, .35, sfx)); },
    tick() { if (ctx) block(ctx.currentTime, .3, 1300); },
    reveal() { if (!ctx) return; drum(ctx.currentTime, .9); gong(ctx.currentTime + .05, .35); },
    bad() { if (!ctx) return; [0, -1, -3].forEach((d, k) => pluck(scaleNote(YU, d + 5), ctx.currentTime + k * .14, .4, sfx)); },
    stamp() { if (ctx) { drum(ctx.currentTime, 1); block(ctx.currentTime + .05, .4, 600); } },
  };
})();
