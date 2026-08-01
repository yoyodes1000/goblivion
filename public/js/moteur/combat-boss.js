// Moteur — combat des Boss (règles p.15 et p.20). Couche PURE, aléa injecté.
// Déclenché une fois tous les ennemis normaux vaincus : plus d'Entraînement, on
// affronte les Boss un par un, dans l'ordre de `partie.boss`. Perdre n'élimine
// pas le Boss : on retente (nouvelle pioche, et son action se relance — règle
// p.15 : « lancer l'action d'un Boss à chaque combat »). Un Boss vaincu est
// simplement retiré de la file (pas de verso récompense). Un Boss ne gagne
// jamais de jeton bonus : il n'y a pas de notion de survivant, un seul Boss est
// affronté à la fois.
//
// Une tentative se joue en trois temps, exportés séparément : piocher, lancer
// l'action du Boss, comparer les forces. Le découpage n'est pas décoratif — les
// actions de Démon, Dragon serpent et Troll Gladiateur réclament des cibles que
// le joueur ne peut désigner qu'APRÈS avoir vu les cartes piochées. `combattreBoss`
// enchaîne les trois pour les appelants qui n'ont pas à s'intercaler.
//
// Les effets PASSIF des Boss ne passent pas par là : ils ne s'exécutent pas,
// ils contraignent le combat. Voir `passifsBoss` dans `special.js`.

import { piocher } from './pioche.js';
import { forceTotale } from './force.js';
import { ajusterRessources, viderChampDeBataille } from './partie.js';
import { executerEffets } from './effets.js';
import { passifsBoss } from './special.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./partie.js').InstanceBoss} InstanceBoss */
/** @typedef {import('./effets.js').Choix} Choix */

/** Ressources perdues à chaque reconstitution du Château pendant un combat de Boss. */
const PENALITE_CHATEAU_VIDE = 2;

/**
 * Le Boss en tête de file, celui que l'on affronte.
 * @param {Partie} partie
 * @returns {InstanceBoss}
 */
function bossEnCours(partie) {
  const boss = partie.boss[0];
  if (!boss) throw new Error('Aucun Boss à affronter');
  return boss;
}

/**
 * Applique la pénalité de Château vide (spécifique au combat des Boss).
 * @param {Partie} partie
 * @param {number} reconstitutions
 * @returns {Partie}
 */
function payerReconstitutions(partie, reconstitutions) {
  return ajusterRessources(partie, -PENALITE_CHATEAU_VIDE * reconstitutions);
}

/**
 * Étape 1 — pioche le nombre de cartes indiqué par le Boss. Toute
 * reconstitution du Château coûte ici des ressources plutôt que de faire
 * avancer l'ennemi.
 * @param {Partie} partie
 * @param {() => number} rng
 * @returns {Partie}
 */
export function piocherPourBoss(partie, rng) {
  const boss = bossEnCours(partie);
  const { partie: apresPioche, reconstitutions } = piocher(partie, boss.type.cartes, rng);
  return payerReconstitutions(apresPioche, reconstitutions);
}

/**
 * Étape 2 — lance l'action REVELATION du Boss, s'il en a une. `choix[i]`
 * fournit la décision du joueur pour `effets[i]`, comme partout ailleurs (voir
 * `executerEffets`).
 *
 * Pas d'équivalent du traitement `JETON_ENNEMI`/`ENNEMI_AVANCE` de
 * `revelerAuxPortes` : un Boss ne gagne pas de jeton bonus (règle p.15) et
 * n'avance sur aucune piste. Tout passe donc par l'exécuteur générique.
 *
 * Contrairement aux ennemis des Portes, l'action se relance à chaque tentative
 * — il n'y a pas d'état « déjà révélé » à consulter.
 * @param {Partie} partie
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {Partie}
 */
export function revelerBoss(partie, choix, rng) {
  const boss = bossEnCours(partie);
  const action = boss.type.actions.find((a) => a.declencheur === 'REVELATION');
  if (!action) return partie;

  const resultat = executerEffets(partie, action.effets, choix, rng, undefined, boss.type.id);
  return payerReconstitutions(resultat.partie, resultat.reconstitutions);
}

