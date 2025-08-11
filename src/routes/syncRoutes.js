// src/routes/syncRoutes.js
const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// Halaman untuk menampilkan tombol sinkronisasi
router.get('/', syncController.showSyncPage);

// Rute untuk SINKRONISASI SISWA
router.post('/students', syncController.runStudentSync);
router.post('/students/finalize', syncController.finalizeStudentSync);

// Rute untuk SINKRONISASI GURU
router.post('/teachers', syncController.runTeacherSync);

module.exports = router;