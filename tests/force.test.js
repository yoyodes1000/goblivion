// Tests du calcul de force au combat (dont le barème variable du Soldat).

import test from 'node:test';
import assert from 'node:assert/strict';

import { forceTotale } from '../public/js/moteur/force.js';

/**
 * Fabrique une instance de test minimale (seuls `id` et `force` importent ici).
 * @param {string} id
 * @param {number | 'VARIABLE'} force
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function inst(id, force) {
  const type = /** @type {any} */ ({ id, force });
  return { instanceId: `${id}#x`, type };
}

test('la force totale additionne les forces (y compris négatives)', () => {
  assert.equal(forceTotale([inst('gentilhomme', 2), inst('vieux', -1), inst('fermier', 0)]), 1);
});

test('un Soldat seul vaut 2', () => {
  assert.equal(forceTotale([inst('soldat', 'VARIABLE')]), 2);
});

test('trois Soldats valent 4 chacun (total 12)', () => {
  const trois = [inst('soldat', 'VARIABLE'), inst('soldat', 'VARIABLE'), inst('soldat', 'VARIABLE')];
  assert.equal(forceTotale(trois), 12);
});

test('cinq Soldats sont plafonnés à 5 chacun (total 25)', () => {
  const cinq = Array.from({ length: 5 }, () => inst('soldat', 'VARIABLE'));
  assert.equal(forceTotale(cinq), 25);
});
