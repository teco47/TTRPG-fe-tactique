/**
 * FE Tactique – installation du contenu dans le monde : modèles CSB, catalogue d'objets, macros.
 */
import {
  MODULE_ID, MODULE_PATH, TEMPLATE_IDS, TEMPLATE_NAMES, WEAPONS, TOMES, STAVES, OBJECTS, TRAITS, CLASSES, WEAPON_TYPES
} from "./config.js";
import { buildTemplates } from "./csb-templates.js";
import { unitPropsFromClass } from "./progression.js";
import { timedEffectData } from "./status.js";

const DialogV2 = () => foundry.applications.api.DialogV2;
const rnd = () => (Math.random() * 0x100000000) >>> 0;

/* ------------------------------------------------------------------ */
/*  Modèles CSB                                                        */
/* ------------------------------------------------------------------ */

async function upsertTemplate(collection, cls, tpl) {
  const existing = collection.get(tpl.id) ?? collection.find(d => d.name === tpl.name && d.type === tpl.type);
  const system = { ...tpl.data, templateSystemUniqueVersion: rnd() };
  if (existing) {
    await existing.update({ system });
    return existing;
  }
  return cls.create({ _id: tpl.id, name: tpl.name, type: tpl.type, system, flags: { [MODULE_ID]: { template: true } } }, { keepId: true });
}

export async function installTemplates() {
  const pack = buildTemplates();
  for (const tpl of pack.items) await upsertTemplate(game.items, Item, tpl);
  for (const tpl of pack.actors) await upsertTemplate(game.actors, Actor, tpl);
}

/** Données à recopier depuis un modèle dans un acteur/objet qui l'utilise (comme le bouton « Recharger » de CSB). */
function appliedTemplateSystem(tplDoc) {
  const s = tplDoc.system;
  const out = {
    template: tplDoc.id,
    templateSystemUniqueVersion: s.templateSystemUniqueVersion,
    header: foundry.utils.deepClone(s.header),
    body: foundry.utils.deepClone(s.body),
    hidden: foundry.utils.deepClone(s.hidden ?? []),
    display: foundry.utils.deepClone(s.display)
  };
  if (tplDoc.documentName === "Actor") {
    out.attributeBar = foundry.utils.deepClone(s.attributeBar ?? {});
    out.initiativeFormula = s.initiativeFormula ?? "";
  }
  return out;
}

function requireTemplate(cat) {
  const doc = cat === "unite" ? game.actors.get(TEMPLATE_IDS.unite) : game.items.get(TEMPLATE_IDS[cat]);
  if (!doc) throw new Error(`Modèle ${TEMPLATE_NAMES[cat]} introuvable : lance d'abord l'installation du module.`);
  return doc;
}

/* ------------------------------------------------------------------ */
/*  Données d'objets                                                   */
/* ------------------------------------------------------------------ */

const icon = (type) => `${MODULE_PATH}/assets/icons/${WEAPON_TYPES[type]?.icon ?? "icone-ep.png"}`;

export function weaponItemData(w) {
  const cat = WEAPON_TYPES[w.type]?.magic ? "tome" : "arme";
  return {
    name: w.nom, type: "equippableItem", img: icon(w.type),
    system: {
      ...appliedTemplateSystem(requireTemplate(cat)),
      props: {
        type_arme: w.type, rang_req: w.rang, pui: w.pui, prec: w.prec, crit: w.crit ?? 0, sans_crit: w.crit === null,
        poids: w.poids, por_min: w.porMin, por_max: w.porMax, dur: w.dur, dur_max: w.dur, prix: w.prix,
        efficace: w.efficace ?? "", special: w.special ?? "aucun", sans_riposte: !!w.sansRiposte,
        bonus_esq: w.bonusEsq ?? 0, bonus_res: w.bonusRes ?? 0, equipee: false, effet: w.effet ?? ""
      }
    },
    flags: { [MODULE_ID]: { catalog: cat } }
  };
}

export function staffItemData(s) {
  return {
    name: s.nom, type: "equippableItem", img: icon("sceptre"),
    system: {
      ...appliedTemplateSystem(requireTemplate("sceptre")),
      props: {
        rang_req: s.rang, effet_sceptre: s.effetCle, soin_base: s.soin, por_min: s.porMin, por_max: s.porMax,
        dur: s.dur, dur_max: s.dur, prix: s.prix, equipee: false, effet: s.effet
      }
    },
    flags: { [MODULE_ID]: { catalog: "sceptre" } }
  };
}

export function objectItemData(o) {
  return {
    name: o.nom, type: "equippableItem", img: "icons/svg/item-bag.svg",
    system: {
      ...appliedTemplateSystem(requireTemplate("objet")),
      props: { effet_objet: o.effetCle, valeur: o.valeur, uses: o.uses, uses_max: o.uses, prix: o.prix, effet: o.effet }
    },
    flags: { [MODULE_ID]: { catalog: "objet" } }
  };
}

