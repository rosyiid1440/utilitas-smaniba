// src/routes/reportApiRoutes.js
const express = require('express');
const router = express.Router();
const reportApiController = require('../controllers/reportApiController');

router.get('/online-users-hourly', reportApiController.getOnlineUsersHourly);
router.get('/daily-usage', reportApiController.getDailyUsage);

// TAMBAHKAN DUA RUTE BARU DI BAWAH INI
router.get('/top-data-users', reportApiController.getTopDataUsers);
router.get('/profile-distribution', reportApiController.getProfileDistribution);

module.exports = router;