/**
 * Pagination FACULTATIVE des listes (admin et mobile).
 *
 * - Requête avec `page` et/ou `limit` → liste paginée, et la réponse contient
 *   `pagination: { page, limit, total, pages }`.
 * - Requête sans ces paramètres → liste complète, comme avant : les versions
 *   de l'app mobile déjà installées continuent de fonctionner.
 *
 * `limit` : 20 par défaut, 100 maximum.
 */
const LIMITE_DEFAUT = 20;
const LIMITE_MAX = 100;

function lirePagination(query = {}, { defaut = LIMITE_DEFAUT, max = LIMITE_MAX } = {}) {
  if (query.page === undefined && query.limit === undefined) return null;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || defaut));
  return { page, limit, offset: (page - 1) * limit };
}

function metaPagination(p, total) {
  return { page: p.page, limit: p.limit, total, pages: Math.max(1, Math.ceil(total / p.limit)) };
}

/**
 * findAll ou findAndCountAll selon la pagination demandée.
 * Renvoie { lignes, pagination } (pagination = null si non demandée).
 */
async function paginer(Modele, options, query, reglages) {
  const p = lirePagination(query, reglages);
  if (!p) return { lignes: await Modele.findAll(options), pagination: null };
  const { count, rows } = await Modele.findAndCountAll({
    ...options,
    limit: p.limit,
    offset: p.offset,
    distinct: true, // compte juste malgré les include
  });
  return { lignes: rows, pagination: metaPagination(p, count) };
}

/** Pagination d'un tableau déjà en mémoire (ex. fichiers de rapports). */
function paginerTableau(tableau, query, reglages) {
  const p = lirePagination(query, reglages);
  if (!p) return { lignes: tableau, pagination: null };
  return { lignes: tableau.slice(p.offset, p.offset + p.limit), pagination: metaPagination(p, tableau.length) };
}

/** Texte de recherche `q` nettoyé (null si vide), prêt pour un ILIKE. */
function motifRecherche(q) {
  const t = String(q ?? '').trim().slice(0, 100);
  if (!t) return null;
  // `%`, `_` et `\` saisis sont des caractères LITTÉRAUX : on les préfixe de
  // l'échappement par défaut de Postgres (`\`). Avant, `\${c}` (échappement
  // du `$` dans le gabarit) remplaçait « 50% » par « 50${c} » : la recherche
  // ne trouvait plus rien.
  return `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Ajoute `pagination` à un corps de réponse seulement si elle a été demandée. */
const avecPagination = (corps, pagination) => (pagination ? { ...corps, pagination } : corps);

module.exports = { lirePagination, metaPagination, paginer, paginerTableau, motifRecherche, avecPagination, LIMITE_DEFAUT, LIMITE_MAX };

/**
 * Middleware : pagine la réponse JSON d'une route qui renvoie un tableau sous
 * la clé `cle` (petites tables : pays, tarifs, taux, rapports). Sans `page` ni
 * `limit` dans la requête, la réponse est inchangée.
 */
function paginerReponse(cle = 'data', reglages) {
  return (req, res, next) => {
    const p = lirePagination(req.query, reglages);
    if (!p) return next();
    const json = res.json.bind(res);
    res.json = (corps) => {
      if (res.statusCode < 400 && corps && Array.isArray(corps[cle])) {
        const total = corps[cle].length;
        return json({ ...corps, [cle]: corps[cle].slice(p.offset, p.offset + p.limit), pagination: metaPagination(p, total) });
      }
      return json(corps);
    };
    return next();
  };
}

module.exports.paginerReponse = paginerReponse;
