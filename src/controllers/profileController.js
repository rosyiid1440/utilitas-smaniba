// src/controllers/profileController.js
const db = require('../config/database');

// Menampilkan daftar semua profil yang ada
exports.listProfiles = async (req, res) => {
    try {
        // Ambil semua nama grup unik dari kedua tabel profil
        const query = `
            SELECT DISTINCT groupname FROM radgroupcheck
            UNION
            SELECT DISTINCT groupname FROM radgroupreply
            ORDER BY groupname;
        `;
        const [profiles] = await db.query(query);
        res.render('pages/profiles_list', {
            pageTitle: 'Manajemen Profil',
            profiles
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// Menampilkan form untuk membuat atau mengedit profil
exports.showProfileForm = async (req, res) => {
    const { profilename } = req.params;

    // UBAH BARIS DI BAWAH INI
    let profileData = { attributes: [] };

    if (profilename) {
        // Jika mengedit, ambil semua atribut yang ada untuk profil tersebut
        const [checkAttributes] = await db.query("SELECT attribute, op, value FROM radgroupcheck WHERE groupname = ?", [profilename]);
        const [replyAttributes] = await db.query("SELECT attribute, op, value FROM radgroupreply WHERE groupname = ?", [profilename]);

        // Gabungkan atribut dari kedua tabel
        profileData.attributes = [...checkAttributes, ...replyAttributes];
    }

    res.render('pages/profile_form', {
        pageTitle: profilename ? `Edit Profil: ${profilename}` : 'Buat Profil Baru',
        profilename: profilename || '',
        profileData: profileData // Sekarang profileData selalu konsisten
    });
};

// Menyimpan perubahan pada profil (baru atau edit)
exports.saveProfile = async (req, res) => {
    const { profilename, originalProfilename, attribute, op, value } = req.body;

    if (!profilename) {
        return res.status(400).send('Nama profil wajib diisi.');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Jika nama profil diubah, update nama grup di semua tabel
        if (originalProfilename && originalProfilename !== profilename) {
            await connection.execute("UPDATE radgroupcheck SET groupname = ? WHERE groupname = ?", [profilename, originalProfilename]);
            await connection.execute("UPDATE radgroupreply SET groupname = ? WHERE groupname = ?", [profilename, originalProfilename]);
            await connection.execute("UPDATE radusergroup SET groupname = ? WHERE groupname = ?", [profilename, originalProfilename]);
        }

        // Hapus semua atribut lama dari profil ini untuk diganti dengan yang baru
        await connection.execute("DELETE FROM radgroupcheck WHERE groupname = ?", [profilename]);
        await connection.execute("DELETE FROM radgroupreply WHERE groupname = ?", [profilename]);

        // Looping dan insert atribut baru
        if (attribute && Array.isArray(attribute)) {
            for (let i = 0; i < attribute.length; i++) {
                const attr = attribute[i];
                const oper = op[i];
                const val = value[i];

                if (attr && val) {
                    // Tentukan tabel mana yang akan digunakan (check atau reply)
                    const targetTable = ['Auth-Type'].includes(attr) ? 'radgroupcheck' : 'radgroupreply';
                    const query = `INSERT INTO ${targetTable} (groupname, attribute, op, value) VALUES (?, ?, ?, ?)`;
                    await connection.execute(query, [profilename, attr, oper, val]);
                }
            }
        }

        await connection.commit();
        res.redirect('/profiles');
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).send('Gagal menyimpan profil.');
    } finally {
        connection.release();
    }
};

// Menghapus profil
exports.deleteProfile = async (req, res) => {
    const { profilename } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Hapus dari tabel profil dan juga dari penetapan user
        await connection.execute("DELETE FROM radgroupcheck WHERE groupname = ?", [profilename]);
        await connection.execute("DELETE FROM radgroupreply WHERE groupname = ?", [profilename]);
        await connection.execute("DELETE FROM radusergroup WHERE groupname = ?", [profilename]);
        await connection.commit();
        res.redirect('/profiles');
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).send('Gagal menghapus profil.');
    } finally {
        connection.release();
    }
};