/**
 * FE Tactique – nombres flottants au-dessus des jetons (dégâts, critique, raté, soins).
 * Utilise le texte défilant natif de Foundry (canvas.interface.createScrollingText) : aucun module requis.
 * Le texte est diffusé à tous les clients connectés par le socket du module.
 */
import { MODULE_ID } from "./config.js";

const CHANNEL = `module.${MODULE_ID}`;

/** Styles par type de texte. */
export const FLOAT_STYLES = {
  degats:   { fill: "#ffffff", stroke: "#8b0000", fontSize: 40 },
  critique: { fill: "#ffd23f", stroke: "#a00000", fontSize: 60 },
  rate:     { fill: "#c8c8c8", stroke: "#202020", fontSize: 34 },
  soin:     { fill: "#7dff7a", stroke: "#0a4a0a", fontSize: 40 },
  info:     { fill: "#9fdcff", stroke: "#0a2a4a", fontSize: 30 }
};

/** Pure : texte et style d'une attaque du journal de combat. */
export function strikeFloat(strike) {
  if (!strike.hit) return { text: "Raté", kind: "rate" };
  const extra = strike.miracle ? " Miracle !" : "";
  if (strike.crit) return { text: `CRITIQUE ! −${strike.dmg}${extra}`, kind: "critique" };
  return { text: `−${strike.dmg}${extra}`, kind: "degats" };
}

function enabled() {
  try { return game.settings.get(MODULE_ID, "damageNumbers") !== false; } catch (e) { return true; }
}

/** Affiche le texte sur ce client. */
export function showFloatLocal(tokenId, text, kind = "degats") {
  const token = canvas?.tokens?.get(tokenId);
  const iface = canvas?.interface;
  if (!token || !iface?.createScrollingText || !enabled()) return;
  if (token.document.hidden && !game.user.isGM) return;
  const st = FLOAT_STYLES[kind] ?? FLOAT_STYLES.degats;
  try {
    iface.createScrollingText(token.center, text, {
      anchor: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
      direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
      distance: token.h * (kind === "critique" ? 1.1 : 0.8),
      duration: kind === "critique" ? 2600 : 1800,
      fontSize: st.fontSize, fill: st.fill, stroke: st.stroke, strokeThickness: 5,
      jitter: 0.25
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | texte flottant`, err);
  }
}

/** Affiche le texte chez tout le monde. */
export function showFloat(token, text, kind = "degats") {
  const id = token?.id ?? token?.document?.id;
  if (!id) return;
  showFloatLocal(id, text, kind);
  try { game.socket.emit(CHANNEL, { type: "float", sceneId: canvas.scene?.id, tokenId: id, text, kind }); } catch (e) { /* ignore */ }
}

/** Réception d'un texte envoyé par un autre client. */
export function handleFloatMessage(msg) {
  if (msg?.type !== "float" || msg.sceneId !== canvas?.scene?.id) return false;
  showFloatLocal(msg.tokenId, msg.text, msg.kind);
  return true;
}
