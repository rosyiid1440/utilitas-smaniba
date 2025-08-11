const express = require('express');
const router = express.Router();
const authLogController = require('../controllers/authLogController');

router.get('/', authLogController.viewAuthLogs);

module.exports = router;