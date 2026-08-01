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
//
// Troisième registre, `passifsBoss` : un PASSIF n'est jamais « exécuté », donc
// n'a pas de gestionnaire — c'est de la donnée déclarative, lue au moment du
// combat par `combat-boss.js`.

import { paysansBase, dores } from './cartes/index.js';
import {
  ajouterJetonBonusAllie,
  retirerJetonBonusEnnemi,
  substituerType,
  rendreTypeImprime,
} from './partie.js';
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
    hopital: [...partie.hopital, rendreTypeImprime(carte)],
  });
}

/**
 * Détruit la prochaine carte du Château. Une carte jamais piochée n'a pas de
 * TESTAMENT à déclencher. Partagée par Trollolole et le Boss Dragon bleu,
 * dont le texte est identique.
 * @type {GestionnaireSpecial}
 */
function detruireProchaineCarteChateau(partie) {
  return Object.freeze({ ...partie, chateau: partie.chateau.slice(1) });
}

/**
 * Envoie à l'Hôpital le Paysan (HUMAIN) le plus fort du Champ de bataille.
 * Partagée par Gobelin vachelier et le Boss Dragon serpent, dont le texte est
 * identique (FAQ p.18).
 *
 * Comme toute cible d'effet, désignée par `choix.cibles` — le moteur ne
 * choisit jamais à la place du joueur, l'UI la fournira au clic ; d'autant
 * qu'en cas d'égalité de force, c'est explicitement au joueur de trancher
 * (FAQ p.18). La cible est ici en plus validée contre la force réelle (via
 * `forceCarte`, qui inclut le jeton bonus).
 * @param {string} nomCarte   Pour les messages d'erreur.
 * @returns {GestionnaireSpecial}
 */
function envoyerPaysanLePlusFortHopital(nomCarte) {
  return (partie, choix) => {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error(`${nomCarte} : une seule cible attendue`);
    const carte = trouverPaysanCible(partie, cible, nomCarte);

    const paysans = partie.champDeBataille.filter((c) => c.type.symbole === 'HUMAIN');
    const forceMax = Math.max(...paysans.map((c) => forceCarte(c, partie.champDeBataille)));
    if (forceCarte(carte, partie.champDeBataille) !== forceMax) {
      throw new Error(`${nomCarte} : la cible doit être le Paysan le plus fort`);
    }

    return envoyerHopital(partie, carte);
  };
}

