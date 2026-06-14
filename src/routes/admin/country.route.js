const express = require('express');
const router = express.Router();
const countryController = require('../../controllers/admin/country.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);

router.get('/', countryController.getCountries);
router.get('/:id', countryController.getCountryById);
router.post('/', countryController.createCountry);
router.put('/:id', countryController.updateCountry);
router.delete('/:id', countryController.deleteCountry);

module.exports = router;
