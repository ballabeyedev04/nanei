const express = require('express');
const router = express.Router();
const countryController = require('../../controllers/admin/country.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);
router.use(isAdmin);

router.get('/', countryController.getCountries);
router.get('/:id', countryController.getCountryById);
router.post('/', auditLog('CREATE', 'Country'), countryController.createCountry);
router.put('/:id', auditLog('UPDATE', 'Country'), countryController.updateCountry);
router.delete('/:id', auditLog('DELETE', 'Country'), countryController.deleteCountry);

module.exports = router;
