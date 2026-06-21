const express = require('express');
const router = express.Router();
const avisController = require('../../controllers/client/avis.controller');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

router.get('/', auth, isAdmin, avisController.adminAvis);

module.exports = router;
