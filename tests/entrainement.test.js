// Tests de la phase Entraînement.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import {
  entrainer,
  obstacleEntrainement,
  piocherPourEntrainement,
  coutEntrainement,
  finaliserEntrainement,
  renoncerEntrainement,
} from '../public/js/moteur/entrainement.js';
import { avancerPhase } from '../public/js/moteur/partie.js';

/**
 * Carte de test (id, force, symbole).
 * @param {string} id @param {number} force @param {'HUMAIN' | 'OBJET'} [symbole]
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function carte(id, force, symbole = 'HUMAIN') {
  return { instanceId: `${id}#x`, type: /** @type {any} */ ({ id, force, symbole }) };
}

/**
 * Partie avec un Château contrôlé (pour maîtriser ce qui est pioché).
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} chateau
 * @param {number} [ressources]
 * @param {boolean} [premierCombatGagne]
 */
function scenario(chateau, ressources = 18, premierCombatGagne = false) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return { ...base, chateau, champDeBataille: [], hopital: [], ressources, premierCombatGagne };
}

// Bâtisseur (1 épée) : piocher 4, cible 2, échange HUMAIN.

test('entraînement réussi : la Doré rejoint l’Hôpital, le sacrifice est détruit', () => {
  const p = scenario([carte('a', 1), carte('b', 1), carte('c', 0), carte('d', 0)]);
  const { partie: r } = entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));
  assert.ok(r.hopital.some((c) => c.type.id === 'batisseur'), 'la Doré doit être à l’Hôpital');
  assert.ok(!r.hopital.some((c) => c.instanceId === 'a#x'), 'le sacrifice ne doit pas être à l’Hôpital');
  assert.ok(r.hopital.some((c) => c.instanceId === 'b#x'), 'les autres cartes en jeu vont à l’Hôpital');
  assert.equal(r.champDeBataille.length, 0);
  assert.equal(r.marcheDore.find((m) => m.typeId === 'batisseur')?.restant, 3);
  assert.equal(r.ressources, 18); // force 2 = cible 2 → pas de paiement
});

test('entraînement : la différence jusqu’à la cible est payée en ressources', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  const { partie: r } = entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));
  assert.equal(r.ressources, 16); // cible 2, force 0 → paie 2
});

test('entraînement : un sacrifice du mauvais symbole est refusé', () => {
  const p = scenario([carte('a', 0, 'OBJET'), carte('b', 0), carte('c', 0), carte('d', 0)]);
  assert.throws(
    () => entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /symbole/,
  );
});

test('entraînement : les cartes 2 épées sont bloquées avant le premier combat gagné', () => {
  const p = scenario([carte('a', 5), carte('b', 0), carte('c', 0)], 18, false);
  assert.throws(
    () => entrainer(p, { doreId: 'fou-de-guerre', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /2 épées/,
  );
});

test('entraînement : ressources insuffisantes pour la cible → refusé', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)], 1);
  assert.throws(
    () => entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /insuffisantes/,
  );
});

// Chevalier (2 épées) : piocher 4, cible 8, échange HUMAIN — et son action
// ENTRAINEMENT, seule du jeu, qui rapporte une carte Épée en plus.

test('Chevalier : l’entraîner ajoute aussi une carte Épée à l’Hôpital', () => {
  const chateau = [carte('a', 4), carte('b', 4), carte('c', 0), carte('d', 0)];
  const p = scenario(chateau, 18, true);
  const { partie: r } = entrainer(p, { doreId: 'chevalier', sacrifieInstanceId: 'a#x' }, creerRng(1));

  assert.ok(r.hopital.some((c) => c.type.id === 'chevalier'), 'la Doré entraînée');
  assert.ok(r.hopital.some((c) => c.type.id === 'epee'), 'l’Épée offerte par son action');
  assert.equal(r.ressources, 18); // force 8 = cible 8, rien à payer
  assert.equal(r.marcheDore.find((m) => m.typeId === 'chevalier')?.restant, 1);
});

test('une Doré sans action ENTRAINEMENT ne rapporte rien de plus', () => {
  const p = scenario([carte('a', 1), carte('b', 1), carte('c', 0), carte('d', 0)]);
  const { partie: r } = entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));
  assert.equal(r.hopital.some((c) => c.type.id === 'epee'), false);
});

test('entrainer remonte les reconstitutions du Château sans en tirer de conséquence', () => {
  // Château vide, Hôpital à exactement 4 cartes : la reconstitution est
  // immédiate et les 4 cartes sont piochées, quel que soit l'ordre du mélange.
  const remplissage = Array.from({ length: 4 }, (_, i) => carte(`c${i}`, 0));
  const p = { ...scenario([]), hopital: remplissage };

  const { partie, reconstitutions } = entrainer(
    p,
    { doreId: 'batisseur', sacrifieInstanceId: 'c0#x' },
    creerRng(1),
  );

  assert.equal(reconstitutions, 1);
  assert.equal(partie.ressources, 16); // cible 2, force 0 → paie 2 ; aucune pénalité de Château
  assert.deepEqual(partie.pisteEnnemi, p.pisteEnnemi); // l'ennemi n'a pas avancé : c'est à l'appelant d'agir
});

// ── Découpage en deux temps ─────────────────────────────────────────────────
// La carte sacrifiée sort de la pioche de l'entraînement : elle ne peut être
// désignée qu'une fois celle-ci faite.

