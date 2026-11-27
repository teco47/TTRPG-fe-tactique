/**
 * FE Tactique – exécution des modifications par le MJ.
 * Un joueur n'a pas le droit de modifier les PV d'un ennemi : ses demandes passent par le MJ connecté.
 */
import { MODULE_ID } from "./config.js";
import { handleFloatMessage } from "./floating.js";
import { handleLootMessage } from "./loot.js";

const CHANNEL = `module.${MODULE_ID}`;
const pending = new Map();

/**
 * Opérations :
 *  { op: "update", uuid, data }
 *  { op: "status", uuid (acteur), statusId, active, overlay }
 *  { op: "createEffect", uuid (acteur), data }
 *  { op: "deleteEffect", uuid (effet) }
 */
async function runOperations(ops) {
  for (const o of ops) {
    try {
      if (o.op === "update") {
        const doc = await fromUuid(o.uuid);
        if (doc) await doc.update(o.data);
      } else if (o.op === "status") {
        const actor = await fromUuid(o.uuid);
        if (actor?.toggleStatusEffect) await actor.toggleStatusEffect(o.statusId, { active: o.active, overlay: !!o.overlay });
      } else if (o.op === "createEffect") {
        const actor = await fromUuid(o.uuid);
        if (actor) await actor.createEmbeddedDocuments("ActiveEffect", [o.data]);
      } else if (o.op === "createItems") {
        const actor = await fromUuid(o.uuid);
        if (actor) await actor.createEmbeddedDocuments("Item", o.data);
      } else if (o.op === "delete") {
        const doc = await fromUuid(o.uuid);
        if (doc) await doc.delete();
      } else if (o.op === "deleteEffect") {
        const effect = await fromUuid(o.uuid);
        if (effect) await effect.delete();
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Échec de l'opération`, o, err);
    }
  }
}

function canRunLocally(ops) {
  if (game.user.isGM) return true;
  return ops.every(o => {
    const doc = o.op === "deleteEffect" ? fromUuidSync(o.uuid) : fromUuidSync(o.uuid);
    return doc?.isOwner;
  });
}

export function activeGM() {
  return game.users.activeGM ?? game.users.find(u => u.isGM && u.active) ?? null;
}

/** Applique les opérations, localement si possible, sinon par le MJ. */
export async function applyOperations(ops) {
  if (!ops.length) return;
  if (canRunLocally(ops)) return runOperations(ops);
  const gm = activeGM();
  if (!gm) {
    ui.notifications.error("FE Tactique : aucun MJ connecté pour appliquer le résultat du combat.");
    return;
  }
  const requestId = foundry.utils.randomID();
  const done = new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => { if (pending.delete(requestId)) resolve(false); }, 15000);
  });
  game.socket.emit(CHANNEL, { type: "ops", requestId, gmId: gm.id, ops });
  return done;
}

export function registerSocket() {
  game.socket.on(CHANNEL, async (msg) => {
    if (handleFloatMessage(msg)) return;
    if (handleLootMessage(msg)) return;
    if (msg?.type === "ops" && game.user.id === msg.gmId) {
      await runOperations(msg.ops);
      game.socket.emit(CHANNEL, { type: "done", requestId: msg.requestId });
    } else if (msg?.type === "done") {
      const resolve = pending.get(msg.requestId);
      if (resolve) { pending.delete(msg.requestId); resolve(true); }
    }
  });
}
