// Tests du moteur — cycle des phases et progression de la partie.
// Lancés par `node --test` (runner intégré, aucune dépendance).

import test from 'node:test';
import assert from 'node:assert/strict';

import { phaseSuivante } from '../public/js/moteur/phases.js';
import { nouvellePartie, avancerPhase } from '../public/js/moteur/partie.js';

test('le cycle des phases suit l’ordre des règles puis reboucle', () => {
  assert.equal(phaseSuivante('ENTRAINEMENT'), 'ENNEMI_AVANCE');
  assert.equal(phaseSuivante('ENNEMI_AVANCE'), 'COMBAT');
  assert.equal(phaseSuivante('COMBAT'), 'ENTRAINEMENT');
});

test('une nouvelle partie commence au tour 1, phase Entraînement', () => {
  const partie = nouvellePartie();
  assert.equal(partie.tour, 1);
  assert.equal(partie.phase, 'ENTRAINEMENT');
});

test('avancer d’un tour complet incrémente le numéro de tour', () => {
  let partie = nouvellePartie(); //            tour 1, ENTRAINEMENT
  partie = avancerPhase(partie); //            tour 1, ENNEMI_AVANCE
  assert.deepEqual(partie, { tour: 1, phase: 'ENNEMI_AVANCE' });
  partie = avancerPhase(partie); //            tour 1, COMBAT
  assert.deepEqual(partie, { tour: 1, phase: 'COMBAT' });
  partie = avancerPhase(partie); //            tour 2, ENTRAINEMENT
  assert.deepEqual(partie, { tour: 2, phase: 'ENTRAINEMENT' });
});

test('l’état d’une partie est immuable (gelé)', () => {
  const partie = nouvellePartie();
  assert.throws(() => {
    /** @type {any} */ (partie).tour = 99;
  }, TypeError);
});
