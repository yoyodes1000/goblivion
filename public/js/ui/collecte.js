// Interface — collecte auprès du joueur les choix qu'une suite d'effets réclame,
// pour les remettre à `executerEffets` sous la forme qu'il attend. Couche PURE :
// aucune référence au DOM, testable sous Node (voir tests/collecte.test.js).
//
// POURQUOI UNE MACHINE À ÉTATS, ET NON UN FORMULAIRE
// Les demandes ne sont pas connues d'avance. Le TESTAMENT à résoudre dépend de
// la carte que le joueur vient de désigner ; les sous-choix d'un CHOIX dépendent
// de la branche qu'il vient de prendre ; le Chapeau magique copie l'action d'une
// cible pas encore choisie. Il faut donc demander, encaisser, puis recalculer.
//
// COMMENT — PAR REJEU
// L'état ne retient qu'une liste plate de réponses, dans l'ordre où elles ont
// été demandées. Chaque appel reparcourt l'arbre des effets depuis le début en
// consommant cette liste ; au premier besoin sans réponse, il rend la demande
// correspondante. Aucune continuation à sauvegarder, aucune position à tenir à
// jour : les fonctions restent pures et idempotentes, et rejouer un parcours de
// trois effets ne coûte rien.
//
// CE QUE CETTE COUCHE NE FAIT PAS
// Valider. Les candidats proposés sont une aide à la saisie ; le gardien reste
// le gestionnaire du moteur, qui lève une erreur explicite. Une liste trop large
// ne casse donc rien.
//
// Comme `vue.js`, elle ne laisse pas fuiter l'information cachée : un ennemi non
// révélé proposé au clic ne livre pas son identité.

import { forceCarte } from '../moteur/force.js';
import { besoinsSpecial } from '../moteur/special.js';

/** @typedef {import('../moteur/partie.js').Partie} Partie */
/** @typedef {import('../moteur/partie.js').InstanceAlliee} InstanceAlliee */
/** @typedef {import('../moteur/cartes/types.js').Effet} Effet */
/** @typedef {import('../moteur/effets.js').Choix} Choix */
/** @typedef {import('../moteur/special.js').BesoinSpecial} BesoinSpecial */

/**
 * Un candidat proposé au joueur. `valeur` est ce qui repartira vers le moteur :
 * un `instanceId`, ou un index rendu en texte (case de piste, branche).
 * @typedef {object} Option
 * @property {string} valeur
 * @property {string} libelle
 */

/**
 * Ce que l'interface doit demander maintenant.
 * @typedef {object} Demande
 * @property {'CARTES' | 'CASES_PISTE' | 'BRANCHE'} genre
 * @property {string} libelle
 * @property {number} nombre    Combien de `valeur` la réponse doit porter.
 * @property {Option[]} options
 */

/**
 * De quelle carte les effets proviennent. `typeId` sert de clé aux registres
 * SPECIAL, `carteActiveeId` identifie la carte activée (cible de FORCE, et
 * référence du filtre « autre que soi » du Chapeau magique).
 * @typedef {object} Contexte
 * @property {string | undefined} [typeId]
 * @property {string | undefined} [carteActiveeId]
 */

/**
 * @typedef {object} EtatCollecte
 * @property {Partie} partie
 * @property {readonly Effet[]} effets
 * @property {Contexte} contexte
 * @property {readonly (readonly string[])[]} reponses   Réponses données, dans l'ordre des demandes.
 */

/**
 * Curseur de rejeu, interne au parcours. Dès que `demande` est renseignée, le
 * parcours s'arrête : tout ce qui suit dépendrait d'une réponse absente.
 * @typedef {object} Lecteur
 * @property {readonly (readonly string[])[]} reponses
 * @property {number} index
 * @property {Demande | null} demande
 */

/**
 * Libellés lisibles des effets, pour résumer les branches d'un CHOIX. Les types
 * absents retombent sur leur nom brut : aucune branche connue n'en contient.
 * @type {Record<string, string>}
 */
const LIBELLE_EFFET = {
  PIOCHER: 'piocher',
  OR: 'or',
  FORCE: 'force',
  VISION: 'vision',
  DEFAUSSER: 'défausser',
  DETRUIRE_JEU: 'détruire en jeu',
  DETRUIRE_HOPITAL: 'détruire à l’Hôpital',
};

