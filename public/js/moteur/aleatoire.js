// Aléa déterministe pour garder le moteur pur et testable : une même seed
// produit toujours la même suite → parties reproductibles et tests stables.

/**
 * Générateur pseudo-aléatoire seedé (mulberry32).
 * @param {number} seed
 * @returns {() => number}  Fonction rendant un flottant dans [0, 1[.
 */
export function creerRng(seed) {
  let a = seed >>> 0;
  return function suivant() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mélange une COPIE de `liste` (Fisher-Yates) — n'altère pas l'entrée.
 * @template T
 * @param {readonly T[]} liste
 * @param {() => number} rng
 * @returns {T[]}
 */
export function melanger(liste, rng) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tampon = /** @type {T} */ (copie[i]);
    copie[i] = /** @type {T} */ (copie[j]);
    copie[j] = tampon;
  }
  return copie;
}
