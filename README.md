# FE Tactique 0.2.0 – guide d'installation et de test

Module pour **Foundry VTT v14** (testé sur le papier pour le build 365) et **Custom System Builder 6.1.2**.
Il ajoute à un monde CSB : la fiche d'unité, les armes/tomes/sceptres/objets/traits, la fenêtre de prévision de combat, la montée de niveau, les états à compteurs, le badge d'arme sur les jetons, le terrain par Régions avec les coûts de déplacement par profil, et la scène du chapitre 1.

> Le module n'a pas pu être lancé dans Foundry pendant sa fabrication. Les calculs de combat ont été vérifiés hors Foundry contre les repères de la campagne test, mais l'affichage et les appels Foundry/CSB sont à valider avec la checklist plus bas.

## 1. Installation

### Foundry installé sur ton PC
1. Ferme le monde.
2. Dézippe `fe-tactique-0.2.0.zip` dans `%LOCALAPPDATA%\FoundryVTT\Data\modules\` : tu dois obtenir `...\modules\fe-tactique\module.json`.
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
| FE – Montée de niveau | Lance les réserves de d6 de l'unité sélectionnée, applique les gains, l'EXP et les PM. |
| FE – Acheter un dé de stat | 3 PM le dé, dans la limite du niveau. |
| FE – Fin de phase | Expire Silence et bonus temporaires du camp qui finit, soigne 10 % sur fort/trône/porte pour le camp qui commence. |
| FE – Bonus temporaire | Bonus ou malus chiffré sur les unités sélectionnées, avec expiration. |
| FE – Nouvelle unité | Crée une unité depuis une des 12 classes de base. |
| FE – Nouveau chapitre | Remet les jetons Bouclier, Ailé et Esprit à zéro. |
| FE – Préparer le chapitre 1 | Remplit la scène affichée : Régions de terrain et jetons. |

## 3. La fiche d'unité

| Zone | Contenu |
|---|---|
| En-tête | Tableau Classe · Niveau · EXP · PM · PV / max · Blessures (et malus), puis la barre de PV. |
| Combat | Tableau de prévision (Arme, Portée, Atq, Préc, Crit, Esq, Vit. att., Esq. crit) avec l'arme équipée, jetons Bouclier/Ailé/Esprit, armes (☆ pour équiper), bonus manuels dans un bloc repliable. |
| Stats | Tableau Stat · Base · En combat · Dés pour PV, For, Mag, Déf, Rés, Tech, Vit et Mouvement ; rangs d'arme sur une ligne. |
| Traits | Emplacements équipés et liste des traits (☆ pour équiper ; 4 emplacements, +2 tous les 10 niveaux). |
| Inventaire | Objets avec bouton *Utiliser*, notes. |
| Profil | Rôle, palier, déplacement, mots-clés de l'unité ; objet Classe ; objets Mot-clé ; mots-clés libres. |

### Classes et mots-clés (objets)

- Les 12 classes sont dans *FE – Catalogue > Classes*. **Glisse une classe sur une unité** : elle remplace l'ancienne, règle le palier, le déplacement et le Mouvement, et ajoute le trait par défaut. Sur une unité **niveau 1**, elle remplit aussi les stats de base, les PV et les dés de classe ; au-delà, les stats sont conservées (promotion).
- Les mots-clés (Volant, Cavalier, Blindé, Dragon, Monstre) sont dans *FE – Catalogue > Mots-clés*. Une unité a les mots-clés de sa classe (Coursier → Volant, Écuyer → Cavalier), ceux des objets Mot-clé glissés sur elle et ceux du champ libre. Le champ « Efficace contre » d'une arme se compare à ces clés.
- À la mise à jour, le module recharge toutes les fiches FE depuis les nouveaux modèles et remplit les valeurs vides (Niveau, Blessures, jetons, bonus).

Glisse un objet du catalogue sur la fiche pour le donner à l'unité.

## 4. Ce que le combat applique automatiquement

- Précision = Précision de l'arme + 2 × Tech + 5 × rang ; Esquive = 2 × (Vit − Poids) + terrain ; Attaque = For ou Mag + Puissance + 2 × rang ; Critique = Crit de l'arme + Tech/2 + 5 × rang − Vit/4 de la cible.
- Triangle ±5 Atq / ±15 Préc (magie comprise : Lumière rouge, Ténèbres vert, Anima bleu).
- Terrain sous chaque unité, lu depuis les Régions.
- 2RN pour toucher (moyenne de deux d100), d100 simple pour le critique, ≥ 100 % touche toujours.
- Multiplicateur max((3 si critique) + (3 si efficace), 1), minimum 1 dégât.
- Double attaque à +6 de Vitesse d'attaque, riposte seulement à portée, armes sans riposte (Fulguration, Purge, Éclipse).
- Durabilité −1 par attaque (option : seulement si elle touche), arme cassée à 0.
- PV, jetons Bouclier/Ailé/Esprit, blessure de l'allié qui tombe (mort au-delà de la limite), ennemi vaincu marqué.
- Traits automatiques : Bouclier, Ailé, Esprit, Boosts, Rage, Miracle, Désespoir, Tir au pigeon, Grande corde, Être des bois, Serment, Duelliste, Forestier (déplacement), Prime (message). Activables dans la prévision : Piqué, Spectre, Siphon, Fracas, Surcharge (le recul de Fracas reste au MJ).
- Animations JB2A via Sequencer (chemins réglables dans les paramètres du module).
- Résultat détaillé dans le chat, avec les dés.

Restent manuels : les autres traits (Garde ferme, Charge, Mur de boucliers, Interposition, Vétéran…), les soutiens (via les bonus manuels), Booster et Magister (le Booster est appliqué, le Magister est seulement annoncé).

## 5. Terrain et déplacement

Une Région donne son terrain par son **nom** : `Forêt`, `Colline`, `Fort`, `Trône`, `Porte`, `Village`/`Maison`/`Église`, `Rivière`, `Gué`, `Montagne`, `Eau profonde`, `Mur`/`Bâtiment`, `Pont`, `Route`. Les cases sans Région sont des plaines. Le coût de chaque case suit la table À pied / Lourd / Monté / Monté lourd / Volant du document de conception, à partir du **profil** de la fiche ; l'infranchissable est bloqué. Paramètre du module pour désactiver.

## 6. Scène du chapitre 1

1. Crée une scène avec comme image de fond (en v14, le fond du niveau de la scène) `modules/fe-tactique/assets/maps/chap1-carte-foundry.png` (1600 × 1200), grille carrée de **100 px**, distance de grille 1 (unité « case »), sans marge de grille décalée.
2. Ouvre-la, lance **FE – Préparer le chapitre 1**.
3. Le module ajoute les Régions (montagnes, forêts, collines, rivière, grenier en fort, bâtiments, maisons et église) et 14 unités dans le dossier « FE – Chapitre 1 » : les 3 personnages des joueurs (stats de classe, à compléter : 3 points libres, 6 dés libres, 5 PM), Ysaline cachée dans l'église, Bram (recrutable, hostile au départ) et les 9 bandits.
4. Donne la propriété des 3 personnages à tes joueurs.

## 7. Checklist de test (environ 20 minutes)

1. **Installation** : la fenêtre d'installation apparaît, les 6 modèles, le catalogue et les 9 macros existent.
2. **Fiche** : ouvre `Mercenaire`. Onglet Combat : Attaque 9, Précision 102, Esquive 12 et Critique 0 avec l'Épée de bronze (le Bronze ne fait pas de critique). Si une valeur affiche `?` ou `ERROR`, note-la.
3. **Équiper** : clique l'étoile d'une autre arme : une seule reste équipée, le badge du jeton change.
4. **Prévision** : Mercenaire adjacent au Bandit (H9) : la fenêtre annonce 9 dégâts à 100 %, riposte 2 à 52 %, ▲ côté Mercenaire.
5. **Combat** : clique Attaquer : animation, PV du Bandit −9, durabilité 49/50, message de chat avec les dés.
6. **Distance** : Apprentie à 2 cases du Bandit : pas de riposte (hors de portée).
7. **Terrain** : Mercenaire contre Garrec sur le grenier : 6 dégâts à 98 %, riposte 6 à 49 %.
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
