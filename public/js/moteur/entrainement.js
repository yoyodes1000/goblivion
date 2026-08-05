// Moteur — phase Entraînement (règles p.8-9). Couche PURE, aléa injecté.
// On entraîne une carte en jeu pour la remplacer par une carte Doré plus forte.
//
// L'entraînement se joue en DEUX temps, exportés séparément, et le découpage
// n'est pas décoratif : la carte sacrifiée sort de la pioche de l'entraînement
// lui-même. Le Champ de bataille est vide quand la phase commence — la
// précédente l'a vidé — donc réclamer le sacrifice avant la pioche reviendrait
// à le choisir parmi rien.
//
// Il ouvre du même coup l'option que les règles prévoient : « on paie la
// différence en ressources pour poursuivre, OU on arrête l'entraînement ».
// Arrêter, c'est simplement ne pas appeler la seconde étape — les cartes
// piochées restent alors en jeu, là où un entraînement mené à terme les envoie
// toutes à l'Hôpital. Renoncer à la carte pour garder la force est donc un
// vrai choix, et non un cas d'erreur.
//
// `entrainer` compose les deux pour les appelants qui n'ont pas à s'intercaler.

import { piocher } from './pioche.js';
import { forceTotale } from './force.js';
import { rendreTypeImprime, viderChampDeBataille } from './partie.js';
import { executerEffets } from './effets.js';
import { dores } from './cartes/index.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./cartes/dores.js').CarteDore} CarteDore */

/**
 * @typedef {object} OptionsEntrainement
 * @property {string} doreId               Type Doré à entraîner (présent au marché).
 * @property {string} sacrifieInstanceId   Carte EN JEU à détruire (symbole = échange du Doré).
 */

/**
 * La carte Doré désignée, ou une erreur explicite.
 * @param {string} doreId
 * @returns {CarteDore}
 */
function trouverDore(doreId) {
  const dore = dores.find((d) => d.id === doreId);
  if (!dore) throw new Error(`Carte Doré inconnue : ${doreId}`);
  return dore;
}

/**
 * Ce qui empêche d'entraîner cette Doré maintenant, ou `null` si rien.
 *
 * Une seule source pour deux usages : `piocherPourEntrainement` en fait ses
 * refus, et l'interface s'en sert pour griser les piles hors de portée. Les
 * dupliquer les ferait diverger.
 * @param {Partie} partie
 * @param {string} doreId
 * @returns {string | null}
 */
export function obstacleEntrainement(partie, doreId) {
  // Rien n'interdisait jusqu'ici d'entraîner en plein Combat. La phase le dit
  // pourtant, et les règles le redisent pour les Boss : « plus d'ENTRAÎNEMENT ».
  if (partie.phase !== 'ENTRAINEMENT') return 'On n’entraîne que pendant la phase Entraînement';
  if (partie.entrainementUtilise) return 'Le jeton d’entraînement est déjà posé ce tour';

  const dore = dores.find((d) => d.id === doreId);
  if (!dore) return `Carte Doré inconnue : ${doreId}`;

  const pile = partie.marcheDore.find((m) => m.typeId === dore.id);
  if (!pile || pile.restant <= 0) return `Aucun exemplaire de ${dore.nom} au marché`;

  if (dore.niveau === 'DEUX_EPEES' && !partie.premierCombatGagne) {
    return 'Les cartes 2 épées ne sont disponibles qu’après un premier combat gagné';
  }
  return null;
}

/**
 * Étape 1 — pioche le nombre de cartes indiqué par le coût d'entraînement.
 *
 * Remonte les reconstitutions du Château sans en tirer de conséquence, comme
 * les autres dispatchers : c'est à l'appelant de la traiter (voir
 * `appliquerChateauVide` dans `orchestration.js`).
 * @param {Partie} partie
 * @param {string} doreId
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function piocherPourEntrainement(partie, doreId, rng) {
  const obstacle = obstacleEntrainement(partie, doreId);
  if (obstacle) throw new Error(obstacle);

  // Piocher, c'est avoir posé le jeton : l'entraînement du tour est engagé,
  // qu'on le mène à terme ou qu'on y renonce.
  const engage = Object.freeze({ ...partie, entrainementUtilise: true });
  return piocher(engage, trouverDore(doreId).entrainement.piocher, rng);
}

/**
 * Ce qu'il reste à payer en ressources pour atteindre la cible, une fois la
 * pioche faite : 0 si la Force en jeu suffit.
 * @param {Partie} partie
 * @param {string} doreId
 * @returns {number}
 */
