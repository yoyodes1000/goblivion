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
  echangerGardeDuCorps,
} from '../public/js/moteur/partie.js';

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

test('échange du Garde du corps : la carte visée prend sa place, l’ancien rejoint le Champ de bataille', () => {
  const p = piocher(partieNeuve(), 4, creerRng(3)).partie; // Garde du corps de départ : archer#garde
  const ancienneGarde = p.gardeDuCorps;
  const visee = p.champDeBataille[0];
  assert.ok(ancienneGarde);
  assert.ok(visee);

  const r = echangerGardeDuCorps(p, visee.instanceId);
  assert.ok(r.gardeDuCorps);

  assert.equal(r.gardeDuCorps.instanceId, visee.instanceId);
  assert.ok(!r.champDeBataille.some((c) => c.instanceId === visee.instanceId));
  assert.ok(r.champDeBataille.some((c) => c.instanceId === ancienneGarde.instanceId));
  assert.equal(r.gardeDuCorpsEchange, true);
});

test('échange du Garde du corps : refusé une seconde fois dans la même phase', () => {
  const p = piocher(partieNeuve(), 4, creerRng(3)).partie;
  const premiere = p.champDeBataille[0];
  assert.ok(premiere);
  const r = echangerGardeDuCorps(p, premiere.instanceId);
  const suivante = r.champDeBataille[0];
  assert.ok(suivante);
  assert.throws(
    () => echangerGardeDuCorps(r, suivante.instanceId),
    /déjà été échangé/,
  );
});

test('échange du Garde du corps : refusé si la carte n’est pas dans le Champ de bataille', () => {
  const p = partieNeuve();
  assert.throws(() => echangerGardeDuCorps(p, 'inconnue#x'), /absente du Champ de bataille/);
});

test('échange du Garde du corps : refusé contre une carte déjà activée', () => {
  const p = piocher(partieNeuve(), 4, creerRng(3)).partie;
  const visee = p.champDeBataille[0];
  assert.ok(visee);
  const active = { ...p, cartesActivees: [visee.instanceId] };
  assert.throws(() => echangerGardeDuCorps(active, visee.instanceId), /déjà activée/);
});
