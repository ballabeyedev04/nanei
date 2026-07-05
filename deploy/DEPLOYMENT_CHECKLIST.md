# ✅ Nanei API — Checklist de Prélancement

Utilise cette checklist pour vérifier que tout est prêt avant de lancer en production.

## 🔒 Sécurité

- [ ] **Fichier .env** : existe et contient tous les secrets (DB_PASSWORD, JWT_SECRET, etc.)
- [ ] **Fichier .env.example** : mis à jour avec les nouvelles variables (sans secrets)
- [ ] **.env dans .gitignore** : vérifier que .env n'est jamais commité
- [ ] **Secrets GitHub** : VPS_HOST, VPS_USER, VPS_SSH_KEY configurés
- [ ] **JWT_SECRET** : généré aléatoirement (>64 caractères)
- [ ] **JWT_REFRESH_SECRET** : différent de JWT_SECRET
- [ ] **DB_PASSWORD** : mot de passe fort (>20 caractères, caractères spéciaux)
- [ ] **WAVE_WEBHOOK_SECRET** : configuré et sécurisé
- [ ] **ORANGE_MONEY_WEBHOOK_SECRET** : configuré et sécurisé
- [ ] **CORS_ORIGIN** : domaine correct, PAS de wildcard "*"
- [ ] **Certificats SSL** : Let's Encrypt configuré pour le domaine
- [ ] **Firewall UFW** : activé, ports 22/80/443 autorisés seulement

## 🗄️ Base de Données

- [ ] **PostgreSQL 16** : version compatible avec Sequelize
- [ ] **Migration** : `npm run migrate` passe sans erreur
- [ ] **Seed** : données initiales créées (admin user, etc.)
- [ ] **Extensions** : uuid-ossp, pgcrypto activées
- [ ] **Sauvegardes** : script de backup en place (cron job)
- [ ] **Permissions** : dossier /var/www/nanei-api/backups accessible

## 🐳 Docker & Déploiement

- [ ] **Dockerfile** : multi-stage build, USER non-root, HEALTHCHECK présent
- [ ] **.dockerignore** : remplissage correct (node_modules, .env, etc.)
- [ ] **docker-compose.prod.yml** : produits DB + backend, volumes montés
- [ ] **docker-compose.yml** : dev config pour local testing
- [ ] **Images Docker** : construites sans erreurs
- [ ] **Répertoires** : /var/www/nanei-api/{uploads,logs} créés

## 🚀 API & Code

