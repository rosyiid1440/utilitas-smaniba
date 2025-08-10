// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.showLoginForm);
router.post('/login', authController.handleLogin);
router.get('/logout', authController.handleLogout);

module.exports = router;