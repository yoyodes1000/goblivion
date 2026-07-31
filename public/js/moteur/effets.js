// Moteur — exécution des effets structurés d'une action (voir le vocabulaire
// dans cartes/types.js). Couche PURE, aléa injecté.
//
// Les effets qui visent une carte précise (défausser, détruire...) ou une
// branche (CHOIX) reçoivent leur cible en paramètre, via `choix` : le moteur
// ne choisit jamais à la place du joueur, l'UI la fournira au clic.
//
// Détruire une carte (DETRUIRE_JEU/DETRUIRE_HOPITAL) déclenche son éventuelle
// action TESTAMENT, exécutée récursivement via executerEffets.
//
// Pas encore gérés (lèvent une erreur explicite plutôt que de ne rien faire) :
// - FORCE : poser un jeton bonus sur une carte alliée n'est pas encore
//   modélisé (contrairement aux ennemis, qui ont déjà `jetonBonus`) — décision
//   de conception à part entière.
// - JETON_ENNEMI, ENNEMI_AVANCE : contexte ennemi/orchestration, pas
//   nécessaires pour les actions PIVOTER des cartes alliées visées ici.
// - CHOIX : la sélection de branche + ses sous-choix demande sa propre
//   conception (imbrication), pas dans ce premier lot.
// - SPECIAL : propre à chaque carte, gestionnaires à écrire au cas par cas.

import { piocher } from './pioche.js';
import { ajusterRessources } from './partie.js';
import { revelerSurPiste } from './ennemi-avance.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./partie.js').InstanceAlliee} InstanceAlliee */
/** @typedef {import('./cartes/types.js').Effet} Effet */

/**
 * Le choix nécessaire pour résoudre un effet donné (absent si l'effet n'en a
 * pas besoin) : `cibles` pour DEFAUSSER/DETRUIRE_JEU/DETRUIRE_HOPITAL (un
 * instanceId par carte visée), `indexPiste` pour VISION (un index de case par
 * vision générée), `choixTestament` pour DETRUIRE_JEU/DETRUIRE_HOPITAL — le
 * choix de l'action TESTAMENT que la carte détruite déclenche, le cas échéant.
 * @typedef {object} Choix
 * @property {readonly string[]} [cibles]
 * @property {readonly number[]} [indexPiste]
 * @property {readonly (Choix | undefined)[]} [choixTestament]
 */

/**
 * Défausse les cartes visées du Champ de bataille vers l'Hôpital.
 * @param {Partie} partie
 * @param {readonly string[]} cibles
 * @returns {Partie}
 */
function defausser(partie, cibles) {
  let etat = partie;
  for (const instanceId of cibles) {
    const carte = etat.champDeBataille.find((c) => c.instanceId === instanceId);
    if (!carte) throw new Error(`DEFAUSSER : carte absente du Champ de bataille (${instanceId})`);
    etat = Object.freeze({
      ...etat,
      champDeBataille: etat.champDeBataille.filter((c) => c.instanceId !== instanceId),
      hopital: [...etat.hopital, carte],
    });
  }
  return etat;
}

