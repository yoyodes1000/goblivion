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

import { passerALaPhaseSuivante, issuePartie } from '../moteur/orchestration.js';
import { activerPivoter } from '../moteur/pivoter.js';
import { activerPouvoir } from '../moteur/pouvoir.js';
import { echangerGardeDuCorps } from '../moteur/garde-du-corps.js';
import {
  obstacleEntrainement,
  piocherPourEntrainement,
  coutEntrainement,
  finaliserEntrainement,
  renoncerEntrainement,
} from '../moteur/entrainement.js';
import { dores } from '../moteur/cartes/index.js';
import { prochainAEngager, piocherPourEnnemi, revelerAuxPortes } from '../moteur/revelation.js';
import { avancerEnnemis } from '../moteur/ennemi-avance.js';
import { combatGagne, forceAlliee, forceEnnemi, forceEnnemisPortes, resoudreCombat } from '../moteur/combat.js';
import { piocherPourBoss, revelerBoss, resoudreCombatBoss } from '../moteur/combat-boss.js';
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
 * @property {'PIVOTER' | 'POUVOIR' | 'ENTRAINEMENT' | 'REVELATION' | 'REVELATION_BOSS' | 'COMBAT' | 'GARDE_DU_CORPS'} genre
 * @property {string} libelle              Ce qu'on est en train de jouer, pour l'afficher.
 * @property {string} [instanceId]         La carte visée (PIVOTER et GARDE_DU_CORPS).
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
 * @property {boolean} tentativeBoss          Tentative de combat de Boss engagée : voir `engagerLeBoss`.
 * @property {string | null} entrainementEngage  id de la Doré dont le jeton est posé : voir `commencerEntrainement`.
 */

/**
 * @param {Partie} partie
 * @returns {Session}
 */
export function nouvelleSession(partie) {
  return Object.freeze({
    partie,
    enCours: null,
    erreur: null,
    tentativeBoss: false,
    entrainementEngage: null,
  });
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
      return Object.freeze({ ...session, partie, enCours: null, erreur: null });
    }

    // L'action d'un Boss ne peut pas faire avancer l'ennemi : la piste est vide
    // en mode Boss, et un Château vidé s'y paie en ressources (`revelerBoss`).
    if (action.genre === 'REVELATION_BOSS') {
      const partie = revelerBoss(session.partie, choix, rng);
      return Object.freeze({ ...session, partie, enCours: null, erreur: null });
    }

    if (action.genre === 'GARDE_DU_CORPS') {
      const partie = echangerGardeDuCorps(session.partie, action.instanceId ?? '', choix, rng);
      return Object.freeze({ ...session, partie, enCours: null, erreur: null });
    }

    const { partie } =
      action.genre === 'POUVOIR'
        ? activerPouvoir(session.partie, choix, rng)
        : activerPivoter(session.partie, action.instanceId ?? '', choix, rng);

    return Object.freeze({ ...session, partie, enCours: null, erreur: null });
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
 * Refus commun à toutes les actions : plus rien ne se joue une fois la partie
 * finie. Rend `null` tant qu'elle continue.
 *
 * L'interface masque déjà les commandes ; ce garde-fou existe pour que l'état
 * ne dépende pas de ce que le DOM montre.
 * @param {Session} session
 * @returns {Session | null}
 */
function refusSiTerminee(session) {
  const issue = issuePartie(session.partie);
  if (!issue) return null;

  const message = issue === 'VICTOIRE' ? 'La partie est gagnée' : 'La partie est perdue';
  return Object.freeze({ ...session, enCours: null, erreur: message });
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
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  // Sans ce refus, activer une carte pendant qu'une question est ouverte
  // écrasait l'action en attente — et un entraînement engagé, dont le jeton est
  // déjà posé, était perdu pour le tour.
  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }

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
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
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
 * Engage l'ennemi le plus à gauche des Portes qui n'a pas encore fait piocher :
 * tire ses cartes, puis lance son action — en s'arrêtant si elle réclame une
 * cible.
 *
 * « Engager » et non « révéler » : un ennemi retourné par une Vision, ou
 * survivant du combat précédent, arrive déjà révélé et fait pourtant piocher
 * ses cartes. Son action, elle, ne se relance pas (voir `revelerAuxPortes`).
 *
 * La pioche est engagée dès ce moment, comme aux règles : on pioche d'abord,
 * l'action ensuite.
 * @param {Session} session
 * @param {() => number} rng
 * @returns {Session}
 */
