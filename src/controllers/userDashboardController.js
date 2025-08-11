// src/controllers/userDashboardController.js
const db = require('../config/database');

exports.showUserDashboard = async (req, res) => {
    try {
        const { radius_username } = req.session.user;
        const [wifiAccount] = await db.query(
            "SELECT value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
            [radius_username]
        );

        res.render('pages/user_dashboard', {
            pageTitle: `Dashboard Pengguna: ${req.session.user.username}`,
            user: req.session.user,
            wifiPassword: wifiAccount.length > 0 ? wifiAccount[0].value : 'Tidak ditemukan'
        });
    } catch (error) {

    }
};

exports.changePassword = async (req, res) => {
    const { new_password, confirm_password } = req.body;
    const { username, radius_username } = req.session.user;

    if (!new_password || new_password !== confirm_password) {
        return res.render('pages/user_dashboard', {
            pageTitle: `Dashboard Pengguna: ${username}`,
            user: req.session.user,
            error: 'Password baru dan konfirmasi tidak cocok.'
        });
    }

    try {
        await db.execute(
            "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'",
            [new_password, radius_username] // Gunakan radius_username
        );
        res.redirect('/user-dashboard?status=success');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal mengubah password.');
    }
};

exports.changeWebPassword = async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    const { id, username } = req.session.user;

    // Ambil password Wi-Fi untuk ditampilkan kembali
    const { radius_username } = req.session.user;
    const [wifiAccount] = await db.query(
        "SELECT value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
        [radius_username]
    );
    const wifiPassword = wifiAccount.length > 0 ? wifiAccount[0].value : 'Tidak ditemukan';

    const renderData = {
        pageTitle: `Dashboard Pengguna: ${username}`,
        user: req.session.user,
        wifiPassword
    };

    if (!current_password || !new_password || !confirm_password) {
        renderData.errorWeb = 'Semua field wajib diisi.';
        return res.render('pages/user_dashboard', renderData);
    }
    if (new_password !== confirm_password) {
        renderData.errorWeb = 'Password baru dan konfirmasi tidak cocok.';
        return res.render('pages/user_dashboard', renderData);
    }

    try {
        const [users] = await db.query("SELECT password FROM webapp_users WHERE id = ?", [id]);
        if (users.length === 0) {
            renderData.errorWeb = 'Pengguna tidak ditemukan.';
            return res.render('pages/user_dashboard', renderData);
        }

        const passwordMatch = await bcrypt.compare(current_password, users[0].password);
        if (!passwordMatch) {
            renderData.errorWeb = 'Password saat ini salah.';
            return res.render('pages/user_dashboard', renderData);
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await db.execute("UPDATE webapp_users SET password = ? WHERE id = ?", [hashedPassword, id]);

        renderData.successWeb = 'Password login web berhasil diubah.';
        res.render('pages/user_dashboard', renderData);

    } catch (error) {
        console.error(error);
        renderData.errorWeb = 'Terjadi kesalahan pada server.';
        res.render('pages/user_dashboard', renderData);
    }
};