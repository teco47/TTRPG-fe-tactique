/**
 * FE Tactique – montée de niveau (réserves de d6), fin de phase, nouvelle unité.
 */
import { MODULE_ID, STATS, STAT_LABELS, MAX_LEVEL, CLASSES, TEMPLATE_IDS, TERRAINS, masteryReference, maxDicePerStat } from "./config.js";
import { readUnit, effectiveStats } from "./engine.js";
import { terrainUnderToken } from "./terrain.js";
import { applyOperations } from "./socket.js";

const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "");
const DialogV2 = () => foundry.applications.api.DialogV2;

function targetActors() {
  const fromTokens = canvas?.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];
  if (fromTokens.length) return fromTokens;
  return game.user.character ? [game.user.character] : [];
}

/**
 * Pure : calcule une montée de niveau à partir des résultats de dés.
 * dice : { pv: [..], for: [..], ... } ; level : niveau avant la montée.
 */
export function computeLevelUp(level, dice) {
  const gains = {};
  let sixes = 0;
  for (const s of STATS) {
    const n = (dice[s] ?? []).filter(v => v === 6).length;
    sixes += n;
    gains[s] = s === "pv" ? 2 * n : n;
  }
  const newLevel = level + 1;
  let pm = Math.max(0, masteryReference(level) - sixes);
  const milestone = newLevel % 5 === 0 ? 5 : 0;
  return { newLevel, gains, sixes, pmMalchance: pm, pmPalier: milestone, pm: pm + milestone };
}

