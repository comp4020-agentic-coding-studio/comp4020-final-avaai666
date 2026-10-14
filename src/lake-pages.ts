// Server-rendered lake pages (DESIGN.md v2.2, "Pages and routes"): the home
// page, the lobby before a season starts, the live page's shell, and the
// debrief after the end row. The live page is drawn by /static/lake.js from
// the snapshot embedded here and the event stream; everything this file
// writes is also readable without the script. Everything typed is escaped.
// Pictures (portraits, houses, the carp print) are drawn by lake.js into
// the [data-art] placeholders, so they live in one place.
import { CAP_PER_FAMILY, FISH_S, HOUSE_PARTS, MEET_S, START_FRAC, YEARS } from "./lib/game-constants.ts";
import { esc, time } from "./pages.ts";
import type { PublicRow, Snapshot } from "./lib/lake-runner.ts";

const PART_ZH = ["茅屋", "瓦房", "红门", "灯笼", "楼", "宝塔"];
const RULE_WORDS: Record<string, { g: string; name: string }> = {
  none: { g: "无", name: "no rule" },
  ban: { g: "禁", name: "fine nets banned" },
  spring: { g: "休", name: "no fishing in spring" },
  nursery: { g: "护", name: "the shallows protected" },
};
const SEAL_WORDS: Record<string, string> = { 赞: "thanks", 求: "please", 怒: "stop that", 喜: "cheers" };
const BOT_KIND: Record<string, string> = { Jin: "jin", Mei: "mei", "Old Wang": "wang" };
const YEAR_STEPS = (FISH_S + MEET_S) * 10;

const yearOf = (step: number | null): number => Math.min(YEARS, Math.floor((step ?? 0) / YEAR_STEPS) + 1);
const startCount = (families: number): number => Math.round(CAP_PER_FAMILY * families * START_FRAC);
const partName = (i: number): string => (i === 0 ? "thatched hut" : HOUSE_PARTS[i].name);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// JSON inside a <script> element: "<" can never close it.
const scriptJson = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c");

function rowWords(r: PublicRow, nameOf: (seat: number | null) => string): string {
  const who = nameOf(r.seat);
  const d = (r.data ?? {}) as Record<string, unknown>;
  switch (r.kind) {
    case "open":
      return "The lake was opened";
    case "join":
      return `${who} joined`;
    case "start":
      return "The season started";
    case "throw":
      return `${who} threw a ${d.fine ? "fine" : "coarse"} net${d.breach ? " (a breach)" : ""}`;
    case "haul":
      return d.got ? `${who}'s net took ${d.got} fish${d.koi ? " and the golden carp" : ""}` : `${who}'s net came up empty`;
    case "buy":
      return `${who} bought a fine net`;
    case "ask":
      return `${who} asked ${nameOf(d.to as number)}: coarse nets only, until winter?`;
    case "answer":
      return `${who} ${d.yes ? "promised" : "said no to"} ${nameOf(d.from as number)}`;
    case "broken":
      return `${who} broke a promise to ${nameOf(d.to as number)}`;
    case "seal":
      return `${who} sent ${nameOf(d.to as number)} ${d.seal} (${SEAL_WORDS[d.seal as string] ?? ""})`;
    case "vote":
      return `${who} voted: ${RULE_WORDS[d.rule as string]?.name ?? d.rule}`;
    case "build":
      return (d.parts as string[]).length ? `${who} built ${(d.parts as string[]).join(" and ")}` : `${who} built nothing new`;
    case "rule":
      return `The village chose: ${RULE_WORDS[d.rule as string]?.name ?? d.rule}`;
    case "end":
      return "The season ended";
  }
}

function page(title: string, body: string, bodyClass = ""): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&amp;family=Fraunces:opsz,wght@9..144,600;9..144,800;9..144,900&amp;family=Nunito:wght@400;600;800;900&amp;family=IBM+Plex+Mono:wght@500&amp;display=swap" />
    <link rel="stylesheet" href="/static/lake.css" />
    <script src="/static/lake.js" defer></script>
  </head>
  <body class="nynf ${bodyClass}">
    ${body}
  </body>
