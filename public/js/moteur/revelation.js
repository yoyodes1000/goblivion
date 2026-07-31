// Moteur — révélation des ennemis aux Portes en Combat (règles p.10-11, p.20).
// Couche PURE, aléa injecté.
//
// Deux fonctions : `revelerAuxPortes` révèle UN ennemi (même famille que
// `activerPivoter`/`activerPouvoir` : trouve l'action REVELATION, délègue à
// `executerEffets`, retourne le nouvel état) ; `resoudreRevelation` est la
// boucle qui pioche et révèle chaque ennemi aux Portes de gauche à droite, et
// reprend depuis le début si une action déclenche « l'ennemi avance ».

import { executerEffets } from './effets.js';
import { piocher } from './pioche.js';
import { avancerEnnemis } from './ennemi-avance.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * Révèle l'ennemi aux Portes d'indice `index` et exécute son action REVELATION
 * — mais seulement si c'est la première fois qu'il est révélé : `revele` ne
 * revient jamais à `false` (voir `partie.js` / `ennemi-avance.js` : rien ne le
 * réinitialise), donc cette transition false → true *est* « la première fois »
 * (règle p.10 : une carte déjà révélée avant le début du tour ne relance pas
 * son action). Un ennemi déjà révélé (tour précédent ou Vision) est donc un
 * no-op complet ici — ne pioche pas non plus : la pioche est inconditionnelle
 * et reste la responsabilité de `resoudreRevelation`.
 *
 * `JETON_ENNEMI` est traité ici, pas dans `executerEffets` : sa cible est
 * l'ennemi en cours de révélation, connu de ce dispatcher, pas de l'exécuteur
 * générique. `ENNEMI_AVANCE` n'est pas un effet à exécuter mais un signal
 * remonté à l'appelant via `ennemiAvance` (faire avancer la piste est aussi la
 * responsabilité de l'appelant, pas de ce dispatcher).
 * @param {Partie} partie
 * @param {number} index
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number, ennemiAvance: boolean }}
 */
export function revelerAuxPortes(partie, index, choix, rng) {
  const ennemi = partie.portes[index];
  if (!ennemi) throw new Error('Aucun ennemi à cet index des Portes');

  if (ennemi.revele) return { partie, reconstitutions: 0, ennemiAvance: false };

  let etat = Object.freeze({
    ...partie,
    portes: partie.portes.map((e, i) => (i === index ? { ...e, revele: true } : e)),
  });

  const action = ennemi.instance.type.actionsEnnemi.find((a) => a.declencheur === 'REVELATION');
  if (!action) return { partie: etat, reconstitutions: 0, ennemiAvance: false };

  let reconstitutions = 0;
  let ennemiAvance = false;

  action.effets.forEach((effet, i) => {
    if (effet.type === 'JETON_ENNEMI') {
      etat = Object.freeze({
        ...etat,
        portes: etat.portes.map((e, j) =>
          j === index ? { ...e, jetonBonus: e.jetonBonus + (effet.valeur ?? 0) } : e,
        ),
      });
    } else if (effet.type === 'ENNEMI_AVANCE') {
      ennemiAvance = true;
    } else {
      const r = executerEffets(etat, [effet], [choix[i]], rng, undefined, ennemi.instance.type.id);
      etat = r.partie;
      reconstitutions += r.reconstitutions;
    }
  });

  return { partie: etat, reconstitutions, ennemiAvance };
}

/**
 * Boucle de révélation du Combat (règles p.11 + p.20) : pour chaque ennemi aux
 * Portes, de gauche à droite, pioche ses cartes (toujours, même si déjà
 * révélé) puis révèle son action (voir `revelerAuxPortes`). Si une action
 * déclenche « l'ennemi avance », fait avancer la piste et reprend la boucle
 * depuis le début — de nouveaux ennemis peuvent arriver aux Portes et seront
 * traités au passage suivant. Termine naturellement : seules quelques cartes
 * précises déclenchent « l'ennemi avance », en stock fini et jamais renouvelé.
 *
 * Ne prend pas de `choix` : aucune action REVELATION actuelle n'en a besoin
 * (OR et JETON_ENNEMI n'en consomment pas). Le jour où un gestionnaire SPECIAL
 * avec choix existera, cette boucle devra évoluer.
 * @param {Partie} partie
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function resoudreRevelation(partie, rng) {
  let etat = partie;
  let reconstitutions = 0;
  let relancer = true;

  while (relancer) {
    relancer = false;

    for (let index = 0; index < etat.portes.length; index += 1) {
      const ennemiActuel = etat.portes[index];
      if (!ennemiActuel) throw new Error('Aucun ennemi à cet index des Portes');

      const rPioche = piocher(etat, ennemiActuel.instance.type.cartes, rng);
      etat = rPioche.partie;
      reconstitutions += rPioche.reconstitutions;

      const rRevelation = revelerAuxPortes(etat, index, [], rng);
      etat = rRevelation.partie;
      reconstitutions += rRevelation.reconstitutions;

      if (rRevelation.ennemiAvance) {
        etat = avancerEnnemis(etat);
        relancer = true;
        break;
      }
    }
  }

  return { partie: etat, reconstitutions };
}
