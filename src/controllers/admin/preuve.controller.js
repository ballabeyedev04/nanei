const { PreuveLivraison, Colis } = require('../../models');
const logger = require('../../config/logger');
const { createUploader, uploadBufferToR2 } = require('../../middlewares/r2Upload.middleware');

// ── Multer config (mémoire — le fichier part directement vers Cloudflare R2) ─
const upload = createUploader({
  maxFileSize: 15 * 1024 * 1024, // 15 MB
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
});

exports.upload = upload;

// ── ADMIN : ajouter une preuve de livraison ──────────────────────────────────
exports.ajouterPreuve = async (req, res) => {
  try {
    const { colisId } = req.params;

    const colis = await Colis.findByPk(colisId);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });

    // Une preuve de livraison n'a de sens que pour un colis livré (l'admin
    // ne propose le bouton que pour `livre` ; le back l'impose aussi).
    if (colis.statut !== 'livre') {
      return res.status(409).json({ success: false, message: "Le colis doit être marqué « Livré » avant d'ajouter une preuve de livraison" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Photo obligatoire' });
    }

    const { commentaire, gps_lat, gps_lng } = req.body;

    // Une seule preuve par colis. Si elle existe déjà, on ne la remplace que
    // sur demande explicite (`remplacer=true`, après confirmation dans
    // l'admin) : avant, tout nouvel envoi écrasait la preuve sans prévenir.
    const existante = await PreuveLivraison.findOne({ where: { colis_id: colisId } });
    const remplacer = String(req.body.remplacer ?? req.query.remplacer ?? '').toLowerCase() === 'true';
    if (existante && !remplacer) {
      return res.status(409).json({
        success: false,
        message: "Une preuve de livraison existe déjà pour ce colis. Confirmez le remplacement pour l'écraser.",
        preuve: existante,
      });
    }

    const photo_url = await uploadBufferToR2(req.file.buffer, req.file.originalname, 'nanei/preuves');
    const valeurs = {
      photo_url,
      commentaire: commentaire || null,
      gps_lat: gps_lat ? parseFloat(gps_lat) : null,
      gps_lng: gps_lng ? parseFloat(gps_lng) : null,
    };

    let preuve;
    if (existante) {
      // Pas de colonne updated_at : on recrée la ligne pour que created_at
      // soit la date de la NOUVELLE photo (affichée « Enregistrée le … »).
      const sequelize = PreuveLivraison.sequelize;
      preuve = await sequelize.transaction(async (t) => {
        await existante.destroy({ transaction: t });
        return PreuveLivraison.create({ colis_id: colisId, ...valeurs }, { transaction: t });
      });
      logger.info('Preuve de livraison remplacée', { colis_id: colisId, admin_id: req.user?.id });
    } else {
      preuve = await PreuveLivraison.create({ colis_id: colisId, ...valeurs });
    }

    return res.status(existante ? 200 : 201).json({
      success: true,
      message: existante ? 'Preuve remplacée' : 'Preuve ajoutée',
      preuve,
    });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    logger.error('Erreur dans ajouterPreuve', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── ADMIN : voir la preuve d'un colis ───────────────────────────────────────
exports.voirPreuve = async (req, res) => {
  try {
    const { colisId } = req.params;

    const preuve = await PreuveLivraison.findOne({ where: { colis_id: colisId } });
    if (!preuve) return res.status(404).json({ success: false, message: 'Aucune preuve trouvée' });

    return res.status(200).json({ success: true, preuve });
  } catch (err) {
    logger.error('Erreur dans voirPreuve', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── CLIENT : voir la preuve de son propre colis ──────────────────────────────
exports.voirPreuveClient = async (req, res) => {
  try {
    const { colisId } = req.params;
    const userId = req.user.id;

    const colis = await Colis.findByPk(colisId);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });
    if (colis.expediteurId !== userId && colis.recepteurId !== userId) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const preuve = await PreuveLivraison.findOne({ where: { colis_id: colisId } });
    if (!preuve) return res.status(404).json({ success: false, message: 'Aucune preuve disponible' });

    return res.status(200).json({ success: true, preuve });
  } catch (err) {
    logger.error('Erreur dans voirPreuveClient', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
