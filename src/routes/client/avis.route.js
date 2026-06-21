const express = require('express');
const router = express.Router();
const avisController = require('../../controllers/client/avis.controller');
const auth = require('../../middlewares/auth.middleware');

router.post('/', auth, avisController.donnerAvis);
router.get('/', auth, avisController.mesAvis);

module.exports = router;
