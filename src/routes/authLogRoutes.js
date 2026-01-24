const express = require('express');
const router = express.Router();
const authLogController = require('../controllers/authLogController');

router.get('/', authLogController.viewAuthLogs);
router.post('/cleanup', authLogController.cleanupOldLogs);
router.post('/clear-all', authLogController.clearAllLogs);
router.post('/cleanup-accounting', authLogController.cleanupOldAccounting);
router.post('/clear-all-accounting', authLogController.clearAllAccounting);

module.exports = router;