/**
 * FE Tactique – générateur d'ennemis génériques (macro MJ « FE – Générer un ennemi »).
 *
 * Même système que les joueurs : stats de classe, 3 points libres, réserves de d6 (un 6 = +1, +2 en PV).
 * Croissance « moyenne » : chaque montée de niveau donne l'espérance des dés (dés / 6), arrondie à la fin ;
 * croissance « aux dés » : chaque montée est lancée comme celle d'un joueur.
 * Les réserves suivent la limite de dés du niveau (3, 6, 9, 12) : l'ennemi « achète » un dé de plus dans
 * ses stats de classe à chaque palier de 10 niveaux, comme un joueur qui dépense ses PM.
 */
import { MODULE_ID, STATS, STAT_LABELS, CLASSES, WEAPONS, TOMES, STAVES, OBJECTS, RANKS, MAX_LEVEL, WEAPON_TYPES, maxDicePerStat } from "./config.js";

const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "");
const DialogV2 = () => foundry.applications.api.DialogV2;

export const DIFFICULTIES = {
  facile:    { label: "Facile",    growth: 0.75, flat: -1, extraDice: 0, rankBonus: 0 },
  normal:    { label: "Normal",    growth: 1,    flat: 0,  extraDice: 0, rankBonus: 0 },
  difficile: { label: "Difficile", growth: 1.25, flat: 1,  extraDice: 1, rankBonus: 0 },
  extreme:   { label: "Extrême",   growth: 1.5,  flat: 2,  extraDice: 1, rankBonus: 1 }
};
/** Renfort du boss, ajouté à la difficulté. */
export const BOSS = { flat: 3, pvFlat: 8, extraDice: 1, rankBonus: 1, growth: 0.25 };

export const BEHAVIORS = {
  fonce:    { label: "Fonce",    tip: "Va vers la cible la plus proche et attaque" },
  attend:   { label: "Attend",   tip: "N'agit que si une cible entre dans sa portée" },
  garde:    { label: "Garde",    tip: "Reste près de sa zone (porte, village, trésor)" },
  immobile: { label: "Immobile", tip: "Ne bouge pas, riposte seulement" },
  fuit:     { label: "Fuit",     tip: "Cherche à s'échapper (voleur, messager)" }
};

/** Pure : rang d'arme d'un ennemi selon son niveau (D, puis C au 10, B au 20, A au 30), plus un bonus. */
export function enemyRank(level, bonus = 0) {
  const i = 1 + Math.min(3, Math.floor((level) / 10)) + bonus;   // D = index 1
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, i))];
}

/** Pure : palier d'équipement selon le niveau : bronze 1-4, fer 5-9, acier 10-29, argent 30+. */
export function weaponTier(level) {
  if (level <= 4) return "bronze";
  if (level <= 9) return "fer";
  if (level <= 29) return "acier";
  return "argent";
}

const rankIndex = (r) => RANKS.indexOf(r);

/** Pure : arme de base d'une classe au niveau donné (nom du catalogue). */
export function defaultWeapon(className, level, rank) {
  const c = CLASSES[className];
  const type = c?.armes?.[0];
  if (!type) return null;
  // Tomes et sceptres suivent les mêmes paliers que les armes : E jusqu'au niveau 4, D 5-9, C 10-29, A 30+
  const tierRank = { bronze: "E", fer: "D", acier: "C", argent: "A" }[weaponTier(level)];
  const ri = Math.min(rankIndex(rank), rankIndex(tierRank));
  const riWeapon = rankIndex(rank);
  if (WEAPON_TYPES[type]?.magic && type !== "sceptre") {
    // Tomes : le plus fort de l'école accessible au rang, hors armes de siège et armes personnelles
    const list = TOMES.filter(t => t.type === type && RANKS.includes(t.rang) && rankIndex(t.rang) <= ri && !t.sansRiposte && t.porMax <= 2 && t.special === "aucun");
    return list.sort((a, b) => rankIndex(b.rang) - rankIndex(a.rang) || b.pui - a.pui)[0]?.nom ?? c.depart;
  }
  if (type === "sceptre") {
    const list = STAVES.filter(s => s.effetCle === "soin" && rankIndex(s.rang) <= ri);
    return list.sort((a, b) => rankIndex(b.rang) - rankIndex(a.rang))[0]?.nom ?? c.depart;
  }
  const tier = weaponTier(level);
  const word = { bronze: "bronze", fer: "fer", acier: "acier", argent: "argent" }[tier];
  const list = WEAPONS.filter(w => w.type === type && rankIndex(w.rang) <= riWeapon);
  return list.find(w => w.nom.toLowerCase().includes(word))?.nom
    ?? list.sort((a, b) => b.pui - a.pui)[0]?.nom ?? c.depart;
}

