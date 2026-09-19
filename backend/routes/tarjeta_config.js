const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener la configuración actual de la tarjeta
router.get('/', async (req, res) => {
  try {
    // casteamos a char para que no mande la hora y el timezone
    const result = await pool.query("SELECT TO_CHAR(fecha_cierre, 'YYYY-MM-DD') as fecha_cierre, TO_CHAR(fecha_vencimiento, 'YYYY-MM-DD') as fecha_vencimiento FROM tarjeta_config LIMIT 1");
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ fecha_cierre: new Date().toISOString().split('T')[0], fecha_vencimiento: new Date().toISOString().split('T')[0] });
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
