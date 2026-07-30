// Tests des données de cartes — validations structurelles (pas de logique de jeu).
// Le total d'exemplaires sert de « somme de contrôle » : il attrape une carte
// oubliée ou en trop lors de la saisie.

import test from 'node:test';
import assert from 'node:assert/strict';

import { paysansBase } from '../public/js/moteur/cartes/paysans-base.js';
import { dores } from '../public/js/moteur/cartes/dores.js';
import { ennemis } from '../public/js/moteur/cartes/ennemis.js';

test('la famille Bleu compte exactement 40 exemplaires', () => {
  assert.equal(paysansBase.reduce((s, c) => s + c.exemplaires, 0), 40);
});

test('la famille Doré compte exactement 40 exemplaires', () => {
  assert.equal(dores.reduce((s, c) => s + c.exemplaires, 0), 40);
});

test('la famille Ennemi/Objet compte exactement 23 exemplaires', () => {
  assert.equal(ennemis.reduce((s, c) => s + c.exemplaires, 0), 23);
});

test('les id sont uniques dans chaque famille', () => {
  for (const famille of [paysansBase, dores, ennemis]) {
    const ids = famille.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('chaque carte alliée a un symbole HUMAIN ou OBJET', () => {
  for (const c of [...paysansBase, ...dores]) {
    assert.ok(c.symbole === 'HUMAIN' || c.symbole === 'OBJET', `${c.nom} : symbole invalide`);
  }
});

test('chaque récompense a un symbole HUMAIN ou OBJET', () => {
  for (const c of ennemis) {
    const s = c.recompense.symbole;
    assert.ok(s === 'HUMAIN' || s === 'OBJET', `${c.recompense.nom} : symbole invalide (${s})`);
  }
});

test('chaque Doré a un coût d’entraînement valide', () => {
  for (const c of dores) {
    assert.ok(Number.isInteger(c.entrainement.piocher), `${c.nom} : piocher invalide`);
    assert.ok(Number.isInteger(c.entrainement.cible), `${c.nom} : cible invalide`);
    assert.ok(
      c.entrainement.echange === 'HUMAIN' || c.entrainement.echange === 'OBJET',
      `${c.nom} : sacrifice invalide`,
    );
  }
});

test('chaque ennemi a une force et un nombre de cartes entiers positifs', () => {
  for (const c of ennemis) {
    assert.ok(Number.isInteger(c.force), `${c.nom} : force invalide`);
    assert.ok(Number.isInteger(c.cartes) && c.cartes > 0, `${c.nom} : cartes invalide`);
  }
});

test('les effets de toutes les actions sont bien formés', () => {
  const valeurRequise = new Set(['PIOCHER', 'OR', 'FORCE', 'VISION', 'JETON_ENNEMI']);

  /** @type {Array<[string, ReadonlyArray<import('../public/js/moteur/cartes/types.js').Action>]>} */
  const groupes = [];
  for (const c of paysansBase) groupes.push([c.nom, c.actions]);
  for (const c of dores) groupes.push([c.nom, c.actions]);
  for (const c of ennemis) {
    groupes.push([`${c.nom} (ennemi)`, c.actionsEnnemi]);
    groupes.push([`${c.recompense.nom} (récompense)`, c.recompense.actions]);
  }

  for (const [nom, actions] of groupes) {
    for (const action of actions) {
      assert.ok(action.effets.length > 0, `${nom} : action sans effet`);
      for (const effet of action.effets) {
        if (valeurRequise.has(effet.type)) {
          assert.equal(typeof effet.valeur, 'number', `${nom} : ${effet.type} sans valeur`);
        }
        if (effet.type === 'CHOIX') {
          assert.ok(
            Array.isArray(effet.options) && effet.options.length >= 2,
            `${nom} : CHOIX doit avoir au moins deux branches`,
          );
        }
        if (effet.type === 'SPECIAL') {
          assert.ok(
            typeof effet.texte === 'string' && effet.texte.length > 0,
            `${nom} : SPECIAL sans texte`,
          );
        }
      }
    }
  }
});
