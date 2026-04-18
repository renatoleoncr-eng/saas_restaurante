const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { logAction } = require('../utils/audit');

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Simple plain text comparison for prototype 
        // TODO: Switch to bcrypt
        const user = await User.findOne({ where: { username } });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Log Login
        req.user = user; // Hack to pass user to logAction helper if needed, or just pass ID
        await logAction(req, 'LOGIN', 'User', user.id, { username });

        // Return user info (excluding password)
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.displayName
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