export function traitItemData(t, { equipped = false } = {}) {
  return {
    name: t.nom, type: "equippableItem", img: "icons/svg/aura.svg",
    system: {
      ...appliedTemplateSystem(requireTemplate("trait")),
      props: {
        classes: t.classes, prix_pm: t.prix, type_trait: t.type, boost_stat: t.stat ?? "aucun", boost_val: t.valeur ?? 0,
        equipe: equipped, effet: t.effet
      }
    },
    flags: { [MODULE_ID]: { catalog: "trait" } }
  };
}

/** Données d'objet à partir d'un nom du catalogue (armes, tomes, sceptres, objets, traits). */
export function catalogItemData(name) {
  const n = name.trim().toLowerCase();
  const w = [...WEAPONS, ...TOMES].find(x => x.nom.toLowerCase() === n);
  if (w) return weaponItemData(w);
  const s = STAVES.find(x => x.nom.toLowerCase() === n);
  if (s) return staffItemData(s);
  const o = OBJECTS.find(x => x.nom.toLowerCase() === n);
  if (o) return objectItemData(o);
  const t = TRAITS.find(x => x.nom.toLowerCase() === n);
  if (t) return traitItemData(t);
  return null;
}

async function ensureFolder(name, type, parent = null, color = "#7a1f1f") {
  return game.folders.find(f => f.name === name && f.type === type && (f.folder?.id ?? null) === (parent?.id ?? null))
    ?? Folder.create({ name, type, folder: parent?.id ?? null, color });
}

export async function installCatalog() {
  const root = await ensureFolder("FE – Catalogue", "Item");
  const groups = [
    ["Armes", WEAPONS.map(weaponItemData)],
    ["Tomes", TOMES.map(weaponItemData)],
    ["Sceptres", STAVES.map(staffItemData)],
    ["Objets", OBJECTS.map(objectItemData)],
    ["Traits", TRAITS.map(t => traitItemData(t))]
  ];
  for (const [name, list] of groups) {
    const folder = await ensureFolder(name, "Item", root);
    const existing = new Set(game.items.filter(i => i.folder?.id === folder.id).map(i => i.name));
    const toCreate = list.filter(d => !existing.has(d.name)).map(d => ({ ...d, folder: folder.id }));
    if (toCreate.length) await Item.createDocuments(toCreate);
  }
}

/* ------------------------------------------------------------------ */
/*  Unités                                                             */
/* ------------------------------------------------------------------ */

/**
 * Crée une unité.
 * { name, classe, props (surcharges), items: [noms du catalogue], equip: nom de l'arme équipée, disposition, folder, img }
 */
export async function createUnit({ name, classe, props = {}, items = null, equip = null, disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY, folder = null, img = null, link = true, defaultTrait = true }) {
  const tpl = requireTemplate("unite");
  const c = CLASSES[classe];
  const allProps = unitPropsFromClass(classe, props);
  const actor = await Actor.create({
    name, type: "character", folder: folder?.id ?? folder ?? null,
    img: img ?? undefined,
    system: { ...appliedTemplateSystem(tpl), props: allProps },
    prototypeToken: {
      name, actorLink: link, disposition,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      bar1: { attribute: "attributeBar.pv" }
    },
    flags: { [MODULE_ID]: { unit: true } }
  });
  const itemNames = items ?? [c.depart];
  const itemData = [];
  for (const n of itemNames) {
    const d = catalogItemData(n);
    if (!d) { console.warn(`${MODULE_ID} | objet inconnu : ${n}`); continue; }
    delete d.flags?.[MODULE_ID]?.catalog;
    itemData.push(d);
  }
  const toEquip = equip ?? itemNames.find(n => catalogItemData(n)?.system?.props?.type_arme !== undefined || STAVES.some(s => s.nom === n));
  for (const d of itemData) if (d.name === toEquip && "equipee" in d.system.props) d.system.props.equipee = true;
  if (defaultTrait && c.traitDefaut && !itemData.some(d => d.name === c.traitDefaut)) {
    const t = TRAITS.find(x => x.nom === c.traitDefaut);
    if (t) itemData.push(traitItemData(t, { equipped: true }));
  }
  if (itemData.length) await actor.createEmbeddedDocuments("Item", itemData);
  return actor;
}

/* ------------------------------------------------------------------ */
/*  Macros                                                             */
/* ------------------------------------------------------------------ */

const API = `game.modules.get("${MODULE_ID}").api`;
export const MACROS = [
  ["FE – Attaquer", "icons/svg/sword.svg", `${API}.attack();`],
  ["FE – Utiliser un sceptre", "icons/svg/heal.svg", `${API}.staff();`],
  ["FE – Montée de niveau", "icons/svg/upgrade.svg", `${API}.levelUp();`],
  ["FE – Acheter un dé de stat", "icons/svg/d20-grey.svg", `${API}.buyDie();`],
  ["FE – Fin de phase", "icons/svg/clockwork.svg", `${API}.endPhase();`],
  ["FE – Bonus temporaire", "icons/svg/aura.svg", `${API}.bonusDialog();`],
  ["FE – Nouvelle unité", "icons/svg/mystery-man.svg", `${API}.newUnit();`],
  ["FE – Nouveau chapitre (jetons à zéro)", "icons/svg/book.svg", `${API}.newChapter();`],
  ["FE – Préparer le chapitre 1", "icons/svg/village.svg", `${API}.setupChapter1();`]
];

