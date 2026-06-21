const path = require('path');
const multer = require('multer');
const { PreuveLivraison, Colis } = require('../../models');
const logger = require('../../config/logger');

// ── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/preuves'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `preuve-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  },
});

exports.upload = upload;

// ── ADMIN : ajouter une preuve de livraison ──────────────────────────────────
exports.ajouterPreuve = async (req, res) => {
  try {
    const { colisId } = req.params;

    const colis = await Colis.findByPk(colisId);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Photo obligatoire' });
    }

    const { commentaire, gps_lat, gps_lng } = req.body;
    const photo_url = `/uploads/preuves/${req.file.filename}`;

    // Upsert (unique sur colis_id)
    const [preuve, created] = await PreuveLivraison.upsert({
      colis_id: colisId,
      photo_url,
      commentaire: commentaire || null,
      gps_lat: gps_lat ? parseFloat(gps_lat) : null,
      gps_lng: gps_lng ? parseFloat(gps_lng) : null,
    }, { returning: true });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Preuve ajoutée' : 'Preuve mise à jour',
      preuve,
    });
  } catch (err) {
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
