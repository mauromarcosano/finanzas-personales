const express = require('express');
const router = express.Router();
const pool = require('../db');
const { appendGastoToSheets } = require('../googleSheets');

router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT ct.id as cuota_id, ct.numero_cuota, ct.monto, ct.estado, ct.gasto_id,
             c.id as compra_id, c.descripcion, c.monto_total, c.cuotas_totales, c.categoria, c.subcategoria, c.fecha_compra,
             COALESCE(c.cuota_inicial, 1) as cuota_inicial
      FROM cuotas_tarjeta ct
      JOIN compras_tarjeta c ON ct.compra_id = c.id
      ORDER BY c.fecha_compra DESC, ct.numero_cuota ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo cuotas' });
  }
});

router.post('/:id/pagar', async (req, res) => {
  try {
    const cuotaId = req.params.id;
    
    const checkQuery = `
      SELECT ct.id, ct.monto, ct.estado, ct.numero_cuota, c.descripcion, c.categoria, c.subcategoria, c.chat_id, c.cuotas_totales
      FROM cuotas_tarjeta ct
      JOIN compras_tarjeta c ON ct.compra_id = c.id
      WHERE ct.id = $1
    `;
    const checkRes = await pool.query(checkQuery, [cuotaId]);
    
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }
    
    const cuota = checkRes.rows[0];
    if (cuota.estado === 'Pagada') {
      return res.status(400).json({ error: 'La cuota ya está pagada' });
    }
    
    const desc = `${cuota.descripcion} (Cuota ${cuota.numero_cuota}/${cuota.cuotas_totales})`;
    
    const gastoQuery = `
      INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, chat_id, monto, descripcion, categoria, subcategoria, fecha;
    `;
    const gastoRes = await pool.query(gastoQuery, [
      cuota.chat_id, 
      cuota.monto, 
      desc, 
      cuota.categoria, 
      cuota.subcategoria
    ]);
    const nuevoGasto = gastoRes.rows[0];
    
    const updateCuotaQuery = `
      UPDATE cuotas_tarjeta
      SET estado = 'Pagada', gasto_id = $1
      WHERE id = $2
    `;
    await pool.query(updateCuotaQuery, [nuevoGasto.id, cuotaId]);
    
    appendGastoToSheets(nuevoGasto);
    
    res.json({ success: true, message: 'Cuota liquidada exitosamente', gasto: nuevoGasto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error liquidando cuota' });
  }
});

// Editar cuota (monto o descripción)
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { descripcion, monto } = req.body;
    
    const cuotaRes = await client.query('UPDATE cuotas_tarjeta SET monto = $1 WHERE id = $2 RETURNING compra_id', [monto, id]);
    if (cuotaRes.rows.length === 0) {
      throw new Error('Cuota no encontrada');
    }
    const compra_id = cuotaRes.rows[0].compra_id;
    await client.query('UPDATE compras_tarjeta SET descripcion = $1 WHERE id = $2', [descripcion, compra_id]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Cuota actualizada' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error actualizando cuota' });
  } finally {
    client.release();
  }
});

// Liquidar todo el resumen (Cuotas Pendientes + Suscripciones)
router.post('/liquidar_mes', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Obtener la cuota pendiente más baja de cada compra
    const cuotasRes = await client.query(`
      SELECT DISTINCT ON (c.id) ct.id, ct.monto, ct.estado, ct.numero_cuota, c.id as compra_id, c.descripcion, c.categoria, c.subcategoria, c.chat_id, c.cuotas_totales
      FROM cuotas_tarjeta ct
      JOIN compras_tarjeta c ON ct.compra_id = c.id
      WHERE ct.estado = 'Pendiente'
      ORDER BY c.id, ct.numero_cuota ASC
    `);
    
    // 2. Obtener todas las suscripciones
    const suscripcionesRes = await client.query('SELECT * FROM suscripciones');
    
    const gastosGenerados = [];
    
    // Procesar cuotas
    for (const cuota of cuotasRes.rows) {
      const desc = cuota.cuotas_totales > 1 ? `${cuota.descripcion} (Cuota ${cuota.numero_cuota}/${cuota.cuotas_totales})` : cuota.descripcion;
      const gastoRes = await client.query(`
        INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago)
        VALUES ($1, $2, $3, $4, $5, 'Tarjeta_Credito')
        RETURNING id, chat_id, monto, descripcion, categoria, subcategoria, fecha;
      `, [cuota.chat_id, cuota.monto, desc, cuota.categoria, cuota.subcategoria]);
      
      const nuevoGasto = gastoRes.rows[0];
      gastosGenerados.push(nuevoGasto);
      
      await client.query(`UPDATE cuotas_tarjeta SET estado = 'Pagada', gasto_id = $1 WHERE id = $2`, [nuevoGasto.id, cuota.id]);
      
      // Si quedan cuotas por pagar y no existe la cuota siguiente, la creamos
      if (cuota.numero_cuota < cuota.cuotas_totales) {
        const nextCheck = await client.query(
          `SELECT id FROM cuotas_tarjeta WHERE compra_id = $1 AND numero_cuota = $2`,
          [cuota.compra_id, cuota.numero_cuota + 1]
        );
        if (nextCheck.rows.length === 0) {
          await client.query(`
            INSERT INTO cuotas_tarjeta (compra_id, numero_cuota, monto, estado)
            VALUES ($1, $2, $3, 'Pendiente')
          `, [cuota.compra_id, cuota.numero_cuota + 1, cuota.monto]);
        }
      }
    }
    
    // Procesar suscripciones
    for (const sub of suscripcionesRes.rows) {
      const gastoRes = await client.query(`
        INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago)
        VALUES ($1, $2, $3, $4, $5, 'Tarjeta_Credito')
        RETURNING id, chat_id, monto, descripcion, categoria, subcategoria, fecha;
      `, [sub.chat_id, sub.monto, sub.descripcion, sub.categoria, sub.subcategoria]);
      
      gastosGenerados.push(gastoRes.rows[0]);
    }
    
    await client.query('COMMIT');
    
    // Sincronizar todo a Sheets
    for (const g of gastosGenerados) {
      appendGastoToSheets(g);
    }
    
    res.json({ success: true, message: 'Resumen liquidado exitosamente', totalItems: gastosGenerados.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error liquidando resumen:', error);
    res.status(500).json({ error: 'Error liquidando resumen' });
  } finally {
    client.release();
  }
});

// Eliminar compra de tarjeta (y todas sus cuotas) por cuota_id
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    
    // Buscar el compra_id asociado a esta cuota
    const cuotaRes = await client.query('SELECT compra_id FROM cuotas_tarjeta WHERE id = $1', [id]);
    let compraId = id;
    if (cuotaRes.rows.length > 0) {
      compraId = cuotaRes.rows[0].compra_id;
    }
    
    await client.query('DELETE FROM cuotas_tarjeta WHERE compra_id = $1', [compraId]);
    await client.query('DELETE FROM compras_tarjeta WHERE id = $1', [compraId]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Compra de tarjeta eliminada exitosamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al borrar compra de tarjeta:', err);
    res.status(500).json({ error: 'Error al eliminar la compra de tarjeta' });
  } finally {
    client.release();
  }
});

module.exports = router;
