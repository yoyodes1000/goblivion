// Tests de la révélation des ennemis aux Portes en Combat (REVELATION).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { revelerAuxPortes, resoudreRevelation } from '../public/js/moteur/revelation.js';

/**
 * Un ennemi de test aux Portes, avec ses cartes à piocher et son éventuelle
 * action REVELATION.
 * @param {string} id
 * @param {import('../public/js/moteur/cartes/types.js').Effet[]} [effetsRevelation]
 * @param {{ revele?: boolean, jetonBonus?: number, cartes?: number }} [options]
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function ennemi(id, effetsRevelation, { revele = false, jetonBonus = 0, cartes = 1 } = {}) {
  const actionsEnnemi = effetsRevelation ? [{ declencheur: 'REVELATION', effets: effetsRevelation }] : [];
  const recompense = { nom: `Butin ${id}`, symbole: 'OBJET', force: 0, actions: [] };
  const type = /** @type {any} */ ({ id, force: 1, niveau: 'UNE_EPEE', cartes, actionsEnnemi, recompense });
  return { instance: { instanceId: `${id}#e`, type }, revele, jetonBonus };
}

/**
 * @param {import('../public/js/moteur/partie.js').EnnemiSurPiste[]} portes
 * @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides]
 */
function scenario(portes, overrides = {}) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, portes, ...overrides };
}

test('révèle un ennemi sans action REVELATION : juste revele passe à true', () => {
  const p = scenario([ennemi('gob')]);
  const { partie, reconstitutions, ennemiAvance } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.portes[0]?.revele, true);
  assert.equal(reconstitutions, 0);
  assert.equal(ennemiAvance, false);
});

test('un ennemi déjà révélé ne relance pas son action', () => {
  const p = scenario([ennemi('gob', [{ type: 'OR', valeur: -5 }], { revele: true })]);
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.ressources, p.ressources);
});

test('OR est délégué à executerEffets', () => {
  const p = scenario([ennemi('gob', [{ type: 'OR', valeur: -2 }])]);
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.ressources, p.ressources - 2);
});

test('JETON_ENNEMI incrémente le jeton bonus de l’ennemi révélé, sans passer par executerEffets', () => {
  const p = scenario([ennemi('gob', [{ type: 'JETON_ENNEMI', valeur: 2 }])]);
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.portes[0]?.jetonBonus, 2);
});

test('JETON_ENNEMI + ENNEMI_AVANCE (forme de Commandant gobelin) : signale ennemiAvance sans avancer la piste', () => {
  const p = scenario([
    ennemi('commandant', [{ type: 'JETON_ENNEMI', valeur: 2 }, { type: 'ENNEMI_AVANCE' }]),
  ]);
  const { partie, ennemiAvance } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(ennemiAvance, true);
  assert.equal(partie.portes[0]?.jetonBonus, 2);
  assert.deepEqual(partie.pisteEnnemi, p.pisteEnnemi);
});

test('un effet SPECIAL non géré lève l’erreur explicite d’effets.js', () => {
  const p = scenario([ennemi('sorciere', [{ type: 'SPECIAL', texte: 'détruire 1 Paysan en jeu' }])]);
  assert.throws(() => revelerAuxPortes(p, 0, [], creerRng(1)), /non encore exécutable/);
});

test('index hors bornes lève une erreur', () => {
  const p = scenario([]);
  assert.throws(() => revelerAuxPortes(p, 0, [], creerRng(1)), /Aucun ennemi/);
});

test('resoudreRevelation : un ennemi sans avancée, pioché et révélé une fois', () => {
  const p = scenario([ennemi('gob', [{ type: 'OR', valeur: -1 }], { cartes: 2 })]);
  const { partie } = resoudreRevelation(p, creerRng(1));
  assert.equal(partie.portes[0]?.revele, true);
  assert.equal(partie.ressources, p.ressources - 1);
  assert.equal(partie.chateau.length, p.chateau.length - 2);
  assert.equal(partie.champDeBataille.length, p.champDeBataille.length + 2);
});

test('resoudreRevelation : « l’ennemi avance » fait avancer la piste et reprend sans redéclencher l’action', () => {
  const commandant = ennemi('commandant', [{ type: 'JETON_ENNEMI', valeur: 2 }, { type: 'ENNEMI_AVANCE' }]);
  const recrue = ennemi('recrue', [{ type: 'OR', valeur: -1 }]);
  const p = scenario([commandant], { pisteEnnemi: [null, null, null, recrue], pileEnnemi: [] });

  const { partie } = resoudreRevelation(p, creerRng(1));

  assert.equal(partie.portes.length, 2);
  assert.equal(partie.portes[0]?.instance.instanceId, 'commandant#e');
  assert.equal(partie.portes[0]?.jetonBonus, 2); // une seule fois malgré la relance
  assert.equal(partie.portes[1]?.instance.instanceId, 'recrue#e');
  assert.equal(partie.portes[1]?.revele, true);
  assert.equal(partie.ressources, p.ressources - 1); // l'effet OR de la recrue, une seule fois
});
