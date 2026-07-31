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
 * Une carte de test avec une action TESTAMENT donnée.
 * @param {string} id
 * @param {import('../public/js/moteur/cartes/types.js').Effet[]} effets
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carteAvecTestament(id, effets) {
  return {
    instanceId: `${id}#x`,
    type: /** @type {any} */ ({ id, force: 0, actions: [{ declencheur: 'TESTAMENT', effets }] }),
  };
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

test('DETRUIRE_JEU : déclenche le TESTAMENT de la carte détruite', () => {
  const p = scenario([carteAvecTestament('paysan', [{ type: 'OR', valeur: 3 }])]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['paysan#x'] }], creerRng(1));
  assert.equal(partie.ressources, p.ressources + 3);
  assert.equal(partie.champDeBataille.length, 0);
});

test('DETRUIRE_HOPITAL : déclenche aussi le TESTAMENT de la carte détruite', () => {
  const p = scenario([], [carteAvecTestament('paysan', [{ type: 'OR', valeur: 3 }])]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_HOPITAL' }], [{ cibles: ['paysan#x'] }], creerRng(1));
  assert.equal(partie.ressources, p.ressources + 3);
});

test('DETRUIRE_JEU : le choix du TESTAMENT vient de `choixTestament`', () => {
  const p = avancerEnnemis(scenario([carteAvecTestament('paysan', [{ type: 'VISION', valeur: 1 }])]));
  const { partie } = executerEffets(
    p,
    [{ type: 'DETRUIRE_JEU' }],
    [{ cibles: ['paysan#x'], choixTestament: [{ indexPiste: [0] }] }],
    creerRng(1),
  );
  assert.equal(partie.pisteEnnemi[0]?.revele, true);
});

test('détruire une carte sans TESTAMENT n’a aucun effet de bord', () => {
  const p = scenario([carte('sans-testament')]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['sans-testament#x'] }], creerRng(1));
  assert.equal(partie.ressources, p.ressources);
});

test('un TESTAMENT pas encore géré (ex. SPECIAL) propage l’erreur explicite', () => {
  const p = scenario([carteAvecTestament('paysan', [{ type: 'SPECIAL', texte: 'quelque chose' }])]);
  assert.throws(
    () => executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['paysan#x'] }], creerRng(1)),
    /non encore exécutable/,
  );
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

test('un effet pas encore géré (ex. CHOIX) lève une erreur explicite plutôt que de ne rien faire', () => {
  const p = scenario([]);
  assert.throws(
    () => executerEffets(p, [{ type: 'CHOIX', options: [] }], [], creerRng(1)),
    /non encore exécutable/,
  );
});

test('FORCE : ajoute un jeton bonus à la carte activée', () => {
  const p = scenario([carte('gentilhomme')]);
  const { partie } = executerEffets(p, [{ type: 'FORCE', valeur: 2 }], [], creerRng(1), 'gentilhomme#x');
  assert.equal(partie.champDeBataille[0]?.jetonBonus, 2);
});

test('FORCE : les jetons bonus s’accumulent', () => {
  const p = scenario([carte('gentilhomme')]);
  const { partie } = executerEffets(
    p,
    [{ type: 'FORCE', valeur: 2 }, { type: 'FORCE', valeur: 1 }],
    [],
    creerRng(1),
    'gentilhomme#x',
  );
  assert.equal(partie.champDeBataille[0]?.jetonBonus, 3);
});

test('FORCE : lève une erreur sans carte activée', () => {
  const p = scenario([carte('gentilhomme')]);
  assert.throws(
    () => executerEffets(p, [{ type: 'FORCE', valeur: 2 }], [], creerRng(1)),
    /aucune carte activée/,
  );
});

test('FORCE : lève une erreur si la carte activée est absente du Champ de bataille', () => {
  const p = scenario([]);
  assert.throws(
    () => executerEffets(p, [{ type: 'FORCE', valeur: 2 }], [], creerRng(1), 'inconnue#x'),
    /absente du Champ de bataille/,
  );
});

test('SPECIAL : délègue au gestionnaire de special.js trouvé via carteActiveeTypeId', () => {
  const p = { ...scenario([]), chateau: [carte('a'), carte('b')] };
  const { partie } = executerEffets(
    p,
    [{ type: 'SPECIAL', texte: 'détruire la prochaine carte du Château' }],
    [],
    creerRng(1),
    undefined,
    'trollolole',
  );
  assert.equal(partie.chateau.length, 1);
  assert.equal(partie.chateau[0]?.instanceId, 'b#x');
});

test('SPECIAL : sans gestionnaire trouvé, lève une erreur explicite avec le texte de la carte', () => {
  const p = scenario([]);
  assert.throws(
    () => executerEffets(p, [{ type: 'SPECIAL', texte: 'un effet jamais vu' }], [], creerRng(1), undefined, 'inconnu'),
    /non encore exécutable : un effet jamais vu/,
  );
});

test('TESTAMENT du Hochet royal réactive le pouvoir Roi/Reine', () => {
  const hochetRoyal = {
    instanceId: 'hochet#x',
    type: /** @type {any} */ ({
      id: 'hochet-royal',
      force: 0,
      actions: [{ declencheur: 'TESTAMENT', effets: [{ type: 'SPECIAL', texte: 'réactiver une carte Roi/Reine' }] }],
    }),
  };
  const p = { ...scenario([hochetRoyal]), pouvoirUtilise: true };
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['hochet#x'] }], creerRng(1));
  assert.equal(partie.pouvoirUtilise, false);
});

test('les reconstitutions du Château se propagent depuis PIOCHER', () => {
  const remplissage = Array.from({ length: 3 }, (_, i) => carte(`c${i}`));
  const p = { ...scenario([]), chateau: [], hopital: remplissage };
  const { reconstitutions } = executerEffets(p, [{ type: 'PIOCHER', valeur: 2 }], [], creerRng(1));
  assert.equal(reconstitutions, 1);
});
