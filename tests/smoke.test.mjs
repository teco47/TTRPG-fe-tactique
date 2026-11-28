import fs from "node:fs";
import assert from "node:assert/strict";
const hooks = {};
globalThis.Hooks = { once: (h, f) => (hooks[h] ??= []).push(f), on: (h, f) => (hooks[h] ??= []).push(f), off() {}, call() {}, callAll() {} };
globalThis.CONST = { TOKEN_DISPOSITIONS: { FRIENDLY: 1, HOSTILE: -1, NEUTRAL: 0 }, REGION_VISIBILITY: { LAYER: 0 }, TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20, HOVER: 30 }, DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2 } };
const settings = new Map();
const mod = { version: "0.1.0" };
globalThis.CONFIG = { Token: { movement: { actions: { walk: { getCostFunction: () => c => c }, blink: { teleport: true } } } }, statusEffects: [{ id: "dead" }] };
globalThis.foundry = { utils: { deepClone: x => structuredClone(x), escapeHTML: s => s } };
globalThis.game = {
  modules: { get: () => mod },
  settings: { registerMenu() {}, register: (m, k, d) => settings.set(k, d.default), get: (m, k) => settings.get(k), set: (m, k, v) => settings.set(k, v) },
  keybindings: { register() {} },
  system: { id: "custom-system-builder" }, user: { isGM: true, id: "gm" }, users: { activeGM: { id: "gm" } }
};
await import("../scripts/main.js");
hooks.init.forEach(f => f()); hooks.setup.forEach(f => f());
const api = mod.api;
assert.ok(api.attack && api.sheet && api.install);
assert.ok(CONFIG.statusEffects.some(s => s.id === "fe-bouclier"));
// Acteur simulé
const mkItem = (id, tpl, props, name) => ({ id, uuid: "I." + id, name, system: { template: tpl, props } });
const C = api.config;
const actor = {
  uuid: "A.1", id: "1", name: "Mercenaire", effects: [],
  system: { props: { ...(await import("../scripts/progression.js")).unitPropsFromClass("Mercenaire") } },
  items: [mkItem("w", C.TEMPLATE_IDS.arme, { type_arme: "epee", rang_req: "E", pui: 2, prec: 90, crit: 0, sans_crit: true, poids: 0, por_min: 1, por_max: 1, dur: 50, dur_max: 50, equipee: true }, "Épée de bronze"),
          mkItem("t", C.TEMPLATE_IDS.trait, { type_trait: "boost", boost_stat: "esq", boost_val: 10, equipe: true }, "Boost [+10 Esquive]")]
};
assert.equal(api.sheet(actor, "atq"), 11); // rang D offert par la classe : +2 Pui
assert.equal(api.sheet(actor, "prec"), 109);
assert.equal(api.sheet(actor, "esq"), 24);
assert.equal(api.sheet(actor, "crit"), 3); // Bronze : −5 au critique
assert.equal(api.sheet(actor, "slots_text"), "1 / 4");
assert.equal(api.itemLabel(actor.items[0], "equip"), "★");
assert.equal(api.itemLabel(actor.items[0], "crit"), -5);
assert.equal(api.itemLabel(actor.items[0], "dur"), "50/50");
// Terrain
const { regionTerrain, moveCost } = await import("../scripts/terrain.js");
assert.equal(regionTerrain({ name: "Forêt du nord" }), "foret");
assert.equal(regionTerrain({ name: "Maison du doyen" }), "village");
assert.equal(regionTerrain({ name: "Fort – Grenier (M2)" }), "fort");
assert.equal(regionTerrain({ name: "Bâtiment – Armurerie" }), "mur");
assert.equal(regionTerrain({ name: "Porte sud" }), "porte");
assert.equal(regionTerrain({ name: "Zone de déploiement" }), null);
assert.equal(regionTerrain({ name: "Fortification" }), null);
assert.equal(moveCost("foret", "monte"), 3);
assert.equal(moveCost("foret", "pied", { forestier: true }), 1);
assert.equal(moveCost("montagne", "lourd"), null);
// Fonction de coût du déplacement natif : une Région Forêt sur la colonne j=2
const forest = { name: "Forêt", flags: {}, polygonTree: { testPoint: (pt) => pt.x >= 200 && pt.x < 300 } };
const wall = { name: "Mur", flags: {}, polygonTree: { testPoint: (pt) => pt.x >= 500 && pt.x < 600 } };
globalThis.canvas = { scene: { regions: { contents: [forest, wall], [Symbol.iterator]: function* () { yield forest; yield wall; } } }, grid: { size: 100, getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 }) } };
const tokenDoc = { parent: canvas.scene, actor };
const costFn = CONFIG.Token.movement.actions.walk.getCostFunction(tokenDoc, {});
assert.equal(costFn(1, { i: 0, j: 0 }, { i: 0, j: 1 }, 1, {}), 1);
assert.equal(costFn(1, { i: 0, j: 1 }, { i: 0, j: 2 }, 1, {}), 2);
assert.equal(costFn(1, { i: 0, j: 4 }, { i: 0, j: 5 }, 1, {}), Infinity);
assert.equal(costFn(5, { i: 0, j: 1 }, { i: 0, j: 2 }, 5, {}), 10);
// Chapitre 1
const ch = await import("../scripts/chapter1.js");
const regions = ch.buildRegions({ x: 0, y: 0, size: 100 });
const byName = Object.fromEntries(regions.map(r => [r.name, r]));
assert.equal(byName["Forêt"].shapes.length, 15);
assert.ok(byName["Fort – Grenier (M2)"].shapes[0].x === 1200 && byName["Fort – Grenier (M2)"].shapes[0].y === 100);
assert.deepEqual(ch.cell("M2"), { i: 1, j: 12 });
console.log(regions.map(r => `${r.name}:${r.shapes.length}`).join(", "));
console.log("smoke OK");
// Zone de déplacement / portée
const R = await import("../scripts/range.js");
// Grille 5x7, forêt (coût 2) en colonne 2, mur (null) en colonne 4, ennemi en (0,3)
const cost = (i, j) => (j === 4 ? null : (j === 2 ? 2 : 1));
const moves = R.reachableCells({ rows: 5, cols: 7, start: { i: 2, j: 0 }, mvt: 5, cost, enemy: (i, j) => i === 0 && j === 3 });
assert.equal(moves.get("2,1"), 1);
assert.equal(moves.get("2,2"), 3);
assert.equal(moves.get("2,3"), 4);
assert.ok(!moves.has("2,4"));         // mur
assert.ok(!moves.has("0,3"));         // ennemi
assert.ok(!moves.has("2,5"));
const atk = R.attackCells({ rows: 5, cols: 7, moves, range: [1, 1], start: { i: 2, j: 0 } });
assert.ok(atk.has("2,4") && atk.has("0,3"));
assert.ok(!atk.has("2,5"));
const bow = R.attackCells({ rows: 5, cols: 7, moves: new Map([["2,0", 0]]), range: [2, 2], start: { i: 2, j: 0 } });
assert.ok(bow.has("2,2") && bow.has("1,1") && !bow.has("2,1"));
console.log("range OK");
// Apostrophes : CSB réévalue le texte entre guillemets simples
{
  const it = mkItem("t2", C.TEMPLATE_IDS.trait, { type_trait: "manuel", effet: "S'il n'a fait aucune action" }, "Lecture");
  assert.ok(!api.itemLabel(it, "effet").includes("'"));
}
console.log("apostrophes OK");
{
  const potion = mkItem("o", C.TEMPLATE_IDS.objet, { effet_objet: "soin", uses: 2, uses_max: 3 }, "Potion");
  assert.equal(api.itemLabel(potion, "dur"), "2/3"); assert.equal(api.itemLabel(potion, "type"), "Objet"); assert.equal(api.itemLabel(potion, "pui"), "—");
}
console.log("inventaire OK");
// 0.10.1 : Ysaline aux stats de Moine + 3 points, ennemis sans « À attribuer »
{
  const P = await import("../scripts/progression.js");
  const ys = ch.UNITS.find(u => u.name === "Ysaline");
  const props = P.unitPropsFromClass(ys.classe, ys.props);
  const cls = { id: "c", name: "Moine", system: { template: C.TEMPLATE_IDS.classe, props: { cl_palier: "1", cl_mod_pv: 4, cl_mod_for: -2, cl_mod_mag: 3, cl_mod_def: -2, cl_mod_res: 3, cl_mod_tech: 0, cl_mod_vit: 1, cl_de1: "res", cl_de2: "pv", cl_armes: "sceptre", cl_mvt: 5, cl_rang: "D" } } };
  const a = { uuid: "A.ys", id: "ys", name: "Ysaline", effects: [], system: { props }, items: [cls], flags: {} };
  const s = api.engine.sheetSummary(api.readUnit(a));
  assert.equal(s.pts_libres, "0"); assert.equal(s.tot_mag, 9); assert.equal(s.pv_max, 16);
  const e = { ...a, uuid: "A.en", system: { props: { ...props, role: "ennemi" } } };
  assert.equal(api.engine.sheetSummary(api.readUnit(e)).a_attribuer, "");
}
console.log("chapitre 1 OK");
// 0.10.1 : l'arc frappe à 2 cases, pas au contact
{
  const S = await import("../scripts/setup.js");
  assert.ok(C.WEAPONS.filter(w => w.type === "arc").every(w => w.porMin === 2 && w.porMax === 2));
  assert.equal(S.bowRangeFix({ name: "Arc de fer", system: { props: { type_arme: "arc", por_min: 1, por_max: 2 } } }), true);
  assert.equal(S.bowRangeFix({ name: "Arc maison", system: { props: { type_arme: "arc", por_min: 1, por_max: 2 } } }), false);
  assert.equal(S.bowRangeFix({ name: "Arc de fer", system: { props: { type_arme: "arc", por_min: 2, por_max: 2 } } }), false);
}
console.log("arcs OK");
// Export de la scène
{
  const X = await import("../scripts/export.js");
  const forest2 = { name: "Forêt", flags: {}, getFlag: () => null, behaviors: { contents: [] }, polygonTree: { testPoint: (pt) => pt.x >= 200 && pt.x < 300 && pt.y < 100 } };
  const td = { name: "Mercenaire", x: 0, y: 100, width: 1, height: 1, disposition: 1, hidden: false, actorLink: true, elevation: 0, actor };
  actor.items.contents = actor.items; actor.effects.contents = actor.effects;
  globalThis.canvas = {
    scene: { name: "Chapitre 1 perso", grid: { type: 1, distance: 1, units: "case" }, padding: 0, background: { src: "map.png" },
      regions: { contents: [forest2], [Symbol.iterator]: function* () { yield forest2; } }, walls: { contents: [{ c: [300, 0, 300, 200], door: 1, ds: 0, move: 20, sight: 20 }] }, tokens: { contents: [td] } },
    dimensions: { sceneRect: { x: 0, y: 0, width: 400, height: 200 } }, grid: { size: 100 }
  };
  globalThis.game.version = "14.365"; globalThis.game.system.version = "6.1.2";
  const out = X.buildSceneExport(api);
  assert.deepEqual(out.terrain, [". . F .", ". . . ."]);
  assert.deepEqual(out.regions[0].cells, ["C1"]); assert.equal(out.regions[0].terrain, "foret");
  assert.equal(out.tokens[0].case, "A2"); assert.equal(out.tokens[0].unit.fiche.atq, 11); assert.equal(out.tokens[0].items.length, 2);
  assert.equal(out.walls[0].type, "porte"); assert.equal(out.walls[0].ouverte, false);
  JSON.stringify(out);
}
console.log("export OK");
// Nombres flottants
{
  const Fl = await import("../scripts/floating.js");
  assert.deepEqual(Fl.strikeFloat({ hit: false }), { text: "Raté", kind: "rate" });
  assert.deepEqual(Fl.strikeFloat({ hit: true, dmg: 8 }), { text: "−8", kind: "degats" });
  assert.deepEqual(Fl.strikeFloat({ hit: true, crit: true, dmg: 24 }), { text: "CRITIQUE ! −24", kind: "critique" });
  // Esquive : pas perpendiculaire à l'attaque (attaque venant de la gauche → pas vers le haut ou le bas)
  const o = Fl.dodgeOffset({ x: 0, y: 0 }, { x: 100, y: 0 }, 35, 1);
  assert.ok(Math.abs(o.x) < 1e-9 && Math.abs(Math.abs(o.y) - 35) < 1e-9);
  const o2 = Fl.dodgeOffset({ x: 0, y: 0 }, { x: 0, y: 0 }, 35, -1);
  assert.ok(Number.isFinite(o2.x) && Number.isFinite(o2.y));
  // Tremblement : s'amortit et revient à zéro
  const sh = Fl.shakeFrames(10, 8, 40);
  assert.equal(sh.length, 9);
  assert.deepEqual(sh.at(-1), { x: 0, y: 0, ms: 40 });
  assert.ok(Math.abs(sh[0].x) > Math.abs(sh[6].x));
  const Snd = await import("../scripts/sounds.js");
  assert.equal(Snd.strikeSound({ hit: false }), "rate");
  assert.equal(Snd.strikeSound({ hit: true }), "touche");
  assert.equal(Snd.strikeSound({ hit: true, crit: true }), "critique");
  for (const list of Object.values(Snd.DEFAULT_SOUNDS)) for (const f of list) {
    assert.ok(fs.existsSync(new URL("../" + f.replace(/^modules\/fe-tactique\//, ""), import.meta.url)), f);
  }
}
console.log("flottants OK");
{
  const L = await import("../scripts/loot.js");
  const items = [];
  L.addLootItem(items, { uuid: "Item.a", name: "Vulnéraire", img: "x" });
  L.addLootItem(items, { uuid: "Item.a", name: "Vulnéraire", img: "x" });
  L.addLootItem(items, { uuid: "Item.b", name: "Épée de fer", img: "y" });
  assert.equal(items.length, 2);
  assert.equal(items[0].qty, 2);
  assert.equal(L.lootSummary(items, 50), "Vulnéraire ×2, Épée de fer, 50 or");
  assert.equal(L.lootSummary([], 0), "");
  assert.ok(L.LOOT_PRESETS.coffre.text.length > 0);
  console.log("loot OK");
  const Cv = await import("../scripts/convoi.js");
  assert.equal(Cv.goldAfter(100, 25), 125);
  assert.equal(Cv.goldAfter(10, -50), 0);
  assert.equal(Cv.goldAfter("", 7), 7);
  const { buildTemplates } = await import("../scripts/csb-templates.js");
  const tpl = buildTemplates().actors.find(t => t.id === C.TEMPLATE_IDS.convoi);
  assert.ok(tpl, "modèle Convoi");
  const json = JSON.stringify(tpl);
  for (const k of ["cv_tout", "cv_armes", "cv_tomes", "cv_sceptres", "cv_objets", "cv_suivi", '"key":"or"']) assert.ok(json.includes(k), k);
  assert.ok(C.isConvoi({ system: { template: C.TEMPLATE_IDS.convoi } }));
  assert.ok(!C.isUnitActor({ system: { template: C.TEMPLATE_IDS.convoi, props: {} } }));
  assert.ok(C.isUnitActor({ system: { template: C.TEMPLATE_IDS.unite, props: {} } }));
  console.log("convoi OK");
}
{
  const Cb = await import("../scripts/combat.js");
  assert.equal(Cb.computeImpactDelay("epee"), C.DEFAULT_IMPACT_DELAYS.epee);
  assert.equal(Cb.computeImpactDelay("arc", { arc: 900 }), 900);
  assert.equal(Cb.computeImpactDelay("epee", {}, -200), C.DEFAULT_IMPACT_DELAYS.epee - 200);
  assert.equal(Cb.computeImpactDelay("epee", {}, -5000), 0);
  assert.equal(Cb.computeImpactDelay("inconnu"), C.DEFAULT_IMPACT_DELAYS.defaut);
  assert.equal(Cb.computeImpactDelay("hache", { hache: "abc" }), C.DEFAULT_IMPACT_DELAYS.defaut);
  console.log("impact OK");
  const G = await import("../scripts/enemies.js");
  // Niveau 1 : stats de classe + 3 points libres (Brute : +1 For, +4 PV)
  const b1 = G.generateEnemyStats({ classe: "Brute", niveau: 1 });
  assert.deepEqual(b1.totals, { pv: 24, for: 9, mag: 3, def: 7, res: 4, tech: 3, vit: 5 });
  assert.equal(b1.rank, "D");
  // Plus haut niveau = stats plus hautes, croissance moyenne stable
  const b10 = G.generateEnemyStats({ classe: "Brute", niveau: 10 });
  assert.ok(b10.totals.for > b1.totals.for && b10.totals.pv > b1.totals.pv);
  assert.deepEqual(G.generateEnemyStats({ classe: "Brute", niveau: 10 }).totals, b10.totals);
  assert.equal(b10.rank, "C");
  // Difficulté et boss
  const hard = G.generateEnemyStats({ classe: "Brute", niveau: 10, difficulte: "difficile" });
  const boss = G.generateEnemyStats({ classe: "Brute", niveau: 10, boss: true });
  assert.ok(hard.totals.for > b10.totals.for && boss.totals.for > hard.totals.for && boss.totals.pv >= b10.totals.pv + 8);
  assert.ok(G.generateEnemyStats({ classe: "Brute", niveau: 10, difficulte: "facile" }).totals.for < b10.totals.for);
  // Aux dés : que des 6 = maximum, que des 1 = stats de niveau 1
  const lucky = G.generateEnemyStats({ classe: "Brute", niveau: 10, croissance: "des", rng: () => 0.99 });
  const unlucky = G.generateEnemyStats({ classe: "Brute", niveau: 10, croissance: "des", rng: () => 0 });
  assert.ok(lucky.totals.for > b10.totals.for);
  assert.deepEqual(unlucky.totals, b1.totals);
  // Réserves : limite du niveau respectée
  for (const l of [1, 9, 10, 25, 40]) for (const v of Object.values(G.enemyDice("Coursier", l, 1))) assert.ok(v <= C.maxDicePerStat(l));
  // Armes de base
  assert.equal(G.defaultWeapon("Brute", 1, "D"), "Hache de bronze");
  assert.equal(G.defaultWeapon("Brute", 6, "D"), "Hache de fer");
  assert.equal(G.defaultWeapon("Mercenaire", 12, "C"), "Épée d'acier");
  assert.equal(G.defaultWeapon("Soldat", 32, "A"), "Lance d'argent");
  assert.equal(G.defaultWeapon("Apprentie", 1, "D"), "Feu");
  assert.equal(G.defaultWeapon("Apprentie", 6, "D"), "Foudre");
  assert.equal(G.defaultWeapon("Moine", 1, "D"), "Soin");
  assert.equal(G.randomDrop(() => 0.9), null);
  assert.ok(G.randomDrop(() => 0.1));
  console.log("ennemis OK");
  // Personnage principal : +3 PV max, +2 dés libres, +3 PV actuels à la création
  const P = await import("../scripts/progression.js");
  const mk = (role) => ({ uuid: "A." + role, id: role, name: role, effects: [], items: [], system: { props: P.unitPropsFromClass("Mercenaire", { role }) } });
  const lord = mk("principal"), rec = mk("secondaire");
  const E2 = api.engine;
  assert.equal(E2.effectiveStats(api.readUnit(lord)).pvMax, E2.effectiveStats(api.readUnit(rec)).pvMax + C.LORD_BONUS.pv);
  assert.equal(lord.system.props.pv, rec.system.props.pv + C.LORD_BONUS.pv);
  assert.equal(E2.allocation(api.readUnit(lord)).des, E2.allocation(api.readUnit(rec)).des + C.LORD_BONUS.des);
  console.log("lord OK");
  const pl = Cb.critCutInPayload({ name: "Payreb", actorId: "abc", weaponName: "Épée de fer", dmg: 24 }, { theme: "blitz", duration: 3 });
  assert.deepEqual(pl, { theme: "blitz", format: "popout", text: "Payreb – CRITIQUE !", subText: "Épée de fer · −24 PV", customDuration: 3, actorId: "abc", characterImageSource: "actor" });
  const pl2 = Cb.critCutInPayload({ name: "Bandit", img: "x.png", dmg: 9 }, { theme: "", duration: 0 });
  assert.equal(pl2.theme, "impact"); assert.equal(pl2.img, "x.png"); assert.equal(pl2.customDuration, 2.5); assert.ok(!("actorId" in pl2));
  console.log("cut-in OK");
}

// Fiche de l'unité sélectionnée
{
  const UP = await import("../scripts/unit-panel.js");
  const unit = api.readUnit(actor);
  const d = UP.panelData(unit, { img: "a.png" });
  assert.equal(d.pvMax, Number(api.sheet(actor, "pv_max")));
  assert.equal(d.combat.find(c => c.k === "atq").value, 11);
  assert.equal(d.stats.length, 7);
  assert.deepEqual(d.inventory.map(i => [i.name, i.equipped, i.count]), [["Épée de bronze", true, "50/50"]]);
  assert.equal(d.traits[0].name, "Boost [+10 Esquive]");
  assert.match(UP.panelHTML(d, "stats"), /Préc<\/span><b>109/);
  assert.match(UP.panelHTML(d, "inv"), /icone-ep\.png/);
  assert.match(UP.panelHTML(d, "traits"), /★ Boost/);
  const limited = UP.panelHTML(UP.panelData(unit, { full: false }), "stats");
  assert.doesNotMatch(limited, /fe-up-tabs/);
  assert.match(UP.panelHTML({ ...d, name: "<b>x</b>" }), /&lt;b&gt;x/);
}

// Cadre de bataille (parties pures)
{
  const BH = await import("../scripts/battle-hud.js");
  assert.deepEqual(BH.parseButtons("Attaquer=FE – Attaquer; FE – Loot ;; Fin=FE – Fin de phase"), [
    { label: "Attaquer", macro: "FE – Attaquer" }, { label: "FE – Loot", macro: "FE – Loot" }, { label: "Fin", macro: "FE – Fin de phase" }]);
  const st = BH.battleState({ name: "Chapitre 1", flags: { "fe-tactique": { battle: { objective: "Vaincre Garrec", turn: 3, phase: "ennemis" } } } });
  assert.equal(st.chapter, "Chapitre 1"); assert.equal(st.turn, 3); assert.equal(st.phase, "ennemis");
  assert.deepEqual(BH.battleState({ name: "X" }), { chapter: "X", objective: "", objective2: "", turn: 1, phase: "joueurs" });
  let n = BH.nextPhase(st, "ennemis"); assert.equal(n.turn, 4); assert.equal(n.phase, "joueurs");
  n = BH.nextPhase(n, "joueurs"); assert.equal(n.turn, 4); assert.equal(n.phase, "ennemis");
  assert.deepEqual(BH.sortRoster([{ name: "Mara", role: "secondaire" }, { name: "Sienne", role: "principal" }, { name: "Alaric", role: "principal" }]).map(e => e.name), ["Alaric", "Sienne", "Mara"]);
  const r = BH.rosterHTML([{ id: "t1", name: "<Alaric>", img: "a.png", hp: 10, pvMax: 27, role: "principal", acted: true, selected: true }, { id: "t2", name: "Mara", img: "", hp: 20, pvMax: 20, role: "secondaire" }]);
  assert.match(r, /&lt;Alaric&gt;/); assert.match(r, /sel done/); assert.match(r, /bar low/); assert.match(r, /1 unité peut encore agir/);
  assert.doesNotMatch(r, /fe-bh-camps/); // un seul camp : pas d'onglets
  const mixed = [{ id: "a", name: "Alaric", role: "principal", hp: 1, pvMax: 2 }, { id: "b", name: "Bandit", role: "ennemi", hp: 1, pvMax: 2, hidden: true }, { id: "c", name: "Villageois", role: "neutre", hp: 1, pvMax: 2 }];
  const m1 = BH.rosterHTML(mixed, "ennemis");
  assert.match(m1, /data-camp="joueurs"[^>]*>Armée <span>1/); assert.match(m1, /data-camp="allies"/); assert.match(m1, /fe-bh-camp-ennemis on/);
  assert.match(m1, /Bandit/); assert.doesNotMatch(m1, /Alaric</); assert.match(m1, /hid/);
  assert.equal(BH.pickCamp(mixed.slice(1, 2), "joueurs"), "ennemis"); // camp absent : premier camp présent
  assert.match(BH.titleHTML(st, { isGM: true }), /data-action="edit"/);
  assert.doesNotMatch(BH.titleHTML(st), /data-action/);
  assert.match(BH.buttonsHTML([{ label: "A", macro: "FE – Attaquer" }], [{ label: "Fin", macro: "FE – Fin de phase" }]), /fe-bh-sep.*class="fe-bh-btn gm"/s);
  assert.deepEqual(BH.actedOperation({ document: { uuid: "Scene.s.Token.t" } }), { op: "update", uuid: "Scene.s.Token.t", data: { "flags.fe-tactique.acted": true } });
  assert.ok(api.advanceBattle && api.resetBattle);
  console.log("cadre de bataille OK");
}
