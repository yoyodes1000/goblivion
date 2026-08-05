// Moteur — piocher des cartes du Château vers le Champ de bataille. Couche PURE
// (aléa injecté pour la reconstitution de la pioche).

import { melanger } from './aleatoire.js';

/** @typedef {import('./partie.js').Partie} Partie */

/**
 * Pioche `n` cartes du Château vers le Champ de bataille. Si le Château se vide
 * en cours de route, on reconstitue la pioche en mélangeant l'Hôpital et en le
 * replaçant sur le Château (règles : « Château vide »). Chaque reconstitution
 * est signalée par `reconstitutions` : l'appelant applique la conséquence
 * (l'ennemi avance, ou −2 ressources pendant le combat des Boss).
 *
 * S'il n'y a plus rien à piocher (Château ET Hôpital vides), la pioche s'arrête.
 * @param {Partie} partie
 * @param {number} n
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function piocher(partie, n, rng) {
  let chateau = [...partie.chateau];
  let hopital = [...partie.hopital];
  const champDeBataille = [...partie.champDeBataille];
  let reconstitutions = 0;

  for (let i = 0; i < n; i++) {
    if (chateau.length === 0) {
      if (hopital.length === 0) break; // plus aucune carte disponible
      chateau = melanger(hopital, rng);
      hopital = [];
      reconstitutions++;
    }
    const carte = chateau.shift();
    if (carte) champDeBataille.push(carte);
  }

  return {
    partie: Object.freeze({ ...partie, chateau, hopital, champDeBataille }),
    reconstitutions,
  };
}
