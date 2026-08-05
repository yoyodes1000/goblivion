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
  obstacleEntrainement,
  piocherPourEntrainement,
  coutEntrainement,
  finaliserEntrainement,
  renoncerEntrainement,
} from '../moteur/entrainement.js';
import { dores } from '../moteur/cartes/index.js';
import { prochainARevele, piocherPourEnnemi, revelerAuxPortes } from '../moteur/revelation.js';
import { avancerEnnemis } from '../moteur/ennemi-avance.js';
import { combatGagne, forceAlliee, forceEnnemi, forceEnnemisPortes, resoudreCombat } from '../moteur/combat.js';
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
 *
 * Deux natures s'y côtoient. PIVOTER et POUVOIR jouent des EFFETS de carte :
 * leurs questions sortent d'une collecte, qui sait les enchaîner et les
 * imbriquer. ENTRAINEMENT, lui, n'exécute aucun effet — il demande une OPTION,
 * la carte à sacrifier, et sa question est donc fabriquée telle quelle.
 * @typedef {object} ActionEnCours
 * @property {'PIVOTER' | 'POUVOIR' | 'ENTRAINEMENT' | 'REVELATION' | 'COMBAT'} genre
 * @property {string} libelle              Ce qu'on est en train de jouer, pour l'afficher.
 * @property {string} [instanceId]         La carte activée (PIVOTER seulement).
 * @property {string} [doreId]             La Doré convoitée (ENTRAINEMENT seulement).
 * @property {number} [indexEnnemi]        L'ennemi révélé (REVELATION seulement).
 * @property {EtatCollecte} [collecte]     Absente pour un entraînement.
 * @property {Demande} [demande]           Question fabriquée (ENTRAINEMENT seulement).
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
  const action = session.enCours;
  if (!action) return null;
  return action.collecte ? prochaineDemande(action.collecte) : (action.demande ?? null);
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
    if (!action.collecte) throw new Error('Action sans effets à exécuter');
    const choix = choixFinal(action.collecte);

    if (action.genre === 'REVELATION') {
      const resultat = revelerAuxPortes(session.partie, action.indexEnnemi ?? 0, choix, rng);
      // « L'ennemi avance » déclenché par une révélation fait glisser la piste :
      // les nouveaux venus, non révélés, seront ramassés au tour suivant.
      const partie = resultat.ennemiAvance ? avancerEnnemis(resultat.partie) : resultat.partie;
      return Object.freeze({ partie, enCours: null, erreur: null });
    }

    const { partie } =
      action.genre === 'POUVOIR'
        ? activerPouvoir(session.partie, choix, rng)
        : activerPivoter(session.partie, action.instanceId ?? '', choix, rng);

    return Object.freeze({ partie, enCours: null, erreur: null });
  } catch (erreur) {
    return Object.freeze({ ...session, enCours: null, erreur: messageDe(erreur) });
  }
}

/**
 * Le message d'un refus du moteur, quelle qu'en soit la forme.
 * @param {unknown} erreur
 * @returns {string}
 */
