// Moteur — l'état complet d'une partie solo, ses transitions de phase et de
// petits helpers d'état. Couche PURE : les fonctions renvoient un NOUVEL état
// gelé plutôt que de muter l'existant.

import { phaseSuivante } from './phases.js';

/** @typedef {import('./cartes/ennemis.js').CarteEnnemi} CarteEnnemi */
/** @typedef {import('./cartes/bosses.js').CarteBoss} CarteBoss */
/** @typedef {import('./cartes/rois-reines.js').CarteRoiReine} CarteRoiReine */
/** @typedef {import('./cartes/types.js').CarteAlliee} CarteAlliee */

/**
 * @typedef {object} InstanceAlliee
 * @property {string} instanceId
 * @property {CarteAlliee} type
 * @property {number} [jetonBonus]   Jeton bonus de force posé par un effet FORCE (absent = 0).
 */
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
 * @property {boolean} jetonsIgnores                 Jetons bonus alliés annulés pour ce combat (Gobelin pestilant).
 * @property {boolean} orBloque                      Aucun gain d'or pour ce combat (Troll saboteur) ; les pertes s'appliquent.
 * @property {readonly string[]} cartesActivees      instanceId des cartes « pivotées » (activées) cette phase.
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
 * sur « Entraînement » (nouveau tour). Les états valables « pour ce combat »
 * (`jetonsIgnores`, `orBloque`) ou « cette phase » (`gardeDuCorpsEchange`,
 * `cartesActivees`) retombent ici.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function avancerPhase(partie) {
  const phase = phaseSuivante(partie.phase);
  const tour = phase === 'ENTRAINEMENT' ? partie.tour + 1 : partie.tour;
  return Object.freeze({
    ...partie,
    phase,
    tour,
    gardeDuCorpsEchange: false,
    cartesActivees: [],
    jetonsIgnores: false,
    orBloque: false,
  });
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
 * Ajoute un jeton bonus de force à une carte alliée activée (effets FORCE et
 * SPECIAL) : sur le Champ de bataille (cas PIVOTER), ou en Garde du corps —
 * retiré du Champ de bataille au moment où sa propre action GARDE_DU_CORPS
 * s'exécute, donc pas cherché au même endroit. Ici plutôt que dans
 * `effets.js` pour que `special.js` puisse la réutiliser sans import
 * circulaire (`effets.js` importe déjà `special.js`).
 * @param {Partie} partie
 * @param {string} instanceId
 * @param {number} valeur
 * @returns {Partie}
 */
export function ajouterJetonBonusAllie(partie, instanceId, valeur) {
  if (partie.gardeDuCorps?.instanceId === instanceId) {
    return Object.freeze({
      ...partie,
      gardeDuCorps: { ...partie.gardeDuCorps, jetonBonus: (partie.gardeDuCorps.jetonBonus ?? 0) + valeur },
    });
  }

  const carte = partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!carte) throw new Error(`Carte activée absente du Champ de bataille (${instanceId})`);

  const champDeBataille = partie.champDeBataille.map((c) =>
    c.instanceId === instanceId ? { ...c, jetonBonus: (c.jetonBonus ?? 0) + valeur } : c,
  );
  return Object.freeze({ ...partie, champDeBataille });
}

/**
 * Détruit le jeton bonus de force d'un ennemi (effet SPECIAL du Champion) :
 * son `jetonBonus` retombe à 0. Un ennemi ne porte qu'un seul jeton à la fois
 * (voir `EnnemiSurPiste`), donc le détruire remet bien le champ à zéro plutôt
 * que de le décrémenter. Cherché aux Portes comme sur la piste : c'est aux
 * Portes que les jetons se posent aujourd'hui, mais l'ennemi les conserve en
 * glissant, et rien dans le texte du Champion ne restreint la zone.
 * @param {Partie} partie
 * @param {string} instanceId   instanceId de l'INSTANCE ENNEMI visée.
 * @returns {Partie}
 */
export function retirerJetonBonusEnnemi(partie, instanceId) {
  const cible = [...partie.portes, ...partie.pisteEnnemi].find(
    (e) => e?.instance.instanceId === instanceId,
  );
  if (!cible) throw new Error(`Ennemi introuvable (${instanceId})`);
  if (cible.jetonBonus === 0) throw new Error('Cet ennemi n’a aucun jeton bonus à détruire');

  const sansJeton = (/** @type {EnnemiSurPiste} */ e) =>
    e.instance.instanceId === instanceId ? { ...e, jetonBonus: 0 } : e;

  return Object.freeze({
    ...partie,
    portes: partie.portes.map(sansJeton),
    pisteEnnemi: partie.pisteEnnemi.map((e) => (e ? sansJeton(e) : e)),
  });
}
