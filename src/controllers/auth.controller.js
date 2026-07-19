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

    const newToken = jwt.sign(
      { id: payload.id, role: payload.role },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    return res.status(200).json({ token: newToken });
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
