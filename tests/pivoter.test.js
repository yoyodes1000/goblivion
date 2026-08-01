// Tests de l'activation d'une action Pivoter (activerPivoter).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { activerPivoter } from '../public/js/moteur/pivoter.js';

/**
 * Une carte de test avec une action Pivoter donnée.
 * @param {string} id
 * @param {import('../public/js/moteur/cartes/types.js').Effet[]} effets
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carteAvecPivoter(id, effets) {
  return {
    instanceId: `${id}#x`,
    type: /** @type {any} */ ({ id, force: 0, actions: [{ declencheur: 'PIVOTER', effets }] }),
  };
}

/**
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id) {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force: 0, actions: [] }) };
}

/** @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} champ */
function scenario(champ) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, champDeBataille: champ };
}

test('active l’action Pivoter et marque la carte comme activée', () => {
  const p = scenario([carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 1 }])]);
  const { partie } = activerPivoter(p, 'boulanger#x', [], creerRng(1));
  assert.equal(partie.ressources, p.ressources + 1);
  assert.deepEqual(partie.cartesActivees, ['boulanger#x']);
});

test('refuse d’activer deux fois la même carte dans la même phase', () => {
  const p = scenario([carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 1 }])]);
  const { partie } = activerPivoter(p, 'boulanger#x', [], creerRng(1));
  assert.throws(() => activerPivoter(partie, 'boulanger#x', [], creerRng(1)), /déjà activée/);
});

test('refuse une carte absente du Champ de bataille', () => {
  const p = scenario([]);
  assert.throws(() => activerPivoter(p, 'inconnue#x', [], creerRng(1)), /absente du Champ de bataille/);
});

test('refuse une carte sans action Pivoter', () => {
  const p = scenario([carte('garde')]);
  assert.throws(() => activerPivoter(p, 'garde#x', [], creerRng(1)), /pas d’action Pivoter/);
});

test('FORCE : pose un jeton bonus sur la carte activée elle-même (forme de Lames toxiques)', () => {
  const p = scenario([carteAvecPivoter('lames', [{ type: 'OR', valeur: -1 }, { type: 'FORCE', valeur: 3 }])]);
  const { partie } = activerPivoter(p, 'lames#x', [], creerRng(1));
  assert.equal(partie.ressources, p.ressources - 1);
  assert.equal(partie.champDeBataille[0]?.jetonBonus, 3);
});

test('Nain (SPECIAL) : chaque Objet en jeu gagne +1 force, résolu via type.id', () => {
  const nain = {
    instanceId: 'nain#x',
    type: /** @type {any} */ ({
      id: 'nain',
      force: 0,
      actions: [{ declencheur: 'PIVOTER', effets: [{ type: 'SPECIAL', texte: 'chaque Objet en jeu gagne +1 force' }] }],
    }),
  };
  const epee = { instanceId: 'epee#x', type: /** @type {any} */ ({ id: 'epee', force: 1, symbole: 'OBJET' }) };
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 0, symbole: 'HUMAIN' }) };

  const p = scenario([nain, epee, paysan]);
  const { partie } = activerPivoter(p, 'nain#x', [], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'epee#x')?.jetonBonus, 1);
  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'paysan#x')?.jetonBonus, undefined);
});

test('Protecteur mécanique (SPECIAL) : +1 jeton bonus sur lui-même par Objet à l’Hôpital', () => {
  const protecteur = carteAvecPivoter('protecteur-mecanique', [
    { type: 'SPECIAL', texte: '+1 force pour chaque Objet à l’Hôpital' },
  ]);
  const objet1 = { instanceId: 'o1#x', type: /** @type {any} */ ({ id: 'o1', force: 0, symbole: 'OBJET' }) };
  const objet2 = { instanceId: 'o2#x', type: /** @type {any} */ ({ id: 'o2', force: 0, symbole: 'OBJET' }) };
  const paysan = { instanceId: 'p1#x', type: /** @type {any} */ ({ id: 'p1', force: 0, symbole: 'HUMAIN' }) };

  const p = { ...scenario([protecteur]), hopital: [objet1, objet2, paysan] };
  const { partie } = activerPivoter(p, 'protecteur-mecanique#x', [], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'protecteur-mecanique#x')?.jetonBonus, 2);
});

