// Tests de la mise en place et de la progression d'une partie solo.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { avancerPhase } from '../public/js/moteur/partie.js';

/**
 * @param {'FACILE' | 'NORMAL' | 'DIFFICILE'} [difficulte]
 * @param {number} [seed]
 */
function partieTest(difficulte = 'NORMAL', seed = 1) {
  return miseEnPlace({ roiReineId: 'margot', difficulte }, creerRng(seed));
}

test('le Château démarre avec 20 cartes Bleu', () => {
  assert.equal(partieTest().chateau.length, 20);
});

test('les ressources et le Garde du corps viennent du rôle Roi/Reine', () => {
  const p = partieTest();
  assert.equal(p.roiReine.id, 'margot');
  assert.equal(p.ressources, 18); // or de départ de Margot
  assert.equal(p.gardeDuCorps?.type.id, 'archer'); // Garde du corps de Margot
});

test('la pile Ennemi contient 15 cartes, les « 1 épée » au-dessus', () => {
  const p = partieTest();
  assert.equal(p.pileEnnemi.length, 15);
  for (let i = 0; i < 8; i++) {
    assert.equal(p.pileEnnemi[i]?.type.niveau, 'UNE_EPEE', `carte ${i} : attendu 1 épée`);
  }
  for (let i = 8; i < 15; i++) {
    assert.equal(p.pileEnnemi[i]?.type.niveau, 'DEUX_EPEES', `carte ${i} : attendu 2 épées`);
  }
});

test('le nombre de Boss dépend de la difficulté', () => {
  assert.equal(partieTest('FACILE').boss.length, 3);
  assert.equal(partieTest('NORMAL').boss.length, 4);
  assert.equal(partieTest('DIFFICILE').boss.length, 5);
});

test('la difficulté Difficile démarre par la phase « L’Ennemi Avance »', () => {
  assert.equal(partieTest('DIFFICILE').phase, 'ENNEMI_AVANCE');
  assert.equal(partieTest('NORMAL').phase, 'ENTRAINEMENT');
});

test('le mode Facile donne 3 jetons bonus de départ, les autres 0', () => {
  assert.equal(partieTest('FACILE').jetonsBonusDepart, 3);
  assert.equal(partieTest('NORMAL').jetonsBonusDepart, 0);
});

test('une même seed produit une partie identique (reproductibilité)', () => {
  const a = partieTest('NORMAL', 42);
  const b = partieTest('NORMAL', 42);
  assert.deepEqual(a.chateau.map((c) => c.instanceId), b.chateau.map((c) => c.instanceId));
  assert.deepEqual(a.boss.map((c) => c.instanceId), b.boss.map((c) => c.instanceId));
});

test('des seeds différentes produisent des Châteaux différents', () => {
  const a = partieTest('NORMAL', 1);
  const b = partieTest('NORMAL', 2);
  assert.notDeepEqual(a.chateau.map((c) => c.instanceId), b.chateau.map((c) => c.instanceId));
});

test('avancerPhase enchaîne les phases et incrémente le tour', () => {
  let p = partieTest('NORMAL'); // tour 1, ENTRAINEMENT
  p = avancerPhase(p);
  assert.equal(p.phase, 'ENNEMI_AVANCE');
  assert.equal(p.tour, 1);
  p = avancerPhase(p);
  assert.equal(p.phase, 'COMBAT');
  p = avancerPhase(p);
  assert.equal(p.phase, 'ENTRAINEMENT');
  assert.equal(p.tour, 2);
});

test('avancerPhase réinitialise l’échange du Garde du corps', () => {
  const p = { ...partieTest('NORMAL'), gardeDuCorpsEchange: true };
  assert.equal(avancerPhase(p).gardeDuCorpsEchange, false);
});

test('avancerPhase réinitialise les cartes activées (Pivoter)', () => {
  const p = { ...partieTest('NORMAL'), cartesActivees: ['a#x', 'b#x'] };
  assert.deepEqual(avancerPhase(p).cartesActivees, []);
});

test('avancerPhase réinitialise les jetons ignorés (Gobelin pestilant, « pour ce combat »)', () => {
  const p = { ...partieTest('NORMAL'), jetonsIgnores: true };
  assert.equal(avancerPhase(p).jetonsIgnores, false);
});

test('avancerPhase réinitialise le blocage de l’or (Troll saboteur, « pour ce combat »)', () => {
  const p = { ...partieTest('NORMAL'), orBloque: true };
  assert.equal(avancerPhase(p).orBloque, false);
});
