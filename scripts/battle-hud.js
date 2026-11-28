/**
 * FE Tactique – cadre de bataille posé sur la scène, comme un plateau de jeu.
 * Le MJ pose des Tiles dans la marge de la carte et choisit leur « Zone FE » (titre, liste, fiche, boutons).
 * Le module affiche l'interface pile sur chaque Tile : elle bouge et zoome avec la carte.
 * Tour et phase sont enregistrés sur la scène ; une unité qui a attaqué (ou utilisé un sceptre) est grisée jusqu'à la phase suivante de son camp.
 */
import { MODULE_ID, isUnitActor } from "./config.js";
import { readUnit, effectiveStats } from "./engine.js";
import { panelState, onPanelRefresh, refresh, currentToken, tokenPanelHTML, handleTabClick } from "./unit-panel.js";

export const ZONES = { titre: "Titre, objectif et tour", liste: "Liste des unités", fiche: "Fiche de l'unité", boutons: "Boutons de macro" };
const DEFAULT_BUTTONS = "Attaquer=FE – Attaquer; Sceptre=FE – Utiliser un sceptre; Convoi=FE – Convoi; Niveau=FE – Montée de niveau; Bonus=FE – Bonus temporaire; Fiche=FE – Fiche de l'unité (afficher/masquer)";
const DEFAULT_GM_BUTTONS = "Fin de phase=FE – Fin de phase; Loot=FE – Loot; Ennemi=FE – Générer un ennemi";
const PHASES = { joueurs: "Phase joueur", ennemis: "Phase ennemie" };

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const setting = (k, d) => { try { return game.settings.get(MODULE_ID, k); } catch (e) { return d; } };

/* ------------------------------------------------------------------ */
/*  Pur (testable hors Foundry)                                        */
/* ------------------------------------------------------------------ */

/** « Libellé=Nom de macro; … » → [{ label, macro }]. Sans « = », le nom de la macro sert de libellé. */
export function parseButtons(text) {
  return String(text ?? "").split(/[;\n]+/).map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf("=");
    return i < 0 ? { label: s, macro: s } : { label: s.slice(0, i).trim() || s.slice(i + 1).trim(), macro: s.slice(i + 1).trim() };
  }).filter(b => b.macro);
}

/** État de bataille d'une scène, avec les valeurs par défaut. */
export function battleState(scene) {
  const f = scene?.flags?.[MODULE_ID]?.battle ?? {};
  return {
    chapter: f.chapter ?? scene?.navName ?? scene?.name ?? "",
    objective: f.objective ?? "",
    objective2: f.objective2 ?? "",
    turn: Math.max(1, Number(f.turn) || 1),
    phase: PHASES[f.phase] ? f.phase : "joueurs"
  };
}

/** Phase suivante après la fin de la phase d'un camp. */
export function nextPhase(state, endingCamp) {
  const starting = endingCamp === "joueurs" ? "ennemis" : "joueurs";
  return { ...state, phase: starting, turn: starting === "joueurs" ? state.turn + 1 : state.turn };
}

/** Unités de la liste : lords d'abord, puis par nom. entries : [{ name, role, … }]. */
export function sortRoster(entries) {
  return [...entries].sort((a, b) => Number(b.role === "principal") - Number(a.role === "principal") || a.name.localeCompare(b.name, "fr"));
}

export function titleHTML(st, { isGM = false } = {}) {
  return `<div class="fe-bh-title${isGM ? " fe-bh-edit" : ""}" ${isGM ? 'data-action="edit" title="Cliquer pour modifier"' : ""}>
    <div class="fe-bh-chapter">${esc(st.chapter)}</div>
    ${st.objective ? `<div class="fe-bh-obj">Objectif : ${esc(st.objective)}</div>` : ""}
    ${st.objective2 ? `<div class="fe-bh-obj2">${esc(st.objective2)}</div>` : ""}
    <div class="fe-bh-turn">Tour ${esc(st.turn)} <span class="fe-bh-phase fe-bh-${st.phase}">${PHASES[st.phase]}</span></div>
  </div>`;
}

