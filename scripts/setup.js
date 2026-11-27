/**
 * FE Tactique – installation du contenu dans le monde : modèles CSB, catalogue d'objets, macros.
 */
import {
  MODULE_ID, MODULE_PATH, TEMPLATE_IDS, TEMPLATE_NAMES, WEAPONS, TOMES, STAVES, OBJECTS, TRAITS, CLASSES, KEYWORDS, WEAPON_TYPES, UNIT_ROLES, TOKEN_SCALE, isUnitActor
} from "./config.js";
import { ensureConvoy } from "./convoi.js";
import { buildTemplates } from "./csb-templates.js";
import { itemCategory, readClass } from "./engine.js";
import { unitPropsFromClass, ensureDefaults, syncLordHp } from "./progression.js";
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
  await refreshSheets();
}

/** Recharge depuis leur modèle toutes les fiches FE du monde (comme le bouton « Recharger » de CSB), valeurs conservées. */
export async function refreshSheets() {
  const ids = new Set(Object.values(TEMPLATE_IDS));
  const isFe = (d) => d.system?.template && ids.has(d.system.template) && !d.type.startsWith("_");
  const sys = (d) => {
    const tpl = d.documentName === "Actor" ? game.actors.get(d.system.template) : game.items.get(d.system.template);
    return tpl ? appliedTemplateSystem(tpl) : null;
  };
  const itemUpdates = (items) => items.filter(isFe).map(i => {
    const u = { _id: i.id, system: sys(i) };
    // 0.2.0 : stats de classe absolues -> modificateurs
    const p = i.system.props ?? {};
    if (itemCategory(i) === "classe" && p.cl_mod_pv === undefined && p.cl_pv !== undefined && u.system) {
      const c = readClass(i);
      u.system.props = Object.fromEntries(Object.entries(c.mods).map(([k, v]) => [`cl_mod_${k}`, v]));
    }
    // 0.10.1 : les arcs du catalogue frappent à 2 cases (portée 2, plus 1-2)
    if (u.system && bowRangeFix(i)) u.system.props = { ...(u.system.props ?? {}), por_min: 2 };
    return u;
  }).filter(u => u.system);
  const worldItems = itemUpdates(game.items.contents);
  if (worldItems.length) await Item.updateDocuments(worldItems);
  for (const a of game.actors.filter(isFe)) {
    const s = sys(a);
    if (s) await a.update({ system: s });
    const emb = itemUpdates(a.items.contents);
    if (emb.length) await a.updateEmbeddedDocuments("Item", emb);
    if (a.system?.template === TEMPLATE_IDS.unite) { await migrateStatModel(a); await syncClassRanks(a); }
    if (a.system?.template === TEMPLATE_IDS.unite) await migrateClassBalance(a);
    if (a.system?.template === TEMPLATE_IDS.unite) await syncLordHp(a); // 0.13.1 : +3 PV des personnages principaux
    await ensureDefaults(a);
  }
}

/** Pure : arc du catalogue resté à la portée 1-2 des versions précédentes. */
export function bowRangeFix(item) {
  const p = item?.system?.props ?? {};
  if (p.type_arme !== "arc" || Number(p.por_min) !== 1 || Number(p.por_max) !== 2) return false;
  return WEAPONS.some(w => w.type === "arc" && w.nom === item.name);
}

/** Recopie sur la fiche les rangs d'arme offerts par les classes (rang D des classes de base). */
export async function syncClassRanks(actor) {
  const { readUnit } = await import("./engine.js");
  const u = readUnit(actor);
  const p = actor.system.props ?? {};
  const upd = {};
  for (const [t, r] of Object.entries(u.ranks)) if (p[`rang_${t}`] !== r) upd[`system.props.rang_${t}`] = r;
  if (Object.keys(upd).length) await actor.update(upd);
}

/**
 * 0.6.0 : les stats de la fiche ne contiennent plus les modificateurs de classe ni les gains de niveau.
 * Ancien base_X (total) -> base_X = total − classes − gains, niv_X = gains.
 */
export async function migrateStatModel(actor) {
  if (actor.getFlag(MODULE_ID, "statModel") >= 2) return;
  const { classSlots } = await import("./classes.js");
  const props = actor.system.props ?? {};
  const slots = Object.values(classSlots(actor.items, props));
  const gains = actor.getFlag(MODULE_ID, "gains") ?? {};
  const upd = { [`flags.${MODULE_ID}.statModel`]: 2 };
  for (const s of ["pv", "for", "mag", "def", "res", "tech", "vit"]) {
    const total = Number(props[`base_${s}`] ?? (s === "pv" ? 10 : 5));
    const mods = slots.reduce((a, c) => a + Number(c.mods?.[s] ?? 0), 0);
    const g = Number(gains[s] ?? 0);
    upd[`system.props.base_${s}`] = total - mods - g;
    upd[`system.props.niv_${s}`] = g;
  }
  await actor.update(upd);
}

