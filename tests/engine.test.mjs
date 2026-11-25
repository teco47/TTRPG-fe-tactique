import assert from "node:assert/strict";
const M = new URL("../scripts/", import.meta.url).href;
const E = await import(M + "engine.js");
const C = await import(M + "config.js");
const P = await import(M + "progression.js").catch(e => ({ err: e }));

function unit(name, cls, stats, weaponName, extra = {}) {
  const c = C.CLASSES[cls];
  const [pv, f, m, d, r, t, v] = stats ?? [c.pv, c.for, c.mag, c.def, c.res, c.tech, c.vit];
  const w = [...C.WEAPONS, ...C.TOMES].find(x => x.nom === weaponName);
  const weapon = { id: "w1", uuid: "w1", name: w.nom, cat: C.WEAPON_TYPES[w.type].magic ? "tome" : "arme", type: w.type, rang: w.rang,
    pui: w.pui, prec: w.prec, crit: w.crit, poids: w.poids, porMin: w.porMin, porMax: w.porMax, dur: w.dur, durMax: w.dur,
    efficace: w.efficace ?? "", special: w.special, sansRiposte: w.sansRiposte, bonusEsq: w.bonusEsq ?? 0, bonusRes: w.bonusRes ?? 0, equipped: true };
  const ranks = {}; for (const k of Object.keys(C.WEAPON_TYPES)) ranks[k] = "E";
  return { name, className: cls, classData: c, level: 1, palier: 1, role: "secondaire", profil: c.profil, tags: "",
    base: { pv, for: f, mag: m, def: d, res: r, tech: t, vit: v, mvt: 5 }, hp: pv, wounds: 0,
    jetons: { bouclier: 0, aile: 0, esprit: 0 }, manual: { prec: 0, esq: 0, crit: 0, atq: 0, def: 0 },
    temp: {}, silenced: false, ranks, traits: [], weapons: [weapon], objects: [], ...extra };
}
const merc = unit("Mercenaire", "Mercenaire", null, "Épée de bronze");
const bandit = unit("Bandit", "Brute", [20, 8, 4, 5, 4, 2, 5], "Hache de bronze");
let f = E.buildForecast(merc, bandit, merc.weapons[0], bandit.weapons[0], { distance: 1 });
assert.equal(f.A.dmg, 4); assert.equal(f.A.hit, 98); assert.equal(f.D.dmg, 6); assert.equal(f.D.hit, 65); // armes de rang E : triangle sans effet
assert.equal(f.A.crit, 0); assert.equal(f.D.can, true);

const app = unit("Apprentie", "Apprentie", null, "Feu");
f = E.buildForecast(app, bandit, app.weapons[0], bandit.weapons[0], { distance: 1 });
assert.equal(f.A.dmg, 8); assert.equal(f.A.hit, 93); assert.equal(f.D.dmg, 9); assert.equal(f.D.hit, 69);
// À distance 2, la hache ne riposte pas
f = E.buildForecast(app, bandit, app.weapons[0], bandit.weapons[0], { distance: 2 });
assert.equal(f.D.can, false); assert.equal(f.D.restriction, "hors de portée");

const ecu = unit("Écuyer", "Écuyer", null, "Lance de bronze");
const spa = unit("Spadassin", "Mercenaire", [12, 7, 5, 5, 3, 6, 6], "Épée de bronze");
f = E.buildForecast(ecu, spa, ecu.weapons[0], spa.weapons[0], { distance: 1 });
assert.equal(f.A.dmg, 5); assert.equal(f.D.dmg, 3);

// Garrec sur le fort : Esq 4 (19 sur le fort), Atq 16, Préc 76, Crit 1
const garrec = unit("Garrec", "Brute", [24, 10, 4, 6, 4, 3, 5], "Hache de fer");
const s = E.combatStats(garrec, garrec.weapons[0], { terrain: "fort" });
assert.equal(s.atq, 16); assert.equal(s.prec, 76); assert.equal(s.esq, 19); assert.equal(s.crit, 1);
// Mercenaire contre Garrec sur le fort : 6 dégâts (100 %), riposte 5 (47 %)
f = E.buildForecast(merc, garrec, merc.weapons[0], garrec.weapons[0], { distance: 1, terrainD: "fort" });
assert.equal(f.A.dmg, 1); assert.equal(f.A.hit, 85); assert.equal(f.D.dmg, 10); assert.equal(f.D.hit, 62);

