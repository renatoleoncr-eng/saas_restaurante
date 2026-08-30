const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = process.env.DB_HOST
    ? new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            dialect: 'mysql',
            logging: false,
            timezone: '-05:00', // Peru time
            dialectOptions: {
                dateStrings: true,
                typeCast: true
            }
        }
    )
    : new Sequelize({
        dialect: 'sqlite',
        // Resolve to server/database.sqlite consistently
        storage: path.join(__dirname, '..', 'database.sqlite'),
        logging: false,
        pool: {
            max: 5, // Important for concurrent requests
            min: 0,
            idle: 10000
        },
        retry: {
            match: [
                /SQLITE_BUSY/,
            ],
            name: 'query',
            max: 5
        }
    });

// Apply SQLite connection pragmas to prevent SQLITE_BUSY race conditions
if (!process.env.DB_HOST) {
    sequelize.addHook('afterConnect', (connection) => {
        return new Promise((resolve, reject) => {
            connection.run('PRAGMA journal_mode=WAL;', (err) => {
                if (err) return reject(err);
                connection.run('PRAGMA busy_timeout=5000;', (err) => {
                    if (err) return reject(err);
                    connection.run('PRAGMA synchronous=NORMAL;', (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            });
        });
    });
}

module.exports = sequelize;
