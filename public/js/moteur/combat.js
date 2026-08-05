// Moteur — phase Combat : comparaison des forces et conséquences (règles p.11).
// Couche PURE. Les étapes préalables (piocher les cartes des ennemis, appliquer
// leurs actions de révélation, jouer ses propres actions) relèvent de
// l'exécution des effets et de l'orchestration — hors de resoudreCombat.

import { forceTotale } from './force.js';
import { ajusterRessources, rendreTypeImprime } from './partie.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./partie.js').EnnemiSurPiste} EnnemiSurPiste */
/** @typedef {import('./partie.js').InstanceAlliee} InstanceAlliee */

/**
 * Force au combat d'un ennemi = force imprimée + son éventuel jeton bonus.
 * @param {EnnemiSurPiste} ennemi
 * @returns {number}
 */
export function forceEnnemi(ennemi) {
  return ennemi.instance.type.force + ennemi.jetonBonus;
}

/**
 * Force totale des ennemis présents aux Portes.
 * @param {Partie} partie
 * @returns {number}
 */
export function forceEnnemisPortes(partie) {
  return partie.portes.reduce((somme, ennemi) => somme + forceEnnemi(ennemi), 0);
}

/**
 * Identifiant stable (kebab, sans accent) d'une carte Objet récompense.
 * Exportée pour que l'interface retrouve la même clé sans recopier la règle :
 * c'est elle qui décide du `type.id` d'un Objet gagné au combat.
 * @param {string} nom
 * @returns {string}
 */
export function slugifier(nom) {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les diacritiques
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Transforme la récompense d'un ennemi vaincu en instance de carte Objet, prête
 * à rejoindre l'Hôpital.
 * @param {EnnemiSurPiste} ennemi
 * @returns {InstanceAlliee}
 */
function instancierRecompense(ennemi) {
  const r = ennemi.instance.type.recompense;
  return {
    instanceId: `${ennemi.instance.instanceId}~recompense`,
    type: { id: slugifier(r.nom), nom: r.nom, symbole: r.symbole, force: r.force, actions: r.actions },
  };
}

/**
 * Jeton bonus gagné par un survivant selon son niveau (1 épée → +1, 2 épées → +2).
 * @param {EnnemiSurPiste} ennemi
 * @returns {number}
 */
function gainSurvivant(ennemi) {
  return ennemi.instance.type.niveau === 'UNE_EPEE' ? 1 : 2;
}

/**
 * Force alliée du combat en cours, jetons annulés compris (Gobelin pestilant).
 * @param {Partie} partie
 * @returns {number}
 */
export function forceAlliee(partie) {
  return forceTotale(partie.champDeBataille, { jetonsIgnores: partie.jetonsIgnores });
}

/**
 * L'issue du combat, sans le résoudre : gagné dès que la Force alliée atteint
 * celle des Portes (règles p.11 : « supérieure OU ÉGALE »).
 *
 * L'interface a besoin de la connaître avant d'agir : une victoire se résout
 * seule, une défaite demande d'abord au joueur quels ennemis il abat.
 * @param {Partie} partie
 * @returns {boolean}
 */
export function combatGagne(partie) {
  return forceAlliee(partie) >= forceEnnemisPortes(partie);
}

/**
 * Résout un combat aux Portes (étape « comparer les forces »).
 * - Victoire (force ≥ ennemis) : tous les ennemis sont vaincus ; leurs
 *   récompenses et les cartes en jeu rejoignent l'Hôpital.
 * - Défaite : on perd la différence en ressources ; on élimine les ennemis
 *   `ciblesDefaite` (leur force cumulée doit être ≤ à la force du joueur) et on
 *   récupère leurs récompenses ; les survivants gagnent un jeton bonus (un seul
 *   maximum par ennemi).
 * @param {Partie} partie
 * @param {readonly number[]} [ciblesDefaite]  Indices d'ennemis (aux Portes) à éliminer.
 * @returns {{ partie: Partie, victoire: boolean }}
 */
export function resoudreCombat(partie, ciblesDefaite = []) {
  const forceJoueur = forceAlliee(partie);
  const forceEnnemis = forceEnnemisPortes(partie);

  if (forceJoueur >= forceEnnemis) {
    const recompenses = partie.portes.map(instancierRecompense);
    return {
      partie: Object.freeze({
        ...partie,
        hopital: [...partie.hopital, ...partie.champDeBataille.map(rendreTypeImprime), ...recompenses],
        champDeBataille: [],
        portes: [],
        premierCombatGagne: true,
      }),
      victoire: true,
    };
  }

  // Défaite : perdre la différence en ressources.
  const etat = ajusterRessources(partie, -(forceEnnemis - forceJoueur));

  const cibles = new Set(ciblesDefaite);
  const forceCiblee = partie.portes.reduce(
    (somme, ennemi, i) => (cibles.has(i) ? somme + forceEnnemi(ennemi) : somme),
    0,
  );
  // `Math.max(0, …)` : une Force négative ne se répartit pas, mais ne doit pas
  // empêcher de ne viser personne — sans quoi 0 > -1 refuserait une liste vide,
  // et le joueur affaibli se retrouverait sans issue.
  if (forceCiblee > Math.max(0, forceJoueur)) {
    throw new Error('Force insuffisante pour éliminer les ennemis ciblés');
  }

  /** @type {InstanceAlliee[]} */
  const recompenses = [];
  /** @type {EnnemiSurPiste[]} */
  const portesRestantes = [];
  partie.portes.forEach((ennemi, i) => {
    if (cibles.has(i)) {
      recompenses.push(instancierRecompense(ennemi));
    } else {
      const jetonBonus = ennemi.jetonBonus === 0 ? gainSurvivant(ennemi) : ennemi.jetonBonus;
      portesRestantes.push({ ...ennemi, jetonBonus });
    }
  });

  return {
    partie: Object.freeze({
      ...etat,
      hopital: [...etat.hopital, ...etat.champDeBataille.map(rendreTypeImprime), ...recompenses],
      champDeBataille: [],
      portes: portesRestantes,
    }),
    victoire: false,
  };
}
