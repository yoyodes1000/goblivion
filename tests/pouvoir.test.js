// Tests de l'activation du pouvoir Roi/Reine (activerPouvoir).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { activerPouvoir } from '../public/js/moteur/pouvoir.js';

/**
 * @param {string} roiReineId
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} [hopital]
 */
function scenario(roiReineId, hopital = []) {
  const base = miseEnPlace({ roiReineId, difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, hopital };
}

/**
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force: 0, actions: [] }) };
}

test('Jade : détruit une carte de l’Hôpital puis pioche 2 (pouvoir entièrement exécutable)', () => {
  const p = scenario('jade', [carte('vieux')]);
  const { partie } = activerPouvoir(p, [{ cibles: ['vieux#x'] }, undefined], creerRng(1));
  assert.ok(!partie.hopital.some((c) => c.instanceId === 'vieux#x'));
  assert.equal(partie.champDeBataille.length, 2);
  assert.equal(partie.pouvoirUtilise, true);
});

test('refusé si le pouvoir a déjà été utilisé cette partie', () => {
  const p = { ...scenario('jade', [carte('vieux')]), pouvoirUtilise: true };
  assert.throws(
    () => activerPouvoir(p, [{ cibles: ['vieux#x'] }, undefined], creerRng(1)),
    /déjà été utilisé/,
  );
});

test('un pouvoir avec un effet SPECIAL (ex. Reine Bella) propage l’erreur explicite', () => {
  const p = scenario('bella');
  assert.throws(() => activerPouvoir(p, [], creerRng(1)), /non encore exécutable/);
});

test('Gonzo : défausse 2 cartes puis pioche 4 (pouvoir entièrement exécutable)', () => {
  const p = { ...scenario('gonzo'), champDeBataille: [carte('a'), carte('b')] };
  const { partie } = activerPouvoir(p, [{ cibles: ['a#x', 'b#x'] }, undefined], creerRng(1));
  assert.ok(partie.hopital.some((c) => c.instanceId === 'a#x'));
  assert.ok(partie.hopital.some((c) => c.instanceId === 'b#x'));
  assert.equal(partie.champDeBataille.length, 4);
});
