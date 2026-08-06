// Tests de la révélation des ennemis aux Portes en Combat (REVELATION).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import {
  revelerAuxPortes,
  resoudreRevelation,
  prochainAEngager,
  piocherPourEnnemi,
} from '../public/js/moteur/revelation.js';

/**
 * Un ennemi de test aux Portes, avec ses cartes à piocher et son éventuelle
 * action REVELATION.
 * @param {string} id
 * @param {import('../public/js/moteur/cartes/types.js').Effet[]} [effetsRevelation]
 * @param {{ revele?: boolean, jetonBonus?: number, cartes?: number }} [options]
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function ennemi(id, effetsRevelation, { revele = false, jetonBonus = 0, cartes = 1 } = {}) {
  const actionsEnnemi = effetsRevelation ? [{ declencheur: 'REVELATION', effets: effetsRevelation }] : [];
  const recompense = { nom: `Butin ${id}`, symbole: 'OBJET', force: 0, actions: [] };
  const type = /** @type {any} */ ({ id, force: 1, niveau: 'UNE_EPEE', cartes, actionsEnnemi, recompense });
  return { instance: { instanceId: `${id}#e`, type }, revele, jetonBonus };
}

/**
 * @param {import('../public/js/moteur/partie.js').EnnemiSurPiste[]} portes
 * @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides]
 */
function scenario(portes, overrides = {}) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, portes, ...overrides };
}

test('révèle un ennemi sans action REVELATION : juste revele passe à true', () => {
  const p = scenario([ennemi('gob')]);
  const { partie, reconstitutions, ennemiAvance } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.portes[0]?.revele, true);
  assert.equal(reconstitutions, 0);
  assert.equal(ennemiAvance, false);
});

test('un ennemi déjà révélé ne relance pas son action', () => {
  const p = scenario([ennemi('gob', [{ type: 'OR', valeur: -5 }], { revele: true })]);
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.ressources, p.ressources);
});

test('OR est délégué à executerEffets', () => {
  const p = scenario([ennemi('gob', [{ type: 'OR', valeur: -2 }])]);
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.ressources, p.ressources - 2);
});

test('JETON_ENNEMI incrémente le jeton bonus de l’ennemi révélé, sans passer par executerEffets', () => {
  const p = scenario([ennemi('gob', [{ type: 'JETON_ENNEMI', valeur: 2 }])]);
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.portes[0]?.jetonBonus, 2);
});

test('JETON_ENNEMI + ENNEMI_AVANCE (forme de Commandant gobelin) : signale ennemiAvance sans avancer la piste', () => {
  const p = scenario([
    ennemi('commandant', [{ type: 'JETON_ENNEMI', valeur: 2 }, { type: 'ENNEMI_AVANCE' }]),
  ]);
  const { partie, ennemiAvance } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(ennemiAvance, true);
  assert.equal(partie.portes[0]?.jetonBonus, 2);
  assert.deepEqual(partie.pisteEnnemi, p.pisteEnnemi);
});

test('un effet SPECIAL non géré lève l’erreur explicite d’effets.js', () => {
  const p = scenario([ennemi('sorciere', [{ type: 'SPECIAL', texte: 'détruire 1 Paysan en jeu' }])]);
  assert.throws(() => revelerAuxPortes(p, 0, [], creerRng(1)), /non encore exécutable/);
});

test('Trollolole : détruit la prochaine carte du Château (gestionnaire SPECIAL résolu via type.id)', () => {
  const p = scenario([ennemi('trollolole', [{ type: 'SPECIAL', texte: 'détruire la prochaine carte du Château' }])]);
  const chateauAvant = p.chateau.length;
  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));
  assert.equal(partie.chateau.length, chateauAvant - 1);
});

test('Horde de Gobelins (SPECIAL) : envoie le Paysan désigné à l’Hôpital', () => {
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 1, symbole: 'HUMAIN' }) };
  const p = scenario(
    [ennemi('horde-de-gobelins', [{ type: 'SPECIAL', texte: 'envoyer un Paysan à l’Hôpital' }])],
    { champDeBataille: [paysan] },
  );

  const { partie } = revelerAuxPortes(p, 0, [{ cibles: ['paysan#x'] }], creerRng(1));

  assert.ok(!partie.champDeBataille.some((c) => c.instanceId === 'paysan#x'));
  assert.ok(partie.hopital.some((c) => c.instanceId === 'paysan#x'));
});

test('Horde de Gobelins (SPECIAL) : refuse une cible qui n’est pas un Paysan (symbole HUMAIN)', () => {
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 1, symbole: 'OBJET' }) };
  const p = scenario(
    [ennemi('horde-de-gobelins', [{ type: 'SPECIAL', texte: 'envoyer un Paysan à l’Hôpital' }])],
    { champDeBataille: [objet] },
  );

  assert.throws(
    () => revelerAuxPortes(p, 0, [{ cibles: ['objet#x'] }], creerRng(1)),
    /doit être un Paysan/,
  );
});

