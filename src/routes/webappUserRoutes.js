// src/routes/webappUserRoutes.js
const express = require('express');
const router = express.Router();
const webappUserController = require('../controllers/webappUserController');

router.get('/', webappUserController.listUsers);
router.post('/reset-password', webappUserController.resetPassword);
router.post('/delete', webappUserController.deleteUser);
router.post('/batch-action', webappUserController.batchAction); // Rute baru

module.exports = router;