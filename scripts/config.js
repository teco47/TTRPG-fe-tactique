/**
 * FE Tactique – données de règles (document de conception du 25/11/2026).
 * Tout ce qui est chiffré dans les règles est ici, pour pouvoir l'ajuster sans toucher au moteur.
 */

export const MODULE_ID = "fe-tactique";
export const MODULE_PATH = `modules/${MODULE_ID}`;

/* ------------------------------------------------------------------ */
/*  Identifiants fixes des modèles CSB créés par le module             */
/* ------------------------------------------------------------------ */
export const TEMPLATE_IDS = {
  unite: "feTplUnite000001",
  arme: "feTplArme0000001",
  tome: "feTplTome0000001",
  sceptre: "feTplSceptre0001",
  objet: "feTplObjet000001",
  trait: "feTplTrait000001",
  classe: "feTplClasse00001",
  motcle: "feTplMotCle00001"
};

export const TEMPLATE_NAMES = {
  unite: "FE – Unité",
  arme: "FE – Arme",
  tome: "FE – Tome",
  sceptre: "FE – Sceptre",
  objet: "FE – Objet",
  trait: "FE – Trait",
  classe: "FE – Classe",
  motcle: "FE – Mot-clé"
};

/* ------------------------------------------------------------------ */
/*  Armes, rangs, triangle                                             */
/* ------------------------------------------------------------------ */
export const RANKS = ["E", "D", "C", "B", "A", "S"];
/** Bonus par rang au-dessus de E (validé le 23/11). */
export const RANK_BONUS = { pui: 2, prec: 5, crit: 5 };

export const WEAPON_TYPES = {
  epee:     { label: "Épée",     magic: false, color: "rouge", icon: "icone-ep.png" },
  lance:    { label: "Lance",    magic: false, color: "bleu",  icon: "icone-la.png" },
  hache:    { label: "Hache",    magic: false, color: "vert",  icon: "icone-ha.png" },
  arc:      { label: "Arc",      magic: false, color: null,    icon: "icone-ar.png" },
  lumiere:  { label: "Lumière",  magic: true,  color: "rouge", icon: "icone-lu.png" },
  anima:    { label: "Anima",    magic: true,  color: "bleu",  icon: "icone-an.png" },
  tenebres: { label: "Ténèbres", magic: true,  color: "vert",  icon: "icone-te.png" },
  sceptre:  { label: "Sceptre",  magic: true,  color: null,    icon: "icone-sc.png" }
};

/** Rouge bat vert, vert bat bleu, bleu bat rouge. */
export const TRIANGLE_BEATS = { rouge: "vert", vert: "bleu", bleu: "rouge" };
/** Triangle des armes : ±5 Puissance et ±15 Précision à l'attaque. */
export const TRIANGLE_BONUS = { atq: 5, prec: 15 };

/** Seuil de double attaque : Vitesse d'attaque supérieure d'au moins 6. */
export const DOUBLE_THRESHOLD = 6;
/** Plafond des stats (utilisé dans les calculs, la fiche peut dépasser). */
export const STAT_CAP = 50;

