// Moteur — décide quand enchaîner quoi entre les phases. Couche PURE.
//
// Ne couvre pour l'instant que la bascule L'Ennemi Avance → combat des Boss
// (règles : « quand la pile ET la piste sont vides, on détruit les ennemis
// restés aux Portes et on passe au combat des Boss »). Le reste d'un tour
// (jouer des cartes, choisir de passer à la phase suivante pendant
// Entraînement/Combat) est piloté par le joueur — donc par l'UI, pas par le
// moteur : rien à orchestrer ici pour ça.

import { avancerPhase } from './partie.js';
import { pisteEtPileVides } from './ennemi-avance.js';

/** @typedef {import('./partie.js').Partie} Partie */

/**
 * Détruit les ennemis restés aux Portes (« l'ennemi n'arrête jamais » ne
 * s'applique plus une fois la pile et la piste épuisées : ceux qui restent
 * aux Portes sont retirés du jeu avant le combat des Boss).
 * @param {Partie} partie
 * @returns {Partie}
 */
export function detruireEnnemisAuxPortes(partie) {
  return Object.freeze({ ...partie, portes: [] });
}

/**
 * Termine la phase L'Ennemi Avance : bascule vers le combat des Boss si la
 * pile et la piste sont vides (détruit d'abord les ennemis restés aux
 * Portes ; pas d'incrément de `tour`, ce n'est pas un nouveau tour au sens
 * Entraînement mais un changement de mode) — sinon avance normalement au
 * cycle habituel via `avancerPhase`.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function terminerPhaseEnnemiAvance(partie) {
  if (pisteEtPileVides(partie)) {
    return Object.freeze({ ...detruireEnnemisAuxPortes(partie), phase: 'COMBAT_BOSS' });
  }
  return avancerPhase(partie);
}