/** entries : [{ id, name, img, hp, pvMax, role, acted, selected }] déjà triées. */
export function rosterHTML(entries) {
  const left = entries.filter(e => !e.acted).length;
  return `<div class="fe-bh-head">Armée <span>${entries.length}</span></div>
    <div class="fe-bh-roster">${entries.map(e => {
      const pct = Math.max(0, Math.min(100, Math.round(100 * e.hp / (e.pvMax || 1))));
      return `<div class="fe-bh-unit${e.selected ? " sel" : ""}${e.acted ? " done" : ""}" data-token="${esc(e.id)}">
        ${e.img ? `<img src="${esc(e.img)}" class="${e.role === "principal" ? "lord" : ""}" alt="">` : `<div class="fe-bh-noimg"></div>`}
        <div class="fe-bh-uname">${esc(e.name)}</div>
        <div class="fe-bh-bar${pct <= 50 ? " low" : ""}"><div style="width:${pct}%"></div></div>
      </div>`;
    }).join("") || `<div class="fe-bh-empty">Aucune unité sur la carte</div>`}</div>
    <div class="fe-bh-foot">${left} unité${left > 1 ? "s" : ""} peu${left > 1 ? "vent" : "t"} encore agir</div>`;
}

export function buttonsHTML(buttons, gmButtons = []) {
  const b = (x, gm) => `<button type="button" class="fe-bh-btn${gm ? " gm" : ""}" data-macro="${esc(x.macro)}">${esc(x.label)}</button>`;
  return `<div class="fe-bh-buttons">${buttons.map(x => b(x, false)).join("")}${gmButtons.length ? `<span class="fe-bh-sep"></span>${gmButtons.map(x => b(x, true)).join("")}` : ""}</div>`;
}

/* ------------------------------------------------------------------ */
/*  Réglages et hooks                                                  */
/* ------------------------------------------------------------------ */

export function registerBattleHudSettings() {
  const world = (key, data) => game.settings.register(MODULE_ID, key, { scope: "world", config: true, onChange: () => refresh(), ...data });
  world("battleHud", { name: "Cadre de bataille sur les Tiles", hint: "Affiche le titre, la liste des unités, la fiche et les boutons sur les Tiles dont la « Zone FE » est choisie (configuration de la Tile). L'interface fait partie du décor : elle bouge et zoome avec la carte.", type: Boolean, default: true });
  world("battleHudText", { name: "Cadre : taille du texte (en cases)", hint: "Hauteur du texte en fraction de case : 0.25 = un quart de case.", type: Number, default: 0.25, range: { min: 0.08, max: 0.6, step: 0.01 } });
  world("battleHudBackground", { name: "Cadre : fond sombre", hint: "Décoché : fond transparent, pour laisser voir l'image de la Tile.", type: Boolean, default: true });
  world("battleButtons", { name: "Cadre : boutons des joueurs", hint: "Libellé=Nom de la macro, séparés par des points-virgules.", type: String, default: DEFAULT_BUTTONS });
  world("battleButtonsGM", { name: "Cadre : boutons du MJ", hint: "Visibles par le MJ seulement. Même format.", type: String, default: DEFAULT_GM_BUTTONS });
  game.settings.register(MODULE_ID, "battleHudOff", { name: "Cadre : le masquer pour moi", scope: "client", config: true, type: Boolean, default: false, onChange: () => refresh() });
}

export function registerBattleHudHooks() {
  onPanelRefresh(render);
  for (const h of ["createTile", "updateTile", "deleteTile", "updateScene", "createToken"]) Hooks.on(h, () => refresh());
  Hooks.on("canvasReady", () => { startSync(); refresh(); });
  Hooks.on("canvasTearDown", () => { stopSync(); if (root) root.hidden = true; });
  Hooks.on("controlToken", () => { panelState.pinned = null; });
  // Unités qui ont agi : grisées sur la carte
  Hooks.on("refreshToken", (token) => {
    if (token.document.getFlag?.(MODULE_ID, "acted") && token.mesh) token.mesh.tint = 0x707070;
  });
  Hooks.on("updateToken", (doc, change) => {
    if (change?.flags?.[MODULE_ID] && "acted" in change.flags[MODULE_ID]) doc.object?.renderFlags?.set({ refreshMesh: true });
  });
  Hooks.on("renderTileConfig", injectTileConfig);
}

