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
    const g = canvas.grid.size;
    const rise = crit ? 0.85 : 0.65;            // hauteur du saut, en cases
    const drift = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.15);
    const seq = new Sequence();
    seq.effect()
      .atLocation(token, { offset: { y: -0.15 }, gridUnits: true })
      .text(text, {
        fill: st.fill, stroke: st.stroke, strokeThickness: 6, fontSize: st.fontSize,
        fontFamily: "Signika, sans-serif", fontWeight: "bold", align: "center",
        dropShadow: true, dropShadowColor: "#000000", dropShadowBlur: 4, dropShadowDistance: 2
      })
      .duration(crit ? 2200 : 1600)
      // Jaillit du personnage : grossit d'un coup avec un léger dépassement
      .scaleIn(0.2, 300, { ease: "easeOutBack" })
      // Monte, retombe un peu et rebondit
      .animateProperty("sprite", "position.y", { from: 0, to: -rise * g, duration: 320, ease: "easeOutQuad" })
      .animateProperty("sprite", "position.y", { from: 0, to: 0.3 * g, duration: 650, delay: 320, ease: "easeOutBounce" })
      // Petite dérive de côté
      .animateProperty("sprite", "position.x", { from: 0, to: drift * g, duration: 900, ease: "easeOutQuad" })
      .fadeOut(450)
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

/* ------------------------------------------------------------------ */
/*  Esquive : le jeton fait un pas de côté puis revient               */
/* ------------------------------------------------------------------ */

function animationsOn() {
  try { return game.settings.get(MODULE_ID, "animations_on") !== false; } catch (e) { return true; }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/** Pure : décalage du pas de côté (perpendiculaire à l'attaque), en pixels. */
export function dodgeOffset(from, to, distance, side = 1) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * distance * side, y: (dx / len) * distance * side };
}

/** Déplace l'image du jeton (pas sa position réelle) sur ce client. */
export async function showDodgeLocal(tokenId, fromId) {
  if (!animationsOn()) return;
  const token = canvas?.tokens?.get(tokenId);
  if (!token || (token.document.hidden && !game.user.isGM)) return;
  const from = canvas.tokens.get(fromId)?.center ?? { x: token.center.x - 1, y: token.center.y };
  const off = dodgeOffset(from, token.center, canvas.grid.size * 0.35, Math.random() < 0.5 ? -1 : 1);
  const parts = [token.mesh, token].filter(Boolean);
  const start = parts.map(o => ({ o, x: o.x, y: o.y }));
  const move = async (k, ms, ease) => {
    const t0 = performance.now();
    const from0 = start.map(s => ({ x: s.o.x, y: s.o.y }));
    await new Promise(resolve => {
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / ms);
        const e = ease(p);
        start.forEach((s, i) => {
          if (s.o.destroyed) return;
          s.o.x = from0[i].x + (s.x + off.x * k - from0[i].x) * e;
          s.o.y = from0[i].y + (s.y + off.y * k - from0[i].y) * e;
        });
        if (p < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  };
  try {
    await move(1, 130, p => 1 - (1 - p) * (1 - p));  // pas de côté rapide
    await wait(180);
    await move(0, 220, p => p * p * (3 - 2 * p));     // retour en douceur
  } catch (err) {
    console.warn(`${MODULE_ID} | esquive`, err);
  } finally {
    start.forEach(s => { if (!s.o.destroyed) { s.o.x = s.x; s.o.y = s.y; } });
    try { token.renderFlags?.set({ refreshPosition: true, refreshMesh: true }); } catch (e) { /* ignore */ }
  }
}

/** Esquive visible par tout le monde. */
export function showDodge(token, from) {
  const id = token?.id ?? token?.document?.id;
  if (!id) return;
  const fromId = from?.id ?? from?.document?.id;
  showDodgeLocal(id, fromId);
  try { game.socket.emit(CHANNEL, { type: "dodge", sceneId: canvas.scene?.id, tokenId: id, fromId }); } catch (e) { /* ignore */ }
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
  if (msg?.type !== "float" && msg?.type !== "dodge") return false;
  if (msg.sceneId !== canvas?.scene?.id) return true;
  if (msg.type === "dodge") showDodgeLocal(msg.tokenId, msg.fromId);
  else showFloatLocal(msg.tokenId, msg.text, msg.kind);
  return true;
}
