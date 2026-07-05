const multer = require('multer');
const r2Service = require('../services/r2.service');

// Stockage en mémoire — le fichier ne touche jamais le disque du serveur
const memoryStorage = multer.memoryStorage();

/**
 * Crée un middleware Multer (mémoire) pour un upload vers R2.
 * @param {object} opts
 * @param {number} opts.maxFileSize - Taille max en octets
 * @param {string[]} opts.allowedMimeTypes - Types MIME autorisés
 */
const createUploader = ({ maxFileSize, allowedMimeTypes }) => {
  return multer({
    storage: memoryStorage,
    limits: { fileSize: maxFileSize },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Type de fichier non autorisé'), false);
    },
  });
};

/**
 * Envoie un buffer (req.file.buffer) vers R2, sans écrire sur disque.
 * @param {Buffer} buffer
 * @param {string} originalname - Nom original du fichier (req.file.originalname)
 * @param {string} folder - Sous-dossier R2 (ex: 'nanei/preuves')
 * @returns {Promise<string>} URL publique du fichier
 */
const uploadBufferToR2 = (buffer, originalname, folder) => {
  return r2Service.uploadImage(buffer, originalname, folder);
};

module.exports = { createUploader, uploadBufferToR2 };
