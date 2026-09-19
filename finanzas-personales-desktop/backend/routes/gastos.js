const express = require('express');
const router = express.Router();
const pool = require('../db');
const { appendGastoToSheets } = require('../googleSheets');

const USUARIOS_AUTORIZADOS = (process.env.TELEGRAM_ALLOWED_USERS || '')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

router.get('/', async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = 'SELECT * FROM gastos';
    const params = [];
    
    if (month && year) {
      query += " WHERE CAST(strftime('%m', fecha) AS INTEGER) = $1 AND CAST(strftime('%Y', fecha) AS INTEGER) = $2";
      params.push(month, year);
    }
    
    query += ' ORDER BY fecha DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los datos para la web' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { monto, descripcion, categoria, subcategoria, metodo_pago, cuotas, cuota_actual, chat_id, fecha } = req.body;
    const cid = chat_id || (USUARIOS_AUTORIZADOS[0] || 0);
    const m_pago = metodo_pago || 'Debito_Efectivo';
    
    // Si es tarjeta de crédito, lo mandamos a la bandeja de pendientes
    if (m_pago === 'Tarjeta_Credito') {
      const c = parseInt(cuotas) || 1;
      const cuotaActualParsed = parseInt(cuota_actual) || 1;
      const montoIngresado = parseFloat(monto);
      const esTotal = req.body.monto_tipo === 'total';
      
      let monto_total = montoIngresado;
      let monto_por_cuota = montoIngresado;

      if (c > 1) {
        if (esTotal) {
          monto_total = montoIngresado;
          monto_por_cuota = montoIngresado / c;
        } else {
          // Por defecto asumimos que el monto ingresado es el precio de CADA cuota
          monto_por_cuota = montoIngresado;
          monto_total = montoIngresado * c;
        }
      }
      
      let queryCompra;
      let paramsCompra;
      if (fecha) {
        queryCompra = `
          INSERT INTO compras_tarjeta (chat_id, descripcion, monto_total, cuotas_totales, monto_por_cuota, categoria, subcategoria, cuota_inicial, fecha_compra)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;
        `;
        paramsCompra = [cid, descripcion, monto_total, c, monto_por_cuota, categoria || 'Otros', subcategoria || 'Otros', cuotaActualParsed, fecha];
      } else {
        queryCompra = `
          INSERT INTO compras_tarjeta (chat_id, descripcion, monto_total, cuotas_totales, monto_por_cuota, categoria, subcategoria, cuota_inicial)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
        `;
        paramsCompra = [cid, descripcion, monto_total, c, monto_por_cuota, categoria || 'Otros', subcategoria || 'Otros', cuotaActualParsed];
      }
      const resultCompra = await pool.query(queryCompra, paramsCompra);
      const compraId = resultCompra.rows[0].id;
      
      const cuotasPromises = [];
      for (let i = 1; i <= c; i++) {
         const estado = i < cuotaActualParsed ? 'Pagada' : 'Pendiente';
         cuotasPromises.push(pool.query(
           `INSERT INTO cuotas_tarjeta (compra_id, numero_cuota, monto, estado) VALUES ($1, $2, $3, $4)`,
           [compraId, i, monto_por_cuota, estado]
         ));
      }
      await Promise.all(cuotasPromises);
      return res.status(201).json({ success: true, message: 'Compra agregada a Pendientes', cuotas: c });
    }

    let query;
    let params;
    if (fecha) {
      query = `
        INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago, fecha)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      params = [cid, monto, descripcion, categoria || 'Otros', subcategoria || 'Otros', m_pago, fecha];
    } else {
      query = `
        INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      params = [cid, monto, descripcion, categoria || 'Otros', subcategoria || 'Otros', m_pago];
    }
    const result = await pool.query(query, params);
    const nuevoGasto = result.rows[0];

    // Sincronización automática con Google Sheets
    appendGastoToSheets(nuevoGasto);

    res.status(201).json(nuevoGasto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar gasto desde la web' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, descripcion, categoria, subcategoria, metodo_pago, fecha } = req.body;
    const m_pago = metodo_pago || 'Debito_Efectivo';
    
    let query;
    let params;
    if (fecha) {
      query = `
        UPDATE gastos
        SET monto = $1, descripcion = $2, categoria = $3, subcategoria = $4, metodo_pago = $5, fecha = $6
        WHERE id = $7
        RETURNING *;
      `;
      params = [monto, descripcion, categoria, subcategoria, m_pago, fecha, id];
    } else {
      query = `
        UPDATE gastos
        SET monto = $1, descripcion = $2, categoria = $3, subcategoria = $4, metodo_pago = $5
        WHERE id = $6
        RETURNING *;
      `;
      params = [monto, descripcion, categoria, subcategoria, m_pago, id];
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar el gasto' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM gastos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json({ message: 'Gasto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
