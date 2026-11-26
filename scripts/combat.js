/**
 * FE Tactique – fenêtre de prévision façon tactical RPG, résolution du combat, sceptres et objets.
 */
import { MODULE_ID, MODULE_PATH, WEAPON_TYPES, TERRAINS, COMBAT_ACTIVATIONS, STATUS, DEFAULT_ANIMATIONS, TOKEN_MAX } from "./config.js";
import {
  readUnit, buildForecast, resolveCombat, weaponRestriction, weaponRange, equippedWeapon, effectiveStats,
  hasTrait, gridDistance, itemCategory
} from "./engine.js";
import { terrainUnderToken, tokenOffset } from "./terrain.js";
import { applyOperations } from "./socket.js";
import { timedEffectData } from "./status.js";
import { showFloat, strikeFloat } from "./floating.js";

const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "");
const DialogV2 = () => foundry.applications.api.DialogV2;

/* ================================================================== */
/*  Contexte de plateau                                                */
/* ================================================================== */

export function camp(token) {
  const d = (token?.document ?? token)?.disposition;
  return d === CONST.TOKEN_DISPOSITIONS.FRIENDLY ? "joueurs" : (d === CONST.TOKEN_DISPOSITIONS.HOSTILE ? "ennemis" : "neutres");
}

function adjacentTokens(token) {
  const o = tokenOffset(token);
  return canvas.tokens.placeables.filter(t => t !== token && !t.document.hidden && gridDistance(o, tokenOffset(t)) === 1);
}

/** Bonus de situation des traits automatiques qui dépendent du plateau. */
function situational(unit, token, terrain, foeToken) {
  const s = { prec: 0, esq: 0, crit: 0, atq: 0 };
  const notes = [];
  if (hasTrait(unit, "Être des bois") && terrain === "foret") { s.prec += 10; s.esq += 10; notes.push("Être des bois"); }
  if (hasTrait(unit, "Serment")) {
    const lord = adjacentTokens(token).some(t => camp(t) === camp(token) && t.actor?.system?.props?.role === "principal");
    if (lord) { s.prec += 10; notes.push("Serment"); }
  }
  if (hasTrait(unit, "Duelliste") && foeToken) {
    const helped = adjacentTokens(foeToken).some(t => t !== token && camp(t) === camp(foeToken));
    if (!helped) { s.prec += 10; s.esq += 10; notes.push("Duelliste"); }
  }
  return { s, notes };
}

/* ================================================================== */
/*  Prévision                                                          */
/* ================================================================== */

function computeForecast(attTok, defTok, choice) {
  const A = readUnit(attTok.actor, { token: attTok.document });
  const D = readUnit(defTok.actor, { token: defTok.document });
  const distance = gridDistance(tokenOffset(attTok), tokenOffset(defTok));
  const terrainA = terrainUnderToken(attTok);
  const terrainD = terrainUnderToken(defTok);
  const wA = A.weapons.find(w => w.id === choice.weaponId) ?? null;
  const wD = equippedWeapon(D);
  const sitA = situational(A, attTok, terrainA, defTok);
  const sitD = situational(D, defTok, terrainD, attTok);
  const f = buildForecast(A, D, wA, wD, {
    distance, terrainA, terrainD,
    activationsA: choice.activations ?? {}, activationsD: {},
    situationalA: sitA.s, situationalD: sitD.s
  });
  f.notes = { A: sitA.notes, D: sitD.notes };
  f.terrain = { A: terrainA, D: terrainD };
  return f;
}

function weaponChoices(attTok, defTok) {
  const A = readUnit(attTok.actor, { token: attTok.document });
  const distance = gridDistance(tokenOffset(attTok), tokenOffset(defTok));
  return A.weapons.filter(w => w.cat !== "sceptre").map(w => {
    const r = weaponRestriction(A, w);
    const [mn, mx] = weaponRange(A, w);
    const inRange = distance >= mn && distance <= mx;
    return { w, ok: !r && inRange, reason: r ?? (inRange ? "" : "hors de portée") };
  });
}

