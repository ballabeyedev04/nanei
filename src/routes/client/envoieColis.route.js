const express = require('express');
const router = express.Router();
const envoieColisController = require('../../controllers/client/envoieColis.controller');

const authMiddleware = require('../../middlewares/auth.middleware');

router.post('/envoie-colis', authMiddleware, envoieColisController.envoieColisController);


module.exports = router;