- [ ] **Routes** : `/health` fonctionne et retourne `{"status":"OK"}`
- [ ] **IDOR fix** : vérifier que URL parameters n'exposent pas d'IDs utilisateur
- [ ] **Webhooks** : signature HMAC validée (Wave, Orange Money)
- [ ] **OTP** : rate-limiting actif (3 tentatives → 15min blocage)
- [ ] **Paiements** : validation montants (100 XOF - 10M XOF)
- [ ] **RGPD** : suppression compte = hard delete (pas d'anonymisation)
- [ ] **Token encryption** : codes OTP hashés avec bcrypt
- [ ] **DECIMAL** : montants en DECIMAL(10,2), pas FLOAT
- [ ] **Dépendances** : pas de doublons (bcrypt vs bcryptjs)
- [ ] **Logs** : Winston configuré, dossier /var/www/nanei-api/logs accessible

## 🌐 Nginx & Reverse Proxy

- [ ] **Configuration Nginx** : /etc/nginx/sites-available/nanei en place
- [ ] **Site activé** : lien symbolique vers sites-enabled
- [ ] **Test Nginx** : `sudo nginx -t` pas d'erreurs
- [ ] **Proxy** : reverse proxy vers 127.0.0.1:3000
- [ ] **HTTPS** : redirection HTTP→HTTPS active
- [ ] **Headers** : X-Forwarded-* configurés pour Express
- [ ] **WebSocket** : support activé (Upgrade, Connection headers)
- [ ] **Gzip** : compression active
- [ ] **SSL protocols** : TLSv1.2 + TLSv1.3 seulement

## 📧 Email & Notifications

- [ ] **Resend API** : clé configurée dans .env
- [ ] **Email SMTP** : (si Resend non utilisé) SMTP_HOST/PORT/USER/PASS
- [ ] **Adresse FROM** : domaine autorisé pour Resend / SPF records
- [ ] **Firebase FCM** : serviceAccount JSON configuré (si notifications push)
- [ ] **Twilio** : ACCOUNT_SID, AUTH_TOKEN, PHONE_NUMBER (si SMS)

## 💳 Paiements

- [ ] **Wave API** : API_KEY et MERCHANT_ID configurés
- [ ] **Orange Money** : API_KEY et MERCHANT_ID configurés
- [ ] **Webhook URLs** : correctement pointées vers le domaine production
- [ ] **Validation montants** : middleware actif sur routes de paiement
- [ ] **DECIMAL columns** : prixTotal et montantPaye en DECIMAL(10,2)

## 📊 Monitoring & Logs

- [ ] **Winston** : logs d'erreur enregistrés dans /var/www/nanei-api/logs/
- [ ] **PM2** : (optionnel) ecosystem.config.js configuré pour cluster
- [ ] **Logs Docker** : `docker compose -f docker-compose.prod.yml logs` fonctionne
- [ ] **Healthcheck Docker** : endpoint /health répond en <10s
- [ ] **Log rotation** : anciens logs nettoyés régulièrement

## 🔄 CI/CD & Déploiement Automatique

- [ ] **GitHub Actions** : `.github/workflows/deploy.yml` en place
- [ ] **Secrets GitHub** : VPS_HOST, VPS_USER, VPS_SSH_KEY configurés
- [ ] **SSH Key** : clé privée stockée comme GitHub secret
- [ ] **Test local** : `docker compose up` passe sans erreur
- [ ] **Script deploy** : `bash deploy/deploy.sh` fonctionne en local

## 🧪 Tests d'Acceptation

- [ ] **Inscription** : nouvel utilisateur peut s'inscrire
- [ ] **Connexion** : utilisateur peut se connecter et reçoit JWT
- [ ] **Refresh token** : refresh du JWT fonctionne
- [ ] **IDOR fix** : impossible de modifier un autre compte par URL
- [ ] **OTP** : réinitialisation password avec OTP hashé fonctionne
- [ ] **Webhooks** : signature HMAC validée, requêtes sans signature rejetées
- [ ] **Paiements** : montants < 100 ou > 10M XOF sont rejetés
- [ ] **Suppression compte** : hard delete, données complètement supprimées
- [ ] **Healthcheck** : curl https://api.nanei.com/health retourne 200

## 📋 Documentation & Connaissances

- [ ] **README déploiement** : deploy/README.md mis à jour
- [ ] **Environ vars** : .env.example documenter toutes les variables
- [ ] **Git History** : commits clairs et descriptifs
- [ ] **Team onboarding** : instructions de setup local pour les devs
- [ ] **Incident runbook** : procédures pour les problèmes courants

## ✨ Optimisations Finales

- [ ] **Image Docker** : taille < 250MB (multi-stage build)
- [ ] **DB indexes** : index sur les colonnes fréquemment filtrées
- [ ] **Rate-limiting** : activé sur les routes sensibles (login, OTP, etc.)
- [ ] **CORS** : restrictif (domaine spécifique, pas wildcard)
- [ ] **Request logging** : logs structurés (JSON) pour machine-readable monitoring

---

## ⏰ Checklist Post-Déploiement

Une fois déployé, vérifier les points suivants toutes les 24h :

- [ ] Tous les conteneurs tournent : `docker compose ps`
- [ ] Logs d'erreur : aucune nouvelle erreur depuis 24h
- [ ] Performance API : temps de réponse < 500ms (median)
- [ ] DB health : pas de timeout, connexions stables
- [ ] Webhooks : Wave/Orange Money reçus avec succès
- [ ] Sauvegardes : dernier backup réussi < 24h
- [ ] Certificat SSL : expires > 30 jours
- [ ] Updates système : patches critiques appliqués

---

**Date de validation** : ___________

**Responsable** : ___________

**Notes** :
