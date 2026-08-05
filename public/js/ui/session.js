// Interface — la boucle de jeu : ouvrir une action, recueillir ses choix, la
// remettre au moteur. Couche PURE, aléa injecté : testable sous Node (voir
// tests/session.test.js), aucune référence au DOM.
//
// C'est ici que vit la règle qui relie les deux couches précédentes : une action
// commence par une collecte (`collecte.js`), et dès qu'il n'y a plus rien à
// demander, elle part au moteur. Le cas « aucun choix nécessaire » n'est donc
// pas un cas particulier — la collecte est simplement complète d'emblée, et
// l'action s'exécute dans la foulée.
//
// Les erreurs du moteur ne sont pas laissées remonter : elles deviennent un
// message dans la session. Un refus (« Gobelin vachelier : une seule cible
// attendue ») est une information à montrer au joueur, pas un plantage.

import { passerALaPhaseSuivante } from '../moteur/orchestration.js';
import { activerPivoter } from '../moteur/pivoter.js';
import { activerPouvoir } from '../moteur/pouvoir.js';
import {
  demarrerCollecte,
  demarrerCollectePouvoir,
  prochaineDemande,
  repondre,
  choixFinal,
} from './collecte.js';

/** @typedef {import('../moteur/partie.js').Partie} Partie */
/** @typedef {import('./collecte.js').EtatCollecte} EtatCollecte */
/** @typedef {import('./collecte.js').Demande} Demande */

/**
 * L'action dont on est en train de recueillir les choix.
 * @typedef {object} ActionEnCours
 * @property {'PIVOTER' | 'POUVOIR'} genre
 * @property {string} libelle              Ce qu'on est en train de jouer, pour l'afficher.
 * @property {string} [instanceId]         La carte activée (PIVOTER seulement).
 * @property {EtatCollecte} collecte
 */

/**
 * @typedef {object} Session
 * @property {Partie} partie
 * @property {ActionEnCours | null} enCours   Aucune action ouverte quand `null`.
 * @property {string | null} erreur           Dernier refus du moteur, à afficher.
 */

/**
 * @param {Partie} partie
 * @returns {Session}
 */
export function nouvelleSession(partie) {
  return Object.freeze({ partie, enCours: null, erreur: null });
}

/**
 * La question posée au joueur, ou `null` s'il n'y a rien à saisir.
 * @param {Session} session
 * @returns {Demande | null}
 */
export function demandeCourante(session) {
  return session.enCours ? prochaineDemande(session.enCours.collecte) : null;
}

/**
 * Exécute l'action au moteur, une fois ses choix complets. Toute erreur devient
 * un message : la session revient au repos, la partie inchangée.
 * @param {Session} session
 * @param {ActionEnCours} action
 * @param {() => number} rng
 * @returns {Session}
 */
function executer(session, action, rng) {
  try {
    const choix = choixFinal(action.collecte);
    const { partie } =
      action.genre === 'POUVOIR'
        ? activerPouvoir(session.partie, choix, rng)
        : activerPivoter(session.partie, action.instanceId ?? '', choix, rng);

    return Object.freeze({ partie, enCours: null, erreur: null });
  } catch (erreur) {
    return Object.freeze({
      ...session,
      enCours: null,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
  }
}

/**
 * Ouvre une action : si sa collecte est complète d'emblée, elle part aussitôt
 * au moteur ; sinon la session attend les réponses.
 * @param {Session} session
 * @param {ActionEnCours} action
 * @param {() => number} rng
 * @returns {Session}
 */
function ouvrir(session, action, rng) {
  if (prochaineDemande(action.collecte)) {
    return Object.freeze({ ...session, enCours: action, erreur: null });
  }
  return executer(session, action, rng);
}

/**
 * Active l'action Pivoter d'une carte en jeu. Refuse — en message, pas en
 * exception — une carte absente, déjà activée, ou sans action Pivoter : ce sont
 * des situations que l'interface doit savoir montrer.
 * @param {Session} session
 * @param {string} instanceId
 * @param {() => number} rng
 * @returns {Session}
 */
export function commencerPivoter(session, instanceId, rng) {
  const carte = session.partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!carte) {
    return Object.freeze({ ...session, erreur: 'Carte absente du Champ de bataille' });
  }
  if (session.partie.cartesActivees.includes(instanceId)) {
    return Object.freeze({ ...session, erreur: 'Cette carte est déjà activée' });
  }

  const action = carte.type.actions.find((a) => a.declencheur === 'PIVOTER');
  if (!action) {
    return Object.freeze({ ...session, erreur: 'Cette carte n’a pas d’action Pivoter' });
  }

  return ouvrir(
    session,
    {
      genre: 'PIVOTER',
      libelle: carte.type.nom,
      instanceId,
      collecte: demarrerCollecte(session.partie, action.effets, {
        typeId: carte.type.id,
        carteActiveeId: instanceId,
      }),
    },
    rng,
  );
}

/**
 * Active le pouvoir Roi/Reine, une seule fois par partie.
 * @param {Session} session
 * @param {() => number} rng
 * @returns {Session}
 */
export function commencerPouvoir(session, rng) {
  if (session.partie.pouvoirUtilise) {
    return Object.freeze({ ...session, erreur: 'Le pouvoir Roi/Reine a déjà été utilisé' });
  }

  return ouvrir(
    session,
    {
      genre: 'POUVOIR',
      libelle: session.partie.roiReine.nom,
      collecte: demarrerCollectePouvoir(session.partie),
    },
    rng,
  );
}

/**
 * Enregistre la réponse à la demande en cours, et exécute l'action s'il ne
 * reste plus rien à saisir.
 * @param {Session} session
 * @param {readonly string[]} valeurs
 * @param {() => number} rng
 * @returns {Session}
 */
export function repondreDemande(session, valeurs, rng) {
  if (!session.enCours) return Object.freeze({ ...session, erreur: 'Aucune action en cours' });

  const action = { ...session.enCours, collecte: repondre(session.enCours.collecte, valeurs) };
  return ouvrir(session, action, rng);
}

/**
 * Abandonne l'action en cours. La partie n'a pas bougé : rien n'a encore été
 * remis au moteur, la collecte n'ayant aucun effet de bord.
 * @param {Session} session
 * @returns {Session}
 */
export function annulerAction(session) {
  return Object.freeze({ ...session, enCours: null, erreur: null });
}

/**
 * Passe à la phase suivante. Le moteur décide de ce que la nouvelle phase
 * entraîne — glissement des ennemis, bascule vers les Boss : ce sont des
 * règles, pas de l'interface. Refuse pendant le combat des Boss : on n'en
 * sort plus.
 * @param {Session} session
 * @returns {Session}
 */
export function passerPhase(session) {
  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (session.partie.phase === 'COMBAT_BOSS') {
    return Object.freeze({ ...session, erreur: 'Le combat des Boss ne mène à aucune autre phase' });
  }

  return Object.freeze({ partie: passerALaPhaseSuivante(session.partie), enCours: null, erreur: null });
}
