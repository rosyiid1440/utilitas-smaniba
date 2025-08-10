require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts'); // <-- TAMBAHKAN INI
const session = require('express-session'); // Import session

// Import routes
const authMiddleware = require('./src/middleware/authMiddleware');
const authRoutes = require('./src/routes/authRoutes');
const userDashboardRoutes = require('./src/routes/userDashboardRoutes');
const userRoutes = require('./src/routes/userRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const nasRoutes = require('./src/routes/nasRoutes');
const activeRoutes = require('./src/routes/activeRoutes');
const syncRoutes = require('./src/routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Session
app.use(session({
    secret: 'kunci-rahasia-jangan-disebar', // Ganti dengan secret yang kuat
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } // Sesi 1 jam
}));

// Middleware untuk membuat data user tersedia di semua view
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Set up view engine
app.set('layout', 'layouts/mainLayout'); // <-- ATUR LAYOUT DEFAULT DI SINI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Middleware
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.json()); // Parse JSON bodies

// Routes
// --- ROUTING ---
// Rute Publik (Login)
app.use('/', authRoutes);

// Rute Dashboard Pengguna (Siswa)
app.use('/user-dashboard', authMiddleware.isLoggedIn, authMiddleware.isUser, userDashboardRoutes);

// Rute Admin (Semua rute lama kita)
app.use('/dashboard-admin', authMiddleware.isLoggedIn, authMiddleware.isAdmin, reportRoutes);
app.use('/users', authMiddleware.isLoggedIn, authMiddleware.isAdmin, userRoutes);
app.use('/profiles', authMiddleware.isLoggedIn, authMiddleware.isAdmin, profileRoutes);
app.use('/nas', authMiddleware.isLoggedIn, authMiddleware.isAdmin, nasRoutes);
app.use('/active-users', authMiddleware.isLoggedIn, authMiddleware.isAdmin, activeRoutes);
app.use('/sync', authMiddleware.isLoggedIn, authMiddleware.isAdmin, syncRoutes); // TAMBAHKAN INI
app.use('/dashboard-admin', authMiddleware.isLoggedIn, authMiddleware.isAdmin, reportRoutes);

// Redirect halaman utama berdasarkan peran
app.get('/', authMiddleware.isLoggedIn, (req, res) => {
    if (req.session.user.role === 'admin') {
        res.redirect('/dashboard-admin');
    } else {
        res.redirect('/user-dashboard');
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('pages/404', {
        pageTitle: 'Halaman Tidak Ditemukan'
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});