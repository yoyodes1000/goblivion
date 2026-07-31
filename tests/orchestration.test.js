// Tests de la bascule L'Ennemi Avance → combat des Boss.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { detruireEnnemisAuxPortes, terminerPhaseEnnemiAvance } from '../public/js/moteur/orchestration.js';

/** @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste} */
function ennemiAuxPortes() {
  const type = /** @type {any} */ ({ id: 'gob', force: 3, niveau: 'UNE_EPEE', recompense: { nom: 'Butin', symbole: 'OBJET', force: 0, actions: [] } });
  return { instance: { instanceId: 'gob#e', type }, revele: true, jetonBonus: 0 };
}

/** @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides] */
function scenario(overrides = {}) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, phase: /** @type {any} */ ('ENNEMI_AVANCE'), ...overrides };
}

test('detruireEnnemisAuxPortes vide les Portes sans toucher au reste', () => {
  const p = scenario({ portes: [ennemiAuxPortes()] });
  const partie = detruireEnnemisAuxPortes(p);
  assert.equal(partie.portes.length, 0);
  assert.equal(partie.pileEnnemi.length, p.pileEnnemi.length);
  assert.equal(partie.ressources, p.ressources);
});

test('terminerPhaseEnnemiAvance : pile et piste non vides, avance normalement vers Combat', () => {
  const p = scenario(); // mise en place par défaut : pileEnnemi non vide
  const partie = terminerPhaseEnnemiAvance(p);
  assert.equal(partie.phase, 'COMBAT');
  assert.equal(partie.tour, p.tour);
});

test('terminerPhaseEnnemiAvance : pile et piste vides, bascule vers le combat des Boss', () => {
  const p = scenario({
    pileEnnemi: [],
    pisteEnnemi: [null, null, null, null],
    portes: [ennemiAuxPortes()],
  });

  const partie = terminerPhaseEnnemiAvance(p);

  assert.equal(partie.phase, 'COMBAT_BOSS');
  assert.equal(partie.portes.length, 0);
  assert.equal(partie.tour, p.tour); // pas un nouveau tour, un changement de mode
});
