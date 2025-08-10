const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const multer = require('multer'); // Import multer
const upload = multer({ dest: 'uploads/' }); // Tentukan folder sementara

// Menampilkan semua pengguna
router.get('/', userController.listUsers);

// Menampilkan form tambah pengguna
router.get('/add', userController.showAddForm);

// Memproses penambahan pengguna baru
router.post('/add', userController.addUser);

// Menampilkan form edit pengguna
router.get('/edit/:username', userController.showEditForm);

// Memproses update pengguna
router.post('/edit/:username', userController.updateUser);

// Menghapus pengguna
router.post('/delete/:username', userController.deleteUser);

// Rute untuk menampilkan form impor
router.get('/import', userController.showImportForm);

// Rute untuk memproses file CSV yang diunggah
router.post('/import', upload.single('userfile'), userController.importFromCsv);

router.post('/batch-action', userController.batchAction);

module.exports = router;