const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../../middlewares/auth.middleware');
const logger = require('../../config/logger');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');
const { genererRapportMensuel } = require('../../jobs/rapport.job');

const RAPPORTS_DIR = path.join(__dirname, '../../uploads/rapports');

// POST /nanei/admin/rapports/generer — génération manuelle à la demande
router.post('/generer', auth, isAdmin, auditLog('GENERATE', 'Rapport'), async (req, res) => {
  try {
    const { filename, moisLabel, caTotal, nbColis } = await genererRapportMensuel();
    return res.status(200).json({
      success: true,
      message: `Rapport de ${moisLabel} généré avec succès`,
      rapport: { filename, moisLabel, caTotal, nbColis, url: `/uploads/rapports/${filename}` },
    });
  } catch (err) {
    logger.error('Rapports erreur génération manuelle', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Erreur lors de la génération du rapport' });
  }
});

// GET /nanei/admin/rapports — liste des fichiers
router.get('/', auth, isAdmin, (req, res) => {
  try {
    if (!fs.existsSync(RAPPORTS_DIR)) {
      return res.status(200).json({ success: true, rapports: [] });
    }

    const fichiers = fs.readdirSync(RAPPORTS_DIR)
      .filter((f) => f.endsWith('.pdf'))
      .sort()
      .reverse()
      .map((f) => ({
        filename: f,
        url: `/uploads/rapports/${f}`,
        taille: fs.statSync(path.join(RAPPORTS_DIR, f)).size,
      }));

    return res.status(200).json({ success: true, rapports: fichiers });
  } catch (err) {
    logger.error('Rapports erreur liste', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /nanei/admin/rapports/:filename — télécharger un rapport
router.get('/:filename', auth, isAdmin, (req, res) => {
  try {
    const { filename } = req.params;

    // Sécurité : interdire les traversées de chemin
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Nom de fichier invalide' });
    }

    const filePath = path.join(RAPPORTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(filePath);
  } catch (err) {
    logger.error('Rapports erreur téléchargement', { error: err.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
