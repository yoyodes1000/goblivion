// Point d'entrée navigateur. Pour l'instant, il câble le moteur à l'écran juste
// assez pour prouver la chaîne : module ES chargé sans build → moteur pur →
// affichage. La vraie interface (plateau SVG) remplacera cette démo.

import { nouvellePartie, avancerPhase } from './moteur/partie.js';

/** Libellés lisibles des phases pour l'affichage. */
const LIBELLE_PHASE = {
  ENTRAINEMENT: 'Entraînement',
  ENNEMI_AVANCE: "L'Ennemi Avance",
  COMBAT: 'Combat',
};

const affichage = document.querySelector('#etat-partie');
let partie = nouvellePartie();

/** Met à jour l'écran avec le tour et la phase courants. */
function afficher() {
  if (affichage) {
    affichage.textContent = `Tour ${partie.tour} — ${LIBELLE_PHASE[partie.phase]}`;
  }
}

// Démo temporaire : un clic n'importe où avance d'une phase.
document.querySelector('.jeu')?.addEventListener('click', () => {
  partie = avancerPhase(partie);
  afficher();
});

afficher();
