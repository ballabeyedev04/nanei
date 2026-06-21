const ClientPaiementService = require('../../services/client/paiement.service');
const logger = require('../../config/logger');

exports.mesPaiements = async (req, res) => {
  try {
    const result = await ClientPaiementService.mesPaiements(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.initierPaiement = async (req, res) => {
  try {
    const { colisId } = req.params;
    const { moyenPaiement } = req.body;
    const result = await ClientPaiementService.initierPaiement(colisId, req.user.id, moyenPaiement);
    if (!result.success) return res.status(400).json(result);
    logger.info('Paiement initié', { colis_id: colisId, moyen: moyenPaiement, user_id: req.user.id });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('Erreur dans initierPaiement', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// Retour après paiement (redirect navigateur)
exports.retourPaiement = async (req, res) => {
  try {
    const { statut, colisId, ref } = req.query;
    const result = await ClientPaiementService.traiterRetour(colisId, ref, statut);

    // Page HTML minimale qui redirige vers l'app via deep link
    const statusFr = statut === 'succes' ? 'réussi ✅' : 'échoué ❌';
    return res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Paiement ${statusFr}</title>
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
                 justify-content: center; min-height: 100vh; margin: 0; background: #f9f9f9; }
          .card { background: white; border-radius: 24px; padding: 48px 32px; text-align: center;
                  box-shadow: 0 8px 40px rgba(0,0,0,0.08); max-width: 360px; width: 90%; }
          .icon { font-size: 64px; margin-bottom: 16px; }
          h2 { font-size: 22px; font-weight: 700; color: #111; margin: 0 0 8px; }
          p { color: #888; font-size: 14px; margin: 0 0 24px; }
          a { display: inline-block; background: #FF7A00; color: white; text-decoration: none;
              padding: 14px 28px; border-radius: 14px; font-weight: 700; font-size: 14px; }
        </style>
        <script>
          // Tentative d'ouverture du deep link automatique
          window.location.href = "${result.deepLink || '#'}";
        </script>
      </head>
      <body>
        <div class="card">
          <div class="icon">${statut === 'succes' ? '✅' : '❌'}</div>
          <h2>Paiement ${statusFr}</h2>
          <p>${statut === 'succes' ? 'Votre paiement a bien été enregistré.' : 'Le paiement a échoué ou a été annulé.'}</p>
          <a href="${result.deepLink || '#'}">Retour à l'application</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send('Erreur serveur');
  }
};

// Webhook Wave
exports.webhookWave = async (req, res) => {
  try {
    await ClientPaiementService.webhookWave(req.body);
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Webhook Orange Money
exports.webhookOrangeMoney = async (req, res) => {
  try {
    await ClientPaiementService.webhookOrangeMoney(req.body);
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
