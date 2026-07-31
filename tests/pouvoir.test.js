// Tests de l'activation du pouvoir Roi/Reine (activerPouvoir).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { activerPouvoir } from '../public/js/moteur/pouvoir.js';

/**
 * @param {string} roiReineId
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} [hopital]
 */
function scenario(roiReineId, hopital = []) {
  const base = miseEnPlace({ roiReineId, difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, hopital };
}

/**
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force: 0, actions: [] }) };
}

test('Jade : détruit une carte de l’Hôpital puis pioche 2 (pouvoir entièrement exécutable)', () => {
  const p = scenario('jade', [carte('vieux')]);
  const { partie } = activerPouvoir(p, [{ cibles: ['vieux#x'] }, undefined], creerRng(1));
  assert.ok(!partie.hopital.some((c) => c.instanceId === 'vieux#x'));
  assert.equal(partie.champDeBataille.length, 2);
  assert.equal(partie.pouvoirUtilise, true);
});

test('refusé si le pouvoir a déjà été utilisé cette partie', () => {
  const p = { ...scenario('jade', [carte('vieux')]), pouvoirUtilise: true };
  assert.throws(
    () => activerPouvoir(p, [{ cibles: ['vieux#x'] }, undefined], creerRng(1)),
    /déjà été utilisé/,
  );
});

test('un pouvoir SPECIAL sans gestionnaire propage l’erreur explicite', () => {
  const base = scenario('bella');
  const p = {
    ...base,
    roiReine: {
      ...base.roiReine,
      id: 'inconnu',
      pouvoir: /** @type {any} */ ({ declencheur: 'POUVOIR', effets: [{ type: 'SPECIAL', texte: 'un pouvoir jamais vu' }] }),
    },
  };
  assert.throws(() => activerPouvoir(p, [], creerRng(1)), /non encore exécutable/);
});

test('Gonzo : défausse 2 cartes puis pioche 4 (pouvoir entièrement exécutable)', () => {
  const p = { ...scenario('gonzo'), champDeBataille: [carte('a'), carte('b')] };
  const { partie } = activerPouvoir(p, [{ cibles: ['a#x', 'b#x'] }, undefined], creerRng(1));
  assert.ok(partie.hopital.some((c) => c.instanceId === 'a#x'));
  assert.ok(partie.hopital.some((c) => c.instanceId === 'b#x'));
  assert.equal(partie.champDeBataille.length, 4);
});

test('Loko (SPECIAL) : chaque Paysan (symbole HUMAIN) en jeu gagne +2 force', () => {
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 0, symbole: 'HUMAIN' }) };
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 0, symbole: 'OBJET' }) };
  const p = { ...scenario('loko'), champDeBataille: [paysan, objet] };

  const { partie } = activerPouvoir(p, [undefined], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'paysan#x')?.jetonBonus, 2);
  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'objet#x')?.jetonBonus, undefined);
});

test('Bella (SPECIAL) : réactive 2 cartes en retirant leur instanceId de cartesActivees', () => {
  const p = { ...scenario('bella'), cartesActivees: ['a#x', 'b#x', 'c#x'] };
  const { partie } = activerPouvoir(p, [{ cibles: ['a#x', 'b#x'] }], creerRng(1));
  assert.deepEqual(partie.cartesActivees, ['c#x']);
});

test('Bella (SPECIAL) : refuse une cible qui n’est pas activée', () => {
  const p = { ...scenario('bella'), cartesActivees: ['a#x'] };
  assert.throws(
    () => activerPouvoir(p, [{ cibles: ['a#x', 'b#x'] }], creerRng(1)),
    /non activée/,
  );
});

test('Bella (SPECIAL) : refuse deux fois la même cible', () => {
  const p = { ...scenario('bella'), cartesActivees: ['a#x'] };
  assert.throws(
    () => activerPouvoir(p, [{ cibles: ['a#x', 'a#x'] }], creerRng(1)),
    /2 cibles distinctes/,
  );
});

test('Margot (SPECIAL) : mélange l’Hôpital à son Château', () => {
  const p = scenario('margot', [carte('a'), carte('b')]);
  const chateauAvant = p.chateau.length;

  const { partie } = activerPouvoir(p, [undefined, undefined], creerRng(1));

  assert.equal(partie.hopital.length, 0);
  assert.equal(partie.chateau.length, chateauAvant + 2 - 2); // +2 (Hôpital mélangé) - 2 (PIOCHER)
});

test('Yolo (SPECIAL) : choisit une carte du Château et la pose en jeu, puis vision 1', () => {
  const p = scenario('yolo');
  const cible = p.chateau[3];
  assert.ok(cible);

  const { partie } = activerPouvoir(
    p,
    [{ cibles: [cible.instanceId] }, { indexPiste: [0] }],
    creerRng(1),
  );

  assert.ok(!partie.chateau.some((c) => c.instanceId === cible.instanceId));
  assert.ok(partie.champDeBataille.some((c) => c.instanceId === cible.instanceId));
});

test('Brod (SPECIAL) : obtient un Objet du marché (Doré) et le pose en jeu, pour -3 or', () => {
  const p = scenario('brod');
  const { partie } = activerPouvoir(p, [{ cibles: ['catapulte'] }, undefined], creerRng(1));

  assert.ok(partie.champDeBataille.some((c) => c.type.id === 'catapulte'));
  assert.equal(partie.ressources, p.ressources - 3);
  const restantAvant = p.marcheDore.find((m) => m.typeId === 'catapulte')?.restant ?? 0;
  assert.equal(partie.marcheDore.find((m) => m.typeId === 'catapulte')?.restant, restantAvant - 1);
});

test('Brod (SPECIAL) : refuse une carte Doré qui n’est pas un Objet (symbole OBJET)', () => {
  const p = scenario('brod');
  assert.throws(
    () => activerPouvoir(p, [{ cibles: ['bourreau'] }, undefined], creerRng(1)),
    /doit être un Objet/,
  );
});