export function coutEntrainement(partie, doreId) {
  const cible = trouverDore(doreId).entrainement.cible;
  return Math.max(0, cible - forceTotale(partie.champDeBataille));
}

/**
 * Étape 2 — paie la différence, détruit la carte sacrifiée, ajoute la Doré à
 * l'Hôpital et déclenche son action ENTRAINEMENT (le Chevalier est le seul à
 * en avoir une).
 *
 * Les autres cartes piochées rejoignent l'Hôpital : mener l'entraînement à
 * terme coûte la main qu'on a tirée pour l'atteindre.
 * @param {Partie} partie
 * @param {OptionsEntrainement} options
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function finaliserEntrainement(partie, options, rng) {
  const dore = trouverDore(options.doreId);

  const manque = coutEntrainement(partie, options.doreId);
  if (manque > partie.ressources) {
    throw new Error('Ressources insuffisantes pour atteindre la cible d’entraînement');
  }

  const sacrifie = partie.champDeBataille.find((c) => c.instanceId === options.sacrifieInstanceId);
  if (!sacrifie) throw new Error('Carte à sacrifier absente du Champ de bataille');
  if (sacrifie.type.symbole !== dore.entrainement.echange) {
    throw new Error(`La carte sacrifiée doit être de symbole ${dore.entrainement.echange}`);
  }

  /** @type {import('./partie.js').InstanceAlliee} */
  const entrainee = { instanceId: `${dore.id}#entraine-t${partie.tour}`, type: dore };

  const enJeuRestant = partie.champDeBataille
    .filter((c) => c.instanceId !== options.sacrifieInstanceId)
    .map(rendreTypeImprime);
  const marcheDore = partie.marcheDore.map((m) =>
    m.typeId === dore.id ? { ...m, restant: m.restant - 1 } : m,
  );

  const etat = Object.freeze({
    ...partie,
    ressources: partie.ressources - manque,
    champDeBataille: [],
    hopital: [...partie.hopital, ...enJeuRestant, entrainee],
    marcheDore,
  });

  // Action ENTRAINEMENT de la carte acquise. Pas de `carteActiveeId` : rien
  // n'est « activé en jeu » pendant un entraînement, et le Champ de bataille
  // vient d'être vidé. Pas de choix non plus — le seul effet existant
  // (Chevalier) n'en demande aucun ; le jour où ce sera le cas, la signature
  // évoluera.
  const action = dore.actions.find((a) => a.declencheur === 'ENTRAINEMENT');
  if (!action) return { partie: etat, reconstitutions: 0 };

  return executerEffets(etat, action.effets, [], rng, undefined, dore.id);
}

/**
 * Renoncer après la pioche : la main tirée rejoint l'Hôpital et la Doré reste
 * sur sa pile. C'est l'issue que les règles prévoient quand la cible n'est pas
 * atteinte et qu'on ne veut pas la payer.
 *
 * Les cartes NE restent PAS en jeu : le terrain d'entraînement se vide dans les
 * deux cas, réussite comme échec. Seul le sort de la Doré diffère.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function renoncerEntrainement(partie) {
  return viderChampDeBataille(partie);
}

/**
 * Un entraînement complet : pioche puis échange. Les appelants qui laissent le
 * joueur choisir son sacrifice enchaînent plutôt les deux étapes eux-mêmes,
 * pour intercaler la saisie une fois la pioche connue.
 * @param {Partie} partie
 * @param {OptionsEntrainement} options
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function entrainer(partie, options, rng) {
  const pioche = piocherPourEntrainement(partie, options.doreId, rng);
  const fin = finaliserEntrainement(pioche.partie, options, rng);

  return { partie: fin.partie, reconstitutions: pioche.reconstitutions + fin.reconstitutions };
}
