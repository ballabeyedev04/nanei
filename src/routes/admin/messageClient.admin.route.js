const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/messageClient.admin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

// GET /nanei/admin/messages/stats
router.get('/stats', authMiddleware, isAdmin, controller.getNombreMessages);

// GET /nanei/admin/messages
router.get('/', authMiddleware, isAdmin, controller.getTousMessages);

// POST /nanei/admin/messages/:id/repondre
router.post('/:id/repondre', authMiddleware, isAdmin, controller.repondreMessage);

module.exports = router;
