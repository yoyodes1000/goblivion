# Goblivion (portage numérique, non officiel)

Implémentation **personnelle et locale** du jeu de société solo
**Goblivion — Definitive Edition** (deckbuilder de défense de château),
pour y jouer seul contre le système du jeu.

> Projet de fan, **non officiel**, sans affiliation avec Goblivion Games.
> Ni les livrets de règles, ni aucune illustration ne sont inclus dans ce
> dépôt. Les **caractéristiques des cartes** (noms, forces, textes d'action),
> elles, y sont saisies : le moteur ne saurait pas jouer sans.

## Statut

**Le moteur est complet et couvert par des tests** : mise en place, phases,
entraînement, combats, combat des Boss, et les effets de toutes les cartes.

**L'interface est en cours.** Le plateau s'affiche en lecture seule et la couche
qui recueille les choix du joueur est en place ; il reste à les relier pour
rendre une partie jouable.

## Pile technique

- JavaScript à modules ES, typé par JSDoc et vérifié avec TypeScript
  (`tsc --noEmit`) — **sans framework, sans étape de build, sans dépendance
  d'exécution**. Le navigateur charge les modules tels quels.
- Tests avec le lanceur intégré de Node (`node --test`), exécutés à chaque
  Pull Request par GitHub Actions.

## Architecture

Deux couches, la seconde dépendant de la première et jamais l'inverse.

- **`public/js/moteur/`** — les règles du jeu. Fonctions **pures** : aucune
  référence au DOM, aléa injecté, états gelés et jamais mutés. Pas d'IA
  adverse : en solo, l'ennemi est un système déterministe scripté.
- **`public/js/ui/`** — l'interface.
  - `vue.js` — traduit un état en modèle d'affichage. Pur, testé. C'est aussi
    la frontière de l'information cachée : ce qui est face caché n'en sort
    qu'en nombre.
  - `collecte.js` — recueille les choix qu'une action réclame. Pur, testé.
  - `rendu.js` — seul fichier à toucher le DOM. HTML sémantique, pas de SVG :
    le plateau est d'abord une structure à parcourir.

## Démarrer

```bash
npm ci
```

```bash
npm start
```

Le serveur de développement écoute sur <http://localhost:8080>. Ajouter
`?graine=42` à l'URL pour rejouer une mise en place à l'identique.

```bash
npm test
```

```bash
npm run check
```

Node 24 ou plus récent (voir le champ `engines`).

## Jouer avec les images des cartes (facultatif)

Le dépôt ne contient **aucun scan** : chacun fournit les siens, à partir du jeu
qu'il possède. Sans eux, le plateau s'affiche en texte et tout reste jouable —
c'est le cas par défaut.

Pour les ajouter, scanner ses cartes puis ouvrir
<http://localhost:8080/outils/images.html> (serveur démarré). L'outil
redimensionne en WebP, normalise les noms vers les identifiants du moteur et
signale ceux qu'il ne reconnaît pas. Destination :
`public/images/cartes/` — dossier **ignoré par Git**, et qui doit le rester.

Une carte Ennemi/Objet est un seul carton : l'ennemi en haut, l'objet en bas à
180°. Un seul fichier par carte suffit donc, l'affichage se charge du découpage.

## Contenu sous droits — non inclus

Goblivion est une œuvre de **Goblivion Games** (© 2023). Les livrets de
règles et tout matériel du jeu sont **exclus de ce dépôt** et conservés
uniquement en local pour le développement. Pour jouer au vrai jeu :
https://www.gobliviongames.com