/* ------------------------------------------------------------------ */
/*  Catalogue d'équipement                                             */
/* ------------------------------------------------------------------ */
// crit: null = « Aucun » (le Bronze ne peut pas faire de critique)
export const WEAPONS = [
  ["Épée de bronze", "epee", 2, 90, null, 0, 50, 120, "E"],
  ["Épée de fer", "epee", 4, 85, 0, 1, 40, 200, "E"],
  ["Épée d'acier", "epee", 7, 75, 0, 4, 30, 400, "C"],
  ["Épée d'argent", "epee", 10, 80, 0, 3, 20, 1000, "A"],
  ["Lance de bronze", "lance", 3, 85, null, 1, 50, 120, "E"],
  ["Lance de fer", "lance", 5, 80, 0, 2, 40, 200, "E"],
  ["Lance d'acier", "lance", 8, 70, 0, 5, 30, 400, "C"],
  ["Lance d'argent", "lance", 11, 75, 0, 4, 20, 1000, "A"],
  ["Hache de bronze", "hache", 4, 75, null, 2, 50, 120, "E"],
  ["Hache de fer", "hache", 6, 70, 0, 3, 40, 200, "E"],
  ["Hache d'acier", "hache", 9, 60, 0, 6, 30, 400, "C"],
  ["Hache d'argent", "hache", 12, 65, 0, 5, 20, 1000, "A"],
  ["Arc de bronze", "arc", 2, 85, null, 0, 50, 120, "E"],
  ["Arc de fer", "arc", 4, 80, 0, 1, 40, 200, "E"],
  ["Arc d'acier", "arc", 7, 70, 0, 3, 30, 400, "C"],
  ["Arc d'argent", "arc", 10, 75, 0, 2, 20, 1000, "A"]
].map(([nom, type, pui, prec, crit, poids, dur, prix, rang]) => ({
  nom, type, pui, prec, crit, poids, dur, prix, rang,
  porMin: 1, porMax: type === "arc" ? 2 : 1,
  efficace: "", special: "aucun", sansRiposte: false, effet: ""
}));

// [nom, école, rang, pui, préc, crit, poids, dur, prix, special, effet, portée]
export const TOMES = [
  ["Feu", "anima", "E", 4, 85, 0, 1, 40, 240],
  ["Foudre", "anima", "D", 6, 75, 5, 1, 35, 300],
  ["Grand feu", "anima", "C", 8, 80, 0, 3, 30, 520],
  ["Fulguration", "anima", "B", 10, 55, 0, 7, 5, 1100, "siege", "Portée 3-10, pas de riposte", [3, 10]],
  ["Fimbulvetr", "anima", "A", 10, 75, 0, 4, 20, 2600],
  ["Excalibur", "anima", "S", 14, 85, 10, 4, 25, 10800],
  ["Brasier", "anima", "Perso", 11, 80, 5, 4, 20, 0, "aucun", "+5 Esquive, efficace contre les dragons", null, "dragon", 5],
  ["Éclair", "lumiere", "E", 3, 90, 5, 1, 35, 270],
  ["Éclat", "lumiere", "D", 5, 85, 8, 2, 30, 390],
  ["Divin", "lumiere", "C", 6, 80, 10, 4, 25, 1100],
  ["Purge", "lumiere", "B", 8, 70, 5, 7, 5, 1300, "siege", "Portée 3-10, pas de riposte", [3, 10]],
  ["Aura", "lumiere", "A", 10, 80, 15, 5, 20, 3400],
  ["Luce", "lumiere", "S", 13, 90, 25, 5, 25, 13000],
  ["Auréole", "lumiere", "Perso", 12, 85, 5, 4, 20, 0, "aucun", "+5 Rés", null, "", 0, 5],
  ["Ombre", "tenebres", "E", 5, 80, 0, 1, 50, 250],
  ["Flux", "tenebres", "D", 6, 75, 0, 2, 45, 390],
  ["Luna", "tenebres", "C", 0, 90, 20, 4, 35, 2250, "luna", "Ignore la Résistance"],
  ["Nosferatu", "tenebres", "C", 8, 65, 0, 4, 20, 1400, "nosferatu", "Rend en PV les dégâts infligés"],
  ["Éclipse", "tenebres", "B", 0, 25, 0, 4, 5, 1700, "eclipse", "Portée 3-10, pas de riposte ; réduit les PV de la cible de moitié", [3, 10]],
  ["Fenrir", "tenebres", "A", 12, 65, 0, 6, 20, 3900],
  ["Gespenst", "tenebres", "S", 18, 75, 0, 7, 25, 15000]
].map(([nom, type, rang, pui, prec, crit, poids, dur, prix, special = "aucun", effet = "", portee = null, efficace = "", bonusEsq = 0, bonusRes = 0]) => ({
  nom, type, rang, pui, prec, crit, poids, dur, prix,
  porMin: portee ? portee[0] : 1, porMax: portee ? portee[1] : 2,
  special: special === "siege" ? "aucun" : special,
  sansRiposte: special === "siege" || special === "eclipse",
  effet, efficace, bonusEsq, bonusRes
}));

