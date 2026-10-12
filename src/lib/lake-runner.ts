// The lake runner (DESIGN.md v2.2, "Real time" and "The record, and
// replay"): one live lake. Owns a Lake (lake-sim.ts) and the game state on
// top of it, and writes every change through lake-store.ts. It never reads
// the clock itself: advance(now) is given the time, and a restart rebuilds a
// runner from the ledger and steps it on with nobody throwing, bots
// included, until the step the server came back at.
import {
  AIM_NOISE,
  AIM_TRIES,
  BOT_FILL_ORDER,
  BOT_NAMES,
  BOT_TAKE,
  BOT_VOTE_AT_S,
  CAP_PER_FAMILY,
  FINE_COST,
  HOUSE_PARTS,
  JIN_ANGER,
  MEI_BREACHES,
  R_COARSE,
  R_FINE,
  RIVAL_REACH,
  SHALLOW,
  STEP_MS,
  THROW_COOLDOWN_STEPS,
  WANG_ASKS_AT_S,
} from "./game-constants.ts";
import {
  bestSpot,
  castNet,
  dead,
  type Fish,
  type Haul,
  inLake,
  inShallows,
  type Lake,
  type LakePhase,
  makeLake,
  nextYear,
  phase,
  phaseAt,
  step as lakeStep,
  stepAt,
} from "./lake-sim.ts";
import {
  botBreaks,
  botBuys,
  botNet,
  botRandom,
  botVote,
  breachOf,
  type BotKind,
  type Rule,
  tally,
} from "./rules.ts";
import { botAnswersPromise, botKeepsPromise, buildWinter, canBuyFine } from "./village.ts";
import type { FamilyRow, LakeLedgerRow, LakeStore, NewRow } from "./lake-store.ts";

const SEALS = ["赞", "求", "怒", "喜"] as const;
export type Seal = (typeof SEALS)[number];
const ASK_PROMPT = "coarse nets only, until winter?";

type FamilyState = {
  familyId: number;
  seat: number;
  name: string;
  bot: BotKind | null;
  basket: number;
  part: number; // index into HOUSE_PARTS of the last part built
  hasFine: boolean;
  nextThrowStep: number;
  fryTaken: number;
};

type AskState = { from: number; to: number; year: number };
type AngerEvent = { from: number; to: number; year: number };
type BreachEvent = { family: number; year: number };
type RecentHaul = { step: number; seat: number; x: number; y: number; got: number };
type NetInfo = { seat: number; x: number; y: number; fine: boolean };

export type ThrowReason = "over" | "not_fishing" | "outside" | "no_fine_net" | "too_soon";
export type ActionReason = "over" | "not_fishing" | "not_meeting" | "no_such_family";
export type BuyReason = "over" | "not_fishing" | "already_owned" | "cannot_afford";
export type VoteReason = "over" | "not_meeting" | "bad_rule";
export type AskReason = "over" | "not_fishing" | "self" | "already_promised";
export type AnswerReason = "over" | "no_such_ask";
export type SealReason = "over" | "self" | "bad_seal";

export type ActionResult<R extends string> = { ok: true } | { ok: false; reason: R };

// Public row shapes for events: never a token, a key, a name key, or (before
// the end row) the secret.
export type PublicRow = {
  id: number;
  at: number;
  step: number | null;
  kind: LakeLedgerRow["kind"];
  seat: number | null;
  data: unknown;
};

export type Frame = {
  s: number;
  f: [number, number, number, number, number][]; // id, x, y, h (centirad), a (0 fry / 1 adult)
  n: { seat: number; x: number; y: number; fine: boolean; closeStep: number }[];
  k: [number, number, number] | null; // golden carp x, y, h, or null
};

export type Snapshot = {
  step: number;
  year: number;
  phase: "fish" | "meet" | "over";
  rule: Rule;
  families: {
    seat: number;
    name: string;
    bot: boolean;
    basket: number;
    part: number;
    hasFine: boolean;
    breaches: number;
    promisedWith: number[];
  }[];
  asks: { from: number; to: number }[];
  vote: { seat: number; rule: Rule }[];
  rows: PublicRow[];
};

