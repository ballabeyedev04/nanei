const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadConfig } = require('../config/security');

// -------------------- Configuration stockage --------------------
// Ici on définit où seront stockés les fichiers et comment les renommer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/image_profils');

    // Crée le dossier uploads s'il n'existe pas
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // On renomme le fichier avec date + nom original
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${name}${ext}`);
  }
});

// -------------------- Filtrage type de fichier --------------------
const fileFilter = (req, file, cb) => {
  if (uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

// -------------------- Middleware Multer --------------------
const upload = multer({
  storage,
  limits: { fileSize: uploadConfig.maxFileSize },
  fileFilter
});

module.exports = upload;