// [nom, rang, effet (clé), soin de base, portée min, portée max, dur, prix, description]
export const STAVES = [
  ["Soin", "E", "soin", 10, 1, 1, 20, 300, "Soigne 10 + Mag/2 PV"],
  ["Guérison", "D", "soin", 15, 1, 1, 20, 600, "Soigne 15 + Mag/2 PV"],
  ["Silence", "C", "silence", 0, 2, 6, 10, 900, "La cible ne peut plus utiliser de tome jusqu'à la fin de sa prochaine phase. Touche automatiquement"],
  ["Restauration", "B", "soin", 20, 1, 1, 20, 900, "Soigne 20 + Mag/2 PV"],
  ["Recouvrement", "A", "recouvrement", 0, 1, 1, 10, 1200, "Soin complet"]
].map(([nom, rang, effetCle, soin, porMin, porMax, dur, prix, effet]) => ({
  nom, type: "sceptre", rang, effetCle, soin, porMin, porMax, dur, prix, effet
}));

// [nom, effet (clé), valeur, utilisations, prix, description]
export const OBJECTS = [
  ["Potion", "soin", 10, 3, 200, "Soigne 10 PV"],
  ["Élixir", "soin", 20, 3, 400, "Soigne 20 PV"],
  ["Clé", "cle", 0, 1, 200, "Ouvre un coffre ou une porte"],
  ["Booster", "booster", 2, 1, 0, "+2 permanent à une stat (+5 pour les PV, +1 pour le Mouvement)"],
  ["Magister", "magister", 0, 1, 600, "Promotion d'une classe de base vers une classe avancée, à partir du niveau 10"],
  ["Magister supérieur", "magister", 0, 1, 1400, "Promotion d'une classe avancée vers une classe d'élite, à partir du niveau 20"],
  ["Magister d'équivalence", "magister", 0, 1, 1400, "Passe dans la classe d'un allié avec qui l'unité a un soutien de rang A ou plus (voir règles)"]
].map(([nom, effetCle, valeur, uses, prix, effet]) => ({ nom, effetCle, valeur, uses, prix, effet }));

