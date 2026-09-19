const pool = require('./db');

async function restoreGasto() {
  try {
    const chat_id = '0';
    const descripcion = 'Cubiertas Moto';
    const monto_total = 270043.62;
    const cuotas_totales = 6;
    const monto_por_cuota = 45007.27;
    const categoria = 'Transporte';
    const subcategoria = 'Repuestos_y_Peajes';
    const cuota_inicial = 4;
    const fecha_compra = '2026-08-01T03:00:00.000Z';
    const moneda = 'ARS';

    const queryCompra = `
      INSERT INTO compras_tarjeta (chat_id, descripcion, monto_total, cuotas_totales, monto_por_cuota, categoria, subcategoria, cuota_inicial, fecha_compra, moneda)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id;
    `;

    const resCompra = await pool.query(queryCompra, [
      chat_id, descripcion, monto_total, cuotas_totales, monto_por_cuota, categoria, subcategoria, cuota_inicial, fecha_compra, moneda
    ]);
    const compraId = resCompra.rows[0].id;

    for (let i = 1; i <= cuotas_totales; i++) {
      const estado = i < cuota_inicial ? 'Pagada' : 'Pendiente';
      await pool.query(
        `INSERT INTO cuotas_tarjeta (compra_id, numero_cuota, monto, estado, moneda) VALUES ($1, $2, $3, $4, $5)`,
        [compraId, i, monto_por_cuota, estado, moneda]
      );
    }

    console.log(`✅ 'Cubiertas Moto' restaurado exitosamente con ID ${compraId}`);
    process.exit(0);
  } catch (e) {
    console.error('Error restaurando gasto:', e);
    process.exit(1);
  }
}

restoreGasto();
