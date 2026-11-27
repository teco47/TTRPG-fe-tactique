/**
 * FE Tactique – badge de l'arme équipée en bas à droite du jeton.
 */
import { MODULE_ID, MODULE_PATH, WEAPON_TYPES, isUnitActor } from "./config.js";
import { readUnit, equippedWeapon } from "./engine.js";

const BADGE = "feWeaponBadge";
const findBadge = (token) => token.children?.find(c => c._feBadge) ?? null;

function iconFor(token) {
  const actor = token?.actor;
  if (!isUnitActor(actor)) return null;
  const w = equippedWeapon(readUnit(actor));
  if (!w) return null;
  const file = WEAPON_TYPES[w.type]?.icon;
  return file ? { path: `${MODULE_PATH}/assets/icons/${file}`, broken: w.dur <= 0 } : null;
}

export function drawBadge(token) {
  try {
    if (!game.settings.get(MODULE_ID, "weaponBadge")) {
      findBadge(token)?.destroy();
      return;
    }
    const icon = iconFor(token);
    let sprite = findBadge(token);
    if (!icon) { sprite?.destroy(); return; }
    if (!sprite || sprite._fePath !== icon.path) {
      sprite?.destroy();
      sprite = PIXI.Sprite.from(icon.path);
      sprite.name = BADGE;
      sprite._feBadge = true;
      sprite._fePath = icon.path;
      token.addChild(sprite);
    }
    const size = Math.max(16, Math.round(Math.min(token.w, token.h) * 0.32));
    sprite.width = size;
    sprite.height = size;
    sprite.position.set(token.w - size - 1, token.h - size - 1);
    sprite.alpha = icon.broken ? 0.35 : 1;
    sprite.zIndex = 100;
  } catch (err) {
    console.warn(`${MODULE_ID} | badge`, err);
  }
}

export function refreshBadgesFor(actor) {
  if (!canvas?.ready) return;
  for (const t of canvas.tokens.placeables) {
    if (t.actor === actor || t.actor?.id === actor?.id) drawBadge(t);
  }
}

export function registerBadgeHooks() {
  Hooks.on("drawToken", (token) => drawBadge(token));
  Hooks.on("refreshToken", (token) => drawBadge(token));
  const onItem = (item) => { if (item.parent?.documentName === "Actor") refreshBadgesFor(item.parent); };
  Hooks.on("updateItem", onItem);
  Hooks.on("createItem", onItem);
  Hooks.on("deleteItem", onItem);
}
