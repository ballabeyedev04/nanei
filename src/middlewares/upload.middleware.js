const { uploadConfig } = require('../config/security');
const { createUploader } = require('./r2Upload.middleware');

// Upload en mémoire — le fichier part directement vers Cloudflare R2 (voir uploadBufferToR2)
const upload = createUploader({
  maxFileSize: uploadConfig.maxFileSize,
  // + WEBP : format possible d'une photo choisie dans la galerie du téléphone
  allowedMimeTypes: [...uploadConfig.allowedMimeTypes, 'image/webp'],
});

module.exports = upload;
