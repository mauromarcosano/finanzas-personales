const pool = require('./db');

async function restoreSeptiembre() {
  try {
    const cid = '0';
    
    // 1. Gastos del Dashboard
    const gastosData = [
      { monto: 6694, desc: 'Uber', cat: 'Transporte', sub: 'Uber_y_Publico', fecha: '2026-09-02T12:00:00.000Z' },
      { monto: 20000, desc: 'Supermercado Coto', cat: 'Supermercado_y_Alimentacion', sub: 'Compra_Fuerte_Mes', fecha: '2026-09-04T12:00:00.000Z' },
      { monto: 15000, desc: 'Carga Nafta YPF', cat: 'Transporte', sub: 'Nafta', fecha: '2026-09-06T12:00:00.000Z' },
      { monto: 3500, desc: 'Kiosco / Antojos', cat: 'Kiosco_y_Despensa', sub: 'Antojos_y_Snacks', fecha: '2026-09-08T12:00:00.000Z' },
      { monto: 8500, desc: 'Salida Delivery', cat: 'Ocio_y_Relaciones', sub: 'Delivery_y_Comida_Hecha', fecha: '2026-09-10T12:00:00.000Z' }
    ];

    for (const g of gastosData) {
      await pool.query(`
        INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago, fecha, moneda)
        VALUES ($1, $2, $3, $4, $5, 'Debito_Efectivo', $6, 'ARS')
      `, [cid, g.monto, g.desc, g.cat, g.sub, g.fecha]);
    }
    console.log(`✅ ${gastosData.length} gastos de Septiembre insertados en el Dashboard.`);

    // 2. Suscripciones
    const suscripcionesData = [
      { desc: 'YouTube Premium', monto: 6799, cat: 'Vivienda_y_Servicios', sub: 'Internet_y_Suscripciones', moneda: 'ARS' },
      { desc: 'Seguro Moto', monto: 44448.04, cat: 'Transporte', sub: 'Repuestos_y_Peajes', moneda: 'ARS' }
    ];

    for (const s of suscripcionesData) {
      await pool.query(`
        INSERT INTO suscripciones (chat_id, descripcion, monto, categoria, subcategoria, moneda)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [cid, s.desc, s.monto, s.cat, s.sub, s.moneda]);
    }
    console.log(`✅ ${suscripcionesData.length} suscripciones insertadas.`);

    process.exit(0);
  } catch (err) {
    console.error('Error restaurando gastos:', err);
    process.exit(1);
  }
}

restoreSeptiembre();
