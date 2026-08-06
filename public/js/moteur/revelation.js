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
 * no-op ici.
 *
 * Sa PIOCHE, elle, a lieu quand même : c'est l'action que la règle dispense,
 * pas les cartes qu'il fait tirer. Elle n'est pas notre affaire — voir
 * `piocherPourEnnemi`, appelée avant nous quel que soit l'état de `revele`.
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
 * L'ennemi qu'il reste à engager : le plus à gauche des Portes dont on n'a pas
 * encore pioché les cartes dans CE combat (règles p.11, étapes 1-2), ou `null`
 * quand tous y sont passés.
 *
 * Le marqueur d'avancement est `ennemisPioches`, PAS `revele`. Les deux se
 * confondaient, et la confusion coûtait des cartes : un ennemi retourné plus
 * tôt par une Vision, ou survivant du combat précédent, arrive aux Portes déjà
 * révélé — il était alors sauté, et ses cartes jamais piochées. Or c'est son
 * ACTION que la règle p.10 dispense, pas sa pioche : l'étape 1 est « révéler,
 * piocher le nombre indiqué, puis lancer son action ».
 *
 * `ennemisPioches` étant remis à zéro à chaque fin de phase (voir
 * `terminerPhase`), chaque combat repart de zéro. Et les ennemis arrivés en
 * cours de combat n'y figurent pas : ils sont ramassés d'eux-mêmes au tour de
 * boucle suivant, la « reprise à l'étape 1 » des règles n'a pas à être codée.
 * @param {Partie} partie
 * @returns {number | null}
 */
export function prochainAEngager(partie) {
  const index = partie.portes.findIndex(
    (e) => !partie.ennemisPioches.includes(e.instance.instanceId),
  );
  return index === -1 ? null : index;
}

/**
 * Pioche les cartes d'un ennemi des Portes, et le note comme engagé.
 *
 * Séparé de `revelerAuxPortes` pour que l'appelant puisse s'intercaler : une
 * action REVELATION qui réclame une cible (Gobelin vachelier, Horde de
 * Gobelins, Sorcière troll) ne peut la désigner qu'une fois ces cartes vues.
 * C'est ici qu'on inscrit l'ennemi dans `ennemisPioches` : piocher ses cartes
 * *est* ce qui fait qu'on l'a traité, révélation ou non.
 * @param {Partie} partie
 * @param {number} index
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function piocherPourEnnemi(partie, index, rng) {
  const ennemi = partie.portes[index];
  if (!ennemi) throw new Error('Aucun ennemi à cet index des Portes');

  const engage = Object.freeze({
    ...partie,
    ennemisPioches: [...partie.ennemisPioches, ennemi.instance.instanceId],
  });
  return piocher(engage, ennemi.instance.type.cartes, rng);
}

/**
 * Résout tout le début du Combat d'un trait : pour chaque ennemi aux Portes, de
 * gauche à droite, pioche ses cartes puis lance son action s'il ne l'a jamais
 * lancée.
 *
 * Chaque ennemi n'est pioché QU'UNE FOIS PAR COMBAT, `ennemisPioches` en
 * faisant foi. Une version antérieure reprenait la boucle depuis le début après
 * « l'ennemi avance » et repiochait pour les ennemis déjà traités.
 *
 * Ne prend pas de `choix` : elle ne convient donc qu'aux ennemis dont l'action
 * n'en réclame aucun. Une interface qui laisse le joueur désigner ses cibles
 * enchaîne plutôt `prochainAEngager` / `piocherPourEnnemi` / `revelerAuxPortes`
 * elle-même.
 * @param {Partie} partie
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function resoudreRevelation(partie, rng) {
  let etat = partie;
  let reconstitutions = 0;

  for (let index = prochainAEngager(etat); index !== null; index = prochainAEngager(etat)) {
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