/**
 * Les modificateurs de force du combat en cours : ceux du PASSIF du Boss, plus
 * l'éventuel `jetonsIgnores` déjà porté par la partie — un combat de Boss reste
 * un combat, il honore l'état comme le fait `resoudreCombat`.
 * @param {Partie} partie
 * @param {InstanceBoss} boss
 * @returns {import('./force.js').ModificateursForce}
 */
function modificateursDuCombat(partie, boss) {
  const force = passifsBoss[boss.type.id]?.force ?? {};
  return { ...force, jetonsIgnores: (force.jetonsIgnores ?? false) || partie.jetonsIgnores };
}

/**
 * Les modificateurs de force en vigueur dans l'état courant, Boss déduit de la
 * phase. Exportée pour que l'interface affiche exactement la force que le
 * combat calculera : sans elle, la vue recopierait la règle et finirait par en
 * diverger.
 *
 * `resoudreCombatBoss` ne s'en sert pas — il connaît déjà son Boss et ne doit
 * pas dépendre de la phase pour appliquer un PASSIF.
 * @param {Partie} partie
 * @returns {import('./force.js').ModificateursForce}
 */
export function modificateursDeForce(partie) {
  const boss = partie.phase === 'COMBAT_BOSS' ? partie.boss[0] : undefined;
  return boss ? modificateursDuCombat(partie, boss) : { jetonsIgnores: partie.jetonsIgnores };
}

/**
 * Fin de tentative : les cartes en jeu rejoignent l'Hôpital (on retentera avec
 * une pioche neuve), et les activations de la tentative sont oubliées — les
 * cartes « pivotées » viennent de quitter le Champ de bataille, et le compteur
 * du Dragon rouge ne doit pas se cumuler d'un essai à l'autre.
 * @param {Partie} partie
 * @returns {Partie}
 */
function terminerTentative(partie) {
  return Object.freeze({ ...viderChampDeBataille(partie), cartesActivees: [] });
}

/**
 * Étape 3 — compare la Force totale du Champ de bataille à celle du Boss et
 * applique l'issue.
 * - Victoire (Force ≥ Boss) : le Boss est retiré du jeu.
 * - Défaite : on paie la différence en ressources ; le Boss reste en tête de
 *   file.
 *
 * Dans les deux cas, la tentative se termine (voir `terminerTentative`). Le
 * coût par action Pivoter du PASSIF (Dragon rouge) est prélevé d'abord : c'est
 * le prix de la tentative, dû quelle qu'en soit l'issue.
 *
 * Ne gagne jamais de ressources (« les Boss ont mis le feu au château ») : rien
 * ici n'en ajoute.
 * @param {Partie} partie
 * @returns {{ partie: Partie, victoire: boolean }}
 */
export function resoudreCombatBoss(partie) {
  const boss = bossEnCours(partie);

  const coutParActivation = passifsBoss[boss.type.id]?.coutParActivation ?? 0;
  const etat = ajusterRessources(partie, -coutParActivation * partie.cartesActivees.length);

  const forceJoueur = forceTotale(etat.champDeBataille, modificateursDuCombat(etat, boss));

  if (forceJoueur >= boss.type.force) {
    const fin = terminerTentative(etat);
    return {
      partie: Object.freeze({ ...fin, boss: fin.boss.slice(1) }),
      victoire: true,
    };
  }

  const apresPerte = ajusterRessources(etat, -(boss.type.force - forceJoueur));
  return { partie: terminerTentative(apresPerte), victoire: false };
}

/**
 * Une tentative complète contre le premier Boss de la file : pioche, action du
 * Boss, comparaison des forces. `choix` alimente l'action du Boss (voir
 * `revelerBoss`) ; inutile pour un Boss dont l'action ne cible rien.
 *
 * Une interface qui laisse le joueur désigner ses cibles enchaînera plutôt les
 * trois étapes elle-même, pour intercaler la saisie après la pioche.
 * @param {Partie} partie
 * @param {() => number} rng
 * @param {readonly (Choix | undefined)[]} [choix]
 * @returns {{ partie: Partie, victoire: boolean }}
 */
export function combattreBoss(partie, rng, choix = []) {
  return resoudreCombatBoss(revelerBoss(piocherPourBoss(partie, rng), choix, rng));
}

/**
 * Vrai quand tous les Boss ont été vaincus (condition de victoire de la partie).
 * @param {Partie} partie
 * @returns {boolean}
 */
export function tousBossVaincus(partie) {
  return partie.boss.length === 0;
}