function messageDe(erreur) {
  return erreur instanceof Error ? erreur.message : String(erreur);
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
  if (action.collecte && prochaineDemande(action.collecte)) {
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
 * Révèle l'ennemi non révélé le plus à gauche des Portes : pioche ses cartes,
 * puis lance son action — en s'arrêtant si elle réclame une cible.
 *
 * La pioche est engagée dès ce moment, comme aux règles : on pioche d'abord,
 * l'action ensuite. Un ennemi ne se révèle qu'une fois, `revele` faisant office
 * de marqueur d'avancement.
 * @param {Session} session
 * @param {() => number} rng
 * @returns {Session}
 */
export function revelerProchainEnnemi(session, rng) {
  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }

  const index = prochainARevele(session.partie);
  if (index === null) {
    return Object.freeze({ ...session, erreur: 'Tous les ennemis aux Portes sont révélés' });
  }

  const { partie } = piocherPourEnnemi(session.partie, index, rng);
  const ennemi = partie.portes[index];
  if (!ennemi) return Object.freeze({ ...session, erreur: 'Aucun ennemi à cet index des Portes' });

  const action = ennemi.instance.type.actionsEnnemi.find((a) => a.declencheur === 'REVELATION');

  return ouvrir(
    Object.freeze({ ...session, partie, erreur: null }),
    {
      genre: 'REVELATION',
      libelle: ennemi.instance.type.nom,
      indexEnnemi: index,
      collecte: demarrerCollecte(partie, action?.effets ?? [], { typeId: ennemi.instance.type.id }),
    },
    rng,
  );
}

/**
 * Compare les Forces et conclut le combat.
 *
 * Une victoire se résout seule. Une défaite demande d'abord au joueur comment
 * répartir sa Force : chaque ennemi dont il l'égale tombe, les autres survivent
 * en gagnant un jeton. Le choix est LIBRE — on peut n'en abattre aucun — et le
 * moteur refuse si le total ciblé dépasse la Force disponible.
 * @param {Session} session
 * @param {() => number} rng
 * @returns {Session}
 */
export function resoudreLeCombat(session, rng) {
  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (session.partie.portes.length === 0) {
    return Object.freeze({ ...session, erreur: 'Aucun ennemi aux Portes : il n’y a pas de combat' });
  }
  if (prochainARevele(session.partie) !== null) {
    return Object.freeze({ ...session, erreur: 'Révèle d’abord tous les ennemis aux Portes' });
  }

  if (combatGagne(session.partie)) {
    const { partie } = resoudreCombat(session.partie);
    return Object.freeze({ partie, enCours: null, erreur: null });
  }

  const disponible = forceAlliee(session.partie);
  const options = session.partie.portes.map((ennemi, index) => ({
    valeur: String(index),
    libelle: `${ennemi.instance.type.nom} — Force ${forceEnnemi(ennemi)}`,
  }));

  /** @type {ActionEnCours} */
  const enCours = {
    genre: 'COMBAT',
    libelle: `Combat perdu — ${forceEnnemisPortes(session.partie) - disponible} ressources perdues`,
    demande: {
      genre: 'CARTES',
      libelle:
        disponible > 0
          ? `Répartis ta Force de ${disponible} : chaque ennemi que tu égales est abattu`
          : 'Aucune Force à répartir : valide sans rien désigner',
      nombre: 1,
      libre: true,
      options,
    },
  };

  return Object.freeze({ ...session, enCours, erreur: null });
}

/**
 * Ouvre un entraînement : pioche aussitôt, puis demande quelle carte sacrifier.
 *
 * La pioche est ENGAGÉE dès ce moment — elle est faite, elle ne se reprend pas.
 * C'est fidèle aux règles : on pioche, puis on décide de poursuivre ou non.
 * Renoncer (voir `annulerAction`) laisse donc les cartes en jeu, prêtes pour le
 * combat, au prix de la Doré convoitée.
 * @param {Session} session
 * @param {string} doreId
 * @param {() => number} rng
 * @returns {Session}
 */
export function commencerEntrainement(session, doreId, rng) {
  const obstacle = obstacleEntrainement(session.partie, doreId);
  if (obstacle) return Object.freeze({ ...session, erreur: obstacle });

  const dore = dores.find((d) => d.id === doreId);
  if (!dore) return Object.freeze({ ...session, erreur: `Carte Doré inconnue : ${doreId}` });

  const { partie } = piocherPourEntrainement(session.partie, doreId, rng);
  const cout = coutEntrainement(partie, doreId);
  const echange = dore.entrainement.echange;

  const options = partie.champDeBataille
    .filter((c) => c.type.symbole === echange)
    .map((c) => ({ valeur: c.instanceId, libelle: c.type.nom }));

  const prix = cout === 0 ? 'cible atteinte, rien à payer' : `${cout} or à payer`;

  /** @type {ActionEnCours} */
  const enCours = {
    genre: 'ENTRAINEMENT',
    libelle: `Entraîner ${dore.nom}`,
    doreId,
    demande: {
      genre: 'CARTES',
      libelle: `Choisis la carte à sacrifier (${echange === 'HUMAIN' ? 'Paysan' : 'Objet'}) — ${prix}`,
      nombre: 1,
      options,
    },
  };

  return Object.freeze({ partie, erreur: null, enCours });
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
  const action = session.enCours;
  if (!action) return Object.freeze({ ...session, erreur: 'Aucune action en cours' });

  // La répartition de la Force conclut le combat perdu.
  if (action.genre === 'COMBAT') {
    try {
      const cibles = valeurs.map(Number);
      const { partie } = resoudreCombat(session.partie, cibles);
      return Object.freeze({ partie, enCours: null, erreur: null });
    } catch (erreur) {
      // Total ciblé trop élevé : la question reste ouverte pour se corriger.
      return Object.freeze({ ...session, erreur: messageDe(erreur) });
    }
  }

  // L'entraînement n'a qu'une question : y répondre le conclut.
  if (action.genre === 'ENTRAINEMENT') {
    try {
      const [sacrifieInstanceId] = valeurs;
      const { partie } = finaliserEntrainement(
        session.partie,
        { doreId: action.doreId ?? '', sacrifieInstanceId: sacrifieInstanceId ?? '' },
        rng,
      );
      return Object.freeze({ partie, enCours: null, erreur: null });
    } catch (erreur) {
      // La question reste ouverte : un refus (mauvais symbole, or insuffisant)
      // doit pouvoir se corriger en désignant une autre carte, pas coûter
      // l'entraînement du tour.
      return Object.freeze({ ...session, erreur: messageDe(erreur) });
    }
  }

  if (!action.collecte) return Object.freeze({ ...session, erreur: 'Aucune saisie attendue' });
  return ouvrir(session, { ...action, collecte: repondre(action.collecte, valeurs) }, rng);
}

/**
 * Abandonne l'action en cours.
 *
 * Pour une action de carte, la partie n'a pas bougé : la collecte n'a aucun
 * effet de bord. Pour un entraînement, la pioche est déjà faite et le reste —
 * c'est l'arrêt que prévoient les règles, et il garde les cartes en jeu.
 * @param {Session} session
 * @returns {Session}
 */
export function annulerAction(session) {
  if (session.enCours?.genre === 'ENTRAINEMENT') {
    return Object.freeze({
      partie: renoncerEntrainement(session.partie),
      enCours: null,
      erreur: null,
    });
  }
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
