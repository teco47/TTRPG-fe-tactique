/**
 * FE Tactique – classes : emplacements Base / Avancée / Élite, choix de classe, promotion et Magister d'équivalence.
 *
 * Les stats de la fiche (base_*) contiennent déjà les modificateurs des classes obtenues.
 * Un changement de classe applique donc un écart : on retire les modificateurs et les dés des classes perdues,
 * puis on ajoute ceux de la nouvelle classe. Le niveau, les stats gagnées, les points libres, les dés achetés,
 * les rangs d'arme et les traits débloqués ne bougent pas.
 */
import { MODULE_ID, STATS, STAT_LABELS, TIERS, PROMOTION, EQUIVALENCE_ITEM, TRAITS, TEMPLATE_IDS } from "./config.js";
import { readClass, classFromConfig, itemCategory } from "./engine.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DialogV2 = () => foundry.applications.api.DialogV2;
const n = (v, d = 0) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? d : Number(v);
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

/* ------------------------------------------------------------------ */
/*  Calculs purs                                                       */
/* ------------------------------------------------------------------ */

/**
 * Emplacements de classe d'une unité { 1: cls, 2: cls, 3: cls }.
 * Une unité sans objet Classe mais dont le champ « classe » nomme une classe de base (fiches 0.1) a un emplacement virtuel.
 */
export function classSlots(items, props = {}, { exclude = null } = {}) {
  const slots = {};
  for (const item of items ?? []) {
    if (item.id && item.id === exclude) continue;
    if (itemCategory(item) !== "classe") continue;
    const c = readClass(item);
    slots[c.palier] ??= c;
  }
  if (!Object.keys(slots).length) {
    const v = classFromConfig(String(props.classe ?? "").trim());
    if (v) slots[1] = { ...v, virtual: true };
  }
  return slots;
}

export const currentTier = (slots) => Math.max(0, ...Object.keys(slots).map(Number));

/**
 * Mode et conditions d'un changement vers la classe cls.
 * has(nomObjet) : l'unité possède cet objet avec au moins une utilisation.
 * Retour : { mode: "initial" | "promotion" | "equivalence" | null, item: objet à consommer, reasons: [..], blocking }
 */
export function classEligibility(cls, slots, props, has = () => false) {
  const t = cls.palier;
  const ct = currentTier(slots);
  const level = n(props.niveau, 1);
  const reasons = [];
  if (Object.values(slots).some(s => s.nom === cls.nom)) return { mode: null, item: null, reasons: ["classe déjà obtenue"], blocking: true };
  if (ct === 0) {
    if (t !== 1) return { mode: null, item: null, reasons: ["il faut d'abord une classe de base"], blocking: true };
    return { mode: "initial", item: null, reasons, blocking: false };
  }
  if (t === 1 && ct === 1 && level <= 1) return { mode: "initial", item: null, reasons, blocking: false };
  if (t === ct + 1) {
    const rule = PROMOTION[t];
    if (level < rule.niveau) reasons.push(`niveau ${rule.niveau} requis`);
    const promos = slots[ct]?.promotions ?? [];
    if (promos.length && !promos.some(p => p.toLowerCase() === cls.nom.toLowerCase())) reasons.push(`pas une promotion de ${slots[ct].nom}`);
    if (!has(rule.objet)) reasons.push(`objet « ${rule.objet} » manquant`);
    return { mode: "promotion", item: rule.objet, reasons, blocking: false };
  }
  if (!has(EQUIVALENCE_ITEM)) reasons.push(`objet « ${EQUIVALENCE_ITEM} » manquant`);
  return { mode: "equivalence", item: EQUIVALENCE_ITEM, reasons, blocking: false, note: "soutien de rang A avec un allié de cette classe" };
}

/**
 * Plan d'un changement de classe : mises à jour de la fiche, classes perdues.
 * initial : remplace la classe de base. promotion : ajoute l'emplacement suivant.
 * equivalence : perd la classe actuelle ; si la nouvelle est d'un palier inférieur, perd aussi les classes de ce palier et au-dessus.
 */