/** Modificateurs des classes de base jusqu'à la 0.7.1 [PV, For, Mag, Déf, Rés, Tech, Vit]. */
export const CLASS_MODS_071 = {
  "Soldat": [4, 1, -2, 2, -1, 1, 0], "Écuyer": [6, 2, -2, 1, -2, 0, 1], "Coursier": [6, 0, -2, -1, -1, 2, 2],
  "Chasseur": [2, 1, -1, -2, 0, 2, 2], "Voleur": [4, 0, 0, -2, -1, 2, 2], "Brute": [10, 3, -1, 0, -1, -3, 0],
  "Mercenaire": [2, 2, 0, 0, -2, 1, 1], "Scribe": [4, 0, 2, -2, 1, 0, 0], "Sauvage": [8, 2, -2, 0, -1, -1, 1],
  "Moine": [2, 0, 2, -2, 2, 0, 0], "Apprentie": [4, -1, 2, -2, 0, 2, 0], "Shaman": [4, 0, 3, -2, 1, 0, -1]
};

/**
 * Pure : mises à jour d'un objet Classe de base resté aux modificateurs de la 0.7.1.
 * Un objet modifié à la main (valeurs différentes de la 0.7.1) n'est pas touché. Retour : { props, pvDelta } ou null.
 */
export function classBalanceUpdate(name, mods) {
  const old = CLASS_MODS_071[name];
  const c = CLASSES[name];
  if (!old || !c) return null;
  const keys = ["pv", "for", "mag", "def", "res", "tech", "vit"];
  if (keys.some((k, i) => Number(mods?.[k] ?? 0) !== old[i])) return null;
  const base = { pv: 10, for: 5, mag: 5, def: 5, res: 5, tech: 5, vit: 5 };
  const props = Object.fromEntries(keys.map(k => [`cl_mod_${k}`, c[k] - base[k]]));
  if (keys.every((k, i) => props[`cl_mod_${k}`] === old[i])) return null;
  return { props, pvDelta: props.cl_mod_pv - old[0] };
}

