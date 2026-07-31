// Tests des petits helpers d'état : ressources et fin de phase.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { piocher } from '../public/js/moteur/pioche.js';
import { ajusterRessources, viderChampDeBataille, estPerdue } from '../public/js/moteur/partie.js';

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
