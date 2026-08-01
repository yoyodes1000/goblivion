// Point d'entrée navigateur — met en place une partie et affiche son plateau.
//
// LECTURE SEULE : rien n'est jouable à ce stade (première tranche du chantier
// interface). L'assemblage se limite donc à trois lignes utiles — mettre en
// place, construire la vue, rendre — et toute la logique vit ailleurs :
// le jeu dans `moteur/`, la traduction en `ui/vue.js`, le DOM en `ui/rendu.js`.

import { creerRng } from './moteur/aleatoire.js';
import { miseEnPlace } from './moteur/mise-en-place.js';
import { construireVue } from './ui/vue.js';
import { rendrePlateau } from './ui/rendu.js';

/**
 * Graine de la partie : celle passée en `?graine=N`, ou une au hasard. Elle est
 * affichée pour qu'un plateau intéressant se retrouve à l'identique — l'aléa
 * du moteur étant déterministe, la graine suffit à rejouer la mise en place.
 * @returns {number}
 */
function graineDemandee() {
  const brut = new URLSearchParams(window.location.search).get('graine');
  const graine = Number(brut);
  return brut !== null && brut.trim() !== '' && Number.isFinite(graine)
    ? graine
    : Math.floor(Math.random() * 1e6);
}

const racine = document.querySelector('#plateau');
if (!(racine instanceof HTMLElement)) throw new Error('Élément #plateau introuvable');

const graine = graineDemandee();
const partie = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(graine));

rendrePlateau(racine, construireVue(partie));

const affichageGraine = document.querySelector('#graine');
if (affichageGraine) affichageGraine.textContent = String(graine);
