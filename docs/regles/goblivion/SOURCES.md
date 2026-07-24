# Provenance du livret de règles — Goblivion (Definitive Edition)

Livret récupéré le **24 juillet 2026**. Ce n'est pas un document produit par le
projet : il vient de l'éditeur / de bases communautaires, et sert de **référence
normative** pendant l'implémentation du moteur de jeu.

## Particularité : aucune version en « texte natif »

Contrairement aux autres jeux, **aucun** PDF de Goblivion trouvé n'a de couche
texte propre. Trois sources ont été évaluées :

| Source | Contenu | Verdict |
|---|---|---|
| `ammd.ch` — *Definitive Edition* | PDF **tout en images**, sans couche texte | **Retenu comme référence canonique** (édition la plus à jour, images nettes) |
| Bibliothèque de Brossard | Scan **avec** couche texte OCR | OCR **peu fiable** (« cartes »→« cortes », nombres faux) ; gardé en recoupement |
| Google Drive | PDF tout en images | Redondant, **écarté** |

Comme il n'existe pas de texte extractible, le fichier
`goblivion-definitive-edition-fr.txt` **n'est pas** une sortie `pdftotext` : c'est
une **transcription à la main**, faite en lisant les pages rendues en image.

## Fiche du jeu

| | |
|---|---|
| Concepteur / Visuel | Jean-François Gauthier |
| Relecture / Traduction | Émilie Levasseur |
| Éditeur | Goblivion Games (© 2023) |
| Joueurs | 1 (solo) ou 2 (coop) |
| Langue du livret | français |
| Pages | 20 |

Sources :
- Definitive Edition (canonique) : <https://ammd.ch/pdfregles/gobliviondefinitiveedition.pdf>
- Scan Brossard (recoupement) : <https://biblio.brossard.ca/jeux_societe/regles/goblivion_regles.pdf>
- Site officiel : <https://www.gobliviongames.com> — Facebook : GoblivionGames

## Fichiers conservés ici

- `goblivion-definitive-edition-fr.pdf` — **référence canonique** (images).
- `goblivion-definitive-edition-fr.txt` — **transcription texte** des 20 pages
  (référence recherchable et hors-ligne).
- `goblivion-brossard-scan-fr.pdf` — scan alternatif, gardé en recoupement.

## Reproduire l'extraction texte

Le PDF étant en images, on rend chaque page en PNG puis on lit à l'œil. Rendu
utilisé : **PyMuPDF** (paquet Python `PyMuPDF`), pages exportées à **180 DPI**.
Aucune dépendance système requise. `pdftotext` **ne fonctionne pas** ici (aucun
texte à extraire).

## Ce que le livret ne contient PAS

Le détail exhaustif des cartes n'est **pas** listé dans les règles (seulement des
exemples). À saisir séparément depuis le matériel physique :

- les 12 types de cartes Doré (marché d'entraînement) : Force, action, coût
  d'entraînement complet (pioche / cible / symbole d'échange) ;
- les 23 cartes Ennemi/Objet : Force ennemie, épées, cartes à piocher, action
  ennemie **et** Force/action du côté récompense (Objet) ;
- les 11 cartes Boss : Force solo / coop, cartes à piocher, action ;
- les 7 rôles Roi/Reine : ressources de départ, Garde du corps, pouvoir.

## Droits — IMPORTANT (dépôt public)

Ce livret reste la **propriété de Goblivion Games**. Il est stocké ici pour un
usage **strictement personnel et local**. Le dépôt GitHub étant **public**, ni
les PDF ni la transcription (reproduction dérivée des règles) **ne doivent être
publiés** : ils sont **exclus par `.gitignore`**. Seul ce fichier de provenance,
qui ne reproduit pas les règles, peut éventuellement rester suivi.
