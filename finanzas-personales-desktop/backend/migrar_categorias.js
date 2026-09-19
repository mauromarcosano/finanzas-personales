const pool = require('./db');

async function migrate() {
  try {
    console.log('Iniciando migración de categorías...');

    // 1. Compra dolares -> Ahorro_e_Inversiones / Compra_Dolares
    const res1 = await pool.query(`UPDATE gastos SET categoria = 'Ahorro_e_Inversiones', subcategoria = 'Compra_Dolares' WHERE descripcion ILIKE '%dolar%' OR descripcion ILIKE '%dólar%'`);
    console.log(`Dólares migrados: ${res1.rowCount} registros.`);

    // 2. Comida gata -> Mascotas / Alimento_Piedras
    const res2 = await pool.query(`UPDATE gastos SET categoria = 'Mascotas', subcategoria = 'Alimento_Piedras' WHERE descripcion ILIKE '%gata%' OR descripcion ILIKE '%gato%' OR descripcion ILIKE '%perro%' OR descripcion ILIKE '%mascota%'`);
    console.log(`Mascotas migradas: ${res2.rowCount} registros.`);

    // 3. Yogurtera -> Vivienda_y_Servicios / Equipamiento_Hogar
    const res3 = await pool.query(`UPDATE gastos SET categoria = 'Vivienda_y_Servicios', subcategoria = 'Equipamiento_Hogar' WHERE descripcion ILIKE '%yogurtera%'`);
    console.log(`Equipamiento hogar migrado: ${res3.rowCount} registros.`);

    // 4. Cafecito amor -> Ocio_y_Relaciones / Salidas_Pareja
    const res4 = await pool.query(`UPDATE gastos SET categoria = 'Ocio_y_Relaciones', subcategoria = 'Salidas_Pareja' WHERE descripcion ILIKE '%amor%'`);
    console.log(`Salidas pareja migrado: ${res4.rowCount} registros.`);

    // 5. Gastos finde -> Ocio_y_Relaciones / Salidas_Varias
    const res5 = await pool.query(`UPDATE gastos SET categoria = 'Ocio_y_Relaciones', subcategoria = 'Salidas_Varias' WHERE descripcion ILIKE '%finde%' AND (categoria = 'Kiosco_y_Despensa' OR subcategoria = 'Compras_de_Emergencia')`);
    console.log(`Salidas varias migrado: ${res5.rowCount} registros.`);

    console.log('✅ Migración completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error migrando:', error);
    process.exit(1);
  }
}

migrate();
