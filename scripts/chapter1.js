/**
 * FE Tactique – campagne test, chapitre 1 « Le bourg de Hautaulne ».
 * La macro remplit la scène affichée : Régions de terrain, unités et jetons.
 * Le fond de carte (assets/maps/chap1-carte-foundry.png, 1600 × 1200, grille de 100 px) se pose à la création de la scène.
 */
import { MODULE_ID } from "./config.js";
import { createUnit } from "./setup.js";

const DialogV2 = () => foundry.applications.api.DialogV2;

export const MAP = [
  "M M F . . . F . . . . C C M M M",
  "M F . E . . V . . . . # T # M M",
  "F . . = . . = . . . . . = . R C",
  ". . . = . . = . . F . . = . R .",
  ". . F = = = = = = = # # = . R .",
  ". . . = . . F = # B # A = . R .",
  ". . . V . . . = = = = = = = P =",
  "F . . = . . . = . . F F . . R .",
  "F F . = . . . = . . . . . . R .",
  ". . . = . . F = . . V . . . R .",
  "= = = = . . . = . . . . . . R .",
  ". . F . . F . V . . . . . . R C"
].map(r => r.split(" "));

const SYMBOLS = {
  M: { terrain: "montagne", name: "Montagne", color: "#8a8a8a" },
  F: { terrain: "foret", name: "Forêt", color: "#2e7d32" },
  C: { terrain: "colline", name: "Colline", color: "#b8a26a" },
  R: { terrain: "riviere", name: "Rivière", color: "#3d7fd1" },
  T: { terrain: "fort", name: "Fort – Grenier (M2)", color: "#c9a227" },
  "#": { terrain: "mur", name: "Bâtiment", color: "#5b3a1e" }
};
// Cases particulières : une Région par lieu, pour que le MJ les repère facilement.
const PLACES = {
  "D2": { terrain: "village", name: "Village – Église (D2)", color: "#e0e0ff" },
  "G2": { terrain: "village", name: "Village – Maison du doyen (G2)", color: "#d84343" },
  "D7": { terrain: "village", name: "Village – Meunier (D7)", color: "#d84343" },
  "K10": { terrain: "village", name: "Village – Ferme (K10)", color: "#d84343" },
  "H12": { terrain: "village", name: "Village – Chasseuse (H12)", color: "#d84343" },
  "J6": { terrain: "mur", name: "Bâtiment – Marchand (J6, fermé)", color: "#5b3a1e" },
  "L6": { terrain: "mur", name: "Bâtiment – Armurerie (L6, fermée)", color: "#5b3a1e" }
};

const COLS = "ABCDEFGHIJKLMNOP";
/** "M2" -> { i: 1, j: 12 } */
export function cell(code) {
  return { i: Number(code.slice(1)) - 1, j: COLS.indexOf(code[0].toUpperCase()) };
}
const code = (i, j) => `${COLS[j]}${i + 1}`;

const H = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
const F = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;

const st = (pv, f, m, d, r, t, v) => ({ totals: { pv, for: f, mag: m, def: d, res: r, tech: t, vit: v } });

export const UNITS = [
  // Joueurs (stats de classe : les 3 points libres, les 4 dés libres et les 5 PM restent à placer)
  { name: "Écuyer", classe: "Écuyer", at: "B11", disp: F, props: { role: "principal" }, items: ["Lance de bronze"], pj: true },
  { name: "Mercenaire", classe: "Mercenaire", at: "A11", disp: F, props: { role: "principal" }, items: ["Épée de bronze"], pj: true },
  { name: "Apprentie", classe: "Apprentie", at: "A10", disp: F, props: { role: "principal" }, items: ["Feu"], pj: true },
  // Alliée à recruter (cachée dans l'église)
  { name: "Ysaline", classe: "Moine", at: "D2", disp: F, hidden: true, props: { ...st(14, 5, 8, 3, 7, 5, 6), notes: "Barricadée dans l'église (D2). Une unité alliée qui visite l'église la libère : révèle son jeton sur une case libre adjacente." }, items: ["Soin"] },
  // Ennemis (sans trait)
  { name: "Garrec le Borgne", classe: "Brute", at: "M2", disp: H, props: { niveau: 4, ...st(24, 10, 4, 6, 4, 3, 5), notes: "Chef. Immobile sur le fort (grenier)." }, items: ["Hache de fer"] },
  { name: "Bram", classe: "Brute", at: "M3", disp: H, props: { niveau: 2, ...st(22, 9, 4, 5, 4, 2, 5), notes: "Recrutable : un personnage principal adjacent peut lui parler. Immobile, ne fait que riposter. Une fois recruté, passe son jeton en Amical." }, items: ["Hache de bronze"] },
  { name: "Grisard (pillard)", classe: "Sauvage", at: "P4", disp: H, props: { niveau: 2, ...st(20, 8, 3, 5, 4, 4, 6), notes: "Pillard : G2 puis D7." }, items: ["Hache de bronze"] },
  { name: "Tanche (pillard)", classe: "Sauvage", at: "P3", disp: H, props: { niveau: 2, ...st(20, 8, 3, 5, 4, 4, 6), notes: "Pillard : K10 puis H12." }, items: ["Hache de bronze"] },
  { name: "Bandit", classe: "Brute", at: "H9", disp: H, props: { niveau: 1, ...st(20, 8, 4, 5, 4, 2, 5), notes: "Agressif." }, items: ["Hache de bronze"] },
  { name: "Spadassin 1", classe: "Mercenaire", at: "G7", disp: H, props: { niveau: 1, ...st(12, 7, 5, 5, 3, 6, 6), notes: "Agressif." }, items: ["Épée de bronze"] },
  { name: "Spadassin 2", classe: "Mercenaire", at: "I4", disp: H, props: { niveau: 1, ...st(12, 7, 5, 5, 3, 6, 6), notes: "Embusqué." }, items: ["Épée de bronze"] },
  { name: "Soldat", classe: "Soldat", at: "F11", disp: H, props: { niveau: 1, ...st(14, 6, 3, 7, 4, 6, 5), notes: "Agressif." }, items: ["Lance de bronze"] },
  { name: "Chasseur", classe: "Chasseur", at: "K8", disp: H, props: { niveau: 2, ...st(12, 7, 4, 3, 5, 8, 7), notes: "Embusqué, dans la forêt." }, items: ["Arc de bronze"] },
  { name: "Voleur (butin)", classe: "Voleur", at: "C3", disp: H, props: { niveau: 1, ...st(14, 5, 5, 3, 4, 7, 7), notes: "Fuit vers le pont et quitte la carte par P7 au tour 4. Vaincu, il lâche 300 or." }, items: ["Épée de bronze"] }
];

