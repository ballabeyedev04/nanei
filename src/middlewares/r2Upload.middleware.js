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
      else {
        const err = new Error('Type de fichier non autorisé');
        err.status = 400;
        cb(err, false);
      }
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
  // Le type est vérifié sur le CONTENU (signature binaire), pas seulement sur
  // le Content-Type déclaré par le client (contrôlé par multer) : un fichier
  // HTML ou un exécutable renommé « photo.jpg » est refusé. L'extension
  // enregistrée sur R2 est celle du type réel, jamais celle du nom fourni.
  const type = typeReelFichier(buffer);
  if (!type) {
    const err = new Error('Type de fichier non autorisé (contenu non reconnu comme image PNG, JPEG, WEBP ou PDF)');
    err.status = 400;
    return Promise.reject(err);
  }
  const base = String(originalname || 'fichier').replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'fichier';
  return r2Service.uploadImage(buffer, `${base}.${type.extension}`, folder);
};

/**
 * Type réel d'un fichier d'après ses premiers octets (« nombres magiques »).
 * Renvoie { mime, extension } pour PNG, JPEG, WEBP et PDF, sinon null.
 */
function typeReelFichier(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  const debut = (octets) => octets.every((o, i) => buffer[i] === o);
  if (debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', extension: 'png' };
  if (debut([0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return { mime: 'application/pdf', extension: 'pdf' };
  return null;
}

module.exports = { createUploader, uploadBufferToR2, typeReelFichier };
