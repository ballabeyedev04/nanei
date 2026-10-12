'use strict';

/**
 * `npm run test:integration:local` — tests d'intégration sur un VRAI
 * PostgreSQL 16 (même version majeure que la production), sans Docker ni
 * installation : le paquet `embedded-postgres` (devDependency) fournit le
 * binaire officiel.
 *
 *   1. démarre un cluster jetable (dossier .tmp-pg/, port libre) ;
 *   2. vérifie les migrations sur une base vide (scripts/verifier-migrations.js) ;
 *   3. lance src/__tests__/integration (base nanei_test, recréée par les tests) ;
 *   4. arrête le cluster et supprime ses fichiers, même en cas d'échec.
 *
 * La chaîne de déploiement fait la même chose avec un service postgres:16-alpine
 * (.github/workflows/deploy.yml, étape 2b).
 *
 * Variables facultatives : NANEI_PG_PORT (défaut : port libre choisi par le système).
 */

const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');

function portLibre() {
  return new Promise((resoudre, rejeter) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', rejeter);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resoudre(port));
    });
  });
}

function lancer(titre, args, env) {
  console.log(`\n=== ${titre} ===`);
  const r = spawnSync(process.execPath, args, { cwd: RACINE, env: { ...process.env, ...env }, stdio: 'inherit' });
  return r.status === 0;
}

(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const port = Number(process.env.NANEI_PG_PORT) || await portLibre();
  const motDePasse = crypto.randomBytes(12).toString('hex');
  const dossier = path.join(RACINE, '.tmp-pg', `cluster-${Date.now()}`);
  fs.mkdirSync(path.dirname(dossier), { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dossier,
    user: 'postgres',
    password: motDePasse,
    port,
    persistent: false, // stop() supprime les fichiers du cluster
    initdbFlags: ['--encoding=UTF8', '--locale=C'], // comme docker-compose.prod.yml
    onLog: () => {},
  });

  let ok = false;
  try {
    console.log(`PostgreSQL jetable : 127.0.0.1:${port} (${dossier})`);
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('nanei_migrations_ci');
    await pg.createDatabase('nanei_test');

    const base = { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'postgres', DB_PASSWORD: motDePasse, DB_SSL_CA: '' };

    const migrationsOk = lancer('Migrations sur base vide', [path.join('scripts', 'verifier-migrations.js')], {
      ...base, DB_NAME: 'nanei_migrations_ci', NODE_ENV: 'development',
    });

    const testsOk = lancer('Tests d\'intégration', [
      require.resolve('jest/bin/jest', { paths: [RACINE] }), 'src/__tests__/integration', '--runInBand',
    ], {
      NANEI_TEST_DB_NAME: 'nanei_test',
      NANEI_TEST_DB_HOST: '127.0.0.1',
      NANEI_TEST_DB_PORT: String(port),
      NANEI_TEST_DB_USER: 'postgres',
      NANEI_TEST_DB_PASSWORD: motDePasse,
    });

    ok = migrationsOk && testsOk;
  } catch (err) {
    console.error(`\n❌ ${err && err.stack ? err.stack : err}`);
  } finally {
    try { await pg.stop(); } catch (e) { console.error(`Arrêt de PostgreSQL : ${e.message}`); }
    fs.rmSync(dossier, { recursive: true, force: true });
  }

  console.log(ok ? '\n✅ Intégration locale : tout est vert' : '\n❌ Intégration locale : échec');
  process.exit(ok ? 0 : 1);
})();
