// src/controllers/authLogController.js
const db = require('../config/database');

exports.viewAuthLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50; // Tampilkan 50 log per halaman
        const offset = (page - 1) * limit;

        const [countResult] = await db.query("SELECT COUNT(*) AS total FROM radpostauth");
        const totalLogs = countResult[0].total;
        const totalPages = Math.ceil(totalLogs / limit);

        const [logs] = await db.query(
            "SELECT username, reply, authdate FROM radpostauth ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        res.render('pages/auth_logs', {
            pageTitle: 'Log Autentikasi',
            logs,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};