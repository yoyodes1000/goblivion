// Données — famille Roi/Reine (7 rôles). Chaque rôle fixe l'or de départ, le
// Garde du corps initial (une carte Doré, référencée par son id) et un pouvoir
// unique jouable une seule fois par partie.

/**
 * @typedef {object} CarteRoiReine
 * @property {string} id
 * @property {string} nom
 * @property {number} ressourcesDepart              Or de départ.
 * @property {string} gardeDuCorps                  id d'une carte Doré (Garde du corps initial).
 * @property {import('./types.js').Action} pouvoir  Pouvoir unique (1× par partie).
 */

/** @type {readonly CarteRoiReine[]} */
export const roisReines = Object.freeze([
  { id: "bella", nom: "Reine Bella l'érudite", ressourcesDepart: 16, gardeDuCorps: "catapulte",
    pouvoir: { declencheur: "POUVOIR", effets: [{ type: "SPECIAL", texte: "réactiver 2 cartes en jeu" }],
      texte: "Réactive 2 cartes" } },

  { id: "jade", nom: "Reine Jade l'impitoyable", ressourcesDepart: 16, gardeDuCorps: "fou-de-guerre",
    pouvoir: { declencheur: "POUVOIR", effets: [{ type: "DETRUIRE_HOPITAL" }, { type: "PIOCHER", valeur: 2 }],
      texte: "Détruire une carte de l'Hôpital, puis piocher 2" } },

  { id: "yolo", nom: "Roi Yolo le tacticien", ressourcesDepart: 17, gardeDuCorps: "bourreau",
    pouvoir: { declencheur: "POUVOIR", effets: [
        { type: "SPECIAL", texte: "choisir une carte du Château et la poser en jeu" },
        { type: "VISION", valeur: 1 }],
      texte: "Choisir une carte du Château et la poser en jeu, puis vision 1" } },

  { id: "margot", nom: "Reine Margot la douce", ressourcesDepart: 18, gardeDuCorps: "archer",
    pouvoir: { declencheur: "POUVOIR", effets: [
        { type: "SPECIAL", texte: "mélanger l'Hôpital au Château" },
        { type: "PIOCHER", valeur: 2 }],
      texte: "Mélanger l'Hôpital à ton Château, puis piocher 2" } },

  { id: "brad", nom: "Roi Brad l'ingénieux", ressourcesDepart: 20, gardeDuCorps: "batisseur",
    pouvoir: { declencheur: "POUVOIR", effets: [
        { type: "SPECIAL", texte: "obtenir un Objet du marché et le poser en jeu" },
        { type: "OR", valeur: -3 }],
      texte: "Obtenir un Objet du marché et le poser, puis -3 or" } },

  { id: "gonzo", nom: "Roi Gonzo la lune", ressourcesDepart: 20, gardeDuCorps: "forgeron",
    pouvoir: { declencheur: "POUVOIR", effets: [{ type: "DEFAUSSER", valeur: 2 }, { type: "PIOCHER", valeur: 4 }],
      texte: "Défausser 2, puis piocher 4" } },

  { id: "loko", nom: "Roi Loko la brute", ressourcesDepart: 21, gardeDuCorps: "soldat",
    pouvoir: { declencheur: "POUVOIR", effets: [{ type: "SPECIAL", texte: "chaque Paysan (HUMAIN) gagne un jeton +2 force" }],
      texte: "Chaque Paysan gagne +2 force" } },
]);
