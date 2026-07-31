// Moteur — gestionnaires des effets SPECIAL (texte libre, propre à chaque
// carte), un par `type.id`. Couche PURE, aléa injecté. Appelés depuis
// `executerEffets` (voir son cas 'SPECIAL') via le paramètre
// `carteActiveeTypeId` — jamais directement par les dispatchers.
//
// Le pouvoir Roi/Reine (POUVOIR) n'utilise PAS ce registre : sa cible n'est
// pas une carte cherchée par id, mais `partie.roiReine` directement. Registre
// séparé plus bas, `pouvoirsSpecial`, à sa propre clé (`roiReine.id`) —
// mélanger les deux espaces de noms dans un seul registre serait fragile
// pour un gain nul. Appelé directement par `pouvoir.js` (pas par
// `executerEffets`, qui ne connaît que `gestionnairesSpecial`).

import { paysansBase, dores } from './cartes/index.js';
import { ajouterJetonBonusAllie } from './partie.js';
import { forceCarte } from './force.js';
import { melanger } from './aleatoire.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./partie.js').InstanceAlliee} InstanceAlliee */
/** @typedef {import('./effets.js').Choix} Choix */
/**
 * Machinerie d'`effets.js` injectée aux gestionnaires qui en ont besoin (voir
 * l'en-tête d'`effets.js`) : `detruireEnJeu` pour détruire une carte avec son
 * éventuel TESTAMENT, `executerEffets` pour exécuter une suite d'effets
 * arbitraire.
 * @typedef {object} OutilsSpecial
 * @property {typeof import('./effets.js').detruireEnJeu} detruireEnJeu
 * @property {typeof import('./effets.js').executerEffets} executerEffets
 */

/**
 * Un gestionnaire qui utilise `outils` renvoie le résultat tel quel
 * (`{ partie, reconstitutions }`) plutôt qu'un `Partie` nu, pour que les
 * reconstitutions du Château remontent jusqu'à l'appelant.
 * @typedef {(partie: Partie, choix: Choix | undefined, rng: () => number, carteActiveeId: string | undefined, outils: OutilsSpecial) => Partie | { partie: Partie, reconstitutions: number }} GestionnaireSpecial
 */

/**
 * @typedef {(partie: Partie, choix: Choix | undefined, rng: () => number) => Partie} GestionnairePouvoir
 */

/**
 * Ramène de l'Hôpital vers le Champ de bataille une carte `symbole: 'OBJET'`
 * désignée par `choix.cibles`, sans bonus de force (contrairement au
 * Prêtre). Partagée par Forgeron et Aimant, dont le texte est identique.
 * @type {GestionnaireSpecial}
 */
function ramenerObjetHopital(partie, choix) {
  const [cible, ...reste] = choix?.cibles ?? [];
  if (!cible || reste.length > 0) throw new Error('Une seule cible attendue');

  const carte = partie.hopital.find((c) => c.instanceId === cible);
  if (!carte) throw new Error(`Carte absente de l'Hôpital (${cible})`);
  if (carte.type.symbole !== 'OBJET') throw new Error('La cible doit être un Objet (symbole OBJET)');

  return Object.freeze({
    ...partie,
    hopital: partie.hopital.filter((c) => c.instanceId !== cible),
    champDeBataille: [...partie.champDeBataille, carte],
  });
}

/**
 * Trouve la cible d'un effet REVELATION ennemi visant un Paysan (symbole
 * HUMAIN) du Champ de bataille, en validant son symbole. Un filtre
 * supplémentaire (ex. « le plus fort ») reste à la charge de l'appelant.
 * @param {Partie} partie
 * @param {string} cible
 * @param {string} nomCarte   Pour le message d'erreur.
 * @returns {InstanceAlliee}
 */
function trouverPaysanCible(partie, cible, nomCarte) {
  const carte = partie.champDeBataille.find((c) => c.instanceId === cible);
  if (!carte) throw new Error(`${nomCarte} : carte absente du Champ de bataille (${cible})`);
  if (carte.type.symbole !== 'HUMAIN') throw new Error(`${nomCarte} : la cible doit être un Paysan (symbole HUMAIN)`);
  return carte;
}

/**
 * Trouve la cible d'un effet visant un Objet (symbole OBJET) du Champ de
 * bataille, en validant son symbole. Pendant de `trouverPaysanCible`.
 * @param {Partie} partie
 * @param {string} cible
 * @param {string} nomCarte   Pour le message d'erreur.
 * @returns {InstanceAlliee}
 */
