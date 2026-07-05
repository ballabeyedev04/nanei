# 🚀 Nanei API — Guide de Déploiement

Ce guide couvre le déploiement complet de l'API Nanei en production.

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

# Exécuter le script de déploiement
bash deploy/deploy.sh

# OU déployer manuellement :
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend npm run migrate
```

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
# Doit retourner : {"status":"OK"}
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

### Exécuter les migrations manuellement

```bash
cd /var/www/nanei-api
docker compose -f docker-compose.prod.yml exec -T backend npm run migrate
```

### Sauvegarder la base de données

```bash
cd /var/www/nanei-api
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump \
  -U ${DB_USER} ${DB_NAME} > backups/nanei_$(date +%Y%m%d_%H%M%S).sql
```

### Nettoyer les vieux conteneurs/images

```bash
# Supprimer les images non utilisées
docker image prune -a --force

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

Le fichier `.github/workflows/deploy.yml` autorise les déploiements automatiques :

1. **Prérequis** : Ajouter les secrets GitHub dans votre repository
   - `VPS_HOST` : IP du VPS
   - `VPS_USER` : utilisateur SSH (ex: root)
   - `VPS_SSH_KEY` : clé privée SSH

2. **Déploiement automatique** :
   - À chaque push sur `main`, le workflow s'exécute
   - Code mis à jour, conteneurs reconstruits, migrations exécutées
   - Vérification de santé avant de valider

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
