const { Sequelize } = require('sequelize');
const path = require('path');
const dbPath = path.join(__dirname, 'config', 'db.js');
const sequelize = require(dbPath);
const { Product } = require('./models');

async function findSopa() {
    try {
        await sequelize.authenticate();
        const products = await Product.findAll({
            where: {
                name: 'Sopa a la minuta'
            }
        });

        if (products.length === 0) {
            console.log("No 'Sopa a la minuta' found.");
        } else {
            console.log("Found Sopa a la minuta:");
            products.forEach(p => console.log(`ID: ${p.id}, RequiresPrep: ${p.requiresPreparation}, Managed: ${p.isStockManaged}`));
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
}

findSopa();