function triIcon(t, mod) {
  const m = mod && (mod.atq || mod.prec) ? ` ${mod.atq > 0 ? "+" : ""}${mod.atq} Atq ${mod.prec > 0 ? "+" : ""}${mod.prec} Préc` : "";
  if (t > 0) return `<span class="fe-tri up" title="Avantage du triangle${m}">▲${m ? `<small>${m}</small>` : ""}</span>`;
  if (t < 0) return `<span class="fe-tri down" title="Désavantage du triangle${m}">▼${m ? `<small>${m}</small>` : ""}</span>`;
  return "";
}

function sideHtml(side, f, key) {
  const w = side.weapon;
  const icon = w ? `<img class="fe-wicon" src="${MODULE_PATH}/assets/icons/${WEAPON_TYPES[w.type]?.icon}">` : "";
  const hpPct = Math.max(0, Math.min(100, Math.round(100 * side.hp / Math.max(1, side.pvMax))));
  const terrain = TERRAINS[f.terrain[key]];
  const tTxt = terrain && (terrain.esq || terrain.def) ? `${terrain.label} (+${terrain.esq} Esq, +${terrain.def} Déf)` : (terrain?.label ?? "");
  const show = side.can;
  const dmgTxt = show ? `${side.dmg}${side.double ? ` <b class="fe-x2">×2</b>` : ""}` : "—";
  const tags = [];
  if (side.effective) tags.push("Efficace ×3");
  if (w?.special === "luna") tags.push("Ignore la Rés");
  if (w?.special === "nosferatu") tags.push("Drain");
  if (side.eclipse) tags.push("PV ÷ 2");
  tags.push(...(f.notes[key] ?? []));
  return `
  <div class="fe-side fe-side-${key}">
    <div class="fe-name">${esc(side.unit.name)}</div>
    <div class="fe-weapon">${icon}<span>${w ? esc(w.name) : "Aucune arme"}</span>${triIcon(side.triangle, side.triMod)}</div>
    <div class="fe-hp"><span>PV</span><b>${side.hp}</b><small>/ ${side.pvMax}</small></div>
    <div class="fe-hpbar"><div style="width:${hpPct}%"></div></div>
    <table class="fe-numbers">
      <tr><th>Dégâts</th><td>${dmgTxt}</td></tr>
      <tr><th>Précision</th><td>${show ? Math.min(100, side.hit) + " %" : "—"}</td></tr>
      <tr><th>Critique</th><td>${show ? Math.min(100, side.crit) + " %" : "—"}</td></tr>
    </table>
    <div class="fe-terrain">${esc(tTxt)}</div>
    ${tags.length ? `<div class="fe-tags">${tags.map(esc).join(" · ")}</div>` : ""}
    ${!show && side.restriction ? `<div class="fe-warn">${esc(key === "D" ? "Pas de riposte : " : "")}${esc(side.restriction)}</div>` : ""}
  </div>`;
}

function forecastBodyHtml(f) {
  return `
  <div class="fe-forecast">
    ${sideHtml(f.A, f, "A")}
    <div class="fe-vs">VS<small>${f.distance} case${f.distance > 1 ? "s" : ""}</small>${f.desperation ? `<small>Désespoir</small>` : ""}</div>
    ${sideHtml(f.D, f, "D")}
  </div>`;
}

function controlsHtml(attTok, defTok, choice) {
  const opts = weaponChoices(attTok, defTok).map(({ w, ok, reason }) =>
    `<option value="${w.id}" ${w.id === choice.weaponId ? "selected" : ""} ${ok ? "" : "disabled"}>${esc(w.name)} (${w.dur}/${w.durMax})${ok ? "" : ` – ${esc(reason)}`}</option>`).join("");
  const A = readUnit(attTok.actor);
  const acts = Object.entries(COMBAT_ACTIVATIONS).filter(([name]) => hasTrait(A, name)).map(([name, a]) => {
    const enough = !a.jeton || A.jetons[a.jeton] >= a.cout;
    return `<label class="fe-act"><input type="checkbox" name="act_${name}" ${choice.activations?.[name] ? "checked" : ""} ${enough ? "" : "disabled"}> ${esc(a.label)}</label>`;
  }).join("");
  return `
  <div class="fe-controls">
    <label>Arme : <select name="weaponId">${opts}</select></label>
    ${acts ? `<div class="fe-acts">${acts}</div>` : ""}
  </div>`;
}

