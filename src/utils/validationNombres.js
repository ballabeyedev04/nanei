/**
 * Contrôle des valeurs numériques saisies dans les grilles tarifaires (admin).
 *
 * `champs` : liste de [libellé, valeur, { strict }]. Une valeur absente
 * (undefined / null) est ignorée (mise à jour partielle). Sinon elle doit être
 * un nombre fini : `strict` → strictement positif, sinon positif ou nul.
 * Chaînes vides, « 4,75 », « abc », booléens et tableaux sont refusés : avant,
 * des valeurs tronquées, négatives ou comparées comme des CHAÎNES
 * (« 10 » < « 9 ») étaient enregistrées et faussaient le prix facturé.
 *
 * Renvoie le message d'erreur du premier champ invalide, ou null.
 */
function erreurNombres(champs) {
  for (const [libelle, valeur, { strict = false } = {}] of champs) {
    if (valeur === undefined || valeur === null) continue;
    const accepte = typeof valeur === 'number' || (typeof valeur === 'string' && valeur.trim() !== '');
    const n = accepte ? Number(valeur) : NaN;
    if (!Number.isFinite(n) || (strict ? n <= 0 : n < 0)) {
      return `${libelle} : nombre ${strict ? 'strictement positif' : 'positif ou nul'} attendu`;
    }
  }
  return null;
}

module.exports = { erreurNombres };
