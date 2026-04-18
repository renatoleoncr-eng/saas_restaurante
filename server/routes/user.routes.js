const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { logAction } = require('../utils/audit');

// Middleware to check if user is admin is ideal, but for now we trust frontend hiding + prototype speed.
// In production, add middleware: const isAdmin = (req, res, next) => ...

// GET ALL USERS (Admin)
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'displayName', 'role'] // Exclude password
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE USER (Admin)
router.post('/users', async (req, res) => {
    try {
        const { username, password, displayName, role } = req.body;

        // Check duplicate
        const existing = await User.findOne({ where: { username } });
        if (existing) return res.status(400).json({ error: 'El usuario ya existe' });

        const newUser = await User.create({
            username,
            password, // Store plain/hashed as per current logic
            displayName,
            role
        });

        await logAction(req, 'CREATE_USER', 'User', newUser.id, { username, role });

        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER (Admin)
router.put('/users/:id', async (req, res) => {
    try {
        const { displayName, role } = req.body;
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (displayName) user.displayName = displayName;
        if (role) user.role = role;

        await user.save();
        await logAction(req, 'UPDATE_USER', 'User', user.id, { changes: req.body });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (Admin)
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        await user.destroy();
        await logAction(req, 'DELETE_USER', 'User', req.params.id, { username: user.username });
        res.json({ message: 'Usuario eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CHANGE PASSWORD (Admin or Self)
router.put('/users/:id/password', async (req, res) => {
    try {
        const { currentPassword, newPassword, requesterRole, requesterId } = req.body;
        const targetUserId = parseInt(req.params.id);

        const user = await User.findByPk(targetUserId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Logic:
        // 1. If requester is Admin: Can force change without current password.
        // 2. If requester is Self: Must provide valid current password.

        const isAdmin = requesterRole === 'admin';
        const isSelf = requesterId === targetUserId;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (isSelf && !isAdmin) {
            // For self-udpate, verify current password
            if (user.password !== currentPassword) {
                return res.status(400).json({ error: 'Contraseña actual incorrecta' });
            }
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Contraseña actualizada' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
