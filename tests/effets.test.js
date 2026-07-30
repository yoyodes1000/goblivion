// Tests de l'exécution des effets structurés (executerEffets).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { avancerEnnemis } from '../public/js/moteur/ennemi-avance.js';
import { executerEffets } from '../public/js/moteur/effets.js';

/**
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force: 0, actions: [] }) };
}

/**
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} [hopital]
 */
function scenario(champ, hopital = []) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ, hopital };
}

test('PIOCHER : déplace des cartes du Château vers le Champ de bataille', () => {
  const p = scenario([]);
  const { partie } = executerEffets(p, [{ type: 'PIOCHER', valeur: 3 }], [], creerRng(1));
  assert.equal(partie.champDeBataille.length, 3);
});

test('OR : ajuste les ressources', () => {
  const p = scenario([]);
  const { partie } = executerEffets(p, [{ type: 'OR', valeur: 2 }], [], creerRng(1));
  assert.equal(partie.ressources, p.ressources + 2);
});

test('plusieurs effets s’enchaînent dans l’ordre de la liste', () => {
  const p = scenario([]);
  const { partie } = executerEffets(
    p,
    [{ type: 'OR', valeur: -1 }, { type: 'PIOCHER', valeur: 2 }],
    [],
    creerRng(1),
  );
  assert.equal(partie.ressources, p.ressources - 1);
  assert.equal(partie.champDeBataille.length, 2);
});

test('DEFAUSSER : envoie les cartes visées du Champ de bataille à l’Hôpital', () => {
  const p = scenario([carte('a'), carte('b')]);
  const { partie } = executerEffets(p, [{ type: 'DEFAUSSER', valeur: 1 }], [{ cibles: ['a#x'] }], creerRng(1));
  assert.equal(partie.champDeBataille.length, 1);
  assert.ok(partie.hopital.some((c) => c.instanceId === 'a#x'));
});

test('DEFAUSSER : refuse si le nombre de cibles fournies ne correspond pas à `valeur`', () => {
  const p = scenario([carte('a')]);
  assert.throws(
    () => executerEffets(p, [{ type: 'DEFAUSSER', valeur: 1 }], [{ cibles: [] }], creerRng(1)),
    /nombre de cibles/,
  );
});

test('DETRUIRE_JEU : retire la carte du jeu sans passer par l’Hôpital', () => {
  const p = scenario([carte('a')]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['a#x'] }], creerRng(1));
  assert.equal(partie.champDeBataille.length, 0);
  assert.equal(partie.hopital.length, 0);
});

test('DETRUIRE_HOPITAL : retire la carte de l’Hôpital', () => {
  const p = scenario([], [carte('a')]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_HOPITAL' }], [{ cibles: ['a#x'] }], creerRng(1));
  assert.equal(partie.hopital.length, 0);
});

test('VISION : révèle les cases de piste visées', () => {
  const p = avancerEnnemis(scenario([])); // un ennemi non révélé sur la case 1 (index 0)
  const { partie } = executerEffets(p, [{ type: 'VISION', valeur: 1 }], [{ indexPiste: [0] }], creerRng(1));
  assert.equal(partie.pisteEnnemi[0]?.revele, true);
});

test('VISION : refuse si le nombre de cases visées ne correspond pas à `valeur`', () => {
  const p = avancerEnnemis(scenario([]));
  assert.throws(
    () => executerEffets(p, [{ type: 'VISION', valeur: 1 }], [{ indexPiste: [] }], creerRng(1)),
    /nombre de cases/,
  );
});

test('un effet pas encore géré (ex. FORCE) lève une erreur explicite plutôt que de ne rien faire', () => {
  const p = scenario([]);
  assert.throws(
    () => executerEffets(p, [{ type: 'FORCE', valeur: 2 }], [], creerRng(1)),
    /non encore exécutable/,
  );
});

test('les reconstitutions du Château se propagent depuis PIOCHER', () => {
  const remplissage = Array.from({ length: 3 }, (_, i) => carte(`c${i}`));
  const p = { ...scenario([]), chateau: [], hopital: remplissage };
  const { reconstitutions } = executerEffets(p, [{ type: 'PIOCHER', valeur: 2 }], [], creerRng(1));
  assert.equal(reconstitutions, 1);
});
