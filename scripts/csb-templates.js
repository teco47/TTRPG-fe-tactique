/**
 * FE Tactique – définition des modèles Custom System Builder (format CSB 6.x).
 * Ces objets sont créés tels quels par l'installeur du module, et exportés dans
 * data/fe-tactique-csb-templates.json pour un import manuel (Paramètres > CSB > Importer les modèles).
 */
import { TEMPLATE_IDS, TEMPLATE_NAMES, WEAPON_TYPES, RANKS, PROFILES, STAT_LABELS } from "./config.js";

const API = "game.modules.get('fe-tactique')?.api";

/* ------------------------------------------------------------------ */
/*  Fabriques de composants                                            */
/* ------------------------------------------------------------------ */
const base = (key, type, extra = {}) => ({
  key, type, cssClass: "", role: 0, permission: 0, editRole: 0, tooltip: "",
  visibilityFormula: "", editableFormula: "", escapeHTML: false, colSpan: 1, rowSpan: 1, ...extra
});
const panel = (key, contents, { flow = "vertical", title = "", align = "left", cssClass = "", collapsible = false } = {}) =>
  base(key, "panel", { contents, flow, align, verticalAlign: "top", collapsible, defaultCollapsed: false, title, titleStyle: title ? "title" : "default", cssClass });
const label = (key, value, { style = "label", size = "full-size", prefix = "", suffix = "", tooltip = "", rollMessage = "", toChat = false, cssClass = "" } = {}) =>
  base(key, "label", { value, style, size, prefix, suffix, tooltip, icon: "", rollMessage, altRollMessage: "", rollMessageToChat: toChat, altRollMessageToChat: false, cssClass });
const title = (text) => label("", text, { style: "subtitle" });
const number = (key, text, { def = 0, min = "", max = "", size = "small", controls = false, tooltip = "" } = {}) =>
  base(key, "numberField", {
    label: text, defaultValue: String(def), size, minVal: String(min), maxVal: String(max), allowDecimal: false,
    allowRelative: true, showControls: controls, controlsStyle: "hover", inputStyle: "text", tooltip
  });
const text = (key, textLabel, { def = "", size = "full-size" } = {}) =>
  base(key, "textField", { label: textLabel, defaultValue: def, size, charList: "", maxLength: null, autocomplete: false });
const select = (key, textLabel, options, { def, size = "medium" } = {}) =>
  base(key, "select", {
    label: textLabel, defaultValue: def ?? options[0][0], size, selectedOptionType: "custom",
    options: options.map(([k, v]) => ({ key: k, value: v }))
  });
const checkbox = (key, textLabel, def = false) => base(key, "checkbox", { label: textLabel, defaultChecked: def });
const textArea = (key, textLabel) => base(key, "textArea", { label: textLabel, defaultValue: "", style: "sheet", size: "full-size" });
const tabs = (key, list) => base(key, "tabbedPanel", { contents: list.map(([k, name, contents]) => base(k, "tab", { name, contents })) });
const col = (key, colName, value, extra = {}) => ({ ...label(key, value, extra), align: "center", colName });
const itemContainer = (key, titleText, templates, columns, extra = {}) =>
  base(key, "itemContainer", {
    title: titleText, hideEmpty: false, hiddenColumns: [], sortOption: "manual", headDisplay: true,
    showCreate: false, showDelete: true, statusIcon: false, nameAlign: "left", nameLabel: "Nom",
    templateFilter: templates, itemFilterFormula: "", sortPredicates: [],
    rowLayout: columns, head: true, deleteWarning: true, labelWhenEmpty: "Aucun", contents: [], ...extra
  });

/** Valeur calculée par le moteur du module pour la fiche. */
const sheetValue = (stat) => `%{return ${API}?.sheet(entity, '${stat}') ?? '?'}%`;
/** Colonne d'un objet calculée par le module. */
const itemValue = (field) => `%{return ${API}?.itemLabel(linkedEntity, '${field}') ?? ''}%`;

const rankOptions = RANKS.map(r => [r, r]);
const typeOptions = (filter) => Object.entries(WEAPON_TYPES).filter(([k, v]) => filter(k, v)).map(([k, v]) => [k, v.label]);