/**
 * Exécute l'action TESTAMENT de `carte` si elle en a une (à appeler juste
 * après sa destruction). Sans TESTAMENT, ne fait rien.
 * @param {Partie} partie
 * @param {InstanceAlliee} carte
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
function executerTestament(partie, carte, choix, rng) {
  const action = carte.type.actions.find((a) => a.declencheur === 'TESTAMENT');
  if (!action) return { partie, reconstitutions: 0 };
  return executerEffets(partie, action.effets, choix, rng);
}

/**
 * Détruit la carte visée du Champ de bataille (retirée du jeu, définitif) et
 * exécute son éventuel TESTAMENT.
 * @param {Partie} partie
 * @param {string} instanceId
 * @param {readonly (Choix | undefined)[]} choixTestament
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
function detruireEnJeu(partie, instanceId, choixTestament, rng) {
  const carte = partie.champDeBataille.find((c) => c.instanceId === instanceId);
  if (!carte) throw new Error(`DETRUIRE_JEU : carte absente du Champ de bataille (${instanceId})`);

  const etat = Object.freeze({
    ...partie,
    champDeBataille: partie.champDeBataille.filter((c) => c.instanceId !== instanceId),
  });

  return executerTestament(etat, carte, choixTestament, rng);
}

/**
 * Détruit la carte visée de l'Hôpital (retirée du jeu, définitif) et exécute
 * son éventuel TESTAMENT.
 * @param {Partie} partie
 * @param {string} instanceId
 * @param {readonly (Choix | undefined)[]} choixTestament
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
function detruireHopital(partie, instanceId, choixTestament, rng) {
  const carte = partie.hopital.find((c) => c.instanceId === instanceId);
  if (!carte) throw new Error(`DETRUIRE_HOPITAL : carte absente de l'Hôpital (${instanceId})`);

  const etat = Object.freeze({
    ...partie,
    hopital: partie.hopital.filter((c) => c.instanceId !== instanceId),
  });

  return executerTestament(etat, carte, choixTestament, rng);
}

/**
 * Révèle les cases de piste visées (effet VISION).
 * @param {Partie} partie
 * @param {readonly number[]} indexPiste
 * @returns {Partie}
 */
function genererVision(partie, indexPiste) {
  let etat = partie;
  for (const index of indexPiste) etat = revelerSurPiste(etat, index);
  return etat;
}

/**
 * Exécute une suite d'effets (l'`effets` d'une `Action`), dans l'ordre.
 * `choix[i]` fournit la décision du joueur pour `effets[i]` quand il en faut
 * une (voir `Choix`) ; absent pour PIOCHER/OR, qui n'en ont pas besoin.
 * @param {Partie} partie
 * @param {readonly Effet[]} effets
 * @param {readonly (Choix | undefined)[]} choix
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function executerEffets(partie, effets, choix, rng) {
  let etat = partie;
  let reconstitutions = 0;

  effets.forEach((effet, i) => {
    const c = choix[i];
    switch (effet.type) {
      case 'PIOCHER': {
        const r = piocher(etat, effet.valeur ?? 1, rng);
        etat = r.partie;
        reconstitutions += r.reconstitutions;
        break;
      }

      case 'OR':
        etat = ajusterRessources(etat, effet.valeur ?? 0);
        break;

      case 'VISION': {
        const indexPiste = c?.indexPiste ?? [];
        if (indexPiste.length !== (effet.valeur ?? 1)) {
          throw new Error('VISION : nombre de cases visées invalide');
        }
        etat = genererVision(etat, indexPiste);
        break;
      }

      case 'DEFAUSSER': {
        const cibles = c?.cibles ?? [];
        if (cibles.length !== (effet.valeur ?? 1)) {
          throw new Error('DEFAUSSER : nombre de cibles invalide');
        }
        etat = defausser(etat, cibles);
        break;
      }

      case 'DETRUIRE_JEU': {
        const [cible, ...reste] = c?.cibles ?? [];
        if (!cible || reste.length > 0) throw new Error('DETRUIRE_JEU : une seule cible attendue');
        const r = detruireEnJeu(etat, cible, c?.choixTestament ?? [], rng);
        etat = r.partie;
        reconstitutions += r.reconstitutions;
        break;
      }

      case 'DETRUIRE_HOPITAL': {
        const [cible, ...reste] = c?.cibles ?? [];
        if (!cible || reste.length > 0) throw new Error('DETRUIRE_HOPITAL : une seule cible attendue');
        const r = detruireHopital(etat, cible, c?.choixTestament ?? [], rng);
        etat = r.partie;
        reconstitutions += r.reconstitutions;
        break;
      }

      default:
        throw new Error(`Effet non encore exécutable : ${effet.type}`);
    }
  });

  return { partie: etat, reconstitutions };
}
