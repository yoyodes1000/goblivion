// Tests de la collecte des choix. L'essentiel porte sur les cas récursifs —
// branche d'un CHOIX, TESTAMENT d'une carte détruite, action copiée — puisque
// c'est ce qui interdit de calculer les demandes à l'avance.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { executerEffets } from '../public/js/moteur/effets.js';
import {
  demarrerCollecte,
  prochaineDemande,
  repondre,
  choixFinal,
} from '../public/js/ui/collecte.js';

/**
 * Carte de test. `actions` permet de lui greffer un TESTAMENT ou un PIVOTER.
 * @param {string} id
 * @param {{ force?: number, symbole?: string, actions?: any[] }} [options]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id, options = {}) {
  const { force = 0, symbole = 'HUMAIN', actions = [] } = options;
  return {
    instanceId: `${id}#x`,
    type: /** @type {any} */ ({ id, nom: id, force, symbole, actions }),
  };
}

/**
 * Ennemi sur la piste ou aux Portes.
 * @param {string} id @param {boolean} revele @param {number} jetonBonus
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function ennemi(id, revele, jetonBonus) {
  const type = /** @type {any} */ ({ id, nom: `Nom secret de ${id}`, force: 3, niveau: 'UNE_EPEE' });
  return { instance: { instanceId: `${id}#e`, type }, revele, jetonBonus };
}

/** @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides] */
function scenario(overrides = {}) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: [], hopital: [], ...overrides };
}

// ── Effets sans choix ───────────────────────────────────────────────────────

test('une suite d’effets sans choix est complète d’emblée', () => {
  const etat = demarrerCollecte(scenario(), [{ type: 'OR', valeur: 1 }, { type: 'PIOCHER', valeur: 2 }]);

  assert.equal(prochaineDemande(etat), null);
  assert.deepEqual(choixFinal(etat), [undefined, undefined]);
});

test('un SPECIAL dont le gestionnaire ne réclame rien ne demande rien', () => {
  const etat = demarrerCollecte(scenario(), [{ type: 'SPECIAL', texte: '' }], { typeId: 'nain' });
  assert.equal(prochaineDemande(etat), null);
});

// ── Demandes simples ────────────────────────────────────────────────────────

test('DEFAUSSER demande autant de cartes que sa valeur, prises au Champ de bataille', () => {
  const p = scenario({ champDeBataille: [carte('a'), carte('b')] });
  const demande = prochaineDemande(demarrerCollecte(p, [{ type: 'DEFAUSSER', valeur: 2 }]));

  assert.equal(demande?.genre, 'CARTES');
  assert.equal(demande?.nombre, 2);
  assert.deepEqual(demande?.options.map((o) => o.valeur), ['a#x', 'b#x']);
});

test('VISION ne propose que les cases occupées et encore cachées', () => {
  const p = scenario({ pisteEnnemi: [ennemi('a', false, 0), ennemi('b', true, 0), null] });
  const demande = prochaineDemande(demarrerCollecte(p, [{ type: 'VISION', valeur: 1 }]));

  assert.equal(demande?.genre, 'CASES_PISTE');
  assert.deepEqual(demande?.options, [{ valeur: '0', libelle: 'Case 1' }]);
});

test('la réponse à VISION ressort en index numériques', () => {
  const p = scenario({ pisteEnnemi: [ennemi('a', false, 0), null, null] });
  const etat = repondre(demarrerCollecte(p, [{ type: 'VISION', valeur: 1 }]), ['0']);

  assert.deepEqual(choixFinal(etat), [{ indexPiste: [0] }]);
});

// ── Récursion : branche d'un CHOIX ──────────────────────────────────────────

test('CHOIX demande la branche, puis les choix de cette branche', () => {
  const p = scenario({ pisteEnnemi: [ennemi('a', false, 0), null, null] });
  const effets = [{
    type: 'CHOIX',
    options: [[{ type: 'FORCE', valeur: 2 }], [{ type: 'VISION', valeur: 1 }]],
  }];

  const depart = demarrerCollecte(p, /** @type {any} */ (effets));
  const premiere = prochaineDemande(depart);
  assert.equal(premiere?.genre, 'BRANCHE');
  assert.deepEqual(premiere?.options.map((o) => o.libelle), ['force 2', 'vision 1']);

  // Branche 0 (FORCE) : plus rien à demander.
  assert.equal(prochaineDemande(repondre(depart, ['0'])), null);

  // Branche 1 (VISION) : une demande apparaît, qui n'existait pas avant.
  const apresBranche = repondre(depart, ['1']);
  assert.equal(prochaineDemande(apresBranche)?.genre, 'CASES_PISTE');

  const complet = repondre(apresBranche, ['0']);
  assert.deepEqual(choixFinal(complet), [{ branche: 1, choixBranche: [{ indexPiste: [0] }] }]);
});

