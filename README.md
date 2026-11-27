# FE Tactique 0.12.0 – guide d'installation et de test

Module pour **Foundry VTT v14** (testé sur le papier pour le build 365) et **Custom System Builder 6.1.2**.
Il ajoute à un monde CSB : la fiche d'unité, les armes/tomes/sceptres/objets/traits, la fenêtre de prévision de combat, la montée de niveau, les états à compteurs, le badge d'arme sur les jetons, le terrain par Régions avec les coûts de déplacement par profil, et la scène du chapitre 1.

> Le module n'a pas pu être lancé dans Foundry pendant sa fabrication. Les calculs de combat ont été vérifiés hors Foundry contre les repères de la campagne test, mais l'affichage et les appels Foundry/CSB sont à valider avec la checklist plus bas.

## 1. Installation

### Foundry installé sur ton PC
1. Ferme le monde.
2. Dézippe `fe-tactique-0.12.0.zip` dans `%LOCALAPPDATA%\FoundryVTT\Data\modules\` : tu dois obtenir `...\modules\fe-tactique\module.json`.
3. Relance Foundry, ouvre ton monde CSB, active **FE Tactique** dans *Gérer les modules*.

### The Forge (ou installation par URL)
Dans la configuration du jeu, *Installer un module*, colle l'URL du manifeste :

`https://raw.githubusercontent.com/teco47/TTRPG-fe-tactique/main/module.json`

## 2. Première ouverture du monde (MJ)

Une fenêtre propose **« Installer le contenu FE Tactique »**. Accepte. Le module crée :

- les modèles CSB : `FE – Unité` (acteur), `FE – Arme`, `FE – Tome`, `FE – Sceptre`, `FE – Objet`, `FE – Trait` ;
- le dossier d'objets **FE – Catalogue** : 16 armes, 21 tomes, 5 sceptres, 7 objets, 37 traits ;
- le dossier de macros **FE Tactique**.

Si la fenêtre n'apparaît pas : console (F12) > `game.modules.get("fe-tactique").api.install()`.
Plan B pour les modèles seuls : *Paramètres > Custom System Builder > Importer les modèles JSON* avec `data/fe-tactique-csb-templates.json`.

