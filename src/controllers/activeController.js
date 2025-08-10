// src/controllers/activeController.js
const db = require('../config/database');
const { exec } = require('child_process');

exports.listActiveUsers = async (req, res) => {
    try {
        const query = `
            SELECT radacctid, username, nasipaddress, framedipaddress, callingstationid, acctstarttime 
            FROM radacct 
            WHERE acctstoptime IS NULL ORDER BY acctstarttime DESC
        `;
        const [activeUsers] = await db.query(query);

        const message = req.query.message ? { type: req.query.type, text: req.query.message } : null;

        res.render('pages/active_users', {
            pageTitle: 'Pengguna Aktif',
            activeUsers,
            message
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

exports.disconnectUser = async (req, res) => {
    const { username, nasipaddress, framedipaddress } = req.body;

    try {
        const [nasList] = await db.query("SELECT secret FROM nas WHERE nasname = ?", [nasipaddress]);
        if (nasList.length === 0) {
            throw new Error(`Secret untuk NAS ${nasipaddress} tidak ditemukan.`);
        }
        const nasSecret = nasList[0].secret;

        // Perintah radclient untuk mengirim Packet-of-Disconnect
        const command = `echo "User-Name=${username},Framed-IP-Address=${framedipaddress}" | radclient -x ${nasipaddress}:3799 disconnect "${nasSecret}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`radclient error: ${stderr}`);
                return res.redirect(`/active-users?type=error&message=Gagal disconnect: ${stderr}`);
            }
            console.log(`radclient success: ${stdout}`);
            res.redirect('/active-users?type=success&message=Perintah disconnect untuk ${username} berhasil dikirim.');
        });

    } catch (error) {
        res.redirect(`/active-users?type=error&message=${error.message}`);
    }
};