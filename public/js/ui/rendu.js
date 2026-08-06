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
/** @typedef {import('./collecte.js').Demande} Demande */

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
 * Un bouton d'action. `type="button"` est explicite : dans un formulaire, le
 * défaut d'un bouton est `submit`.
 * @param {string} texte
 * @param {string} action
 * @param {Record<string, string>} [donnees]
 * @returns {HTMLButtonElement}
 */
function bouton(texte, action, donnees = {}) {
  const noeud = document.createElement('button');
  noeud.type = 'button';
  noeud.className = 'bouton';
  noeud.textContent = texte;
  noeud.dataset['action'] = action;
  for (const [cle, valeur] of Object.entries(donnees)) noeud.dataset[cle] = valeur;
  return noeud;
}

/**
 * Le scan d'une carte, s'il existe. `alt=""` : l'image est DÉCORATIVE, le nom,
 * le symbole et la force restant écrits à côté — sans quoi il aurait fallu
 * rédiger 92 textes alternatifs.
 *
 * Si le fichier manque, le cadre se retire de lui-même : le jeu reste jouable
 * en texte pour qui n'a pas fourni ses propres scans, et rien ne le trahit à
 * l'écran. C'est aussi ce qui permet à la CI de tourner sans une seule image.
 *
 * Une carte Ennemi/Objet est un carton unique — ennemi en haut, objet en bas à
 * 180°. On n'en montre donc qu'une moitié, via un cadre deux fois moins haut
 * que l'image ; la rotation du bas est faite en CSS.
 * @param {import('./vue.js').ImageVue} image
 * @returns {HTMLElement}
 */
