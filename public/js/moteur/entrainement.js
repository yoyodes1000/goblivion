// Moteur — phase Entraînement (règles p.8-9). Couche PURE, aléa injecté.
// On entraîne une carte en jeu pour la remplacer par une carte Doré plus forte.
// L'action ENTRAINEMENT de la carte acquise se déclenche une fois l'échange
// terminé (le Chevalier est le seul à en avoir une). Les actions optionnelles
// jouées pendant la phase (pivoter) sont pilotées par le joueur, pas ici.

import { piocher } from './pioche.js';
import { forceTotale } from './force.js';
import { rendreTypeImprime } from './partie.js';
import { executerEffets } from './effets.js';
import { dores } from './cartes/index.js';

/** @typedef {import('./partie.js').Partie} Partie */

/**
 * @typedef {object} OptionsEntrainement
 * @property {string} doreId               Type Doré à entraîner (présent au marché).
 * @property {string} sacrifieInstanceId   Carte EN JEU à détruire (symbole = échange du Doré).
 */

/**
 * Entraîne une carte Doré : pioche, atteint (ou paie) la cible de force, détruit
 * une carte en jeu du symbole demandé, et ajoute la Doré obtenue à l'Hôpital.
 *
 * Remonte le nombre de reconstitutions du Château sans en tirer de conséquence,
 * comme les autres dispatchers : c'est à l'appelant de la traiter (voir
 * `appliquerChateauVide` dans `orchestration.js`).
 * @param {Partie} partie
 * @param {OptionsEntrainement} options
 * @param {() => number} rng
 * @returns {{ partie: Partie, reconstitutions: number }}
 */
export function entrainer(partie, options, rng) {
  const dore = dores.find((d) => d.id === options.doreId);
  if (!dore) throw new Error(`Carte Doré inconnue : ${options.doreId}`);

  const pile = partie.marcheDore.find((m) => m.typeId === dore.id);
  if (!pile || pile.restant <= 0) throw new Error(`Aucun exemplaire de ${dore.nom} au marché`);

  if (dore.niveau === 'DEUX_EPEES' && !partie.premierCombatGagne) {
    throw new Error('Les cartes 2 épées ne sont disponibles qu’après un premier combat gagné');
  }

  // Piocher le nombre de cartes indiqué par le coût d'entraînement.
  const { partie: apresPioche, reconstitutions } = piocher(partie, dore.entrainement.piocher, rng);

  // Comparer la force à la cible ; payer la différence en ressources si besoin.
  const force = forceTotale(apresPioche.champDeBataille);
  const manque = Math.max(0, dore.entrainement.cible - force);
  if (manque > apresPioche.ressources) {
    throw new Error('Ressources insuffisantes pour atteindre la cible d’entraînement');
  }

  // Détruire la carte en jeu du symbole demandé (elle est retirée du jeu).
  const sacrifie = apresPioche.champDeBataille.find((c) => c.instanceId === options.sacrifieInstanceId);
  if (!sacrifie) throw new Error('Carte à sacrifier absente du Champ de bataille');
  if (sacrifie.type.symbole !== dore.entrainement.echange) {
    throw new Error(`La carte sacrifiée doit être de symbole ${dore.entrainement.echange}`);
  }

  // La Doré entraînée devient une instance ajoutée à l'Hôpital.
  /** @type {import('./partie.js').InstanceAlliee} */
  const entrainee = { instanceId: `${dore.id}#entraine-t${partie.tour}`, type: dore };

  // Les autres cartes en jeu rejoignent l'Hôpital ; la sacrifiée est détruite.
  const enJeuRestant = apresPioche.champDeBataille
    .filter((c) => c.instanceId !== options.sacrifieInstanceId)
    .map(rendreTypeImprime);
  const marcheDore = apresPioche.marcheDore.map((m) =>
    m.typeId === dore.id ? { ...m, restant: m.restant - 1 } : m,
  );

  const etat = Object.freeze({
    ...apresPioche,
    ressources: apresPioche.ressources - manque,
    champDeBataille: [],
    hopital: [...apresPioche.hopital, ...enJeuRestant, entrainee],
    marcheDore,
  });

  // Action ENTRAINEMENT de la carte acquise. Pas de `carteActiveeId` : rien
  // n'est « activé en jeu » pendant un entraînement, et le Champ de bataille
  // vient d'être vidé. Pas de choix non plus — le seul effet existant (Chevalier)
  // n'en demande aucun ; le jour où ce sera le cas, la signature évoluera.
  const action = dore.actions.find((a) => a.declencheur === 'ENTRAINEMENT');
  if (!action) return { partie: etat, reconstitutions };

  const resultat = executerEffets(etat, action.effets, [], rng, undefined, dore.id);
  return {
    partie: resultat.partie,
    reconstitutions: reconstitutions + resultat.reconstitutions,
  };
}
