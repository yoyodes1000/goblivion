// Tests de la phase « L'Ennemi Avance » : avancée, entrée aux Portes,
// débordement, épuisement, et Vision.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { avancerEnnemis, pisteEtPileVides, revelerSurPiste } from '../public/js/moteur/ennemi-avance.js';

function neuve() {
  return miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
}

/** @param {import('../public/js/moteur/partie.js').Partie} p */
function nbSurPiste(p) {
  return p.pisteEnnemi.filter((c) => c !== null).length;
}

test('une avancée fait apparaître un ennemi sur la case 1', () => {
  const p = avancerEnnemis(neuve());
  assert.equal(nbSurPiste(p), 1);
  assert.equal(p.pisteEnnemi[0]?.revele, false);
  assert.equal(p.portes.length, 0);
  assert.equal(p.pileEnnemi.length, 14);
});

test('après 4 avancées la piste est pleine et les Portes vides', () => {
  let p = neuve();
  for (let i = 0; i < 4; i++) p = avancerEnnemis(p);
  assert.equal(nbSurPiste(p), 4);
  assert.equal(p.portes.length, 0);
});

test('à la 5e avancée, le premier ennemi entre aux Portes', () => {
  let p = neuve();
  for (let i = 0; i < 5; i++) p = avancerEnnemis(p);
  assert.equal(p.portes.length, 1);
  assert.equal(nbSurPiste(p), 4);
});

test('les Portes ne dépassent jamais 3 (l’excédent est détruit)', () => {
  let p = neuve();
  for (let i = 0; i < 8; i++) p = avancerEnnemis(p);
  assert.equal(p.portes.length, 3);
  // 8 cartes sorties de la pile ; 3 aux Portes + 4 sur la piste = 7 → 1 détruite.
  assert.equal(p.portes.length + nbSurPiste(p), 7);
});

test('quand la pile et la piste sont vides, on bascule vers le combat des Boss', () => {
  let p = neuve();
  assert.equal(pisteEtPileVides(p), false);
  for (let i = 0; i < 30; i++) p = avancerEnnemis(p);
  assert.equal(p.pileEnnemi.length, 0);
  assert.equal(nbSurPiste(p), 0);
  assert.equal(pisteEtPileVides(p), true);
});

test('la Vision révèle un ennemi, qui reste révélé en glissant', () => {
  let p = revelerSurPiste(avancerEnnemis(neuve()), 0);
  assert.equal(p.pisteEnnemi[0]?.revele, true);
  p = avancerEnnemis(p); // il glisse de la case 1 (index 0) à la case 2 (index 1)
  assert.equal(p.pisteEnnemi[1]?.revele, true);
});

test('avancerEnnemis n’altère pas l’état d’origine (immuabilité)', () => {
  const p0 = neuve();
  avancerEnnemis(p0);
  assert.equal(nbSurPiste(p0), 0);
  assert.equal(p0.pileEnnemi.length, 15);
});