/**
 * Lit la prochaine réponse, ou enregistre la demande et interrompt le parcours.
 * @param {Lecteur} lecteur
 * @param {Demande} demande
 * @returns {readonly string[] | undefined}
 */
function lire(lecteur, demande) {
  const reponse = lecteur.reponses[lecteur.index];
  if (reponse === undefined) {
    lecteur.demande = demande;
    return undefined;
  }
  lecteur.index += 1;
  return reponse;
}

/**
 * @param {InstanceAlliee} carte
 * @returns {Option}
 */
function optionCarte(carte) {
  return { valeur: carte.instanceId, libelle: carte.type.nom };
}

/**
 * Restreint les candidats d'une zone selon le symbole et les filtres déclarés.
 * @param {readonly InstanceAlliee[]} cartes
 * @param {Partie} partie
 * @param {BesoinSpecial} besoin
 * @param {Contexte} contexte
 * @returns {InstanceAlliee[]}
 */
function filtrerCartes(cartes, partie, besoin, contexte) {
  let restants = besoin.symbole ? cartes.filter((c) => c.type.symbole === besoin.symbole) : [...cartes];

  for (const filtre of besoin.filtres ?? []) {
    if (filtre === 'LE_PLUS_FORT') {
      const force = (/** @type {InstanceAlliee} */ c) => forceCarte(c, partie.champDeBataille);
      const maximum = Math.max(...restants.map(force));
      restants = restants.filter((c) => force(c) === maximum);
    } else if (filtre === 'FORCE_MINIMUM_1') {
      restants = restants.filter((c) => forceCarte(c, partie.champDeBataille) >= 1);
    } else if (filtre === 'AVEC_PIVOTER') {
      restants = restants.filter((c) => c.type.actions.some((a) => a.declencheur === 'PIVOTER'));
    } else if (filtre === 'AUTRE_QUE_SOI') {
      restants = restants.filter((c) => c.instanceId !== contexte.carteActiveeId);
    }
    // AVEC_JETON ne concerne que les ennemis : voir `optionsEnnemis`.
  }

  return restants;
}

/**
 * Les ennemis désignables, aux Portes comme sur la piste. Un ennemi non révélé
 * reste cliquable — le jeton posé sur lui est visible — mais ne livre pas son
 * identité, comme dans `vue.js`.
 * @param {Partie} partie
 * @param {BesoinSpecial} besoin
 * @returns {Option[]}
 */
function optionsEnnemis(partie, besoin) {
  const avecJeton = (besoin.filtres ?? []).includes('AVEC_JETON');

  // `flatMap` plutôt que `filter` + `map` : il écarte les cases vides ET fait
  // disparaître le `null` du type, sans prédicat de garde à écrire.
  return [...partie.portes, ...partie.pisteEnnemi].flatMap((e) => {
    if (!e || (avecJeton && e.jetonBonus === 0)) return [];
    return [{
      valeur: e.instance.instanceId,
      libelle: e.revele
        ? `${e.instance.type.nom} (jeton +${e.jetonBonus})`
        : `Carte face cachée (jeton +${e.jetonBonus})`,
    }];
  });
}

/**
 * Les candidats correspondant à un besoin SPECIAL.
 * @param {Partie} partie
 * @param {BesoinSpecial} besoin
 * @param {Contexte} contexte
 * @returns {Option[]}
 */
function optionsPourBesoin(partie, besoin, contexte) {
  if (besoin.source === 'ENNEMIS') return optionsEnnemis(partie, besoin);

  const zone = besoin.source === 'HOPITAL' ? partie.hopital : partie.champDeBataille;
  return filtrerCartes(zone, partie, besoin, contexte).map(optionCarte);
}

/**
 * @param {string} libelle
 * @param {number} nombre
 * @param {Option[]} options
 * @returns {Demande}
 */
function demandeCartes(libelle, nombre, options) {
  return { genre: 'CARTES', libelle, nombre, options };
}

/**
 * Résumé lisible d'une branche de CHOIX, pour l'afficher au joueur.
 * @param {readonly Effet[]} effets
 * @returns {string}
 */
