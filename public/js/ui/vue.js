// Interface — traduit un état de partie en modèle d'affichage. Couche PURE :
// aucune référence au DOM, testable sous Node (voir tests/vue.test.js). Le
// rendu proprement dit vit dans `rendu.js`.
//
// RÔLE CRITIQUE — cette fonction est la frontière de l'information cachée.
// Le Château, la pile Ennemi, la réserve et la file des Boss sont faces
// cachées ; un ennemi sur la piste l'est aussi tant qu'il n'est pas révélé.
// Rien de tout cela ne sort d'ici autrement qu'en NOMBRE : ni nom, ni force,
// ni identifiant. Laisser filer ces données jusqu'au DOM reviendrait à jouer
// cartes sur table — il suffirait ensuite d'une règle CSS mal placée, ou d'un
// coup d'œil à l'inspecteur, pour tricher sans le vouloir.

import { forceCarte, forceTotale } from '../moteur/force.js';
import { forceEnnemi, forceEnnemisPortes, slugifier } from '../moteur/combat.js';
import { modificateursDeForce } from '../moteur/combat-boss.js';
import { obstacleEntrainement } from '../moteur/entrainement.js';
import { issuePartie } from '../moteur/orchestration.js';
import { paysansBase, dores, ennemis } from '../moteur/cartes/index.js';

/** @typedef {import('../moteur/partie.js').Partie} Partie */
/** @typedef {import('../moteur/partie.js').InstanceAlliee} InstanceAlliee */
/** @typedef {import('../moteur/partie.js').EnnemiSurPiste} EnnemiSurPiste */
/** @typedef {import('../moteur/cartes/types.js').CarteAlliee} CarteAlliee */

/** Libellés lisibles des phases. */
const LIBELLE_PHASE = {
  ENTRAINEMENT: 'Entraînement',
  ENNEMI_AVANCE: "L'Ennemi Avance",
  COMBAT: 'Combat',
  COMBAT_BOSS: 'Combat des Boss',
};

/** Libellés lisibles des symboles — le symbole ne doit jamais tenir à la seule couleur. */
const LIBELLE_SYMBOLE = { HUMAIN: 'Paysan', OBJET: 'Objet' };

/** Cartes qui ont leur propre scan, recto entier. */
const CARTES_ENTIERES = new Set([...paysansBase, ...dores].map((c) => c.id));

/**
 * Récompense → ennemi dont elle occupe la moitié basse. Une carte Ennemi/Objet
 * est un seul carton : l'ennemi en haut, l'objet en bas à 180°. L'image d'un
 * Objet gagné est donc celle de l'ennemi qui le portait.
 *
 * Les récompenses qui existent AUSSI comme carte à part entière en sont
 * exclues — le Soldat est une Dorée avant d'être la récompense du Gobelin
 * trappeur, et c'est son propre scan qu'il faut montrer.
 */
const ENNEMI_PAR_RECOMPENSE = new Map(
  ennemis
    .filter((e) => e.recompense)
    .map((e) => /** @type {[string, string]} */ ([slugifier(e.recompense.nom), e.id]))
    .filter(([id]) => !CARTES_ENTIERES.has(id)),
);

/** Dos générique des cartes Ennemi, seul visage d'un ennemi non révélé. */
const DOS_ENNEMI = 'dos-ennemi';

/**
 * L'image d'une carte : quel fichier charger, et quelle moitié en montrer.
 * `moitie` vaut `null` pour un scan de carte entière ; `HAUT` et `BAS`
 * découpent une carte Ennemi/Objet, dont la moitié basse est imprimée à 180°.
 * @typedef {object} ImageVue
 * @property {string} fichier   Nom de base, sans dossier ni extension.
 * @property {'HAUT' | 'BAS' | null} moitie
 */

/**
 * Une carte alliée visible.
 * @typedef {object} CarteVue
 * @property {string} instanceId
 * @property {string} nom
 * @property {string} symbole        Libellé lisible ('Paysan' / 'Objet').
 * @property {number | null} force   Force au combat ; `null` si variable et hors Champ de bataille.
 * @property {boolean} forceVariable Force sans valeur imprimée (Soldat, Joker).
 * @property {number} jetonBonus
 * @property {boolean} activee       Déjà « pivotée » cette phase.
 * @property {boolean} activable     Son action Pivoter est jouable maintenant.
 * @property {string[]} actions      Textes des actions de la carte.
 * @property {ImageVue} image        Le scan à afficher, si le joueur en a fourni un.
 */

