const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener la configuración actual de la tarjeta
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT strftime('%Y-%m-%d', fecha_cierre) as fecha_cierre, strftime('%Y-%m-%d', fecha_vencimiento) as fecha_vencimiento FROM tarjeta_config LIMIT 1");
    if (result.rows.length > 0 && result.rows[0].fecha_cierre) {
      res.json(result.rows[0]);
    } else {
      const fallback = await pool.query("SELECT fecha_cierre, fecha_vencimiento FROM tarjeta_config LIMIT 1");
      if (fallback.rows.length > 0) {
        res.json(fallback.rows[0]);
      } else {
        res.json({ fecha_cierre: new Date().toISOString().split('T')[0], fecha_vencimiento: new Date().toISOString().split('T')[0] });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo config de tarjeta' });
  }
});

// Actualizar configuración
router.post('/', async (req, res) => {
  try {
    const { fecha_cierre, fecha_vencimiento } = req.body;
    await pool.query('UPDATE tarjeta_config SET fecha_cierre = $1, fecha_vencimiento = $2', [fecha_cierre, fecha_vencimiento]);
    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando config de tarjeta' });
  }
});

module.exports = router;