### Macros
| Macro | Usage |
|---|---|
| FE – Attaquer | Sélectionne ton unité, cible l'adversaire (touche **T**), lance la macro : prévision, puis Attaquer/Annuler. Avec un sceptre équipé, ouvre l'action de sceptre. |
| FE – Utiliser un sceptre | Soin, Recouvrement ou Silence sur l'unité ciblée. |
| FE – Classe et promotion | Choix de la classe de départ, promotion (niveau 10 / 20, Magister) ou Magister d'équivalence, appliqués automatiquement. |
| FE – Montée de niveau | Lance les réserves de d6 de l'unité sélectionnée, applique les gains, l'EXP et les PM. |
| FE – Acheter un dé de stat | 3 PM le dé, dans la limite du niveau. |
| FE – Fin de phase | Expire Silence et bonus temporaires du camp qui finit, soigne 10 % sur fort/trône/porte pour le camp qui commence. |
| FE – Bonus temporaire | Bonus ou malus chiffré sur les unités sélectionnées, avec expiration. |
| FE – Nouvelle unité | Crée une unité depuis une des 12 classes de base, en choisissant son type : principal ou secondaire (joueur, anneau #1fdaff), neutre/allié (#73ff00) ou ennemi (#ff0000). Neutre et Ennemi comptent comme secondaires. Le jeton a l'anneau dynamique activé et une échelle de 1.1. |
| FE – Couleurs des jetons | (MJ) Applique l'anneau coloré et l'échelle 1.1 aux jetons sélectionnés, ou à toutes les unités FE. Changer le type sur la fiche met aussi le jeton à jour. |
| FE – Terrain des Régions | (MJ) Liste les Régions de la scène avec le terrain reconnu, et permet de le choisir dans une liste. |
| FE – Nouveau chapitre | Remet les jetons Bouclier, Ailé et Esprit à zéro. |
| FE – Préparer le chapitre 1 | Remplit la scène affichée : Régions de terrain et jetons. |
| FE – Exporter la scène (JSON) | (MJ) Télécharge un fichier JSON de la scène affichée : grille, terrain case par case, Régions, murs et portes, jetons avec la fiche complète de chaque unité. Pour faire analyser une carte hors de Foundry. |

## 3. La fiche d'unité

| Zone | Contenu |
|---|---|
| En-tête | Tableau Classe · Niveau · EXP · PM · PV / max · Blessures (et malus), puis la barre de PV. |
| Combat | Tableau de prévision (Arme, Portée, Atq, Préc, Crit, Esq, Vit. att., Esq. crit) avec l'arme équipée, jetons Bouclier/Ailé/Esprit, **inventaire unique** (armes, tomes, sceptres et objets : ☆ pour équiper une arme, ▶ pour utiliser un objet ; dernière colonne = durabilité ou utilisations), bonus manuels dans un bloc repliable. |
| Stats | Reste à attribuer, puis tableau Stat · Base (10 PV / 5 + points libres + Boosters, modifiable) · Classe (modificateurs des classes, calculé) · Niveau (gains de niveau, modifiable) · Total · En combat (Total + traits Boost + bonus temporaires − blessures) · Dés ; rangs d'arme sur une ligne. |
| Traits | Emplacements équipés et liste des traits (☆ pour équiper ; 4 emplacements, +2 tous les 10 niveaux). |
| Profil | Type d'unité (principal, secondaire, neutre/allié, ennemi), notes, palier, déplacement, mots-clés de l'unité ; objet Classe ; objets Mot-clé ; mots-clés libres. |

### Reste à attribuer

En haut de l'onglet Stats (et en résumé sous la barre de PV) : **points de stats libres** (3 au niveau 1, 2 PV = 1 point), **dés libres** (4 au niveau 1, réglage « Dés libres au niveau 1 ») et **PM**, avec une alerte si un total est dépassé ou si une stat a plus de dés que la limite du niveau. Les gains de montée de niveau, les Boosters et les dés achetés avec la macro sont suivis à part et ne consomment pas les points libres. Ajouter un trait à une unité retire son prix en PM, le retirer les rembourse (réglage « Déduire le prix des traits »).

### Classes, promotions et mots-clés (objets)

- **Équilibrage des classes de base (0.8.0)** : la stat d'attaque inutile (Magie des classes physiques, Force des mages et du Moine) est à −2 et ne compte pas dans le budget. Les 6 autres stats (PV/2, stat d'attaque, Déf, Rés, Tech, Vit) totalisent **+7 à pied** et **+5 pour l'Écuyer et le Coursier**, la monture ou le vol valant environ 2 points. À la mise à jour, les objets Classe des unités restés aux valeurs de la 0.7.1 prennent les nouveaux modificateurs et les PV actuels suivent le nouveau maximum ; un objet Classe modifié à la main n'est pas touché. Les ennemis du chapitre 1 gardent leurs stats totales.

| Classe | PV | For | Mag | Déf | Rés | Tech | Vit | Mvt |
|---|---|---|---|---|---|---|---|---|
| Soldat | +6 | +1 | −2 | +3 | −1 | +1 | 0 | 5 |
| Écuyer | +6 | +2 | −2 | +1 | −2 | 0 | +1 | 6 |
| Coursier | +6 | 0 | −2 | −1 | −1 | +2 | +2 | 6 |
| Chasseur | +4 | +2 | −2 | −2 | 0 | +3 | +2 | 5 |
| Voleur | +4 | +1 | −2 | −2 | 0 | +3 | +3 | 5 |
| Brute | +10 | +3 | −2 | +2 | −1 | −2 | 0 | 5 |
| Mercenaire | +4 | +2 | −2 | +1 | −2 | +2 | +2 | 5 |
| Sauvage | +8 | +2 | −2 | 0 | −1 | 0 | +2 | 5 |
| Scribe | +4 | −2 | +3 | −2 | +2 | +1 | +1 | 5 |
| Moine | +4 | −2 | +3 | −2 | +3 | 0 | +1 | 5 |
| Apprentie | +4 | −2 | +3 | −2 | +1 | +2 | +1 | 5 |
| Shaman | +4 | −2 | +4 | −1 | +2 | +1 | −1 | 5 |

