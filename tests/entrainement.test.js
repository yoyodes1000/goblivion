// Tests de la phase Entraînement.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { entrainer } from '../public/js/moteur/entrainement.js';

/**
 * Carte de test (id, force, symbole).
 * @param {string} id @param {number} force @param {'HUMAIN' | 'OBJET'} [symbole]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id, force, symbole = 'HUMAIN') {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force, symbole }) };
}

/**
 * Partie avec un Château contrôlé (pour maîtriser ce qui est pioché).
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} chateau
 * @param {number} [ressources]
 * @param {boolean} [premierCombatGagne]
 */
function scenario(chateau, ressources = 18, premierCombatGagne = false) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, chateau, champDeBataille: [], hopital: [], ressources, premierCombatGagne };
}

// Bâtisseur (1 épée) : piocher 4, cible 2, échange HUMAIN.

test('entraînement réussi : la Doré rejoint l’Hôpital, le sacrifice est détruit', () => {
  const p = scenario([carte('a', 1), carte('b', 1), carte('c', 0), carte('d', 0)]);
  const { partie: r } = entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));
  assert.ok(r.hopital.some((c) => c.type.id === 'batisseur'), 'la Doré doit être à l’Hôpital');
  assert.ok(!r.hopital.some((c) => c.instanceId === 'a#x'), 'le sacrifice ne doit pas être à l’Hôpital');
  assert.ok(r.hopital.some((c) => c.instanceId === 'b#x'), 'les autres cartes en jeu vont à l’Hôpital');
  assert.equal(r.champDeBataille.length, 0);
  assert.equal(r.marcheDore.find((m) => m.typeId === 'batisseur')?.restant, 3);
  assert.equal(r.ressources, 18); // force 2 = cible 2 → pas de paiement
});

test('entraînement : la différence jusqu’à la cible est payée en ressources', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  const { partie: r } = entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));
  assert.equal(r.ressources, 16); // cible 2, force 0 → paie 2
});

test('entraînement : un sacrifice du mauvais symbole est refusé', () => {
  const p = scenario([carte('a', 0, 'OBJET'), carte('b', 0), carte('c', 0), carte('d', 0)]);
  assert.throws(
    () => entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /symbole/,
  );
});

test('entraînement : les cartes 2 épées sont bloquées avant le premier combat gagné', () => {
  const p = scenario([carte('a', 5), carte('b', 0), carte('c', 0)], 18, false);
  assert.throws(
    () => entrainer(p, { doreId: 'fou-de-guerre', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /2 épées/,
  );
});

test('entraînement : ressources insuffisantes pour la cible → refusé', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)], 1);
  assert.throws(
    () => entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /insuffisantes/,
  );
});

// Chevalier (2 épées) : piocher 4, cible 8, échange HUMAIN — et son action
// ENTRAINEMENT, seule du jeu, qui rapporte une carte Épée en plus.

test('Chevalier : l’entraîner ajoute aussi une carte Épée à l’Hôpital', () => {
  const chateau = [carte('a', 4), carte('b', 4), carte('c', 0), carte('d', 0)];
  const p = scenario(chateau, 18, true);
  const { partie: r } = entrainer(p, { doreId: 'chevalier', sacrifieInstanceId: 'a#x' }, creerRng(1));

  assert.ok(r.hopital.some((c) => c.type.id === 'chevalier'), 'la Doré entraînée');
  assert.ok(r.hopital.some((c) => c.type.id === 'epee'), 'l’Épée offerte par son action');
  assert.equal(r.ressources, 18); // force 8 = cible 8, rien à payer
  assert.equal(r.marcheDore.find((m) => m.typeId === 'chevalier')?.restant, 1);
});

test('une Doré sans action ENTRAINEMENT ne rapporte rien de plus', () => {
  const p = scenario([carte('a', 1), carte('b', 1), carte('c', 0), carte('d', 0)]);
  const { partie: r } = entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));
  assert.equal(r.hopital.some((c) => c.type.id === 'epee'), false);
});

test('entrainer remonte les reconstitutions du Château sans en tirer de conséquence', () => {
  // Château vide, Hôpital à exactement 4 cartes : la reconstitution est
  // immédiate et les 4 cartes sont piochées, quel que soit l'ordre du mélange.
  const remplissage = Array.from({ length: 4 }, (_, i) => carte(`c${i}`, 0));
  const p = { ...scenario([]), hopital: remplissage };

  const { partie, reconstitutions } = entrainer(
    p,
    { doreId: 'batisseur', sacrifieInstanceId: 'c0#x' },
    creerRng(1),
  );

  assert.equal(reconstitutions, 1);
  assert.equal(partie.ressources, 16); // cible 2, force 0 → paie 2 ; aucune pénalité de Château
  assert.deepEqual(partie.pisteEnnemi, p.pisteEnnemi); // l'ennemi n'a pas avancé : c'est à l'appelant d'agir
});
