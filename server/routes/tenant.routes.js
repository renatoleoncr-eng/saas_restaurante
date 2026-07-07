/**
 * Tenant Routes — Public endpoints for tenant registration and management
 * 
 * These routes handle:
 * - Self-service tenant registration (autoservicio completo)
 * - Slug availability checking
 * - Tenant info for the current subdomain
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Tenant, User, sequelize } = require('../models');
const { generateToken, generateRefreshToken } = require('../middleware/auth.middleware');
const { seedTenantData } = require('../utils/tenantSeed');
const models = require('../models');

// Slug validation regex: lowercase letters, numbers, hyphens. 3-30 chars.
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// Reserved slugs that can't be used
const RESERVED_SLUGS = [
    'www', 'api', 'app', 'admin', 'mail', 'ftp', 'ssh', 'dev', 'staging',
    'test', 'demo', 'blog', 'docs', 'help', 'support', 'status', 'cdn',
    'assets', 'static', 'media', 'images', 'img', 'ns1', 'ns2',
    'registro', 'register', 'login', 'signup', 'signin',
    'makala', 'maksuites', 'sunat', 'karaoke'
];

// =============================================
// CHECK SLUG AVAILABILITY
// =============================================
router.get('/check-slug/:slug', async (req, res) => {
    try {
        const slug = req.params.slug.toLowerCase().trim();

        // Validate format
        if (!SLUG_REGEX.test(slug)) {
            return res.json({
                available: false,
                reason: 'El subdominio debe tener entre 3 y 30 caracteres, solo letras minúsculas, números y guiones. No puede empezar ni terminar con guión.'
            });
        }

        // Check reserved slugs
        if (RESERVED_SLUGS.includes(slug)) {
            return res.json({
                available: false,
                reason: 'Este subdominio está reservado'
            });
        }

        // Check database
        const existing = await Tenant.findOne({ where: { slug } });

        res.json({
            available: !existing,
            reason: existing ? 'Este subdominio ya está en uso' : null
        });
    } catch (err) {
        console.error('[Tenant] Slug check error:', err);
        res.status(500).json({ error: 'Error verificando disponibilidad' });
    }
});

// =============================================
// REGISTER NEW TENANT (Self-service)
// =============================================
router.post('/register', async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { name, slug, email, password, ownerName, username, phone } = req.body;

        // Validate required fields
        if (!name || !slug || !email || !password || !username || !phone) {
            await t.rollback();
            return res.status(400).json({
                error: 'Todos los campos son requeridos: nombre del restaurante, subdominio, nombre, usuario, contraseña, email y celular'
            });
        }

        // Validate username format
        const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
        const normalizedUsername = username.toLowerCase().trim();
        if (!USERNAME_REGEX.test(normalizedUsername)) {
            await t.rollback();
            return res.status(400).json({
                error: 'Usuario inválido. Use solo letras minúsculas, números y guiones bajos (3-20 caracteres).'
            });
        }

        // Validate phone (Peru: 9 digits starting with 9)
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 9) {
            await t.rollback();
            return res.status(400).json({
                error: 'Ingresa un número de celular válido (mínimo 9 dígitos)'
            });
        }

        const normalizedSlug = slug.toLowerCase().trim();

        // Validate slug format
        if (!SLUG_REGEX.test(normalizedSlug)) {
            await t.rollback();
            return res.status(400).json({
                error: 'Subdominio inválido. Use solo letras minúsculas, números y guiones (3-30 caracteres).'
            });
        }

        // Check reserved
        if (RESERVED_SLUGS.includes(normalizedSlug)) {
            await t.rollback();
            return res.status(400).json({ error: 'Este subdominio está reservado' });
        }

        // Check slug availability
        const existingTenant = await Tenant.findOne({
            where: { slug: normalizedSlug },
            transaction: t
        });
        if (existingTenant) {
            await t.rollback();
            return res.status(409).json({ error: 'Este subdominio ya está en uso' });
        }

        // Check email not already registered as tenant owner
        const existingOwner = await Tenant.findOne({
            where: { ownerEmail: email.toLowerCase().trim() },
            transaction: t
        });
        if (existingOwner) {
            await t.rollback();
            return res.status(409).json({
                error: 'Este email ya tiene un restaurante registrado'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            await t.rollback();
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        // 1. Create tenant
        const tenant = await Tenant.create({
            name: name.trim(),
            slug: normalizedSlug,
            ownerEmail: email.toLowerCase().trim(),
            ownerPhone: cleanPhone,
            plan: 'demo',
            status: 'active',
            onboardingCompleted: false
        }, { transaction: t });

        // 2. Create owner user (admin role) with custom username
        const hashedPassword = await bcrypt.hash(password, 10);
        const adminUser = await User.create({
            username: normalizedUsername,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: 'admin',
            displayName: ownerName || 'Administrador',
            active: true,
            TenantId: tenant.id
        }, { transaction: t });

        // 3. Seed initial data for the tenant
        await seedTenantData(tenant.id, tenant.name, models, t);

        await t.commit();

        // 4. Generate tokens for automatic login
        const token = generateToken(adminUser, tenant.id);
        const refreshToken = generateRefreshToken(adminUser, tenant.id);

        console.log(`[Tenant] New tenant registered: "${tenant.name}" (${tenant.slug}.maksuites.com.pe)`);

        res.status(201).json({
            message: '¡Restaurante creado exitosamente!',
            tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                plan: tenant.plan,
                url: `https://${tenant.slug}.maksuites.com.pe`,
                onboardingCompleted: false
            },
            token,
            refreshToken,
            user: {
                id: adminUser.id,
                username: adminUser.username,
                role: adminUser.role,
                displayName: adminUser.displayName
            }
        });

    } catch (err) {
        await t.rollback();
        console.error('[Tenant] Registration error:', err);
        res.status(500).json({ error: 'Error creando el restaurante. Intente nuevamente.' });
    }
});

// =============================================
// GET TENANT INFO (for current subdomain)
// =============================================
router.get('/info', async (req, res) => {
    try {
        if (!req.tenant) {
            return res.status(404).json({ error: 'No tenant context' });
        }

        res.json({
            id: req.tenant.id,
            name: req.tenant.name,
            slug: req.tenant.slug,
            plan: req.tenant.plan,
            status: req.tenant.status,
            logoUrl: req.tenant.logoUrl,
            onboardingCompleted: req.tenant.onboardingCompleted || false
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