/**
 * Un emplacement de la piste ennemie, ou un ennemi aux Portes. Un ennemi non
 * révélé ne livre que son jeton bonus : le jeton est un pion posé SUR la
 * carte, visible même face cachée.
 * @typedef {object} EnnemiVue
 * @property {boolean} revele
 * @property {number} jetonBonus
 * @property {ImageVue} image        Le dos tant qu'il n'est pas révélé.
 * @property {string} [nom]          Absent tant que l'ennemi n'est pas révélé.
 * @property {number} [force]        Idem — force imprimée plus jeton.
 * @property {string} [niveau]       Idem.
 */

/**
 * Une zone dont le contenu est visible (Champ de bataille, Hôpital).
 * @typedef {object} ZoneVue
 * @property {string} nom
 * @property {CarteVue[]} cartes
 */

/**
 * Une zone face cachée : son nombre de cartes, et rien d'autre.
 * @typedef {object} ZoneCacheeVue
 * @property {string} nom
 * @property {number} nombre
 */

/**
 * @typedef {object} PileMarcheVue
 * @property {string} typeId
 * @property {string} nom
 * @property {number} restant
 * @property {number | null} force
 * @property {boolean} forceVariable
 * @property {string} niveau
 * @property {boolean} entrainable   Peut être entraînée maintenant.
 */

/**
 * Le modèle complet d'affichage d'un état de partie.
 * @typedef {object} VuePartie
 * @property {'VICTOIRE' | 'DEFAITE' | null} issue   Non nulle, la partie est finie.
 * @property {string} roiReine
 * @property {ImageVue} imageRoiReine
 * @property {number} tour
 * @property {string} phase
 * @property {number} ressources
 * @property {boolean} pouvoirDisponible
 * @property {number} forceAlliee    Force totale au Champ de bataille, modificateurs compris.
 * @property {number} forceEnnemie   Force totale aux Portes.
 * @property {ZoneVue} champDeBataille
 * @property {ZoneVue} hopital
 * @property {CarteVue | null} gardeDuCorps
 * @property {ZoneCacheeVue} chateau
 * @property {ZoneCacheeVue} pileEnnemi
 * @property {(EnnemiVue | null)[]} pisteEnnemi
 * @property {EnnemiVue[]} portes
 * @property {number} ennemisARevele   Combien restent à révéler aux Portes.
 * @property {boolean} combatResoluble Tous révélés, le combat peut se conclure.
 * @property {number} bossRestants
 * @property {PileMarcheVue[]} marche
 */

/**
 * Force affichable d'une carte alliée. Sur le Champ de bataille, c'est la
 * force réelle du combat (barème du Soldat, jeton bonus et modificateurs du
 * moment compris) — celle que le moteur calculera. Ailleurs, il n'y a pas de
 * contexte de combat : on s'en tient à la force imprimée, et une force
 * variable n'a tout simplement pas de valeur.
 * @param {InstanceAlliee} carte
 * @param {Partie} partie
 * @param {boolean} enJeu
 * @returns {number | null}
 */
function forceAffichable(carte, partie, enJeu) {
  if (enJeu) return forceCarte(carte, partie.champDeBataille, modificateursDeForce(partie));
  return typeof carte.type.force === 'number' ? carte.type.force : null;
}

/**
 * L'image d'une carte alliée : son propre scan, ou la moitié basse de
 * l'ennemi qui la portait s'il s'agit d'un Objet gagné au combat.
 * @param {InstanceAlliee} carte
 * @returns {ImageVue}
 */
function imageDeCarte(carte) {
  const ennemi = ENNEMI_PAR_RECOMPENSE.get(carte.type.id);
  return ennemi ? { fichier: ennemi, moitie: 'BAS' } : { fichier: carte.type.id, moitie: null };
}

/**
 * Traduit une carte alliée visible.
 * @param {InstanceAlliee} carte
 * @param {Partie} partie
 * @param {boolean} enJeu   La carte est-elle sur le Champ de bataille ?
 * @returns {CarteVue}
 */
function carteVue(carte, partie, enJeu) {
  const activee = partie.cartesActivees.includes(carte.instanceId);
  const aPivoter = carte.type.actions.some((a) => a.declencheur === 'PIVOTER');
  const enCours = issuePartie(partie) === null;

  return {
    instanceId: carte.instanceId,
    nom: carte.type.nom,
    symbole: LIBELLE_SYMBOLE[carte.type.symbole] ?? carte.type.symbole,
    force: forceAffichable(carte, partie, enJeu),
    forceVariable: carte.type.force === 'VARIABLE',
    jetonBonus: carte.jetonBonus ?? 0,
    activee,
    // Seules les cartes EN JEU se pivotent : à l'Hôpital ou en Garde du corps,
    // une action Pivoter existe sur le carton mais n'est pas jouable. Et plus
    // rien ne l'est une fois la partie finie.
    activable: enCours && enJeu && aPivoter && !activee,
    // `texte` est optionnel dans les données : une action sans libellé est
    // omise, plutôt que d'afficher un trou à l'écran.
    actions: carte.type.actions.flatMap((a) => (a.texte ? [a.texte] : [])),
    image: imageDeCarte(carte),
  };
}

