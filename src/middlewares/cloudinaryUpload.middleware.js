const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const logger = require('../config/logger');

// Stockage en mémoire — le fichier ne touche jamais le disque du serveur
const memoryStorage = multer.memoryStorage();

/**
 * Crée un middleware Multer (mémoire) + une fonction d'upload vers Cloudinary.
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
 * Envoie un buffer (req.file.buffer) vers Cloudinary via un stream, sans écrire sur disque.
 * @param {Buffer} buffer
 * @param {string} folder - Dossier Cloudinary (ex: 'nanei/preuves')
 * @returns {Promise<string>} URL publique sécurisée (secure_url)
 */
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) {
          logger.error('Erreur upload Cloudinary', { error: error.message, folder });
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

module.exports = { createUploader, uploadBufferToCloudinary };
