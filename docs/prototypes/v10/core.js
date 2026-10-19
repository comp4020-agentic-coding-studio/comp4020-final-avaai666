/* ================================================================ words: every visible word, in English and Chinese */
const W = { en: {}, zh: {} };
const addWords = (o) => { Object.assign(W.en, o.en); Object.assign(W.zh, o.zh); };
let LANG = /^zh/i.test(navigator.language || "") ? "zh" : "en";
try { const l = localStorage.getItem("nynf-lang"); if (l === "zh" || l === "en") LANG = l; } catch (e) {}
const Q = new URLSearchParams(location.search);
if (Q.get("lang") === "zh" || Q.get("lang") === "en") LANG = Q.get("lang");
const t = (k, v = {}) => String(W[LANG][k] ?? W.en[k] ?? k).replace(/\{(\w+)\}/g, (m, x) => (x in v ? v[x] : m));
const ord = (n) => LANG === "zh" ? t("place_zh", { n }) : n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const quote = (s) => LANG === "zh" ? `「${s}」` : `“${s}”`;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SPEED = Math.max(1, Math.min(20, +Q.get("speed") || 1)), AUTO = Q.has("auto");
const later = (fn, ms) => setTimeout(fn, ms / SPEED);
const isTouch = matchMedia("(pointer: coarse)").matches || Q.has("touch");

/* the six fishers (original characters) */
const CREW = [
  { id: "mei", en: "Mei", zh: "阿梅", color: "#d6473a", bot: "steady" },
  { id: "wang", en: "Old Wang", zh: "老王", color: "#4a7d9c", bot: "keeper" },
  { id: "jin", en: "Jin", zh: "阿金", color: "#e0a93a", bot: "greedy" },
  { id: "lu", en: "Lu", zh: "小鹭", color: "#2f9a8f", bot: "steady" },
  { id: "lian", en: "Lian", zh: "莲娘", color: "#d9668a", bot: "keeper" },
  { id: "shitou", en: "Shitou", zh: "石头", color: "#62a344", bot: "greedy" },
];
const crewName = (c) => c[LANG];

addWords({
  en: {
    you: "You", bot: "{name} (bot)", place_zh: "第 {n} 名",
    fish: "fish", young: "young fish", coins: "coins",
    p_north: "the north bay", p_east: "the east bay", p_south: "the south bay", p_west: "the west bay", p_reeds: "the reeds", p_lotus: "the lotus pond", p_river: "the river mouth", p_island: "the island",
    s_spring: "Spring", s_summer: "Summer", s_autumn: "Autumn", s_winter: "Winter",
    sz_spring: "春", sz_summer: "夏", sz_autumn: "秋", sz_winter: "冬",
    v_rich: "Bountiful", v_fair: "Fair", v_lean: "Lean", v_none: "No fish",
    v_rich_p: "A bountiful year. Everyone's catch counts ×1.2.", v_fair_p: "A fair year. Catches count as they are.", v_lean_p: "A lean year. Everyone's catch counts ×0.8.", v_none_p: "Next year, no fish. Everyone's catch counts ×0.5.",
    lake: "Next year's lake", lake_now: "The lake now",
    back: "Village", sound: "Sound", on: "On", off: "Off", lang: "Language", next: "Next", skipall: "Skip", go: "Start", again: "Play again", tovillage: "Back to the village",
    keys_boat: "<kbd>W A S D</kbd> or arrows to sail · <kbd>Space</kbd> net · <kbd>Shift</kbd> dash · or click the water",
    fin1: "The year is over", fin1_s: "Winter comes. In spring, the lake has only the fish you all left.", left: "Left in the lake", nextyear: "Next spring",
    fin2: "Who took what", lg_home: "Fish brought home", lg_young: "Young fish killed", lg_spared: "Young fish spared",
    fair: "Gold line = a fair share: if everyone took this much, the lake would recover",
    what: "If everyone had taken one fish in five fewer, next spring would hold {alt} fish ({tier}) instead of {real}.",
    what_same: "Even one fish in five fewer would not have changed the year: still {tier}.",
    t_king: "King of the Lake", t_king_s: "{name}: most fish home ({n})", t_keeper: "Keeper", t_keeper_s: "{name}: spared {n} young fish", t_mesh: "Fine Mesh", t_mesh_s: "{name}: killed {n} young fish", t_ram: "Rammer", t_ram_s: "{name}: {n} rams", t_koi: "Golden Luck", t_koi_s: "{name}: caught the golden carp",
    you_won: "You won!", you_came: "You came {n}", fin3_s: "Fish home × {mult} ({tier})",
    nextyear_btn: "Next year: same lake", newlake: "New lake",
    jar: "This lake remembers: {n} fish now", jar_new: "A new lake",
  },
  zh: {
    you: "你", bot: "{name}（机器人）", place_zh: "第 {n} 名",
    fish: "条鱼", young: "条小鱼", coins: "枚铜钱",
    p_north: "北湾", p_east: "东湾", p_south: "南湾", p_west: "西湾", p_reeds: "芦苇荡", p_lotus: "荷花塘", p_river: "河口", p_island: "湖心岛",
    s_spring: "春", s_summer: "夏", s_autumn: "秋", s_winter: "冬",
    sz_spring: "春", sz_summer: "夏", sz_autumn: "秋", sz_winter: "冬",
    v_rich: "丰收年", v_fair: "平年", v_lean: "歉收年", v_none: "无鱼年",
    v_rich_p: "丰收年。所有人的收获 ×1.2。", v_fair_p: "平年。收获照算。", v_lean_p: "歉收年。所有人的收获 ×0.8。", v_none_p: "明年无鱼。所有人的收获 ×0.5。",
    lake: "明年的湖", lake_now: "现在的湖",
    back: "回村口", sound: "声音", on: "开", off: "关", lang: "语言", next: "下一步", skipall: "跳过", go: "开始", again: "再来一局", tovillage: "回村口",
    keys_boat: "<kbd>W A S D</kbd> 或方向键开船 · <kbd>空格</kbd> 撒网 · <kbd>Shift</kbd> 冲刺 · 也可以点水面",
    fin1: "一年结束了", fin1_s: "冬天来了。到了春天，湖里只有你们留下的鱼。", left: "湖里还剩", nextyear: "明年春天",
    fin2: "谁拿了多少", lg_home: "运回家的鱼", lg_young: "捞死的小鱼", lg_spared: "放过的小鱼",
    fair: "黄线 = 公平的一份：人人都只捞这么多，湖明年还能恢复",
    what: "如果每个人都少捞五分之一，明年春天湖里会有 {alt} 条鱼（{tier}），而不是 {real} 条。",
    what_same: "就算每个人都少捞五分之一，年景也不会变：还是{tier}。",
    t_king: "渔王", t_king_s: "{name}：运回家最多（{n} 条）", t_keeper: "守湖人", t_keeper_s: "{name}：放过了 {n} 条小鱼", t_mesh: "细网手", t_mesh_s: "{name}：捞死了 {n} 条小鱼", t_ram: "撞船王", t_ram_s: "{name}：撞了 {n} 次", t_koi: "锦鲤运", t_koi_s: "{name}：网到了金色锦鲤",
    you_won: "你赢了！", you_came: "你是{n}", fin3_s: "到家的鱼 × {mult}（{tier}）",
    nextyear_btn: "明年继续：同一片湖", newlake: "换一片新湖",
    jar: "这片湖记得：现在有 {n} 条鱼", jar_new: "一片新湖",
  },
});