// Exported so routes.ts can build the same public row shape for a lake that
// has no live runner (before the start, or after the end).
export function publicRow(r: LakeLedgerRow, seatOf: Map<number, number>): PublicRow {
  const data = r.kind === "end" ? r.data : stripSeed(r.data);
  return { id: r.id, at: r.at, step: r.step, kind: r.kind, seat: r.familyId === null ? null : (seatOf.get(r.familyId) ?? null), data };
}

// Defensive: nothing we write ever carries a "secret" field before the end
// row, but a public projection must never pass one through regardless.
function stripSeed(data: unknown): unknown {
  if (data && typeof data === "object" && "secret" in data) {
    const { secret: _secret, ...rest } = data as Record<string, unknown>;
    return rest;
  }
  return data;
}

const promiseKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

function fishUnder(L: Lake, x: number, y: number, fine: boolean): number {
  const r = fine ? R_FINE : R_COARSE;
  let n = 0;
  for (const f of L.fish) {
    if (!fine && f.age === 0) continue;
    const dx = f.x - x,
      dy = f.y - y;
    if (dx * dx + dy * dy < r * r) n++;
  }
  return n;
}

export interface Runner {
  readonly lakeId: number;
  readonly code: string;
  advance(now: number): boolean; // true if a frame is due
  throwNet(seat: number, args: { x: number; y: number; net: "coarse" | "fine"; key: string }): ActionResult<ThrowReason>;
  buy(seat: number): ActionResult<BuyReason>;
  vote(seat: number, rule: Rule): ActionResult<VoteReason>;
  ask(seat: number, to: number): ActionResult<AskReason>;
  answer(seat: number, from: number, yes: boolean): ActionResult<AnswerReason>;
  seal(seat: number, to: number, seal: string): ActionResult<SealReason>;
  frame(): Frame;
  snapshot(): Snapshot;
  rowsAfter(afterId: number, limit: number): PublicRow[];
  isOver(): boolean;
}

export interface RunnerInit {
  store: LakeStore;
  lakeId: number;
  code: string;
  secret: string;
  startedAt: number;
  families: FamilyRow[]; // seat order, from lake-store's familiesOf()
  rows: LakeLedgerRow[]; // every row from 'start' onward, in id order
}

// Reconstructs a runner from a ledger: replays every row from 'start' to the
// last one it has (no bot acts during replay), then steps on to `now` with
// nobody throwing, bots included (time-driven rows — hauls already in
// flight, winter, a meeting's rule, the end — still happen). Bots act again
// only once a later advance() call runs the step the server came back at.
export function rebuild(init: RunnerInit, now: number): Runner {
  const r = new RunnerImpl(init);
  r.replay(init.rows);
  r.catchUpSilently(now);
  return r;
}

class RunnerImpl implements Runner {
  readonly lakeId: number;
  readonly code: string;
  private readonly store: LakeStore;
  private readonly secret: string;
  private readonly startedAt: number;
  private readonly families: FamilyState[]; // by seat
  private readonly seatOf = new Map<number, number>(); // familyId -> seat
  private L: Lake;
  private step = 0; // the next step to process
  private rule: Rule = "none";
  private votes = new Map<number, Rule>();
  private promises = new Set<string>();
  private pendingAsks: AskState[] = [];
  private anger: AngerEvent[] = [];
  private breaches: BreachEvent[] = [];
  private recentHauls: RecentHaul[] = [];
  private netThrowRow = new Map<number, number>(); // Net.seq -> throw row id
  private netInfo = new Map<number, NetInfo>(); // Net.seq -> seat/x/y/fine at cast time
  private ended = false;

