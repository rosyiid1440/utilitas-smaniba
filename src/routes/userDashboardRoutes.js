// src/routes/userDashboardRoutes.js
const express = require('express');
const router = express.Router();
const userDashboardController = require('../controllers/userDashboardController');

router.get('/', userDashboardController.showUserDashboard);
router.post('/change-password', userDashboardController.changePassword);

module.exports = router;