test('Forgeron (SPECIAL) : ramène un Objet de l’Hôpital en jeu, sans bonus', () => {
  const forgeron = carteAvecPivoter('forgeron', [{ type: 'SPECIAL', texte: 'ramener un Objet de l’Hôpital en jeu' }]);
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 1, symbole: 'OBJET' }) };

  const p = { ...scenario([forgeron]), hopital: [objet] };
  const { partie } = activerPivoter(p, 'forgeron#x', [{ cibles: ['objet#x'] }], creerRng(1));

  const ramene = partie.champDeBataille.find((c) => c.instanceId === 'objet#x');
  assert.ok(ramene);
  assert.equal(ramene?.jetonBonus, undefined);
  assert.ok(!partie.hopital.some((c) => c.instanceId === 'objet#x'));
});

test('Forgeron (SPECIAL) : refuse une cible qui n’est pas un Objet (symbole OBJET)', () => {
  const forgeron = carteAvecPivoter('forgeron', [{ type: 'SPECIAL', texte: 'ramener un Objet de l’Hôpital en jeu' }]);
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 0, symbole: 'HUMAIN' }) };

  const p = { ...scenario([forgeron]), hopital: [paysan] };
  assert.throws(
    () => activerPivoter(p, 'forgeron#x', [{ cibles: ['paysan#x'] }], creerRng(1)),
    /doit être un Objet/,
  );
});

test('Aimant (SPECIAL) : même effet que Forgeron (texte identique, gestionnaire partagé)', () => {
  const aimant = carteAvecPivoter('aimant', [{ type: 'SPECIAL', texte: 'ramener un Objet de l’Hôpital en jeu' }]);
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 1, symbole: 'OBJET' }) };

  const p = { ...scenario([aimant]), hopital: [objet] };
  const { partie } = activerPivoter(p, 'aimant#x', [{ cibles: ['objet#x'] }], creerRng(1));

  assert.ok(partie.champDeBataille.some((c) => c.instanceId === 'objet#x'));
});

test('Épée de feu (SPECIAL) : double le jeton bonus d’une carte du Champ de bataille', () => {
  const epee = carteAvecPivoter('epee-de-feu', [{ type: 'SPECIAL', texte: 'doubler les jetons bonus d’une carte en jeu' }]);
  const cible = { instanceId: 'cible#x', type: /** @type {any} */ ({ id: 'cible', force: 1 }), jetonBonus: 3 };

  const p = scenario([epee, cible]);
  const { partie } = activerPivoter(p, 'epee-de-feu#x', [{ cibles: ['cible#x'] }], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'cible#x')?.jetonBonus, 6);
});

test('Cape royale (SPECIAL) : chaque Paysan (symbole HUMAIN) en jeu gagne +1 force', () => {
  const cape = carteAvecPivoter('cape-royale', [{ type: 'SPECIAL', texte: 'chaque Paysan gagne un jeton +1 force' }]);
  const paysan = { instanceId: 'paysan#x', type: /** @type {any} */ ({ id: 'paysan', force: 0, symbole: 'HUMAIN' }) };
  const objet = { instanceId: 'objet#x', type: /** @type {any} */ ({ id: 'objet', force: 0, symbole: 'OBJET' }) };

  const p = scenario([cape, paysan, objet]);
  const { partie } = activerPivoter(p, 'cape-royale#x', [], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'paysan#x')?.jetonBonus, 1);
  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'objet#x')?.jetonBonus, undefined);
});

test('Casque à cornes (SPECIAL) : chaque carte Bleu (Paysan de base) en jeu gagne +1 force', () => {
  const casque = carteAvecPivoter('casque-a-cornes', [{ type: 'SPECIAL', texte: 'les cartes Bleu gagnent +1 force' }]);
  const fermier = { instanceId: 'fermier#x', type: /** @type {any} */ ({ id: 'fermier', force: 0 }) }; // vraie carte Bleu
  const dore = { instanceId: 'dore#x', type: /** @type {any} */ ({ id: 'catapulte', force: 3 }) }; // vraie carte Doré

  const p = scenario([casque, fermier, dore]);
  const { partie } = activerPivoter(p, 'casque-a-cornes#x', [], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'fermier#x')?.jetonBonus, 1);
  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'dore#x')?.jetonBonus, undefined);
});