- Les 12 classes de base sont dans *FE – Catalogue > Classes*. Une fiche retient trois emplacements : **Base**, **Avancée** et **Élite** (onglet Profil).
- Macro **FE – Classe et promotion** (ou *Utiliser* un Magister dans l'inventaire) : sélectionne le jeton, choisis la classe, et tout se fait :

| Cas | Condition | Effet |
|---|---|---|
| Classe de départ | Pas encore de classe, ou niveau 1 | Remplace la classe de base : retire ses modificateurs et ses 2 dés, ajoute ceux de la nouvelle. |
| Promotion | Niveau 10 (Avancée, Magister) ou 20 (Élite, Magister supérieur) ; classe listée dans « Promotions possibles » si ce champ est rempli | Ajoute le bonus de promotion et les dés de la nouvelle classe ; l'ancienne reste dans son emplacement. |
| Magister d'équivalence | Soutien A avec un allié de cette classe (vérifié par le MJ) | Perd les modificateurs et dés de la classe actuelle (et des classes précédentes si la nouvelle est d'un palier inférieur), ajoute ceux de la nouvelle. |

  Le niveau, les stats gagnées, les points libres, les dés achetés, les rangs d'arme et les traits sont conservés. Le Mouvement, le déplacement, le palier (malus de blessure) et les armes maniables suivent la nouvelle classe, et le trait par défaut est ajouté. Le MJ peut ignorer les conditions ou ne pas consommer l'objet. Glisser une classe sur la fiche fait la même chose, sans vérifier les conditions ni consommer d'objet.
- Le compendium du monde **FE – Catalogue** (onglet Compendiums) contient tout le catalogue par dossiers : armes, tomes, sceptres, objets, traits, classes, mots-clés. Il est mis à jour à chaque version du module ; les objets que tu y ajoutes ne sont pas touchés.
- Dans un objet Classe, chaque trait déblocable est un **lien vers le compendium** : clique pour l'ouvrir, **glisse-le sur la fiche d'une unité pour le débloquer** (son prix en PM est déduit ; un trait déjà débloqué est refusé).
- L'objet Classe contient ses **modificateurs** (classe de base) ou son **bonus de promotion** (classe avancée ou élite), ses 2 dés, ses armes, son Mouvement, son déplacement, son trait par défaut, ses mots-clés, ses promotions possibles et la liste de ses **traits déblocables avec leur prix en PM** (✓ pour ceux que l'unité possède).
- Les classes avancées et d'élite ne sont pas encore définies : crée un objet Classe (palier Avancée ou Élite) et des objets Trait dont le champ « Classe(s) » contient son nom.
- Les mots-clés (Volant, Cavalier, Blindé, Dragon, Monstre) sont dans *FE – Catalogue > Mots-clés*. Une unité a les mots-clés de sa classe (Coursier → Volant, Écuyer → Cavalier), ceux des objets Mot-clé glissés sur elle et ceux du champ libre. Le champ « Efficace contre » d'une arme se compare à ces clés.
- À la mise à jour, le module recharge toutes les fiches FE depuis les nouveaux modèles et remplit les valeurs vides (Niveau, Blessures, jetons, bonus).

Glisse un objet du catalogue sur la fiche pour le donner à l'unité.

## 4. Ce que le combat applique automatiquement

