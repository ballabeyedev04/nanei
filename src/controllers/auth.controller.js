const AuthService = require('../services/auth.service');
const logger = require('../config/logger');
const formatUser = require('../utils/formatUser');
const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/security');
const RefreshToken = require('../models/refreshToken.model');
const crypto = require('crypto');

exports.inscriptionUser = async (req, res) => {
  const {
    nom,
    prenom,
    email,
    mot_de_passe,
    adresse,
    telephone,
    role
  } = req.body;

  try {
    const result = await AuthService.register({
      nom,
      prenom,
      email,
      mot_de_passe,
      adresse,
      telephone: telephone || null,
      role,
    });

    if (!result.success) {
      return res.status(400).json({
        message: result.message
      });
    }

    logger.info('Nouvel utilisateur inscrit', { user_id: result.utilisateur?.id });
    return res.status(201).json({
      message: result.message,
      utilisateur: formatUser(result.utilisateur)
    });

  } catch (err) {
    logger.error('Erreur dans inscriptionUser', { error: err.message, stack: err.stack });
    return res.status(500).json({
      message: "Erreur serveur lors de l'inscription",
      erreur: err.message
    });
  }
};


exports.login = async (req, res) => {
  const { identifiant, mot_de_passe } = req.body;

  try {
    const result = await AuthService.login({ identifiant, mot_de_passe });

    if (!result.success) {
      return res.status(400).json({ message: result.error ?? result.message ?? 'Identifiants incorrects' });
    }

    logger.info('Connexion utilisateur réussie', { user_id: result.utilisateur?.id });
    return res.status(200).json({
      token: result.token,
      refreshToken: result.refreshToken,
      utilisateur: formatUser(result.utilisateur)
    });
  } catch (err) {
    logger.error('Erreur dans login', { error: err.message, stack: err.stack });
    return res.status(500).json({
      message: 'Erreur serveur',
      erreur: err.message
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token manquant' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await RefreshToken.findOne({ where: { tokenHash, revoked: false } });
    if (!stored) {
      return res.status(401).json({ message: 'Refresh token invalide ou révoqué' });
    }

    if (new Date() > stored.expiresAt) {
      await stored.destroy();
      return res.status(401).json({ message: 'Refresh token expiré' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    } catch {
      await stored.destroy();
      return res.status(401).json({ message: 'Refresh token invalide' });
    }

    // Le compte doit toujours exister et être actif (avant : un compte
    // désactivé ou supprimé gardait sa session tant que le refresh token
    // était valide), et le refresh token doit être postérieur au dernier
    // changement de mot de passe.
    const Utilisateur = require('../models/utilisateur.model');
    const utilisateur = await Utilisateur.findByPk(payload.id);
    if (!utilisateur || utilisateur.statut !== 'actif' ||
        (utilisateur.passwordChangedAt && payload.iat * 1000 < utilisateur.passwordChangedAt.getTime())) {
      await stored.update({ revoked: true });
      return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
    }

    // Même jeton d'accès qu'à la connexion (avant : { id, role } seulement).
    const newToken = AuthService.genererJetonAcces(utilisateur);

    // Rotation : l'ancien refresh token est révoqué et remplacé par un
    // nouveau (jti aléatoire, voir AuthService.genererRefreshToken). Un rejeu
    // de l'ancien (fuite) échouera désormais.
    await stored.update({ revoked: true });
    const newRefreshToken = await AuthService.genererRefreshToken(utilisateur);

    return res.status(200).json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    logger.error('Erreur dans refresh', { error: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await RefreshToken.update({ revoked: true }, { where: { tokenHash } });
    }
    return res.status(200).json({ message: 'Déconnexion réussie' });
  } catch (err) {
    logger.error('Erreur dans logout', { error: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.oublierPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await AuthService.oublierPassword(email);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, mot_de_passe } = req.body;

    if (!email || !code || !mot_de_passe) {
      return res.status(400).json({ success: false, message: 'Email, code et nouveau mot de passe requis' });
    }

    const result = await AuthService.resetPassword(email, code, mot_de_passe);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
