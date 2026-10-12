'use strict';

/**
 * Toute route montée exige-t-elle une authentification ?
 *
 * ## Le défaut que ce test rend impossible
 *
 * Ajouter une route est une ligne ; oublier `auth` (ou `isAdmin` sous
 * /nanei/admin) dans cette ligne en est une autre — et rien ne le signale :
 * la route répond, l'admin et le mobile fonctionnent. Elle est simplement
 * ouverte à tout le monde (cas réel corrigé avant cette suite : la route de
 * test publique GET /nanei/admin/hello, et des doublons de /nanei/messages
 * qui contournaient la garde admin).
 *
 * ## Comment
 *
 * La table est reconstruite depuis app.js et la pile Express de chaque
 * routeur (helpers/routesMontees.js) : `auth` et `isAdmin` sont reconnus par
 * IDENTITÉ de fonction, qu'ils soient passés sur la route ou par
 * `router.use(...)` avant elle.
 *
 * ## Les routes publiques
 *
 * Listées nommément, avec leur raison : une route publique n'est pas un
 * oubli, c'est une décision, et elle doit s'écrire comme telle.
 */

const fs = require('fs');
const path = require('path');
const { routesMontees, montages, SRC } = require('./helpers/routesMontees');

const PUBLIQUES = new Map([
  // ── Entrer dans l'application ───────────────────────────────────────────
  ['POST /nanei/auth/register', 'création de compte : aucun jeton à présenter encore'],
  ['POST /nanei/auth/login', 'point d’entrée (limité à 5 essais / 15 min / IP)'],
  ['POST /nanei/auth/refresh', 'renouvellement : le jeton d’accès est justement expiré ; protégé par le refresh token (empreinte en base, rotation)'],
  ['POST /nanei/auth/logout', 'doit aboutir même jeton d’accès périmé ; ne fait que révoquer le refresh token présenté'],

  // ── Reprendre la main sur un compte (par définition sans session) ────────
  ['POST /nanei/auth/oublier-password', 'mot de passe oublié client : réponse générique (pas d’énumération), limites par IP et par e-mail'],
  ['POST /nanei/auth/reset-password', 'porté par le code OTP reçu par e-mail (haché, 3 essais puis blocage)'],
  ['POST /nanei/admin/forgot-password', 'mot de passe oublié admin : réponse générique à temps constant'],
  ['POST /nanei/admin/reset-password', 'porté par un jeton de réinitialisation signé (10 min) dont l’empreinte est en base'],

  // ── Lu ou écrit sans compte ──────────────────────────────────────────────
  ['POST /nanei/messages', 'formulaire de contact du support, ouvert aux visiteurs ; la lecture et la réponse n’existent que sous /nanei/admin/messages'],
  ['GET /nanei/suivi/:reference', 'page de suivi du QR code de l’étiquette, lisible par n’importe quel lecteur QR ; référence aléatoire non séquentielle, téléphones masqués, 30 req / 15 min / IP'],
  ['POST /nanei/pricing/calculate', 'simulateur de prix : la grille tarifaire n’est pas confidentielle'],
  ['GET /nanei/pricing/taux-change', 'taux EUR → FCFA affiché avant connexion'],

  // ── Appelées par un opérateur ou un navigateur, pas par l’application ────
  ['GET /nanei/paiements/retour', 'redirection du navigateur après paiement ; ne valide JAMAIS un paiement sur la foi de l’URL (vérification auprès de Wave)'],
  ['POST /nanei/paiements/webhook/wave', 'appelé par Wave : authentifié par signature HMAC sur le corps brut'],
  ['POST /nanei/paiements/webhook/orange_money', 'appelé par Orange Money : authentifié par signature HMAC sur le corps brut'],
]);

/** Seuls paramètres tolérés sur une route publique : non devinables, avec raison. */
const PARAMETRES_PUBLICS_TOLERES = new Set(['GET /nanei/suivi/:reference']);

