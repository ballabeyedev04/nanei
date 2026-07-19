const AccountService = require('../services/account.service');
const logger = require('../config/logger');
const formatUser = require('../utils/formatUser');
const User = require('../models/utilisateur.model');
const { v4: uuidv4 } = require('uuid');
const { uploadBufferToR2 } = require('../middlewares/r2Upload.middleware');

// ── GET /me ───────────────────────────────────────────────────────────────────
exports.me = async (req, res) => {
  try {
    const result = await AccountService.getMe(req.user.id);
    if (!result.success) {
      return res.status(404).json({ message: result.message });
    }
    return res.status(200).json({ utilisateur: formatUser(result.utilisateur) });
  } catch (err) {
    logger.error('Erreur dans me', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── PUT /modifier-profil ──────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const userId = req.user.id;

  const {
    nom,
    prenom,
    email,
    telephone,
    adresse,
    carte_identite_national_num
  } = req.body;

  try {
    // SÉCURITÉ/PERF: Upload direct vers Cloudflare R2 (buffer en mémoire, jamais écrit sur disque)
    const photoProfil = req.file
      ? await uploadBufferToR2(req.file.buffer, req.file.originalname, 'nanei/profils')
      : null;

    const { utilisateur, message, error } = await AccountService.updateProfile({
      userId,
      data: { nom, prenom, email, telephone, adresse, photoProfil, carte_identite_national_num }
    });

    if (error) return res.status(400).json({ message: error });

    return res.status(200).json({ message, utilisateur: formatUser(utilisateur) });
  } catch (err) {
    logger.error('Erreur dans updateProfile', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ message: 'Erreur serveur lors de la modification du profil' });
  }
};

// NB : forgotPassword / resetPassword ont été retirés (dead code, jamais
// appelés — le mobile utilise /auth/oublier-password et /auth/reset-password,
// voir auth.route.js + auth.controller.js).

// ── PUT /change-password ──────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "L'ancien et le nouveau mot de passe sont obligatoires" });
  }

  try {
    const result = await AccountService.changePassword(userId, oldPassword, newPassword);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    logger.error('Erreur dans changePassword', { error: error.message, stack: error.stack, user_id: req.user?.id });
    return res.status(500).json({ message: "Erreur serveur lors du changement de mot de passe" });
  }
};

// ── POST /fcm-token ───────────────────────────────────────────────────────────
exports.updateFcmToken = async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) {
    return res.status(400).json({ message: 'fcm_token est requis' });
  }
  try {
    await User.update({ fcm_token }, { where: { id: req.user.id } });
    return res.status(200).json({ message: 'FCM token enregistré' });
  } catch (err) {
    logger.error('Erreur dans updateFcmToken', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── DELETE /account (RGPD) ────────────────────────────────────────────────────
exports.deleteAccount = async (req, res) => {
  try {
    const RgpdService = require('../services/rgpd.service');
    const userId = req.user.id;

    // SÉCURITÉ: Hard delete conforme RGPD (pas d'anonymisation)
    const result = await RgpdService.deleteUserAccount(userId);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    logger.info('Compte supprimé par l\'utilisateur lui-même', { user_id: userId });
    return res.status(200).json({ message: result.message });
  } catch (err) {
    logger.error('Erreur dans deleteAccount', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ message: 'Erreur serveur lors de la suppression du compte' });
  }
};
