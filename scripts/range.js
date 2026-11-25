/**
 * FE Tactique – affichage à la Fire Emblem : cases atteignables en bleu, portée d'attaque en rouge
 * (vert pour un sceptre). Tient compte des coûts de terrain du profil, des murs, des ennemis et de l'arme équipée.
 */
import { MODULE_ID } from "./config.js";
import { readUnit, effectiveStats, equippedWeapon, weaponRange, hasTrait } from "./engine.js";
import { terrainAtPoint, moveCost, tokenOffset } from "./terrain.js";

const LAYER = "fe-range";
const COLORS = { move: 0x2f6fde, attack: 0xd63a3a, staff: 0x3fbf5a };

/* ------------------------------------------------------------------ */
/*  Calcul pur                                                         */
/* ------------------------------------------------------------------ */

const key = (i, j) => `${i},${j}`;

/**
 * Cases atteignables (Dijkstra, 4 voisins).
 * opts : { rows, cols, start: {i,j}, mvt, cost(i,j) -> nombre | null, enemy(i,j) -> bool, wall(a,b) -> bool }
 * Retour : Map "i,j" -> coût dépensé. On traverse les alliés, pas les ennemis (sauf passThrough).
 */
export function reachableCells({ rows, cols, start, mvt, cost, enemy = () => false, wall = () => false, passThrough = false }) {
  const best = new Map([[key(start.i, start.j), 0]]);
  const queue = [[0, start.i, start.j]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [spent, i, j] = queue.shift();
    if (spent > (best.get(key(i, j)) ?? Infinity)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= rows || nj >= cols) continue;
      if (!passThrough && enemy(ni, nj)) continue;
      const c = cost(ni, nj);
      if (c === null || c === undefined || !Number.isFinite(c)) continue;
      const total = spent + c;
      if (total > mvt) continue;
      if (wall({ i, j }, { i: ni, j: nj })) continue;
      if (total < (best.get(key(ni, nj)) ?? Infinity)) {
        best.set(key(ni, nj), total);
        queue.push([total, ni, nj]);
      }
    }
  }
  return best;
}

/**
 * Cases à portée depuis les cases où l'unité peut s'arrêter (portée Manhattan [min, max]).
 * occupied(i,j) : case prise par une autre unité (on ne peut pas s'y arrêter).
 */
