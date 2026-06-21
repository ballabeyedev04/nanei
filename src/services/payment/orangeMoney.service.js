const axios = require('axios');
const logger = require('../../config/logger');

class OrangeMoneyService {
  static get apiUrl()      { return process.env.OM_API_URL      || 'https://api.orange.com/orange-money-webpay/sn/v1'; }
  static get oauthUrl()    { return process.env.OM_OAUTH_URL    || 'https://api.orange.com/oauth/v3/token'; }
  static get clientId()    { return process.env.OM_CLIENT_ID    || ''; }
  static get clientSecret(){ return process.env.OM_CLIENT_SECRET|| ''; }
  static get merchantKey() { return process.env.OM_MERCHANT_KEY || ''; }

  /**
   * Obtient un access token OAuth2 Orange Money.
   */
  static async getAccessToken() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('OM_CLIENT_ID / OM_CLIENT_SECRET manquants dans .env');
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post(
      this.oauthUrl,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization:  `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept:         'application/json',
        },
        timeout: 15000,
      }
    );

    return response.data.access_token;
  }

  /**
   * Crée une session de paiement Orange Money WebPay.
   * @param {object} opts
   * @param {number}  opts.montant     - Montant en XOF
   * @param {string}  opts.orderId     - ID de commande unique (référence paiement)
   * @param {string}  opts.returnUrl   - URL de retour après paiement
   * @param {string}  opts.cancelUrl   - URL d'annulation
   * @param {string}  opts.notifUrl    - URL de notification webhook
   */
  static async initierPaiement({ montant, orderId, returnUrl, cancelUrl, notifUrl }) {
    if (!this.merchantKey) {
      throw new Error('OM_MERCHANT_KEY manquant dans .env');
    }

    const accessToken = await this.getAccessToken();
    const merchantAuth = Buffer.from(`${this.merchantKey}:`).toString('base64');

    const t0 = Date.now();
    const response = await axios.post(
      `${this.apiUrl}/webpayment`,
      {
        merchant_key: this.merchantKey,
        currency:     'OAF',           // XOF en notation OM
        order_id:     orderId,
        amount:       String(Math.round(montant)),
        return_url:   returnUrl,
        cancel_url:   cancelUrl,
        notif_url:    notifUrl,
        lang:         'fr',
        reference:    orderId,
      },
      {
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'X-AUTH-TOKEN': merchantAuth,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        timeout: 15000,
      }
    );

    logger.info('OrangeMoney API appel initierPaiement', { url: `${this.apiUrl}/webpayment`, status: response.status, duration_ms: Date.now() - t0, orderId });
    const data = response.data?.data || response.data;
    return {
      checkoutUrl:      data.payment_url,
      notifToken:       data.notif_token,
      referenceSession: orderId,
    };
  }
}

module.exports = OrangeMoneyService;
