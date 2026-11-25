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
  settings: { register: (m, k, d) => settings.set(k, d.default), get: (m, k) => settings.get(k), set: (m, k, v) => settings.set(k, v) },
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
assert.equal(api.sheet(actor, "prec"), 102);
assert.equal(api.sheet(actor, "esq"), 22);
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
// Chapitre 1
const ch = await import("../scripts/chapter1.js");
const regions = ch.buildRegions({ x: 0, y: 0, size: 100 });
const byName = Object.fromEntries(regions.map(r => [r.name, r]));
assert.equal(byName["Forêt"].shapes.length, 15);
assert.ok(byName["Fort – Grenier (M2)"].shapes[0].x === 1200 && byName["Fort – Grenier (M2)"].shapes[0].y === 100);
assert.deepEqual(ch.cell("M2"), { i: 1, j: 12 });
console.log(regions.map(r => `${r.name}:${r.shapes.length}`).join(", "));
console.log("smoke OK");
