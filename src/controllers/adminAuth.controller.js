const AdminAuthService = require('../services/adminAuth.service');
const logger = require('../config/logger');

/**
 * POST /nanei/admin/forgot-password
 * Demande de réinitialisation de mot de passe administrateur.
 * Retourne toujours un message générique pour éviter l'énumération d'emails.
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: "L'adresse email est requise."
      });
    }

    const result = await AdminAuthService.forgotPassword(email);

    // On retourne toujours 200 (même si l'email n'existe pas — anti-énumération)
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Erreur dans adminAuth.forgotPassword', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur. Veuillez réessayer dans quelques instants.'
    });
  }
};

/**
 * POST /nanei/admin/reset-password
 * Réinitialise le mot de passe à partir d'un token valide.
 * Body: { token: string, mot_de_passe: string }
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, mot_de_passe } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation manquant.'
      });
    }

    if (!mot_de_passe || typeof mot_de_passe !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe est requis.'
      });
    }

    const result = await AdminAuthService.resetPassword(token, mot_de_passe);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Erreur dans adminAuth.resetPassword', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur. Veuillez réessayer dans quelques instants.'
    });
  }
};
