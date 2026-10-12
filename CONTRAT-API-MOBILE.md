# Contrat d’API — Application mobile Nanei / Franco Mali Ship (envoi et suivi de colis)

> **Mis à jour le 2026-10-12 : relecture complète** des 43 routes montées hors `/nanei/admin` (hors webhooks) et des 42 routes appelées par l’application (`C:\nanei\lib`). Aucune route manquante ; corrections : pagination et filtres (§5, §6, §7, §10, §11, §12), champs de réponse (`webhookPayload` retiré, `updatedAt` absent des avis et preuves), téléphone vidé au profil, erreurs 500 sans `erreur` / `error`, inscription sans adresse, contacts (`pays_id`). Nouveaux écarts : Annexe C.6.

> Rédigé le 2026-10-11 **à partir du code du back**, mis à jour après les deux séries de correctifs du même jour (voir Annexe C) (`nanei/src` : `app.js`, routes, middlewares, schémas Joi, contrôleurs, services, modèles Sequelize). Il ne s’agit **pas** d’exemples capturés sur une API réelle : les formes de réponse sont déduites du code. Les points marqués **⚠️ À vérifier** n’ont pas pu être confirmés par lecture seule.
>
> **Périmètre :** les routes appelées par l’application mobile Flutter (`C:\nanei`) : authentification, compte, colis (envoi, lots, listes, recherche), pays et tarifs, notifications, paiements et factures, étiquettes, suivi public, réclamations, contacts favoris, preuve de livraison, avis, message au support. Le back-office (`/nanei/admin/*`) et les webhooks des fournisseurs de paiement (`/nanei/paiements/webhook/*`) sont hors périmètre : ils ne sont jamais appelés par l’application.

## Mode d’emploi pour l’IA ou le développeur qui vérifie

1. Lire d’abord la section **0. Conventions** : elle s’applique à toutes les routes. **Attention :** contrairement à beaucoup d’API, il n’y a **pas d’enveloppe de réponse uniforme**. Chaque route a sa propre forme, décrite route par route.
2. Pour chaque route, comparer avec le code mobile : chemin exact, méthode, corps (noms de champs **exacts**, casse comprise), clés lues dans la réponse.
3. Les noms de champs **mélangent camelCase et snake_case** selon les routes (`recepteurId`, `type_colis`, `colis_id`, `moyenPaiement`…). Ne pas « corriger » un nom : utiliser celui indiqué.
4. Les statuts sont des **codes sans accent** : `en_attente`, `recupere`, `livre`. L’application ne doit jamais comparer avec `livré`.
5. La section **Annexe C — Écarts constatés** liste les correctifs déjà appliqués (C.1, C.2, C.4 bis à C.4 quinquies), les incohérences du back (C.3), les risques de sécurité (C.4), les étapes de déploiement (C.5) et les écarts mobile ↔ back relevés à la relecture du 2026-10-12 (C.6).

## Sommaire

