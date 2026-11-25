/**
 * FE Tactique – point d'entrée du module.
 * Module pour Foundry VTT v14 + Custom System Builder 6.x.
 */
import { MODULE_ID, WEAPON_TYPES } from "./config.js";
import * as config from "./config.js";
import * as engine from "./engine.js";
import { readUnit, sheetSummary, itemCategory, readWeapon } from "./engine.js";
import { registerMovementCosts, refreshPlannedPaths, terrainUnderToken, terrainAtPoint } from "./terrain.js";
import { registerSocket } from "./socket.js";
import { registerStatusEffects, registerStatusHooks, syncCounters } from "./status.js";
import { registerBadgeHooks } from "./badge.js";
import { attackMacro, staffMacro, useObject, toggleEquip } from "./combat.js";
import { levelUp, buyDie, endPhase, newUnitDialog, computeLevelUp, registerClassHooks, ensureDefaults } from "./progression.js";
import { installAll, offerInstall, bonusDialog, newChapter, createUnit, catalogItemData } from "./setup.js";
import { buildTemplates } from "./csb-templates.js";
import { setupChapter1 } from "./chapter1.js";

/* ------------------------------------------------------------------ */
/*  Valeurs affichées par la fiche CSB                                 */
/* ------------------------------------------------------------------ */
const cache = new Map();
function summaryFor(actor) {
  const key = actor?.uuid ?? actor?.id;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.t < 40) return hit.v;
  const v = sheetSummary(readUnit(actor));
  cache.set(key, { t: now, v });
  return v;
}

function sheet(actor, stat) {
  try {
    if (!actor) return "?";
    const s = summaryFor(actor);
    if (stat === "slots_text") return `${s.slots_used} / ${s.slots}`;
    if (stat === "pv_max") return s.pv_max;
    return s[stat] ?? "?";
  } catch (err) {
    console.warn(`${MODULE_ID} | fiche`, err);
    return "?";
  }
}

function itemLabel(item, field) {
  try {
    if (!item) return "";
    const p = item.system?.props ?? {};
    const cat = itemCategory(item);
    const on = (v) => v === true || v === "true";
    switch (field) {
      case "equip": return cat === "trait" ? (on(p.equipe) ? "★" : "☆") : (on(p.equipee) ? "★" : "☆");
      case "type": return cat === "sceptre" ? "Sceptre" : (WEAPON_TYPES[p.type_arme]?.label ?? "");
      case "rang": return p.rang_req ?? "";
      case "pui": return cat === "sceptre" ? "—" : (p.pui ?? 0);
      case "prec": return cat === "sceptre" ? "—" : (p.prec ?? 0);
      case "crit": return cat === "sceptre" ? "—" : (on(p.sans_crit) ? "—" : (p.crit ?? 0));
      case "poids": return cat === "sceptre" ? "—" : (p.poids ?? 0);
      case "portee": { const w = readWeapon(item); return w ? (w.porMin === w.porMax ? `${w.porMin}` : `${w.porMin}-${w.porMax}`) : ""; }
      case "dur": return `${p.dur ?? 0}/${p.dur_max ?? p.dur ?? 0}`;
      case "uses": return `${p.uses ?? 0}/${p.uses_max ?? p.uses ?? 0}`;
      case "prix": return `${p.prix_pm ?? 0} PM`;
      case "effet": return p.effet ?? "";
      case "cl_profil": return config.PROFILES[p.cl_profil] ?? p.cl_profil ?? "";
      case "cl_armes": return String(p.cl_armes ?? "").split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => WEAPON_TYPES[x]?.label ?? x).join(", ");
      case "cl_mots": return String(p.cl_mots ?? "").split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => config.KEYWORDS.find(k => k.cle === x)?.nom ?? x).join(", ");
      default: return p[field] ?? "";
    }
  } catch (err) {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Paramètres                                                         */
/* ------------------------------------------------------------------ */
function registerSettings() {
  const reg = (key, data) => game.settings.register(MODULE_ID, key, { scope: "world", config: true, ...data });
  reg("terrainCosts", { name: "Coûts de déplacement par profil", hint: "Remplace le coût natif des cases par la table du jeu (À pied, Lourd, Monté, Monté lourd, Volant) selon les Régions de terrain.", type: Boolean, default: true, onChange: refreshPlannedPaths });
  reg("weaponBadge", { name: "Badge d'arme sur les jetons", hint: "Affiche l'icône de l'arme équipée en bas à droite du jeton.", type: Boolean, default: true, onChange: () => canvas?.tokens?.placeables.forEach(t => t.renderFlags?.set?.({ refreshState: true })) });
  reg("animations_on", { name: "Animations JB2A", hint: "Joue les animations avec Sequencer et JB2A pendant les combats.", type: Boolean, default: true });
  reg("animations", { name: "Animations personnalisées (JSON)", hint: 'Exemple : {"epee": ["jb2a.greatsword.melee.standard.white"]}. Clés : epee, lance, hache, arc, anima, lumiere, tenebres, critique, soin, silence.', type: String, default: "" });
  reg("durabilityOnMiss", { name: "Un coup raté use l'arme", hint: "Décoché : seule une attaque qui touche coûte 1 point de durabilité.", type: Boolean, default: true });
  reg("fortHeal", { name: "Soin des forts et trônes", hint: "La macro de fin de phase soigne 10 % des PV max des unités du camp qui commence sa phase sur un fort, un trône ou une porte.", type: Boolean, default: true });
  reg("dieCost", { name: "Prix d'un dé de stat (PM)", type: Number, default: 3 });
  game.settings.register(MODULE_ID, "installedVersion", { scope: "world", config: false, type: String, default: "" });
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */
Hooks.once("init", () => {
  registerSettings();
  registerMovementCosts();
  registerStatusHooks();
  registerBadgeHooks();
  registerClassHooks();
  game.modules.get(MODULE_ID).api = {
    // Macros
    attack: attackMacro, staff: staffMacro, levelUp, buyDie, endPhase, bonusDialog, newChapter, newUnit: newUnitDialog, setupChapter1,
    // Installation
    install: installAll, templates: buildTemplates,
    // Fiche CSB
    sheet, itemLabel, toggleEquip, useObject,
    // Outils
    createUnit, catalogItemData, ensureDefaults, readUnit, terrainUnderToken, terrainAtPoint, syncCounters, computeLevelUp,
    engine, config
  };
});

Hooks.once("setup", () => registerStatusEffects());

Hooks.once("ready", async () => {
  registerStatusEffects(); // CSB peut remplacer CONFIG.statusEffects à l'initialisation
  registerSocket();
  if (game.system.id !== "custom-system-builder") {
    ui.notifications.error("FE Tactique fonctionne avec le système Custom System Builder.");
    return;
  }
  await offerInstall();
});

for (const h of ["createRegion", "updateRegion", "deleteRegion"]) Hooks.on(h, refreshPlannedPaths);
