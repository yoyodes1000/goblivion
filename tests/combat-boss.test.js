// Tests du combat des Boss : résolution, retrait de la file, pénalité de
// Château vide.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { combattreBoss, tousBossVaincus } from '../public/js/moteur/combat-boss.js';

/**
 * Une carte alliée de test (seule `force` compte ici).
 * @param {string} id @param {number} force
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function allie(id, force) {
  return { instanceId: `${id}#a`, type: /** @type {any} */ ({ id, force }) };
}

/**
 * Un Boss de test (seuls `force` et `cartes` comptent ici).
 * @param {string} id @param {number} force @param {number} [cartes]
 * @returns {import('../public/js/moteur/partie.js').InstanceBoss}
 */
function boss(id, force, cartes = 0) {
  return { instanceId: `${id}#b`, type: /** @type {any} */ ({ id, force, cartes }) };
}

/**
 * Carte de remplissage à force uniforme, pour rendre un résultat indépendant
 * de l'ordre de mélange.
 * @param {string} id @param {number} force
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id, force) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force }) };
}

/**
 * Construit un scénario de combat de Boss depuis une vraie partie.
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ
 * @param {import('../public/js/moteur/partie.js').InstanceBoss[]} file
 * @param {number} [ressources]
 */
function scenario(champ, file, ressources = 18) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ, boss: file, ressources };
}

test('victoire : Force ≥ Boss → il est retiré du jeu, le Champ de bataille rejoint l’Hôpital', () => {
  const p = scenario([allie('champion', 5)], [boss('demon', 4), boss('dragon', 10)]);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true);
  assert.equal(partie.boss.length, 1);
  assert.equal(partie.boss[0]?.type.id, 'dragon');
  assert.equal(partie.champDeBataille.length, 0);
  assert.equal(partie.hopital.length, 1);
});

test('défaite : on perd la différence en ressources, le Boss reste en tête de file', () => {
  const p = scenario([allie('vieux', 1)], [boss('demon', 5)], 18);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 14); // 18 - (5 - 1)
  assert.equal(partie.boss.length, 1);
  assert.equal(partie.boss[0]?.type.id, 'demon');
  assert.equal(partie.champDeBataille.length, 0); // reparti à l'Hôpital, pioche neuve au prochain essai
});

test('Château vide pendant un combat de Boss : 2 ressources perdues par reconstitution', () => {
  // Château vide d'entrée de jeu, Hôpital rempli de cartes de force 0 : la
  // reconstitution est immédiate et le résultat du combat (victoire à force
  // 0 ≥ 0) ne dépend pas de l'ordre du mélange.
  const remplissage = Array.from({ length: 5 }, (_, i) => carte(`c${i}`, 0));
  const p = { ...scenario([], [boss('demon', 0, 5)], 18), chateau: [], hopital: remplissage };

  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true);
  assert.equal(partie.ressources, 16); // 18 - 2 (une reconstitution pour piocher 5 cartes)
});

test('combattreBoss : refusé s’il ne reste aucun Boss à affronter', () => {
  const p = scenario([], []);
  assert.throws(() => combattreBoss(p, creerRng(1)), /Aucun Boss/);
});

test('tousBossVaincus reflète l’état de la file de Boss', () => {
  assert.equal(tousBossVaincus(scenario([], [boss('demon', 1)])), false);
  assert.equal(tousBossVaincus(scenario([], [])), true);
});
