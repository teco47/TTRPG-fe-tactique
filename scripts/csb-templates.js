/**
 * FE Tactique – définition des modèles Custom System Builder (format CSB 6.x).
 * Ces objets sont créés tels quels par l'installeur du module, et exportés dans
 * data/fe-tactique-csb-templates.json pour un import manuel (Paramètres > CSB > Importer les modèles).
 */
import { TEMPLATE_IDS, TEMPLATE_NAMES, WEAPON_TYPES, RANKS, PROFILES, STAT_LABELS, STATS } from "./config.js";

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
/*  Tableaux                                                           */
/* ------------------------------------------------------------------ */
/** Tableau CSB : rows = tableau de lignes de composants (null = case vide), layout = alignement par colonne (l/c/r). */
const table = (key, rows, { layout = null, cssClass = "fe-table" } = {}) => {
  const cols = Math.max(...rows.map(r => r.length));
  return base(key, "table", {
    cols, rows: rows.length, layout: layout ?? "l" + "c".repeat(cols - 1), cssClass,
    contents: rows.map(r => Array.from({ length: cols }, (_, i) => r[i] ?? null))
  });
};
/** En-tête de colonne. */
const th = (text) => label("", text, { style: "bold", cssClass: "fe-th" });
/** Valeur calculée mise en avant. */
const val = (key, stat, extra = {}) => label(key, sheetValue(stat), { cssClass: "fe-val", ...extra });
const status = (name) => `<img class="fe-ico" src="modules/fe-tactique/assets/status/${name}.svg">`;
const wicon = (type) => `<img class="fe-ico" src="modules/fe-tactique/assets/icons/${WEAPON_TYPES[type].icon}">`;
const meter = (key, value, max) => base(key, "meter", {
  label: "", value, min: "0", max, low: `\${${max.slice(2, -2)} * 0.34}$`, high: `\${${max.slice(2, -2)} * 0.67}$`,
  optimum: max, textOption: "showMax", cssClass: "fe-meter"
});

