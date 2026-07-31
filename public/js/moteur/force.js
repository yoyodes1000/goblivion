// Moteur — calcul de la force au combat des cartes en jeu. Couche PURE.

/** @typedef {import('./partie.js').InstanceAlliee} InstanceAlliee */

/**
 * Force d'un Soldat selon le nombre de Soldats en jeu : 1→2, 2→3, 3→4, 4+→5.
 * @param {number} nbSoldats
 * @returns {number}
 */
function forceSoldat(nbSoldats) {
  return Math.min(nbSoldats + 1, 5);
}

/**
 * Force au combat d'une carte alliée en jeu : sa force imprimée (ou le barème
 * du Soldat, force variable) plus son éventuel jeton bonus (effet FORCE, voir
 * `effets.js`). Les autres forces « VARIABLE » (ex. Joker) ne sont pas encore
 * gérées et ne comptent que leur jeton bonus, le cas échéant.
 * @param {InstanceAlliee} carte
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @returns {number}
 */
export function forceCarte(carte, champDeBataille) {
  const bonus = carte.jetonBonus ?? 0;
  if (typeof carte.type.force === 'number') {
    return carte.type.force + bonus;
  }
  if (carte.type.id === 'soldat') {
    const nbSoldats = champDeBataille.filter((c) => c.type.id === 'soldat').length;
    return forceSoldat(nbSoldats) + bonus;
  }
  return bonus;
}

/**
 * Somme des forces des cartes en jeu sur le Champ de bataille.
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @returns {number}
 */
export function forceTotale(champDeBataille) {
  return champDeBataille.reduce((somme, carte) => somme + forceCarte(carte, champDeBataille), 0);
}
