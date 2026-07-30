// Moteur — l'état complet d'une partie solo et sa progression.
// Couche PURE : les fonctions renvoient un NOUVEL état gelé plutôt que de muter
// l'existant. Testable sous Node, réutilisable telle quelle par le navigateur.

import { phaseSuivante } from './phases.js';

/** @typedef {import('./cartes/paysans-base.js').CartePaysanBase} CartePaysanBase */
/** @typedef {import('./cartes/ennemis.js').CarteEnnemi} CarteEnnemi */
/** @typedef {import('./cartes/bosses.js').CarteBoss} CarteBoss */
/** @typedef {import('./cartes/rois-reines.js').CarteRoiReine} CarteRoiReine */
/** @typedef {import('./cartes/types.js').CarteAlliee} CarteAlliee */

/** @typedef {{ instanceId: string, type: CartePaysanBase }} InstancePaysan */
/** @typedef {{ instanceId: string, type: CarteAlliee }} InstanceAlliee */
/** @typedef {{ instanceId: string, type: CarteEnnemi }} InstanceEnnemi */
/** @typedef {{ instanceId: string, type: CarteBoss }} InstanceBoss */

/**
 * Une pile du marché Doré : un type et le nombre de copies encore disponibles.
 * @typedef {object} PileDore
 * @property {string} typeId
 * @property {number} restant
 */

/**
 * Un ennemi présent sur la piste, avec son état de révélation.
 * @typedef {object} EnnemiSurPiste
 * @property {InstanceEnnemi} instance
 * @property {boolean} revele
 */

/**
 * État complet et immuable d'une partie solo.
 * @typedef {object} Partie
 * @property {number} tour
 * @property {import('./phases.js').Phase} phase
 * @property {'FACILE' | 'NORMAL' | 'DIFFICILE'} difficulte
 * @property {number} ressources                     Or / points de survie.
 * @property {CarteRoiReine} roiReine
 * @property {boolean} pouvoirUtilise                Pouvoir Roi/Reine déjà joué ?
 * @property {boolean} premierCombatGagne            Débloque l'entraînement 2 épées.
 * @property {number} jetonsBonusDepart              Jetons +2 en main (mode Facile).
 * @property {InstancePaysan[]} chateau              Pioche, faces cachées (index 0 = dessus).
 * @property {InstanceAlliee[]} hopital              Défausse, faces visibles.
 * @property {InstanceAlliee[]} champDeBataille      Cartes « en jeu ».
 * @property {InstanceAlliee | null} gardeDuCorps
 * @property {PileDore[]} marcheDore
 * @property {InstanceEnnemi[]} pileEnnemi           Pioche ennemie (index 0 = dessus).
 * @property {EnnemiSurPiste[]} pisteEnnemi          Ennemis en approche (vide au départ).
 * @property {InstanceBoss[]} boss                   Boss à affronter, faces cachées.
 */

/**
 * Fait avancer la partie d'une phase. Le numéro de tour s'incrémente au retour
 * sur « Entraînement » (nouveau tour).
 * @param {Partie} partie
 * @returns {Partie}
 */
export function avancerPhase(partie) {
  const phase = phaseSuivante(partie.phase);
  const tour = phase === 'ENTRAINEMENT' ? partie.tour + 1 : partie.tour;
  return Object.freeze({ ...partie, phase, tour });
}
