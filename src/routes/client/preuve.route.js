const express = require('express');
const router = express.Router();
const preuveController = require('../../controllers/admin/preuve.controller');
const auth = require('../../middlewares/auth.middleware');

// GET /nanei/colis/:colisId/preuve
router.get('/colis/:colisId/preuve', auth, preuveController.voirPreuveClient);

module.exports = router;