export async function levelUp(actor) {
  actor ??= targetActors()[0];
  if (!actor?.system?.props) return ui.notifications.warn("Sélectionne une unité FE.");
  const p = actor.system.props;
  const level = Number(p.niveau ?? 1);
  if (level >= MAX_LEVEL) return ui.notifications.warn(`${actor.name} est déjà au niveau maximum (${MAX_LEVEL}).`);

  const pools = {};
  const rolls = [];
  const dice = {};
  for (const s of STATS) {
    pools[s] = Math.max(0, Number(p[`des_${s}`] ?? 1));
    if (pools[s] > 0) {
      const r = await new Roll(`${pools[s]}d6`).evaluate();
      rolls.push(r);
      dice[s] = r.dice[0].results.map(x => x.result);
    } else dice[s] = [];
  }
  const res = computeLevelUp(level, dice);
  const upd = { niveau: res.newLevel, exp: Math.max(0, Number(p.exp ?? 0) - 100), pm: Number(p.pm ?? 0) + res.pm };
  for (const s of STATS) if (res.gains[s]) upd[`base_${s}`] = Number(p[`base_${s}`] ?? 0) + res.gains[s];
  if (res.gains.pv) upd.pv = Number(p.pv ?? 0) + res.gains.pv;
  const data = Object.fromEntries(Object.entries(upd).map(([k, v]) => [`system.props.${k}`, v]));
  const prevGains = actor.getFlag(MODULE_ID, "gains") ?? {};
  for (const s of STATS) if (res.gains[s]) data[`flags.${MODULE_ID}.gains.${s}`] = Number(prevGains[s] ?? 0) + res.gains[s];
  await applyOperations([{ op: "update", uuid: actor.uuid, data }]);

  const rows = STATS.map(s => {
    const faces = dice[s].map(v => `<span class="fe-die ${v === 6 ? "six" : ""}">${v}</span>`).join("");
    return `<tr><th>${STAT_LABELS[s]}</th><td>${faces || "<i>aucun dé</i>"}</td><td>${res.gains[s] ? `<b>+${res.gains[s]}</b>` : "—"}</td></tr>`;
  }).join("");
  const limit = maxDicePerStat(res.newLevel);
  const content = `
  <div class="fe-chat fe-levelup">
    <h3>${esc(actor.name)} passe niveau ${res.newLevel} !</h3>
    <table class="fe-log">${rows}</table>
    <p>Stats gagnées : ${res.sixes} (un 6 de PV donne +2 PV et compte pour 1).</p>
    <p>Points de maîtrise : +${res.pmMalchance} (référence ${masteryReference(level)})${res.pmPalier ? ` +${res.pmPalier} (palier du niveau ${res.newLevel})` : ""} = <b>+${res.pm} PM</b>.</p>
    <p class="fe-sub">Limite de dés par stat à ce niveau : ${limit}d6. Emplacements de traits : ${4 + 2 * Math.min(4, Math.floor(res.newLevel / 10))}.</p>
  </div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls, flags: { [MODULE_ID]: { levelUp: true } } });
}

/** Achat d'un dé de stat avec des PM (3 PM par défaut). */
export async function buyDie(actor) {
  actor ??= targetActors()[0];
  if (!actor?.system?.props) return ui.notifications.warn("Sélectionne une unité FE.");
  const p = actor.system.props;
  const level = Number(p.niveau ?? 1);
  const limit = maxDicePerStat(level);
  const cost = Number(game.settings.get(MODULE_ID, "dieCost") ?? 3);
  const options = STATS.map(s => {
    const n = Number(p[`des_${s}`] ?? 1);
    return `<option value="${s}" ${n >= limit ? "disabled" : ""}>${STAT_LABELS[s]} (${n}d6${n >= limit ? ", limite atteinte" : ""})</option>`;
  }).join("");
  const stat = await DialogV2().wait({
    window: { title: `Acheter un dé (${cost} PM) – ${actor.name}` },
    content: `<p>PM disponibles : ${p.pm ?? 0}. Limite : ${limit}d6 par stat au niveau ${level}.</p><select name="stat">${options}</select>`,
    buttons: [{ action: "ok", label: "Acheter", default: true, callback: (e, b) => b.form.elements.stat.value }, { action: "cancel", label: "Annuler" }],
    rejectClose: false
  }).catch(() => null);
  if (!stat || stat === "cancel") return;
  if (Number(p.pm ?? 0) < cost) return ui.notifications.warn("Pas assez de PM.");
  await actor.update({
    [`system.props.des_${stat}`]: Number(p[`des_${stat}`] ?? 1) + 1, "system.props.pm": Number(p.pm) - cost,
    [`flags.${MODULE_ID}.diceBought`]: Number(actor.getFlag(MODULE_ID, "diceBought") ?? 0) + 1
  });
  ui.notifications.info(`${actor.name} : +1 dé de ${STAT_LABELS[stat]}.`);
}

/* ------------------------------------------------------------------ */
/*  Changement de phase                                                */
/* ------------------------------------------------------------------ */

function tokenCamp(t) {
  const d = t.document.disposition;
  return d === CONST.TOKEN_DISPOSITIONS.FRIENDLY ? "joueurs" : (d === CONST.TOKEN_DISPOSITIONS.HOSTILE ? "ennemis" : "neutres");
}

/**
 * Fin de la phase d'un camp : fait expirer les effets temporaires de ce camp,
 * puis début de la phase de l'autre camp : soin des forts et trônes (10 % des PV max).
 */
export async function endPhase(endingCamp) {
  if (!game.user.isGM) return ui.notifications.warn("Seul le MJ change de phase.");
  if (!endingCamp) {
    endingCamp = await DialogV2().wait({
      window: { title: "Fin de phase" },
      content: "<p>Quel camp termine sa phase ?</p>",
      buttons: [{ action: "joueurs", label: "Joueurs", default: true }, { action: "ennemis", label: "Ennemis" }],
      rejectClose: false
    }).catch(() => null);
  }
  if (!["joueurs", "ennemis"].includes(endingCamp)) return;
  const starting = endingCamp === "joueurs" ? "ennemis" : "joueurs";
  const lines = [];
  const seen = new Set();
  for (const t of canvas.tokens.placeables) {
    const actor = t.actor;
    if (!actor?.system?.props || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    // Effets temporaires
    for (const e of actor.effects) {
      const fl = e.flags?.[MODULE_ID];
      if (!fl?.expireCamp || fl.expireCamp !== endingCamp) continue;
      const left = Number(fl.phasesLeft ?? 1) - 1;
      if (left <= 0) { await e.delete(); lines.push(`${esc(actor.name)} : ${esc(e.name)} prend fin.`); }
      else await e.setFlag(MODULE_ID, "phasesLeft", left);
    }
    // Soin des forts au début de la phase du camp
    if (tokenCamp(t) === starting && game.settings.get(MODULE_ID, "fortHeal")) {
      const terrain = TERRAINS[terrainUnderToken(t)];
      if (terrain?.soin) {
        const unit = readUnit(actor);
        const max = effectiveStats(unit).pvMax;
        if (unit.hp > 0 && unit.hp < max) {
          const heal = Math.max(1, Math.floor(max * terrain.soin));
          const hp = Math.min(max, unit.hp + heal);
          await actor.update({ "system.props.pv": hp });
          lines.push(`${esc(actor.name)} récupère ${hp - unit.hp} PV (${terrain.label}).`);
        }
      }
    }
  }
  ChatMessage.create({
    content: `<div class="fe-chat"><h3>Phase des ${starting}</h3>${lines.length ? `<ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul>` : "<p>Rien à signaler.</p>"}</div>`
  });
}

/* ------------------------------------------------------------------ */
/*  Nouvelle unité depuis une classe                                   */
/* ------------------------------------------------------------------ */

export function unitPropsFromClass(className, overrides = {}) {
  const c = CLASSES[className];
  if (!c) throw new Error(`Classe inconnue : ${className}`);
  const props = {
    classe: className, niveau: 1, exp: 0, pm: 5, role: "secondaire", palier: "1", profil: c.profil, tags: "",
    base_pv: c.pv, base_for: c.for, base_mag: c.mag, base_def: c.def, base_res: c.res, base_tech: c.tech, base_vit: c.vit, base_mvt: c.mvt,
    pv: c.pv, blessures: 0, jet_bouclier: 0, jet_aile: 0, jet_esprit: 0,
    bon_prec: 0, bon_esq: 0, bon_crit: 0, bon_atq: 0, bon_def: 0
  };
  for (const s of STATS) props[`des_${s}`] = 1;
  for (const d of c.des) props[`des_${d}`] += 1;
  for (const t of ["epee", "lance", "hache", "arc", "lumiere", "anima", "tenebres", "sceptre"]) props[`rang_${t}`] = "E";
  return { ...props, ...overrides };
}

export async function newUnitDialog() {
  const options = Object.keys(CLASSES).map(c => `<option value="${c}">${c}</option>`).join("");
  const res = await DialogV2().wait({
    window: { title: "Nouvelle unité FE" },
    content: `
      <div class="form-group"><label>Nom</label><input name="name" type="text" value="Nouvelle unité"></div>
      <div class="form-group"><label>Classe</label><select name="classe">${options}</select></div>
      <div class="form-group"><label>Rôle</label><select name="role"><option value="secondaire">Personnage secondaire</option><option value="principal">Personnage principal</option></select></div>
      <p class="hint">Stats de classe, 1 dé par stat + 2 dés de classe, 5 PM et l'arme de départ. Les 3 points libres et les 6 dés libres restent à placer sur la fiche.</p>`,
    buttons: [{ action: "ok", label: "Créer", default: true, callback: (e, b) => ({ name: b.form.elements.name.value, classe: b.form.elements.classe.value, role: b.form.elements.role.value }) }, { action: "cancel", label: "Annuler" }],
    rejectClose: false
  }).catch(() => null);
  if (!res || res === "cancel") return;
  const { createUnit } = await import("./setup.js");
  const actor = await createUnit({ name: res.name, classe: res.classe, props: { role: res.role } });
  actor?.sheet?.render(true);
}

