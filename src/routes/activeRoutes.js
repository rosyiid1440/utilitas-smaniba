// src/routes/activeRoutes.js
const express = require('express');
const router = express.Router();
const activeController = require('../controllers/activeController');

router.get('/', activeController.listActiveUsers);
router.post('/disconnect', activeController.disconnectUser);

module.exports = router;