  constructor(init: RunnerInit) {
    this.store = init.store;
    this.lakeId = init.lakeId;
    this.code = init.code;
    this.secret = init.secret;
    this.startedAt = init.startedAt;
    this.families = init.families.map((f) => ({
      familyId: f.familyId,
      seat: f.seat,
      name: f.name,
      bot: f.bot,
      basket: 0,
      part: 0,
      hasFine: false,
      nextThrowStep: 0,
      fryTaken: 0,
    }));
    for (const f of this.families) this.seatOf.set(f.familyId, f.seat);
    this.L = makeLake(this.families.length, this.secret);
  }

  // Replays history with no writes and no bot decisions: a throw row casts
  // its net, a haul row is expected to match, winter/rule/end rows update
  // state. Only rows from 'start' onward carry a step.
  replay(rows: LakeLedgerRow[]): void {
    const byStep = new Map<number, LakeLedgerRow[]>();
    for (const r of rows) {
      if (r.step === null || r.kind === "start") continue; // the start row alone is not a step to replay
      if (!byStep.has(r.step)) byStep.set(r.step, []);
      byStep.get(r.step)!.push(r);
    }
    const maxStep = Math.max(-1, ...byStep.keys());
    for (let n = 0; n <= maxStep; n++) {
      const stepRows = byStep.get(n) ?? [];
      for (const r of stepRows) {
        if (r.kind === "throw") this.applyThrowRow(r);
      }
      const out = lakeStep(this.L);
      for (const r of stepRows) {
        if (r.kind === "haul") this.recordHaulFromRow(r);
        if (r.kind === "vote") this.votes.set(this.seatOf.get(r.familyId!)!, (r.data as { rule: Rule }).rule);
        if (r.kind === "rule") {
          this.rule = (r.data as { rule: Rule }).rule;
          this.votes = new Map();
        }
        if (r.kind === "buy") {
          const fam = this.famBySeat(this.seatOf.get(r.familyId!)!);
          fam.hasFine = true;
        }
        if (r.kind === "build") {
          const fam = this.famBySeat(this.seatOf.get(r.familyId!)!);
          const data = r.data as { parts: string[]; left: number };
          fam.part += data.parts.length;
          fam.basket = data.left;
        }
        if (r.kind === "ask") this.pendingAsks.push({ from: this.seatOf.get(r.familyId!)!, to: (r.data as { to: number }).to, year: phase(this.L.t, this.L.years).year });
        if (r.kind === "answer") {
          const data = r.data as { from: number; yes: boolean };
          const to = this.seatOf.get(r.familyId!)!;
          this.pendingAsks = this.pendingAsks.filter((a) => !(a.from === data.from && a.to === to));
          if (data.yes) this.promises.add(promiseKey(data.from, to));
        }
        if (r.kind === "broken") {
          const from = this.seatOf.get(r.familyId!)!;
          const to = (r.data as { to: number }).to;
          this.promises.delete(promiseKey(from, to));
        }
        if (r.kind === "seal" && (r.data as { seal: string }).seal === "怒") {
          this.anger.push({ from: this.seatOf.get(r.familyId!)!, to: (r.data as { to: number }).to, year: phase(this.L.t, this.L.years).year });
        }
        if (r.kind === "end") this.ended = true;
      }
      if (out.winter) this.votes = new Map();
      this.step = n + 1;
      if (this.ended) break;
    }
  }

  private famBySeat(seat: number): FamilyState {
    const f = this.families[seat];
    if (!f) throw new Error(`no family at seat ${seat}`);
    return f;
  }

  private applyThrowRow(r: LakeLedgerRow): void {
    const seat = this.seatOf.get(r.familyId!)!;
    const data = r.data as { x: number; y: number; fine: boolean; breach: boolean };
    const net = castNet(this.L, seat, data.x, data.y, data.fine);
    this.netThrowRow.set(net.seq, r.id);
    this.netInfo.set(net.seq, { seat, x: data.x, y: data.y, fine: data.fine });
    if (data.breach) this.breaches.push({ family: seat, year: phase(this.L.t, this.L.years).year });
  }

