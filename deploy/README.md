# 🚀 Nanei API — Guide de Déploiement

Ce guide couvre le déploiement de l'API Nanei en production :

- **Partie A — la chaîne de déploiement** (GitHub Actions → GHCR → VPS) : ce
  qui se passe à chaque `git push origin main`, la configuration à faire une
  seule fois, le retour arrière, la restauration de la base, le dépannage.
- **Partie B — installation du serveur** (première mise en place du VPS).

---

# Partie A — Chaîne de déploiement

## A.1 Vue d'ensemble

Fichiers : `.github/workflows/deploy.yml` (déploiement),
`.github/workflows/rollback.yml` (retour arrière manuel), `deploy/ci-distant.sh`
(partie serveur, envoyée par SSH), `deploy/release.sh` (mise en service sur le
serveur), `scripts/ci/*.sh` (outils du CI).

```
 1. Contrôles d'entrée ─┬─ 2a. Analyse (ESLint) ──────────────┐
                        ├─ 2b. Tests unitaires ───────────────┤
                        ├─ 2c. Intégration (PostgreSQL 16) ───┼─ 3. Image Docker : construction & contrôle
                        └─ 2d. Sécurité ──────────────────────┘            │
                                                        4. Test de démarrage de CETTE image
                                                                            │
                                                        5a. Vérification du serveur (rien n'est modifié)
                                                                            │
                                   5b. ✋ Approbation → mise en service (retour arrière automatique)
                                                                            │
                                                                       6. Bilan
```

