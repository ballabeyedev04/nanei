const logger = require('../config/logger');

/**
 * Filtre global des réponses d'erreur : aucun détail technique (SQL, pile,
 * noms de tables ou de contraintes, chemins) ne doit sortir vers le client.
 *
 * Beaucoup de contrôleurs renvoient `error: error.message` (ou `erreur`, ou
 * le message brut comme `message`). Plutôt que de les corriger un par un, on
 * nettoie ici toutes les réponses JSON de code >= 400 :
 *  - >= 500 : champs `error` / `erreur` retirés, message technique remplacé
 *    par « Erreur serveur » (le détail est journalisé) ;
 *  - 4xx : `error` / `erreur` / `message` conservés sauf s'ils ressemblent à
 *    une erreur technique (ils restent utiles : « Type de fichier non
 *    autorisé », « Cet email est déjà utilisé »…).
 */
// Ligne de pile : « …/fichier.js:42:13 », avec ou sans nom de fonction (avant :
// seul « at fichier.js:42 » était reconnu, pas « at Object.<anonymous> (…) »).
const TECHNIQUE = /sequelize|postgres|\bsql\b|relation "|column "|violates|constraint|duplicate key|syntax error|null value in|invalid input syntax|\.js:\d+|node_modules|TypeError|ReferenceError|Cannot read propert|is not a function|is not defined|\bundefined\b/i;
// Codes d'erreur système : SENSIBLES à la casse et en mot entier. Avant, ils
// étaient dans l'expression insensible à la casse : « reconnecter » contient
// « econn », et le message « Session expirée suite à un changement de mot de
// passe. Veuillez vous reconnecter. » devenait « Requête invalide ».
const CODES_SYSTEME = /\bE(?:CONN[A-Z]+|TIMEDOUT|NOTFOUND|AI_AGAIN|PIPE)\b/;

const estTechnique = (v) => typeof v === 'string' && (TECHNIQUE.test(v) || CODES_SYSTEME.test(v));

function filtrerReponsesErreur(req, res, next) {
  const json = res.json.bind(res);
  res.json = (corps) => {
    const code = res.statusCode;
    if (code < 400 || !corps || typeof corps !== 'object' || Array.isArray(corps)) return json(corps);

    const propre = { ...corps };
    const details = {};
    for (const cle of ['error', 'erreur']) {
      if (cle in propre && (code >= 500 || estTechnique(propre[cle]))) {
        details[cle] = propre[cle];
        delete propre[cle];
      }
    }
    if (estTechnique(propre.message)) {
      details.message = propre.message;
      propre.message = code >= 500 ? 'Erreur serveur' : 'Requête invalide';
    }
    if (Object.keys(details).length) {
      logger.warn('Détail technique retiré d\'une réponse d\'erreur', {
        status: code, path: req.originalUrl, method: req.method, ...details,
      });
    }
    return json(propre);
  };
  next();
}

module.exports = filtrerReponsesErreur;
module.exports.estTechnique = estTechnique;