export function registerDefaultHooks() {
  // Trait ajouté à une unité : son prix en PM est déduit (réglage « traitCost »).
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id || options?.feSkipClass || options?.feNoCost) return;
    const actor = item.parent;
    if (!(actor instanceof Actor) || actor.system?.template !== TEMPLATE_IDS.unite) return;
    if (!game.settings.get(MODULE_ID, "traitCost")) return;
    const { itemCategory } = await import("./engine.js");
    if (itemCategory(item) !== "trait") return;
    const price = Number(item.system.props?.prix_pm ?? 0);
    if (!price) return;
    const pm = Number(actor.system.props?.pm ?? 0);
    await actor.update({ "system.props.pm": pm - price });
    if (pm < price) ui.notifications.warn(`${actor.name} : ${item.name} coûte ${price} PM, il n'en avait que ${pm}. PM négatifs : retire le trait ou corrige les PM.`);
    else ui.notifications.info(`${actor.name} débloque ${item.name} : −${price} PM (reste ${pm - price}).`);
  });
  Hooks.on("deleteItem", async (item, options, userId) => {
    if (userId !== game.user.id || options?.feNoCost) return;
    const actor = item.parent;
    if (!(actor instanceof Actor) || actor.system?.template !== TEMPLATE_IDS.unite || !game.settings.get(MODULE_ID, "traitCost")) return;
    const { itemCategory } = await import("./engine.js");
    if (itemCategory(item) !== "trait") return;
    const price = Number(item.system.props?.prix_pm ?? 0);
    if (!price) return;
    await actor.update({ "system.props.pm": Number(actor.system.props?.pm ?? 0) + price });
    ui.notifications.info(`${actor.name} : ${item.name} retiré, +${price} PM remboursés.`);
  });
  Hooks.on("createActor", (actor, options, userId) => {
    if (userId === game.user.id) ensureDefaults(actor);
  });
  for (const h of ["renderActorSheet", "renderActorSheetV2"]) Hooks.on(h, (app) => {
    const actor = app.actor ?? app.document;
    if (actor?.isOwner) ensureDefaults(actor);
  });
}

