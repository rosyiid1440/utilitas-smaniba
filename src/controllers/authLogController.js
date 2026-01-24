// src/controllers/authLogController.js
const db = require('../config/database');

exports.viewAuthLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50; // Tampilkan 50 log per halaman
        const offset = (page - 1) * limit;

        // Get counts for both tables
        const [countResult] = await db.query("SELECT COUNT(*) AS total FROM radpostauth");
        const totalLogs = countResult[0].total;
        const totalPages = Math.ceil(totalLogs / limit);

        const [acctCountResult] = await db.query("SELECT COUNT(*) AS total FROM radacct");
        const totalAcctRecords = acctCountResult[0].total;

        const [logs] = await db.query(
            "SELECT username, reply, reason, authdate FROM radpostauth ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        const message = req.query.message ? { type: req.query.type, text: req.query.message } : null;

        res.render('pages/auth_logs', {
            pageTitle: 'Log Autentikasi',
            logs,
            totalPages,
            currentPage: page,
            totalLogs,
            totalAcctRecords,
            message
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// Fungsi untuk membersihkan log autentikasi lama
exports.cleanupOldLogs = async (req, res) => {
    const { retention_days } = req.body;
    const days = parseInt(retention_days) || 30; // Default 30 hari

    try {
        const [result] = await db.query(
            "DELETE FROM radpostauth WHERE authdate < DATE_SUB(NOW(), INTERVAL ? DAY)",
            [days]
        );

        const deletedCount = result.affectedRows;
        res.redirect(`/auth-logs?type=success&message=Berhasil menghapus ${deletedCount} log autentikasi yang lebih lama dari ${days} hari.`);
    } catch (error) {
        console.error(error);
        res.redirect('/auth-logs?type=error&message=Gagal membersihkan log autentikasi.');
    }
};

// Fungsi untuk membersihkan data accounting lama
exports.cleanupOldAccounting = async (req, res) => {
    const { retention_days } = req.body;
    const days = parseInt(retention_days) || 30; // Default 30 hari

    try {
        const [result] = await db.query(
            "DELETE FROM radacct WHERE acctstarttime < DATE_SUB(NOW(), INTERVAL ? DAY)",
            [days]
        );

        const deletedCount = result.affectedRows;
        res.redirect(`/auth-logs?type=success&message=Berhasil menghapus ${deletedCount} record accounting yang lebih lama dari ${days} hari.`);
    } catch (error) {
        console.error(error);
        res.redirect('/auth-logs?type=error&message=Gagal membersihkan data accounting.');
    }
};

// Fungsi untuk menghapus semua log autentikasi
exports.clearAllLogs = async (req, res) => {
    try {
        const [result] = await db.query("DELETE FROM radpostauth");
        const deletedCount = result.affectedRows;
        res.redirect(`/auth-logs?type=success&message=Berhasil menghapus semua ${deletedCount} log autentikasi.`);
    } catch (error) {
        console.error(error);
        res.redirect('/auth-logs?type=error&message=Gagal menghapus log autentikasi.');
    }
};

// Fungsi untuk menghapus semua data accounting
exports.clearAllAccounting = async (req, res) => {
    try {
        const [result] = await db.query("DELETE FROM radacct");
        const deletedCount = result.affectedRows;
        res.redirect(`/auth-logs?type=success&message=Berhasil menghapus semua ${deletedCount} record accounting.`);
    } catch (error) {
        console.error(error);
        res.redirect('/auth-logs?type=error&message=Gagal menghapus data accounting.');
    }
};