/** @type {Record<string, GestionnaireSpecial>} */
export const gestionnairesSpecial = {
  trollolole: detruireProchaineCarteChateau,
  'dragon-bleu': detruireProchaineCarteChateau,

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

  /**
   * Héros du village (PIVOTER) : devient un Soldat le temps de son séjour en
   * jeu. Il prend le type Soldat *en entier* — donc son barème de force
   * variable, sa présence au décompte des Soldats et ses capacités —, ce qui
   * fait disparaître sa force imprimée de 2. Elle lui revient quand il rentre
   * à l'Hôpital (voir `substituerType`).
   *
   * Rien à ajouter dans `force.js` : la carte EST un Soldat, le barème existant
   * la reconnaît comme telle.
   */
  'heros-du-village'(partie, choix, rng, carteActiveeId) {
    if (!carteActiveeId) throw new Error('Héros du village : aucune carte activée dans ce contexte');

    const soldat = dores.find((d) => d.id === 'soldat');
    if (!soldat) throw new Error('Héros du village : type Soldat introuvable');

    return substituerType(partie, carteActiveeId, soldat);
  },

  /**
   * Chevalier (ENTRAINEMENT) : l'entraîner rapporte en plus une carte Épée
   * (Bleu, symbole OBJET), ajoutée directement à l'Hôpital — sans avoir à
   * sacrifier de Paysan pour elle (FAQ p.18).
   *
   * L'Épée est CRÉÉE, pas prélevée : le moteur ne modélise aucune réserve de
   * cartes Bleu (la mise en place en tire 20 sur 40 et ignore le reste), donc
   * pas de plafond aux 3 exemplaires du jeu physique. Dette assumée.
   */
  chevalier(partie) {
    const epee = paysansBase.find((c) => c.id === 'epee');
    if (!epee) throw new Error('Chevalier : carte Épée introuvable');

    const instance = { instanceId: `epee#chevalier-t${partie.tour}`, type: epee };
    return Object.freeze({ ...partie, hopital: [...partie.hopital, instance] });
  },

  /**
   * Champion (PIVOTER) : détruit le jeton bonus de force d'un ennemi désigné
   * par `choix.cibles` — qui contient ici l'instanceId d'une instance ENNEMI,
   * pas d'une carte alliée.
   */
  champion(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Champion : une seule cible attendue');
    return retirerJetonBonusEnnemi(partie, cible);
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
   * Gobelin pestilant (REVELATION) : annule les jetons bonus des cartes du
   * Champ de bataille pour le calcul de force de ce combat (`jetonsIgnores`,
   * remis à false par `avancerPhase`). Les jetons ne sont pas retirés des
   * cartes : ils redeviennent effectifs au combat suivant. Le Garde du corps
   * n'est pas concerné — il ne compte déjà pas dans la force du combat.
   */
  'gobelin-pestilant'(partie) {
    return Object.freeze({ ...partie, jetonsIgnores: true });
  },

  /**
   * Bébé troll (REVELATION) : ajoute un Boss à affronter, pris sur le dessus
   * de la réserve des Boss non tirés à la mise en place (`pileBoss`, déjà
   * mélangée). Ajouté en fin de file : les Boss déjà prévus gardent leur
   * ordre, celui-ci s'affronte en dernier.
   *
   * Réserve vide : l'état est inchangé plutôt qu'une erreur. Contrairement à
   * une cible mal désignée (bug d'interface), c'est ici une conséquence
   * possible de l'état du jeu, subie par le joueur sans qu'il ait rien
   * choisi — la révélation ne doit pas planter pour autant. En pratique
   * inatteignable : 11 Boss pour 5 tirés au maximum, et Bébé troll n'existe
   * qu'en un exemplaire.
   */
  'bebe-troll'(partie) {
    const [ajoute, ...reste] = partie.pileBoss;
    if (!ajoute) return partie;
    return Object.freeze({ ...partie, boss: [...partie.boss, ajoute], pileBoss: reste });
  },

  /**
   * Troll saboteur (REVELATION) : aucun gain d'or pour ce combat
   * (`orBloque`, remis à false par `avancerPhase`). Les actions qui
   * rapportent de l'or restent jouables — la carte est bien activée et ses
   * autres effets s'appliquent — mais leur gain est perdu. Les pertes d'or
   * continuent de s'appliquer normalement.
   */
  'troll-saboteur'(partie) {
    return Object.freeze({ ...partie, orBloque: true });
  },

  /**
   * Horde Gobelin (REVELATION) : envoie un Paysan désigné à l'Hôpital.
   */
  'horde-gobelin'(partie, choix) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Horde Gobelin : une seule cible attendue');
    return envoyerHopital(partie, trouverPaysanCible(partie, cible, 'Horde Gobelin'));
  },

  'gobelin-vachelier': envoyerPaysanLePlusFortHopital('Gobelin vachelier'),
  'dragon-serpent': envoyerPaysanLePlusFortHopital('Dragon serpent'),

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
   * Démon (REVELATION, Boss) : détruit une carte de force 1 ou plus du Champ
   * de bataille — même mécanisme que Sorcière troll et Booba Brise-Fer, mais
   * filtré sur la force plutôt que sur le symbole : toute carte assez forte
   * fait l'affaire, Paysan comme Objet.
   *
   * La force est celle du combat en cours, jeton bonus compris. Elle est en
   * revanche évaluée SANS les modificateurs du Boss : le Démon n'en a aucun,
   * et le calcul de force d'un autre Boss n'a pas cours pendant le sien.
   */
  demon(partie, choix, rng, carteActiveeId, outils) {
    const [cible, ...reste] = choix?.cibles ?? [];
    if (!cible || reste.length > 0) throw new Error('Démon : une seule cible attendue');

    const carte = partie.champDeBataille.find((c) => c.instanceId === cible);
    if (!carte) throw new Error(`Démon : carte absente du Champ de bataille (${cible})`);
    if (forceCarte(carte, partie.champDeBataille) < 1) {
      throw new Error('Démon : la cible doit avoir une force de 1 ou plus');
    }

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

/**
 * Joker (PASSIF) : à son arrivée en jeu, il prend toutes les caractéristiques
 * d'un Paysan en jeu, Bleu ou Doré — force ET capacités. Il redevient Joker en
 * rentrant à l'Hôpital (voir `substituerType`).
 *
 * Hors du registre ci-dessus, et c'est délibéré : un PASSIF ne s'exécute pas,
 * et « l'arrivée en jeu » n'a aucun point de passage unique dans le moteur (on
 * arrive par la pioche, par Prêtre/Forgeron/Aimant, par Yolo, par Brod).
 * Instrumenter les cinq pour un seul cas coûterait plus que ça ne rapporte :
 * l'appelant déclenche donc la copie au bon moment — d'autant que le Paysan
 * copié est de toute façon un choix du joueur.
 *
 * « Bleu ou Doré » écarte les cartes gagnées sur les ennemis, dont le Joker
 * lui-même : comme pour Casque à cornes, l'appartenance à ces familles se lit
 * dans les données, aucun champ de la carte ne la porte. Recopier est donc
 * impossible sans garde supplémentaire — après substitution, le `type.id` du
 * Joker n'est plus `joker`.
 * @param {Partie} partie
 * @param {string} jokerInstanceId
 * @param {string} cibleInstanceId   Le Paysan en jeu dont il prend la place.
 * @returns {Partie}
 */
export function copierAvecJoker(partie, jokerInstanceId, cibleInstanceId) {
  const joker = partie.champDeBataille.find((c) => c.instanceId === jokerInstanceId);
  if (!joker) throw new Error(`Joker : carte absente du Champ de bataille (${jokerInstanceId})`);
  if (joker.type.id !== 'joker') throw new Error('Joker : cette carte n’est pas un Joker');

  const cible = partie.champDeBataille.find((c) => c.instanceId === cibleInstanceId);
  if (!cible) throw new Error(`Joker : cible absente du Champ de bataille (${cibleInstanceId})`);
  if (cible.type.symbole !== 'HUMAIN') {
    throw new Error('Joker : la cible doit être un Paysan (symbole HUMAIN)');
  }

  const familles = new Set([...paysansBase, ...dores].map((c) => c.id));
  if (!familles.has(cible.type.id)) {
    throw new Error('Joker : la cible doit être une carte Bleu ou Doré');
  }

  return substituerType(partie, jokerInstanceId, cible.type);
}

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

/**
 * Ce qu'un gestionnaire SPECIAL réclame comme choix, décrit pour l'interface.
 *
 * DESCRIPTIF, jamais normatif : il sert à savoir QUOI demander et quoi
 * proposer au clic. La validation, elle, reste dans le gestionnaire, qui lève
 * déjà une erreur explicite. Il n'y a donc pas deux sources de vérité mais deux
 * rôles — un guide de saisie ici, un gardien là-bas. Un besoin trop large ne
 * casse rien : le gestionnaire refusera.
 *
 * Vit dans ce fichier, collé aux gestionnaires qu'il décrit : séparés, les deux
 * divergeraient sans que personne ne le voie.
 * @typedef {object} BesoinSpecial
 * @property {'CHAMP' | 'HOPITAL' | 'ENNEMIS'} source   Où puiser les candidats.
 * @property {number} nombre                            Combien en désigner.
 * @property {string} libelle                           Ce qu'on demande au joueur.
 * @property {'HUMAIN' | 'OBJET'} [symbole]             Restriction de symbole.
 * @property {readonly Filtre[]} [filtres]
 * @property {'TESTAMENT' | 'COPIE'} [suite]            Choix imbriqué consommé ensuite.
 */

/**
 * Restrictions supplémentaires sur les candidats, au-delà de la zone et du
 * symbole. Des étiquettes plutôt que des prédicats : elles traversent la
 * frontière moteur/interface sans y transporter de logique.
 * @typedef {'LE_PLUS_FORT' | 'FORCE_MINIMUM_1' | 'AVEC_PIVOTER' | 'AUTRE_QUE_SOI' | 'AVEC_JETON'} Filtre
 */

/**
 * Les besoins en choix, par `type.id`. Un gestionnaire absent n'en réclame
 * aucun — c'est le cas le plus fréquent (Nain, Trollolole, Bébé troll…).
 * @type {Record<string, BesoinSpecial>}
 */
export const besoinsSpecial = {
  pretre: {
    source: 'HOPITAL', nombre: 1, symbole: 'HUMAIN',
    libelle: 'Choisis le Paysan à ramener de l’Hôpital, avec un jeton +1',
  },
  forgeron: {
    source: 'HOPITAL', nombre: 1, symbole: 'OBJET',
    libelle: 'Choisis l’Objet à ramener de l’Hôpital',
  },
  aimant: {
    source: 'HOPITAL', nombre: 1, symbole: 'OBJET',
    libelle: 'Choisis l’Objet à ramener de l’Hôpital',
  },
  champion: {
    source: 'ENNEMIS', nombre: 1, filtres: ['AVEC_JETON'],
    libelle: 'Choisis l’ennemi dont détruire le jeton bonus',
  },
  'epee-de-feu': {
    source: 'CHAMP', nombre: 1,
    libelle: 'Choisis la carte dont doubler le jeton bonus',
  },
  'horde-gobelin': {
    source: 'CHAMP', nombre: 1, symbole: 'HUMAIN',
    libelle: 'Choisis le Paysan envoyé à l’Hôpital',
  },
  'gobelin-vachelier': {
    source: 'CHAMP', nombre: 1, symbole: 'HUMAIN', filtres: ['LE_PLUS_FORT'],
    libelle: 'Envoie ton Paysan le plus fort à l’Hôpital (à toi de trancher en cas d’égalité)',
  },
  'dragon-serpent': {
    source: 'CHAMP', nombre: 1, symbole: 'HUMAIN', filtres: ['LE_PLUS_FORT'],
    libelle: 'Envoie ton Paysan le plus fort à l’Hôpital (à toi de trancher en cas d’égalité)',
  },
  'sorciere-troll': {
    source: 'CHAMP', nombre: 1, symbole: 'HUMAIN', suite: 'TESTAMENT',
    libelle: 'Choisis le Paysan à détruire',
  },
  'booba-brise-fer': {
    source: 'CHAMP', nombre: 1, symbole: 'OBJET', suite: 'TESTAMENT',
    libelle: 'Choisis l’Objet à détruire',
  },
  demon: {
    source: 'CHAMP', nombre: 1, filtres: ['FORCE_MINIMUM_1'], suite: 'TESTAMENT',
    libelle: 'Choisis une carte de force 1 ou plus à détruire',
  },
  'chapeau-magique': {
    source: 'CHAMP', nombre: 1, filtres: ['AUTRE_QUE_SOI', 'AVEC_PIVOTER'], suite: 'COPIE',
    libelle: 'Choisis la carte dont copier l’action Pivoter',
  },
};

/**
 * L'effet PASSIF d'un Boss. Un PASSIF n'est jamais « exécuté » : c'est une
 * contrainte permanente que le combat doit prendre en compte, pas une action
 * qui se déclenche. D'où de la DONNÉE et non un gestionnaire — `combat-boss.js`
 * la lit, personne ne l'appelle.
 * @typedef {object} PassifBoss
 * @property {import('./force.js').ModificateursForce} [force]  Altération du calcul de force.
 * @property {number} [coutParActivation]  Ressources perdues par action Pivoter utilisée avant le combat.
 */

/**
 * Les PASSIF des Boss, par `type.id` de Boss. Un Boss absent du registre n'a
 * pas de PASSIF — l'absence est normale ici, contrairement à
 * `gestionnairesSpecial` où elle signale un effet non encore implémenté.
 * @type {Record<string, PassifBoss>}
 */
export const passifsBoss = {
  /** Reine troll : « Ignore la Force des Objets. » */
  'reine-troll': { force: { objetsIgnores: true } },

  /** Trollette : « Ignore la Force des cartes de Force 4 et plus. » */
  trollette: { force: { seuilForceIgnoree: 4 } },

  /** Goblinosaurus : « Ignore les jetons +1 et +2. » */
  goblinosaurus: { force: { jetonsIgnores: true } },

  /** Les jumeaux : « La Force des cartes en double est réduite à la Force d'une seule d'entre elles. » */
  'les-jumeaux': { force: { doublonsReduits: true } },

  /** Dragon rouge : « Pour chaque action pivoter utilisée : -1 or. » */
  'dragon-rouge': { coutParActivation: 1 },
};
