const AccountService = require('../services/account.service');

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
      data: {
        nom,
        prenom,
        email,
        telephone,
        adresse,
        photoProfil,
        carte_identite_national_num
      }
    });

    if (error) return res.status(400).json({ message: error });

    return res.status(200).json({
      message,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        adresse: utilisateur.adresse,
        telephone: utilisateur.telephone,
        photoProfil: utilisateur.photoProfil,
        carte_identite_national_num: utilisateur.carte_identite_national_num,
        role: utilisateur.role
      }
    });

  } catch (err) {
    console.error('Erreur modification profil :', err);
    return res.status(500).json({
      message: 'Erreur serveur lors de la modification du profil',
      erreur: err.message
    });
  }
};
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "L'email est obligatoire"
    });
  }

  try {
    const result = await AccountService.forgotPassword(email);

    if (result.error) {
      return res.status(404).json({
        message: result.error
      });
    }

    return res.status(200).json({
      message: result.message,
      // ⚠️ utile pour tests backend seulement (à enlever en prod)
      resetLink: result.resetLink
    });

  } catch (error) {
    console.error('Erreur controller forgotPassword:', error);
    return res.status(500).json({
      message: "Erreur serveur lors de la demande de réinitialisation",
      erreur: error.message
    });
  }
};

exports.changePassword = async (req, res) => {
  const userId = req.user.id;

  const { oldPassword, newPassword } = req.body;

  // Vérification des champs
  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      message: "L'ancien et le nouveau mot de passe sont obligatoires"
    });
  }

  try {
    const result = await AccountService.changePassword(
      userId,
      oldPassword,
      newPassword
    );

    if (result.error) {
      return res.status(400).json({
        message: result.error
      });
    }

    return res.status(200).json({
      message: result.message
    });

  } catch (error) {
    console.error("Erreur controller changePassword:", error);
    return res.status(500).json({
      message: "Erreur serveur lors du changement de mot de passe",
      erreur: error.message
    });
  }
};

