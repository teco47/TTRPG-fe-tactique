import assert from "node:assert/strict";
import fs from "node:fs";
const M = new URL("../scripts/", import.meta.url).href;
const P = await import(M + "progression.js");
let r = P.computeLevelUp(1, { pv: [6, 2], for: [6], mag: [1], def: [2], res: [3], tech: [4, 6], vit: [5] });
assert.equal(r.gains.pv, 2); assert.equal(r.gains.for, 1); assert.equal(r.sixes, 3); assert.equal(r.pm, 0);
r = P.computeLevelUp(4, { pv: [1], for: [1], mag: [1], def: [1], res: [1], tech: [1], vit: [1] });
assert.equal(r.newLevel, 5); assert.equal(r.pm, 2 + 5);
const props = P.unitPropsFromClass("Écuyer", { role: "principal" });
assert.equal(props.des_for, 2); assert.equal(props.des_vit, 2); assert.equal(props.base_mvt, 6); assert.equal(props.profil, "monte");
const T = await import(M + "csb-templates.js");
const pack = T.buildTemplates();
const keys = [];
const walk = (c, path) => {
  if (!c || typeof c !== "object") return;
  if (c.type && c.key !== undefined) {
    if (c.key !== "") { assert.match(c.key, /^[A-Za-z0-9_]+$/, `clé invalide ${c.key}`); keys.push(c.key); }
  }
  for (const k of ["contents", "rowLayout"]) if (Array.isArray(c[k])) c[k].forEach(x => walk(x, path + "/" + c.key));
};
for (const tpl of [...pack.actors, ...pack.items]) {
  keys.length = 0;
  walk(tpl.data.header, tpl.name); walk(tpl.data.body, tpl.name);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dup, [], `doublons dans ${tpl.name}: ${dup}`);
  console.log(tpl.name, keys.length, "composants à clé");
}
fs.writeFileSync(new URL("../data/fe-tactique-csb-templates.json", import.meta.url), JSON.stringify(pack, null, "\t"));
console.log("misc OK");
