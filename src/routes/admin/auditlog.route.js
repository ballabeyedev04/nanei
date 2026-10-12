const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { motifRecherche } = require('../../utils/pagination');
const AuditLog = require('../../models/auditlog.model');
const Utilisateur = require('../../models/utilisateur.model');
const logger = require('../../config/logger');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

// GET /nanei/admin/audit-logs?page=1&limit=20&action=...&entite=...&admin_id=...
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      entite,
      admin_id,
      date_debut,
      date_fin,
    } = req.query;

    // Pagination bornée : valeurs invalides → valeurs par défaut (avant : 500).
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;
    const where = {};

    // Correspondance partielle et sans casse : « update » trouve UPDATE_STATUT
    // (avant : égalité stricte, une saisie partielle ne trouvait rien).
    const motifAction = motifRecherche(action);
    if (motifAction) where.action = { [Op.iLike]: motifAction };
    if (entite) where.entite = entite;
    if (admin_id) where.admin_id = admin_id;

    // Dates AAAA-MM-JJ (champ date de l'admin). La date de fin est INCLUSE :
    // on prend jusqu'au début du jour suivant (avant, « 2026-10-11 » valait
    // minuit et excluait toute la journée choisie).
    const debutJour = (v) => {
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const debut = date_debut ? debutJour(String(date_debut)) : null;
    let finExclue = null;
    if (date_fin) {
      const f = debutJour(String(date_fin));
      if (f && /^\d{4}-\d{2}-\d{2}$/.test(String(date_fin))) f.setDate(f.getDate() + 1);
      finExclue = f;
    }
    if ((date_debut && !debut) || (date_fin && !finExclue)) {
      return res.status(400).json({ success: false, message: 'Date invalide (format AAAA-MM-JJ)' });
    }
    if (debut || finExclue) {
      where.created_at = {};
      if (debut) where.created_at[Op.gte] = debut;
      if (finExclue) where.created_at[Op.lt] = finExclue;
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        { model: Utilisateur, as: 'admin', attributes: ['nom', 'prenom', 'email'] },
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset,
    });

    return res.status(200).json({
      success: true,
      total: count,
      page: pageNum,
      pages: Math.max(1, Math.ceil(count / limitNum)),
      // Même forme que les autres listes paginées
      pagination: { page: pageNum, limit: limitNum, total: count, pages: Math.max(1, Math.ceil(count / limitNum)) },
      logs: rows,
    });
  } catch (err) {
    logger.error('AuditLog erreur liste', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
