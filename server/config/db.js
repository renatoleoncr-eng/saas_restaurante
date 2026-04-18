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
        logging: false
    });

module.exports = sequelize;
