import assert from "node:assert/strict";
globalThis.Hooks = { once() {}, on() {} };
globalThis.CONST = { TOKEN_DISPOSITIONS: { FRIENDLY: 1, HOSTILE: -1 }, TOKEN_DISPLAY_MODES: { OWNER_HOVER: 20, HOVER: 30 } };
globalThis.foundry = { utils: { deepClone: x => structuredClone(x) } };
const T = await import("../scripts/csb-templates.js");
const C = await import("../scripts/config.js");
const pack = T.buildTemplates();
const tplDoc = (t, docName) => ({ id: t.id, documentName: docName, system: { ...t.data, templateSystemUniqueVersion: 42 } });
const items = new Map(pack.items.map(t => [t.id, tplDoc(t, "Item")]));
const actors = new Map(pack.actors.map(t => [t.id, tplDoc(t, "Actor")]));
let created = null, embedded = null;
globalThis.game = { items, actors };
globalThis.Actor = { create: async (d) => (created = d, { createEmbeddedDocuments: async (t, list) => (embedded = list) }) };
const S = await import("../scripts/setup.js");
await S.createUnit({ name: "Soldat test", classe: "Soldat" });
assert.equal(created.system.template, C.TEMPLATE_IDS.unite);
assert.equal(created.system.props.des_tech, 2);
assert.equal(embedded.length, 3);
assert.equal(embedded[0].name, "Soldat"); assert.equal(embedded[0].system.template, C.TEMPLATE_IDS.classe);
assert.equal(embedded[0].system.props.cl_mod_def, 2); assert.equal(embedded[0].system.props.cl_trait, "Bouclier");
assert.equal(embedded[1].name, "Lance de bronze"); assert.equal(embedded[1].system.props.equipee, true);
assert.equal(embedded[1].system.props.sans_crit, true);
assert.equal(embedded[2].name, "Bouclier"); assert.equal(embedded[2].system.props.equipe, true);
await S.createUnit({ name: "Moine", classe: "Moine" });
assert.equal(embedded[1].name, "Soin"); assert.equal(embedded[1].system.props.equipee, true);

// Classe et mots-clés lus par le moteur
const E = await import("../scripts/engine.js");
const P = await import("../scripts/progression.js");
const coursier = S.catalogItemData("Coursier");
const volant = S.catalogItemData("Volant");
assert.equal(E.itemCategory(coursier), "classe");
assert.equal(E.itemCategory(volant), "motcle");
const fakeActor = (items, props = {}) => ({ name: "x", items, effects: [], system: { props: { ...P.unitPropsFromClass("Coursier"), ...props } } });
const u = E.readUnit(fakeActor([coursier, S.catalogItemData("Dragon")], { tags: "Monstre" }));
assert.equal(u.className, "Coursier");
assert.deepEqual([...u.keywords].sort(), ["dragon", "monstre", "volant"]);
assert.equal(E.sheetSummary(u).mots_cles, "Volant · Dragon · Monstre");
const arc = { ...S.catalogItemData("Arc de fer") };
assert.equal(E.isEffective(E.readUnit(fakeActor([])), E.readWeapon(arc), u), false);
const brasier = E.readWeapon(S.catalogItemData("Brasier"));
assert.equal(E.isEffective(u, brasier, u), true);
// Classes : emplacements, conditions et écarts
const K = await import("../scripts/classes.js");
assert.equal(embedded[0].system.props.cl_mod_res, 2); // Moine : Rés 7 = 5 + 2
const brute = S.catalogItemData("Brute");
const bruteC = E.readClass(brute);
assert.deepEqual(bruteC.mods, { pv: 10, for: 3, mag: -1, def: 0, res: -1, tech: -3, vit: 0 });
// Unité faite à la main (10/5 partout, aucun objet Classe) -> choix de la Brute
const blank = { niveau: 1, pv: 10, base_pv: 10, base_for: 5, base_mag: 5, base_def: 5, base_res: 5, base_tech: 5, base_vit: 5, base_mvt: 5,
  des_pv: 1, des_for: 1, des_mag: 1, des_def: 1, des_res: 1, des_tech: 1, des_vit: 1 };
