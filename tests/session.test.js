// Tests de la boucle de jeu : ouvrir une action, la nourrir de réponses, la
// remettre au moteur — et transformer ses refus en messages.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { paysansBase } from '../public/js/moteur/cartes/index.js';
import {
  nouvelleSession,
  demandeCourante,
  commencerPivoter,
  commencerPouvoir,
  repondreDemande,
  annulerAction,
  passerPhase,
} from '../public/js/ui/session.js';

const rng = () => creerRng(1);

/**
 * Instancie une vraie carte Bleu, pour éprouver la boucle sur les données du
 * jeu plutôt que sur des doublures.
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceAlliee}
 */
function bleu(id) {
  const type = paysansBase.find((c) => c.id === id);
  if (!type) throw new Error(`Carte Bleu inconnue : ${id}`);
  return { instanceId: `${id}#x`, type };
}

/** @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides] */
function session(overrides = {}) {
  const base = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));
  return nouvelleSession({ ...base, champDeBataille: [], hopital: [], ...overrides });
}

// ── Actions sans choix : exécutées d'emblée ─────────────────────────────────

test('une action sans choix part au moteur sans rien demander', () => {
  // Boulanger : « Pivoter : +1 or ».
  const s = session({ champDeBataille: [bleu('boulanger')] });
  const apres = commencerPivoter(s, 'boulanger#x', rng());

  assert.equal(apres.enCours, null);
  assert.equal(demandeCourante(apres), null);
  assert.equal(apres.partie.ressources, s.partie.ressources + 1);
  assert.ok(apres.partie.cartesActivees.includes('boulanger#x'));
});

// ── Actions à choix : la session attend ─────────────────────────────────────

test('une action à choix ouvre une demande et laisse la partie intacte', () => {
  // Alchimiste : « défausser une autre carte, puis piocher 1 ».
  const s = session({ champDeBataille: [bleu('alchimiste'), bleu('fermier')] });
  const apres = commencerPivoter(s, 'alchimiste#x', rng());

  assert.equal(apres.enCours?.genre, 'PIVOTER');
  assert.equal(apres.enCours?.libelle, 'Alchimiste');
  assert.equal(demandeCourante(apres)?.genre, 'CARTES');
  assert.equal(apres.partie, s.partie); // rien n'a encore bougé
});

test('répondre à la dernière demande exécute l’action', () => {
  const s = session({ champDeBataille: [bleu('alchimiste'), bleu('fermier')] });
  const ouverte = commencerPivoter(s, 'alchimiste#x', rng());
  const apres = repondreDemande(ouverte, ['fermier#x'], rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.erreur, null);
  assert.ok(apres.partie.hopital.some((c) => c.instanceId === 'fermier#x'));
  assert.ok(apres.partie.cartesActivees.includes('alchimiste#x'));
});

test('annuler rend la main sans avoir touché à la partie', () => {
  const s = session({ champDeBataille: [bleu('alchimiste'), bleu('fermier')] });
  const apres = annulerAction(commencerPivoter(s, 'alchimiste#x', rng()));

  assert.equal(apres.enCours, null);
  assert.equal(apres.partie, s.partie);
});

// ── Refus : des messages, pas des exceptions ────────────────────────────────

test('activer une carte absente donne un message', () => {
  const apres = commencerPivoter(session(), 'fantome#x', rng());
  assert.match(apres.erreur ?? '', /absente/);
});

test('activer une carte déjà activée donne un message', () => {
  const s = session({ champDeBataille: [bleu('boulanger')], cartesActivees: ['boulanger#x'] });
  assert.match(commencerPivoter(s, 'boulanger#x', rng()).erreur ?? '', /déjà activée/);
});

test('activer une carte sans action Pivoter donne un message', () => {
  const s = session({ champDeBataille: [bleu('mendiant')] }); // Mendiant : aucune action
  assert.match(commencerPivoter(s, 'mendiant#x', rng()).erreur ?? '', /pas d’action Pivoter/);
});

test('un refus du moteur devient un message, la partie restant intacte', () => {
  const s = session({ champDeBataille: [bleu('alchimiste'), bleu('fermier')] });
  const ouverte = commencerPivoter(s, 'alchimiste#x', rng());

  // DEFAUSSER n'attend qu'une cible : deux, et le moteur refuse.
  const apres = repondreDemande(ouverte, ['fermier#x', 'alchimiste#x'], rng());

  assert.match(apres.erreur ?? '', /nombre de cibles/);
  assert.equal(apres.enCours, null);
  assert.equal(apres.partie, s.partie);
});

test('répondre sans action ouverte donne un message', () => {
  assert.match(repondreDemande(session(), ['x'], rng()).erreur ?? '', /Aucune action/);
});

// ── Pouvoir Roi/Reine ───────────────────────────────────────────────────────

test('le pouvoir de Margot, qui ne demande rien, s’exécute d’emblée', () => {
  const s = session({ hopital: [bleu('fermier')] });
  const apres = commencerPouvoir(s, rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.partie.pouvoirUtilise, true);
  assert.equal(apres.partie.hopital.length, 0); // mélangé au Château
});

test('un pouvoir déjà utilisé est refusé par un message', () => {
  const s = nouvelleSession({ ...session().partie, pouvoirUtilise: true });
  assert.match(commencerPouvoir(s, rng()).erreur ?? '', /déjà été utilisé/);
});

// ── Phases ──────────────────────────────────────────────────────────────────

test('passer la phase suit le cycle habituel', () => {
  assert.equal(passerPhase(session()).partie.phase, 'ENNEMI_AVANCE');
});

test('depuis L’Ennemi Avance, une piste vide bascule vers le combat des Boss', () => {
  const s = session({
    phase: /** @type {any} */ ('ENNEMI_AVANCE'),
    pileEnnemi: [],
    pisteEnnemi: [null, null, null],
  });
  assert.equal(passerPhase(s).partie.phase, 'COMBAT_BOSS');
});

test('on ne sort pas du combat des Boss', () => {
  const s = session({ phase: /** @type {any} */ ('COMBAT_BOSS') });
  assert.match(passerPhase(s).erreur ?? '', /aucune autre phase/);
});

test('passer la phase est refusé tant qu’une action est ouverte', () => {
  const s = session({ champDeBataille: [bleu('alchimiste'), bleu('fermier')] });
  const ouverte = commencerPivoter(s, 'alchimiste#x', rng());

  const apres = passerPhase(ouverte);
  assert.match(apres.erreur ?? '', /action en cours/);
  assert.equal(apres.partie.phase, s.partie.phase);
});

// ── Immuabilité ─────────────────────────────────────────────────────────────

test('aucune fonction n’altère la session reçue', () => {
  const s = session({ champDeBataille: [bleu('boulanger')] });
  commencerPivoter(s, 'boulanger#x', rng());
  passerPhase(s);

  assert.equal(s.enCours, null);
  assert.equal(s.erreur, null);
  assert.equal(s.partie.phase, 'ENTRAINEMENT');
  assert.deepEqual(s.partie.cartesActivees, []);
});
