// Moteur — combat des Boss (règles p.15 et p.20). Couche PURE, aléa injecté.
// Déclenché une fois tous les ennemis normaux vaincus : plus d'Entraînement, on
// affronte les Boss un par un, dans l'ordre de `partie.boss`. Perdre n'élimine
// pas le Boss : on retente (nouvelle pioche, son action se relance — non
// exécutée ici, voir plus bas). Un Boss vaincu est simplement retiré de la
// file (pas de verso récompense). Un Boss ne gagne jamais de jeton bonus : il
// n'y a pas de notion de survivant, un seul Boss est affronté à la fois.

import { piocher } from './pioche.js';
import { forceTotale } from './force.js';
import { ajusterRessources } from './partie.js';

/** @typedef {import('./partie.js').Partie} Partie */

/** Ressources perdues à chaque reconstitution du Château pendant un combat de Boss. */
const PENALITE_CHATEAU_VIDE = 2;

/**
 * Combat le premier Boss de la file : pioche le nombre de cartes qu'il
 * indique (toute reconstitution du Château coûte, ici, des ressources plutôt
 * que de faire avancer l'ennemi), puis compare la Force totale du Champ de
 * bataille à celle du Boss.
 * - Victoire : le Boss est retiré du jeu ; les cartes en jeu rejoignent
 *   l'Hôpital.
 * - Défaite : on paie la différence en ressources ; les cartes en jeu
 *   rejoignent quand même l'Hôpital (on retentera avec une pioche neuve) ; le
 *   Boss reste en tête de file.
 *
 * Ne déclenche pas l'action du Boss (REVELATION/PASSIF) : l'exécution des
 * effets n'existe pas encore dans le moteur. Ne gagne jamais de ressources
 * (« les Boss ont mis le feu au château ») : rien ici n'en ajoute.
 * @param {Partie} partie
 * @param {() => number} rng
 * @returns {{ partie: Partie, victoire: boolean }}
 */
export function combattreBoss(partie, rng) {
  const boss = partie.boss[0];
  if (!boss) throw new Error('Aucun Boss à affronter');

  const { partie: apresPioche, reconstitutions } = piocher(partie, boss.type.cartes, rng);
  const etat = ajusterRessources(apresPioche, -PENALITE_CHATEAU_VIDE * reconstitutions);

  const forceJoueur = forceTotale(etat.champDeBataille);

  if (forceJoueur >= boss.type.force) {
    return {
      partie: Object.freeze({
        ...etat,
        hopital: [...etat.hopital, ...etat.champDeBataille],
        champDeBataille: [],
        boss: etat.boss.slice(1),
      }),
      victoire: true,
    };
  }

  const apresPerte = ajusterRessources(etat, -(boss.type.force - forceJoueur));
  return {
    partie: Object.freeze({
      ...apresPerte,
      hopital: [...apresPerte.hopital, ...apresPerte.champDeBataille],
      champDeBataille: [],
    }),
    victoire: false,
  };
}

/**
 * Vrai quand tous les Boss ont été vaincus (condition de victoire de la partie).
 * @param {Partie} partie
 * @returns {boolean}
 */
export function tousBossVaincus(partie) {
  return partie.boss.length === 0;
}
