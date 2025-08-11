// src/controllers/syncController.js
const db = require('../config/database');
const bcrypt = require('bcrypt');

// Menampilkan halaman sinkronisasi
exports.showSyncPage = async (req, res) => {
    try {
        const message = req.query.message ? {
            type: req.query.type,
            text: req.query.message
        } : null;

        // Ambil daftar semua profil yang tersedia
        const [profiles] = await db.query(`
            SELECT DISTINCT groupname FROM radgroupreply ORDER BY groupname
        `);

        res.render('pages/sync_page', {
            pageTitle: 'Sinkronisasi Data Siswa',
            message,
            profiles // Kirim daftar profil ke view
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// Menjalankan proses sinkronisasi
// exports.runSync = async (req, res) => {
//     const API_URL = 'https://data-master.sman1balongpanggang.sch.id/api/siswa';
//     const { target_profile } = req.body; // Ambil profil yang dipilih dari form

//     try {
//         // 1. Ambil data dari API
//         console.log('Fetching data from API...');

//         const fetchOptions = {
//             method: 'GET',
//             headers: {
//                 'Authorization': process.env.API_MASTER_TOKEN,
//                 'Content-Type': 'application/json'
//             }
//         };

//         const apiResponse = await fetch(API_URL, fetchOptions);

//         if (!apiResponse.ok) {
//             throw new Error(`Gagal mengambil data dari API. Status: ${apiResponse.status}`);
//         }
//         const students = await apiResponse.json();
//         console.log(`Successfully fetched ${students.length} student records.`);

//         // 2. Proses data dan masukkan ke database
//         const connection = await db.getConnection();
//         let addedCount = 0;
//         let updatedCount = 0;
//         let skippedCount = 0;

//         try {
//             await connection.beginTransaction();

//             for (const student of students) {
//                 if (student.status !== 'Aktif' || !student.nisn || !student.id_kelas_detail.kelas) {
//                     skippedCount++;
//                     continue; // Lewati siswa yang tidak aktif atau data tidak lengkap
//                 }

//                 const webUsername = student.nisn.trim();
//                 const radiusUsername = student.no_induk.trim();
//                 const groupname = target_profile;

//                 // Cek apakah user sudah ada
//                 const [existingUser] = await connection.execute("SELECT id FROM webapp_users WHERE username = ?", [webUsername]);
//                 const isUpdate = existingUser.length > 0;

//                 // Buat password acak untuk Wi-Fi
//                 const wifiPassword = Math.random().toString(36).substring(2, 10);

//                 // Hapus data lama di tabel RADIUS untuk memastikan data profil terbaru
//                 await connection.execute("DELETE FROM radcheck WHERE username = ?", [radiusUsername]);
//                 await connection.execute("DELETE FROM radusergroup WHERE username = ?", [radiusUsername]);

//                 // Masukkan data Wi-Fi yang baru/diperbarui
//                 await connection.execute(
//                     "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)",
//                     [radiusUsername, wifiPassword]
//                 );
//                 await connection.execute(
//                     "INSERT INTO radusergroup (username, groupname) VALUES (?, ?)",
//                     [radiusUsername, groupname]
//                 );

//                 if (isUpdate) {
//                     // Jika user sudah ada, hanya update data RADIUS nya saja (sudah dilakukan di atas)
//                     updatedCount++;
//                 } else {
//                     // Jika user baru, buat juga akun webapp nya
//                     const webPassword = webUsername; // Password login web awal = NISN
//                     const hashedPassword = await bcrypt.hash(webPassword, 10);

//                     await connection.execute(
//                         "INSERT INTO webapp_users (username, password, radius_username, role) VALUES (?, ?, ?, 'user')",
//                         [webUsername, hashedPassword, radiusUsername]
//                     );
//                     addedCount++;
//                 }
//             }

//             await connection.commit();
//             const successMessage = `Sinkronisasi Selesai. Pengguna Baru: ${addedCount}, Diperbarui: ${updatedCount}, Dilewati: ${skippedCount}.`;
//             res.redirect(`/sync?type=success&message=${encodeURIComponent(successMessage)}`);

//         } catch (dbError) {
//             await connection.rollback();
//             throw dbError; // Lemparkan error agar ditangkap oleh blok catch luar
//         } finally {
//             connection.release();
//         }

//     } catch (error) {
//         console.error('Sync process failed:', error);
//         res.redirect(`/sync?type=error&message=${encodeURIComponent(error.message)}`);
//     }
// };

// LANGKAH 1: MENGAMBIL DATA DARI API DAN MENAMPILKAN HALAMAN REVIEW
exports.runStudentSync = async (req, res) => {
    const API_URL = 'https://data-master.sman1balongpanggang.sch.id/api/siswa';
    const { target_profile } = req.body; // Ambil profil yang dipilih

    if (!target_profile) {
        return res.redirect(`/sync?type=error&message=Anda harus memilih profil tujuan.`);
    }

    try {
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Authorization': `${process.env.API_MASTER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        const apiResponse = await fetch(API_URL, fetchOptions);
        if (!apiResponse.ok) throw new Error(`Gagal mengambil data dari API. Status: ${apiResponse.status}`);

        const students = await apiResponse.json();
        if (!Array.isArray(students)) {
            throw new Error('Data yang diterima dari API bukan dalam format array yang valid.');
        }

        // Kelompokkan siswa berdasarkan kelas
        const groupedStudents = students.reduce((acc, student) => {
            // Pastikan data yang dibutuhkan ada dan siswa aktif
            if (student.status === 'Aktif' && student.id_kelas_detail && student.id_kelas_detail.tingkat) {
                const classLevel = `Tingkat ${student.id_kelas_detail.tingkat}`; // Contoh: "Tingkat 10"
                if (!acc[classLevel]) {
                    acc[classLevel] = [];
                }
                acc[classLevel].push(student);
            }
            return acc;
        }, {});

        res.render('pages/sync_review', {
            pageTitle: 'Tinjau Data Sinkronisasi',
            groupedStudents,
            target_profile
        });

    } catch (error) {
        console.error('Sync process failed:', error);
        res.redirect(`/sync?type=error&message=${encodeURIComponent(error.message)}`);
    }
};

// LANGKAH 2: MEMPROSES DATA DARI HALAMAN REVIEW DAN MEMASUKKAN KE DATABASE
exports.finalizeStudentSync = async (req, res) => {
    const { students, prefixes, target_profile } = req.body;

    if (!students) {
        return res.redirect(`/sync?type=error&message=Tidak ada data siswa untuk diproses.`);
    }

    const connection = await db.getConnection();
    let addedCount = 0, updatedCount = 0, skippedCount = 0;

    try {
        await connection.beginTransaction();

        for (const student of Object.values(students)) {
            const { nisn, no_induk, tingkat } = student;
            const levelName = `Tingkat ${tingkat}`;
            const prefix = prefixes[levelName] || '';

            if (!nisn || !no_induk) {
                skippedCount++;
                continue;
            }

            const webUsername = nisn.trim();
            const radiusUsername = `${prefix}${no_induk.trim()}`; // Username Wi-Fi = prefix + NIS

            const [existingUser] = await connection.execute("SELECT id FROM webapp_users WHERE username = ?", [webUsername]);
            const isUpdate = existingUser.length > 0;

            const wifiPassword = Math.random().toString(36).substring(2, 8);

            await connection.execute("DELETE FROM radcheck WHERE username = ?", [radiusUsername]);
            await connection.execute("DELETE FROM radusergroup WHERE username = ?", [radiusUsername]);

            await connection.execute("INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)", [radiusUsername, wifiPassword]);
            await connection.execute("INSERT INTO radusergroup (username, groupname) VALUES (?, ?)", [radiusUsername, target_profile]);

            if (isUpdate) {
                // Jika user web sudah ada, update radius_username nya
                await connection.execute("UPDATE webapp_users SET radius_username = ? WHERE username = ?", [radiusUsername, webUsername]);
                updatedCount++;
            } else {
                // Jika user web baru, buat akunnya
                const webPassword = webUsername;
                const hashedPassword = await bcrypt.hash(webPassword, 10);
                await connection.execute("INSERT INTO webapp_users (username, password, radius_username, role) VALUES (?, ?, ?, 'user')", [webUsername, hashedPassword, radiusUsername]);
                addedCount++;
            }
        }

        await connection.commit();
        const successMessage = `Impor Selesai. Pengguna Baru: ${addedCount}, Diperbarui: ${updatedCount}, Dilewati: ${skippedCount}.`;
        res.redirect(`/sync?type=success&message=${encodeURIComponent(successMessage)}`);

    } catch (dbError) {
        await connection.rollback();
        console.error('Finalize sync failed:', dbError);
        res.redirect(`/sync?type=error&message=${encodeURIComponent(dbError.message)}`);
    } finally {
        connection.release();
    }
};

exports.runTeacherSync = async (req, res) => {
    const API_URL = 'https://data-master.sman1balongpanggang.sch.id/api/guru';
    const { target_profile } = req.body;

    if (!target_profile) {
        return res.redirect(`/sync?type=error&message=Anda harus memilih profil tujuan untuk guru.`);
    }

    try {
        const fetchOptions = {
            method: 'GET',
            headers: { 'Authorization': `${process.env.API_MASTER_TOKEN}` }
        };
        const apiResponse = await fetch(API_URL, fetchOptions);
        if (!apiResponse.ok) throw new Error(`API Guru Error: Status ${apiResponse.status}`);

        const teachers = await apiResponse.json();
        if (!Array.isArray(teachers)) throw new Error('Data API guru tidak valid.');

        const connection = await db.getConnection();
        let addedCount = 0, updatedCount = 0, skippedCount = 0;

        try {
            await connection.beginTransaction();

            for (const teacher of teachers) {
                if (teacher.status !== 'Aktif' || !teacher.nama || !teacher.id_guru) {
                    skippedCount++;
                    continue;
                }

                // --- PERUBAHAN UTAMA DI SINI ---
                // Mengambil nama depan, membersihkan, dan menggabungkannya dengan id_guru
                const firstName = teacher.nama.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
                const uniqueIdentifier = `${firstName}${teacher.id_guru}`;

                const webUsername = uniqueIdentifier;
                const radiusUsername = uniqueIdentifier;

                const [existingUser] = await connection.execute("SELECT id FROM webapp_users WHERE username = ?", [webUsername]);
                const isUpdate = existingUser.length > 0;

                const wifiPassword = Math.random().toString(36).substring(2, 10);

                await connection.execute("DELETE FROM radcheck WHERE username = ?", [radiusUsername]);
                await connection.execute("DELETE FROM radusergroup WHERE username = ?", [radiusUsername]);

                await connection.execute("INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)", [radiusUsername, wifiPassword]);
                await connection.execute("INSERT INTO radusergroup (username, groupname) VALUES (?, ?)", [radiusUsername, target_profile]);

                if (isUpdate) {
                    await connection.execute("UPDATE webapp_users SET radius_username = ? WHERE username = ?", [radiusUsername, webUsername]);
                    updatedCount++;
                } else {
                    const webPassword = webUsername; // Password login web awal = username baru
                    const hashedPassword = await bcrypt.hash(webPassword, 10);
                    await connection.execute("INSERT INTO webapp_users (username, password, radius_username, role) VALUES (?, ?, ?, 'user')", [webUsername, hashedPassword, radiusUsername]);
                    addedCount++;
                }
            }

            await connection.commit();
            const successMessage = `Sinkronisasi Guru Selesai. Baru: ${addedCount}, Diperbarui: ${updatedCount}, Dilewati: ${skippedCount}.`;
            res.redirect(`/sync?type=success&message=${encodeURIComponent(successMessage)}`);

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Teacher sync process failed:', error);
        res.redirect(`/sync?type=error&message=${encodeURIComponent(error.message)}`);
    }
};