- Précision = Précision de l'arme + 2 × Tech + 5 × rang ; Esquive = 2 × (Vit − Poids) + terrain ; Attaque = For ou Mag + Puissance + 2 × rang ; Critique = Crit de l'arme + Tech/2 + 5 × rang − Vit/4 de la cible.
- Triangle selon le rang de l'unité (magie comprise : Lumière rouge, Ténèbres vert, Anima bleu) : l'unité avantagée gagne le bonus de son rang dans le type d'arme utilisé, l'unité désavantagée subit le malus du rang de l'adversaire dans son type d'arme. E : rien ; D : 2 Puissance / 4 Précision ; C : 4 / 8 ; B : 6 / 12 ; A : 8 / 16 ; S : 10 / 20. La prévision affiche le bonus ou malus à côté de l'arme.
- Chaque classe de base offre le rang D dans ses types d'arme (champ « Rang offert » de l'objet Classe) ; les fiches existantes sont mises à jour à l'installation.
- Terrain sous chaque unité, lu depuis les Régions.
- 2RN pour toucher (moyenne de deux d100), d100 simple pour le critique, ≥ 100 % touche toujours.
- Multiplicateur max((3 si critique) + (3 si efficace), 1), minimum 1 dégât.
- Double attaque à +6 de Vitesse d'attaque, riposte seulement à portée, armes sans riposte (Fulguration, Purge, Éclipse).
- Durabilité −1 par attaque (option : seulement si elle touche), arme cassée à 0.
- PV, jetons Bouclier/Ailé/Esprit, blessure de l'allié qui tombe (mort au-delà de la limite), ennemi vaincu marqué.
- Traits automatiques : Bouclier, Ailé, Esprit, Boosts, Rage, Miracle, Désespoir, Tir au pigeon, Grande corde, Être des bois, Serment, Duelliste, Forestier (déplacement), Prime (message). Activables dans la prévision, pour l'attaquant comme pour le défenseur, dans un panneau de chaque côté de la fenêtre : Piqué, Spectre, Siphon, Fracas, Surcharge (le recul de Fracas reste au MJ), et les traits à condition Garde ferme (+2 Déf), Charge (+2 For, +5 Préc), Lecture (+5 Mag) et Chasteté (+10 Préc, +3 Mag), à cocher quand la condition est remplie. Chaque panneau liste aussi les traits automatiques et ceux à gérer à la main.
- Animations JB2A via Sequencer (chemins réglables dans les paramètres du module). Critique : l'attaquant se charge, impact au sol et secousse de l'écran. Coup raté : le projectile passe à côté, avec un effet « Miss » si ton pack JB2A en a un.
- Nombres flottants qui jaillissent du jeton et rebondissent, visibles par tous : dégâts (blanc), CRITIQUE ! (jaune), Raté (gris), soins (vert). Rendu par Sequencer quand il est actif, sinon par le texte natif de Foundry. Un coup raté n'affiche que « Raté » (l'animation JB2A « Miss » est désactivée par défaut ; clé `rate` des animations pour la remettre). Réglage « Nombres de dégâts sur les jetons », propre à chaque joueur.
- Esquive : quand une attaque rate, le jeton visé fait un pas de côté puis revient sur sa case (effet visuel seulement, sa position ne change pas). Suit le réglage « Animations JB2A ».
- Coup reçu : le jeton touché tremble (plus fort sur un critique). Même réglage.
- Sons, entendus par tous : touché (un des trois sons de dégâts au hasard), critique, raté (souffle), arme brisée, unité vaincue, montée de niveau. Réglages « Sons de combat », « Volume des sons FE » et « Sons personnalisés (JSON) » (clés touche, critique, rate, arme_brisee, mort, niveau, coffre). Fichiers dans `assets/sounds/`.
- Convoi (modèle « FE – Convoi », macro « FE – Convoi ») : acteur partagé par toute l'équipe, créé à l'installation (tous les joueurs en sont propriétaires). En-tête : or, chapitre, renommée, nombre d'objets. Onglets : Tout, Armes, Tomes, Sceptres, Objets, Traits et classes, Suivi (6 compteurs à nom libre et journal de l'équipe). Colonne 📦 de l'inventaire d'une unité : envoie l'objet au convoi ; colonne 🎁 du convoi : donne l'objet au jeton sélectionné. L'or du Loot et des Primes (+25) arrive automatiquement au convoi.
- Macro « FE – Loot » (MJ) : glisse des objets (barre latérale ou compendium) dans la fenêtre, règle les quantités, l'or et la présentation (préréglages : coffre, ennemi vaincu, village, trouvaille, récompense, marchand, ou texte libre). Le message du chat porte un bouton « Récupérer » : le premier joueur qui clique donne le butin au jeton qu'il a sélectionné. Son du coffre, et le chat annonce ce qui a été gagné. Les armes arrivent non équipées ; l'or va au convoi.
- Résultat détaillé dans le chat, avec les dés.

Restent manuels : les autres traits (Mur de boucliers, Interposition, Vétéran…), les soutiens (via les bonus manuels), Booster et Magister (le Booster est appliqué, le Magister est seulement annoncé).

## 5. Terrain et déplacement

**Choisir le terrain d'une Région** : ouvre la configuration de la Région ; sous son nom, la liste **Terrain FE** propose tous les terrains (Automatique = d'après le nom). La liste des noms reconnus, bonus et coûts est aussi dans *Paramètres > FE Tactique > Voir la liste des terrains*.

**Zone à la Fire Emblem** : sélectionne une unité : cases atteignables en bleu (Mouvement, coûts du profil, murs, ennemis bloquants), portée de l'arme équipée en rouge (vert pour un sceptre). La zone se recalcule à la fin de chaque déplacement de l'unité sélectionnée. **Alt+R** sur une unité survolée (ennemie comprise) affiche ou efface sa zone. Réglage « Zone de déplacement et de portée » pour la désactiver.

**Diagnostic** : survole une case et appuie sur **Alt+T** (raccourci modifiable dans *Configurer les contrôles*) : le module affiche le terrain reconnu, les Régions qui couvrent la case et le coût pour le jeton sélectionné.

**Aedif's Tactical Grid** : la grille tactique est désactivée par défaut sur tous les calques. Active-la dans *Paramètres > Tactical Grid > World Settings > Enable Grid* (calque Tokens), ou appuie sur **G** avec le calque des jetons actif.

