// Tests du calcul de force au combat (dont le barème variable du Soldat).

import test from 'node:test';
import assert from 'node:assert/strict';

import { forceTotale } from '../public/js/moteur/force.js';

/**
 * Fabrique une instance de test minimale (seuls `id` et `force` importent ici).
 * @param {string} id
 * @param {number | 'VARIABLE'} force
 * @param {number} [jetonBonus]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function inst(id, force, jetonBonus) {
  const type = /** @type {any} */ ({ id, force });
  return jetonBonus === undefined
    ? { instanceId: `${id}#x`, type }
    : { instanceId: `${id}#x`, type, jetonBonus };
}

/**
 * Une instance d'Objet, pour les modificateurs qui filtrent sur le symbole.
 * @param {string} id
 * @param {number} force
 * @param {number} [jetonBonus]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function objet(id, force, jetonBonus) {
  const type = /** @type {any} */ ({ id, force, symbole: 'OBJET' });
  return jetonBonus === undefined
    ? { instanceId: `${id}#o`, type }
    : { instanceId: `${id}#o`, type, jetonBonus };
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

test('un jeton bonus s’ajoute à la force imprimée', () => {
  assert.equal(forceTotale([inst('gentilhomme', 2, 3)]), 5);
});

test('un jeton bonus s’ajoute à la force variable du Soldat', () => {
  assert.equal(forceTotale([inst('soldat', 'VARIABLE', 1)]), 3); // 2 (1 Soldat) + 1
});

test('une carte à force VARIABLE non gérée (ex. Joker) compte au moins son jeton bonus', () => {
  assert.equal(forceTotale([inst('joker', 'VARIABLE', 2)]), 2); // pas 0 : le bonus n'est pas perdu
});

test('jetonsIgnores : les jetons bonus ne comptent plus, la force imprimée reste', () => {
  assert.equal(forceTotale([inst('gentilhomme', 2, 3)], { jetonsIgnores: true }), 2);
});

test('jetonsIgnores : le barème variable du Soldat n’est pas un jeton, il reste compté', () => {
  assert.equal(forceTotale([inst('soldat', 'VARIABLE', 1)], { jetonsIgnores: true }), 2); // 2 (1 Soldat), sans le +1
});

test('jetonsIgnores : les forces négatives restent dues (ce n’est pas un plancher)', () => {
  assert.equal(forceTotale([inst('mendiant', -1, 2)], { jetonsIgnores: true }), -1);
});

// Reine troll — « Ignore la Force des Objets. »

test('objetsIgnores : un Objet ne compte plus, les autres cartes si', () => {
  const champ = [objet('catapulte', 3), inst('gentilhomme', 2)];
  assert.equal(forceTotale(champ, { objetsIgnores: true }), 2);
});

test('objetsIgnores : le jeton bonus de l’Objet tombe avec sa force', () => {
  assert.equal(forceTotale([objet('catapulte', 3, 2)], { objetsIgnores: true }), 0);
});

// Trollette — « Ignore la Force des cartes de Force 4 et plus. »

test('seuilForceIgnoree : au seuil la force tombe, en dessous elle reste', () => {
  const champ = [inst('chevalier', 4), inst('gentilhomme', 3)];
  assert.equal(forceTotale(champ, { seuilForceIgnoree: 4 }), 3);
});

test('seuilForceIgnoree : le seuil se juge sur la force effective, jeton compris', () => {
  // 3 + 1 = 4 : la carte atteint le seuil par son jeton, elle est donc ignorée.
  assert.equal(forceTotale([inst('gentilhomme', 3, 1)], { seuilForceIgnoree: 4 }), 0);
});

test('seuilForceIgnoree : les forces négatives sont loin du seuil, elles restent dues', () => {
  assert.equal(forceTotale([inst('mendiant', -1)], { seuilForceIgnoree: 4 }), -1);
});

// Les jumeaux — « La Force des cartes en double est réduite à celle d'une seule. »

test('doublonsReduits : deux cartes du même type ne comptent que pour une', () => {
  const champ = [inst('gentilhomme', 2), inst('gentilhomme', 2)];
  assert.equal(forceTotale(champ, { doublonsReduits: true }), 2);
});

test('doublonsReduits : c’est le plus fort des doublons qui est retenu', () => {
  const champ = [inst('gentilhomme', 2), inst('gentilhomme', 2, 3)];
  assert.equal(forceTotale(champ, { doublonsReduits: true }), 5); // 2 + 3, pas 2
});

test('doublonsReduits : des types distincts s’additionnent normalement', () => {
  const champ = [inst('gentilhomme', 2), inst('fermier', 1)];
  assert.equal(forceTotale(champ, { doublonsReduits: true }), 3);
});

test('doublonsReduits : le barème du Soldat compte tous les Soldats, le total un seul', () => {
  // 3 Soldats en jeu → chacun vaut 4 ; un seul entre dans la somme.
  const trois = Array.from({ length: 3 }, () => inst('soldat', 'VARIABLE'));
  assert.equal(forceTotale(trois, { doublonsReduits: true }), 4);
});
