// Point d'entrée navigateur — démo : met en place une partie et laisse avancer
// les phases au clic. La vraie interface (plateau SVG) remplacera cette démo.

import { creerRng } from './moteur/aleatoire.js';
import { miseEnPlace } from './moteur/mise-en-place.js';
import { avancerPhase } from './moteur/partie.js';

/** Libellés lisibles des phases pour l'affichage. */
const LIBELLE_PHASE = {
  ENTRAINEMENT: 'Entraînement',
  ENNEMI_AVANCE: "L'Ennemi Avance",
  COMBAT: 'Combat',
};

const affichage = document.querySelector('#etat-partie');
let partie = miseEnPlace({ roiReineId: 'margot', difficulte: 'NORMAL' }, creerRng(1));

/** Met à jour l'écran avec un résumé de l'état courant. */
function afficher() {
  if (affichage) {
    affichage.textContent =
      `${partie.roiReine.nom} — Tour ${partie.tour} · ${LIBELLE_PHASE[partie.phase]} · ` +
      `${partie.ressources} or · Château ${partie.chateau.length} · Boss ${partie.boss.length}`;
  }
}

// Démo temporaire : un clic n'importe où avance d'une phase.
document.querySelector('.jeu')?.addEventListener('click', () => {
  partie = avancerPhase(partie);
  afficher();
});

afficher();
