const express = require('express');
const router = express.Router();
const messageClientController = require('../controllers/messageClient.controller');

// POST /nanei/messages — un client (ou un visiteur) écrit au support (public)
router.post('/', messageClientController.envoyerMessage);

// Les routes de consultation et de réponse sont réservées à l'admin et
// n'existent QUE sous /nanei/admin/messages (messageClient.admin.route.js),
// avec la limite de débit admin et le journal d'audit. Les doublons qui
// existaient ici (GET /, GET /stats, POST /:id/repondre) contournaient ces
// deux protections : ils ont été retirés.

module.exports = router;