/**
 * Un ennemi de test aux Portes, avec son éventuel jeton bonus.
 * @param {string} id
 * @param {number} jetonBonus
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function ennemi(id, jetonBonus) {
  return {
    instance: { instanceId: `${id}#e`, type: /** @type {any} */ ({ id, force: 3, niveau: 'UNE_EPEE' }) },
    revele: true,
    jetonBonus,
  };
}

test('orBloque (Troll saboteur) : la carte se pivote bien, mais son gain d’or est perdu', () => {
  const boulanger = carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 1 }]);
  const p = { ...scenario([boulanger]), orBloque: true };

  const { partie } = activerPivoter(p, 'boulanger#x', [], creerRng(1));

  assert.equal(partie.ressources, p.ressources); // aucun or gagné
  assert.ok(partie.cartesActivees.includes('boulanger#x')); // la carte est bien activée
});

test('Champion (SPECIAL) : détruit le jeton bonus de l’ennemi désigné aux Portes', () => {
  const champion = carteAvecPivoter('champion', [{ type: 'SPECIAL', texte: 'détruire un jeton bonus ennemi' }]);
  const p = { ...scenario([champion]), portes: [ennemi('gob', 2), ennemi('autre', 1)] };

  const { partie } = activerPivoter(p, 'champion#x', [{ cibles: ['gob#e'] }], creerRng(1));

  assert.equal(partie.portes[0]?.jetonBonus, 0);
  assert.equal(partie.portes[1]?.jetonBonus, 1); // les autres ennemis ne bougent pas
});

test('Champion (SPECIAL) : atteint aussi un ennemi resté sur la piste', () => {
  const champion = carteAvecPivoter('champion', [{ type: 'SPECIAL', texte: 'détruire un jeton bonus ennemi' }]);
  const p = { ...scenario([champion]), pisteEnnemi: [null, ennemi('gob', 2), null, null] };

  const { partie } = activerPivoter(p, 'champion#x', [{ cibles: ['gob#e'] }], creerRng(1));

  assert.equal(partie.pisteEnnemi[1]?.jetonBonus, 0);
});

test('Champion (SPECIAL) : refuse un ennemi sans jeton bonus', () => {
  const champion = carteAvecPivoter('champion', [{ type: 'SPECIAL', texte: 'détruire un jeton bonus ennemi' }]);
  const p = { ...scenario([champion]), portes: [ennemi('gob', 0)] };

  assert.throws(
    () => activerPivoter(p, 'champion#x', [{ cibles: ['gob#e'] }], creerRng(1)),
    /aucun jeton bonus/,
  );
});

test('Champion (SPECIAL) : refuse un ennemi introuvable', () => {
  const champion = carteAvecPivoter('champion', [{ type: 'SPECIAL', texte: 'détruire un jeton bonus ennemi' }]);
  const p = { ...scenario([champion]), portes: [ennemi('gob', 2)] };

  assert.throws(
    () => activerPivoter(p, 'champion#x', [{ cibles: ['inconnu#e'] }], creerRng(1)),
    /Ennemi introuvable/,
  );
});

test('Chapeau magique (SPECIAL) : copie l’action Pivoter de la carte désignée', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const boulanger = carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 2 }]);

  const p = scenario([chapeau, boulanger]);
  const { partie } = activerPivoter(p, 'chapeau-magique#x', [{ cibles: ['boulanger#x'] }], creerRng(1));

  assert.equal(partie.ressources, p.ressources + 2);
  assert.deepEqual(partie.cartesActivees, ['chapeau-magique#x']); // la cible n'est pas « utilisée »
});

test('Chapeau magique (SPECIAL) : un FORCE copié pose son jeton sur le Chapeau, pas sur la cible', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const lames = carteAvecPivoter('lames', [{ type: 'OR', valeur: -1 }, { type: 'FORCE', valeur: 3 }]);

  const p = scenario([chapeau, lames]);
  const { partie } = activerPivoter(p, 'chapeau-magique#x', [{ cibles: ['lames#x'] }], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'chapeau-magique#x')?.jetonBonus, 3);
  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'lames#x')?.jetonBonus, undefined);
});