function readChoice(form) {
  const activations = {};
  for (const name of Object.keys(COMBAT_ACTIVATIONS)) {
    const el = form?.elements?.namedItem?.(`act_${name}`);
    if (el?.checked) activations[name] = true;
  }
  return { weaponId: form?.elements?.namedItem?.("weaponId")?.value ?? null, activations };
}

/** Point d'entrée : jeton contrôlé = attaquant, jeton ciblé (touche T) = défenseur. */
export async function attackMacro() {
  const attTok = canvas.tokens.controlled[0];
  const defTok = [...game.user.targets][0];
  if (!attTok || !defTok) return ui.notifications.warn("Sélectionne ton unité, puis cible l'adversaire (touche T).");
  if (attTok === defTok) return ui.notifications.warn("L'attaquant et la cible sont la même unité.");
  if (!attTok.actor?.system?.props || !defTok.actor?.system?.props) return ui.notifications.warn("Les deux jetons doivent être des unités FE (modèle « FE – Unité »).");

  const A = readUnit(attTok.actor);
  const eq = equippedWeapon(A);
  // Sceptre équipé, ou aucune arme mais un sceptre : action de sceptre
  if ((eq?.cat === "sceptre") || (!A.weapons.some(w => w.cat !== "sceptre") && A.weapons.some(w => w.cat === "sceptre"))) {
    return staffMacro(attTok, defTok);
  }

  const choices = weaponChoices(attTok, defTok);
  const first = choices.find(c => c.w.id === eq?.id && c.ok) ?? choices.find(c => c.ok) ?? choices[0];
  if (!first) return ui.notifications.warn(`${A.name} n'a aucune arme.`);
  let choice = { weaponId: first.w.id, activations: {} };

  const content = `<div class="fe-forecast-root">${controlsHtml(attTok, defTok, choice)}<div class="fe-forecast-body">${forecastBodyHtml(computeForecast(attTok, defTok, choice))}</div></div>`;

  let bound = false;
  const bind = (root) => {
    if (bound || !root) return;
    const el = root instanceof HTMLElement ? root : root[0];
    const form = el?.querySelector("form") ?? el?.closest?.("form") ?? el;
    if (!el?.querySelector(".fe-forecast-root")) return;
    bound = true;
    el.addEventListener("change", () => {
      choice = readChoice(form);
      const body = el.querySelector(".fe-forecast-body");
      if (body) body.innerHTML = forecastBodyHtml(computeForecast(attTok, defTok, choice));
    });
  };
  const hookId = Hooks.once("renderDialogV2", (app, element) => bind(element ?? app.element));

  const result = await DialogV2().wait({
    window: { title: `Combat : ${A.name} contre ${defTok.name}`, icon: "fa-solid fa-swords" },
    classes: ["fe-forecast-dialog"],
    position: { width: 640 },
    content,
    buttons: [
      { action: "attack", label: "Attaquer", icon: "fa-solid fa-hand-fist", default: true, callback: (event, button) => readChoice(button.form) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" }
    ],
    render: (event, dialog) => bind(dialog?.element ?? event?.target?.element),
    rejectClose: false
  }).catch(() => null);
  Hooks.off("renderDialogV2", hookId);

  if (!result || result === "cancel" || typeof result !== "object") return;
  choice = { ...choice, ...result };
  const f = computeForecast(attTok, defTok, choice);
  if (!f.A.can) return ui.notifications.warn(`Attaque impossible : ${f.A.restriction ?? "cible hors de portée"}.`);
  return executeCombat(attTok, defTok, f);
}

/* ================================================================== */
/*  Exécution                                                          */
/* ================================================================== */

async function rollPool(n) {
  const roll = await new Roll(`${n}d100`).evaluate();
  const values = roll.dice[0].results.map(r => r.result);
  let i = 0;
  return { roll, rng: () => values[i++ % values.length] };
}

function propsUpdate(actor, data) {
  return { op: "update", uuid: actor.uuid, data: Object.fromEntries(Object.entries(data).map(([k, v]) => [`system.props.${k}`, v])) };
}

async function executeCombat(attTok, defTok, f) {
  const { roll, rng } = await rollPool(16);
  const result = resolveCombat(f, rng, { durabilityOnMiss: game.settings.get(MODULE_ID, "durabilityOnMiss") });
  const ops = [];

  // L'arme utilisée devient l'arme équipée
  const A = f.A.unit;
  for (const w of A.weapons) {
    const shouldEquip = w.id === f.A.weapon.id;
    if (w.equipped !== shouldEquip && w.cat !== "sceptre") ops.push({ op: "update", uuid: w.uuid, data: { "system.props.equipee": shouldEquip } });
  }
  await applyOperations(ops.splice(0));

  // Coups un par un : animation puis PV
  const tok = { A: attTok, D: defTok };
  const lastHp = { A: f.A.hp, D: f.D.hp };
  for (const s of result.log) {
    const other = s.who === "A" ? "D" : "A";
    await playStrike(tok[s.who], tok[other], f[s.who].weapon, s);
    const hpOps = [];
    for (const k of ["A", "D"]) {
      if (s.hpAfter[k] !== lastHp[k]) { hpOps.push(propsUpdate(tok[k].actor, { pv: s.hpAfter[k] })); lastHp[k] = s.hpAfter[k]; }
    }
    await applyOperations(hpOps);
  }

  // Durabilité, jetons, chute
  for (const k of ["A", "D"]) {
    const side = f[k];
    const st = result.state[k];
    const actor = tok[k].actor;
    if (side.weapon && st.dur !== side.weapon.dur) ops.push({ op: "update", uuid: side.weapon.uuid, data: { "system.props.dur": st.dur } });
    const j = side.unit.jetons;
    const jUpd = {};
    if (st.jetons.bouclier !== j.bouclier) jUpd.jet_bouclier = st.jetons.bouclier;
    if (st.jetons.aile !== j.aile) jUpd.jet_aile = st.jetons.aile;
    if (st.jetons.esprit !== j.esprit) jUpd.jet_esprit = st.jetons.esprit;
    const fall = result.fallen[k];
    if (fall && camp(tok[k]) === "joueurs") jUpd.blessures = fall.wounds;
    if (Object.keys(jUpd).length) ops.push(propsUpdate(actor, jUpd));
    if (fall) {
      ops.push({ op: "status", uuid: actor.uuid, statusId: CONFIG.specialStatusEffects?.DEFEATED ?? "dead", active: true, overlay: true });
    }
  }
  await applyOperations(ops);

  await postCombatMessage(attTok, defTok, f, result, roll);
}

/* ================================================================== */
/*  Message de chat                                                    */
/* ================================================================== */

async function postCombatMessage(attTok, defTok, f, result, roll) {
  const rows = result.log.map(s => {
    const rate = s.rate >= 100 ? "auto" : `${s.rate} %`;
    const dice = s.rolls.length ? ` <small>(${s.rolls.join(" + ")}) / 2 = ${s.value}</small>` : "";
    const res = s.hit
      ? `<b class="fe-hit">${s.crit ? "CRITIQUE ! " : "Touché"}</b> −${s.dmg} PV${s.miracle ? " (Miracle !)" : ""}${s.drain ? `, +${s.drain} PV drainés` : ""}${s.siphon ? `, +${s.siphon} PV (Siphon)` : ""}`
      : `<span class="fe-miss">Raté</span>`;
    return `<tr><td>${esc(s.attacker)}</td><td>${rate}${dice}</td><td>${res}${s.broke ? `<br><i>${esc(s.broke)} se brise !</i>` : ""}</td></tr>`;
  }).join("");

  const fallLine = (k, tokenRef) => {
    const fall = result.fallen[k];
    if (!fall) return "";
    const name = esc(f[k].unit.name);
    if (camp(tokenRef) !== "joueurs") return `<p class="fe-fall">${name} est vaincu.</p>`;
    if (fall.dead) return `<p class="fe-fall dead">${name} tombe et reçoit sa ${fall.wounds}e blessure : <b>mort définitive</b> (voir avec le MJ).</p>`;
    return `<p class="fe-fall">${name} tombe : ${fall.wounds}e blessure, il quitte la carte.</p>`;
  };
  const prime = result.fallen.D && hasTrait(f.A.unit, "Prime") && camp(defTok) === "ennemis" ? `<p>Prime : +25 or pour ${esc(f.A.unit.name)}.</p>` : "";

  const content = `
  <div class="fe-chat">
    <h3>${esc(f.A.unit.name)} ⚔ ${esc(f.D.unit.name)}</h3>
    <p class="fe-sub">${esc(f.A.weapon?.name ?? "")} contre ${esc(f.D.weapon?.name ?? "aucune arme")} · ${f.distance} case(s)${f.D.can ? "" : ` · pas de riposte (${esc(f.D.restriction ?? "")})`}</p>
    <table class="fe-log"><tr><th>Attaquant</th><th>Toucher (2RN)</th><th>Résultat</th></tr>${rows}</table>
    <p class="fe-final">${esc(f.A.unit.name)} : ${result.state.A.hp}/${f.A.pvMax} PV · ${esc(f.D.unit.name)} : ${result.state.D.hp}/${f.D.pvMax} PV</p>
    ${fallLine("A", attTok)}${fallLine("D", defTok)}${prime}
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: attTok.document }),
    content,
    rolls: [roll],
    flags: { [MODULE_ID]: { combat: true } }
  });
}

/* ================================================================== */
/*  Animations (Sequencer + JB2A)                                      */
/* ================================================================== */

function animationTable() {
  let custom = {};
  try { custom = JSON.parse(game.settings.get(MODULE_ID, "animations") || "{}"); } catch (e) { /* JSON invalide : ignoré */ }
  return { ...DEFAULT_ANIMATIONS, ...custom };
}

export function findAnimation(kind) {
  if (!game.modules.get("sequencer")?.active || !window.Sequencer?.Database) return null;
  const list = [].concat(animationTable()[kind] ?? []);
  for (const key of list) {
    try { if (Sequencer.Database.entryExists(key)) return key; } catch (e) { /* ignore */ }
  }
  return null;
}

async function playStrike(src, tgt, weapon, strike) {
  await playStrikeAnimation(src, tgt, weapon, strike);
  const fl = strikeFloat(strike);
  showFloat(tgt, fl.text, fl.kind);
  if (strike.drain) showFloat(src, `+${strike.drain}`, "soin");
  if (strike.siphon) showFloat(src, `+${strike.siphon} Siphon`, "soin");
  if (strike.broke) showFloat(src, `${strike.broke} se brise !`, "info");
}

async function playStrikeAnimation(src, tgt, weapon, strike) {
  if (!game.settings.get(MODULE_ID, "animations_on")) return;
  const key = weapon ? findAnimation(weapon.type) : null;
  if (!key) { await new Promise(r => setTimeout(r, 250)); return; }
  try {
    const seq = new Sequence();
    // Critique : l'attaquant se charge avant de frapper
    if (strike.crit) {
      const charge = findAnimation("critique_charge");
      if (charge) seq.effect().file(charge).atLocation(src).scaleToObject(1.8).waitUntilFinished(-500);
    }
    seq.effect().file(key).atLocation(src).stretchTo(tgt).missed(!strike.hit).waitUntilFinished(-300);
    if (strike.crit) {
      const impact = findAnimation("critique");
      if (impact) seq.effect().file(impact).atLocation(tgt).scaleToObject(1.6);
      try { seq.canvasPan().shake({ duration: 450, strength: 12, rotation: false }); } catch (e) { /* Sequencer trop ancien */ }
    } else if (!strike.hit) {
      const miss = findAnimation("rate");
      if (miss) seq.effect().file(miss).atLocation(tgt).scaleToObject(1.2);
    }
    await seq.play();
  } catch (err) {
    console.warn(`${MODULE_ID} | animation`, err);
  }
}

async function playOn(target, kind) {
  if (!game.settings.get(MODULE_ID, "animations_on")) return;
  const key = findAnimation(kind);
  if (!key) return;
  try { await new Sequence().effect().file(key).atLocation(target).scaleToObject(1.5).play(); } catch (e) { /* ignore */ }
}

/* ================================================================== */
/*  Sceptres                                                           */
/* ================================================================== */

export async function staffMacro(srcTok, tgtTok) {
  srcTok ??= canvas.tokens.controlled[0];
  tgtTok ??= [...game.user.targets][0];
  if (!srcTok || !tgtTok) return ui.notifications.warn("Sélectionne l'unité au sceptre, puis cible l'unité visée (touche T).");
  const S = readUnit(srcTok.actor);
  const staves = S.weapons.filter(w => w.cat === "sceptre");
  if (!staves.length) return ui.notifications.warn(`${S.name} n'a pas de sceptre.`);
  const distance = gridDistance(tokenOffset(srcTok), tokenOffset(tgtTok));
  const opts = staves.map(w => {
    const r = weaponRestriction(S, w);
    const ok = !r && distance >= w.porMin && distance <= w.porMax;
    return `<option value="${w.id}" ${ok ? "" : "disabled"}>${esc(w.name)} (${w.dur}/${w.durMax})${ok ? "" : ` – ${esc(r ?? "hors de portée")}`}</option>`;
  }).join("");
  const choice = await DialogV2().wait({
    window: { title: `Sceptre : ${S.name} → ${tgtTok.name}`, icon: "fa-solid fa-wand-sparkles" },
    content: `<label>Sceptre : <select name="staff">${opts}</select></label><p>Distance : ${distance} case(s).</p>`,
    buttons: [
      { action: "use", label: "Utiliser", default: true, callback: (e, b) => b.form.elements.staff.value },
      { action: "cancel", label: "Annuler" }
    ],
    rejectClose: false
  }).catch(() => null);
  if (!choice || choice === "cancel") return;
  const w = staves.find(s => s.id === choice);
  if (!w) return;
  const st = effectiveStats(S);
  const T = readUnit(tgtTok.actor);
  const tStats = effectiveStats(T);
  const ops = [];
  let text = "";
  if (w.effetCle === "soin" || w.effetCle === "recouvrement") {
    const amount = w.effetCle === "recouvrement" ? tStats.pvMax : w.soin + Math.floor(st.mag / 2);
    const newHp = Math.min(tStats.pvMax, T.hp + amount);
    await playOn(tgtTok, "soin");
    ops.push(propsUpdate(tgtTok.actor, { pv: newHp }));
    text = `${esc(T.name)} récupère ${newHp - T.hp} PV (${newHp}/${tStats.pvMax}).`;
    showFloat(tgtTok, `+${newHp - T.hp}`, "soin");
  } else if (w.effetCle === "silence") {
    await playOn(tgtTok, "silence");
    showFloat(tgtTok, "Silence", "info");
    ops.push({ op: "createEffect", uuid: tgtTok.actor.uuid, data: timedEffectData({ kind: "silence", name: "Silence", expireCamp: camp(tgtTok), phases: 1 }) });
    text = `${esc(T.name)} est réduit au Silence jusqu'à la fin de sa prochaine phase.`;
  } else {
    text = `${esc(w.name)} est utilisé : effet à appliquer par le MJ.`;
  }
  const dur = Math.max(0, w.dur - 1);
  // Le sceptre utilisé devient l'arme équipée : les autres armes sont déséquipées
  for (const o of S.weapons) if (o.id !== w.id && o.equipped) ops.push({ op: "update", uuid: o.uuid, data: { "system.props.equipee": false } });
  ops.push({ op: "update", uuid: w.uuid, data: { "system.props.dur": dur, "system.props.equipee": true } });
  await applyOperations(ops);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: srcTok.document }),
    content: `<div class="fe-chat"><h3>${esc(S.name)} utilise ${esc(w.name)}</h3><p>${text}</p><p class="fe-sub">Durabilité ${dur}/${w.durMax}${dur === 0 ? " : le sceptre se brise !" : ""}</p></div>`
  });
}