Une Région donne son terrain par son **nom** : `Forêt`, `Colline`, `Fort`, `Trône`, `Porte`, `Village`/`Maison`/`Église`, `Rivière`, `Gué`, `Montagne`, `Eau profonde`, `Mur`/`Bâtiment`, `Pont`, `Route`. Les cases sans Région sont des plaines. Le coût de chaque case suit la table À pied / Lourd / Monté / Monté lourd / Volant du document de conception, à partir du **profil** de la fiche ; l'infranchissable est bloqué. Paramètre du module pour désactiver.

## 6. Scène du chapitre 1

1. Crée une scène avec comme image de fond (en v14, le fond du niveau de la scène) `modules/fe-tactique/assets/maps/chap1-carte-foundry.png` (1600 × 1200), grille carrée de **100 px**, distance de grille 1 (unité « case »), sans marge de grille décalée.
2. Ouvre-la, lance **FE – Préparer le chapitre 1**.
3. Le module ajoute les Régions (montagnes, forêts, collines, rivière, grenier en fort, bâtiments, maisons et église) et 14 unités dans le dossier « FE – Chapitre 1 » : les 3 personnages des joueurs (stats de classe, à compléter : 3 points libres, 4 dés libres, 5 PM), Ysaline cachée dans l'église, Bram (recrutable, hostile au départ) et les 9 bandits.
4. Donne la propriété des 3 personnages à tes joueurs (et celle d'Ysaline et de Bram quand ils sont recrutés : pour Bram, passe aussi son Type à « Personnage secondaire » dans l'onglet Profil, son jeton devient amical et bleu).

La macro ne modifie pas une unité qui existe déjà dans le dossier « FE – Chapitre 1 ». Pour repartir d'une carte propre (après un test, ou pour prendre les stats de la dernière version) : supprime les jetons de la scène et les acteurs ennemis du dossier, puis relance la macro. Garde les 3 personnages des joueurs s'ils ont déjà placé leurs points.

Les ennemis gardent leurs stats du scénario : leur fiche n'affiche pas « À attribuer ».

## 7. Checklist de test (environ 20 minutes)

1. **Installation** : la fenêtre d'installation apparaît, les 6 modèles, le catalogue et les macros existent.
2. **Fiche** : ouvre `Mercenaire` (avant de placer ses 3 points libres). Onglet Combat : Attaque 11, Précision 109, Esquive 14 et Critique 0 avec l'Épée de bronze (rang D offert par la classe) (le Bronze ne fait pas de critique). Si une valeur affiche `?` ou `ERROR`, note-la.
3. **Équiper** : clique l'étoile d'une autre arme : une seule reste équipée, le badge du jeton change.
4. **Prévision** : Mercenaire adjacent au Bandit (H9) : la fenêtre annonce 8 dégâts à 100 %, riposte 6 à 66 %, ▲ +2 Atq +4 Préc côté Mercenaire.
5. **Combat** : clique Attaquer : animation, PV du Bandit −8, durabilité 49/50, message de chat avec les dés.
6. **Distance** : Apprentie à 2 cases du Bandit : pas de riposte (hors de portée).
7. **Terrain** : Mercenaire contre Garrec sur le grenier : 5 dégâts à 94 %, riposte 10 à 63 %.
8. **Déplacement** : glisse l'Écuyer (Monté) vers une forêt : la règle compte 3 par case de forêt ; vers la rivière, 5 ; un chemin vers une montagne est refusé.
9. **Jetons** : crée un Soldat avec *FE – Nouvelle unité* (il reçoit le trait Bouclier), fais-le frapper par un ennemi : son jeton Bouclier monte, le compteur s'affiche sur le jeton (Status Icon Counters).
10. **Chute** : mets un personnage à 1 PV et fais-le attaquer : il reçoit une blessure, le malus s'affiche.
11. **Montée de niveau** : sélectionne un jeton, lance la macro : dés dans le chat, stats et PM mis à jour.
12. **Joueur** : connecte-toi en joueur et attaque un ennemi : les PV de l'ennemi changent (le MJ doit être connecté).

Note les points qui ne marchent pas (avec le message de la console F12 si possible) : je corrigerai.

## 8. Limites connues

- Les règles de mouvement natives de Foundry v14 affichent le coût mais n'empêchent pas de dépasser le Mouvement : c'est au joueur de s'arrêter à temps.
- Les unités de plus d'une case ne sont pas gérées par le calcul de distance (Manhattan sur la case en haut à gauche).
- Les PV ne sont pas plafonnés à 50 (seules les stats de combat le sont).
- Une Région posée à la main doit avoir un nom de terrain reconnu.