export function attackCells({ rows, cols, moves, range: [min, max], occupied = () => false, start }) {
  const out = new Set();
  if (max <= 0) return out;
  for (const k of moves.keys()) {
    const [i, j] = k.split(",").map(Number);
    if (occupied(i, j) && !(i === start.i && j === start.j)) continue;
    for (let di = -max; di <= max; di++) {
      for (let dj = -max; dj <= max; dj++) {
        const d = Math.abs(di) + Math.abs(dj);
        if (d < min || d > max) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= rows || nj >= cols) continue;
        const nk = key(ni, nj);
        if (!moves.has(nk)) out.add(nk);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Plateau Foundry                                                    */
/* ------------------------------------------------------------------ */

function sceneGrid() {
  const d = canvas.dimensions;
  const size = canvas.grid.size;
  const r = d.sceneRect ?? { x: d.sceneX, y: d.sceneY, width: d.sceneWidth, height: d.sceneHeight };
  const i0 = Math.floor(r.y / size), j0 = Math.floor(r.x / size);
  return { i0, j0, rows: Math.ceil(r.height / size), cols: Math.ceil(r.width / size), size };
}

function hostile(a, b) {
  const da = a.document.disposition, db = b.document.disposition;
  const F = CONST.TOKEN_DISPOSITIONS.FRIENDLY, H = CONST.TOKEN_DISPOSITIONS.HOSTILE;
  return (da === F && db === H) || (da === H && db === F);
}

function wallBetween(a, b) {
  try {
    const backend = CONFIG.Canvas.polygonBackends?.move;
    if (!backend?.testCollision) return false;
    const pa = canvas.grid.getCenterPoint(a), pb = canvas.grid.getCenterPoint(b);
    return !!backend.testCollision(pa, pb, { type: "move", mode: "any" });
  } catch (e) {
    return false;
  }
}

/** Calcule et affiche la zone d'une unité. */
export function showRange(token) {
  clearRange();
  if (!token?.actor?.system?.props || !canvas?.grid || canvas.grid.isGridless) return;
  const grid = canvas.interface?.grid ?? canvas.grid;
  if (!grid.highlightPosition) return;
  const unit = readUnit(token.actor, { token: token.document });
  const st = effectiveStats(unit);
  const profil = unit.profil || "pied";
  const forestier = hasTrait(unit, "Forestier");
  const { i0, j0, rows, cols, size } = sceneGrid();
  const origin = tokenOffset(token);
  const start = { i: origin.i - i0, j: origin.j - j0 };

  const others = canvas.tokens.placeables.filter(t => t !== token && !t.document.hidden && t.actor);
  const cellOf = (t) => { const o = tokenOffset(t); return key(o.i - i0, o.j - j0); };
  const enemies = new Set(others.filter(t => hostile(token, t)).map(cellOf));
  const occupiedSet = new Set(others.map(cellOf));
  const terrainCache = new Map();
  const cost = (i, j) => {
    const k = key(i, j);
    if (!terrainCache.has(k)) {
      const c = canvas.grid.getCenterPoint({ i: i + i0, j: j + j0 });
      terrainCache.set(k, terrainAtPoint({ x: c.x, y: c.y, elevation: token.document.elevation ?? 0 }));
    }
    return moveCost(terrainCache.get(k), profil, { forestier });
  };
  const moves = reachableCells({
    rows, cols, start, mvt: st.mvt, cost,
    enemy: (i, j) => enemies.has(key(i, j)),
    wall: (a, b) => wallBetween({ i: a.i + i0, j: a.j + j0 }, { i: b.i + i0, j: b.j + j0 }),
    passThrough: hasTrait(unit, "Insaisissable")
  });
  const w = equippedWeapon(unit);
  const range = w ? weaponRange(unit, w) : [0, 0];
  const attacks = attackCells({ rows, cols, moves, range, start, occupied: (i, j) => occupiedSet.has(key(i, j)) });

  grid.addHighlightLayer?.(LAYER);
  const paint = (k, color) => {
    const [i, j] = k.split(",").map(Number);
    const p = canvas.grid.getTopLeftPoint({ i: i + i0, j: j + j0 });
    grid.highlightPosition(LAYER, { x: p.x, y: p.y, color, border: color, alpha: 0.35 });
  };
  for (const k of moves.keys()) paint(k, COLORS.move);
  const atkColor = w?.cat === "sceptre" ? COLORS.staff : COLORS.attack;
  for (const k of attacks) paint(k, atkColor);
  shown = token.id;
}

let shown = null;
export function clearRange() {
  const grid = canvas?.interface?.grid ?? canvas?.grid;
  try { grid?.clearHighlightLayer?.(LAYER); } catch (e) { /* ignore */ }
  shown = null;
}

function refreshForControlled() {
  if (!game.settings.get(MODULE_ID, "rangeOnSelect")) return clearRange();
  const ctl = canvas.tokens?.controlled ?? [];
  if (ctl.length === 1) showRange(ctl[0]);
  else clearRange();
}

export function registerRangeHooks() {
  Hooks.on("controlToken", () => setTimeout(refreshForControlled, 0));
  // Après un déplacement ou un changement d'équipement, on recalcule.
  const later = foundry.utils.debounce ? foundry.utils.debounce(refreshForControlled, 150) : refreshForControlled;
  Hooks.on("updateToken", () => { if (shown) later(); });
  Hooks.on("updateItem", () => { if (shown) later(); });
  Hooks.on("updateActor", () => { if (shown) later(); });
  Hooks.on("canvasTearDown", clearRange);
}

/** Raccourci : zone du jeton survolé (ennemis compris), ou efface. */
export function toggleHoverRange() {
  const t = canvas.tokens?.hover ?? canvas.tokens?.controlled?.[0];
  if (!t || shown === t.id) return clearRange();
  showRange(t);
}
