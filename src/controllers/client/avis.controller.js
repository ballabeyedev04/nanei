const { Avis, Colis, Utilisateur } = require('../../models');
const logger = require('../../config/logger');
const { Op, fn, col, literal } = require('sequelize');

// ── CLIENT : donner un avis ──────────────────────────────────────────────────
exports.donnerAvis = async (req, res) => {
  try {
    const userId = req.user.id;
    const { colis_id, note, commentaire } = req.body;

    if (!colis_id || !note) {
      return res.status(400).json({ success: false, message: 'colis_id et note sont obligatoires' });
    }
    if (note < 1 || note > 5) {
      return res.status(400).json({ success: false, message: 'La note doit être entre 1 et 5' });
    }

    // Vérifier que le colis est livré et appartient à l'utilisateur
    const colis = await Colis.findByPk(colis_id);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });
    if (colis.expediteurId !== userId) {
      return res.status(403).json({ success: false, message: 'Ce colis ne vous appartient pas' });
    }
    if (colis.statut !== 'livre') {
      return res.status(400).json({ success: false, message: 'Vous pouvez donner un avis uniquement après livraison' });
    }

    // Vérifier qu'aucun avis n'existe déjà
    const existant = await Avis.findOne({ where: { colis_id } });
    if (existant) {
      return res.status(409).json({ success: false, message: 'Un avis existe déjà pour ce colis' });
    }

    const avis = await Avis.create({
      colis_id,
      utilisateur_id: userId,
      note: parseInt(note, 10),
      commentaire: commentaire || null,
    });

    return res.status(201).json({ success: true, message: 'Avis enregistré', avis });
  } catch (err) {
    logger.error('Erreur dans donnerAvis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── CLIENT : mes avis ────────────────────────────────────────────────────────
exports.mesAvis = async (req, res) => {
  try {
    const avis = await Avis.findAll({
      where: { utilisateur_id: req.user.id },
      include: [{ model: Colis, as: 'colis', attributes: ['reference', 'destination'] }],
      order: [['created_at', 'DESC']],
    });
    return res.status(200).json({ success: true, avis });
  } catch (err) {
    logger.error('Erreur dans mesAvis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── ADMIN : tous les avis + stats ────────────────────────────────────────────
exports.adminAvis = async (req, res) => {
  try {
    const avis = await Avis.findAll({
      include: [
        { model: Colis, as: 'colis', attributes: ['reference', 'destination'] },
        { model: Utilisateur, as: 'utilisateur', attributes: ['nom', 'prenom', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });

    // Statistiques
    const total = avis.length;
    const note_moyenne = total > 0
      ? Math.round((avis.reduce((sum, a) => sum + a.note, 0) / total) * 10) / 10
      : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    avis.forEach((a) => { distribution[a.note] = (distribution[a.note] || 0) + 1; });

    return res.status(200).json({
      success: true,
      stats: { total, note_moyenne, distribution },
      avis,
    });
  } catch (err) {
    logger.error('Erreur dans adminAvis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
