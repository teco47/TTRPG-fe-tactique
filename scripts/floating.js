/**
 * FE Tactique – nombres flottants au-dessus des jetons (dégâts, critique, raté, soins).
 * Avec Sequencer actif, le texte est un effet texte Sequencer joué localement sur chaque client.
 * Sans Sequencer, repli sur le texte défilant natif de Foundry (canvas.interface.createScrollingText).
 * Dans les deux cas, le texte est diffusé à tous les clients connectés par le socket du module.
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

function sequencerReady() {
  return !!(game.modules.get("sequencer")?.active && globalThis.Sequence);
}

/** Texte via Sequencer (même moteur que les animations de combat). Renvoie false en cas d'échec. */
function floatWithSequencer(token, text, kind, st) {
  try {
    const crit = kind === "critique";
    const seq = new Sequence();
    seq.effect()
      .atLocation(token, { offset: { y: -0.35 }, gridUnits: true })
      .text(text, {
        fill: st.fill, stroke: st.stroke, strokeThickness: 6, fontSize: st.fontSize,
        fontFamily: "Signika, sans-serif", fontWeight: "bold", align: "center",
        dropShadow: true, dropShadowColor: "#000000", dropShadowBlur: 4, dropShadowDistance: 2
      })
      .duration(crit ? 2400 : 1700)
      .fadeIn(120)
      .fadeOut(500)
      .zIndex(100)
      .locally();
    seq.play();
    return true;
  } catch (err) {
    console.warn(`${MODULE_ID} | texte flottant (Sequencer)`, err);
    return false;
  }
}

/** Texte défilant natif de Foundry. */
function floatWithCore(token, text, kind, st) {
  const iface = canvas?.interface;
  if (!iface?.createScrollingText) return false;
  try {
    iface.createScrollingText(token.center, text, {
      anchor: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
      direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
      distance: token.h * (kind === "critique" ? 1.1 : 0.8),
      duration: kind === "critique" ? 2600 : 1800,
      fontSize: st.fontSize, fill: st.fill, stroke: st.stroke, strokeThickness: 5,
      jitter: 0.25
    });
    return true;
  } catch (err) {
    console.warn(`${MODULE_ID} | texte flottant`, err);
    return false;
  }
}

/** Affiche le texte sur ce client. */
export function showFloatLocal(tokenId, text, kind = "degats") {
  if (!enabled()) return;
  const token = canvas?.tokens?.get(tokenId);
  if (!token) { console.debug(`${MODULE_ID} | texte flottant : jeton ${tokenId} introuvable sur la scène affichée`); return; }
  if (token.document.hidden && !game.user.isGM) return;
  const st = FLOAT_STYLES[kind] ?? FLOAT_STYLES.degats;
  const ok = (sequencerReady() && floatWithSequencer(token, text, kind, st)) || floatWithCore(token, text, kind, st);
  console.debug(`${MODULE_ID} | texte flottant "${text}" (${kind}) sur ${token.name} : ${ok ? (sequencerReady() ? "Sequencer" : "Foundry") : "échec"}`);
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
