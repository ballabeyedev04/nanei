const express = require('express');
const router = express.Router();
const contactController = require('../../controllers/client/contact.controller');
const auth = require('../../middlewares/auth.middleware');

router.get('/', auth, contactController.liste);
router.post('/', auth, contactController.creer);
router.put('/:id', auth, contactController.modifier);
router.delete('/:id', auth, contactController.supprimer);

module.exports = router;
