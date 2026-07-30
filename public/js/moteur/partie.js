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
 * Un ennemi présent sur la piste ou aux Portes, avec son état de révélation et
 * son éventuel jeton bonus de force.
 * @typedef {object} EnnemiSurPiste
 * @property {InstanceEnnemi} instance
 * @property {boolean} revele
 * @property {number} jetonBonus   Jeton bonus de force sur l'ennemi (0/1/2 ; un seul maximum).
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
 * @property {boolean} gardeDuCorpsEchange           Garde du corps déjà échangé cette phase ?
 * @property {number} jetonsBonusDepart              Jetons +2 en main (mode Facile).
 * @property {InstanceAlliee[]} chateau              Pioche, faces cachées (index 0 = dessus).
 * @property {InstanceAlliee[]} hopital              Défausse, faces visibles.
 * @property {InstanceAlliee[]} champDeBataille      Cartes « en jeu ».
 * @property {InstanceAlliee | null} gardeDuCorps
 * @property {PileDore[]} marcheDore
 * @property {InstanceEnnemi[]} pileEnnemi           Pioche ennemie (index 0 = dessus).
 * @property {(EnnemiSurPiste | null)[]} pisteEnnemi Les 4 cases : index 0 = case 1 (pioche) → index 3 = case 4 (Portes).
 * @property {EnnemiSurPiste[]} portes               Ennemis aux Portes du château (max 3, en combat).
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
  return Object.freeze({ ...partie, phase, tour, gardeDuCorpsEchange: false });
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

/**
 * Échange le Garde du corps contre une carte du Champ de bataille (règles
 * p.16) : la carte visée prend sa place, l'ancien Garde du corps rejoint le
 * Champ de bataille (il compte désormais pour la Force). Limité à une fois
 * par phase — remis à zéro par `avancerPhase`.
 *
 * Ne déclenche PAS l'effet `GARDE_DU_CORPS` de la carte, et ne vérifie pas
 * qu'elle n'est pas « activée » : rien dans le moteur ne suit encore l'état
 * pivoté d'une carte ni n'exécute d'effet (à faire avec le reste de
 * l'exécution des effets).
 * @param {Partie} partie
 * @param {string} instanceId   Carte du Champ de bataille à faire passer Garde du corps.
 * @returns {Partie}
 */
export function echangerGardeDuCorps(partie, instanceId) {
  if (partie.gardeDuCorpsEchange) {
    throw new Error('Le Garde du corps a déjà été échangé cette phase');
  }

  const nouvelleGarde = partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!nouvelleGarde) {
    throw new Error('Carte absente du Champ de bataille');
  }

  const champDeBataille = partie.champDeBataille.filter((c) => c.instanceId !== instanceId);
  if (partie.gardeDuCorps) champDeBataille.push(partie.gardeDuCorps);

  return Object.freeze({
    ...partie,
    gardeDuCorps: nouvelleGarde,
    champDeBataille,
    gardeDuCorpsEchange: true,
  });
}
