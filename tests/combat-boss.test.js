// Tests du combat des Boss : résolution, retrait de la file, pénalité de
// Château vide, actions REVELATION et effets PASSIF.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { bosses } from '../public/js/moteur/cartes/bosses.js';
import { gestionnairesSpecial, passifsBoss } from '../public/js/moteur/special.js';
import {
  combattreBoss,
  piocherPourBoss,
  revelerBoss,
  resoudreCombatBoss,
  tousBossVaincus,
} from '../public/js/moteur/combat-boss.js';

/**
 * Une carte alliée de test. `symbole` n'est utile qu'aux effets qui filtrent
 * dessus (Reine troll, Dragon serpent).
 * @param {string} id @param {number} force @param {string} [symbole]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function allie(id, force, symbole) {
  return { instanceId: `${id}#a`, type: /** @type {any} */ ({ id, force, symbole, actions: [] }) };
}

/**
 * Une carte alliée portant un jeton bonus de force.
 * @param {string} id @param {number} force @param {number} jetonBonus
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function allieAvecJeton(id, force, jetonBonus) {
  return { ...allie(id, force), jetonBonus };
}

/**
 * `n` exemplaires du même type de carte : même `type.id` (ce qui en fait des
 * doublons pour Les jumeaux), `instanceId` distincts.
 * @param {number} n @param {string} id @param {number} force
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee[]}
 */
function exemplaires(n, id, force) {
  return Array.from({ length: n }, (_, i) => ({
    instanceId: `${id}#${i}`,
    type: /** @type {any} */ ({ id, force, actions: [] }),
  }));
}

/**
 * Un Boss de test (seuls `force` et `cartes` comptent ici ; pas d'action).
 * @param {string} id @param {number} force @param {number} [cartes]
 * @returns {import('../public/js/moteur/partie.js').InstanceBoss}
 */
function boss(id, force, cartes = 0) {
  return { instanceId: `${id}#b`, type: /** @type {any} */ ({ id, force, cartes, actions: [] }) };
}

/**
 * Un vrai Boss du jeu, instancié depuis les données : c'est sa force, son
 * nombre de cartes et son action réels qui sont mis à l'épreuve.
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceBoss}
 */
function bossReel(id) {
  const type = bosses.find((b) => b.id === id);
  if (!type) throw new Error(`Boss inconnu : ${id}`);
  return { instanceId: `${id}#b`, type };
}

/**
 * Carte de remplissage à force uniforme, pour rendre un résultat indépendant
 * de l'ordre de mélange.
 * @param {string} id @param {number} force
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id, force) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force, actions: [] }) };
}

/**
 * Construit un scénario de combat de Boss depuis une vraie partie.
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ
 * @param {import('../public/js/moteur/partie.js').InstanceBoss[]} file
 * @param {number} [ressources]
 */
function scenario(champ, file, ressources = 18) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ, boss: file, ressources };
}

/**
 * Scénario sans pioche possible : Château ET Hôpital vides, `piocher`
 * s'arrêtant faute de cartes. La Force du Champ de bataille est alors
 * exactement celle qu'on lui donne, quel que soit le nombre de cartes du Boss.
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ
 * @param {import('../public/js/moteur/partie.js').InstanceBoss[]} file
 * @param {number} [ressources]
 */
function scenarioSansPioche(champ, file, ressources = 30) {
  return { ...scenario(champ, file, ressources), chateau: [], hopital: [] };
}

test('victoire : Force ≥ Boss → il est retiré du jeu, le Champ de bataille rejoint l’Hôpital', () => {
  const p = scenario([allie('champion', 5)], [boss('demon', 4), boss('dragon', 10)]);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true);
  assert.equal(partie.boss.length, 1);
  assert.equal(partie.boss[0]?.type.id, 'dragon');
  assert.equal(partie.champDeBataille.length, 0);
  assert.equal(partie.hopital.length, 1);
});

test('défaite : on perd la différence en ressources, le Boss reste en tête de file', () => {
  const p = scenario([allie('vieux', 1)], [boss('demon', 5)], 18);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 14); // 18 - (5 - 1)
  assert.equal(partie.boss.length, 1);
  assert.equal(partie.boss[0]?.type.id, 'demon');
  assert.equal(partie.champDeBataille.length, 0); // reparti à l'Hôpital, pioche neuve au prochain essai
});

test('Château vide pendant un combat de Boss : 2 ressources perdues par reconstitution', () => {
  // Château vide d'entrée de jeu, Hôpital rempli de cartes de force 0 : la
  // reconstitution est immédiate et le résultat du combat (victoire à force
  // 0 ≥ 0) ne dépend pas de l'ordre du mélange.
  const remplissage = Array.from({ length: 5 }, (_, i) => carte(`c${i}`, 0));
  const p = { ...scenario([], [boss('demon', 0, 5)], 18), chateau: [], hopital: remplissage };

  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true);
  assert.equal(partie.ressources, 16); // 18 - 2 (une reconstitution pour piocher 5 cartes)
});