/** Liste « Zone FE » dans la configuration d'une Tile. */
function injectTileConfig(app, element) {
  const html = element instanceof HTMLElement ? element : element?.[0];
  const tile = app.document;
  if (!html || !tile || html.querySelector(`[name='flags.${MODULE_ID}.zone']`)) return;
  const anchor = html.querySelector("[name='texture.src']")?.closest(".form-group") ?? html.querySelector(".form-group");
  if (!anchor) return;
  const cur = tile.getFlag(MODULE_ID, "zone") ?? "";
  const div = document.createElement("div");
  div.className = "form-group";
  div.innerHTML = `<label>Zone FE</label><div class="form-fields"><select name="flags.${MODULE_ID}.zone">
      <option value="">Aucune</option>${Object.entries(ZONES).map(([k, l]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${l}</option>`).join("")}
    </select></div><p class="hint">FE Tactique affiche cette partie du cadre de bataille sur la Tile.</p>`;
  anchor.before(div);
  app.setPosition?.({ height: "auto" });
}

/* ------------------------------------------------------------------ */
/*  Tour et phase, unités qui ont agi                                  */
/* ------------------------------------------------------------------ */

/** Après « Fin de phase » (MJ) : avance le tour et dégrise le camp qui commence. */
export async function advanceBattle(endingCamp, scene = canvas?.scene) {
  if (!scene || !game.user.isGM) return;
  const st = nextPhase(battleState(scene), endingCamp);
  await scene.setFlag(MODULE_ID, "battle", { turn: st.turn, phase: st.phase });
  await clearActed(scene, (t) => camp(t) === st.phase);
}

/** Nouveau chapitre (MJ) : tour 1, phase joueur, plus personne de grisé. */
export async function resetBattle(scene = canvas?.scene) {
  if (!scene || !game.user.isGM) return;
  await scene.setFlag(MODULE_ID, "battle", { turn: 1, phase: "joueurs" });
  await clearActed(scene, () => true);
}

async function clearActed(scene, filter) {
  const updates = scene.tokens.filter(t => t.getFlag(MODULE_ID, "acted") && filter(t)).map(t => ({ _id: t.id, [`flags.${MODULE_ID}.acted`]: false }));
  if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
}

function camp(tokenDoc) {
  const d = tokenDoc.disposition;
  return d === CONST.TOKEN_DISPOSITIONS.FRIENDLY ? "joueurs" : (d === CONST.TOKEN_DISPOSITIONS.HOSTILE ? "ennemis" : "neutres");
}

/** Opération (pour applyOperations) qui marque l'unité comme ayant agi. */
export function actedOperation(token) {
  const doc = token?.document ?? token;
  return doc?.uuid ? { op: "update", uuid: doc.uuid, data: { [`flags.${MODULE_ID}.acted`]: true } } : null;
}

async function editTitle() {
  const scene = canvas?.scene;
  if (!scene || !game.user.isGM) return;
  const st = battleState(scene);
  const data = await foundry.applications.api.DialogV2.wait({
    window: { title: "Cadre de bataille" },
    content: `<div class="form-group"><label>Chapitre</label><input name="chapter" value="${esc(st.chapter)}"></div>
      <div class="form-group"><label>Objectif</label><input name="objective" value="${esc(st.objective)}"></div>
      <div class="form-group"><label>Objectif secondaire</label><input name="objective2" value="${esc(st.objective2)}"></div>
      <div class="form-group"><label>Tour</label><input name="turn" type="number" min="1" value="${st.turn}"></div>
      <div class="form-group"><label>Phase</label><select name="phase">${Object.entries(PHASES).map(([k, l]) => `<option value="${k}" ${k === st.phase ? "selected" : ""}>${l}</option>`).join("")}</select></div>`,
    buttons: [
      { action: "ok", label: "Enregistrer", default: true, callback: (e, b) => Object.fromEntries(["chapter", "objective", "objective2", "turn", "phase"].map(k => [k, b.form.elements[k].value])) },
      { action: "cancel", label: "Annuler" }
    ],
    rejectClose: false
  }).catch(() => null);
  if (!data || data === "cancel") return;
  data.turn = Math.max(1, Number(data.turn) || 1);
  await scene.setFlag(MODULE_ID, "battle", data);
}

/* ------------------------------------------------------------------ */
/*  Affichage                                                          */
/* ------------------------------------------------------------------ */
let root = null;
let layer = null;
let lastMatrix = "";
let tickerFn = null;

function zoneTiles(scene = canvas?.scene) {
  return (scene?.tiles?.contents ?? []).filter(t => ZONES[t.getFlag(MODULE_ID, "zone")]);
}

function ensureRoot() {
  if (root) return root;
  root = document.createElement("div");
  root.id = "fe-battle-hud";
  layer = document.createElement("div");
  layer.className = "fe-bh-layer";
  root.appendChild(layer);
  root.addEventListener("click", onClick);
  root.addEventListener("dblclick", onDblClick);
  const board = document.getElementById("board");
  if (board?.parentElement) board.after(root); else document.body.prepend(root);
  return root;
}

/** Recopie la transformation de la caméra (position et zoom) sur la couche HTML. */
function syncTransform() {
  if (!layer || !canvas?.ready || !canvas.stage) return;
  const t = canvas.stage.worldTransform;
  const r = canvas.app?.view?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  const m = `matrix(${t.a},${t.b},${t.c},${t.d},${t.tx + r.left},${t.ty + r.top})`;
  if (m !== lastMatrix) { layer.style.transform = m; lastMatrix = m; }
}

function startSync() {
  stopSync();
  tickerFn = () => syncTransform();
  canvas.app?.ticker?.add(tickerFn);
}

function stopSync() {
  if (tickerFn) canvas?.app?.ticker?.remove(tickerFn);
  tickerFn = null;
  lastMatrix = "";
}

function rosterEntries(scene) {
  const selected = currentToken()?.id;
  const out = [];
  for (const t of canvas.tokens.placeables) {
    const actor = t.actor;
    if (!actor || !isUnitActor(actor) || (t.document.hidden && !game.user.isGM)) continue;
    const unit = readUnit(actor, { token: t.document });
    if (!["principal", "secondaire"].includes(unit.role)) continue;
    const pvMax = effectiveStats(unit).pvMax;
    out.push({
      id: t.id, name: t.name || actor.name, img: t.document.texture?.src || actor.img, role: unit.role,
      hp: unit.hp, pvMax, acted: !!t.document.getFlag(MODULE_ID, "acted"), selected: t.id === selected
    });
  }
  return sortRoster(out);
}

function render() {
  const scene = canvas?.scene;
  const tiles = setting("battleHud", true) && !setting("battleHudOff", false) ? zoneTiles(scene) : [];
  const hadFiche = panelState.suppressed;
  panelState.suppressed = tiles.some(t => t.getFlag(MODULE_ID, "zone") === "fiche");
  if (!tiles.length) {
    if (root) root.hidden = true;
    if (hadFiche !== panelState.suppressed) refresh();
    return;
  }
  ensureRoot();
  root.classList.toggle("fe-bh-plain", !setting("battleHudBackground", true));
  layer.style.setProperty("--fe-bh-font", `${Math.round((scene.grid?.size ?? 100) * setting("battleHudText", 0.25))}px`);
  const st = battleState(scene);
  const html = tiles.map(t => {
    const zone = t.getFlag(MODULE_ID, "zone");
    let inner = "";
    try {
      if (zone === "titre") inner = titleHTML(st, { isGM: game.user.isGM });
      else if (zone === "liste") inner = rosterHTML(rosterEntries(scene));
      else if (zone === "boutons") inner = buttonsHTML(parseButtons(setting("battleButtons", DEFAULT_BUTTONS)), game.user.isGM ? parseButtons(setting("battleButtonsGM", DEFAULT_GM_BUTTONS)) : []);
      else if (zone === "fiche") {
        const tok = panelState.hidden ? null : currentToken();
        inner = tok ? `<div class="fe-bh-sheet">${tokenPanelHTML(tok)}</div>` : `<div class="fe-bh-empty">Sélectionne une unité</div>`;
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | cadre de bataille (${zone})`, err);
    }
    return `<div class="fe-bh-zone fe-bh-${zone}" style="left:${t.x}px;top:${t.y}px;width:${t.width}px;height:${t.height}px">${inner}</div>`;
  }).join("");
  // Garde la position de défilement de la liste
  const scroll = layer.querySelector(".fe-bh-roster")?.scrollTop ?? 0;
  layer.innerHTML = html;
  const roster = layer.querySelector(".fe-bh-roster");
  if (roster) roster.scrollTop = scroll;
  root.hidden = false;
  if (!tickerFn) startSync();
  syncTransform();
  if (hadFiche !== panelState.suppressed) refresh();
}

function tokenById(id) {
  return canvas.tokens.get(id) ?? null;
}

async function onClick(ev) {
  if (handleTabClick(ev)) return;
  if (ev.target.closest?.("[data-action='edit']")) return editTitle();
  const btn = ev.target.closest?.("[data-macro]");
  if (btn) {
    const name = btn.dataset.macro;
    const macro = game.macros.getName(name) ?? (name.includes(".") ? await fromUuid(name).catch(() => null) : null);
    if (!macro) return ui.notifications.warn(`Macro introuvable : ${name}`);
    return macro.execute();
  }
  const card = ev.target.closest?.("[data-token]");
  if (card) {
    const token = tokenById(card.dataset.token);
    if (!token) return;
    if (token.isOwner) { token.control({ releaseOthers: true }); panelState.pinned = null; }
    else panelState.pinned = token;
    canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
    refresh();
  }
}

function onDblClick(ev) {
  const card = ev.target.closest?.("[data-token]");
  const token = card ? tokenById(card.dataset.token) : null;
  if (token?.actor?.testUserPermission?.(game.user, "OBSERVER")) token.actor.sheet.render(true);
}
