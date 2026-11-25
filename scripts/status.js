/**
 * FE Tactique – états sur les jetons : jetons Bouclier/Ailé/Esprit, blessures, Silence, bonus temporaires.
 * Les compteurs s'affichent avec Status Icon Counters (drapeau flags.statuscounter.value de l'effet).
 */
import { MODULE_ID, STATUS } from "./config.js";
import { activeGM } from "./socket.js";

export function registerStatusEffects() {
  const list = CONFIG.statusEffects ?? [];
  for (const s of Object.values(STATUS)) {
    if (list.some(e => e.id === s.id)) continue;
    list.push({ id: s.id, name: s.name, img: s.img });
  }
  CONFIG.statusEffects = list;
}

const COUNTED = ["bouclier", "aile", "esprit", "blessure"];

function findStatusEffect(actor, statusId) {
  return actor.effects.find(e => e.statuses?.has?.(statusId));
}

/** Aligne les effets à compteur sur les valeurs de la fiche. */
export async function syncCounters(actor) {
  if (!actor?.system?.props) return;
  const props = actor.system.props;
  for (const key of COUNTED) {
    const s = STATUS[key];
    const value = Math.max(0, Number(props[s.prop] ?? 0) || 0);
    const existing = findStatusEffect(actor, s.id);
    if (value > 0) {
      if (existing) {
        if (existing.getFlag("statuscounter", "value") !== value) {
          await existing.update({ "flags.statuscounter.value": value, "flags.statuscounter.visible": true });
        }
      } else {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name: s.name, img: s.img, statuses: [s.id],
          flags: { statuscounter: { value, visible: true }, [MODULE_ID]: { counter: key } }
        }]);
      }
    } else if (existing) {
      await existing.delete();
    }
  }
}

export function registerStatusHooks() {
  const isSyncUser = () => game.user.id === activeGM()?.id;
  Hooks.on("updateActor", (actor, changes) => {
    if (!isSyncUser()) return;
    const props = changes?.system?.props;
    if (!props) return;
    const keys = COUNTED.map(k => STATUS[k].prop);
    if (keys.some(k => k in props)) syncCounters(actor);
  });
  Hooks.on("createToken", (tokenDoc) => {
    if (isSyncUser() && tokenDoc.actor) syncCounters(tokenDoc.actor);
  });
}

/**
 * Effet temporaire (Silence, bonus, malus).
 * expireCamp : "joueurs" | "ennemis" | "" ; phases : nombre de fins de phase de ce camp avant expiration.
 */
export function timedEffectData({ kind = "bonus", name, bonus = {}, expireCamp = "", phases = 1, origin = "" }) {
  const s = STATUS[kind] ?? STATUS.bonus;
  const parts = Object.entries(bonus).filter(([, v]) => Number(v)).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`);
  return {
    name: name ?? `${s.name}${parts.length ? ` (${parts.join(", ")})` : ""}`,
    img: s.img,
    statuses: [s.id],
    description: expireCamp ? `Expire à la fin de la ${phases > 1 ? `${phases}e ` : ""}phase des ${expireCamp}.` : "",
    flags: { [MODULE_ID]: { bonus, expireCamp, phasesLeft: phases, origin } }
  };
}
