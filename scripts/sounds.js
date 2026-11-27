/**
 * FE Tactique – sons de combat et d'événements.
 * Joués pour tous les joueurs (AudioHelper diffusé), sur le canal d'interface de Foundry.
 * Fichiers dans assets/sounds/ ; remplaçables par le réglage « Sons personnalisés (JSON) ».
 */
import { MODULE_ID, MODULE_PATH } from "./config.js";

const S = (f) => `${MODULE_PATH}/assets/sounds/${f}`;

/** Sons par défaut : une liste = un fichier tiré au hasard. */
export const DEFAULT_SOUNDS = {
  touche: [S("touche-210.ogg"), S("touche-211.ogg"), S("touche-212.ogg")],
  critique: [S("critique.ogg")],
  rate: [S("rate.ogg")],
  arme_brisee: [S("arme-brisee.ogg")],
  mort: [S("mort.ogg")],
  niveau: [S("niveau.ogg")],
  coffre: [S("coffre.ogg")]
};

/** Pure : quel son pour une attaque du journal de combat. */
export function strikeSound(strike) {
  if (!strike?.hit) return "rate";
  return strike.crit ? "critique" : "touche";
}

function soundTable() {
  let custom = {};
  try { custom = JSON.parse(game.settings.get(MODULE_ID, "sounds") || "{}"); } catch (e) { /* JSON invalide : ignoré */ }
  return { ...DEFAULT_SOUNDS, ...custom };
}

/** Joue un son chez tout le monde. kind : touche, critique, rate, arme_brisee, mort, niveau, coffre (ou un chemin). */
export function playSound(kind, { volume } = {}) {
  try {
    if (!game.settings.get(MODULE_ID, "sounds_on")) return;
    const list = [].concat(soundTable()[kind] ?? (String(kind).includes("/") ? kind : []));
    if (!list.length) return;
    const src = list[Math.floor(Math.random() * list.length)];
    const vol = volume ?? Number(game.settings.get(MODULE_ID, "soundVolume") ?? 0.7);
    const AH = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    AH.play({ src, volume: vol, autoplay: true, loop: false, channel: "interface" }, true);
  } catch (err) {
    console.warn(`${MODULE_ID} | son ${kind}`, err);
  }
}
