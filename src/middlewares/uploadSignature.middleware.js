// src/middlewares/uploadSignature.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadConfig } = require('../config/security');

// -------------------- Configuration stockage --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/signatures');

    // Crée le dossier uploads/signatures s'il n'existe pas
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
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
const uploadSignature = multer({
  storage,
  limits: { fileSize: uploadConfig.maxFileSize }, // ex: 2MB
  fileFilter
});

module.exports = uploadSignature;
