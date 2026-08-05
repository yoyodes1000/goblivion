// Tests de l'exécution des effets structurés (executerEffets).

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { avancerEnnemis } from '../public/js/moteur/ennemi-avance.js';
import { executerEffets } from '../public/js/moteur/effets.js';
import { forceTotale } from '../public/js/moteur/force.js';
import { viderChampDeBataille } from '../public/js/moteur/partie.js';
import { copierAvecJoker } from '../public/js/moteur/special.js';

/**
 * Instance de test au type librement décrit (symbole, force, id).
 * @param {string} instanceId @param {any} type
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function instanceDeType(instanceId, type) {
  return { instanceId, type };
}

/**
 * Active l'effet SPECIAL de `typeId` sur la carte `carteActiveeId`.
 * @param {any} partie @param {string | undefined} carteActiveeId @param {string} typeId
 */
function activerSpecial(partie, carteActiveeId, typeId) {
  return executerEffets(
    partie,
    [{ type: 'SPECIAL', texte: '' }],
    [],
    creerRng(1),
    carteActiveeId,
    typeId,
  ).partie;
}

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

test('OR : orBloque (Troll saboteur) annule le gain', () => {
  const p = { ...scenario([]), orBloque: true };
  const { partie } = executerEffets(p, [{ type: 'OR', valeur: 2 }], [], creerRng(1));
  assert.equal(partie.ressources, p.ressources);
});

test('OR : orBloque laisse les pertes s’appliquer', () => {
  const p = { ...scenario([]), orBloque: true };
  const { partie } = executerEffets(p, [{ type: 'OR', valeur: -3 }], [], creerRng(1));
  assert.equal(partie.ressources, p.ressources - 3);
});

test('OR : orBloque n’empêche pas les autres effets de l’action de se jouer', () => {
  const p = { ...scenario([]), orBloque: true };
  const { partie } = executerEffets(
    p,
    [{ type: 'OR', valeur: 1 }, { type: 'PIOCHER', valeur: 2 }],
    [],
    creerRng(1),
  );
  assert.equal(partie.ressources, p.ressources); // le gain est perdu
  assert.equal(partie.champDeBataille.length, 2); // mais la pioche a bien lieu
});

test('OR : aucun gain pendant le combat des Boss (« le feu au château »)', () => {
  const p = { ...scenario([]), phase: /** @type {any} */ ('COMBAT_BOSS') };
  const { partie } = executerEffets(p, [{ type: 'OR', valeur: 2 }], [], creerRng(1));
  assert.equal(partie.ressources, p.ressources);
});