/** Pure : réserves de dés de l'ennemi au niveau donné. */
export function enemyDice(className, level, extraDice = 0) {
  const c = CLASSES[className];
  const cap = maxDicePerStat(level);
  const dice = {};
  for (const s of STATS) dice[s] = 1 + extraDice;
  for (const d of c.des) dice[d] += 1;
  const bought = Math.floor(level / 10);           // un dé de plus par palier de 10 niveaux, dans les stats de classe
  for (const d of new Set(c.des)) dice[d] += bought;
  for (const s of STATS) dice[s] = Math.max(0, Math.min(cap, dice[s]));
  return dice;
}

/**
 * Pure : stats d'un ennemi.
 * opts : { classe, niveau, difficulte, boss, croissance: "moyenne" | "des", rng }
 * Renvoie { totals, dice, rank, gains, level, rolls }.
 */
export function generateEnemyStats({ classe, niveau = 1, difficulte = "normal", boss = false, croissance = "moyenne", rng = Math.random }) {
  const c = CLASSES[classe];
  if (!c) throw new Error(`Classe inconnue : ${classe}`);
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(niveau) || 1)));
  const diff = DIFFICULTIES[difficulte] ?? DIFFICULTIES.normal;
  const growth = diff.growth + (boss ? BOSS.growth : 0);
  const extra = diff.extraDice + (boss ? BOSS.extraDice : 0);

  // Niveau 1 : stats de classe + 3 points libres (+1 à chacune des deux stats de classe, +2 PV)
  const totals = {};
  for (const s of STATS) totals[s] = c[s];
  const classStats = [...new Set(c.des)];
  if (classStats.length === 1) totals[classStats[0]] += classStats[0] === "pv" ? 4 : 2;
  else for (const s of classStats) totals[s] += s === "pv" ? 2 : 1;
  totals.pv += 2;

  // Montées de niveau
  const gains = Object.fromEntries(STATS.map(s => [s, 0]));
  const rolls = [];
  for (let l = 1; l < level; l++) {
    const dice = enemyDice(classe, l, extra);
    for (const s of STATS) {
      const per = s === "pv" ? 2 : 1;
      if (croissance === "des") {
        let sixes = 0;
        for (let i = 0; i < dice[s]; i++) if (Math.floor(rng() * 6) + 1 === 6) sixes++;
        gains[s] += sixes * per * growth;
        if (sixes) rolls.push(`${l + 1} : +${sixes * per} ${STAT_LABELS[s]}`);
      } else {
        gains[s] += (dice[s] / 6) * per * growth;
      }
    }
  }
  const flat = diff.flat + (boss ? BOSS.flat : 0);
  for (const s of STATS) {
    let v = totals[s] + Math.round(gains[s]);
    if (s === "pv") v += 2 * flat + (boss ? BOSS.pvFlat : 0);
    else if (!(s === "mag" && !isMagic(c)) && !(s === "for" && isMagic(c))) v += flat; // la stat d'attaque inutile ne bouge pas
    totals[s] = Math.max(s === "pv" ? 1 : 0, Math.min(s === "pv" ? 99 : 50, v)); // PV sans plafond de stat
  }
  return {
    level, totals, gains, rolls,
    dice: enemyDice(classe, level, extra),
    rank: enemyRank(level, diff.rankBonus + (boss ? BOSS.rankBonus : 0))
  };
}

function isMagic(c) {
  return (c.armes ?? []).some(t => WEAPON_TYPES[t]?.magic);
}

/** Pure : tirage de l'objet porté. chance : 0 à 1. */
export function randomDrop(rng = Math.random, chance = 0.35, level = 1) {
  if (rng() >= chance) return null;
  const pool = ["Potion", "Potion", "Potion", "Clé", level >= 5 ? "Élixir" : "Potion", level >= 10 ? "Booster" : "Potion"];
  return pool[Math.floor(rng() * pool.length)];
}

/* ------------------------------------------------------------------ */
/*  Étiquette de comportement, visible du MJ seulement                 */
/* ------------------------------------------------------------------ */

