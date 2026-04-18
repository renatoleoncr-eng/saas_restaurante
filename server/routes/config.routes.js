const express = require('express');
const router = express.Router();
const { RestaurantConfig } = require('../models');

router.get('/config', async (req, res) => {
    try {
        // Priority: Env Var > DB
        const envName = process.env.RESTAURANT_NAME;
        const config = await RestaurantConfig.findOne();

        const responseData = config ? config.toJSON() : { name: 'Restaurante', address: '' };
        if (envName) responseData.name = envName;

        res.json(responseData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/config', async (req, res) => {
    try {
        const { name, address } = req.body;
        // Assuming only one config record
        const config = await RestaurantConfig.findOne();
        if (config) {
            config.name = name;
            config.address = address;
            await config.save();
        } else {
            await RestaurantConfig.create({ name, address });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
