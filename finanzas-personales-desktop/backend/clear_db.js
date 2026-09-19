const pool = require('./db');

async function clearDB() {
  try {
    await pool.query('TRUNCATE TABLE compras_tarjeta, cuotas_tarjeta, gastos, suscripciones RESTART IDENTITY CASCADE;');
    console.log('✅ Base de datos limpiada (tablas truncadas con cascade)');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

clearDB();
