// src/controllers/reportApiController.js
const db = require('../config/database');

exports.getOnlineUsersHourly = async (req, res) => {
    try {
        const query = `
            SELECT HOUR(acctstarttime) as hour, COUNT(*) as count 
            FROM radacct 
            WHERE acctstarttime >= NOW() - INTERVAL 1 DAY 
            GROUP BY hour 
            ORDER BY hour ASC;
        `;
        const [results] = await db.query(query);

        // Siapkan data untuk 24 jam terakhir, isi dengan 0
        const labels = [];
        const data = [];
        const currentHour = new Date().getHours();

        for (let i = 0; i < 24; i++) {
            const hour = (currentHour - 23 + i + 24) % 24;
            labels.push(`${hour.toString().padStart(2, '0')}:00`);
            data.push(0);
        }

        // Isi data dari hasil query
        results.forEach(row => {
            const labelIndex = labels.indexOf(`${row.hour.toString().padStart(2, '0')}:00`);
            if (labelIndex > -1) {
                data[labelIndex] = row.count;
            }
        });

        res.json({ labels, data });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getDailyUsage = async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(acctstarttime) as date, 
                SUM(acctinputoctets + acctoutputoctets) as total_bytes
            FROM radacct 
            WHERE acctstarttime >= NOW() - INTERVAL 7 DAY
            GROUP BY date 
            ORDER BY date ASC;
        `;
        const [results] = await db.query(query);

        const labels = results.map(row => new Date(row.date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }));
        const data = results.map(row => (row.total_bytes / (1024 * 1024 * 1024)).toFixed(2)); // Konversi ke GB

        res.json({ labels, data });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getTopDataUsers = async (req, res) => {
    try {
        const query = `
            SELECT username, SUM(acctinputoctets + acctoutputoctets) as total_bytes
            FROM radacct 
            WHERE acctstarttime >= NOW() - INTERVAL 7 DAY
            GROUP BY username 
            ORDER BY total_bytes DESC
            LIMIT 5;
        `;
        const [results] = await db.query(query);

        const labels = results.map(row => row.username);
        const data = results.map(row => (row.total_bytes / (1024 * 1024 * 1024)).toFixed(2));

        res.json({ labels, data });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getProfileDistribution = async (req, res) => {
    try {
        const query = `
            SELECT IFNULL(ru.groupname, 'Tanpa Profil') as profile, COUNT(ra.username) as count 
            FROM radacct ra 
            LEFT JOIN radusergroup ru ON ra.username = ru.username 
            WHERE ra.acctstoptime IS NULL 
            GROUP BY profile;
        `;
        const [results] = await db.query(query);

        const labels = results.map(row => row.profile);
        const data = results.map(row => row.count);

        res.json({ labels, data });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
};