| Étape | Ce qui est vérifié | Bloquant |
|---|---|:---:|
| **1 · Contrôles d'entrée** | le commit est sur `main` ; mode (déploiement / essai à blanc) ; nom de l'image ; migrations nouvelles depuis le dernier déploiement (alerte si une migration déjà déployée a été modifiée) ; l'environnement `production` exige bien une approbation (alerte sinon) | oui |
| **2a · Analyse** | `npm run lint` (ESLint, `eslint.config.js`) : variables non définies, imports absents (`n/no-missing-require`), dépendance de dev utilisée par le code de production (`n/no-unpublished-require`), code mort… | oui |
| **2b · Tests unitaires** | `npm test` (Jest) | oui |
| **2c · Intégration** | service `postgres:16-alpine` (même version que la prod) : `npm run test:migrations` (migrations sur base **vide**, puis plus rien en attente, puis chaque colonne des modèles existe) et le parcours complet `src/__tests__/integration` ; des tests « sautés » comptent comme un échec | oui |
| **2d · Sécurité** | Gitleaks (secrets dans le code, exceptions justifiées dans `.gitleaks.toml`) ; `npm audit --omit=dev --audit-level=high` ; OSV-Scanner sur `package-lock.json` (avertissement seulement) | oui (sauf OSV) |
| **3 · Image Docker** | construite **une seule fois** à partir du commit testé, avec `GIT_SHA=<sha>`, poussée sur `ghcr.io/<owner>/<repo>/nanei-api:<sha>` ; contrôlée : étiquette de commit, `GIT_SHA`, utilisateur `node`, Node 22, pas de `.env` / `.git` / tests / outils de dev, dépendances de prod complètes, modules natifs chargés | oui |
| **4 · Test de démarrage** | CETTE image (par son empreinte) + PostgreSQL 16 vierge, configuration de production : migrations (puis second passage sans rien à faire), démarrage, `GET /health` = 200 avec `db: ok` et la bonne `version`, route publique 200, routes protégées sans jeton 401, route inconnue 404, connexion réelle de l'admin créé au démarrage, HEALTHCHECK Docker `healthy`, aucun redémarrage | oui |
| **5a · Vérification du serveur** | par SSH, **sans rien modifier** : outils présents (docker, compose v2, git, flock, curl), `.env` présent, aucun fichier **suivi** modifié sur le serveur, accès à GHCR depuis le serveur (l'image est tirée), commit récupérable, 2 Go libres | oui |
| **5b · Mise en service** | **approbation** (environnement `production`), puis sur le serveur : voir A.2 ; vérification publique `<API_URL>/health` ; tag `back-vAAAA.MM.JJ-HHMM-<sha7>` + Release GitHub | — |
| **6 · Bilan** | tableau de toutes les étapes, toujours affiché (même en échec / retour arrière) | — |

Chaque étape écrit son résultat dans le **résumé** de l'exécution (onglet
Actions > l'exécution > Summary).

- **Déployer** : `git push origin main`.
- **Essai à blanc** : Actions > « Back — déploiement VPS » > *Run workflow*
  (case « Essai à blanc » cochée par défaut). Tout est construit, testé, le
  serveur est vérifié (5a) ; **rien n'est mis en service** (5b sautée). L'image
  est tout de même poussée sur GHCR (elle pourra servir telle quelle).
- **Un seul déploiement à la fois** : `concurrency: back-production` (partagé
  avec le retour arrière, jamais annulé en cours), plus un verrou `flock` sur
  le serveur (`/var/www/nanei-api/.deploy/release.lock`) qui protège aussi des
  lancements manuels simultanés.

## A.2 Sur le serveur : la mise en service (`deploy/release.sh`)

Envoyé par SSH (`scripts/ci/ssh-distant.sh` → `deploy/ci-distant.sh`), c'est
toujours la version **testée** des scripts qui s'exécute.

1. **Verrou** (un seul déploiement à la fois).
2. **Fichiers de déploiement au commit EXACT** testé : `git fetch origin <sha>`
   puis `git checkout --detach <sha>` (plus de `git pull origin main`, qui
   prenait ce qui était sur main à cet instant, testé ou non). Refus si des
   fichiers **suivis** ont été modifiés sur le serveur ; `.env`, `backups/`,
   `.deploy/` et les fichiers non suivis sont conservés.
3. **Connexion à GHCR** avec le jeton `GITHUB_TOKEN` du job (valable le temps du
   job, transmis sur l'entrée standard, jamais écrit dans la ligne de
   commande), `docker logout` à la fin quoi qu'il arrive.
4. **Version en service relevée** (`.deploy/version-courante`) ; si elle est
   inconnue (premier déploiement par cette chaîne), l'image du conteneur en
   service est figée sous `nanei-api:avant-<date>` pour pouvoir y revenir.
5. **Image tirée** par son sha et contrôlée (étiquette de commit). Le serveur ne
   construit plus rien.
6. **Sauvegarde** de la base : `backups/pre-deploy_<date>_<sha7>.sql.gz`
   (5 dernières gardées).
7. **Migrations** avec la NOUVELLE image, dans un conteneur temporaire. Échec →
   arrêt, l'ancienne version n'a pas été touchée.
8. **Redémarrage** du backend sur la nouvelle image.
9. **Vérification** de `http://localhost:4000/health` : 200, `db: "ok"` ET
   `version` = sha déployé (120 s max).
10. **Succès** → `.deploy/version-courante` et `.deploy/historique.log` mis à
    jour, `nanei-api:latest` pointe sur la version en service, anciennes images
    nettoyées (**5 dernières gardées** pour les retours arrière).
11. **Échec** → **retour arrière automatique** : l'image PRÉCÉDENTE est remise
    en service et revérifiée, le job échoue avec un message clair (résumé :
    « RETOUR ARRIÈRE AUTOMATIQUE effectué »). Si la précédente ne répond pas
    non plus : « BACKEND HORS SERVICE », intervention manuelle (A.7).

**La base n'est JAMAIS restaurée automatiquement** : entre la migration et le
retour arrière, des données ont pu être écrites. Le chemin de la sauvegarde et
la commande exacte de restauration sont affichés dans le journal (voir A.6).

## A.3 Règles pour le code

### Migrations : toujours rétrocompatibles

Après un retour arrière (automatique ou manuel), l'**ancien** code tourne sur le
schéma **migré**. Une migration doit donc laisser la version précédente
fonctionner :

- ✅ ajouter : table, colonne **nullable ou avec valeur par défaut**, index ;
- ❌ dans la même version que le code qui cesse de s'en servir : supprimer ou
  renommer une colonne / table, rendre une colonne obligatoire, changer un type ;
- suppression ou renommage = **en deux déploiements** : la version N n'utilise
  plus l'ancien élément, la version N+1 — une fois N validée en production — le
  supprime ;
- une migration déjà déployée ne se modifie plus (elle ne serait pas rejouée en
  production) : en écrire une nouvelle. Les migrations doivent être
  idempotentes (vérifier l'existence avant d'ajouter), comme les existantes ;
- sur une base **vide**, la migration de référence (`…-baseline.js`) crée le
  schéma à partir des modèles : `npm run migrate` fonctionne aussi pour une
  nouvelle installation (vérifié à chaque déploiement, étapes 2c et 4).

### Contrat d'API : `GET /health` et `API_VERSION`

`GET /health` (public, hors `/nanei`) :

```
200 { "status": "OK", "db": "ok", "version": "<sha du commit | dev>", "api": 2 }
503 { "status": "KO", "db": "erreur" }
```

- La base est réellement interrogée (`sequelize.authenticate()`, 3 s max) ;
  aucune information technique n'est renvoyée.
- `version` vient de `GIT_SHA`, injecté à la construction de l'image (`ARG`/`ENV`
  du `Dockerfile`) ; `dev` hors image.
