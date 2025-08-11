// src/controllers/webappUserController.js
const db = require('../config/database');
const bcrypt = require('bcrypt');

// FUNGSI BARU YANG LENGKAP DENGAN FILTER & PAGINATION
exports.listUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 25;
        const offset = (page - 1) * limit;

        const { filter_username } = req.query;

        let whereClauses = ["role != 'admin'"];
        let queryParams = [];

        if (filter_username) {
            whereClauses.push("(username LIKE ? OR radius_username LIKE ?)");
            queryParams.push(`%${filter_username}%`, `%${filter_username}%`);
        }

        const whereSql = whereClauses.join(' AND ');

        const countQuery = `SELECT COUNT(*) AS total FROM webapp_users WHERE ${whereSql}`;
        const [countResult] = await db.query(countQuery, queryParams);
        const totalUsers = countResult[0].total;
        const totalPages = Math.ceil(totalUsers / limit);

        const mainQuery = `SELECT id, username, radius_username, role FROM webapp_users WHERE ${whereSql} ORDER BY username LIMIT ? OFFSET ?`;
        const [users] = await db.query(mainQuery, [...queryParams, limit, offset]);

        const message = req.query.message ? { type: req.query.type, text: req.query.message } : null;

        res.render('pages/webapp_users_list', {
            pageTitle: 'Manajemen Akun Web',
            users,
            totalPages,
            currentPage: page,
            currentFilters: { filter_username },
            message
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.resetPassword = async (req, res) => {
    const { userId, new_password } = req.body;
    if (!userId || !new_password) {
        return res.redirect('/webapp-users?type=error&message=Data tidak lengkap.');
    }
    try {
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await db.execute("UPDATE webapp_users SET password = ? WHERE id = ?", [hashedPassword, userId]);
        res.redirect('/webapp-users?type=success&message=Password berhasil direset.');
    } catch (error) {
        res.redirect(`/webapp-users?type=error&message=Gagal reset password.`);
    }
};

// Fungsi ini untuk hapus tunggal, bisa dipanggil dari form individual jika perlu
exports.deleteUser = async (req, res) => {
    const { userId } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await connection.execute("SELECT radius_username FROM webapp_users WHERE id = ?", [userId]);
        if (users.length > 0) {
            const radiusUsername = users[0].radius_username;
            await connection.execute("DELETE FROM webapp_users WHERE id = ?", [userId]);
            await connection.execute("DELETE FROM radcheck WHERE username = ?", [radiusUsername]);
            await connection.execute("DELETE FROM radusergroup WHERE username = ?", [radiusUsername]);
        }
        await connection.commit();
        res.redirect('/webapp-users?type=success&message=Pengguna berhasil dihapus.');
    } catch (error) {
        await connection.rollback();
        res.redirect(`/webapp-users?type=error&message=Gagal hapus pengguna.`);
    } finally {
        connection.release();
    }
};

// FUNGSI BARU UNTUK AKSI MASSAL
exports.batchAction = async (req, res) => {
    const { action, selected_users } = req.body;
    if (!action || !selected_users) {
        return res.redirect('/webapp-users?type=error&message=Aksi atau pengguna tidak dipilih.');
    }

    const usersToDelete = Array.isArray(selected_users) ? selected_users : [selected_users];
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        if (action === 'delete_selected') {
            for (const userId of usersToDelete) {
                const [users] = await connection.execute("SELECT radius_username FROM webapp_users WHERE id = ?", [userId]);
                if (users.length > 0) {
                    const radiusUsername = users[0].radius_username;
                    await connection.execute("DELETE FROM webapp_users WHERE id = ?", [userId]);
                    await connection.execute("DELETE FROM radcheck WHERE username = ?", [radiusUsername]);
                    await connection.execute("DELETE FROM radusergroup WHERE username = ?", [radiusUsername]);
                }
            }
        }

        await connection.commit();
        res.redirect('/webapp-users?type=success&message=Aksi massal berhasil diterapkan.');
    } catch (error) {
        await connection.rollback();
        res.redirect(`/webapp-users?type=error&message=Gagal terapkan aksi massal.`);
    } finally {
        connection.release();
    }
};