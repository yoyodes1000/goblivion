// Tests du cycle des phases (fonction pure `phaseSuivante`).
// La progression d'une vraie partie est testée dans mise-en-place.test.js.

import test from 'node:test';
import assert from 'node:assert/strict';

import { phaseSuivante } from '../public/js/moteur/phases.js';

test('le cycle des phases suit l’ordre des règles puis reboucle', () => {
  assert.equal(phaseSuivante('ENTRAINEMENT'), 'ENNEMI_AVANCE');
  assert.equal(phaseSuivante('ENNEMI_AVANCE'), 'COMBAT');
  assert.equal(phaseSuivante('COMBAT'), 'ENTRAINEMENT');
});