/* ------------------------------------------------------------------ */
/*  Modèle d'acteur : Unité                                            */
/* ------------------------------------------------------------------ */
function uniteTemplate() {
  const header = panel("custom_header", [
    table("fe_head", [
      [th("Classe"), th("Niveau"), th("EXP"), th("PM"), th("PV"), th("Blessures")],
      [
        val("classe_nom", "classe", { tooltip: "Glisse un objet Classe sur la fiche pour la changer" }),
        number("niveau", "", { def: 1, min: 1, max: 40 }),
        number("exp", "", { def: 0, min: 0, max: 99 }),
        number("pm", "", { def: 5, min: 0 }),
        panel("fe_head_pv", [
          number("pv", "", { def: 10, min: 0, max: "${pv_max}$", controls: true }),
          label("pv_max", sheetValue("pv_max"), { prefix: "/ ", size: "small" })
        ], { flow: "grid-2" }),
        panel("fe_head_bl", [
          number("blessures", "", { def: 0, min: 0, max: 4, controls: true }),
          label("malus_blessure", sheetValue("malus"), { prefix: "malus −", size: "small", tooltip: "Malus à toutes les stats par blessure" })
        ], { flow: "grid-2" })
      ]
    ], { layout: "cccccc", cssClass: "fe-table fe-head" }),
    meter("", "${pv}$", "${pv_max}$"),
    label("a_attribuer", sheetValue("a_attribuer"), { cssClass: "fe-todo" })
  ], { flow: "vertical" });

  const combat = panel("fe_combat", [
    title("Prévision (arme équipée, hors terrain et triangle)"),
    table("fe_prev", [
      [th("Arme"), th("Portée"), th("Atq"), th("Préc"), th("Crit"), th("Esq"), th("Vit. att."), th("Esq. crit")],
      [val("arme_equipee", "weapon"), val("portee", "portee"), val("attaque", "atq"), val("precision", "prec"),
       val("critique", "crit"), val("esquive", "esq"), val("vit_att", "vit_att"), val("esq_crit", "esq_crit")]
    ]),
    title("Jetons (0 à 10, remis à zéro à chaque chapitre)"),
    table("fe_jetons", [
      [th(`${status("bouclier")} Bouclier`), th(`${status("aile")} Ailé`), th(`${status("esprit")} Esprit`)],
      [number("jet_bouclier", "", { def: 0, min: 0, max: 10, controls: true }),
       number("jet_aile", "", { def: 0, min: 0, max: 10, controls: true }),
       number("jet_esprit", "", { def: 0, min: 0, max: 10, controls: true })]
    ], { layout: "ccc" }),
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
      ]),
    panel("fe_bonus_panel", [
      table("fe_bonus", [
        [th("Préc"), th("Esq"), th("Crit"), th("Atq"), th("Déf/Rés")],
        [number("bon_prec", "", { def: 0 }), number("bon_esq", "", { def: 0 }), number("bon_crit", "", { def: 0 }),
         number("bon_atq", "", { def: 0 }), number("bon_def", "", { def: 0 })]
      ], { layout: "ccccc" })
    ], { title: "Bonus manuels (soutiens, effets du MJ)", collapsible: true })
  ]);

  const statRow = (s) => [
    th(STAT_LABELS[s]),
    number(`base_${s}`, "", { def: s === "pv" ? 10 : 5, min: 0, tooltip: "Base du personnage : 10 PV / 5, plus points libres et Boosters" }),
    val(`cls_${s}`, `cls_${s}`, { tooltip: "Modificateurs des classes obtenues (Base, Avancée, Élite)" }),
    number(`niv_${s}`, "", { def: 0, tooltip: "Gains des montées de niveau" }),
    val(`tot_${s}`, `tot_${s}`),
    s === "pv" ? val(`eff_${s}`, "pv_max", { tooltip: "PV max avec les traits Boost" })
               : val(`eff_${s}`, s, { tooltip: "Total + traits Boost + bonus temporaires − blessures, plafond 50" }),
    number(`des_${s}`, "", { def: 1, min: 0, max: 12 })
  ];
  const rankTypes = Object.keys(WEAPON_TYPES);
  const stats = panel("fe_stats", [
    title("Reste à attribuer"),
    table("fe_alloc", [
      [th("Points de stats libres"), th("Dés libres"), th("PM"), th("Contrôle")],
      [val("pts_libres", "pts_libres", { tooltip: "3 au niveau 1 (2 PV = 1 point). Calcul : stats de base − classe − gains de niveau." }),
       val("des_libres", "des_libres", { tooltip: "6 au niveau 1. Calcul : dés − 1 par stat − dés de classe − dés achetés." }),
       val("pm_restants", "pm_restants"),
       label("alerte", sheetValue("alerte"))]
    ], { layout: "cccc" }),
    table("fe_stats_table", [
      [th("Stat"), th("Base"), th("Classe"), th("Niveau"), th("Total"), th("En combat"), th("Dés")],
      ...["pv", "for", "mag", "def", "res", "tech", "vit"].map(statRow),
      [th("Mouvement"), number("base_mvt", "", { def: 5, min: 0 }), label("", "—"), label("", "—"), val("eff_mvt", "mvt"), val("eff_mvt2", "mvt"), label("", "—")]
    ], { layout: "lcccccc" }),
    title("Rangs d'arme"),
    table("fe_rangs", [
      rankTypes.map(k => th(`${wicon(k)} ${WEAPON_TYPES[k].label}`)),
      rankTypes.map(k => select(`rang_${k}`, "", rankOptions, { def: "E", size: "small" }))
    ], { layout: "c".repeat(rankTypes.length) })
  ]);

  const traits = panel("fe_traits", [
    table("fe_slots", [[th("Emplacements équipés"), label("slots", sheetValue("slots_text"), { cssClass: "fe-val" })]], { layout: "lc" }),
    itemContainer("traits", "Traits", [TEMPLATE_IDS.trait], [
      col("t_eq", "Équipé", itemValue("equip"), { rollMessage: `%{${API}?.toggleEquip(linkedEntity); return '';}%`, tooltip: "Cliquer pour équiper" }),
      col("t_prix", "Prix", itemValue("prix")),
      { ...col("t_effet", "Effet", itemValue("effet")), align: "left" }
    ])
  ]);

  const profil = panel("fe_profil", [
    table("fe_profil_table", [
      [th("Rôle"), th("Palier de classe"), th("Déplacement"), th("Mots-clés")],
      [select("role", "", [["secondaire", "Personnage secondaire"], ["principal", "Personnage principal"]]),
       select("palier", "", [["1", "I (base)"], ["2", "II (avancée)"], ["3", "III / élite"]]),
       select("profil", "", Object.entries(PROFILES)),
       val("mots_cles", "mots_cles")]
    ], { layout: "cccc" }),
    title("Classes obtenues (macro « FE – Classe et promotion »)"),
    table("fe_slots_classes", [
      [th("Base"), th("Avancée"), th("Élite")],
      [val("classe_1", "classe_1"), val("classe_2", "classe_2"), val("classe_3", "classe_3")]
    ], { layout: "ccc" }),
    itemContainer("classe_item", "Objets Classe", [TEMPLATE_IDS.classe], [
      col("k_palier", "Palier", itemValue("cl_palier")),
      col("k_mvt", "Mvt", itemValue("cl_mvt")),
      col("k_profil", "Déplacement", itemValue("cl_profil")),
      col("k_armes", "Armes", itemValue("cl_armes")),
      col("k_mots", "Mots-clés", itemValue("cl_mots"))
    ]),
    itemContainer("mots_cles_items", "Mots-clés de l'unité", [TEMPLATE_IDS.motcle], [
      { ...col("m_effet", "Effet", itemValue("effet")), align: "left" }
    ]),
    text("tags", "Autres mots-clés (séparés par des virgules)", { def: "" })
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
      ["tab_inv", "Inventaire", [inventaire]],
      ["tab_profil", "Profil", [profil]]
    ])
  ]);

  return {
    id: TEMPLATE_IDS.unite, type: "_template", name: TEMPLATE_NAMES.unite,
    data: {
      header, body, hidden: [], attributeBar: {},
      display: { width: 820, height: 780, fix_size: false, pp_width: 100, pp_height: 100 },
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

const SHORT = { pv: "PV", for: "For", mag: "Mag", def: "Déf", res: "Rés", tech: "Tech", vit: "Vit" };
const statOptions = [["aucun", "—"], ...STATS.map(k => [k, STAT_LABELS[k]])];

function classeTemplate() {
  return itemTemplate("classe", [
    select("cl_palier", "Palier", [["1", "Base"], ["2", "Avancée"], ["3", "Élite"]]),
    select("cl_profil", "Déplacement", Object.entries(PROFILES)),
    number("cl_mvt", "Mouvement", { def: 5, min: 0 })
  ], [
    title("Modificateurs de stats (classe de base) ou bonus de promotion"),
    table("fe_cl_stats", [
      STATS.map(k => th(SHORT[k])),
      STATS.map(k => number(`cl_mod_${k}`, "", { def: 0 }))
    ], { layout: "c".repeat(STATS.length) }),
    table("fe_cl_info", [
      [th("Dé de classe 1"), select("cl_de1", "", statOptions, { def: "aucun" })],
      [th("Dé de classe 2"), select("cl_de2", "", statOptions, { def: "aucun" })],
      [th("Types d'arme"), text("cl_armes", "", { def: "" })],
      [th("Arme de départ"), text("cl_depart", "", { def: "" })],
      [th("Trait par défaut"), text("cl_trait", "", { def: "" })],
      [th("Mots-clés"), text("cl_mots", "", { def: "" })],
      [th("Promotions possibles"), text("cl_promos", "", { def: "" })]
    ], { layout: "ll" }),
    title("Traits déblocables"),
    label("cl_traits", `%{return ${API}?.classTraits(entity) ?? ''}%`, { cssClass: "fe-traits-box" }),
    text("effet", "Description", { def: "" })
  ]);
}

function motCleTemplate() {
  return itemTemplate("motcle", [
    text("mc_cle", "Clé (à écrire dans « Efficace contre »)", { def: "" })
  ], [
    text("effet", "Description", { def: "" })
  ]);
}

export function buildTemplates() {
  return {
    isCustomSystemExport: true,
    actors: [uniteTemplate()],
    items: [armeTemplate(), tomeTemplate(), sceptreTemplate(), objetTemplate(), traitTemplate(), classeTemplate(), motCleTemplate()]
  };
}
