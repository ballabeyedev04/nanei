const express = require('express');
const router = express.Router();
const messageClientController = require('../controllers/messageClient.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const isAdmin = require('../middlewares/isAdmin.middlewares');

// POST /nanei/messages — client envoie un message (public)
router.post('/', messageClientController.envoyerMessage);

// GET /nanei/messages — admin consulte tous les messages
router.get('/', authMiddleware, isAdmin, messageClientController.getTousMessages);

// GET /nanei/messages/stats — nombre de messages
router.get('/stats', authMiddleware, isAdmin, messageClientController.getNombreMessages);

// POST /nanei/messages/:id/repondre — répondre par email
router.post('/:id/repondre', authMiddleware, isAdmin, messageClientController.repondreMessage);

module.exports = router;
