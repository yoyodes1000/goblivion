// Moteur — activer le pouvoir Roi/Reine (règles p.15) : effet unique, une
// seule fois par partie. Couche PURE, aléa injecté.

import { executerEffets } from './effets.js';
import { pouvoirsSpecial } from './special.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * Active le pouvoir du Roi/Reine de la partie et marque le pouvoir utilisé
 * pour le reste de la partie. Refuse s'il l'est déjà.
 *
 * Traite SPECIAL lui-même (résolu via `pouvoirsSpecial[roiReine.id]`, un
 * registre distinct de celui des cartes : la cible d'un pouvoir n'est jamais
 * une carte cherchée par id) plutôt que de le déléguer à `executerEffets`,
 * qui ne connaît que le registre par carte — même schéma que `revelation.js`
 * pour JETON_ENNEMI/ENNEMI_AVANCE. Sûr ici : aucun pouvoir Roi/Reine n'utilise
 * CHOIX, donc pas de risque qu'un SPECIAL se cache dans une branche non vue.
 * @param {Partie} partie
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function activerPouvoir(partie, choix, rng) {
  if (partie.pouvoirUtilise) {
    throw new Error('Le pouvoir Roi/Reine a déjà été utilisé cette partie');
  }

  let etat = partie;
  let reconstitutions = 0;

  partie.roiReine.pouvoir.effets.forEach((effet, i) => {
    if (effet.type === 'SPECIAL') {
      const gestionnaire = pouvoirsSpecial[partie.roiReine.id];
      if (!gestionnaire) throw new Error(`SPECIAL non encore exécutable : ${effet.texte}`);
      etat = gestionnaire(etat, choix[i], rng);
    } else {
      const r = executerEffets(etat, [effet], [choix[i]], rng);
      etat = r.partie;
      reconstitutions += r.reconstitutions;
    }
  });

  return {
    partie: Object.freeze({ ...etat, pouvoirUtilise: true }),
    reconstitutions,
  };
}
