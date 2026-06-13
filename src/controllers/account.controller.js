const AccountService = require('../services/account.service');
const formatUser = require('../utils/formatUser');

// ── GET /me ───────────────────────────────────────────────────────────────────
exports.me = async (req, res) => {
  try {
    const result = await AccountService.getMe(req.user.id);
    if (!result.success) {
      return res.status(404).json({ message: result.message });
    }
    return res.status(200).json({ utilisateur: formatUser(result.utilisateur) });
  } catch (err) {
    console.error('Erreur me:', err);
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

  const photoProfil = req.file ? '/image_profils/' + req.file.filename : null;

  try {
    const { utilisateur, message, error } = await AccountService.updateProfile({
      userId,
      data: { nom, prenom, email, telephone, adresse, photoProfil, carte_identite_national_num }
    });

    if (error) return res.status(400).json({ message: error });

    return res.status(200).json({ message, utilisateur: formatUser(utilisateur) });
  } catch (err) {
    console.error('Erreur modification profil :', err);
    return res.status(500).json({ message: 'Erreur serveur lors de la modification du profil' });
  }
};

// ── POST /forgot-password ─────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "L'email est obligatoire" });
  }

  try {
    const result = await AccountService.forgotPassword(email);

    if (result.error) {
      return res.status(404).json({ message: result.error });
    }

    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Erreur controller forgotPassword:', error);
    return res.status(500).json({ message: "Erreur serveur lors de la demande de réinitialisation" });
  }
};

// ── POST /reset-password ──────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { email, otpRecu, mot_de_passe } = req.body;

  try {
    const result = await AccountService.resetPassword(email, otpRecu, mot_de_passe);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Erreur controller resetPassword:', error);
    return res.status(500).json({ message: "Erreur serveur lors de la réinitialisation du mot de passe" });
  }
};

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
    console.error("Erreur controller changePassword:", error);
    return res.status(500).json({ message: "Erreur serveur lors du changement de mot de passe" });
  }
};
