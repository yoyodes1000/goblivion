// Moteur — calcul de la force au combat des cartes en jeu. Couche PURE.
//
// Ce fichier connaît les *natures* d'altération du calcul (ignorer les jetons,
// ignorer les Objets…), jamais les cartes qui les provoquent : quel Boss lève
// quel modificateur est décrit par `passifsBoss`, dans `special.js`.

/** @typedef {import('./partie.js').InstanceAlliee} InstanceAlliee */

/**
 * Ce qui altère le calcul de force pour un combat donné. Tous les champs sont
 * optionnels ; absent = aucune altération.
 *
 * Une carte dont la force est ignorée reste en jeu et garde ses actions
 * activables (FAQ p.18) : ces modificateurs ne touchent QUE le calcul.
 * @typedef {object} ModificateursForce
 * @property {boolean} [jetonsIgnores]     Les jetons bonus ne comptent pas (Gobelin pestilant, Goblinosaurus).
 * @property {boolean} [objetsIgnores]     La force des Objets (OBJET) ne compte pas (Reine troll).
 * @property {number} [seuilForceIgnoree]  La force des cartes atteignant ce seuil ne compte pas (Trollette : 4).
 * @property {boolean} [doublonsReduits]   Un seul exemplaire par type compte dans le total (Les jumeaux).
 */

/**
 * Force d'un Soldat selon le nombre de Soldats en jeu : 1→2, 2→3, 3→4, 4+→5.
 * @param {number} nbSoldats
 * @returns {number}
 */
function forceSoldat(nbSoldats) {
  return Math.min(nbSoldats + 1, 5);
}

/**
 * Force imprimée d'une carte, jeton bonus exclu : sa valeur fixe, ou le barème
 * du Soldat (force « VARIABLE »). Les autres forces variables (ex. Joker) ne
 * sont pas encore gérées et valent 0.
 * @param {InstanceAlliee} carte
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @returns {number}
 */
function forceImprimee(carte, champDeBataille) {
  if (typeof carte.type.force === 'number') return carte.type.force;
  if (carte.type.id === 'soldat') {
    return forceSoldat(champDeBataille.filter((c) => c.type.id === 'soldat').length);
  }
  return 0;
}

/**
 * Force au combat d'une carte alliée en jeu : sa force imprimée plus son
 * éventuel jeton bonus (effet FORCE, voir `effets.js`), le tout soumis aux
 * `modificateurs` du combat en cours.
 *
 * `objetsIgnores` et `seuilForceIgnoree` ramènent la force à 0 — ils ne
 * retirent pas la carte du jeu. `jetonsIgnores`, lui, n'annule que le jeton :
 * la force imprimée reste acquise.
 *
 * Le seuil de `seuilForceIgnoree` se compare à la force effective, jeton
 * compris : une carte de force 3 portant un jeton +1 atteint bien 4.
 * @param {InstanceAlliee} carte
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @param {ModificateursForce} [modificateurs]
 * @returns {number}
 */
export function forceCarte(carte, champDeBataille, modificateurs = {}) {
  const { jetonsIgnores = false, objetsIgnores = false, seuilForceIgnoree } = modificateurs;

  if (objetsIgnores && carte.type.symbole === 'OBJET') return 0;

  const force = forceImprimee(carte, champDeBataille) + (jetonsIgnores ? 0 : (carte.jetonBonus ?? 0));

  if (seuilForceIgnoree !== undefined && force >= seuilForceIgnoree) return 0;
  return force;
}

/**
 * Ne garde qu'un exemplaire par type de carte (Les jumeaux : « on ne compte
 * qu'un exemplaire de ses doublons en jeu », FAQ p.18). Le texte ne dit pas
 * lequel : on garde le plus fort, au bénéfice du joueur — et le choix reste
 * déterministe, sans rien demander à l'UI.
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @param {ModificateursForce} modificateurs
 * @returns {InstanceAlliee[]}
 */
function unExemplaireParType(champDeBataille, modificateurs) {
  /** @type {Map<string, InstanceAlliee>} */
  const meilleurParType = new Map();

  for (const carte of champDeBataille) {
    const retenu = meilleurParType.get(carte.type.id);
    const estMeilleur =
      !retenu ||
      forceCarte(carte, champDeBataille, modificateurs) >
        forceCarte(retenu, champDeBataille, modificateurs);
    if (estMeilleur) meilleurParType.set(carte.type.id, carte);
  }

  return [...meilleurParType.values()];
}

/**
 * Somme des forces des cartes en jeu sur le Champ de bataille. Le Garde du
 * corps n'en fait pas partie : c'est une zone à part, hors du calcul.
 *
 * `doublonsReduits` retire des doublons de la SOMME, pas du Champ de bataille :
 * chaque carte reste calculée dans le contexte complet du champ, si bien qu'un
 * Soldat écarté du total continue de compter dans le barème des Soldats.
 * @param {readonly InstanceAlliee[]} champDeBataille
 * @param {ModificateursForce} [modificateurs]
 * @returns {number}
 */
export function forceTotale(champDeBataille, modificateurs = {}) {
  const comptees = modificateurs.doublonsReduits
    ? unExemplaireParType(champDeBataille, modificateurs)
    : champDeBataille;

  return comptees.reduce(
    (somme, carte) => somme + forceCarte(carte, champDeBataille, modificateurs),
    0,
  );
}