export function planClassChange(props, slots, cls, mode) {
  const t = cls.palier;
  const ct = currentTier(slots);
  let lostTiers = [];
  if (mode === "initial") lostTiers = slots[1] ? [1] : [];
  else if (mode === "equivalence" && ct > 0) lostTiers = Object.keys(slots).map(Number).filter(x => x >= Math.min(t, ct));
  if (slots[t] && !lostTiers.includes(t)) lostTiers.push(t);
  const lost = lostTiers.map(x => slots[x]).filter(Boolean);

  const delta = Object.fromEntries(STATS.map(s => [s, 0]));
  const dice = Object.fromEntries(STATS.map(s => [s, 0]));
  for (const c of lost) {
    for (const s of STATS) delta[s] -= n(c.mods?.[s]);
    for (const d of c.des) if (d in dice) dice[d] -= 1;
  }
  for (const s of STATS) delta[s] += n(cls.mods?.[s]);
  for (const d of cls.des) if (d in dice) dice[d] += 1;

  const previous = ct > 0 ? slots[ct] : null;
  const mvtDelta = cls.mvt - (previous?.mvt ?? 5);
  const updates = { classe: cls.nom, palier: String(t), profil: cls.profil, base_mvt: n(props.base_mvt, 5) + mvtDelta };
  for (const s of STATS) {
    if (delta[s]) updates[`base_${s}`] = n(props[`base_${s}`], s === "pv" ? 10 : 5) + delta[s];
    if (dice[s]) updates[`des_${s}`] = Math.max(0, n(props[`des_${s}`], 1) + dice[s]);
  }
  if (delta.pv) updates.pv = Math.max(1, n(props.pv, n(props.base_pv, 10)) + delta.pv);
  const keep = Object.entries(slots).filter(([x]) => !lostTiers.includes(Number(x))).map(([, c]) => c);
  return { updates, lost, keep, delta, dice, mvtDelta, tier: t };
}

/** Résumé lisible d'un plan. */
export function describePlan(plan, cls) {
  const parts = [];
  const stats = STATS.filter(s => plan.delta[s]).map(s => `${STAT_LABELS[s]} ${signed(plan.delta[s])}`);
  if (stats.length) parts.push(stats.join(", "));
  const dice = STATS.filter(s => plan.dice[s]).map(s => `${signed(plan.dice[s])} dé ${STAT_LABELS[s]}`);
  if (dice.length) parts.push(dice.join(", "));
  if (plan.mvtDelta) parts.push(`Mouvement ${signed(plan.mvtDelta)}`);
  if (plan.lost.length) parts.push(`perd ${plan.lost.map(c => c.nom).join(" et ")}`);
  return `${cls.nom} (${TIERS[cls.palier]}) : ${parts.length ? parts.join(" ; ") : "aucun changement de stats"}`;
}

/** Traits d'une classe : catalogue du module + objets Trait du monde dont le champ Classe(s) la nomme. */
export function classTraitList(className, worldTraits = []) {
  const hit = (classes) => String(classes ?? "").split(/[,;]+/).map(x => x.trim().toLowerCase()).includes(className.trim().toLowerCase());
  const out = new Map();
  for (const t of TRAITS) if (hit(t.classes)) out.set(t.nom, { nom: t.nom, prix: t.prix, effet: t.effet });
  for (const i of worldTraits) {
    const p = i.system?.props ?? {};
    if (hit(p.classes) && !out.has(i.name)) out.set(i.name, { nom: i.name, prix: n(p.prix_pm), effet: p.effet ?? "" });
  }
  return [...out.values()].sort((a, b) => a.prix - b.prix || a.nom.localeCompare(b.nom));
}

/* ------------------------------------------------------------------ */
/*  Fiche : liste des traits d'une classe                              */
/* ------------------------------------------------------------------ */