/**
 * Traduit un ennemi. Non révélé, il ne livre que son jeton bonus — voir
 * `EnnemiVue` et l'en-tête de ce fichier.
 * @param {EnnemiSurPiste} ennemi
 * @returns {EnnemiVue}
 */
function ennemiVue(ennemi) {
  // Face cachée, il n'a qu'un dos : son scan reste hors de portée du rendu,
  // qui ne pourrait donc pas le montrer même par erreur.
  if (!ennemi.revele) {
    return { revele: false, jetonBonus: ennemi.jetonBonus, image: { fichier: DOS_ENNEMI, moitie: null } };
  }

  return {
    revele: true,
    jetonBonus: ennemi.jetonBonus,
    image: { fichier: ennemi.instance.type.id, moitie: 'HAUT' },
    nom: ennemi.instance.type.nom,
    force: forceEnnemi(ennemi),
    niveau: ennemi.instance.type.niveau === 'UNE_EPEE' ? '1 épée' : '2 épées',
  };
}

/**
 * Traduit une pile du marché Doré. Le nom et la force viennent des données de
 * la carte, le reste de l'état de la partie.
 *
 * `entrainable` interroge le moteur (`obstacleEntrainement`) plutôt que de
 * recopier ses conditions — phase, stock, niveau débloqué : la vue grise
 * exactement ce que l'entraînement refuserait.
 * @param {import('../moteur/partie.js').PileDore} pile
 * @param {Partie} partie
 * @returns {PileMarcheVue}
 */
function pileMarcheVue(pile, partie) {
  const dore = dores.find((d) => d.id === pile.typeId);
  if (!dore) throw new Error(`Carte Doré inconnue au marché : ${pile.typeId}`);

  return {
    typeId: pile.typeId,
    nom: dore.nom,
    restant: pile.restant,
    force: typeof dore.force === 'number' ? dore.force : null,
    forceVariable: dore.force === 'VARIABLE',
    niveau: dore.niveau === 'UNE_EPEE' ? '1 épée' : '2 épées',
    entrainable: issuePartie(partie) === null && obstacleEntrainement(partie, pile.typeId) === null,
  };
}

/**
 * Construit le modèle d'affichage d'un état de partie.
 * @param {Partie} partie
 * @returns {VuePartie}
 */
export function construireVue(partie) {
  return {
    issue: issuePartie(partie),
    roiReine: partie.roiReine.nom,
    imageRoiReine: { fichier: partie.roiReine.id, moitie: null },
    tour: partie.tour,
    phase: LIBELLE_PHASE[partie.phase] ?? partie.phase,
    ressources: partie.ressources,
    pouvoirDisponible: !partie.pouvoirUtilise,

    forceAlliee: forceTotale(partie.champDeBataille, modificateursDeForce(partie)),
    forceEnnemie: forceEnnemisPortes(partie),

    champDeBataille: {
      nom: 'Champ de bataille',
      cartes: partie.champDeBataille.map((c) => carteVue(c, partie, true)),
    },
    hopital: {
      nom: 'Hôpital',
      cartes: partie.hopital.map((c) => carteVue(c, partie, false)),
    },
    gardeDuCorps: partie.gardeDuCorps ? carteVue(partie.gardeDuCorps, partie, false) : null,

    // Faces cachées : un nombre, rien de plus.
    chateau: { nom: 'Château', nombre: partie.chateau.length },
    pileEnnemi: { nom: 'Pile Ennemi', nombre: partie.pileEnnemi.length },

    pisteEnnemi: partie.pisteEnnemi.map((e) => (e ? ennemiVue(e) : null)),
    portes: partie.portes.map(ennemiVue),
    ennemisARevele: partie.portes.filter((e) => !e.revele).length,
    combatResoluble: partie.phase === 'COMBAT' && partie.portes.length > 0
      && partie.portes.every((e) => e.revele),

    // Les Boss sont faces cachées jusqu'à être affrontés : leur nombre suffit.
    bossRestants: partie.boss.length,

    marche: partie.marcheDore.map((pile) => pileMarcheVue(pile, partie)),
  };
}
