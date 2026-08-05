// Tests de la pioche (Château → Champ de bataille) et de la reconstitution.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { piocher } from '../public/js/moteur/pioche.js';
import { viderChampDeBataille } from '../public/js/moteur/partie.js';

function partieNeuve() {
  return miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
}

test('piocher déplace des cartes du Château vers le Champ de bataille', () => {
  const { partie, reconstitutions } = piocher(partieNeuve(), 3, creerRng(9));
  assert.equal(partie.champDeBataille.length, 3);
  assert.equal(partie.chateau.length, 17);
  assert.equal(reconstitutions, 0);
});

test('piocher n’altère pas l’état d’origine (immuabilité)', () => {
  const p0 = partieNeuve();
  piocher(p0, 5, creerRng(9));
  assert.equal(p0.chateau.length, 20);
  assert.equal(p0.champDeBataille.length, 0);
});

test('quand le Château est vide, on reconstitue la pioche depuis l’Hôpital', () => {
  let p = partieNeuve();
  p = piocher(p, 20, creerRng(1)).partie; // vide le Château (champ = 20)
  p = viderChampDeBataille(p); //            → Hôpital 20, Château 0
  assert.equal(p.chateau.length, 0);
  assert.equal(p.hopital.length, 20);

  const { partie, reconstitutions } = piocher(p, 5, creerRng(2));
  assert.equal(reconstitutions, 1);
  assert.equal(partie.champDeBataille.length, 5);
  assert.equal(partie.chateau.length, 15);
  assert.equal(partie.hopital.length, 0);
});

test('piocher s’arrête s’il n’y a plus aucune carte disponible', () => {
  let p = partieNeuve();
  p = piocher(p, 20, creerRng(1)).partie; // Château et Hôpital vides ensuite
  const { partie, reconstitutions } = piocher(p, 5, creerRng(1));
  assert.equal(partie.champDeBataille.length, 20); // rien de plus à piocher
  assert.equal(reconstitutions, 0);
});
