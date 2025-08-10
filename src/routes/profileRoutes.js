// src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// Menampilkan semua profil
router.get('/', profileController.listProfiles);

// Menampilkan form untuk membuat atau mengedit profil
router.get('/add', profileController.showProfileForm);
router.get('/edit/:profilename', profileController.showProfileForm);

// Menyimpan data profil (baik baru atau update)
router.post('/save', profileController.saveProfile);

// Menghapus profil
router.post('/delete/:profilename', profileController.deleteProfile);

module.exports = router;