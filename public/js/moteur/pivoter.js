// Moteur — activer l'action PIVOTER d'une carte en jeu (règles p.7 : « action
// activée en tournant la carte à 90° »). Couche PURE, aléa injecté.

import { executerEffets } from './effets.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * Active l'action PIVOTER d'une carte du Champ de bataille : exécute ses
 * effets (voir `executerEffets`) puis marque la carte comme activée pour le
 * reste de la phase — `avancerPhase` remet `cartesActivees` à zéro.
 *
 * Refuse une carte absente du Champ de bataille, sans action PIVOTER, ou déjà
 * activée. Un effet qui réactiverait explicitement des cartes (ex. le pouvoir
 * de Reine Bella, « réactive 2 cartes ») n'est pas géré ici : ce sera un
 * gestionnaire SPECIAL à part, qui retirera l'instanceId de `cartesActivees`.
 * @param {Partie} partie
 * @param {string} instanceId
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function activerPivoter(partie, instanceId, choix, rng) {
  const carte = partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!carte) throw new Error('Carte absente du Champ de bataille');

  if (partie.cartesActivees.includes(instanceId)) {
    throw new Error('Cette carte est déjà activée');
  }

  const action = carte.type.actions.find((a) => a.declencheur === 'PIVOTER');
  if (!action) throw new Error('Cette carte n’a pas d’action Pivoter');

  const { partie: etat, reconstitutions } = executerEffets(
    partie,
    action.effets,
    choix,
    rng,
    instanceId,
    carte.type.id,
  );

  return {
    partie: Object.freeze({ ...etat, cartesActivees: [...etat.cartesActivees, instanceId] }),
    reconstitutions,
  };
}
