// Données — famille Ennemi / Objet (23 cartes recto-verso : un côté ennemi, un
// côté récompense « Objet »). Saisi depuis le jeu physique (mode solo).
// `actionsEnnemi` se déclenchent à la RÉVÉLATION de l'ennemi en combat ;
// `recompense.actions` sont celles de la carte obtenue en le battant.

/**
 * Le verso « récompense » d'une carte Ennemi, obtenu en la battant.
 * @typedef {object} Recompense
 * @property {string} nom
 * @property {import('./types.js').Symbole} symbole
 * @property {number | "VARIABLE"} force
 * @property {import('./types.js').Action[]} actions
 */

/**
 * @typedef {object} CarteEnnemi
 * @property {string} id
 * @property {string} nom
 * @property {import('./types.js').Niveau} niveau   UNE_EPEE (gobelins) ou DEUX_EPEES (trolls).
 * @property {number} force
 * @property {number} cartes                        Cartes à piocher pour l'affronter.
 * @property {number} exemplaires
 * @property {import('./types.js').Action[]} actionsEnnemi   Effet(s) à la révélation.
 * @property {Recompense} recompense
 */

/** @type {readonly CarteEnnemi[]} */
export const ennemis = Object.freeze([
  { id: "gobelin-nudiste", nom: "Gobelin nudiste", niveau: "UNE_EPEE", force: 1, cartes: 1, exemplaires: 1,
    actionsEnnemi: [],
    recompense: { nom: "Slip sale", symbole: "OBJET", force: -2, actions: [] } },

  { id: "gobelin-assassin", nom: "Gobelin assassin", niveau: "UNE_EPEE", force: 3, cartes: 2, exemplaires: 2,
    actionsEnnemi: [],
    recompense: { nom: "Lames toxiques", symbole: "OBJET", force: 0, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "OR", valeur: -1 }, { type: "FORCE", valeur: 3 }],
        texte: "Pivoter : -1 or, puis jeton +3 force" }] } },

  { id: "heros-gobelin", nom: "Héros gobelin", niveau: "UNE_EPEE", force: 3, cartes: 3, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "OR", valeur: -1 }, { type: "JETON_ENNEMI", valeur: 1 }],
        texte: "À la révélation : -1 or et jeton ennemi +1 force" }],
    recompense: { nom: "Épée de feu", symbole: "OBJET", force: 1, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "doubler les jetons bonus sur une carte en jeu" }],
        texte: "Pivoter : double les jetons bonus sur une carte en jeu" }] } },

  { id: "commandant-gobelin", nom: "Commandant gobelin", niveau: "UNE_EPEE", force: 3, cartes: 2, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "JETON_ENNEMI", valeur: 2 }, { type: "ENNEMI_AVANCE" }],
        texte: "À la révélation : jeton ennemi +2 force, puis l'ennemi avance" }],
    recompense: { nom: "Casque à cornes", symbole: "OBJET", force: 1, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "les cartes Bleu gagnent un jeton +1 force" }],
        texte: "Pivoter : les cartes Bleu gagnent +1 force" }] } },

  { id: "gobelin-magicien", nom: "Gobelin magicien", niveau: "UNE_EPEE", force: 4, cartes: 3, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "OR", valeur: -2 }], texte: "À la révélation : -2 or" }],
    recompense: { nom: "Chapeau magique", symbole: "OBJET", force: 0, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "copier une action pivoter d'une carte en jeu" }],
        texte: "Pivoter : copier une action pivoter" }] } },

  { id: "gobelin-trappeur", nom: "Gobelin trappeur", niveau: "UNE_EPEE", force: 2, cartes: 2, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "JETON_ENNEMI", valeur: 2 }],
        texte: "À la révélation : jeton ennemi +2 force" }],
    recompense: { nom: "Soldat", symbole: "HUMAIN", force: "VARIABLE", actions: [
      { declencheur: "PASSIF", effets: [{ type: "SPECIAL",
          texte: "Force = 2/3/4/5 selon le nombre de Soldats en jeu (1/2/3/4 et +)" }],
        texte: "Force variable : 1 Soldat → 2, 2 → 3, 3 → 4, 4 et + → 5" }] } },

  { id: "gobelin-archer", nom: "Gobelin archer", niveau: "UNE_EPEE", force: 2, cartes: 2, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "OR", valeur: -1 }], texte: "À la révélation : -1 or" }],
    recompense: { nom: "Slip", symbole: "OBJET", force: 0, actions: [] } },

  { id: "gobelin-vachelier", nom: "Gobelin vachelier", niveau: "UNE_EPEE", force: 4, cartes: 4, exemplaires: 2,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "envoyer le Paysan le plus fort à l'Hôpital" }],
        texte: "À la révélation : envoie le Paysan le plus fort à l'Hôpital" }],
    recompense: { nom: "Marguerite", symbole: "OBJET", force: 0, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "OR", valeur: 2 }], texte: "Pivoter : +2 or" }] } },

  { id: "gobelin-pestilant", nom: "Gobelin pestilant", niveau: "UNE_EPEE", force: 2, cartes: 2, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "ignorer les jetons +1 et +2 force pour ce combat" }],
        texte: "À la révélation : ignore les jetons +1/+2 force pour ce combat" }],
    recompense: { nom: "Sac à rats", symbole: "OBJET", force: -1, actions: [
      { declencheur: "TESTAMENT", effets: [{ type: "OR", valeur: 3 }], texte: "Testament : +3 or" }] } },

  { id: "horde-gobelin", nom: "Horde Gobelin", niveau: "UNE_EPEE", force: 5, cartes: 3, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "envoyer un Paysan (HUMAIN) à l'Hôpital" }],
        texte: "À la révélation : envoie un Paysan à l'Hôpital" }],
    recompense: { nom: "Cor de chasse", symbole: "OBJET", force: 0, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "PIOCHER", valeur: 2 }], texte: "Pivoter : piocher 2" }] } },

  { id: "bebe-troll", nom: "Bébé troll", niveau: "DEUX_EPEES", force: 4, cartes: 2, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "ajouter une carte Boss" }],
        texte: "À la révélation : ajoute une carte Boss" }],
    recompense: { nom: "Hochet royal", symbole: "OBJET", force: 0, actions: [
      { declencheur: "TESTAMENT", effets: [{ type: "SPECIAL", texte: "réactiver une carte Roi/Reine" }],
        texte: "Testament : réactive une carte Roi/Reine" }] } },

  { id: "sorciere-troll", nom: "Sorcière troll", niveau: "DEUX_EPEES", force: 6, cartes: 3, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "détruire 1 Paysan (HUMAIN) en jeu" }],
        texte: "À la révélation : détruire 1 Paysan" }],
    recompense: { nom: "Balai maudit", symbole: "OBJET", force: 2, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "DETRUIRE_JEU" }, { type: "PIOCHER", valeur: 1 }],
        texte: "Pivoter : détruire une carte en jeu, puis piocher 1" }] } },

  { id: "troll-saboteur", nom: "Troll saboteur", niveau: "DEUX_EPEES", force: 7, cartes: 3, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "vous ne gagnez aucun or pour ce combat" }],
        texte: "À la révélation : aucun or gagné ce combat" }],
    recompense: { nom: "Super outil", symbole: "OBJET", force: 2, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "OR", valeur: 2 }], texte: "Pivoter : +2 or" }] } },

  { id: "roi-troll", nom: "Roi Troll", niveau: "DEUX_EPEES", force: 8, cartes: 3, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "JETON_ENNEMI", valeur: 2 }, { type: "OR", valeur: -2 }, { type: "ENNEMI_AVANCE" }],
        texte: "À la révélation : jeton ennemi +2 force, -2 or, puis l'ennemi avance" }],
    recompense: { nom: "Cape royale", symbole: "OBJET", force: 0, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "chaque Paysan (HUMAIN) gagne un jeton +1 force" }],
        texte: "Pivoter : chaque Paysan gagne +1 force" }] } },

  { id: "troll-esclavagiste", nom: "Troll esclavagiste", niveau: "DEUX_EPEES", force: 9, cartes: 3, exemplaires: 1,
    actionsEnnemi: [],
    recompense: { nom: "Joker", symbole: "HUMAIN", force: "VARIABLE", actions: [
      { declencheur: "PASSIF", effets: [{ type: "SPECIAL",
          texte: "à son arrivée en jeu, prend toutes les caractéristiques (force et capacités) d'un Paysan en jeu, Bleu ou Doré" }],
        texte: "Copie un Paysan en jeu (Bleu ou Doré) à son arrivée" }] } },

  { id: "troll-mage", nom: "Troll mage", niveau: "DEUX_EPEES", force: 10, cartes: 4, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "JETON_ENNEMI", valeur: 2 }, { type: "OR", valeur: -3 }],
        texte: "À la révélation : jeton ennemi +2 force, -3 or" }],
    recompense: { nom: "Livre de sort", symbole: "OBJET", force: 3, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "DEFAUSSER", valeur: 2 }, { type: "PIOCHER", valeur: 2 }],
        texte: "Pivoter : défausser 2, puis piocher 2" }] } },

  { id: "booba-brise-fer", nom: "Booba Brise-Fer", niveau: "DEUX_EPEES", force: 10, cartes: 4, exemplaires: 1,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "détruire 1 Objet (OBJET) en jeu" }],
        texte: "À la révélation : détruire 1 Objet" }],
    recompense: { nom: "Aimant", symbole: "OBJET", force: 0, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "ramener un Objet (OBJET) de l'Hôpital en jeu" }],
        texte: "Pivoter : ramener un Objet de l'Hôpital en jeu" }] } },

  { id: "troll-glouton", nom: "Troll glouton", niveau: "DEUX_EPEES", force: 11, cartes: 4, exemplaires: 2,
    actionsEnnemi: [],
    recompense: { nom: "Machette", symbole: "OBJET", force: 1, actions: [
      { declencheur: "PIVOTER", effets: [{ type: "DETRUIRE_HOPITAL" }],
        texte: "Pivoter : détruire une carte de l'Hôpital" }] } },

  { id: "trollolole", nom: "Trollolole", niveau: "DEUX_EPEES", force: 12, cartes: 4, exemplaires: 2,
    actionsEnnemi: [
      { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "détruire la prochaine carte du Château" }],
        texte: "À la révélation : détruire la prochaine carte du Château" }],
    recompense: { nom: "Couteau géant", symbole: "OBJET", force: 4, actions: [] } },
]);