export function registerEnemyHooks() {
  const draw = (token) => {
    try {
      const old = token.feBehaviorLabel;
      const key = token.actor?.getFlag?.(MODULE_ID, "behavior");
      if (!game.user.isGM || !key || !BEHAVIORS[key]) {
        if (old) { old.destroy(); token.feBehaviorLabel = null; }
        return;
      }
      const text = `${BEHAVIORS[key].label}${token.actor.getFlag(MODULE_ID, "boss") ? " · Boss" : ""}`;
      let label = old;
      if (!label || label.destroyed) {
        label = new PIXI.Text(text, { fontFamily: "Signika, sans-serif", fontSize: 13, fontWeight: "bold", fill: "#ffe08a", stroke: "#000000", strokeThickness: 3 });
        label.anchor.set(0.5, 0);
        token.addChild(label);
        token.feBehaviorLabel = label;
      }
      if (label.text !== text) label.text = text;
      label.position.set(token.w / 2, 2);
      label.zIndex = 50;
    } catch (e) { /* ignore */ }
  };
  Hooks.on("refreshToken", draw);
  Hooks.on("drawToken", draw);
  Hooks.on("updateActor", (actor, change) => {
    if (!change?.flags?.[MODULE_ID]) return;
    for (const t of actor.getActiveTokens?.() ?? []) draw(t);
  });
}

/* ------------------------------------------------------------------ */
/*  Fenêtre du MJ                                                      */
/* ------------------------------------------------------------------ */

function optionList(entries, selected) {
  return entries.map(([v, l]) => `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(l)}</option>`).join("");
}

function dialogContent() {
  const classes = Object.keys(CLASSES).map(k => [k, k]);
  const weaponNames = [
    ...WEAPONS.map(w => [w.nom, `${w.nom} (${w.rang})`]),
    ...TOMES.filter(t => RANKS.includes(t.rang)).map(t => [t.nom, `${t.nom} (${WEAPON_TYPES[t.type].label}, ${t.rang})`]),
    ...STAVES.map(s => [s.nom, `${s.nom} (sceptre, ${s.rang})`])
  ];
  const objets = OBJECTS.map(o => [o.nom, o.nom]);
  return `
  <div class="fe-gen-root">
    <div class="form-group"><label>Classe</label><select name="classe">${optionList(classes, "Brute")}</select></div>
    <div class="form-group"><label>Niveau</label><input type="number" name="niveau" value="1" min="1" max="${MAX_LEVEL}"></div>
    <div class="form-group"><label>Nom</label><input type="text" name="nom" placeholder="Classe par défaut (ex. Brute)"></div>
    <div class="form-group"><label>Difficulté</label><select name="difficulte">${optionList(Object.entries(DIFFICULTIES).map(([k, d]) => [k, d.label]), "normal")}</select></div>
    <div class="form-group"><label>Croissance</label><select name="croissance">${optionList([["moyenne", "Moyenne attendue (stable)"], ["des", "Lancée aux dés (comme un joueur)"]], "moyenne")}</select></div>
    <div class="form-group"><label>Boss</label><input type="checkbox" name="boss"></div>
    <div class="form-group"><label>Comportement (MJ)</label><select name="behavior">${optionList(Object.entries(BEHAVIORS).map(([k, b]) => [k, `${b.label} – ${b.tip}`]), "fonce")}</select></div>
    <hr>
    <div class="form-group"><label>Arme principale</label><select name="arme"><option value="">Auto (selon classe et niveau)</option>${optionList(weaponNames, "")}</select></div>
    <div class="form-group"><label>Arme en plus</label><select name="arme2"><option value="">Aucune</option>${optionList(weaponNames, "")}</select></div>
    <div class="form-group"><label>Objet porté</label><select name="objet"><option value="aleatoire">Aléatoire (1 chance sur 3)</option><option value="">Aucun</option>${optionList(objets, "")}</select></div>
    <div class="form-group"><label>Lâché à sa mort</label><input type="checkbox" name="drop" checked></div>
    <div class="form-group"><label>Poser le jeton</label><input type="checkbox" name="place" checked></div>
    <p class="hint">Mêmes règles que les joueurs : stats de classe, 3 points libres dans les stats de classe, puis une montée par niveau avec les réserves de dés (moyenne ou vrai lancer). Arme de base : bronze jusqu'au niveau 4, fer 5-9, acier 10-29, argent 30+. Rang d'arme D, C au niveau 10, B au 20, A au 30. Le boss gagne +3 partout, +8 PV, un dé de plus par stat et un rang d'arme.</p>
  </div>`;
}