test('Gobelin vachelier (SPECIAL) : envoie le Paysan le plus fort désigné à l’Hôpital', () => {
  const faible = { instanceId: 'faible#x', type: /** @type {any} */ ({ id: 'faible', force: 1, symbole: 'HUMAIN' }) };
  const fort = { instanceId: 'fort#x', type: /** @type {any} */ ({ id: 'fort', force: 3, symbole: 'HUMAIN' }) };
  const p = scenario(
    [ennemi('gobelin-vachelier', [{ type: 'SPECIAL', texte: 'envoyer le Paysan le plus fort à l’Hôpital' }])],
    { champDeBataille: [faible, fort] },
  );

  const { partie } = revelerAuxPortes(p, 0, [{ cibles: ['fort#x'] }], creerRng(1));

  assert.ok(partie.hopital.some((c) => c.instanceId === 'fort#x'));
  assert.ok(partie.champDeBataille.some((c) => c.instanceId === 'faible#x'));
});

test('Gobelin vachelier (SPECIAL) : refuse une cible qui n’est pas le Paysan le plus fort', () => {
  const faible = { instanceId: 'faible#x', type: /** @type {any} */ ({ id: 'faible', force: 1, symbole: 'HUMAIN' }) };
  const fort = { instanceId: 'fort#x', type: /** @type {any} */ ({ id: 'fort', force: 3, symbole: 'HUMAIN' }) };
  const p = scenario(
    [ennemi('gobelin-vachelier', [{ type: 'SPECIAL', texte: 'envoyer le Paysan le plus fort à l’Hôpital' }])],
    { champDeBataille: [faible, fort] },
  );

  assert.throws(
    () => revelerAuxPortes(p, 0, [{ cibles: ['faible#x'] }], creerRng(1)),
    /le plus fort/,
  );
});

test('Gobelin vachelier (SPECIAL) : le jeton bonus compte dans la comparaison de force', () => {
  const faibleBonus = {
    instanceId: 'faible#x',
    type: /** @type {any} */ ({ id: 'faible', force: 1, symbole: 'HUMAIN' }),
    jetonBonus: 5,
  };
  const fort = { instanceId: 'fort#x', type: /** @type {any} */ ({ id: 'fort', force: 3, symbole: 'HUMAIN' }) };
  const p = scenario(
    [ennemi('gobelin-vachelier', [{ type: 'SPECIAL', texte: 'envoyer le Paysan le plus fort à l’Hôpital' }])],
    { champDeBataille: [faibleBonus, fort] },
  );

  // faible (1 + 5 = 6) est en réalité plus fort que fort (3) une fois le jeton bonus compté.
  assert.throws(
    () => revelerAuxPortes(p, 0, [{ cibles: ['fort#x'] }], creerRng(1)),
    /le plus fort/,
  );
});

test('Sorcière troll (SPECIAL) : détruit le Paysan désigné, sans passer par l’Hôpital', () => {
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 1, symbole: 'HUMAIN', actions: [] }) };
  const p = scenario(
    [ennemi('sorciere-troll', [{ type: 'SPECIAL', texte: 'détruire 1 Paysan (HUMAIN) en jeu' }])],
    { champDeBataille: [paysan] },
  );

  const { partie } = revelerAuxPortes(p, 0, [{ cibles: ['paysan#x'] }], creerRng(1));

  assert.ok(!partie.champDeBataille.some((c) => c.instanceId === 'paysan#x'));
  assert.ok(!partie.hopital.some((c) => c.instanceId === 'paysan#x'));
});

test('Sorcière troll (SPECIAL) : refuse une cible qui n’est pas un Paysan (symbole HUMAIN)', () => {
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 1, symbole: 'OBJET', actions: [] }) };
  const p = scenario(
    [ennemi('sorciere-troll', [{ type: 'SPECIAL', texte: 'détruire 1 Paysan (HUMAIN) en jeu' }])],
    { champDeBataille: [objet] },
  );

  assert.throws(
    () => revelerAuxPortes(p, 0, [{ cibles: ['objet#x'] }], creerRng(1)),
    /doit être un Paysan/,
  );
});

