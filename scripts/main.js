/**
 * FE Tactique – point d'entrée du module.
 * Module pour Foundry VTT v14 + Custom System Builder 6.x.
 */
import { MODULE_ID, WEAPON_TYPES } from "./config.js";
import * as config from "./config.js";
import * as engine from "./engine.js";
import { readUnit, sheetSummary, itemCategory, readWeapon } from "./engine.js";
import { regionTerrain, registerMovementCosts, refreshPlannedPaths, terrainUnderToken, terrainAtPoint, regionsMacro, reportTerrainAtCursor, makeTerrainListApp, registerRegionConfigHook } from "./terrain.js";
import { registerRangeHooks, toggleHoverRange, showRange, clearRange } from "./range.js";
import { registerSocket } from "./socket.js";
import { registerStatusEffects, registerStatusHooks, syncCounters } from "./status.js";
import { registerBadgeHooks } from "./badge.js";
import { attackMacro, staffMacro, useObject, toggleEquip } from "./combat.js";
import { levelUp, buyDie, endPhase, newUnitDialog, computeLevelUp, registerDefaultHooks, ensureDefaults } from "./progression.js";
import { installAll, offerInstall, bonusDialog, newChapter, createUnit, catalogItemData, tokenLookMacro } from "./setup.js";
import { buildTemplates } from "./csb-templates.js";
import { classMacro, classTraitsHTML, registerClassHooks, applyClassChange } from "./classes.js";
import { setupChapter1 } from "./chapter1.js";
import { exportSceneMacro, buildSceneExport } from "./export.js";
import { playSound } from "./sounds.js";
import { lootMacro, registerLootHooks } from "./loot.js";
import { enemyMacro, createEnemy, registerEnemyHooks } from "./enemies.js";
import { convoyMacro, toConvoy, fromConvoy, convoyCount, addGold, findConvoy } from "./convoi.js";

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

/**
 * CSB entoure le résultat d'un script de guillemets simples puis le réévalue :
 * une apostrophe dans le texte casse la formule (affiche ERROR). On la remplace par l'apostrophe typographique.
 */
