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