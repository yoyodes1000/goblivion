// Moteur — exécution des effets structurés d'une action (voir le vocabulaire
// dans cartes/types.js). Couche PURE, aléa injecté.
//
// Les effets qui visent une carte précise (défausser, détruire...) ou une
// branche (CHOIX) reçoivent leur cible en paramètre, via `choix` : le moteur
// ne choisit jamais à la place du joueur, l'UI la fournira au clic.
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
/** @typedef {import('./cartes/types.js').Effet} Effet */

/**
 * Le choix nécessaire pour résoudre un effet donné (absent si l'effet n'en a
 * pas besoin) : `cibles` pour DEFAUSSER/DETRUIRE_JEU/DETRUIRE_HOPITAL (un
 * instanceId par carte visée), `indexPiste` pour VISION (un index de case par
 * vision générée).
 * @typedef {object} Choix
 * @property {readonly string[]} [cibles]
 * @property {readonly number[]} [indexPiste]
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
 * Détruit les cartes visées du Champ de bataille (retirées du jeu, définitif).
 * @param {Partie} partie
 * @param {readonly string[]} cibles
 * @returns {Partie}
 */
function detruireEnJeu(partie, cibles) {
  let etat = partie;
  for (const instanceId of cibles) {
    if (!etat.champDeBataille.some((c) => c.instanceId === instanceId)) {
      throw new Error(`DETRUIRE_JEU : carte absente du Champ de bataille (${instanceId})`);
    }
    etat = Object.freeze({
      ...etat,
      champDeBataille: etat.champDeBataille.filter((c) => c.instanceId !== instanceId),
    });
  }
  return etat;
}

/**
 * Détruit les cartes visées de l'Hôpital (retirées du jeu, définitif).
 * @param {Partie} partie
 * @param {readonly string[]} cibles
 * @returns {Partie}
 */
function detruireHopital(partie, cibles) {
  let etat = partie;
  for (const instanceId of cibles) {
    if (!etat.hopital.some((c) => c.instanceId === instanceId)) {
      throw new Error(`DETRUIRE_HOPITAL : carte absente de l'Hôpital (${instanceId})`);
    }
    etat = Object.freeze({ ...etat, hopital: etat.hopital.filter((c) => c.instanceId !== instanceId) });
  }
  return etat;
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
        const cibles = c?.cibles ?? [];
        if (cibles.length !== 1) throw new Error('DETRUIRE_JEU : une seule cible attendue');
        etat = detruireEnJeu(etat, cibles);
        break;
      }

      case 'DETRUIRE_HOPITAL': {
        const cibles = c?.cibles ?? [];
        if (cibles.length !== 1) throw new Error('DETRUIRE_HOPITAL : une seule cible attendue');
        etat = detruireHopital(etat, cibles);
        break;
      }

      default:
        throw new Error(`Effet non encore exécutable : ${effet.type}`);
    }
  });

  return { partie: etat, reconstitutions };
}