function resumerBranche(effets) {
  return effets
    .map((e) => {
      const nom = LIBELLE_EFFET[e.type] ?? e.type;
      return e.valeur === undefined ? nom : `${nom} ${e.valeur}`;
    })
    .join(', ');
}

/**
 * Les choix de l'action TESTAMENT de la carte détruite, s'il y en a une. Le
 * TESTAMENT s'exécute au nom de la carte détruite : c'est son `type.id` qui
 * devient la clé des registres, et plus aucune carte n'est « activée ».
 * @param {Partie} partie
 * @param {readonly InstanceAlliee[]} zone
 * @param {string | undefined} instanceId
 * @param {Lecteur} lecteur
 * @returns {(Choix | undefined)[]}
 */
function choixDuTestament(partie, zone, instanceId, lecteur) {
  const carte = zone.find((c) => c.instanceId === instanceId);
  const action = carte?.type.actions.find((a) => a.declencheur === 'TESTAMENT');
  if (!carte || !action) return [];

  return choixDesEffets(partie, action.effets, { typeId: carte.type.id }, lecteur);
}

/**
 * Les choix de l'action Pivoter copiée par le Chapeau magique. Un SPECIAL copié
 * se résout via le `type.id` de la CIBLE, mais la carte activée reste le Chapeau
 * — c'est exactement ce que fait le gestionnaire (voir `special.js`).
 * @param {Partie} partie
 * @param {string | undefined} instanceId
 * @param {Contexte} contexte
 * @param {Lecteur} lecteur
 * @returns {(Choix | undefined)[]}
 */
function choixDeLaCopie(partie, instanceId, contexte, lecteur) {
  const carte = partie.champDeBataille.find((c) => c.instanceId === instanceId);
  const action = carte?.type.actions.find((a) => a.declencheur === 'PIVOTER');
  if (!carte || !action) return [];

  return choixDesEffets(
    partie,
    action.effets,
    { typeId: carte.type.id, carteActiveeId: contexte.carteActiveeId },
    lecteur,
  );
}

/**
 * Les choix d'un effet SPECIAL, d'après le besoin déclaré par son gestionnaire.
 * @param {Partie} partie
 * @param {Contexte} contexte
 * @param {Lecteur} lecteur
 * @returns {Choix | undefined}
 */
function choixDuSpecial(partie, contexte, lecteur) {
  const besoin = contexte.typeId ? besoinsSpecial[contexte.typeId] : undefined;
  if (!besoin) return undefined; // la plupart des gestionnaires ne demandent rien

  const cibles = lire(lecteur, {
    genre: 'CARTES',
    libelle: besoin.libelle,
    nombre: besoin.nombre,
    options: optionsPourBesoin(partie, besoin, contexte),
  });
  if (!cibles) return undefined;

  if (besoin.suite === 'TESTAMENT') {
    return { cibles, choixTestament: choixDuTestament(partie, partie.champDeBataille, cibles[0], lecteur) };
  }
  if (besoin.suite === 'COPIE') {
    return { cibles, choixCopie: choixDeLaCopie(partie, cibles[0], contexte, lecteur) };
  }
  return { cibles };
}

/**
 * Les choix d'un effet. Rend `undefined` pour ceux qui n'en réclament aucun
 * (PIOCHER, OR, FORCE, JETON_ENNEMI, ENNEMI_AVANCE).
 * @param {Partie} partie
 * @param {Effet} effet
 * @param {Contexte} contexte
 * @param {Lecteur} lecteur
 * @returns {Choix | undefined}
 */
