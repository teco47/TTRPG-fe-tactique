/**
 * FE Tactique – point d'entrée du module.
 * Module pour Foundry VTT v14 + Custom System Builder 6.x.
 */
import { MODULE_ID, WEAPON_TYPES } from "./config.js";
import * as config from "./config.js";
import * as engine from "./engine.js";
import { readUnit, sheetSummary, itemCategory, readWeapon } from "./engine.js";
import { registerMovementCosts, refreshPlannedPaths, terrainUnderToken, terrainAtPoint, regionsMacro, reportTerrainAtCursor, makeTerrainListApp, registerRegionConfigHook } from "./terrain.js";
import { registerRangeHooks, toggleHoverRange, showRange, clearRange } from "./range.js";
import { registerSocket } from "./socket.js";
import { registerStatusEffects, registerStatusHooks, syncCounters } from "./status.js";
import { registerBadgeHooks } from "./badge.js";
import { attackMacro, staffMacro, useObject, toggleEquip } from "./combat.js";
import { levelUp, buyDie, endPhase, newUnitDialog, computeLevelUp, registerDefaultHooks, ensureDefaults } from "./progression.js";
import { installAll, offerInstall, bonusDialog, newChapter, createUnit, catalogItemData } from "./setup.js";
import { buildTemplates } from "./csb-templates.js";
import { classMacro, classTraitsHTML, registerClassHooks, applyClassChange } from "./classes.js";
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
      case "cl_palier": return config.TIERS[p.cl_palier] ?? "";
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
  game.settings.register(MODULE_ID, "rangeOnSelect", { name: "Zone de déplacement et de portée", hint: "Quand tu sélectionnes une unité : cases atteignables en bleu, portée de l'arme équipée en rouge (vert pour un sceptre). Alt+R montre la zone de l'unité survolée.", scope: "client", config: true, type: Boolean, default: true, onChange: () => clearRange() });
  const TerrainApp = makeTerrainListApp();
  if (TerrainApp) game.settings.registerMenu(MODULE_ID, "terrainList", { name: "Terrains reconnus", label: "Voir la liste des terrains", hint: "Noms exacts, mots reconnus, bonus et coûts de déplacement par profil.", icon: "fas fa-mountain", type: TerrainApp, restricted: false });
  reg("freeDice", { name: "Dés libres au niveau 1", hint: "Nombre de dés de stats que le joueur place librement à la création (en plus d'1 dé par stat et des 2 dés de classe).", type: Number, default: config.FREE_DICE });
  reg("traitCost", { name: "Déduire le prix des traits", hint: "Ajouter un trait à une unité retire son prix en PM ; le retirer les rembourse.", type: Boolean, default: true });
  reg("dieCost", { name: "Prix d'un dé de stat (PM)", type: Number, default: 3 });
  game.settings.register(MODULE_ID, "installedVersion", { scope: "world", config: false, type: String, default: "" });
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */
Hooks.once("init", () => {
  registerSettings();
  game.keybindings.register(MODULE_ID, "terrainInfo", {
    name: "Terrain sous le curseur",
    hint: "Affiche le terrain de la case survolée, les Régions qui la couvrent et le coût de déplacement pour le jeton sélectionné.",
    editable: [{ key: "KeyT", modifiers: ["Alt"] }],
    onDown: () => { reportTerrainAtCursor(); return true; }
  });
  game.keybindings.register(MODULE_ID, "rangeInfo", {
    name: "Zone de l'unité survolée",
    hint: "Affiche (ou efface) les cases atteignables et la portée de l'unité survolée, alliée ou ennemie.",
    editable: [{ key: "KeyR", modifiers: ["Alt"] }],
    onDown: () => { toggleHoverRange(); return true; }
  });
  registerRangeHooks();
  registerRegionConfigHook();
  registerMovementCosts();
  registerStatusHooks();
  registerBadgeHooks();
  registerClassHooks();
  registerDefaultHooks();
  game.modules.get(MODULE_ID).api = {
    // Macros
    attack: attackMacro, staff: staffMacro, classe: classMacro, levelUp, buyDie, endPhase, bonusDialog, newChapter, newUnit: newUnitDialog, setupChapter1, regions: regionsMacro, showRange, clearRange,
    // Installation
    install: installAll, templates: buildTemplates,
    // Fiche CSB
    sheet, itemLabel, toggleEquip, useObject, classTraits: classTraitsHTML,
    // Outils
    createUnit, catalogItemData, ensureDefaults, applyClassChange, readUnit, terrainUnderToken, terrainAtPoint, syncCounters, computeLevelUp,
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