/* ------------------------------------------------------------------ */
/*  Valeurs par défaut manquantes                                      */
/* ------------------------------------------------------------------ */
export const UNIT_DEFAULTS = {
  niveau: 1, exp: 0, pm: 5, pv: 10, blessures: 0, role: "secondaire", palier: "1", profil: "pied",
  jet_bouclier: 0, jet_aile: 0, jet_esprit: 0,
  bon_prec: 0, bon_esq: 0, bon_crit: 0, bon_atq: 0, bon_def: 0,
  base_pv: 10, base_for: 5, base_mag: 5, base_def: 5, base_res: 5, base_tech: 5, base_vit: 5, base_mvt: 5,
  des_pv: 1, des_for: 1, des_mag: 1, des_def: 1, des_res: 1, des_tech: 1, des_vit: 1,
  rang_epee: "E", rang_lance: "E", rang_hache: "E", rang_arc: "E", rang_lumiere: "E", rang_anima: "E", rang_tenebres: "E", rang_sceptre: "E"
};

/** Champs manquants ou vides d'une unité (null, "" ou absent). */
export function missingDefaults(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(UNIT_DEFAULTS)) {
    const cur = props?.[k];
    if (cur === undefined || cur === null || cur === "" || (typeof cur === "number" && Number.isNaN(cur))) out[k] = v;
  }
  return out;
}

const pending = new Set();
export async function ensureDefaults(actor) {
  if (!actor || actor.type !== "character" || actor.system?.template !== TEMPLATE_IDS.unite) return;
  if (pending.has(actor.uuid)) return;
  const miss = missingDefaults(actor.system.props);
  if (!Object.keys(miss).length) return;
  pending.add(actor.uuid);
  try {
    await actor.update(Object.fromEntries(Object.entries(miss).map(([k, v]) => [`system.props.${k}`, v])));
  } finally {
    pending.delete(actor.uuid);
  }
}
