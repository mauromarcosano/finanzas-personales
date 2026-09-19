require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const pool = require('./db');

process.on('uncaughtException', (err) => {
  const logMsg = `[UNCAUGHT EXCEPTION] ${new Date().toISOString()}\n${err.stack}\n\n`;
  fs.appendFileSync(path.join(process.cwd(), 'crash.log'), logMsg);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const logMsg = `[UNHANDLED REJECTION] ${new Date().toISOString()}\nReason: ${reason}\n\n`;
  fs.appendFileSync(path.join(process.cwd(), 'crash.log'), logMsg);
  process.exit(1);
});


const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id BIGINT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        descripcion TEXT NOT NULL,
        categoria VARCHAR(100),
        subcategoria VARCHAR(100),
        metodo_pago VARCHAR(50) DEFAULT 'Debito_Efectivo',
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        moneda VARCHAR(10) DEFAULT 'ARS',
        monto_usd DECIMAL(10,2)
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compras_tarjeta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id BIGINT NOT NULL,
        descripcion TEXT NOT NULL,
        monto_total DECIMAL(10, 2) NOT NULL,
        cuotas_totales INT NOT NULL DEFAULT 1,
        monto_por_cuota DECIMAL(10, 2) NOT NULL,
        categoria VARCHAR(100),
        subcategoria VARCHAR(100),
        cuota_inicial INT DEFAULT 1,
        fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        moneda VARCHAR(10) DEFAULT 'ARS',
        monto_usd DECIMAL(10,2)
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cuotas_tarjeta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compra_id INTEGER REFERENCES compras_tarjeta(id) ON DELETE CASCADE,
        numero_cuota INT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        estado VARCHAR(20) DEFAULT 'Pendiente',
        gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
        fecha_vencimiento TIMESTAMP,
        moneda VARCHAR(10) DEFAULT 'ARS',
        monto_usd DECIMAL(10,2)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tarjeta_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_cierre DATE,
        fecha_vencimiento DATE
      );
    `);
    
    const countRes = await pool.query(`SELECT COUNT(*) as c FROM tarjeta_config`);
    if (countRes.rows[0].c === 0) {
      await pool.query(`
        INSERT INTO tarjeta_config (fecha_cierre, fecha_vencimiento) 
        VALUES (date('now', '+15 days'), date('now', '+25 days'))
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS suscripciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id BIGINT NOT NULL,
        descripcion TEXT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        categoria VARCHAR(100),
        subcategoria VARCHAR(100),
        fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        moneda VARCHAR(10) DEFAULT 'ARS',
        monto_usd DECIMAL(10,2)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recordatorio_config (
        id INT PRIMARY KEY DEFAULT 1,
        hora VARCHAR(5) DEFAULT '21:30',
        activo BOOLEAN DEFAULT true
      );
    `);
    
    await pool.query(`
      INSERT INTO recordatorio_config (id, hora, activo)
      VALUES (1, '21:30', true)
      ON CONFLICT(id) DO UPDATE SET id=id;
    `);

    await pool.query('CREATE TABLE IF NOT EXISTS categorias_config (id INT PRIMARY KEY DEFAULT 1, config TEXT NOT NULL);');
    
    const catRes = await pool.query('SELECT COUNT(*) as c FROM categorias_config');
    if (catRes.rows[0].c === 0) {
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
        await pool.query('INSERT INTO categorias_config (id, config) VALUES (1, ?)', [JSON.stringify(defaultCats)]);
    }

    console.log('✅ Base de datos inicializada: tablas creadas.');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
  }
};
initDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

const gastosRouter = require('./routes/gastos');
const cuotasRouter = require('./routes/cuotas');
const tarjetaConfigRouter = require('./routes/tarjeta_config');
const suscripcionesRouter = require('./routes/suscripciones');
const aiRouter = require('./routes/ai');
const categoriasRouter = require('./routes/categorias');
const { router: recordatorioRouter } = require('./routes/recordatorio');

app.use('/api/gastos', gastosRouter);
app.use('/api/cuotas', cuotasRouter);
app.use('/api/tarjeta_config', tarjetaConfigRouter);
app.use('/api/suscripciones', suscripcionesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/recordatorio', recordatorioRouter);

const frontendPath = path.join(__dirname, '../frontend-v2/dist');
app.use(express.static(frontendPath));

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Aplicación corriendo en http://localhost:${PORT}`);
  try {
    exec(`start http://localhost:${PORT}`);
  } catch(e) {}
});
