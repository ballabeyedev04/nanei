'use strict';

/**
 * Versions exposées par GET /health.
 *
 * ── API_VERSION : version du CONTRAT d'API (entier) ─────────────────────────
 * Lue par l'admin (et à terme par le mobile) sur https://<domaine-api>/health :
 * l'admin REFUSE de se déployer si `api` est inférieur à sa constante
 * minimale. C'est ce qui empêche de mettre en ligne un admin qui appelle des
 * routes que le back en service ne connaît pas encore.
 *
 * Règle (à appliquer dans le même commit que la modification) :
 *   • on INCRÉMENTE API_VERSION quand une modification du back CASSE ou
 *     ÉTEND de façon nécessaire le contrat dont dépendent l'admin ou le
 *     mobile : route supprimée ou renommée, champ de réponse retiré ou
 *     renommé, champ de requête devenu obligatoire, sens d'un champ ou d'un
 *     code HTTP changé, nouvelle route dont une nouvelle version de l'admin
 *     a besoin pour fonctionner ;
 *   • on NE la change PAS pour un ajout purement facultatif (nouveau champ
 *     de réponse ignoré par les anciens clients, correctif interne) ;
 *   • on ne la DÉCRÉMENTE jamais ;
 *   • puis on met à jour CONTRAT-API-ADMIN.md / CONTRAT-API-MOBILE.md, et la
 *     constante minimale côté admin quand l'admin dépend du changement.
 *
 * ── VERSION : commit du code en service ─────────────────────────────────────
 * Injectée à la construction de l'image Docker (ARG/ENV GIT_SHA, voir
 * Dockerfile et .github/workflows/deploy.yml) : le déploiement vérifie que
 * /health renvoie bien le commit attendu. « dev » hors image (poste local,
 * tests).
 */
const API_VERSION = 2;

const VERSION = (process.env.GIT_SHA || '').trim() || 'dev';

module.exports = { API_VERSION, VERSION };
