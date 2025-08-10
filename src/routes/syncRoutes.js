// src/routes/syncRoutes.js
const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// Halaman untuk menampilkan tombol sinkronisasi
router.get('/', syncController.showSyncPage);

// Rute untuk menjalankan proses sinkronisasi
router.post('/', syncController.runSync);

// Menjalankan LANGKAH 2: Proses data dari halaman review dan impor ke DB
router.post('/finalize', syncController.finalizeSync);

module.exports = router;