// ── Récursion : TESTAMENT de la carte détruite ──────────────────────────────

test('détruire une carte à TESTAMENT enchaîne sur les choix de ce TESTAMENT', () => {
  const avecTestament = carte('traitre', {
    actions: [{ declencheur: 'TESTAMENT', effets: [{ type: 'VISION', valeur: 1 }] }],
  });
  const p = scenario({
    champDeBataille: [avecTestament, carte('banal')],
    pisteEnnemi: [ennemi('a', false, 0), null, null],
  });

  const depart = demarrerCollecte(p, [{ type: 'DETRUIRE_JEU' }]);
  assert.equal(prochaineDemande(depart)?.libelle, 'Choisis la carte en jeu à détruire');

  // Détruire la carte SANS testament : la collecte s'arrête là.
  assert.equal(prochaineDemande(repondre(depart, ['banal#x'])), null);

  // Détruire celle qui en a un : une demande surgit, née de la réponse précédente.
  const apres = repondre(depart, ['traitre#x']);
  assert.equal(apres && prochaineDemande(apres)?.genre, 'CASES_PISTE');

  assert.deepEqual(choixFinal(repondre(apres, ['0'])), [
    { cibles: ['traitre#x'], choixTestament: [{ indexPiste: [0] }] },
  ]);
});

// ── Besoins déclarés des gestionnaires SPECIAL ──────────────────────────────

test('Prêtre : ne propose que les Paysans de l’Hôpital', () => {
  const p = scenario({
    hopital: [carte('paysan'), carte('objet', { symbole: 'OBJET' })],
    champDeBataille: [carte('en-jeu')],
  });
  const demande = prochaineDemande(
    demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], { typeId: 'pretre' }),
  );

  assert.deepEqual(demande?.options.map((o) => o.valeur), ['paysan#x']);
});

test('Gobelin vachelier : ne propose que les Paysans les plus forts (égalités comprises)', () => {
  const p = scenario({
    champDeBataille: [carte('fort', { force: 3 }), carte('exaequo', { force: 3 }), carte('faible', { force: 1 })],
  });
  const demande = prochaineDemande(
    demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], { typeId: 'gobelin-vachelier' }),
  );

  assert.deepEqual(demande?.options.map((o) => o.valeur), ['fort#x', 'exaequo#x']);
});

test('Démon : écarte les cartes de force 0 ou moins', () => {
  const p = scenario({
    champDeBataille: [carte('costaud', { force: 2 }), carte('nul', { force: 0 }), carte('negatif', { force: -1 })],
  });
  const demande = prochaineDemande(
    demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], { typeId: 'demon' }),
  );

  assert.deepEqual(demande?.options.map((o) => o.valeur), ['costaud#x']);
});

test('Champion : ne propose que les ennemis porteurs d’un jeton, piste comprise', () => {
  const p = scenario({
    portes: [ennemi('aux-portes', true, 2), ennemi('sans-jeton', true, 0)],
    pisteEnnemi: [ennemi('sur-piste', true, 1), null, null],
  });
  const demande = prochaineDemande(
    demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], { typeId: 'champion' }),
  );

  assert.deepEqual(demande?.options.map((o) => o.valeur), ['aux-portes#e', 'sur-piste#e']);
});

test('un ennemi non révélé reste désignable sans livrer son identité', () => {
  const p = scenario({ portes: [ennemi('mystere', false, 2)] });
  const demande = prochaineDemande(
    demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], { typeId: 'champion' }),
  );

  assert.equal(demande?.options[0]?.libelle, 'Carte face cachée (jeton +2)');
  assert.equal(JSON.stringify(demande).includes('Nom secret'), false);
});

// ── Récursion : action copiée par le Chapeau magique ────────────────────────

test('Chapeau magique : ne propose que les autres cartes ayant une action Pivoter', () => {
  const avecPivoter = carte('bourreau', {
    actions: [{ declencheur: 'PIVOTER', effets: [{ type: 'DETRUIRE_HOPITAL' }] }],
  });
  const p = scenario({
    champDeBataille: [carte('chapeau', { actions: [{ declencheur: 'PIVOTER', effets: [] }] }), avecPivoter, carte('inerte')],
    hopital: [carte('malade')],
  });

  const depart = demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], {
    typeId: 'chapeau-magique',
    carteActiveeId: 'chapeau#x',
  });
  const demande = prochaineDemande(depart);

  // Ni lui-même, ni la carte sans action Pivoter.
  assert.deepEqual(demande?.options.map((o) => o.valeur), ['bourreau#x']);
});