test('combattreBoss : refusé s’il ne reste aucun Boss à affronter', () => {
  const p = scenario([], []);
  assert.throws(() => combattreBoss(p, creerRng(1)), /Aucun Boss/);
});

test('tousBossVaincus reflète l’état de la file de Boss', () => {
  assert.equal(tousBossVaincus(scenario([], [boss('demon', 1)])), false);
  assert.equal(tousBossVaincus(scenario([], [])), true);
});

// ── Fin de tentative ────────────────────────────────────────────────────────

test('les activations sont oubliées en fin de tentative, victoire comme défaite', () => {
  const p = { ...scenarioSansPioche([], [boss('mur', 99)]), cartesActivees: ['x#a', 'y#a'] };
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false);
  assert.deepEqual(partie.cartesActivees, []);
});

// ── Actions REVELATION des Boss ─────────────────────────────────────────────

test('Troll géant : son action -1 or s’applique en plus du résultat du combat', () => {
  const p = scenarioSansPioche([allie('heros', 22)], [bossReel('troll-geant')], 18);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true); // force 22 ≥ 22
  assert.equal(partie.ressources, 17); // 18 - 1, la victoire ne coûte rien d'autre
});

test('l’action d’un Boss se relance à chaque tentative', () => {
  const p = scenarioSansPioche([], [bossReel('troll-geant')], 100);
  const premier = combattreBoss(p, creerRng(1));
  const second = combattreBoss(premier.partie, creerRng(1));
  assert.equal(second.victoire, false);
  assert.equal(second.partie.ressources, 54); // 100 - 2×(1 + 22)
  assert.equal(second.partie.boss.length, 1);
});

test('Dragon bleu : détruit la prochaine carte du Château, qui ne rejoint pas l’Hôpital', () => {
  const chateau = Array.from({ length: 5 }, (_, i) => carte(`c${i}`, 0));
  const p = { ...scenario([allie('heros', 13)], [bossReel('dragon-bleu')], 30), chateau, hopital: [] };

  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true); // force 13 ≥ 13, les 4 cartes piochées valent 0
  assert.equal(partie.chateau.length, 0); // c4, la 5e, est détruite
  assert.equal(partie.hopital.length, 5); // le héros + les 4 piochées, pas c4
  assert.equal(partie.hopital.some((c) => c.instanceId === 'c4#x'), false);
});

test('Démon : détruit la carte ciblée, force 1 ou plus, avant la comparaison', () => {
  const p = scenarioSansPioche([allie('heros', 14), allie('paille', 0)], [bossReel('demon')]);
  const choix = [{ cibles: ['heros#a'] }];

  const { partie, victoire } = combattreBoss(p, creerRng(1), choix);
  assert.equal(victoire, false); // le héros détruit, il ne reste que 0 de Force
  assert.equal(partie.ressources, 16); // 30 - (14 - 0)
});

test('Démon : une cible de force 0 est refusée', () => {
  const p = scenarioSansPioche([allie('paille', 0)], [bossReel('demon')]);
  assert.throws(
    () => combattreBoss(p, creerRng(1), [{ cibles: ['paille#a'] }]),
    /force de 1 ou plus/,
  );
});

test('Démon : la cible se choisit après la pioche, en trois étapes', () => {
  const p = { ...scenario([], [bossReel('demon')], 30), chateau: [carte('butin', 3)], hopital: [] };

  const apresPioche = piocherPourBoss(p, creerRng(1));
  const [pioche] = apresPioche.champDeBataille;
  assert.equal(pioche?.instanceId, 'butin#x'); // le joueur voit la carte avant de décider

  const apresAction = revelerBoss(apresPioche, [{ cibles: ['butin#x'] }], creerRng(1));
  assert.equal(apresAction.champDeBataille.length, 0);

  const { victoire, partie } = resoudreCombatBoss(apresAction);
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 16); // 30 - (14 - 0)
});

test('Dragon serpent : envoie à l’Hôpital le Paysan le plus fort, comme Gobelin vachelier', () => {
  const champ = [allie('chevalier', 5, 'HUMAIN'), allie('fermier', 2, 'HUMAIN')];
  const p = scenarioSansPioche(champ, [bossReel('dragon-serpent')]);

  const { partie, victoire } = combattreBoss(p, creerRng(1), [{ cibles: ['chevalier#a'] }]);
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 10); // 30 - (22 - 2) : le chevalier ne comptait plus
});