</html>
`;
}

function topBar(code: string | null, extra = ""): string {
  return `<header class="bar">
      <a class="seal" href="/" aria-label="Next Year, No Fish: home">明年无鱼</a>
      <div class="titles"><span class="title-en">Next Year, No Fish</span><span class="sub">${code ? `Lake <b class="code">${esc(code)}</b>` : "A fishing game for one table"}</span></div>
      ${extra}
    </header>`;
}

const HOW = `<div class="how">
      <div><b>Throw <i class="zh">撒网</i></b>Tap the water. Every grown fish inside your ring is yours.</div>
      <div><b>Build <i class="zh">盖房</i></b>Each winter your basket goes into your house.</div>
      <div><b>Spring <i class="zh">春</i></b>Two fish that meet lay eggs. Fry grow up by next year.</div>
      <div><b>Winter <i class="zh">冬</i></b>The lake freezes and the village may agree on a rule.</div>
    </div>`;

// ---------------------------------------------------------------- home

export function lakeHomePage(pastLakes: { code: string; openedAt: number }[]): string {
  const rows = pastLakes
    .map((l) => `<tr><td><a href="/l/${esc(l.code)}">${esc(l.code)}</a></td><td>${time(l.openedAt)}</td></tr>`)
    .join("");
  const table = pastLakes.length
    ? `<table>
        <caption>Past lakes: open one to see how it went</caption>
        <thead><tr><th scope="col">Lake</th><th scope="col">Opened</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : "<p>No lakes yet.</p>";
  return page(
    "Next Year, No Fish",
    `${topBar(null)}
    <main class="home">
      <section class="card hero">
        <div class="print">
          <svg viewBox="0 0 160 200" data-art="carp" aria-hidden="true"></svg>
          <div>
            <p class="eyebrow">Up to eight families · one lake · five years · about five minutes</p>
            <h1 class="goal">Grow your family's house. The fish in the lake belong to everyone.</h1>
            <p class="en">A fishing game for the people at one table. On New Year prints the carp stands for 年年有余, “fish to spare, every year”.</p>
          </div>
        </div>
        ${HOW}
        <div class="go">
          <form method="post" action="/lakes"><button class="cta" type="submit">Open a lake</button></form>
          <form class="join-code" id="join-code" action="/" method="get">
            <label for="code">or type a lake's code</label>
            <input id="code" name="code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="BKMT" pattern="[A-Za-z]{4}" required />
            <button class="btn" type="submit">Go</button>
          </form>
        </div>
      </section>
      <section class="card past">${table}</section>
      <p class="foot"><a class="newgame" href="/b">New and experimental: <b>Quick Catch</b>, boats on a shared lake →</a></p>
      <p class="foot"><a href="/readme/">About this game, and how it was made</a></p>
    </main>`,
    "page-home",
  );
}

// ---------------------------------------------------------------- views

export interface PreStartView {
  state: "pre";
  code: string;
  families: { seat: number; name: string }[];
  me: number | null;
  error?: string;
  rows: PublicRow[];
}

export interface LiveView {
  state: "live";
  code: string;
  snapshot: Snapshot;
  me: number | null;
}

export interface DoneView {
  state: "done";
  code: string;
  families: { seat: number; name: string; bot: boolean }[];
  end: { kept: number[]; parts: number[]; grownFish: number; nextYear: number; secret?: string; step?: number; years?: number[] };
  rows: PublicRow[];
  me: number | null;
}

export type LakeView = PreStartView | LiveView | DoneView;

const BOT_FILL = ["Jin", "Mei", "Old Wang"];
const kindOf = (f: { name: string; bot: boolean }): string => (f.bot ? (BOT_KIND[f.name] ?? "you") : "you");

function portrait(name: string, seat: number, bot: boolean, cls = ""): string {
  const kind = bot ? (BOT_KIND[name] ?? "you") : "you";
  return `<span class="pic ${cls}" data-art="portrait" data-kind="${kind}" data-seat="${seat}" data-mood="happy" aria-hidden="true"></span>`;
}

export function lakePage(v: LakeView): string {
  if (v.state === "pre") return prePage(v);
  if (v.state === "live") return livePage(v);
  return donePage(v);
}

// ---------------------------------------------------------------- lobby

