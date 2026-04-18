const sequelize = require('./server/config/db');
sequelize.query("DESCRIBE Orders")
    .then(([results]) => {
        console.log("ORDERS TABLE SCHEMA:");
        console.table(results);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
