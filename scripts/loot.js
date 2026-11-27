/**
 * FE Tactique – macro Loot.
 * Le MJ glisse des objets (barre latérale ou compendium) dans une fenêtre, règle les quantités et un message
 * de présentation. Le message de chat porte un bouton : le premier joueur qui clique donne le butin au jeton
 * qu'il a sélectionné. Le MJ connecté crée les objets (un seul gagnant, même si deux joueurs cliquent).
 */
import { MODULE_ID } from "./config.js";
import { playSound } from "./sounds.js";
import { activeGM } from "./socket.js";
import { addGold } from "./convoi.js";

const CHANNEL = `module.${MODULE_ID}`;
const DialogV2 = () => foundry.applications.api.DialogV2;
const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "");

/** Présentations prêtes à l'emploi. */
export const LOOT_PRESETS = {
  coffre:    { label: "Coffre",            title: "Un coffre !",           text: "Le couvercle grince et s'ouvre. À l'intérieur, vous trouvez :" },
  ennemi:    { label: "Ennemi vaincu",     title: "Butin",                 text: "L'ennemi vaincu laisse tomber quelque chose :" },
  village:   { label: "Village visité",    title: "Les villageois vous remercient", text: "Pour vous remercier de votre visite, les habitants vous offrent :" },
  sol:       { label: "Trouvaille",        title: "Une trouvaille",        text: "En fouillant les environs, vous découvrez :" },
  recompense:{ label: "Récompense",        title: "Récompense",            text: "Pour services rendus, vous recevez :" },
  marchand:  { label: "Cadeau d'un marchand", title: "Un marchand généreux", text: "Le marchand vous glisse un paquet avec un clin d'œil :" },
  perso:     { label: "Personnalisé",      title: "",                      text: "" }
};

/** Pure : liste lisible d'un butin. */
export function lootSummary(items, gold = 0) {
  const parts = items.filter(i => i.qty > 0).map(i => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name));
  if (gold > 0) parts.push(`${gold} or`);
  return parts.join(", ");
}

/** Pure : ajoute un objet à la liste ou augmente sa quantité. */
export function addLootItem(items, entry) {
  const found = items.find(i => i.uuid === entry.uuid);
  if (found) found.qty += 1;
  else items.push({ uuid: entry.uuid, name: entry.name, img: entry.img, qty: 1 });
  return items;
}

function lootListHtml(items, gold) {
  const rows = items.filter(i => i.qty > 0).map(i =>
    `<li><img src="${esc(i.img)}" alt=""><span>${esc(i.name)}</span>${i.qty > 1 ? `<b>×${i.qty}</b>` : ""}</li>`).join("");
  const g = gold > 0 ? `<li><i class="fa-solid fa-coins"></i><span>${gold} or</span></li>` : "";
  return `<ul class="fe-loot-list">${rows}${g}</ul>`;
}

/* ------------------------------------------------------------------ */
/*  Fenêtre du MJ                                                      */
/* ------------------------------------------------------------------ */