test('Sorcière troll (SPECIAL) : déclenche le TESTAMENT du Paysan détruit', () => {
  const paysan = {
    instanceId: 'paysan#x',
    type: /** @type {any} */ ({
      id: 'paysan', force: 1, symbole: 'HUMAIN',
      actions: [{ declencheur: 'TESTAMENT', effets: [{ type: 'OR', valeur: 3 }] }],
    }),
  };
  const p = scenario(
    [ennemi('sorciere-troll', [{ type: 'SPECIAL', texte: 'détruire 1 Paysan (HUMAIN) en jeu' }])],
    { champDeBataille: [paysan] },
  );

  const { partie } = revelerAuxPortes(p, 0, [{ cibles: ['paysan#x'] }], creerRng(1));

  assert.equal(partie.ressources, p.ressources + 3);
});

test('Booba Brise-Fer (SPECIAL) : détruit l’Objet désigné, sans passer par l’Hôpital', () => {
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 1, symbole: 'OBJET', actions: [] }) };
  const p = scenario(
    [ennemi('booba-brise-fer', [{ type: 'SPECIAL', texte: 'détruire 1 Objet (OBJET) en jeu' }])],
    { champDeBataille: [objet] },
  );

  const { partie } = revelerAuxPortes(p, 0, [{ cibles: ['objet#x'] }], creerRng(1));

  assert.ok(!partie.champDeBataille.some((c) => c.instanceId === 'objet#x'));
  assert.ok(!partie.hopital.some((c) => c.instanceId === 'objet#x'));
});

test('Booba Brise-Fer (SPECIAL) : refuse une cible qui n’est pas un Objet (symbole OBJET)', () => {
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 1, symbole: 'HUMAIN', actions: [] }) };
  const p = scenario(
    [ennemi('booba-brise-fer', [{ type: 'SPECIAL', texte: 'détruire 1 Objet (OBJET) en jeu' }])],
    { champDeBataille: [paysan] },
  );

  assert.throws(
    () => revelerAuxPortes(p, 0, [{ cibles: ['paysan#x'] }], creerRng(1)),
    /doit être un Objet/,
  );
});

test('Gobelin pestilant (SPECIAL) : lève jetonsIgnores sans toucher aux jetons des cartes', () => {
  const paysan = {
    instanceId: 'paysan#x',
    type: /** @type {any} */ ({ id: 'paysan', force: 1, symbole: 'HUMAIN', actions: [] }),
    jetonBonus: 2,
  };
  const p = scenario(
    [ennemi('gobelin-pestilant', [{ type: 'SPECIAL', texte: 'ignorer les jetons +1 et +2 force pour ce combat' }])],
    { champDeBataille: [paysan] },
  );

  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));

  assert.equal(partie.jetonsIgnores, true);
  assert.equal(partie.champDeBataille[0]?.jetonBonus, 2); // le jeton est ignoré, pas retiré
});

test('Troll saboteur (SPECIAL) : lève orBloque', () => {
  const p = scenario([
    ennemi('troll-saboteur', [{ type: 'SPECIAL', texte: 'vous ne gagnez aucun or pour ce combat' }]),
  ]);

  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));

  assert.equal(partie.orBloque, true);
});

test('Bébé troll (SPECIAL) : ajoute en fin de file le Boss du dessus de la réserve', () => {
  const p = scenario([ennemi('bebe-troll', [{ type: 'SPECIAL', texte: 'ajouter une carte Boss' }])]);
  const bossAvant = p.boss.length;
  const attendu = p.pileBoss[0];

  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));

  assert.equal(partie.boss.length, bossAvant + 1);
  assert.equal(partie.boss.at(-1)?.instanceId, attendu?.instanceId);
  assert.equal(partie.pileBoss.length, p.pileBoss.length - 1);
  assert.deepEqual(partie.boss.slice(0, bossAvant), p.boss); // les Boss prévus gardent leur ordre
});

test('Bébé troll (SPECIAL) : réserve vide, l’état est inchangé plutôt qu’une erreur', () => {
  const p = scenario(
    [ennemi('bebe-troll', [{ type: 'SPECIAL', texte: 'ajouter une carte Boss' }])],
    { pileBoss: [] },
  );

  const { partie } = revelerAuxPortes(p, 0, [], creerRng(1));

  assert.deepEqual(partie.boss, p.boss);
  assert.deepEqual(partie.pileBoss, []);
});

test('index hors bornes lève une erreur', () => {
  const p = scenario([]);
  assert.throws(() => revelerAuxPortes(p, 0, [], creerRng(1)), /Aucun ennemi/);
});

test('resoudreRevelation : un ennemi sans avancée, pioché et révélé une fois', () => {
  const p = scenario([ennemi('gob', [{ type: 'OR', valeur: -1 }], { cartes: 2 })]);
  const { partie } = resoudreRevelation(p, creerRng(1));
  assert.equal(partie.portes[0]?.revele, true);
  assert.equal(partie.ressources, p.ressources - 1);
  assert.equal(partie.chateau.length, p.chateau.length - 2);
  assert.equal(partie.champDeBataille.length, p.champDeBataille.length + 2);
});

