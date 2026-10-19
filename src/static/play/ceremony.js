// The ceremony every mode ends with (DESIGN.md "The ceremony (every mode)"):
// three steps, from one results object the mode script builds from its
// server results plus the room's boot words. Pure HTML-string functions: no
// DOM, no state, so they can be tested and reused by any mode's script.
//
// data shape:
//   { a, y, next, tier: {id, mult}, counterfactual?: {alt, tierId},
//     ledger?: [{seat, name, character, isMe, home, young, spared}],
//     fairShare?, titles?: [{key, vars}], unit?,
//     podium: [{seat, name, character, isMe, base, score, sub}] }
const dotsHtml = (n, on) => `<div class="cer-dots">${Array.from({ length: n }, (_, i) => `<i class="${i <= on ? "on" : ""}"></i>`).join("")}</div>`;

// deps.zh(key) gives a tier word's Chinese characters even when the page is
// in English (DESIGN.md step 1: "the Chinese characters, with the English
// label under them when the page is in English") — read from the room's
// boot JSON's `other` dict (the opposite language's words the server
// already sent), never hardcoded here, so there is one copy of the text.
export function ceremonySteps(data, { t, esc, portrait, zh }) {
  const steps = data.ledger ? 3 : 2;
  const col = { rich: "var(--jade)", fair: "var(--mist)", lean: "var(--gold)", none: "var(--lacquer)" }[data.tier.id];
  const nav = (step) => `<div class="row spread">${dotsHtml(steps, step)}<div class="row">${step >= steps - 1 ? "" : `<button class="btn ghost" type="button" data-cer-skip>${esc(t("skipall"))}</button><button class="btn primary" type="button" data-cer-next>${esc(t("next"))} →</button>`}</div></div>`;

  function step1() {
    const stampZh = zh(`cer_v_${data.tier.id}`);
    return `<div class="sheet narrow"><h2>${esc(t("cer_step1_title"))}</h2><p class="lede">${esc(t("cer_step1_sub"))}</p>
      <div class="cer-verdict"><div class="cer-stamp" style="color:${col}">${stampZh.split("").map((c) => `<span>${esc(c)}</span>`).join("")}<b>${esc(t("cer_v_" + data.tier.id))}</b></div>
        <div class="row" style="gap:26px;align-items:center;justify-content:center">
          <div><small class="muted">${esc(t("cer_left"))}</small><div class="cer-big">${data.a + data.y}</div><small class="muted">${esc(t("cer_fish"))}${data.y ? ` · ${data.y} ${esc(t("cer_young"))}` : ""}</small></div>
          <div class="cer-arrow">→</div>
          <div><small class="muted">${esc(t("cer_nextyear"))}</small><div class="cer-big" style="color:${col}">${data.next}</div><small class="muted">${esc(t("cer_fish"))}</small></div>
        </div>
        <p class="cer-mult">${esc(t("cer_step3_mult", { mult: data.tier.mult, tier: t("cer_v_" + data.tier.id) }))}</p></div>${nav(0)}</div>`;
  }
  function step2() {
    const fair = data.fairShare ?? 1;
    const maxv = Math.max(fair * 1.4, ...data.ledger.map((b) => b.home + (b.young ?? 0)));
    return `<div class="sheet narrow"><h2>${esc(t("cer_step2_title"))}</h2>
      <div class="cer-legend"><span style="--c:#ff9a4a">${esc(t("cer_lg_home"))}</span><span style="--c:#cf3b2e">${esc(t("cer_lg_young"))}</span><span style="--c:var(--gold)">${esc(t("cer_fair_share"))}</span></div>
      <div class="cer-ledger">${data.ledger.map((b) => `<div class="cer-lrow"><span class="pf">${portrait(b.character, b.name)}</span><div style="min-width:0"><div class="cer-lbl"><b>${esc(b.isMe ? t("g_you") : b.name)}</b><span>${b.home} ${esc(data.unit ?? t("cer_fish"))}${b.young ? ` · <em>${esc(t("cer_lg_young"))} ${b.young}</em>` : ""}${b.spared ? ` · <span class="cer-ok">${esc(t("cer_lg_spared"))} ${b.spared}</span>` : ""}</span></div>
        <div class="cer-bars"><i style="width:${(b.home / maxv) * 100}%;background:#ff9a4a"></i><i style="left:${(b.home / maxv) * 100}%;width:${((b.young ?? 0) / maxv) * 100}%;background:#cf3b2e"></i><span class="cer-fairline" style="left:${(fair / maxv) * 100}%"></span></div></div></div>`).join("")}</div>
      ${data.counterfactual !== undefined ? `<div class="cer-what">${data.counterfactual.tierId === data.tier.id ? esc(t("cer_what_same", { tier: t("cer_v_" + data.tier.id) })) : esc(t("cer_what", { alt: data.counterfactual.alt, tier: t("cer_v_" + data.counterfactual.tierId), real: data.next }))}</div>` : ""}
      ${data.titles?.length ? `<div class="cer-titles">${data.titles.map((ti) => `<div class="cer-ttl"><b>${esc(t("cer_t_" + ti.key))}</b>${esc(t("cer_t_" + ti.key + "_s", ti.vars))}</div>`).join("")}</div>` : ""}${nav(1)}</div>`;
  }
  function step3() {
    const rows = data.podium.slice().sort((p, q) => q.score - p.score);
    const myPlace = rows.findIndex((x) => x.isMe) + 1;
    const place = (n) => (n <= 3 ? t(`g_place${n}`) : t("g_placeN", { n }));
    const title = myPlace === 1 ? t("g_you_win") : myPlace > 0 ? t("g_you_came", { place: place(myPlace) }) : t("g_results");
    return `<div class="sheet narrow"><h2>${esc(title)}</h2>
      <p class="lede">${esc(t("cer_step3_mult", { mult: data.tier.mult, tier: t("cer_v_" + data.tier.id) }))}</p>
      <div class="podium">${rows.map((x, i) => `<div class="pl ${x.isMe ? "first" : ""}">${portrait(x.character, x.name)}<span class="place">${i + 1}</span><b>${esc(x.isMe ? t("g_you") : x.name)}${x.sub ? `<br><small class="muted">${esc(x.sub)}</small>` : ""}</b><span class="sc">${x.score}</span>${x.base !== undefined ? `<small>${x.base} × ${data.tier.mult}</small>` : ""}</div>`).join("")}</div>
      <div class="row"><button class="btn primary" type="button" data-cer-again>${esc(t("cer_next_same", { n: data.next }))}</button><button class="btn ghost" type="button" data-cer-village>${esc(t("cer_back_village"))}</button></div>${nav(2)}</div>`;
  }
  return [step1(), data.ledger ? step2() : null, step3()].filter(Boolean);
}

// Mounts the ceremony into a container element; wires Next/Skip/Again/Village.
export function mountCeremony(container, data, deps, { onAgain, onVillage }) {
  const html = ceremonySteps(data, deps);
  let step = 0;
  function render() {
    container.innerHTML = html[step];
    container.querySelector("[data-cer-next]")?.addEventListener("click", () => { step++; render(); });
    container.querySelector("[data-cer-skip]")?.addEventListener("click", () => { step = html.length - 1; render(); });
    container.querySelector("[data-cer-again]")?.addEventListener("click", onAgain);
    container.querySelector("[data-cer-village]")?.addEventListener("click", onVillage);
  }
  render();
}
