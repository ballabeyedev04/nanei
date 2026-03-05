const cloudinary = require('../config/cloudinary'); // ton fichier config Cloudinary

const uploadImage = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "profil_users",   // dossier Cloudinary
      use_filename: true,
      unique_filename: false,
      overwrite: true
    });
    return result.secure_url; // URL publique de l'image
  } catch (error) {
    console.error("Erreur upload image:", error);
    throw error;
  }
};

module.exports = { uploadImage };