export function classTraitsHTML(item) {
  try {
    if (!item) return "";
    const worldTraits = (globalThis.game?.items?.contents ?? []).filter(i => itemCategory(i) === "trait");
    const list = classTraitList(item.name, worldTraits);
    if (!list.length) return "<p><i>Aucun trait trouvé pour cette classe (crée des objets Trait dont le champ « Classe(s) » contient son nom).</i></p>";
    const owner = item.parent;
    const owned = new Set([...(owner?.items ?? [])].filter(i => itemCategory(i) === "trait").map(i => i.name));
    const rows = list.map(t => `<tr><td>${owner ? (owned.has(t.nom) ? "✓" : "") : ""}</td><td><b>${esc(t.nom)}</b></td><td style="text-align:center">${t.prix === 0 ? "défaut" : `${t.prix} PM`}</td><td>${esc(t.effet)}</td></tr>`).join("");
    return `<table class="fe-traits-list"><thead><tr><th>${owner ? "Acquis" : ""}</th><th>Trait</th><th>Prix</th><th>Effet</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    console.warn(`${MODULE_ID} | traits de classe`, err);
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Application dans Foundry                                           */
/* ------------------------------------------------------------------ */

function findUsable(actor, name) {
  return actor.items.find(i => itemCategory(i) === "objet" && i.name.toLowerCase() === name.toLowerCase() && n(i.system.props?.uses) > 0) ?? null;
}

function classDocData(source) {
  const d = source.toObject ? source.toObject() : foundry.utils.deepClone(source);
  delete d._id; delete d.folder; delete d.ownership; delete d.sort;
  if (d.flags?.[MODULE_ID]) delete d.flags[MODULE_ID].catalog;
  return d;
}

/**
 * Applique un changement de classe à une unité.
 * source : objet Classe (du monde, ou déjà sur l'acteur si existingItemId est donné).
 */
export async function applyClassChange(actor, source, { mode = null, existingItemId = null, consume = true } = {}) {
  const cls = readClass(source);
  const props = actor.system.props ?? {};
  const slots = classSlots(actor.items, props, { exclude: existingItemId });
  const has = (name) => !!findUsable(actor, name);
  const elig = classEligibility(cls, slots, props, has);
  const finalMode = mode ?? elig.mode ?? "equivalence";
  const plan = planClassChange(props, slots, cls, finalMode);

  // Classes perdues : on supprime leurs objets. Emplacement virtuel conservé : on crée son objet.
  const toDelete = plan.lost.filter(c => !c.virtual && c.id).map(c => c.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);
  const toCreate = [];
  if (!existingItemId) toCreate.push(classDocData(source));
  for (const c of plan.keep) {
    if (!c.virtual) continue;
    const { catalogItemData } = await import("./setup.js");
    const d = catalogItemData(c.nom);
    if (d) toCreate.push(classDocData(d));
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate, { feSkipClass: true });
  await actor.update(Object.fromEntries(Object.entries(plan.updates).map(([k, v]) => [`system.props.${k}`, v])));

  // Objet consommé (Magister…)
  let consumed = null;
  if (consume && elig.item) {
    const it = findUsable(actor, elig.item);
    if (it) {
      await it.update({ "system.props.uses": n(it.system.props.uses) - 1 });
      consumed = it.name;
    }
  }
  // Trait par défaut de la nouvelle classe
  if (cls.traitDefaut && !actor.items.some(i => i.name === cls.traitDefaut)) {
    const { catalogItemData } = await import("./setup.js");
    const t = catalogItemData(cls.traitDefaut);
    if (t) {
      delete t.flags?.[MODULE_ID]?.catalog;
      t.system.props.equipe = true;
      await actor.createEmbeddedDocuments("Item", [t], { feNoCost: true });
    }
  }

  const title = { initial: "Classe choisie", promotion: "Promotion", equivalence: "Changement de classe" }[finalMode];
  const lines = [esc(describePlan(plan, cls))];
  if (consumed) lines.push(`Objet utilisé : ${esc(consumed)}.`);
  if (cls.armes.length) lines.push(`Armes maniables : ${esc(cls.armes.join(", "))}.`);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fe-chat"><h3>${title} : ${esc(actor.name)}</h3>${lines.map(l => `<p>${l}</p>`).join("")}</div>`
  });
  return plan;
}

/* ------------------------------------------------------------------ */
/*  Macro « Classe / promotion »                                       */
/* ------------------------------------------------------------------ */

function worldClasses() {
  const seen = new Map();
  for (const i of game.items.contents) {
    if (itemCategory(i) !== "classe" || i.system?.template === undefined || i.type.startsWith("_")) continue;
    if (!seen.has(i.name)) seen.set(i.name, i);
  }
  return [...seen.values()].sort((a, b) => readClass(a).palier - readClass(b).palier || a.name.localeCompare(b.name));
}

