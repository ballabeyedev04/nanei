# Packages à installer

Exécuter dans le répertoire `backend-app/` :

```bash
npm install firebase-admin twilio node-cron xlsx
```

## Description des packages

| Package | Usage |
|---|---|
| `firebase-admin` | Push notifications FCM via `src/config/firebase.js` et `src/services/notification.service.js` |
| `twilio` | SMS via `src/services/twilio.service.js` (optionnel — le projet utilise Orange SMS par défaut) |
| `node-cron` | Jobs planifiés : `src/jobs/alertes.job.js` (quotidien 8h) et `src/jobs/rapport.job.js` (mensuel) |
| `xlsx` | Export Excel dans `src/controllers/admin/export.controller.js` |

## Variables d'environnement à ajouter dans `.env`

```env
# Email admin (pour les alertes et rapports)
EMAIL_ADMIN=admin@votredomaine.com

# Nodemailer (email.service.js — optionnel si Resend suffit)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=motdepasse
EMAIL_FROM=Nanei <noreply@nanei.app>
```
