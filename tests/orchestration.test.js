// Tests de la bascule L'Ennemi Avance → combat des Boss, et de la conséquence
// d'un Château vide.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { avancerEnnemis } from '../public/js/moteur/ennemi-avance.js';
import {
  detruireEnnemisAuxPortes,
  terminerPhaseEnnemiAvance,
  appliquerChateauVide,
  passerALaPhaseSuivante,
  issuePartie,
} from '../public/js/moteur/orchestration.js';

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
    pisteEnnemi: [null, null, null],
    portes: [ennemiAuxPortes()],
  });

  const partie = terminerPhaseEnnemiAvance(p);

  assert.equal(partie.phase, 'COMBAT_BOSS');
  assert.equal(partie.portes.length, 0);
  assert.equal(partie.tour, p.tour); // pas un nouveau tour, un changement de mode
});

test('terminerPhaseEnnemiAvance : la bascule vers les Boss remet aussi les états de phase à zéro', () => {
  const p = scenario({
    pileEnnemi: [],
    pisteEnnemi: [null, null, null],
    portes: [ennemiAuxPortes()],
    jetonsIgnores: true,
    orBloque: true,
    gardeDuCorpsEchange: true,
    cartesActivees: ['x#a'],
  });

  const partie = terminerPhaseEnnemiAvance(p);

  assert.equal(partie.jetonsIgnores, false);
  assert.equal(partie.orBloque, false);
  assert.equal(partie.gardeDuCorpsEchange, false);
  assert.deepEqual(partie.cartesActivees, []);
});

// Château vide (règles p.8) : l'ennemi avance, une fois par reconstitution.

test('appliquerChateauVide : une reconstitution fait avancer l’ennemi une fois', () => {
  const p = scenario();
  const attendu = avancerEnnemis(p);
  const partie = appliquerChateauVide(p, 1);

  assert.deepEqual(partie.pisteEnnemi, attendu.pisteEnnemi);
  assert.equal(partie.pileEnnemi.length, p.pileEnnemi.length - 1);
});

test('appliquerChateauVide : deux reconstitutions font avancer deux fois', () => {
  const p = scenario();
  const partie = appliquerChateauVide(p, 2);
  assert.equal(partie.pileEnnemi.length, p.pileEnnemi.length - 2);
});

test('appliquerChateauVide : sans reconstitution, l’état est inchangé', () => {
  const p = scenario();
  assert.equal(appliquerChateauVide(p, 0), p);
});

test('appliquerChateauVide : sans effet pendant le combat des Boss, qui paie en ressources', () => {
  const p = scenario({ phase: /** @type {any} */ ('COMBAT_BOSS') });
  assert.equal(appliquerChateauVide(p, 3), p);
});

// Ce que la phase impose d'elle-même (règles p.10).

test('entrer dans L’Ennemi Avance fait glisser les ennemis d’une case', () => {
  const p = scenario({ phase: /** @type {any} */ ('ENTRAINEMENT') });
  assert.equal(p.pisteEnnemi.filter(Boolean).length, 0);

  const partie = passerALaPhaseSuivante(p);

  assert.equal(partie.phase, 'ENNEMI_AVANCE');
  assert.equal(partie.pisteEnnemi.filter(Boolean).length, 1);
  assert.equal(partie.pileEnnemi.length, p.pileEnnemi.length - 1);
});

test('un tour complet ne fait avancer l’ennemi qu’une fois', () => {
  let p = scenario({ phase: /** @type {any} */ ('ENTRAINEMENT') });
  for (const attendue of ['ENNEMI_AVANCE', 'COMBAT', 'ENTRAINEMENT']) {
    p = passerALaPhaseSuivante(p);
    assert.equal(p.phase, attendue);
  }
  assert.equal(p.pisteEnnemi.filter(Boolean).length, 1); // une seule avancée sur le tour
});

test('quatre tours amènent le premier ennemi aux Portes', () => {
  // 3 cases de piste : la 4e avancée fait entrer le premier ennemi aux Portes.
  let p = scenario({ phase: /** @type {any} */ ('ENTRAINEMENT') });
  for (let tour = 0; tour < 4; tour += 1) {
    for (let i = 0; i < 3; i += 1) p = passerALaPhaseSuivante(p);
  }

  assert.equal(p.portes.length, 1);
  assert.equal(p.pisteEnnemi.filter(Boolean).length, 3);
});

test('depuis L’Ennemi Avance, on avance vers le Combat sans glisser une seconde fois', () => {
  const p = scenario({ phase: /** @type {any} */ ('ENNEMI_AVANCE') });
  const partie = passerALaPhaseSuivante(p);

  assert.equal(partie.phase, 'COMBAT');
  assert.deepEqual(partie.pisteEnnemi, p.pisteEnnemi);
});

test('pile et piste vides : la bascule vers les Boss reste prioritaire', () => {
  const p = scenario({
    phase: /** @type {any} */ ('ENNEMI_AVANCE'),
    pileEnnemi: [],
    pisteEnnemi: [null, null, null],
    portes: [ennemiAuxPortes()],
  });

  const partie = passerALaPhaseSuivante(p);
  assert.equal(partie.phase, 'COMBAT_BOSS');
  assert.equal(partie.portes.length, 0);
});

// ── Issue de la partie (règles p.3) ─────────────────────────────────────────

test('la partie continue tant qu’il reste des ressources et des Boss', () => {
  assert.equal(issuePartie(scenario()), null);
});

test('ressources épuisées : défaite', () => {
  assert.equal(issuePartie(scenario({ ressources: 0 })), 'DEFAITE');
});

test('tous les Boss vaincus : victoire', () => {
  assert.equal(issuePartie(scenario({ boss: [] })), 'VICTOIRE');
});

test('la défaite l’emporte : tomber à zéro en abattant le dernier Boss reste une défaite', () => {
  assert.equal(issuePartie(scenario({ ressources: 0, boss: [] })), 'DEFAITE');
});
