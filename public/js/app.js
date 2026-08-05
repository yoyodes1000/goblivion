// Point d'entrée navigateur — assemble les couches et branche les événements.
//
// Ne contient aucune règle : la partie vit dans `moteur/`, la boucle de jeu
// dans `ui/session.js`, la traduction en `ui/vue.js`, le DOM en `ui/rendu.js`.
// Ce fichier ne fait que tenir la session courante, écouter les clics et
// redemander un rendu — c'est pourquoi il n'a pas de tests : il ne décide rien.

import { creerRng } from './moteur/aleatoire.js';
import { miseEnPlace } from './moteur/mise-en-place.js';
import { construireVue } from './ui/vue.js';
import { rendrePlateau } from './ui/rendu.js';
import {
  nouvelleSession,
  demandeCourante,
  commencerPivoter,
  commencerPouvoir,
  commencerEntrainement,
  revelerProchainEnnemi,
  resoudreLeCombat,
  repondreDemande,
  annulerAction,
  passerPhase,
} from './ui/session.js';

/**
 * Graine de la partie : celle passée en `?graine=N`, ou une au hasard. Elle est
 * affichée pour qu'un plateau intéressant se retrouve à l'identique — l'aléa du
 * moteur étant déterministe, la graine suffit à rejouer la mise en place.
 * @returns {number}
 */
function graineDemandee() {
  const brut = new URLSearchParams(window.location.search).get('graine');
  const graine = Number(brut);
  return brut !== null && brut.trim() !== '' && Number.isFinite(graine)
    ? graine
    : Math.floor(Math.random() * 1e6);
}

const cible = document.querySelector('#plateau');
if (!(cible instanceof HTMLElement)) throw new Error('Élément #plateau introuvable');
/** @type {HTMLElement} */
const racine = cible;

const graine = graineDemandee();

// Un seul générateur pour toute la partie : le relancer à chaque action
// rejouerait la même suite, et les pioches se répéteraient.
const rng = creerRng(graine);

let session = nouvelleSession(miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, rng));

/** Redessine l'écran d'après la session courante. */
function afficher() {
  const demande = demandeCourante(session);
  rendrePlateau(racine, construireVue(session.partie), {
    demande,
    erreur: session.erreur,
    ...(session.enCours ? { contexte: session.enCours.libelle } : {}),
  });

  // Porter le focus sur la question dès qu'elle apparaît : plus fiable qu'une
  // région live pour une saisie qui bloque la suite du tour.
  if (demande) {
    const premier = racine.querySelector('.demande input');
    if (premier instanceof HTMLElement) premier.focus();
  }
}

/** @param {Session} suivante */
function appliquer(suivante) {
  session = suivante;
  afficher();
}

/** @typedef {import('./ui/session.js').Session} Session */

racine.addEventListener('click', (evenement) => {
  const cible = evenement.target;
  if (!(cible instanceof HTMLElement)) return;

  const declencheur = cible.closest('[data-action]');
  if (!(declencheur instanceof HTMLElement)) return;

  switch (declencheur.dataset['action']) {
    case 'pivoter':
      appliquer(commencerPivoter(session, declencheur.dataset['id'] ?? '', rng));
      break;
    case 'pouvoir':
      appliquer(commencerPouvoir(session, rng));
      break;
    case 'entrainer':
      appliquer(commencerEntrainement(session, declencheur.dataset['dore'] ?? '', rng));
      break;
    case 'reveler':
      appliquer(revelerProchainEnnemi(session, rng));
      break;
    case 'combattre':
      appliquer(resoudreLeCombat(session, rng));
      break;
    case 'phase':
      appliquer(passerPhase(session));
      break;
    case 'annuler':
      appliquer(annulerAction(session));
      break;
    default:
      break;
  }
});

// La réponse à une demande passe par la soumission du formulaire : la sélection
// est portée par les champs eux-mêmes, rien à mémoriser entre deux clics.
racine.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  const formulaire = evenement.target;
  if (!(formulaire instanceof HTMLFormElement)) return;

  const valeurs = new FormData(formulaire).getAll('valeur').map(String);
  appliquer(repondreDemande(session, valeurs, rng));
});

afficher();

const affichageGraine = document.querySelector('#graine');
if (affichageGraine) affichageGraine.textContent = String(graine);
