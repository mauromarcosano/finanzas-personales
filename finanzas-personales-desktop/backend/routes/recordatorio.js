const express = require('express');
const router = express.Router();
const pool = require('../db');

let sendTestNotificationFn = null;
let triggerReminderFn = null;

const setSendTestNotification = (fn) => {
  sendTestNotificationFn = fn;
};

const setTriggerReminder = (fn) => {
  triggerReminderFn = fn;
};

// GET /api/recordatorio -> Obtener configuración
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT hora, activo FROM recordatorio_config ORDER BY id LIMIT 1;');
    if (result.rows.length === 0) {
      return res.json({ hora: '21:30', activo: true });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener config de recordatorio:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// POST /api/recordatorio -> Guardar configuración
router.post('/', async (req, res) => {
  try {
    const { hora, activo } = req.body;
    const h = hora || '21:30';
    const a = activo !== undefined ? Boolean(activo) : true;

    await pool.query(`
      INSERT INTO recordatorio_config (id, hora, activo)
      VALUES (1, $1, $2)
      ON CONFLICT (id) 
      DO UPDATE SET hora = EXCLUDED.hora, activo = EXCLUDED.activo;
    `, [h, a]);

    res.json({ success: true, hora: h, activo: a });
  } catch (error) {
    console.error('Error al guardar config de recordatorio:', error);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// POST /api/recordatorio/test -> Enviar notificación de prueba
router.post('/test', async (req, res) => {
  try {
    if (!sendTestNotificationFn) {
      return res.status(500).json({ error: 'Servicio de notificaciones no inicializado' });
    }
    await sendTestNotificationFn();
    res.json({ success: true, message: 'Notificación de prueba enviada a Telegram' });
  } catch (error) {
    console.error('Error enviando prueba:', error);
    res.status(500).json({ error: error.message || 'Error al enviar prueba' });
  }
});

// GET o POST /api/recordatorio/ejecutar -> Disparar ejecución de recordatorios (ideal para cron externo como cron-job.org o UptimeRobot)
const triggerHandler = async (req, res) => {
  try {
    if (!triggerReminderFn) {
      return res.status(500).json({ error: 'Servicio de recordatorios no inicializado' });
    }
    const forced = (req.query && req.query.force === 'true') || (req.body && req.body.force === true);
    const result = await triggerReminderFn(forced);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error en ejecución forzada de recordatorio:', error);
    res.status(500).json({ error: error.message || 'Error al ejecutar recordatorio' });
  }
};

router.get('/ejecutar', triggerHandler);
router.post('/ejecutar', triggerHandler);

module.exports = { router, setSendTestNotification, setTriggerReminder };

