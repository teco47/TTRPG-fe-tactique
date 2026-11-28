/**
 * FE Tactique – fiche de l'unité sélectionnée.
 * Panneau fixé sur un bord de l'écran (pensé pour la colonne droite d'un cadre Wrap a Map) :
 * portrait, PV, stats, stats de combat, traits et inventaire de l'unité sélectionnée (ou survolée).
 * Chaque joueur voit sa propre sélection ; rien n'est écrit dans le monde.
 */
import { MODULE_ID, MODULE_PATH, WEAPON_TYPES, isUnitActor } from "./config.js";
import { readUnit, sheetSummary, itemCategory, readWeapon, woundMalus } from "./engine.js";

const TABS = [["stats", "Stats"], ["traits", "Traits"], ["inv", "Inventaire"]];
const STAT_ROWS = [["for", "For"], ["mag", "Mag"], ["def", "Déf"], ["res", "Rés"], ["tech", "Tech"], ["vit", "Vit"], ["mvt", "Mvt"]];
const COMBAT_ROWS = [["atq", "Att"], ["prec", "Préc"], ["crit", "Crit"], ["esq", "Esq"], ["vit_att", "Vit. att"], ["esq_crit", "Esq. crit"]];
const INVENTORY_CATS = ["arme", "tome", "sceptre", "objet"];

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const on = (v) => v === true || v === "true";

/* ------------------------------------------------------------------ */
/*  Données (pur, testable hors Foundry)                               */
/* ------------------------------------------------------------------ */

/** Ligne d'inventaire d'un objet CSB (arme, tome, sceptre, objet), ou null. */
export function inventoryRow(item) {
  const cat = itemCategory(item);
  if (!INVENTORY_CATS.includes(cat)) return null;
  const p = item.system?.props ?? {};
  if (cat === "objet") {
    return { name: item.name, cat, icon: null, equipped: false, count: `${p.uses ?? 0}/${p.uses_max ?? p.uses ?? 0}`, broken: false };
  }
  const w = readWeapon(item);
  const file = WEAPON_TYPES[w?.type]?.icon;
  return {
    name: item.name, cat,
    icon: file ? `${MODULE_PATH}/assets/icons/${file}` : null,
    equipped: !!w?.equipped,
    count: `${w?.dur ?? 0}/${w?.durMax ?? 0}`,
    broken: (w?.dur ?? 1) <= 0
  };
}

/**
 * Tout ce que le panneau affiche pour une unité.
 * full = false : seulement le portrait, le nom, la classe et les PV (unités qu'on ne possède pas, si le MJ le règle ainsi).
 */
