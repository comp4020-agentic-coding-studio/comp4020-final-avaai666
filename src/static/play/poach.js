// Who's Poaching on /play: draws what the server sent this seat (its own
// role only, its own basket, what it inspected) and sends only steer, cast,
// buoy, inspect, the poacher's fine net, dump and plant, set phrases and a
// vote. No free text: the meeting is set phrases and people talking.
const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
const BAYS = ["North Bay", "East Bay", "South Bay", "West Bay"];
const ROLE_TEXT = {
  fisher: ["Fisher", "Fish for the village quota. Find the poacher before the lake drops below 40%."],
  warden: ["Warden", "You are a fisher who may inspect one boat a day from anywhere: tap PATROL."],
  poacher: ["Poacher", "Your fine net is fast and takes fry: the lake suffers. Dump fry to hide them, or plant them on someone. Survive day 3."],
};

export function mount({ world, sound, ui, send, view }) {
  let prev = null, cur = null, curAt = 0, seats = null, target = null, inspectHeld = false, plantHeld = false;
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const nameOf = (seat) => (seat === me() ? "You" : seats?.[seat]?.name ?? `Boat ${seat + 1}`);
  const named = (text) => text.replace(/\{seat(\d+)\}/g, (_, n) => nameOf(Number(n)));
  const $ = (id) => document.getElementById(id);
  world.setCamera([-30, 34, 50], [0, 0, 0]);
  ui.hud.innerHTML = `
    <div class="card role role-card" id="p-role"><div class="frame" id="p-face"></div><div><h4>Your role · only you see this</h4><div class="big" style="font-size:22px" id="p-rolename">…</div><p class="small" id="p-roletext"></p></div></div>
    <div class="card"><div class="row"><h4>Village quota</h4><b id="p-quota">0 / 60</b></div><div class="bar"><i id="p-quotabar" style="width:0%"></i></div>
      <div class="row" style="margin-top:6px"><h4>Lake health</h4><b id="p-health">100%</b></div><div class="bar"><i id="p-healthbar" style="width:100%;background:#e8b84d"></i></div><p class="small">Line: 40%. Below it, the poacher wins.</p></div>
    <div class="card" id="p-basket"><h4>Your basket</h4><p class="small" style="margin:0" id="p-mine"></p><p class="small" id="p-seen"></p></div>
    <div class="pads dock" id="p-pads"></div>`;
  const meetingEl = document.createElement("div"); meetingEl.className = "meeting"; meetingEl.hidden = true; document.body.appendChild(meetingEl);
  const seen = []; // inspection results this seat got (only its own)

  // ---- input ----
  const canvas = document.getElementById("gl");
  let lastSteer = 0, dragging = false;
  const boatAt = (p) => { if (!cur) return null; let best = null, bd = 45; for (const b of cur.b) { if (b[0] === me() || b[4]) continue; const d = Math.hypot(b[1] - p[0], b[2] - p[1]); if (d < bd) { bd = d; best = b[0]; } } return best; };
  const steerTo = (e, first) => {
    const p = world.screenToSim(e.clientX, e.clientY); if (!p || me() === null || cur?.phase !== "day") return;
    if (first) { const t = boatAt(p); if (t !== null) { target = t; renderPads(); ui.did("pick"); } }
    const t = performance.now(); if (t - lastSteer < 90) return; lastSteer = t;
    send({ k: "steer", x: p[0], y: p[1] }); world.ripple(p[0], p[1], colorOf(me()), 2, .5); ui.did("sail");
  };
  const onDown = (e) => { dragging = true; steerTo(e, true); }, onMove = (e) => { if (dragging) steerTo(e, false); }, onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); addEventListener("pointerup", onUp);
  // inspecting and planting are held: the server counts the seconds while the input keeps coming
  const hold = setInterval(() => {
    if (cur?.phase !== "day" || target === null) return;
    if (inspectHeld) send({ k: "inspect", target });
    if (plantHeld) send({ k: "plant", target });
  }, 50);
  function renderPads() {
    const f = cur, pads = $("p-pads"); if (!f || !pads) return;
    if (f.phase !== "day" || me() === null || f.out[me()]) { pads.innerHTML = ""; return; }
    const t = target !== null ? nameOf(target) : null;
    const role = f.role;
    pads.innerHTML = `<button class="pad" type="button" data-a="cast">CAST</button>
      <button class="pad" type="button" data-a="inspect" ${t ? "" : "disabled"}>${t ? `LOOK at ${ui.esc(t)}` : "tap a boat to LOOK"}<br><small>hold 3 s alongside</small></button>
      <button class="pad" type="button" data-a="buoy" ${f.mine?.buoyUsed ? "disabled" : ""}>BUOY</button>
      ${role === "warden" ? `<button class="pad" type="button" data-a="patrol" ${t && !f.mine?.patrolled ? "" : "disabled"}>PATROL</button>` : ""}
      ${role === "poacher" ? `<button class="pad red" type="button" data-a="fine">FINE NET</button><button class="pad red" type="button" data-a="dump" ${f.mine?.fry ? "" : "disabled"}>DUMP</button><button class="pad red" type="button" data-a="plant" ${t && f.mine?.fry ? "" : "disabled"}>PLANT</button>` : ""}`;
  }
  const padsEl = $("p-pads");
  padsEl.addEventListener("pointerdown", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "inspect") { inspectHeld = true; ui.did("inspect"); }
    else if (a === "plant") plantHeld = true;
    else if (a === "patrol") send({ k: "patrol", target });
    else { send({ k: a }); ui.did(a); }
  });
  const release = () => { inspectHeld = false; plantHeld = false; };
  padsEl.addEventListener("pointerup", release); padsEl.addEventListener("pointerleave", release);
  const onKey = (e) => { if (e.code === "Space" && e.type === "keydown" && cur?.phase === "day") { e.preventDefault(); send({ k: "cast" }); ui.did("cast"); } };
  addEventListener("keydown", onKey);

  // ---- the meeting: portraits round a table, set phrases, a vote ----
  let phrase = { p: "was", bay: BAYS[0], target: null, fry: 0 };
  function renderMeeting() {
    const f = cur; if (!f) return;
    if (f.phase !== "meeting" && f.phase !== "dusk") { meetingEl.hidden = true; return; }
    meetingEl.hidden = false;
    const others = f.b.filter((b) => b[0] !== me() && !b[4]).map((b) => b[0]);
    const said = new Map(); for (const s of f.said) said.set(s.seat, named(s.text));
    const myVote = f.voted?.[me()];
    const sel = (opts, cur, key) => `<select data-k="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${ui.esc(l)}</option>`).join("")}</select>`;
    const builder = me() === null || f.out[me()] || f.phase !== "meeting" ? "" : `<div class="card"><h4>Say (set phrases only; it may be true or not)</h4>
      <div class="chips">
        <span>I was in ${sel(BAYS.map((b) => [b, b]), phrase.bay, "bay")}</span><button class="chipbtn" data-say="was">Say it</button>
      </div><div class="chips" style="margin-top:6px">
        <span>I inspected ${sel(others.map((o) => [o, nameOf(o)]), phrase.target ?? others[0], "target")}: ${sel([[0, "clean"], ...[1, 2, 3, 4, 5, 6, 8, 10].map((n) => [n, `${n} fry`])], phrase.fry, "fry")}</span><button class="chipbtn" data-say="inspected">Say it</button>
      </div><div class="chips" style="margin-top:6px">
        <button class="chipbtn" data-say="suspect">I suspect ${ui.esc(nameOf(phrase.target ?? others[0]))}</button><button class="chipbtn" data-say="vouch">I vouch for ${ui.esc(nameOf(phrase.target ?? others[0]))}</button><button class="chipbtn" data-say="skip">Skip</button>
      </div></div>
      <div class="card"><h4>Vote ${myVote ? "· your vote is in" : f.canSkip ? "· a tie or skips exile nobody, and cost the lake 5" : "· the most votes go; a tie is drawn"}</h4><div class="chips">${others.map((o) => `<button class="chipbtn vote" data-vote="${o}" ${myVote ? "disabled" : ""}>Exile ${ui.esc(nameOf(o))}</button>`).join("")}${f.canSkip ? `<button class="chipbtn" data-vote="skip" ${myVote ? "disabled" : ""}>Skip</button>` : `<small>Last meeting: no Skip. The village must choose.</small>`}</div></div>`;
    const dusk = f.phase === "dusk" ? `<p class="verdict">Evening, day ${f.day}. ${ui.esc(lastDusk ?? "")}</p>` : "";
    meetingEl.innerHTML = `<div class="meeting-in"><header><h3>Village meeting, day ${f.day}<span lang="zh">村会</span></h3><b>${Math.ceil(f.left)} s</b></header>
      ${dusk}
      <div class="table">${f.b.map((b) => { const s = seats?.[b[0]]; return `<div class="seat ${b[4] ? "out" : ""} ${said.has(b[0]) ? "speaking" : ""}"><div class="frame">${ui.portrait(s?.character ?? "mei", s?.name ?? "")}</div><div><b>${ui.esc(nameOf(b[0]))}${b[4] ? ` · out (${ui.esc(f.known.find((k) => k.seat === b[0])?.role ?? "")})` : ""}</b><div class="say">${ui.esc(said.get(b[0]) ?? "")}</div>${f.voted?.[b[0]] ? "<small>voted</small>" : ""}</div></div>`; }).join("")}</div>
      ${f.buoys.length ? `<div class="card"><h4>Buoy logs (who passed each buoy today)</h4>${f.buoys.map((u) => `<p class="small" style="margin:0">${ui.esc(nameOf(u.seat))}'s buoy in ${bay(u.x, u.y)}: ${u.passed.length ? u.passed.map((x) => ui.esc(nameOf(x))).join(", ") : "nobody"}</p>`).join("")}</div>` : ""}
      ${seen.length ? `<div class="card"><h4>What you saw (only you)</h4>${seen.map((x) => `<p class="small" style="margin:0">Day ${x.day}: ${ui.esc(nameOf(x.target))}'s basket held ${x.fish} fish and ${x.fry ? `<b style="color:var(--gold)">${x.fry} fry</b>` : "no fry"}.</p>`).join("")}</div>` : ""}
      ${builder}</div>`;
  }
  meetingEl.addEventListener("change", (e) => { const k = e.target.dataset.k; if (!k) return; phrase[k] = k === "bay" ? e.target.value : Number(e.target.value); renderMeeting(); });
  meetingEl.addEventListener("click", (e) => {
    const s = e.target.closest("[data-say]")?.dataset.say, v = e.target.closest("[data-vote]")?.dataset.vote;
    const others = cur.b.filter((b) => b[0] !== me() && !b[4]).map((b) => b[0]);
    const t = phrase.target ?? others[0];
    if (s === "was") send({ k: "say", p: "was", bay: phrase.bay });
    if (s === "inspected") send({ k: "say", p: "inspected", target: t, fry: phrase.fry });
    if (s === "suspect" || s === "vouch") send({ k: "say", p: s, target: t });
    if (s === "skip") send({ k: "say", p: "skip" });
    if (v !== undefined) { send({ k: "vote", target: v === "skip" ? null : Number(v) }); ui.did("vote"); }
  });
  const bay = (x, y) => { const a = Math.atan2((y - 350) / 315, (x - 500) / 460); return a > -Math.PI / 4 && a <= Math.PI / 4 ? "East Bay" : a > Math.PI / 4 && a <= 3 * Math.PI / 4 ? "South Bay" : a > -3 * Math.PI / 4 && a <= -Math.PI / 4 ? "North Bay" : "West Bay"; };

  // ---- events ----
  let lastDusk = null;
  function events(ev) {
    for (const e of ev) {
      if (e.k === "catch") { if (e.n) world.floatText(e.x, e.y, `+${e.n}`, colorOf(e.seat)); world.netDrop(e.x, e.y, 36, colorOf(e.seat), .7); if (e.seat === me()) e.n ? sound.catch(e.n) : sound.miss(); }
      if (e.k === "fry") { ui.banner(`${e.fry} fry in your basket`, "evidence: dump them, or plant them on someone"); }
      if (e.k === "dumped") ui.banner(`You dumped ${e.fry} fry`, "the evidence is gone; the fry still died");
      if (e.k === "inspected") { seen.push({ day: cur?.day, target: e.target, fish: e.fish, fry: e.fry }); ui.banner(`${nameOf(e.target)}'s basket: ${e.fry ? `${e.fry} fry` : "clean"}`, `only you saw this${e.patrol ? " (patrol)" : ""}`, 3200); sound.big(); }
      if (e.k === "looked") { ui.banner("Someone looked in your basket", "you don't know who"); sound.hit(); world.shake(); }
      if (e.k === "splash") { world.ripple(e.x, e.y, "#ffffff", 6); ui.banner("A splash beside a boat", `near ${nameOf(e.near)}: someone put something in a basket`, 3000); sound.hit(); }
      if (e.k === "buoy") world.ripple(e.x, e.y, colorOf(e.seat), 3);
      if (e.k === "dusk") { lastDusk = `Fry lost today: ${Object.entries(e.bays).map(([b, n]) => `${b} ${n}`).join(", ")}. Lake health ${Math.round(e.health)}%.`; ui.banner(`Evening, day ${e.day}`, lastDusk, 4000); sound.horn(); }
      if (e.k === "meeting") { ui.banner("The village meets", "set phrases, then a vote"); }
      if (e.k === "said") sound.tick();
      if (e.k === "exiled") { ui.banner(`${nameOf(e.seat)} is exiled`, `they were a ${e.role}`, 4000); sound.big(); world.shake(); }
      if (e.k === "noexile") ui.banner("Nobody is exiled", `the poacher worked the night unwatched: the lake lost ${e.cost} points of health`, 4000);
      if (e.k === "dawn") { ui.banner(`Day ${e.day}`, "back on the water"); target = null; }
      if (e.k === "end") { sound.horn(); ui.banner(e.winner === "fishers" ? "The fishers win" : "The poacher wins", "", 3000); }
    }
  }

  function hudFrom(f) {
    ui.setClock(f.left, f.phase === "day" ? `Day ${f.day} of ${f.days}` : f.phase === "meeting" ? "Meeting" : "Evening");
    ui.goalEl.textContent = f.role === "poacher" ? "Poacher: survive day 3, or sink the lake below 40%" : "Find the poacher · keep the lake above 40%";
    const r = ROLE_TEXT[f.role] ?? ["Watching", "You are not in this match."];
    $("p-rolename").textContent = r[0] + (f.partners?.length ? ` (with ${f.partners.map(nameOf).join(", ")})` : "");
    $("p-roletext").textContent = r[1];
    $("p-role").classList.toggle("poacher", f.role === "poacher");
    if (me() !== null && seats) $("p-face").innerHTML = ui.portrait(seats[me()]?.character ?? "mei", "");
    $("p-quota").textContent = `${f.quota} / ${f.quotaGoal}`; $("p-quotabar").style.width = `${Math.min(100, f.quota / f.quotaGoal * 100)}%`;
    $("p-health").textContent = `${Math.round(f.health)}%`; $("p-healthbar").style.width = `${f.health}%`; $("p-healthbar").style.background = f.health < 55 ? "#ff7a5a" : "#e8b84d";
    $("p-mine").textContent = f.mine ? `${f.mine.fish} fish${f.mine.fry ? `, ${f.mine.fry} fry` : ""}${f.mine.inspecting ? ` · looking… ${f.mine.inspecting.t.toFixed(1)} / 3 s` : ""}${f.mine.planting !== null ? ` · planting… ${f.mine.planting.toFixed(1)} / 2 s` : ""}` : "";
    $("p-seen").textContent = seen.length ? `You have looked in ${seen.length} basket${seen.length > 1 ? "s" : ""}.` : "";
    renderPads(); renderMeeting();
  }

  function coach() {
    if (!cur || cur.phase !== "day" || me() === null) return;
    ui.coach([
      ["sail", "Tap the water to sail"],
      ["cast", "Fish ahead: tap CAST to fill the quota", () => true],
      ["pick", "Tap another boat to pick it, then hold LOOK beside it"],
      ["fine", "You are the poacher: FINE NET is fast but kills fry", () => cur.role === "poacher"],
    ]);
  }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) { seats = v.seats; prev = cur = frame; curAt = performance.now(); seen.length = 0; for (const b of frame.b) world.boat(b[0], colorOf(b[0]), nameOf(b[0])); world.setDocks([]); world.onFrame(draw); hudFrom(frame); },
    frame(f, ev) { seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now(); events(ev); hudFrom(f); coach(); },
    end() { canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("keydown", onKey); clearInterval(hold); meetingEl.remove(); },
  };

  function draw(dt, t) {
    if (!cur) return;
    const k = Math.min(1, (performance.now() - curAt) / 100), lerp = (a, b) => a + (b - a) * k;
    world.setNight(cur.phase === "day" ? .15 : .8);
    for (const b of cur.b) {
      const p = prev.b[b[0]] ?? b, bt = world.boat(b[0], colorOf(b[0]), `${nameOf(b[0])}${b[4] ? " (out)" : ""}${b[0] === target ? " ◎" : ""}`);
      bt.tag.classList.toggle("me", b[0] === me());
      world.drawBoat(bt, lerp(p[1], b[1]), lerp(p[2], b[2]), b[3] / 100, t, { visible: !b[4], hold: 0, lantern: cur.phase !== "day" });
    }
    world.setFish(cur.f.map((f) => [f[0], f[1], f[2] / 100, f[3] ? 1 : .55]), t);
    for (const u of cur.buoys) { const m = world.prop(`buoy${u.seat}`, () => { const g = world.makeLantern(.5); return g; }); m.position.set((u.x - 500) / 10, 1 + Math.sin(t * 2) * .2, (u.y - 350) / 10); }
    world.sweepProps();
  }
}