/* ------------------------------------------------------------------ */
/*  Classes de base (version du 24/11/2026)                            */
/* ------------------------------------------------------------------ */
// stats après modificateurs de classe, avant les 3 points libres
export const CLASSES = {
  "Soldat":     { pv: 14, for: 6, mag: 3, def: 7, res: 4, tech: 6, vit: 5, des: ["tech", "def"], armes: ["lance"], depart: "Lance de bronze", mvt: 5, profil: "pied", traitDefaut: "Bouclier" },
  "Écuyer":     { pv: 16, for: 7, mag: 3, def: 6, res: 3, tech: 5, vit: 6, des: ["for", "vit"], armes: ["lance"], depart: "Lance de bronze", mvt: 6, profil: "monte", motsCles: ["cavalier"] },
  "Coursier":   { pv: 16, for: 5, mag: 3, def: 4, res: 4, tech: 7, vit: 7, des: ["vit", "vit"], armes: ["epee"], depart: "Épée de bronze", mvt: 6, profil: "volant", traitDefaut: "Ailé", motsCles: ["volant"] },
  "Chasseur":   { pv: 12, for: 6, mag: 4, def: 3, res: 5, tech: 7, vit: 7, des: ["tech", "for"], armes: ["arc"], depart: "Arc de bronze", mvt: 5, profil: "pied" },
  "Voleur":     { pv: 14, for: 5, mag: 5, def: 3, res: 4, tech: 7, vit: 7, des: ["tech", "vit"], armes: ["epee"], depart: "Épée de bronze", mvt: 5, profil: "pied" },
  "Brute":      { pv: 20, for: 8, mag: 4, def: 5, res: 4, tech: 2, vit: 5, des: ["for", "pv"], armes: ["hache"], depart: "Hache de bronze", mvt: 5, profil: "pied" },
  "Mercenaire": { pv: 12, for: 7, mag: 5, def: 5, res: 3, tech: 6, vit: 6, des: ["for", "def"], armes: ["epee"], depart: "Épée de bronze", mvt: 5, profil: "pied" },
  "Scribe":     { pv: 14, for: 5, mag: 7, def: 3, res: 6, tech: 5, vit: 5, des: ["mag", "res"], armes: ["lumiere"], depart: "Éclair", mvt: 5, profil: "pied" },
  "Sauvage":    { pv: 18, for: 7, mag: 3, def: 5, res: 4, tech: 4, vit: 6, des: ["for", "vit"], armes: ["hache"], depart: "Hache de bronze", mvt: 5, profil: "pied" },
  "Moine":      { pv: 12, for: 5, mag: 7, def: 3, res: 7, tech: 5, vit: 5, des: ["res", "pv"], armes: ["sceptre"], depart: "Soin", mvt: 5, profil: "pied" },
  "Apprentie":  { pv: 14, for: 4, mag: 7, def: 3, res: 5, tech: 7, vit: 5, des: ["mag", "tech"], armes: ["anima"], depart: "Feu", mvt: 5, profil: "pied" },
  "Shaman":     { pv: 14, for: 5, mag: 8, def: 3, res: 6, tech: 5, vit: 4, des: ["mag", "pv"], armes: ["tenebres"], depart: "Ombre", mvt: 5, profil: "pied", traitDefaut: "Esprit" }
};

/* ------------------------------------------------------------------ */
/*  Mots-clés d'unité (cibles des armes « efficaces contre »)          */
/* ------------------------------------------------------------------ */
// cle : valeur à écrire dans « Efficace contre » d'une arme
export const KEYWORDS = [
  { nom: "Volant", cle: "volant", effet: "Unité volante : les arcs sont efficaces contre elle" },
  { nom: "Cavalier", cle: "cavalier", effet: "Unité montée" },
  { nom: "Blindé", cle: "blinde", effet: "Unité en armure lourde" },
  { nom: "Dragon", cle: "dragon", effet: "Dragon ou unité draconique" },
  { nom: "Monstre", cle: "monstre", effet: "Créature monstrueuse" }
];

/* ------------------------------------------------------------------ */
/*  Paliers de classe et promotions                                    */
/* ------------------------------------------------------------------ */
export const TIERS = { 1: "Base", 2: "Avancée", 3: "Élite" };
/** Promotion vers le palier indiqué : niveau minimum et objet consommé. */
export const PROMOTION = {
  2: { niveau: 10, objet: "Magister" },
  3: { niveau: 20, objet: "Magister supérieur" }
};
/** Changement de classe hors promotion (soutien de rang A avec un allié de cette classe, vérifié par le MJ). */
export const EQUIVALENCE_ITEM = "Magister d'équivalence";

export const STATS = ["pv", "for", "mag", "def", "res", "tech", "vit"];
export const STAT_LABELS = { pv: "PV", for: "Force", mag: "Magie", def: "Défense", res: "Résistance", tech: "Technique", vit: "Vitesse", mvt: "Mouvement" };

