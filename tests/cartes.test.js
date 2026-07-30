// Tests des données de cartes — validations structurelles (pas de logique de jeu).
// Le total d'exemplaires sert de « somme de contrôle » : il attrape une carte
// oubliée ou en trop lors de la saisie.

import test from 'node:test';
import assert from 'node:assert/strict';

import { paysansBase } from '../public/js/moteur/cartes/paysans-base.js';
import { dores } from '../public/js/moteur/cartes/dores.js';

test('la famille Bleu compte exactement 40 exemplaires', () => {
  const total = paysansBase.reduce((somme, carte) => somme + carte.exemplaires, 0);
  assert.equal(total, 40);
});

test('la famille Doré compte exactement 40 exemplaires', () => {
  const total = dores.reduce((somme, carte) => somme + carte.exemplaires, 0);
  assert.equal(total, 40);
});

test('les id sont uniques dans chaque famille', () => {
  for (const famille of [paysansBase, dores]) {
    const ids = famille.map((carte) => carte.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('chaque carte alliée a un symbole HUMAIN ou OBJET', () => {
  for (const carte of [...paysansBase, ...dores]) {
    assert.ok(
      carte.symbole === 'HUMAIN' || carte.symbole === 'OBJET',
      `${carte.nom} : symbole invalide (${carte.symbole})`,
    );
  }
});

test('chaque Doré a un coût d’entraînement valide', () => {
  for (const carte of dores) {
    assert.ok(Number.isInteger(carte.entrainement.piocher), `${carte.nom} : piocher invalide`);
    assert.ok(Number.isInteger(carte.entrainement.cible), `${carte.nom} : cible invalide`);
    assert.ok(
      carte.entrainement.echange === 'HUMAIN' || carte.entrainement.echange === 'OBJET',
      `${carte.nom} : sacrifice invalide`,
    );
  }
});

test('les effets des actions sont bien formés', () => {
  const valeurRequise = new Set(['PIOCHER', 'OR', 'FORCE', 'VISION']);
  for (const carte of [...paysansBase, ...dores]) {
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
