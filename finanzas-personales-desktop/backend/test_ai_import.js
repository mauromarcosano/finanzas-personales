const pool = require('./db');

async function main() {
  const { rows } = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  console.log("Tables:", rows.map(r => r.table_name).join(', '));
  
  try {
    const config = await pool.query('SELECT * FROM configuracion_tarjeta');
    console.log("Configuracion:", config.rows);
  } catch (e) {
    console.log("Configuracion err:", e.message);
  }
  process.exit(0);
}

main();