/** Macro : génère un ennemi. */
export async function enemyMacro() {
  if (!game.user.isGM) return ui.notifications.warn("Le générateur d'ennemis est réservé au MJ.");
  const res = await DialogV2().wait({
    window: { title: "Générer un ennemi", icon: "fa-solid fa-skull" },
    classes: ["fe-gen-dialog"],
    position: { width: 520 },
    content: dialogContent(),
    buttons: [
      {
        action: "ok", label: "Créer", icon: "fa-solid fa-skull", default: true,
        callback: (event, button) => {
          const f = button.form.elements;
          return {
            classe: f.classe.value, niveau: Number(f.niveau.value) || 1, nom: f.nom.value.trim(), difficulte: f.difficulte.value,
            croissance: f.croissance.value, boss: f.boss.checked, behavior: f.behavior.value,
            arme: f.arme.value, arme2: f.arme2.value, objet: f.objet.value, drop: f.drop.checked, place: f.place.checked
          };
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  }).catch(() => null);
  if (!res || typeof res !== "object") return;
  return createEnemy(res);
}

/** Crée l'acteur (et le jeton). Utilisable en script : api.createEnemy({ classe: "Brute", niveau: 5, boss: true }). */
export async function createEnemy({ classe, niveau = 1, nom = "", difficulte = "normal", croissance = "moyenne", boss = false, behavior = "fonce", arme = "", arme2 = "", objet = "aleatoire", drop = true, place = false }) {
  const { createUnit } = await import("./setup.js");
  const gen = generateEnemyStats({ classe, niveau, difficulte, boss, croissance });
  const c = CLASSES[classe];
  const weapon = arme || defaultWeapon(classe, gen.level, gen.rank);
  const carried = objet === "aleatoire" ? randomDrop(Math.random, 1 / 3, gen.level) : (objet || null);
  const items = [weapon, arme2, carried].filter(Boolean);
  const name = nom || `${classe}${boss ? " (boss)" : ""}`;

  const props = { niveau: gen.level, role: "ennemi", totals: gen.totals, pm: 0 };
  for (const s of STATS) props[`des_${s}`] = gen.dice[s];
  for (const t of c.armes ?? []) props[`rang_${t}`] = gen.rank;
  const diffLabel = DIFFICULTIES[difficulte]?.label ?? difficulte;
  props.notes = [
    `Généré : ${classe} niveau ${gen.level}, ${diffLabel}${boss ? ", boss" : ""}, croissance ${croissance === "des" ? "aux dés" : "moyenne"}.`,
    `Comportement : ${BEHAVIORS[behavior]?.label ?? behavior} (${BEHAVIORS[behavior]?.tip ?? ""}).`,
    carried ? `Porte : ${carried}${drop ? " (lâché à sa mort)" : ""}.` : ""
  ].filter(Boolean).join(" ");

  let folder = game.folders.find(f => f.type === "Actor" && f.name === "Ennemis générés");
  if (!folder) folder = await Folder.create({ name: "Ennemis générés", type: "Actor", color: "#7a1f1f" });

  const actor = await createUnit({ name, classe, props, items, equip: weapon, folder, link: false, defaultTrait: true });
  if (!actor) return null;
  const flags = { behavior, boss, generated: { classe, niveau: gen.level, difficulte, croissance } };
  if (carried && drop) {
    const it = actor.items.find(i => i.name === carried);
    if (it) flags.drop = it.id;
  }
  await actor.update({ [`flags.${MODULE_ID}`]: flags, "prototypeToken.name": name });

  if (place && canvas?.scene) {
    try {
      const size = canvas.grid.size;
      const center = canvas.stage.pivot;
      const x = Math.floor(center.x / size) * size, y = Math.floor(center.y / size) * size;
      const td = await actor.getTokenDocument({ x, y });
      await canvas.scene.createEmbeddedDocuments("Token", [td.toObject()]);
    } catch (err) {
      console.warn(`${MODULE_ID} | pose du jeton`, err);
    }
  }
  const st = gen.totals;
  ui.notifications.info(`${name} créé (niv. ${gen.level}) : ${st.pv} PV, For ${st.for}, Mag ${st.mag}, Déf ${st.def}, Rés ${st.res}, Tech ${st.tech}, Vit ${st.vit} – ${weapon}${carried ? `, porte ${carried}` : ""}.`);
  return actor;
}

/** Ennemi vaincu qui portait un objet à lâcher : message Loot automatique. */
export async function dropOnDeath(actor) {
  try {
    const id = actor?.getFlag?.(MODULE_ID, "drop");
    const item = id ? actor.items.get(id) : null;
    if (!item) return;
    const { postLootMessage } = await import("./loot.js");
    await postLootMessage({ title: `${actor.name} lâche un objet`, text: `${actor.name} est vaincu et laisse tomber :`, gold: 0, items: [{ uuid: item.uuid, name: item.name, img: item.img, qty: 1 }] });
    await actor.unsetFlag(MODULE_ID, "drop");
  } catch (err) {
    console.warn(`${MODULE_ID} | objet lâché`, err);
  }
}
