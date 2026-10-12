# Tests du back Nanei

## Lancer

```bash
npm test                      # toute la suite (Jest), sans base ni réseau
npx jest src/__tests__/paiements.test.js   # un seul fichier
npx jest -t "webhook"         # les tests dont le nom contient « webhook »
TEST_LOGS=1 npm test          # avec les journaux winston (silencieux par défaut)
```

La CI (`.github/workflows/deploy.yml`, job `test`, Node 22) lance `npm ci && npm test` ;
le job `deploy` en dépend (`needs: test`) : aucun déploiement si un test échoue.

## Tests d'intégration (PostgreSQL réel)

Le dossier `integration/` est **sauté** tant que `NANEI_TEST_DB_NAME` n'est pas défini.
Il faut une base **jetable** : ses tables sont recréées (`sequelize.sync({ force: true })`),
et son nom doit contenir `test`, `jetable` ou `ci` (garde-fou contre une erreur de variable).

```bash
createdb nanei_test
NANEI_TEST_DB_NAME=nanei_test NANEI_TEST_DB_USER=postgres NANEI_TEST_DB_PASSWORD=… npm run test:integration
# facultatif : NANEI_TEST_DB_HOST (127.0.0.1), NANEI_TEST_DB_PORT (5432)
```

Sous PowerShell : `$env:NANEI_TEST_DB_NAME='nanei_test'; npm run test:integration`.

## Parité avec le mobile et l'admin

`parite.apiMobile.test.js` lit `C:\nanei\lib` (ou `NANEI_MOBILE_DIR`) et
`parite.apiAdmin.test.js` lit `../admin-nanei/src/api` (ou `NANEI_ADMIN_DIR`).
Dépôt absent (CI du back seul) → test **sauté**, pas en échec.
`parite.contrats.test.js` confronte les tableaux de `CONTRAT-API-*.md` aux routes montées.

## Conventions

- Un fichier par sujet : `src/__tests__/<domaine>.<sujet>.test.js`.
- **En-tête obligatoire, en français** : quel défaut le test rend impossible (et, s'il
  a été trouvé en écrivant le test, ce qui était cassé avant).
- **Aucun appel réseau réel** : `helpers/doublures.js` (chargé pour chaque fichier)
  double Resend, SMS (Twilio / Orange), R2, Firebase, Wave, Orange Money, Chromium
  (`htmlToPdf`) et `node-cron` ; `fetch` lève une erreur. Pour le vrai module :
  `jest.requireActual(...)`.
- **Aucune base réelle hors `integration/`** : modèles Sequelize doublés par
  `jest.mock('../models/…')` ou `jest.spyOn(Modele, 'findByPk')`. Jamais de requête
  qui partirait vers Postgres (pas de `sync`, pas de `findAll` non doublé).
- Application réelle : `require('../app')` + supertest. Les limiteurs de débit sont
  neutralisés par un `jest.mock` en **Proxy** (tout limiteur, même ajouté demain,
  devient un passe-plat).
- Les listes de routes ne s'écrivent pas à la main : `helpers/routesMontees.js`
  relit `app.js` et la pile Express de chaque routeur (`auth` / `isAdmin` reconnus par
  identité de fonction).
- Environnement de test : `helpers/env.js` (secrets JWT de test, aucun identifiant
  de service externe, rapports dans un dossier temporaire).
- Garde-fou dans chaque test « par lecture de fichiers » : vérifier d'abord que la
  table lue n'est pas vide (sinon le test passerait sans rien vérifier).
