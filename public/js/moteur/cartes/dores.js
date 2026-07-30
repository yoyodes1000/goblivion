// Données — famille Doré (le marché d'entraînement : 12 types, 40 exemplaires).
// Saisi depuis le jeu physique (mode solo). Actions formalisées en effets
// (voir ./types.js). `entrainement` = le coût au bas de la carte (piocher /
// cible / symbole à sacrifier).

/**
 * Coût d'entraînement, lu au bas de la carte Doré (gauche → droite).
 * @typedef {object} Entrainement
 * @property {number} piocher   Cartes à piocher du Château (A).
 * @property {number} cible     Force à atteindre (B).
 * @property {import('./types.js').Symbole} echange  Symbole de la carte à sacrifier (C).
 */

/**
 * @typedef {object} CarteDore
 * @property {string} id
 * @property {string} nom
 * @property {import('./types.js').Symbole} symbole
 * @property {import('./types.js').Niveau} niveau     UNE_EPEE ou DEUX_EPEES.
 * @property {number | "VARIABLE"} force              "VARIABLE" = force calculée (ex. Soldat).
 * @property {number} exemplaires
 * @property {Entrainement} entrainement
 * @property {import('./types.js').Action[]} actions
 */

/** @type {readonly CarteDore[]} */
export const dores = Object.freeze([
  { id: "soldat", nom: "Soldat", symbole: "HUMAIN", niveau: "UNE_EPEE", force: "VARIABLE", exemplaires: 4,
    entrainement: { piocher: 3, cible: 2, echange: "HUMAIN" }, actions: [
      { declencheur: "PASSIF", effets: [{ type: "SPECIAL",
          texte: "Force = 2/3/4/5 selon le nombre de Soldats en jeu (1/2/3/4 et +)" }],
        texte: "Force variable : 1 Soldat → 2, 2 → 3, 3 → 4, 4 et + → 5" }] },

  { id: "batisseur", nom: "Bâtisseur", symbole: "HUMAIN", niveau: "UNE_EPEE", force: 1, exemplaires: 4,
    entrainement: { piocher: 4, cible: 2, echange: "HUMAIN" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "OR", valeur: 1 }], texte: "Pivoter : +1 or" }] },

  { id: "bourreau", nom: "Bourreau", symbole: "HUMAIN", niveau: "UNE_EPEE", force: 1, exemplaires: 4,
    entrainement: { piocher: 4, cible: 2, echange: "HUMAIN" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "DETRUIRE_JEU" }, { type: "FORCE", valeur: 2 }],
        texte: "Pivoter : détruire une carte en jeu, puis +2 force" }] },

  { id: "champion", nom: "Champion", symbole: "HUMAIN", niveau: "UNE_EPEE", force: 3, exemplaires: 2,
    entrainement: { piocher: 4, cible: 3, echange: "HUMAIN" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "détruire un jeton bonus ennemi" }],
        texte: "Pivoter : détruire un jeton bonus ennemi" }] },

  { id: "pretre", nom: "Prêtre", symbole: "HUMAIN", niveau: "UNE_EPEE", force: 2, exemplaires: 2,
    entrainement: { piocher: 3, cible: 3, echange: "HUMAIN" }, actions: [
      { declencheur: "GARDE_DU_CORPS", effets: [{ type: "SPECIAL",
          texte: "ramener un Paysan (HUMAIN) de l'Hôpital en jeu avec +1 force" }],
        texte: "Quand cette carte devient Garde du corps : ramener un Paysan de l'Hôpital en jeu avec +1 force" }] },

  { id: "archer", nom: "Archer", symbole: "HUMAIN", niveau: "UNE_EPEE", force: 2, exemplaires: 4,
    entrainement: { piocher: 3, cible: 2, echange: "HUMAIN" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "CHOIX", options: [
            [{ type: "PIOCHER", valeur: 1 }],
            [{ type: "VISION", valeur: 1 }]] }],
        texte: "Pivoter : au choix, piocher 1 OU générer 1 vision" }] },

  { id: "fou-de-guerre", nom: "Fou de guerre", symbole: "HUMAIN", niveau: "DEUX_EPEES", force: 4, exemplaires: 4,
    entrainement: { piocher: 3, cible: 4, echange: "HUMAIN" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "DETRUIRE_HOPITAL" }],
        texte: "Pivoter : détruire une carte de l'Hôpital" }] },

  { id: "chevalier", nom: "Chevalier", symbole: "HUMAIN", niveau: "DEUX_EPEES", force: 5, exemplaires: 2,
    entrainement: { piocher: 4, cible: 8, echange: "HUMAIN" }, actions: [
      { declencheur: "ENTRAINEMENT", effets: [{ type: "SPECIAL", texte: "obtenir une carte Épée" }],
        texte: "Lorsque tu entraînes cette carte : obtenir une carte Épée (pas besoin de sacrifier de Paysan pour la 2e carte)" }] },

  { id: "protecteur-mecanique", nom: "Protecteur mécanique", symbole: "OBJET", niveau: "DEUX_EPEES", force: 6, exemplaires: 4,
    entrainement: { piocher: 4, cible: 6, echange: "OBJET" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "+1 force pour chaque Objet (OBJET) à l'Hôpital" }],
        texte: "Pivoter : +1 force pour chaque Objet à l'Hôpital" }] },

  { id: "forgeron", nom: "Forgeron", symbole: "HUMAIN", niveau: "DEUX_EPEES", force: 2, exemplaires: 4,
    entrainement: { piocher: 3, cible: 4, echange: "HUMAIN" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "ramener un Objet (OBJET) de l'Hôpital en jeu" }],
        texte: "Pivoter : ramener un Objet de l'Hôpital en jeu" }] },

  { id: "bro", nom: "BRO", symbole: "HUMAIN", niveau: "DEUX_EPEES", force: 3, exemplaires: 2,
    entrainement: { piocher: 3, cible: 6, echange: "HUMAIN" }, actions: [
      { declencheur: "GARDE_DU_CORPS", effets: [{ type: "PIOCHER", valeur: 2 }],
        texte: "Quand cette carte devient Garde du corps : piocher 2" }] },

  { id: "catapulte", nom: "Catapulte", symbole: "OBJET", niveau: "DEUX_EPEES", force: 3, exemplaires: 4,
    entrainement: { piocher: 4, cible: 6, echange: "OBJET" }, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "DEFAUSSER" }, { type: "PIOCHER", valeur: 2 }],
        texte: "Pivoter : défausser 1 carte en jeu, puis piocher 2" }] },
]);
