'use strict';

/**
 * Filtre global des réponses d'erreur (middlewares/reponsesErreur.middleware.js)
 * et gestionnaire d'erreurs final (errorHandler.middleware.js).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * 1. Une erreur SQL, une pile ou un nom de contrainte qui sort vers le client
 *    (beaucoup de contrôleurs renvoient `error: err.message`).
 * 2. L'inverse, trouvé en écrivant ce test : un message MÉTIER légitime pris
 *    pour un détail technique et remplacé par « Requête invalide ». Le motif
 *    `ECONN` était insensible à la casse et « reconnecter » le contient : le
 *    401 « Session expirée… Veuillez vous reconnecter. » perdait son texte.
 *    Le dernier bloc relit TOUS les messages écrits dans le code et vérifie
 *    qu'aucun n'est censuré.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const multer = require('multer');
const filtre = require('../middlewares/reponsesErreur.middleware');
const errorHandler = require('../middlewares/errorHandler.middleware');

const { estTechnique } = filtre;

function appAvec(code, corps) {
  const app = express();
  app.use(filtre);
  app.get('/x', (req, res) => res.status(code).json(corps));
  return app;
}

describe('filtre des réponses d’erreur', () => {
  it('>= 500 : `error` / `erreur` retirés, message technique remplacé', async () => {
    const r = await request(appAvec(500, {
      message: 'insert or update on table "colis" violates foreign key constraint',
      error: 'SequelizeForeignKeyConstraintError',
      erreur: 'détail',
    })).get('/x');
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ message: 'Erreur serveur' });
  });

  it('>= 500 : un message déjà propre est conservé, mais `error` est retiré', async () => {
    const r = await request(appAvec(500, { success: false, message: 'Erreur serveur lors de l’inscription', error: 'ECONNREFUSED 127.0.0.1:5432' })).get('/x');
    expect(r.body).toEqual({ success: false, message: 'Erreur serveur lors de l’inscription' });
  });

  it('4xx : message métier conservé, détail technique retiré', async () => {
    const r = await request(appAvec(400, { message: 'invalid input syntax for type uuid: "abc"', error: 'Cet email est déjà utilisé' })).get('/x');
    expect(r.body).toEqual({ message: 'Requête invalide', error: 'Cet email est déjà utilisé' });
  });

  it('les réponses < 400 et les tableaux passent intacts', async () => {
    const corps = { message: 'Sequelize ok', data: [1] };
    expect((await request(appAvec(200, corps)).get('/x')).body).toEqual(corps);
    expect((await request(appAvec(400, [1, 2])).get('/x')).body).toEqual([1, 2]);
  });

  it.each([
    'Cannot read properties of undefined (reading \'id\')',
    'connect ECONNREFUSED 127.0.0.1:5432',
    'getaddrinfo ENOTFOUND api.wave.com',
    'duplicate key value violates unique constraint "utilisateur_email_key"',
    '    at Object.<anonymous> (/app/src/services/auth.service.js:42:13)',
    'x is not a function',
  ])('reconnu technique : %s', (texte) => {
    expect(estTechnique(texte)).toBe(true);
  });

  it.each([
    'Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter.',
    'Connexion impossible : reconnectez-vous',
    'Compte désactivé. Contactez le support.',
    'Le colis doit être marqué « Livré » avant d’ajouter une preuve de livraison',
  ])('message métier NON censuré : %s', (texte) => {
    expect(estTechnique(texte)).toBe(false);
  });

  it('aucun message écrit dans le code n’est pris pour un détail technique', () => {
    // Relit chaque `message: '…'` / "…" des contrôleurs, services et
    // middlewares : un message destiné à l'utilisateur ne doit jamais être
    // remplacé par « Requête invalide » ou « Erreur serveur ».
    const racine = path.resolve(__dirname, '..');
    const messages = [];
    const parcourir = (dossier) => {
      for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
        const complet = path.join(dossier, e.name);
        if (e.isDirectory()) {
          if (!['__tests__', 'migrations', 'node_modules'].includes(e.name)) parcourir(complet);
        } else if (e.name.endsWith('.js')) {
          const src = fs.readFileSync(complet, 'utf8');
          for (const [, , texte] of src.matchAll(/message:\s*(['"])((?:(?!\1)[^\\\n]|\\.)+)\1/g)) {
            messages.push(`${texte}  (${path.relative(racine, complet)})`);
          }
        }
      }
    };
    for (const d of ['controllers', 'services', 'middlewares', 'routes']) parcourir(path.join(racine, d));
    expect(messages.length).toBeGreaterThan(150);
    const censures = messages.filter((m) => estTechnique(m.replace(/ {2}\(.*\)$/, '')));
    expect(censures).toEqual([]);
  });
});

describe('gestionnaire d’erreurs final', () => {
  function appQuiLeve(erreur) {
    const app = express();
    app.use(filtre);
    app.get('/x', () => { throw erreur; });
    app.use(errorHandler);
    return app;
  }

  it('erreur inattendue : 500 générique, sans pile ni message interne', async () => {
    const r = await request(appQuiLeve(new Error('column "foo" does not exist'))).get('/x');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('Erreur interne du serveur');
    expect(JSON.stringify(r.body)).not.toMatch(/column|foo/);
  });

  it('erreur porteuse d’un statut 4xx : statut et message conservés', async () => {
    const err = new Error('Type de fichier non autorisé');
    err.status = 400;
    const r = await request(appQuiLeve(err)).get('/x');
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Type de fichier non autorisé');
  });

  it('fichier trop volumineux (multer) : 413', async () => {
    const r = await request(appQuiLeve(new multer.MulterError('LIMIT_FILE_SIZE'))).get('/x');
    expect(r.status).toBe(413);
    expect(r.body.message).toBe('Fichier trop volumineux');
  });

  it('champ de fichier inattendu (multer) : 400', async () => {
    const r = await request(appQuiLeve(new multer.MulterError('LIMIT_UNEXPECTED_FILE'))).get('/x');
    expect(r.status).toBe(400);
  });
});