export async function classMacro({ actor = null } = {}) {
  actor ??= canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor || actor.system?.template !== TEMPLATE_IDS.unite) return ui.notifications.warn("Sélectionne le jeton d'une unité FE (ou définis ton personnage).");
  const props = actor.system.props ?? {};
  const slots = classSlots(actor.items, props);
  const has = (name) => !!findUsable(actor, name);
  const candidates = worldClasses();
  if (!candidates.length) return ui.notifications.warn("Aucun objet Classe dans le monde : relance l'installation du module (catalogue).");

  const modeLabel = { initial: "classe de départ", promotion: "promotion", equivalence: "Magister d'équivalence" };
  const entries = candidates.map(item => {
    const cls = readClass(item);
    const e = classEligibility(cls, slots, props, has);
    const preview = e.mode ? describePlan(planClassChange(props, slots, cls, e.mode), cls) : "";
    return { item, cls, e, preview };
  });
  const groups = [1, 2, 3].map(t => {
    const opts = entries.filter(x => x.cls.palier === t).map((x, i) => {
      const idx = entries.indexOf(x);
      const status = x.e.blocking ? x.e.reasons.join(", ") : `${modeLabel[x.e.mode]}${x.e.reasons.length ? ` · ${x.e.reasons.join(", ")}` : ""}`;
      return `<option value="${idx}" ${x.e.blocking ? "disabled" : ""}>${esc(x.cls.nom)} (${status})</option>`;
    }).join("");
    return opts ? `<optgroup label="${TIERS[t]}">${opts}</optgroup>` : "";
  }).join("");
  const firstOk = entries.findIndex(x => !x.e.blocking && !x.e.reasons.length);
  const slotRows = [1, 2, 3].map(t => `<tr><th>${TIERS[t]}</th><td>${esc(slots[t]?.nom ?? "—")}</td></tr>`).join("");
  const previews = entries.map(x => x.preview + (x.e.note ? ` (condition : ${x.e.note})` : ""));

  const res = await DialogV2().wait({
    window: { title: `Classe et promotion : ${actor.name}` },
    position: { width: 520 },
    content: `
      <p>Niveau ${n(props.niveau, 1)}. Promotion vers une classe avancée dès le niveau ${PROMOTION[2].niveau} (${PROMOTION[2].objet}), vers une classe d'élite dès le niveau ${PROMOTION[3].niveau} (${PROMOTION[3].objet}).</p>
      <table class="fe-class-slots">${slotRows}</table>
      <div class="form-group"><label>Nouvelle classe</label><select name="cls">${groups}</select></div>
      <p class="fe-class-preview hint"></p>
      ${game.user.isGM ? `<div class="form-group"><label><input type="checkbox" name="force"> Ignorer les conditions (MJ)</label></div>
      <div class="form-group"><label><input type="checkbox" name="noconsume"> Ne pas consommer d'objet</label></div>` : ""}`,
    render: (event, dialog) => {
      const root = dialog.element ?? event?.target?.element;
      const sel = root?.querySelector("select[name=cls]");
      const out = root?.querySelector(".fe-class-preview");
      if (!sel || !out) return;
      if (firstOk >= 0) sel.value = String(firstOk);
      const show = () => { out.textContent = previews[Number(sel.value)] ?? ""; };
      sel.addEventListener("change", show);
      show();
    },
    buttons: [{
      action: "ok", label: "Appliquer", default: true,
      callback: (e, b) => ({ idx: Number(b.form.elements.cls.value), force: !!b.form.elements.force?.checked, noconsume: !!b.form.elements.noconsume?.checked })
    }, { action: "cancel", label: "Annuler" }],
    rejectClose: false
  }).catch(() => null);
  if (!res || res === "cancel") return;
  const entry = entries[res.idx];
  if (!entry || entry.e.blocking) return;
  if (entry.e.reasons.length && !res.force) {
    return ui.notifications.warn(`${entry.cls.nom} : ${entry.e.reasons.join(", ")}.${game.user.isGM ? " Coche « Ignorer les conditions » pour passer outre." : " Demande au MJ."}`);
  }
  await applyClassChange(actor, entry.item, { mode: entry.e.mode, consume: !res.noconsume });
  actor.sheet?.render(false);
}

/* ------------------------------------------------------------------ */
/*  Glisser-déposer d'un objet Classe sur une unité                    */
/* ------------------------------------------------------------------ */

export function registerClassHooks() {
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id || options?.feSkipClass) return;
    const actor = item.parent;
    if (!(actor instanceof Actor) || actor.system?.template !== TEMPLATE_IDS.unite) return;
    if (itemCategory(item) !== "classe") return;
    const slots = classSlots(actor.items, actor.system.props, { exclude: item.id });
    const elig = classEligibility(readClass(item), slots, actor.system.props);
    if (elig.blocking) {
      ui.notifications.warn(`${item.name} : ${elig.reasons.join(", ")}.`);
      return actor.deleteEmbeddedDocuments("Item", [item.id]);
    }
    if (elig.reasons.length) ui.notifications.info(`${item.name} appliquée par glisser-déposer, sans vérifier : ${elig.reasons.join(", ")}. La macro « FE – Classe et promotion » vérifie les conditions.`);
    await applyClassChange(actor, item, { mode: elig.mode, existingItemId: item.id, consume: false });
  });
}