/* ------------------------------------------------------------------ */
/*  Traits des classes de base (version de Teco du 25/11/2026)         */
/* ------------------------------------------------------------------ */
// type : jetons (génère des jetons, automatisé), boost (automatisé), auto (automatisé par le moteur), manuel
export const TRAITS = [
  { nom: "Bouclier", classes: "Soldat", prix: 0, type: "jetons", effet: "+1 jeton Bouclier par coup reçu (un double coup en donne 2), maximum 10" },
  { nom: "Garde ferme", classes: "Soldat", prix: 2, type: "manuel", effet: "+2 Déf s'il ne s'est pas déplacé ce tour" },
  { nom: "Mur de boucliers", classes: "Soldat", prix: 4, type: "manuel", effet: "Dépense 4 jetons Bouclier : +3 Déf à chaque allié adjacent jusqu'à sa prochaine phase" },
  { nom: "Interposition", classes: "Soldat", prix: 6, type: "manuel", effet: "Dépense 10 jetons Bouclier : prend les coups reçus par un allié adjacent pendant tout un combat" },
  { nom: "Serment", classes: "Écuyer", prix: 2, type: "auto", effet: "+10 Précision s'il est adjacent à un personnage principal" },
  { nom: "Charge", classes: "Écuyer", prix: 4, type: "manuel", effet: "S'il s'est déplacé d'au moins 6 cases : +2 For et +5 Précision jusqu'à la fin de son activation" },
  { nom: "Redéploiement", classes: "Écuyer", prix: 6, type: "manuel", effet: "Après une action (attaque, objet, dialogue, etc.), il peut utiliser le reste de son déplacement" },
  { nom: "Ailé", classes: "Coursier", prix: 0, type: "jetons", effet: "+1 jeton Ailé par coup esquivé, maximum 10" },
  { nom: "Boost [+10 Esquive]", classes: "Coursier", prix: 4, type: "boost", stat: "esq", valeur: 10, effet: "+10 Esquive" },
  { nom: "Piqué", classes: "Coursier", prix: 2, type: "manuel", effet: "Dépense 2 jetons Ailé avant un combat : +10 Critique" },
  { nom: "Barrel Roll", classes: "Coursier", prix: 4, type: "manuel", effet: "S'il sort d'un combat après avoir esquivé un coup, dépense 4 jetons Ailé pour se déplacer de 3 cases" },
  { nom: "Transport ailé", classes: "Coursier", prix: 6, type: "manuel", effet: "Prend un allié adjacent, se déplace de 2 cases par jeton Ailé dépensé (au plus son Mouvement), puis dépose l'allié sur une case adjacente. Sinon, l'allié va sur la case libre la plus proche et subit 5 dégâts par case d'écart. Compte comme son action" },
  { nom: "Forestier", classes: "Chasseur, Sauvage", prix: 2, type: "auto", effet: "La forêt coûte 1 Mouvement de moins" },
  { nom: "Tir au pigeon", classes: "Chasseur", prix: 4, type: "auto", effet: "Ses arcs sont efficaces contre les unités volantes" },
  { nom: "Grande corde", classes: "Chasseur", prix: 6, type: "auto", effet: "+1 portée maximale avec un arc" },
  { nom: "Crochetage", classes: "Voleur", prix: 2, type: "manuel", effet: "Ouvre portes et coffres sans clé" },
  { nom: "Insaisissable", classes: "Voleur", prix: 4, type: "manuel", effet: "Traverse les cases ennemies" },
  { nom: "Larcin", classes: "Voleur", prix: 4, type: "manuel", effet: "Vole 10 or × l'écart de Vitesse avec la cible" },
  { nom: "Boost [+10 PV]", classes: "Brute", prix: 4, type: "boost", stat: "pv", valeur: 10, effet: "+10 PV max" },
  { nom: "Fracas", classes: "Brute", prix: 4, type: "manuel", effet: "Pendant tout le combat : −10 Précision et +5 For, et −5 durabilité de la hache par coup porté. Si une attaque touche, la cible recule d'une case et perd 3 Déf jusqu'à la fin de la prochaine phase ennemie" },
  { nom: "Rage", classes: "Brute", prix: 6, type: "auto", effet: "Sous la moitié de ses PV : +3 For et +15 Critique" },
  { nom: "Prime", classes: "Mercenaire", prix: 2, type: "auto", effet: "Chaque ennemi tué rapporte 25 or" },
  { nom: "Duelliste", classes: "Mercenaire", prix: 4, type: "auto", effet: "+10 Précision et +10 Esquive si aucun allié de la cible ne lui est adjacent" },
  { nom: "Vétéran", classes: "Mercenaire", prix: 4, type: "manuel", effet: "Paye 200 or pour relancer un jet de toucher" },
  { nom: "Lecture", classes: "Scribe, Apprentie", prix: 2, type: "manuel", effet: "S'il n'a fait aucune action au tour précédent : +5 Mag jusqu'à la fin de la phase joueur" },
  { nom: "Chasteté", classes: "Scribe", prix: 4, type: "manuel", effet: "Si aucun personnage du sexe opposé (ou du même sexe, au choix du MJ) ne lui est adjacent : +10 Précision et +3 Mag" },
  { nom: "Miracle", classes: "Scribe, Moine", prix: 6, type: "auto", effet: "S'il a au moins 50 % de ses PV et qu'un coup devrait le tuer, il survit à 1 PV" },
  { nom: "Être des bois", classes: "Sauvage", prix: 4, type: "auto", effet: "En forêt : +10 Précision et +10 Esquive" },
  { nom: "Désespoir", classes: "Sauvage", prix: 6, type: "auto", effet: "S'il engage un combat avec 50 % de ses PV ou moins, il porte toutes ses attaques avant la riposte de la cible" },
  { nom: "Méditation", classes: "Moine", prix: 2, type: "manuel", effet: "Au début de sa phase, s'il n'a eu aucun combat depuis le début de sa phase précédente : soigne 10 % de ses PV max" },
  { nom: "Bénédiction", classes: "Moine", prix: 4, type: "manuel", effet: "Au début de chaque phase joueur, soigne 2 PV à chaque allié adjacent" },
  { nom: "Studieuse", classes: "Apprentie", prix: 2, type: "manuel", effet: "+5 EXP par tour sans agir" },
  { nom: "Surcharge", classes: "Apprentie", prix: 4, type: "manuel", effet: "Pendant tout le combat : +1 portée maximale et +5 Mag, et −5 durabilité du tome par coup porté" },
  { nom: "Esprit", classes: "Shaman", prix: 0, type: "jetons", effet: "+1 jeton Esprit par attaque magique qui inflige des dégâts, maximum 10" },
  { nom: "Hantise", classes: "Shaman", prix: 4, type: "manuel", effet: "Réaction : dès qu'un ennemi adjacent lui inflige des dégâts, le joueur peut dépenser 4 jetons Esprit : l'ennemi a −10 Esquive et −3 Rés jusqu'à la fin de la prochaine phase joueur" },
  { nom: "Siphon", classes: "Shaman", prix: 4, type: "manuel", effet: "Dépense 5 jetons Esprit : sa prochaine attaque qui touche le soigne de la moitié des dégâts infligés" },
  { nom: "Spectre", classes: "Shaman", prix: 6, type: "manuel", effet: "Dépense 10 jetons Esprit : sa prochaine attaque est un critique garanti" }
];

