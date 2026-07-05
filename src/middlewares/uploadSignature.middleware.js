// src/middlewares/uploadSignature.middleware.js
const { uploadConfig } = require('../config/security');
const { createUploader } = require('./r2Upload.middleware');

// Upload en mémoire — la signature part directement vers Cloudflare R2
const uploadSignature = createUploader({
  maxFileSize: uploadConfig.maxFileSize,
  allowedMimeTypes: uploadConfig.allowedMimeTypes,
});

module.exports = uploadSignature;
