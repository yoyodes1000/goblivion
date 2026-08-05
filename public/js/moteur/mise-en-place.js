// Moteur — mise en place d'une partie solo (règles p.4-5). Couche PURE :
// l'aléa est INJECTÉ (paramètre `rng`) pour rester déterministe et testable.

import { melanger } from './aleatoire.js';
import { paysansBase, dores, ennemis, bosses, roisReines } from './cartes/index.js';

/** @typedef {import('./partie.js').Partie} Partie */

/** Nombre de Boss à affronter selon la difficulté. */
const NB_BOSS = { FACILE: 3, NORMAL: 4, DIFFICILE: 5 };

/** Jetons bonus « +2 » en main au départ (mode Facile uniquement). */
const JETONS_DEPART = { FACILE: 3, NORMAL: 0, DIFFICILE: 0 };

const CHATEAU_DEPART = 20;   // cartes Bleu piochées pour la pioche du Château
const ENNEMIS_UNE_EPEE = 8;  // cartes « 1 épée » (dessus de la pile ennemie)
const ENNEMIS_DEUX_EPEES = 7; // cartes « 2 épées » (dessous)

/**
 * Développe des types de cartes en exemplaires individuels (« instances »).
 * @template {{ id: string, exemplaires: number }} T
 * @param {readonly T[]} types
 * @returns {Array<{ instanceId: string, type: T }>}
 */
function instancier(types) {
  /** @type {Array<{ instanceId: string, type: T }>} */
  const instances = [];
  for (const type of types) {
    for (let n = 1; n <= type.exemplaires; n++) {
      instances.push({ instanceId: `${type.id}#${n}`, type });
    }
  }
  return instances;
}

/**
 * @typedef {object} OptionsMiseEnPlace
 * @property {string} roiReineId                          id du rôle choisi.
 * @property {'FACILE' | 'NORMAL' | 'DIFFICILE'} difficulte
 */

/**
 * Construit l'état de départ d'une partie solo.
 * @param {OptionsMiseEnPlace} options
 * @param {() => number} rng   Générateur pseudo-aléatoire (voir aleatoire.js).
 * @returns {Partie}
 */
export function miseEnPlace(options, rng) {
  const roiReine = roisReines.find((r) => r.id === options.roiReineId);
  if (!roiReine) {
    throw new Error(`Rôle Roi/Reine inconnu : ${options.roiReineId}`);
  }

  const typeGarde = dores.find((d) => d.id === roiReine.gardeDuCorps);
  if (!typeGarde) {
    throw new Error(`Garde du corps inconnu : ${roiReine.gardeDuCorps}`);
  }

  // 3. Château : CHATEAU_DEPART cartes Bleu au hasard.
  const chateau = melanger(instancier(paysansBase), rng).slice(0, CHATEAU_DEPART);

  // 4. Garde du corps : la carte Doré indiquée par le rôle.
  const gardeDuCorps = { instanceId: `${typeGarde.id}#garde`, type: typeGarde };

  // 6. Marché Doré : les 12 piles (une copie de moins pour le Garde du corps).
  const marcheDore = dores.map((d) => ({
    typeId: d.id,
    restant: d.id === typeGarde.id ? d.exemplaires - 1 : d.exemplaires,
  }));

  // 8. Pile Ennemi : les « 2 épées » dessous, les « 1 épée » par-dessus (dessus = pioché en premier).
  const instancesEnnemi = instancier(ennemis);
  const uneEpee = melanger(instancesEnnemi.filter((e) => e.type.niveau === 'UNE_EPEE'), rng)
    .slice(0, ENNEMIS_UNE_EPEE);
  const deuxEpees = melanger(instancesEnnemi.filter((e) => e.type.niveau === 'DEUX_EPEES'), rng)
    .slice(0, ENNEMIS_DEUX_EPEES);
  const pileEnnemi = [...uneEpee, ...deuxEpees];

  // 7. Boss : 3 / 4 / 5 selon la difficulté. Les non-tirés sont conservés en
  // réserve (`pileBoss`) : Bébé troll y puise pour ajouter un Boss en cours de
  // partie. Déjà mélangée, donc son dessus est un Boss au hasard.
  const bossMelanges = melanger(instancier(bosses), rng);
  const boss = bossMelanges.slice(0, NB_BOSS[options.difficulte]);
  const pileBoss = bossMelanges.slice(NB_BOSS[options.difficulte]);

  // 5. Ressources de départ ; en Difficile la partie commence par « L'Ennemi Avance ».
  const phase = options.difficulte === 'DIFFICILE' ? 'ENNEMI_AVANCE' : 'ENTRAINEMENT';

  return Object.freeze({
    tour: 1,
    phase,
    difficulte: options.difficulte,
    ressources: roiReine.ressourcesDepart,
    roiReine,
    pouvoirUtilise: false,
    premierCombatGagne: false,
    gardeDuCorpsEchange: false,
    entrainementUtilise: false,
    cartesActivees: [],
    jetonsIgnores: false,
    orBloque: false,
    jetonsBonusDepart: JETONS_DEPART[options.difficulte],
    chateau,
    hopital: [],
    champDeBataille: [],
    gardeDuCorps,
    marcheDore,
    pileEnnemi,
    pisteEnnemi: [null, null, null],
    portes: [],
    boss,
    pileBoss,
  });
}