/** Traits activables avant un combat dans la fenêtre de prévision (coût en jetons). */
export const COMBAT_ACTIVATIONS = {
  "Piqué":   { jeton: "aile",   cout: 2,  label: "Piqué (2 Ailé) : +10 Critique" },
  "Spectre": { jeton: "esprit", cout: 10, label: "Spectre (10 Esprit) : critique garanti" },
  "Siphon":  { jeton: "esprit", cout: 5,  label: "Siphon (5 Esprit) : soigne la moitié des dégâts" },
  "Fracas":  { jeton: null,     cout: 0,  label: "Fracas : −10 Préc, +5 For, −5 durabilité par coup" },
  "Surcharge": { jeton: null,   cout: 0,  label: "Surcharge : +1 portée, +5 Mag, −5 durabilité par coup" }
};

/* ------------------------------------------------------------------ */
/*  Terrain (validé le 25/11/2026)                                     */
/* ------------------------------------------------------------------ */
export const TERRAINS = {
  plaine:   { label: "Plaine",        esq: 0,  def: 0 },
  route:    { label: "Route",         esq: 0,  def: 0 },
  pont:     { label: "Pont",          esq: 0,  def: 0 },
  foret:    { label: "Forêt",         esq: 15, def: 1 },
  colline:  { label: "Colline",       esq: 20, def: 1 },
  fort:     { label: "Fort",          esq: 15, def: 2, soin: 0.1 },
  trone:    { label: "Trône",         esq: 20, def: 3, soin: 0.1 },
  porte:    { label: "Porte",         esq: 20, def: 3, soin: 0.1 },
  village:  { label: "Village",       esq: 5,  def: 0 },
  riviere:  { label: "Rivière",       esq: 0,  def: 0 },
  gue:      { label: "Gué",           esq: 0,  def: 0 },
  montagne: { label: "Montagne",      esq: 25, def: 2 },
  eau:      { label: "Eau profonde",  esq: 0,  def: 0 },
  mur:      { label: "Mur",           esq: 0,  def: 0 }
};

