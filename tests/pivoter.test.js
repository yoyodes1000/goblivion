// Tests de l'activation d'une action Pivoter (activerPivoter).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { activerPivoter } from '../public/js/moteur/pivoter.js';

/**
 * Une carte de test avec une action Pivoter donnée.
 * @param {string} id
 * @param {import('../public/js/moteur/cartes/types.js').Effet[]} effets
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carteAvecPivoter(id, effets) {
  return {
    instanceId: `${id}#x`,
    type: /** @type {any} */ ({ id, force: 0, actions: [{ declencheur: 'PIVOTER', effets }] }),
  };
}

/**
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force: 0, actions: [] }) };
}

/** @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ */
function scenario(champ) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ };
}

test('active l’action Pivoter et marque la carte comme activée', () => {
  const p = scenario([carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 1 }])]);
  const { partie } = activerPivoter(p, 'boulanger#x', [], creerRng(1));
  assert.equal(partie.ressources, p.ressources + 1);
  assert.deepEqual(partie.cartesActivees, ['boulanger#x']);
});

test('refuse d’activer deux fois la même carte dans la même phase', () => {
  const p = scenario([carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 1 }])]);
  const { partie } = activerPivoter(p, 'boulanger#x', [], creerRng(1));
  assert.throws(() => activerPivoter(partie, 'boulanger#x', [], creerRng(1)), /déjà activée/);
});

test('refuse une carte absente du Champ de bataille', () => {
  const p = scenario([]);
  assert.throws(() => activerPivoter(p, 'inconnue#x', [], creerRng(1)), /absente du Champ de bataille/);
});

test('refuse une carte sans action Pivoter', () => {
  const p = scenario([carte('garde')]);
  assert.throws(() => activerPivoter(p, 'garde#x', [], creerRng(1)), /pas d’action Pivoter/);
});

test('propage les reconstitutions du Château depuis les effets exécutés', () => {
  const remplissage = Array.from({ length: 2 }, (_, i) => carte(`c${i}`));
  const p = {
    ...scenario([carteAvecPivoter('scout', [{ type: 'PIOCHER', valeur: 2 }])]),
    chateau: [],
    hopital: remplissage,
  };
  const { reconstitutions } = activerPivoter(p, 'scout#x', [], creerRng(1));
  assert.equal(reconstitutions, 1);
});
