const axios = require('axios');
const logger = require('../../config/logger');

class WaveService {
  static get apiUrl()  { return process.env.WAVE_API_URL  || 'https://api.wave.com/v1'; }
  static get apiKey()  { return process.env.WAVE_API_KEY  || ''; }

  /**
   * Crée une session de paiement Wave et retourne le checkout_url.
   * @param {object} opts
   * @param {number}  opts.montant       - Montant en XOF (ex: 5000)
   * @param {string}  opts.reference     - Référence interne (ex: PAY-uuid)
   * @param {string}  opts.successUrl    - URL de succès (deep link)
   * @param {string}  opts.errorUrl      - URL d'erreur (deep link)
   */
  static async initierPaiement({ montant, reference, successUrl, errorUrl }) {
    if (!this.apiKey) {
      throw new Error('WAVE_API_KEY manquant dans .env');
    }

    const t0 = Date.now();
    const response = await axios.post(
      `${this.apiUrl}/checkout/sessions`,
      {
        amount:           String(Math.round(montant)),
        currency:         'XOF',
        client_reference: reference,
        success_url:      successUrl,
        error_url:        errorUrl,
      },
      {
        headers: {
          Authorization:  `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    logger.info('Wave API appel initierPaiement', { url: `${this.apiUrl}/checkout/sessions`, status: response.status, duration_ms: Date.now() - t0, reference });
    const data = response.data;
    return {
      checkoutUrl:        data.wave_launch_url || data.launch_url,
      referenceSession:   data.id,
    };
  }

  /**
   * Vérifie le statut d'une session Wave.
   */
  static async verifierStatut(sessionId) {
    const response = await axios.get(
      `${this.apiUrl}/checkout/sessions/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      }
    );
    // checkout_status: 'processing' | 'complete' | 'error'
    return response.data;
  }
}

module.exports = WaveService;