function prePage(v: PreStartView): string {
  const joined = v.families
    .map(
      (f) =>
        `<li class="who${f.seat === v.me ? " me" : ""}">${portrait(f.name, f.seat, false)}<span>${esc(f.name)}${f.seat === v.me ? " <small>(you)</small>" : ""}</span></li>`,
    )
    .join("");
  const bots = BOT_FILL.slice(0, Math.max(0, 4 - v.families.length));
  const botNote = bots.length
    ? `If nobody else comes, ${bots.join(", ").replace(/, ([^,]*)$/, " and $1")} (bots) will fill the empty seats up to four.`
    : "No bots: you are four or more.";
  const errorLine = v.error ? `<p class="error" role="alert">${esc(v.error)}</p>` : "";
  const you =
    v.me === null
      ? v.families.length >= 8
        ? `<p>This lake already has eight families. You can watch once it starts.</p>`
        : `<form method="post" action="/l/${esc(v.code)}/join" class="joinform">
            <label for="name">Your family's name</label>
            <div class="row"><input id="name" name="name" required maxlength="24" autocomplete="nickname" placeholder="e.g. Liu" /><button class="cta" type="submit">Join</button></div>
            <small>1 to 24 characters. Everyone at the table sees it.</small>
          </form>
          ${errorLine}`
      : `<form method="post" action="/l/${esc(v.code)}/start" class="startform">
            <button class="cta" type="submit">Start the season</button>
            <small>Anyone who has joined can start. Wait until everyone at the table is in.</small>
          </form>`;
  return page(
    `Lake ${v.code} · Next Year, No Fish`,
    `${topBar(v.code)}
    <main class="lobby" data-lake="${esc(v.code)}" data-state="pre" data-families="${v.families.length}">
      <section class="card codecard">
        <p class="eyebrow">Everyone at the table opens</p>
        <p class="url"><span data-host>this site</span>/l/<b>${esc(v.code)}</b></p>
        <p class="bigcode" aria-label="Lake code ${esc(v.code).split("").join(" ")}">${esc(v.code)
          .split("")
          .map((c) => `<span>${c}</span>`)
          .join("")}</p>
        <p class="en">or types the code on the home page.</p>
      </section>
      <section class="card">
        <h2>Who has joined <span class="count" id="joined-count">${v.families.length} of 8</span></h2>
        <ul class="joined" id="families">${joined || '<li class="nobody">Nobody yet.</li>'}</ul>
        <p class="note">${botNote}</p>
        ${you}
      </section>
      <section class="card">
        <h2>How to play</h2>
        ${HOW}
        <p class="note">You can buy a fine net for 20 fish. It keeps everything in the ring, fry included. Nobody will tell you whether to.</p>
      </section>
    </main>`,
    "page-lobby",
  );
}

// ---------------------------------------------------------------- live