const toutes = routesMontees();
const cle = (r) => `${r.methode} ${r.chemin}`;

describe('authentification des routes', () => {
  it('la table des routes est bien reconstruite', () => {
    // Garde-fou du test lui-même : une table vide ferait passer les
    // assertions suivantes sans rien vérifier.
    expect(toutes.length).toBeGreaterThan(100);
    expect(toutes.some((r) => r.auth)).toBe(true);
  });

  it('chaque route exige un jeton, sauf celles listées comme publiques', () => {
    const ouvertes = toutes.filter((r) => !r.auth && !PUBLIQUES.has(cle(r))).map((r) => `${cle(r)}  (${r.fichier})`);
    expect(ouvertes).toEqual([]);
  });

  it('chaque route /nanei/admin/** authentifiée exige aussi le rôle Admin (isAdmin)', () => {
    const sansAdmin = toutes
      .filter((r) => r.chemin.startsWith('/nanei/admin/') && r.auth && !r.admin)
      .map((r) => `${cle(r)}  (${r.fichier})`);
    expect(sansAdmin).toEqual([]);
  });

  it('aucune route publique ne porte de garde admin ou d’auth inutile (la liste est exacte)', () => {
    const publiquesProtegees = toutes.filter((r) => PUBLIQUES.has(cle(r)) && r.auth).map(cle);
    expect(publiquesProtegees).toEqual([]);
  });

  it('la liste des routes publiques ne contient rien de périmé', () => {
    const declarees = new Set(toutes.map(cle));
    const orphelines = [...PUBLIQUES.keys()].filter((c) => !declarees.has(c));
    expect(orphelines).toEqual([]);
  });

  it('aucune route publique ne porte d’identifiant de ressource (sauf exception nommée)', () => {
    const parametrees = [...PUBLIQUES.keys()].filter((c) => c.includes('/:') && !PARAMETRES_PUBLICS_TOLERES.has(c));
    expect(parametrees).toEqual([]);
  });

  it('les webhooks publics passent tous par la vérification de signature', () => {
    const src = fs.readFileSync(path.join(SRC, 'routes', 'client', 'paiement.route.js'), 'utf8');
    const webhooks = [...src.matchAll(/router\.post\(\s*'(\/webhook\/[^']+)'\s*,\s*([^\n]+)/g)];
    expect(webhooks.length).toBe(2);
    for (const [, , suite] of webhooks) {
      expect(suite).toMatch(/^validateWebhookSignature\('(wave|orange_money)'\)/);
    }
  });

  it('app.js ne déclare directement qu’une seule route, publique : GET /health', () => {
    // Sonde de l'orchestrateur (Docker / deploy/release.sh) : ne renvoie que
    // { status: 'OK' }. Toute autre route doit passer par un routeur, donc
    // par les contrôles ci-dessus.
    const src = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
    const directes = [...src.matchAll(/app\.(get|post|put|patch|delete|all)\(\s*'([^']+)'/g)].map(([, m, c]) => `${m.toUpperCase()} ${c}`);
    expect(directes).toEqual(['GET /health']);
  });

  it('chaque fichier de routes non vide est monté dans app.js', () => {
    // Un routeur écrit mais jamais monté est du code mort qui laisse croire
    // qu'une route existe (voir parite.api*.test.js pour l'autre sens).
    const montes = new Set(montages().map((m) => m.fichier));
    const fichiers = [];
    const parcourir = (dossier) => {
      for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
        const complet = path.join(dossier, e.name);
        if (e.isDirectory()) parcourir(complet);
        else if (e.name.endsWith('.js') && fs.readFileSync(complet, 'utf8').trim()) fichiers.push(require.resolve(complet));
      }
    };
    parcourir(path.join(SRC, 'routes'));
    const nonMontes = fichiers.filter((f) => !montes.has(f)).map((f) => path.relative(SRC, f));
    expect(nonMontes).toEqual([]);
  });
});
