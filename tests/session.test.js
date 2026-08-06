// Tests de la boucle de jeu : ouvrir une action, la nourrir de réponses, la
// remettre au moteur — et transformer ses refus en messages.

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerRng } from '../public/js/moteur/aleatoire.js';
import { miseEnPlace } from '../public/js/moteur/mise-en-place.js';
import { paysansBase } from '../public/js/moteur/cartes/index.js';
import { bosses } from '../public/js/moteur/cartes/bosses.js';
import {
  nouvelleSession,
  demandeCourante,
  commencerPivoter,
  commencerPouvoir,
  commencerEntrainement,
  repondreDemande,
  annulerAction,
  passerPhase,
  engagerProchainEnnemi,
  resoudreLeCombat,
  engagerLeBoss,
  resoudreLeCombatBoss,
  conclureEntrainement,
  renoncerALEntrainement,
  echangerLeGardeDuCorps,
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

// ── Révélation des ennemis, un par un ───────────────────────────────────────

/**
 * Un ennemi aux Portes, avec son éventuelle action REVELATION.
 * @param {string} id
 * @param {any[]} [effets]
 * @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste}
 */
function auxPortes(id, effets) {
  const type = /** @type {any} */ ({
    id, nom: id, force: 3, niveau: 'UNE_EPEE', cartes: 1,
    actionsEnnemi: effets ? [{ declencheur: 'REVELATION', effets }] : [],
    recompense: { nom: `Butin ${id}`, symbole: 'OBJET', force: 0, actions: [] },
  });
  return { instance: { instanceId: `${id}#e`, type }, revele: false, jetonBonus: 0 };
}

/**
 * Une session en phase Combat, ennemis aux Portes, aucun encore engagé.
 * @param {import('../public/js/moteur/partie.js').EnnemiSurPiste[]} portes
 * @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides]
 */
function sessionPortes(portes, overrides = {}) {
  return session({ phase: /** @type {any} */ ('COMBAT'), portes, ...overrides });
}

test('engager un ennemi sans question pioche ses cartes et lance son action', () => {
  const s = sessionPortes([auxPortes('gob', [{ type: 'OR', valeur: -2 }])]);
  const apres = engagerProchainEnnemi(s, rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.partie.portes[0]?.revele, true);
  assert.equal(apres.partie.ressources, s.partie.ressources - 2);
  assert.equal(apres.partie.champDeBataille.length, 1); // sa carte piochée
});

test('un ennemi dont l’action réclame une cible ouvre une question', () => {
  const paysan = bleu('fermier');
  const s = sessionPortes(
    [auxPortes('horde-de-gobelins', [{ type: 'SPECIAL', texte: 'envoyer un Paysan à l’Hôpital' }])],
    { champDeBataille: [paysan] },
  );

  const ouverte = engagerProchainEnnemi(s, rng());
  assert.equal(ouverte.enCours?.genre, 'REVELATION');
  assert.equal(demandeCourante(ouverte)?.genre, 'CARTES');

  const apres = repondreDemande(ouverte, ['fermier#x'], rng());
  assert.equal(apres.enCours, null);
  assert.ok(apres.partie.hopital.some((c) => c.instanceId === 'fermier#x'));
  assert.equal(apres.partie.portes[0]?.revele, true);
});

test('les ennemis se révèlent de gauche à droite, un par appel', () => {
  const s = sessionPortes([auxPortes('a'), auxPortes('b')]);

  const un = engagerProchainEnnemi(s, rng());
  assert.equal(un.partie.portes[0]?.revele, true);
  assert.equal(un.partie.portes[1]?.revele, false);

  const deux = engagerProchainEnnemi(un, rng());
  assert.equal(deux.partie.portes[1]?.revele, true);
});

test('plus rien à engager donne un message', () => {
  const s = engagerProchainEnnemi(sessionPortes([auxPortes('gob')]), rng());
  assert.match(engagerProchainEnnemi(s, rng()).erreur ?? '', /ont déjà fait piocher/);
});

test('engager hors de la phase Combat est refusé', () => {
  // Un survivant campe aux Portes tout le tour, et son compteur repart à chaque
  // phase : sans ce refus, on l'engagerait depuis l'Entraînement.
  const s = session({ portes: [auxPortes('gob')] }); // phase Entraînement
  assert.match(engagerProchainEnnemi(s, rng()).erreur ?? '', /phase Combat/);
});

test('un ennemi déjà révélé fait piocher ses cartes, sans relancer son action', () => {
  // Le bug d'origine : retourné par une Vision, il était sauté — ses cartes
  // avec. Règle p.11, étape 1 : révéler, PIOCHER, puis lancer l'action ; et
  // p.10, seule l'action est dispensée pour un ennemi déjà révélé.
  const vu = { ...auxPortes('vu', [{ type: 'OR', valeur: -2 }]), revele: true };
  const s = sessionPortes([vu, auxPortes('neuf')]);

  const un = engagerProchainEnnemi(s, rng());
  assert.equal(un.partie.champDeBataille.length, 1); // il a bien pioché
  assert.equal(un.partie.ressources, s.partie.ressources); // mais n'a pas rejoué son action

  const deux = engagerProchainEnnemi(un, rng());
  assert.equal(deux.partie.champDeBataille.length, 2); // les deux ont donné leurs cartes
});

test('le combat n’est résoluble qu’une fois tous les ennemis engagés', () => {
  const vu = { ...auxPortes('vu'), revele: true };
  const s = sessionPortes([vu]);

  // Déjà révélé, mais il n'a pas encore fait piocher : le combat attend.
  assert.match(resoudreLeCombat(s, rng()).erreur ?? '', /Engage d’abord/);
  assert.equal(resoudreLeCombat(engagerProchainEnnemi(s, rng()), rng()).erreur, null);
});

test('« l’ennemi avance » déclenché par une révélation fait glisser la piste', () => {
  const s = sessionPortes([auxPortes('commandant', [{ type: 'ENNEMI_AVANCE' }])], {
    pisteEnnemi: [null, null, null],
  });
  const apres = engagerProchainEnnemi(s, rng());

  assert.equal(apres.partie.pisteEnnemi.filter(Boolean).length, 1);
  assert.equal(apres.partie.portes[0]?.revele, true);
});

// ── Résolution du combat ────────────────────────────────────────────────────

/** @param {string} id @param {number} force @returns {import('../public/js/moteur/partie.js').EnnemiSurPiste} */
function revele(id, force) {
  const type = /** @type {any} */ ({
    id, nom: id, force, niveau: 'UNE_EPEE', cartes: 1, actionsEnnemi: [],
    recompense: { nom: `Butin ${id}`, symbole: 'OBJET', force: 0, actions: [] },
  });
  return { instance: { instanceId: `${id}#e`, type }, revele: true, jetonBonus: 0 };
}

/**
 * Une session en phase Combat dont les ennemis ont tous fait piocher : l'état
 * où la résolution est possible. C'est `ennemisPioches` qui l'autorise, pas
 * `revele` — un ennemi retourné d'avance doit encore donner ses cartes.
 * @param {import('../public/js/moteur/partie.js').EnnemiSurPiste[]} portes
 * @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides]
 */
function sessionCombat(portes, overrides = {}) {
  return session({
    phase: /** @type {any} */ ('COMBAT'),
    portes,
    ennemisPioches: portes.map((e) => e.instance.instanceId),
    ...overrides,
  });
}

test('victoire : le combat se résout seul, sans question', () => {
  const s = sessionCombat([revele('gob', 2)], {
    champDeBataille: [bleu('gentilhomme')], // force 2
  });
  const apres = resoudreLeCombat(s, rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.partie.portes.length, 0);
  assert.equal(apres.partie.premierCombatGagne, true);
  assert.ok(apres.partie.hopital.some((c) => c.type.nom === 'Butin gob')); // la récompense
});

test('défaite : la question de la répartition s’ouvre, la partie intacte', () => {
  const s = sessionCombat([revele('faible', 2), revele('costaud', 9)], {
    champDeBataille: [bleu('gentilhomme')], // force 2
  });
  const apres = resoudreLeCombat(s, rng());

  assert.equal(apres.enCours?.genre, 'COMBAT');
  assert.equal(demandeCourante(apres)?.libre, true);
  assert.equal(demandeCourante(apres)?.options.length, 2);
  assert.equal(apres.partie, s.partie); // rien n'a encore bougé
});

test('défaite : abattre un ennemi qu’on égale, l’autre survit avec un jeton', () => {
  const s = sessionCombat([revele('faible', 2), revele('costaud', 9)], {
    champDeBataille: [bleu('gentilhomme')],
  });
  const apres = repondreDemande(resoudreLeCombat(s, rng()), ['0'], rng());

  assert.equal(apres.partie.ressources, s.partie.ressources - 9); // 11 - 2
  assert.equal(apres.partie.portes.length, 1);
  assert.equal(apres.partie.portes[0]?.instance.instanceId, 'costaud#e');
  assert.equal(apres.partie.portes[0]?.jetonBonus, 1); // survivant 1 épée
  assert.ok(apres.partie.hopital.some((c) => c.type.nom === 'Butin faible'));
});

test('défaite : n’abattre personne est un choix valable', () => {
  const s = sessionCombat([revele('costaud', 9)], { champDeBataille: [] });
  const apres = repondreDemande(resoudreLeCombat(s, rng()), [], rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.partie.portes.length, 1);
  assert.equal(apres.partie.portes[0]?.jetonBonus, 1);
});

test('défaite : viser plus que sa Force est refusé, la question reste ouverte', () => {
  const s = sessionCombat([revele('a', 3), revele('b', 3)], {
    champDeBataille: [bleu('gentilhomme')], // force 2, insuffisante pour l'un ou l'autre
  });
  const apres = repondreDemande(resoudreLeCombat(s, rng()), ['0'], rng());

  assert.match(apres.erreur ?? '', /Force insuffisante/);
  assert.equal(apres.enCours?.genre, 'COMBAT'); // on peut se corriger
});

test('combattre est refusé tant qu’un ennemi n’a pas fait piocher', () => {
  const s = session({ phase: /** @type {any} */ ('COMBAT'), portes: [auxPortes('gob')] });
  assert.match(resoudreLeCombat(s, rng()).erreur ?? '', /Engage d’abord/);
});

test('combattre sans ennemi aux Portes n’a pas de sens', () => {
  const s = session({ phase: /** @type {any} */ ('COMBAT'), portes: [] });
  assert.match(resoudreLeCombat(s, rng()).erreur ?? '', /pas de combat/);
});

// ── Entraînement en deux temps ──────────────────────────────────────────────

/**
 * Une session en phase Entraînement dont le Château ne contient que les cartes
 * données : la pioche de l'entraînement ramène exactement celles-là.
 * @param {import('../public/js/moteur/partie.js').InstanceAlliee[]} chateau
 */
function sessionEntrainement(chateau) {
  return session({ phase: /** @type {any} */ ('ENTRAINEMENT'), chateau });
}

test('engager un entraînement pioche sans rien demander encore', () => {
  // Archer : piocher 3, cible 2, échanger un Paysan.
  const s = sessionEntrainement([bleu('fermier'), bleu('gentilhomme'), bleu('vieux')]);
  const apres = commencerEntrainement(s, 'archer', rng());

  assert.equal(apres.enCours, null);
  assert.equal(demandeCourante(apres), null); // la question du sacrifice attend
  assert.equal(apres.entrainementEngage, 'archer');
  assert.equal(apres.partie.champDeBataille.length, 3);
  assert.equal(apres.partie.entrainementUtilise, true);
});

test('on peut activer une carte pendant un entraînement engagé', () => {
  // Le bug d'origine : activer l'Enfant écrasait la question du sacrifice, et
  // l'entraînement du tour était perdu avec elle. Les règles (p.9, étape 3)
  // demandent au contraire de pouvoir jouer ses cartes à ce moment.
  const s = sessionEntrainement([bleu('boulanger'), bleu('fermier'), bleu('gentilhomme')]);
  const engage = commencerEntrainement(s, 'archer', rng());
  const apres = commencerPivoter(engage, 'boulanger#x', rng()); // Boulanger : +1 or

  assert.equal(apres.erreur, null);
  assert.equal(apres.entrainementEngage, 'archer'); // toujours là
  assert.equal(apres.partie.ressources, engage.partie.ressources + 1);
  assert.ok(apres.partie.cartesActivees.includes('boulanger#x'));
});

test('conclure demande le sacrifice, avec les cartes du moment', () => {
  const s = sessionEntrainement([bleu('fermier'), bleu('gentilhomme'), bleu('epee')]);
  const apres = conclureEntrainement(commencerEntrainement(s, 'archer', rng()));

  assert.equal(apres.enCours?.genre, 'ENTRAINEMENT');
  const demande = demandeCourante(apres);
  // L'Archer s'échange contre un Paysan : l'Épée, un Objet, n'est pas proposée.
  assert.deepEqual(demande?.options.map((o) => o.valeur), ['fermier#x', 'gentilhomme#x']);
});

test('répondre au sacrifice conclut l’entraînement', () => {
  const s = sessionEntrainement([bleu('fermier'), bleu('gentilhomme'), bleu('vieux')]);
  const ouverte = conclureEntrainement(commencerEntrainement(s, 'archer', rng()));
  const apres = repondreDemande(ouverte, ['vieux#x'], rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.entrainementEngage, null);
  assert.equal(apres.partie.champDeBataille.length, 0);
  assert.ok(apres.partie.hopital.some((c) => c.type.id === 'archer'));
  assert.equal(apres.partie.hopital.some((c) => c.instanceId === 'vieux#x'), false); // détruit
});

test('annuler la question du sacrifice ne renonce pas à l’entraînement', () => {
  const s = sessionEntrainement([bleu('fermier'), bleu('gentilhomme'), bleu('vieux')]);
  const ouverte = conclureEntrainement(commencerEntrainement(s, 'archer', rng()));
  const apres = annulerAction(ouverte);

  assert.equal(apres.enCours, null);
  assert.equal(apres.entrainementEngage, 'archer'); // on peut encore jouer, puis reposer la question
  assert.equal(apres.partie.champDeBataille.length, 3);
  assert.equal(conclureEntrainement(apres).enCours?.genre, 'ENTRAINEMENT');
});

test('renoncer rend la main tirée à l’Hôpital et libère l’entraînement', () => {
  const s = sessionEntrainement([bleu('fermier'), bleu('gentilhomme'), bleu('vieux')]);
  const apres = renoncerALEntrainement(commencerEntrainement(s, 'archer', rng()));

  assert.equal(apres.entrainementEngage, null);
  assert.equal(apres.partie.champDeBataille.length, 0);
  assert.equal(apres.partie.hopital.length, 3);
  assert.equal(apres.partie.entrainementUtilise, true); // le jeton reste posé pour le tour
});

test('conclure ou renoncer sans entraînement engagé donne un message', () => {
  const s = sessionEntrainement([]);
  assert.match(conclureEntrainement(s).erreur ?? '', /Aucun entraînement/);
  assert.match(renoncerALEntrainement(s).erreur ?? '', /Aucun entraînement/);
});

// ── Rien ne s'ouvre par-dessus une question ─────────────────────────────────

test('activer une carte pendant qu’une question est posée est refusé', () => {
  const s = session({ champDeBataille: [bleu('alchimiste'), bleu('boulanger')] });
  const ouverte = commencerPivoter(s, 'alchimiste#x', rng());
  const apres = commencerPivoter(ouverte, 'boulanger#x', rng());

  assert.match(apres.erreur ?? '', /action en cours/);
  assert.equal(apres.enCours?.libelle, 'Alchimiste'); // la question d'origine tient
});

test('le pouvoir et l’entraînement se refusent aussi pendant une question', () => {
  const s = sessionEntrainement([bleu('fermier'), bleu('gentilhomme'), bleu('vieux')]);
  const ouverte = conclureEntrainement(commencerEntrainement(s, 'archer', rng()));

  assert.match(commencerPouvoir(ouverte, rng()).erreur ?? '', /action en cours/);
  assert.match(commencerEntrainement(ouverte, 'soldat', rng()).erreur ?? '', /action en cours/);
  assert.match(echangerLeGardeDuCorps(ouverte, 'fermier#x', rng()).erreur ?? '', /action en cours/);
});

// ── Échange du Garde du corps ───────────────────────────────────────────────

test('une carte en jeu prend la place du Garde du corps, qui redescend', () => {
  const s = session({ champDeBataille: [bleu('fermier')] });
  const ancien = s.partie.gardeDuCorps;
  const apres = echangerLeGardeDuCorps(s, 'fermier#x', rng());

  assert.equal(apres.erreur, null);
  assert.equal(apres.partie.gardeDuCorps?.instanceId, 'fermier#x');
  assert.equal(apres.partie.champDeBataille[0]?.instanceId, ancien?.instanceId);
  assert.equal(apres.partie.gardeDuCorpsEchange, true);
});

test('l’action GARDE_DU_CORPS de la carte s’exécute, questions comprises', () => {
  // Oracle : « quand cette carte devient Garde du corps, générer 1 vision ».
  const s = session({
    champDeBataille: [bleu('oracle')],
    pisteEnnemi: [auxPortes('gob'), null, null],
  });
  const ouverte = echangerLeGardeDuCorps(s, 'oracle#x', rng());

  assert.equal(ouverte.enCours?.genre, 'GARDE_DU_CORPS');
  assert.equal(demandeCourante(ouverte)?.genre, 'CASES_PISTE');

  const apres = repondreDemande(ouverte, ['0'], rng());
  assert.equal(apres.partie.gardeDuCorps?.instanceId, 'oracle#x');
  assert.equal(apres.partie.pisteEnnemi[0]?.revele, true);
});

test('un second échange dans la même phase est refusé', () => {
  const s = session({ champDeBataille: [bleu('fermier'), bleu('gentilhomme')] });
  const apres = echangerLeGardeDuCorps(echangerLeGardeDuCorps(s, 'fermier#x', rng()), 'gentilhomme#x', rng());

  assert.match(apres.erreur ?? '', /déjà été échangé/);
});

test('échanger contre une carte déjà activée est refusé', () => {
  const s = session({ champDeBataille: [bleu('boulanger')] });
  const activee = commencerPivoter(s, 'boulanger#x', rng());
  const apres = echangerLeGardeDuCorps(activee, 'boulanger#x', rng());

  assert.match(apres.erreur ?? '', /déjà activée/);
});

test('échanger contre une carte absente du Champ de bataille donne un message', () => {
  assert.match(echangerLeGardeDuCorps(session(), 'fantome#x', rng()).erreur ?? '', /absente/);
});

// ── Combat des Boss ─────────────────────────────────────────────────────────

/**
 * Un vrai Boss du jeu : c'est sa Force, son nombre de cartes et son action
 * réels qu'on éprouve, comme les Bleu de `bleu()`.
 * @param {string} id
 * @returns {import('../public/js/moteur/partie.js').InstanceBoss}
 */
function bossReel(id) {
  const type = bosses.find((b) => b.id === id);
  if (!type) throw new Error(`Boss inconnu : ${id}`);
  return { instanceId: `${id}#b`, type };
}

/**
 * Une session en mode « combat des Boss ». Le Château est vide par défaut : la
 * pioche du Boss ne ramène alors rien, et la Force en jeu reste exactement
 * celle qu'on lui donne.
 * @param {string} bossId
 * @param {Partial<import('../public/js/moteur/partie.js').Partie>} [overrides]
 */
function sessionBoss(bossId, overrides = {}) {
  return session({
    phase: /** @type {any} */ ('COMBAT_BOSS'),
    boss: [bossReel(bossId)],
    chateau: [],
    ...overrides,
  });
}

test('affronter un Boss pioche ses cartes et lance son action', () => {
  // Troll géant : 5 cartes à piocher, action « -1 or ». Le Château n'en a que 2.
  const s = sessionBoss('troll-geant', { chateau: [bleu('fermier'), bleu('vieux')] });
  const apres = engagerLeBoss(s, rng());

  assert.equal(apres.enCours, null);
  assert.equal(apres.tentativeBoss, true);
  assert.equal(apres.partie.champDeBataille.length, 2);
  assert.equal(apres.partie.ressources, s.partie.ressources - 1);
});

test('un Boss dont l’action cible ouvre une question, et la tentative reste ouverte', () => {
  // Dragon serpent : « envoie ton Paysan le plus fort à l'Hôpital ».
  const s = sessionBoss('dragon-serpent', { champDeBataille: [bleu('fermier')] });
  const ouverte = engagerLeBoss(s, rng());

  assert.equal(ouverte.enCours?.genre, 'REVELATION_BOSS');
  assert.equal(ouverte.enCours?.libelle, 'Dragon serpent');
  assert.equal(demandeCourante(ouverte)?.genre, 'CARTES');

  const apres = repondreDemande(ouverte, ['fermier#x'], rng());
  assert.equal(apres.enCours, null);
  assert.ok(apres.partie.hopital.some((c) => c.instanceId === 'fermier#x'));
  assert.equal(apres.tentativeBoss, true); // il reste à comparer les Forces
});

test('affronter un Boss hors du combat des Boss est refusé', () => {
  assert.match(engagerLeBoss(session(), rng()).erreur ?? '', /n’a pas commencé/);
});

test('le Boss ne se pioche qu’une fois par tentative', () => {
  const engagee = engagerLeBoss(sessionBoss('troll-geant'), rng());
  const apres = engagerLeBoss(engagee, rng());

  assert.match(apres.erreur ?? '', /déjà engagé/);
  assert.equal(apres.partie, engagee.partie); // aucune seconde pioche
});

test('résoudre sans avoir affronté le Boss est refusé', () => {
  assert.match(resoudreLeCombatBoss(sessionBoss('reine-troll')).erreur ?? '', /Affronte d’abord/);
});

test('victoire : le Boss quitte la file et la tentative se referme', () => {
  // Reine troll : Force 12, et son PASSIF n'ignore que les Objets.
  const s = sessionBoss('reine-troll', {
    champDeBataille: [{ ...bleu('gentilhomme'), jetonBonus: 10 }], // 2 + 10 = 12
  });
  const apres = resoudreLeCombatBoss(engagerLeBoss(s, rng()));

  assert.equal(apres.tentativeBoss, false);
  assert.equal(apres.partie.boss.length, 0);
  assert.equal(apres.partie.ressources, s.partie.ressources); // un Boss ne rapporte rien
  assert.equal(apres.partie.champDeBataille.length, 0);
});

test('défaite : on paie la différence, le Boss reste à affronter', () => {
  const s = sessionBoss('reine-troll', { champDeBataille: [bleu('gentilhomme')] }); // force 2
  const apres = resoudreLeCombatBoss(engagerLeBoss(s, rng()));

  assert.equal(apres.tentativeBoss, false); // on peut retenter
  assert.equal(apres.partie.boss.length, 1);
  assert.equal(apres.partie.ressources, s.partie.ressources - 10); // 12 - 2
  assert.equal(apres.partie.champDeBataille.length, 0); // pioche neuve au prochain essai
});

test('les Boss s’affrontent l’un après l’autre, jusqu’à la victoire', () => {
  const s = sessionBoss('reine-troll', {
    boss: [bossReel('reine-troll'), bossReel('troll-geant')], // Force 12 puis 22
    champDeBataille: [{ ...bleu('gentilhomme'), jetonBonus: 20 }], // 2 + 20 = 22
  });

  const premier = resoudreLeCombatBoss(engagerLeBoss(s, rng()));
  assert.equal(premier.partie.boss.length, 1);

  // Deuxième tentative : le Château étant vide, la pioche se reconstitue depuis
  // l'Hôpital — ce qui coûte 2 ressources en mode Boss — et ramène la carte.
  const second = resoudreLeCombatBoss(engagerLeBoss(premier, rng()));

  assert.equal(second.partie.boss.length, 0);
  assert.equal(second.partie.ressources, s.partie.ressources - 3); // 2 de Château vide, 1 d'action
  assert.match(passerPhase(second).erreur ?? '', /gagnée/);
});

// ── Plus rien ne se joue une fois la partie finie ───────────────────────────

test('partie perdue : toutes les actions sont refusées', () => {
  const s = nouvelleSession({ ...session().partie, ressources: 0 });

  assert.match(passerPhase(s).erreur ?? '', /perdue/);
  assert.match(commencerPouvoir(s, rng()).erreur ?? '', /perdue/);
  assert.match(commencerEntrainement(s, 'batisseur', rng()).erreur ?? '', /perdue/);
  assert.match(engagerProchainEnnemi(s, rng()).erreur ?? '', /perdue/);
  assert.equal(passerPhase(s).partie.phase, s.partie.phase); // rien n'a bougé
});

test('partie gagnée : les actions sont refusées aussi', () => {
  const s = nouvelleSession({ ...session().partie, boss: [] });
  assert.match(passerPhase(s).erreur ?? '', /gagnée/);
});
