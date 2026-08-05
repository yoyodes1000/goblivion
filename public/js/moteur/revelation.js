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
 * L'ennemi qu'il reste à révéler : le plus à gauche des Portes qui ne l'est pas
 * encore (règles p.11, étapes 1-2), ou `null` quand tous le sont.
 *
 * `revele` sert ici de marqueur d'avancement, et c'est ce qui rend la
 * révélation reprenable pas à pas : les nouveaux ennemis arrivés en cours de
 * combat sont non révélés, donc ramassés d'eux-mêmes au tour de boucle suivant
 * — la « reprise à l'étape 1 » des règles n'a pas à être codée.
 * @param {Partie} partie
 * @returns {number | null}
 */
export function prochainARevele(partie) {
  const index = partie.portes.findIndex((e) => !e.revele);
  return index === -1 ? null : index;
}

/**
 * Pioche les cartes d'un ennemi des Portes, préalable à sa révélation.
 *
 * Séparé de `revelerAuxPortes` pour que l'appelant puisse s'intercaler : une
 * action REVELATION qui réclame une cible (Gobelin vachelier, Horde de
 * Gobelins, Sorcière troll) ne peut la désigner qu'une fois ces cartes vues.
 * @param {Partie} partie
 * @param {number} index
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function piocherPourEnnemi(partie, index, rng) {
  const ennemi = partie.portes[index];
  if (!ennemi) throw new Error('Aucun ennemi à cet index des Portes');

  return piocher(partie, ennemi.instance.type.cartes, rng);
}

/**
 * Résout toute la révélation du Combat d'un trait : pour chaque ennemi non
 * encore révélé, de gauche à droite, pioche ses cartes puis lance son action.
 *
 * Chaque ennemi n'est pioché QU'UNE FOIS, à sa révélation : la pioche est
 * l'étape 1 des règles, indissociable du fait de révéler. Une version
 * antérieure reprenait la boucle depuis le début après « l'ennemi avance » et
 * repiochait pour les ennemis déjà traités.
 *
 * Ne prend pas de `choix` : elle ne convient donc qu'aux ennemis dont l'action
 * n'en réclame aucun. Une interface qui laisse le joueur désigner ses cibles
 * enchaîne plutôt `prochainARevele` / `piocherPourEnnemi` / `revelerAuxPortes`
 * elle-même.
 * @param {Partie} partie
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function resoudreRevelation(partie, rng) {
  let etat = partie;
  let reconstitutions = 0;

  for (let index = prochainARevele(etat); index !== null; index = prochainARevele(etat)) {
    const rPioche = piocherPourEnnemi(etat, index, rng);
    etat = rPioche.partie;
    reconstitutions += rPioche.reconstitutions;

    const rRevelation = revelerAuxPortes(etat, index, [], rng);
    etat = rRevelation.partie;
    reconstitutions += rRevelation.reconstitutions;

    if (rRevelation.ennemiAvance) etat = avancerEnnemis(etat);
  }

  return { partie: etat, reconstitutions };
}