function trouverObjetCible(partie, cible, nomCarte) {
  const carte = partie.champDeBataille.find((c) => c.instanceId === cible);
  if (!carte) throw new Error(`${nomCarte} : carte absente du Champ de bataille (${cible})`);
  if (carte.type.symbole !== 'OBJET') throw new Error(`${nomCarte} : la cible doit être un Objet (symbole OBJET)`);
  return carte;
}

/**
 * Envoie une carte du Champ de bataille vers l'Hôpital. Pas de TESTAMENT :
 * un envoi à l'Hôpital n'en déclenche jamais (comme DEFAUSSER).
 * @param {Partie} partie
 * @param {InstanceAlliee} carte
 * @returns {Partie}
 */
function envoyerHopital(partie, carte) {
  return Object.freeze({
    ...partie,
    champDeBataille: partie.champDeBataille.filter((c) => c.instanceId !== carte.instanceId),
    hopital: [...partie.hopital, carte],
  });
}

/** @type {Record<string, GestionnaireSpecial>} */
export const gestionnairesSpecial = {
  /**
   * Trollolole (REVELATION) : détruit la prochaine carte du Château. Une
   * carte jamais piochée n'a pas de TESTAMENT à déclencher.
   */
  trollolole(partie) {
    return Object.freeze({ ...partie, chateau: partie.chateau.slice(1) });
  },

  /**
   * Nain (PIVOTER) : chaque Objet en jeu gagne un jeton +1 force. Application
   * déterministe à tout le Champ de bataille, pas de cible à désigner.
   */
  nain(partie) {
    const champDeBataille = partie.champDeBataille.map((c) =>
      c.type.symbole === 'OBJET' ? { ...c, jetonBonus: (c.jetonBonus ?? 0) + 1 } : c,
    );
    return Object.freeze({ ...partie, champDeBataille });
  },

  /**
   * Prêtre (GARDE_DU_CORPS) : ramène un Paysan (HUMAIN) de l'Hôpital en jeu
   * avec un jeton +1 force. Cible explicite via `choix.cibles`.
   */
  pretre(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Prêtre : une seule cible attendue');

    const carte = partie.hopital.find((c) => c.instanceId === cible);
    if (!carte) throw new Error(`Prêtre : carte absente de l'Hôpital (${cible})`);
    if (carte.type.symbole !== 'HUMAIN') {
      throw new Error('Prêtre : la cible doit être un Paysan (symbole HUMAIN)');
    }

    return Object.freeze({
      ...partie,
      hopital: partie.hopital.filter((c) => c.instanceId !== cible),
      champDeBataille: [...partie.champDeBataille, { ...carte, jetonBonus: (carte.jetonBonus ?? 0) + 1 }],
    });
  },

  /**
   * Hochet royal (TESTAMENT) : réactive le pouvoir Roi/Reine (remet
   * `pouvoirUtilise` à false). Pas de cible.
   */
  'hochet-royal'(partie) {
    return Object.freeze({ ...partie, pouvoirUtilise: false });
  },

  /**
   * Protecteur mécanique (PIVOTER) : gagne un jeton +1 force pour chaque
   * Objet à l'Hôpital, sur lui-même. Seul gestionnaire de ce lot à cibler la
   * carte activée elle-même (comme FORCE), d'où `carteActiveeId`.
   */
  'protecteur-mecanique'(partie, choix, rng, carteActiveeId) {
    if (!carteActiveeId) throw new Error('Protecteur mécanique : aucune carte activée dans ce contexte');
    const bonus = partie.hopital.filter((c) => c.type.symbole === 'OBJET').length;
    return ajouterJetonBonusAllie(partie, carteActiveeId, bonus);
  },

  forgeron: ramenerObjetHopital,
  aimant: ramenerObjetHopital,

  /**
   * Épée de feu (PIVOTER, récompense héros-gobelin) : double le jeton bonus
   * d'une carte du Champ de bataille désignée par `choix.cibles`.
   */
  'epee-de-feu'(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Épée de feu : une seule cible attendue');
    if (!partie.champDeBataille.some((c) => c.instanceId === cible)) {
      throw new Error(`Épée de feu : carte absente du Champ de bataille (${cible})`);
    }

    const champDeBataille = partie.champDeBataille.map((c) =>
      c.instanceId === cible ? { ...c, jetonBonus: (c.jetonBonus ?? 0) * 2 } : c,
    );
    return Object.freeze({ ...partie, champDeBataille });
  },

  /**
   * Cape royale (PIVOTER, récompense roi-troll) : chaque Paysan (symbole
   * HUMAIN) en jeu gagne un jeton +1 force. Même forme que Nain, sur HUMAIN.
   */
  'cape-royale'(partie) {
    const champDeBataille = partie.champDeBataille.map((c) =>
      c.type.symbole === 'HUMAIN' ? { ...c, jetonBonus: (c.jetonBonus ?? 0) + 1 } : c,
    );
    return Object.freeze({ ...partie, champDeBataille });
  },

  /**
   * Casque à cornes (PIVOTER, récompense commandant-gobelin) : chaque carte
   * Bleu (famille Paysan de base) en jeu gagne un jeton +1 force. « Bleu »
   * n'est pas un `symbole` : aucun champ ne le distingue sur la carte
   * elle-même (contrairement à Doré, qui a `niveau`), donc vérification par
   * appartenance au tableau `paysansBase` des données.
   */
  'casque-a-cornes'(partie) {
    const idsBleu = new Set(paysansBase.map((c) => c.id));
    const champDeBataille = partie.champDeBataille.map((c) =>
      idsBleu.has(c.type.id) ? { ...c, jetonBonus: (c.jetonBonus ?? 0) + 1 } : c,
    );
    return Object.freeze({ ...partie, champDeBataille });
  },

  /**
   * Horde Gobelin (REVELATION) : envoie un Paysan désigné à l'Hôpital.
   */
  'horde-gobelin'(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Horde Gobelin : une seule cible attendue');
    return envoyerHopital(partie, trouverPaysanCible(partie, cible, 'Horde Gobelin'));
  },

  /**
   * Gobelin vachelier (REVELATION) : envoie le Paysan le plus fort du Champ
   * de bataille à l'Hôpital. Comme toute cible d'effet, désignée par
   * `choix.cibles` — le moteur ne choisit jamais à la place du joueur, même
   * quand « le plus fort » a un unique gagnant, l'UI la fournira au clic ;
   * ici en plus validée contre la force réelle (via `forceCarte`, qui inclut
   * le jeton bonus).
   */
  'gobelin-vachelier'(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Gobelin vachelier : une seule cible attendue');
    const carte = trouverPaysanCible(partie, cible, 'Gobelin vachelier');

    const paysans = partie.champDeBataille.filter((c) => c.type.symbole === 'HUMAIN');
    const forceMax = Math.max(...paysans.map((c) => forceCarte(c, partie.champDeBataille)));
    if (forceCarte(carte, partie.champDeBataille) !== forceMax) {
      throw new Error('Gobelin vachelier : la cible doit être le Paysan le plus fort');
    }

    return envoyerHopital(partie, carte);
  },

  /**
   * Sorcière troll (REVELATION) : détruit le Paysan (HUMAIN) désigné du Champ
   * de bataille — comme DETRUIRE_JEU, TESTAMENT éventuel compris, via la
   * fonction injectée `detruireEnJeu` (voir le typedef `GestionnaireSpecial`).
   */
  'sorciere-troll'(partie, choix, rng, carteActiveeId, outils) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Sorcière troll : une seule cible attendue');
    trouverPaysanCible(partie, cible, 'Sorcière troll');
    return outils.detruireEnJeu(partie, cible, choix?.choixTestament ?? [], rng);
  },

  /**
   * Booba Brise-Fer (REVELATION) : détruit l'Objet (OBJET) désigné du Champ
   * de bataille — même mécanisme que Sorcière troll, sur l'autre symbole.
   */
  'booba-brise-fer'(partie, choix, rng, carteActiveeId, outils) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Booba Brise-Fer : une seule cible attendue');
    trouverObjetCible(partie, cible, 'Booba Brise-Fer');
    return outils.detruireEnJeu(partie, cible, choix?.choixTestament ?? [], rng);
  },

  /**
   * Chapeau magique (PIVOTER) : copie l'action Pivoter d'une autre carte du
   * Champ de bataille, y compris une carte déjà pivotée — la cible sert de
   * modèle, elle n'est pas « utilisée » (elle ne rejoint donc pas
   * `cartesActivees`, et ce n'est pas non plus une réactivation, qui est le
   * pouvoir de Bella).
   *
   * Les effets copiés s'exécutent au profit du Chapeau magique : un FORCE
   * copié pose son jeton sur LUI (`carteActiveeId` inchangé), sans quoi
   * copier reviendrait à réactiver la cible. En revanche un SPECIAL copié se
   * résout via le `type.id` de la CIBLE — sinon il rappellerait ce
   * gestionnaire-ci, en boucle.
   */
  'chapeau-magique'(partie, choix, rng, carteActiveeId, outils) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Chapeau magique : une seule cible attendue');
    if (cible === carteActiveeId) throw new Error('Chapeau magique : ne peut pas se copier lui-même');

    const carte = partie.champDeBataille.find((c) => c.instanceId === cible);
    if (!carte) throw new Error(`Chapeau magique : carte absente du Champ de bataille (${cible})`);

    const action = carte.type.actions.find((a) => a.declencheur === 'PIVOTER');
    if (!action) throw new Error('Chapeau magique : la cible n’a pas d’action Pivoter');

    return outils.executerEffets(partie, action.effets, choix?.choixCopie ?? [], rng, carteActiveeId, carte.type.id);
  },
};