- [0. Conventions communes](#0-conventions-communes)
- [0 bis. Parcours de l’application](#0-bis-parcours-de-lapplication)
- [1. Authentification](#1-authentification) — 6 routes
- [2. Compte connecté](#2-compte-connecté) — 5 routes
- [3. Pays, tarifs et taux de change](#3-pays-tarifs-et-taux-de-change) — 4 routes
- [4. Colis — envoi](#4-colis--envoi) — 3 routes
- [5. Colis — consultation](#5-colis--consultation) — 4 routes
- [6. Notifications](#6-notifications) — 3 routes
- [7. Paiements et factures](#7-paiements-et-factures) — 5 routes
- [8. Étiquette et suivi public](#8-étiquette-et-suivi-public) — 2 routes
- [9. Preuve de livraison](#9-preuve-de-livraison) — 1 route
- [10. Avis](#10-avis) — 2 routes
- [11. Réclamations](#11-réclamations) — 3 routes
- [12. Contacts favoris](#12-contacts-favoris) — 4 routes
- [13. Message au support](#13-message-au-support) — 1 route
- [14. Divers (santé, fichiers)](#14-divers-santé-fichiers) — 2 routes
- [Annexe A — Entités (champs renvoyés)](#annexe-a--entités-champs-renvoyés)
- [Annexe B — Énumérations métier](#annexe-b--énumérations-métier)
- [Annexe C — Écarts constatés et points de vigilance](#annexe-c--écarts-constatés-et-points-de-vigilance)

---

## 0. Conventions communes

### URL de base

- Toutes les routes sont préfixées par **`/nanei`** : `https://<domaine-api>/nanei/...`.
- Côté mobile, `Env.baseUrl` (`API_BASE_URL`) **contient déjà** `/nanei` ; les chemins de l’application commencent donc par `/auth`, `/client`, etc.
- Compatibilité : un préfixe doublé `/nanei/nanei/...` est réécrit en `/nanei/...` par le back (rustine temporaire, ne pas s’en servir).
- Santé : `GET /health` (hors préfixe `/nanei`, publique) → `200 { "status": "OK", "db": "ok", "version": "<sha du commit | dev>", "api": <entier> }`, ou `503 { "status": "KO", "db": "erreur" }` si la base est injoignable. `api` = version du contrat d’API (`src/config/version.js`, `API_VERSION`) : incrémentée quand une modification du back casse le contrat de l’admin ou du mobile.

### Forme des réponses

Il n’y a **pas d’enveloppe commune**. On rencontre, selon la route :

| Forme | Routes concernées |
|---|---|
| `{ token, refreshToken, utilisateur }` | `POST /auth/login` |
| `{ message, utilisateur }` | inscription, profil |
| `{ data: … }` (sans `success`) | listes et recherche de colis (+ `par_statut`), notifications (+ `non_lues`), recherche de client — `pagination` en plus si demandée |
| `{ success, data }` | pays, tarifs, statistiques, paiements, calcul de prix, taux de change |
| `{ success, message, <entité> }` | réclamations (`reclamation(s)`), contacts (`contact(s)`), avis (`avis`), preuve (`preuve`) |
| `{ message }` | la plupart des erreurs et des actions simples |
| PDF / HTML / texte | facture, étiquette, suivi public, retour de paiement |

**Règle pour le mobile :** lire `message` quand il est présent (texte en français, destiné à l’utilisateur) ; ne jamais supposer qu’un champ `success` existe.

### Erreurs

| Code | Quand | Corps |
|---|---|---|
| 400 | Validation Joi échouée | `{ "message": "Données invalides", "details": ["\"email\" must be a valid email", …] }` |
| 400 | Erreur métier (la plupart des routes) | `{ "message": "…" }` ou `{ "success": false, "message": "…" }` |
| 401 | Jeton absent ou mal formé | `{ "message": "Token manquant ou invalide" }` |
| 401 | Jeton expiré ou signature invalide | `{ "message": "Token invalide" }` |
| 401 | Jeton émis avant un changement de mot de passe | `{ "message": "Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter." }` |
| 403 | Compte désactivé (`statut ≠ actif`) | `{ "message": "Compte désactivé. Contactez le support." }` |
| 403 | Ressource d’un autre utilisateur | `{ "success": false, "message": "Accès non autorisé" }` ou message spécifique |
| 404 | Utilisateur du jeton supprimé | `{ "message": "Utilisateur introuvable" }` |
| 404 | Ressource introuvable | `{ "success": false, "message": "… introuvable" }` |
| 409 | Doublon (avis déjà donné) | `{ "success": false, "message": "…" }` |
| 429 | Limite de débit dépassée | `{ "message": "Trop de …" }` (en-têtes standard `RateLimit-*`) |
| 500 | Erreur interne | `{ "message": "Erreur serveur…" }` ou `{ "success": false, "message": "Erreur serveur" }` — les champs `error` / `erreur` et tout détail technique (SQL, pile) sont **retirés** de toute réponse ≥ 500 (`middlewares/reponsesErreur.middleware.js`) |
| 400 | Fichier refusé à l’upload | type déclaré refusé : `{ "success": false, "message": "Type de fichier non autorisé", "error": "Type de fichier non autorisé" }` · trop de fichiers ou champ inattendu : `{ "success": false, "message": "Trop de fichiers ou champ de fichier inattendu", "error": "…" }` |
| 413 | Fichier trop volumineux | `{ "success": false, "message": "Fichier trop volumineux", "error": "Fichier trop volumineux" }` |
| 500 | Erreur non interceptée | `{ "success": false, "message": "Erreur interne du serveur" }` (le champ `error` est retiré par le filtre des réponses ≥ 500) |

> Filtre global (`middlewares/reponsesErreur.middleware.js`) : sur une réponse **4xx**, un `message` qui ressemble à une erreur technique (SQL, Sequelize, pile, `undefined`…) est remplacé par « Requête invalide » ; sur une **5xx**, par « Erreur serveur ». Les champs `error` / `erreur` sont toujours retirés des 5xx.

> Il n’existe **pas** de champ `error.code` stable : brancher la logique de l’application sur le **code HTTP**, pas sur le texte.

### Authentification

1. `POST /auth/login` avec `{ identifiant, mot_de_passe }` (`identifiant` = e-mail **ou** téléphone, avec ou sans indicatif : voir `POST /auth/login`). Réponse : `token` (accès) et `refreshToken`.
2. Chaque appel protégé envoie `Authorization: Bearer <token>`.
3. Durée du jeton d’accès : **1 heure** (`JWT_EXPIRES_IN=1h`). Durée du refresh token : **7 jours**.
4. À expiration (401) : `POST /auth/refresh` avec `{ refreshToken }`. La réponse renvoie un **nouveau** `token` **et** un **nouveau** `refreshToken` (rotation) : l’ancien refresh token est révoqué, il faut toujours conserver le nouveau. Mutualiser le rafraîchissement (une seule requête en vol) : c’est ce que fait le mobile (`TokenService.tryRefresh`). Il renouvelle aussi le jeton **avant** un appel s’il est déjà expiré, et n’efface la session que si le serveur refuse le refresh token (400 / 401).
5. `POST /auth/logout` avec `{ refreshToken }` révoque ce refresh token. Le jeton d’accès reste valide jusqu’à son expiration.
6. Le middleware `auth` recharge l’utilisateur en base à chaque requête : compte supprimé → 404, compte `inactif` → 403.

### Pagination des listes

Toutes les routes de liste acceptent `?page=N&limit=M` (page ≥ 1 ; `limit` 20 par défaut, 100 maximum ; `utils/pagination.js`).

- **Avec `page` ou `limit`** : la liste est paginée et la réponse contient en plus `"pagination": { "page": 2, "limit": 20, "total": 137, "pages": 7 }` (`pages` ≥ 1).
- **Sans ces paramètres** : liste complète, réponse identique à avant. Les versions de l’app mobile déjà installées continuent de fonctionner.

La clé de la liste ne change pas (`colis`, `data`, `avis`, `reclamations`, `logs`, `rapports`, `contacts`…). Les recherches (`q`) et filtres (`statut`, `note`) sont appliqués **côté serveur, avant la pagination**.

### Limitation de débit

| Limite | Portée | Routes |
|---|---|---|
| 300 requêtes / 15 min | par utilisateur (ID du jeton), sinon par IP | **toutes** les routes |
| 5 requêtes / 15 min | par IP | `POST /auth/login` (compteur propre) |
| 30 requêtes / 15 min | par IP | `POST /auth/refresh` (compteur propre) |
| 5 requêtes / 15 min | par IP | `POST /auth/oublier-password`, `POST /auth/reset-password` (compteur commun aux mots de passe oubliés, mobile et admin) |
| 3 requêtes / 15 min | par e-mail ciblé | `POST /auth/oublier-password`, `POST /auth/reset-password` |
| 20 requêtes / 15 min | par IP | `PUT /account/modifier-profil`, `PUT /account/change-password`, `DELETE /account` |
| 30 requêtes / 15 min | par IP | `GET /suivi/:reference` |

> Chaque limiteur a **son propre compteur** : renouveler la session ne consomme pas les essais de connexion (`middlewares/rateLimit.middleware.js`).

### Types et formats

| Type | Format JSON |
|---|---|
| Identifiants | UUID v4 (`string`) |
| Poids | nombre (kg, `FLOAT`) |
| Prix d’un colis (`prix`) | nombre (`FLOAT`), **en euros** ; converti en XOF au moment du paiement |
| Montants de paiement (`prixTotal`, `montantPaye`) | `DECIMAL(10,2)` converti en **nombre** par `GET /paiements` |
| Dates-heures | ISO 8601 UTC (`"2026-10-11T10:07:31.000Z"`) |
| Horodatages Sequelize | clés **camelCase** `createdAt`, `updatedAt` (et `deletedAt` sur les modèles « paranoid ») ; exceptions signalées route par route (`created_at`) |
| Statut colis | `en_attente` · `recupere` · `livre` (**sans accent**) |

### Envoi de fichiers (multipart)

| Route | Champ | Types acceptés | Taille max |
|---|---|---|---|
| `PUT /account/modifier-profil` | `photoProfil` (1 fichier) | PDF, PNG, JPEG, WEBP | 5 Mo |
| `POST /reclamations` | `photos` (jusqu’à 5 fichiers) | PNG, JPEG, WEBP | 10 Mo par fichier |

Les fichiers sont envoyés vers Cloudflare R2 ; l’URL publique est stockée. Un type refusé → **400**, un fichier trop gros → **413**, avec `{ success: false, message }`.

> Le type est lu dans l’en-tête `Content-Type` **de chaque fichier**. Côté Flutter, il faut le préciser (`MultipartFile.fromFile(path, contentType: DioMediaType('image', 'jpeg'))`, voir `core/utils/media_type.dart`) : sinon Dio envoie `application/octet-stream` et le fichier est refusé.

### Réponses non JSON

- **PDF** (facture, étiquette) : à télécharger avec l’en-tête `Authorization` (un simple lien ne l’envoie pas), puis à ouvrir avec le visualiseur du téléphone.
- **HTML** : suivi public (par défaut) et page de retour de paiement.
- **Texte ZPL** : étiquette au format imprimante thermique (`?format=zpl`).

---

## 0 bis. Parcours de l’application

### Démarrage et connexion
1. Jeton d’accès **ou** refresh token stocké → `GET /account/me` (valide la session et recharge le profil ; un jeton d’accès expiré est renouvelé automatiquement). 401 / 403 / 404 → écran de connexion.
2. Aucun jeton → `POST /auth/login` → stocker `token` et `refreshToken` dans le stockage sécurisé.
3. Après connexion → `POST /account/fcm-token` (notifications push).
4. Taux d’affichage → `GET /pricing/taux-change` (EUR → FCFA).

### Envoyer un colis
1. `GET /client/countries` → choix du pays de destination.
2. `GET /client/pricing/:countryId` → grille de tarifs (aérien et maritime, récupération, livraison). Le mobile affiche une estimation et refuse un poids hors des plages de la grille ; le prix **facturé** est calculé par le back à l’envoi. Variante : `POST /pricing/calculate`.
3. Destinataire : `GET /client/rechercher-client?q=…` (compte existant → `recepteurId`) **ou** saisie manuelle (`destinataireManuel`) **ou** `GET /contacts` (contacts favoris).
4. `POST /client/envoie-colis` (un colis) ou `POST /client/envoie-colis-lot` (2 à 20 colis groupés).
5. `GET /etiquettes/:colisId` → étiquette PDF.
6. Paiement : `POST /paiements/:colisId/initier` → ouvrir `checkoutUrl` dans le navigateur → retour par lien profond `nanei://paiement/{succes|verification|echec}?colisId=…` (géré par `LiensEntrantsService`). ⚠️ Le paiement en ligne est encore **désactivé** dans l’app (feuille « service indisponible »).

### Suivre ses colis
- `GET /client/colis-envoyes`, `GET /client/colis-recus`, `GET /client/statistiques-colis`.
- Scan du QR code de l’étiquette → `GET /client/colis-recherche/:reference`.
- Colis `livre` → `GET /colis/:colisId/preuve`, puis, pour l’expéditeur seulement, `GET /avis` (le colis est-il déjà noté ?) et `POST /avis`.
- Problème → `POST /reclamations` (expéditeur **ou** destinataire).

---

## 1. Authentification

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/auth/register` | public |
| POST | `/nanei/auth/login` | public · 5 / 15 min / IP |
| POST | `/nanei/auth/refresh` | public · 30 / 15 min / IP |
| POST | `/nanei/auth/logout` | public |
| POST | `/nanei/auth/oublier-password` | public · 5 / 15 min / IP + 3 / 15 min / e-mail |
| POST | `/nanei/auth/reset-password` | public · 5 / 15 min / IP + 3 / 15 min / e-mail |

#### `POST /nanei/auth/register`

Crée un compte `Particulier`. Si un compte **destinataire léger** (statut `inactif`, créé automatiquement lors d’un envoi de colis) existe avec le même e-mail **ou** le même téléphone, il est **complété et activé** au lieu d’en créer un nouveau : la personne retrouve les colis déjà reçus.

- **Format :** `application/json`

**Corps de la requête** (validation Joi, champs inconnus retirés)

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `nom` | string | **oui** | 2 à 50 car., espaces retirés |
| `prenom` | string | **oui** | 2 à 50 car., espaces retirés |
| `email` | string (email) | **oui** | mis en minuscules |
| `mot_de_passe` | string | **oui** | 8 à 128 car., au moins 1 minuscule, 1 majuscule, 1 chiffre |
| `telephone` | string | **oui en pratique** | Joi le dit facultatif, mais le service répond 400 « Le numéro de téléphone est obligatoire » s’il manque. Format `/^\+?[0-9\s\-\.]{7,20}$/` |
| `adresse` | string | non | max 200 car. ; `""` accepté. Absent → enregistrée vide (`""`) |
| `role` | string | non | seule valeur permise : `Particulier` (défaut) |

```json
{
  "nom": "Traore",
  "prenom": "Ali",
  "email": "ali@gmail.com",
  "mot_de_passe": "MotDePasse1",
  "telephone": "+22376000000",
  "adresse": "Bamako"
}
```

**Réponse 201** — aucun jeton n’est renvoyé : enchaîner avec `POST /auth/login`.

```json
{
  "message": "Inscription réussie",
  "utilisateur": {
    "id": "uuid", "nom": "Traore", "prenom": "Ali", "email": "ali@gmail.com",
    "adresse": "Bamako", "telephone": "+22376000000", "role": "Particulier", "statut": "actif"
  }
}
```

**Erreurs :** 400 `Données invalides` (+ `details`) · 400 « Le numéro de téléphone est obligatoire » · 400 « Cet email est déjà utilisé » · 400 « Ce numéro de téléphone est déjà utilisé » · 500 `{ message: "Erreur serveur lors de l'inscription" }` (le champ `erreur` est retiré par le filtre des 5xx).

> Seul un compte destinataire **créé automatiquement** (`compteAuto = true`, statut `inactif`) est revendiqué ; un client désactivé par un admin ne l’est jamais (son e-mail / téléphone répondent « déjà utilisé »).

---

#### `POST /nanei/auth/login`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `identifiant` | string | **oui** | e-mail (détecté par `/\S+@\S+\.\S+/`, mis en minuscules) **ou** téléphone (voir « Recherche par téléphone » ci-dessous) |
| `mot_de_passe` | string | **oui** | — |

**Réponse 200**

```json
{
  "token": "<jwt accès, 1 h>",
  "refreshToken": "<jwt refresh, 7 jours>",
  "utilisateur": {
    "id": "uuid", "nom": "…", "prenom": "…", "email": "…",
    "adresse": "…", "telephone": "…", "role": "Particulier", "statut": "actif"
  }
}
```

**Erreurs :** 400 « Identifiant ou mot de passe incorrect » · 400 « Compte désactivé. Contactez le support. » (seulement si le mot de passe est correct ; sinon « Identifiant ou mot de passe incorrect », que le compte existe ou non) · 400 `Données invalides` · 429 « Trop de tentatives. Veuillez réessayer dans 15 minutes. » · 500.

> Les identifiants invalides répondent **400** (et non 401).

**Recherche par téléphone.** Les numéros sont enregistrés au format international (`+22376000000`). Le back essaie dans l’ordre :
1. la valeur exacte saisie ;
2. les **chiffres seuls** (espaces, tirets, points et `+` ignorés ; `00` initial retiré) : `00223 76 00 00 00` → `22376000000` ;
3. un numéro enregistré qui **se termine** par le numéro saisi, sans ses `0` initiaux (au moins 7 chiffres) : `76000000`, `0612345678`.

À l’étape 3, si plusieurs comptes correspondent, seul un compte `actif` unique est retenu. Sinon la connexion est refusée (« Identifiant ou mot de passe incorrect ») plutôt que d’ouvrir le mauvais compte.

---

#### `POST /nanei/auth/refresh`

**Corps :** `{ "refreshToken": "<jwt>" }` (obligatoire).

**Réponse 200 :** `{ "token": "<nouveau jwt accès>", "refreshToken": "<nouveau refresh token>" }`. L’ancien refresh token est révoqué : rejouer l’ancien → 401.

**Erreurs :** 400 `Données invalides` · 401 « Refresh token invalide ou révoqué » · 401 « Refresh token expiré » · 401 « Refresh token invalide » · 401 « Session expirée, veuillez vous reconnecter » (compte supprimé ou non `actif`, ou refresh token émis avant le dernier changement de mot de passe ; il est alors révoqué) · 429 « Trop de renouvellements de session. Veuillez réessayer dans quelques minutes. » · 500 « Erreur serveur ».

---

#### `POST /nanei/auth/logout`

**Corps :** `{ "refreshToken": "<jwt>" }` (facultatif ; `""` ou `null` acceptés). Aucun jeton d’accès requis.

**Réponse 200 :** `{ "message": "Déconnexion réussie" }` (même si le refresh token est inconnu).

---

#### `POST /nanei/auth/oublier-password`

Envoie un code à 6 chiffres par e-mail (valide **10 minutes**).

**Corps :** `{ "email": "…" }` (obligatoire, format e-mail).

**Réponse 200 :** `{ "success": true, "message": "Si un compte existe avec cet email, un code de réinitialisation a été envoyé." }` (même réponse, sans envoi, si l’e-mail est inconnu, appartient à un administrateur ou à un compte désactivé).

**Erreurs :** 400 `{ success: false, message: "Impossible d'envoyer l'email pour le moment. Veuillez réessayer plus tard." }` · 429.

---

#### `POST /nanei/auth/reset-password`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `email` | string (email) | **oui** | — |
| `code` | string | **oui** | exactement 6 chiffres |
| `mot_de_passe` | string | **oui** | 8 à 128 car., au moins 1 minuscule, 1 majuscule, 1 chiffre (même règle qu’à l’inscription) |

**Réponse 200 :** `{ "success": true, "message": "Mot de passe réinitialisé avec succès" }`.

**Erreurs (400, `{ success: false, message }`) :** « Aucun code de réinitialisation trouvé. Veuillez refaire la demande. » (aussi pour un e-mail inconnu : pas d’énumération de comptes) · « Code expiré. Veuillez refaire la demande. » · « Code incorrect (N tentatives restantes). » · « Trop de tentatives. Réessayez dans 15 minutes. » (blocage de 15 min après 3 échecs) · « Trop de tentatives. Réessayez dans N minute(s). » (nouvel essai pendant le blocage) · `Données invalides` (+ `details`). 429 possible (« Trop de tentatives… » par IP, ou « Trop de tentatives pour cet email. Réessayez dans 15 minutes. »). 500 `{ success: false, message }`.

> Le message « Code incorrect » contient déjà le nombre d’essais restants : le mobile l’affiche tel quel.

---

## 2. Compte connecté

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/account/me` | jeton |
| PUT | `/nanei/account/modifier-profil` | jeton · compte actif · 20 / 15 min / IP |
| PUT | `/nanei/account/change-password` | jeton · compte actif · 20 / 15 min / IP |
| POST | `/nanei/account/fcm-token` | jeton |
| DELETE | `/nanei/account` | jeton · 20 / 15 min / IP |

#### `GET /nanei/account/me`

**Réponse 200 :** `{ "utilisateur": { id, nom, prenom, email, adresse, telephone, role, statut, photoProfil } }`. `photoProfil` est l’URL de la photo (R2) ou `null`. `fcm_token` n’est jamais renvoyé.

**Erreurs :** 401 · 403 · 404 « Utilisateur introuvable » · 500.

---

#### `PUT /nanei/account/modifier-profil`

- **Format :** `multipart/form-data` (si une photo est jointe) ou `application/json`.

**Corps** (tous facultatifs ; un champ absent n’est pas modifié)

| Champ | Type | Contraintes |
|---|---|---|
| `nom` | string | 2 à 50 car. |
| `prenom` | string | 2 à 50 car. |
| `email` | string (email) | doit être libre, sinon 400 « Cet email est déjà utilisé » |
| `telephone` | string | format téléphone ; doit être libre, sinon 400 « Ce numéro de téléphone est déjà utilisé ». `""` (champ vidé) → 400 « Le numéro de téléphone est obligatoire » pour un client qui a déjà un numéro (seul un `Admin` peut l’effacer) |
| `adresse` | string | max 200 car. ; `""` accepté (efface l’adresse) |
| `photoProfil` | fichier | PNG, JPEG, WEBP (ou PDF), 5 Mo max. Envoyé sur R2, l’URL est enregistrée dans `photo_profil` et renvoyée dans `utilisateur.photoProfil`. Le mobile l’envoie seule, en multipart, après un appui sur l’avatar du profil |

**Réponse 200 :** `{ "message": "Profil modifié avec succès", "utilisateur": { …formatUser } }`.

**Erreurs :** 400 `Données invalides` · 400 (e-mail ou téléphone déjà utilisé, téléphone vidé) · 400 « Type de fichier non autorisé » (type déclaré, `{ success: false, message, error }`) · 400 `{ message: "Type de fichier non autorisé (contenu non reconnu comme image PNG, JPEG, WEBP ou PDF)" }` (contenu réel vérifié) · 413 « Fichier trop volumineux » · 403 compte désactivé · 429 · 500 « Erreur serveur lors de la modification du profil ».

---

#### `PUT /nanei/account/change-password`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `oldPassword` | string | **oui** | mot de passe actuel |
| `newPassword` | string | **oui** | 8 à 128 car., 1 minuscule, 1 majuscule, 1 chiffre |

**Réponse 200 :** `{ "message": "Mot de passe modifié avec succès.", "token": "…", "refreshToken": "…" }`.

> **Toutes les autres sessions sont coupées** (autres appareils, jeton volé) : `passwordChangedAt` mis à jour et refresh tokens révoqués. La session en cours reçoit de nouveaux jetons : le mobile les enregistre (`profils_page.dart`, `TokenService.setToken` / `setRefreshToken`). Une version de l’app qui ne les enregistre pas est déconnectée au prochain appel.

**Erreurs :** 400 « Mot de passe actuel incorrect. » · 400 `Données invalides` · 429 · 500.

---

#### `POST /nanei/account/fcm-token`

**Corps :** `{ "fcm_token": "<jeton Firebase>" }` (obligatoire).

**Réponse 200 :** `{ "message": "FCM token enregistré" }`. **Erreur :** 400 « fcm_token est requis ».

Les changements de statut d’un colis faits par l’admin déclenchent une **notification push** à l’expéditeur et au destinataire, avec les données `{ colisId, statut }` (`statut` ∈ `en_attente`, `recupere`, `livre`).

---

#### `DELETE /nanei/account`

Suppression du compte (RGPD), par **anonymisation**, en une transaction :
- nom, prénom, e-mail, téléphone, adresse, photo et jeton push effacés ; mot de passe remplacé par une valeur aléatoire ; compte désactivé et marqué supprimé ;
- notifications, contacts favoris, avis et réclamations de l’utilisateur supprimés ; refresh tokens supprimés ;
- colis et paiements **conservés** (obligation comptable, et un colis concerne aussi son destinataire), rattachés à un compte anonyme.

**Réponse 200 :** `{ "message": "Compte supprimé : vos données personnelles ont été effacées définitivement" }`. **Erreurs :** 400 « Impossible de supprimer le dernier administrateur actif » · 429 · 500.

> Avant le 2026-10-11, cette route répondait toujours 500 (modèles et colonnes inexistants dans `rgpd.service.js`).

---

## 3. Pays, tarifs et taux de change

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/client/countries` | jeton |
| GET | `/nanei/client/pricing/:countryId` | jeton |
| POST | `/nanei/pricing/calculate` | **public** |
| GET | `/nanei/pricing/taux-change` | **public** |

#### `GET /nanei/client/countries`

Pays **actifs**, triés par nom.

**Réponse 200 :** `{ "success": true, "data": [ { "id": "uuid", "name": "France", "code": "FR" } ] }`.

---

#### `GET /nanei/client/pricing/:countryId`

**Réponse 200**

```json
{
  "success": true,
  "data": {
    "country": { "id": "uuid", "name": "France", "code": "FR" },
    "shippingPrices": [
      { "type": "aérien",   "minWeight": 1, "maxWeight": 30,  "pricePerKg": 15 },
      { "type": "maritime", "minWeight": 1, "maxWeight": 100, "pricePerKg": 5 }
    ],
    "servicePrices": [
      { "serviceType": "récupération", "price": 10 },
      { "serviceType": "livraison",    "price": 10 }
    ]
  }
}
```

- La grille vient de la table `shipping_rates` / `service_rates`. Si le pays n’y figure pas encore, le back retombe sur les anciennes tables `shipping_prices` / `service_prices` : chaque élément a alors en plus un champ `id`, et il peut y avoir plusieurs plages de poids par type.
- `type` vaut `aérien` ou `maritime` (**avec accent**) ; `serviceType` vaut `récupération` ou `livraison` (**avec accent**).
- Si une grille manque, la liste correspondante est vide (`[]`).

**Erreurs :** 404 `{ success: false, message: "Pays non trouvé" }` (inconnu ou inactif) · 500.

---

#### `POST /nanei/pricing/calculate`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `countryId` | UUID | **oui** | — |
| `weight` | number | **oui** | kg |
| `shippingType` | string | **oui** | `aérien` ou `maritime` (casse et accent tolérés : `aerien`, `AERIEN`…) |
| `needsPickup` | boolean | non | défaut `false` |
| `needsDelivery` | boolean | non | défaut `false` |

**Réponse 200**

```json
{
  "success": true,
  "message": "Prix calculé avec succès",
  "data": {
    "shippingPrice": 150, "pickupPrice": 0, "deliveryPrice": 10, "total": 160,
    "breakdown": { "weight": 10, "type": "aérien", "country": "France", "needsPickup": false, "needsDelivery": true }
  }
}
```

**Erreurs (400, `{ success: false, message }`) :** paramètres manquants (« Les paramètres countryId, weight et shippingType sont obligatoires », ou « … weight (> 0) … » si le poids n’est pas un nombre strictement positif) · « Erreur lors du calcul du prix total » (erreur interne du calcul, renvoyée en 400) · « Pays non trouvé » (inconnu ou inactif) · « Aucun prix trouvé pour le pays et le type de transport spécifiés » · « Aucune plage de poids ne correspond au poids de N kg ».

La réponse contient aussi `data.pricePerKg`, ainsi que `breakdown.countryId`. Erreur supplémentaire : 400 « Type de transport invalide (aérien ou maritime) ».

> Cette route lit **la même grille** que `GET /client/pricing/:countryId` : les tables `shipping_rates` / `service_rates` en priorité, les anciennes `shipping_prices` / `service_prices` en repli. C’est aussi ce calcul que le back applique à la création d’un colis (§4).

---

#### `GET /nanei/pricing/taux-change`

**Réponse 200 :** `{ "success": true, "data": { "deviseSource": "EUR", "deviseCible": "FCFA", "valeur": 655.957 } }`. La valeur vient de la table `taux_change` ; elle vaut **655.957** par défaut si la table est vide.

---

## 4. Colis — envoi

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/client/rechercher-client?q=…` | jeton |
| POST | `/nanei/client/envoie-colis` | jeton |
| POST | `/nanei/client/envoie-colis-lot` | jeton |

#### `GET /nanei/client/rechercher-client`

Recherche d’un destinataire **inscrit et actif**, par identifiant exact.

**Paramètre :** `q` = **e-mail complet** ou **numéro de téléphone** d’au moins **7 chiffres** (avec ou sans indicatif, mêmes règles que la connexion). En dessous, aucune recherche n’est faite. Plus de recherche partielle par nom : elle permettait de parcourir l’annuaire des clients.

**Réponse 200 :** `{ "data": [ { "id": "uuid", "nom": "Diallo", "prenom": "Aminata", "email": "am***@gmail.com", "telephone": "+223 ** ** 12 34" } ] }` — **un seul** résultat au plus, e-mail et téléphone **masqués**. Sinon `{ "data": [] }` (aucun compte, compte admin, compte inactif ou automatique, ou soi-même).

> L’envoi de colis n’utilise que `id` (`recepteurId`). Si rien n’est trouvé, le mobile propose la saisie manuelle du destinataire.

Moins de 5 caractères, ou un numéro de moins de 7 chiffres → `{ "data": [] }` sans recherche. E-mail reconnu par `/^\S+@\S+\.\S+$/` (comparé en minuscules). Masquage : 2 premiers caractères de l’e-mail + `***@domaine` ; téléphone = indicatif (4 premiers caractères si le numéro commence par `+`) + `** **` + 4 derniers chiffres.

**Erreurs :** 400 `{ message: "Recherche impossible pour le moment" }` (erreur interne) · 401 / 403 / 404 (jeton).

---

#### `POST /nanei/client/envoie-colis`

Aucune validation Joi : les contrôles viennent du service et des contraintes de la base.

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `recepteurId` | UUID | **oui, sauf si** `destinataireManuel` | compte client existant (jamais un administrateur), sinon 400 « Recepteur non trouvé » |
| `destinataireManuel` | objet | **oui, sauf si** `recepteurId` | prioritaire sur `recepteurId` s’il est présent (voir ci-dessous) |
| `poids` | number | **oui** | kg, strictement positif. Avec `countryId` + `shippingType` : absent, nul ou négatif → 400 « Les paramètres countryId, weight (> 0) et shippingType sont obligatoires ». Sans eux (ancienne app) : absent → 400 avec le message de validation Sequelize (« notNull Violation: Colis.poids cannot be null ») |
| `countryId` | UUID | **oui** (app ≥ 1.0.2+13) | pays de destination. Avec `shippingType`, déclenche le **calcul du prix par le back** |
| `shippingType` | string | **oui** (app ≥ 1.0.2+13) | `aérien` ou `maritime` (casse et accent tolérés). Enregistré dans `colis.type_transport` (`aerien` / `maritime`) |
| `needsPickup` | boolean | non | récupération à domicile (défaut `false`) |
| `needsDelivery` | boolean | non | livraison à destination (défaut `false`) |
| `prix` | number | non | **ignoré** quand `countryId` et `shippingType` sont fournis. Pris tel quel seulement pour les anciennes versions de l’app, tant que `PRIX_SERVEUR_OBLIGATOIRE` n’est pas `true` (doit alors être un nombre > 0, sinon 400 « Prix invalide ») |
| `destination` | string | non si `countryId` | remplacée par le nom du pays de `countryId` quand le prix est calculé par le back. Ni `destination` ni `countryId` → 400 « La destination est obligatoire » |
| `type_colis` | string | non | **nature** du colis, texte libre saisi par l’utilisateur (« Vêtement », « Document »…). Ce n’est **pas** le mode de transport |
| `description` | string | non | — |

**Objet `destinataireManuel`**

| Champ | Type | Obligatoire | Effet |
|---|---|---|---|
| `prenom` | string | **oui** | sinon 400 « Le prénom et le nom du destinataire sont obligatoires » |
| `nom` | string | **oui** | idem |
| `telephone` | string | **oui** | sinon 400 « Le téléphone du destinataire est obligatoire » |
| `email` | string | non | sert à retrouver un compte existant |
| `ville` | string | non | enregistrée comme adresse du compte léger |
| `paysId` | UUID | non | enregistré dans le contact favori |

Résolution du destinataire manuel : un compte existant avec le même **e-mail**, puis à défaut avec le même **téléphone** (comparaison exacte), est réutilisé (400 « Ce contact correspond à un compte non autorisé comme destinataire » si c’est un compte `Admin`). Sinon, un compte léger `inactif` est créé (e-mail factice `no-email-<uuid>@nanei.local` si aucun e-mail n’est fourni). Le destinataire est aussi ajouté aux **contacts favoris** de l’expéditeur, sans doublon sur le téléphone.

Prix : le back appelle le même calcul que `POST /pricing/calculate` (poids × prix au kg de la plage + récupération + livraison) et enregistre ce total dans `colis.prix`. Erreurs possibles en 400 : « Pays non trouvé », « Type de transport invalide (aérien ou maritime) », « Aucune plage de poids ne correspond au poids de N kg », « Version de l'application obsolète… » (si `PRIX_SERVEUR_OBLIGATOIRE=true` et que `countryId` / `shippingType` manquent).

Effets de bord : une ligne `Notifications` (pour le destinataire), une ligne `Paiement` (`statut: en_attente`, `prixTotal = prix calculé`), puis un SMS au destinataire (non bloquant).

```json
{
  "destinataireManuel": { "prenom": "Ali", "nom": "Traore", "telephone": "+221770000000", "email": "ali@gmail.com", "ville": "Dakar" },
  "poids": 10,
  "countryId": "uuid-du-senegal",
  "shippingType": "aérien",
  "needsPickup": false,
  "needsDelivery": true,
  "prix": 160,
  "destination": "Sénégal",
  "type_colis": "Vêtements",
  "description": "Sac de vêtements"
}
```

**Réponse 201**

```json
{
  "message": "Colis créé avec succès",
  "colis": {
    "id": "uuid", "reference": "COL-2026-B5A880-1234",
    "expediteurId": "uuid", "recepteurId": "uuid",
    "poids": 10, "prix": 160, "destination": "Sénégal",
    "description": "Sac de vêtements", "type_colis": "Vêtements",
    "type_transport": "aerien",
    "statut": "en_attente",
    "createdAt": "…", "updatedAt": "…"
  }
}
```

`prix` = total calculé par le back (ici 10 kg × 15 + livraison 10). `type_transport` vaut `null` si `shippingType` est absent (ancienne app). Format de la référence : `COL-<année>-<6 hex majuscules>-<4 chiffres>`. ⚠️ À vérifier : `lot_id` est probablement absent (et non `null`) pour un envoi simple.

**Erreurs :** 400 `{ message }` (destinataire, champs manquants, compte non autorisé, poids hors grille…) · 500 `{ message: "Erreur serveur lors de l'envoi du colis" }` (le champ `erreur` est retiré par le filtre des 5xx). Le mobile affiche le `message` du back dans le toast d’échec.

---

#### `POST /nanei/client/envoie-colis-lot`

Plusieurs colis en **une seule transaction** (tout ou rien), avec un `lot_id` commun.

**Corps :** `{ "colis": [ <élément>, … ] }`, entre **1 et 20** éléments. Chaque élément a les mêmes champs que `POST /client/envoie-colis`, y compris `countryId`, `shippingType`, `needsPickup` et `needsDelivery` : le prix de **chaque** colis est calculé par le back. `poids`, (`destination` **ou** `countryId`) et (`recepteurId` **ou** `destinataireManuel`) sont **obligatoires**.

**Réponse 201**

```json
{
  "message": "3 colis créés avec succès",
  "lotId": "uuid",
  "colis": [ { "id": "uuid", "reference": "COL-…", "lot_id": "uuid", "statut": "en_attente", … } ]
}
```

**Erreurs (400, `{ message }`) :** « Aucun colis fourni » · « Un lot ne peut pas contenir plus de 20 colis » · « Un des colis du lot est incomplet (destinataire, poids ou destination manquant) » · erreurs de calcul du prix (voir ci-dessus) · erreurs du destinataire manuel (voir ci-dessus) · « Récepteur non trouvé pour un des colis du lot » · 500 `{ message: "Erreur serveur lors de l'envoi du lot de colis" }`.

---

## 5. Colis — consultation

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/client/colis-envoyes` | jeton |
| GET | `/nanei/client/colis-recus` | jeton |
| GET | `/nanei/client/colis-recherche/:reference` | jeton (expéditeur ou destinataire du colis) |
| GET | `/nanei/client/statistiques-colis` | jeton |

#### `GET /nanei/client/colis-envoyes` et `GET /nanei/client/colis-recus`

Colis où l’utilisateur est l’expéditeur (respectivement le destinataire), du plus récent au plus ancien.

**Paramètres (facultatifs) :** `page`, `limit` (voir « Pagination des listes », §0) · `statut` = `en_attente` | `recupere` | `livre` (`tous` ou vide = pas de filtre ; autre valeur → 400), appliqué **avant** la pagination. Sans `page` ni `limit` : liste complète (utilisé par le formulaire de réclamation).

**Réponse 200**

```json
{
  "par_statut": { "en_attente": 1, "recupere": 0, "livre": 3, "total": 4 },
  "pagination": { "page": 1, "limit": 20, "total": 4, "pages": 1 },
  "data": [
    {
      "id": "uuid", "reference": "COL-2026-469D90-5678",
      "expediteurId": "uuid", "recepteurId": "uuid",
      "poids": 10, "prix": 150, "destination": "France",
      "description": null, "type_colis": "Vêtements",
      "type_transport": "aerien",
      "statut": "livre", "lot_id": null,
      "createdAt": "…", "updatedAt": "…", "deletedAt": null,
      "expediteur": { "id": "uuid", "nom": "…", "prenom": "…", "email": "…", "telephone": "…" },
      "recepteur":  { "id": "uuid", "nom": "…", "prenom": "…", "email": "…", "telephone": "…" }
    }
  ]
}
```

- `par_statut` : toujours présent ; nombre de colis de l’utilisateur (envoyés, respectivement reçus) par statut, sur **toutes les pages** et **sans** le filtre `statut`.
- `pagination` : présent seulement si `page` ou `limit` est passé.

> `statut` ∈ `en_attente` | `recupere` | `livre`. C’est la seule source de vérité : il est modifié par l’admin (`PUT /nanei/admin/changer-statut-*/:id`). Le mobile doit recharger la liste pour voir un changement (ou réagir à la notification push).

**Erreurs :** 400 « Statut invalide (en_attente, recupere, livre) » · 400 `{ message }` (autre erreur du service) · 500 `{ message: "Erreur serveur lors de la récupération des colis envoyés" }` (resp. « … reçus » ; champ `erreur` retiré).

---

#### `GET /nanei/client/colis-recherche/:reference`

Utilisé après le scan du QR code de l’étiquette.

**Réponse 200 :** `{ "data": { …colis, "expediteur": {…}, "recepteur": {…} } }` (même forme qu’un élément de liste).

**Erreurs :** 404 « Colis introuvable » · 403 « Ce colis ne vous appartient pas » (toute autre erreur du service répond aussi 403) · 500.

---

#### `GET /nanei/client/statistiques-colis`

**Réponse 200 :** `{ "success": true, "data": { "colisEnvoyes": 4, "colisRecus": 2, "total": 6 } }`. Erreur : 500 `{ success: false, message }`.

---

## 6. Notifications

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/client/mes-notifications` | jeton |
| PATCH | `/nanei/client/lire-notifications/:notificationId` | jeton (destinataire de la notification) |
| POST | `/nanei/client/notifications/mark-all-read` | jeton |

#### `GET /nanei/client/mes-notifications`

Notifications **reçues** (une est créée pour le destinataire à chaque nouveau colis). Avec `?page=&limit=` : paginées ; sans : les 50 plus récentes.

La réponse contient toujours `non_lues` : nombre **total** de notifications non lues (toutes pages), pour le badge.

> Les changements de statut faits par l’admin **ne créent pas** de ligne ici : ils passent uniquement par une notification push FCM.

**Réponse 200**

```json
{
  "non_lues": 3,
  "pagination": { "page": 1, "limit": 20, "total": 12, "pages": 1 },
  "data": [
    {
      "id": "uuid", "expediteurId": "uuid", "recepteurId": "uuid", "colisId": "uuid",
      "statut": "non_lu",
      "createdAt": "…", "updatedAt": "…", "deletedAt": null,
      "colis": { "id": "uuid", "reference": "COL-…", "type_colis": "…", "description": "…", "statut": "en_attente", "created_at": "…" },
      "expediteur": { "id": "uuid", "nom": "…", "prenom": "…", "email": "…", "telephone": "…" }
    }
  ]
}
```

`statut` ∈ `lu` | `non_lu`. `pagination` n’est présent que si `page` ou `limit` est passé. ⚠️ À vérifier : la date du colis inclus est demandée sous la clé `created_at` ; il faut confirmer par un appel réel la clé effectivement renvoyée.

**Erreurs :** 400 `{ message }` (erreur du service) · 500 `{ message: "Erreur serveur lors de la récupération des notifications" }`.

---

#### `PATCH /nanei/client/lire-notifications/:notificationId`

Aucun corps. **Réponse 200 :** `{ "message": "Notification marquée comme lue", "data": { …notification, "statut": "lu" } }`.

**Erreurs :** 404 « Notification introuvable » (notification inexistante **ou** appartenant à un autre utilisateur) · 500.

---

#### `POST /nanei/client/notifications/mark-all-read`

Aucun corps. Passe à `lu` toutes les notifications `non_lu` de l’utilisateur connecté.

**Réponse 200 :** `{ "message": "Notifications marquées comme lues", "data": { "nombre": 3 } }`. **Erreur :** 500.

---

## 7. Paiements et factures

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/paiements` | jeton |
| POST | `/nanei/paiements/:colisId/initier` | jeton (expéditeur du colis) |
| GET | `/nanei/paiements/retour` | public (redirection navigateur) — ne valide **jamais** un paiement sur la seule foi de l’URL |
| GET | `/nanei/factures/:paiementId` | jeton (payeur) |
| GET | `/nanei/factures/:paiementId/download` | jeton (payeur) |

#### `GET /nanei/paiements`

Paiements dont l’utilisateur est le payeur (un par colis envoyé), du plus récent au plus ancien.

**Paramètres (facultatifs) :** `page`, `limit` (§0) · `statut` = `en_attente` | `en_cours` | `paye` | `echoue` | `rembourse` (`tous` ou vide = pas de filtre ; autre valeur → 400), appliqué avant la pagination.

**Réponse 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "colisId": "uuid", "payeurId": "uuid",
      "prixTotal": 150, "montantPaye": null,
      "moyenPaiement": null, "statut": "en_attente",
      "referenceTransaction": null, "checkoutUrl": null,
      "createdAt": "…", "updatedAt": "…",
      "colis": { "id": "uuid", "reference": "COL-…", "prix": 150, "poids": 10, "destination": "France", "type_colis": "…", "statut": "en_attente" }
    }
  ],
  "par_statut": { "en_attente": 1, "en_cours": 0, "paye": 0, "echoue": 0, "rembourse": 0, "total": 1 },
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

`prixTotal`, `montantPaye`, `colis.prix` et `colis.poids` sont convertis en **nombres** (les colonnes `DECIMAL` sortent normalement en texte) ; `montantPaye` reste `null` tant que rien n’a été payé. `webhookPayload` (charge brute de l’opérateur) n’est **jamais** renvoyé. `statut` ∈ `en_attente` | `en_cours` | `paye` | `echoue` | `rembourse` ; `moyenPaiement` ∈ `wave` | `orange_money` | `null`. `par_statut` : toujours présent, compteurs sur tous les paiements du client (toutes pages, sans filtre). `pagination` : seulement si `page` ou `limit` est passé.

**Erreurs :** 400 `{ success: false, message: "Statut invalide (en_attente, en_cours, paye, echoue, rembourse)" }` · 500 `{ success: false, message: "Erreur serveur" }`.

---

#### `POST /nanei/paiements/:colisId/initier`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `moyenPaiement` | string | **oui** | `wave` ou `orange_money` |

Aucun montant n’est envoyé par le client : le back le calcule. Il prend le prix du colis (**en euros**), le convertit en **XOF** au taux de change actif (`GET /pricing/taux-change`, 655.957 par défaut) et arrondit à l’unité. Le montant doit être compris entre **100 et 10 000 000 XOF**.

**Réponse 200**

```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://…",
    "paiementId": "uuid",
    "montant": 98394,
    "devise": "XOF",
    "prixEur": 150,
    "tauxChange": 655.957
  }
}
```

Le paiement passe à `en_cours`. Ouvrir `checkoutUrl` dans le navigateur.

**Erreurs (400, `{ success: false, message }`) :** « Colis non trouvé ou non autorisé » · « Paiement non trouvé pour ce colis » · « Ce colis est déjà payé » · « Montant minimum : 100 XOF » · « Montant maximum : 10000000 XOF » · « Moyen de paiement invalide » · « Erreur lors de l'initialisation du paiement: … » (le paiement passe alors à `echoue`). 500 `{ success: false, message: "Erreur serveur" }`.

> `moyenPaiement` n’est contrôlé qu’après les vérifications du colis et du montant : une valeur invalide répond « Moyen de paiement invalide » sans changer le statut du paiement.

---

#### `GET /nanei/paiements/retour?statut=succes|echec&colisId=…&ref=<paiementId>`

Appelée par le navigateur après le paiement Wave ou Orange Money (pas par l’application). Le paramètre `statut` de l’URL **n’est jamais cru** :

- **Wave :** le back interroge l’API Wave (`GET /checkout/sessions/:id`). Il ne passe le paiement à `paye` que si Wave confirme `checkout_status = complete`, la bonne référence (`client_reference`) **et** le bon montant en XOF. Si Wave répond `error` ou `expired`, le paiement passe à `echoue`.
- **Orange Money :** rien n’est écrit en base ; le paiement reste `en_cours` jusqu’au **webhook signé** d’Orange Money.
- **Webhooks (Wave / Orange Money) :** signature HMAC vérifiée sur le corps brut ; un webhook ne modifie jamais un paiement déjà `paye` ou `rembourse`, et ne valide pas un paiement dont le montant annoncé diffère du montant attendu en XOF.

La page HTML affichée, et le lien profond vers lequel elle redirige, dépendent de l’état **vérifié** :

| État | Lien profond | Message |
|---|---|---|
| confirmé | `nanei://paiement/succes?colisId=<id>` | Paiement réussi |
| en attente de confirmation | `nanei://paiement/verification?colisId=<id>` | Paiement en cours de vérification |
| échec ou annulation | `nanei://paiement/echec?colisId=<id>` | Paiement échoué |

(schéma configurable par `APP_DEEP_LINK`, `nanei` par défaut). Au retour dans l’application, recharger `GET /paiements` : c’est la seule source de vérité.

Côté mobile, le schéma `nanei://paiement` est déclaré sur Android (`AndroidManifest.xml`) et sur iOS (`CFBundleURLTypes`). Le deep linking natif de Flutter est désactivé au profit de `app_links`. `LiensEntrantsService` affiche le message correspondant et fait recharger « Mes paiements ».

---

#### `GET /nanei/factures/:paiementId` et `GET /nanei/factures/:paiementId/download`

Paramètre : **l’ID du paiement** (pas celui du colis).

**Réponse 200 :** PDF (`Content-Type: application/pdf`), affiché dans la page (`inline`) ou téléchargé (`attachment` pour `/download`). Les montants y sont en **euros**, avec l’équivalent en FCFA réellement débité (montant renvoyé par Wave, sinon conversion au taux actif).

**Erreurs :** 404 « Paiement non trouvé » · 403 « Accès non autorisé » · 400 « Facture disponible uniquement après paiement validé » (statut ≠ `paye`) · 500.

> Le mobile télécharge le PDF avec le client réseau commun (`sl<Dio>()`, `responseType: bytes`), donc avec renouvellement automatique du jeton. En mode `bytes`, le corps JSON d’une erreur arrive aussi en octets : il faut le décoder pour lire `message`.

---

## 8. Étiquette et suivi public

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/etiquettes/:colisId` | jeton (**expéditeur** uniquement) |
| GET | `/nanei/suivi/:reference` | **public** · 30 / 15 min / IP |

#### `GET /nanei/etiquettes/:colisId`

- Par défaut : PDF (`inline; filename="etiquette-<reference>.pdf"`), avec QR code vers le suivi public.
- `?format=zpl` : texte ZPL pour imprimante thermique 100×150 mm (`attachment; filename="etiquette-<reference>.zpl"`).
- Le pays d’origine est toujours `MALI` ; le pays de destination vient de `colis.destination`.
- Le mode de transport affiché (AÉRIEN / MARITIME) vient de `colis.type_transport`. Pour un ancien colis sans cette valeur, le back utilise `type_colis` s’il contient « aérien » ou « maritime », sinon il affiche aérien.

**Erreurs :** 404 « Colis introuvable » · 403 « Accès non autorisé » (le destinataire ne peut pas télécharger l’étiquette) · 500.

---

#### `GET /nanei/suivi/:reference`

- Par défaut : **page HTML** de suivi (cible du QR code de l’étiquette).
- `?format=json` : version JSON, utilisée par le mobile.

**Réponse 200 (`?format=json`)**

```json
{
  "success": true,
  "colis": {
    "reference": "COL-…", "statut": "recupere", "destination": "France",
    "poids": 10, "type_colis": "Vêtements", "type_transport": "aerien", "created_at": "…",
    "expediteur": { "nom": "…", "prenom": "…", "telephone": "77****00" },
    "recepteur":  { "nom": "…", "prenom": "…", "telephone": "06****78" },
    "historique": [
      { "ancien_statut": "en_attente", "nouveau_statut": "recupere", "commentaire": null, "created_at": "…" }
    ]
  }
}
```

Les téléphones sont masqués (2 premiers et 2 derniers caractères). L’historique est alimenté à chaque changement de statut fait par l’admin. Il est trié **du plus ancien au plus récent**. `type_transport` vaut toujours `aerien` ou `maritime` (même règle de repli que l’étiquette). ⚠️ À vérifier : la clé de date des lignes d’historique (`created_at`) est à confirmer par un appel réel.

**Erreurs :** 404 `{ success: false, message: "Colis introuvable" }` (en HTML sans `?format=json`) · 429 · 500.

---

## 9. Preuve de livraison

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/colis/:colisId/preuve` | jeton (expéditeur ou destinataire du colis) |

#### `GET /nanei/colis/:colisId/preuve`

- **Accès :** jeton ; expéditeur **ou** destinataire du colis.

**Réponse 200**

```json
{
  "success": true,
  "preuve": {
    "id": "uuid", "colis_id": "uuid", "photo_url": "https://…",
    "commentaire": null, "gps_lat": null, "gps_lng": null,
    "createdAt": "…"
  }
}
```

Pas de `updatedAt` : le modèle `PreuveLivraison` est défini avec `updatedAt: false`.

**Erreurs :** 404 « Colis introuvable » · 403 « Accès non autorisé » · 404 « Aucune preuve disponible » (cas normal tant que l’admin n’a pas téléversé de photo) · 500.

---

## 10. Avis

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/avis` | jeton (**expéditeur** du colis) |
| GET | `/nanei/avis` | jeton |

#### `POST /nanei/avis`

**Corps**

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `colis_id` (ou `colisId`) | UUID | **oui** | colis de l’utilisateur, avec le statut **`livre`** |
| `note` | integer | **oui** | 1 à 5 |
| `commentaire` | string | non | — |

**Réponse 201 :** `{ "success": true, "message": "Avis enregistré", "avis": { id, colis_id, utilisateur_id, note, commentaire, createdAt } }` (pas de `updatedAt` : modèle défini avec `updatedAt: false`).

**Erreurs :** 400 « colis_id et note sont obligatoires » · 400 « La note doit être un entier entre 1 et 5 » (« 4 » accepté, 4.5 ou « abc » refusés) · 404 « Colis introuvable » · 403 « Ce colis ne vous appartient pas » · 400 « Vous pouvez donner un avis uniquement après livraison » · 409 « Un avis existe déjà pour ce colis » · 500.

> Un seul avis par colis, donné par l’**expéditeur**. Le mobile n’affiche le bandeau « Donnez votre avis » qu’à l’expéditeur, et seulement si `GET /avis` ne contient pas déjà ce colis. Une réponse 409 est traitée comme « déjà noté ».

---

#### `GET /nanei/avis`

Avis donnés par l’utilisateur, du plus récent au plus ancien. **Paramètres (facultatifs) :** `page`, `limit` (§0). Sans eux : liste complète (le détail d’un colis s’en sert pour savoir s’il est déjà noté).

**Réponse 200 :** `{ "success": true, "avis": [ { …avis, "colis": { "reference": "…", "destination": "…" } } ] }`, plus `"pagination": { page, limit, total, pages }` si `page` ou `limit` est passé.

**Erreurs :** 500 `{ success: false, message: "Erreur serveur" }`.

---

## 11. Réclamations

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/reclamations` | jeton (**expéditeur ou destinataire** du colis) |
| GET | `/nanei/reclamations` | jeton |
| GET | `/nanei/reclamations/:id` | jeton (auteur de la réclamation) |

#### `POST /nanei/reclamations`

- **Format :** `multipart/form-data` (les champs texte sont des chaînes).

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `colis_id` | UUID | **oui** | colis dont l’utilisateur est l’**expéditeur ou le destinataire** |
| `type` | string | **oui** | `perdu` · `endommagé` · `retard` · `autre` Valeur canonique `endommagé` **avec accent** ; `endommage` est accepté et converti, la casse est ignorée. Une autre valeur → **400** |
| `description` | string | **oui** | — |
| `photos` | fichiers | non | 0 à 5 ; PNG, JPEG ou WEBP ; 10 Mo par fichier ; `Content-Type` de chaque fichier obligatoire (voir §0) |

**Réponse 201 :** `{ "success": true, "message": "Réclamation créée", "reclamation": { id, colis_id, utilisateur_id, type, description, photos: ["https://…"], statut: "ouverte", commentaire_admin: null, createdAt, updatedAt } }`.

**Erreurs :** 400 « Champs obligatoires manquants » · 400 « Type de réclamation invalide (perdu, endommagé, retard ou autre) » · 400 « Type de fichier non autorisé » (type déclaré) · 400 « Type de fichier non autorisé (contenu non reconnu comme image PNG, JPEG, WEBP ou PDF) » (contenu réel) · 400 « Trop de fichiers ou champ de fichier inattendu » (plus de 5 photos) · 413 « Fichier trop volumineux » · 404 « Colis introuvable » · 403 « Ce colis ne vous appartient pas » · 500 `{ success: false, message: "Erreur serveur" }`.

> Le formulaire mobile propose les colis **envoyés et reçus** de l’utilisateur.

---

#### `GET /nanei/reclamations` et `GET /nanei/reclamations/:id`

Liste : réclamations **créées par l’utilisateur**, de la plus récente à la plus ancienne ; paramètres facultatifs `page`, `limit` (§0, pas de filtre `statut` côté client). Détail : seulement si l’utilisateur en est l’auteur (sinon 404).

**Réponse 200 :** `{ "success": true, "reclamations": [ … ] }` (+ `pagination` si `page` ou `limit` est passé) ou `{ "success": true, "reclamation": { … } }`. Chaque réclamation inclut `colis: { reference, statut, destination }`. `statut` ∈ `ouverte` | `en_cours` | `resolue` | `rejetee` (libellés mobile : Ouverte · En cours · Résolue · Rejetée).

**Erreurs :** 404 « Réclamation introuvable » · 500.

---

## 12. Contacts favoris

| Méthode | Chemin | Accès |
|---|---|---|
| GET | `/nanei/contacts` | jeton |
| POST | `/nanei/contacts` | jeton |
| PUT | `/nanei/contacts/:id` | jeton (propriétaire du contact) |
| DELETE | `/nanei/contacts/:id` | jeton (propriétaire du contact) |

Les contacts sont aussi créés **automatiquement** lors d’un envoi à un destinataire manuel.

**Entité `contact` :** `{ id, utilisateur_id, nom, prenom, email, telephone, ville, pays_id, createdAt, updatedAt }`.

#### `GET /nanei/contacts`
**Paramètres (facultatifs) :** `page`, `limit` (§0) · `q` : recherche insensible à la casse dans `nom`, `prenom`, `telephone` et `email` (100 caractères max, appliquée avant la pagination). Le mobile n’envoie pas `q`.

**Réponse 200 :** `{ "success": true, "contacts": [ … ] }`, du plus récent au plus ancien, plus `pagination` si `page` ou `limit` est passé. **Erreur :** 500.

#### `POST /nanei/contacts`

| Champ | Type | Obligatoire | Remarque |
|---|---|---|---|
| `nom` | string | **oui** | sinon 400 « Le nom est obligatoire » |
| `prenom`, `email`, `telephone`, `ville` | string | non | — |
| `pays_id` (ou `pays`) | UUID | non | enregistré dans `pays_id` (`pays_id` prioritaire si les deux sont envoyés ; doit être l’ID d’un pays existant, sinon 500) |

**Réponse 201 :** `{ "success": true, "message": "Contact créé", "contact": { … } }`.

#### `PUT /nanei/contacts/:id`
Mêmes champs, tous facultatifs (un champ présent remplace la valeur). **Réponse 200 :** `{ success, message: "Contact mis à jour", contact }`. **Erreur :** 404 « Contact introuvable ».

#### `DELETE /nanei/contacts/:id`
**Réponse 200 :** `{ "success": true, "message": "Contact supprimé" }`. **Erreur :** 404 « Contact introuvable ».

> Le pays s’écrit et se lit sous le même nom, `pays_id` ; l’ancien nom `pays` reste accepté en écriture (correctif #41).

---

## 13. Message au support

| Méthode | Chemin | Accès |
|---|---|---|
| POST | `/nanei/messages` | **public** (visiteur ou client) |

#### `POST /nanei/messages`

- **Accès :** public (aucun jeton).

| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `email` | string | **oui** | e-mail valide (ex. `nom@domaine.com` ; `a@b` refusé), sinon 400 « Adresse email invalide. » |
| `objet` | string | **oui** | max 200 car., sinon 400 |
| `description` | string | **oui** | — |

**Réponse 201 :** `{ "success": true, "message": "Message envoyé avec succès. Nous vous répondrons via email.", "data": { "id": "uuid" } }`.

**Erreurs :** 400 « Les champs email, objet et description sont obligatoires. » · 400 « Adresse email invalide. » · 400 « L’objet ne doit pas dépasser 200 caractères. » · 500. Le mobile applique les mêmes contrôles avant l’envoi et affiche le message du back en cas d’erreur.

---

## 14. Divers (santé, fichiers)

- `GET /health` (hors préfixe `/nanei`, publique) → `200 { "status": "OK", "db": "ok", "version": "<sha du commit | dev>", "api": <entier> }`, ou `503 { "status": "KO", "db": "erreur" }` si la base est injoignable. `api` = version du contrat d’API (`src/config/version.js`, `API_VERSION`) : incrémentée quand une modification du back casse le contrat de l’admin ou du mobile.
- `GET /uploads/<chemin>` : fichiers statiques locaux (hérités). Les nouveaux fichiers (photos de réclamation, preuves, profil) sont sur **Cloudflare R2** : utiliser directement l’URL complète renvoyée.

---

## Annexe A — Entités (champs renvoyés)

### Utilisateur (`formatUser`)
`id`, `nom`, `prenom`, `email`, `adresse`, `telephone`, `role` (`Particulier` | `Admin`), `statut` (`actif` | `inactif`), `photoProfil` (URL ou `null`). Les réponses de connexion, d’inscription, `/account/me` et de modification de profil utilisent toutes cette forme.

### Colis
| Champ | Type | Remarque |
|---|---|---|
| `id` | UUID | |
| `reference` | string | `COL-AAAA-XXXXXX-NNNN`, unique |
| `expediteurId`, `recepteurId` | UUID | |
| `poids` | number | kg |
| `prix` | number | en euros, **calculé par le back** à la création (sauf anciennes versions de l’app) |
| `destination` | string | nom du pays |
| `description` | string \| null | |
| `type_colis` | string \| null | nature du colis, texte libre (« Vêtements »…) |
| `type_transport` | `aerien` \| `maritime` \| null | mode de transport choisi à l’envoi (sans accent) ; `null` pour un ancien colis non repris par la migration |
| `statut` | enum | `en_attente` · `recupere` · `livre` |
| `lot_id` | UUID \| null | colis envoyés ensemble |
| `createdAt`, `updatedAt`, `deletedAt` | date-heure | |
| `expediteur`, `recepteur` | objet | `{ id, nom, prenom, email, telephone }` dans les listes |

### Notification
`id`, `expediteurId`, `recepteurId`, `colisId`, `statut` (`lu` | `non_lu`), `createdAt`, `updatedAt`, `deletedAt`, `colis`, `expediteur`.

### Paiement
`id`, `colisId`, `payeurId`, `prixTotal`, `montantPaye` (`null` tant que rien n’est payé), `moyenPaiement`, `statut`, `referenceTransaction`, `checkoutUrl`, `createdAt`, `updatedAt`, `colis`. (`webhookPayload` existe en base mais n’est jamais renvoyé au client.)

### Réclamation
`id`, `colis_id`, `utilisateur_id`, `type`, `description`, `photos` (tableau d’URL), `statut`, `commentaire_admin`, `createdAt`, `updatedAt`, `colis`.

### Contact favori
`id`, `utilisateur_id`, `nom`, `prenom`, `email`, `telephone`, `ville`, `pays_id`, `createdAt`, `updatedAt`.

### Preuve de livraison
`id`, `colis_id`, `photo_url`, `commentaire`, `gps_lat`, `gps_lng`, `createdAt` (pas de `updatedAt`).

### Avis
`id`, `colis_id` (unique), `utilisateur_id`, `note` (1 à 5), `commentaire`, `createdAt` (pas de `updatedAt`).

---

## Annexe B — Énumérations métier

| Énumération | Valeurs (exactes) | Libellés conseillés |
|---|---|---|
| Statut colis | `en_attente`, `recupere`, `livre` | En attente · Récupéré · Livré |
| Statut notification | `lu`, `non_lu` | |
| Statut paiement | `en_attente`, `en_cours`, `paye`, `echoue`, `rembourse` | |
| Moyen de paiement | `wave`, `orange_money` | |
| Type de transport (tarifs, `shippingType`) | `aérien`, `maritime` | avec accent |
| Type de transport (`colis.type_transport`, suivi) | `aerien`, `maritime` | **sans** accent · Aérien · Maritime |
| Type de service (tarifs) | `récupération`, `livraison` | avec accent |
| Type de réclamation | `perdu`, `endommagé`, `retard`, `autre` | avec accent sur `endommagé` (`endommage` accepté en entrée) |
| Statut de réclamation | `ouverte`, `en_cours`, `resolue`, `rejetee` | Ouverte · En cours · Résolue · Rejetée |
| Rôle utilisateur | `Particulier`, `Admin` | |
| Statut utilisateur | `actif`, `inactif` | `inactif` = compte destinataire léger ou compte désactivé |

---

## Annexe C — Écarts constatés et points de vigilance

### C.1 Correctifs appliqués le 2026-10-11 — première série

| # | Statut | Problème | Correctif |
|---|---|---|---|
| 1 | ✅ DONE | `POST /paiements/:colisId/initier` exigeait un `montant` que le mobile n’envoie pas : chaque paiement répondait 400 « Montant manquant ». | Le middleware `validatePaymentAmount` est retiré de la route. Le montant est calculé et borné côté serveur (100 à 10 000 000 XOF). Le corps ne contient plus que `moyenPaiement`. |
| 2 | ✅ DONE | `GET /paiements/retour?statut=succes&ref=…` (public) marquait un paiement `paye` sans vérification. | Le paramètre `statut` n’est plus cru. Wave : vérification par l’API (statut, référence, montant). Orange Money : on attend le webhook signé. Nouvel état « en cours de vérification ». |
| 3 | ✅ DONE | Le prix en euros était envoyé tel quel à Wave et Orange Money en XOF (150 € débités 150 FCFA). La facture affichait aussi des euros suivis de « FCFA ». | Conversion EUR → XOF au taux actif avant l’appel à l’opérateur. La facture affiche les euros et l’équivalent en FCFA débité. |
| 4 | ✅ DONE | Le prix du colis venait du mobile sans être recalculé. | Le back calcule le prix à partir de `countryId`, `shippingType`, `needsPickup` et `needsDelivery`, envoyés par le mobile à partir de la version 1.0.2+13. Les anciennes versions (qui n’envoient que `prix`) restent acceptées avec un avertissement dans les logs, tant que `PRIX_SERVEUR_OBLIGATOIRE` n’est pas `true`. |
| 5 | ✅ DONE | `POST /client/notifications/mark-all-read` (appelée par le mobile) n’existait pas → 404. | Route ajoutée. En plus, `PATCH /client/lire-notifications/:id` vérifie maintenant que la notification appartient à l’utilisateur (404 sinon). |
| 6 | ✅ DONE | La photo de profil était téléversée mais jamais enregistrée. | Colonne `photo_profil` ajoutée (migration `20261011120000-add-photo-profil-to-utilisateur.js`), attribut `photoProfil` dans le modèle, renvoyé par `formatUser`. |
| 7 | ✅ DONE | `POST /pricing/calculate` lisait les anciennes tables de tarifs, alors que l’écran d’envoi lit les nouvelles. | Le calcul utilise la même grille que `GET /client/pricing/:countryId` (nouvelles tables, anciennes en repli). |
| — | ✅ DONE (mobile 1.0.2+11) | Le mobile comparait le statut avec `livré` alors que le back renvoie `livre`. | Normalisation du statut dans `ColisModel`. |

### C.2 Correctifs appliqués le 2026-10-11 — deuxième série (vérification mobile ↔ back)

| # | Statut | Problème | Correctif |
|---|---|---|---|
| 8 | ✅ DONE | Réclamation « colis endommagé » : le mobile envoyait `endommage`, le back attend `endommagé` → 500. Les photos partaient sans type (`application/octet-stream`) et étaient refusées. | Mobile : valeur `endommagé`, `Content-Type` explicite sur chaque photo. Back : `endommage` accepté et converti, type inconnu → 400. |
| 9 | ✅ DONE | `type_colis` (la nature : « Vêtement ») était lu comme mode de transport par l’étiquette, le ZPL et le suivi : tous les colis s’affichaient « MARITIME ». Le mode de transport n’était enregistré nulle part. | Colonne `colis.type_transport`, renseignée depuis `shippingType`. La migration `20261011130000-add-type-transport-to-colis.js` reprend les anciens colis quand `type_colis` contenait le transport. Étiquette, ZPL et suivi l’utilisent (`utils/typeTransport.js`) et le mobile l’affiche. L’historique du suivi est trié par date. |
| 10 | ✅ DONE | Mobile : rafraîchissement du jeton non mutualisé (déconnexion avec la rotation des refresh tokens), et boucle sur `/auth/refresh` en cas de 401. | Une seule requête de rafraîchissement, partagée et envoyée par un client sans intercepteur. Renouvellement préventif d’un jeton expiré. Session effacée seulement si le serveur refuse le refresh token, avec retour à l’écran de connexion. |
| 11 | ✅ DONE | Mobile : au démarrage, un jeton d’accès expiré (1 h) renvoyait à la connexion malgré un refresh token valide (7 jours). | Le démarrage appelle `GET /account/me`, qui renouvelle le jeton. Seules les réponses 401, 403 et 404 renvoient à la connexion. |
| 12 | ✅ DONE | Le mobile proposait l’avis et la réclamation au destinataire, alors que le back les réservait à l’expéditeur → 403. | Réclamation ouverte à l’expéditeur **et** au destinataire (back). Avis réservé à l’expéditeur, bouton masqué côté destinataire (mobile). |
| 13 | ✅ DONE | Mobile : les statuts de réclamation `resolue`, `rejetee` et `ouverte` s’affichaient « En attente ». | Libellés alignés sur les valeurs du back. |
| 14 | ✅ DONE | Mobile : un poids hors grille affichait quand même un prix ; le back refusait l’envoi et l’app affichait un message générique. | Contrôle de la plage de poids dès la saisie ; le message du back est affiché en cas d’échec. |
| 15 | ✅ DONE | Mobile : le bandeau d’avis réapparaissait à chaque ouverture d’un colis livré (deuxième envoi → 409), et le bouton « Envoyer » ne fermait jamais la fenêtre. | Vérification via `GET /avis`, réponse 409 traitée comme « déjà noté », bouton branché sur le bon traitement. |
| 16 | ✅ DONE | Mot de passe : 6 caractères acceptés à la réinitialisation (back) et au changement (mobile), et le détail de l’erreur n’était pas affiché. | Back : même règle partout (8 caractères, majuscule, minuscule, chiffre). Mobile : règle de l’inscription appliquée au changement, détail (`details`) affiché. |
| 17 | ✅ DONE | Le retour de paiement `nanei://paiement/...` n’était déclaré ni sur Android ni sur iOS, et l’app ne le gérait pas. | Schéma déclaré sur les deux plateformes, service `LiensEntrantsService` (paquet `app_links`). |
| 18 | ✅ DONE | Mobile : la facture était téléchargée par un client Dio séparé, sans renouvellement du jeton (échec après 1 h). | Client réseau commun. |
| 19 | ✅ DONE | Mobile : aucun écran pour la photo de profil. Back : les erreurs d’upload répondaient 500. | Choix de la photo depuis l’avatar et envoi multipart. Back : WEBP accepté pour le profil, type refusé → 400, fichier trop gros → 413. |
| 20 | ✅ DONE | Connexion par téléphone : la comparaison était exacte, donc `76000000` était refusé pour un compte `+22376000000`. | Recherche tolérante (voir `POST /auth/login`), refus en cas d’ambiguïté. |

### C.3 Incohérences internes au back

État vérifié à la relecture du 2026-10-12.

| # | Constat |
|---|---|
| 21 | ✅ **Résolu (#33)** pour `adresse` (vide par défaut). Reste : `telephone` facultatif pour Joi mais exigé par le service (400 « Le numéro de téléphone est obligatoire »). |
| 22 | ✅ **Résolu (#30)** : `passwordChangedAt` mis à jour et refresh tokens révoqués au changement et à la réinitialisation. |
| 23 | ⏳ Toujours vrai : pas d’enveloppe de réponse commune ni de code d’erreur stable (voir §0) ; les identifiants invalides répondent 400 et non 401. |
| 24 | ✅ **Résolu (#31)** : compteurs séparés (connexion 5, renouvellement 30, mots de passe 5). |
| 25 | ✅ **Résolu (#34)**, à confirmer avec un vrai webhook : signature vérifiée sur le corps brut (`req.rawBody`). |
| 26 | ⏳ Toujours vrai : back 8 caractères avec majuscule, minuscule et chiffre ; mobile 12 caractères avec symbole (`lib/core/utils/security_validators.dart:69-74`). Compatible, mais le formulaire mobile refuse un mot de passe qui respecte seulement la règle du back. |

### C.4 Points de sécurité restants

| # | Gravité | Constat |
|---|---|---|
| 27 | ~~Moyenne~~ | ✅ **Résolu (#32)** : `GET /client/rechercher-client` n’accepte plus qu’un e-mail complet ou un numéro, renvoie un seul compte et masque e-mail et téléphone. |

### C.4 bis Correctifs du 2026-10-11 issus de la vérification de l’admin

| # | Statut | Problème | Correctif |
|---|---|---|---|
| 28 | ✅ DONE | `DELETE /nanei/account` répondait toujours 500. | Réécrite en anonymisation (voir §2). |
| 29 | ✅ DONE | Un client désactivé par un admin pouvait être repris par une nouvelle inscription avec son e-mail ou son téléphone (le compte était réactivé avec le nouveau mot de passe). | Seuls les comptes destinataires automatiques (`utilisateur.compte_auto`) sont revendiqués à l’inscription. |
| 30 | ✅ DONE | Changement et réinitialisation du mot de passe : les autres sessions restaient valides (point 22 de C.3). | Sessions révoquées ; `change-password` renvoie de nouveaux jetons, enregistrés par le mobile. `/auth/refresh` refuse un compte désactivé. |
| 31 | ✅ DONE | `/auth/refresh` partageait la limite de 5 / 15 min avec la connexion (point 24 de C.3). | Compteurs séparés : connexion 5, renouvellement 30, mots de passe 5 (par 15 min et par IP). |

### C.4 ter Correctifs du 2026-10-12

| # | Statut | Problème | Correctif |
|---|---|---|---|
| 32 | ✅ DONE | `rechercher-client` exposait e-mail et téléphone de tout compte actif (point 27 de C.4). | Identifiant exact, un résultat, données masquées (voir §4). |
| 33 | ✅ DONE | Inscription sans `adresse` → 500 (point 21 de C.3). | Adresse vide par défaut. |
| 34 | ✅ DONE (à confirmer avec un vrai webhook) | Signature des webhooks sur un corps reconstruit (point 25 de C.3). | Corps brut ; format Wave `t=…,v1=…`. |
| 35 | ✅ DONE | « Compte inactif » révélait l’existence d’un compte. | Mot de passe vérifié d’abord. |
| 36 | ✅ DONE | Aucune liste paginée. | Pagination facultative (§0) ; boutons Précédent / Suivant dans l’app. |
| 37 | ✅ DONE | Erreurs 500 avec détail technique. | Filtre global des réponses d’erreur. |
| 38 | ✅ DONE | Type des photos (profil, réclamation) contrôlé sur la déclaration seulement. | Contenu vérifié (PNG, JPEG, WEBP, PDF). |

### C.4 quater Pagination dans l’application (2026-10-12)

Paramètres et champs ajoutés aux listes du client (toujours facultatifs, voir « Pagination des listes », §0) :

| Route | Clé | Filtre | Champs ajoutés à la réponse |
|---|---|---|---|
| `GET /client/colis-envoyes`, `GET /client/colis-recus` | `data` | `statut` (`en_attente`, `recupere`, `livre` ; autre → 400), appliqué avant la pagination | `par_statut: { en_attente, recupere, livre, total }` (toutes pages, sans filtre) |
| `GET /paiements` | `data` | `statut` (`en_attente`, `en_cours`, `paye`, `echoue`, `rembourse` ; autre → 400) | `par_statut: { en_attente, en_cours, paye, echoue, rembourse, total }` |
| `GET /client/mes-notifications` | `data` | — | `non_lues` (total des non lues) |
| `GET /reclamations`, `GET /avis`, `GET /contacts` | `reclamations`, `avis`, `contacts` | `GET /contacts` : `q` | — |

Écrans paginés (20 par page, barre « Précédent » / « Suivant » / « Page X sur Y » en fin de liste, `lib/core/widgets/barre_pagination.dart`, `lib/core/utils/pagination.dart`) : Mes colis (Reçus, Envoyés), Suivi (Tous, Envoyés, Reçus), Notifications, Mes paiements, Mes réclamations, Mes contacts, Mes avis. Les filtres par statut passent au serveur, les compteurs viennent de `par_statut`, le badge des notifications de `non_lues`.

Laissés sans pagination, volontairement : sélecteur de pays, `GET /avis` dans le détail d’un colis (savoir s’il est déjà noté), liste des colis du formulaire de réclamation (sélecteur).

### C.4 quinquies Correctifs issus des suites de tests (2026-10-12)

| # | Statut | Problème | Correctif |
|---|---|---|---|
| 39 | ✅ DONE | `GET /paiements` renvoyait au client `webhookPayload` (charge brute de l’opérateur) et transformait un `montantPaye` absent en `0`. | `webhookPayload` retiré ; `null` conservé. |
| 40 | ✅ DONE | `PUT /account/modifier-profil` lisait un champ `carte_identite_national_num` inexistant (ni colonne ni schéma). | Retiré du contrôleur. |
| 41 | ✅ DONE | Contacts : champ `pays` à l’écriture, `pays_id` à la lecture. | `pays_id` accepté à l’écriture (`pays` toujours toléré). |
| 42 | ✅ DONE | Recherche de destinataire : seuil de 5 caractères pour un numéro, alors que la connexion en exige 7 chiffres. | 7 chiffres minimum pour un numéro. |

Suites de tests (2026-10-12) : back **678 tests** (Jest + Supertest, `src/__tests__/`, exécutés par le CI avant tout déploiement), admin **166 tests** (Vitest), mobile **272 tests** (`flutter test`, exécutés par le CI avant toute publication).

### C.6 Relecture complète du 2026-10-12 — écarts mobile ↔ back

**Couverture.** 45 routes montées hors `/nanei/admin` (+ `GET /health`), dont 2 webhooks hors périmètre : **43 routes** dans le périmètre, toutes documentées. L’application implémente **42 appels** (tous existent côté back, méthode et chemin justes) ; `GET /paiements/retour` est appelée par le navigateur, `GET /health` par personne côté mobile. Deux appels sont implémentés dans la couche données mais déclenchés par **aucun écran** : `PUT /contacts/:id` (`lib/features/contacts/data/datasources/contact_remote_datasource.dart:48`) et `GET /reclamations/:id` (`lib/features/reclamations/data/datasources/reclamation_remote_datasource.dart:67`).

**Corrections apportées au contrat à cette relecture** (le code n’a pas changé, seul le document était faux ou incomplet) :

| Route | Ce qui était faux |
|---|---|
| `GET /client/colis-envoyes`, `GET /client/colis-recus` | Décrites « sans pagination » : `page`, `limit`, `statut`, `par_statut` et `pagination` manquaient dans la section. |
| `GET /client/mes-notifications` | Exemple sans `non_lues` ni `pagination`. |
| `GET /paiements` | Exemple avec `webhookPayload` (retiré, #39) et `montantPaye: 0` (c’est `null`) ; `statut`, `par_statut`, `pagination` absents de la section. |
| `GET /avis`, `GET /reclamations`, `GET /contacts` | Pagination (et `q` pour les contacts) absente des sections. |
| `POST /avis`, `GET /colis/:colisId/preuve` | `updatedAt` annoncé alors que les modèles ont `updatedAt: false`. |
| `POST /auth/register` | « Adresse absente → 500 » (corrigé par #33). |
| `PUT /account/modifier-profil` | « `telephone: ""` accepté (ignoré) » : c’est 400 « Le numéro de téléphone est obligatoire » pour un client. |
| `POST /contacts` | Champ `pays` seulement : `pays_id` est accepté (#41). |
| `POST /auth/refresh`, `POST /auth/reset-password`, `POST /client/envoie-colis`, `GET /client/rechercher-client`, `POST /pricing/calculate`, `POST /reclamations` | Messages d’erreur manquants (session expirée, blocage en cours, destination / prix / compte admin, recherche impossible, poids ≤ 0, trop de photos, contenu de fichier non reconnu). |
| Erreurs 500 (plusieurs routes) | `{ message, erreur }` / `error` annoncés : ces champs sont retirés de toute réponse ≥ 500. |
| Sommaire | §6 comptait 2 routes au lieu de 3. |

**Écarts mobile ↔ back restants** (aucun ne casse un appel) :

| # | Gravité | Écart | Côté mobile |
|---|---|---|---|
| 43 | Faible | Le champ Téléphone du formulaire « Modifier le profil » n’est pas obligatoire ; s’il est vidé, le back répond 400 « Le numéro de téléphone est obligatoire » (message affiché par l’app). | `lib/features/home/presentation/pages/client/profils_page.dart:1078` (champ sans `required`), `:1033` (envoi) |
| 44 | Faible | Réinitialisation du mot de passe : l’app bloque localement après **5** échecs, le back bloque déjà après **3** (« Trop de tentatives. Réessayez dans 15 minutes. »). Les deux messages peuvent se succéder. | `lib/features/auth/presentation/pages/reset_password_page.dart:35` |
| 45 | Info | Règles de mot de passe différentes (voir #26). | `lib/core/utils/security_validators.dart:69-74` |
| 46 | Info | Le modèle de contact sérialise encore le pays sous `pays` (toléré par le back) ; l’écran d’ajout n’envoie aucun pays. | `lib/features/contacts/data/models/contact_favori_model.dart:34`, `lib/features/contacts/presentation/pages/ajouter_contact_page.dart:36-42` |
| 47 | Info | L’envoi de colis transmet encore `prix` et `destination`, ignorés par le back dès que `countryId` et `shippingType` sont présents (toujours le cas dans l’app). | `lib/features/home/data/datasources/colis_remote_datasource.dart:132-133`, `lib/features/home/domain/usecases/envoyer_colis_lot.dart:16-17` |
| 48 | Info | ⚠️ À vérifier : la clé de date des lignes d’historique du suivi (`created_at`, demandée explicitement dans les `attributes` d’un modèle `underscored`) ; le mobile ne lit que `created_at`. (Pour les notifications, le mobile lit la date de la notification elle-même, `createdAt` puis `created_at` : pas d’écart.) | `lib/features/home/data/models/suivi_public_model.dart:57` |

### C.5 Déploiement

1. Back : les migrations (`photo_profil` sur l’utilisateur, `type_transport` sur le colis) sont exécutées **automatiquement** par le CI/CD à chaque push sur `main` (`deploy/release.sh`), après une sauvegarde de la base et **avant** le redémarrage du backend. Sans elles, toute lecture d’un utilisateur ou d’un colis échouerait ; si elles échouent, l’ancienne version reste en ligne.
2. Mobile : `flutter pub get` (nouvelle dépendance `app_links`).
3. Garder `PRIX_SERVEUR_OBLIGATOIRE` différent de `true` tant que des versions antérieures à 1.0.2+13 sont en circulation.
