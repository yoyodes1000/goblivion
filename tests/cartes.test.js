// Tests des données de cartes — validations structurelles (pas de logique de jeu).
// Le total d'exemplaires sert de « somme de contrôle » : il attrape une carte
// oubliée ou en trop lors de la saisie.

import test from 'node:test';
import assert from 'node:assert/strict';

import { paysansBase } from '../public/js/moteur/cartes/paysans-base.js';

test('la famille Bleu compte exactement 40 exemplaires', () => {
  const total = paysansBase.reduce((somme, carte) => somme + carte.exemplaires, 0);
  assert.equal(total, 40);
});

test('chaque carte Bleu a un id unique', () => {
  const ids = paysansBase.map((carte) => carte.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('chaque carte Bleu a un symbole HUMAIN ou OBJET', () => {
  for (const carte of paysansBase) {
    assert.ok(
      carte.symbole === 'HUMAIN' || carte.symbole === 'OBJET',
      `${carte.nom} : symbole invalide (${carte.symbole})`,
    );
  }
});

test('les effets des actions sont bien formés', () => {
  const valeurRequise = new Set(['PIOCHER', 'OR', 'FORCE', 'VISION']);
  for (const carte of paysansBase) {
    for (const action of carte.actions) {
      assert.ok(action.effets.length > 0, `${carte.nom} : action sans effet`);
      for (const effet of action.effets) {
        if (valeurRequise.has(effet.type)) {
          assert.equal(typeof effet.valeur, 'number', `${carte.nom} : ${effet.type} sans valeur`);
        }
        if (effet.type === 'CHOIX') {
          assert.ok(
            Array.isArray(effet.options) && effet.options.length >= 2,
            `${carte.nom} : CHOIX doit avoir au moins deux branches`,
          );
        }
        if (effet.type === 'SPECIAL') {
          assert.ok(
            typeof effet.texte === 'string' && effet.texte.length > 0,
            `${carte.nom} : SPECIAL sans texte`,
          );
        }
      }
    }
  }
});
