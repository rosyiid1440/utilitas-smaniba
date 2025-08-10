// src/routes/nasRoutes.js
const express = require('express');
const router = express.Router();
const nasController = require('../controllers/nasController');

router.get('/', nasController.listNas);
router.get('/add', nasController.showNasForm);
router.post('/add', nasController.saveNas);
router.get('/edit/:id', nasController.showNasForm);
router.post('/edit/:id', nasController.saveNas);
router.post('/delete/:id', nasController.deleteNas);

module.exports = router;