test('resoudreRevelation : « l’ennemi avance » fait avancer la piste et reprend sans redéclencher l’action', () => {
  const commandant = ennemi('commandant', [{ type: 'JETON_ENNEMI', valeur: 2 }, { type: 'ENNEMI_AVANCE' }]);
  const recrue = ennemi('recrue', [{ type: 'OR', valeur: -1 }]);
  const p = scenario([commandant], { pisteEnnemi: [null, null, recrue], pileEnnemi: [] });

  const { partie } = resoudreRevelation(p, creerRng(1));

  assert.equal(partie.portes.length, 2);
  assert.equal(partie.portes[0]?.instance.instanceId, 'commandant#e');
  assert.equal(partie.portes[0]?.jetonBonus, 2); // une seule fois malgré la relance
  assert.equal(partie.portes[1]?.instance.instanceId, 'recrue#e');
  assert.equal(partie.portes[1]?.revele, true);
  assert.equal(partie.ressources, p.ressources - 1); // l'effet OR de la recrue, une seule fois
});

// ── Progression pas à pas ───────────────────────────────────────────────────

test('prochainAEngager rend l’ennemi non pioché le plus à gauche', () => {
  const p = scenario([ennemi('a'), ennemi('b'), ennemi('c')], { ennemisPioches: ['a#e'] });
  assert.equal(prochainAEngager(p), 1);
});

test('prochainAEngager rend null quand tous ont fait piocher', () => {
  const p = scenario([ennemi('a')], { ennemisPioches: ['a#e'] });
  assert.equal(prochainAEngager(p), null);
});

test('un ennemi déjà révélé fait quand même piocher ses cartes', () => {
  // Une Vision l'a retourné sur la piste : c'est son ACTION que la règle p.10
  // dispense, pas sa pioche. Il était auparavant sauté, cartes comprises.
  const p = scenario([ennemi('vu', undefined, { revele: true, cartes: 3 }), ennemi('neuf', undefined, { cartes: 2 })]);
  const { partie } = resoudreRevelation(p, creerRng(1));

  assert.equal(partie.champDeBataille.length, 5); // 3 + 2, et non 2
  assert.deepEqual(partie.ennemisPioches, ['vu#e', 'neuf#e']);
});

test('un ennemi déjà révélé ne relance pas son action', () => {
  const p = scenario([ennemi('vu', [{ type: 'OR', valeur: -3 }], { revele: true, cartes: 2 })]);
  const { partie } = resoudreRevelation(p, creerRng(1));

  assert.equal(partie.champDeBataille.length, 2); // ses cartes, oui
  assert.equal(partie.ressources, p.ressources); // son action, non
});

test('un survivant redonne ses cartes au combat suivant', () => {
  // `ennemisPioches` retombe à chaque fin de phase : le combat d'après repart
  // de zéro, sans quoi un survivant ne ferait plus rien piocher.
  const p = scenario([ennemi('costaud', undefined, { cartes: 3 })]);

  const premier = resoudreRevelation(p, creerRng(1)).partie;
  assert.equal(premier.champDeBataille.length, 3);

  const combatSuivant = { ...premier, champDeBataille: [], ennemisPioches: [] };
  assert.equal(resoudreRevelation(combatSuivant, creerRng(1)).partie.champDeBataille.length, 3);
});

test('chaque ennemi n’est pioché qu’une fois, malgré une relance', () => {
  // Le Commandant fait avancer l'ennemi : une version antérieure reprenait la
  // boucle à zéro et repiochait pour lui.
  const commandant = ennemi('commandant', [{ type: 'JETON_ENNEMI', valeur: 2 }, { type: 'ENNEMI_AVANCE' }]);
  const recrue = ennemi('recrue', [{ type: 'OR', valeur: -1 }]);
  const p = scenario([commandant], {
    pisteEnnemi: [null, null, recrue],
    pileEnnemi: [],
    champDeBataille: [],
  });

  const { partie } = resoudreRevelation(p, creerRng(1));

  // 1 carte pour le Commandant + 1 pour la recrue, pas 3.
  assert.equal(partie.champDeBataille.length, 2);
  assert.equal(partie.chateau.length, p.chateau.length - 2);
});

test('piocherPourEnnemi pioche le compte de l’ennemi visé, sans le révéler', () => {
  const p = scenario([ennemi('gob', undefined, { cartes: 3 })], { champDeBataille: [] });
  const { partie } = piocherPourEnnemi(p, 0, creerRng(1));

  assert.equal(partie.champDeBataille.length, 3);
  assert.equal(partie.portes[0]?.revele, false); // la révélation est une étape à part
});