function dialogContent() {
  const opts = Object.entries(LOOT_PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join("");
  const p = LOOT_PRESETS.coffre;
  return `
  <div class="fe-loot-root">
    <div class="form-group"><label>Présentation</label><select name="preset">${opts}</select></div>
    <div class="form-group"><label>Titre</label><input type="text" name="title" value="${esc(p.title)}"></div>
    <div class="form-group stacked"><label>Message</label><textarea name="text" rows="3">${esc(p.text)}</textarea></div>
    <div class="fe-loot-drop">
      <p class="fe-loot-hint"><i class="fa-solid fa-hand-holding-box"></i> Glisse ici des objets depuis la barre latérale ou un compendium.</p>
      <table class="fe-loot-table"><tbody></tbody></table>
    </div>
    <div class="form-group"><label>Or</label><input type="number" name="gold" value="0" min="0" step="1"></div>
    <input type="hidden" name="items" value="[]">
  </div>`;
}

function dragData(event) {
  try {
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    const d = TE?.getDragEventData?.(event);
    if (d && Object.keys(d).length) return d;
  } catch (e) { /* ignore */ }
  try { return JSON.parse(event.dataTransfer.getData("text/plain")); } catch (e) { return null; }
}

/** Macro : ouvre la fenêtre de butin (MJ). */
export async function lootMacro() {
  if (!game.user.isGM) return ui.notifications.warn("La macro Loot est réservée au MJ.");
  const items = [];
  let bound = false;

  const bind = (root) => {
    if (bound || !root) return;
    const el = root instanceof HTMLElement ? root : root[0];
    if (!el?.querySelector?.(".fe-loot-root")) return;
    bound = true;
    const tbody = el.querySelector(".fe-loot-table tbody");
    const hidden = el.querySelector('input[name="items"]');
    const drop = el.querySelector(".fe-loot-drop");
    const refresh = () => {
      tbody.innerHTML = items.map((i, n) => `
        <tr data-n="${n}">
          <td><img src="${esc(i.img)}" alt="" width="28" height="28"></td>
          <td class="fe-loot-name">${esc(i.name)}</td>
          <td><input type="number" class="fe-loot-qty" value="${i.qty}" min="1" step="1"></td>
          <td><a class="fe-loot-del" title="Retirer"><i class="fa-solid fa-trash"></i></a></td>
        </tr>`).join("");
      hidden.value = JSON.stringify(items);
      el.querySelector(".fe-loot-hint").style.display = items.length ? "none" : "";
    };
    el.querySelector('select[name="preset"]').addEventListener("change", (ev) => {
      const p = LOOT_PRESETS[ev.target.value];
      if (!p || ev.target.value === "perso") return;
      el.querySelector('input[name="title"]').value = p.title;
      el.querySelector('textarea[name="text"]').value = p.text;
    });
    drop.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      drop.classList.remove("over");
      const data = dragData(ev);
      if (data?.type !== "Item" || !data.uuid) return ui.notifications.warn("Glisse un objet (Item).");
      const item = await fromUuid(data.uuid);
      if (!item) return;
      addLootItem(items, { uuid: item.uuid, name: item.name, img: item.img });
      refresh();
    });
    tbody.addEventListener("change", (ev) => {
      if (!ev.target.classList.contains("fe-loot-qty")) return;
      const n = Number(ev.target.closest("tr").dataset.n);
      items[n].qty = Math.max(1, Math.floor(Number(ev.target.value) || 1));
      hidden.value = JSON.stringify(items);
    });
    tbody.addEventListener("click", (ev) => {
      const del = ev.target.closest(".fe-loot-del");
      if (!del) return;
      items.splice(Number(del.closest("tr").dataset.n), 1);
      refresh();
    });
    refresh();
  };
  const hookId = Hooks.once("renderDialogV2", (app, element) => bind(element ?? app.element));

  const result = await DialogV2().wait({
    window: { title: "Loot", icon: "fa-solid fa-gem" },
    classes: ["fe-loot-dialog"],
    position: { width: 520 },
    content: dialogContent(),
    buttons: [
      {
        action: "ok", label: "Envoyer dans le chat", icon: "fa-solid fa-paper-plane", default: true,
        callback: (event, button) => {
          const f = button.form.elements;
          return { title: f.title.value, text: f.text.value, gold: Math.max(0, Math.floor(Number(f.gold.value) || 0)), items: JSON.parse(f.items.value || "[]") };
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" }
    ],
    render: (event, dialog) => bind(dialog?.element ?? event?.target?.element),
    rejectClose: false
  }).catch(() => null);
  Hooks.off("renderDialogV2", hookId);

  if (!result || typeof result !== "object") return;
  if (!result.items.length && !result.gold) return ui.notifications.warn("Butin vide : glisse au moins un objet ou indique de l'or.");
  return postLootMessage(result);
}

/* ------------------------------------------------------------------ */
/*  Message de chat et récupération                                    */
/* ------------------------------------------------------------------ */

export async function postLootMessage({ title, text, gold, items }) {
  const content = `
  <div class="fe-chat fe-loot">
    ${title ? `<h3><i class="fa-solid fa-gem"></i> ${esc(title)}</h3>` : ""}
    ${text ? `<p>${esc(text).replace(/\n/g, "<br>")}</p>` : ""}
    ${lootListHtml(items, gold)}
    <div class="fe-loot-action"><button type="button" class="fe-loot-claim"><i class="fa-solid fa-hand"></i> Récupérer (jeton sélectionné)</button></div>
  </div>`;
  return ChatMessage.create({
    speaker: { alias: title || "Butin" },
    content,
    flags: { [MODULE_ID]: { loot: { title, text, gold, items, claimedBy: null } } }
  });
}

/** Branche le bouton des messages de butin : un seul écouteur délégué, valable pour tous les messages. */
export function registerLootHooks() {
  globalThis.document?.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.(".fe-loot-claim");
    if (!btn) return;
    ev.preventDefault();
    const id = btn.closest("[data-message-id]")?.dataset.messageId;
    const message = id ? game.messages.get(id) : null;
    const loot = message?.getFlag(MODULE_ID, "loot");
    if (!loot) return;
    if (loot.claimedBy) return ui.notifications.info(`Ce butin a déjà été récupéré par ${loot.claimedBy}.`);
    requestClaim(message);
  });
}

