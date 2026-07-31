// Tests de l'échange du Garde du corps (echangerGardeDuCorps).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { echangerGardeDuCorps } from '../public/js/moteur/garde-du-corps.js';

/**
 * Une carte de test, avec une action GARDE_DU_CORPS optionnelle.
 * @param {string} id
 * @param {import('../public/js/moteur/cartes/types.js').Effet[]} [effetsGarde]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id, effetsGarde) {
  const actions = effetsGarde ? [{ declencheur: 'GARDE_DU_CORPS', effets: effetsGarde }] : [];
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force: 0, actions }) };
}

/** @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ */
function scenario(champ) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ };
}

test('la carte visée prend la place du Garde du corps, l’ancien rejoint le Champ de bataille', () => {
  const p = scenario([carte('visee')]);
  const ancienneGarde = p.gardeDuCorps;
  assert.ok(ancienneGarde);

  const r = echangerGardeDuCorps(p, 'visee#x', [], creerRng(1));
  assert.ok(r.gardeDuCorps);

  assert.equal(r.gardeDuCorps.instanceId, 'visee#x');
  assert.ok(!r.champDeBataille.some((c) => c.instanceId === 'visee#x'));
  assert.ok(r.champDeBataille.some((c) => c.instanceId === ancienneGarde.instanceId));
  assert.equal(r.gardeDuCorpsEchange, true);
});

test('refusé une seconde fois dans la même phase', () => {
  const p = scenario([carte('a'), carte('b')]);
  const r = echangerGardeDuCorps(p, 'a#x', [], creerRng(1));
  assert.throws(() => echangerGardeDuCorps(r, 'b#x', [], creerRng(1)), /déjà été échangé/);
});

test('refusé si la carte n’est pas dans le Champ de bataille', () => {
  const p = scenario([]);
  assert.throws(
    () => echangerGardeDuCorps(p, 'inconnue#x', [], creerRng(1)),
    /absente du Champ de bataille/,
  );
});

test('refusé contre une carte déjà activée', () => {
  const p = { ...scenario([carte('visee')]), cartesActivees: ['visee#x'] };
  assert.throws(() => echangerGardeDuCorps(p, 'visee#x', [], creerRng(1)), /déjà activée/);
});

test('l’action GARDE_DU_CORPS de la carte qui prend la place s’exécute', () => {
  const p = scenario([carte('espion', [{ type: 'PIOCHER', valeur: 2 }])]);
  const r = echangerGardeDuCorps(p, 'espion#x', [], creerRng(1));
  // Champ de bataille après l'échange : l'ancien Garde du corps (1) + les 2
  // cartes piochées par l'action GARDE_DU_CORPS de la carte entrante.
  assert.equal(r.champDeBataille.length, 3);
});

test('sans action GARDE_DU_CORPS, l’échange n’a aucun effet de bord', () => {
  const p = scenario([carte('sans-action')]);
  const r = echangerGardeDuCorps(p, 'sans-action#x', [], creerRng(1));
  assert.equal(r.champDeBataille.length, 1); // seulement l'ancien Garde du corps
});

test('FORCE dans une action GARDE_DU_CORPS cible la carte qui prend la place (aucune carte réelle ne l’utilise encore, vérifie juste le branchement)', () => {
  const p = scenario([carte('espion', [{ type: 'FORCE', valeur: 2 }])]);
  const r = echangerGardeDuCorps(p, 'espion#x', [], creerRng(1));
  assert.equal(r.gardeDuCorps?.jetonBonus, 2);
});
