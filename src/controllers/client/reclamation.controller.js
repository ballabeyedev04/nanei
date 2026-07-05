const { Reclamation, Colis } = require('../../models');
const logger = require('../../config/logger');
const { sendEmail } = require('../../services/resend.service');
const { sendSMS } = require('../../services/sms.service');
const { createUploader, uploadBufferToR2 } = require('../../middlewares/r2Upload.middleware');

// ── Multer config (mémoire — les fichiers partent directement vers Cloudflare R2) ─
const upload = createUploader({
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
});

exports.upload = upload;

// ── CLIENT : créer une réclamation ──────────────────────────────────────────
exports.creer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { colis_id, type, description } = req.body;

    if (!colis_id || !type || !description) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    // Vérifier que le colis appartient à l'utilisateur
    const colis = await Colis.findByPk(colis_id);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });
    if (colis.expediteurId !== userId) {
      return res.status(403).json({ success: false, message: 'Ce colis ne vous appartient pas' });
    }

    // Upload direct vers Cloudflare R2 (buffers en mémoire, jamais écrits sur disque)
    const photos = req.files
      ? await Promise.all(req.files.map((f) => uploadBufferToR2(f.buffer, f.originalname, 'nanei/reclamations')))
      : [];

    const reclamation = await Reclamation.create({
      colis_id,
      utilisateur_id: userId,
      type,
      description,
      photos,
    });

    logger.info('Réclamation créée', { reclamation_id: reclamation.id, colis_id, type, user_id: userId });
    return res.status(201).json({ success: true, message: 'Réclamation créée', reclamation });
  } catch (err) {
    logger.error('Erreur dans creer reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── CLIENT : mes réclamations ────────────────────────────────────────────────
exports.mesList = async (req, res) => {
  try {
    const userId = req.user.id;

    const reclamations = await Reclamation.findAll({
      where: { utilisateur_id: userId },
      include: [{ model: Colis, as: 'colis', attributes: ['reference', 'statut', 'destination'] }],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({ success: true, reclamations });
  } catch (err) {
    logger.error('Erreur dans mesList reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── CLIENT : détail d'une réclamation ───────────────────────────────────────
exports.detail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const reclamation = await Reclamation.findOne({
      where: { id, utilisateur_id: userId },
      include: [{ model: Colis, as: 'colis', attributes: ['reference', 'statut', 'destination'] }],
    });

    if (!reclamation) return res.status(404).json({ success: false, message: 'Réclamation introuvable' });

    return res.status(200).json({ success: true, reclamation });
  } catch (err) {
    logger.error('Erreur dans detail reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── ADMIN : liste toutes les réclamations ────────────────────────────────────
exports.adminList = async (req, res) => {
  try {
    const where = {};
    if (req.query.statut) where.statut = req.query.statut;

    const { Utilisateur } = require('../../models');

    const reclamations = await Reclamation.findAll({
      where,
      include: [
        { model: Colis, as: 'colis', attributes: ['reference', 'statut', 'destination'] },
        { model: Utilisateur, as: 'utilisateur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({ success: true, reclamations });
  } catch (err) {
    logger.error('Erreur dans adminList reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── ADMIN : mettre à jour une réclamation ───────────────────────────────────
exports.adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaire_admin } = req.body;

    const { Utilisateur } = require('../../models');

    const reclamation = await Reclamation.findByPk(id, {
      include: [
        { model: Colis, as: 'colis', attributes: ['reference'] },
        { model: Utilisateur, as: 'utilisateur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
    });

    if (!reclamation) return res.status(404).json({ success: false, message: 'Réclamation introuvable' });

    if (statut) reclamation.statut = statut;
    if (commentaire_admin !== undefined) reclamation.commentaire_admin = commentaire_admin;
    await reclamation.save();

    // Notifier le client
    const client = reclamation.utilisateur;
    const colisRef = reclamation.colis?.reference || '—';
    const statutLabel = statut || reclamation.statut;
    const msgTexte = `Votre réclamation pour le colis ${colisRef} a été mise à jour : ${statutLabel}. ${commentaire_admin || ''}`;

    if (client) {
      if (client.email) {
        await sendEmail({
          to: client.email,
          subject: `Réclamation colis ${colisRef} — ${statutLabel}`,
          html: `<p>Bonjour ${client.prenom},</p><p>${msgTexte}</p><p>Connectez-vous sur <strong>nanei.app</strong> pour plus de détails.</p>`,
        }).catch((e) => logger.warn('Reclamation email erreur', { error: e.message }));
      }
      if (client.telephone) {
        await sendSMS(client.telephone, msgTexte).catch((e) => logger.warn('Reclamation SMS erreur', { error: e.message }));
      }
    }

    return res.status(200).json({ success: true, message: 'Réclamation mise à jour', reclamation });
  } catch (err) {
    logger.error('Erreur dans adminUpdate reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
