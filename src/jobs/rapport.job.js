/**
 * Job de rapport mensuel — le 1er de chaque mois à 6h00.
 * Calcule le CA du mois précédent, génère un PDF et l'envoie par email à l'admin.
 */
const cron = require('node-cron');
const { RAPPORTS_DIR, preparerDossierRapports } = require('../utils/rapportsStockage');
const { echapperHtml } = require('../utils/echapperHtml');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const htmlToPdf = require('../utils/htmlToPdf');
// Paiement n'est pas exporté par models/index.js : import direct (sinon
// Paiement.findAll plantait et aucun rapport ne pouvait être généré).
const Paiement = require('../models/paiement.model');
const { Colis } = require('../models');
const { sendEmail } = require('../services/resend.service');
const logger = require('../config/logger');

// Montants du rapport : en euros (prix des colis), 2 décimales.
const formatEUR = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

async function genererRapportMensuel() {
  // Calcul des dates du mois précédent
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fin = new Date(now.getFullYear(), now.getMonth(), 1);

  const moisLabel = debut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // CA total (paiements complétés)
  const paiements = await Paiement.findAll({
    where: {
      statut: 'paye',
      created_at: { [Op.gte]: debut, [Op.lt]: fin },
    },
    include: [{ model: Colis, as: 'colis', attributes: ['destination'] }],
  });

  // montantPaye est une colonne DECIMAL : Postgres la renvoie en CHAÎNE
  // ("45.50"). Sans conversion, `0 + "45.50" + "12.00"` concaténait les
  // chaînes et le rapport affichait « NaN ». Montants en EUR (prix du colis) ;
  // le montant XOF n'est calculé qu'au moment du débit chez l'opérateur.
  const montant = (p) => {
    const n = Number(p.montantPaye ?? p.prixTotal ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const arrondi = (n) => Math.round(n * 100) / 100;
  const caTotal = arrondi(paiements.reduce((sum, p) => sum + montant(p), 0));
  const nbColis = paiements.length;

  // Regroupement par pays/destination
  const parPays = {};
  paiements.forEach((p) => {
    const dest = p.colis?.destination || 'Inconnu';
    if (!parPays[dest]) parPays[dest] = { nombre: 0, ca: 0 };
    parPays[dest].nombre += 1;
    parPays[dest].ca = arrondi(parPays[dest].ca + montant(p));
  });

  const lignesPays = Object.entries(parPays)
    .sort((a, b) => b[1].ca - a[1].ca)
    .map(([dest, d]) => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #EEE;">${echapperHtml(dest)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #EEE;text-align:center;">${d.nombre}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #EEE;text-align:right;">${formatEUR(d.ca)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Rapport mensuel — ${moisLabel}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:-apple-system,sans-serif;color:#111;font-size:13px;line-height:1.6;background:#F7F7F5; }
  .page { max-width:794px;margin:0 auto;background:white;padding:40px 48px; }
  .top-bar { height:5px;background:#FF7A00;margin-bottom:32px; }
  h1 { font-size:26px;font-weight:900;color:#FF7A00;margin-bottom:4px; }
  .subtitle { color:#888;font-size:14px;margin-bottom:32px; }
  .kpi-row { display:flex;gap:16px;margin-bottom:32px; }
  .kpi { flex:1;background:#FFF4E8;border:1px solid #FFD9A8;border-radius:10px;padding:16px;text-align:center; }
  .kpi-val { font-size:28px;font-weight:900;color:#FF7A00; }
  .kpi-label { font-size:11px;color:#888;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px; }
  .section-title { font-size:11px;font-weight:800;color:#CCC;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px; }
  table { width:100%;border-collapse:collapse;font-size:13px; }
  thead tr { background:#111;color:white; }
  thead th { padding:8px 12px;text-align:left; }
  .footer { margin-top:40px;text-align:center;color:#CCC;font-size:11px; }
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>
  <h1>Rapport mensuel</h1>
  <div class="subtitle">Nanei · FrancoMaliShip — ${moisLabel}</div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-val">${formatEUR(caTotal)}</div>
      <div class="kpi-label">Chiffre d'affaires (EUR)</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${nbColis}</div>
      <div class="kpi-label">Colis payés</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${Object.keys(parPays).length}</div>
      <div class="kpi-label">Destinations</div>
    </div>
  </div>

  <div class="section-title">Répartition par destination</div>
  <table>
    <thead>
      <tr>
        <th>Destination</th>
        <th style="text-align:center;">Nb colis</th>
        <th style="text-align:right;">CA</th>
      </tr>
    </thead>
    <tbody>
      ${lignesPays || '<tr><td colspan="3" style="padding:12px;color:#AAA;text-align:center;">Aucune donnée</td></tr>'}
    </tbody>
  </table>

  <div class="footer">Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')} — © 2026 Nanei</div>
</div>
</body>
</html>`;

  // Générer le PDF
  const buffer = await htmlToPdf(html, {
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  // Sauvegarder le fichier
  // Dossier privé (jamais servi en statique) — voir utils/rapportsStockage.js
  preparerDossierRapports();
  const rapportsDir = RAPPORTS_DIR;

  const filename = `rapport-${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}.pdf`;
  const filePath = path.join(rapportsDir, filename);
  fs.writeFileSync(filePath, buffer);

  return { buffer, filename, moisLabel, caTotal, nbColis };
}

cron.schedule('0 6 1 * *', async () => {
  logger.info('[Job Rapport] Démarrage génération rapport mensuel');

  try {
    const { filename, moisLabel, caTotal, nbColis } = await genererRapportMensuel();

    const adminEmail = process.env.EMAIL_ADMIN;
    if (!adminEmail) {
      logger.warn('[Job Rapport] EMAIL_ADMIN non défini — email non envoyé, fichier sauvegardé');
      return;
    }

    await sendEmail({
      to: adminEmail,
      subject: `[Nanei] Rapport mensuel — ${moisLabel}`,
      html: `
        <h2 style="color:#FF7A00;">Rapport mensuel — ${moisLabel}</h2>
        <p>Le rapport du mois de <strong>${moisLabel}</strong> est disponible.</p>
        <ul>
          <li>CA total : <strong>${formatEUR(caTotal)}</strong></li>
          <li>Nombre de colis : <strong>${nbColis}</strong></li>
        </ul>
        <p>Le fichier PDF est disponible dans l'interface d'administration.</p>
        <p style="color:#888;font-size:12px;">Généré automatiquement par Nanei · FrancoMaliShip</p>
      `,
    });

    logger.info('[Job Rapport] Rapport généré et email envoyé', { filename, ca_total: caTotal, nb_colis: nbColis });
  } catch (err) {
    logger.error('[Job Rapport] Erreur génération rapport', { error: err.message, stack: err.stack });
  }
});

logger.info('[Job Rapport] Planifié — le 1er de chaque mois à 6h00');

module.exports = { genererRapportMensuel };