/* ------------------------------------------------------------------ */
/*  Modèle d'acteur : Unité                                            */
/* ------------------------------------------------------------------ */
function uniteTemplate() {
  const statRow = (s) => [
    number(`base_${s}`, STAT_LABELS[s], { def: s === "pv" ? 10 : 5, min: 0 }),
    s === "pv" ? label(`eff_${s}`, sheetValue("pv_max"), { size: "small", prefix: "→ " })
               : label(`eff_${s}`, sheetValue(s), { size: "small", prefix: "→ ", tooltip: "Valeur utilisée en combat (blessures, traits, bonus, plafond 50)" }),
    number(`des_${s}`, "Dés", { def: 1, min: 0, max: 12 })
  ];

  const header = panel("custom_header", [
    panel("fe_head_id", [
      text("classe", "Classe", { def: "" }),
      number("niveau", "Niveau", { def: 1, min: 1, max: 40 }),
      number("exp", "EXP", { def: 0, min: 0, max: 99 }),
      number("pm", "PM", { def: 5, min: 0 })
    ], { flow: "grid-4" }),
    panel("fe_head_hp", [
      number("pv", "PV", { def: 10, min: 0, max: "${pv_max}$", size: "small", controls: true }),
      label("pv_max", sheetValue("pv_max"), { prefix: "/ ", size: "small" }),
      number("blessures", "Blessures", { def: 0, min: 0, max: 4, controls: true }),
      label("malus_blessure", sheetValue("malus"), { prefix: "Malus −", size: "small" })
    ], { flow: "grid-4" }),
    panel("fe_head_role", [
      select("role", "Rôle", [["secondaire", "Personnage secondaire"], ["principal", "Personnage principal"]]),
      select("palier", "Palier de classe", [["1", "I (base)"], ["2", "II (avancée)"], ["3", "III / élite"]]),
      select("profil", "Déplacement", Object.entries(PROFILES)),
      text("tags", "Mots-clés (dragon…)", { def: "" })
    ], { flow: "grid-4" })
  ], { flow: "vertical" });

  const combat = panel("fe_combat", [
    title("Combat (arme équipée, hors terrain et triangle)"),
    panel("fe_combat_grid", [
      label("arme_equipee", sheetValue("weapon"), { prefix: "Arme : " }),
      label("portee", sheetValue("portee"), { prefix: "Portée : " }),
      label("vit_att", sheetValue("vit_att"), { prefix: "Vit. d'attaque : " }),
      label("attaque", sheetValue("atq"), { prefix: "Attaque : " }),
      label("precision", sheetValue("prec"), { prefix: "Précision : " }),
      label("esquive", sheetValue("esq"), { prefix: "Esquive : " }),
      label("critique", sheetValue("crit"), { prefix: "Critique : " }),
      label("esq_crit", sheetValue("esq_crit"), { prefix: "Esq. critique : " })
    ], { flow: "grid-4" }),
    title("Bonus manuels (soutiens, effets du MJ)"),
    panel("fe_bonus", [
      number("bon_prec", "Préc"), number("bon_esq", "Esq"), number("bon_crit", "Crit"),
      number("bon_atq", "Atq"), number("bon_def", "Déf/Rés")
    ], { flow: "grid-5" }),
    title("Jetons (0 à 10, remis à zéro à chaque chapitre)"),
    panel("fe_jetons", [
      number("jet_bouclier", "Bouclier", { min: 0, max: 10, controls: true }),
      number("jet_aile", "Ailé", { min: 0, max: 10, controls: true }),
      number("jet_esprit", "Esprit", { min: 0, max: 10, controls: true })
    ], { flow: "grid-3" }),
    itemContainer("inv_armes", "Armes, tomes et sceptres",
      [TEMPLATE_IDS.arme, TEMPLATE_IDS.tome, TEMPLATE_IDS.sceptre], [
        col("c_eq", "Équipée", itemValue("equip"), { rollMessage: `%{${API}?.toggleEquip(linkedEntity); return '';}%`, tooltip: "Cliquer pour équiper" }),
        col("c_type", "Type", itemValue("type")),
        col("c_rang", "Rang", itemValue("rang")),
        col("c_pui", "Pui", itemValue("pui")),
        col("c_prec", "Préc", itemValue("prec")),
        col("c_crit", "Crit", itemValue("crit")),
        col("c_poids", "Poids", itemValue("poids")),
        col("c_por", "Portée", itemValue("portee")),
        col("c_dur", "Dur.", itemValue("dur"))
      ])
  ]);

  const stats = panel("fe_stats", [
    title("Statistiques (valeur de base · valeur en combat · dés de progression)"),
    panel("fe_stats_grid", ["pv", "for", "mag", "def", "res", "tech", "vit"].flatMap(statRow), { flow: "grid-3" }),
    panel("fe_mvt", [number("base_mvt", "Mouvement", { def: 5, min: 0 })], { flow: "grid-3" }),
    title("Rangs d'arme"),
    panel("fe_rangs", Object.entries(WEAPON_TYPES).map(([k, v]) =>
      select(`rang_${k}`, v.label, rankOptions, { def: "E", size: "small" })), { flow: "grid-4" })
  ]);

  const traits = panel("fe_traits", [
    label("slots", sheetValue("slots_text"), { prefix: "Emplacements équipés : " }),
    itemContainer("traits", "Traits", [TEMPLATE_IDS.trait], [
      col("t_eq", "Équipé", itemValue("equip"), { rollMessage: `%{${API}?.toggleEquip(linkedEntity); return '';}%`, tooltip: "Cliquer pour équiper" }),
      col("t_prix", "Prix", itemValue("prix")),
      { ...col("t_effet", "Effet", itemValue("effet")), align: "left" }
    ])
  ]);

  const inventaire = panel("fe_inv", [
    itemContainer("inv_objets", "Objets", [TEMPLATE_IDS.objet], [
      col("o_uses", "Utilisations", itemValue("uses")),
      { ...col("o_effet", "Effet", itemValue("effet")), align: "left" },
      col("o_use", "", "Utiliser", { style: "button", rollMessage: `%{${API}?.useObject(linkedEntity); return '';}%` })
    ]),
    textArea("notes", "Notes")
  ]);

  const body = panel("custom_body", [
    tabs("fe_tabs", [
      ["tab_combat", "Combat", [combat]],
      ["tab_stats", "Stats", [stats]],
      ["tab_traits", "Traits", [traits]],
      ["tab_inv", "Inventaire", [inventaire]]
    ])
  ]);

  return {
    id: TEMPLATE_IDS.unite, type: "_template", name: TEMPLATE_NAMES.unite,
    data: {
      header, body, hidden: [], attributeBar: {},
      display: { width: 760, height: 760, fix_size: false, pp_width: 100, pp_height: 100 },
      initiativeFormula: ""
    },
    flags: {}
  };
}