/** Mots-clés reconnus dans le nom d'une Région (sans accents, en minuscules). L'ordre compte. */
export const TERRAIN_KEYWORDS = [
  ["eau profonde", "eau"], ["mer", "eau"], ["lac", "eau"],
  ["foret", "foret"], ["bois", "foret"], ["bosquet", "foret"],
  ["colline", "colline"],
  ["fort", "fort"], ["grenier", "fort"],
  ["trone", "trone"],
  ["porte", "porte"],
  ["village", "village"], ["maison", "village"], ["eglise", "village"],
  ["riviere", "riviere"], ["ruisseau", "riviere"],
  ["gue", "gue"],
  ["montagne", "montagne"],
  ["mur", "mur"], ["batiment", "mur"], ["palissade", "mur"],
  ["pont", "pont"], ["route", "route"], ["plaine", "plaine"]
];

export const PROFILES = {
  pied:       "À pied",
  lourd:      "Lourd",
  monte:      "Monté",
  montelourd: "Monté lourd",
  volant:     "Volant"
};

// null = infranchissable
export const MOVE_COSTS = {
  plaine:   { pied: 1, lourd: 1, monte: 1, montelourd: 1, volant: 1 },
  route:    { pied: 1, lourd: 1, monte: 1, montelourd: 1, volant: 1 },
  pont:     { pied: 1, lourd: 1, monte: 1, montelourd: 1, volant: 1 },
  trone:    { pied: 1, lourd: 1, monte: 1, montelourd: 1, volant: 1 },
  porte:    { pied: 1, lourd: 1, monte: 1, montelourd: 1, volant: 1 },
  village:  { pied: 1, lourd: 1, monte: 1, montelourd: 1, volant: 1 },
  fort:     { pied: 2, lourd: 2, monte: 2, montelourd: 2, volant: 1 },
  foret:    { pied: 2, lourd: 2, monte: 3, montelourd: 4, volant: 1 },
  colline:  { pied: 3, lourd: 4, monte: 4, montelourd: 4, volant: 1 },
  riviere:  { pied: 4, lourd: 5, monte: 5, montelourd: null, volant: 1 },
  gue:      { pied: 4, lourd: 5, monte: 5, montelourd: null, volant: 1 },
  montagne: { pied: 5, lourd: null, monte: null, montelourd: null, volant: 1 },
  eau:      { pied: null, lourd: null, monte: null, montelourd: null, volant: 1 },
  mur:      { pied: null, lourd: null, monte: null, montelourd: null, volant: null }
};

