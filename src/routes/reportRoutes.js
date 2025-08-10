const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Halaman utama (Dashboard)
router.get('/', reportController.showDashboard);

module.exports = router;