test('OR : pendant le combat des Boss, les pertes restent dues', () => {
  const p = { ...scenario([]), phase: /** @type {any} */ ('COMBAT_BOSS') };
  const { partie } = executerEffets(p, [{ type: 'OR', valeur: -3 }], [], creerRng(1));
  assert.equal(partie.ressources, p.ressources - 3);
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

test('un effet pas encore géré (ex. JETON_ENNEMI, hors contexte REVELATION) lève une erreur explicite', () => {
  const p = scenario([]);
  assert.throws(
    () => executerEffets(p, [{ type: 'JETON_ENNEMI', valeur: 2 }], [], creerRng(1)),
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

test('CHOIX : exécute la branche désignée (0)', () => {
  const p = scenario([]);
  const effet = /** @type {import('../public/js/moteur/cartes/types.js').Effet} */ ({
    type: 'CHOIX',
    options: [[{ type: 'PIOCHER', valeur: 1 }], [{ type: 'VISION', valeur: 1 }]],
  });
  const { partie } = executerEffets(p, [effet], [{ branche: 0 }], creerRng(1));
  assert.equal(partie.champDeBataille.length, 1);
});

test('CHOIX : exécute la branche désignée (1), avec ses propres sous-choix', () => {
  const p = avancerEnnemis(scenario([]));
  const effet = /** @type {import('../public/js/moteur/cartes/types.js').Effet} */ ({
    type: 'CHOIX',
    options: [[{ type: 'PIOCHER', valeur: 1 }], [{ type: 'VISION', valeur: 1 }]],
  });
  const { partie } = executerEffets(p, [effet], [{ branche: 1, choixBranche: [{ indexPiste: [0] }] }], creerRng(1));
  assert.equal(partie.pisteEnnemi[0]?.revele, true);
});

test('CHOIX : lève une erreur sur une branche invalide', () => {
  const p = scenario([]);
  const effet = /** @type {import('../public/js/moteur/cartes/types.js').Effet} */ ({
    type: 'CHOIX',
    options: [[{ type: 'PIOCHER', valeur: 1 }]],
  });
  assert.throws(() => executerEffets(p, [effet], [{ branche: 5 }], creerRng(1)), /branche invalide/);
  assert.throws(() => executerEffets(p, [effet], [{}], creerRng(1)), /branche invalide/);
});

test('CHOIX : une branche contenant FORCE fonctionne (forme de Scouts), carteActiveeId propagé', () => {
  const p = scenario([carte('scouts')]);
  const effet = /** @type {import('../public/js/moteur/cartes/types.js').Effet} */ ({
    type: 'CHOIX',
    options: [[{ type: 'FORCE', valeur: 2 }], [{ type: 'VISION', valeur: 1 }]],
  });
  const { partie } = executerEffets(p, [effet], [{ branche: 0 }], creerRng(1), 'scouts#x');
  assert.equal(partie.champDeBataille[0]?.jetonBonus, 2);
});

test('CHOIX : propage les reconstitutions du Château depuis la branche choisie', () => {
  const remplissage = Array.from({ length: 3 }, (_, i) => carte(`c${i}`));
  const p = { ...scenario([]), chateau: [], hopital: remplissage };
  const effet = /** @type {import('../public/js/moteur/cartes/types.js').Effet} */ ({
    type: 'CHOIX',
    options: [[{ type: 'PIOCHER', valeur: 2 }]],
  });
  const { reconstitutions } = executerEffets(p, [effet], [{ branche: 0 }], creerRng(1));
  assert.equal(reconstitutions, 1);
});

test('SPECIAL (Sorcière troll) : propage les reconstitutions du Château depuis le TESTAMENT de la cible détruite', () => {
  const cibleHumaine = {
    instanceId: 'paysan#x',
    type: /** @type {any} */ ({
      id: 'paysan', force: 0, symbole: 'HUMAIN',
      actions: [{ declencheur: 'TESTAMENT', effets: [{ type: 'PIOCHER', valeur: 2 }] }],
    }),
  };
  const remplissage = Array.from({ length: 3 }, (_, i) => carte(`c${i}`));
  const p = { ...scenario([cibleHumaine]), chateau: [], hopital: remplissage };

  const { partie, reconstitutions } = executerEffets(
    p,
    [{ type: 'SPECIAL', texte: 'détruire 1 Paysan (HUMAIN) en jeu' }],
    [{ cibles: ['paysan#x'] }],
    creerRng(1),
    undefined,
    'sorciere-troll',
  );

  assert.equal(partie.champDeBataille.some((c) => c.instanceId === 'paysan#x'), false);
  assert.equal(reconstitutions, 1);
});

test('les reconstitutions du Château se propagent depuis PIOCHER', () => {
  const remplissage = Array.from({ length: 3 }, (_, i) => carte(`c${i}`));
  const p = { ...scenario([]), chateau: [], hopital: remplissage };
  const { reconstitutions } = executerEffets(p, [{ type: 'PIOCHER', valeur: 2 }], [], creerRng(1));
  assert.equal(reconstitutions, 1);
});

// ── Héros du village : devient un Soldat le temps de son séjour en jeu ──────

/** @returns {import('../public/js/moteur/partie.js').InstanceAlliee} */
function herosDuVillage() {
  return instanceDeType('heros#x', {
    id: 'heros-du-village', nom: 'Héros du village', symbole: 'HUMAIN', force: 2, actions: [],
  });
}

/** @param {string} n @returns {import('../public/js/moteur/partie.js').InstanceAlliee} */
function soldat(n) {
  return instanceDeType(`soldat#${n}`, {
    id: 'soldat', nom: 'Soldat', symbole: 'HUMAIN', force: 'VARIABLE', actions: [],
  });
}

test('Héros du village (SPECIAL) : prend le type Soldat, sa force imprimée passe au second plan', () => {
  const p = scenario([herosDuVillage()]);
  const [apres] = activerSpecial(p, 'heros#x', 'heros-du-village').champDeBataille;

  assert.equal(apres?.type.id, 'soldat');
  assert.equal(apres?.typeOrigine?.id, 'heros-du-village');
});

test('Héros du village : il entre dans le barème des Soldats, pour lui et pour les autres', () => {
  const p = scenario([herosDuVillage(), soldat('1'), soldat('2')]);
  assert.equal(forceTotale(p.champDeBataille), 2 + 3 + 3); // 2 Soldats à 3, plus le Héros à 2

  const apres = activerSpecial(p, 'heros#x', 'heros-du-village');
  assert.equal(forceTotale(apres.champDeBataille), 12); // 3 Soldats à 4
});

test('Héros du village : il redevient lui-même en rentrant à l’Hôpital', () => {
  const p = scenario([herosDuVillage()]);
  const { hopital } = viderChampDeBataille(activerSpecial(p, 'heros#x', 'heros-du-village'));

  assert.equal(hopital[0]?.type.id, 'heros-du-village');
  assert.equal(hopital[0]?.typeOrigine, undefined);
});

test('Héros du village : refusé hors contexte d’activation', () => {
  const p = scenario([herosDuVillage()]);
  assert.throws(() => activerSpecial(p, undefined, 'heros-du-village'), /aucune carte activée/);
});

// ── Chevalier : son action ENTRAINEMENT ajoute une carte Épée ───────────────

test('Chevalier (SPECIAL) : ajoute une carte Épée bleue à l’Hôpital', () => {
  const p = scenario([]);
  const apres = activerSpecial(p, undefined, 'chevalier');

  const epee = apres.hopital.find((c) => c.type.id === 'epee');
  assert.ok(epee, 'l’Épée doit être à l’Hôpital');
  assert.equal(epee?.type.symbole, 'OBJET');
  assert.equal(apres.champDeBataille.length, 0); // elle arrive à l'Hôpital, pas en jeu
});

// ── Joker : copie un Paysan en jeu à son arrivée ────────────────────────────

/** @returns {import('../public/js/moteur/partie.js').InstanceAlliee} */
function joker(instanceId = 'joker#x') {
  return instanceDeType(instanceId, {
    id: 'joker', nom: 'Joker', symbole: 'HUMAIN', force: 'VARIABLE', actions: [],
  });
}

/** @returns {import('../public/js/moteur/partie.js').InstanceAlliee} */
function gentilhomme() {
  return instanceDeType('gentilhomme#x', {
    id: 'gentilhomme', nom: 'Gentilhomme', symbole: 'HUMAIN', force: 2, actions: [],
  });
}

test('Joker : prend la force et les capacités du Paysan copié', () => {
  const p = scenario([joker(), gentilhomme()]);
  const apres = copierAvecJoker(p, 'joker#x', 'gentilhomme#x');

  const copie = apres.champDeBataille.find((c) => c.instanceId === 'joker#x');
  assert.equal(copie?.type.id, 'gentilhomme');
  assert.equal(copie?.typeOrigine?.id, 'joker');
  assert.equal(forceTotale(apres.champDeBataille), 4); // deux Gentilhommes à 2
});

test('Joker : redevient Joker en rentrant à l’Hôpital', () => {
  const p = scenario([joker(), gentilhomme()]);
  const { hopital } = viderChampDeBataille(copierAvecJoker(p, 'joker#x', 'gentilhomme#x'));

  const rentre = hopital.find((c) => c.instanceId === 'joker#x');
  assert.equal(rentre?.type.id, 'joker');
  assert.equal(rentre?.typeOrigine, undefined);
});

test('Joker : ne peut pas copier une seconde fois — il n’est plus un Joker', () => {
  const p = scenario([joker(), gentilhomme()]);
  const apres = copierAvecJoker(p, 'joker#x', 'gentilhomme#x');
  assert.throws(() => copierAvecJoker(apres, 'joker#x', 'gentilhomme#x'), /n’est pas un Joker/);
});

test('Joker : refuse une cible qui n’est ni Bleu ni Doré (dont un autre Joker)', () => {
  const p = scenario([joker(), joker('joker#2')]);
  assert.throws(() => copierAvecJoker(p, 'joker#x', 'joker#2'), /Bleu ou Doré/);
});

test('Joker : refuse une cible qui n’est pas un Paysan', () => {
  const grimoire = instanceDeType('grimoire#x', {
    id: 'grimoire', nom: 'Grimoire', symbole: 'OBJET', force: 0, actions: [],
  });
  const p = scenario([joker(), grimoire]);
  assert.throws(() => copierAvecJoker(p, 'joker#x', 'grimoire#x'), /symbole HUMAIN/);
});

test('Joker : refuse une cible absente du Champ de bataille', () => {
  const p = scenario([joker()]);
  assert.throws(() => copierAvecJoker(p, 'joker#x', 'fantome#x'), /cible absente/);
});

// ── ENNEMI_AVANCE : le TESTAMENT du Traître ─────────────────────────────────

/** @returns {import('../public/js/moteur/partie.js').InstanceAlliee} */
function traitre() {
  return carteAvecTestament('traitre', [{ type: 'ENNEMI_AVANCE' }]);
}

test('détruire un Traître fait avancer l’ennemi, au lieu de lever une erreur', () => {
  const p = scenario([traitre()]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['traitre#x'] }], creerRng(1));

  assert.equal(partie.pisteEnnemi.filter(Boolean).length, 1);
  assert.equal(partie.pileEnnemi.length, p.pileEnnemi.length - 1);
  assert.equal(partie.champDeBataille.length, 0);
});

test('détruire un Traître à l’Hôpital le fait avancer aussi (Bourreau, Enfant)', () => {
  const p = scenario([], [traitre()]);
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_HOPITAL' }], [{ cibles: ['traitre#x'] }], creerRng(1));

  assert.equal(partie.pisteEnnemi.filter(Boolean).length, 1);
});

test('pendant le combat des Boss, le TESTAMENT du Traître ne fait rien (FAQ p.18)', () => {
  const p = { ...scenario([traitre()]), phase: /** @type {any} */ ('COMBAT_BOSS') };
  const { partie } = executerEffets(p, [{ type: 'DETRUIRE_JEU' }], [{ cibles: ['traitre#x'] }], creerRng(1));

  assert.deepEqual(partie.pisteEnnemi, p.pisteEnnemi);
  assert.equal(partie.pileEnnemi.length, p.pileEnnemi.length);
});
