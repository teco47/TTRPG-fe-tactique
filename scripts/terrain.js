/**
 * FE Tactique – terrain lu depuis les Régions de la scène, et coûts de déplacement par profil.
 *
 * Une Région donne son terrain :
 *  1. par le drapeau flags["fe-tactique"].terrain (posé par la macro de scène), sinon
 *  2. par son nom : « Forêt », « Colline nord », « Maison du doyen »… (mots-clés de config.js).
 * Les cases sans Région sont des plaines.
 */
import { MODULE_ID, TERRAINS, TERRAIN_KEYWORDS, MOVE_COSTS } from "./config.js";

const normalize = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Terrain d'une Région, ou null si elle n'en définit pas. */
export function regionTerrain(region) {
  const flag = region?.getFlag?.(MODULE_ID, "terrain") ?? region?.flags?.[MODULE_ID]?.terrain;
  if (flag && TERRAINS[flag]) return flag;
  const name = normalize(region?.name);
  if (!name) return null;
  for (const [kw, terrain] of TERRAIN_KEYWORDS) {
    if (new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`).test(name)) return terrain;
  }
  return null;
}

function regionContains(region, point) {
  try {
    if (region.polygonTree?.testPoint) return region.polygonTree.testPoint(point);
  } catch (e) { /* on tente la méthode suivante */ }
  try {
    if (region.testPoint) return region.testPoint({ x: point.x, y: point.y, elevation: point.elevation ?? 0 });
  } catch (e) { /* ignore */ }
  try {
    if (region.object?.testPoint) return region.object.testPoint(point);
  } catch (e) { /* ignore */ }
  return false;
}

/** Terrain au point (x, y) de la scène. La Région la plus récente l'emporte en cas de chevauchement. */
export function terrainAtPoint(point, scene = canvas?.scene) {
  if (!scene?.regions) return "plaine";
  let found = null;
  for (const region of scene.regions) {
    const t = regionTerrain(region);
    if (!t) continue;
    if (regionContains(region, point)) found = t;
  }
  return found ?? "plaine";
}

/** Terrain sous un jeton (centre du jeton). */
export function terrainUnderToken(token) {
  const doc = token?.document ?? token;
  if (!doc) return "plaine";
  const obj = doc.object;
  let center = obj?.center;
  if (!center && canvas?.grid) {
    const size = canvas.grid.size;
    center = { x: doc.x + (doc.width * size) / 2, y: doc.y + (doc.height * size) / 2 };
  }
  return terrainAtPoint({ ...center, elevation: doc.elevation ?? 0 }, doc.parent);
}

/** Case de grille d'un jeton { i: ligne, j: colonne }. */
export function tokenOffset(token) {
  const doc = token?.document ?? token;
  try {
    return canvas.grid.getOffset({ x: doc.x + 1, y: doc.y + 1 });
  } catch (e) {
    const size = canvas.grid.size;
    return { i: Math.floor(doc.y / size), j: Math.floor(doc.x / size) };
  }
}

/** Coût d'entrée dans une case pour un profil (null = infranchissable). */
export function moveCost(terrain, profil, { forestier = false } = {}) {
  const row = MOVE_COSTS[terrain] ?? MOVE_COSTS.plaine;
  let c = (profil in row) ? row[profil] : row.pied;
  if (c !== null && forestier && terrain === "foret") c = Math.max(1, c - 1);
  return c;
}

/**
 * Remplace la fonction de coût des actions de déplacement mesurées (marche, vol, etc.).
 * Le moteur natif de Foundry v14 additionne alors ces coûts dans la règle et le chemin planifié.
 */
export function registerMovementCosts() {
  const actions = CONFIG.Token?.movement?.actions;
  if (!actions) {
    console.warn(`${MODULE_ID} | CONFIG.Token.movement.actions introuvable : coûts de terrain désactivés.`);
    return;
  }
  for (const [id, action] of Object.entries(actions)) {
    if (action.teleport || action.measure === false) continue;
    const original = action.getCostFunction;
    action.getCostFunction = (token, options) => {
      const fallback = original ? original.call(action, token, options) : (cost) => cost;
      if (!game.settings.get(MODULE_ID, "terrainCosts")) return fallback;
      const actor = token?.actor;
      const props = actor?.system?.props;
      if (!props) return fallback;
      const profil = props.profil || "pied";
      const forestier = actor.items?.some(i => i.name?.trim().toLowerCase() === "forestier" && (i.system?.props?.equipe === true || i.system?.props?.equipe === "true"));
      return (cost, from, to, distance, segment) => {
        try {
          const center = canvas.grid.getCenterPoint({ i: to.i, j: to.j });
          const terrain = terrainAtPoint({ x: center.x, y: center.y, elevation: segment?.elevation ?? 0 }, token.parent ?? canvas.scene);
          const c = moveCost(terrain, profil, { forestier });
          if (c === null) return Infinity;
          return distance * c;
        } catch (e) {
          return fallback(cost, from, to, distance, segment);
        }
      };
    };
  }
  console.log(`${MODULE_ID} | Coûts de déplacement par profil activés.`);
}

/** Recalcule les chemins planifiés quand les Régions changent. */
export function refreshPlannedPaths() {
  try { canvas?.tokens?.recalculatePlannedMovementPaths?.(); } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Macro : vérifier / régler le terrain des Régions de la scène       */
/* ------------------------------------------------------------------ */
export async function regionsMacro() {
  if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ.");
  const scene = canvas?.scene;
  const regions = scene?.regions?.contents ?? [];
  if (!regions.length) return ui.notifications.warn("Aucune Région sur cette scène.");
  const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "");
  const options = (sel) => [`<option value="">(aucun : ignorée)</option>`]
    .concat(Object.entries(TERRAINS).map(([k, t]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${t.label}${t.esq || t.def ? ` (Esq +${t.esq}, Déf +${t.def})` : ""}</option>`)).join("");
  const rows = regions.map(r => {
    const flag = r.getFlag(MODULE_ID, "terrain");
    const detected = regionTerrain(r);
    const how = flag ? "réglé" : (detected ? "d'après le nom" : "non reconnu");
    return `<tr><td>${esc(r.name)}</td><td><select name="${r.id}">${options(detected)}</select></td><td class="hint">${how}</td></tr>`;
  }).join("");
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: `Terrain des Régions : ${scene.name}` },
    position: { width: 620 },
    content: `<p>Chaque Région donne son terrain aux cases qu'elle couvre (les cases sans Région sont des plaines). Le combat lit le terrain sous chaque unité, et le déplacement utilise le coût du profil de l'unité.</p>
      <table><thead><tr><th>Région</th><th>Terrain</th><th></th></tr></thead><tbody>${rows}</tbody></table>`,
    buttons: [{
      action: "ok", label: "Enregistrer", default: true,
      callback: (e, b) => Object.fromEntries(regions.map(r => [r.id, b.form.elements[r.id].value]))
    }, { action: "cancel", label: "Annuler" }],
    rejectClose: false
  }).catch(() => null);
  if (!res || res === "cancel") return;
  const updates = regions.map(r => res[r.id]
    ? { _id: r.id, [`flags.${MODULE_ID}.terrain`]: res[r.id] }
    : { _id: r.id, [`flags.${MODULE_ID}.-=terrain`]: null });
  await scene.updateEmbeddedDocuments("Region", updates);
  refreshPlannedPaths();
  ui.notifications.info(`Terrain enregistré pour ${regions.length} Région(s).`);
}
