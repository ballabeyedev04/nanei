# Contrat d’API — Back-office admin Nanei / Franco Mali Ship

> Rédigé le 2026-10-11 **à partir du code** du back (`nanei/src` : `app.js`, routes, middlewares, contrôleurs, services, modèles Sequelize) et de l’admin React (`admin-nanei/src` : `api/*.ts`, écrans `features/*`, `types/index.ts`). Mis à jour le même jour après la correction des 12 points prioritaires (Annexe B.0), puis après une **deuxième vérification complète** de chaque appel de l’admin (Annexe B.5, 27 problèmes corrigés), puis le 2026-10-12 après la correction des derniers points et l’ajout de la **pagination** (Annexe B.6). Il ne s’agit **pas** d’exemples capturés sur une API réelle : les formes de réponse sont déduites du code. Les points marqués **⚠️ À vérifier** n’ont pas pu être confirmés par lecture seule.
>
> **Périmètre :** toutes les routes `/nanei/admin/*`, plus les routes `/nanei/auth/*` et `/nanei/account/*` utilisées par l’admin pour la connexion et le profil. L’application mobile a son propre contrat : `CONTRAT-API-MOBILE.md`.

## Mode d’emploi pour l’IA ou le développeur qui vérifie

1. Lire d’abord la section **0. Conventions** : elle s’applique à toutes les routes. Il n’y a **pas d’enveloppe de réponse uniforme** : chaque route a sa propre forme, décrite route par route.
2. Sous chaque route, la ligne **« Admin : »** indique quelle fonction de `admin-nanei/src/api/*.ts` (ou quel écran) l’appelle. « Non appelée par l’admin » signale une route du back que l’interface n’utilise pas.
3. Les noms de champs **mélangent camelCase et snake_case** selon les routes (`montantPaye`, `entite_id`, `commentaire_admin`…). Ne pas « corriger » un nom : utiliser celui indiqué. C’est la première cause des écarts listés en Annexe B.
4. Les statuts sont des **codes sans accent** (`en_attente`, `recupere`, `livre`, `resolue`…), sauf le type de réclamation `endommagé`, **avec** accent.
5. L’**Annexe B — Écarts constatés** liste tous les désaccords admin ↔ back et les risques de sécurité, avec les fichiers et lignes concernés des deux côtés. Elle commence par un tableau des corrections prioritaires.

## Sommaire