test('piocherPourEntrainement pioche sans rien échanger', () => {
  const p = scenario([carte('a', 1), carte('b', 1), carte('c', 0), carte('d', 0)]);
  const { partie } = piocherPourEntrainement(p, 'batisseur', creerRng(1));

  assert.equal(partie.champDeBataille.length, 4);
  assert.equal(partie.ressources, p.ressources); // rien n'est encore payé
  assert.equal(partie.marcheDore.find((m) => m.typeId === 'batisseur')?.restant, 4);
});

test('coutEntrainement dit ce qu’il reste à payer une fois la pioche vue', () => {
  const faible = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  const fort = scenario([carte('a', 2), carte('b', 0), carte('c', 0), carte('d', 0)]);

  // Bâtisseur : cible 2.
  assert.equal(coutEntrainement(piocherPourEntrainement(faible, 'batisseur', creerRng(1)).partie, 'batisseur'), 2);
  assert.equal(coutEntrainement(piocherPourEntrainement(fort, 'batisseur', creerRng(1)).partie, 'batisseur'), 0);
});

test('renoncer envoie la main à l’Hôpital et laisse la Doré sur sa pile', () => {
  // Le terrain d'entraînement se vide dans les deux cas, réussite comme échec :
  // seul le sort de la Doré diffère.
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  const { partie: pioche } = piocherPourEntrainement(p, 'batisseur', creerRng(1));
  const partie = renoncerEntrainement(pioche);

  assert.equal(partie.champDeBataille.length, 0);
  assert.equal(partie.hopital.length, 4);
  assert.equal(partie.ressources, p.ressources); // rien payé
  assert.equal(partie.marcheDore.find((m) => m.typeId === 'batisseur')?.restant, 4);
  assert.equal(partie.hopital.some((c) => c.type.id === 'batisseur'), false);
});

// ── Un entraînement par tour ────────────────────────────────────────────────

test('piocher pose le jeton d’entraînement du tour', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  assert.equal(p.entrainementUtilise, false);

  const { partie } = piocherPourEntrainement(p, 'batisseur', creerRng(1));
  assert.equal(partie.entrainementUtilise, true);
  assert.match(obstacleEntrainement(partie, 'soldat') ?? '', /déjà posé/);
});

test('le jeton reste posé après un renoncement — l’entraînement du tour est consommé', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  const partie = renoncerEntrainement(piocherPourEntrainement(p, 'batisseur', creerRng(1)).partie);

  assert.match(obstacleEntrainement(partie, 'batisseur') ?? '', /déjà posé/);
});

test('le jeton se repose au tour suivant, pas à la phase suivante', () => {
  const p = scenario([carte('a', 0), carte('b', 0), carte('c', 0), carte('d', 0)]);
  let partie = piocherPourEntrainement(p, 'batisseur', creerRng(1)).partie;

  partie = avancerPhase(partie); // → L'Ennemi Avance
  assert.equal(partie.entrainementUtilise, true);
  partie = avancerPhase(partie); // → Combat
  assert.equal(partie.entrainementUtilise, true);
  partie = avancerPhase(partie); // → Entraînement, tour suivant
  assert.equal(partie.entrainementUtilise, false);
  assert.equal(partie.tour, p.tour + 1);
});

test('mener l’entraînement à terme envoie la main à l’Hôpital', () => {
  const p = scenario([carte('a', 1), carte('b', 1), carte('c', 0), carte('d', 0)]);
  const { partie: pioche } = piocherPourEntrainement(p, 'batisseur', creerRng(1));
  const { partie } = finaliserEntrainement(pioche, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1));

  assert.equal(partie.champDeBataille.length, 0);
  assert.ok(partie.hopital.some((c) => c.type.id === 'batisseur'));
  assert.equal(partie.hopital.some((c) => c.instanceId === 'a#x'), false); // sacrifiée, pas défaussée
});

// ── Ce qui empêche d'entraîner ──────────────────────────────────────────────

test('obstacleEntrainement : rien à signaler dans le cas normal', () => {
  assert.equal(obstacleEntrainement(scenario([]), 'batisseur'), null);
});

test('obstacleEntrainement : hors de la phase Entraînement', () => {
  const p = { ...scenario([]), phase: /** @type {any} */ ('COMBAT') };
  assert.match(obstacleEntrainement(p, 'batisseur') ?? '', /phase Entraînement/);
});

test('obstacleEntrainement : pile épuisée', () => {
  const p = scenario([]);
  const marcheDore = p.marcheDore.map((m) => (m.typeId === 'batisseur' ? { ...m, restant: 0 } : m));
  assert.match(obstacleEntrainement({ ...p, marcheDore }, 'batisseur') ?? '', /Aucun exemplaire/);
});

test('obstacleEntrainement : 2 épées avant le premier combat gagné', () => {
  assert.match(obstacleEntrainement(scenario([]), 'chevalier') ?? '', /2 épées/);
  assert.equal(obstacleEntrainement({ ...scenario([]), premierCombatGagne: true }, 'chevalier'), null);
});

test('entraîner hors phase est refusé', () => {
  const p = { ...scenario([carte('a', 1), carte('b', 1)]), phase: /** @type {any} */ ('COMBAT') };
  assert.throws(
    () => entrainer(p, { doreId: 'batisseur', sacrifieInstanceId: 'a#x' }, creerRng(1)),
    /phase Entraînement/,
  );
});
