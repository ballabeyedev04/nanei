// src/middlewares/uploadSignature.middleware.js
const { uploadConfig } = require('../config/security');
const { createUploader } = require('./cloudinaryUpload.middleware');

// Upload en mémoire — la signature part directement vers Cloudinary
const uploadSignature = createUploader({
  maxFileSize: uploadConfig.maxFileSize,
  allowedMimeTypes: uploadConfig.allowedMimeTypes,
});

module.exports = uploadSignature;
