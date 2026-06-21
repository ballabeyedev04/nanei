const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/client/facture.controller');
const auth    = require('../../middlewares/auth.middleware');

// GET /nanei/factures/:id        → aperçu PDF dans le navigateur/app
router.get('/:id',          auth, ctrl.afficherFacture);

// GET /nanei/factures/:id/download → force le téléchargement
router.get('/:id/download', auth, ctrl.telechargerFacture);

module.exports = router;
