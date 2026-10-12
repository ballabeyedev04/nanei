'use strict';

/**
 * Vérifie les migrations sur une base PostgreSQL RÉELLE et JETABLE.
 *
 * Utilisé par `npm run test:integration:local` (scripts/test-integration-local.js)
 * et par la chaîne de déploiement (.github/workflows/deploy.yml, étape 2b).
 *
 *   1. `db:migrate` sur une base VIDE (nouvelle installation) doit réussir ;
 *   2. relancé aussitôt, il ne doit rien rester à appliquer (aucune ligne
 *      « down » dans `db:migrate:status`) ;
 *   3. le schéma obtenu doit être accepté par l'application : on charge tous
 *      les modèles et on vérifie que chaque colonne déclarée existe en base
 *      (sinon le premier SELECT du serveur tomberait en erreur 500).
 *
 * Variables : DB_NAME (doit contenir « test », « jetable » ou « ci » — garde-
 * fou, la base est modifiée), DB_HOST, DB_PORT, DB_USER, DB_PASSWORD.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const CLI = require.resolve('sequelize-cli/lib/sequelize', { paths: [RACINE] });

function sequelizeCli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: RACINE,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
    encoding: 'utf8',
  });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) throw new Error(`sequelize-cli ${args.join(' ')} : code ${r.status}`);
  return r.stdout || '';
}

async function verifierSchema() {
  const fs = require('fs');
  const dossier = path.join(RACINE, 'src', 'models');
  require(path.join(dossier, 'index.js'));
  for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith('.model.js'))) require(path.join(dossier, f));
  const sequelize = require(path.join(RACINE, 'src', 'config', 'db'));
  const qi = sequelize.getQueryInterface();
  const manques = [];
  try {
    for (const modele of Object.values(sequelize.models)) {
      const table = modele.getTableName();
      let colonnes;
      try {
        colonnes = await qi.describeTable(table);
      } catch {
        manques.push(`table ${table} absente`);
        continue;
      }
      for (const attr of Object.values(modele.rawAttributes)) {
        if (attr.type && attr.type.key === 'VIRTUAL') continue;
        if (!colonnes[attr.field]) manques.push(`${table}.${attr.field}`);
      }
    }
  } finally {
    await sequelize.close();
  }
  return manques;
}

(async () => {
  const nom = process.env.DB_NAME || '';
  if (!/test|jetable|ci/i.test(nom)) {
    throw new Error(`DB_NAME="${nom}" : le nom doit contenir « test », « jetable » ou « ci » (la base est modifiée).`);
  }

  console.log(`\n[migrations] 1/3 — db:migrate sur la base « ${nom} »`);
  sequelizeCli(['db:migrate']);

  console.log('\n[migrations] 2/3 — plus rien à appliquer');
  const statut = sequelizeCli(['db:migrate:status']);
  if (/^\s*down\b/m.test(statut)) throw new Error('des migrations restent « down » après db:migrate');
  sequelizeCli(['db:migrate']);

  console.log('\n[migrations] 3/3 — chaque colonne des modèles existe en base');
  const manques = await verifierSchema();
  if (manques.length) {
    throw new Error(`colonnes / tables attendues par les modèles mais absentes après migration :\n  - ${manques.join('\n  - ')}`);
  }
  console.log('[migrations] ✅ migrations vérifiées sur base vide');
})().catch((err) => {
  console.error(`\n[migrations] ❌ ${err.message}`);
  process.exit(1);
});
