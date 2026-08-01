// Tests de la résolution de combat (comparaison des forces + conséquences).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { resoudreCombat } from '../public/js/moteur/combat.js';

/**
 * Une carte alliée de test (seuls `id` et `force` comptent ici).
 * @param {string} id @param {number} force
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function allie(id, force) {
  return { instanceId: `${id}#a`, type: /** @type {any} */ ({ id, force }) };
}

/**
 * Un ennemi de test aux Portes.
 * @param {string} id @param {number} force
 * @param {'UNE_EPEE' | 'DEUX_EPEES'} niveau @param {number} [jetonBonus]
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function ennemi(id, force, niveau, jetonBonus = 0) {
  const recompense = { nom: `Butin ${id}`, symbole: 'OBJET', force: 0, actions: [] };
  const type = /** @type {any} */ ({ id, force, niveau, recompense });
  return { instance: { instanceId: `${id}#e`, type }, revele: true, jetonBonus };
}

/**
 * Construit un scénario de combat depuis une vraie partie.
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ
 * @param {import('../public/js/moteur/partie.js').EnnemiSurPiste[]} portes
 * @param {number} [ressources]
 */
function scenario(champ, portes, ressources = 18) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ, portes, ressources };
}

test('victoire : force ≥ ennemis → vaincus, récompenses + cartes en jeu à l’Hôpital', () => {
  const { partie, victoire } = resoudreCombat(scenario([allie('gentilhomme', 5)], [ennemi('gob', 3, 'UNE_EPEE')]));
  assert.equal(victoire, true);
  assert.equal(partie.portes.length, 0);
  assert.equal(partie.champDeBataille.length, 0);
  assert.equal(partie.premierCombatGagne, true);
  assert.equal(partie.hopital.length, 2); // 1 récompense + 1 carte en jeu
});

test('défaite : on perd la différence de force en ressources', () => {
  const { partie, victoire } = resoudreCombat(scenario([allie('vieux', 1)], [ennemi('gob', 5, 'UNE_EPEE')], 18), []);
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 14); // 18 - (5 - 1)
});

test('défaite : un survivant gagne un jeton bonus selon ses épées', () => {
  const { partie } = resoudreCombat(scenario([allie('vieux', 0)], [ennemi('gob', 5, 'DEUX_EPEES')]), []);
  assert.equal(partie.portes.length, 1);
  assert.equal(partie.portes[0]?.jetonBonus, 2); // 2 épées → +2
});

test('défaite : on élimine un ennemi dont on égale la force, l’autre survit', () => {
  const p = scenario([allie('chevalier', 4)], [ennemi('faible', 4, 'UNE_EPEE'), ennemi('fort', 9, 'DEUX_EPEES')]);
  const { partie, victoire } = resoudreCombat(p, [0]);
  assert.equal(victoire, false);
  assert.equal(partie.portes.length, 1);
  assert.equal(partie.portes[0]?.instance.type.id, 'fort');
  assert.equal(partie.hopital.length, 2); // récompense du vaincu + carte en jeu
});

test('défaite : cibler au-delà de sa force lève une erreur', () => {
  const p = scenario([allie('vieux', 2)], [ennemi('gob', 5, 'UNE_EPEE')]);
  assert.throws(() => resoudreCombat(p, [0]), /Force insuffisante/);
});

test('jetonsIgnores (Gobelin pestilant) : les jetons alliés ne comptent plus, la victoire bascule en défaite', () => {
  const allieJetonne = { ...allie('gentilhomme', 3), jetonBonus: 2 };
  const p = { ...scenario([allieJetonne], [ennemi('gob', 5, 'UNE_EPEE')]), jetonsIgnores: true };

  const { victoire } = resoudreCombat(p, []);

  assert.equal(victoire, false); // 3 seul face à 5, au lieu de 3 + 2 = 5
});

test('jetonsIgnores absent : le même combat est gagné grâce au jeton', () => {
  const allieJetonne = { ...allie('gentilhomme', 3), jetonBonus: 2 };
  const { victoire } = resoudreCombat(scenario([allieJetonne], [ennemi('gob', 5, 'UNE_EPEE')]));

  assert.equal(victoire, true);
});

test('le jeton bonus d’un survivant est plafonné à un seul', () => {
  const { partie } = resoudreCombat(scenario([allie('vieux', 0)], [ennemi('gob', 5, 'UNE_EPEE', 2)]), []);
  assert.equal(partie.portes[0]?.jetonBonus, 2); // déjà un jeton → inchangé
});

test('la force d’un ennemi inclut son jeton bonus', () => {
  // Ennemi force 3 + jeton 2 = 5 ; joueur 4 → défaite.
  const { victoire } = resoudreCombat(scenario([allie('gentilhomme', 4)], [ennemi('gob', 3, 'UNE_EPEE', 2)]), []);
  assert.equal(victoire, false);
});