  private recordHaulFromRow(r: LakeLedgerRow): void {
    const data = r.data as { got: number; koi: boolean };
    const seat = this.seatOf.get(r.familyId!)!;
    const info = [...this.netInfo.values()].find((n) => n.seat === seat); // best effort; only used to keep the rival window warm during replay
    this.recentHauls.push({ step: r.step ?? this.step, seat, x: info?.x ?? 0, y: info?.y ?? 0, got: data.got });
    const fam = this.famBySeat(seat);
    fam.basket += data.got + (data.koi ? 8 : 0);
  }

  isOver(): boolean {
    return this.ended;
  }

  advance(now: number): boolean {
    if (this.ended) return false;
    const target = stepAt(this.startedAt, now);
    let lastProcessed = -1;
    while (this.step < target && !this.ended) {
      this.processStep(this.step, true);
      lastProcessed = this.step;
      this.step++;
    }
    return lastProcessed >= 0 && lastProcessed % 2 === 0;
  }

  // Steps on to `now` with bots silent: fish still move, age and spawn, a
  // haul already in flight still lands, winter still builds, a meeting still
  // reaches its rule, the season can still end — nobody throws.
  catchUpSilently(now: number): void {
    const target = stepAt(this.startedAt, now);
    while (this.step < target && !this.ended) {
      this.processStep(this.step, false);
      this.step++;
    }
  }

  private processStep(n: number, botsActive: boolean): void {
    const ph = phase(this.L.t, this.L.years);
    this.store.appendStep(this.lakeId, n, (write) => {
      const botThrows: { seat: number; x: number; y: number; fine: boolean }[] = [];
      if (botsActive) {
        for (const fam of this.families) {
          if (fam.bot === null) continue;
          this.runBot(fam, n, ph, write, botThrows);
        }
      }

      // the throws for this step, in ledger order: any already written by a
      // person between ticks (lowest row id first), then the bots' just
      // decided (seat order).
      const already = this.store.allRows(this.lakeId).filter((r) => r.kind === "throw" && r.step === n);
      for (const r of already) this.applyThrowRow(r);
      for (const t of botThrows) {
        const fam = this.famBySeat(t.seat);
        const breach = breachOf(this.rule, ph, t.x, t.y, t.fine);
        const under = fishUnder(this.L, t.x, t.y, t.fine);
        const row = write({ kind: "throw", familyId: fam.familyId, data: { x: t.x, y: t.y, fine: t.fine, breach, under } });
        this.applyThrowRow(row);
        if (breach) this.breaches.push({ family: t.seat, year: ph.year });
      }

      const before = ph;
      const out = lakeStep(this.L);
      const after = phase(this.L.t, this.L.years);

      for (const h of out.hauls) this.writeHaul(write, n, h);

      if (out.winter) {
        for (const fam of this.families) {
          const r = buildWinter(fam.basket, fam.part);
          fam.part = r.part;
          fam.basket = r.left;
          write({ kind: "build", familyId: fam.familyId, data: { parts: r.built, left: r.left } });
        }
      }

      if (before.phase === "meet" && after.phase === "fish") {
        const votes = this.families.filter((f) => f.bot === null).map((f) => this.votes.get(f.seat) ?? "none");
        const won = tally(votes, this.families.length);
        this.rule = won;
        const votesByFamily: Record<number, Rule> = {};
        for (const [seat, rule] of this.votes) votesByFamily[seat] = rule;
        write({ kind: "rule", familyId: null, data: { year: before.year, rule: won, votes: votesByFamily } });
        this.votes = new Map();
      }

      if (!this.ended && (dead(this.L) || after.phase === "over")) {
        this.writeEnd(write, n);
      }
    });
  }

