// Données — famille Bleu / Paysan de base (les 40 cartes de départ).
// Saisi depuis le jeu physique. Les actions sont formalisées en effets
// (voir ./types.js). `actions: []` = carte sans action.
// niveau implicite POING et catégorie PAYSAN_BASE (constants pour la famille).

/**
 * @typedef {object} CartePaysanBase
 * @property {string} id
 * @property {string} nom
 * @property {import('./types.js').Symbole} symbole
 * @property {number} force                              Peut être négative.
 * @property {number} exemplaires                        Copies dans les 40 Bleu.
 * @property {import('./types.js').Action[]} actions
 */

/** @type {readonly CartePaysanBase[]} */
export const paysansBase = Object.freeze([
  { id: "alchimiste", nom: "Alchimiste", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "DEFAUSSER" }, { type: "PIOCHER", valeur: 1 }],
      texte: "Pivoter : défausser une autre carte à l'Hôpital, puis piocher 1" }] },

  { id: "artiste", nom: "Artiste", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "DEFAUSSER" }, { type: "OR", valeur: 1 }],
      texte: "Pivoter : défausser une autre carte à l'Hôpital, puis +1 or" }] },

  { id: "aubergiste", nom: "Aubergiste", symbole: "HUMAIN", force: -2, exemplaires: 1, actions: [] },

  { id: "aventurier", nom: "Aventurier", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "DEFAUSSER" }, { type: "FORCE", valeur: 2 }],
      texte: "Pivoter : défausser une autre carte à l'Hôpital, puis +2 force" }] },

  { id: "boulanger", nom: "Boulanger", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "OR", valeur: 1 }], texte: "Pivoter : +1 or" }] },

  { id: "bucheron", nom: "Bûcheron", symbole: "HUMAIN", force: 1, exemplaires: 3, actions: [] },

  { id: "chasseur", nom: "Chasseur", symbole: "HUMAIN", force: 1, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "OR", valeur: 1 }], texte: "Pivoter : +1 or" }] },

  { id: "duc", nom: "Duc", symbole: "HUMAIN", force: 1, exemplaires: 1, actions: [
    { declencheur: "TESTAMENT", effets: [{ type: "OR", valeur: 3 }], texte: "Testament : +3 or" }] },

  { id: "enfant", nom: "Enfant", symbole: "HUMAIN", force: -2, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "DETRUIRE_HOPITAL" }],
      texte: "Pivoter : détruire une carte de l'Hôpital" }] },

  { id: "epee", nom: "Épée", symbole: "OBJET", force: 1, exemplaires: 3, actions: [] },

  { id: "fermier", nom: "Fermier", symbole: "HUMAIN", force: 0, exemplaires: 12, actions: [] },

  { id: "gentilhomme", nom: "Gentilhomme", symbole: "HUMAIN", force: 2, exemplaires: 1, actions: [] },

  { id: "grimoire", nom: "Grimoire", symbole: "OBJET", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "PIOCHER", valeur: 2 }], texte: "Pivoter : piocher 2" }] },

  { id: "heros-du-village", nom: "Héros du village", symbole: "HUMAIN", force: 2, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [
        { type: "OR", valeur: -1 },
        { type: "SPECIAL", texte: "compte comme un Soldat pour cette phase" }],
      texte: "Pivoter : payer 1 or, puis compte comme un Soldat pour cette phase" }] },

  { id: "mendiant", nom: "Mendiant", symbole: "HUMAIN", force: -1, exemplaires: 1, actions: [] },

  { id: "nain", nom: "Nain", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [{ type: "SPECIAL", texte: "chaque Objet en jeu gagne +1 force" }],
      texte: "Pivoter : chaque Objet en jeu gagne +1 force" }] },

  { id: "oracle", nom: "Oracle", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "GARDE_DU_CORPS", effets: [{ type: "VISION", valeur: 1 }],
      texte: "Quand cette carte devient Garde du corps : générer 1 vision" }] },

  { id: "patron", nom: "Patron", symbole: "HUMAIN", force: 1, exemplaires: 1, actions: [
    { declencheur: "GARDE_DU_CORPS", effets: [{ type: "PIOCHER", valeur: 1 }],
      texte: "Quand cette carte devient Garde du corps : piocher 1" }] },

  { id: "percepteur-d-impots", nom: "Percepteur d'impôts", symbole: "HUMAIN", force: -1, exemplaires: 1, actions: [] },

  { id: "pickpocket", nom: "Pickpocket", symbole: "HUMAIN", force: -1, exemplaires: 1, actions: [] },

  { id: "pyromane-fou", nom: "Pyromane Fou", symbole: "HUMAIN", force: -2, exemplaires: 1, actions: [
    { declencheur: "TESTAMENT", effets: [{ type: "VISION", valeur: 1 }], texte: "Testament : générer 1 vision" }] },

  { id: "scouts", nom: "Scouts", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "PIVOTER", effets: [
        { type: "CHOIX", options: [
            [{ type: "FORCE", valeur: 2 }],
            [{ type: "VISION", valeur: 1 }]] }],
      texte: "Pivoter : au choix, +2 force OU générer 1 vision" }] },

  { id: "traitre", nom: "Traître", symbole: "HUMAIN", force: 0, exemplaires: 1, actions: [
    { declencheur: "TESTAMENT", effets: [{ type: "ENNEMI_AVANCE" }], texte: "Testament : l'ennemi avance" }] },

  { id: "vieux", nom: "Vieux", symbole: "HUMAIN", force: -1, exemplaires: 1, actions: [] },

  { id: "voleur", nom: "Voleur", symbole: "HUMAIN", force: -1, exemplaires: 1, actions: [] },
]);
