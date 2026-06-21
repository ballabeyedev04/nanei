const { ContactFavori } = require('../../models');
const logger = require('../../config/logger');

// GET /nanei/contacts — liste des contacts favoris de l'utilisateur connecté
exports.liste = async (req, res) => {
  try {
    const contacts = await ContactFavori.findAll({
      where: { utilisateur_id: req.user.id },
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json({ success: true, contacts });
  } catch (err) {
    logger.error('Erreur dans liste contacts', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /nanei/contacts
exports.creer = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, ville, pays } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est obligatoire' });
    }

    const contact = await ContactFavori.create({
      utilisateur_id: req.user.id,
      nom,
      prenom: prenom || null,
      email: email || null,
      telephone: telephone || null,
      ville: ville || null,
      pays_id: pays || null,
    });

    return res.status(201).json({ success: true, message: 'Contact créé', contact });
  } catch (err) {
    logger.error('Erreur dans creer contact', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /nanei/contacts/:id
exports.modifier = async (req, res) => {
  try {
    const contact = await ContactFavori.findOne({
      where: { id: req.params.id, utilisateur_id: req.user.id },
    });

    if (!contact) return res.status(404).json({ success: false, message: 'Contact introuvable' });

    const { nom, prenom, email, telephone, ville, pays } = req.body;
    if (nom !== undefined) contact.nom = nom;
    if (prenom !== undefined) contact.prenom = prenom;
    if (email !== undefined) contact.email = email;
    if (telephone !== undefined) contact.telephone = telephone;
    if (ville !== undefined) contact.ville = ville;
    if (pays !== undefined) contact.pays_id = pays;

    await contact.save();
    return res.status(200).json({ success: true, message: 'Contact mis à jour', contact });
  } catch (err) {
    logger.error('Erreur dans modifier contact', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /nanei/contacts/:id
exports.supprimer = async (req, res) => {
  try {
    const contact = await ContactFavori.findOne({
      where: { id: req.params.id, utilisateur_id: req.user.id },
    });

    if (!contact) return res.status(404).json({ success: false, message: 'Contact introuvable' });

    await contact.destroy();
    return res.status(200).json({ success: true, message: 'Contact supprimé' });
  } catch (err) {
    logger.error('Erreur dans supprimer contact', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