  private writeHaul(write: (r: NewRow) => LakeLedgerRow, n: number, h: Haul): void {
    const seat = h.net.fam;
    const fam = this.famBySeat(seat);
    const info = this.netInfo.get(h.net.seq);
    const x = info?.x ?? h.net.x,
      y = info?.y ?? h.net.y;
    let rival: number | null = null;
    if (h.got === 0) {
      // "closed in the 6 steps before": this step's own earlier hauls count too
      const cand = this.recentHauls.find((rh) => rh.step >= n - 5 && rh.got > 0 && rh.seat !== seat && Math.hypot(rh.x - x, rh.y - y) < RIVAL_REACH);
      rival = cand ? cand.seat : null;
    }
    fam.basket += h.got + (h.koi ? 8 : 0);
    fam.fryTaken += h.gotFry;
    this.recentHauls.push({ step: n, seat, x, y, got: h.got });
    this.recentHauls = this.recentHauls.filter((rh) => rh.step >= n - 5);
    const throwRowId = this.netThrowRow.get(h.net.seq) ?? null;
    write({
      kind: "haul",
      familyId: fam.familyId,
      data: { throw: throwRowId, got: h.got, fry: h.gotFry, slipped: h.slipped, koi: h.koi, rival },
    });
    this.netThrowRow.delete(h.net.seq);
    this.netInfo.delete(h.net.seq);
  }

  private writeEnd(write: (r: NewRow) => LakeLedgerRow, n: number): void {
    this.ended = true;
    const copy: Lake = structuredClone(this.L);
    const next = dead(this.L) ? 0 : nextYear(copy);
    const kept = this.families.map((f) => this.builtValue(f) + f.basket);
    const parts = this.families.map((f) => f.part);
    write({
      kind: "end",
      familyId: null,
      data: { secret: this.secret, step: n, kept, parts, grownFish: dead(this.L) ? 0 : this.L.fish.filter((f) => f.age >= 1).length, nextYear: next },
    });
  }

  private builtValue(f: FamilyState): number {
    let v = 0;
    for (let i = 1; i <= f.part; i++) v += HOUSE_PARTS[i].cost;
    return v;
  }

  // ---- bots ----

  private runBot(
    fam: FamilyState,
    n: number,
    ph: LakePhase,
    write: (r: NewRow) => LakeLedgerRow,
    botThrows: { seat: number; x: number; y: number; fine: boolean }[],
  ): void {
    const kind = fam.bot!;
    const rand = botRandom(this.secret, n, fam.seat);

    if (ph.phase === "fish") {
      // a broken promise's other side stamps anger, the step after it breaks
      // (handled when the throw/haul is written; see writeHaul/applyThrowRow)

      if (botBuys(kind, { basket: fam.basket, hasFine: fam.hasFine, othersFine: this.othersFine(fam.seat) }) && (this.rule !== "ban" || botNet(true, this.rule, this.botBreaksNow(fam, ph)))) {
        fam.hasFine = true;
        fam.basket -= FINE_COST;
        write({ kind: "buy", familyId: fam.familyId, data: {} });
      }

      if (kind === "careful") {
        this.oldWangAsks(fam, n, ph, write, rand);
      }

      this.answerPendingAsks(fam, ph, write);

      if (n === fam.nextThrowStep) {
        fam.nextThrowStep = n + THROW_COOLDOWN_STEPS;
        if (rand() < BOT_TAKE) {
          const keepsSpring = this.rule === "spring" && !this.botBreaksNow(fam, ph);
          if (!(keepsSpring && ph.spring)) {
            const keepsNursery = this.rule === "nursery" && !this.botBreaksNow(fam, ph);
            const fine = botNet(fam.hasFine, this.rule, this.botBreaksNow(fam, ph));
            const s = bestSpot(this.L, fine, rand, AIM_TRIES, keepsNursery ? SHALLOW * 0.95 : 9);
            let x = s.x + (rand() - 0.5) * 2 * AIM_NOISE;
            let y = s.y + (rand() - 0.5) * 2 * AIM_NOISE;
            if (keepsNursery && inShallows(x, y)) {
              x = s.x;
              y = s.y;
            }
            const breaksPromiseNow = fine && this.openPromisesOf(fam.seat).length > 0;
            const allowThrow = !breaksPromiseNow || kind !== "greedy" || !botKeepsPromise(kind, rand());
            if (allowThrow && inLake(x, y)) botThrows.push({ seat: fam.seat, x, y, fine });
          }
        }
      }
    } else if (ph.phase === "meet") {
      const atS = ph.into;
      if (atS >= BOT_VOTE_AT_S[kind] && !this.votes.has(fam.seat)) {
        const v = this.botVoteFor(kind, fam, ph);
        this.votes.set(fam.seat, v);
        write({ kind: "vote", familyId: fam.familyId, data: { year: ph.year, rule: v } });
      }
    }

    void n;
  }

