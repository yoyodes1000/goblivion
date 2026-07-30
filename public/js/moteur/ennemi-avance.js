// Moteur — phase « L'Ennemi Avance » (règles p.10-11). Couche PURE.
// La piste a 4 cases : index 0 = case 1 (côté pioche, où apparaissent les
// ennemis) → index 3 = case 4 (côté Portes). Les Portes accueillent au plus 3
// ennemis (la zone de combat).

/** @typedef {import('./partie.js').Partie} Partie */
/** @typedef {import('./partie.js').EnnemiSurPiste} EnnemiSurPiste */
/** @typedef {import('./partie.js').InstanceEnnemi} InstanceEnnemi */

/**
 * Une avancée de l'ennemi :
 * 1. l'ennemi de la case 4 entre aux Portes ; si elles sont pleines (3), il est
 *    détruit (« l'ennemi n'arrête jamais ») ;
 * 2. tous les ennemis glissent d'une case vers les Portes ;
 * 3. une nouvelle carte de la pile Ennemi (si non vide) comble la case 1.
 * Une carte révélée le reste en glissant.
 * @param {Partie} partie
 * @returns {Partie}
 */
export function avancerEnnemis(partie) {
  const piste = partie.pisteEnnemi;
  const portes = [...partie.portes];
  const pileEnnemi = [...partie.pileEnnemi];

  // 1. La case 4 entre aux Portes, ou est détruite si elles sont pleines.
  const frontal = piste[3] ?? null;
  if (frontal && portes.length < 3) {
    portes.push(frontal);
  }

  // 3. Nouvelle carte sur la case 1 (si la pile n'est pas vide).
  /** @type {EnnemiSurPiste | null} */
  let case1 = null;
  if (pileEnnemi.length > 0) {
    const instance = /** @type {InstanceEnnemi} */ (pileEnnemi.shift());
    case1 = { instance, revele: false };
  }

  // 2. Glissement d'une case vers les Portes (index 0 → 1 → 2 → 3).
  const pisteEnnemi = [case1, piste[0] ?? null, piste[1] ?? null, piste[2] ?? null];

  return Object.freeze({ ...partie, pisteEnnemi, portes, pileEnnemi });
}

/**
 * Vrai s'il ne reste plus aucun ennemi à faire avancer (pile ET piste vides).
 * Dans ce cas, la phase « L'Ennemi Avance » mène au combat des Boss (après avoir
 * détruit les ennemis restés aux Portes).
 * @param {Partie} partie
 * @returns {boolean}
 */
export function pisteEtPileVides(partie) {
  return partie.pileEnnemi.length === 0 && partie.pisteEnnemi.every((c) => c === null);
}

/**
 * Révèle l'ennemi présent sur la case d'indice `index` (effet Vision / œil).
 * Une carte révélée le reste. Sans ennemi sur la case, l'état est inchangé.
 * @param {Partie} partie
 * @param {number} index
 * @returns {Partie}
 */
export function revelerSurPiste(partie, index) {
  if (!partie.pisteEnnemi[index]) return partie;
  const pisteEnnemi = partie.pisteEnnemi.map((carte, i) =>
    i === index && carte ? { ...carte, revele: true } : carte,
  );
  return Object.freeze({ ...partie, pisteEnnemi });
}
