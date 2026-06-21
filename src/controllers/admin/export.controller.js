const { Op } = require('sequelize');
const { Colis, Paiement, Utilisateur } = require('../../models');
const logger = require('../../config/logger');

function buildDateWhere(date_debut, date_fin) {
  const where = {};
  if (date_debut || date_fin) {
    where.created_at = {};
    if (date_debut) where.created_at[Op.gte] = new Date(date_debut);
    if (date_fin) where.created_at[Op.lte] = new Date(date_fin);
  }
  return where;
}

// ── EXPORT COLIS ─────────────────────────────────────────────────────────────
exports.exportColis = async (req, res) => {
  try {
    const { format = 'csv', statut, date_debut, date_fin } = req.query;

    const where = buildDateWhere(date_debut, date_fin);
    if (statut) where.statut = statut;

    const colis = await Colis.findAll({
      where,
      include: [
        { model: Utilisateur, as: 'expediteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
        { model: Utilisateur, as: 'recepteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows = colis.map((c) => ({
      reference: c.reference,
      statut: c.statut,
      destination: c.destination,
      poids: c.poids,
      prix: c.prix,
      type_colis: c.type_colis || '',
      expediteur_nom: c.expediteur ? `${c.expediteur.prenom} ${c.expediteur.nom}` : '',
      expediteur_email: c.expediteur?.email || '',
      expediteur_telephone: c.expediteur?.telephone || '',
      recepteur_nom: c.recepteur ? `${c.recepteur.prenom} ${c.recepteur.nom}` : '',
      recepteur_email: c.recepteur?.email || '',
      recepteur_telephone: c.recepteur?.telephone || '',
      created_at: c.created_at ? new Date(c.created_at).toISOString() : '',
    }));

    if (format === 'xlsx') {
      const xlsx = require('xlsx');
      const ws = xlsx.utils.json_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Colis');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=colis-export.xlsx');
      return res.end(buffer);
    }

    // CSV
    const headers = Object.keys(rows[0] || {
      reference: '', statut: '', destination: '', poids: '', prix: '', type_colis: '',
      expediteur_nom: '', expediteur_email: '', expediteur_telephone: '',
      recepteur_nom: '', recepteur_email: '', recepteur_telephone: '', created_at: '',
    });

    const csvLines = [
      headers.join(';'),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=colis-export.csv');
    return res.send('﻿' + csvLines.join('\n')); // BOM pour Excel
  } catch (err) {
    logger.error('Erreur dans exportColis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur export' });
  }
};

// ── EXPORT PAIEMENTS ──────────────────────────────────────────────────────────
exports.exportPaiements = async (req, res) => {
  try {
    const { format = 'csv', statut, date_debut, date_fin } = req.query;

    const where = buildDateWhere(date_debut, date_fin);
    if (statut) where.statut = statut;

    const paiements = await Paiement.findAll({
      where,
      include: [
        { model: Colis, as: 'colis', attributes: ['reference', 'destination'] },
        { model: Utilisateur, as: 'payeur', attributes: ['nom', 'prenom', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows = paiements.map((p) => ({
      id: p.id,
      colis_reference: p.colis?.reference || '',
      destination: p.colis?.destination || '',
      payeur: p.payeur ? `${p.payeur.prenom} ${p.payeur.nom}` : '',
      payeur_email: p.payeur?.email || '',
      prix_total: p.prixTotal,
      montant_paye: p.montantPaye,
      moyen_paiement: p.moyenPaiement || '',
      statut: p.statut,
      reference_transaction: p.referenceTransaction || '',
      created_at: p.created_at ? new Date(p.created_at).toISOString() : '',
    }));

    if (format === 'xlsx') {
      const xlsx = require('xlsx');
      const ws = xlsx.utils.json_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Paiements');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=paiements-export.xlsx');
      return res.end(buffer);
    }

    const headers = Object.keys(rows[0] || {
      id: '', colis_reference: '', destination: '', payeur: '', payeur_email: '',
      prix_total: '', montant_paye: '', moyen_paiement: '', statut: '',
      reference_transaction: '', created_at: '',
    });

    const csvLines = [
      headers.join(';'),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=paiements-export.csv');
    return res.send('﻿' + csvLines.join('\n'));
  } catch (err) {
    logger.error('Erreur dans exportPaiements', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur export' });
  }
};
