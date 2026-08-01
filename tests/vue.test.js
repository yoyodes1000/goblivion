// Tests du modèle d'affichage (construireVue). L'essentiel porte sur ce que la
// vue NE doit PAS livrer : l'information cachée.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { bosses } from '../public/js/moteur/cartes/bosses.js';
import { construireVue } from '../public/js/ui/vue.js';

/**
 * Carte alliée de test.
 * @param {string} id @param {number | 'VARIABLE'} force @param {'HUMAIN' | 'OBJET'} [symbole]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function allie(id, force, symbole = 'HUMAIN') {
  return {
    instanceId: `${id}#a`,
    type: /** @type {any} */ ({ id, nom: id, force, symbole, actions: [] }),
  };
}

/**
 * Ennemi sur la piste ou aux Portes.
 * @param {string} id @param {boolean} revele @param {number} [jetonBonus]
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function ennemi(id, revele, jetonBonus = 0) {
  const type = /** @type {any} */ ({ id, nom: `Nom secret de ${id}`, force: 4, niveau: 'UNE_EPEE' });
  return { instance: { instanceId: `${id}#e`, type }, revele, jetonBonus };
}

/** @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides] */
function scenario(overrides = {}) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, ...overrides };
}

/** @param {string} id @returns {import('../public/js/moteur/partie.js').InstanceBoss} */
function bossReel(id) {
  const type = bosses.find((b) => b.id === id);
  if (!type) throw new Error(`Boss inconnu : ${id}`);
  return { instanceId: `${id}#b`, type };
}

// ── Information cachée ──────────────────────────────────────────────────────

test('le Château ne sort qu’en nombre, jamais son contenu', () => {
  const p = scenario();
  const vue = construireVue(p);

  assert.equal(vue.chateau.nombre, p.chateau.length);
  assert.equal('cartes' in vue.chateau, false);
});

test('aucun identifiant de carte du Château n’apparaît dans la vue entière', () => {
  const p = scenario();
  const serialisee = JSON.stringify(construireVue(p));

  for (const carte of p.chateau) {
    assert.equal(
      serialisee.includes(carte.instanceId),
      false,
      `${carte.instanceId} ne doit pas fuiter jusqu’à l’affichage`,
    );
  }
});

test('un ennemi non révélé ne livre ni nom, ni force, ni niveau', () => {
  const p = scenario({ pisteEnnemi: [ennemi('gob', false), null, null, null] });
  const [case1] = construireVue(p).pisteEnnemi;

  assert.equal(case1?.revele, false);
  assert.equal(case1?.nom, undefined);
  assert.equal(case1?.force, undefined);
  assert.equal(case1?.niveau, undefined);
  assert.equal(JSON.stringify(case1).includes('Nom secret'), false);
});

test('un ennemi non révélé montre quand même son jeton : c’est un pion posé sur la carte', () => {
  const p = scenario({ pisteEnnemi: [ennemi('gob', false, 2), null, null, null] });
  assert.equal(construireVue(p).pisteEnnemi[0]?.jetonBonus, 2);
});

test('un ennemi révélé livre son nom et sa force, jeton compris', () => {
  const p = scenario({ portes: [ennemi('gob', true, 2)] });
  const [aux] = construireVue(p).portes;

  assert.equal(aux?.revele, true);
  assert.equal(aux?.nom, 'Nom secret de gob');
  assert.equal(aux?.force, 6); // 4 imprimée + 2 de jeton
  assert.equal(aux?.niveau, '1 épée');
});

test('les Boss ne sortent qu’en nombre : ils sont faces cachées', () => {
  const p = scenario({ boss: [bossReel('reine-troll'), bossReel('demon')] });
  const vue = construireVue(p);

  assert.equal(vue.bossRestants, 2);
  assert.equal(JSON.stringify(vue).includes('Reine troll'), false);
});

// ── Forces affichées ────────────────────────────────────────────────────────

