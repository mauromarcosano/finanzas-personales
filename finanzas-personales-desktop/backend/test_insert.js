const pool = require('./db.js');
async function test() {
  const query = `
        INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
  const params = [0, '50000', 'arreglo caño de agua casa', 'Vivienda_y_Servicios', 'Arreglos_Casa', 'Debito_Efectivo'];
  try {
    const result = await pool.query(query, params);
    console.log(result);
  } catch(e) {
    console.error('ERROR:', e);
  }
}
test();