test('Chapeau magique : les choix de l’action copiée sont demandés ensuite', () => {
  const avecPivoter = carte('bourreau', {
    actions: [{ declencheur: 'PIVOTER', effets: [{ type: 'DETRUIRE_HOPITAL' }] }],
  });
  const p = scenario({
    champDeBataille: [carte('chapeau'), avecPivoter],
    hopital: [carte('malade')],
  });

  const etat = repondre(
    demarrerCollecte(p, [{ type: 'SPECIAL', texte: '' }], { typeId: 'chapeau-magique', carteActiveeId: 'chapeau#x' }),
    ['bourreau#x'],
  );

  assert.equal(prochaineDemande(etat)?.libelle, 'Choisis la carte à détruire à l’Hôpital');
  assert.deepEqual(choixFinal(repondre(etat, ['malade#x'])), [
    { cibles: ['bourreau#x'], choixCopie: [{ cibles: ['malade#x'], choixTestament: [] }] },
  ]);
});

test('deux effets à choix : c’est le premier qui est demandé, puis le second', () => {
  // Le parcours doit s'arrêter net sur une demande sans réponse. Sinon le
  // second effet relit la même réponse et sa demande écrase la première —
  // le joueur se verrait poser la dernière question en premier.
  const p = scenario({ champDeBataille: [carte('a'), carte('b')], hopital: [carte('malade')] });
  const effets = /** @type {any} */ ([{ type: 'DEFAUSSER' }, { type: 'DETRUIRE_HOPITAL' }]);

  const depart = demarrerCollecte(p, effets);
  assert.equal(prochaineDemande(depart)?.libelle, 'Choisis les cartes à défausser');

  const apresPremier = repondre(depart, ['a#x']);
  assert.equal(prochaineDemande(apresPremier)?.libelle, 'Choisis la carte à détruire à l’Hôpital');

  assert.deepEqual(choixFinal(repondre(apresPremier, ['malade#x'])), [
    { cibles: ['a#x'] },
    { cibles: ['malade#x'], choixTestament: [] },
  ]);
});

// ── Contrat de l'API ────────────────────────────────────────────────────────

test('choixFinal refuse tant qu’une demande est en attente', () => {
  const p = scenario({ champDeBataille: [carte('a')] });
  assert.throws(
    () => choixFinal(demarrerCollecte(p, [{ type: 'DEFAUSSER' }])),
    /Collecte incomplète/,
  );
});

test('répondre ne modifie pas l’état d’origine (immuabilité)', () => {
  const p = scenario({ champDeBataille: [carte('a')] });
  const depart = demarrerCollecte(p, [{ type: 'DEFAUSSER' }]);
  repondre(depart, ['a#x']);

  assert.equal(depart.reponses.length, 0);
  assert.notEqual(prochaineDemande(depart), null);
});

// ── Preuve de bout en bout : le moteur accepte ce qu'on lui rend ────────────

test('les choix collectés sont acceptés tels quels par executerEffets', () => {
  const p = scenario({ champDeBataille: [carte('a'), carte('b')] });
  const effets = /** @type {any} */ ([{ type: 'DEFAUSSER' }, { type: 'PIOCHER', valeur: 1 }]);

  const etat = repondre(demarrerCollecte(p, effets), ['a#x']);
  const { partie } = executerEffets(p, effets, choixFinal(etat), creerRng(1));

  assert.equal(partie.champDeBataille.some((c) => c.instanceId === 'a#x'), false);
  assert.ok(partie.hopital.some((c) => c.instanceId === 'a#x'));
});

test('un TESTAMENT collecté est accepté jusqu’au bout par le moteur', () => {
  const avecTestament = carte('duc', {
    actions: [{ declencheur: 'TESTAMENT', effets: [{ type: 'OR', valeur: 3 }] }],
  });
  const p = scenario({ champDeBataille: [avecTestament] });
  const effets = /** @type {any} */ ([{ type: 'DETRUIRE_JEU' }]);

  const etat = repondre(demarrerCollecte(p, effets), ['duc#x']);
  const { partie } = executerEffets(p, effets, choixFinal(etat), creerRng(1));

  assert.equal(partie.ressources, p.ressources + 3); // le TESTAMENT s'est bien joué
  assert.equal(partie.champDeBataille.length, 0);
});