/** @type {Record<string, GestionnairePouvoir>} */
export const pouvoirsSpecial = {
  /**
   * Loko : chaque Paysan (symbole HUMAIN) en jeu gagne un jeton +2 force.
   * Même forme que Cape royale/Nain, juste +2 au lieu de +1.
   */
  loko(partie) {
    const champDeBataille = partie.champDeBataille.map((c) =>
      c.type.symbole === 'HUMAIN' ? { ...c, jetonBonus: (c.jetonBonus ?? 0) + 2 } : c,
    );
    return Object.freeze({ ...partie, champDeBataille });
  },

  /**
   * Bella : réactive 2 cartes en jeu, c'est-à-dire retire 2 `instanceId`
   * distincts de `cartesActivees`. Désignées par `choix.cibles`, jamais
   * choisies par le moteur — même si le joueur n'a par exemple activé que 2
   * cartes ce tour-là.
   */
  bella(partie, choix) {
    const cibles = choix?.cibles ?? [];
    if (new Set(cibles).size !== 2) throw new Error('Bella : exactement 2 cibles distinctes attendues');
    for (const id of cibles) {
      if (!partie.cartesActivees.includes(id)) throw new Error(`Bella : carte non activée (${id})`);
    }
    return Object.freeze({
      ...partie,
      cartesActivees: partie.cartesActivees.filter((id) => !cibles.includes(id)),
    });
  },

  /**
   * Margot : mélange l'Hôpital à son Château.
   */
  margot(partie, choix, rng) {
    return Object.freeze({
      ...partie,
      chateau: melanger([...partie.chateau, ...partie.hopital], rng),
      hopital: [],
    });
  },

  /**
   * Yolo : choisit une carte du Château (pas du Champ de bataille ni de
   * l'Hôpital) et la pose en jeu. Désignée par `choix.cibles` (instanceId,
   * sens habituel).
   */
  yolo(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Yolo : une seule cible attendue');
    const carte = partie.chateau.find((c) => c.instanceId === cible);
    if (!carte) throw new Error(`Yolo : carte absente du Château (${cible})`);
    return Object.freeze({
      ...partie,
      chateau: partie.chateau.filter((c) => c.instanceId !== cible),
      champDeBataille: [...partie.champDeBataille, carte],
    });
  },

  /**
   * Brod : obtient un Objet du marché et le pose en jeu (le coût, -3 or, est
   * un effet OR séparé dans son pouvoir, pas géré ici). « Le marché » ne
   * peut désigner que `marcheDore` — seul marché du moteur — et « un Objet »
   * une carte Doré de `symbole: 'OBJET'` (Protecteur mécanique, Catapulte) :
   * les cartes Objet (récompenses d'ennemis vaincus) ne sont vendues nulle
   * part. Obtenue directement, sans le rituel complet d'entraînement
   * (piocher / cible de force / sacrifice) — juste décrémentée du marché.
   * `choix.cibles` désigne ici exceptionnellement un `dore.id` (id de type),
   * pas un `instanceId` : la carte n'existe pas encore en tant qu'instance
   * avant d'être obtenue.
   */
  brod(partie, choix) {
    const [doreId, ...reste] = choix?.cibles ?? [];
    if (!doreId || reste.length > 0) throw new Error('Brod : une seule cible attendue');

    const dore = dores.find((d) => d.id === doreId);
    if (!dore) throw new Error(`Brod : carte Doré inconnue (${doreId})`);
    if (dore.symbole !== 'OBJET') throw new Error('Brod : la cible doit être un Objet (symbole OBJET)');

    const pile = partie.marcheDore.find((m) => m.typeId === doreId);
    if (!pile || pile.restant <= 0) throw new Error(`Brod : aucun exemplaire de ${dore.nom} au marché`);

    const instance = { instanceId: `${dore.id}#brod-t${partie.tour}`, type: dore };
    const marcheDore = partie.marcheDore.map((m) => (m.typeId === doreId ? { ...m, restant: m.restant - 1 } : m));
    return Object.freeze({ ...partie, marcheDore, champDeBataille: [...partie.champDeBataille, instance] });
  },
};