function requestClaim(message) {
  const token = canvas?.tokens?.controlled?.[0];
  const actor = token?.actor ?? (!game.user.isGM ? game.user.character : null);
  if (!actor) return ui.notifications.warn("Sélectionne d'abord le jeton de l'unité qui récupère le butin.");
  if (!actor.isOwner) return ui.notifications.warn(`Tu ne contrôles pas ${actor.name}.`);
  const data = { messageId: message.id, actorUuid: actor.uuid, userId: game.user.id };
  if (game.user.isGM) return runClaim(data);
  const gm = activeGM();
  if (!gm) return ui.notifications.error("Aucun MJ connecté pour distribuer le butin.");
  game.socket.emit(CHANNEL, { type: "lootClaim", gmId: gm.id, ...data });
}

/** Côté MJ : distribue le butin au premier qui le demande. */
export async function runClaim({ messageId, actorUuid, userId }) {
  const message = game.messages.get(messageId);
  const loot = message?.getFlag(MODULE_ID, "loot");
  if (!loot) return;
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  const user = game.users.get(userId);
  if (loot.claimedBy) {
    if (user && user.id !== game.user.id) game.socket.emit(CHANNEL, { type: "lootTaken", userId, by: loot.claimedBy });
    else ui.notifications.info(`Ce butin a déjà été récupéré par ${loot.claimedBy}.`);
    return;
  }
  // Réserve d'abord le butin, pour qu'un second clic ne le donne pas deux fois
  await message.update({ [`flags.${MODULE_ID}.loot.claimedBy`]: actor.name });

  const created = [], missing = [];
  const toCreate = [];
  for (const entry of loot.items) {
    const src = await fromUuid(entry.uuid);
    if (!src) { missing.push(entry.name); continue; }
    const data = src.toObject();
    delete data._id;
    if (data.system?.props && "equipee" in data.system.props) data.system.props.equipee = false;
    for (let i = 0; i < Math.max(1, entry.qty); i++) toCreate.push(foundry.utils.deepClone(data));
    created.push(entry);
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);

  const newContent = message.content.replace(
    /<div class="fe-loot-action">[\s\S]*?<\/div>/,
    `<div class="fe-loot-action fe-loot-done"><i class="fa-solid fa-check"></i> Récupéré par ${esc(actor.name)}</div>`
  );
  await message.update({ content: newContent });

  playSound("coffre");
  const total = loot.gold > 0 ? await addGold(loot.gold, { reason: "butin" }) : null;
  const got = lootSummary(created, loot.gold);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fe-chat fe-loot-got"><p><b>${esc(actor.name)}</b> obtient : ${esc(got) || "rien"}.</p>
      ${loot.gold > 0 ? (total !== null ? `<p class="fe-sub">+${loot.gold} or au convoi (total : ${total} or).</p>` : `<p class="fe-sub">Pas de convoi dans ce monde : l'or (${loot.gold}) est à noter par le MJ.</p>`) : ""}
      ${missing.length ? `<p class="fe-sub">Introuvables (supprimés ?) : ${esc(missing.join(", "))}.</p>` : ""}</div>`
  });
}

/** Réception socket. Renvoie true si le message concernait le butin. */
export function handleLootMessage(msg) {
  if (msg?.type === "lootClaim") {
    if (game.user.id === msg.gmId) runClaim(msg);
    return true;
  }
  if (msg?.type === "lootTaken") {
    if (game.user.id === msg.userId) ui.notifications.info(`Ce butin a déjà été récupéré par ${msg.by}.`);
    return true;
  }
  return false;
}