function livePage(v: LiveView): string {
  const s = v.snapshot;
  const nameOf = (seat: number | null): string => (seat === null ? "The village" : (s.families.find((f) => f.seat === seat)?.name ?? `seat ${seat}`));
  const me = v.me === null ? null : s.families.find((f) => f.seat === v.me);
  const recent = s.rows
    .filter((r) => !["open", "join", "throw", "haul"].includes(r.kind))
    .slice(-40)
    .reverse();
  const rows = recent.map((r) => `<li data-id="${r.id}"><span class="y">Y${yearOf(r.step)}</span><span>${esc(rowWords(r, nameOf))}</span></li>`).join("");
  const fams = s.families
    .map(
      (f) =>
        `<li class="fam${f.seat === v.me ? " me" : ""}" data-seat="${f.seat}">${esc(f.name)}${f.bot ? " (bot)" : ""}${f.seat === v.me ? " (you)" : ""}: basket ${f.basket}, ${partName(f.part)}${f.hasFine ? ", owns a fine net" : ""}</li>`,
    )
    .join("");
  const boot = { code: v.code, me: v.me, snapshot: { ...s, rows: s.rows.slice(-300) } };
  return page(
    `Lake ${v.code} · Next Year, No Fish`,
    `<div class="app" id="app">
    ${topBar(
      v.code,
      `<div class="clock">
        <span class="yearchip">Year <b id="year">${s.year}</b> of ${YEARS}</span>
        <div class="seasons" aria-hidden="true"><div class="fill" id="seasonfill"></div><span style="--w:14">Spring<i class="zh">春</i></span><span style="--w:26">Summer<i class="zh">夏</i></span><span style="--w:14">Winter<i class="zh">冬</i></span></div>
        <span class="counts" aria-live="off"><span>grown fish <b id="adults">–</b></span><span>fry <b id="fry">–</b></span></span>
        <span class="tiny conn" id="conn" role="status">connecting…</span>
        <button class="tiny" id="sound" type="button" aria-pressed="false">sound off</button>
      </div>`,
    )}
    <main class="board lake-live" id="board" data-lake="${esc(v.code)}" data-state="live" data-me="${v.me ?? ""}" data-last-id="${s.rows.at(-1)?.id ?? 0}">
      <div class="stagewrap" id="stagewrap">
        <canvas id="lake" tabindex="0" aria-label="The lake. Click or tap the water to throw your net. Arrow keys move your aim; space throws."></canvas>
        <div class="banner" id="banner" hidden role="status"><span class="g" id="banner-g">春</span><span id="banner-t"></span></div>
        <div class="overlay" id="meeting" hidden>
          <div class="card">
            <p class="eyebrow" id="meet-eyebrow">Winter · the village meets</p>
            <div class="facts" id="facts"></div>
            <h2>Which rule does the village keep next year?</h2>
            <div class="council" id="council"></div>
            <div class="vote" id="vote-options">
              <button type="button" data-v="none" aria-pressed="false"><span class="glyph">无</span><b>No rule</b><span class="what">Fish however you like.</span><small>&nbsp;</small></button>
              <button type="button" data-v="ban" aria-pressed="false"><span class="glyph">禁</span><b>Ban fine nets</b><span class="what">A fine net that lands is marked as a breach.</span><small>Mencius: 数罟不入洿池, “fine nets stay out of the pools”</small></button>
              <button type="button" data-v="spring" aria-pressed="false"><span class="glyph">休</span><b>No fishing in spring</b><span class="what">Any net in the first 14 s, while fish spawn, is a breach.</span><small>Guoyu: 今鱼方别孕, “the fish are spawning”</small></button>
              <button type="button" data-v="nursery" aria-pressed="false"><span class="glyph">护</span><b>Keep out of the shallows</b><span class="what">A net in the pale ring, where the fry live, is a breach.</span><small>Guoyu: 鱼禁鲲鲕, “spare the roe and the fry”</small></button>
            </div>
            <div class="meterline" aria-hidden="true"><i id="meet-left"></i></div>
            <p class="keys">A rule needs more votes than any other and at least half the village; a family that does not vote counts as no rule. A rule stops nobody: everyone sees who breaks it.</p>
          </div>
        </div>
        <div class="overlay soft" id="newyear" hidden>
          <div class="card newyear">
            <p class="eyebrow" id="ny-eyebrow">New Year</p>
            <p class="big" id="ny-big">Fish to spare</p>
            <h2 id="ny-line"></h2>
            <p class="en" id="ny-rule"></p>
          </div>
        </div>
        <div class="overlay soft" id="over" hidden>
          <div class="card newyear"><p class="big">The season is over<span class="zh">终</span></p><p class="en">Counting every house…</p></div>
        </div>
      </div>

      <aside class="side">
        <section class="panel">
          <h3>The families${v.me === null ? "" : " · tap one to send a seal or ask for a promise"}</h3>
          <div class="fams" id="fams"></div>
          <ul class="plain" id="fams-text">${fams}</ul>
        </section>
        <div class="offer" id="offer" hidden aria-live="assertive"></div>
        ${
          me
            ? `<section class="panel" id="mine">
          <h3>Your basket and your net</h3>
          <div class="basket"><span class="big" id="basket">${me.basket}</span><div class="basket-next"><b id="nextpart"></b><div class="progress"><i id="partbar"></i></div></div></div>
          <div class="netrow">
            <button class="btn" id="buy" type="button">Buy a fine net · 20 fish</button>
            <button class="btn alt" id="toggle" type="button" hidden>Use coarse net</button>
          </div>
          <p class="netdesc" id="netdesc">Coarse net: grown fish only. Fry slip through.</p>
          <p class="keys"><kbd>←↑↓→</kbd> aim <kbd>Space</kbd> throw <kbd>B</kbd> buy <kbd>F</kbd> switch net</p>
        </section>`
            : `<section class="panel"><h3>You are watching</h3><p class="netdesc">This season started before you joined. Everything you see is live; the debrief opens here when it ends.</p></section>`
        }
        <section class="panel">
          <h3>This year's rule</h3>
          <div class="rulebox"><span class="g" id="rule-g">${RULE_WORDS[s.rule].g}</span><span id="rule-t">${cap(RULE_WORDS[s.rule].name)}.</span></div>
        </section>
        <section class="panel">
          <h3>The village record</h3>
          <ol class="log" id="rows" reversed>${rows}</ol>
        </section>
      </aside>
    </main>
    <div class="react" id="react" hidden role="dialog" aria-label="Send a seal or ask for a promise"></div>
    ${
      me
        ? `<div class="actionbar" id="actionbar"><span class="mini">basket <b id="ab-basket">${me.basket}</b><br><span id="ab-next"></span></span><button class="btn" id="ab-buy" type="button">Fine net · 20</button><button class="btn alt" id="ab-toggle" type="button" hidden>Coarse</button></div>`
        : ""
    }
    </div>
    <noscript><p class="card">This page needs JavaScript to show the lake. Refresh to see the record.</p></noscript>
    <script type="application/json" id="boot">${scriptJson(boot)}</script>`,
    "page-live",
  );
}

