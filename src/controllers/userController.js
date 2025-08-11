const db = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify');

// Menampilkan daftar semua pengguna
exports.listUsers = async (req, res) => {
    try {
        // --- PAGINATION & FILTER SETUP ---
        const page = parseInt(req.query.page) || 1;
        const { filter_username, filter_groupname, show } = req.query;
        const isShowingAll = show === 'all';

        // --- DYNAMIC WHERE CLAUSE ---
        let whereClauses = ["rc.attribute = 'Cleartext-Password'"];
        let queryParams = [];
        if (filter_username) {
            whereClauses.push("rc.username LIKE ?");
            queryParams.push(`%${filter_username}%`);
        }
        if (filter_groupname) {
            whereClauses.push(`(SELECT groupname FROM radusergroup WHERE username = rc.username LIMIT 1) = ?`);
            queryParams.push(filter_groupname);
        }
        const whereSql = whereClauses.join(' AND ');

        // --- DYNAMIC QUERY BUILDING ---
        const countQuery = `
            SELECT COUNT(DISTINCT rc.username) AS total 
            FROM radcheck rc LEFT JOIN webapp_users wu ON rc.username = wu.radius_username
            WHERE ${whereSql}
        `;
        const [countResult] = await db.query(countQuery, queryParams);
        const totalUsers = countResult[0].total;

        // --- Logic untuk Pagination atau Tampilkan Semua ---
        let limitSql = '';
        let queryParamsMain = [...queryParams];
        let totalPages = 1;

        if (!isShowingAll) {
            const limit = 25;
            const offset = (page - 1) * limit;
            totalPages = Math.ceil(totalUsers / limit);
            limitSql = `LIMIT ? OFFSET ?`;
            queryParamsMain.push(limit, offset);
        }

        const mainQuery = `
            SELECT rc.username, wu.username AS nisn, MAX(rc.value) AS password,
                   (SELECT groupname FROM radusergroup WHERE username = rc.username LIMIT 1) AS groupname
            FROM radcheck rc
            LEFT JOIN webapp_users wu ON rc.username = wu.radius_username
            WHERE ${whereSql}
            GROUP BY rc.username, wu.username
            ORDER BY rc.username ASC
            ${limitSql}
        `;
        const [users] = await db.query(mainQuery, queryParamsMain);

        // ... sisa kode fungsi tetap sama ...
        const [profiles] = await db.query(`SELECT DISTINCT groupname FROM radgroupreply ORDER BY groupname`);
        const message = req.query.message ? { type: req.query.type, text: req.query.message } : null;

        res.render('pages/users', {
            pageTitle: 'Manajemen Pengguna',
            users,
            profiles,
            totalPages,
            currentPage: page,
            currentFilters: { filter_username, filter_groupname },
            isShowingAll, // Kirim status "tampilkan semua" ke view
            message
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// Menampilkan form tambah
exports.showAddForm = async (req, res) => {
    try {
        // Ambil daftar semua profil yang tersedia
        const [profiles] = await db.query(`
            SELECT DISTINCT groupname FROM radgroupcheck
            UNION
            SELECT DISTINCT groupname FROM radgroupreply
            ORDER BY groupname;
        `);

        res.render('pages/user_form', {
            pageTitle: 'Tambah Pengguna Baru',
            user: null,
            action: '/users/add',
            profiles: profiles // Kirim daftar profil ke view
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// Menambahkan pengguna baru
exports.addUser = async (req, res) => {
    const { username, password, groupname, login_time_days, login_time_hours } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username dan Password wajib diisi.');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Insert password
        await connection.execute(
            "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)",
            [username, password]
        );
        // Insert group if provided
        if (groupname) {
            await connection.execute(
                "INSERT INTO radusergroup (username, groupname) VALUES (?, ?)",
                [username, groupname]
            );
        }

        await connection.execute("DELETE FROM radcheck WHERE username = ? AND attribute = 'Login-Time'", [username]);
        if (login_time_days && login_time_hours) {
            const loginTimeString = `${login_time_days.trim()}${login_time_hours.trim()}`;
            await connection.execute(
                "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Login-Time', ':=', ?)",
                [username, loginTimeString]
            );
        }

        await connection.commit();
        res.redirect('/users');
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).send('Gagal menambah pengguna. Mungkin username sudah ada.');
    } finally {
        connection.release();
    }
};

// Menampilkan form edit
exports.showEditForm = async (req, res) => {
    try {
        const { username } = req.params;

        // Ambil daftar semua profil yang tersedia
        const [profiles] = await db.query(`
            SELECT DISTINCT groupname FROM radgroupcheck
            UNION
            SELECT DISTINCT groupname FROM radgroupreply
            ORDER BY groupname;
        `);

        const [users] = await db.execute("SELECT username FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'", [username]);
        if (users.length === 0) return res.status(404).send('Pengguna tidak ditemukan.');

        const user = users[0];

        // Ambil profil (grup) pengguna saat ini
        const [groups] = await db.execute("SELECT groupname FROM radusergroup WHERE username = ?", [username]);
        user.groupname = groups.length > 0 ? groups[0].groupname : '';

        // Ambil jadwal Login-Time pengguna (jika ada)
        const [loginTimes] = await db.execute("SELECT value FROM radcheck WHERE username = ? AND attribute = 'Login-Time'", [username]);
        if (loginTimes.length > 0) {
            const timeValue = loginTimes[0].value;
            const parts = timeValue.split(/(\d{4}-\d{4})/);
            user.loginTimeDays = parts[0] || '';
            user.loginTimeHours = parts[1] || '';
        }

        res.render('pages/user_form', {
            pageTitle: 'Edit Pengguna',
            user,
            action: `/users/edit/${username}`,
            profiles: profiles // Kirim daftar profil ke view
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// Update pengguna
exports.updateUser = async (req, res) => {
    const { username } = req.params;
    const { password, groupname, login_time_days, login_time_hours } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Update password jika diisi
        if (password) {
            await connection.execute(
                "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'",
                [password, username]
            );
        }

        // Hapus grup lama dan insert grup baru
        await connection.execute("DELETE FROM radusergroup WHERE username = ?", [username]);
        if (groupname) {
            await connection.execute(
                "INSERT INTO radusergroup (username, groupname) VALUES (?, ?)",
                [username, groupname]
            );
        }

        await connection.execute("DELETE FROM radcheck WHERE username = ? AND attribute = 'Login-Time'", [username]);
        if (login_time_days && login_time_hours) {
            const loginTimeString = `${login_time_days.trim()}${login_time_hours.trim()}`;
            await connection.execute(
                "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Login-Time', ':=', ?)",
                [username, loginTimeString]
            );
        }

        await connection.commit();
        res.redirect('/users');
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).send('Gagal mengupdate pengguna.');
    } finally {
        connection.release();
    }
};

// Hapus pengguna
exports.deleteUser = async (req, res) => {
    const { username } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Hapus dari semua tabel relevan
        await connection.execute("DELETE FROM radcheck WHERE username = ?", [username]);
        await connection.execute("DELETE FROM radusergroup WHERE username = ?", [username]);
        await connection.execute("DELETE FROM radreply WHERE username = ?", [username]);
        await connection.execute("DELETE FROM radacct WHERE username = ?", [username]);
        await connection.commit();
        res.redirect('/users');
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).send('Gagal menghapus pengguna.');
    } finally {
        connection.release();
    }
};

// Fungsi untuk menampilkan halaman form impor
exports.showImportForm = (req, res) => {
    // Mengambil pesan flash jika ada (misal setelah redirect)
    const message = req.query.message ? {
        type: req.query.type,
        text: req.query.message
    } : null;

    res.render('pages/user_import', {
        pageTitle: 'Impor Pengguna',
        message
    });
};

// Fungsi untuk memproses file CSV
exports.importFromCsv = async (req, res) => {
    if (!req.file) {
        return res.redirect('/users/import?type=error&message=File tidak ditemukan.');
    }

    const results = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
        .pipe(csv({ headers: ['nisn', 'nama_lengkap', 'kelas'], skipLines: 1 }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            fs.unlinkSync(filePath);

            if (results.length === 0) {
                return res.redirect('/users/import?type=error&message=File CSV kosong atau format salah.');
            }

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                for (const user of results) {
                    const webUsername = user.nisn.trim(); // Username untuk login web
                    const radiusUsername = user.nis.trim(); // Username untuk Wi-Fi
                    const groupname = user.kelas.trim();

                    if (!webUsername || !groupname) continue;

                    // 1. Buat password acak untuk Wi-Fi
                    const wifiPassword = Math.random().toString(36).substring(2, 10);

                    // 2. Buat password untuk login web (awalnya sama dengan NISN) dan hash
                    const webPassword = webUsername;
                    const hashedPassword = await bcrypt.hash(webPassword, 10);

                    // Hapus data lama untuk menghindari duplikat di semua tabel
                    await connection.execute("DELETE FROM radcheck WHERE username = ?", [radiusUsername]);
                    await connection.execute("DELETE FROM radusergroup WHERE username = ?", [radiusUsername]);
                    await connection.execute("DELETE FROM webapp_users WHERE username = ?", [webUsername]);

                    // 3. Masukkan akun Wi-Fi ke radcheck
                    await connection.execute(
                        "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)",
                        [radiusUsername, wifiPassword]
                    );
                    await connection.execute(
                        "INSERT INTO radusergroup (username, groupname) VALUES (?, ?)",
                        [radiusUsername, groupname]
                    );

                    // 4. Masukkan akun login web ke webapp_users
                    await connection.execute(
                        "INSERT INTO webapp_users (username, password, radius_username, role) VALUES (?, ?, ?, 'user')",
                        [webUsername, hashedPassword, radiusUsername]
                    );
                }
                await connection.commit();
                res.redirect(`/users/import?type=success&message=${results.length} pengguna berhasil diimpor.`);
            } catch (error) {
                await connection.rollback();
                console.error(error);
                res.redirect(`/users/import?type=error&message=Terjadi kesalahan saat impor database.`);
            } finally {
                connection.release();
            }
        });
};

// Tambahkan fungsi ini di akhir file userController.js
exports.batchAction = async (req, res) => {
    const { action, target_profile, selected_users } = req.body;

    if (!action) {
        return res.redirect('/users?type=error&message=Aksi tidak dipilih.');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        switch (action) {
            case 'change_profile':
                if (!selected_users || !target_profile) {
                    throw new Error('Pengguna atau profil tujuan tidak dipilih.');
                }
                const usersToChange = Array.isArray(selected_users) ? selected_users : [selected_users];
                for (const username of usersToChange) {
                    // Hapus dari grup lama, lalu masukkan ke grup baru
                    await connection.execute("DELETE FROM radusergroup WHERE username = ?", [username]);
                    await connection.execute("INSERT INTO radusergroup (username, groupname) VALUES (?, ?)", [username, target_profile]);
                }
                break;

            case 'delete_selected':
                if (!selected_users) {
                    throw new Error('Tidak ada pengguna yang dipilih.');
                }
                const usersToDelete = Array.isArray(selected_users) ? selected_users : [selected_users];
                for (const username of usersToDelete) {
                    await connection.execute("DELETE FROM radcheck WHERE username = ?", [username]);
                    await connection.execute("DELETE FROM radusergroup WHERE username = ?", [username]);
                    // Tambahkan tabel lain jika perlu
                }
                break;

            case 'delete_by_group':
                if (!target_profile) {
                    throw new Error('Profil yang akan dihapus tidak dipilih.');
                }
                // Dapatkan semua user di grup target
                const [usersInGroup] = await connection.execute("SELECT username FROM radusergroup WHERE groupname = ?", [target_profile]);
                if (usersInGroup.length > 0) {
                    for (const user of usersInGroup) {
                        await connection.execute("DELETE FROM radcheck WHERE username = ?", [user.username]);
                        await connection.execute("DELETE FROM radusergroup WHERE username = ?", [user.username]);
                        // Tambahkan tabel lain jika perlu
                    }
                }
                break;

            default:
                throw new Error('Aksi tidak valid.');
        }

        await connection.commit();
        res.redirect('/users?type=success&message=Aksi massal berhasil dilaksanakan.');

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.redirect(`/users?type=error&message=${error.message}`);
    } finally {
        connection.release();
    }
};

exports.exportUsersCsv = async (req, res) => {
    try {
        const { filter_username, filter_groupname } = req.query;

        // Logika filter sama persis seperti di fungsi listUsers
        let whereClauses = ["rc.attribute = 'Cleartext-Password'"];
        let queryParams = [];
        if (filter_username) {
            whereClauses.push("rc.username LIKE ?");
            queryParams.push(`%${filter_username}%`);
        }
        if (filter_groupname) {
            whereClauses.push(`(SELECT groupname FROM radusergroup WHERE username = rc.username LIMIT 1) = ?`);
            queryParams.push(filter_groupname);
        }
        const whereSql = whereClauses.join(' AND ');

        // Query untuk mengambil SEMUA pengguna yang cocok (tanpa LIMIT/pagination)
        const query = `
            SELECT 
                wu.username AS nisn,
                rc.username, 
                MAX(rc.value) AS password,
                (SELECT groupname FROM radusergroup WHERE username = rc.username LIMIT 1) AS groupname
            FROM radcheck rc
            LEFT JOIN webapp_users wu ON rc.username = wu.radius_username
            WHERE ${whereSql}
            GROUP BY rc.username, wu.username
            ORDER BY rc.username ASC
        `;
        const [users] = await db.query(query, queryParams);

        // Siapkan header untuk file CSV
        const columns = [
            "NISN (Login Web)",
            "Username Wi-Fi (NIS)",
            "Password Wi-Fi",
            "Profil"
        ];

        // Atur header response agar browser men-download file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="daftar-pengguna-wifi-${Date.now()}.csv"`);

        // Buat dan kirim data CSV
        stringify(users, {
            header: true,
            columns: {
                nisn: columns[0],
                username: columns[1],
                password: columns[2],
                groupname: columns[3]
            }
        }).pipe(res);

    } catch (error) {
        console.error("Gagal mengekspor data:", error);
        res.status(500).send("Terjadi kesalahan saat membuat file ekspor.");
    }
};