/* ------------------------------------------------------------------ */
/*  Modèles d'objets                                                   */
/* ------------------------------------------------------------------ */
function itemTemplate(cat, headerContents, bodyContents) {
  return {
    id: TEMPLATE_IDS[cat], type: "_equippableItemTemplate", name: TEMPLATE_NAMES[cat],
    data: {
      header: panel("custom_header", headerContents, { flow: "grid-3" }),
      body: panel("custom_body", bodyContents),
      hidden: [],
      display: { width: 560, height: 520, fix_size: false, pp_width: 64, pp_height: 64 }
    },
    flags: {}
  };
}

function weaponBody(magic) {
  return [
    panel("fe_w_stats", [
      number("pui", "Puissance"), number("prec", "Précision", { def: 80 }), number("crit", "Critique"),
      checkbox("sans_crit", "Pas de critique (Bronze)"), number("poids", "Poids"),
      number("por_min", "Portée min", { def: 1, min: 0 }), number("por_max", "Portée max", { def: magic ? 2 : 1, min: 0 }),
      number("dur", "Durabilité", { def: 40, min: 0, controls: true }), number("dur_max", "Durabilité max", { def: 40, min: 0 }),
      number("prix", "Prix (or)", { def: 0, min: 0 })
    ], { flow: "grid-3" }),
    panel("fe_w_special", [
      text("efficace", "Efficace contre (mots-clés)", { def: "" }),
      select("special", "Effet spécial", [["aucun", "Aucun"], ["luna", "Ignore la Résistance"], ["nosferatu", "Rend les dégâts en PV"], ["eclipse", "Réduit les PV de moitié"]]),
      checkbox("sans_riposte", "Empêche la riposte"),
      number("bonus_esq", "Bonus Esquive"), number("bonus_res", "Bonus Rés"),
      checkbox("equipee", "Équipée")
    ], { flow: "grid-3" }),
    text("effet", "Description", { def: "" })
  ];
}

