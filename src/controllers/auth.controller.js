const AuthService = require('../services/auth.service');
const formatUser = require('../utils/formatUser');

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

    return res.status(201).json({
      message: result.message,
      utilisateur: formatUser(result.utilisateur)
    });

  } catch (err) {
    console.error('Erreur lors de l’inscription :', err);
    return res.status(500).json({
      message: 'Erreur serveur lors de l’inscription',
      erreur: err.message
    });
  }
};


exports.login = async (req, res) => {
  const { identifiant, mot_de_passe } = req.body;

  try {
    const { token, utilisateur, error } = await AuthService.login({ identifiant, mot_de_passe });

    if (error) return res.status(400).json({ message: error });

    return res.status(200).json({
      token,
      utilisateur: formatUser(utilisateur)
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    return res.status(500).json({
      message: 'Erreur serveur',
      erreur: err.message
    });
  }
};
