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
 *
 * `jetonsIgnores` annule les jetons bonus pour ce calcul (Gobelin pestilant :
 * « ignore les jetons +1 et +2 force pour ce combat ») : la force imprimée,
 * elle, reste acquise.
 * @param {InstanceAlliee} carte
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @param {boolean} [jetonsIgnores]
 * @returns {number}
 */
export function forceCarte(carte, champDeBataille, jetonsIgnores = false) {
  const bonus = jetonsIgnores ? 0 : (carte.jetonBonus ?? 0);
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
 * Somme des forces des cartes en jeu sur le Champ de bataille. Le Garde du
 * corps n'en fait pas partie : c'est une zone à part, hors du calcul.
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @param {boolean} [jetonsIgnores]   Voir `forceCarte`.
 * @returns {number}
 */
export function forceTotale(champDeBataille, jetonsIgnores = false) {
  return champDeBataille.reduce(
    (somme, carte) => somme + forceCarte(carte, champDeBataille, jetonsIgnores),
    0,
  );
}
