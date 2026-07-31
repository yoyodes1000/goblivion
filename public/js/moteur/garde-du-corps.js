// Moteur — échange du Garde du corps (règles p.16). Couche PURE, aléa injecté.
// Dans son propre fichier (plutôt que partie.js) car elle dépend d'effets.js,
// qui dépend lui-même de partie.js (ajusterRessources) : les garder dans le
// même fichier créerait un import circulaire.

import { executerEffets } from './effets.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * Échange le Garde du corps contre une carte du Champ de bataille : la carte
 * visée prend sa place, l'ancien Garde du corps rejoint le Champ de bataille
 * (il compte désormais pour la Force). Limité à une fois par phase — remis à
 * zéro par `avancerPhase`. Refuse une carte déjà activée (« tournée à 90° »).
 *
 * Si la carte qui prend la place a une action `GARDE_DU_CORPS`, elle
 * s'exécute (voir `executerEffets`) ; `choix`/`rng` ne servent que dans ce
 * cas et sont ignorés sinon.
 * @param {Partie} partie
 * @param {string} instanceId   Carte du Champ de bataille à faire passer Garde du corps.
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {Partie}
 */
export function echangerGardeDuCorps(partie, instanceId, choix, rng) {
  if (partie.gardeDuCorpsEchange) {
    throw new Error('Le Garde du corps a déjà été échangé cette phase');
  }

  const nouvelleGarde = partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!nouvelleGarde) {
    throw new Error('Carte absente du Champ de bataille');
  }
  if (partie.cartesActivees.includes(instanceId)) {
    throw new Error('Impossible d’échanger le Garde du corps contre une carte déjà activée');
  }

  const champDeBataille = partie.champDeBataille.filter((c) => c.instanceId !== instanceId);
  if (partie.gardeDuCorps) champDeBataille.push(partie.gardeDuCorps);

  const etat = Object.freeze({
    ...partie,
    gardeDuCorps: nouvelleGarde,
    champDeBataille,
    gardeDuCorpsEchange: true,
  });

  const action = nouvelleGarde.type.actions.find((a) => a.declencheur === 'GARDE_DU_CORPS');
  if (!action) return etat;

  return executerEffets(etat, action.effets, choix, rng, instanceId).partie;
}