// Résolution : dés fixes
const seq = (arr) => { let i = 0; return () => arr[i++ % arr.length]; };
f = E.buildForecast({ ...app, hp: 9 }, bandit, app.weapons[0], bandit.weapons[0], { distance: 1 });
let r = E.resolveCombat(f, seq([10, 10, 99, 50, 50]));
// Apprentie (9 PV) touche (moyenne 10 ≤ 93), pas de crit (jet 99), Bandit touche (50 ≤ 69) → 9 dégâts : Apprentie tombe
assert.equal(r.log.length, 2); assert.equal(r.state.D.hp, 12); assert.equal(r.state.A.hp, 0);
assert.deepEqual(r.fallen.A, { wounds: 1, dead: false }); assert.equal(r.state.A.dur, 39);

// Double attaque et Bouclier
const fast = unit("Rapide", "Voleur", [14, 5, 5, 3, 4, 7, 14], "Épée de bronze");
const sold = unit("Soldat", "Soldat", null, "Lance de bronze", { traits: [{ name: "Bouclier", equipped: true, type: "jetons" }] });
f = E.buildForecast(fast, sold, fast.weapons[0], sold.weapons[0], { distance: 1 });
assert.equal(f.A.double, true);
assert.deepEqual(E.strikeOrder(f), ["A", "D", "A"]);
r = E.resolveCombat(f, seq([1, 1, 100]));
assert.equal(r.state.D.jetons.bouclier, 2);

// Critique x3, efficacité x3, les deux x6
const ar = unit("Archer", "Chasseur", null, "Arc de fer", { traits: [{ name: "Tir au pigeon", equipped: true, type: "auto" }] });
const flyer = unit("Coursier", "Coursier", null, "Épée de bronze");
f = E.buildForecast(ar, flyer, ar.weapons[0], flyer.weapons[0], { distance: 2 });
assert.equal(f.A.effective, true); assert.equal(f.D.can, false);
const base = (f.A.atq - f.A.defense);
r = E.resolveCombat(f, seq([1, 1, 1]));
assert.equal(r.log[0].crit, true); assert.equal(r.log[0].dmg, Math.min(flyer.hp, base * 6));

// 2RN : 100 % et plus touche toujours sans jet
assert.deepEqual(E.rollHit(120, () => 100), { hit: true, rolls: [], value: null });
assert.equal(E.rollHit(50, seq([100, 1])).hit, true); // (100+1)/2 = 50

// Blessures : −3 par blessure au palier I
const hurt = { ...merc, wounds: 2 };
assert.equal(E.effectiveStats(hurt).for, 1);
// Rang insuffisant
const steel = { ...merc.weapons[0], name: "Épée d'acier", rang: "C" };
assert.match(E.weaponRestriction(merc, steel), /rang C requis/);

// Triangle selon le rang de l'unité (25/11/2026)
{
  const withRank = (u, t, r) => ({ ...u, ranks: { ...u.ranks, [t]: r } });
  const lance = withRank(unit("L", "Soldat", null, "Lance de bronze"), "lance", "C");
  const epee = withRank(unit("S", "Mercenaire", null, "Épée de bronze"), "epee", "A");
  let t = E.buildForecast(lance, epee, lance.weapons[0], epee.weapons[0], { distance: 1 });
  // Lance avantagée : bonus de son rang C ; épée désavantagée : malus du rang C de l'adversaire (pas son propre A)
  assert.deepEqual(t.A.triMod, { atq: 4, prec: 8 }); assert.deepEqual(t.D.triMod, { atq: -4, prec: -8 });
  // Rang E de l'unité avantagée : rien, même avec une arme d'argent
  const lE = unit("L", "Soldat", null, "Lance d'argent");
  t = E.buildForecast(lE, epee, lE.weapons[0], epee.weapons[0], { distance: 1 });
  assert.deepEqual(t.A.triMod, { atq: 0, prec: 0 }); assert.deepEqual(t.D.triMod, { atq: 0, prec: 0 });
  // Hache rang B contre lance rang D : hache avantagée +6/+12, lance −6/−12
  const h = withRank(unit("H", "Brute", null, "Hache de bronze"), "hache", "B");
  const lD = withRank(unit("L", "Soldat", null, "Lance de bronze"), "lance", "D");
  t = E.buildForecast(lD, h, lD.weapons[0], h.weapons[0], { distance: 1 });
  assert.deepEqual(t.A.triMod, { atq: -6, prec: -12 }); assert.deepEqual(t.D.triMod, { atq: 6, prec: 12 });
}
console.log("engine OK");
