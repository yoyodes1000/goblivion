// Moteur — le cycle des phases d'un tour.
// Couche PURE : aucune dépendance au DOM ni à l'extérieur. Testable sous Node.

/**
 * Les phases d'une partie. Les trois premières s'enchaînent en cycle (voir
 * règles : Entraînement → L'Ennemi Avance → Combat, cf. `phaseSuivante`).
 * `COMBAT_BOSS` n'en fait pas partie : on n'y entre qu'une fois, depuis
 * L'Ennemi Avance (voir `orchestration.js`), et on n'en ressort jamais vers
 * Entraînement — plus d'Entraînement une fois les Boss engagés, on les
 * retente jusqu'à victoire ou défaite.
 * @typedef {'ENTRAINEMENT' | 'ENNEMI_AVANCE' | 'COMBAT' | 'COMBAT_BOSS'} Phase
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