function sceneOrigin() {
  const d = canvas.dimensions;
  return { x: d.sceneRect?.x ?? d.sceneX ?? 0, y: d.sceneRect?.y ?? d.sceneY ?? 0, size: d.size ?? canvas.grid.size };
}

function rect(i, j, o) {
  return { type: "rectangle", x: o.x + j * o.size, y: o.y + i * o.size, width: o.size, height: o.size, rotation: 0, hole: false };
}

export function buildRegions(o) {
  const groups = {};
  const regions = [];
  MAP.forEach((row, i) => row.forEach((sym, j) => {
    const c = code(i, j);
    if (PLACES[c]) {
      const p = PLACES[c];
      regions.push({ name: p.name, color: p.color, shapes: [rect(i, j, o)], terrain: p.terrain });
      return;
    }
    const s = SYMBOLS[sym];
    if (!s) return;
    (groups[s.name] ??= { ...s, shapes: [] }).shapes.push(rect(i, j, o));
  }));
  for (const g of Object.values(groups)) regions.push({ name: g.name, color: g.color, shapes: g.shapes, terrain: g.terrain });
  return regions;
}

export async function setupChapter1() {
  if (!game.user.isGM) return ui.notifications.warn("Seul le MJ peut préparer la scène.");
  const scene = canvas.scene;
  if (!scene) return ui.notifications.warn("Ouvre d'abord la scène du chapitre 1.");
  const o = sceneOrigin();
  const dims = canvas.dimensions;
  const sw = dims.sceneWidth ?? dims.sceneRect?.width, sh = dims.sceneHeight ?? dims.sceneRect?.height;
  const warn = (o.size !== 100 || sw !== 1600 || sh !== 1200)
    ? `<p class="fe-warn">La scène fait ${sw} × ${sh} px avec une grille de ${o.size} px. Le chapitre 1 attend 1600 × 1200 px et une grille de 100 px : les positions seront décalées.</p>` : "";
  const ok = await DialogV2().confirm({
    window: { title: "Préparer le chapitre 1" },
    content: `<p>Ajouter à la scène « ${scene.name} » les Régions de terrain et les jetons du chapitre 1 ?</p>${warn}<p class="hint">Les unités sont créées dans le dossier d'acteurs « FE – Chapitre 1 » si elles n'existent pas déjà.</p>`,
    rejectClose: false
  }).catch(() => false);
  if (!ok) return;

  // Régions
  const levelId = canvas.level?.id ?? scene.initialLevel ?? null;
  const existingNames = new Set(scene.regions.map(r => r.name));
  const regionData = buildRegions(o).filter(r => !existingNames.has(r.name)).map(r => {
    const d = {
      name: r.name, color: r.color, shapes: r.shapes,
      visibility: CONST.REGION_VISIBILITY?.LAYER ?? 0,
      flags: { [MODULE_ID]: { terrain: r.terrain } }
    };
    if (levelId) d.levels = [levelId];
    return d;
  });
  if (regionData.length) await scene.createEmbeddedDocuments("Region", regionData);

  // Unités
  let folder = game.folders.find(f => f.type === "Actor" && f.name === "FE – Chapitre 1");
  folder ??= await Folder.create({ name: "FE – Chapitre 1", type: "Actor", color: "#7a1f1f" });
  const tokens = [];
  for (const u of UNITS) {
    let actor = game.actors.find(a => a.name === u.name && a.folder?.id === folder.id);
    actor ??= await createUnit({
      name: u.name, classe: u.classe, props: u.props, items: u.items, disposition: u.disp, folder,
      defaultTrait: !!u.pj || u.disp === F
    });
    if (scene.tokens.some(t => t.actorId === actor.id)) continue;
    const c = cell(u.at);
    const td = await actor.getTokenDocument({ x: o.x + c.j * o.size, y: o.y + c.i * o.size, disposition: u.disp, hidden: !!u.hidden });
    const data = td.toObject();
    if (levelId) data.level = levelId;
    tokens.push(data);
  }
  if (tokens.length) await scene.createEmbeddedDocuments("Token", tokens);
  ui.notifications.info(`Chapitre 1 : ${regionData.length} Régions et ${tokens.length} jetons ajoutés.`);
}
