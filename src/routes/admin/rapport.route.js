const express = require('express');
const router = express.Router();
const { paginerReponse } = require('../../utils/pagination');
const path = require('path');
const fs = require('fs');
const auth = require('../../middlewares/auth.middleware');
const logger = require('../../config/logger');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');
const { genererRapportMensuel } = require('../../jobs/rapport.job');

const { RAPPORTS_DIR, preparerDossierRapports } = require('../../utils/rapportsStockage');

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** rapport-2026-09.pdf → { mois: 'septembre', annee: '2026', label: 'Septembre 2026' } */
function decrireRapport(filename) {
  const m = /^rapport-(\d{4})-(\d{2})\.pdf$/.exec(filename);
  if (!m) return { mois: null, annee: null, label: filename };
  const mois = MOIS[Number(m[2]) - 1] || m[2];
  return { mois, annee: m[1], label: `${mois.charAt(0).toUpperCase()}${mois.slice(1)} ${m[1]}` };
}

/** URL de téléchargement : route protégée (jeton admin), jamais /uploads. */
const urlRapport = (filename) => `/nanei/admin/rapports/${encodeURIComponent(filename)}`;

// POST /nanei/admin/rapports/generer — génération manuelle à la demande
router.post('/generer', auth, isAdmin, auditLog('GENERATE', 'Rapport'), async (req, res) => {
  try {
    const { filename, moisLabel, caTotal, nbColis } = await genererRapportMensuel();
    return res.status(200).json({
      success: true,
      message: `Rapport de ${moisLabel} généré avec succès`,
      rapport: { filename, moisLabel, caTotal, nbColis, ...decrireRapport(filename), url: urlRapport(filename) },
    });
  } catch (err) {
    logger.error('Rapports erreur génération manuelle', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Erreur lors de la génération du rapport' });
  }
});

// GET /nanei/admin/rapports — liste des fichiers
router.get('/', auth, isAdmin, paginerReponse('rapports'), (req, res) => { // pagination facultative
  try {
    preparerDossierRapports();

    const fichiers = fs.readdirSync(RAPPORTS_DIR)
      .filter((f) => f.endsWith('.pdf'))
      .sort()
      .reverse()
      .map((f) => ({
        filename: f,
        ...decrireRapport(f),
        url: urlRapport(f),
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