test('Dragon serpent : refuse une cible qui n’est pas le Paysan le plus fort', () => {
  const champ = [allie('chevalier', 5, 'HUMAIN'), allie('fermier', 2, 'HUMAIN')];
  const p = scenarioSansPioche(champ, [bossReel('dragon-serpent')]);
  assert.throws(
    () => combattreBoss(p, creerRng(1), [{ cibles: ['fermier#a'] }]),
    /le Paysan le plus fort/,
  );
});

test('Troll Gladiateur : son DEFAUSSER 2 retire deux cartes avant la comparaison', () => {
  const champ = exemplaires(3, 'garde', 5);
  const p = scenarioSansPioche(champ, [bossReel('troll-gladiateur')]);

  const { partie, victoire } = combattreBoss(p, creerRng(1), [{ cibles: ['garde#0', 'garde#1'] }]);
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 20); // 30 - (15 - 5) : une seule carte restait
});

// ── Effets PASSIF des Boss ──────────────────────────────────────────────────

test('Reine troll : la Force des Objets ne compte pas', () => {
  const p = scenarioSansPioche([allie('catapulte', 12, 'OBJET')], [bossReel('reine-troll')]);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 18); // 30 - 12 : l'Objet n'a rien apporté
});

test('Reine troll : les cartes qui ne sont pas des Objets comptent normalement', () => {
  const champ = [allie('catapulte', 6, 'OBJET'), allie('chevalier', 12, 'HUMAIN')];
  const p = scenarioSansPioche(champ, [bossReel('reine-troll')]);
  assert.equal(combattreBoss(p, creerRng(1)).victoire, true); // 12 ≥ 12, sans les 6 de l'Objet
});

test('Trollette : la Force des cartes de 4 et plus ne compte pas', () => {
  const p = scenarioSansPioche(exemplaires(4, 'garde', 4), [bossReel('trollette')]);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 14); // 30 - 16 : les 4 cartes sont ignorées
});

test('Trollette : sous le seuil, les cartes comptent — même nombreuses', () => {
  const p = scenarioSansPioche(exemplaires(6, 'fermier', 3), [bossReel('trollette')]);
  assert.equal(combattreBoss(p, creerRng(1)).victoire, true); // 18 ≥ 16
});

test('Goblinosaurus : les jetons bonus ne comptent pas, la force imprimée si', () => {
  const p = scenarioSansPioche([allieAvecJeton('titan', 20, 5)], [bossReel('goblinosaurus')]);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false); // 20 sans le jeton, contre 22
  assert.equal(partie.ressources, 28); // 30 - 2
});

test('Les jumeaux : les doublons ne comptent que pour un', () => {
  const p = scenarioSansPioche(exemplaires(5, 'garde', 6), [bossReel('les-jumeaux')]);
  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, false);
  assert.equal(partie.ressources, 12); // 30 - (24 - 6) : un seul garde compte
});

test('Les jumeaux : des types distincts s’additionnent normalement', () => {
  const champ = ['a', 'b', 'c', 'd'].map((id) => allie(id, 6));
  const p = scenarioSansPioche(champ, [bossReel('les-jumeaux')]);
  assert.equal(combattreBoss(p, creerRng(1)).victoire, true); // 24 ≥ 24
});

test('Dragon rouge : -1 or par action Pivoter utilisée, dû même en cas de victoire', () => {
  const base = scenarioSansPioche([allie('titan', 22)], [bossReel('dragon-rouge')]);
  const p = { ...base, cartesActivees: ['x#a', 'y#a', 'z#a'] };

  const { partie, victoire } = combattreBoss(p, creerRng(1));
  assert.equal(victoire, true); // 22 ≥ 22
  assert.equal(partie.ressources, 27); // 30 - 3 activations
  assert.deepEqual(partie.cartesActivees, []);
});

test('Dragon rouge : sans activation, il ne coûte rien', () => {
  const p = scenarioSansPioche([allie('titan', 22)], [bossReel('dragon-rouge')]);
  assert.equal(combattreBoss(p, creerRng(1)).partie.ressources, 30);
});

// ── Couverture des données ──────────────────────────────────────────────────
// Garde-fous : un Boss ajouté aux données sans son câblage échouerait ici
// plutôt qu'au premier combat réel.

test('tout Boss dont l’action REVELATION contient un SPECIAL a son gestionnaire', () => {
  for (const b of bosses) {
    const action = b.actions.find((a) => a.declencheur === 'REVELATION');
    if (!action?.effets.some((e) => e.type === 'SPECIAL')) continue;
    assert.ok(gestionnairesSpecial[b.id], `gestionnaire SPECIAL manquant : ${b.id}`);
  }
});

test('tout Boss porteur d’un PASSIF a son entrée dans passifsBoss', () => {
  for (const b of bosses) {
    if (!b.actions.some((a) => a.declencheur === 'PASSIF')) continue;
    assert.ok(passifsBoss[b.id], `PASSIF non décrit : ${b.id}`);
  }
});