/** 0.8.0 : nouvel équilibrage des classes de base sur les objets Classe des unités ; les PV actuels suivent le maximum. */
export async function migrateClassBalance(actor) {
  if (actor.getFlag(MODULE_ID, "classBalance") >= 1) return;
  const upd = [];
  let pvDelta = 0;
  for (const i of actor.items) {
    if (itemCategory(i) !== "classe") continue;
    const c = readClass(i);
    if (c.palier !== 1) continue;
    const u = classBalanceUpdate(i.name, c.mods);
    if (!u) continue;
    upd.push({ _id: i.id, ...Object.fromEntries(Object.entries(u.props).map(([k, v]) => [`system.props.${k}`, v])) });
    pvDelta += u.pvDelta;
  }
  if (upd.length) await actor.updateEmbeddedDocuments("Item", upd);
  const data = { [`flags.${MODULE_ID}.classBalance`]: 1 };
  const pv = actor.system.props?.pv;
  if (pvDelta && pv !== undefined && pv !== null && pv !== "") data["system.props.pv"] = Math.max(1, Number(pv) + pvDelta);
  await actor.update(data);
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

export function classItemData(nom) {
  const c = CLASSES[nom];
  return {
    name: nom, type: "equippableItem", img: icon(c.armes?.[0] ?? "epee"),
    system: {
      ...appliedTemplateSystem(requireTemplate("classe")),
      props: {
        cl_palier: "1", cl_profil: c.profil, cl_mvt: c.mvt,
        cl_mod_pv: c.pv - 10, cl_mod_for: c.for - 5, cl_mod_mag: c.mag - 5, cl_mod_def: c.def - 5,
        cl_mod_res: c.res - 5, cl_mod_tech: c.tech - 5, cl_mod_vit: c.vit - 5, cl_promos: "",
        cl_de1: c.des[0] ?? "aucun", cl_de2: c.des[1] ?? "aucun",
        cl_armes: (c.armes ?? []).join(", "), cl_depart: c.depart ?? "", cl_trait: c.traitDefaut ?? "",
        cl_mots: (c.motsCles ?? []).join(", "), cl_rang: "D", effet: ""
      }
    },
    flags: { [MODULE_ID]: { catalog: "classe" } }
  };
}

export function keywordItemData(k) {
  return {
    name: k.nom, type: "equippableItem", img: "icons/svg/target.svg",
    system: { ...appliedTemplateSystem(requireTemplate("motcle")), props: { mc_cle: k.cle, effet: k.effet } },
    flags: { [MODULE_ID]: { catalog: "motcle" } }
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
  const c = Object.keys(CLASSES).find(x => x.toLowerCase() === n);
  if (c) return classItemData(c);
  const k = KEYWORDS.find(x => x.nom.toLowerCase() === n || x.cle === n);
  if (k) return keywordItemData(k);
  return null;
}

async function ensureFolder(name, type, parent = null, color = "#7a1f1f") {
  return game.folders.find(f => f.name === name && f.type === type && (f.folder?.id ?? null) === (parent?.id ?? null))
    ?? Folder.create({ name, type, folder: parent?.id ?? null, color });
}

export const PACK_NAME = "fe-catalogue";
export const PACK_ID = `world.${PACK_NAME}`;

function catalogGroups() {
  return [
    ["Armes", WEAPONS.map(weaponItemData)],
    ["Tomes", TOMES.map(weaponItemData)],
    ["Sceptres", STAVES.map(staffItemData)],
    ["Objets", OBJECTS.map(objectItemData)],
    ["Traits", TRAITS.map(t => traitItemData(t))],
    ["Classes", Object.keys(CLASSES).map(classItemData)],
    ["Mots-clés", KEYWORDS.map(keywordItemData)]
  ];
}

/**
 * Compendium du monde « FE – Catalogue » : tout le catalogue rangé par dossiers.
 * Les objets du module y sont mis à jour à chaque version ; ceux que tu y ajoutes ne sont pas touchés.
 */
export async function installCompendium() {
  const CC = foundry.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
  let pack = game.packs.get(PACK_ID);
  if (!pack) pack = await CC.createCompendium({ type: "Item", label: "FE – Catalogue", name: PACK_NAME, package: "world" });
  if (pack.locked) await pack.configure({ locked: false });
  const docs = await pack.getDocuments();
  const folders = pack.folders ?? new Map();
  for (const [name, list] of catalogGroups()) {
    let folder = [...folders.values?.() ?? folders].find?.(f => f.name === name);
    folder ??= await Folder.create({ name, type: "Item", color: "#7a1f1f" }, { pack: pack.collection });
    const byName = new Map(docs.filter(d => d.getFlag(MODULE_ID, "catalog")).map(d => [d.name, d]));
    const toCreate = [], toUpdate = [];
    for (const d of list) {
      const ex = byName.get(d.name);
      if (ex) toUpdate.push({ _id: ex.id, system: d.system, img: d.img, folder: folder.id });
      else toCreate.push({ ...d, folder: folder.id });
    }
    if (toCreate.length) await Item.createDocuments(toCreate, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
  }
  await pack.getIndex();
  return pack;
}

export async function installCatalog() {
  const root = await ensureFolder("FE – Catalogue", "Item");
  for (const [name, list] of catalogGroups()) {
    const folder = await ensureFolder(name, "Item", root);
    const inFolder = game.items.filter(i => i.folder?.id === folder.id);
    const existing = new Set(inFolder.map(i => i.name));
    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };
    const toCreate = list.filter(d => !existing.has(d.name)).map(d => ({ ...d, folder: folder.id, ownership }));
    if (toCreate.length) await Item.createDocuments(toCreate);
    // Classes du module : mises à jour avec les données de cette version
    if (name === "Classes") {
      const upd = inFolder.filter(i => i.getFlag?.(MODULE_ID, "catalog") === "classe")
        .map(i => ({ _id: i.id, "system.props": list.find(d => d.name === i.name)?.system.props, ownership }))
        .filter(u => u["system.props"]);
      if (upd.length) await Item.updateDocuments(upd);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Unités                                                             */
/* ------------------------------------------------------------------ */

/**
 * Crée une unité.
 * { name, classe, props (surcharges), items: [noms du catalogue], equip: nom de l'arme équipée, disposition, folder, img }
 */
export async function createUnit({ name, classe, props = {}, items = null, equip = null, disposition = null, folder = null, img = null, link = true, defaultTrait = true }) {
  const tpl = requireTemplate("unite");
  const c = CLASSES[classe];
  const allProps = unitPropsFromClass(classe, props);
  const actor = await Actor.create({
    name, type: "character", folder: folder?.id ?? folder ?? null,
    img: img ?? undefined,
    system: { ...appliedTemplateSystem(tpl), props: allProps },
    prototypeToken: {
      name, actorLink: link,
      ...tokenLook(allProps.role, { disposition }),
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
      bar1: { attribute: "attributeBar.pv" }
    },
    flags: { [MODULE_ID]: { unit: true, statModel: 2, ...(allProps.role === "principal" ? { lordHp: true } : {}) } }
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
  if (c) itemData.unshift(classItemData(classe));
  for (const d of itemData) delete d.flags?.[MODULE_ID]?.catalog;
  // La classe est déjà appliquée par unitPropsFromClass : on ne la réapplique pas.
  if (itemData.length) await actor.createEmbeddedDocuments("Item", itemData, { feSkipClass: true });
  return actor;
}

/* ------------------------------------------------------------------ */
/*  Macros                                                             */
/* ------------------------------------------------------------------ */

const API = `game.modules.get("${MODULE_ID}").api`;
export const MACROS = [
  ["FE – Attaquer", "icons/svg/sword.svg", `${API}.attack();`],
  ["FE – Utiliser un sceptre", "icons/svg/heal.svg", `${API}.staff();`],
  ["FE – Classe et promotion", "icons/svg/statue.svg", `${API}.classe();`],
  ["FE – Montée de niveau", "icons/svg/upgrade.svg", `${API}.levelUp();`],
  ["FE – Acheter un dé de stat", "icons/svg/d20-grey.svg", `${API}.buyDie();`],
  ["FE – Fin de phase", "icons/svg/clockwork.svg", `${API}.endPhase();`],
  ["FE – Bonus temporaire", "icons/svg/aura.svg", `${API}.bonusDialog();`],
  ["FE – Nouvelle unité", "icons/svg/mystery-man.svg", `${API}.newUnit();`],
  ["FE – Terrain des Régions", "icons/svg/terrain.svg", `${API}.regions();`],
  ["FE – Couleurs des jetons", "icons/svg/target.svg", `${API}.tokenLook();`],
  ["FE – Nouveau chapitre (jetons à zéro)", "icons/svg/book.svg", `${API}.newChapter();`],
  ["FE – Préparer le chapitre 1", "icons/svg/village.svg", `${API}.setupChapter1();`],
  ["FE – Exporter la scène (JSON)", "icons/svg/down.svg", `${API}.exportScene();`],
  ["FE – Loot", "icons/svg/chest.svg", `${API}.loot();`],
  ["FE – Convoi", "icons/svg/item-bag.svg", `${API}.convoi();`],
  ["FE – Générer un ennemi", "icons/svg/skull.svg", `${API}.enemy();`]
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
    await installCompendium();
    await installMacros();
    await ensureConvoy();
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
      ? `<p>Le module est passé en version ${current}. Mettre à jour les modèles CSB et les macros ?</p><p class="hint">Les fiches existantes sont rechargées depuis les nouveaux modèles et gardent leurs valeurs.</p>`
      : `<p>Installer le contenu FE Tactique dans ce monde ?</p><ul><li>modèles CSB : Unité, Convoi, Arme, Tome, Sceptre, Objet, Trait, Classe, Mot-clé ;</li><li>catalogue des armes, tomes, sceptres, objets, traits, classes et mots-clés ;</li><li>macros de combat, de progression et de scène ;</li><li>un acteur Convoi (or, inventaire et compteurs de l'équipe).</li></ul>`,
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
  for (const a of game.actors.filter(a => a.type === "character" && isUnitActor(a))) {
    await a.update({ "system.props.jet_bouclier": 0, "system.props.jet_aile": 0, "system.props.jet_esprit": 0 });
  }
  ui.notifications.info("Jetons remis à zéro.");
}

/* ------------------------------------------------------------------ */
/*  Apparence du jeton selon le type d'unité                           */
/* ------------------------------------------------------------------ */

/** Données de jeton : camp, anneau dynamique coloré et échelle 1.1. disposition : force le camp (sinon celui du rôle). */
export function tokenLook(role, { disposition = null } = {}) {
  const r = UNIT_ROLES[role] ?? UNIT_ROLES.secondaire;
  return {
    disposition: disposition ?? r.disposition,
    ring: { enabled: true, colors: { ring: r.ring } },
    texture: { scaleX: TOKEN_SCALE, scaleY: TOKEN_SCALE }
  };
}

/** Applique l'apparence au jeton prototype et aux jetons posés d'une unité. */
export async function applyTokenLook(actor, { keepDisposition = false } = {}) {
  const role = actor.system?.props?.role ?? "secondaire";
  const look = tokenLook(role, { disposition: keepDisposition ? actor.prototypeToken.disposition : null });
  await actor.update({ prototypeToken: look });
  for (const t of actor.getActiveTokens?.(false, true) ?? []) {
    if (t.isOwner) await t.update(look);
  }
}

/** Macro : applique couleurs d'anneau et échelle à toutes les unités FE (ou aux jetons sélectionnés). */
export async function tokenLookMacro() {
  if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ.");
  const selected = canvas.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];
  const actors = selected.length ? [...new Set(selected)] : game.actors.filter(a => a.system?.template === TEMPLATE_IDS.unite);
  for (const a of actors) await applyTokenLook(a, { keepDisposition: true });
  ui.notifications.info(`Anneaux et échelle appliqués à ${actors.length} unité(s).`);
}