/* ------------------------------------------------------------------ */
/*  Progression                                                        */
/* ------------------------------------------------------------------ */
export const MAX_LEVEL = 40;
/** Référence de points de maîtrise par tranche de niveaux. */
export function masteryReference(level) {
  if (level <= 9) return 2;
  if (level <= 19) return 4;
  if (level <= 29) return 5;
  return 6;
}
/** Dés maximum par stat selon le niveau. */
export function maxDicePerStat(level) {
  if (level <= 9) return 3;
  if (level <= 19) return 6;
  if (level <= 30) return 9;
  return 12;
}
/** Emplacements de traits : 4, puis +2 aux niveaux 10, 20, 30, 40. */
export function traitSlots(level) {
  return 4 + 2 * Math.min(4, Math.floor(level / 10));
}

/* ------------------------------------------------------------------ */
/*  Blessures                                                          */
/* ------------------------------------------------------------------ */
/** Malus par blessure selon le palier de classe : −3 (I), −5 (II), −7 (III et élite). */
export const WOUND_MALUS = { 1: 3, 2: 5, 3: 7 };
/** Blessures supportées : la mort survient à la blessure suivante. */
export const WOUND_LIMIT = { principal: 3, secondaire: 2 };

/* ------------------------------------------------------------------ */
/*  États                                                              */
/* ------------------------------------------------------------------ */
export const STATUS = {
  bouclier: { id: "fe-bouclier", name: "Jetons Bouclier", img: `${MODULE_PATH}/assets/status/bouclier.svg`, prop: "jet_bouclier" },
  aile:     { id: "fe-aile",     name: "Jetons Ailé",     img: `${MODULE_PATH}/assets/status/aile.svg`,     prop: "jet_aile" },
  esprit:   { id: "fe-esprit",   name: "Jetons Esprit",   img: `${MODULE_PATH}/assets/status/esprit.svg`,   prop: "jet_esprit" },
  blessure: { id: "fe-blessure", name: "Blessures",       img: `${MODULE_PATH}/assets/status/blessure.svg`, prop: "blessures" },
  silence:  { id: "fe-silence",  name: "Silence",         img: `${MODULE_PATH}/assets/status/silence.svg` },
  bonus:    { id: "fe-bonus",    name: "Bonus temporaire", img: `${MODULE_PATH}/assets/status/bonus.svg` },
  malus:    { id: "fe-malus",    name: "Malus temporaire", img: `${MODULE_PATH}/assets/status/malus.svg` }
};
export const TOKEN_MAX = 10;

/* ------------------------------------------------------------------ */
/*  Animations JB2A (premier chemin trouvé dans la base Sequencer)     */
/* ------------------------------------------------------------------ */
export const DEFAULT_ANIMATIONS = {
  epee: ["jb2a.sword.melee.01.white", "jb2a.shortsword.melee.01.white", "jb2a.melee_generic.slash.01.orange"],
  lance: ["jb2a.spear.melee.01.white", "jb2a.melee_generic.piercing.01.orange", "jb2a.melee_generic.slash.01.orange"],
  hache: ["jb2a.handaxe.melee.standard.white", "jb2a.greataxe.melee.standard.white", "jb2a.melee_generic.slash.01.orange"],
  arc: ["jb2a.arrow.physical.white.01", "jb2a.arrow.physical.white"],
  anima: ["jb2a.fire_bolt.orange", "jb2a.fire_bolt"],
  lumiere: ["jb2a.guiding_bolt.01.yellowblue", "jb2a.guiding_bolt", "jb2a.magic_missile"],
  tenebres: ["jb2a.eldritch_blast.purple", "jb2a.eldritch_blast", "jb2a.ray_of_enfeeblement"],
  critique: ["jb2a.impact.ground_crack.orange.01", "jb2a.impact.004.orange", "jb2a.impact.orange"],
  soin: ["jb2a.healing_generic.200px.green", "jb2a.healing_generic", "jb2a.cure_wounds.400px.blue"],
  silence: ["jb2a.markers.light.complete.purple", "jb2a.markers.light"]
};
