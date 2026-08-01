// Interface — rend un modèle d'affichage (voir `vue.js`) dans le DOM. Aucune
// logique de jeu ici : ce fichier ne sait que fabriquer des éléments à partir
// de ce qu'on lui donne. Il n'accède jamais à un état de partie.
//
// Le plateau est construit en HTML sémantique plutôt qu'en SVG : sections
// titrées, listes, points de repère. Un lecteur d'écran y navigue nativement,
// là où un dessin SVG obligerait à recoudre à la main ce que le HTML offre
// d'emblée (CLAUDE.md, section Accessibilité).
//
// Tout le texte passe par `textContent`, jamais par `innerHTML` : aucune
// donnée ne peut être interprétée comme du balisage.

/** @typedef {import('./vue.js').VuePartie} VuePartie */
/** @typedef {import('./vue.js').CarteVue} CarteVue */
/** @typedef {import('./vue.js').EnnemiVue} EnnemiVue */
/** @typedef {import('./vue.js').ZoneVue} ZoneVue */

/**
 * Crée un élément, avec sa classe et son texte éventuels.
 * @param {string} balise
 * @param {string} [classe]
 * @param {string} [texte]
 * @returns {HTMLElement}
 */
function element(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

/**
 * Libellé de la force d'une carte. Une force variable hors du Champ de
 * bataille n'a pas de valeur : le barème du Soldat suppose un contexte de jeu.
 * @param {CarteVue} carte
 * @returns {string}
 */
function libelleForce(carte) {
  if (carte.force === null) return 'Force variable';
  return carte.forceVariable ? `Force ${carte.force} (variable)` : `Force ${carte.force}`;
}

/**
 * « aucune carte » / « 1 carte » / « 20 cartes ».
 * @param {number} nombre
 * @returns {string}
 */
function nombreDeCartes(nombre) {
  if (nombre === 0) return 'aucune carte';
  return `${nombre} carte${nombre > 1 ? 's' : ''}`;
}

/**
 * Une carte alliée.
 * @param {CarteVue} carte
 * @returns {HTMLElement}
 */
function rendreCarte(carte) {
  const item = element('li', 'carte');
  item.dataset['symbole'] = carte.symbole;
  if (carte.activee) item.dataset['activee'] = 'oui';

  item.append(
    element('span', 'carte-nom', carte.nom),
    // Le symbole est écrit, pas seulement porté par une couleur.
    element('span', 'carte-symbole', carte.symbole),
    element('span', 'carte-force', libelleForce(carte)),
  );

  if (carte.jetonBonus !== 0) {
    item.append(element('span', 'carte-jeton', `jeton +${carte.jetonBonus}`));
  }
  if (carte.activee) {
    item.append(element('span', 'carte-activee', 'activée'));
  }
  if (carte.actions.length > 0) {
    const actions = element('ul', 'carte-actions');
    for (const texte of carte.actions) actions.append(element('li', undefined, texte));
    item.append(actions);
  }

  return item;
}

/**
 * Un ennemi. Non révélé, il n'affiche que son dos et son éventuel jeton — la
 * vue ne livre rien d'autre, et le rendu n'a rien à inventer.
 * @param {EnnemiVue} ennemi
 * @returns {HTMLElement}
 */
function rendreEnnemi(ennemi) {
  const item = element('li', 'ennemi');

  if (!ennemi.revele) {
    item.dataset['revele'] = 'non';
    item.append(element('span', 'ennemi-nom', 'Carte face cachée'));
  } else {
    item.append(
      element('span', 'ennemi-nom', ennemi.nom ?? ''),
      element('span', 'ennemi-niveau', ennemi.niveau ?? ''),
      element('span', 'ennemi-force', `Force ${ennemi.force}`),
    );
  }

  if (ennemi.jetonBonus !== 0) {
    item.append(element('span', 'carte-jeton', `jeton +${ennemi.jetonBonus}`));
  }
  return item;
}

/**
 * Une section titrée contenant une liste. Le titre porte le compte, pour qu'il
 * soit annoncé avec l'intitulé plutôt que deviné à l'énumération.
 * @param {string} titre
 * @param {HTMLElement[]} items
 * @param {string} [videTexte]   Message quand la liste est vide.
 * @returns {HTMLElement}
 */
function rendreSectionListe(titre, items, videTexte = 'Vide') {
  const section = element('section', 'zone');
  section.append(element('h2', undefined, `${titre} (${items.length})`));

  if (items.length === 0) {
    section.append(element('p', 'zone-vide', videTexte));
    return section;
  }

  const liste = element('ul', 'cartes');
  liste.append(...items);
  section.append(liste);
  return section;
}

/**
 * L'en-tête : rôle, tour, phase, ressources et rapport de forces.
 * @param {VuePartie} vue
 * @returns {HTMLElement}
 */
function rendreEntete(vue) {
  const section = element('section', 'entete');
  section.append(element('h2', undefined, 'État de la partie'));

  const liste = element('dl', 'resume');
  /** @type {[string, string][]} */
  const lignes = [
    ['Rôle', vue.roiReine],
    ['Tour', String(vue.tour)],
    ['Phase', vue.phase],
    ['Ressources', `${vue.ressources} or`],
    ['Pouvoir', vue.pouvoirDisponible ? 'disponible' : 'déjà utilisé'],
    ['Force alliée', String(vue.forceAlliee)],
    ['Force ennemie', String(vue.forceEnnemie)],
  ];

  for (const [terme, valeur] of lignes) {
    liste.append(element('dt', undefined, terme), element('dd', undefined, valeur));
  }

  section.append(liste);
  return section;
}

/**
 * La piste ennemie : 4 cases, de la pioche (case 1) aux Portes (case 4).
 * @param {VuePartie} vue
 * @returns {HTMLElement}
 */
function rendrePiste(vue) {
  const section = element('section', 'zone');
  section.append(element('h2', undefined, 'Piste ennemie'));

  const liste = element('ol', 'piste');
  vue.pisteEnnemi.forEach((ennemi, i) => {
    const item = element('li', 'case-piste');
    item.append(element('span', 'case-numero', `Case ${i + 1}`));
    if (ennemi) {
      const contenu = element('ul', 'cartes');
      contenu.append(rendreEnnemi(ennemi));
      item.append(contenu);
    } else {
      item.append(element('span', 'zone-vide', 'Vide'));
    }
    liste.append(item);
  });

  section.append(liste);
  return section;
}

/**
 * Les zones faces cachées, réduites à leur compte.
 * @param {VuePartie} vue
 * @returns {HTMLElement}
 */
function rendreReserves(vue) {
  const section = element('section', 'zone');
  section.append(element('h2', undefined, 'Réserves (faces cachées)'));

  const liste = element('dl', 'resume');
  /** @type {[string, string][]} */
  const lignes = [
    [vue.chateau.nom, nombreDeCartes(vue.chateau.nombre)],
    [vue.pileEnnemi.nom, nombreDeCartes(vue.pileEnnemi.nombre)],
    // Pas « 4 cartes » : on compte des Boss, pas des cartes à piocher.
    ['Boss restants', String(vue.bossRestants)],
  ];

  for (const [terme, valeur] of lignes) {
    liste.append(element('dt', undefined, terme), element('dd', undefined, valeur));
  }

  section.append(liste);
  return section;
}

/**
 * Le marché Doré : les 12 piles et ce qu'il en reste.
 * @param {VuePartie} vue
 * @returns {HTMLElement}
 */
function rendreMarche(vue) {
  const section = element('section', 'zone');
  section.append(element('h2', undefined, 'Marché Doré'));

  const liste = element('ul', 'cartes');
  for (const pile of vue.marche) {
    const item = element('li', 'carte');
    if (pile.restant === 0) item.dataset['epuisee'] = 'oui';

    item.append(
      element('span', 'carte-nom', pile.nom),
      element('span', 'carte-symbole', pile.niveau),
      element(
        'span',
        'carte-force',
        pile.force === null ? 'Force variable' : `Force ${pile.force}`,
      ),
      element('span', 'carte-restant', `${pile.restant} en réserve`),
    );
    liste.append(item);
  }

  section.append(liste);
  return section;
}

/**
 * Rend le plateau complet dans `racine`, en remplaçant son contenu.
 * @param {HTMLElement} racine
 * @param {VuePartie} vue
 */
export function rendrePlateau(racine, vue) {
  const gardeDuCorps = vue.gardeDuCorps ? [rendreCarte(vue.gardeDuCorps)] : [];

  racine.replaceChildren(
    rendreEntete(vue),
    rendreSectionListe(
      'Aux Portes',
      vue.portes.map(rendreEnnemi),
      'Aucun ennemi aux Portes',
    ),
    rendrePiste(vue),
    rendreSectionListe(
      vue.champDeBataille.nom,
      vue.champDeBataille.cartes.map(rendreCarte),
      'Aucune carte en jeu',
    ),
    rendreSectionListe('Garde du corps', gardeDuCorps, 'Aucun Garde du corps'),
    rendreSectionListe(vue.hopital.nom, vue.hopital.cartes.map(rendreCarte)),
    rendreReserves(vue),
    rendreMarche(vue),
  );
}
