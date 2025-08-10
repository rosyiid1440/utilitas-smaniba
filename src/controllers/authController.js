// src/controllers/authController.js
const db = require('../config/database');
const bcrypt = require('bcrypt'); // Meskipun belum dipakai, ini praktik yang baik

exports.showLoginForm = (req, res) => {
    res.render('pages/login', {
        pageTitle: 'Login',
        layout: false // Tidak menggunakan layout utama
    });
};

exports.handleLogin = async (req, res) => {
    const { username, password } = req.body;

    // Admin tetap menggunakan .env untuk login
    const ADMIN_USERNAME = process.env.ADMIN_USER || 'admin';
    if (username === ADMIN_USERNAME && password === process.env.ADMIN_PASS) {
        req.session.user = { username: ADMIN_USERNAME, role: 'admin' };
        return res.redirect('/');
    }

    try {
        // Cari pengguna di tabel login web yang baru
        const [users] = await db.query("SELECT * FROM webapp_users WHERE username = ?", [username]);

        if (users.length > 0) {
            const user = users[0];
            // Bandingkan password yang diinput dengan hash di database
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                // Jika password cocok, buat sesi
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    radius_username: user.radius_username, // Simpan username RADIUS
                    role: user.role
                };
                return res.redirect('/'); // Arahkan ke halaman utama
            }
        }

        // Jika username tidak ditemukan atau password salah
        res.render('pages/login', {
            pageTitle: 'Login',
            layout: false,
            error: 'Username atau password salah.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.handleLogout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
};