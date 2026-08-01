// Moteur — décide quand enchaîner quoi entre les phases, et applique les
// conséquences qui ne relèvent d'aucun dispatcher en particulier. Couche PURE.
//
// Deux sujets aujourd'hui : la bascule L'Ennemi Avance → combat des Boss
// (règles : « quand la pile ET la piste sont vides, on détruit les ennemis
// restés aux Portes et on passe au combat des Boss »), et la conséquence d'un
// Château vide (règles p.8).
//
// Le reste d'un tour (jouer des cartes, choisir de passer à la phase suivante
// pendant Entraînement/Combat) est piloté par le joueur — donc par l'UI, pas
// par le moteur : rien à orchestrer ici pour ça.

import { avancerPhase, reinitialiserEtatsDePhase } from './partie.js';
import { avancerEnnemis, pisteEtPileVides } from './ennemi-avance.js';

/** @typedef {import('./partie.js').Partie} Partie */

/**
 * Détruit les ennemis restés aux Portes (« l'ennemi n'arrête jamais » ne
 * s'applique plus une fois la pile et la piste épuisées : ceux qui restent
 * aux Portes sont retirés du jeu avant le combat des Boss).
 * @param {Partie} partie
 * @returns {Partie}
 */
export function detruireEnnemisAuxPortes(partie) {
  return Object.freeze({ ...partie, portes: [] });
}

/**
 * Termine la phase L'Ennemi Avance : bascule vers le combat des Boss si la
 * pile et la piste sont vides (détruit d'abord les ennemis restés aux
 * Portes ; pas d'incrément de `tour`, ce n'est pas un nouveau tour au sens
 * Entraînement mais un changement de mode) — sinon avance normalement au
 * cycle habituel via `avancerPhase`.
 *
 * Les deux chemins réinitialisent les états de phase : entrer en combat des
 * Boss reste un changement de phase, même s'il ne passe pas par le cycle.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function terminerPhaseEnnemiAvance(partie) {
  if (pisteEtPileVides(partie)) {
    return Object.freeze({
      ...reinitialiserEtatsDePhase(detruireEnnemisAuxPortes(partie)),
      phase: 'COMBAT_BOSS',
    });
  }
  return avancerPhase(partie);
}

/**
 * Applique la conséquence d'un Château vide (règles p.8) : l'ennemi avance,
 * une fois par reconstitution de la pioche.
 *
 * `reconstitutions` est le compteur que remonte toute opération susceptible de
 * piocher — `piocher`, `executerEffets`, `activerPivoter`, `activerPouvoir`,
 * `entrainer`, `resoudreRevelation`. Ces fonctions comptent sans agir : c'est
 * à l'appelant d'appliquer la conséquence, au moment qu'il juge bon.
 *
 * Sans effet pendant le combat des Boss : la piste y est vide, et la
 * conséquence n'y est pas une avancée mais une perte de 2 ressources, déjà
 * appliquée par `combat-boss.js` au plus près de la pioche.
 * @param {Partie} partie
 * @param {number} reconstitutions
 * @returns {Partie}
 */
export function appliquerChateauVide(partie, reconstitutions) {
  if (partie.phase === 'COMBAT_BOSS') return partie;

  let etat = partie;
  for (let i = 0; i < reconstitutions; i += 1) etat = avancerEnnemis(etat);
  return etat;
}
