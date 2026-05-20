const express = require('express');
const router = express.Router();
const { Setting, Account } = require('../models');
const appEmitter = require('../utils/emitter');

const DEFAULT_CONFIG = {
  is_active: false,
  visits_required: 1, // Trigger roulette per qualified payment
  categories: [
    { id: 1, name: "5% Desc.", icon: "🎁", weight: 20 },
    { id: 2, name: "Bebida Gratis", icon: "🥤", weight: 10 },
    { id: 3, name: "Postre Gratis", icon: "🍰", weight: 40 },
    { id: 4, name: "Café de Cortesía", icon: "☕", weight: 15 },
    { id: 5, name: "Pisco Sour", icon: "🍸", weight: 5 },
    { id: 6, name: "Entrada Gratis", icon: "🍟", weight: 10 }
  ]
};

// GET Roulette settings
router.get('/', async (req, res) => {
  try {
    const { type = 'standard' } = req.query;
    const key = `roulette_config_${type}`;
    
    let setting = await Setting.findByPk(key);
    
    // Fallback to legacy key
    if (!setting && type === 'standard') {
      setting = await Setting.findByPk('roulette_config');
    }

    if (!setting) {
      return res.status(200).json(DEFAULT_CONFIG);
    }
    res.status(200).json(JSON.parse(setting.value));
  } catch (error) {
    console.error('Error fetching roulette settings:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// POST update Roulette settings
router.post('/', async (req, res) => {
  try {
    const { config, type = 'standard' } = req.body;
    const key = `roulette_config_${type}`;

    if (config.categories && (config.categories.length < 2 || config.categories.length > 6)) {
        return res.status(400).json({ error: 'La ruleta debe tener entre 2 y 6 categorías.' });
    }

    await Setting.upsert({
      key: key,
      value: JSON.stringify(config),
      description: `Configuración de la Ruleta Ganadora - ${type}`
    });

    const io = req.app.get('io');
    if (io) {
       io.emit('roulette_settings_updated', { config, type });
    }
    res.status(200).json({ message: 'Configuración guardada correctamente', config });
  } catch (error) {
    console.error('Error updating roulette settings:', error);
    res.status(500).json({ error: 'Error al actualizar la ruleta' });
  }
});

// POST start roulette projection on customer display
router.post('/project', async (req, res) => {
    try {
        const payload = req.body; // winnerCategoryId, elements, accountId
        const io = req.app.get('io');
        if (io) {
             io.emit('start_roulette_projection', payload);
             res.status(200).json({ message: 'Proyección iniciada correctamente' });
        } else {
             res.status(500).json({ error: 'Servicio de sockets no configurado' });
        }
    } catch(err) {
        console.error('Error starting roulette projection:', err);
        res.status(500).json({ error: 'Error al proyectar la ruleta' });
    }
});

// POST record roulette interaction and prize choice for an Account
router.post('/record-interaction', async (req, res) => {
    try {
        const { accountId, interaction, prize } = req.body;

        if (!accountId || !interaction) {
            return res.status(400).json({ error: 'accountId e interaction son obligatorios' });
        }

        const account = await Account.findByPk(accountId);
        if (!account) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }

        account.roulette_interaction = interaction;
        if (prize) {
            account.roulette_prize = prize;
        }
        await account.save();

        const io = req.app.get('io');
        if (io) {
            // Notify cashier dashboard
            io.emit('roulette_interaction_recorded', {
                accountId,
                interaction,
                prize
            });
            // If interaction is 'claimed' or completed, broadcast winner celebration
            if (interaction === 'claimed' || interaction === 'spin') {
                io.emit('report_roulette_winner', {
                    accountId,
                    prize,
                    customerName: account.customerName
                });
            }
        }

        res.status(200).json({ message: 'Interacción de ruleta registrada con éxito', account });
    } catch (err) {
        console.error('Error recording roulette interaction:', err);
        res.status(500).json({ error: 'Error al registrar la interacción de la ruleta' });
    }
});

module.exports = router;