const csbSafe = (v) => typeof v === "string" ? v.replace(/'/g, "’").replace(/\\/g, "/") : v;

function sheet(actor, stat) {
  return csbSafe(sheetRaw(actor, stat));
}

function sheetRaw(actor, stat) {
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
  return csbSafe(itemLabelRaw(item, field));
}

function itemLabelRaw(item, field) {
  try {
    if (!item) return "";
    const p = item.system?.props ?? {};
    const cat = itemCategory(item);
    const on = (v) => v === true || v === "true";
    switch (field) {
      case "equip": return cat === "objet" ? "▶ Utiliser" : (cat === "trait" ? (on(p.equipe) ? "★" : "☆") : (on(p.equipee) ? "★" : "☆"));
      case "type": return cat === "objet" ? "Objet" : (cat === "sceptre" ? "Sceptre" : (WEAPON_TYPES[p.type_arme]?.label ?? ""));
      case "rang": return p.rang_req ?? "";
      case "pui": return ["sceptre", "objet"].includes(cat) ? "—" : (p.pui ?? 0);
      case "prec": return ["sceptre", "objet"].includes(cat) ? "—" : (p.prec ?? 0);
      case "crit": return ["sceptre", "objet"].includes(cat) ? "—" : (on(p.sans_crit) ? Number(p.crit ?? 0) - config.BRONZE_CRIT_MALUS : (p.crit ?? 0));
      case "poids": return ["sceptre", "objet"].includes(cat) ? "—" : (p.poids ?? 0);
      case "portee": { const w = readWeapon(item); return w ? (w.porMin === w.porMax ? `${w.porMin}` : `${w.porMin}-${w.porMax}`) : ""; }
      case "dur": return cat === "objet" ? `${p.uses ?? 0}/${p.uses_max ?? p.uses ?? 0}` : `${p.dur ?? 0}/${p.dur_max ?? p.dur ?? 0}`;
      case "uses": return `${p.uses ?? 0}/${p.uses_max ?? p.uses ?? 0}`;
      case "prix": return `${p.prix_pm ?? 0} PM`;
      case "prix_or": return p.prix !== undefined ? `${p.prix} or` : "—";
      case "categorie": return { arme: "Arme", tome: "Tome", sceptre: "Sceptre", objet: "Objet", trait: "Trait", classe: "Classe", motcle: "Mot-clé" }[cat] ?? "";
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
  reg("animations", { name: "Animations personnalisées (JSON)", hint: 'Exemple : {"epee": ["jb2a.greatsword.melee.standard.white"]}. Clés : epee, lance, hache, arc, anima, lumiere, tenebres, critique, critique_charge, rate, soin, silence.', type: String, default: "" });
  reg("impactOffset", { name: "Décalage de l'impact (ms)", hint: "Avance (négatif) ou retarde (positif) le son, les chiffres et le tremblement par rapport à l'animation d'arme. Exemple : -200 si l'impact arrive trop tard.", type: Number, default: 0, range: { min: -1500, max: 1500, step: 50 } });
  reg("impactTiming", { name: "Moment de l'impact par arme (JSON)", hint: 'Délai en ms depuis le début de l\'animation d\'arme. Par défaut : {"epee":500,"lance":500,"hache":600,"arc":700,"anima":750,"lumiere":750,"tenebres":750}. N\'indique que les armes à changer, ex. {"arc":900}.', type: String, default: "" });
  reg("critCutIn", { name: "Cut-in sur les critiques (Cinematic Cut-ins)", hint: "Si le module Cinematic Cut-ins est actif : un cut-in avec le portrait de l'attaquant, « CRITIQUE ! », l'arme et les dégâts, visible par tous.", type: Boolean, default: true });
  reg("critCutInTheme", { name: "Thème du cut-in de critique", hint: "Identifiant du thème personnel de Cinematic Cut-ins, en minuscules : impact, blitz, brush, cinematic, scope, broadcast…", type: String, default: "impact" });
  reg("critCutInDuration", { name: "Durée du cut-in de critique (s)", type: Number, default: 2.5, range: { min: 1, max: 8, step: 0.5 } });
  reg("critMacro", { name: "Macro de critique", hint: "Nom (ou UUID) d'une macro lancée à chaque critique, au moment de l'impact, par le joueur qui attaque. Elle reçoit attacker et target (jetons), actor, token, weapon et strike. Sert à brancher un module de cut-in (Cinematic Cut-ins…). Vide : rien.", type: String, default: "" });
  reg("sounds_on", { name: "Sons de combat", hint: "Touché, critique, raté, arme brisée, unité vaincue, montée de niveau. Entendus par tous les joueurs (volume « Interface » de Foundry).", type: Boolean, default: true });
  reg("soundVolume", { name: "Volume des sons FE", hint: "De 0 à 1, multiplié par le volume Interface de chaque joueur.", type: Number, default: 0.7, range: { min: 0, max: 1, step: 0.05 } });
  reg("sounds", { name: "Sons personnalisés (JSON)", hint: 'Exemple : {"critique": ["sounds/mon-crit.ogg"]}. Clés : touche, critique, rate, arme_brisee, mort, niveau, coffre.', type: String, default: "" });
  game.settings.register(MODULE_ID, "damageNumbers", { name: "Nombres de dégâts sur les jetons", hint: "Affiche au-dessus des jetons les dégâts, les critiques, les coups ratés et les soins (effet texte Sequencer, ou texte natif de Foundry sans Sequencer ; visible par tous). Réglage propre à chaque joueur.", scope: "client", config: true, type: Boolean, default: true });
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
  registerLootHooks();
  registerEnemyHooks();
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
    attack: attackMacro, staff: staffMacro, classe: classMacro, levelUp, buyDie, endPhase, bonusDialog, newChapter, newUnit: newUnitDialog, setupChapter1, regions: regionsMacro, tokenLook: tokenLookMacro, exportScene: exportSceneMacro, playSound, loot: lootMacro, enemy: enemyMacro, createEnemy, convoi: convoyMacro, toConvoy, fromConvoy, convoyCount, addGold, findConvoy, buildSceneExport: (api) => buildSceneExport(api ?? game.modules.get(MODULE_ID).api), showRange, clearRange,
    // Installation
    install: installAll, templates: buildTemplates,
    // Fiche CSB
    sheet, itemLabel, toggleEquip, useObject, classTraits: (item) => csbSafe(classTraitsHTML(item)),
    // Outils
    createUnit, catalogItemData, ensureDefaults, regionTerrain, applyClassChange, readUnit, terrainUnderToken, terrainAtPoint, syncCounters, computeLevelUp,
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