export function engagerProchainEnnemi(session, rng) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (session.partie.phase !== 'COMBAT') {
    return Object.freeze({ ...session, erreur: 'On n’engage les ennemis que pendant la phase Combat' });
  }

  const index = prochainAEngager(session.partie);
  if (index === null) {
    return Object.freeze({ ...session, erreur: 'Tous les ennemis aux Portes ont déjà fait piocher' });
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
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (session.partie.portes.length === 0) {
    return Object.freeze({ ...session, erreur: 'Aucun ennemi aux Portes : il n’y a pas de combat' });
  }
  if (prochainAEngager(session.partie) !== null) {
    return Object.freeze({ ...session, erreur: 'Engage d’abord tous les ennemis aux Portes' });
  }

  if (combatGagne(session.partie)) {
    const { partie } = resoudreCombat(session.partie);
    return Object.freeze({ ...session, partie, enCours: null, erreur: null });
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
 * Engage une tentative contre le Boss en tête de file : pioche le nombre de
 * cartes qu'il exige, puis lance son action — en s'arrêtant si elle réclame une
 * cible.
 *
 * La comparaison des Forces ne suit PAS. Les règles laissent le joueur jouer ses
 * actions entre la pioche et le verdict (p.11, étape 3) ; c'est
 * `resoudreLeCombatBoss` qui conclut. D'où deux commandes ici, là où
 * `combattreBoss` n'en offrirait qu'une — et c'est précisément pour cela que le
 * moteur exporte les trois étapes séparément.
 *
 * La pioche est ENGAGÉE dès ce moment : `tentativeBoss` s'en souvient, et une
 * seconde pioche est refusée tant que le combat n'est pas résolu.
 * @param {Session} session
 * @param {() => number} rng
 * @returns {Session}
 */
export function engagerLeBoss(session, rng) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (session.partie.phase !== 'COMBAT_BOSS') {
    return Object.freeze({ ...session, erreur: 'Le combat des Boss n’a pas commencé' });
  }
  if (session.tentativeBoss) {
    return Object.freeze({ ...session, erreur: 'Le Boss est déjà engagé : résous le combat' });
  }

  // Une file vide vaudrait victoire, déjà refusée plus haut : ce garde-fou
  // écarte le cas pour le vérificateur de types, pas pour le joueur.
  const [boss] = session.partie.boss;
  if (!boss) return Object.freeze({ ...session, erreur: 'Aucun Boss à affronter' });

  const partie = piocherPourBoss(session.partie, rng);
  const action = boss.type.actions.find((a) => a.declencheur === 'REVELATION');

  return ouvrir(
    Object.freeze({ ...session, partie, tentativeBoss: true, erreur: null }),
    {
      genre: 'REVELATION_BOSS',
      libelle: boss.type.nom,
      collecte: demarrerCollecte(partie, action?.effets ?? [], { typeId: boss.type.id }),
    },
    rng,
  );
}

/**
 * Compare les Forces et conclut la tentative contre le Boss.
 *
 * Rien à demander au joueur, quelle qu'en soit l'issue : un Boss vaincu quitte
 * la file, un Boss victorieux coûte la différence en ressources et reste à
 * affronter. Il n'y a pas de Force à répartir — on n'affronte qu'un Boss à la
 * fois (règles p.15).
 *
 * La tentative se referme dans les deux cas : le Champ de bataille est vidé par
 * le moteur, et la suivante repartira d'une pioche neuve.
 * @param {Session} session
 * @returns {Session}
 */
export function resoudreLeCombatBoss(session) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (!session.tentativeBoss) {
    return Object.freeze({ ...session, erreur: 'Affronte d’abord le Boss : ses cartes ne sont pas piochées' });
  }

  const { partie } = resoudreCombatBoss(session.partie);
  return Object.freeze({ ...session, partie, enCours: null, erreur: null, tentativeBoss: false });
}

/**
 * Ouvre un entraînement : pose le jeton et pioche, sans rien demander encore.
 *
 * La pioche est ENGAGÉE dès ce moment — elle est faite, elle ne se reprend pas.
 * Ce qui suit appartient au joueur : les règles (p.9, étape 3) le laissent
 * « utiliser les actions des cartes en jeu » et échanger son Garde du corps
 * AVANT de comparer sa Force à la cible. D'où deux commandes, comme pour les
 * Boss : celle-ci pioche, `conclureEntrainement` demande le sacrifice.
 *
 * Demander le sacrifice tout de suite revenait à interdire l'étape 3 : la
 * moindre activation écrasait la question, et l'entraînement du tour était
 * perdu avec elle.
 * @param {Session} session
 * @param {string} doreId
 * @param {() => number} rng
 * @returns {Session}
 */
export function commencerEntrainement(session, doreId, rng) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }

  const obstacle = obstacleEntrainement(session.partie, doreId);
  if (obstacle) return Object.freeze({ ...session, erreur: obstacle });

  const { partie } = piocherPourEntrainement(session.partie, doreId, rng);
  return Object.freeze({ ...session, partie, erreur: null, entrainementEngage: doreId });
}

