// Serveur statique minimal pour le développement — ZÉRO dépendance.
// Sert le dossier public/ tel quel : le navigateur charge les modules ES sans
// aucune étape de build. Usage strictement local (aucun durcissement réseau).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';

const RACINE = fileURLToPath(new URL('../public/', import.meta.url));
const PORT = Number(process.env['PORT'] ?? 8080);

/**
 * Types MIME servis. `.js` doit être `text/javascript`, sinon le navigateur
 * refuse de charger le module.
 * @type {Record<string, string>}
 */
const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const serveur = createServer(async (requete, reponse) => {
  try {
    const url = new URL(requete.url ?? '/', `http://${requete.headers.host}`);
    let chemin = decodeURIComponent(url.pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';

    // Empêche toute remontée hors de la racine (path traversal).
    const cible = normalize(join(RACINE, chemin));
    if (!cible.startsWith(RACINE)) {
      reponse.writeHead(403).end('403 Interdit');
      return;
    }

    const contenu = await readFile(cible);
    const type = TYPES_MIME[extname(cible)] ?? 'application/octet-stream';
    reponse.writeHead(200, { 'content-type': type }).end(contenu);
  } catch {
    reponse
      .writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      .end('404 Introuvable');
  }
});

serveur.listen(PORT, () => {
  console.log(`Goblivion — serveur de dev : http://localhost:${PORT}`);
});
