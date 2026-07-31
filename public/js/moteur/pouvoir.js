// Moteur — activer le pouvoir Roi/Reine (règles p.15) : effet unique, une
// seule fois par partie. Couche PURE, aléa injecté.

import { executerEffets } from './effets.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * Active le pouvoir du Roi/Reine de la partie : exécute ses effets (voir
 * `executerEffets`) puis marque le pouvoir utilisé pour le reste de la
 * partie. Refuse s'il l'est déjà.
 * @param {Partie} partie
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function activerPouvoir(partie, choix, rng) {
  if (partie.pouvoirUtilise) {
    throw new Error('Le pouvoir Roi/Reine a déjà été utilisé cette partie');
  }

  const { partie: etat, reconstitutions } = executerEffets(
    partie,
    partie.roiReine.pouvoir.effets,
    choix,
    rng,
  );

  return {
    partie: Object.freeze({ ...etat, pouvoirUtilise: true }),
    reconstitutions,
  };
}
