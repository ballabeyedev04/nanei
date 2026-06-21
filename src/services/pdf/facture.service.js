const puppeteer = require('puppeteer');
const { factureHtml } = require('../../pdf/facture.template');
const Paiement = require('../../models/paiement.model');
const { Colis, Utilisateur } = require('../../models');

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date(date));
}

function buildNumero(paiement) {
  const year  = new Date(paiement.created_at || paiement.createdAt || Date.now()).getFullYear();
  const short = paiement.id.slice(0, 8).toUpperCase();
  return `FCT-${year}-${short}`;
}

class FactureService {
  /**
   * Génère le Buffer PDF de la facture d'un paiement.
   * @param {string} paiementId
   * @returns {{ buffer: Buffer, filename: string }}
   */
  static async generer(paiementId) {
    const paiement = await Paiement.findByPk(paiementId, {
      include: [
        {
          model: Colis,
          as: 'colis',
          attributes: ['reference', 'poids', 'destination', 'type_colis'],
        },
        {
          model: Utilisateur,
          as: 'payeur',
          attributes: ['nom', 'prenom', 'email', 'telephone'],
        },
      ],
    });

    if (!paiement) throw new Error('Paiement introuvable');
    if (paiement.statut !== 'paye') throw new Error('La facture est disponible uniquement pour les paiements validés');

    const colis  = paiement.colis  || {};
    const payeur = paiement.payeur || {};

    const data = {
      factureNumero:  buildNumero(paiement),
      dateEmission:   formatDate(paiement.createdAt || paiement.created_at),
      dateReglement:  formatDate(paiement.updatedAt || paiement.updated_at),
      // Colis
      colisReference: colis.reference  || paiement.colisId.slice(0, 8).toUpperCase(),
      destination:    colis.destination || '—',
      poids:          (Number(colis.poids) || 0).toFixed(1),
      typeColis:      colis.type_colis  || 'Standard',
      // Payeur
      payeurPrenom:   payeur.prenom   || '',
      payeurNom:      payeur.nom      || '',
      payeurEmail:    payeur.email    || '',
      payeurTelephone: payeur.telephone || '',
      // Paiement
      prixTotal:      paiement.prixTotal   || 0,
      montantPaye:    paiement.montantPaye || 0,
      moyenPaiement:  paiement.moyenPaiement || null,
    };

    const html = factureHtml(data);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);

      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      const filename = `facture-${data.factureNumero}-${data.colisReference}.pdf`;
      return { buffer, filename };
    } finally {
      await browser.close();
    }
  }
}

module.exports = FactureService;
