const { uploadConfig } = require('../config/security');
const { createUploader } = require('./cloudinaryUpload.middleware');

// Upload en mémoire — le fichier part directement vers Cloudinary (voir uploadBufferToCloudinary)
const upload = createUploader({
  maxFileSize: uploadConfig.maxFileSize,
  allowedMimeTypes: uploadConfig.allowedMimeTypes,
});

module.exports = upload;
