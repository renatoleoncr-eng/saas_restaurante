const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { logAction } = require('../utils/audit');

// GET ALL USERS (Admin) — scoped to tenant
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            where: { TenantId: req.tenant.id },
            attributes: ['id', 'username', 'displayName', 'role', 'pin', 'requirePinPrompt', 'active']
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE USER (Admin) — scoped to tenant
router.post('/users', async (req, res) => {
    try {
        const { username, password, displayName, role, pin, requirePinPrompt } = req.body;
        const tenantId = req.tenant.id;

        // Check duplicate username within this tenant
        const existing = await User.findOne({ where: { username, TenantId: tenantId } });
        if (existing) return res.status(400).json({ error: 'El usuario ya existe' });

        // Check duplicate PIN within this tenant
        if (pin) {
            const existingPin = await User.findOne({ where: { pin, TenantId: tenantId } });
            if (existingPin) return res.status(400).json({ error: 'El PIN ya está en uso' });
        }

        const newUser = await User.create({
            username,
            password,
            displayName,
            role,
            pin: pin || null,
            requirePinPrompt: requirePinPrompt || false,
            TenantId: tenantId
        });

        await logAction(req, 'CREATE_USER', 'User', newUser.id, { username, role });

        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER (Admin) — scoped to tenant
router.put('/users/:id', async (req, res) => {
    try {
        const { displayName, role, pin, requirePinPrompt } = req.body;
        const tenantId = req.tenant.id;
        const user = await User.findOne({ where: { id: req.params.id, TenantId: tenantId } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Check duplicate PIN within this tenant
        if (pin && pin !== user.pin) {
            const existingPin = await User.findOne({ where: { pin, TenantId: tenantId } });
            if (existingPin) return res.status(400).json({ error: 'El PIN ya está en uso' });
        }

        if (displayName !== undefined) user.displayName = displayName;
        if (role !== undefined) user.role = role;
        user.pin = pin || null;
        if (requirePinPrompt !== undefined) user.requirePinPrompt = requirePinPrompt;

        await user.save();
        await logAction(req, 'UPDATE_USER', 'User', user.id, { changes: req.body });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (deactivate) — scoped to tenant
router.delete('/users/:id', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const user = await User.findOne({ where: { id: req.params.id, TenantId: tenantId } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        await user.update({ active: false });
        await logAction(req, 'DELETE_USER', 'User', req.params.id, { username: user.username, active: false });
        res.json({ message: 'Usuario desactivado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REACTIVATE USER (Admin) — scoped to tenant
router.put('/users/:id/reactivate', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const user = await User.findOne({ where: { id: req.params.id, TenantId: tenantId } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        await user.update({ active: true });
        await logAction(req, 'REACTIVATE_USER', 'User', user.id, { username: user.username });
        res.json({ message: 'Usuario reactivado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CHANGE PASSWORD & PIN (Admin or Self) — scoped to tenant
router.put('/users/:id/password', async (req, res) => {
    try {
        const { currentPassword, newPassword, newPin } = req.body;
        const targetUserId = parseInt(req.params.id);
        const tenantId = req.tenant.id;

        const user = await User.findOne({ where: { id: targetUserId, TenantId: tenantId } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // El rol y el ID del solicitante vienen del JWT verificado, no del body del cliente
        const isAdmin = req.user?.role === 'admin';
        const isSelf = req.user?.id === targetUserId;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Si es el propio usuario (no admin), verificar contraseña actual con bcrypt
        if (isSelf && !isAdmin) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Contraseña actual requerida' });
            }
            let passwordMatch = false;
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
                passwordMatch = await bcrypt.compare(currentPassword, user.password);
            } else {
                // Legacy plain-text (migración pendiente)
                passwordMatch = (user.password === currentPassword);
            }
            if (!passwordMatch) {
                return res.status(400).json({ error: 'Contraseña actual incorrecta' });
            }
        }

        // Check duplicate PIN within this tenant
        if (newPin && newPin !== user.pin) {
            const existingPin = await User.findOne({ where: { pin: newPin, TenantId: tenantId } });
            if (existingPin) return res.status(400).json({ error: 'El PIN ya está en uso' });
        }

        if (newPassword) {
            // Hashear nueva contraseña con bcrypt
            user.password = await bcrypt.hash(newPassword, 10);
        }

        if (newPin !== undefined) {
            user.pin = newPin || null;
        }

        await user.save();

        res.json({ message: 'Credenciales actualizadas correctamente' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Validate PIN
router.post('/validate-pin', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { pin } = req.body;

        if (!pin) {
            return res.status(400).json({ error: 'PIN requerido' });
        }

        const user = await User.findOne({ where: { pin, TenantId: tenantId } });
        if (!user || user.active === false) {
            return res.status(400).json({ error: 'PIN incorrecto o usuario inactivo' });
        }

        res.json({ success: true, user: { id: user.id, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
