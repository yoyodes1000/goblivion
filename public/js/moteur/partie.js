// Moteur — l'état d'une partie et sa progression.
// Couche PURE : les fonctions renvoient un NOUVEL état gelé plutôt que de muter
// l'existant. Testable sous Node, réutilisable telle quelle par le navigateur.

import { phaseSuivante } from './phases.js';

/**
 * L'état d'une partie de Goblivion (pour l'instant réduit au cycle des tours ;
 * ressources, château, ennemis et cartes viendront s'y ajouter).
 * @typedef {object} Partie
 * @property {number} tour   Numéro du tour, à partir de 1.
 * @property {import('./phases.js').Phase} phase   Phase courante du tour.
 */

/**
 * Crée l'état de départ d'une partie (au tout début du premier tour).
 * @returns {Partie}
 */
export function nouvellePartie() {
  return Object.freeze({ tour: 1, phase: 'ENTRAINEMENT' });
}

/**
 * Fait avancer la partie d'une phase. Quand le tour reboucle (après « Combat »,
 * retour à « Entraînement »), le numéro de tour est incrémenté.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function avancerPhase(partie) {
  const phase = phaseSuivante(partie.phase);
  const tour = phase === 'ENTRAINEMENT' ? partie.tour + 1 : partie.tour;
  return Object.freeze({ tour, phase });
}
