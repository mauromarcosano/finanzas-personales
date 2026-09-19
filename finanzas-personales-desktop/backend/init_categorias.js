const pool = require('./db');

async function initCat() {
  await pool.query('CREATE TABLE IF NOT EXISTS categorias_config (id INT PRIMARY KEY DEFAULT 1, config JSONB NOT NULL);');
  
  const defaultCats = [
    { id: 'Supermercado_y_Alimentacion', label: 'Supermercado y Alimentación', subcategorias: [ { id: 'Compra_Fuerte_Mes', label: 'Compra Fuerte Mes' }, { id: 'Carniceria_Verduleria', label: 'Carnicería/Verdulería' }, { id: 'Panaderia', label: 'Panadería' } ] },
    { id: 'Kiosco_y_Despensa', label: 'Kiosco y Despensa', subcategorias: [ { id: 'Antojos_y_Snacks', label: 'Antojos y Snacks' }, { id: 'Compras_de_Emergencia', label: 'Compras de Emergencia (Despensa)' } ] },
    { id: 'Vivienda_y_Servicios', label: 'Vivienda y Servicios', subcategorias: [ { id: 'Luz_Agua_Gas', label: 'Luz/Agua/Gas' }, { id: 'Internet_y_Suscripciones', label: 'Internet y Suscripciones (Hogar)' }, { id: 'Arreglos_Casa', label: 'Arreglos Casa' }, { id: 'Equipamiento_Hogar', label: 'Equipamiento y Bazar' } ] },
    { id: 'Transporte', label: 'Transporte', subcategorias: [ { id: 'Nafta', label: 'Nafta' }, { id: 'Repuestos_y_Peajes', label: 'Repuestos y Peajes' }, { id: 'Uber_y_Publico', label: 'Uber / Transporte Público' } ] },
    { id: 'Ocio_y_Relaciones', label: 'Ocio y Relaciones', subcategorias: [ { id: 'Salidas_Pareja', label: 'Salidas Pareja' }, { id: 'Juntadas_Amigos', label: 'Juntadas Amigos' }, { id: 'Salidas_Varias', label: 'Salidas Varias / Boliche' }, { id: 'Regalos', label: 'Regalos' }, { id: 'Delivery_y_Comida_Hecha', label: 'Delivery / Comida Hecha' } ] },
    { id: 'Desarrollo_y_Trabajo', label: 'Desarrollo y Trabajo', subcategorias: [ { id: 'Herramientas_Trabajo', label: 'Herramientas de Trabajo' }, { id: 'Gimnasio', label: 'Gimnasio' }, { id: 'Salud_y_Farmacia', label: 'Salud y Farmacia' }, { id: 'Ropa', label: 'Ropa' }, { id: 'Otros', label: 'Otros' } ] },
    { id: 'Ahorro_e_Inversiones', label: 'Ahorro e Inversiones', subcategorias: [ { id: 'Compra_Dolares', label: 'Compra Dólares' }, { id: 'Cripto_Inversiones', label: 'Cripto / Inversiones' }, { id: 'Ahorro_Fijo', label: 'Ahorro Fijo' } ] },
    { id: 'Mascotas', label: 'Mascotas', subcategorias: [ { id: 'Alimento_Piedras', label: 'Alimento y Piedras' }, { id: 'Veterinario_Salud', label: 'Veterinario y Salud' }, { id: 'Accesorios_Juguetes', label: 'Accesorios / Juguetes' } ] },
    { id: 'Otros', label: 'Otros', subcategorias: [] }
  ];
  
  await pool.query('INSERT INTO categorias_config (id, config) VALUES (1, $1) ON CONFLICT (id) DO NOTHING;', [JSON.stringify(defaultCats)]);
  console.log('Categorias init OK');
  process.exit(0);
}

initCat().catch(console.error);