  private botVoteFor(kind: BotKind, fam: FamilyState, ph: { year: number }): Rule {
    const anyFine = this.families.some((f) => f.hasFine);
    const maxFryTaken = Math.max(0, ...this.families.map((f) => f.fryTaken));
    const adultsNow = this.L.fish.filter((f) => f.age >= 1).length;
    const humanVotes = this.families.filter((f) => f.bot === null).map((f) => this.votes.get(f.seat) ?? "none");
    const humans = this.families.filter((f) => f.bot === null).length;
    void ph;
    return botVote(kind, { anyFine, maxFryTaken, adults: adultsNow, startAdults: this.L.start, humanVotes, humans });
  }

  private botBreaksNow(fam: FamilyState, ph: { year: number }): boolean {
    if (fam.bot === null) return false;
    const angerOnMe = this.anger.filter((a) => a.to === fam.seat).map((a) => ({ from: a.from, year: a.year }));
    const breachesByOthers = this.breaches.filter((b) => b.family !== fam.seat).map((b) => ({ family: b.family, year: b.year }));
    return botBreaks(fam.bot, { rule: this.rule, year: ph.year, angerOnMe, breachesByOthers });
  }

  private othersFine(seat: number): number {
    return this.families.filter((f) => f.seat !== seat && f.hasFine).length;
  }

  private openPromisesOf(seat: number): number[] {
    return this.families.filter((f) => f.seat !== seat && this.promises.has(promiseKey(seat, f.seat))).map((f) => f.seat);
  }

  private oldWangAsks(fam: FamilyState, n: number, ph: { year: number; into: number }, write: (r: NewRow) => LakeLedgerRow, rand: () => number): void {
    if (ph.into < WANG_ASKS_AT_S || ph.into >= WANG_ASKS_AT_S + 0.1) return;
    if (this.oldWangAskedThisYear === ph.year) return;
    if (ph.year === 1 && !this.families.some((f) => f.hasFine)) return;
    const candidates = this.families
      .filter((f) => f.bot === null && !this.promises.has(promiseKey(fam.seat, f.seat)))
      .sort((a, b) => b.basket - a.basket || a.seat - b.seat);
    const target = candidates[0];
    if (!target) return;
    this.oldWangAskedThisYear = ph.year;
    this.pendingAsks.push({ from: fam.seat, to: target.seat, year: ph.year });
    write({ kind: "ask", familyId: fam.familyId, data: { to: target.seat } });
    void n;
    void rand;
  }

  private oldWangAskedThisYear = 0;

  private answerPendingAsks(fam: FamilyState, ph: { year: number }, write: (r: NewRow) => LakeLedgerRow): void {
    const mine = this.pendingAsks.filter((a) => a.to === fam.seat);
    for (const a of mine) {
      const yes = botAnswersPromise(fam.bot!, { hasFine: fam.hasFine, othersFine: this.othersFine(fam.seat) });
      this.pendingAsks = this.pendingAsks.filter((p) => p !== a);
      if (yes) this.promises.add(promiseKey(a.from, fam.seat));
      write({ kind: "answer", familyId: fam.familyId, data: { from: a.from, yes } });
      void ph;
    }
  }

