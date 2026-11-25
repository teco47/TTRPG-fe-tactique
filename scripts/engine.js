/**
 * FE Tactique – moteur de règles.
 * Les fonctions « pures » (sans Foundry) sont en bas de fichier et testables hors Foundry.
 * La fiche CSB affiche les valeurs calculées ici, pour qu'il n'y ait qu'une seule source de vérité.
 */
import {
  RANKS, RANK_BONUS, WEAPON_TYPES, TRIANGLE_BEATS, TRIANGLE_BY_RANK, DOUBLE_THRESHOLD, STAT_CAP,
  TERRAINS, WOUND_MALUS, WOUND_LIMIT, CLASSES, TEMPLATE_IDS, TOKEN_MAX, STATUS, MODULE_ID, KEYWORDS, traitSlots, maxDicePerStat, FREE_POINTS, FREE_DICE
} from "./config.js";

/* ================================================================== */
/*  Lecture des documents Foundry / CSB                                */
/* ================================================================== */

const num = (v, d = 0) => {
  if (v === null || v === undefined || v === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v) => v === true || v === "true" || v === 1 || v === "1";
const str = (v, d = "") => (v === null || v === undefined) ? d : String(v);

/** Catégorie d'un objet CSB : arme, tome, sceptre, objet, trait (ou null). */
export function itemCategory(item) {
  const tpl = item?.system?.template;
  for (const [cat, id] of Object.entries(TEMPLATE_IDS)) if (tpl === id && cat !== "unite") return cat;
  const p = item?.system?.props ?? {};
  if (p.cl_mvt !== undefined) return "classe";
  if (p.mc_cle !== undefined) return "motcle";
  if (p.type_trait !== undefined) return "trait";
  if (p.effet_sceptre !== undefined) return "sceptre";
  if (p.effet_objet !== undefined) return "objet";
  if (p.type_arme !== undefined) return WEAPON_TYPES[p.type_arme]?.magic ? "tome" : "arme";
  return null;
}

/** Lit un objet de combat (arme, tome ou sceptre). */
export function readWeapon(item) {
  const cat = itemCategory(item);
  if (!["arme", "tome", "sceptre"].includes(cat)) return null;
  const p = item.system.props ?? {};
  const type = cat === "sceptre" ? "sceptre" : str(p.type_arme, cat === "tome" ? "anima" : "epee");
  return {
    id: item.id, uuid: item.uuid, name: item.name, cat, type,
    rang: str(p.rang_req, "E"),
    pui: num(p.pui), prec: num(p.prec), crit: bool(p.sans_crit) ? null : num(p.crit),
    poids: num(p.poids),
    porMin: num(p.por_min, 1), porMax: num(p.por_max, cat === "tome" ? 2 : 1),
    dur: num(p.dur, 1), durMax: num(p.dur_max, num(p.dur, 1)),
    efficace: str(p.efficace).toLowerCase(),
    special: str(p.special, "aucun"),
    sansRiposte: bool(p.sans_riposte),
    bonusEsq: num(p.bonus_esq), bonusRes: num(p.bonus_res),
    effetCle: str(p.effet_sceptre, "soin"), soin: num(p.soin_base),
    equipped: bool(p.equipee)
  };
}

export function readTrait(item) {
  const p = item.system.props ?? {};
  return {
    id: item.id, name: item.name, equipped: bool(p.equipe),
    type: str(p.type_trait, "manuel"), stat: str(p.boost_stat, "aucun"), valeur: num(p.boost_val)
  };
}

const list = (v) => str(v).toLowerCase().split(/[,;]+/).map(x => x.trim()).filter(Boolean);

/** Normalise un mot-clé : minuscules, sans accents. */
export function keywordKey(v) {
  return str(v).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Valeur de base d'une stat avant modificateurs de classe. */
export const STAT_BASELINE = { pv: 10, for: 5, mag: 5, def: 5, res: 5, tech: 5, vit: 5 };
const CLASS_STATS = Object.keys(STAT_BASELINE);

/**
 * Lit un objet Classe.
 * mods : modificateurs de stats (classe de base) ou bonus de promotion (classe avancée / élite).
 * Les objets créés en 0.2.0 stockaient des stats absolues (cl_pv…) : on les convertit.
 */
export function readClass(item) {
  const p = item.system?.props ?? {};
  const mods = {};
  for (const k of CLASS_STATS) {
    if (p[`cl_mod_${k}`] !== undefined && p[`cl_mod_${k}`] !== null && p[`cl_mod_${k}`] !== "") mods[k] = num(p[`cl_mod_${k}`]);
    else if (p[`cl_${k}`] !== undefined) mods[k] = num(p[`cl_${k}`]) - STAT_BASELINE[k];
    else mods[k] = 0;
  }
  return {
    id: item.id, uuid: item.uuid, nom: item.name, mods,
    des: [str(p.cl_de1, "aucun"), str(p.cl_de2, "aucun")].filter(d => d !== "aucun" && d !== ""),
    armes: list(p.cl_armes), mvt: num(p.cl_mvt, 5), profil: str(p.cl_profil, "pied"),
    palier: Math.min(3, Math.max(1, num(p.cl_palier, 1))), depart: str(p.cl_depart), traitDefaut: str(p.cl_trait),
    motsCles: list(p.cl_mots).map(keywordKey),
    rang: RANKS.includes(str(p.cl_rang)) ? str(p.cl_rang) : (num(p.cl_palier, 1) <= 1 ? "D" : "E"),
    promotions: str(p.cl_promos).split(/[,;]+/).map(x => x.trim()).filter(Boolean)
  };
}

/** Classe tirée de config.js (CLASSES), au même format que readClass. */
export function classFromConfig(nom) {
  const c = CLASSES[nom];
  if (!c) return null;
  const mods = {};
  for (const k of CLASS_STATS) mods[k] = c[k] - STAT_BASELINE[k];
  return {
    id: null, nom, mods, des: [...c.des], armes: [...c.armes], mvt: c.mvt, profil: c.profil, palier: 1,
    rang: "D", depart: c.depart ?? "", traitDefaut: c.traitDefaut ?? "", motsCles: [...(c.motsCles ?? [])], promotions: []
  };
}

/** Effets temporaires (Bonus/Malus/Silence) portés par l'acteur. */
function readTemporaryEffects(actor) {
  const bonus = { prec: 0, esq: 0, crit: 0, atq: 0, def: 0, res: 0, for: 0, mag: 0, tech: 0, vit: 0 };
  let silenced = false;
  for (const effect of actor?.effects ?? []) {
    if (effect.disabled) continue;
    const statuses = effect.statuses ?? new Set();
    if (statuses.has?.(STATUS.silence.id)) silenced = true;
    const b = effect.getFlag?.(MODULE_ID, "bonus") ?? effect.flags?.[MODULE_ID]?.bonus;
    if (b) for (const k of Object.keys(bonus)) bonus[k] += num(b[k]);
  }
  return { bonus, silenced };
}

/** Construit l'objet « unité » utilisé par tout le moteur. */
export function readUnit(actor, { token = null } = {}) {
  const p = actor?.system?.props ?? {};
  const traits = [];
  const weapons = [];
  const objects = [];
  const keywordItems = [];
  const classes = {};
  for (const item of actor?.items ?? []) {
    const cat = itemCategory(item);
    if (cat === "classe") { const c = readClass(item); classes[c.palier] ??= c; continue; }
    if (cat === "motcle") { keywordItems.push(keywordKey(item.system.props?.mc_cle || item.name)); continue; }
    if (cat === "trait") traits.push(readTrait(item));
    else if (cat === "objet") objects.push(item);
    else if (cat) { const w = readWeapon(item); if (w) weapons.push(w); }
  }
  const temp = readTemporaryEffects(actor);
  const tiers = Object.keys(classes).map(Number).sort((a, b) => b - a);
  const classItem = tiers.length ? classes[tiers[0]] : null;
  const className = classItem?.nom ?? str(p.classe).trim();
  const classData = classItem ?? classFromConfig(className);
  const profil = str(p.profil, classData?.profil ?? "pied");
  const keywords = [...new Set([
    ...(classData?.motsCles ?? []).map(keywordKey), ...keywordItems, ...list(p.tags).map(keywordKey)
  ])];
  const ranks = {};
  for (const t of Object.keys(WEAPON_TYPES)) ranks[t] = str(p[`rang_${t}`], "E");
  // Stats permanentes = Base (perso + points libres + Boosters) + Classe (modificateurs des classes) + Niveau (gains)
  const slotList = Object.values(classes).length ? Object.values(classes) : (classData ? [classData] : []);
  const parts = { perso: {}, classe: {}, niveau: {} };
  const base = {};
  for (const k of Object.keys(STAT_BASELINE)) {
    parts.perso[k] = num(p[`base_${k}`], STAT_BASELINE[k]);
    parts.classe[k] = slotList.reduce((a, c) => a + num(c.mods?.[k]), 0);
    parts.niveau[k] = num(p[`niv_${k}`]);
    base[k] = parts.perso[k] + parts.classe[k] + parts.niveau[k];
  }
  base.mvt = num(p.base_mvt, 5);
  // Rang offert par les classes dans leurs types d'arme (classe de base : D)
  for (const c of slotList) for (const t of c.armes ?? []) {
    if (ranks[t] !== undefined && RANKS.indexOf(c.rang ?? "E") > RANKS.indexOf(ranks[t])) ranks[t] = c.rang;
  }
  return {
    actor, token,
    name: token?.name ?? actor?.name ?? "?",
    className, classData, classes,
    level: num(p.niveau, 1),
    palier: num(p.palier, classData?.palier ?? 1),
    role: str(p.role, "secondaire"),
    profil, keywords,
    tags: keywords.join(","),
    base, parts, classList: slotList,
    hp: num(p.pv, base.pv),
    pm: num(p.pm),
    dice: Object.fromEntries(Object.keys(STAT_BASELINE).map(k => [k, num(p[`des_${k}`], 1)])),
    boosts: Object.fromEntries(Object.keys(STAT_BASELINE).map(k => [k, num(actor?.flags?.[MODULE_ID]?.boosts?.[k])])),
    diceBought: num(actor?.flags?.[MODULE_ID]?.diceBought),
    wounds: num(p.blessures),
    jetons: { bouclier: num(p.jet_bouclier), aile: num(p.jet_aile), esprit: num(p.jet_esprit) },
    manual: {
      prec: num(p.bon_prec), esq: num(p.bon_esq), crit: num(p.bon_crit), atq: num(p.bon_atq), def: num(p.bon_def)
    },
    temp: temp.bonus,
    silenced: temp.silenced,
    ranks, traits, weapons, objects
  };
}

/* ================================================================== */
/*  Calculs purs                                                       */
/* ================================================================== */

export function hasTrait(unit, name) {
  return unit.traits.some(t => t.equipped && t.name.trim().toLowerCase() === name.toLowerCase());
}

export function traitBoosts(unit) {
  const boosts = {};
  for (const t of unit.traits) {
    if (!t.equipped) continue;
    if (t.type !== "boost" || !t.stat || t.stat === "aucun") continue;
    boosts[t.stat] = (boosts[t.stat] ?? 0) + t.valeur;
  }
  return boosts;
}

export function woundMalus(unit) {
  return unit.wounds * (WOUND_MALUS[unit.palier] ?? WOUND_MALUS[1]);
}

/** Stats effectives (blessures, traits Boost, bonus temporaires), plafonnées à 50. */
export function effectiveStats(unit) {
  const boosts = traitBoosts(unit);
  const malus = woundMalus(unit);
  const out = {};
  for (const s of ["for", "mag", "def", "res", "tech", "vit"]) {
    const raw = unit.base[s] + (boosts[s] ?? 0) + (unit.temp[s] ?? 0) - malus;
    out[s] = Math.max(0, Math.min(STAT_CAP, raw));
  }
  out.pvMax = Math.max(1, unit.base.pv + (boosts.pv ?? 0));
  out.mvt = unit.base.mvt;
  return out;
}

export function rankIndex(r) {
  const i = RANKS.indexOf(String(r).toUpperCase());
  return i < 0 ? 0 : i;
}

/** L'unité peut-elle manier cette arme ? Renvoie null si oui, sinon la raison. */
export function weaponRestriction(unit, w) {
  if (!w) return "aucune arme";
  if (w.dur <= 0) return "arme cassée";
  if (unit.classData && !unit.classData.armes.includes(w.type)) return `la classe ${unit.className} ne manie pas ce type d'arme`;
  if (w.rang !== "Perso" && RANKS.includes(w.rang) && rankIndex(unit.ranks[w.type]) < rankIndex(w.rang)) {
    return `rang ${w.rang} requis (${unit.ranks[w.type]} actuel)`;
  }
  if (w.cat === "tome" && unit.silenced) return "sous Silence";
  return null;
}

export function equippedWeapon(unit) {
  return unit.weapons.find(w => w.equipped) ?? null;
}

export function weaponRange(unit, w, activations = {}) {
  if (!w) return [0, 0];
  let max = w.porMax;
  if (w.type === "arc" && hasTrait(unit, "Grande corde")) max += 1;
  if (activations.Surcharge && w.cat === "tome") max += 1;
  return [w.porMin, max];
}

/**
 * Stats de combat d'une unité avec une arme, hors adversaire.
 * ctx : { terrain, activations, situational: {prec, esq, crit, atq} }
 */
export function combatStats(unit, w, ctx = {}) {
  const st = effectiveStats(unit);
  const terrain = TERRAINS[ctx.terrain] ?? TERRAINS.plaine;
  const boosts = traitBoosts(unit);
  const act = ctx.activations ?? {};
  const sit = ctx.situational ?? {};
  const isMagic = !!(w && WEAPON_TYPES[w.type]?.magic);
  const rank = w ? rankIndex(unit.ranks[w.type]) : 0;
  const fracas = act.Fracas && w?.type === "hache";
  const surcharge = act.Surcharge && w?.cat === "tome";

  const forStat = st.for + (fracas ? 5 : 0);
  const magStat = st.mag + (surcharge ? 5 : 0);
  const poids = w ? w.poids : 0;
  const vitAtt = st.vit - poids;
  const lowHp = unit.hp <= st.pvMax / 2;
  const rage = hasTrait(unit, "Rage") && lowHp;

  const res = {
    stats: st, terrain, isMagic,
    pvMax: st.pvMax,
    vitAtt,
    atq: w && w.cat !== "sceptre"
      ? (isMagic ? magStat : forStat) + w.pui + rank * RANK_BONUS.pui + unit.manual.atq + (unit.temp.atq ?? 0) + (rage ? 3 : 0) + (sit.atq ?? 0)
      : 0,
    prec: w && w.cat !== "sceptre"
      ? w.prec + 2 * st.tech + rank * RANK_BONUS.prec + unit.manual.prec + (unit.temp.prec ?? 0) + (boosts.prec ?? 0)
        - (fracas ? 10 : 0) + (sit.prec ?? 0)
      : 0,
    esq: 2 * vitAtt + terrain.esq + unit.manual.esq + (unit.temp.esq ?? 0) + (boosts.esq ?? 0)
      + (w?.bonusEsq ?? 0) + (sit.esq ?? 0),
    crit: w && w.cat !== "sceptre" && w.crit !== null
      ? w.crit + Math.floor(st.tech / 2) + rank * RANK_BONUS.crit + unit.manual.crit + (unit.temp.crit ?? 0)
        + (boosts.crit ?? 0) + (rage ? 15 : 0) + (act["Piqué"] ? 10 : 0) + (sit.crit ?? 0)
      : 0,
    canCrit: !!(w && w.cat !== "sceptre" && w.crit !== null),
    esqCrit: Math.floor(st.vit / 4),
    def: st.def + terrain.def + unit.manual.def + (unit.temp.def ?? 0),
    res: st.res + terrain.def + unit.manual.def + (unit.temp.res ?? 0) + (w?.bonusRes ?? 0)
  };
  return res;
}

/** +1 si l'arme a l'avantage, −1 si elle est désavantagée, 0 sinon. */
export function triangle(wA, wB) {
  const a = wA ? WEAPON_TYPES[wA.type]?.color : null;
  const b = wB ? WEAPON_TYPES[wB.type]?.color : null;
  if (!a || !b) return 0;
  if (TRIANGLE_BEATS[a] === b) return 1;
  if (TRIANGLE_BEATS[b] === a) return -1;
  return 0;
}

/** Rang pour le triangle : rang de l'unité dans le type de l'arme qu'elle utilise (25/11/2026). */
export function triangleRank(unit, w) {
  if (!w) return "E";
  const r = unit?.ranks?.[w.type] ?? "E";
  return RANKS.includes(r) ? r : "E";
}

/** Modificateur du triangle pour l'attaquant att (arme w) contre def (arme wDef), tr = triangle(w, wDef). */
export function triangleMod(att, w, def, wDef, tr) {
  if (tr > 0) { const b = TRIANGLE_BY_RANK[triangleRank(att, w)]; return { atq: b.atq, prec: b.prec }; }
  if (tr < 0) { const b = TRIANGLE_BY_RANK[triangleRank(def, wDef)]; return { atq: -b.atq || 0, prec: -b.prec || 0 }; }
  return { atq: 0, prec: 0 };
}

export function isEffective(attacker, w, defender) {
  if (!w) return false;
  const targetTags = [defender.profil, ...(defender.keywords ?? defender.tags.split(/[,; ]+/))].map(keywordKey).filter(Boolean);
  const eff = w.efficace.split(/[,; ]+/).map(keywordKey).filter(Boolean);
  if (eff.some(e => targetTags.includes(e))) return true;
  if (w.type === "arc" && defender.profil === "volant" && hasTrait(attacker, "Tir au pigeon")) return true;
  return false;
}

/**
 * Prévision complète d'un combat.
 * ctx : { distance, terrainA, terrainD, activationsA, activationsD, situationalA, situationalD }
 */
export function buildForecast(A, D, wA, wD, ctx = {}) {
  const distance = ctx.distance ?? 1;
  const actA = ctx.activationsA ?? {};
  const actD = ctx.activationsD ?? {};
  const sA = combatStats(A, wA, { terrain: ctx.terrainA, activations: actA, situational: ctx.situationalA });
  const sD = combatStats(D, wD, { terrain: ctx.terrainD, activations: actD, situational: ctx.situationalD });

  const [aMin, aMax] = weaponRange(A, wA, actA);
  const [dMin, dMax] = weaponRange(D, wD, actD);
  const restrictionA = weaponRestriction(A, wA);
  const restrictionD = wD ? weaponRestriction(D, wD) : "aucune arme équipée";

  const attackerCan = !restrictionA && wA.cat !== "sceptre" && distance >= aMin && distance <= aMax;
  let counterReason = null;
  if (restrictionD) counterReason = restrictionD;
  else if (wD.cat === "sceptre") counterReason = "porte un sceptre";
  else if (wA?.sansRiposte) counterReason = `${wA.name} empêche la riposte`;
  else if (distance < dMin || distance > dMax) counterReason = "hors de portée";
  const defenderCan = attackerCan && !counterReason;

  const tri = triangle(wA, wD);
  const side = (att, def, s, sDef, w, tr, act, wOpp) => {
    const triMod = triangleMod(att, w, def, wOpp, tr);
    const atq = s.atq + triMod.atq;
    const prec = s.prec + triMod.prec;
    const hit = Math.max(0, prec - sDef.esq);
    const defense = s.isMagic ? (w?.special === "luna" ? 0 : sDef.res) : sDef.def;
    const effective = isEffective(att, w, def);
    const base = Math.max(1, (atq - defense) * (effective ? 3 : 1));
    const crit = act.Spectre ? 100 : (s.canCrit ? Math.max(0, s.crit - sDef.esqCrit) : 0);
    return {
      atq, prec, hit, defense, effective, crit,
      dmg: w?.special === "eclipse" ? Math.max(1, Math.floor(def.hp / 2)) : base,
      eclipse: w?.special === "eclipse",
      triangle: tr, triMod
    };
  };
  const fa = side(A, D, sA, sD, wA, tri, actA, wD);
  const fd = side(D, A, sD, sA, wD, -tri, actD, wA);
  const doubleA = attackerCan && sA.vitAtt - sD.vitAtt >= DOUBLE_THRESHOLD;
  const doubleD = defenderCan && sD.vitAtt - sA.vitAtt >= DOUBLE_THRESHOLD;
  const desperation = hasTrait(A, "Désespoir") && A.hp <= sA.pvMax / 2;

  return {
    distance,
    A: { unit: A, weapon: wA, stats: sA, ...fa, can: attackerCan, restriction: restrictionA, double: doubleA, hp: A.hp, pvMax: sA.pvMax, activations: actA, range: [aMin, aMax] },
    D: { unit: D, weapon: wD, stats: sD, ...fd, can: defenderCan, restriction: counterReason, double: doubleD, hp: D.hp, pvMax: sD.pvMax, activations: actD, range: [dMin, dMax] },
    desperation
  };
}

/** Ordre des attaques. */
export function strikeOrder(f) {
  const order = [];
  if (!f.A.can) return order;
  if (f.desperation) {
    order.push("A"); if (f.A.double) order.push("A");
    if (f.D.can) { order.push("D"); if (f.D.double) order.push("D"); }
    return order;
  }
  order.push("A");
  if (f.D.can) order.push("D");
  if (f.A.double) order.push("A");
  if (f.D.can && f.D.double) order.push("D");
  return order;
}

/** 2RN : moyenne de deux d100, arrondie à l'inférieur. Au-delà de 100 %, touche toujours. */
export function rollHit(rate, rng) {
  if (rate >= 100) return { hit: true, rolls: [], value: null };
  if (rate <= 0) return { hit: false, rolls: [], value: null };
  const r1 = rng(), r2 = rng();
  const value = Math.floor((r1 + r2) / 2);
  return { hit: value <= rate, rolls: [r1, r2], value };
}

/**
 * Résout le combat. rng() renvoie un entier de 1 à 100.
 * options : { durabilityOnMiss: true }
 * Renvoie le journal et l'état final (PV, durabilités, jetons, blessure, mort).
 */
export function resolveCombat(f, rng, options = {}) {
  const durOnMiss = options.durabilityOnMiss ?? true;
  const st = {
    A: { hp: f.A.hp, dur: f.A.weapon?.dur ?? 0, jetons: { ...f.A.unit.jetons }, broken: false, dmgDealt: 0 },
    D: { hp: f.D.hp, dur: f.D.weapon?.dur ?? 0, jetons: { ...f.D.unit.jetons }, broken: false, dmgDealt: 0 }
  };
  // Coût des activations
  for (const k of ["A", "D"]) {
    for (const [name, on] of Object.entries(f[k].activations ?? {})) {
      if (!on) continue;
      const cost = { "Piqué": ["aile", 2], "Spectre": ["esprit", 10], "Siphon": ["esprit", 5] }[name];
      if (cost) st[k].jetons[cost[0]] = Math.max(0, st[k].jetons[cost[0]] - cost[1]);
    }
  }
  const log = [];
  let spectreUsed = { A: false, D: false };
  let siphonUsed = { A: false, D: false };
  for (const who of strikeOrder(f)) {
    const other = who === "A" ? "D" : "A";
    const side = f[who];
    if (st.A.hp <= 0 || st.D.hp <= 0) break;
    if (st[who].broken) continue;
    const w = side.weapon;
    const critRate = side.activations?.Spectre && !spectreUsed[who] ? 100 : side.crit;
    const h = rollHit(side.hit, rng);
    const entry = { who, attacker: side.unit.name, defender: f[other].unit.name, rate: side.hit, ...h, crit: false, critRoll: null, dmg: 0 };
    if (h.hit) {
      if (critRate > 0) {
        entry.critRoll = critRate >= 100 ? null : rng();
        entry.crit = critRate >= 100 || entry.critRoll <= critRate;
      }
      if (side.activations?.Spectre) spectreUsed[who] = true;
      let dmg;
      if (side.eclipse) dmg = Math.max(1, Math.floor(st[other].hp / 2));
      else {
        const mult = Math.max((entry.crit ? 3 : 0) + (side.effective ? 3 : 0), 1);
        dmg = Math.max(1, (side.atq - side.defense) * mult);
      }
      // Miracle
      const target = f[other];
      if (dmg >= st[other].hp && hasTrait(target.unit, "Miracle") && st[other].hp >= target.pvMax / 2) {
        dmg = st[other].hp - 1;
        entry.miracle = true;
      }
      dmg = Math.min(dmg, st[other].hp);
      st[other].hp -= dmg;
      st[who].dmgDealt += dmg;
      entry.dmg = dmg;
      if (w?.special === "nosferatu" && dmg > 0) {
        const heal = Math.min(dmg, side.pvMax - st[who].hp);
        st[who].hp += heal; entry.drain = heal;
      }
      if (side.activations?.Siphon && !siphonUsed[who] && dmg > 0) {
        const heal = Math.min(Math.floor(dmg / 2), side.pvMax - st[who].hp);
        st[who].hp += heal; entry.siphon = heal; siphonUsed[who] = true;
      }
      // Jetons
      if (hasTrait(target.unit, "Bouclier")) st[other].jetons.bouclier = Math.min(TOKEN_MAX, st[other].jetons.bouclier + 1);
      if (side.stats.isMagic && dmg > 0 && hasTrait(side.unit, "Esprit")) st[who].jetons.esprit = Math.min(TOKEN_MAX, st[who].jetons.esprit + 1);
    } else if (hasTrait(f[other].unit, "Ailé")) {
      st[other].jetons.aile = Math.min(TOKEN_MAX, st[other].jetons.aile + 1);
    }
    // Durabilité
    if (w && (h.hit || durOnMiss)) {
      const heavy = (side.activations?.Fracas && w.type === "hache") || (side.activations?.Surcharge && w.cat === "tome");
      st[who].dur = Math.max(0, st[who].dur - (heavy ? 5 : 1));
      if (st[who].dur <= 0) { st[who].broken = true; entry.broke = w.name; }
    }
    entry.hpAfter = { A: st.A.hp, D: st.D.hp };
    log.push(entry);
  }
  const outcome = (k) => {
    const unit = f[k].unit;
    if (st[k].hp > 0) return null;
    const limit = WOUND_LIMIT[unit.role] ?? WOUND_LIMIT.secondaire;
    const wounds = unit.wounds + 1;
    return { wounds, dead: wounds > limit };
  };
  return { log, state: st, fallen: { A: outcome("A"), D: outcome("D") } };
}

/** Résumé utilisé par la fiche (valeurs avec l'arme équipée, sans adversaire ni terrain). */
export function sheetSummary(unit) {
  const w = equippedWeapon(unit);
  const s = combatStats(unit, w, { terrain: "plaine" });
  return {
    ...s.stats,
    pv_max: s.pvMax,
    vit_att: s.vitAtt,
    atq: s.atq, prec: s.prec, esq: s.esq, crit: s.canCrit ? s.crit : 0,
    esq_crit: s.esqCrit,
    malus: woundMalus(unit),
    slots: traitSlots(unit.level),
    slots_used: unit.traits.filter(t => t.equipped).length,
    weapon: w ? w.name : "—",
    classe: unit.className || "—",
    ...Object.fromEntries(Object.keys(STAT_BASELINE).flatMap(k => [
      [`cls_${k}`, signedNum(unit.parts.classe[k])], [`tot_${k}`, unit.base[k]]
    ])),
    classe_1: unit.classes?.[1]?.nom ?? "—",
    classe_2: unit.classes?.[2]?.nom ?? "—",
    classe_3: unit.classes?.[3]?.nom ?? "—",
    mots_cles: unit.keywords.length ? unit.keywords.map(k => KEYWORDS.find(x => x.cle === k)?.nom ?? (k[0].toUpperCase() + k.slice(1))).join(" · ") : "—",
    ...(() => {
      const a = allocation(unit);
      const parts = [];
      if (a.points > 0) parts.push(`${a.pointsText} pt${a.points > 1 ? "s" : ""} de stats`);
      if (a.des > 0) parts.push(`${a.des} dé${a.des > 1 ? "s" : ""}`);
      if (a.pm > 0) parts.push(`${a.pm} PM`);
      const alert = a.alerts.length ? `<span class="fe-alert">⚠ ${a.alerts.join(" · ")}</span>` : "";
      return {
        pts_libres: a.pointsText, des_libres: a.des, pm_restants: a.pm,
        alerte: a.alerts.length ? alert : "<span class=\"fe-ok\">✓ rien à signaler</span>",
        a_attribuer: (parts.length ? `À attribuer : <b>${parts.join(" · ")}</b>` : "") + (alert ? ` ${alert}` : "")
      };
    })(),
    blessures_max: WOUND_LIMIT[unit.role] ?? WOUND_LIMIT.secondaire,
    portee: w ? weaponRange(unit, w).join("-") : "—"
  };
}

function freeDiceSetting() {
  try { const v = globalThis.game?.settings?.get?.(MODULE_ID, "freeDice"); if (Number.isFinite(Number(v)) && v !== undefined && v !== null) return Number(v); } catch (e) { /* réglage absent */ }
  return FREE_DICE;
}

const signedNum = (v) => (v > 0 ? `+${v}` : (v < 0 ? `−${-v}` : "0"));

/**
 * Ce qu'il reste à attribuer : points de stats libres, dés libres, PM.
 * Points dépensés = stats de base − (10 PV / 5 + modificateurs des classes + gains de niveau et boosters) ; 2 PV = 1 point.
 * Dés dépensés = dés − (1 par stat + dés des classes + dés achetés).
 */
export function allocation(unit) {
  const classes = unit.classList ?? [];
  const stats = Object.keys(STAT_BASELINE);
  let spent = 0;
  const perStat = {};
  for (const k of stats) {
    const extra = num(unit.parts?.perso?.[k], unit.base[k]) - STAT_BASELINE[k] - num(unit.boosts?.[k]);
    perStat[k] = extra;
    spent += k === "pv" ? extra / 2 : extra;
  }
  const classDice = classes.reduce((a, c) => a + (c.des?.length ?? 0), 0);
  const totalDice = stats.reduce((a, k) => a + num(unit.dice?.[k], 1), 0);
  const freeDiceUsed = totalDice - stats.length - classDice - num(unit.diceBought);
  const limit = maxDicePerStat(unit.level);
  const out = {
    points: FREE_POINTS - spent, des: freeDiceSetting() - freeDiceUsed, pm: unit.pm, perStat,
    overDice: stats.filter(k => num(unit.dice?.[k], 1) > limit).map(k => k), limit, alerts: []
  };
  const fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  if (out.points < 0) out.alerts.push(`${fmt(-out.points)} point(s) de stats en trop`);
  if (out.des < 0) out.alerts.push(`${-out.des} dé(s) en trop`);
  if (out.pm < 0) out.alerts.push(`PM négatifs (${out.pm})`);
  if (out.overDice.length) out.alerts.push(`plus de ${limit}d6 en ${out.overDice.map(k => k.toUpperCase()).join(", ")}`);
  out.pointsText = fmt(out.points);
  return out;
}

/** Distance en cases (Manhattan, comme dans les tactical RPG). */
export function gridDistance(a, b) {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j);
}