function rendreImage(image) {
  const cadre = element('div', image.moitie ? 'vignette vignette--moitie' : 'vignette');
  if (image.moitie) cadre.dataset['moitie'] = image.moitie.toLowerCase();

  const vignette = document.createElement('img');
  vignette.src = `/images/cartes/${image.fichier}.webp`;
  vignette.alt = '';
  vignette.loading = 'lazy';
  vignette.addEventListener('error', () => cadre.remove());

  // La hauteur du cadre vaut la moitié de celle du scan. Mesurée sur l'image
  // plutôt que codée en dur : la conversion redimensionne, et un rapport figé
  // décalerait la coupure au moindre changement de réglage ou de cadrage.
  if (image.moitie) {
    vignette.addEventListener('load', () => {
      cadre.style.aspectRatio = `${vignette.naturalWidth} / ${vignette.naturalHeight / 2}`;
    });
  }

  cadre.append(vignette);
  return cadre;
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
 *
 * Ses boutons disparaissent tant qu'une question est posée : y répondre est la
 * seule chose à faire, et rien ne doit pouvoir s'ouvrir par-dessus. La session
 * refuse déjà de son côté — l'interface ne fait pas semblant de proposer.
 * @param {CarteVue} carte
 * @param {boolean} actionOuverte
 * @returns {HTMLElement}
 */
function rendreCarte(carte, actionOuverte) {
  const item = element('li', 'carte');
  item.dataset['symbole'] = carte.symbole;
  if (carte.activee) item.dataset['activee'] = 'oui';

  item.append(
    rendreImage(carte.image),
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

  // Le bouton est distinct du contenu plutôt que d'englober la carte : un
  // `button` n'accepte que du contenu de phrase, pas la liste des actions.
  if (carte.activable && !actionOuverte) {
    item.append(bouton('Activer', 'pivoter', { id: carte.instanceId }));
  }
  // Un bouton, pas un glisser-déposer : c'est utilisable au clavier et au
  // lecteur d'écran sans rien à recoudre (CLAUDE.md, section Accessibilité).
  if (carte.echangeable && !actionOuverte) {
    item.append(bouton('Passer Garde du corps', 'garde', { id: carte.instanceId }));
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
  item.append(rendreImage(ennemi.image));

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
  section.append(element('h2', undefined, 'État de la partie'), rendreImage(vue.imageRoiReine));

  const liste = element('dl', 'resume');
  /** @type {[string, string][]} */
  const lignes = [
    ['Rôle', vue.roiReine],
    ['Tour', String(vue.tour)],
    ['Phase', vue.phase],
    ['Ressources', `${vue.ressources} or`],
    ['Pouvoir', vue.pouvoirDisponible ? 'disponible' : 'déjà utilisé'],
    ['Force alliée', String(vue.forceAlliee)],
    // La force ennemie est celle des Portes, vides en mode Boss : l'afficher y
    // annoncerait un « 0 » rassurant alors qu'un Boss est en face. Sa force à
    // lui est dans sa propre section, et sur le bouton qui conclut le combat.
    ...(vue.boss ? [] : [/** @type {[string, string]} */ (['Force ennemie', String(vue.forceEnnemie)])]),
  ];

  for (const [terme, valeur] of lignes) {
    liste.append(element('dt', undefined, terme), element('dd', undefined, valeur));
  }

  section.append(liste);
  return section;
}

/**
 * La piste ennemie : 3 cases, de la pioche (case 1) aux Portes (après la case 3).
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
 * Le Boss affronté : son scan, la Force à atteindre, ce qu'il coûte de cartes
 * et ce qu'il fait. Rendu comme un ennemi — c'en est un, en plus gros.
 * @param {import('./vue.js').BossVue} boss
 * @returns {HTMLElement}
 */
function rendreBoss(boss) {
  const section = element('section', 'zone');
  section.append(element('h2', undefined, 'Boss affronté'));

  const item = element('li', 'ennemi');
  item.append(
    rendreImage(boss.image),
    element('span', 'ennemi-nom', boss.nom),
    element('span', 'ennemi-force', `Force ${boss.force}`),
    element('span', 'ennemi-niveau', `${nombreDeCartes(boss.cartes)} à piocher`),
  );

  if (boss.actions.length > 0) {
    const actions = element('ul', 'carte-actions');
    for (const texte of boss.actions) actions.append(element('li', undefined, texte));
    item.append(actions);
  }

  const liste = element('ul', 'cartes');
  liste.append(item);
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
 * @param {boolean} actionOuverte
 * @returns {HTMLElement}
 */
function rendreMarche(vue, actionOuverte) {
  const section = element('section', 'zone');
  section.append(element('h2', undefined, 'Marché Doré'));

  const liste = element('ul', 'cartes');
  for (const pile of vue.marche) {
    const item = element('li', 'carte');
    if (pile.restant === 0) item.dataset['epuisee'] = 'oui';

    item.append(
      rendreImage(pile.image),
      element('span', 'carte-nom', pile.nom),
      element('span', 'carte-symbole', pile.niveau),
      element(
        'span',
        'carte-force',
        pile.force === null ? 'Force variable' : `Force ${pile.force}`,
      ),
      element('span', 'carte-restant', `${pile.restant} en réserve`),
    );
    if (pile.entrainable && !actionOuverte) {
      item.append(bouton('Entraîner', 'entrainer', { dore: pile.typeId }));
    }
    liste.append(item);
  }

  section.append(liste);
  return section;
}

/**
 * Le refus du moteur, s'il y en a un. `role="alert"` : le message est annoncé
 * dès son apparition, sans attendre que le joueur y arrive au clavier.
 * @param {string} message
 * @returns {HTMLElement}
 */
function rendreErreur(message) {
  const noeud = element('p', 'erreur', message);
  noeud.setAttribute('role', 'alert');
  return noeud;
}

/**
 * La question en cours, sous forme de vrai formulaire : `fieldset` et `legend`
 * pour que la consigne soit annoncée avec chaque option, boutons radio quand il
 * n'en faut qu'une, cases à cocher au-delà. Aucun état à tenir côté script —
 * c'est le formulaire qui porte la sélection jusqu'à la validation.
 * @param {Demande} demande
 * @param {string} contexte   Ce qu'on est en train de jouer.
 * @returns {HTMLElement}
 */
function rendreDemande(demande, contexte) {
  const formulaire = document.createElement('form');
  formulaire.className = 'demande';
  formulaire.dataset['action'] = 'repondre';

  const groupe = document.createElement('fieldset');
  groupe.append(element('legend', undefined, `${contexte} — ${demande.libelle}`));

  if (demande.libre) {
    groupe.append(element('p', 'demande-consigne', 'autant que tu veux, zéro compris'));
  } else if (demande.nombre > 1) {
    groupe.append(element('p', 'demande-consigne', `${demande.nombre} à désigner`));
  }

  // Un choix libre reste à cocher, même s'il n'en faut qu'un : les radios
  // s'excluent, et l'on doit pouvoir n'en désigner aucun.
  const type = demande.nombre === 1 && !demande.libre ? 'radio' : 'checkbox';
  for (const option of demande.options) {
    const etiquette = element('label', 'option');
    const champ = document.createElement('input');
    champ.type = type;
    champ.name = 'valeur';
    champ.value = option.valeur;
    // Sur un groupe de radios, `required` empêche nativement la validation à
    // vide — le cas d'erreur le plus courant — avec le message du navigateur,
    // déjà accessible. Inapplicable aux cases à cocher, où il exigerait que
    // CETTE case soit cochée : là, c'est le moteur qui reste le garde-fou.
    if (type === 'radio') champ.required = true;
    etiquette.append(champ, document.createTextNode(` ${option.libelle}`));
    groupe.append(etiquette);
  }

  if (demande.options.length === 0) {
    groupe.append(element('p', 'zone-vide', 'Aucune cible possible — annule l’action.'));
  }

  const valider = document.createElement('button');
  valider.type = 'submit';
  valider.className = 'bouton';
  valider.textContent = 'Valider';

  formulaire.append(groupe, valider, bouton('Annuler', 'annuler'));
  return formulaire;
}

/**
 * L'annonce de fin de partie. `role="status"` : annoncée sans voler le focus,
 * là où `alert` interromprait la lecture du plateau final.
 * @param {'VICTOIRE' | 'DEFAITE'} issue
 * @returns {HTMLElement}
 */
function rendreIssue(issue) {
  const section = element('section', 'issue');
  section.dataset['issue'] = issue.toLowerCase();
  section.setAttribute('role', 'status');

  const gagne = issue === 'VICTOIRE';
  section.append(
    element('h2', undefined, gagne ? 'Victoire' : 'Défaite'),
    element(
      'p',
      undefined,
      gagne
        ? 'Tous les Boss sont tombés : la paix revient au village.'
        : 'Les ressources du château sont épuisées : l’ennemi a percé la défense.',
    ),
  );
  return section;
}

/**
 * Les commandes qui ne dépendent d'aucune carte.
 * @param {VuePartie} vue
 * @param {boolean} actionOuverte
 * @param {boolean} tentativeBoss          Le Boss est engagé : il reste à comparer les Forces.
 * @param {boolean} entrainementEngage     Le jeton d'entraînement est posé : il reste à conclure.
 * @returns {HTMLElement}
 */
function rendreCommandes(vue, actionOuverte, tentativeBoss, entrainementEngage) {
  const section = element('section', 'commandes');
  section.append(element('h2', undefined, 'Commandes'));

  const pouvoir = bouton(`Pouvoir : ${vue.roiReine}`, 'pouvoir');
  pouvoir.disabled = !vue.pouvoirDisponible || actionOuverte;

  // Le combat des Boss ne mène à aucune autre phase : le bouton n'y aurait
  // aucune suite, autant ne pas le montrer.
  if (!vue.boss) {
    const phase = bouton('Phase suivante', 'phase');
    phase.disabled = actionOuverte;
    section.append(phase);
  }

  section.append(pouvoir);

  // Un entraînement engagé se conclut quand le joueur a fini de jouer ses
  // cartes — ou s'abandonne, la main tirée partant à l'Hôpital.
  if (entrainementEngage) {
    const conclure = bouton('Conclure l’entraînement', 'conclure-entrainement');
    const renoncer = bouton('Renoncer à l’entraînement', 'renoncer-entrainement');
    conclure.disabled = actionOuverte;
    renoncer.disabled = actionOuverte;
    section.append(conclure, renoncer);
  }

  // Les ennemis s'engagent un par un : le joueur voit chaque pioche et chaque
  // action avant de passer au suivant. « Engager » plutôt que « Révéler » —
  // un ennemi déjà retourné fait piocher lui aussi, sans rien révéler.
  if (vue.ennemisAEngager > 0) {
    const engager = bouton(`Engager l’ennemi suivant (${vue.ennemisAEngager})`, 'engager-ennemi');
    engager.disabled = actionOuverte;
    section.append(engager);
  }

  if (vue.combatResoluble) {
    const combattre = bouton(`Combattre (${vue.forceAlliee} contre ${vue.forceEnnemie})`, 'combattre');
    combattre.disabled = actionOuverte;
    section.append(combattre);
  }

  // Une tentative contre un Boss se joue en deux temps : on l'affronte (pioche
  // et action du Boss), on joue ses cartes, puis on compare les Forces.
  if (vue.boss) {
    const tentative = tentativeBoss
      ? bouton(`Résoudre le combat (${vue.forceAlliee} contre ${vue.boss.force})`, 'resoudre-boss')
      : bouton(`Affronter ${vue.boss.nom} (piocher ${nombreDeCartes(vue.boss.cartes)})`, 'engager-boss');
    tentative.disabled = actionOuverte;
    section.append(tentative);
  }

  return section;
}

/**
 * Ce que l'écran doit montrer en plus du plateau : la question en cours et le
 * dernier refus du moteur.
 * @typedef {object} EtatEcran
 * @property {import('./collecte.js').Demande | null} demande
 * @property {string | null} erreur
 * @property {boolean} tentativeBoss        Le Boss est engagé, il reste à conclure.
 * @property {boolean} entrainementEngage   Le jeton d'entraînement est posé, il reste à conclure.
 * @property {string} [contexte]            Ce qu'on est en train de jouer.
 */

/**
 * Rend le plateau complet dans `racine`, en remplaçant son contenu.
 * @param {HTMLElement} racine
 * @param {VuePartie} vue
 * @param {EtatEcran} ecran
 */
export function rendrePlateau(racine, vue, ecran) {
  // Une question posée fige le plateau : elle seule attend une réponse.
  const actionOuverte = ecran.demande !== null;
  const carte = (/** @type {CarteVue} */ c) => rendreCarte(c, actionOuverte);
  const gardeDuCorps = vue.gardeDuCorps ? [carte(vue.gardeDuCorps)] : [];

  // Partie finie : le plateau reste lisible, mais plus aucune commande — ni
  // question en suspens, qui n'aurait plus de réponse à donner.
  const termine = vue.issue !== null;

  racine.replaceChildren(
    ...(vue.issue ? [rendreIssue(vue.issue)] : []),
    ...(ecran.erreur ? [rendreErreur(ecran.erreur)] : []),
    ...(ecran.demande && !termine ? [rendreDemande(ecran.demande, ecran.contexte ?? 'Action')] : []),
    ...(termine
      ? []
      : [rendreCommandes(vue, actionOuverte, ecran.tentativeBoss, ecran.entrainementEngage)]),
    rendreEntete(vue),
    ...(vue.boss ? [rendreBoss(vue.boss)] : []),
    rendreSectionListe(
      'Aux Portes',
      vue.portes.map(rendreEnnemi),
      'Aucun ennemi aux Portes',
    ),
    rendrePiste(vue),
    rendreSectionListe(
      vue.champDeBataille.nom,
      vue.champDeBataille.cartes.map(carte),
      'Aucune carte en jeu',
    ),
    rendreSectionListe('Garde du corps', gardeDuCorps, 'Aucun Garde du corps'),
    rendreSectionListe(vue.hopital.nom, vue.hopital.cartes.map(carte)),
    rendreReserves(vue),
    rendreMarche(vue, actionOuverte),
  );
}