  // ---- human actions ----

  throwNet(seat: number, args: { x: number; y: number; net: "coarse" | "fine"; key: string }): ActionResult<ThrowReason> {
    const fam = this.families[seat];
    if (this.store.throwByKey(fam.familyId, args.key)) return { ok: true }; // the same key again: the first answer, nothing changes
    if (this.ended) return { ok: false, reason: "over" };
    const ph = phase(this.L.t, this.L.years);
    if (ph.phase !== "fish") return { ok: false, reason: "not_fishing" };
    if (!inLake(args.x, args.y)) return { ok: false, reason: "outside" };
    const fine = args.net === "fine";
    if (fine && !fam.hasFine) return { ok: false, reason: "no_fine_net" };
    if (this.step < fam.nextThrowStep) return { ok: false, reason: "too_soon" };
    const breach = breachOf(this.rule, ph, args.x, args.y, fine);
    const under = fishUnder(this.L, args.x, args.y, fine);
    const row = this.store.append(this.lakeId, this.step, [
      { kind: "throw", familyId: fam.familyId, data: { x: args.x, y: args.y, fine, breach, under }, key: args.key },
    ])[0];
    fam.nextThrowStep = this.step + THROW_COOLDOWN_STEPS;
    if (breach) this.breaches.push({ family: seat, year: ph.year });
    if (fine) {
      for (const other of this.openPromisesOf(seat)) {
        this.promises.delete(promiseKey(seat, other));
        this.store.append(this.lakeId, this.step, [{ kind: "broken", familyId: fam.familyId, data: { to: other } }]);
        const otherFam = this.famBySeat(other);
        if (otherFam.bot !== null) {
          this.anger.push({ from: other, to: seat, year: ph.year });
          this.store.append(this.lakeId, this.step, [{ kind: "seal", familyId: otherFam.familyId, data: { to: seat, seal: "怒" } }]);
        }
      }
    }
    void row;
    return { ok: true };
  }

  buy(seat: number): ActionResult<BuyReason> {
    if (this.ended) return { ok: false, reason: "over" };
    const fam = this.families[seat];
    const ph = phase(this.L.t, this.L.years);
    if (!canBuyFine(fam.basket, fam.hasFine, ph)) {
      if (ph.phase !== "fish") return { ok: false, reason: "not_fishing" };
      if (fam.hasFine) return { ok: false, reason: "already_owned" };
      return { ok: false, reason: "cannot_afford" };
    }
    fam.hasFine = true;
    fam.basket -= FINE_COST;
    this.store.append(this.lakeId, this.step, [{ kind: "buy", familyId: fam.familyId, data: {} }]);
    return { ok: true };
  }

  vote(seat: number, rule: Rule): ActionResult<VoteReason> {
    if (this.ended) return { ok: false, reason: "over" };
    const ph = phase(this.L.t, this.L.years);
    if (ph.phase !== "meet") return { ok: false, reason: "not_meeting" };
    if (!["none", "ban", "spring", "nursery"].includes(rule)) return { ok: false, reason: "bad_rule" };
    this.votes.set(seat, rule);
    const fam = this.families[seat];
    this.store.append(this.lakeId, this.step, [{ kind: "vote", familyId: fam.familyId, data: { year: ph.year, rule } }]);
    return { ok: true };
  }

  ask(seat: number, to: number): ActionResult<AskReason> {
    if (this.ended) return { ok: false, reason: "over" };
    if (seat === to) return { ok: false, reason: "self" };
    const ph = phase(this.L.t, this.L.years);
    if (ph.phase !== "fish") return { ok: false, reason: "not_fishing" };
    if (this.promises.has(promiseKey(seat, to)) || this.pendingAsks.some((a) => a.from === seat && a.to === to)) {
      return { ok: false, reason: "already_promised" };
    }
    const fam = this.families[seat];
    this.pendingAsks.push({ from: seat, to, year: ph.year });
    this.store.append(this.lakeId, this.step, [{ kind: "ask", familyId: fam.familyId, data: { to } }]);
    return { ok: true };
  }

