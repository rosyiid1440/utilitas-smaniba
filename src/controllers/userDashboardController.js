// // src/controllers/userDashboardController.js
// const db = require('../config/database');

// exports.showUserDashboard = async (req, res) => {
//     try {
//         const { radius_username } = req.session.user;
//         const [wifiAccount] = await db.query(
//             "SELECT value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
//             [radius_username]
//         );

//         res.render('pages/user_dashboard', {
//             pageTitle: `Dashboard Pengguna: ${req.session.user.username}`,
//             user: req.session.user,
//             wifiPassword: wifiAccount.length > 0 ? wifiAccount[0].value : 'Tidak ditemukan'
//         });
//     } catch (error) {

//     }
// };

// exports.changePassword = async (req, res) => {
//     const { new_password, confirm_password } = req.body;
//     const { username, radius_username } = req.session.user;

//     if (!new_password || new_password !== confirm_password) {
//         return res.render('pages/user_dashboard', {
//             pageTitle: `Dashboard Pengguna: ${username}`,
//             user: req.session.user,
//             error: 'Password baru dan konfirmasi tidak cocok.'
//         });
//     }

//     try {
//         await db.execute(
//             "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'",
//             [new_password, radius_username] // Gunakan radius_username
//         );
//         res.redirect('/user-dashboard?status=success');
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Gagal mengubah password.');
//     }
// };

// exports.changeWebPassword = async (req, res) => {
//     const { current_password, new_password, confirm_password } = req.body;
//     const { id, username } = req.session.user;

//     // Ambil password Wi-Fi untuk ditampilkan kembali
//     const { radius_username } = req.session.user;
//     const [wifiAccount] = await db.query(
//         "SELECT value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
//         [radius_username]
//     );
//     const wifiPassword = wifiAccount.length > 0 ? wifiAccount[0].value : 'Tidak ditemukan';

//     const renderData = {
//         pageTitle: `Dashboard Pengguna: ${username}`,
//         user: req.session.user,
//         wifiPassword
//     };

//     if (!current_password || !new_password || !confirm_password) {
//         renderData.errorWeb = 'Semua field wajib diisi.';
//         return res.render('pages/user_dashboard', renderData);
//     }
//     if (new_password !== confirm_password) {
//         renderData.errorWeb = 'Password baru dan konfirmasi tidak cocok.';
//         return res.render('pages/user_dashboard', renderData);
//     }

//     try {
//         const [users] = await db.query("SELECT password FROM webapp_users WHERE id = ?", [id]);
//         if (users.length === 0) {
//             renderData.errorWeb = 'Pengguna tidak ditemukan.';
//             return res.render('pages/user_dashboard', renderData);
//         }

//         const passwordMatch = await bcrypt.compare(current_password, users[0].password);
//         if (!passwordMatch) {
//             renderData.errorWeb = 'Password saat ini salah.';
//             return res.render('pages/user_dashboard', renderData);
//         }

//         const hashedPassword = await bcrypt.hash(new_password, 10);
//         await db.execute("UPDATE webapp_users SET password = ? WHERE id = ?", [hashedPassword, id]);

//         renderData.successWeb = 'Password login web berhasil diubah.';
//         res.render('pages/user_dashboard', renderData);

//     } catch (error) {
//         console.error(error);
//         renderData.errorWeb = 'Terjadi kesalahan pada server.';
//         res.render('pages/user_dashboard', renderData);
//     }
// };

// src/controllers/userDashboardController.js
const db = require('../config/database');
const bcrypt = require('bcrypt');

// FUNGSI UTAMA YANG DIPERBAIKI
exports.showUserDashboard = async (req, res) => {
    try {
        // Ambil username RADIUS dari sesi Keycloak. Pastikan nama propertinya benar.
        // Berdasarkan setup Keycloak kita, username aplikasi (NISN) adalah `preferred_username`.
        // Kita perlu menghubungkannya ke `radius_username` dari tabel `webapp_users`.
        const webUsername = req.kauth.grant.access_token.content.preferred_username;

        const [webappUser] = await db.query("SELECT radius_username FROM webapp_users WHERE username = ?", [webUsername]);

        if (!webappUser || webappUser.length === 0) {
            // Jika akun webapp tidak ditemukan (misal: belum disinkronisasi), tampilkan pesan error
            return res.status(404).send('Akun Anda tidak ditemukan di database lokal. Harap hubungi admin.');
        }

        const radiusUsername = webappUser[0].radius_username;

        // Ambil password Wi-Fi saat ini dari radcheck
        const [wifiAccount] = await db.query(
            "SELECT value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
            [radiusUsername]
        );

        res.render('pages/user_dashboard', {
            pageTitle: `Dashboard Pengguna: ${webUsername}`,
            // Kirim data user dari sesi Keycloak
            user: {
                username: webUsername,
                radius_username: radiusUsername
            },
            wifiPassword: wifiAccount.length > 0 ? wifiAccount[0].value : 'Tidak Ditemukan',
            // Untuk menampilkan pesan notifikasi
            query: req.query
        });

    } catch (error) {
        console.error("Gagal menampilkan dashboard pengguna:", error);
        res.status(500).send('Terjadi kesalahan pada server saat memuat dashboard Anda.');
    }
};

// Fungsi ubah password Wi-Fi (sedikit disesuaikan)
exports.changePassword = async (req, res) => {
    const { new_password, confirm_password } = req.body;
    const webUsername = req.kauth.grant.access_token.content.preferred_username;

    if (!new_password || new_password !== confirm_password) {
        return res.redirect('/user-dashboard?status=error&message=Password tidak cocok.');
    }

    try {
        const [webappUser] = await db.query("SELECT radius_username FROM webapp_users WHERE username = ?", [webUsername]);
        if (!webappUser || webappUser.length === 0) {
            return res.status(404).send('Akun Anda tidak ditemukan.');
        }
        const radiusUsername = webappUser[0].radius_username;

        await db.execute(
            "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'",
            [new_password, radiusUsername]
        );
        res.redirect('/user-dashboard?status=success');

    } catch (error) {
        console.error(error);
        res.redirect('/user-dashboard?status=error&message=Gagal ubah password.');
    }
};

// Fungsi ubah password webapp (sedikit disesuaikan)
exports.changeWebPassword = async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    const webUsername = req.kauth.grant.access_token.content.preferred_username;

    // Logika di sini sekarang harus memverifikasi password via Keycloak API atau
    // jika Anda ingin tetap independen, Anda harus menyimpan hash password juga di webapp_users
    // Untuk saat ini, kita akan asumsikan verifikasi password dilakukan di sini.

    // ... (Logika lengkap untuk changeWebPassword dari respons sebelumnya) ...
    // Pastikan semua redirect diarahkan kembali dengan benar
};