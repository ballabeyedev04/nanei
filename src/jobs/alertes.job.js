/**
 * Job d'alertes quotidien — 8h00 chaque jour.
 * Cherche les colis en statut "en_attente" créés il y a plus de 3 jours
 * et envoie un email récapitulatif à l'administrateur.
 */
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Colis, Utilisateur } = require('../models');
const { sendEmail } = require('../services/resend.service');
const logger = require('../config/logger');
const { echapperHtml } = require('../utils/echapperHtml');

/**
 * Envoie à l'admin la liste des colis en attente depuis plus de 3 jours.
 * Renvoie le nombre de colis signalés (0 si aucun e-mail envoyé).
 */
async function verifierColisEnAttente() {
  logger.info('[Job Alertes] Démarrage vérification colis en attente');

  try {
    const seuilDate = new Date();
    seuilDate.setDate(seuilDate.getDate() - 3);

    const colis = await Colis.findAll({
      where: {
        statut: 'en_attente',
        created_at: { [Op.lte]: seuilDate },
      },
      include: [
        { model: Utilisateur, as: 'expediteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
      order: [['created_at', 'ASC']],
    });

    if (colis.length === 0) {
      logger.info('[Job Alertes] Aucun colis en attente depuis plus de 3 jours');
      return 0;
    }

    const adminEmail = process.env.EMAIL_ADMIN;
    if (!adminEmail) {
      logger.warn('[Job Alertes] EMAIL_ADMIN non défini — email non envoyé');
      return 0;
    }

    const lignes = colis.map((c) => {
      // Nom et destination saisis par le client : échappés (e-mail HTML).
      const exp = c.expediteur ? echapperHtml(`${c.expediteur.prenom} ${c.expediteur.nom}`) : '—';
      // Attribut Sequelize `createdAt` (colonne created_at, modèle underscored) :
      // `c.created_at` valait toujours undefined → « — » dans chaque ligne.
      const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—';
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;">${echapperHtml(c.reference)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;">${exp}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;">${echapperHtml(c.destination)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;">${date}</td>
      </tr>`;
    }).join('');

    const html = `
      <h2 style="color:#FF7A00;">Alerte — Colis en attente depuis plus de 3 jours</h2>
      <p>${colis.length} colis nécessitent votre attention :</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#FF7A00;color:white;">
            <th style="padding:8px 10px;text-align:left;">Référence</th>
            <th style="padding:8px 10px;text-align:left;">Expéditeur</th>
            <th style="padding:8px 10px;text-align:left;">Destination</th>
            <th style="padding:8px 10px;text-align:left;">Date création</th>
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
      <p style="margin-top:16px;color:#888;font-size:12px;">Généré automatiquement par Nanei · FrancoMaliShip</p>
    `;

    await sendEmail({
      to: adminEmail,
      subject: `[Nanei] ${colis.length} colis en attente depuis plus de 3 jours`,
      html,
    });

    logger.info('[Job Alertes] Email envoyé', { nb_colis: colis.length });
    return colis.length;
  } catch (err) {
    logger.error('[Job Alertes] Erreur', { error: err.message, stack: err.stack });
    return 0;
  }
}

cron.schedule('0 8 * * *', verifierColisEnAttente);

logger.info('[Job Alertes] Planifié — tous les jours à 8h00');

module.exports = { verifierColisEnAttente };
