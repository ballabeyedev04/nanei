const { Op } = require('sequelize');
const { Colis, Utilisateur } = require('../../models');
// Paiement n'est pas exporté par models/index.js : import direct (sinon
// chaque export des paiements finissait en 500).
const Paiement = require('../../models/paiement.model');
const logger = require('../../config/logger');

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Date AAAA-MM-JJ (champ date de l'admin) → début du jour, heure locale du serveur. */
function lireDate(v) {
  if (!v) return null;
  const d = new Date(JOUR.test(String(v)) ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Filtre de dates ; la date de fin est INCLUSE (jusqu'au début du jour suivant). */
function buildDateWhere(date_debut, date_fin) {
  const debut = lireDate(date_debut);
  const fin = lireDate(date_fin);
  if (debut === undefined || fin === undefined) {
    const err = new Error('Date invalide (format AAAA-MM-JJ)');
    err.status = 400;
    throw err;
  }
  const where = {};
  if (debut || fin) {
    where.created_at = {};
    if (debut) where.created_at[Op.gte] = debut;
    if (fin) {
      if (JOUR.test(String(date_fin))) fin.setDate(fin.getDate() + 1);
      where.created_at[Op.lt] = fin;
    }
  }
  return where;
}

const STATUTS_COLIS = ['en_attente', 'recupere', 'livre'];
const STATUTS_PAIEMENT = ['en_attente', 'en_cours', 'paye', 'echoue', 'rembourse'];

/**
 * Neutralise les formules dans les cellules (injection CSV / Excel) : une
 * valeur saisie par un client qui commence par = + - @ (ou tabulation /
 * retour chariot) serait exécutée par Excel à l'ouverture. On la préfixe
 * d'une apostrophe. Les nombres restent des nombres.
 */
function cellule(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
const ligneSure = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cellule(v)]));
const nombre = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));

function erreurExport(res, err, nom, req) {
  if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
  logger.error(`Erreur dans ${nom}`, { error: err.message, stack: err.stack, user_id: req.user?.id });
  return res.status(500).json({ success: false, message: 'Erreur export' });
}

// ── EXPORT COLIS ─────────────────────────────────────────────────────────────
exports.exportColis = async (req, res) => {
  try {
    const { format = 'csv', statut, date_debut, date_fin } = req.query;

    const where = buildDateWhere(date_debut, date_fin);
    if (statut) {
      if (!STATUTS_COLIS.includes(statut)) {
        return res.status(400).json({ success: false, message: `Statut invalide (${STATUTS_COLIS.join(', ')})` });
      }
      where.statut = statut;
    }

    const colis = await Colis.findAll({
      where,
      include: [
        { model: Utilisateur, as: 'expediteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
        { model: Utilisateur, as: 'recepteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows = colis.map((c) => ligneSure({
      reference: c.reference,
      statut: c.statut,
      destination: c.destination,
      poids: nombre(c.poids),
      prix_eur: nombre(c.prix),
      type_transport: c.type_transport || '',
      type_colis: c.type_colis || '',
      expediteur_nom: c.expediteur ? `${c.expediteur.prenom} ${c.expediteur.nom}` : '',
      expediteur_email: c.expediteur?.email || '',
      expediteur_telephone: c.expediteur?.telephone || '',
      recepteur_nom: c.recepteur ? `${c.recepteur.prenom} ${c.recepteur.nom}` : '',
      recepteur_email: c.recepteur?.email || '',
      recepteur_telephone: c.recepteur?.telephone || '',
      // Attribut Sequelize `createdAt` (colonne created_at) : `c.created_at`
      // était toujours vide.
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : '',
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
      reference: '', statut: '', destination: '', poids: '', prix_eur: '', type_transport: '', type_colis: '',
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
    return erreurExport(res, err, 'exportColis', req);
  }
};

// ── EXPORT PAIEMENTS ──────────────────────────────────────────────────────────
exports.exportPaiements = async (req, res) => {
  try {
    const { format = 'csv', statut, date_debut, date_fin } = req.query;

    const where = buildDateWhere(date_debut, date_fin);
    if (statut) {
      if (!STATUTS_PAIEMENT.includes(statut)) {
        return res.status(400).json({ success: false, message: `Statut invalide (${STATUTS_PAIEMENT.join(', ')})` });
      }
      where.statut = statut;
    }

    const paiements = await Paiement.findAll({
      where,
      include: [
        { model: Colis, as: 'colis', attributes: ['reference', 'destination'] },
        { model: Utilisateur, as: 'payeur', attributes: ['nom', 'prenom', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows = paiements.map((p) => ligneSure({
      id: p.id,
      colis_reference: p.colis?.reference || '',
      destination: p.colis?.destination || '',
      payeur: p.payeur ? `${p.payeur.prenom} ${p.payeur.nom}` : '',
      payeur_email: p.payeur?.email || '',
      prix_total_eur: nombre(p.prixTotal),
      montant_paye_eur: nombre(p.montantPaye),
      moyen_paiement: p.moyenPaiement || '',
      statut: p.statut,
      reference_transaction: p.referenceTransaction || '',
      created_at: p.createdAt ? new Date(p.createdAt).toISOString() : '',
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
      prix_total_eur: '', montant_paye_eur: '', moyen_paiement: '', statut: '',
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
    return erreurExport(res, err, 'exportPaiements', req);
  }
};
