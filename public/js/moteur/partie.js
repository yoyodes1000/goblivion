// Moteur — l'état complet d'une partie solo, ses transitions de phase et de
// petits helpers d'état. Couche PURE : les fonctions renvoient un NOUVEL état
// gelé plutôt que de muter l'existant.

import { phaseSuivante } from './phases.js';

/** @typedef {import('./cartes/ennemis.js').CarteEnnemi} CarteEnnemi */
/** @typedef {import('./cartes/bosses.js').CarteBoss} CarteBoss */
/** @typedef {import('./cartes/rois-reines.js').CarteRoiReine} CarteRoiReine */
/** @typedef {import('./cartes/types.js').CarteAlliee} CarteAlliee */

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
 * @property {InstanceAlliee[]} chateau              Pioche, faces cachées (index 0 = dessus).
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

/**
 * Ajuste les ressources d'un delta (signé), bornées à ≥ 0.
 * Un total nul signifie la défaite (voir `estPerdue`).
 * @param {Partie} partie
 * @param {number} delta
 * @returns {Partie}
 */
export function ajusterRessources(partie, delta) {
  return Object.freeze({ ...partie, ressources: Math.max(0, partie.ressources + delta) });
}

/**
 * Fin de phase : les cartes en jeu rejoignent l'Hôpital et le Champ de bataille
 * est vidé. Le Garde du corps, lui, ne quitte pas son emplacement.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function viderChampDeBataille(partie) {
  return Object.freeze({
    ...partie,
    hopital: [...partie.hopital, ...partie.champDeBataille],
    champDeBataille: [],
  });
}

/**
 * La partie est perdue quand les ressources sont épuisées.
 * @param {Partie} partie
 * @returns {boolean}
 */
export function estPerdue(partie) {
  return partie.ressources <= 0;
}
