'use strict';

/**
 * Parité des contrats d'API (CONTRAT-API-MOBILE.md, CONTRAT-API-ADMIN.md)
 * avec les routes réellement montées.
 *
 * ## Le défaut que ce test rend impossible
 *
 * Les contrats sont la référence de l'équipe mobile et de l'équipe admin. Un
 * contrat qui documente une route RETIRÉE (cas réel : GET /nanei/admin/hello,
 * toujours décrite comme « publique » après son retrait) envoie un
 * développeur vers un 404 ; une route montée mais absente des contrats est
 * une route que personne ne sait appeler correctement — ou qu'on a oubliée.
 *
 * Les tableaux « | VERBE | `/nanei/…` | … | » des deux contrats sont lus et
 * confrontés à la table d'app.js. Les routes délibérément non documentées
 * dans un tableau sont listées ci-dessous, avec leur raison.
 */

const fs = require('fs');
const path = require('path');
const { routesMontees, gabarit } = require('./helpers/routesMontees');

const RACINE = path.resolve(__dirname, '..', '..');
const CONTRATS = ['CONTRAT-API-MOBILE.md', 'CONTRAT-API-ADMIN.md'];

const HORS_TABLEAUX = new Map([
  ['POST /nanei/paiements/webhook/wave', 'appelée par Wave, hors périmètre des deux applications (décrite en texte dans les contrats)'],
  ['POST /nanei/paiements/webhook/orange_money', 'appelée par Orange Money, hors périmètre des deux applications'],
]);

function routesDesContrats() {
  const routes = [];
  for (const nom of CONTRATS) {
    const src = fs.readFileSync(path.join(RACINE, nom), 'utf8');
    for (const [, methode, chemin] of src.matchAll(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/gm)) {
      routes.push({ cle: `${methode} ${gabarit(chemin)}`, texte: `${methode} ${chemin}`, contrat: nom });
    }
  }
  return routes;
}

describe('contrats d’API ↔ routes montées', () => {
  const montees = routesMontees();
  const table = new Set(montees.map((r) => `${r.methode} ${gabarit(r.chemin)}`));
  const contrats = routesDesContrats();
  const documentees = new Set(contrats.map((r) => r.cle));

  it('les deux contrats sont lus', () => {
    expect(contrats.length).toBeGreaterThan(100);
  });

  it('chaque route documentée dans un tableau des contrats existe', () => {
    const fantomes = contrats.filter((r) => !table.has(r.cle)).map((r) => `${r.texte}  (${r.contrat})`);
    expect(fantomes).toEqual([]);
  });

  it('chaque route montée est documentée (ou exclue nommément)', () => {
    const muettes = montees
      .map((r) => `${r.methode} ${r.chemin}`)
      .filter((c) => !documentees.has(`${c.split(' ')[0]} ${gabarit(c.split(' ')[1])}`) && !HORS_TABLEAUX.has(c));
    expect([...new Set(muettes)]).toEqual([]);
  });

  it('la liste des exclusions ne contient rien de périmé', () => {
    const cles = new Set(montees.map((r) => `${r.methode} ${r.chemin}`));
    expect([...HORS_TABLEAUX.keys()].filter((c) => !cles.has(c))).toEqual([]);
  });
});