function armeTemplate() {
  return itemTemplate("arme", [
    select("type_arme", "Type", typeOptions((k, v) => !v.magic)),
    select("rang_req", "Rang", rankOptions.concat([["Perso", "Perso"]]), { def: "E" })
  ], weaponBody(false));
}

function tomeTemplate() {
  return itemTemplate("tome", [
    select("type_arme", "École", typeOptions((k, v) => v.magic && k !== "sceptre")),
    select("rang_req", "Rang", rankOptions.concat([["Perso", "Perso"]]), { def: "E" })
  ], weaponBody(true));
}

function sceptreTemplate() {
  return itemTemplate("sceptre", [
    select("rang_req", "Rang", rankOptions, { def: "E" }),
    select("effet_sceptre", "Effet", [["soin", "Soin (base + Mag/2)"], ["recouvrement", "Soin complet"], ["silence", "Silence"], ["autre", "Autre (manuel)"]])
  ], [
    panel("fe_s_stats", [
      number("soin_base", "Soin de base", { def: 10, min: 0 }),
      number("por_min", "Portée min", { def: 1, min: 0 }), number("por_max", "Portée max", { def: 1, min: 0 }),
      number("dur", "Durabilité", { def: 20, min: 0, controls: true }), number("dur_max", "Durabilité max", { def: 20, min: 0 }),
      number("prix", "Prix (or)", { def: 0, min: 0 }),
      checkbox("equipee", "Équipé")
    ], { flow: "grid-3" }),
    text("effet", "Description", { def: "" })
  ]);
}

function objetTemplate() {
  return itemTemplate("objet", [
    select("effet_objet", "Effet", [["soin", "Soin"], ["cle", "Clé"], ["booster", "Booster"], ["magister", "Magister"], ["autre", "Autre (manuel)"]]),
    number("valeur", "Valeur", { def: 0 })
  ], [
    panel("fe_o_stats", [
      number("uses", "Utilisations", { def: 1, min: 0, controls: true }), number("uses_max", "Utilisations max", { def: 1, min: 0 }),
      number("prix", "Prix (or)", { def: 0, min: 0 })
    ], { flow: "grid-3" }),
    text("effet", "Description", { def: "" })
  ]);
}

function traitTemplate() {
  return itemTemplate("trait", [
    text("classes", "Classe(s)", { def: "" }),
    number("prix_pm", "Prix (PM)", { def: 2, min: 0 }),
    select("type_trait", "Automatisation", [["manuel", "Manuel (le MJ applique)"], ["auto", "Automatique"], ["boost", "Boost"], ["jetons", "Génère des jetons"]])
  ], [
    panel("fe_t_boost", [
      select("boost_stat", "Stat du Boost", [["aucun", "—"], ["pv", "PV"], ["for", "Force"], ["mag", "Magie"], ["def", "Défense"], ["res", "Résistance"], ["tech", "Technique"], ["vit", "Vitesse"], ["prec", "Précision"], ["esq", "Esquive"], ["crit", "Critique"]]),
      number("boost_val", "Valeur", { def: 0 }),
      checkbox("equipe", "Équipé")
    ], { flow: "grid-3" }),
    text("effet", "Effet", { def: "" })
  ]);
}

export function buildTemplates() {
  return {
    isCustomSystemExport: true,
    actors: [uniteTemplate()],
    items: [armeTemplate(), tomeTemplate(), sceptreTemplate(), objetTemplate(), traitTemplate()]
  };
}