// ---------------------------------------------------------------- debrief

type Moment = { year: number; text: string };

function storyOf(v: DoneView): { moments: Moment[]; perFamily: { fry: number; breaches: number; broken: number; fine: boolean; koi: number }[]; rulesByYear: Record<number, string> } {
  const nameOf = (seat: number | null): string => (seat === null ? "The village" : (v.families.find((f) => f.seat === seat)?.name ?? `seat ${seat}`));
  const per = v.families.map(() => ({ fry: 0, breaches: 0, broken: 0, fine: false, koi: 0 }));
  const moments: Moment[] = [];
  const rulesByYear: Record<number, string> = { 1: "none" };
  let firstFine = false;
  const breachYears = new Map<string, number>();
  for (const r of v.rows) {
    const d = (r.data ?? {}) as Record<string, unknown>;
    const y = yearOf(r.step);
    const p = r.seat === null ? null : per[r.seat];
    if (r.kind === "buy" && p) {
      p.fine = true;
      if (!firstFine) moments.push({ year: y, text: `${nameOf(r.seat)} bought the first fine net.` });
      firstFine = true;
    }
    if (r.kind === "haul" && p) {
      p.fry += Number(d.fry) || 0;
      if (d.koi) {
        p.koi++;
        moments.push({ year: y, text: `${nameOf(r.seat)} netted the golden carp (+8).` });
      }
    }
    if (r.kind === "throw" && p && d.breach) {
      p.breaches++;
      const k = `${r.seat}-${y}`;
      breachYears.set(k, (breachYears.get(k) ?? 0) + 1);
      if (breachYears.get(k) === 1) moments.push({ year: y, text: `${nameOf(r.seat)} broke the village rule (${RULE_WORDS[rulesByYear[y] ?? "none"]?.name}).` });
    }
    if (r.kind === "broken" && p) {
      p.broken++;
      moments.push({ year: y, text: `${nameOf(r.seat)} promised ${nameOf(d.to as number)} coarse nets, then threw a fine one.` });
    }
    if (r.kind === "answer" && d.yes) moments.push({ year: y, text: `${nameOf(d.from as number)} and ${nameOf(r.seat)} promised each other: coarse nets until winter.` });
    if (r.kind === "rule") {
      const ry = Number(d.year);
      rulesByYear[ry + 1] = String(d.rule);
      if (d.rule !== "none" && rulesByYear[ry] !== d.rule) moments.push({ year: ry, text: `The village agreed: ${RULE_WORDS[String(d.rule)].name}, from year ${ry + 1}.` });
    }
    if (r.kind === "end") {
      const endYear = yearOf(r.step);
      const seasonEnd = (YEARS - 1) * YEAR_STEPS + FISH_S * 10 - 1;
      if ((r.step ?? 0) < seasonEnd) moments.push({ year: endYear, text: `The lake emptied in year ${endYear}: fewer than two fish were left.` });
    }
  }
  return { moments, perFamily: per, rulesByYear };
}

