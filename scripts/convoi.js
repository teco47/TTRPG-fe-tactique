/**
 * FE Tactique – Convoi : acteur partagé qui porte l'inventaire de réserve, l'or et les compteurs de l'équipe.
 * Les objets passent d'une unité au convoi (colonne 📦 de l'inventaire) et du convoi à l'unité sélectionnée (colonne 🎁).
 */
import { MODULE_ID, TEMPLATE_IDS, isConvoi } from "./config.js";
import { applyOperations } from "./socket.js";
import { itemCategory } from "./engine.js";

const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "");

/** Le convoi du monde (le premier trouvé). */
export function findConvoy() {
  return game.actors?.find(a => isConvoi(a) && !a.type.startsWith("_")) ?? null;
}

/** Pure : nouvel or après un gain ou une dépense (jamais négatif). */
export function goldAfter(current, delta) {
  return Math.max(0, Math.floor(Number(current) || 0) + Math.floor(Number(delta) || 0));
}

/** Crée le convoi s'il n'existe pas (MJ). Tous les joueurs en sont propriétaires. */
export async function ensureConvoy({ open = false } = {}) {
  let convoy = findConvoy();
  if (!convoy) {
    if (!game.user.isGM) { ui.notifications.warn("Aucun convoi dans ce monde : le MJ doit le créer (macro « FE – Convoi »)."); return null; }
    const tpl = game.actors.get(TEMPLATE_IDS.convoi);
    if (!tpl) { ui.notifications.error("Modèle « FE – Convoi » introuvable : relance l'installation du module."); return null; }
    const s = tpl.system;
    convoy = await Actor.create({
      name: "Convoi", type: "character", img: "icons/svg/item-bag.svg",
      system: {
        template: tpl.id, templateSystemUniqueVersion: s.templateSystemUniqueVersion,
        header: foundry.utils.deepClone(s.header), body: foundry.utils.deepClone(s.body),
        hidden: foundry.utils.deepClone(s.hidden ?? []), display: foundry.utils.deepClone(s.display),
        attributeBar: {}, initiativeFormula: "", props: { or: 0, chapitre: 1, renommee: 0 }
      },
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: { name: "Convoi", actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY },
      flags: { [MODULE_ID]: { convoi: true } }
    });
    ui.notifications.info("Convoi créé : tous les joueurs peuvent l'ouvrir.");
  }
  if (open) convoy.sheet?.render(true);
  return convoy;
}

/** Macro : ouvre le convoi (le crée au besoin). */
export async function convoyMacro() {
  return ensureConvoy({ open: true });
}

/** Ajoute (ou retire, delta négatif) de l'or au convoi. Renvoie le nouveau total, ou null sans convoi. */
export async function addGold(delta, { reason = "" } = {}) {
  const convoy = findConvoy();
  if (!convoy || !delta) return null;
  const total = goldAfter(convoy.system.props?.or, delta);
  await applyOperations([{ op: "update", uuid: convoy.uuid, data: { "system.props.or": total } }]);
  console.debug(`${MODULE_ID} | or du convoi ${delta > 0 ? "+" : ""}${delta} (${reason}) = ${total}`);
  return total;
}

/** Nombre d'objets du convoi (en-tête de la fiche). */
export function convoyCount(actor) {
  try { return actor.items.filter(i => itemCategory(i)).length; } catch (e) { return ""; }
}

async function moveItem(item, target, { equip = false } = {}) {
  const data = item.toObject();
  delete data._id;
  if (data.system?.props && "equipee" in data.system.props) data.system.props.equipee = equip;
  if (data.system?.props && "equipe" in data.system.props) data.system.props.equipe = false;
  await applyOperations([
    { op: "createItems", uuid: target.uuid, data: [data] },
    { op: "delete", uuid: item.uuid }
  ]);
}

/** Colonne 📦 de l'inventaire d'une unité : envoie l'objet au convoi. */
export async function toConvoy(item) {
  const actor = item?.parent;
  if (!actor || isConvoi(actor)) return;
  const convoy = findConvoy();
  if (!convoy) return ui.notifications.warn("Aucun convoi dans ce monde : le MJ le crée avec la macro « FE – Convoi ».");
  await moveItem(item, convoy);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="fe-chat"><p>${esc(actor.name)} dépose <b>${esc(item.name)}</b> au convoi.</p></div>` });
}

/** Colonne 🎁 du convoi : donne l'objet au jeton sélectionné. */
export async function fromConvoy(item) {
  const convoy = item?.parent;
  if (!convoy || !isConvoi(convoy)) return;
  const actor = canvas?.tokens?.controlled?.map(t => t.actor).find(a => a && !isConvoi(a)) ?? (!game.user.isGM ? game.user.character : null);
  if (!actor) return ui.notifications.warn("Sélectionne d'abord le jeton de l'unité qui reçoit l'objet.");
  if (!actor.isOwner) return ui.notifications.warn(`Tu ne contrôles pas ${actor.name}.`);
  await moveItem(item, actor);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="fe-chat"><p>${esc(actor.name)} prend <b>${esc(item.name)}</b> dans le convoi.</p></div>` });
}
