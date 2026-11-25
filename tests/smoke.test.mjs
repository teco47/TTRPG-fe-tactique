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
assert.equal(api.sheet(actor, "atq"), 9);
assert.equal(api.sheet(actor, "prec"), 104);
assert.equal(api.sheet(actor, "esq"), 24);
assert.equal(api.sheet(actor, "crit"), 0);
assert.equal(api.sheet(actor, "slots_text"), "1 / 4");
assert.equal(api.itemLabel(actor.items[0], "equip"), "★");
assert.equal(api.itemLabel(actor.items[0], "crit"), "—");
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
