const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
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

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (action) where.action = action;
    if (entite) where.entite = entite;
    if (admin_id) where.admin_id = admin_id;

    if (date_debut || date_fin) {
      where.created_at = {};
      if (date_debut) where.created_at[Op.gte] = new Date(date_debut);
      if (date_fin) where.created_at[Op.lte] = new Date(date_fin);
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        { model: Utilisateur, as: 'admin', attributes: ['nom', 'prenom', 'email'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    return res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page, 10),
      pages: Math.ceil(count / parseInt(limit, 10)),
      logs: rows,
    });
  } catch (err) {
    logger.error('AuditLog erreur liste', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
