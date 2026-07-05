/**
 * r2.service.js — Stockage Cloudflare R2
 *
 * Variables d'environnement requises :
 *   R2_ACCOUNT_ID        — ID du compte Cloudflare
 *   R2_ACCESS_KEY_ID     — Clé d'accès R2
 *   R2_SECRET_ACCESS_KEY — Clé secrète R2
 *   R2_BUCKET_NAME       — Nom du bucket (nanei-app)
 *   R2_PUBLIC_URL        — URL publique du bucket (ex: https://pub-xxx.r2.dev)
 *
 * Structure du bucket :
 *   nanei/profils/       — Photos de profil
 *   nanei/preuves/       — Preuves de livraison
 *   nanei/reclamations/  — Photos de réclamations
 */

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const path = require('path');

// ── Client R2 ─────────────────────────────────────────────────────────────────
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// ── Utilitaires ───────────────────────────────────────────────────────────────

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.pdf':  'application/pdf'
  };
  return types[ext] || 'application/octet-stream';
}

// ── Upload image (photos profil, preuves, réclamations) ───────────────────────

/**
 * Upload un fichier directement vers R2 depuis un Buffer mémoire.
 * Aucun fichier temporaire n'est écrit sur disque.
 *
 * @param {Buffer} buffer        — Contenu du fichier (req.file.buffer via multer memoryStorage)
 * @param {string} originalname  — Nom original du fichier (req.file.originalname)
 * @param {string} [folder]      — Sous-dossier dans R2 (ex: 'nanei/profils')
 * @returns {Promise<string>}    — URL publique du fichier
 */
async function uploadImage(buffer, originalname, folder = 'nanei/misc') {
  const ext      = path.extname(originalname) || '.jpg';
  const basename = path.basename(originalname, ext).replace(/\s+/g, '_');
  const filename = `${Date.now()}_${basename}${ext}`;
  const key      = `${folder}/${filename}`;

  await r2Client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: getContentType(originalname),
  }));

  return `${PUBLIC_URL}/${key}`;
}

// ── Suppression ───────────────────────────────────────────────────────────────

/**
 * Supprime un fichier de R2.
 * @param {string} key  — Clé R2 ou URL publique complète
 */
async function deleteFile(key) {
  if (key.startsWith('http')) {
    key = key.replace(`${PUBLIC_URL}/`, '');
  }
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = {
  uploadImage,
  deleteFile,
};
