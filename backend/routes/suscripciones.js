const express = require('express');
const router = express.Router();
const pool = require('../db');

const USUARIOS_AUTORIZADOS = (process.env.TELEGRAM_ALLOWED_USERS || '')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

// Obtener suscripciones
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suscripciones ORDER BY fecha_agregado DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo suscripciones' });
  }
});

// Agregar suscripción
router.post('/', async (req, res) => {
  try {
    const { descripcion, monto, categoria, subcategoria, chat_id } = req.body;
    const cid = chat_id || (USUARIOS_AUTORIZADOS[0] || 0);

    const query = `
      INSERT INTO suscripciones (chat_id, descripcion, monto, categoria, subcategoria)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [cid, descripcion, monto, categoria || 'Otros', subcategoria || 'Otros']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar suscripción' });
  }
});

// Editar suscripción
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, monto } = req.body;
    
    const result = await pool.query(`
      UPDATE suscripciones 
      SET descripcion = $1, monto = $2
      WHERE id = $3
      RETURNING *;
    `, [descripcion, monto, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar suscripción' });
  }
});

// Borrar suscripción
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM suscripciones WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    res.json({ message: 'Suscripción eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