test('Chapeau magique (SPECIAL) : copie une cible déjà pivotée', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const boulanger = carteAvecPivoter('boulanger', [{ type: 'OR', valeur: 2 }]);

  const p = scenario([chapeau, boulanger]);
  const { partie: apresBoulanger } = activerPivoter(p, 'boulanger#x', [], creerRng(1));
  const { partie } = activerPivoter(apresBoulanger, 'chapeau-magique#x', [{ cibles: ['boulanger#x'] }], creerRng(1));

  assert.equal(partie.ressources, p.ressources + 4); // 2 (boulanger) + 2 (copie)
});

test('Chapeau magique (SPECIAL) : un SPECIAL copié se résout via le type.id de la cible', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const nain = carteAvecPivoter('nain', [{ type: 'SPECIAL', texte: 'chaque Objet en jeu gagne +1 force' }]);
  const epee = { instanceId: 'epee#x', type: /** @type {any} */ ({ id: 'epee', force: 1, symbole: 'OBJET' }) };

  const p = scenario([chapeau, nain, epee]);
  const { partie } = activerPivoter(p, 'chapeau-magique#x', [{ cibles: ['nain#x'] }], creerRng(1));

  assert.equal(partie.champDeBataille.find((c) => c.instanceId === 'epee#x')?.jetonBonus, 1);
});

test('Chapeau magique (SPECIAL) : refuse de se copier lui-même (récursion infinie)', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const p = scenario([chapeau]);

  assert.throws(
    () => activerPivoter(p, 'chapeau-magique#x', [{ cibles: ['chapeau-magique#x'] }], creerRng(1)),
    /se copier lui-même/,
  );
});

test('Chapeau magique (SPECIAL) : refuse une cible sans action Pivoter', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const p = scenario([chapeau, carte('garde')]);

  assert.throws(
    () => activerPivoter(p, 'chapeau-magique#x', [{ cibles: ['garde#x'] }], creerRng(1)),
    /pas d’action Pivoter/,
  );
});

test('Chapeau magique (SPECIAL) : les sous-choix de l’action copiée viennent de choixCopie', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const bourreau = carteAvecPivoter('bourreau', [{ type: 'DETRUIRE_JEU' }]);
  const victime = carte('victime');

  const p = scenario([chapeau, bourreau, victime]);
  const { partie } = activerPivoter(
    p,
    'chapeau-magique#x',
    [{ cibles: ['bourreau#x'], choixCopie: [{ cibles: ['victime#x'] }] }],
    creerRng(1),
  );

  assert.ok(!partie.champDeBataille.some((c) => c.instanceId === 'victime#x'));
});

test('Chapeau magique (SPECIAL) : propage les reconstitutions du Château de l’action copiée', () => {
  const chapeau = carteAvecPivoter('chapeau-magique', [
    { type: 'SPECIAL', texte: 'copier une action pivoter d’une carte en jeu' },
  ]);
  const scout = carteAvecPivoter('scout', [{ type: 'PIOCHER', valeur: 2 }]);
  const remplissage = Array.from({ length: 2 }, (_, i) => carte(`c${i}`));

  const p = { ...scenario([chapeau, scout]), chateau: [], hopital: remplissage };
  const { reconstitutions } = activerPivoter(p, 'chapeau-magique#x', [{ cibles: ['scout#x'] }], creerRng(1));

  assert.equal(reconstitutions, 1);
});

test('CHOIX : au choix, +2 force OU vision 1 (forme de Scouts)', () => {
  const scouts = carteAvecPivoter('scouts', [
    { type: 'CHOIX', options: [[{ type: 'FORCE', valeur: 2 }], [{ type: 'VISION', valeur: 1 }]] },
  ]);
  const p = scenario([scouts]);

  const { partie } = activerPivoter(p, 'scouts#x', [{ branche: 0 }], creerRng(1));

  assert.equal(partie.champDeBataille[0]?.jetonBonus, 2);
});

test('propage les reconstitutions du Château depuis les effets exécutés', () => {
  const remplissage = Array.from({ length: 2 }, (_, i) => carte(`c${i}`));
  const p = {
    ...scenario([carteAvecPivoter('scout', [{ type: 'PIOCHER', valeur: 2 }])]),
    chateau: [],
    hopital: remplissage,
  };
  const { reconstitutions } = activerPivoter(p, 'scout#x', [], creerRng(1));
  assert.equal(reconstitutions, 1);
});