- [0. Conventions communes](#0-conventions-communes)
- [1. Authentification admin](#1-authentification-admin) — 8 routes
- [2. Administrateurs](#2-administrateurs) — 6 routes
- [3. Clients (utilisateurs)](#3-clients-utilisateurs) — 6 routes
- [4. Journal d’audit](#4-journal-daudit) — 1 route
- [5. Messages du support](#5-messages-du-support) — 3 routes
- [6. Colis](#6-colis) — 12 routes
- [7. Étiquettes](#7-étiquettes) — 1 route
- [8. Preuves de livraison](#8-preuves-de-livraison) — 2 routes
- [9. Avis](#9-avis) — 1 route
- [10. Réclamations](#10-réclamations) — 2 routes
- [11. Exports](#11-exports) — 2 routes
- [12. Pays](#12-pays) — 5 routes
- [13. Tarifs de transport](#13-tarifs-de-transport) — 11 routes
- [14. Tarifs des services (récupération, livraison)](#14-tarifs-des-services-récupération-livraison) — 10 routes
- [15. Taux de change](#15-taux-de-change) — 3 routes
- [16. Paiements](#16-paiements) — 3 routes
- [17. Rapports et tableau de bord](#17-rapports-et-tableau-de-bord) — 3 routes
- [Annexe A — Énumérations métier](#annexe-a--énumérations-métier)
- [Annexe B — Écarts constatés et points de vigilance](#annexe-b--écarts-constatés-et-points-de-vigilance)

---

## 0. Conventions communes

### URL de base

- Toutes les routes sont préfixées par **`/nanei`** : `https://<domaine-api>/nanei/...`.
- Côté admin, `VITE_API_URL` **contient déjà** `/nanei` (`.env` : `https://api.app-nanei.com/nanei`). Valeur par défaut si absente : `/nanei` (`src/api/axios.ts:5`). Les chemins de l’admin commencent donc par `/auth`, `/account`, `/admin`.
- Les en-têtes autorisés par CORS sont `Content-Type` et `Authorization` uniquement. Origines : variable `CORS_ORIGIN` (liste séparée par des virgules).

### Santé et version du contrat (garde de déploiement)

- `GET /health` (hors préfixe `/nanei`, publique) → `200 { "status": "OK", "db": "ok", "version": "<sha du commit | dev>", "api": <entier> }`, ou `503 { "status": "KO", "db": "erreur" }` si la base est injoignable. `api` = version du contrat d’API (`src/config/version.js`, `API_VERSION`) : incrémentée quand une modification du back casse le contrat de l’admin ou du mobile.
- **Garde de déploiement de l’admin** : avant de se déployer, l’admin lit `api` sur `https://<domaine-api>/health` et **refuse** de partir si `api` est inférieur à sa constante minimale (back pas encore à jour) ou si la sonde ne répond pas `200`.
- Règle côté back : `API_VERSION` est incrémentée dans le même commit qu’un changement qui casse ou étend de façon nécessaire ce contrat (route retirée / renommée, champ retiré / renommé, champ devenu obligatoire, nouvelle route requise par l’admin) ; jamais décrémentée. Valeur actuelle : **2**.

### Jeton

- Chaque appel protégé envoie `Authorization: Bearer <token>` (ajouté par l’intercepteur de `src/api/axios.ts`).
- Le jeton est rangé dans le store Zustand persistant `nanei-admin-auth` (localStorage) : `{ user, token, refreshToken }`.
- Durée du jeton d’accès : **1 heure** (`JWT_EXPIRES_IN`, défaut `1h`). Refresh token : 7 jours.
- Le back vérifie à chaque appel (`auth.middleware.js`) : jeton valide, utilisateur existant, compte `actif`, jeton émis **après** le dernier `passwordChangedAt`.

### Rôles

| Rôle | Valeur `role` | Ce qu’il peut faire |
|---|---|---|
| Administrateur | `Admin` | toutes les routes `/nanei/admin/*` (sauf routes publiques ci-dessous) |
| Client | `Particulier` | aucune route admin (403) |

- Il n’existe **pas** de super-admin : l’énumération est `ENUM('Admin', 'Particulier')` (`utilisateur.model.js:38`). Tout admin peut créer, activer ou désactiver un autre admin.
- Middleware `isAdmin` (`isAdmin.middlewares.js`) : refuse si `req.user.role !== 'Admin'` → **403** `{ "success": false, "message": "Accès refusé" }`. Il est toujours placé **après** `auth.middleware`.
- `role.middleware.js` (`roleMiddleware`) existe mais n’est utilisé par aucune route de ce périmètre.
- Côté admin, le rôle est aussi vérifié dans le navigateur : à la connexion (`LoginPage.tsx:26`), au démarrage (`useAuthGuard.ts`, via `GET /account/me`) et dans le routeur (`store.isAdmin()`).

### Pagination des listes

Toutes les routes de liste acceptent `?page=N&limit=M` (page ≥ 1 ; `limit` 20 par défaut, 100 maximum ; `utils/pagination.js`).

- **Avec `page` ou `limit`** : la liste est paginée et la réponse contient en plus `"pagination": { "page": 2, "limit": 20, "total": 137, "pages": 7 }` (`pages` ≥ 1).
- **Sans ces paramètres** : liste complète, réponse identique à avant. Les versions de l’app mobile déjà installées continuent de fonctionner.

La clé de la liste ne change pas (`colis`, `data`, `avis`, `reclamations`, `logs`, `rapports`, `contacts`…). Les recherches (`q`) et filtres (`statut`, `note`) sont appliqués **côté serveur, avant la pagination**.

### Limitation de débit

| Limiteur | Où | Quota | Clé | Message 429 |
|---|---|---|---|---|
| `authenticatedRateLimit` | toute l’API | 300 req / 15 min | utilisateur du jeton (sinon IP) | `{ "message": "Trop de requêtes. Veuillez réessayer dans quelques minutes." }` |
| `adminRateLimit` | tout `/nanei/admin/*` | 200 req / 15 min | IP | `{ "success": false, "message": "Trop de requêtes admin. Veuillez réessayer." }` |
| `authRateLimit` | `/auth/login` | **5 req / 15 min** | IP | `{ "message": "Trop de tentatives. Veuillez réessayer dans 15 minutes." }` |
| `refreshRateLimit` | `/auth/refresh` | 30 req / 15 min | IP | `{ "message": "Trop de renouvellements de session. Veuillez réessayer dans quelques minutes." }` |
| `motDePasseRateLimit` | `/auth/oublier-password`, `/auth/reset-password`, `/admin/forgot-password`, `/admin/reset-password` | 5 req / 15 min | IP | `{ "message": "Trop de tentatives. Veuillez réessayer dans 15 minutes." }` |
| `mutationRateLimit` | `PUT /account/modifier-profil`, `PUT /account/change-password` | 20 req / 15 min | IP | `{ "success": false, "message": "Trop de requêtes. Veuillez réessayer dans 15 minutes." }` |

> Chaque limiteur a **son propre compteur** : renouveler la session ne consomme plus les essais de connexion (avant, une seule instance de 5 / 15 min était partagée par login, refresh et mots de passe oubliés).
> En-têtes standard `RateLimit-*` (pas de `X-RateLimit-*`).

### Forme des réponses

Pas d’enveloppe commune. Dans ce périmètre :

| Forme | Routes |
|---|---|
| `{ token, refreshToken, utilisateur }` | `POST /auth/login` |
| `{ utilisateur }` / `{ message, utilisateur }` | `GET /account/me`, `PUT /account/modifier-profil` |
| `{ success, message, data }` | admins (liste, ajout, activation), clients (activation) |
| `{ success, data }` | admins (nombre), clients (recherche), messages (liste) |
| `{ success, total, data }` | clients (liste) |
| `{ success, total }` | clients (nombre), messages (stats) |
| `{ success, total, page, pages, logs }` | journal d’audit |
| **tableau nu** `[ … ]` | `GET /admin/rechercher-admin` |
| `{ success, message }` | mots de passe oubliés admin |

### Erreurs

| Code | Quand | Corps |
|---|---|---|
| 400 | Validation Joi (routes `/auth`, `/account` seulement) | `{ "message": "Données invalides", "details": [ "…" ] }` |
| 400 | Erreur métier | `{ "success": false, "message": "…" }` (parfois avec `error`) ou `{ "message": "…" }` |
| 401 | Jeton absent / mal formé | `{ "message": "Token manquant ou invalide" }` |
| 401 | Jeton expiré ou signature invalide | `{ "message": "Token invalide" }` |
| 401 | Jeton émis avant un changement de mot de passe | `{ "message": "Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter." }` |
| 403 | Compte désactivé | `{ "message": "Compte désactivé. Contactez le support." }` |
| 403 | Rôle ≠ `Admin` | `{ "success": false, "message": "Accès refusé" }` |
| 404 | Utilisateur du jeton supprimé | `{ "message": "Utilisateur introuvable" }` |
| 429 | Débit dépassé | voir tableau ci-dessus |
| 500 | Erreur interne interceptée | `{ "success": false, "message": "Erreur serveur…", "error": "<détail technique>" }` |
| 500 | Erreur non interceptée (`errorHandler`) | `{ "success": false, "message": "Erreur interne du serveur", "error": "Erreur interne du serveur" }` |

> Les routes `/nanei/admin/*` de ce périmètre n’ont **aucune validation Joi** : les contrôles sont faits à la main dans les contrôleurs et services.
> Pas de code d’erreur stable : brancher la logique sur le **code HTTP**.

### Session côté admin (401, refresh)

1. Connexion : `POST /auth/login`. L’admin garde `token`, `refreshToken` et `utilisateur` (`LoginPage.tsx`).
2. **Renouvellement automatique** (`api/axios.ts`, `renouvelerJeton`) : une réponse **401** sur une route protégée déclenche `POST /auth/refresh` avec le refresh token, puis rejoue la requête **une fois**. Un seul renouvellement à la fois (requête partagée) : le back fait tourner le refresh token, deux renouvellements simultanés se déconnecteraient l’un l’autre. Le renouvellement passe par un client sans intercepteur (pas de boucle).
3. Déconnexion forcée (retour à `/nanei/admin/login`) seulement si :
   - le renouvellement est refusé (400 / 401 sur `/auth/refresh`) ;
   - ou un **403** indique une session refusée (« Compte désactivé… », « Accès refusé »).
   Les autres 403, les 402, 404, 409, les erreurs 5xx, les délais dépassés et les coupures réseau **ne déconnectent plus** : l’écran affiche l’erreur.
4. Au démarrage, `useAuthGuard` appelle `GET /account/me` (renouvelé si besoin). Seuls 401, 403 ou 404 après renouvellement, ou un rôle ≠ `Admin`, vident la session. Serveur injoignable ou 5xx : la session est conservée.
5. Déconnexion volontaire : `POST /auth/logout` avec le **vrai** refresh token (révoqué côté serveur), puis vidage du store.
6. Délais : 15 s par défaut ; 60 s pour les exports, les étiquettes et l’envoi de preuve ; 120 s pour la génération de rapport.

> Conséquence : la session admin dure tant que le refresh token est valide (**7 jours** sans activité), au lieu d’1 heure.
> **Plusieurs onglets** partagent la même session (stockage local commun) : un changement fait par un onglet est relu par les autres (événement `storage`), et un verrou du navigateur (Web Locks) empêche deux onglets de renouveler en même temps. Avant de renouveler, l’onglet vérifie si un autre l’a déjà fait. Avant ce correctif, le renouvellement d’un onglet déconnectait les autres (refresh token tourné, donc révoqué).
> Un 429 ou une panne pendant le renouvellement ne déconnecte pas : l’écran affiche l’erreur.

---

## 1. Authentification admin

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/auth/login` | public (5 req / 15 min / IP) |
| POST | `/nanei/auth/refresh` | public (5 req / 15 min / IP) |
| POST | `/nanei/auth/logout` | public |
| GET | `/nanei/account/me` | jeton (tout rôle) |
| PUT | `/nanei/account/modifier-profil` | jeton (tout rôle) |
| PUT | `/nanei/account/change-password` | jeton (tout rôle) |
| POST | `/nanei/admin/forgot-password` | public (5 req / 15 min / IP) |
| POST | `/nanei/admin/reset-password` | public (5 req / 15 min / IP) |

#### `POST /nanei/auth/login`

- **Accès :** public. Route commune au mobile et à l’admin : le back **ne filtre pas** sur le rôle.

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `identifiant` | string | **oui** | e-mail **ou** téléphone ; espaces retirés |
| `mot_de_passe` | string | **oui** | — |

**Réponse 200 :** `{ "token": "…", "refreshToken": "…", "utilisateur": { id, nom, prenom, email, adresse, telephone, role, statut, photoProfil } }`.

**Erreurs :** 400 « Données invalides » (Joi) · 400 « Identifiant ou mot de passe incorrect » · 400 « Compte désactivé. Contactez le support. » (seulement avec le bon mot de passe) · 429 « Trop de tentatives. Veuillez réessayer dans 15 minutes. » · 500 « Erreur serveur ».

> L’admin refuse lui-même un `utilisateur.role` ≠ `Admin` (message « Accès réservé aux administrateurs » côté écran).

**Admin :** `authApi.login({ identifiant: email, mot_de_passe })` (`src/api/auth.ts:5`), appelée par `LoginPage.tsx:24`. Lit `token` et `utilisateur`.

---

#### `POST /nanei/auth/refresh`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `refreshToken` | string | **oui** | — |

**Réponse 200 :** `{ "token": "…", "refreshToken": "…" }` (rotation : l’ancien est révoqué). Le rôle mis dans les jetons est relu en base.

**Contrôles :** refresh token connu, non révoqué, non expiré, signature valide ; **compte existant et actif** ; refresh token émis **après** le dernier changement de mot de passe (`passwordChangedAt`). Sinon 401 et le refresh token est révoqué.

**Erreurs :** 400 « Données invalides » · 401 « Refresh token invalide ou révoqué » · 401 « Refresh token expiré » · 401 « Refresh token invalide » · 401 « Session expirée, veuillez vous reconnecter » · 429 (`refreshRateLimit`, 30 / 15 min / IP) · 500 « Erreur serveur ».

**Admin :** `renouvelerJeton()` (`src/api/axios.ts`), automatiquement sur un 401 (voir « Session côté admin »).

---

#### `POST /nanei/auth/logout`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `refreshToken` | string | non | `""` et `null` acceptés |

**Réponse 200 :** `{ "message": "Déconnexion réussie" }`. Le refresh token envoyé est révoqué s’il est fourni.

**Erreurs :** 500 « Erreur serveur ».

**Admin :** `authApi.logout('')` (`src/api/auth.ts:8`), appelée par `DashboardLayout.tsx:40` avec une **chaîne vide** : rien n’est révoqué.

---

#### `GET /nanei/account/me`

**Réponse 200 :** `{ "utilisateur": { id, nom, prenom, email, adresse, telephone, role, statut, photoProfil } }`.

**Erreurs :** 401 / 403 / 404 (voir conventions) · 500 « Erreur serveur ».

**Admin :** `authApi.me()` (`src/api/auth.ts:11`), appelée par `useAuthGuard.ts:22`. Lit `utilisateur.role`.

---

#### `PUT /nanei/account/modifier-profil`

- **Format :** JSON ou `multipart/form-data` (fichier facultatif `photoProfil`).

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `nom` | string | non | 2 à 50 car. |
| `prenom` | string | non | 2 à 50 car. |
| `email` | string | non | e-mail valide, mis en minuscules ; unique |
| `adresse` | string | non | max 200 car. ; `""` accepté |
| `telephone` | string | non | `^\+?[0-9\s\-\.]{7,20}$` ; `""` accepté (ignoré) ; unique |

**Réponse 200 :** `{ "message": "Profil modifié avec succès", "utilisateur": { … } }`.

**Erreurs :** 400 « Données invalides » · 400 « Cet email est déjà utilisé » · 400 « Ce numéro de téléphone est déjà utilisé » · 400 « Utilisateur non trouvé » · 429 · 500 « Erreur serveur lors de la modification du profil ».

> Un `telephone` vide ne vide pas le numéro : il est simplement ignoré.

**Admin :** `authApi.updateProfile({ nom, prenom, telephone, adresse })` (`src/api/auth.ts:14`), appelée par `ProfilePage.tsx:43`. Lit `utilisateur` (ou `user`).

---

#### `PUT /nanei/account/change-password`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `oldPassword` | string | **oui** | mot de passe actuel |
| `newPassword` | string | **oui** | 8 à 128 car., au moins 1 minuscule, 1 majuscule, 1 chiffre |

**Réponse 200 :** `{ "message": "Mot de passe modifié avec succès.", "token": "…", "refreshToken": "…" }`.

> **Toutes les autres sessions sont coupées** : `passwordChangedAt` est mis à jour et tous les refresh tokens du compte sont révoqués. La session en cours reçoit de nouveaux jetons dans la réponse ; le client doit les enregistrer, sinon il est déconnecté au prochain appel. L’admin et l’app mobile (version suivante) les enregistrent.

**Erreurs :** 400 « Données invalides » (+ `details`) · 400 « Mot de passe actuel incorrect. » · 400 « Utilisateur non trouvé. » · 429 · 500 « Erreur serveur lors du changement de mot de passe ».

**Admin :** `authApi.changePassword({ ancienMotDePasse, nouveauMotDePasse })` (`src/api/auth.ts`), qui envoie `{ oldPassword, newPassword }`. `ProfilePage` enregistre `token` et `refreshToken` (`setTokens`) et affiche le détail des erreurs de validation.

---

#### `POST /nanei/admin/forgot-password`

- **Accès :** public. Réservé aux comptes `Admin` actifs (`/auth/oublier-password` répond pour un admin la même réponse générique que pour un e-mail inconnu, sans rien envoyer : il ne révèle pas quelles adresses sont celles des administrateurs).

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `email` | string | **oui** | chaîne non vide (pas de contrôle de format) |

**Réponse 200 (toujours, même si l’e-mail est inconnu) :** `{ "success": true, "message": "Si cet email correspond à un compte administrateur actif, un lien de réinitialisation vous a été envoyé." }`.

**Erreurs :** 400 « L'adresse email est requise. » · 429 · 500 « Erreur serveur. Veuillez réessayer dans quelques instants. »

> Le lien envoyé est `${FRONTEND_URL}/nanei/admin/reset-password?token=<jwt>`, valable **10 minutes**. Temps de réponse minimum 400 ms (anti-énumération).

**Admin :** `authApi.adminForgotPassword(email)` (`src/api/auth.ts`), appelée par `ForgotPasswordPage`. « E-mail envoyé » ne s’affiche que sur une réponse 200 ; un 429, une erreur serveur ou une panne réseau affiche un message d’erreur (avant : « envoyé » dans tous les cas).

---

#### `POST /nanei/admin/reset-password`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `token` | string | **oui** | jeton reçu par e-mail |
| `mot_de_passe` | string | **oui** | min 8 car., 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère parmi `!@#$%^&*` |

**Réponse 200 :** `{ "success": true, "message": "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter." }`. Toutes les sessions déjà ouvertes sont coupées : jetons d’accès refusés (`passwordChangedAt`) **et refresh tokens révoqués** (avant : les refresh tokens restaient valables).

> La page `/nanei/admin/reset-password` est accessible même si une session admin est ouverte dans le navigateur (elle était sous `RequireGuest`, le lien redirigeait vers le tableau de bord). Après succès, la session locale est vidée.

**Erreurs (400, `{ success: false, message }`) :** « Token de réinitialisation manquant. » · « Le nouveau mot de passe est requis. » · « Lien de réinitialisation invalide ou expiré. Veuillez faire une nouvelle demande. » · « Token non autorisé pour cette opération. » · « Compte introuvable. » · « Opération non autorisée pour ce type de compte. » · « Votre compte est désactivé. Contactez le support. » · « Le mot de passe doit contenir au moins 8 caractères. » · « … au moins une lettre majuscule. » · « … au moins une lettre minuscule. » · « … au moins un chiffre. » · « … au moins un caractère spécial (!@#$%^&*). » — puis 429 · 500.

**Admin :** `authApi.adminResetPassword({ token, mot_de_passe })` (`src/api/auth.ts:31`), appelée par `ResetPasswordPage.tsx:48`. Un 400 dont le message contient « expiré » ou « invalide » affiche l’écran « lien invalide ».

---

## 2. Administrateurs

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/liste-admins` | jeton **Admin** |
| POST | `/nanei/admin/ajouter-admin` | jeton **Admin** (journalisé `CREATE` / `Admin`) |
| PUT | `/nanei/admin/activer-admin/:id` | jeton **Admin** (journalisé `ACTIVATE` / `Admin`) |
| PUT | `/nanei/admin/desactiver-admin/:id` | jeton **Admin** (journalisé `DEACTIVATE` / `Admin`) |
| GET | `/nanei/admin/nombre-admins` | jeton **Admin** |
| GET | `/nanei/admin/rechercher-admin` | jeton **Admin** |

#### `GET /nanei/admin/liste-admins`

Pas de pagination ni de filtre. L’admin connecté est **exclu** de la liste.

**Réponse 200 :** `{ "success": true, "message": "Liste des admins récupérée avec succès", "data": [ { id, nom, prenom, email, adresse, telephone, role, statut, photoProfil, createdAt, updatedAt, deletedAt } ] }`. Liste vide → `message: "Aucun admin trouvé"`.

**Erreurs :** 401 · 403 · 500 « Erreur serveur lors de la récupération des admins ». Une erreur base renvoie **500** `{ success: false, message: "Erreur lors de la récupération des admins" }` (le détail technique est retiré).

> **Champs privés jamais renvoyés** (toutes routes, admin et client) : `mot_de_passe`, `resetPasswordToken`, `resetPasswordExpires`, `passwordChangedAt`, `otpCode`, `otpExpires`, `fcm_token`. Ils sont exclus des requêtes et retirés à la sérialisation JSON (`User.CHAMPS_PRIVES`, `utilisateur.model.js`).

**Admin :** `adminsApi.list()` (`src/api/admins.ts:5`), appelée par `AdminsPage.tsx:69` et `AuditLogPage.tsx:32`. Lit `data` (repli sur `admins`).

---

#### `POST /nanei/admin/ajouter-admin`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `email` | string | **oui** | unique ; mis en minuscules ; format vérifié par le modèle |
| `mot_de_passe` | string | **oui** | min 8 car. (aucune autre règle) |
| `nom` | string | **oui** (modèle) | non nul |
| `prenom` | string | **oui** (modèle) | non nul |
| `adresse` | string | **oui** (modèle) | non nul ; `""` accepté |
| `telephone` | string | non | unique (contrôlé seulement s’il est non vide) |

Le compte est créé avec `role: "Admin"` et `statut: "actif"`.

**Réponse 201 :** `{ "success": true, "message": "Admin créé avec succès", "data": { …utilisateur sans les champs privés } }`.

> Le journal d’audit enregistre le corps de la requête avec `mot_de_passe` remplacé par `"***"` (voir §4).

**Erreurs (400, `{ success: false, message }`) :** « Email et mot de passe sont obligatoires » · « Cet email est déjà utilisé » · « Ce numéro de téléphone est déjà utilisé » · « Le mot de passe doit contenir au moins 8 caractères » · « Erreur lors de la création de l'admin » (+ `error`, ex. champ nul, e-mail invalide, téléphone `""` en doublon) — puis 401 · 403 · 500 « Erreur serveur lors de l'ajout de l'admin ».

**Admin :** `adminsApi.create({ nom, prenom, email, mot_de_passe, telephone, adresse })` (`src/api/admins.ts:8`), appelée par `AdminsPage.tsx:80`. Envoie `telephone: ""` et `adresse: ""` si non saisis.

---

#### `PUT /nanei/admin/activer-admin/:id` et `PUT /nanei/admin/desactiver-admin/:id`

- **Paramètre :** `id` (UUID d’utilisateur). Aucun corps.
- Met `statut` à `actif` ou `inactif`. La cible doit être un compte **`Admin`** (un client → 404).
- **Garde-fous de désactivation :** un admin ne peut pas se désactiver lui-même, et le **dernier admin actif** ne peut pas être désactivé.

**Réponse 200 :** `{ "success": true, "message": "Admin activé avec succès" | "Admin désactivé avec succès", "data": { …utilisateur sans les champs privés } }`.

**Erreurs :** 404 « Admin introuvable » · 400 « Vous ne pouvez pas désactiver votre propre compte » · 400 « Impossible de désactiver le dernier administrateur actif » · 401 · 403 · 500 « Erreur lors de l'activation » / « … de la désactivation ».

**Admin :** `adminsApi.activate(id)` / `adminsApi.deactivate(id)` (`src/api/admins.ts:10-11`), appelées par `AdminsPage.tsx:97`.

---

#### `GET /nanei/admin/nombre-admins`

**Réponse 200 :** `{ "success": true, "data": 4 }` (compte **tous** les admins, y compris celui connecté).

**Erreurs :** 401 · 403 · 500. Une erreur base renvoie **500** `{ success: false, message: "Erreur lors du comptage des admins" }`.

**Admin :** `adminsApi.count()` (`src/api/admins.ts:6`), appelée par `DashboardPage.tsx:52`. Lit `data` (repli sur `nombre`).

---

#### `GET /nanei/admin/rechercher-admin`

**Paramètres (query) :** `nom`, `prenom`, `email` — tous facultatifs, recherche « contient » insensible à la casse (`ILIKE`, `%` et `_` pris littéralement), combinés par ET. Aucun paramètre → tous les admins.

**Réponse 200 :** **tableau nu** `[ { …admin sans mot_de_passe } ]`, du plus récent au plus ancien. L’admin connecté est inclus.

**Erreurs :** 401 · 403 · 500. Une erreur base renvoie **500** `{ success: false, message: "Erreur lors de la recherche des admins" }`.

**Admin :** `adminsApi.search(q)` existe (`src/api/admins.ts:7`) mais **n’est appelée nulle part** (la recherche se fait dans le navigateur).

---

## 3. Clients (utilisateurs)

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/liste-utilisateurs` | jeton **Admin** |
| PATCH | `/nanei/admin/activer-utilisateurs/:id` | jeton **Admin** (journalisé `ACTIVATE` / `Utilisateur`) |
| PATCH | `/nanei/admin/desactiver-utilisateurs/:id` | jeton **Admin** (journalisé `DEACTIVATE` / `Utilisateur`) |
| GET | `/nanei/admin/nombre-utilisateurs` | jeton **Admin** |
| GET | `/nanei/admin/rechercher-utilisateur` | jeton **Admin** |

**Entité `utilisateur` (client) renvoyée :** `{ id, nom, prenom, email, adresse, telephone, role: "Particulier", statut, photoProfil, compteAuto, createdAt, updatedAt, deletedAt }`. Les champs privés (`mot_de_passe`, `resetPasswordToken`, `resetPasswordExpires`, `passwordChangedAt`, `otpCode`, `otpExpires`, `fcm_token`) ne sont **jamais** renvoyés (`Utilisateur.CHAMPS_PRIVES`).

#### `GET /nanei/admin/liste-utilisateurs`

Pagination facultative (`?page=&limit=`) et recherche `?q=` (nom, prénom, e-mail, téléphone, insensible à la casse). Seuls les `Particulier` non supprimés et **inscrits** (`compteAuto = false`), du plus récent au plus ancien. Les comptes destinataires créés automatiquement à l’envoi d’un colis (`compteAuto = true`) n’apparaissent pas : ce ne sont pas des clients tant que la personne ne s’est pas inscrite.

**Réponse 200 :** `{ "success": true, "total": 152, "data": [ … ] }`.

**Erreurs :** 401 · 403 · 500 « Erreur lors de la récupération des utilisateurs ».

**Admin :** `clientsApi.list()` (`src/api/clients.ts:5`), appelée par `ClientsPage.tsx:20`. Lit `data` (repli sur `utilisateurs`).

---

#### `PATCH /nanei/admin/activer-utilisateurs/:id` et `PATCH /nanei/admin/desactiver-utilisateurs/:id`

- **Paramètre :** `id` (UUID). Aucun corps. Réservé aux **clients** : un compte `Admin` répond 404 (il se gère par `activer-admin` / `desactiver-admin`, avec leurs garde-fous).

**Réponse 200 :** `{ "success": true, "message": "Utilisateur activé avec succès" | "Utilisateur désactivé avec succès", "data": { …utilisateur sans les champs privés } }`.

**Erreurs :** 404 « Utilisateur non trouvé » · 400 « Utilisateur déjà actif » · 400 « Utilisateur déjà inactif » · 400 « Ce compte destinataire n'a pas encore été créé par la personne : elle doit s'inscrire dans l'application » (activation d’un compte automatique) — puis 401 · 403.

> Un client désactivé par un admin **ne peut plus être repris** par une nouvelle inscription avec son e-mail ou son téléphone (« Cet email est déjà utilisé ») : seul un compte automatique (`compteAuto = true`) est revendiqué à l’inscription. Avant, tout compte client inactif l’était, mot de passe compris.
> Un compte désactivé reçoit **403** « Compte désactivé. Contactez le support. » sur toutes ses requêtes, même avec un jeton encore valide.

**Admin :** `clientsApi.activate(id)` / `clientsApi.deactivate(id)` (`src/api/clients.ts:8-9`), appelées par `ClientsPage.tsx:31`.

---

#### `GET /nanei/admin/nombre-utilisateurs`

**Réponse 200 :** `{ "success": true, "total": 152 }` (clients inscrits seulement, comme la liste).

**Erreurs :** 401 · 403 · 500 « Erreur lors du comptage des utilisateurs ».

**Admin :** `clientsApi.count()` (`src/api/clients.ts:6`), appelée par `DashboardPage.tsx:51`. Lit `total` (repli sur `nombre`).

---

#### `GET /nanei/admin/rechercher-utilisateur`

**Paramètres (query) :** `nom`, `prenom`, `email` — facultatifs, « contient » insensible à la casse (`%` et `_` pris littéralement), combinés par ET.

**Réponse 200 :** `{ "success": true, "data": [ … ] }`.

**Erreurs :** 401 · 403 · 500 « Erreur lors de la recherche des utilisateurs ».

**Admin :** `clientsApi.search(q)` existe (`src/api/clients.ts:7`) mais **n’est appelée nulle part**.

---

## 4. Journal d’audit

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/audit-logs` | jeton **Admin** |

Les entrées sont créées automatiquement par le middleware `auditLog(action, entite)`, **après** une réponse 2xx/3xx. Actions utilisées dans le back : `CREATE`, `UPDATE`, `UPDATE_STATUT`, `DELETE`, `ACTIVATE`, `DEACTIVATE`, `REPLY`, `BULK_UPSERT`, `GENERATE`.

#### `GET /nanei/admin/audit-logs`

**Paramètres (query)**

| Champ | Type | Défaut | Effet |
|---|---|---|---|
| `page` | integer | `1` | page demandée |
| `limit` | integer | `20` | taille de page, **100 maximum** |
| `action` | string | — | égalité exacte (ex. `UPDATE_STATUT`) |
| `entite` | string | — | égalité exacte (ex. `Colis`, `Admin`, `Utilisateur`) |
| `admin_id` | UUID | — | auteur de l’action |
| `date_debut` | date `AAAA-MM-JJ` | — | à partir de 00:00 ce jour-là |
| `date_fin` | date `AAAA-MM-JJ` | — | jusqu’à la fin de ce jour (**inclus**) |

**Réponse 200 :**

```json
{
  "success": true,
  "total": 87,
  "page": 1,
  "pages": 5,
  "logs": [
    {
      "id": "uuid",
      "admin_id": "uuid",
      "action": "DEACTIVATE",
      "entite": "Utilisateur",
      "entite_id": "uuid",
      "details": { "method": "PATCH", "path": "/nanei/admin/desactiver-utilisateurs/…", "body": {} },
      "ip_address": "41.82.10.5",
      "createdAt": "2026-10-01T10:12:00.000Z",
      "admin": { "nom": "…", "prenom": "…", "email": "…" }
    }
  ]
}
```

Tri : du plus récent au plus ancien.

**Erreurs :** 400 « Date invalide (format AAAA-MM-JJ) » · 401 · 403 · 500 `{ "success": false, "message": "Erreur serveur" }`. `page` / `limit` non numériques → valeurs par défaut.

> `details.body` contient le corps de la requête **avec les champs sensibles masqués** (`"***"`) : tout nom de champ contenant `pass`, `mot_de_passe`, `token`, `otp`, `secret`… (`auditlog.middleware.js`, `masquerChampsSensibles`). La migration `20261011140000-masquer-secrets-audit-logs.js` masque les lignes enregistrées avant ce correctif.

**Admin :** `auditLogsApi.list({ page, limit: 20, admin_id, action, date_debut, date_fin })` (`src/api/auditLogs.ts`), appelée par `AuditLogPage.tsx`. Lit `logs`, `total`, `pages`, puis `log.admin.prenom/nom`, `log.entite_id`, `log.ip_address`, `log.createdAt`, `log.details`. La liste des admins du filtre inclut l’admin connecté (« moi »).

---

## 5. Messages du support

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/messages/stats` | jeton **Admin** |
| GET | `/nanei/admin/messages` | jeton **Admin** |
| POST | `/nanei/admin/messages/:id/repondre` | jeton **Admin** (journalisé `REPLY` / `MessageClient`) |

**Entité `message` :** `{ id, email, objet, description, createdAt, updatedAt }`. Pas de statut « répondu » : rien n’est enregistré après une réponse.

> Doublons : les mêmes actions existent aussi sous `/nanei/messages` (`GET /`, `GET /stats`, `POST /:id/repondre`, jeton **Admin**), sans journal d’audit ni limite admin. L’admin ne les utilise pas.

#### `GET /nanei/admin/messages/stats`

**Réponse 200 :** `{ "success": true, "total": 42 }`.

**Erreurs :** 401 · 403 · 500 `{ success: false, message: "Erreur serveur.", error }`.

**Admin :** `messagesApi.stats()` existe (`src/api/messages.ts:13`) mais **n’est appelée nulle part**.

---

#### `GET /nanei/admin/messages`

Pas de pagination. Du plus récent au plus ancien.

**Réponse 200 :** `{ "success": true, "data": [ { id, email, objet, description, createdAt, updatedAt } ] }`.

**Erreurs :** 401 · 403 · 500 `{ success: false, message: "Erreur serveur.", error }`.

**Admin :** `messagesApi.list()` (`src/api/messages.ts:12`), appelée par `MessagesPage.tsx:18`. Lit `data`.

---

#### `POST /nanei/admin/messages/:id/repondre`

- **Paramètre :** `id` (UUID du message).

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `reponse` | string | **oui** | non vide après `trim` |

La réponse est envoyée par e-mail (Resend) à `message.email`, objet « Réponse Nanei — <objet> » (une seule ligne, 150 caractères max). L’objet, le message d’origine et la réponse sont **échappés** dans le HTML (`utils/echapperHtml.js`) : ils s’affichent comme du texte, jamais comme du code.

**Réponse 200 :** `{ "success": true, "destinataire": "client@exemple.com", "message": "Réponse envoyée avec succès." }`.

**Erreurs :** 400 « La réponse est requise. » · 404 « Message introuvable » · 401 · 403 · 500 `{ success: false, message: "<erreur d'envoi>" }`.

**Admin :** `messagesApi.repondre(id, reponse)` (`src/api/messages.ts:14`), appelée par `MessagesPage.tsx:25`.


---

## 6. Colis

Toutes les routes de cette section sont dans `src/routes/admin/gestioncolis.routes.js`, montées sur `/nanei/admin` (`src/app.js`).

**Accès commun :** `authMiddleware` (jeton `Authorization: Bearer …`, compte `actif`) puis `isAdmin` (`role === 'Admin'`). Tout le sous-arbre `/nanei/admin` passe aussi par `adminRateLimit` : **200 requêtes / 15 min / IP**, sinon 429 « Trop de requêtes admin. Veuillez réessayer. ».

**Erreurs communes à toutes les routes admin :** 401 « Token manquant ou invalide » · 401 « Token invalide » · 401 « Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter. » · 404 « Utilisateur introuvable » · 403 « Compte désactivé. Contactez le support. » · 403 « Accès refusé » (pas admin) · 429.

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/liste-colis` | admin |
| GET | `/nanei/admin/nombre-colis` | admin |
| GET | `/nanei/admin/colis-en-attente` | admin |
| GET | `/nanei/admin/nombre-colis-en-attente` | admin |
| GET | `/nanei/admin/colis-livres` | admin |
| GET | `/nanei/admin/nombre-colis-livres` | admin |
| GET | `/nanei/admin/colis-recuperes` | admin |
| GET | `/nanei/admin/nombre-colis-recuperes` | admin |
| GET | `/nanei/admin/colis-recherche/:reference` | admin |
| PUT | `/nanei/admin/changer-statut-en-attente/:id` | admin + audit log |
| PUT | `/nanei/admin/changer-statut-livre/:id` | admin + audit log |
| PUT | `/nanei/admin/changer-statut-recupere/:id` | admin + audit log |

**Entité `colis` (listes admin) :** `{ id, reference, expediteurId, recepteurId, poids, prix, destination, description, type_colis, type_transport, statut, lot_id, createdAt, updatedAt, deletedAt, expediteur: { nom, prenom, email, telephone }, recepteur: { nom, prenom, email, telephone } }`.

- `type_colis` : nature du colis, texte libre (« Vêtement », « Document »…), peut être `null`.
- `type_transport` : `aerien` | `maritime` (sans accent), peut être `null` pour les anciens colis.
- `statut` : `en_attente` | `recupere` | `livre`.
- `lot_id` : UUID partagé par les colis d’un même envoi groupé, `null` sinon.
- `expediteur` / `recepteur` **ne contiennent pas `id`**.
- Le modèle est `paranoid` : les colis supprimés (`deletedAt` non nul) n’apparaissent pas.

---

#### `GET /nanei/admin/liste-colis`

- **Paramètres :** aucun. **Pas de pagination**, pas de filtre. Tri : `created_at` décroissant.

**Réponse 200 :** `{ "success": true, "message": "Colis récupérés avec succès", "colis": [ { …colis } ] }`.

```json
{ "success": true, "message": "Colis récupérés avec succès",
  "colis": [ { "id": "uuid", "reference": "NAN-…", "poids": 2.5, "prix": 15000, "destination": "Mali",
               "type_colis": "Vêtement", "type_transport": "aerien", "statut": "en_attente", "lot_id": null,
               "createdAt": "2026-10-01T10:00:00.000Z",
               "expediteur": { "nom": "Diallo", "prenom": "Awa", "email": "…", "telephone": "…" },
               "recepteur": { "nom": "…", "prenom": "…", "email": "…", "telephone": "…" } } ] }
```

**Erreurs :** 500 « Erreur serveur lors de la récupération des colis » (avec `error`).

**Admin :** `colisApi.list()` (`src/api/colis.ts:5`), sans paramètre. Utilisée par `ColisPage` (filtre « Tous »), `EtiquettesPage` et `DashboardPage` (8 derniers colis). L’admin lit `res.data.colis` (avec repli sur `res.data.data`).

---

#### `GET /nanei/admin/nombre-colis`

**Réponse 200 :** `{ "success": true, "message": "Nombre Total des Colis récupérés avec succès", "nombre_colis": 42 }`.

**Erreurs :** 500 « Erreur serveur comptage colis ».

**Admin :** `colisApi.count()` (`src/api/colis.ts:6`). `DashboardPage` lit `nombre_colis` (repli `total`, `nombre`).

---

#### `GET /nanei/admin/colis-en-attente` · `GET /nanei/admin/colis-livres` · `GET /nanei/admin/colis-recuperes`

- **Paramètres :** aucun. Pas de pagination. Tri : `created_at` décroissant.
- Filtre fixe : `statut = en_attente` / `livre` / `recupere`.

**Réponse 200 :** même forme que `liste-colis` : `{ success: true, message: "Colis récupérés avec succès", colis: [ … ] }`.

**Erreurs :** 500 « Erreur serveur colis en attente » · « Erreur serveur colis livrés » · « Erreur serveur colis récupérés ».

**Admin :** `colisApi.enAttente()`, `colisApi.livres()`, `colisApi.recuperes()` (`src/api/colis.ts:7-9`). Appelées par `ColisPage` selon le filtre ; `enAttente()` aussi par `DashboardPage` (alerte « colis bloqués » > 3 jours).

---

#### `GET /nanei/admin/nombre-colis-en-attente` · `GET /nanei/admin/nombre-colis-livres` · `GET /nanei/admin/nombre-colis-recuperes`

**Réponse 200 :** `{ "success": true, "message": "Nombre Total des Colis récupérés avec succès", "nombre_colis": 12 }` (même message pour les trois).

**Erreurs :** 500 « Erreur serveur comptage en attente » · « Erreur serveur comptage livrés » · « Erreur serveur comptage récupérés ».

**Admin :** `colisApi.countEnAttente()`, `countLivres()`, `countRecuperes()` (`src/api/colis.ts:10-12`), lues par `DashboardPage` via `nombre_colis`.

---

#### `GET /nanei/admin/colis-recherche/:reference`

- **Paramètre de chemin :** `reference` (référence exacte, sensible à la casse).

**Réponse 200 :** `{ "success": true, "message": "Colis récupérés avec succès", "colis": { …colis } }`.

> Si la référence n’existe pas, la réponse est quand même **200** avec `"colis": null` (pas de 404).

**Erreurs :** 500 « Erreur serveur recherche colis ».

**Admin :** `colisApi.search(ref)` existe (`src/api/colis.ts:13`) mais **n’est appelée par aucun écran** (la recherche de `ColisPage` filtre côté navigateur).

---

#### `PUT /nanei/admin/changer-statut-en-attente/:id` · `PUT /nanei/admin/changer-statut-recupere/:id` · `PUT /nanei/admin/changer-statut-livre/:id`

- **Accès :** admin. Middleware `auditLog('UPDATE_STATUT', 'Colis')`.
- **Paramètre de chemin :** `id` = UUID du colis.
- **Corps :** aucun.

**Transitions :** aucun contrôle (ex. `livre` → `en_attente` permis). Vers le **même** statut : ni historique ni notification.

**Effets de bord :**
1. `colis.statut` mis à jour.
2. Ligne `colis_historiques` `{ colis_id, ancien_statut, nouveau_statut, admin_id }` — **avant** la réponse.
3. **Après** la réponse, en arrière-plan : notification push (FCM) à l’expéditeur et au destinataire s’ils ont un `fcm_token` (titre « Mise à jour colis », données `{ colisId, statut }`).
   SMS à l’expéditeur et au destinataire s’ils ont un téléphone ; e-mail (un seul si même adresse, jamais vers une adresse technique `@nanei.local` ou un compte supprimé). Objet : « Colis {reference} — {libellé} ».
   Texte : « Votre colis {reference} est maintenant : {libellé}. - Nanei FrancoMaliShip » (libellés : En attente · Récupéré · Livré). Un échec d’envoi est journalisé et n’empêche pas les autres.
4. Après la réponse 2xx : ligne `audit_logs` `{ admin_id, action: "UPDATE_STATUT", entite: "Colis", entite_id: id, details: { method, path, body }, ip_address }`.

> La réponse n’attend plus les notifications (avant, un fournisseur SMS ou e-mail lent faisait dépasser le délai de 15 s de l’admin, qui affichait « Erreur » alors que le statut avait changé).

**Réponse 200 :** `{ "success": true, "message": "<message>", "colis": { …colis sans expediteur/recepteur } }`.
Messages : « Colis mis en attente avec succès » · « Colis marqué comme récupéré » · « Colis marqué comme livré ».

**Erreurs :** 404 « Colis introuvable » (`{ success: false, message }`) · 500 « Erreur changement statut en attente » · « Erreur changement statut récupéré » · « Erreur changement statut livré » (avec `error`). Un `id` qui n’est pas un UUID donne une erreur Postgres → 500.

**Admin :** `colisApi.setEnAttente(id)`, `setRecupere(id)`, `setLivre(id)` (`src/api/colis.ts:14-16`), sans corps, depuis le sélecteur de statut de `ColisPage` (après confirmation). L’admin ignore la réponse et recharge les listes, les compteurs et l’alerte « colis bloqués » du tableau de bord.

---

## 7. Étiquettes

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/etiquettes/:colisId` | admin |

#### `GET /nanei/admin/etiquettes/:colisId`

- **Fichier :** `src/routes/admin/etiquette.route.js` (`router.use(authMiddleware)` + `router.use(isAdmin)`). Pas d’audit log.
- **Paramètre de chemin :** `colisId` = UUID du colis. Aucun contrôle de propriétaire (l’admin voit tous les colis).
- **Query :** `format` (optionnel). `zpl` → fichier ZPL ; toute autre valeur ou absent → PDF.

**Contenu de l’étiquette :** référence, nom/prénom/téléphone/e-mail de l’expéditeur et du destinataire, pays expéditeur (**toujours « MALI »**, valeur fixe), pays destinataire (= `colis.destination`), type de transport (`aerien` | `maritime`, déduit de `type_transport`, sinon de `type_colis`, sinon `aerien`), poids, date. QR code vers `{BACKEND_URL}/nanei/suivi/{reference}`.

**Réponse 200 (PDF) :**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="etiquette-{reference}.pdf"`
- `Cache-Control: no-cache`, `Content-Length`
- Corps : PDF binaire (généré par Chromium/Puppeteer).

**Réponse 200 (`?format=zpl`) :**
- `Content-Type: text/plain; charset=utf-8`
- `Content-Disposition: attachment; filename="etiquette-{reference}.zpl"`
- Corps : texte ZPL, étiquette 100 × 150 mm, 203 dpi.

**Erreurs :** 404 « Colis introuvable » · 500 `{ success: false, message: <message technique de l’erreur> }` (repli « Erreur génération étiquette »).

**Admin :** `etiquettesApi.telecharger(colisId)` (`src/api/etiquettes.ts:4-5`, `responseType: 'blob'`) et `etiquettesApi.telechargerZPL(colisId)` (`src/api/etiquettes.ts:6-7`, `params: { format: 'zpl' }`, blob). `EtiquettesPage` enregistre le blob via `downloadBlob` sous `etiquette-{reference}.pdf|.zpl` ; pour le ZPL il lit aussi `blob.text()` pour l’afficher et le copier.

> Avec `responseType: 'blob'`, une erreur 404/500 arrive aussi en blob : l’admin affiche seulement « Impossible de télécharger l'étiquette ».

---

## 8. Preuves de livraison

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/admin/colis/:colisId/preuve` | admin + audit log |
| GET | `/nanei/admin/colis/:colisId/preuve` | admin |

**Entité `preuve` :** `{ id, colis_id, photo_url, commentaire, gps_lat, gps_lng, createdAt }` (pas de `updatedAt`). Une seule preuve par colis (`colis_id` unique).

#### `POST /nanei/admin/colis/:colisId/preuve`

- **Accès :** `auth`, `isAdmin`, puis upload multer, puis `auditLog('CREATE', 'PreuveLivraison')`.
- **Format :** `multipart/form-data`.

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `photo` | fichier | **oui** | un seul fichier ; `image/png`, `image/jpeg`, `image/jpg` ou `image/webp` (selon le `Content-Type` du fichier) ; 15 Mo max |
| `commentaire` | string | non | — |
| `gps_lat` | string (nombre) | non | converti par `parseFloat` |
| `gps_lng` | string (nombre) | non | converti par `parseFloat` |

| `remplacer` | `"true"` | non | en query (`?remplacer=true`) ou dans le formulaire. Obligatoire pour **remplacer** une preuve existante |

- Pas de contrôle du statut du colis (on peut ajouter une preuve à un colis non livré).
- La photo est envoyée sur Cloudflare R2 (`nanei/preuves/…`) ; `photo_url` est l’URL publique.
- **Une seule preuve par colis.** Si elle existe et que `remplacer` n’est pas `true` → **409**, rien n’est envoyé sur R2 ni modifié.

**Réponse 201 :** `{ "success": true, "message": "Preuve ajoutée", "preuve": { id, colis_id, photo_url, commentaire, gps_lat, gps_lng, createdAt, updatedAt } }`.
**Réponse 200 (remplacement confirmé) :** `{ "success": true, "message": "Preuve remplacée", "preuve": { … } }`.

**Erreurs :** 409 « Une preuve de livraison existe déjà pour ce colis. Confirmez le remplacement pour l'écraser. » (+ `preuve` existante) · 404 « Colis introuvable » · 400 « Photo obligatoire » · 400 « Type de fichier non autorisé » · 413 « Fichier trop volumineux » · 400 « Trop de fichiers ou champ de fichier inattendu » · 500 « Erreur serveur ».

**Admin :** `preuveLivraisonApi.upload(colisId, formData, remplacer)` (`src/api/preuveLivraison.ts`), `FormData` avec le champ `photo`. Modale « Preuve de livraison » de `ColisPage` (visible pour un colis `livre`) : bouton « Ajouter une preuve » s’il n’y en a pas, « Remplacer la photo » (avec confirmation, `remplacer=true`) sinon.

---

#### `GET /nanei/admin/colis/:colisId/preuve`

**Réponse 200 :** `{ "success": true, "preuve": { id, colis_id, photo_url, commentaire, gps_lat, gps_lng, createdAt } }`.

**Erreurs :** 404 « Aucune preuve trouvée » · 500 « Erreur serveur ».

**Admin :** `preuveLivraisonApi.get(colisId)` (`src/api/preuveLivraison.ts`) lit `preuve` et renvoie `null` sur 404. `ColisPage` affiche `photo_url`, `commentaire`, la position GPS (`gps_lat`, `gps_lng`) et la date. Une autre erreur affiche « Impossible de charger la preuve » sans proposer d’envoi (pas d’écrasement à l’aveugle).

---

## 9. Avis

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/avis` | admin |

#### `GET /nanei/admin/avis`

- **Fichier :** `src/routes/admin/avis.route.js` → `avis.controller.adminAvis`.
- **Paramètres (query) :** `note` (facultatif, entier 1 à 5) filtre la liste. Pas de pagination. Tri : `created_at` décroissant.

**Réponse 200 :**

```json
{ "success": true,
  "stats": { "total": 3, "note_moyenne": 4.3, "distribution": { "1": 0, "2": 0, "3": 1, "4": 0, "5": 2 } },
  "avis": [ { "id": "uuid", "colis_id": "uuid", "utilisateur_id": "uuid", "note": 5, "commentaire": "…",
              "createdAt": "…",
              "colis": { "reference": "…", "destination": "…" },
              "utilisateur": { "nom": "…", "prenom": "…", "email": "…" } } ] }
```

- `note_moyenne` : arrondie à 1 décimale, `0` s’il n’y a aucun avis.
- `stats` est calculé sur **tous** les avis, même quand `note` filtre la liste.

**Erreurs :** 500 « Erreur serveur ».

**Admin :** `avisApi.list(note?)` (`src/api/avis.ts`) envoie `?note=n` quand un filtre est choisi, lit `avis` et `stats`, et convertit chaque avis : `colis.reference` → `colisReference`, `utilisateur` → `client`. `AvisPage` affiche ces champs.

---

## 10. Réclamations

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/reclamations` | admin |
| PUT | `/nanei/admin/reclamations/:id` | admin + audit log |

**Entité `reclamation` (vue admin) :** `{ id, colis_id, utilisateur_id, type, description, photos: ["https://…"], statut, commentaire_admin, createdAt, updatedAt, colis: { reference, statut, destination }, utilisateur: { nom, prenom, email, telephone } }`.

#### `GET /nanei/admin/reclamations`

- **Query :** `statut` (optionnel) ∈ `ouverte` | `en_cours` | `resolue` | `rejetee`. Pas de pagination. Tri : `created_at` décroissant.
- Une valeur de `statut` hors liste fait échouer la requête Postgres (enum) → 500.

**Réponse 200 :** `{ "success": true, "reclamations": [ { …reclamation } ] }`.

**Erreurs :** 500 « Erreur serveur ».

**Admin :** `reclamationsApi.list(statut?)` (`src/api/reclamations.ts`), `?statut=` seulement si le filtre n’est pas « Toutes ». Lit `reclamations` et convertit : `colis.reference` → `colisReference`, `utilisateur` → `client`, `commentaire_admin` → `commentaireAdmin`, type `endommagé` (avec accent).

---

#### `PUT /nanei/admin/reclamations/:id`

- **Accès :** admin. Middleware `auditLog('UPDATE_STATUT', 'Reclamation')`.
- **Paramètre de chemin :** `id` = UUID de la réclamation.
- **Format :** JSON.

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `statut` | string | non | `ouverte` · `en_cours` · `resolue` · `rejetee`. Absent ou vide → inchangé. Autre valeur → **400** |
| `commentaire_admin` | string \| null | non | présent (même `null` ou `""`) → remplace la valeur. Envoyé au client par e-mail et SMS. `commentaire` est accepté comme synonyme (ancienne version de l’admin) |

**Transitions :** aucun contrôle. Tout statut peut passer à tout autre (y compris revenir à `ouverte`).

**Effets de bord :**
1. Mise à jour de la réclamation.
2. E-mail au client auteur (s’il a un e-mail). Objet : « Réclamation colis {reference} — {statut} ».
   Texte : « Votre réclamation pour le colis {reference} a été mise à jour : {libellé du statut}. {commentaire_admin} ». Libellés : ouverte · en cours de traitement · résolue · rejetée. Prénom et commentaire **échappés** dans le HTML.
3. SMS au client (s’il a un téléphone), même texte.
4. Après la réponse 2xx : ligne `audit_logs` (`action: "UPDATE_STATUT"`, `entite: "Reclamation"`, `details.body` = corps envoyé).

> Pas de notification push. Pas d’historique des statuts côté back. E-mail et SMS partent même si rien n’a changé.

**Réponse 200 :** `{ "success": true, "message": "Réclamation mise à jour", "reclamation": { …reclamation, colis: { reference }, utilisateur: { nom, prenom, email, telephone } } }`.

**Erreurs :** 400 « Statut invalide (ouverte, en_cours, resolue ou rejetee) » · 404 « Réclamation introuvable » · 500 « Erreur serveur ».

**Admin :** `reclamationsApi.update(id, statut, commentaire?)` (`src/api/reclamations.ts`) envoie `{ statut, commentaire_admin }`. La modale de `ReclamationsPage` affiche aussi le dernier message envoyé au client (`commentaire_admin`).

---

## 11. Exports

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/export/colis` | admin |
| GET | `/nanei/admin/export/paiements` | admin |

Chaque export est tracé dans le journal d’audit (`action: "EXPORT"`, `entite: "Colis" | "Paiement"`, filtres dans `details.query`). Pas de limite de volume (toute la table est exportée).

> Les cellules texte qui commencent par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot sont préfixées d’une apostrophe (pas d’exécution de formule à l’ouverture dans Excel). Les montants et poids sont des nombres.

#### `GET /nanei/admin/export/colis`

**Query**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `format` | string | non | `xlsx` → Excel ; toute autre valeur ou absent → **CSV** (défaut `csv`) |
| `statut` | string | non | `en_attente` · `recupere` · `livre` ; autre valeur → **400** |
| `date_debut` | date `AAAA-MM-JJ` | non | à partir de 00:00 ce jour-là |
| `date_fin` | date `AAAA-MM-JJ` | non | jusqu’à la fin de ce jour (**inclus**) ; date illisible → 400 |

**Colonnes (ordre) :** `reference`, `statut`, `destination`, `poids`, `prix_eur`, `type_transport`, `type_colis`, `expediteur_nom` (« prénom nom »), `expediteur_email`, `expediteur_telephone`, `recepteur_nom`, `recepteur_email`, `recepteur_telephone`, `created_at` (date ISO, remplie).

**Réponse 200 (CSV) :** `Content-Type: text/csv; charset=utf-8` · `Content-Disposition: attachment; filename=colis-export.csv`. Séparateur `;`, valeurs entre guillemets, BOM UTF-8 en tête, lignes séparées par `\n`.

**Réponse 200 (xlsx) :** `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` · `Content-Disposition: attachment; filename=colis-export.xlsx`. Une feuille « Colis ».

**Erreurs :** 400 « Statut invalide (…) » · 400 « Date invalide (format AAAA-MM-JJ) » · 500 `{ success: false, message: "Erreur export" }`.

**Admin :** `exportApi.colis(format, params)` (`src/api/export.ts:4-5`, `responseType: 'blob'`), `params` ⊂ `{ statut, date_debut, date_fin }` (champs vides non envoyés). `ExportPage` propose `en_attente` · `recupere` · `livre` et des champs `type="date"`. Fichier enregistré sous `colis-export.csv|xlsx`.

---

#### `GET /nanei/admin/export/paiements`

**Query :** `format` (`csv` par défaut, `xlsx`), `statut` (optionnel : `en_attente` · `en_cours` · `paye` · `echoue` · `rembourse`, autre valeur → 400), `date_debut`, `date_fin` (mêmes règles que ci-dessus).

**Colonnes (ordre) :** `id`, `colis_reference`, `destination`, `payeur` (« prénom nom »), `payeur_email`, `prix_total_eur`, `montant_paye_eur`, `moyen_paiement` (`orange_money` | `wave`), `statut`, `reference_transaction`, `created_at`.

> Avant ce correctif, cette route répondait **toujours 500** : `Paiement` était importé depuis `models/index.js`, qui ne l’exporte pas.

**Réponse 200 :** CSV (`filename=paiements-export.csv`) ou xlsx (`filename=paiements-export.xlsx`, feuille « Paiements »), mêmes en-têtes HTTP que l’export colis.

**Erreurs :** 400 (statut, date) · 500 « Erreur export ».

**Admin :** `exportApi.paiements(format, params)` (`src/api/export.ts:6-7`, blob), `params` ⊂ `{ date_debut, date_fin }` (pas de filtre `statut` dans l’écran). Fichier enregistré sous `paiements-export.csv|xlsx`. Délai 60 s. En cas d’erreur, l’écran lit le message du back dans la réponse (reçue en blob) au lieu d’un texte fixe.


---

## 12. Pays

Toutes les routes de cette partie (§12 à §17) passent par `authMiddleware` puis `isAdmin` (`role === "Admin"`), et par le limiteur `/nanei/admin` (200 requêtes / 15 min / IP). Les écritures sont tracées dans le journal d’audit (`auditLog`), seulement si la réponse est en 2xx.

Erreurs communes à toutes les routes (middlewares) : 401 « Token manquant ou invalide » · 401 « Token invalide » · 401 « Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter. » · 404 « Utilisateur introuvable » · 403 « Compte désactivé. Contactez le support. » · 403 `{ success: false, message: "Accès refusé" }` (pas admin) · 429 (limiteur).

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/countries` | Admin |
| GET | `/nanei/admin/countries/:id` | Admin |
| POST | `/nanei/admin/countries` | Admin (audit `CREATE Country`) |
| PUT | `/nanei/admin/countries/:id` | Admin (audit `UPDATE Country`) |
| DELETE | `/nanei/admin/countries/:id` | Admin (audit `DELETE Country`) |

**Entité `country` :** `{ id (UUID), name, code, isActive, createdAt, updatedAt }`. `name` et `code` sont uniques en base. `code` : 3 caractères max.

> Un pays **inactif** (`isActive: false`) ne peut plus être utilisé pour calculer un prix ni pour afficher une grille côté mobile (« Pays non trouvé »).

#### `GET /nanei/admin/countries`

**Query**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `isActive` | string | non | `"true"` → pays actifs ; toute autre valeur → pays inactifs ; absent → tous |

Pas de pagination. Tri par `name` croissant.

**Réponse 200 :** `{ "message": "Pays récupérés avec succès", "data": [ { "id": "…", "name": "France", "code": "FRA", "isActive": true, "createdAt": "…", "updatedAt": "…" } ] }`.

**Erreurs :** 400 `{ success: false, message: "Erreur lors de la récupération des pays", error }` · 500 `{ message: "Erreur serveur", error }`.

**Admin :** `countriesApi.list()` (`src/api/countries.ts:5`), sans paramètre, appelée par `CountriesPage` (onglet Pays et listes déroulantes). Lit `res.data.data`.

---

#### `GET /nanei/admin/countries/:id`

**Réponse 200 :** `{ "message": "Pays récupéré avec succès", "data": { …country } }`.

**Erreurs :** 404 `{ success: false, message: "Pays non trouvé" }` · 404 « Erreur lors de la récupération du pays » (ex. `id` qui n’est pas un UUID) · 500.

**Admin :** `countriesApi.getById()` existe (`src/api/countries.ts:6`) mais n’est **jamais appelée**.

---

#### `POST /nanei/admin/countries`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `name` | string | **oui** | unique |
| `code` | string | **oui** | 3 caractères max ; enregistré en MAJUSCULES ; unique |
| `isActive` | boolean | non | défaut `true` (seul `false` désactive) |

**Réponse 201 :** `{ "success": true, "message": "Pays créé avec succès", "data": { …country } }`.

**Erreurs :** 400 « Le nom et le code du pays sont obligatoires » · 400 « Un pays avec ce code existe déjà » · 400 « Un pays avec ce nom existe déjà » · 400 « Erreur lors de la création du pays » (+ `error`, ex. code de plus de 3 caractères) · 500.

> Doublons contrôlés avant l’insertion : code comparé en majuscules, nom sans tenir compte de la casse.

**Admin :** `countriesApi.create({ name, code, isActive })` (`src/api/countries.ts:7`) depuis la modale Pays de `CountriesPage` ; le code est saisi en majuscules, 3 caractères max.

---

#### `PUT /nanei/admin/countries/:id`

**Corps :** mêmes champs, tous facultatifs. Un `name` vide est ignoré. Le code est remis en majuscules.

**Réponse 200 :** `{ "success": true, "message": "Pays mis à jour avec succès", "data": { …country } }`.

**Erreurs :** 400 « Pays non trouvé » (⚠️ 400, pas 404) · 400 « Un pays avec ce code existe déjà » · 400 « Un pays avec ce nom existe déjà » · 400 « Erreur lors de la mise à jour du pays » · 500.

**Admin :** `countriesApi.update(id, { name, code, isActive })` (`src/api/countries.ts:9`), modale Pays en mode édition.

---

#### `DELETE /nanei/admin/countries/:id`

Suppression définitive.

**Réponse 200 :** `{ "success": true, "message": "Pays supprimé avec succès" }`.

**Erreurs :** 404 « Pays non trouvé » · **409** « Impossible de supprimer ce pays : il a encore des tarifs de transport et des tarifs de services. Supprimez d'abord les tarifs, ou désactivez le pays. » (tarifs nouveaux ou anciens, contacts favoris de clients) · 500 « Erreur lors de la suppression du pays ».

**Admin :** `countriesApi.delete(id)` (`src/api/countries.ts:11`), bouton Supprimer après confirmation.

---

## 13. Tarifs de transport

### Quelle table sert vraiment au calcul ?

Il existe deux tables. Les prix sont en **EUR**, les poids en **kg**.

| Table | Routes | Forme | Statut |
|---|---|---|---|
| `shipping_rates` (**nouvelle**) | `/nanei/admin/shipping-rates` | **une ligne par pays**, avec une tranche aérien et une tranche maritime | **utilisée en priorité** ; seule table gérée par l’admin |
| `shipping_prices` (**ancienne**) | `/nanei/admin/shipping-prices` | une ligne par pays + type + tranche de poids | **repli** seulement ; jamais gérée par l’admin |

Règle de calcul (`src/services/pricingCalculator.service.js:30-51`, utilisée par `POST /nanei/pricing/calculate` et par la création de colis ; même règle dans `GET /nanei/client/pricing/:countryId`) :

1. Si le pays a une ligne `shipping_rates` → on utilise **uniquement** cette ligne (l’ancienne table est ignorée pour ce pays, même pour l’autre type de transport).
2. Sinon → on utilise toutes les lignes `shipping_prices` du pays.
3. Le choix est fait **séparément** pour les services (§14) : un pays peut avoir des tarifs transport « nouveaux » et des tarifs services « anciens ».
4. Prix transport = `poids × pricePerKg` de la tranche où `minWeight ≤ poids ≤ maxWeight` (bornes **incluses**). Poids hors tranche → 400 « Aucune plage de poids ne correspond au poids de Xkg ». Pas de tranche pour ce type → « Aucun prix trouvé pour le pays et le type de transport spécifiés ».

> Avec la nouvelle table, un pays n’a **qu’une seule tranche par type** de transport. Pour plusieurs tranches, il faudrait l’ancienne table, que l’admin ne sait plus gérer.

---

### 13.1 Nouvelle table : `shipping-rates` (utilisée)

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/shipping-rates` | Admin |
| GET | `/nanei/admin/shipping-rates/:id` | Admin |
| POST | `/nanei/admin/shipping-rates` | Admin (audit `CREATE ShippingRate`) |
| PUT | `/nanei/admin/shipping-rates/:id` | Admin (audit `UPDATE ShippingRate`) |
| DELETE | `/nanei/admin/shipping-rates/:id` | Admin (audit `DELETE ShippingRate`) |

**Entité `shippingRate` :** `{ id, countryId, minWeightAerien, maxWeightAerien, priceAerienPerKg, minWeightMaritime, maxWeightMaritime, priceMaritimePerKg, createdAt, updatedAt, country: { id, name, code } }`. Poids en kg, prix en EUR par kg (nombres décimaux).

#### `GET /nanei/admin/shipping-rates`

**Query :** `countryId` (UUID, facultatif) filtre sur un pays. Pas de pagination. Tri par `countryId`.

**Réponse 200 :** `{ "success": true, "data": [ { "id": "…", "countryId": "…", "minWeightAerien": 0, "maxWeightAerien": 30, "priceAerienPerKg": 9.5, "minWeightMaritime": 0, "maxWeightMaritime": 500, "priceMaritimePerKg": 3, "country": { "id": "…", "name": "Mali", "code": "MLI" } } ] }`.

**Erreurs :** 500 `{ success: false, message: "Erreur serveur", error }`.

**Admin :** `shippingRatesApi.list()` (`src/api/countries.ts:32`), onglet « Tarifs transport » de `CountriesPage`. Lit `res.data.data`.

---

#### `GET /nanei/admin/shipping-rates/:id`

**Réponse 200 :** `{ "success": true, "data": { …shippingRate } }`.

**Erreurs :** 404 `{ success: false, message: "Tarif non trouvé" }` · 500 (ex. `id` non UUID).

**Admin :** non appelée par l’admin.

---

#### `POST /nanei/admin/shipping-rates`

> Valeurs numériques contrôlées par le back : poids ≥ 0, prix > 0, poids max. > poids min. ; sinon 400 avec le champ en cause. L’admin accepte la virgule (« 4,75 ») : avant, `parseFloat` coupait à la virgule et enregistrait 4.

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `countryId` | UUID | **oui** | pays existant ; **un seul** tarif par pays |
| `minWeightAerien` | number (kg) | **oui** | < `maxWeightAerien` |
| `maxWeightAerien` | number (kg) | **oui** | — |
| `priceAerienPerKg` | number (EUR/kg) | **oui** | aucun contrôle de signe |
| `minWeightMaritime` | number (kg) | **oui** | < `maxWeightMaritime` |
| `maxWeightMaritime` | number (kg) | **oui** | — |
| `priceMaritimePerKg` | number (EUR/kg) | **oui** | aucun contrôle de signe |

Les 7 champs sont obligatoires (`null` refusé, `0` accepté). Aucune règle sur les valeurs négatives.

**Réponse 201 :** `{ "success": true, "message": "Tarif créé avec succès", "data": { …shippingRate } }`.

**Erreurs :** 400 « Tous les champs sont obligatoires (aérien + maritime) » · 400 « Poids min aérien doit être < poids max aérien » · 400 « Poids min maritime doit être < poids max maritime » · 400 « Pays non trouvé » · 400 « Un tarif existe déjà pour ce pays. Modifiez-le. » · 500.

> Effet immédiat : dès sa création, cette ligne **remplace** l’ancienne table `shipping_prices` pour ce pays dans tous les calculs de prix.

**Admin :** `shippingRatesApi.create(payload)` (`src/api/countries.ts:33`). Formulaire en deux étapes (maritime puis aérien) ; les 7 champs sont envoyés via `parseFloat`. Libellés « Poids (kg) » et « Prix par kg (€) ».

---

#### `PUT /nanei/admin/shipping-rates/:id`

> Valeurs numériques contrôlées par le back : poids ≥ 0, prix > 0, poids max. > poids min. ; sinon 400 avec le champ en cause. L’admin accepte la virgule (« 4,75 ») : avant, `parseFloat` coupait à la virgule et enregistrait 4.

**Corps :** mêmes champs, tous facultatifs (`null`/absent = valeur actuelle conservée). Le contrôle min < max n’est fait que si **les deux** bornes d’un même type sont envoyées.

**Réponse 200 :** `{ "success": true, "message": "Tarif mis à jour", "data": { …shippingRate } }`.

**Erreurs :** 400 « Tarif non trouvé » (⚠️ 400, pas 404) · 400 « Poids min aérien doit être < poids max aérien » · 400 « Poids min maritime doit être < poids max maritime » · 500.

> `countryId` est modifiable mais **sans contrôle** : ni existence du pays (→ 500), ni unicité (deux tarifs possibles pour un même pays ; le calcul prendra alors une ligne au hasard).

**Admin :** `shippingRatesApi.update(id, payload)` (`src/api/countries.ts:34`), envoie les 7 champs + `countryId` (liste Pays désactivée en édition, donc inchangé).

---

#### `DELETE /nanei/admin/shipping-rates/:id`

**Réponse 200 :** `{ "success": true, "message": "Tarif supprimé" }`.

**Erreurs :** 404 « Tarif non trouvé » · 500.

> Effet : le pays **retombe** sur l’ancienne table `shipping_prices` (si elle contient des lignes), sinon il n’a plus de prix.

**Admin :** `shippingRatesApi.delete(id)` (`src/api/countries.ts:35`), après confirmation.

---

### 13.2 Ancienne table : `shipping-prices` (repli, non gérée par l’admin)

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/shipping-prices` | Admin |
| GET | `/nanei/admin/shipping-prices/:id` | Admin |
| POST | `/nanei/admin/shipping-prices` | Admin (audit `CREATE ShippingPrice`) |
| POST | `/nanei/admin/shipping-prices/bulk` | Admin (audit `BULK_UPSERT ShippingPrice`) |
| PUT | `/nanei/admin/shipping-prices/:id` | Admin (audit `UPDATE ShippingPrice`) |
| DELETE | `/nanei/admin/shipping-prices/:id` | Admin (audit `DELETE ShippingPrice`) |

**Entité `shippingPrice` :** `{ id, countryId, type, minWeight, maxWeight, pricePerKg, createdAt, updatedAt, country: { id, name, code } }`. `type` ∈ `aérien` | `maritime` (**avec accent**). Poids en kg, prix en EUR/kg.

#### `GET /nanei/admin/shipping-prices`

**Query :** `countryId` (UUID), `type` (`aérien` | `maritime`), facultatifs. Pas de pagination. Tri : pays, type, `minWeight`.

**Réponse 200 :** `{ "message": "Prix de transport récupérés avec succès", "data": [ …shippingPrice ] }`.

**Erreurs :** 400 « Erreur lors de la récupération des prix de transport » · 500.

**Admin :** `shippingPricesApi.list()` existe (`src/api/countries.ts:15`) mais n’est **jamais appelée**.

#### `GET /nanei/admin/shipping-prices/:id`

**Réponse 200 :** `{ "message": "Prix de transport récupéré avec succès", "data": { … } }`. **Erreurs :** 404 « Prix de transport non trouvé » · 404 « Erreur lors de la récupération du prix » · 500.

**Admin :** non appelée par l’admin.

#### `POST /nanei/admin/shipping-prices`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `countryId` | UUID | **oui** | pays existant |
| `type` | string | **oui** | `aérien` ou `maritime` exactement |
| `minWeight` | number (kg) | **oui** | < `maxWeight` |
| `maxWeight` | number (kg) | **oui** | — |
| `pricePerKg` | number (EUR/kg) | **oui** | aucun contrôle de signe |

**Chevauchements refusés** pour un même pays + type (test strict : `min < autreMax` et `max > autreMin`). Deux tranches qui se touchent (`0–10` et `10–20`) sont acceptées ; au calcul, 10 kg tombe dans la première.

**Réponse 201 :** `{ "success": true, "message": "Prix de transport créé avec succès", "data": { …shippingPrice } }`.

**Erreurs :** 400 « Tous les champs sont obligatoires » · 400 « Type invalide. Doit être "aérien" ou "maritime" » · 400 « Le poids minimum doit être inférieur au poids maximum » · 400 « Pays non trouvé » · 400 « Une plage de poids qui chevauche existe déjà pour ce pays et ce type de transport » · 400 « Erreur lors de la création du prix » · 500.

**Admin :** `shippingPricesApi.create()` existe (`src/api/countries.ts:16`), jamais appelée.

#### `POST /nanei/admin/shipping-prices/bulk`

Crée ou met à jour d’un coup les lignes aérien **et** maritime d’une même tranche.

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `countryId` | UUID | **oui** | pays existant |
| `minWeight`, `maxWeight` | number (kg) | **oui** | min < max |
| `aerienPricePerKg`, `maritimePricePerKg` | number (EUR/kg) | **oui** | — |
| `aerienId`, `maritimeId` | UUID | non | si présent → mise à jour de cette ligne (sans contrôle de chevauchement) ; un id inconnu est ignoré sans erreur |

**Réponse 200 :** `{ "success": true, "message": "Tarifs créés/mis à jour avec succès", "data": [ … ] }`.

**Erreurs :** 400 « Tous les champs sont obligatoires » · 400 « Le poids minimum doit être inférieur au poids maximum » · 400 « Pays non trouvé » · 400 « Chevauchement de poids pour le type aérien|maritime » · 400 `{ success: false, message: "Erreur serveur", error }` · 500.

> Pas de transaction : si la ligne aérien est créée puis la maritime refusée, l’aérien reste en base.

**Admin :** non appelée par l’admin.

#### `PUT /nanei/admin/shipping-prices/:id`

Mêmes champs, facultatifs. **Réponse 200 :** `{ success: true, message: "Prix mis à jour avec succès", data }`. **Erreurs :** 400 « Prix de transport non trouvé » · 400 « Pays non trouvé » · 400 « Le poids minimum doit être inférieur au poids maximum » · 400 « Une plage de poids qui chevauche existe déjà » · 400 « Erreur lors de la mise à jour du prix » · 500.

> Le contrôle de chevauchement n’est fait **que si `countryId` est envoyé** (`shippingPrice.service.js:191`). Le `type` n’est pas validé en mise à jour (erreur base → 400 générique).

**Admin :** `shippingPricesApi.update()` existe (`src/api/countries.ts:18`), jamais appelée.

#### `DELETE /nanei/admin/shipping-prices/:id`

**Réponse 200 :** `{ success: true, message: "Prix supprimé avec succès" }`. **Erreurs :** 404 « Prix de transport non trouvé » · 404 « Erreur lors de la suppression du prix » · 500.

**Admin :** `shippingPricesApi.delete()` existe (`src/api/countries.ts:20`), jamais appelée.

---

## 14. Tarifs des services (récupération, livraison)

Même logique que §13 : la **nouvelle** table `service_rates` (une ligne par pays, deux prix) est utilisée en priorité ; l’**ancienne** `service_prices` sert de repli si le pays n’a pas de ligne `service_rates`. Prix forfaitaires en **EUR**, ajoutés au prix transport seulement si le client demande la récupération (`needsPickup`) ou la livraison (`needsDelivery`). Service absent → 0 €.

### 14.1 Nouvelle table : `service-rates` (utilisée)

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/service-rates` | Admin |
| GET | `/nanei/admin/service-rates/:id` | Admin |
| POST | `/nanei/admin/service-rates` | Admin (audit `CREATE ServiceRate`) |
| PUT | `/nanei/admin/service-rates/:id` | Admin (audit `UPDATE ServiceRate`) |
| DELETE | `/nanei/admin/service-rates/:id` | Admin (audit `DELETE ServiceRate`) |

**Entité `serviceRate` :** `{ id, countryId, prixRecuperation, prixLivraison, createdAt, updatedAt, country: { id, name, code } }`. Prix en EUR.

#### `GET /nanei/admin/service-rates`

Aucun filtre, pas de pagination. Tri par `createdAt` croissant.

**Réponse 200 :** `{ "data": [ { "id": "…", "countryId": "…", "prixRecuperation": 10, "prixLivraison": 15, "country": { "id": "…", "name": "Mali", "code": "MLI" } } ] }` (pas de clé `success`).

**Erreurs :** 500 `{ message: "Erreur serveur", error }`.

**Admin :** `serviceRatesApi.list()` (`src/api/countries.ts:56`), onglet Services de `CountriesPage`. Lit `res.data.data`.

#### `GET /nanei/admin/service-rates/:id`

**Réponse 200 :** `{ "data": { …serviceRate } }`. **Erreurs :** 404 `{ success: false, message: "Tarif service non trouvé" }` · 500.

**Admin :** non appelée par l’admin.

#### `POST /nanei/admin/service-rates`

> Valeurs numériques contrôlées par le back : poids ≥ 0, prix > 0, poids max. > poids min. ; sinon 400 avec le champ en cause. L’admin accepte la virgule (« 4,75 ») : avant, `parseFloat` coupait à la virgule et enregistrait 4.

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `countryId` | UUID | **oui** | pays existant ; **un seul** tarif de service par pays |
| `prixRecuperation` | number (EUR) | **oui** | absent refusé ; aucun contrôle de signe |
| `prixLivraison` | number (EUR) | **oui** | idem |

**Réponse 201 :** `{ "success": true, "message": "Tarif service créé avec succès", "data": { …serviceRate } }`.

**Erreurs :** 400 « Tous les champs sont obligatoires » · 400 « Pays non trouvé » · 400 « Un tarif de service existe déjà pour ce pays » · 500.

> ⚠️ Un `null` passe le contrôle (seul `undefined` est refusé) puis échoue en base → 500.

**Admin :** `serviceRatesApi.create({ countryId, prixRecuperation, prixLivraison })` (`src/api/countries.ts:57`), formulaire en deux étapes, libellés « Prix (€) ».

#### `PUT /nanei/admin/service-rates/:id`

> Valeurs numériques contrôlées par le back : poids ≥ 0, prix > 0, poids max. > poids min. ; sinon 400 avec le champ en cause. L’admin accepte la virgule (« 4,75 ») : avant, `parseFloat` coupait à la virgule et enregistrait 4.

**Corps :** `prixRecuperation`, `prixLivraison` (facultatifs). **`countryId` est ignoré.**

**Réponse 200 :** `{ "success": true, "message": "Tarif mis à jour", "data": { …serviceRate } }`.

**Erreurs :** 400 « Tarif service non trouvé » (⚠️ 400, pas 404) · 500.

**Admin :** `serviceRatesApi.update(id, { countryId, prixRecuperation, prixLivraison })` (`src/api/countries.ts:58`) ; `countryId` est envoyé mais la liste Pays est désactivée en édition.

#### `DELETE /nanei/admin/service-rates/:id`

**Réponse 200 :** `{ "success": true, "message": "Tarif supprimé" }`. **Erreurs :** 404 « Tarif service non trouvé » · 500.

> Effet : le pays retombe sur l’ancienne table `service_prices`.

**Admin :** `serviceRatesApi.delete(id)` (`src/api/countries.ts:59`).

---

### 14.2 Ancienne table : `service-prices` (repli, non gérée par l’admin)

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/service-prices` | Admin |
| GET | `/nanei/admin/service-prices/:id` | Admin |
| POST | `/nanei/admin/service-prices` | Admin (audit `CREATE ServicePrice`) |
| PUT | `/nanei/admin/service-prices/:id` | Admin (audit `UPDATE ServicePrice`) |
| DELETE | `/nanei/admin/service-prices/:id` | Admin (audit `DELETE ServicePrice`) |

**Entité `servicePrice` :** `{ id, serviceType, countryId, price, createdAt, updatedAt, country: { id, name, code } }`. `serviceType` ∈ `récupération` | `livraison` (**avec accent**). `price` en EUR.

#### `GET /nanei/admin/service-prices`

**Query :** `countryId`, `serviceType` (facultatifs). **Réponse 200 :** `{ "message": "Prix de services récupérés avec succès", "data": [ … ] }`. **Erreurs :** 400 « Erreur lors de la récupération des prix de services » · 500.

**Admin :** `servicePricesApi.list()` existe (`src/api/countries.ts:39`), jamais appelée.

#### `GET /nanei/admin/service-prices/:id`

**Réponse 200 :** `{ "message": "Prix de service récupéré avec succès", "data": { … } }`. **Erreurs :** 404 « Prix de service non trouvé » · 404 « Erreur lors de la récupération du prix » · 500.

**Admin :** non appelée par l’admin.

#### `POST /nanei/admin/service-prices`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `serviceType` | string | **oui** | `récupération` ou `livraison` |
| `countryId` | UUID | **oui** | pays existant ; un seul prix par pays + service |
| `price` | number (EUR) | **oui** | — |

**Réponse 201 :** `{ success: true, message: "Prix de service créé avec succès", data }`. **Erreurs :** 400 « Tous les champs sont obligatoires » · 400 « Type de service invalide. Doit être "récupération" ou "livraison" » · 400 « Pays non trouvé » · 400 « Un prix pour ce service et ce pays existe déjà » · 400 « Erreur lors de la création du prix » · 500.

**Admin :** `servicePricesApi.create()` existe (`src/api/countries.ts:40`), jamais appelée.

#### `PUT /nanei/admin/service-prices/:id`

Mêmes champs, facultatifs. Pas de contrôle de doublon en mise à jour. **Réponse 200 :** `{ success: true, message: "Prix mis à jour avec succès", data }`. **Erreurs :** 400 « Prix de service non trouvé » · 400 « Pays non trouvé » · 400 « Type de service invalide » · 400 « Erreur lors de la mise à jour du prix » · 500.

**Admin :** `servicePricesApi.update()` existe (`src/api/countries.ts:42`), jamais appelée.

#### `DELETE /nanei/admin/service-prices/:id`

**Réponse 200 :** `{ success: true, message: "Prix supprimé avec succès" }`. **Erreurs :** 404 « Prix de service non trouvé » · 404 « Erreur lors de la suppression du prix » · 500.

**Admin :** `servicePricesApi.delete()` existe (`src/api/countries.ts:44`), jamais appelée.

---

## 15. Taux de change

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/taux-change` | Admin |
| GET | `/nanei/admin/taux-change/:id` | Admin |
| PUT | `/nanei/admin/taux-change/:id` | Admin (audit `UPDATE TauxChange`) |

Pas de POST ni de DELETE : une seule ligne, créée par la migration `20260722090000-create-taux-change.js` (1 EUR = 655,957 FCFA).

**Entité `tauxChange` :** `{ id, devise_source: "EUR", devise_cible: "FCFA", valeur, createdAt, updatedAt }` (noms de colonnes en snake_case pour les devises).

**À quoi sert ce taux :** le « taux actif » est la **plus ancienne** ligne `EUR → FCFA` (repli : 655.957 si aucune ligne). Il sert à :
- l’affichage FCFA dans le mobile (`GET /nanei/pricing/taux-change`, public) ;
- **le montant réellement débité** chez Wave / Orange Money : `round(prix du colis en EUR × taux)` en XOF (`services/client/paiement.service.js:23-26`), borné entre 100 et 10 000 000 XOF ;
- le montant XOF affiché sur les factures PDF (`services/pdf/facture.service.js:12-13`).

> Modifier ce taux change donc **immédiatement** les montants facturés aux clients. Un paiement en cours créé avec l’ancien taux peut ne plus être reconnu au retour Wave (comparaison stricte du montant).

#### `GET /nanei/admin/taux-change`

**Réponse 200 :** `{ "data": [ { "id": "…", "devise_source": "EUR", "devise_cible": "FCFA", "valeur": 655.957, "createdAt": "…", "updatedAt": "…" } ] }`. Tri par `createdAt`.

**Erreurs :** 500 `{ message: "Erreur serveur", error }`.

**Admin :** `tauxChangeApi.list()` (`src/api/countries.ts:73`), onglet « Taux de change » de `CountriesPage`. Affiche « 1 EUR = 655,957 FCFA ».

#### `GET /nanei/admin/taux-change/:id`

**Réponse 200 :** `{ "data": { …tauxChange } }`. **Erreurs :** 404 `{ success: false, message: "Taux de change non trouvé" }` · 500.

**Admin :** non appelée par l’admin.

#### `PUT /nanei/admin/taux-change/:id`

> L’admin accepte la virgule (« 655,957 ») : avant, `parseFloat` enregistrait 655. Ce taux fixe le montant débité chez Wave / Orange Money.

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `valeur` | number | **oui** | nombre strictement positif (nombre de FCFA pour 1 EUR) ; chaîne numérique acceptée |

Seul `valeur` est modifiable.

**Réponse 200 :** `{ "success": true, "message": "Taux de change mis à jour", "data": { …tauxChange } }`.

**Erreurs :** 400 « Taux de change non trouvé » (⚠️ 400, pas 404) · 400 « La valeur du taux doit être un nombre positif » · 500.

**Admin :** `tauxChangeApi.update(id, valeur)` (`src/api/countries.ts:74`) avec `{ valeur: parseFloat(saisie) }`, modale « Modifier le taux de change ».

---

## 16. Paiements

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/admin/paiements` | Admin |
| GET | `/nanei/admin/paiements/stats` | Admin |
| PUT | `/nanei/admin/paiements/:id/statut` | Admin (audit `UPDATE_STATUT Paiement`) |

**Entité `paiement` (JSON) :** `{ id, colisId, payeurId, prixTotal, montantPaye, moyenPaiement, statut, referenceTransaction, checkoutUrl, createdAt, updatedAt }`.
- `prixTotal`, `montantPaye` : **en EUR**, renvoyés en **nombres** (ex. `45.5`). `colis.poids` aussi.
- `montantPaye` = prix du colis (EUR) une fois payé ; `0.00` sinon. Le montant réellement débité en XOF n’est **pas stocké** (il se recalcule : EUR × taux).
- `moyenPaiement` ∈ `orange_money` | `wave` | `null`.
- `statut` ∈ `en_attente` | `en_cours` | `paye` | `echoue` | `rembourse`.
- `webhookPayload` (JSON brut de l’opérateur) n’est plus renvoyé.

#### `GET /nanei/admin/paiements`

Aucun filtre, **pas de pagination** (tous les paiements). Tri : plus récent d’abord.

**Réponse 200 :**
```json
{ "success": true, "data": [ {
  "id": "…", "colisId": "…", "payeurId": "…",
  "prixTotal": 45.5, "montantPaye": 45.5,
  "moyenPaiement": "wave", "statut": "paye",
  "referenceTransaction": "cos-…", "checkoutUrl": "https://…",
  "createdAt": "…", "updatedAt": "…",
  "colis": { "id": "…", "reference": "…", "poids": 12, "destination": "Mali", "type_colis": "…", "statut": "en_attente" },
  "payeur": { "id": "…", "nom": "…", "prenom": "…", "email": "…", "telephone": "…" }
} ] }
```

**Erreurs :** 500 `{ success: false, message: "Erreur serveur", error }`.

**Admin :** `paiementsApi.list()` (`src/api/paiements.ts:45`), `PaiementsPage`. Recherche (référence, nom, destination) et filtre par statut faits **côté navigateur**. Affiche `prixTotal` et `montantPaye` **en euros**, avec en dessous l’équivalent FCFA au taux de change actuel (`GET /admin/taux-change`, couple EUR → FCFA).

#### `GET /nanei/admin/paiements/stats`

**Réponse 200 :** `{ "success": true, "data": { "total": 120, "paye": 80, "enAttente": 30, "enCours": 5, "echoue": 4, "rembourse": 1, "montantTotal": 3640.5 } }`.

- Comptes par statut sur **tous** les paiements (pas de période).
- `montantTotal` = somme de `montantPaye` des paiements `paye`, **en EUR**, nombre arrondi à 2 décimales.

**Erreurs :** 500.

**Admin :** `paiementsApi.stats()` (`src/api/paiements.ts:46`). Cartes « Total », « Payés », « En attente » (= `enAttente + enCours`), « Montant encaissé » (en euros, avec l’équivalent FCFA au taux actuel).

#### `PUT /nanei/admin/paiements/:id/statut`

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `statut` | string | **oui** | `en_attente` · `en_cours` · `paye` · `echoue` · `rembourse` |

Aucune règle de transition (on peut passer de `paye` à `en_attente`). Passage à `paye` avec `montantPaye` à 0 (paiement validé à la main) → `montantPaye = prixTotal`. Le colis et les notifications ne sont pas touchés. Aucun remboursement réel n’est déclenché chez l’opérateur.

**Réponse 200 :** `{ "success": true, "message": "Statut mis à jour", "data": { …paiement } }`.

**Erreurs :** 400 « Statut invalide. Valeurs: en_attente, en_cours, paye, echoue, rembourse » · 400 « Paiement non trouvé » (⚠️ 400, pas 404) · 500.

> Un paiement passé à `paye` à la main est donc compté dans `montantTotal` et dans le CA du rapport mensuel.

**Admin :** `paiementsApi.changerStatut(id, statut)` (`src/api/paiements.ts:47`), menu déroulant de statut avec confirmation.

---

## 17. Rapports et tableau de bord

### 17.1 Rapports mensuels

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/admin/rapports/generer` | Admin (audit `GENERATE Rapport`) |
| GET | `/nanei/admin/rapports` | Admin |
| GET | `/nanei/admin/rapports/:filename` | Admin |

Un rapport = un PDF du **mois précédent** : nombre de paiements `paye` créés dans le mois, CA, CA par destination. Il est aussi généré automatiquement le 1er de chaque mois à 6h00 (tâche cron) et un e-mail résumé part vers `EMAIL_ADMIN`. Fichiers stockés dans un dossier **privé**, `<racine>/uploads/rapports/rapport-AAAA-MM.pdf` (`/app/uploads/rapports` en production, sur le volume Docker `uploads_data` : conservés entre deux déploiements). Ce dossier n’est jamais servi en statique ; la variable `RAPPORTS_DIR` permet de le changer (`utils/rapportsStockage.js`). Les anciens rapports de `src/uploads/rapports` y sont déplacés automatiquement.

#### `POST /nanei/admin/rapports/generer`

Pas de corps. Génère (ou **écrase**) le rapport du mois précédent.

> Avant ce correctif, la génération échouait **toujours** (à la main comme le 1er du mois) : `Paiement` était importé depuis `models/index.js`, qui ne l’exporte pas. Vérifié avec des paiements simulés : 45,50 + 12,00 + 3,10 → « 60,60 € ».
> Règle métier : le mois est déterminé par la date de **création** du paiement (`created_at`), pas par sa date d’encaissement. Génération synchrone (PDF via navigateur sans tête). Pas d’e-mail envoyé dans ce cas.

**Réponse 200 :** `{ "success": true, "message": "Rapport de septembre 2026 généré avec succès", "rapport": { "filename": "rapport-2026-09.pdf", "moisLabel": "septembre 2026", "caTotal": 60.6, "nbColis": 3, "mois": "septembre", "annee": "2026", "label": "Septembre 2026", "url": "/nanei/admin/rapports/rapport-2026-09.pdf" } }`.

> `caTotal` : somme des `montantPaye` (repli sur `prixTotal`) **en EUR**, arrondie à 2 décimales. Le PDF et l’e-mail l’affichent en euros (« 60,60 € »). `nbColis` = nombre de paiements payés.

**Erreurs :** 500 `{ success: false, message: "Erreur lors de la génération du rapport" }`.

**Admin :** `rapportsApi.generate()` (`src/api/rapports.ts`, délai 120 s), bouton « Générer » de `RapportsPage`. N’utilise pas le contenu de la réponse (simple notification).

#### `GET /nanei/admin/rapports`

Liste des fichiers `.pdf` du dossier, tri par nom **décroissant** (le plus récent d’abord). Pas de pagination.

**Réponse 200 :** `{ "success": true, "rapports": [ { "filename": "rapport-2026-09.pdf", "mois": "septembre", "annee": "2026", "label": "Septembre 2026", "url": "/nanei/admin/rapports/rapport-2026-09.pdf", "taille": 48213 } ] }` (`taille` en octets ; `url` = route protégée). Aucun rapport → `rapports: []`.

**Erreurs :** 500 `{ success: false, message: "Erreur serveur" }`.

**Admin :** `rapportsApi.list()` (`src/api/rapports.ts:5`). Lit `res.data.data ?? res.data.rapports`. Affiche `rapport.label` (« Septembre 2026 »).

#### `GET /nanei/admin/rapports/:filename`

- **Type de contenu :** `application/pdf`, `Content-Disposition: attachment; filename="<filename>"`.
- `filename` ne doit contenir ni `..`, ni `/`, ni `\`.

**Erreurs :** 400 « Nom de fichier invalide » · 404 « Fichier introuvable » · 500 « Erreur serveur » (JSON).

**Admin :** `rapportsApi.download(filename)` (`src/api/rapports.ts:6`) avec `responseType: 'blob'`, puis enregistrement local du fichier.

> L’ancienne adresse publique `GET /uploads/rapports/<filename>` répond toujours **404** (garde dans `app.js`) : un rapport ne se télécharge qu’avec un jeton admin.

---

### 17.2 Tableau de bord

Il n’existe **pas** de route dédiée « dashboard » ou « statistiques globales ». `DashboardPage` assemble des compteurs venant des routes de gestion (toutes `authMiddleware` + `isAdmin`, détaillées dans leurs sections) :

| Indicateur | Route | Clé lue par l’admin | Clé renvoyée par le back |
|---|---|---|---|
| Clients | `GET /nanei/admin/nombre-utilisateurs` | `total ?? nombre` | `{ success, total }` (rôle Particulier) |
| Admins | `GET /nanei/admin/nombre-admins` | `data ?? nombre` | `{ success, data }` |
| Colis | `GET /nanei/admin/nombre-colis` | `nombre_colis ?? total ?? nombre` | `{ success, message, nombre_colis }` |
| En attente | `GET /nanei/admin/nombre-colis-en-attente` | idem | `{ …, nombre_colis }` |
| Récupérés | `GET /nanei/admin/nombre-colis-recuperes` | idem | `{ …, nombre_colis }` |
| Livrés | `GET /nanei/admin/nombre-colis-livres` | idem | `{ …, nombre_colis }` |
| Colis bloqués (> 3 jours en attente) | `GET /nanei/admin/colis-en-attente` | `colis ?? data` | `{ success, message, colis: [...] }` — filtre 3 jours fait **côté navigateur** |
| 8 derniers colis | `GET /nanei/admin/liste-colis` | `colis ?? data` | `{ success, message, colis: [...] }` — **tous** les colis sont chargés puis coupés à 8 côté navigateur |

**Admin :** `clientsApi.count()`, `adminsApi.count()`, `colisApi.count()`, `colisApi.countEnAttente()`, `colisApi.countRecuperes()`, `colisApi.countLivres()`, `colisApi.enAttente()`, `colisApi.list()`. Les clés lues correspondent bien au back (grâce aux replis `??`). Le prix des colis y est affiché en € (`formatPrice(c.prix)`), ce qui est correct.

Autres routes de statistiques existantes, **non utilisées** par le tableau de bord : `GET /nanei/admin/paiements/stats` (utilisée par `PaiementsPage` seulement), `GET /nanei/admin/messages/stats`, `GET /nanei/messages/stats`.


---

## Annexe A — Énumérations métier

### Statut de colis (`colis.statut`)

| Ordre | Code (back et admin) | Libellé admin | Libellé notif. back |
|---|---|---|---|
| 1 | `en_attente` (défaut) | En attente | En attente |
| 2 | `recupere` | Récupéré (filtre : « Récupérés ») | Récupéré |
| 3 | `livre` | Livré (filtre : « Livrés ») | Livré |

Source : `nanei/src/models/colis.model.js:65-72` · `admin-nanei/src/types/index.ts:22` · `admin-nanei/src/features/colis/ColisPage.tsx:17-34`. Aucun autre statut n’existe côté back. Les deux côtés sont alignés.

### Type de transport (`colis.type_transport`)

`aerien` | `maritime` (sans accent), ou `null`. Lecture normalisée : `type_transport`, sinon `type_colis`, sinon `aerien` (`nanei/src/utils/typeTransport.js`). **Absent du type `Colis` admin** (`admin-nanei/src/types/index.ts:14-27`) et jamais affiché.

### Statut de réclamation

| Code | Libellé admin | Remarque |
|---|---|---|
| `ouverte` | Ouverte | défaut à la création |
| `en_cours` | En cours | — |
| `resolue` | Résolue | — |
| `rejetee` | Rejetée | — |

Source : `nanei/src/models/reclamation.model.js:33-37` · `admin-nanei/src/types/index.ts:88` · `ReclamationsPage.tsx:12-17`. Alignés.

### Type de réclamation

| Code back | Code admin | Libellé admin |
|---|---|---|
| `perdu` | `perdu` | Colis perdu |
| `endommagé` (avec accent ; `endommage` accepté à la création et converti) | `endommage` (sans accent) | Colis endommagé |
| `retard` | `retard` | Retard de livraison |
| `autre` | `autre` | Autre |

Source : `nanei/src/models/reclamation.model.js:20-23`, `controllers/client/reclamation.controller.js:18-24` · `admin-nanei/src/types/index.ts:89`, `ReclamationsPage.tsx:19-24`. **Désaccord** sur `endommagé` (voir Annexe B).

### Statut de paiement (export)

`en_attente` · `en_cours` · `paye` · `echoue` · `rembourse` (`nanei/src/models/paiement.model.js:36`). Moyen : `orange_money` · `wave`.

### Note d’avis

Entier de 1 à 5.

### Rôles

`Admin` | `Particulier` (`nanei/src/models/utilisateur.model.js:38`). Seul `Admin` passe `isAdmin`.


---

## Annexe B — Écarts constatés et points de vigilance

Chemins : back = `nanei/src/…`, admin = `admin-nanei/src/…`. Les écarts sont numérotés par domaine : **A** = comptes, authentification, audit, support (§1 à §5) ; **B** = colis, étiquettes, preuves, avis, réclamations, exports (§6 à §11) ; **C** = pays, tarifs, taux de change, paiements, rapports (§12 à §17).

### B.0 Corrections prioritaires (toutes faites le 2026-10-11)

| Priorité | Statut | Écart | Côté corrigé | Effet avant correction |
|---|---|---|---|---|
| 1 | ✅ DONE | **A17** Mot de passe du nouvel admin en clair dans le journal d’audit | back | visible par tous les admins |
| 2 | ✅ DONE | **A18, A19** Hash du mot de passe, `resetPasswordToken`, `otpCode`, `fcm_token` renvoyés au navigateur | back | fuite de données sensibles |
| 3 | ✅ DONE | **C3** Rapports financiers PDF téléchargeables sans jeton (`/uploads/rapports/…`) | back | fuite de données financières |
| 4 | ✅ DONE | **A20** Un admin peut désactiver n’importe quel compte, y compris le sien ou le dernier admin | back | blocage total du back-office possible |
| 5 | ✅ DONE | **A21, B26** HTML non échappé dans les e-mails (réponse au support, réclamation) | back | e-mails piégés envoyés depuis le domaine Nanei |
| 6 | ✅ DONE | **B2, B3** Pages Avis et Réclamations qui plantent dès qu’il y a une donnée | admin | écrans inutilisables |
| 7 | ✅ DONE | **B1** Preuve de livraison jamais affichée (et écrasée si on en renvoie une) | admin + back (409 sans confirmation) | preuve perdue |
| 8 | ✅ DONE | **B4** Commentaire admin de réclamation perdu (`commentaire` ≠ `commentaire_admin`) | admin + back (synonyme accepté) | le client ne reçoit pas la réponse |
| 9 | ✅ DONE | **C1** Montants des paiements affichés en FCFA alors qu’ils sont en EUR | admin + back (montants en nombres, montant encaissé des paiements validés à la main) | montants faux à l’écran |
| 10 | ✅ DONE | **C2** CA du rapport mensuel : « NaN FCFA » | back | rapport faux |
| 11 | ✅ DONE | **A1, A2** Journal d’audit : filtre de dates sans effet, colonnes « Entité ID » et « IP » vides | admin + back (date de fin incluse, pagination bornée) | audit inexploitable |
| 12 | ✅ DONE | **A9, A10** Pas de renouvellement du jeton : session admin coupée après 1 h, et tout 403 ou délai > 15 s déconnecte | admin | perte de saisie |


### B.1 Comptes, authentification, audit, support (A)

#### Bloquants

A1. ✅ DONE — **Filtre de dates du journal d’audit sans effet.** L’admin envoie `dateDebut` / `dateFin` (`features/audit/AuditLogPage.tsx:45-46`, `api/auditLogs.ts:5`) ; le back lit `date_debut` / `date_fin` (`routes/admin/auditlog.route.js:19-20, 30-34`). Les dates sont ignorées, la liste n’est pas filtrée.
A2. ✅ DONE — **Colonnes « Entité ID » et « IP » toujours vides dans le journal.** L’admin lit `log.entiteId` et `log.ip` (`features/audit/AuditLogPage.tsx:170, 183` ; type `types/index.ts:130-132`) ; le back renvoie `entite_id` et `ip_address` (`models/auditlog.model.js` ; `middlewares/auditlog.middleware.js:33, 39`).
A3. ✅ DONE (V9 : téléphone vide → NULL) — ⚠️ À vérifier (dépend des données) — **Création d’un 2ᵉ admin sans téléphone.** L’admin envoie `telephone: ""` (`features/admins/AdminsPage.tsx:18, 121`) ; le back ne contrôle l’unicité que si le téléphone est non vide (`services/admin/gestionadmin.service.js:61`) puis enregistre `""` dans une colonne `unique` (`models/utilisateur.model.js:32-36`). Dès qu’un compte a déjà `""`, la création échoue en 400 « Erreur lors de la création de l'admin ».

#### Mineurs

A4. ✅ DONE (V25 : types alignés) — **Clés de réponse mal typées (repli qui marche).** `api/admins.ts:5` attend `admins`, `api/clients.ts:5` attend `utilisateurs`, `api/auditLogs.ts:6` attend `data` ; le back renvoie `data` / `data` / `logs` (`gestionadmin.service.js:24`, `gestionutilisateur.controller.js:13`, `auditlog.route.js:51`). Les écrans lisent les deux (`AdminsPage.tsx:70`, `ClientsPage.tsx:21`, `AuditLogPage.tsx:49`).
A5. ✅ DONE (V25 : types alignés) — **Compteurs mal typés (repli qui marche).** `api/admins.ts:6` et `api/clients.ts:6` attendent `nombre` ; le back renvoie `data` (`gestionadmin.service.js:179`) et `total` (`gestionutilisateur.controller.js:82`). `DashboardPage.tsx:51-52` lit les bonnes clés.
A6. ✅ DONE (paramètres `admin_id`, `date_debut`, `date_fin` typés (`FiltresAudit`)) — **Paramètre de filtre d’audit mal nommé dans le type.** `api/auditLogs.ts:5` déclare `admin` ; l’écran envoie bien `admin_id` (`AuditLogPage.tsx:44`).
A7. ✅ DONE (V25 : recherche envoie `nom` / `prenom` / `email`) — **Recherche serveur inutilisable.** `api/admins.ts:7` et `api/clients.ts:7` envoient `?q=` ; le back lit `nom`, `prenom`, `email` (`gestionadmin.controller.js:112`, `gestionutilisateur.controller.js:106`). Fonctions jamais appelées. `rechercher-admin` renvoie un **tableau nu** (`gestionadmin.service.js:206`) alors que le type attend `{ admins }`.
A8. **Routes back jamais appelées par l’admin :** `GET /admin/rechercher-admin`, `GET /admin/rechercher-utilisateur`, `GET /admin/messages/stats` (`api/messages.ts:13` non utilisée), `POST /auth/refresh`, `GET /admin/hello`, et les doublons `/nanei/messages` (`routes/messageClient.route.js:11-17`).
A9. ✅ DONE — **Pas de refresh de session.** `refreshToken` est ignoré à la connexion (`features/auth/LoginPage.tsx:25` ; store `store/authStore.ts:38` ne le garde pas). L’admin est déconnecté au bout d’1 h (`config/security.js` `expiresIn: '1h'`), même en pleine saisie.
A10. ✅ DONE — **Tout 403 déconnecte l’admin** (`api/axios.ts:10, 59-61`), y compris les 403 métier (ex. « Ce colis ne vous appartient pas ») ; un délai > 15 s aussi (`axios.ts:66-73`).
A11. ✅ DONE — **L’admin connecté ne peut pas filtrer ses propres actions** dans le journal : la liste déroulante utilise `liste-admins` (`AuditLogPage.tsx:32`), qui l’exclut (`gestionadmin.service.js:13-15`). Incohérence aussi avec `nombre-admins`, qui le compte (`gestionadmin.service.js:173-175`).
A12. ✅ DONE (B.6 : codes 404 / 500 cohérents) — **Codes HTTP trompeurs.** `liste-admins`, `nombre-admins`, `rechercher-admin` répondent **200** avec `success: false` en cas d’erreur base (`gestionadmin.controller.js:7-9, 96-98, 114-116`) ; `activer/desactiver-admin` répondent 404 pour une erreur base (`gestionadmin.controller.js:56-58, 78-80`) ; `activer/desactiver-utilisateurs` répondent **400** (et non 404) pour « Utilisateur non trouvé » (`gestionutilisateur.controller.js:43, 67`).
A13. ✅ DONE — **Pagination de l’audit non bornée.** `limit` sans maximum, `page`/`limit` non numériques → 500 (`auditlog.route.js:14-15, 23, 42`). `date_fin` sans heure exclut la journée de fin.
A14. 🟡 EN PARTIE — création d’admin, inscription et changement : même règle (8 car., majuscule, minuscule, chiffre). Reste : la réinitialisation admin exige en plus un caractère spécial. Constat d’origine : **Politiques de mot de passe incohérentes.** Création d’admin : 8 caractères seulement (`gestionadmin.service.js:75`, écran sans contrôle `AdminsPage.tsx:119`) ; `change-password` : majuscule + minuscule + chiffre (`validations/common.js` `motDePasse`) ; reset admin : + caractère spécial (`adminAuth.service.js:199-210`).
A15. ✅ DONE (V20 : trois compteurs séparés) — **`authRateLimit` partagé** : une seule instance de 5 req / 15 min / IP pour login, refresh et mots de passe oubliés (`middlewares/rateLimit.middleware.js:14` ; `routes/auth.route.js:16, 19, 25-26` ; `routes/admin/adminAuth.route.js:15-16`). Quelques échecs de connexion bloquent aussi « mot de passe oublié ».
A16. ✅ DONE (B.6 : repli sur CORS_ORIGIN, alerte au démarrage, pas de lien localhost en production) — Lien de réinitialisation admin construit avec `FRONTEND_URL`, défaut `http://localhost:5173` (`services/adminAuth.service.js:78`). Si la variable manque en production, le lien est faux. Le chemin `/nanei/admin/reset-password` correspond bien à la route de l’écran (`router/index.tsx:26`).

#### Sécurité

A17. ✅ DONE — **Mot de passe en clair dans le journal d’audit.** `auditLog('CREATE', 'Admin')` (`routes/admin/gestionadmin.route.js:21`) enregistre `details.body = req.body` sans filtre (`middlewares/auditlog.middleware.js:37`) : le `mot_de_passe` du nouvel admin est stocké en clair, renvoyé par `GET /admin/audit-logs` (`auditlog.route.js:36-51`) et affiché à tous les admins (`AuditLogPage.tsx:158, 172-177`).
A18. ✅ DONE — **Hash `mot_de_passe` renvoyé.** `liste-admins` (`gestionadmin.service.js:17`, sans `attributes.exclude`), `ajouter-admin` (`:84-99`), `activer-admin` (`:113-129`), `desactiver-admin` (`:143-159`) renvoient l’objet complet : `mot_de_passe` (hash bcrypt), `resetPasswordToken`, `resetPasswordExpires`, `otpCode`, `fcm_token`… Le modèle n’a pas de `defaultScope` qui les masque (`models/utilisateur.model.js:80-85`).
A19. ✅ DONE — **Champs internes des clients exposés.** `liste-utilisateurs`, `rechercher-utilisateur`, `activer/desactiver-utilisateurs` n’excluent que `mot_de_passe` (`gestionutilisateur.service.js:13, 41, 65, 100`) : `fcm_token`, `resetPasswordToken`, `otpCode`, `passwordChangedAt` partent vers le navigateur.
A20. ✅ DONE — **Pas de contrôle du rôle de la cible.** `activer/desactiver-admin/:id` agit sur **n’importe quel** utilisateur (`gestionadmin.service.js:113, 143`) et `activer/desactiver-utilisateurs/:id` aussi, y compris un admin (`gestionutilisateur.service.js:28, 52`). Un admin peut se désactiver lui-même ou désactiver tous les autres ; il n’y a pas de super-admin (`utilisateur.model.js:38`) ni de garde « dernier admin actif ».
A21. ✅ DONE — **Injection HTML dans les e-mails de réponse.** `objet`, `messageOriginal` et `reponse` sont insérés sans échappement (`templates/mail/reponseMessage.template.js:28, 29, 34`). `objet`/`description` viennent du formulaire **public** `POST /nanei/messages` : n’importe qui peut faire envoyer, depuis le domaine Nanei, un e-mail HTML arbitraire (liens piégés) à l’adresse de son choix dès qu’un admin répond. L’objet sert aussi de sujet (`services/admin/messageClient.admin.service.js:22`).
A22. ✅ DONE (V8 : sessions révoquées, nouveaux jetons renvoyés) — **`change-password` ne coupe pas les sessions.** `passwordChangedAt` n’est pas mis à jour et les refresh tokens ne sont pas révoqués (`services/account.service.js:35-36`) : un jeton volé reste valable après le changement. (Le reset admin, lui, le fait : `adminAuth.service.js:183`.)
A23. ✅ DONE — **Refresh token jamais révoqué à la déconnexion.** L’admin appelle `POST /auth/logout` avec `""` (`layouts/DashboardLayout.tsx:40`) ; le refresh token émis au login reste valable 7 jours côté back (`controllers/auth.controller.js:138-141`). Risque faible : l’admin ne le stocke pas.
A24. ✅ DONE (B.6 : doublons retirés) — **Routes admin en doublon hors `/nanei/admin`.** `GET /nanei/messages`, `GET /nanei/messages/stats`, `POST /nanei/messages/:id/repondre` (`routes/messageClient.route.js:11-17`) échappent à `adminRateLimit` (`app.js` : limite montée sur `/nanei/admin` seulement) et au journal d’audit.
A25. ✅ DONE (B.6 : route retirée) — **Route publique dans le routeur admin.** `GET /nanei/admin/hello` sans `auth` ni `isAdmin` (`routes/admin/gestionutilisateur.route.js:49`). Sans danger, mais à retirer.
A26. ✅ DONE (B.6 : filtre global des réponses d’erreur) — **Détails techniques dans les 500.** `error: error.message` est renvoyé au client (`gestionadmin.controller.js:15, 44, 66, 88, 104, 122` ; `messageClient.admin.controller.js:8, 17`) ; `gestionutilisateur.controller.js` renvoie directement `error.message` comme `message`.
A27. ✅ DONE (B.6 : mot de passe vérifié avant l’état du compte) — **Énumération de comptes au login.** Le statut est testé **avant** le mot de passe (`services/auth.service.js:254-266`) : « Compte inactif » révèle qu’un compte existe et est désactivé, sans connaître le mot de passe.
A28. ✅ DONE (V9 : e-mail, nom, prénom et mot de passe contrôlés) — **Création d’admin sans validation d’entrée.** Aucune validation Joi sur `ajouter-admin` (`routes/admin/gestionadmin.route.js:17-23`) ; mot de passe admin à 8 caractères sans complexité (`gestionadmin.service.js:75`).


### B.2 Colis, étiquettes, preuves, avis, réclamations, exports (B)

#### Bloquants

B1. ✅ DONE — **Preuve de livraison jamais affichée.** Back renvoie `{ success, preuve: { photo_url, … } }` (`controllers/admin/preuve.controller.js:56`, champ `models/preuvelivraison.model.js:16`). Admin lit `res.data.data` (`features/colis/ColisPage.tsx:116`) puis `preuve.photo` (`ColisPage.tsx:172,176`) ; type `PreuveLivraison { photo, lat, lng }` (`types/index.ts:144-150`) au lieu de `photo_url`, `gps_lat`, `gps_lng`. Effet : la modale dit toujours « Aucune preuve » et propose d’en ajouter une, ce qui **écrase** la preuve existante.
B2. ✅ DONE — **Page Avis plante dès qu’il y a un avis.** Back renvoie `utilisateur: { nom, prenom, email }` et `colis: { reference, destination }` (`controllers/client/avis.controller.js:69-72`). Admin lit `a.client.prenom` (`features/avis/AvisPage.tsx:154`) → `TypeError` (client indéfini) ; et `a.colisReference` (`AvisPage.tsx:151`) → vide. Type `Avis` faux (`types/index.ts:110-117`).
B3. ✅ DONE — **Page Réclamations plante dès qu’il y a une réclamation.** Back renvoie `utilisateur: { nom, prenom, email, telephone }` et `colis: { reference, … }` (`controllers/client/reclamation.controller.js:121-125`). Admin lit `r.client.prenom` / `r.client.email` (`features/reclamations/ReclamationsPage.tsx:321-322`, et dans la modale `:159-160`) → `TypeError` ; `r.colisReference` (`:155`, `:318`) → vide. Type `Reclamation` faux (`types/index.ts:98-108`).
B4. ✅ DONE — **Commentaire admin de réclamation perdu.** Admin envoie `{ statut, commentaire }` (`api/reclamations.ts:8`) ; back lit `commentaire_admin` (`controllers/client/reclamation.controller.js:139,153`). Le commentaire n’est ni enregistré ni ajouté à l’e-mail/SMS. De plus l’admin n’affiche jamais `commentaire_admin` existant.

#### Mineurs

B5. ✅ DONE — **Filtre par note des avis sans effet.** Admin envoie `?note=n` (`api/avis.ts:6`, `AvisPage.tsx:52`) ; back ignore tout paramètre (`controllers/client/avis.controller.js:66-74`). La liste n’est pas filtrée.
B6. ✅ DONE — **Type de réclamation `endommagé` sans libellé.** Back stocke `endommagé` avec accent (`models/reclamation.model.js:21`) ; admin attend `endommage` (`types/index.ts:89`, `ReclamationsPage.tsx:21`) → `TYPE_LABELS[r.type]` vide (`ReclamationsPage.tsx:142,324`).
B7. ✅ DONE (bloc « Historique » remplacé par « Dernier message envoyé au client ») — **Historique de réclamation inexistant.** Admin affiche `reclamation.historique` (`ReclamationsPage.tsx:185-204`, `types/index.ts:91-96,106`) ; le back n’a ni colonne ni table d’historique de réclamation. Bloc jamais affiché (code mort).
B8. ✅ DONE (type mis à jour, mode de transport affiché dans le tableau des colis) — **`type_transport` non affiché.** Champ renvoyé par les listes (`models/colis.model.js:60`) mais absent du type `Colis` admin (`types/index.ts:14-27`), des tableaux `ColisPage.tsx:341` et `EtiquettesPage.tsx:111`. `type_colis` n’est pas affiché non plus.
B9. ✅ DONE (colonne `type_transport` ajoutée à l’export) — **Export : pas de colonne `type_transport`** (`controllers/admin/export.controller.js:32-46`).
B10. ✅ DONE (V11) — **Export : colonne `created_at` vide.** Lecture de `c.created_at` / `p.created_at` (`controllers/admin/export.controller.js:45,108`) alors que l’attribut Sequelize est `createdAt` (modèles `underscored: true`). ⚠️ À vérifier par un export réel.
B11. ✅ DONE (V12) — **Export : borne `date_fin` exclusive du jour choisi.** Admin envoie `AAAA-MM-JJ` (`features/export/ExportPage.tsx:154,203`, `type="date"`) ; back fait `new Date(date_fin)` = minuit UTC (`controllers/admin/export.controller.js:10`). Les colis du jour de fin sont exclus.
B12. ✅ DONE (V25) — **Types de réponse TypeScript faux dans `src/api/colis.ts`.** Génériques `{ data: Colis[] }` et `{ nombre: number }` (`api/colis.ts:5-13`) alors que le back renvoie `colis` et `nombre_colis` (`services/admin/gestioncolis.service.js:79-83,94-98`). Sans effet à l’exécution (les écrans castent en `any` et lisent `colis` / `nombre_colis`), mais trompeur.
B13. ✅ DONE (type admin corrigé (pas d’id renvoyé)) — **`expediteur.id` / `recepteur.id` absents.** Type admin les déclare (`types/index.ts:24-25`) ; le back ne renvoie que `nom, prenom, email, telephone` (`gestioncolis.service.js:68,73`). Pas utilisé à l’écran aujourd’hui.
B14. **Route back jamais utilisée :** `GET /nanei/admin/colis-recherche/:reference` (`colisApi.search`, `api/colis.ts:13`, jamais appelée). Elle renvoie 200 avec `colis: null` si la référence n’existe pas (`gestioncolis.service.js:262-286`).
B15. ✅ DONE (B.6 : transitions contrôlées) — **Aucun contrôle de transition de statut colis.** `changerEnAttente/Livre/Recupere` acceptent tout (`gestioncolis.service.js:294-336`) ; un retour `livre` → `en_attente` renvoie push + SMS + e-mails aux deux parties et crée une ligne d’historique, même si le statut ne change pas. Côté admin, seul le statut identique est bloqué (`ColisPage.tsx:84`).
B16. ✅ DONE (V15 : notifications en arrière-plan) — **Changement de statut lent.** Push, SMS et e-mails sont attendus un par un avant la réponse (`gestioncolis.service.js:25-55`). L’admin a un timeout de 15 s et **déconnecte** l’utilisateur en cas de timeout (`api/axios.ts:29,68-73`). ⚠️ À vérifier en conditions réelles (même risque pour l’étiquette PDF via Chromium et les gros exports).
B17. ✅ DONE (création ou remplacement explicite, plus d’upsert) — **Preuve : code 201 jamais renvoyé.** `PreuveLivraison.upsert` sur Postgres renvoie `created = null` (`controllers/admin/preuve.controller.js:29-40`) → toujours 200 « Preuve mise à jour ». ⚠️ À vérifier : un 2e envoi pour le même colis peut lever une violation d’unicité (`colis_id`) si Sequelize choisit `id` comme cible `ON CONFLICT` → 500.
B18. ✅ DONE (preuve refusée (409) si le colis n’est pas livré) — **Preuve sans contrôle de statut.** Le back accepte une preuve pour un colis non livré (`preuve.controller.js:16-27`) ; l’admin ne montre le bouton que pour `livre` (`ColisPage.tsx:388`).
B19. ✅ DONE (B.6 : filtre `statut` des réclamations → 400) — **Valeur de filtre invalide → 500** au lieu de 400 : `statut` des exports (`export.controller.js:21,86`) et de la liste des réclamations (`reclamation.controller.js:114-115`), `statut` du PUT réclamation (`:152`).
B20. ✅ DONE (B.6 : pagination) — **Pas de pagination** sur `liste-colis`, `colis-*`, avis, réclamations, exports. L’admin charge tout à chaque écran (Dashboard : 6 requêtes colis au chargement). Avec la limite de 200 req/15 min/IP sur `/nanei/admin` (`config/security.js:76-82`), une utilisation intense peut recevoir des 429. ⚠️ À vérifier.
B21. ✅ DONE (B.6 : pays déduit de l’indicatif) — **Étiquette : pays expéditeur figé** à « MALI » (`controllers/admin/etiquette.controller.js:43`), quel que soit le pays réel.
B22. ✅ DONE — **Libellé brut dans les notifications de réclamation.** E-mail/SMS au client avec le code (`en_cours`, `resolue`…) au lieu d’un libellé (`reclamation.controller.js:159-160`).

#### Sécurité

B23. **Contrôle d’accès : OK.** Les 20 routes du périmètre ont `auth` + `isAdmin` (vérifié dans les 6 fichiers de routes). Aucune route admin sans contrôle de rôle.
B24. ✅ DONE (V13 : cellules neutralisées) — **Injection de formules CSV/Excel.** Les exports écrivent tels quels des champs saisis par les clients (nom, prénom, destination, `type_colis`) sans neutraliser `=`, `+`, `-`, `@` en début de valeur (`controllers/admin/export.controller.js:32-46,68`). Un client peut piéger le fichier ouvert dans Excel par un admin.
B25. ✅ DONE (V13 : `auditLog('EXPORT')`) — **Export de données personnelles sans trace.** Les routes d’export n’ont pas de `auditLog` (`routes/admin/export.route.js:8,11`), alors qu’elles sortent noms, e-mails et téléphones de tous les clients.
B26. ✅ DONE — **HTML non échappé dans l’e-mail de réclamation.** `client.prenom` (saisi par le client) et `commentaire_admin` sont injectés dans le HTML (`controllers/client/reclamation.controller.js:167`). Même chose pour `colis.reference` dans `gestioncolis.service.js:41` (risque faible, référence générée).
B27. ✅ DONE (B.6 : filtre global des réponses d’erreur) — **Fuite de messages techniques.** Les 500 renvoient `error.message` (`controllers/admin/gestoncolis.controller.js:15,30,…`) ou `err.message` (`controllers/admin/etiquette.controller.js:75`).
B28. ✅ DONE (B.6 : contenu vérifié par signature binaire) — **Upload de preuve : type vérifié sur l’en-tête seulement.** Multer filtre sur `file.mimetype` déclaré par le client (`middlewares/r2Upload.middleware.js:17-18`) ; l’extension du nom d’origine est conservée sur R2 (`services/r2.service.js:64-66`). Pas de vérification du contenu réel. Risque limité (le `Content-Type` R2 retombe sur `application/octet-stream` pour une extension inconnue).


### B.3 Pays, tarifs, taux de change, paiements, rapports (C)

#### Bloquants

C1. ✅ DONE — **Montants des paiements affichés en FCFA alors qu’ils sont en EUR.** Admin : `src/features/paiements/PaiementsPage.tsx:26-27` (`formatXOF`), `:159` (`montantTotal`), `:232` (`prixTotal`), `:236` (`montantPaye`). Back : `src/services/client/paiement.service.js:18-27,190,221,239` (`montantPaye = colis.prix`, en EUR ; le XOF n’est jamais stocké), `src/services/admin/paiement.service.js:45`. Un paiement de 45,50 € s’affiche « 46 F CFA ». Il faut afficher en € (`formatPrice`) et, si besoin, l’équivalent XOF via le taux.
C2. ✅ DONE — **CA du rapport mensuel faux et mal libellé.** Back : `src/jobs/rapport.job.js:31` et `:40` additionnent `montantPaye` (DECIMAL renvoyé en **chaîne** par Postgres, cf. le commentaire `services/client/paiement.service.js:41-46`) → concaténation de chaînes (`0 + "45.50" + "12.00"` = `"045.5012.00"`), donc « NaN FCFA » dans le PDF et l’e-mail dès qu’il y a au moins un paiement ; de plus le montant (EUR) est étiqueté « FCFA » (`:48`, `:51`, `:145`). La même valeur `caTotal` est renvoyée par `POST /admin/rapports/generer` (`src/routes/admin/rapport.route.js:16-20`).

#### Sécurité

C3. ✅ DONE — **Rapports financiers téléchargeables sans authentification.** Back : `src/app.js:80` sert tout `src/uploads` en statique public ; les rapports sont écrits dans `src/uploads/rapports` (`src/routes/admin/rapport.route.js:11`, `src/jobs/rapport.job.js:123-128`) avec un nom prévisible `rapport-AAAA-MM.pdf`, et la route renvoie même l’URL publique (`rapport.route.js:20,41`). Le contrôle `auth + isAdmin` de `GET /admin/rapports/:filename` est donc contournable via `GET /uploads/rapports/rapport-2026-09.pdf`.
C4. ✅ DONE (B.6 : filtre global des réponses d’erreur) — **Fuite de messages d’erreur internes (mineur).** Toutes les réponses 500 (et plusieurs 400) renvoient `error: error.message` (ex. `src/controllers/admin/country.controller.js:27`, `shippingRate.controller.js:7`, `paiement.controller.js:9`) : noms de tables/contraintes SQL exposés.
C5. Contrôle de rôle : **aucune route sans contrôle** dans ce périmètre (`authMiddleware` + `isAdmin` partout, vérifié dans les 8 fichiers de routes).

#### Mineurs

C6. ✅ DONE — **Liste des rapports : libellé « Rapport — undefined undefined ».** Admin : `src/features/rapports/RapportsPage.tsx:94` lit `label`, `mois`, `annee` (type `src/types/index.ts:136-142`). Back : `src/routes/admin/rapport.route.js:39-43` ne renvoie que `filename`, `url`, `taille`.
C7. ✅ DONE (V27 : avertissement listant les pays concernés) — **Anciennes tables de tarifs invisibles dans l’admin mais encore utilisées en repli.** Admin : `shippingPricesApi` et `servicePricesApi` (`src/api/countries.ts:14-21` et `:38-45`) ne sont appelées nulle part ; le dossier `src/features/pricing` est vide. Back : `src/services/pricingCalculator.service.js:30-51` et `src/controllers/client/envoieColis.controller.js:241-261` lisent encore `shipping_prices` / `service_prices` pour tout pays sans ligne `shipping_rates` / `service_rates`. ⚠️ À vérifier en base : un pays avec seulement des lignes anciennes (issues de `src/seed/seedPrices.js`) aura des prix que l’admin ne voit pas et ne peut pas modifier. Les 11 routes `/admin/shipping-prices*` et `/admin/service-prices*` (dont `POST /shipping-prices/bulk`) ne sont jamais appelées.
C8. ✅ DONE — **Le libellé du taux de change minimise son effet.** Admin : `src/features/countries/CountriesPage.tsx:467` (« utilisé pour l’affichage FCFA dans le mobile ») et commentaire `src/api/countries.ts:70`. Back : le taux fixe aussi le **montant débité** chez Wave / Orange Money (`src/services/client/paiement.service.js:23-26,81-88`) et le montant XOF des factures (`src/services/pdf/facture.service.js:12-13`).
C9. ✅ DONE (`countryId` ignoré en modification) — **`PUT /admin/shipping-rates/:id` accepte un `countryId` sans contrôle.** Back : `src/services/shippingRate.service.js:47-60` (ni existence du pays, ni unicité ; deux tarifs pour un même pays deviennent possibles). Admin : `src/features/countries/CountriesPage.tsx:136-145` envoie `countryId`, mais la liste est désactivée en édition (`:570`), donc pas de risque depuis l’écran actuel.
C10. ✅ DONE (comportement conservé : le pays d’un tarif ne change pas) — **`PUT /admin/service-rates/:id` ignore `countryId`.** Back : `src/services/serviceRate.service.js:41-48`. Admin : `src/features/countries/CountriesPage.tsx:197-198` l’envoie quand même (sans effet ; liste désactivée en édition).
C11. ✅ DONE (V5 : poids ≥ 0, prix > 0 contrôlés par le back) — **Aucune validation de signe** sur les poids et les prix (négatifs ou nuls acceptés) : `src/services/shippingRate.service.js:22-36`, `serviceRate.service.js:21-25`, `shippingPrice.service.js:77-99`. L’admin n’ajoute pas de `min` sur ses champs (`CountriesPage.tsx` ~`:580-640`, ⚠️ à vérifier sur les attributs des `<input>`).
C12. ✅ DONE (route admin : nombres) — **Types numériques de l’admin vs chaînes renvoyées.** Admin : `src/api/paiements.ts:9-10` type `prixTotal`, `montantPaye` en `number`. Back : `src/services/admin/paiement.service.js:6-22` renvoie les DECIMAL tels quels (chaînes), contrairement à la route client qui les convertit. Pas de casse visible aujourd’hui (`Intl` convertit), mais tout calcul côté admin serait faux. ⚠️ À vérifier : idem pour `montantTotal` (`paiement.service.js:45`).
C13. ✅ DONE — **Passer un paiement à `paye` à la main ne renseigne pas `montantPaye`.** Back : `src/services/admin/paiement.service.js:25-33`. Conséquence : « Montant encaissé » (`PaiementsPage.tsx:159`) et le CA du rapport ignorent ce paiement. Aucune règle de transition entre statuts, et `rembourse` ne déclenche aucun remboursement réel.
C14. ✅ DONE (B.6 : codes 404 / 500 cohérents) — **Codes HTTP incohérents.** « … non trouvé » renvoie **400** sur les PUT (`country.controller.js:79-81`, `shippingRate.controller.js:29`, `serviceRate.controller.js:35`, `tauxChange.controller.js:25`, `paiement.controller.js:16`) et une erreur base renvoie **404** sur les GET/DELETE des anciennes tables et des pays (`country.controller.js:38-40,99-101`). L’admin n’affiche que `message`, donc sans gravité.
C15. ✅ DONE (V26 : code comparé en majuscules) — **Doublon de code pays mal détecté.** Back : `src/services/country.service.js:68` et `:114` comparent le code avant passage en majuscules (`:80`, `:127`) → `"fra"` contre `"FRA"` donne un 400 générique « Erreur lors de la création du pays » au lieu de « Un pays avec ce code existe déjà ». L’admin envoie déjà en majuscules (`CountriesPage.tsx` champ code), donc peu d’impact.
C16. ✅ DONE (V26 : 409 avec message explicite) — ⚠️ À vérifier : **suppression d’un pays qui a des tarifs.** Back : `src/services/country.service.js:146-171` ; FK `countryId` non nulle dans `shipping_rates`, `service_rates`, `shipping_prices`, `service_prices` (tables créées par `sync`, contrainte probablement `NO ACTION`). La suppression échouerait avec un **404** « Erreur lors de la suppression du pays ». Admin : `CountriesPage.tsx:109-117` annonce « sera définitivement supprimé » sans prévenir.
C17. ✅ DONE (délai 120 s, et un délai dépassé ne déconnecte plus) — ⚠️ À vérifier : **génération de rapport et délai de 15 s.** Admin : `src/api/axios.ts:29` (timeout 15 s) et `:66-73` (un timeout **déconnecte** l’admin). Back : `POST /admin/rapports/generer` génère le PDF de façon synchrone avec un navigateur sans tête (`src/jobs/rapport.job.js:117-120`). Un premier lancement lent peut déconnecter l’admin.
C18. **Routes back jamais utilisées par l’admin :** `GET /admin/countries/:id` (fonction `countriesApi.getById` définie mais inutilisée, `src/api/countries.ts:6`), `GET /admin/shipping-rates/:id`, `GET /admin/service-rates/:id`, `GET /admin/taux-change/:id`, et toutes les routes des anciennes tables (C7).
C19. ✅ DONE (B.6 : pagination) — **Chargements sans pagination.** `GET /admin/paiements` et `GET /admin/liste-colis` renvoient tout ; le tableau de bord charge **tous** les colis pour n’en afficher que 8 (`src/features/dashboard/DashboardPage.tsx:69-75`). `GET /admin/paiements` renvoie aussi `webhookPayload` (JSON brut opérateur) que l’admin n’utilise pas.

### B.4 Déploiement des correctifs du 2026-10-11

1. **Back** : la migration `20261011140000-masquer-secrets-audit-logs.js` (mots de passe déjà enregistrés dans le journal d’audit) est exécutée automatiquement par le CI/CD (`deploy/release.sh`) au prochain push sur `main`. Elle est irréversible : les valeurs masquées ne reviennent pas.
2. **Back** : les rapports sont désormais écrits dans `/app/uploads/rapports` (volume `uploads_data`). Les rapports présents dans l’ancien dossier public sont déplacés au premier accès à la liste ou à la première génération.
3. **Admin** : redéployer le front. Les admins déjà connectés n’ont pas de refresh token enregistré : ils sont renvoyés une dernière fois à la connexion à l’expiration de leur jeton, puis la session se renouvelle normalement.
4. **Sécurité** : le mot de passe d’un admin créé avant ce correctif a été visible dans le journal d’audit par tous les admins. Il faut demander à ces admins de **changer leur mot de passe**.

### B.5 Deuxième vérification complète (2026-10-11) — chaque appel de l’admin

Les **78 fonctions** de `admin-nanei/src/api/*.ts` (aucun écran n’appelle l’API directement) ont été comparées une à une au code du back : chemin, méthode, champs envoyés, clés lues dans la réponse, gestion des erreurs. 27 problèmes trouvés, tous corrigés.

#### Bloquants et sécurité

| # | Statut | Problème | Correction |
|---|---|---|---|
| V1 | ✅ DONE | Export des paiements : **toujours 500** (`Paiement` absent de `models/index.js`) | import direct du modèle (`export.controller.js`) |
| V2 | ✅ DONE | Génération des rapports : **toujours en échec**, même cause | import direct (`jobs/rapport.job.js`) ; testé |
| V3 | ✅ DONE | Suppression de compte (`DELETE /nanei/account`, mobile) : **toujours 500** (modèles et colonnes inexistants) | réécrite en anonymisation (`services/rgpd.service.js`) ; dernier admin actif protégé ; testé |
| V4 | ✅ DONE | Écrans Paiements et Pays : même clé de cache pour le taux de change → plantage de l’onglet Taux, « ≈ NaN FCFA » | clé distincte `['taux-change', 'eur-fcfa']` |
| V5 | ✅ DONE | Saisie « 4,75 » enregistrée 4 (tarifs) et « 655,957 » enregistré 655 (taux) | virgule acceptée et valeurs contrôlées (admin) ; nombres contrôlés par le back |
| V6 | ✅ DONE | Plusieurs onglets : le renouvellement d’un onglet déconnectait les autres | session relue entre onglets, verrou Web Locks, vérification avant renouvellement |
| V7 | ✅ DONE | Un client désactivé pouvait être repris par une nouvelle inscription (nouveau mot de passe) | colonne `compte_auto` : seuls les comptes destinataires automatiques sont revendiqués (migration `20261011150000`) ; testé |
| V8 | ✅ DONE | Changement / réinitialisation de mot de passe : les autres sessions restaient actives | `passwordChangedAt` + révocation des refresh tokens partout ; `/auth/refresh` vérifie compte actif et date ; nouveaux jetons renvoyés par `change-password` ; testé |
| V9 | ✅ DONE | Création du 2ᵉ admin sans téléphone impossible (`""` dans une colonne unique) | téléphone vide → NULL (et reprise des `""` existants par la migration) ; règle de mot de passe complète |
| V10 | ✅ DONE | Nginx : `/uploads/` aurait servi les rapports si le back tournait hors Docker ; délai Nginx 60 s < 120 s | `location ^~ /uploads/rapports/ { return 404; }`, `proxy_read_timeout 130s` (`deploy/nginx.conf`) |

#### Mineurs

| # | Statut | Problème | Correction |
|---|---|---|---|
| V11 | ✅ DONE | Exports : colonne `created_at` vide | lecture de `createdAt` |
| V12 | ✅ DONE | Exports : jour de fin exclu ; statut invalide → 500 | date de fin incluse ; 400 |
| V13 | ✅ DONE | Exports : formules Excel exécutables ; pas de trace | cellules neutralisées ; `auditLog('EXPORT')` |
| V14 | ✅ DONE | Téléchargements (étiquettes, exports, rapports) : message d’erreur fixe | lecture du message du back dans la réponse blob (`messageErreurTelechargement`) |
| V15 | ✅ DONE | Changement de statut colis : réponse bloquée par les envois de notifications | historique d’abord, notifications en arrière-plan ; pas de doublon si statut inchangé |
| V16 | ✅ DONE | Tableau de bord : alerte « colis bloqués » non rafraîchie | invalidation de `['colis-bloques']` |
| V17 | ✅ DONE | 11 écrans : une erreur de chargement s’affichait comme une liste vide | composant `ErreurChargement` avec « Réessayer » |
| V18 | ✅ DONE | Preuve remplacée : date de la première photo affichée | la ligne est recréée (pas de colonne `updated_at`) |
| V19 | ✅ DONE | Comptes destinataires automatiques listés et comptés comme clients ; les activer bloquait l’inscription | exclus des listes et compteurs ; activation refusée avec explication |
| V20 | ✅ DONE | Limite de 5 / 15 min partagée entre login, refresh et mots de passe | trois compteurs séparés (refresh : 30 / 15 min) |
| V21 | ✅ DONE | Erreur passagère au renouvellement (429, 5xx, réseau) → déconnexion au rechargement | l’erreur du renouvellement est remontée, la session conservée |
| V22 | ✅ DONE | « Mot de passe oublié » affichait « envoyé » même en cas d’échec | messages d’erreur distincts |
| V23 | ✅ DONE | Profil : détail de validation non affiché ; téléphone vidé ignoré avec un 200 | détail affiché ; téléphone retiré (admin) ou refus explicite (client) |
| V24 | ✅ DONE | Lien de réinitialisation inaccessible avec une session ouverte | route sortie de `RequireGuest` |
| V25 | ✅ DONE | Fonctions de recherche admin/client au mauvais contrat ; types de réponse faux (`admins.ts`, `clients.ts`, `colis.ts`) | contrats et types alignés sur le back |
| V26 | ✅ DONE | Pays : messages génériques (doublon de nom, suppression avec tarifs → 404) | messages précis ; 409 si le pays est encore utilisé |
| V27 | ✅ DONE | Anciennes grilles de tarifs utilisées en repli mais invisibles | avertissement listant les pays concernés (onglets Transport et Services) |

#### Ce qui reste volontairement en l’état

- Le mois d’un paiement dans le rapport mensuel est celui de sa **création** (règle métier à confirmer).
- Routes du back que l’admin n’appelle pas : `GET` par identifiant (pays, tarifs, taux), toutes les routes des anciennes grilles (`/shipping-prices*`, `/service-prices*`, lecture seule utilisée pour l’avertissement V27), `rechercher-admin`, `rechercher-utilisateur`, `colis-recherche`, `messages/stats` (contrats corrigés, prêts à l’emploi). `/admin/hello` a été retirée (B.6).

#### Déploiement de cette deuxième série

1. **Back** : deux nouvelles migrations, exécutées par le CI/CD — `20261011140000-masquer-secrets-audit-logs.js` et `20261011150000-add-compte-auto-to-utilisateur.js`. Sans la seconde, le back ne démarre pas correctement (colonne `compte_auto` lue par le modèle).
2. **Nginx** : `deploy/nginx.conf` n’est pas appliqué automatiquement. Reporter sur le serveur le bloc `location ^~ /uploads/rapports/` et `proxy_read_timeout 130s`, puis `nginx -t && systemctl reload nginx`.
3. **Mobile** : `change-password` coupe désormais les autres sessions. La version suivante de l’app enregistre les nouveaux jetons ; avec les versions déjà installées, l’utilisateur doit se reconnecter après avoir changé son mot de passe.

### B.6 Derniers points corrigés et pagination (2026-10-12)

| # | Statut | Point | Correction | Vérification |
|---|---|---|---|---|
| P1 | ✅ DONE | `GET /client/rechercher-client` exposait e-mail et téléphone de tout compte actif (recherche partielle par nom) | e-mail complet ou téléphone exact seulement, un seul résultat, e-mail et téléphone **masqués**, comptes automatiques et soi-même exclus (`envoieColis.service.js`) | testé |
| P2 | ✅ DONE | Routes admin en double sous `/nanei/messages` (sans limite de débit ni audit) | retirées ; seul `POST /nanei/messages` (formulaire public) reste | testé (404) |
| P3 | ✅ DONE | « Compte inactif » révélait l’existence d’un compte sans mot de passe | mot de passe vérifié d’abord (bcrypt fictif si compte inconnu : même durée) ; « Compte désactivé. Contactez le support. » seulement avec le bon mot de passe | testé |
| P4 | ✅ DONE | Détails techniques (SQL, pile) dans les réponses d’erreur | filtre global `middlewares/reponsesErreur.middleware.js` sur toutes les réponses ≥ 400 ; détail journalisé | testé |
| P5 | ✅ DONE | Type des fichiers envoyés contrôlé sur la déclaration du navigateur | contenu vérifié par signature binaire (PNG, JPEG, WEBP, PDF) ; extension enregistrée = type réel ; refus → 400 (preuves, photos de profil, réclamations) | testé |
| P6 | ✅ DONE | Aucune règle de transition de statut colis | `en_attente` → `recupere`, `livre` ; `recupere` → `livre`, `en_attente` ; `livre` définitif ; refus → **409** | testé |
| P7 | ✅ DONE | Aucune liste paginée | pagination facultative sur toutes les listes (voir « Pagination des listes », §0) ; boutons Précédent / Suivant dans l’admin et le mobile | testé (back) |
| P8 | ✅ DONE | Pays de l’expéditeur toujours « MALI » sur l’étiquette | déduit de l’indicatif du téléphone de l’expéditeur (`utils/paysDepuisTelephone.js`) ; inconnu → `PAYS_ORIGINE_DEFAUT` (MALI) | testé |
| P9 | ✅ DONE (à confirmer avec un vrai webhook) | Signature des webhooks calculée sur un corps reconstruit | corps **brut** conservé (`req.rawBody`) ; format Wave `t=…,v1=…` (±5 min) et ancien format hexadécimal ; comparaison en temps constant | testé (signatures simulées) |
| P10 | ✅ DONE | `FRONTEND_URL` absent → lien vers localhost | repli sur la première origine HTTPS de `CORS_ORIGIN` ; sinon pas d’envoi (réponse neutre) ; alerte au démarrage ; documenté dans `.env.example` | relu |
| P11 | ✅ DONE | Inscription sans `adresse` → 500 | adresse vide par défaut | relu |
| P12 | ✅ DONE | Codes HTTP incohérents ; `/admin/hello` publique | « non trouvé » → 404, erreur base → 500 (`utils/statutHttp.js`) ; listes d’admins en erreur → 500 au lieu de 200 ; `/admin/hello` retirée | testé (hello) |

**Paramètres de liste ajoutés :**

| Route admin | Clé | Recherche / filtres |
|---|---|---|
| `liste-colis`, `colis-en-attente`, `colis-recuperes`, `colis-livres` | `colis` | `q` (référence, destination). Chaque colis d’un lot porte `taille_lot` (nombre total de colis du lot, toutes pages) |
| `liste-admins` | `data` | `q` (nom, prénom, e-mail, téléphone) |
| `liste-utilisateurs` | `data` (+ `total` toutes pages) | `q` |
| `messages` | `data` | `q` (e-mail, objet, message) |
| `paiements` | `data` | `statut`, `q` (référence, destination, payeur, référence opérateur) |
| `avis` | `avis` | `note` ; `stats` calculées en base sur tous les avis |
| `reclamations` | `reclamations` | `statut` (valeur inconnue → 400) |
| `audit-logs` | `logs` | déjà paginé ; renvoie aussi `pagination` |
| `rapports`, `countries`, `shipping-rates`, `service-rates`, `shipping-prices`, `service-prices`, `taux-change` | `rapports` / `data` | — |

**Dans l’interface admin** (`admin-nanei`) : composant commun `components/ui/Pagination.tsx` (« Précédent » / « Suivant », « Page X sur Y · N résultats », 20 lignes par page), utilitaires `api/pagination.ts` et `hooks/usePagination.ts`. Sur chaque écran : la page fait partie de la clé de cache, un changement de recherche ou de filtre ramène à la page 1, la recherche part au serveur après 400 ms de frappe, et une page devenue vide (après suppression ou changement de statut) renvoie à la précédente.

| Écran | Route | Paramètres envoyés |
|---|---|---|
| Colis (tous, en attente, récupérés, livrés) | `liste-colis`, `colis-en-attente`, `colis-recuperes`, `colis-livres` | `page`, `limit`, `q` |
| Étiquettes | `liste-colis` | `page`, `limit`, `q` |
| Clients | `liste-utilisateurs` | `page`, `limit`, `q` |
| Admins | `liste-admins` | `page`, `limit`, `q` |
| Messages | `messages` | `page`, `limit`, `q` |
| Paiements | `paiements` | `page`, `limit`, `q`, `statut` |
| Avis | `avis` | `page`, `limit`, `note` |
| Réclamations | `reclamations` | `page`, `limit`, `statut` |
| Journal d’audit | `audit-logs` | `page`, `limit`, `admin_id`, `action`, `date_debut`, `date_fin` |
| Rapports | `rapports` | `page`, `limit` |
| Pays, tarifs de transport, tarifs de services, taux de change | `countries`, `shipping-rates`, `service-rates`, `taux-change` | `page`, `limit` |

Appels laissés **sans** pagination, volontairement : listes déroulantes (admins du filtre d’audit, pays des modales de tarifs), calcul « colis bloqués » et compteurs du tableau de bord, liste complète des tarifs pour l’avertissement « ancienne grille », lecture du taux EUR → FCFA. Les « colis récents » du tableau de bord demandent `page=1&limit=8`.

Le sélecteur de statut des colis ne propose que les transitions permises ; un colis livré n’a plus de menu ; un refus 409 affiche le message du back.

### B.7 Suites de tests et derniers correctifs (2026-10-12)

| Projet | Outil | Emplacement | Tests | Exécution automatique |
|---|---|---|---|---|
| Back | Jest + Supertest | `src/__tests__/` (+ `integration/`, sauté sans base jetable `NANEI_TEST_DB_NAME`) | 678 | job `test` du CI, avant le déploiement (`needs: test`) |
| Admin | Vitest + Testing Library | fichiers `*.test.ts(x)` à côté du code, utilitaires dans `src/test/` | 166 | étape `npm test` du CI, avant le build |
| Mobile | flutter_test, bloc_test, mocktail | `test/`, même arborescence que `lib/`, utilitaires dans `test/helpers/` | 272 | job `tests` des workflows de publication Android / iOS |

Tests transverses du back : toute route exige une authentification sauf une liste nommée et justifiée de routes publiques (`routes.authRequise`) ; chaque appel du mobile et de l’admin vise une route montée avec le bon verbe (`parite.apiMobile`, `parite.apiAdmin`) ; les routes admin refusent sans jeton, avec un jeton client, un rôle falsifié ou un compte inactif (`api.directe.securite`).

Correctifs complémentaires :
- `GET /admin/audit-logs` : filtre `action` en correspondance partielle et sans casse (`update` trouve `UPDATE_STATUT`).
- `POST /admin/ajouter-admin` : nom et prénom de 2 à 50 caractères, format du téléphone contrôlé (mêmes règles qu’à l’inscription).
- Les bugs trouvés par les suites de tests sont corrigés et couverts par un test (détail dans les rapports de chaque projet).
