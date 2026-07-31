// Moteur — gestionnaires des effets SPECIAL (texte libre, propre à chaque
// carte), un par `type.id`. Couche PURE, aléa injecté. Appelés depuis
// `executerEffets` (voir son cas 'SPECIAL') via le paramètre
// `carteActiveeTypeId` — jamais directement par les dispatchers.
//
// Le pouvoir Roi/Reine (POUVOIR) n'utilise PAS ce registre : sa cible n'est
// pas une carte cherchée par id, mais `partie.roiReine` directement — un
// registre séparé, à sa propre clé (`roiReine.id`), viendra avec ce lot-là.

import { paysansBase } from './cartes/index.js';
import { ajouterJetonBonusAllie } from './partie.js';

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * @typedef {(partie: Partie, choix: Choix | undefined, rng: () => number, carteActiveeId: string | undefined) => Partie} GestionnaireSpecial
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
};
