const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'finanzas_personales_super_secret_key_123';

// Obtener estado del PIN (si está configurado o no)
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT pin_hash FROM auth_config WHERE id = 1');
    if (result.rows.length > 0 && result.rows[0].pin_hash) {
      return res.json({ isSetup: true });
    }
    return res.json({ isSetup: false });
  } catch (error) {
    console.error('Error al obtener estado de auth:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Configurar PIN inicial
router.post('/setup', async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) {
    return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres.' });
  }

  try {
    const statusRes = await pool.query('SELECT pin_hash FROM auth_config WHERE id = 1');
    if (statusRes.rows.length > 0 && statusRes.rows[0].pin_hash) {
      return res.status(400).json({ error: 'El PIN ya está configurado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pin.toString(), salt);

    await pool.query(
      'INSERT INTO auth_config (id, pin_hash) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash',
      [hash]
    );

    const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '365d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error al configurar PIN:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Iniciar sesión
router.post('/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN requerido.' });
  }

  try {
    const result = await pool.query('SELECT pin_hash FROM auth_config WHERE id = 1');
    if (result.rows.length === 0 || !result.rows[0].pin_hash) {
      return res.status(400).json({ error: 'PIN no configurado aún.' });
    }

    const hash = result.rows[0].pin_hash;
    const isMatch = await bcrypt.compare(pin.toString(), hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'PIN incorrecto.' });
    }

    const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '365d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar PIN
router.post('/remove', async (req, res) => {
  try {
    await pool.query('UPDATE auth_config SET pin_hash = NULL WHERE id = 1');
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar PIN:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = { router, JWT_SECRET };