export function panelData(unit, { img = "", full = true } = {}) {
  const s = sheetSummary(unit);
  const pvMax = Number(s.pv_max) || 1;
  const hp = Math.max(0, Math.min(unit.hp, pvMax));
  const items = [...(unit.actor?.items ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const traits = [...unit.traits].sort((a, b) => Number(b.equipped) - Number(a.equipped));
  return {
    name: unit.name, img,
    className: unit.className || "—", level: unit.level, role: unit.role,
    hp, pvMax, hpPct: Math.round(100 * hp / pvMax),
    wounds: unit.wounds, woundMalus: woundMalus(unit), silenced: !!unit.silenced,
    full,
    stats: STAT_ROWS.map(([k, label]) => ({ k, label, value: s[k] ?? 0 })),
    combat: COMBAT_ROWS.map(([k, label]) => ({ k, label, value: s[k] ?? 0 })),
    weapon: s.weapon, range: s.portee,
    traits: traits.map(t => ({ name: t.name, equipped: t.equipped })),
    slots: `${s.slots_used} / ${s.slots}`,
    inventory: items.map(inventoryRow).filter(Boolean)
  };
}

/** HTML du panneau (sans le conteneur). */
export function panelHTML(d, tab = "stats") {
  const roleClass = { principal: "ally", secondaire: "ally", neutre: "neutral", ennemi: "foe" }[d.role] ?? "ally";
  const flags = [
    d.wounds > 0 ? `<span class="fe-up-flag">Blessures ${esc(d.wounds)} (−${esc(d.woundMalus)})</span>` : "",
    d.silenced ? `<span class="fe-up-flag">Silence</span>` : ""
  ].join("");
  const head = `
    <header class="fe-up-head fe-up-${roleClass}">
      ${d.img ? `<img class="fe-up-img" src="${esc(d.img)}" alt="">` : `<div class="fe-up-img"></div>`}
      <div class="fe-up-id">
        <div class="fe-up-name">${esc(d.name)}</div>
        <div class="fe-up-class">${esc(d.className)} · niv. ${esc(d.level)}</div>
        <div class="fe-up-hp"><span>PV</span> <b>${esc(d.hp)}</b>/${esc(d.pvMax)}</div>
        <div class="fe-up-bar"><div style="width:${Number(d.hpPct) || 0}%"></div></div>
      </div>
    </header>
    ${flags ? `<div class="fe-up-flags">${flags}</div>` : ""}`;
  if (!d.full) return head;

  const tabs = `<nav class="fe-up-tabs">${TABS.map(([k, label]) =>
    `<a data-tab="${k}" class="${k === tab ? "active" : ""}">${label}</a>`).join("")}</nav>`;

  let body = "";
  if (tab === "traits") {
    body = `<div class="fe-up-sub">Équipés ${esc(d.slots)}</div>` + (d.traits.length
      ? `<ul class="fe-up-list">${d.traits.map(t => `<li class="${t.equipped ? "" : "off"}">${t.equipped ? "★" : "☆"} ${esc(t.name)}</li>`).join("")}</ul>`
      : `<div class="fe-up-empty">Aucun trait</div>`);
  } else if (tab === "inv") {
    body = d.inventory.length
      ? `<ul class="fe-up-list fe-up-inv">${d.inventory.map(i => `<li class="${i.broken ? "broken" : ""}">
          ${i.icon ? `<img src="${esc(i.icon)}" alt="">` : `<span class="fe-up-dot"></span>`}
          <span class="fe-up-iname">${i.equipped ? "<b>★</b> " : ""}${esc(i.name)}</span>
          <span class="fe-up-count">${esc(i.count)}</span></li>`).join("")}</ul>`
      : `<div class="fe-up-empty">Inventaire vide</div>`;
  } else {
    const cells = (rows) => rows.map(r => `<div><span>${r.label}</span><b>${esc(r.value)}</b></div>`).join("");
    body = `<div class="fe-up-grid">${cells(d.stats)}</div>
      <div class="fe-up-sub">Combat · ${esc(d.weapon)}${d.range && d.range !== "—" ? ` (portée ${esc(d.range)})` : ""}</div>
      <div class="fe-up-grid">${cells(d.combat)}</div>`;
  }
  return head + tabs + `<div class="fe-up-body">${body}</div>`;
}

/* ------------------------------------------------------------------ */
/*  Affichage dans Foundry                                             */
/* ------------------------------------------------------------------ */
let el = null;
let timer = null;
/** État partagé avec le cadre de bataille : onglet, jeton survolé, masqué (Alt+U), panneau fixe remplacé. */
export const panelState = { tab: "stats", hovered: null, pinned: null, hidden: false, suppressed: false };
const listeners = [];
/** Appelé à chaque rafraîchissement (le cadre de bataille s'y abonne). */
export function onPanelRefresh(fn) { listeners.push(fn); }

const setting = (k, d) => { try { return game.settings.get(MODULE_ID, k); } catch (e) { return d; } };

export function registerUnitPanelSettings() {
  const client = (key, data) => game.settings.register(MODULE_ID, key, { scope: "client", config: true, onChange: () => refresh(), ...data });
  client("unitPanel", { name: "Fiche de l'unité sélectionnée", hint: "Panneau fixe avec le portrait, les PV, les stats, les traits et l'inventaire de l'unité sélectionnée. Alt+U l'affiche ou le masque.", type: Boolean, default: true });
  client("unitPanelHover", { name: "Fiche : unité survolée", hint: "Survoler un jeton affiche sa fiche tant que la souris reste dessus, puis la fiche revient à l'unité sélectionnée.", type: Boolean, default: true });
  client("unitPanelSide", { name: "Fiche : côté de l'écran", type: String, choices: { right: "Droite", left: "Gauche" }, default: "right" });
  client("unitPanelX", { name: "Fiche : écart au bord (px)", hint: "Distance entre le bord de l'écran et le panneau. Règle-le pour le poser dans la colonne de ton cadre.", type: Number, default: 320, range: { min: 0, max: 1200, step: 5 } });
  client("unitPanelY", { name: "Fiche : écart au haut (px)", type: Number, default: 90, range: { min: 0, max: 1200, step: 5 } });
  client("unitPanelWidth", { name: "Fiche : largeur (px)", type: Number, default: 260, range: { min: 180, max: 480, step: 5 } });
  client("unitPanelHeight", { name: "Fiche : hauteur max (px, 0 = auto)", hint: "Au-delà, le contenu de l'onglet défile.", type: Number, default: 0, range: { min: 0, max: 1400, step: 10 } });
  game.settings.register(MODULE_ID, "unitPanelFoes", { name: "Fiche complète des unités non possédées", hint: "Décoché : pour les unités qu'un joueur ne possède pas (ennemis…), la fiche ne montre que le portrait, la classe et les PV. Le MJ voit toujours tout.", scope: "world", config: true, type: Boolean, default: true, onChange: () => refresh() });
}

export function registerUnitPanelHooks() {
  game.keybindings.register(MODULE_ID, "unitPanelToggle", {
    name: "Afficher / masquer la fiche de l'unité",
    editable: [{ key: "KeyU", modifiers: ["Alt"] }],
    onDown: () => { panelState.hidden = !panelState.hidden; refresh(); return true; }
  });
  Hooks.on("controlToken", () => refresh());
  Hooks.on("hoverToken", (token, isHover) => {
    if (!setting("unitPanelHover", true)) return;
    if (isHover) panelState.hovered = token;
    else if (panelState.hovered === token) panelState.hovered = null;
    refresh();
  });
  Hooks.on("canvasReady", () => { panelState.hovered = null; panelState.pinned = null; refresh(); });
  Hooks.on("deleteToken", (doc) => { if (panelState.hovered?.document === doc) panelState.hovered = null; refresh(); });
  for (const h of ["updateActor", "updateToken", "createItem", "updateItem", "deleteItem", "createActiveEffect", "deleteActiveEffect"]) Hooks.on(h, () => refresh());
}

/** Jeton affiché : survolé (unité FE), sinon le dernier sélectionné. */
export function currentToken() {
  const isUnit = (t) => t?.actor && isUnitActor(t.actor);
  if (isUnit(panelState.hovered)) return panelState.hovered;
  if (isUnit(panelState.pinned) && !panelState.pinned.destroyed) return panelState.pinned;
  const controlled = canvas?.tokens?.controlled ?? [];
  return [...controlled].reverse().find(isUnit) ?? null;
}

/** Regroupe les rafraîchissements (plusieurs hooks d'affilée pendant un combat). */
export function refresh() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    render();
    for (const fn of listeners) { try { fn(); } catch (err) { console.warn(`${MODULE_ID} | rafraîchissement`, err); } }
  }, 30);
}

