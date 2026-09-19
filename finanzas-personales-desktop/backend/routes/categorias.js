const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener categorías
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT config FROM categorias_config WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json([]);
    }
    let configData = result.rows[0].config;
    while (typeof configData === 'string') {
      try {
        configData = JSON.parse(configData);
      } catch (e) {
        break;
      }
    }
    if (!Array.isArray(configData)) {
      configData = [];
    }
    res.json(configData);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Guardar categorías (reemplaza toda la configuración)
router.post('/', async (req, res) => {
  const { categorias } = req.body;
  if (!categorias || !Array.isArray(categorias)) {
    return res.status(400).json({ error: 'Formato inválido. Se esperaba un array "categorias".' });
  }

  try {
    await pool.query(
      'INSERT INTO categorias_config (id, config) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET config = $1',
      [JSON.stringify(categorias)]
    );
    res.json({ success: true, categorias });
  } catch (error) {
    console.error('Error guardando categorías:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
