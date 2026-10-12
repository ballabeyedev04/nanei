/**
 * Code HTTP d'un résultat de service en échec ({ success: false, … }).
 *  - `status` explicite → utilisé tel quel ;
 *  - message « … non trouvé » / « introuvable » → 404 (avant, souvent 400) ;
 *  - champ `error` (exception base de données attrapée par le service) → 500
 *    (avant, 400 ou 404 selon les routes) ;
 *  - sinon le code par défaut de la route (400 en général : données refusées).
 */
function statutEchec(result, defaut = 400) {
  if (result && Number.isInteger(result.status)) return result.status;
  if (result && /non trouvée?|introuvable/i.test(String(result.message || ''))) return 404;
  if (result && result.error) return 500;
  return defaut;
}

module.exports = { statutEchec };
