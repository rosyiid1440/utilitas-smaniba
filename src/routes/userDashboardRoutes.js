// src/routes/userDashboardRoutes.js
const express = require('express');
const router = express.Router();
const userDashboardController = require('../controllers/userDashboardController');

router.get('/', userDashboardController.showUserDashboard);
router.post('/change-password', userDashboardController.changePassword);
router.post('/change-web-password', userDashboardController.changeWebPassword);

module.exports = router;