function choixDeLEffet(partie, effet, contexte, lecteur) {
  switch (effet.type) {
    case 'DEFAUSSER': {
      const options = partie.champDeBataille.map(optionCarte);
      const cibles = lire(lecteur, demandeCartes('Choisis les cartes à défausser', effet.valeur ?? 1, options));
      return cibles ? { cibles } : undefined;
    }

    case 'DETRUIRE_JEU': {
      const options = partie.champDeBataille.map(optionCarte);
      const cibles = lire(lecteur, demandeCartes('Choisis la carte en jeu à détruire', 1, options));
      if (!cibles) return undefined;
      return { cibles, choixTestament: choixDuTestament(partie, partie.champDeBataille, cibles[0], lecteur) };
    }

    case 'DETRUIRE_HOPITAL': {
      const options = partie.hopital.map(optionCarte);
      const cibles = lire(lecteur, demandeCartes('Choisis la carte à détruire à l’Hôpital', 1, options));
      if (!cibles) return undefined;
      return { cibles, choixTestament: choixDuTestament(partie, partie.hopital, cibles[0], lecteur) };
    }

    case 'VISION': {
      // Seules les cases occupées et encore cachées valent d'être révélées.
      const options = partie.pisteEnnemi.flatMap((e, i) =>
        e && !e.revele ? [{ valeur: String(i), libelle: `Case ${i + 1}` }] : [],
      );
      const reponse = lire(lecteur, {
        genre: 'CASES_PISTE',
        libelle: 'Choisis les cases de piste à révéler',
        nombre: effet.valeur ?? 1,
        options,
      });
      return reponse ? { indexPiste: reponse.map(Number) } : undefined;
    }

    case 'CHOIX': {
      const branches = effet.options ?? [];
      const reponse = lire(lecteur, {
        genre: 'BRANCHE',
        libelle: 'Choisis une option',
        nombre: 1,
        options: branches.map((b, i) => ({ valeur: String(i), libelle: resumerBranche(b) })),
      });
      if (!reponse) return undefined;

      const branche = Number(reponse[0]);
      return { branche, choixBranche: choixDesEffets(partie, branches[branche] ?? [], contexte, lecteur) };
    }

    case 'SPECIAL':
      return choixDuSpecial(partie, contexte, lecteur);

    default:
      return undefined;
  }
}

/**
 * Parcourt une suite d'effets, dans l'ordre. S'interrompt dès qu'une demande
 * est en attente : la suite dépendrait d'une réponse qu'on n'a pas.
 * @param {Partie} partie
 * @param {readonly Effet[]} effets
 * @param {Contexte} contexte
 * @param {Lecteur} lecteur
 * @returns {(Choix | undefined)[]}
 */
function choixDesEffets(partie, effets, contexte, lecteur) {
  /** @type {(Choix | undefined)[]} */
  const choix = [];

  for (const effet of effets) {
    if (lecteur.demande) break;
    choix.push(choixDeLEffet(partie, effet, contexte, lecteur));
  }

  return choix;
}

/**
 * Rejoue le parcours depuis le début avec les réponses connues.
 * @param {EtatCollecte} etat
 * @returns {{ choix: (Choix | undefined)[], demande: Demande | null }}
 */
function rejouer(etat) {
  /** @type {Lecteur} */
  const lecteur = { reponses: etat.reponses, index: 0, demande: null };
  const choix = choixDesEffets(etat.partie, etat.effets, etat.contexte, lecteur);
  return { choix, demande: lecteur.demande };
}

/**
 * Ouvre une collecte pour une suite d'effets.
 * @param {Partie} partie
 * @param {readonly Effet[]} effets
 * @param {Contexte} [contexte]
 * @returns {EtatCollecte}
 */
export function demarrerCollecte(partie, effets, contexte = {}) {
  return Object.freeze({ partie, effets, contexte, reponses: [] });
}

/**
 * Ce qu'il reste à demander, ou `null` si la collecte est complète.
 * @param {EtatCollecte} etat
 * @returns {Demande | null}
 */
export function prochaineDemande(etat) {
  return rejouer(etat).demande;
}

/**
 * Enregistre une réponse à la demande en cours. Ne valide pas le nombre de
 * valeurs : c'est `executerEffets` qui refusera, avec son message.
 * @param {EtatCollecte} etat
 * @param {readonly string[]} valeurs
 * @returns {EtatCollecte}
 */
export function repondre(etat, valeurs) {
  return Object.freeze({ ...etat, reponses: [...etat.reponses, valeurs] });
}

/**
 * Les choix assemblés, prêts pour `executerEffets`. Refuse tant qu'une demande
 * reste en attente — rendre un tableau incomplet ferait échouer le moteur avec
 * un message bien moins parlant.
 * @param {EtatCollecte} etat
 * @returns {(Choix | undefined)[]}
 */
export function choixFinal(etat) {
  const { choix, demande } = rejouer(etat);
  if (demande) throw new Error(`Collecte incomplète : ${demande.libelle}`);
  return choix;
}
