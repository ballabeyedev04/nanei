const { Reclamation, Colis } = require('../../models');
const { paginer, avecPagination } = require('../../utils/pagination');
const STATUTS_RECLAMATION = ['ouverte', 'en_cours', 'resolue', 'rejetee'];
const { echapperHtml, sujetEmail } = require('../../utils/echapperHtml');
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

// Types de réclamation acceptés (valeurs de l'ENUM en base). Les variantes
// sans accent (« endommage ») envoyées par d'anciennes versions de l'app sont
// ramenées à la valeur canonique.
const TYPES_RECLAMATION = {
  perdu: 'perdu',
  endommage: 'endommagé',
  'endommagé': 'endommagé',
  retard: 'retard',
  autre: 'autre',
};

// ── CLIENT : créer une réclamation ──────────────────────────────────────────
exports.creer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { colis_id, description } = req.body;

    if (!colis_id || !req.body.type || !description) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    const type = TYPES_RECLAMATION[String(req.body.type).trim().toLowerCase()];
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Type de réclamation invalide (perdu, endommagé, retard ou autre)',
      });
    }

    // Le colis doit concerner l'utilisateur : l'expéditeur OU le destinataire
    // (c'est souvent le destinataire qui constate un colis endommagé).
    const colis = await Colis.findByPk(colis_id);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });
    if (colis.expediteurId !== userId && colis.recepteurId !== userId) {
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
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    logger.error('Erreur dans creer reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── CLIENT : mes réclamations ────────────────────────────────────────────────
exports.mesList = async (req, res) => {
  try {
    const userId = req.user.id;

    const { lignes: reclamations, pagination } = await paginer(Reclamation, {
      where: { utilisateur_id: userId },
      include: [{ model: Colis, as: 'colis', attributes: ['reference', 'statut', 'destination'] }],
      order: [['created_at', 'DESC']],
    }, req.query);

    return res.status(200).json(avecPagination({ success: true, reclamations }, pagination));
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
    if (req.query.statut) {
      // Valeur inconnue → 400 (avant : erreur Postgres sur l'enum → 500)
      if (!STATUTS_RECLAMATION.includes(req.query.statut)) {
        return res.status(400).json({ success: false, message: `Statut invalide (${STATUTS_RECLAMATION.join(', ')})` });
      }
      where.statut = req.query.statut;
    }

    const { Utilisateur } = require('../../models');

    // Pagination facultative (?page=&limit=)
    const { lignes: reclamations, pagination } = await paginer(Reclamation, {
      where,
      include: [
        { model: Colis, as: 'colis', attributes: ['reference', 'statut', 'destination'] },
        { model: Utilisateur, as: 'utilisateur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
      order: [['created_at', 'DESC']],
    }, req.query);

    return res.status(200).json(avecPagination({ success: true, reclamations }, pagination));
  } catch (err) {
    logger.error('Erreur dans adminList reclamation', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── ADMIN : mettre à jour une réclamation ───────────────────────────────────
exports.adminUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    // Champ attendu : commentaire_admin. `commentaire` accepté aussi (ancienne
    // version de l'admin, qui l'envoyait sous ce nom et le perdait).
    const commentaire_admin = req.body.commentaire_admin ?? req.body.commentaire;

    const { Utilisateur } = require('../../models');

    const reclamation = await Reclamation.findByPk(id, {
      include: [
        { model: Colis, as: 'colis', attributes: ['reference'] },
        { model: Utilisateur, as: 'utilisateur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      ],
    });

    if (!reclamation) return res.status(404).json({ success: false, message: 'Réclamation introuvable' });

    if (statut && !STATUTS_RECLAMATION.includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide (ouverte, en_cours, resolue ou rejetee)' });
    }
    if (statut) reclamation.statut = statut;
    if (commentaire_admin !== undefined) reclamation.commentaire_admin = commentaire_admin;
    await reclamation.save();

    // Notifier le client
    const client = reclamation.utilisateur;
    const colisRef = reclamation.colis?.reference || '—';
    const LIBELLES_STATUT = { ouverte: 'ouverte', en_cours: 'en cours de traitement', resolue: 'résolue', rejetee: 'rejetée' };
    const statutLabel = LIBELLES_STATUT[reclamation.statut] || reclamation.statut;
    const commentaire = (commentaire_admin || '').trim();
    const msgTexte = `Votre réclamation pour le colis ${colisRef} a été mise à jour : ${statutLabel}.${commentaire ? ` ${commentaire}` : ''}`;

    if (client) {
      if (client.email) {
        await sendEmail({
          to: client.email,
          subject: sujetEmail(`Réclamation colis ${colisRef} — ${statutLabel}`),
          // Prénom (saisi par le client) et commentaire (saisi par l'admin)
          // échappés : jamais interprétés comme HTML.
          html: `<p>Bonjour ${echapperHtml(client.prenom)},</p><p style="white-space:pre-wrap;">${echapperHtml(msgTexte)}</p><p>Connectez-vous sur <strong>nanei.app</strong> pour plus de détails.</p>`,
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