test('en jeu, la force affichée est celle du combat — barème du Soldat compris', () => {
  const soldats = [allie('soldat', 'VARIABLE'), allie('soldat', 'VARIABLE')];
  const vue = construireVue(scenario({ champDeBataille: soldats }));

  assert.equal(vue.champDeBataille.cartes[0]?.force, 3); // 2 Soldats → 3 chacun
  assert.equal(vue.champDeBataille.cartes[0]?.forceVariable, true);
  assert.equal(vue.forceAlliee, 6);
});

test('en jeu, le jeton bonus est compté dans la force affichée', () => {
  const carte = { ...allie('gentilhomme', 2), jetonBonus: 3 };
  const vue = construireVue(scenario({ champDeBataille: [carte] }));

  assert.equal(vue.champDeBataille.cartes[0]?.force, 5);
  assert.equal(vue.champDeBataille.cartes[0]?.jetonBonus, 3);
});

test('en jeu, le PASSIF du Boss affronté est reflété dans la force affichée', () => {
  // Reine troll ignore la force des Objets : l'interface doit montrer 0, pas 6,
  // sans quoi elle annoncerait une force que le combat ne validera pas.
  const p = scenario({
    phase: /** @type {any} */ ('COMBAT_BOSS'),
    boss: [bossReel('reine-troll')],
    champDeBataille: [allie('catapulte', 6, 'OBJET')],
  });
  const vue = construireVue(p);

  assert.equal(vue.champDeBataille.cartes[0]?.force, 0);
  assert.equal(vue.forceAlliee, 0);
});

test('hors du Champ de bataille, la force est l’imprimée — variable donc sans valeur', () => {
  const p = scenario({ hopital: [allie('soldat', 'VARIABLE'), allie('gentilhomme', 2)] });
  const [soldat, gentilhomme] = construireVue(p).hopital.cartes;

  assert.equal(soldat?.force, null);
  assert.equal(soldat?.forceVariable, true);
  assert.equal(gentilhomme?.force, 2);
});

// ── Le reste du plateau ─────────────────────────────────────────────────────

test('une carte activée est signalée comme telle', () => {
  const p = scenario({ champDeBataille: [allie('nain', 0)], cartesActivees: ['nain#a'] });
  assert.equal(construireVue(p).champDeBataille.cartes[0]?.activee, true);
});

test('le symbole est un libellé lisible, pas seulement une couleur', () => {
  const p = scenario({ champDeBataille: [allie('catapulte', 3, 'OBJET'), allie('fermier', 0)] });
  const [objet, humain] = construireVue(p).champDeBataille.cartes;

  assert.equal(objet?.symbole, 'Objet');
  assert.equal(humain?.symbole, 'Paysan');
});

test('l’en-tête reprend le rôle, le tour, la phase et les ressources', () => {
  const vue = construireVue(scenario());

  assert.equal(vue.roiReine, 'Reine Margot la douce');
  assert.equal(vue.tour, 1);
  assert.equal(vue.phase, 'Entraînement');
  assert.equal(vue.ressources, 18);
  assert.equal(vue.pouvoirDisponible, true);
});

test('le marché présente les 12 piles Doré avec leur nom et leur niveau', () => {
  const vue = construireVue(scenario());

  assert.equal(vue.marche.length, 12);
  const soldat = vue.marche.find((m) => m.typeId === 'soldat');
  assert.equal(soldat?.nom, 'Soldat');
  assert.equal(soldat?.niveau, '1 épée');
  assert.equal(soldat?.forceVariable, true);
});

test('le Garde du corps est affiché, ou null s’il n’y en a pas', () => {
  assert.equal(construireVue(scenario()).gardeDuCorps?.nom, 'Archer'); // Garde du corps de Margot
  assert.equal(construireVue(scenario({ gardeDuCorps: null })).gardeDuCorps, null);
});

test('la force ennemie aux Portes est la somme de leurs forces', () => {
  const p = scenario({ portes: [ennemi('a', true, 1), ennemi('b', true)] });
  assert.equal(construireVue(p).forceEnnemie, 9); // (4+1) + 4
});