- `api` = `API_VERSION` (`src/config/version.js`) : **version entière du contrat
  d'API**. L'admin la lit sur `https://<domaine-api>/health` et **refuse de se
  déployer** si `api` est inférieur à sa constante minimale.
- **Règle** : incrémenter `API_VERSION` dans le même commit qu'une modification
  qui casse ou étend de façon nécessaire le contrat de l'admin ou du mobile
  (route supprimée / renommée, champ de réponse retiré / renommé, champ de
  requête devenu obligatoire, sens d'un champ ou d'un code changé, nouvelle
  route dont une nouvelle version de l'admin a besoin). Jamais pour un ajout
  facultatif ; jamais à la baisse. Mettre à jour `CONTRAT-API-ADMIN.md` /
  `CONTRAT-API-MOBILE.md`, puis la constante minimale côté admin.
- Ordre de déploiement quand l'admin dépend d'un changement : **back d'abord**
  (`api` augmente), admin ensuite (sa garde le vérifie).

### Vérifier en local avant de pousser

```bash
npm run lint                     # ESLint (étape 2a)
npm test                         # tests unitaires (étape 2b)
npm run test:integration:local   # vrai PostgreSQL 16 sans Docker (embedded-postgres) :
                                 # migrations sur base vide + parcours complet (étape 2c)
```

## A.4 Configuration à faire UNE FOIS

### Sur GitHub

1. **Environnement `production` avec relecteurs requis** — *Settings >
   Environments > New environment* : `production`, cocher **Required
   reviewers** et ajouter la ou les personnes qui approuvent les mises en
   service ; *Deployment branches and tags* : **Selected branches** → `main`.
   ⚠️ À faire **avant** le premier déploiement : sans cela, GitHub crée
   l'environnement sans protection et la mise en service part sans
   approbation (l'étape 1 affiche alors un avertissement).
2. **Secrets** (*Settings > Secrets and variables > Actions > Secrets*) :

   | Secret | Rôle | |
   |---|---|---|
   | `VPS_HOST` | adresse du VPS | existant |
   | `VPS_USER` | utilisateur SSH (membre du groupe `docker`, propriétaire de `/var/www/nanei-api`) | existant |
   | `VPS_SSH_KEY` | clé privée SSH de déploiement | existant |
   | `VPS_KNOWN_HOSTS` | empreinte du serveur (sortie de `ssh-keyscan -p <port> <hôte>`, à comparer à `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` sur le serveur) — sans lui, l'identité du serveur n'est pas vérifiée (avertissement) | **nouveau, recommandé** |
   | `VPS_PORT` | port SSH s'il n'est pas 22 | nouveau, facultatif |

   Aucun jeton GHCR à créer : le `GITHUB_TOKEN` du job suffit (droits
   `packages: write` pour pousser, `packages: read` pour que le serveur tire).
   Les secrets SSH sont utilisés aussi par l'étape 5a (sans approbation) :
   les laisser au niveau du dépôt.
3. **Variable** (*… > Variables*) : `API_URL` = `https://<domaine-api>` (sans
   `/nanei`), pour la vérification publique après mise en service et le lien
   de l'environnement. Facultative (vérification sautée avec un avertissement).
4. **Paquet GHCR** : il est créé au premier passage de l'étape 3
   (`ghcr.io/<owner>/<repo>/nanei-api`). Le laisser **privé**. Vérifier dans
   *Packages > nanei-api > Package settings > Manage Actions access* que ce
   dépôt y figure avec le rôle **Write** (normalement automatique pour un
   paquet poussé par le workflow du dépôt). Conseillé : une règle de
   rétention des anciennes versions du paquet (les retours arrière n'ont
   besoin que des dernières).
5. **Actions** : *Settings > Actions > General > Workflow permissions* peut
   rester sur « Read repository contents » : chaque job déclare ses droits.

### Sur le serveur (une fois, en SSH)

```bash
cd /var/www/nanei-api
# 1. Outils : docker compose v2, flock (util-linux), curl, gzip
docker compose version && flock --version && curl --version | head -1
# 2. Aucun fichier SUIVI modifié localement (sinon la chaîne refuse de déployer)
git status --short --untracked-files=no      # doit être vide
#    (modification légitime → la reporter dans le dépôt ; sinon : git checkout -- <fichier>)
#    (seulement des droits d'exécution changés → git config core.fileMode false)
# 3. Le dépôt peut récupérer un commit précis (accès à GitHub déjà utilisé par l'ancien git pull)
git fetch origin main
# 4. Nginx : l'upstream doit pointer sur 127.0.0.1:4000 et « location = /health »
#    transmettre X-Forwarded-For (voir deploy/nginx.conf)
sudo nginx -t && grep -n "server 127.0.0.1" /etc/nginx/sites-available/nanei
```

Rien d'autre : pas de `docker login` permanent (la chaîne se connecte et se
déconnecte à chaque déploiement). Le premier déploiement fige l'image
actuellement en service sous `nanei-api:avant-<date>` : un retour arrière
automatique vers elle reste possible.

**Premier passage conseillé** : un **essai à blanc** (A.1). Il valide l'image,
l'accès SSH, l'accès du serveur à GHCR et l'état du dépôt du serveur, sans rien
modifier.

## A.5 Retour arrière manuel (revenir sur une version précédente)

Actions > **« Back — retour arrière »** > *Run workflow* :

- **version** : sha (complet ou abrégé) ou tag `back-v…` d'une version déjà
  déployée (onglet *Releases*) ;
- **motif** : texte libre (affiché dans le résumé).

Le workflow vérifie que la version est sur `main` et que son image existe sur
GHCR, liste les migrations postérieures (qui **restent appliquées**), attend
l'**approbation** (environnement `production`), puis lance sur le serveur
`deploy/release.sh retour <image> <sha>` : **ni sauvegarde, ni migration, ni
changement des fichiers du serveur**, même vérification `/health` et même filet
(si la version demandée ne répond pas, celle qui était en service est remise).
Fonctionne après au moins un déploiement par cette chaîne.

Sans GitHub (en SSH, image déjà présente sur le serveur ou GHCR accessible) :

```bash
cd /var/www/nanei-api
cat .deploy/historique.log                    # versions déployées
docker image ls | grep nanei-api              # images disponibles localement
bash deploy/release.sh retour ghcr.io/<owner>/<repo>/nanei-api:<sha> <sha>
```

## A.6 Restaurer la base (manuel, en dernier recours)

Jamais automatique. À ne faire que si les données doivent revenir à l'état
d'avant un déploiement : toute écriture faite depuis est **perdue**. Les
sauvegardes de déploiement sont dans `/var/www/nanei-api/backups/pre-deploy_*.sql.gz`
(le chemin exact est dans le résumé et le journal du déploiement) ; les
sauvegardes quotidiennes viennent de `deploy/backup-postgres.sh`.

```bash
cd /var/www/nanei-api
DB_USER=$(grep -E '^DB_USER=' .env | cut -d= -f2-) ; DB_NAME=$(grep -E '^DB_NAME=' .env | cut -d= -f2-)
SAUVEGARDE=backups/pre-deploy_AAAAMMJJ_HHMMSS_<sha7>.sql.gz

# 0. Sauvegarder l'état actuel, au cas où
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > backups/avant-restauration_$(date +%Y%m%d_%H%M%S).sql.gz
# 1. Arrêter le backend
docker compose -f docker-compose.prod.yml stop backend
# 2. Recréer la base vide
docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE \"$DB_NAME\" WITH (FORCE)" -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""
# 3. Recharger la sauvegarde
gunzip -c "$SAUVEGARDE" | docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
# 4. Remettre en service la version qui correspond à ce schéma (A.5), puis
docker compose -f docker-compose.prod.yml start backend
curl -s http://localhost:4000/health
```

## A.7 Dépannage

| Symptôme (résumé de l'exécution) | Cause probable / action |
|---|---|
| 1 · « commit absent de main » | lancement manuel depuis une autre branche : déployer depuis `main` |
| 2a · erreurs ESLint | `npm run lint` en local ; corriger (exception ponctuelle justifiée sur la ligne : `// eslint-disable-next-line <règle> -- <raison>`) |
| 2c · « tests d'intégration sautés » | variables `NANEI_TEST_DB_*` perdues : la base n'a pas été vue, ce n'est pas un succès |
| 2d · npm audit en échec | `npm audit --omit=dev` en local, mettre à jour la dépendance, `npm test` |
| 5a · « fichiers suivis modifiés » | `git status` sur le serveur : reporter la modification dans le dépôt ou l'annuler |
| 5a · « connexion à ghcr.io refusée » / « impossible de tirer » | droits du paquet GHCR (A.4, point 4) |
| retour manuel · « ancienne version de release.sh » | faire d'abord un déploiement normal par la chaîne |
| 5b · « Échec des migrations » | rien n'a été redémarré ; corriger la migration (elle a pu s'appliquer partiellement : vérifier le schéma) ; sauvegarde dans le résumé |
| 5b · « RETOUR ARRIÈRE AUTOMATIQUE effectué » | la nouvelle version ne répondait pas (journaux du backend dans le journal de l'étape) ; la précédente est en service ; la base n'a PAS été restaurée |
| 5b · « BACKEND HORS SERVICE » | en SSH : `docker compose -f docker-compose.prod.yml logs backend --tail=200`, `docker compose -f docker-compose.prod.yml exec -T postgres pg_isready`, puis A.5 ; restauration (A.6) seulement si le schéma est en cause |
| Vérification publique en échec, serveur OK | Nginx : upstream `127.0.0.1:4000`, `location = /health` (deploy/nginx.conf) |

**Déploiement de secours sans GitHub / GHCR** : `bash deploy/deploy.sh` sur le
serveur (met le serveur au dernier commit de `main`, construit l'image sur
place — non testée par le CI —, même filet de sauvegarde / vérification /
retour arrière).

---

# Partie B — Installation du serveur

## 📋 Prérequis

- **VPS** : Contabo / DigitalOcean / Linode (min. 2GB RAM)
- **Système** : Ubuntu 22.04 LTS ou équivalent
- **Logiciels** : Docker, Docker Compose, Git, Nginx, Certbot

## 🔧 Installation sur le VPS

### 1. Préparation du serveur

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Installer Nginx
sudo apt install -y nginx

# Installer Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Installer Git
sudo apt install -y git

# Ajouter votre utilisateur au groupe Docker (pour éviter sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Créer les répertoires de l'application

```bash
# Créer le dossier de l'application
sudo mkdir -p /var/www/nanei-api
cd /var/www/nanei-api

# Cloner le repository
sudo git clone https://github.com/votre-org/nanei-backend.git .

# Donner les permissions
sudo chown -R $USER:$USER /var/www/nanei-api

# Créer les répertoires de données
mkdir -p uploads logs
```

### 3. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier .env avec les vrais secrets
nano .env

# Les variables critiques à remplir :
# - DB_PASSWORD : mot de passe PostgreSQL fort (24+ caractères)
# - JWT_SECRET : hash aléatoire (génération : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
# - JWT_REFRESH_SECRET : autre hash aléatoire
# - RESEND_API_KEY : clé API Resend (ou SMTP_*)
# - WAVE_WEBHOOK_SECRET : secret Wave pour les webhooks
# - ORANGE_MONEY_WEBHOOK_SECRET : secret Orange Money pour les webhooks
# - CORS_ORIGIN : domaine de votre app (https://app.nanei.com)
```

### 4. Lancer le déploiement initial

```bash
# Se placer dans le dossier de l'application
cd /var/www/nanei-api

# Première mise en service : configuration de la Partie A.4, puis un essai
# à blanc et un déploiement depuis GitHub Actions.
# Secours sans GitHub (image construite sur place) :
bash deploy/deploy.sh
```

> Ensuite, tout passe par la chaîne (Partie A) : chaque push sur `main` est
> testé, l'image construite par le CI est tirée par le serveur, la base est
> sauvegardée, les migrations exécutées, `/health` vérifié, avec retour
> arrière automatique en cas d'échec.

### 5. Configurer Nginx + Let's Encrypt

```bash
# Générer un certificat SSL gratuit (Let's Encrypt)
sudo certbot certonly --standalone -d api.nanei.com

# Copier la configuration Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/nanei

# Adapter le domaine dans le fichier
sudo sed -i 's/api\.nanei\.com/api.VOTRE_DOMAINE.com/g' /etc/nginx/sites-available/nanei

# Activer le site
sudo ln -sf /etc/nginx/sites-available/nanei /etc/nginx/sites-enabled/nanei

# Vérifier la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 6. Vérifier le déploiement

```bash
# Vérifier que les conteneurs tournent
docker compose -f docker-compose.prod.yml ps

# Vérifier les logs du backend
docker compose -f docker-compose.prod.yml logs backend -f

# Tester l'API
curl -f https://api.nanei.com/health
# Doit retourner : {"status":"OK","db":"ok","version":"<sha>","api":<entier>}
```

## 📊 Maintenance et Monitoring

### Voir les logs en temps réel

```bash
cd /var/www/nanei-api
docker compose -f docker-compose.prod.yml logs -f backend
```

### Redémarrer l'application

```bash
cd /var/www/nanei-api
docker compose -f docker-compose.prod.yml restart backend
```

### Exécuter les migrations manuellement (normalement inutile : fait par la chaîne)

```bash
cd /var/www/nanei-api
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backend npm run migrate:status
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backend npm run migrate
```

En cas de problème, la sauvegarde prise juste avant la migration est dans
`backups/pre-deploy_<date>_<sha7>.sql.gz` (les 5 dernières sont conservées) ;
restauration : Partie A.6. `nanei-api:latest` désigne toujours l'image en service.

### Sauvegarder la base de données

```bash
cd /var/www/nanei-api
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump \
  -U ${DB_USER} ${DB_NAME} > backups/nanei_$(date +%Y%m%d_%H%M%S).sql
```

### Nettoyer les vieux conteneurs/images

```bash
# ⚠️ PAS de « docker image prune -a » : il supprimerait les images gardées
# pour les retours arrière (deploy/release.sh garde les 5 dernières et
# nettoie le reste à chaque déploiement). Images sans étiquette seulement :
docker image prune --force

# Supprimer les conteneurs arrêtés
docker container prune --force
```

## 🔐 Sécurité

### ✅ Points à vérifier avant production

- [ ] `.env` est dans `.gitignore` et **NE JAMAIS** commité
- [ ] Certificats SSL/TLS activés (Let's Encrypt)
- [ ] Firewall configuré (UFW ou équivalent)
- [ ] SSH : clé privée sécurisée, pas de mot de passe
- [ ] Database : password fort + chiffrement en transit
- [ ] Webhooks : signature HMAC validée côté serveur
- [ ] Rate-limiting activé sur les routes d'authentification
- [ ] Logs centralisés et surveillés
- [ ] Sauvegardes automatiques de la BD (cron job)

### Configurer le firewall (UFW)

```bash
# Activer UFW
sudo ufw enable

# Autoriser SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Vérifier les règles
sudo ufw status
```

### Sauvegardes automatiques (cron)

```bash
# Éditer la crontab
sudo crontab -e

# Ajouter une ligne pour une sauvegarde quotidienne à 2h du matin
0 2 * * * cd /var/www/nanei-api && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $DB_USER $DB_NAME > backups/nanei_$(date +\%Y\%m\%d).sql && find backups -name "*.sql" -mtime +30 -delete

# Vérifier
sudo crontab -l
```

## 🚀 CI/CD avec GitHub Actions

Voir la **Partie A** en tête de ce document (chaîne, secrets, approbation,
retour arrière, restauration).

## 📈 Monitoring et Logs

### Logs Winston (application)
```bash
# Voir les logs en temps réel
tail -f /var/www/nanei-api/logs/error.log
tail -f /var/www/nanei-api/logs/combined.log
```

### Logs Docker
```bash
# Logs du backend
docker compose -f docker-compose.prod.yml logs backend

# Logs de PostgreSQL
docker compose -f docker-compose.prod.yml logs postgres
```

### Logs Nginx
```bash
tail -f /var/log/nginx/nanei-api-access.log
tail -f /var/log/nginx/nanei-api-error.log
```

## ⚠️ Troubleshooting

### "Backend n'est pas healthy"
```bash
# Vérifier les logs
docker compose -f docker-compose.prod.yml logs backend --tail=50

# Vérifier la DB
docker compose -f docker-compose.prod.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

### "Erreur de connexion PostgreSQL"
```bash
# Vérifier que le conteneur PostgreSQL tourne
docker compose -f docker-compose.prod.yml ps

# Redémarrer la DB
docker compose -f docker-compose.prod.yml restart postgres
```

### "Certificat SSL expiré"
```bash
# Renouveler le certificat
sudo certbot renew --force-renewal

# Recharger Nginx
sudo systemctl reload nginx
```

## 📞 Support

Pour toute question, consultez :
- Documentation Docker Compose : https://docs.docker.com/compose/
- Guide PostgreSQL : https://www.postgresql.org/docs/
- Forum Let's Encrypt : https://community.letsencrypt.org/