/* ================================================================== */
/*  Objets                                                             */
/* ================================================================== */

export async function useObject(item) {
  const actor = item?.parent;
  if (!actor) return;
  const p = item.system.props ?? {};
  const uses = Number(p.uses ?? 0);
  if (uses <= 0) return ui.notifications.warn(`${item.name} n'a plus d'utilisation.`);
  const unit = readUnit(actor);
  const st = effectiveStats(unit);
  const effet = p.effet_objet ?? "autre";
  if (effet === "magister") {
    const { classMacro } = await import("./classes.js");
    return classMacro({ actor });
  }
  const ops = [];
  let text = "";
  if (effet === "soin") {
    const newHp = Math.min(st.pvMax, unit.hp + Number(p.valeur ?? 0));
    ops.push(propsUpdate(actor, { pv: newHp }));
    text = `${esc(actor.name)} récupère ${newHp - unit.hp} PV (${newHp}/${st.pvMax}).`;
    const t = actor.getActiveTokens?.()[0];
    if (t) { playOn(t, "soin"); showFloat(t, `+${newHp - unit.hp}`, "soin"); }
  } else if (effet === "booster") {
    const stat = await DialogV2().wait({
      window: { title: `${item.name} : quelle stat ?` },
      content: `<select name="stat">${["pv", "for", "mag", "def", "res", "tech", "vit", "mvt"].map(s => `<option value="${s}">${s.toUpperCase()}</option>`).join("")}</select>`,
      buttons: [{ action: "ok", label: "Appliquer", default: true, callback: (e, b) => b.form.elements.stat.value }, { action: "cancel", label: "Annuler" }],
      rejectClose: false
    }).catch(() => null);
    if (!stat || stat === "cancel") return;
    const gain = stat === "pv" ? 5 : (stat === "mvt" ? 1 : 2);
    const key = `base_${stat}`;
    const current = Number(actor.system.props[key] ?? 0);
    const upd = { [key]: current + gain };
    if (stat === "pv") upd.pv = unit.hp + gain;
    ops.push(propsUpdate(actor, upd));
    if (stat !== "mvt") ops.push({ op: "update", uuid: actor.uuid, data: { [`flags.${MODULE_ID}.boosts.${stat}`]: Number(actor.getFlag(MODULE_ID, "boosts")?.[stat] ?? 0) + gain } });
    text = `${esc(actor.name)} gagne +${gain} ${stat.toUpperCase()} de façon permanente.`;
  } else {
    text = `${esc(actor.name)} utilise ${esc(item.name)} : ${esc(p.effet ?? "effet à appliquer par le MJ")}.`;
  }
  ops.push({ op: "update", uuid: item.uuid, data: { "system.props.uses": uses - 1 } });
  await applyOperations(ops);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="fe-chat"><h3>${esc(item.name)}</h3><p>${text}</p><p class="fe-sub">Utilisations restantes : ${uses - 1}</p></div>` });
}

/** Équiper une arme (désé­quipe les autres) ou basculer un trait. */
export async function toggleEquip(item) {
  const actor = item?.parent;
  if (!actor) return;
  const cat = itemCategory(item);
  if (cat === "objet") return useObject(item);
  if (cat === "trait") {
    const on = !(item.system.props?.equipe === true || item.system.props?.equipe === "true");
    if (on) {
      const unit = readUnit(actor);
      const used = unit.traits.filter(t => t.equipped).length;
      const slots = 4 + 2 * Math.min(4, Math.floor(unit.level / 10));
      if (used >= slots) ui.notifications.warn(`${actor.name} a déjà ${used} traits équipés sur ${slots} emplacements.`);
      if (unit.traits.some(t => t.equipped && t.name.trim().toLowerCase() === item.name.trim().toLowerCase())) {
        return ui.notifications.warn("Deux emplacements ne peuvent pas porter le même trait.");
      }
    }
    return item.update({ "system.props.equipe": on });
  }
  if (!["arme", "tome", "sceptre"].includes(cat)) return;
  const updates = actor.items.filter(i => ["arme", "tome", "sceptre"].includes(itemCategory(i)) && i.id !== item.id && (i.system.props?.equipee === true))
    .map(i => ({ _id: i.id, "system.props.equipee": false }));
  updates.push({ _id: item.id, "system.props.equipee": true });
  return actor.updateEmbeddedDocuments("Item", updates);
}