let slots = K.classSlots([], blank);
assert.equal(K.currentTier(slots), 0);
let el = K.classEligibility(bruteC, slots, blank);
assert.equal(el.mode, "initial");
let plan = K.planClassChange(blank, slots, bruteC, "initial");
assert.equal(plan.updates.base_pv, 20); assert.equal(plan.updates.pv, 20); assert.equal(plan.updates.base_tech, 2);
assert.equal(plan.updates.des_for, 2); assert.equal(plan.updates.des_pv, 2); assert.equal(plan.updates.base_mvt, 5);
// Mercenaire de 0.1 (classe en texte) qui passe Brute au niveau 1 : on retire Mercenaire puis on ajoute Brute
const merc = P.unitPropsFromClass("Mercenaire");
slots = K.classSlots([], merc);
assert.equal(slots[1].nom, "Mercenaire"); assert.ok(slots[1].virtual);
plan = K.planClassChange(merc, slots, bruteC, K.classEligibility(bruteC, slots, merc).mode);
const bruteProps = P.unitPropsFromClass("Brute");
for (const k of ["base_pv", "base_for", "base_mag", "base_def", "base_res", "base_tech", "base_vit"]) assert.equal(plan.updates[k] ?? merc[k], bruteProps[k], k);
for (const k of ["des_pv", "des_for", "des_def"]) assert.equal(plan.updates[k] ?? merc[k], bruteProps[k], k);
// Promotion : classe avancée fictive (palier 2, bonus +2 For +1 Déf, 1 dé For)
const adv = { system: { props: { cl_palier: "2", cl_mvt: 6, cl_profil: "monte", cl_mod_for: 2, cl_mod_def: 1, cl_de1: "for", cl_de2: "aucun" } }, name: "Avancée test", id: "adv" };
const advC = E.readClass(adv);
const lvl = { ...bruteProps, niveau: 9 };
const bruteItem = { ...brute, id: "b1" };
slots = K.classSlots([bruteItem], lvl);
el = K.classEligibility(advC, slots, lvl, () => false);
assert.equal(el.mode, "promotion"); assert.deepEqual(el.reasons, ["niveau 10 requis", "objet « Magister » manquant"]);
el = K.classEligibility(advC, slots, { ...lvl, niveau: 10 }, (x) => x === "Magister");
assert.deepEqual(el.reasons, []);
plan = K.planClassChange(lvl, slots, advC, "promotion");
assert.equal(plan.updates.base_for, bruteProps.base_for + 2); assert.equal(plan.updates.des_for, bruteProps.des_for + 1);
assert.equal(plan.updates.base_mvt, 6); assert.equal(plan.updates.palier, "2"); assert.equal(plan.lost.length, 0);
// Équivalence vers une classe de base depuis une avancée : perd l'avancée et la base
const advItem = { ...adv };
slots = K.classSlots([bruteItem, advItem], { ...lvl, niveau: 12 });
const coursierC = E.readClass(S.catalogItemData("Coursier"));
el = K.classEligibility(coursierC, slots, { niveau: 12 }, () => true);
assert.equal(el.mode, "equivalence");
plan = K.planClassChange({ ...lvl, base_for: lvl.base_for + 2, base_def: lvl.base_def + 1, base_mvt: 6 }, slots, coursierC, "equivalence");
assert.deepEqual(plan.lost.map(c => c.nom).sort(), ["Avancée test", "Brute"]);
const coursierProps = P.unitPropsFromClass("Coursier");
assert.equal(plan.updates.base_for, coursierProps.base_for); assert.equal(plan.updates.base_def, coursierProps.base_def);
assert.equal(plan.updates.base_mvt, 6);
// Classe déjà obtenue
assert.equal(K.classEligibility(bruteC, slots, lvl).blocking, true);
// Traits d'une classe
const tl = K.classTraitList("Sauvage");
assert.deepEqual(tl.map(t => t.nom), ["Forestier", "Être des bois", "Désespoir"]);
// Valeurs manquantes
assert.deepEqual(Object.keys(P.missingDefaults({ ...P.unitPropsFromClass("Soldat"), niveau: null, jet_bouclier: "" })).sort(), ["jet_bouclier", "niveau"]);
assert.equal(S.catalogItemData("Fulguration").system.props.sans_riposte, true);
assert.equal(S.catalogItemData("Fulguration").system.props.por_max, 10);
assert.equal(S.catalogItemData("Luna").system.props.special, "luna");
assert.equal(S.catalogItemData("Arc de fer").system.props.por_max, 2);
console.log("setup OK");
// Reste à attribuer
{
  const fresh = (props = {}, items = [S.catalogItemData("Soldat")], flags = {}) => E.readUnit({ name: "x", items, effects: [], flags: { "fe-tactique": flags }, system: { props: { ...P.unitPropsFromClass("Soldat"), ...props } } });
  let a = E.allocation(fresh());
  assert.equal(a.points, 3); assert.equal(a.des, 6); assert.equal(a.pm, 5); assert.deepEqual(a.alerts, []);
  a = E.allocation(fresh({ base_for: 8, base_pv: 16, des_for: 3, des_vit: 3 }));
  assert.equal(a.points, 0); assert.equal(a.des, 2);
  a = E.allocation(fresh({ base_for: 10, des_for: 4 }));
  assert.equal(a.points, -1); assert.ok(a.alerts.some(x => x.includes("en trop"))); assert.ok(a.alerts.some(x => x.includes("3d6")));
  // gains de niveau et dés achetés ne comptent pas
  a = E.allocation(fresh({ niveau: 2, base_for: 7, des_tech: 3 }, undefined, { gains: { for: 1 }, diceBought: 0 }));
  assert.equal(a.points, 3); assert.equal(a.des, 5);
  a = E.allocation(fresh({ des_tech: 3 }, undefined, { diceBought: 1 }));
  assert.equal(a.des, 6);
  // unité 0.1 sans objet Classe
  a = E.allocation(fresh({}, []));
  assert.equal(a.points, 3);
  const sum = E.sheetSummary(fresh());
  assert.ok(sum.a_attribuer.includes("3 pts de stats") && sum.a_attribuer.includes("6 dés") && sum.a_attribuer.includes("5 PM"));
}
console.log("allocation OK");
