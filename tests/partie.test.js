// Tests des petits helpers d'état : ressources et fin de phase.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { piocher } from '../public/js/moteur/pioche.js';
import {
  ajusterRessources,
  viderChampDeBataille,
  estPerdue,
  substituerType,
  rendreTypeImprime,
} from '../public/js/moteur/partie.js';

/**
 * Instance de test, éventuellement porteuse d'un jeton bonus.
 * @param {string} instanceId @param {string} typeId @param {number} [jetonBonus]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function instance(instanceId, typeId, jetonBonus) {
  const type = /** @type {any} */ ({ id: typeId, force: 2, actions: [] });
  return jetonBonus === undefined ? { instanceId, type } : { instanceId, type, jetonBonus };
}

/** @param {string} id @returns {any} */
function type(id) {
  return { id, force: 5, actions: [] };
}

function partieNeuve() {
  return miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
}

test('ajusterRessources gagne et perd de l’or', () => {
  const p = partieNeuve(); // Margot : 18 or
  assert.equal(ajusterRessources(p, 2).ressources, 20);
  assert.equal(ajusterRessources(p, -5).ressources, 13);
});

test('les ressources ne descendent jamais sous zéro', () => {
  const p = partieNeuve();
  assert.equal(ajusterRessources(p, -100).ressources, 0);
});

test('estPerdue est vrai quand les ressources sont épuisées', () => {
  const p = partieNeuve();
  assert.equal(estPerdue(p), false);
  assert.equal(estPerdue(ajusterRessources(p, -100)), true);
});

test('viderChampDeBataille envoie les cartes en jeu à l’Hôpital', () => {
  let p = piocher(partieNeuve(), 4, creerRng(3)).partie;
  assert.equal(p.champDeBataille.length, 4);
  p = viderChampDeBataille(p);
  assert.equal(p.champDeBataille.length, 0);
  assert.equal(p.hopital.length, 4);
});

// Les tests de echangerGardeDuCorps vivent dans garde-du-corps.test.js —
// la fonction a rejoint son propre fichier (voir garde-du-corps.js).

// Substitution de type (Joker qui copie un Paysan, Héros du village qui
// devient un Soldat).

test('substituerType : la carte prend le nouveau type sans perdre son identité', () => {
  const p = { ...partieNeuve(), champDeBataille: [instance('x#1', 'joker', 3)] };
  const [apres] = substituerType(p, 'x#1', type('gentilhomme')).champDeBataille;

  assert.equal(apres?.type.id, 'gentilhomme');
  assert.equal(apres?.instanceId, 'x#1'); // c'est toujours la même carte
  assert.equal(apres?.jetonBonus, 3);
  assert.equal(apres?.typeOrigine?.id, 'joker');
});

test('substituerType : une seconde substitution garde le type imprimé d’origine', () => {
  const p = { ...partieNeuve(), champDeBataille: [instance('x#1', 'joker')] };
  const uneFois = substituerType(p, 'x#1', type('gentilhomme'));
  const [apres] = substituerType(uneFois, 'x#1', type('fermier')).champDeBataille;

  assert.equal(apres?.type.id, 'fermier');
  assert.equal(apres?.typeOrigine?.id, 'joker'); // pas 'gentilhomme'
});

test('substituerType : refuse une carte absente du Champ de bataille', () => {
  const p = { ...partieNeuve(), champDeBataille: [] };
  assert.throws(() => substituerType(p, 'x#1', type('fermier')), /absente du Champ de bataille/);
});

test('rendreTypeImprime : rend le type d’origine et efface la trace', () => {
  const p = { ...partieNeuve(), champDeBataille: [instance('x#1', 'joker', 2)] };
  const [substituee] = substituerType(p, 'x#1', type('gentilhomme')).champDeBataille;
  const rendue = rendreTypeImprime(/** @type {any} */ (substituee));

  assert.equal(rendue.type.id, 'joker');
  assert.equal(rendue.typeOrigine, undefined);
  assert.equal(rendue.jetonBonus, 2); // le jeton n'est pas une caractéristique du type
});

test('rendreTypeImprime : laisse intacte une carte jamais substituée', () => {
  const carte = instance('x#1', 'fermier');
  assert.equal(rendreTypeImprime(carte), carte);
});

test('viderChampDeBataille : les cartes substituées redeviennent elles-mêmes à l’Hôpital', () => {
  const p = { ...partieNeuve(), champDeBataille: [instance('x#1', 'joker')], hopital: [] };
  const { hopital } = viderChampDeBataille(substituerType(p, 'x#1', type('gentilhomme')));

  assert.equal(hopital[0]?.type.id, 'joker');
  assert.equal(hopital[0]?.typeOrigine, undefined);
});