function verdictOf(next: number, start: number): [string, string, string] {
  if (next >= start * 0.6) return ["年年有余", "Fish to spare", "Next year the lake will be as full as you found it."];
  if (next >= 2) return ["鱼少了", "Fewer fish", "Next year the lake will hold fewer fish than you found."];
  return ["明年无鱼", "Next year, no fish", "Next year there will be no fish to catch."];
}

function yearsChart(years: number[], grownFish: number, next: number, start: number, rules: Record<number, string>): string {
  const vals = [...years.map((n, i) => ({ label: `Year ${i + 1}`, n, kind: "y" })), { label: "End", n: grownFish, kind: "end" }, { label: "Next year", n: next, kind: "next" }];
  const w = 640,
    h = 230,
    top = 30,
    base = h - 30;
  const max = Math.max(start, ...vals.map((v) => v.n), 1);
  const bw = (w - 60) / vals.length;
  const Y = (n: number): number => base - (n / max) * (base - top);
  const bars = vals
    .map((v, i) => {
      const x = 44 + i * bw + bw * 0.18,
        bwid = bw * 0.64;
      const fill = v.kind === "next" ? "#d7261e" : v.kind === "end" ? "#1f7f8c" : "#7cc5bd";
      const rule = v.kind === "y" && rules[i + 1] && rules[i + 1] !== "none" ? `<text x="${(x + bwid / 2).toFixed(1)}" y="${(Y(v.n) - 22).toFixed(1)}" font-size="16" text-anchor="middle" fill="#d7261e" font-family="Ma Shan Zheng,KaiTi,serif">${RULE_WORDS[rules[i + 1]].g}</text>` : "";
      return `<rect x="${x.toFixed(1)}" y="${Y(v.n).toFixed(1)}" width="${bwid.toFixed(1)}" height="${(base - Y(v.n)).toFixed(1)}" fill="${fill}" stroke="#1f2a5c" stroke-width="2" rx="3"/>
        <text x="${(x + bwid / 2).toFixed(1)}" y="${(Y(v.n) - 6).toFixed(1)}" font-size="13" font-weight="800" text-anchor="middle" fill="#1f2a5c" font-family="Nunito,sans-serif">${v.n}</text>${rule}
        <text x="${(x + bwid / 2).toFixed(1)}" y="${h - 10}" font-size="11.5" text-anchor="middle" fill="#5b628a" font-family="IBM Plex Mono,monospace">${v.label}</text>`;
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Grown fish at the start of each year, at the end, and next year if left alone">
    <line x1="40" x2="${w - 10}" y1="${Y(start).toFixed(1)}" y2="${Y(start).toFixed(1)}" stroke="#1f2a5c" stroke-dasharray="4 5" stroke-opacity=".5"/>
    <text x="${w - 12}" y="${(Y(start) - 5).toFixed(1)}" font-size="11" text-anchor="end" fill="#5b628a" font-family="Nunito,sans-serif">what you found: ${start}</text>
    ${bars}
  </svg>`;
}

// From sim/payoff_output.txt (24 seeds × 4 seats, model 2.2).
const PAYOFF = [
  [0, 132.2, 164.3, "86/96"],
  [1, 95.1, 106.0, "66/96"],
  [2, 73.7, 79.5, "64/96"],
  [3, 66.5, 64.3, "41/96"],
] as const;

function donePage(v: DoneView): string {
  const n = v.families.length;
  const start = startCount(n);
  const { moments, perFamily, rulesByYear } = storyOf(v);
  const [zh, head, sub] = verdictOf(v.end.nextYear, start);
  const villageKept = v.end.kept.reduce((a, b) => a + b, 0);
  const ranked = v.families.map((f) => f.seat).sort((a, b) => v.end.kept[b] - v.end.kept[a]);
  const mine = v.me === null ? null : (v.families.find((f) => f.seat === v.me) ?? null);
  const myRank = mine === null ? 0 : ranked.indexOf(mine.seat) + 1;
  const ord = ["", "the biggest house", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
  const houseCol = mine
    ? `<h3>Your house</h3><div class="houseart" data-art="house" data-part="${v.end.parts[mine.seat]}" data-seat="${mine.seat}" data-kind="${kindOf(mine)}"></div>
       <h2>${cap(partName(v.end.parts[mine.seat]))}, ${v.end.kept[mine.seat]} fish</h2>
       <p>${myRank === 1 ? "The biggest house on the lake." : `${cap(ord[myRank])} of ${n} houses.`} The whole village kept ${villageKept} fish.</p>`
    : `<h3>The houses</h3><div class="houseart" data-art="house" data-part="${v.end.parts[ranked[0]]}" data-seat="${ranked[0]}" data-kind="${kindOf(v.families[ranked[0]])}"></div>
       <h2>${esc(v.families[ranked[0]].name)} built the biggest: ${partName(v.end.parts[ranked[0]])}</h2>
       <p>The whole village kept ${villageKept} fish.</p>`;
  const lakeLine =
    v.end.grownFish >= 2
      ? `${v.end.grownFish} grown fish are left of the ${start} you found. Left alone for a year, the lake would hold <b>${v.end.nextYear}</b>.`
      : "Fewer than two fish are left; none can spawn.";
  const shown = moments.slice(0, 6);
  const famRows = v.families
    .map((f) => {
      const p = perFamily[f.seat];
      return `<tr${f.seat === v.me ? ' class="me"' : ""}><td>${esc(f.name)}${f.bot ? " (bot)" : ""}</td><td>${p.fine ? "fine" : "coarse"}</td><td class="num">${v.end.kept[f.seat]}</td><td class="num">${p.fry}</td><td class="num">${p.breaches || ""}</td><td class="num">${p.broken || ""}</td><td>${partName(v.end.parts[f.seat])} <span class="zh">${PART_ZH[v.end.parts[f.seat]]}</span></td></tr>`;
    })
    .join("");
  const houses = v.families
    .map(
      (f) =>
        `<li class="${f.seat === v.me ? "me" : ""}"><span class="mini-house" data-art="house" data-part="${v.end.parts[f.seat]}" data-seat="${f.seat}" data-kind="${kindOf(f)}"></span><b>${esc(f.name)}${f.bot ? " <small>(bot)</small>" : ""}</b><span>${v.end.kept[f.seat]} fish · ${partName(v.end.parts[f.seat])}</span></li>`,
    )
    .join("");
  const chart = v.end.years?.length
    ? `${yearsChart(v.end.years, v.end.grownFish, v.end.nextYear, start, rulesByYear)}<p class="keys">Grown fish at the start of each year, at the end, and next year if nobody fishes. A seal marks a year the village kept a rule.</p>`
    : `<p>${v.end.grownFish} grown fish at the end; ${v.end.nextYear} next year if nobody fishes.</p>`;
  const nameOf = (seat: number | null): string => (seat === null ? "The village" : (v.families.find((f) => f.seat === seat)?.name ?? `seat ${seat}`));
  const record = v.rows
    .filter((r) => r.kind !== "open")
    .map((r) => `<li><span class="y">${r.step === null ? "" : `Y${yearOf(r.step)}`}</span><span>${esc(rowWords(r, nameOf))}</span></li>`)
    .join("");
  const payoffRows = PAYOFF.map(([k, keep, sw, paid]) => `<tr><td>${k}</td><td class="num">${keep.toFixed(1)}</td><td class="num">${sw.toFixed(1)}</td><td class="num">${paid}</td></tr>`).join("");

  return page(
    `Lake ${v.code}: the debrief · Next Year, No Fish`,
    `${topBar(v.code, `<div class="clock"><span class="yearchip">The end <i class="zh">终</i></span></div>`)}
    <main class="debrief done" data-lake="${esc(v.code)}" data-state="done" data-me="${v.me ?? ""}">
      <div class="result">
        <div class="col">${houseCol}</div>
        <div class="col"><h3>The lake</h3><div class="stampbig">${zh.slice(0, 2)}<br>${zh.slice(2)}</div><h2>${head}</h2><p>${lakeLine} ${sub}</p></div>
        <div class="col"><h3>What happened</h3><ul class="moments">${shown.length ? shown.map((m) => `<li><b>Year ${m.year}</b>${esc(m.text)}</li>`).join("") : "<li>A quiet five years.</li>"}</ul>
          <form method="post" action="/lakes" class="again"><button class="cta" type="submit">Open a new lake</button></form></div>
      </div>
      <section class="card"><h2 class="h">Every house</h2><ul class="houses">${houses}</ul></section>
      <details class="why" id="why" open><summary>Why it went this way</summary>
        <div class="cols">
          <div>${chart}</div>
          <div class="scroll"><table><thead><tr><th>Family</th><th>Net</th><th class="num">Kept</th><th class="num">Fry taken</th><th class="num">Broke rule</th><th class="num">Broke promise</th><th>House</th></tr></thead><tbody>${famRows}</tbody></table></div>
        </div>
        <div class="prose">
          <h3>Why the fine net is hard to refuse</h3>
          <p>We simulated this lake many times with four families who all aim well, comparing each family with itself: the same lake and the same seat, once keeping a coarse net and once buying a fine net as soon as it could.</p>
          <div class="scroll"><table><thead><tr><th>Other families with fine nets</th><th class="num">Keep coarse</th><th class="num">Switch</th><th class="num">Switching paid</th></tr></thead><tbody>${payoffRows}</tbody></table></div>
          <p>Fish each family kept, on average over 24 lakes. Switching paid most families most of the time, until the last one: when the three others already have fine nets, there is too little left to take. If every family keeps a coarse net, each keeps about 132 fish and the lake survived every time; if every family switches, each keeps about 64 and the lake died in all 24. Garrett Hardin called this the tragedy of the commons (1968); H. Scott Gordon had shown in 1954 that an open fishery draws in effort until the extra boats earn nothing.</p>
          <h3>It is not the only ending</h3>
          <p>Elinor Ostrom studied fisheries, forests and irrigation systems that lasted for centuries because the people who used them made their own rules, watched each other and answered whoever broke them (Ostrom 1990). In laboratory commons, promises made face to face helped, and promises backed by a way to answer cheaters helped more (Ostrom, Walker and Gardner 1992). Your meeting offered three of the oldest fishing rules: a limit on the gear, a closed season, and a protected nursery. In our simulations with four fine nets, a ban left 173 grown fish for the next year, a protected nursery 116, and a closed spring 51.</p>
          <div class="net-story"><svg viewBox="0 0 120 130" data-art="net" aria-hidden="true"></svg><div><p><b>Li Ge cuts the duke's net.</b> One summer Duke Xuan of Lu cast his nets in the river Si while the fish were spawning. His officer Li Ge cut the net and threw it away: the old rule spares the roe and the fry, he said, and casting nets while the fish spawn is greed without limit. The duke answered: this is a good net, it taught me the rule; keep it, so I do not forget. <span class="zh">里革断罟匡君</span> (Guoyu, “Lu Yu I”)</p><p>And from the Lüshi Chunqiu, c. 239 BC: <span class="zh">竭泽而渔，岂不获得？而明年无鱼。</span> “Drain the lake and of course you catch the fish. But next year there are no fish.”</p></div></div>
        </div>
        <ol class="sources">
          <li>Lüshi Chunqiu, “Yi Shang” (c. 239 BC).</li>
          <li>Mencius, “Liang Hui Wang I”: 数罟不入洿池，鱼鳖不可胜食也.</li>
          <li>Guoyu, “Lu Yu I”: 里革断罟匡君 (鱼禁鲲鲕; 今鱼方别孕).</li>
          <li>Hardin, G. (1968). The tragedy of the commons. Science 162(3859), 1243–1248.</li>
          <li>Gordon, H. S. (1954). The economic theory of a common-property resource: the fishery. Journal of Political Economy 62(2), 124–142.</li>
          <li>Ostrom, E. (1990). Governing the Commons. Cambridge University Press.</li>
          <li>Ostrom, E., Walker, J. &amp; Gardner, R. (1992). Covenants with and without a sword. American Political Science Review 86(2), 404–417.</li>
        </ol>
      </details>
      <details class="why record"><summary>The whole record (${v.rows.length} rows)</summary>
        ${v.end.secret ? `<p class="keys">This season's secret was <code>${esc(v.end.secret)}</code>. Its hash was fixed when the lake opened; with the secret and this record, anyone can replay every fish and every net.</p>` : ""}
        <ol class="log full">${record}</ol>
      </details>
    </main>`,
    "page-done",
  );
}