export async function installMacros() {
  const folder = await ensureFolder("FE Tactique", "Macro");
  for (const [name, img, command] of MACROS) {
    const existing = game.macros.find(m => m.name === name);
    if (existing) await existing.update({ command, img });
    else await Macro.create({ name, type: "script", img, command, folder: folder.id, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
  }
}

export async function installAll({ silent = false } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Seul le MJ peut installer le contenu FE Tactique.");
  if (game.system.id !== "custom-system-builder") return ui.notifications.error("FE Tactique demande le système Custom System Builder.");
  ui.notifications.info("FE Tactique : installation des modèles, du catalogue et des macros…");
  try {
    await installTemplates();
    await installCatalog();
    await installMacros();
    await game.settings.set(MODULE_ID, "installedVersion", game.modules.get(MODULE_ID).version);
    ui.notifications.info("FE Tactique : installation terminée. Les macros sont dans le dossier « FE Tactique ».");
  } catch (err) {
    console.error(`${MODULE_ID} | installation`, err);
    ui.notifications.error(`FE Tactique : échec de l'installation (${err.message}). Détails dans la console (F12).`);
  }
}

export async function offerInstall() {
  if (!game.user.isGM) return;
  const installed = game.settings.get(MODULE_ID, "installedVersion");
  const current = game.modules.get(MODULE_ID).version;
  if (installed === current && game.actors.get(TEMPLATE_IDS.unite)) return;
  const ok = await DialogV2().confirm({
    window: { title: "FE Tactique" },
    content: installed
      ? `<p>Le module est passé en version ${current}. Mettre à jour les modèles CSB et les macros ?</p><p class="hint">Les fiches existantes gardent leurs valeurs ; recharge-les ensuite depuis le modèle (clic droit > Recharger).</p>`
      : `<p>Installer le contenu FE Tactique dans ce monde ?</p><ul><li>modèles CSB : Unité, Arme, Tome, Sceptre, Objet, Trait ;</li><li>catalogue des armes, tomes, sceptres, objets et traits ;</li><li>macros de combat, de progression et de scène.</li></ul>`,
    rejectClose: false
  }).catch(() => false);
  if (ok) await installAll();
}

/* ------------------------------------------------------------------ */
/*  Outils divers                                                      */
/* ------------------------------------------------------------------ */

export async function bonusDialog() {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn("Sélectionne les unités qui reçoivent le bonus ou le malus.");
  const fields = [["prec", "Précision"], ["esq", "Esquive"], ["crit", "Critique"], ["atq", "Attaque"], ["def", "Défense"], ["res", "Résistance"], ["for", "Force"], ["mag", "Magie"], ["tech", "Technique"], ["vit", "Vitesse"]];
  const res = await DialogV2().wait({
    window: { title: "Bonus ou malus temporaire" },
    content: `
      <div class="form-group"><label>Nom</label><input name="name" type="text" value="Bonus temporaire"></div>
      <div class="fe-grid">${fields.map(([k, l]) => `<label>${l} <input name="${k}" type="number" value="0" style="width:4em"></label>`).join("")}</div>
      <div class="form-group"><label>Expire à la fin de la phase des</label><select name="camp"><option value="joueurs">joueurs</option><option value="ennemis">ennemis</option><option value="">jamais (à retirer à la main)</option></select></div>
      <div class="form-group"><label>Nombre de phases</label><input name="phases" type="number" value="1" min="1"></div>`,
    buttons: [{
      action: "ok", label: "Appliquer", default: true,
      callback: (e, b) => {
        const el = b.form.elements;
        const bonus = {};
        for (const [k] of fields) { const v = Number(el[k].value); if (v) bonus[k] = v; }
        return { name: el.name.value, bonus, camp: el.camp.value, phases: Math.max(1, Number(el.phases.value) || 1) };
      }
    }, { action: "cancel", label: "Annuler" }],
    rejectClose: false
  }).catch(() => null);
  if (!res || res === "cancel") return;
  const negative = Object.values(res.bonus).some(v => v < 0) && !Object.values(res.bonus).some(v => v > 0);
  const data = timedEffectData({ kind: negative ? "malus" : "bonus", name: res.name, bonus: res.bonus, expireCamp: res.camp, phases: res.phases });
  for (const t of tokens) await t.actor?.createEmbeddedDocuments("ActiveEffect", [foundry.utils.deepClone(data)]);
}

export async function newChapter() {
  if (!game.user.isGM) return;
  const ok = await DialogV2().confirm({ window: { title: "Nouveau chapitre" }, content: "<p>Remettre à zéro les jetons Bouclier, Ailé et Esprit de toutes les unités du monde ?</p>", rejectClose: false }).catch(() => false);
  if (!ok) return;
  for (const a of game.actors.filter(a => a.type === "character" && a.system?.props)) {
    await a.update({ "system.props.jet_bouclier": 0, "system.props.jet_aile": 0, "system.props.jet_esprit": 0 });
  }
  ui.notifications.info("Jetons remis à zéro.");
}