/**
 * Demande quelle carte sacrifier, une fois les cartes jouées. Les candidats et
 * le prix sont calculés MAINTENANT : c'est tout l'intérêt d'avoir attendu, la
 * Force en jeu ayant pu monter entre-temps.
 * @param {Session} session
 * @returns {Session}
 */
export function conclureEntrainement(session) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }

  const doreId = session.entrainementEngage;
  if (!doreId) return Object.freeze({ ...session, erreur: 'Aucun entraînement en cours' });

  const dore = dores.find((d) => d.id === doreId);
  if (!dore) return Object.freeze({ ...session, erreur: `Carte Doré inconnue : ${doreId}` });

  const cout = coutEntrainement(session.partie, doreId);
  const echange = dore.entrainement.echange;

  const options = session.partie.champDeBataille
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

  return Object.freeze({ ...session, erreur: null, enCours });
}

/**
 * Renonce à l'entraînement engagé : la main tirée rejoint l'Hôpital et la Doré
 * reste sur sa pile. C'est l'arrêt que prévoient les règles quand la cible
 * n'est pas atteinte et qu'on ne veut pas la payer. Le jeton, lui, est posé
 * pour le tour.
 * @param {Session} session
 * @returns {Session}
 */
export function renoncerALEntrainement(session) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (!session.entrainementEngage) {
    return Object.freeze({ ...session, erreur: 'Aucun entraînement en cours' });
  }

  return Object.freeze({
    ...session,
    partie: renoncerEntrainement(session.partie),
    enCours: null,
    erreur: null,
    entrainementEngage: null,
  });
}

/**
 * Fait passer une carte du Champ de bataille Garde du corps ; l'ancien Garde du
 * corps redescend au Champ de bataille et compte de nouveau pour la Force. Une
 * seule fois par phase, et jamais contre une carte déjà activée — le moteur
 * tranche, on ne recopie pas ses conditions.
 *
 * Si la carte a une action GARDE_DU_CORPS, ses choix sont recueillis d'abord.
 * Ils sont calculés sur l'état d'AVANT l'échange : aucune action de ce
 * déclencheur ne puise ses candidats dans le Champ de bataille (le Prêtre
 * cherche à l'Hôpital, le Guetteur regarde la piste), les deux états donnent
 * donc les mêmes options — et la collecte n'est de toute façon qu'une aide à
 * la saisie, le moteur restant le gardien.
 * @param {Session} session
 * @param {string} instanceId
 * @param {() => number} rng
 * @returns {Session}
 */
export function echangerLeGardeDuCorps(session, instanceId, rng) {
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }

  const carte = session.partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!carte) {
    return Object.freeze({ ...session, erreur: 'Carte absente du Champ de bataille' });
  }

  const action = carte.type.actions.find((a) => a.declencheur === 'GARDE_DU_CORPS');

  return ouvrir(
    session,
    {
      genre: 'GARDE_DU_CORPS',
      libelle: `${carte.type.nom} passe Garde du corps`,
      instanceId,
      collecte: demarrerCollecte(session.partie, action?.effets ?? [], {
        typeId: carte.type.id,
        carteActiveeId: instanceId,
      }),
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
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  const action = session.enCours;
  if (!action) return Object.freeze({ ...session, erreur: 'Aucune action en cours' });

  // La répartition de la Force conclut le combat perdu.
  if (action.genre === 'COMBAT') {
    try {
      const cibles = valeurs.map(Number);
      const { partie } = resoudreCombat(session.partie, cibles);
      return Object.freeze({ ...session, partie, enCours: null, erreur: null });
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
      return Object.freeze({
        ...session,
        partie,
        enCours: null,
        erreur: null,
        entrainementEngage: null,
      });
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
 * Referme la question en cours sans y répondre. La partie n'a pas bougé : une
 * collecte n'a aucun effet de bord, et la question du sacrifice non plus.
 *
 * N'abandonne PAS l'entraînement engagé : renoncer est une décision à part
 * (voir `renoncerALEntrainement`), et refermer la question laisse au joueur de
 * quoi activer une carte de plus avant de reposer la même.
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
  const finie = refusSiTerminee(session);
  if (finie) return finie;

  if (session.enCours) {
    return Object.freeze({ ...session, erreur: 'Termine l’action en cours d’abord' });
  }
  if (session.partie.phase === 'COMBAT_BOSS') {
    return Object.freeze({ ...session, erreur: 'Le combat des Boss ne mène à aucune autre phase' });
  }

  return Object.freeze({
    ...session,
    partie: passerALaPhaseSuivante(session.partie),
    enCours: null,
    erreur: null,
  });
}
