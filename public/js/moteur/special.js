// Moteur — gestionnaires des effets SPECIAL (texte libre, propre à chaque
// carte), un par `type.id`. Couche PURE, aléa injecté. Appelés depuis
// `executerEffets` (voir son cas 'SPECIAL') via le paramètre
// `carteActiveeTypeId` — jamais directement par les dispatchers.
//
// Le pouvoir Roi/Reine (POUVOIR) n'utilise PAS ce registre : sa cible n'est
// pas une carte cherchée par id, mais `partie.roiReine` directement — un
// registre séparé, à sa propre clé (`roiReine.id`), viendra avec ce lot-là.

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./effets.js').Choix} Choix */

/**
 * @typedef {(partie: Partie, choix: Choix | undefined, rng: () => number) => Partie} GestionnaireSpecial
 */

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
};
