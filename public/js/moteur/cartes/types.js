// Types partagés des cartes (JSDoc uniquement — pas de code exécutable).
// Le "langage d'effets" ci-dessous formalise les icônes du livret (p.7) pour que
// les actions soient des données exploitables par le moteur, pas du texte libre.

/**
 * Symbole d'une carte : visage (Humain/Paysan) ou sac (Objet). C'est ce que
 * compare le processus d'entraînement quand il faut détruire une carte.
 * @typedef {"HUMAIN" | "OBJET"} Symbole
 */

/**
 * Rang d'une carte (icône bannière) : du plus faible au plus fort.
 * POING = cartes Bleu de base ; UNE_EPEE / DEUX_EPEES = marché Doré.
 * @typedef {"POING" | "UNE_EPEE" | "DEUX_EPEES"} Niveau
 */

/**
 * Quand une action se déclenche.
 * - PIVOTER : action activée en tournant la carte à 90°.
 * - TESTAMENT : au moment où la carte est détruite.
 * - GARDE_DU_CORPS : quand la carte devient Garde du corps.
 * - PASSIF : effet permanent, sans activation (ex. force variable du Soldat).
 * - ENTRAINEMENT : au moment où l'on entraîne (acquiert) la carte.
 * - REVELATION : effet d'une carte Ennemi au moment où elle est révélée en combat.
 * @typedef {"PIVOTER" | "TESTAMENT" | "GARDE_DU_CORPS" | "PASSIF" | "ENTRAINEMENT" | "REVELATION"} Declencheur
 */

/**
 * Vocabulaire des effets élémentaires (une icône = un type).
 * - PIOCHER : piocher `valeur` cartes (flèche verte).
 * - DEFAUSSER : défausser `valeur` autre(s) carte(s) en jeu vers l'Hôpital (défaut 1).
 * - DETRUIRE_JEU : détruire une carte en jeu (retirée du jeu, définitif).
 * - DETRUIRE_HOPITAL : détruire une carte de l'Hôpital (retirée du jeu).
 * - OR : gagner/perdre `valeur` ressources (jeton pièce ; valeur signée).
 * - FORCE : poser un jeton bonus de `valeur` force sur la carte activée.
 * - JETON_ENNEMI : l'ennemi se pose un jeton bonus de `valeur` force sur lui-même.
 * - VISION : générer `valeur` vision (œil).
 * - ENNEMI_AVANCE : l'ennemi avance (flèche gobelin).
 * - CHOIX : jouer UNE seule des branches de `options`.
 * - SPECIAL : effet propre à la carte, sans icône standard (voir `texte`).
 * @typedef {"PIOCHER" | "DEFAUSSER" | "DETRUIRE_JEU" | "DETRUIRE_HOPITAL" | "OR" | "FORCE" | "JETON_ENNEMI" | "VISION" | "ENNEMI_AVANCE" | "CHOIX" | "SPECIAL"} TypeEffet
 */

/**
 * Un effet élémentaire d'une action.
 * @typedef {object} Effet
 * @property {TypeEffet} type
 * @property {number} [valeur]      Ex. PIOCHER 2, OR -1, FORCE 2, VISION 1.
 * @property {Effet[][]} [options]  Pour CHOIX : les branches possibles.
 * @property {string} [texte]       Pour SPECIAL : description de l'effet.
 */

/**
 * Une action portée par une carte.
 * @typedef {object} Action
 * @property {Declencheur} declencheur
 * @property {Effet[]} effets
 * @property {string} [texte]       Libellé lisible d'origine.
 */

export {};
