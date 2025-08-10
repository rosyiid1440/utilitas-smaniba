// src/controllers/nasController.js
const db = require('../config/database');

exports.listNas = async (req, res) => {
    try {
        const [nasList] = await db.query("SELECT * FROM nas ORDER BY nasname");
        res.render('pages/nas_list', {
            pageTitle: 'Manajemen Router (NAS)',
            nasList
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

exports.showNasForm = async (req, res) => {
    const { id } = req.params;
    let nas = null;
    if (id) {
        const [nasList] = await db.query("SELECT * FROM nas WHERE id = ?", [id]);
        if (nasList.length > 0) nas = nasList[0];
    }
    res.render('pages/nas_form', {
        pageTitle: id ? 'Edit Router' : 'Tambah Router Baru',
        nas
    });
};

exports.saveNas = async (req, res) => {
    const { id } = req.params;
    const { nasname, shortname, secret, description } = req.body;

    try {
        if (id) {
            // Update
            await db.execute(
                "UPDATE nas SET nasname = ?, shortname = ?, secret = ?, description = ? WHERE id = ?",
                [nasname, shortname, secret, description, id]
            );
        } else {
            // Insert
            await db.execute(
                "INSERT INTO nas (nasname, shortname, type, secret, description) VALUES (?, ?, 'other', ?, ?)",
                [nasname, shortname, secret, description]
            );
        }
        res.redirect('/nas');
    } catch (error) {
        res.status(500).send('Gagal menyimpan router.');
    }
};

exports.deleteNas = async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute("DELETE FROM nas WHERE id = ?", [id]);
        res.redirect('/nas');
    } catch (error) {
        res.status(500).send('Gagal menghapus router.');
    }
};