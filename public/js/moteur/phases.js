// Moteur — le cycle des phases d'un tour.
// Couche PURE : aucune dépendance au DOM ni à l'extérieur. Testable sous Node.

/**
 * Les trois phases d'un tour, dans l'ordre où elles s'enchaînent (voir règles :
 * Entraînement → L'Ennemi Avance → Combat).
 * @typedef {'ENTRAINEMENT' | 'ENNEMI_AVANCE' | 'COMBAT'} Phase
 */

/** @type {readonly Phase[]} */
export const ORDRE_PHASES = Object.freeze(['ENTRAINEMENT', 'ENNEMI_AVANCE', 'COMBAT']);

/**
 * Rend la phase qui suit `phase` dans le cycle. Après « Combat », on repart à
 * « Entraînement » : c'est un nouveau tour (géré par le moteur de partie).
 * @param {Phase} phase
 * @returns {Phase}
 */
export function phaseSuivante(phase) {
  const suivant = (ORDRE_PHASES.indexOf(phase) + 1) % ORDRE_PHASES.length;
  // Le modulo garantit un index valide ; l'assertion satisfait
  // noUncheckedIndexedAccess sans introduire de branche morte.
  return /** @type {Phase} */ (ORDRE_PHASES[suivant]);
}
