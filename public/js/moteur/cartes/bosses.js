// Données — famille Boss (11 cartes, mode solo). Pas de verso récompense : un
// Boss vaincu est retiré du jeu. Les Boss réappliquent leur effet à chaque
// tentative de combat (règles). `force` et `cartes` sont les valeurs SOLO.
// Effets persistants (« ignore… ») en PASSIF ; effets ponctuels en REVELATION.

/**
 * @typedef {object} CarteBoss
 * @property {string} id
 * @property {string} nom
 * @property {number} force
 * @property {number} cartes         Cartes à piocher pour l'affronter (solo).
 * @property {number} exemplaires
 * @property {import('./types.js').Action[]} actions
 */

/** @type {readonly CarteBoss[]} */
export const bosses = Object.freeze([
  { id: "reine-troll", nom: "Reine troll", force: 12, cartes: 6, exemplaires: 1, actions: [
    { declencheur: "PASSIF", effets: [{ type: "SPECIAL", texte: "ignore la force des Objets (OBJET)" }],
      texte: "Ignore la force des Objets" }] },

  { id: "dragon-bleu", nom: "Dragon bleu", force: 13, cartes: 4, exemplaires: 1, actions: [
    { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "détruire la prochaine carte du Château" }],
      texte: "Détruit la prochaine carte du Château" }] },

  { id: "demon", nom: "Démon", force: 14, cartes: 5, exemplaires: 1, actions: [
    { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "détruire une carte de force 1 et plus" }],
      texte: "Détruit une carte de force 1 et plus" }] },

  { id: "troll-gladiateur", nom: "Troll Gladiateur", force: 15, cartes: 6, exemplaires: 1, actions: [
    { declencheur: "REVELATION", effets: [{ type: "DEFAUSSER", valeur: 2 }], texte: "Défausser 2 cartes" }] },

  { id: "trollette", nom: "Trollette", force: 16, cartes: 7, exemplaires: 1, actions: [
    { declencheur: "PASSIF", effets: [{ type: "SPECIAL", texte: "ignore la force des cartes de force 4 ou plus" }],
      texte: "Ignore la force des cartes de force 4 ou plus" }] },

  { id: "goblinosaurus", nom: "Goblinosaurus", force: 22, cartes: 7, exemplaires: 1, actions: [
    { declencheur: "PASSIF", effets: [{ type: "SPECIAL", texte: "ignore les jetons +1 et +2 force" }],
      texte: "Ignore les jetons +1 et +2" }] },

  { id: "dragon-rouge", nom: "Dragon rouge", force: 22, cartes: 7, exemplaires: 1, actions: [
    { declencheur: "PASSIF", effets: [{ type: "SPECIAL", texte: "pour chaque action pivoter utilisée, -1 or" }],
      texte: "Pour chaque action pivoter utilisée : -1 or" }] },

  { id: "dragon-serpent", nom: "Dragon serpent", force: 22, cartes: 7, exemplaires: 1, actions: [
    { declencheur: "REVELATION", effets: [{ type: "SPECIAL", texte: "envoyer le Paysan (HUMAIN) le plus fort à l'Hôpital" }],
      texte: "Envoie ton Paysan le plus fort à l'Hôpital" }] },

  { id: "troll-geant", nom: "Troll géant", force: 22, cartes: 5, exemplaires: 1, actions: [
    { declencheur: "REVELATION", effets: [{ type: "OR", valeur: -1 }], texte: "-1 or" }] },

  { id: "les-jumeaux", nom: "Les jumeaux", force: 24, cartes: 8, exemplaires: 1, actions: [
    { declencheur: "PASSIF", effets: [{ type: "SPECIAL", texte: "la force des cartes en double est réduite à celle d'un seul exemplaire" }],
      texte: "La force des doublons est réduite à celle d'une seule d'entre elles" }] },

  { id: "dragon-vache", nom: "Dragon vache", force: 45, cartes: 9, exemplaires: 1, actions: [] },
]);
