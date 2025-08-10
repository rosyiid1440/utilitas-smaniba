// src/controllers/reportController.js
const db = require('../config/database');

exports.showDashboard = async (req, res) => {
    try {
        const [totalUsers] = await db.query("SELECT COUNT(DISTINCT username) AS count FROM radcheck WHERE attribute = 'Cleartext-Password'");

        const [onlineUsers] = await db.query(
            `SELECT ru.groupname, COUNT(ra.username) as count 
         FROM radacct ra 
         LEFT JOIN radusergroup ru ON ra.username = ru.username 
         WHERE ra.acctstoptime IS NULL 
         GROUP BY ru.groupname`
        );

        let onlineStudents = 0;
        let onlineTeachers = 0;
        onlineUsers.forEach(group => {
            if (group.groupname && group.groupname.toLowerCase().includes('guru')) {
                onlineTeachers += group.count;
            } else {
                onlineStudents += group.count;
            }
        });

        const [topUser] = await db.query(
            `SELECT username, SUM(acctinputoctets + acctoutputoctets) AS totalusage 
         FROM radacct 
         WHERE acctstarttime >= CURDATE() 
         GROUP BY username 
         ORDER BY totalusage DESC 
         LIMIT 1`
        );

        const stats = {
            totalUsers: totalUsers[0].count,
            onlineStudents,
            onlineTeachers,
            topUserData: topUser.length > 0 ? topUser[0] : { username: '-', totalusage: 0 }
        };

        res.render('pages/dashboard', {
            pageTitle: 'Dashboard',
            stats,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};