  answer(seat: number, from: number, yes: boolean): ActionResult<AnswerReason> {
    if (this.ended) return { ok: false, reason: "over" };
    const pending = this.pendingAsks.find((a) => a.from === from && a.to === seat);
    if (!pending) return { ok: false, reason: "no_such_ask" };
    this.pendingAsks = this.pendingAsks.filter((a) => a !== pending);
    if (yes) this.promises.add(promiseKey(from, seat));
    const fam = this.families[seat];
    this.store.append(this.lakeId, this.step, [{ kind: "answer", familyId: fam.familyId, data: { from, yes } }]);
    return { ok: true };
  }

  seal(seat: number, to: number, seal: string): ActionResult<SealReason> {
    if (this.ended) return { ok: false, reason: "over" };
    if (seat === to) return { ok: false, reason: "self" };
    if (!(SEALS as readonly string[]).includes(seal)) return { ok: false, reason: "bad_seal" };
    const fam = this.families[seat];
    if (seal === "怒") this.anger.push({ from: seat, to, year: phase(this.L.t, this.L.years).year });
    this.store.append(this.lakeId, this.step, [{ kind: "seal", familyId: fam.familyId, data: { to, seal } }]);
    return { ok: true };
  }

  frame(): Frame {
    const f: Frame["f"] = this.L.fish.map((fish: Fish) => [
      fish.id,
      Math.round(fish.x),
      Math.round(fish.y),
      Math.round(fish.h * 100),
      fish.age >= 1 ? 1 : 0,
    ]);
    const n: Frame["n"] = this.L.nets.map((net) => ({
      seat: net.fam,
      x: Math.round(net.x),
      y: Math.round(net.y),
      fine: net.fine,
      closeStep: Math.round(net.closeAt / 0.1),
    }));
    const k: Frame["k"] = this.L.koi ? [Math.round(this.L.koi.x), Math.round(this.L.koi.y), Math.round(this.L.koi.h * 100)] : null;
    return { s: this.step, f, n, k };
  }

  snapshot(): Snapshot {
    const ph = phase(this.L.t, this.L.years);
    return {
      step: this.step,
      year: ph.year,
      phase: ph.phase,
      rule: this.rule,
      families: this.families.map((f) => ({
        seat: f.seat,
        name: f.name,
        bot: f.bot !== null,
        basket: f.basket,
        part: f.part,
        hasFine: f.hasFine,
        breaches: this.breaches.filter((b) => b.family === f.seat).length,
        promisedWith: this.openPromisesOf(f.seat),
      })),
      asks: this.pendingAsks.map((a) => ({ from: a.from, to: a.to })),
      vote: [...this.votes.entries()].map(([seat, rule]) => ({ seat, rule })),
      rows: this.store.allRows(this.lakeId).map((r) => publicRow(r, this.seatOf)),
    };
  }

  rowsAfter(afterId: number, limit: number): PublicRow[] {
    return this.store.rowsAfter(this.lakeId, afterId, limit).map((r) => publicRow(r, this.seatOf));
  }
}

export { phaseAt };
export type { Rule };

// Test-only: puts a family in a state a short unit test cannot reach by
// playing a season (a basket, a fine net, a house part, its next throw
// step), without touching the ledger. Never used by the server.
export function debugPokeFamily(
  r: Runner,
  seat: number,
  patch: Partial<{ basket: number; hasFine: boolean; part: number; nextThrowStep: number }>,
): void {
  const fam = (r as unknown as { families: { seat: number }[] }).families.find((f) => f.seat === seat);
  if (fam) Object.assign(fam, patch);
}

// Test-only: sets the rule in force without playing to a meeting's end.
export function debugSetRule(r: Runner, rule: Rule): void {
  (r as unknown as { rule: Rule }).rule = rule;
}