/** HTML de la fiche d'un jeton (aussi utilisé par le cadre de bataille). */
export function tokenPanelHTML(token) {
  const actor = token.actor;
  const unit = readUnit(actor, { token: token.document });
  const full = game.user.isGM || actor.isOwner || setting("unitPanelFoes", true);
  const img = token.document?.texture?.src || actor.img || "";
  return panelHTML(panelData(unit, { img, full }), panelState.tab);
}

/** Clic sur un onglet dans un conteneur de fiche. */
export function handleTabClick(ev) {
  const a = ev.target.closest?.("[data-tab]");
  if (!a) return false;
  panelState.tab = a.dataset.tab;
  refresh();
  return true;
}

function ensureElement() {
  if (el) return el;
  el = document.createElement("section");
  el.id = "fe-unit-panel";
  el.addEventListener("click", handleTabClick);
  document.body.appendChild(el);
  return el;
}

function render() {
  const token = setting("unitPanel", true) && !panelState.hidden && !panelState.suppressed ? currentToken() : null;
  if (!token) { if (el) el.hidden = true; return; }
  const panel = ensureElement();
  try {
    panel.innerHTML = tokenPanelHTML(token);
  } catch (err) {
    console.warn(`${MODULE_ID} | fiche de l'unité`, err);
    panel.hidden = true;
    return;
  }
  const side = setting("unitPanelSide", "right") === "left" ? "left" : "right";
  const h = Number(setting("unitPanelHeight", 0));
  Object.assign(panel.style, {
    left: side === "left" ? `${setting("unitPanelX", 320)}px` : "",
    right: side === "right" ? `${setting("unitPanelX", 320)}px` : "",
    top: `${setting("unitPanelY", 90)}px`,
    width: `${setting("unitPanelWidth", 260)}px`,
    maxHeight: h > 0 ? `${h}px` : ""
  });
  panel.hidden = false;
}

/** Macro / console : affiche ou masque le panneau. */
export function toggleUnitPanel(force) {
  panelState.hidden = force === undefined ? !panelState.hidden : !force;
  refresh();
}
