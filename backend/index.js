require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express'); 
const cors = require('cors');       
const { appendGastoToSheets } = require('./googleSheets');

// Configuración de variables de entorno
const token = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;

const USUARIOS_AUTORIZADOS = (process.env.TELEGRAM_ALLOWED_USERS || '')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));
const pool = require('./db');

const cron = require('node-cron');

// Crear la base de datos de gastos si no existe
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        descripcion TEXT NOT NULL,
        categoria VARCHAR(100),
        subcategoria VARCHAR(100),
        metodo_pago VARCHAR(50) DEFAULT 'Debito_Efectivo',
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compras_tarjeta (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        descripcion TEXT NOT NULL,
        monto_total DECIMAL(10, 2) NOT NULL,
        cuotas_totales INT NOT NULL DEFAULT 1,
        monto_por_cuota DECIMAL(10, 2) NOT NULL,
        categoria VARCHAR(100),
        subcategoria VARCHAR(100),
        cuota_inicial INT DEFAULT 1,
        fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`ALTER TABLE compras_tarjeta ADD COLUMN IF NOT EXISTS cuota_inicial INT DEFAULT 1;`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cuotas_tarjeta (
        id SERIAL PRIMARY KEY,
        compra_id INTEGER REFERENCES compras_tarjeta(id) ON DELETE CASCADE,
        numero_cuota INT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        estado VARCHAR(20) DEFAULT 'Pendiente',
        gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
        fecha_vencimiento TIMESTAMP
      );
    `);

    // Tabla de config, creada preservando datos si ya existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tarjeta_config (
        id SERIAL PRIMARY KEY,
        fecha_cierre DATE,
        fecha_vencimiento DATE
      );
    `);
    
    // Insertamos fechas default únicamente si la tabla está vacía
    await pool.query(`
      INSERT INTO tarjeta_config (fecha_cierre, fecha_vencimiento) 
      SELECT CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '25 days'
      WHERE NOT EXISTS (SELECT 1 FROM tarjeta_config);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS suscripciones (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        descripcion TEXT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        categoria VARCHAR(100),
        subcategoria VARCHAR(100),
        fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      ON CONFLICT (id) DO NOTHING;
    `);

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

    // Limpiamos las tablas fallidas anteriores e impulsamos migraciones de esquema
    try {
      await pool.query(`ALTER TABLE gastos DROP COLUMN IF EXISTS resumen_id;`);
      await pool.query(`DROP TABLE IF EXISTS resumenes_tarjeta CASCADE;`);
      await pool.query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50) DEFAULT 'Debito_Efectivo';`);
      await pool.query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'ARS';`);
      await pool.query(`ALTER TABLE gastos ADD COLUMN IF NOT EXISTS monto_usd DECIMAL(10,2);`);
      await pool.query(`ALTER TABLE compras_tarjeta ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'ARS';`);
      await pool.query(`ALTER TABLE compras_tarjeta ADD COLUMN IF NOT EXISTS monto_usd DECIMAL(10,2);`);
      await pool.query(`ALTER TABLE cuotas_tarjeta ADD COLUMN IF NOT EXISTS gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL;`);
      await pool.query(`ALTER TABLE cuotas_tarjeta ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMP;`);
      await pool.query(`ALTER TABLE cuotas_tarjeta ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'ARS';`);
      await pool.query(`ALTER TABLE cuotas_tarjeta ADD COLUMN IF NOT EXISTS monto_usd DECIMAL(10,2);`);
      await pool.query(`ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'ARS';`);
      await pool.query(`ALTER TABLE suscripciones ADD COLUMN IF NOT EXISTS monto_usd DECIMAL(10,2);`);
    } catch(e) {}

    console.log('✅ Base de datos inicializada: tablas "gastos", "compras_tarjeta", "cuotas_tarjeta" y "recordatorio_config" listas.');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
  }
};
initDB();

// --- 🌐 API EXPRESS (BACKEND PARA TU WEB) ---
const app = express();
app.use(cors()); // Fundamental para el dashboard Angular
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
// Rutas principales
const gastosRouter = require('./routes/gastos');
const cuotasRouter = require('./routes/cuotas');
const tarjetaConfigRouter = require('./routes/tarjeta_config');
const suscripcionesRouter = require('./routes/suscripciones');
const aiRouter = require('./routes/ai');
const categoriasRouter = require('./routes/categorias');
const { router: recordatorioRouter, setSendTestNotification } = require('./routes/recordatorio');

app.use('/api/gastos', gastosRouter);
app.use('/api/cuotas', cuotasRouter);
app.use('/api/tarjeta_config', tarjetaConfigRouter);
app.use('/api/suscripciones', suscripcionesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/recordatorio', recordatorioRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API escuchando en el puerto ${PORT} (Conectado con Dashboard Web)`);
});

// --- 🧠 INICIALIZAMOS LA IA DE GEMINI ---
const cleanGeminiKey = (geminiApiKey || '').replace(/['" ]/g, '');
const genAI = new GoogleGenerativeAI(cleanGeminiKey);
// Helper para asignar emojis temáticos a las categorías en Telegram
const getCategoryEmoji = (categoriaId) => {
  const text = (categoriaId || '').toLowerCase();
  if (text.includes('super') || text.includes('alimen') || text.includes('comida') || text.includes('panad')) return '🛒';
  if (text.includes('kios') || text.includes('despen') || text.includes('antoj') || text.includes('snack')) return '🍫';
  if (text.includes('vivien') || text.includes('servici') || text.includes('hogar') || text.includes('casa') || text.includes('luz')) return '🏠';
  if (text.includes('transp') || text.includes('auto') || text.includes('nafta') || text.includes('uber') || text.includes('moto')) return '🚗';
  if (text.includes('ocio') || text.includes('salida') || text.includes('amigo') || text.includes('boliche') || text.includes('juntad')) return '🍕';
  if (text.includes('desarr') || text.includes('trabaj') || text.includes('estudio') || text.includes('oficina') || text.includes('gimnasio') || text.includes('ropa')) return '💼';
  if (text.includes('ahorr') || text.includes('inver') || text.includes('dolar') || text.includes('cripto')) return '📈';
  if (text.includes('mascot') || text.includes('perro') || text.includes('gato') || text.includes('veterin')) return '🐾';
  if (text.includes('salud') || text.includes('farma') || text.includes('medic') || text.includes('doctor')) return '💊';
  if (text.includes('educa') || text.includes('curso') || text.includes('libro')) return '📚';
  if (text.includes('viaj') || text.includes('vuelo') || text.includes('turism') || text.includes('hotel')) return '✈️';
  if (text.includes('impuest') || text.includes('banc') || text.includes('tasa') || text.includes('afip')) return '🏛️';
  return '🏷️';
};

// Función para obtener el modelo de Gemini con las categorías actualizadas
const getGeminiModel = async (modelName = 'gemini-flash-lite-latest') => {
  let configCats = [];
  try {
    const res = await pool.query('SELECT config FROM categorias_config WHERE id = 1');
    if (res.rows.length > 0) {
      configCats = res.rows[0].config;
    }
  } catch (e) {
    console.error('Error fetching categories for Gemini:', e);
  }

  const categoriesContext = configCats.map(c => {
    const subs = (c.subcategorias || []).map(s => s.id).join(', ');
    return `- ${c.id}: [${subs || 'Otros'}]`;
  }).join('\n');

  const hoyISO = new Date().toISOString().split('T')[0];

  const systemInstruction = `Sos un asistente financiero personal experto en Argentina. Tu único trabajo es extraer y estructurar gastos a partir de mensajes de texto o transcripciones de audio en español rioplatense.

FECHA ACTUAL DE REFERENCIA: ${hoyISO}

CATEGORÍAS Y SUBCATEGORÍAS DISPONIBLES (Elegí estrictamente de esta lista):
${categoriesContext}

REGLAS DE EXTRACCIÓN Y FORMATO:
1. 'gastos': DEVOLVÉ SIEMPRE UN ARRAY con los gastos detectados en el mensaje (puede ser 1 solo o una lista si el usuario anotó varios gastos juntos).
2. 'monto': número float positivo limpio, sin símbolos ($ / ARS) ni puntos de miles. Interpreta TODAS las formas y modismos argentinos:
   - Notación "k": "50k", "50 k", "50 K" -> 50000 | "1.5k", "1,5k" -> 1500 | "250k" -> 250000
   - Puntos de miles: "50.000", "50,000" -> 50000 (el punto es separador de miles en Argentina)
   - "mil": "50mil", "50 mil", "cincuenta mil" -> 50000 | "medio millón" -> 500000
   - Jerga "lucas" (1 luca = $1000): "50 lucas" -> 50000 | "1 luca" -> 1000 | "media luca" -> 500 | "2 lucas y media" -> 2500 | "10 lucas" -> 10000
   - Jerga "palos" (1 palo = $1.000.000): "1 palo" -> 1000000 | "2 palos" -> 2000000 | "un palo y medio" -> 1500000
   - Números en palabras: "cincuenta mil pesos" -> 50000 | "tres mil doscientos" -> 3200 | "veinte mil" -> 20000
   - Símbolos: "$50000", "$ 50.000", "50000$", "ARS 50000"
   - Posición libre: El monto puede estar al principio ("50k nafta"), al medio ("ayer gasté 50k en nafta") o al final ("nafta 50k", "arreglo caño de agua 50mil").
3. 'descripcion': texto conciso, limpio y con ortografía corregida (2 a 5 palabras).
   - Corregí errores tipográficos (ej: "Areglo" -> "Arreglo", "panaderia" -> "Panadería").
   - Capitalizá la primera letra.
   - Eliminá viñetas iniciales (- , • , *), artículos redundantes y verbos de relleno ("gasté", "pagué", "compré").
   - Conservá detalles útiles entre paréntesis si aportan contexto.
4. 'categoria' y 'subcategoria':
   - Elegí la categoría y subcategoría de la lista que mejor correspondan al gasto.
   - Plomería/arreglos/hogar/gas/luz/electricista -> Vivienda_y_Servicios -> Arreglos_Casa
   - Supermercado/alimentos grandes -> Supermercado_y_Alimentacion -> Compra_Fuerte_Mes
   - Carnicería/Verdulería/Panadería -> Supermercado_y_Alimentacion -> respectiva subcategoría
   - Kiosco/snacks/golosinas/antojos -> Kiosco_y_Despensa -> Antojos_y_Snacks
   - Salidas/bares/cenas/pareja/amigos/delivery -> Ocio_y_Relaciones
   - Nafta/combustible/peaje/uber -> Transporte
   - Si no hay match claro para la subcategoría, usá "Otros".
5. 'metodo_pago':
   - "Tarjeta_Credito": si menciona "tarjeta", "crédito", "tc", "visa", "master", o cuotas ("en 3 cuotas", "6 pagos").
   - "Debito_Efectivo": débito, transferencia, mercado pago, efectivo o si no especifica.
6. 'cuotas': número entero de cuotas (ej: 3, 6, 12). Si es en 1 pago o no especifica, poné 1.
7. 'monto_tipo': "por_cuota" (ej: "3 cuotas de 20k") o "total" (ej: "60k en 3 cuotas", o si cuotas es 1).
8. 'fecha': fecha del gasto en formato YYYY-MM-DD.
   - Si menciona "ayer", calculá la fecha del día anterior a la fecha de referencia.
   - Si menciona "anteayer", 2 días antes.
   - Si no menciona ninguna fecha, devolvé null (se asume hoy).
9. Si el mensaje NO contiene un gasto (saludos, preguntas, comandos), devolvé: {"error": "no_es_gasto"}

OUTPUT ESPERADO: JSON puro sin markdown, sin \`\`\`, con formato:
{
  "gastos": [
    {
      "monto": 50000,
      "descripcion": "Arreglo caño de agua",
      "categoria": "Vivienda_y_Servicios",
      "subcategoria": "Arreglos_Casa",
      "metodo_pago": "Debito_Efectivo",
      "cuotas": 1,
      "monto_tipo": "total",
      "fecha": null
    }
  ]
}`;

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction
  });
};

const MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.5-flash'
];

// Parser local de respaldo de máxima velocidad y resiliencia ante límites de cuota
const fallbackLocalParse = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  const parseSingle = (lineText) => {
    let clean = lineText.replace(/^[-•*–—]+\s*/, '').trim();

    // Detección de fecha relativa
    let fecha = null;
    const hoy = new Date();
    if (/\bayer\b/i.test(clean)) {
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      fecha = ayer.toISOString().split('T')[0];
      clean = clean.replace(/\bayer\b/gi, '').trim();
    } else if (/\banteayer\b/i.test(clean)) {
      const ante = new Date(hoy);
      ante.setDate(ante.getDate() - 2);
      fecha = ante.toISOString().split('T')[0];
      clean = clean.replace(/\banteayer\b/gi, '').trim();
    }

    // Detección de cuotas y tarjeta
    let cuotas = 1;
    let metodo_pago = 'Debito_Efectivo';
    const cuotasMatch = clean.match(/(\d+)\s*(?:cuotas|pagos)/i);
    if (cuotasMatch) {
      cuotas = parseInt(cuotasMatch[1], 10);
      metodo_pago = 'Tarjeta_Credito';
      clean = clean.replace(/en\s*\d+\s*(?:cuotas|pagos)/gi, '').replace(/\d+\s*(?:cuotas|pagos)/gi, '').trim();
    }
    if (/\b(tc|tarjeta|visa|master|mastercard|credito|crédito)\b/i.test(clean)) {
      metodo_pago = 'Tarjeta_Credito';
      clean = clean.replace(/\b(con|en)?\s*(tc|tarjeta|visa|master|mastercard|credito|crédito)\b/gi, '').trim();
    }

    let monto = null;

    if (/media\s+luca/i.test(clean)) {
      monto = 500;
      clean = clean.replace(/media\s+luca/gi, '').trim();
    } else if (/(?:1|un)\s+palo\s+y\s+medio/i.test(clean)) {
      monto = 1500000;
      clean = clean.replace(/(?:1|un)\s+palo\s+y\s+medio/gi, '').trim();
    } else if (/(\d+(?:[.,]\d+)?)\s*palos?/i.test(clean)) {
      const m = clean.match(/(\d+(?:[.,]\d+)?)\s*palos?/i);
      monto = parseFloat(m[1].replace(',', '.')) * 1000000;
      clean = clean.replace(m[0], '').trim();
    } else if (/(\d+)\s*lucas?\s+y\s+media/i.test(clean)) {
      const m = clean.match(/(\d+)\s*lucas?\s+y\s+media/i);
      monto = parseInt(m[1], 10) * 1000 + 500;
      clean = clean.replace(m[0], '').trim();
    } else if (/(\d+(?:[.,]\d+)?)\s*lucas?/i.test(clean)) {
      const m = clean.match(/(\d+(?:[.,]\d+)?)\s*lucas?/i);
      monto = parseFloat(m[1].replace(',', '.')) * 1000;
      clean = clean.replace(m[0], '').trim();
    } else if (/(\d+(?:[.,]\d+)?)\s*k\b/i.test(clean)) {
      const m = clean.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
      monto = parseFloat(m[1].replace(',', '.')) * 1000;
      clean = clean.replace(m[0], '').trim();
    } else if (/(\d+(?:[.,]\d+)?)\s*mil\b/i.test(clean)) {
      const m = clean.match(/(\d+(?:[.,]\d+)?)\s*mil\b/i);
      monto = parseFloat(m[1].replace(',', '.')) * 1000;
      clean = clean.replace(m[0], '').trim();
    } else if (/\$?\s*(\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?/i.test(clean)) {
      const m = clean.match(/\$?\s*(\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?/i);
      monto = parseFloat(m[1].replace(/\./g, ''));
      clean = clean.replace(m[0], '').trim();
    } else if (/\$?\s*(\d+(?:[.,]\d{1,2})?)/i.test(clean)) {
      const m = clean.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/i);
      monto = parseFloat(m[1].replace(',', '.'));
      clean = clean.replace(m[0], '').trim();
    }

    if (!monto || isNaN(monto) || monto <= 0) return null;

    let desc = clean
      .replace(/\b(gasté|gaste|pagué|pague|compré|compre|en|por)\b/gi, ' ')
      .replace(/[$,;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    desc = desc.replace(/^areglo\b/i, 'Arreglo');
    if (!desc) desc = 'Gasto';
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    const lower = (desc + ' ' + lineText).toLowerCase();
    let categoria = 'Otros';
    let subcategoria = 'Otros';

    if (/\b(caño|agua|plomero|gas|luz|electric|pintura|casa|hogar|arreglo|reparaci|albañil|ferreter)/.test(lower)) {
      categoria = 'Vivienda_y_Servicios';
      if (/\b(caño|plomero|arreglo|reparaci|albañil|ferreter|pintor)\b/.test(lower)) {
        subcategoria = 'Arreglos_Casa';
      } else if (/\b(luz|edenor|edesur|gas|metrogas|aysa)\b/.test(lower)) {
        subcategoria = 'Luz_Agua_Gas';
      } else if (/\b(internet|fibertel|telecentro|claro|flow|netflix|spotify)\b/.test(lower)) {
        subcategoria = 'Internet_y_Suscripciones';
      } else {
        subcategoria = 'Arreglos_Casa';
      }
    } else if (/\b(super|coto|dia|carrefour|chango|disco|vea|jumbo|almacen)\b/.test(lower)) {
      categoria = 'Supermercado_y_Alimentacion';
      subcategoria = 'Compra_Fuerte_Mes';
    } else if (/\b(carne|asado|pollo|carniceria|verduleria|fruta|verdura)\b/.test(lower)) {
      categoria = 'Supermercado_y_Alimentacion';
      subcategoria = 'Carniceria_Verduleria';
    } else if (/\b(pan|facturas|panaderia|medialunas)\b/.test(lower)) {
      categoria = 'Supermercado_y_Alimentacion';
      subcategoria = 'Panaderia';
    } else if (/\b(kiosco|golosina|alfajor|chocolate|snack|galletita|coca|papas)\b/.test(lower)) {
      categoria = 'Kiosco_y_Despensa';
      subcategoria = 'Antojos_y_Snacks';
    } else if (/\b(nafta|combustible|ypf|shell|axion|gnc|peaje|uber|cabify|taxi|remis|sube|colectivo)\b/.test(lower)) {
      categoria = 'Transporte';
      subcategoria = /\b(nafta|combustible|ypf|shell|axion|gnc)\b/.test(lower) ? 'Nafta' : (/\b(peaje|repuesto|taller)\b/.test(lower) ? 'Repuestos_y_Peajes' : 'Uber_y_Publico');
    } else if (/\b(cerveza|bar|birra|salida|cena|boliche|juntada|amigos|pareja|regalo|delivery|pizza|empanada|hamburguesa|sushi|pedidosya|rappi)\b/.test(lower)) {
      categoria = 'Ocio_y_Relaciones';
      subcategoria = /\b(delivery|pedidosya|rappi|pizza|empanada|hamburguesa|sushi)\b/.test(lower) ? 'Delivery_y_Comida_Hecha' : 'Salidas_Varias';
    } else if (/\b(farmacia|remedio|medicamento|medico|doctor|salud)\b/.test(lower)) {
      categoria = 'Desarrollo_y_Trabajo';
      subcategoria = 'Salud_y_Farmacia';
    } else if (/\b(gym|gimnasio|crossfit)\b/.test(lower)) {
      categoria = 'Desarrollo_y_Trabajo';
      subcategoria = 'Gimnasio';
    } else if (/\b(ropa|zapatilla|remera|pantalon|buzo|calzado)\b/.test(lower)) {
      categoria = 'Desarrollo_y_Trabajo';
      subcategoria = 'Ropa';
    } else if (/\b(perro|gato|mascota|veterinari|alimento perro|alimento gato|piedras)\b/.test(lower)) {
      categoria = 'Mascotas';
      subcategoria = /\b(veterinari|vacuna)\b/.test(lower) ? 'Veterinario_Salud' : 'Alimento_Piedras';
    }

    return {
      monto,
      descripcion: desc,
      categoria,
      subcategoria,
      metodo_pago,
      cuotas,
      monto_tipo: 'total',
      fecha
    };
  };

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const items = [];
    for (const l of lines) {
      const parsed = parseSingle(l);
      if (parsed) items.push(parsed);
    }
    if (items.length > 0) return { gastos: items };
  }

  const single = parseSingle(rawText);
  return single ? { gastos: [single] } : null;
};



const bot = new TelegramBot(token, { polling: true });
console.log('✅ Bot de Telegram inicializado y escuchando mensajes...');

bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.message.includes('409 Conflict')) {
    console.warn('⚠️ AVISO: Conflicto 409 de Telegram: Hay otra terminal o proceso ejecutando el bot con este token en simultáneo.');
  } else {
    console.error('Telegram polling error:', err.message);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const voice = msg.voice;

  if (!text && !voice) return;
  console.log(`📩 [Telegram] Mensaje de ${chatId}:`, text ? `"${text}"` : '[Nota de voz]');

  if (text.startsWith('/start')) {
    return bot.sendMessage(chatId, '¡Hola! Soy tu bot de gastos. Escríbeme qué gastaste (ej: "Gasté 5000 en el kiosco") o mándame un audio, y lo guardaré limpio en tu base de datos.\n\nPuedes usar /resumen para ver tus métricas del mes.');
  }

  if (text.startsWith('/resumen')) {
    try {
      // Sumamos por categoría usando la fecha actual
      const query = `
        SELECT categoria, SUM(monto) as total
        FROM gastos
        WHERE chat_id = $1
        AND extract(month from fecha) = extract(month from CURRENT_DATE)
        AND extract(year from fecha) = extract(year from CURRENT_DATE)
        GROUP BY categoria
        ORDER BY total DESC;
      `;
      const result = await pool.query(query, [chatId]);

      const mesActual = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date());
      const mesCapitalizado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

      if (result.rows.length === 0) {
        return bot.sendMessage(chatId, `No tienes gastos registrados en ${mesCapitalizado}.`);
      }

      let totalMes = 0;
      let mensaje = `📊 <b>Resumen de ${mesCapitalizado}:</b>\n\n`;

      result.rows.forEach(row => {
        const monto = parseFloat(row.total);
        totalMes += monto;
        // Limpiamos los guiones bajos para que quede más lindo
        const catLimpia = row.categoria.replace(/_/g, ' ');
        mensaje += `🔸 ${catLimpia}: $${monto.toFixed(2)}\n`;
      });

      mensaje += `\n💰 <b>Total gastado:</b> $${totalMes.toFixed(2)}`;

      // Cambiamos a HTML
      return bot.sendMessage(chatId, mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error obteniendo el resumen:', error);
      return bot.sendMessage(chatId, 'Hubo un error al obtener tu resumen de gastos.');
    }
  }

  if (text.startsWith('/deshacer')) {
    try {
      const result = await pool.query(`
        DELETE FROM gastos
        WHERE id = (
          SELECT id FROM gastos
          WHERE chat_id = $1
          ORDER BY fecha DESC
          LIMIT 1
        )
        RETURNING *;
      `, [chatId]);

      if (result.rows.length === 0) {
        return bot.sendMessage(chatId, 'No encontré ningún gasto reciente para borrar.');
      }

      const gastoBorrado = result.rows[0];
      return bot.sendMessage(chatId, `🗑️ <b>Gasto eliminado:</b>\n$${gastoBorrado.monto} en ${gastoBorrado.descripcion}`, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error al deshacer:', error);
      return bot.sendMessage(chatId, '❌ Hubo un error al intentar borrar el último gasto.');
    }
  }

  if (text.startsWith('/hoy')) {
    try {
      const query = `
        SELECT categoria, SUM(monto) as total
        FROM gastos
        WHERE chat_id = $1
        AND DATE(fecha) = CURRENT_DATE
        GROUP BY categoria
        ORDER BY total DESC;
      `;
      const result = await pool.query(query, [chatId]);

      if (result.rows.length === 0) {
        return bot.sendMessage(chatId, 'No tenés gastos registrados en el día de hoy.');
      }

      let totalHoy = 0;
      let mensaje = `☀️ <b>Gastos de Hoy:</b>\n\n`;

      result.rows.forEach(row => {
        const monto = parseFloat(row.total);
        totalHoy += monto;
        const catLimpia = row.categoria.replace(/_/g, ' ');
        mensaje += `🔸 ${catLimpia}: $${monto.toFixed(2)}\n`;
      });

      mensaje += `\n💰 <b>Total de hoy:</b> $${totalHoy.toFixed(2)}`;

      return bot.sendMessage(chatId, mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error obteniendo gastos de hoy:', error);
      return bot.sendMessage(chatId, 'Hubo un error al obtener tus gastos de hoy.');
    }
  }

  // --- LÓGICA DE REGISTRO DE GASTOS ---
  try {
    bot.sendChatAction(chatId, 'typing');

    let data = null;

    if (voice) {
      bot.sendMessage(chatId, '🎙️ Procesando audio...');
      const fileId = voice.file_id;
      const fileLink = await bot.getFileLink(fileId);

      const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
      const response = await fetchFn(fileLink);
      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');

      for (const modelName of MODEL_CANDIDATES) {
        try {
          const dynamicModel = await getGeminiModel(modelName);
          const geminiResult = await dynamicModel.generateContent([
            {
              inlineData: {
                mimeType: 'audio/ogg',
                data: base64Audio
              }
            },
            { text: 'Extrae los datos al JSON solicitado a partir del audio.' }
          ]);
          let jsonText = geminiResult.response.text();
          jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
          data = JSON.parse(jsonText);
          if (data) break;
        } catch (err) {
          console.warn(`[Audio] Modelo ${modelName} falló:`, err.message);
        }
      }
    } else {
      // Es texto: Intentamos con Gemini primero
      for (const modelName of MODEL_CANDIDATES) {
        try {
          const dynamicModel = await getGeminiModel(modelName);
          const prompt = `Extrae los datos al JSON solicitado: "${text}"`;
          const geminiResult = await dynamicModel.generateContent(prompt);
          let jsonText = geminiResult.response.text();
          jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
          data = JSON.parse(jsonText);
          if (data) {
            console.log(`✅ Procesado con éxito por ${modelName}:`, JSON.stringify(data));
            break;
          }
        } catch (err) {
          console.warn(`[Texto] Modelo ${modelName} falló (${err.status || err.message}). Intentando alternativa...`);
        }
      }

      // Si Gemini falló por cuota (429) o error de red, activamos el parser local inteligente
      if (!data || data.error) {
        const localParsed = fallbackLocalParse(text);
        if (localParsed) {
          data = localParsed;
          console.log("⚡ Procesado mediante parser inteligente de respaldo:", JSON.stringify(data));
        }
      }
    }

    if (!data || data.error) {
      return bot.sendMessage(chatId, '🤔 <b>No entendí eso como un gasto.</b>\n\n💡 <i>Podés escribir de forma simple, por ejemplo:</i>\n• <code>50000 arreglo caño de agua</code>\n• <code>50k nafta</code>\n• <code>3500 almuerzo</code>\n• <code>ayer 15k supermercado</code>', { parse_mode: 'HTML' });
    }

    const items = Array.isArray(data.gastos) ? data.gastos : (data.monto !== undefined ? [data] : []);

    if (items.length === 0) {
      return bot.sendMessage(chatId, '⚠️ <b>No pude identificar el monto en tu mensaje.</b>\n\n💡 <i>Asegurate de incluir el número (ej: <code>50k arreglo caño</code> o <code>50000 arreglo caño</code>).</i>', { parse_mode: 'HTML' });
    }

    // Caso A: Múltiples gastos detectados en un solo mensaje
    if (items.length > 1) {
      let totalBatch = 0;
      const insertedIds = [];
      const lines = [];

      for (const item of items) {
        const montoNum = parseFloat(item.monto);
        if (isNaN(montoNum) || montoNum <= 0) continue;
        totalBatch += montoNum;

        const desc = (item.descripcion || 'Gasto').trim();
        const cat = item.categoria || 'Otros';
        const sub = item.subcategoria || 'Otros';
        const metodo = item.metodo_pago || 'Debito_Efectivo';
        const f = item.fecha || null;

        const q = `
          INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago, fecha)
          VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamp, CURRENT_TIMESTAMP))
          RETURNING *;
        `;
        const resIns = await pool.query(q, [chatId, montoNum, desc, cat, sub, metodo, f]);
        const row = resIns.rows[0];
        insertedIds.push(row.id);
        appendGastoToSheets(row);

        const emoji = getCategoryEmoji(cat);
        const iconoPago = metodo === 'Tarjeta_Credito' ? '💳' : '💵';
        lines.push(`• ${emoji} <b>${desc}:</b> $${montoNum.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ${iconoPago} (<i>${cat.replace(/_/g, ' ')}</i>)`);
      }

      const replyMsg = `✅ <b>${lines.length} gastos registrados con éxito:</b>\n\n${lines.join('\n')}\n\n💰 <b>Total sumado:</b> $${totalBatch.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

      await bot.sendMessage(chatId, replyMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑️ Deshacer todos', callback_data: `undo_batch_${insertedIds.join(',')}` }]
          ]
        }
      });
      return;
    }

    // Caso B: Un solo gasto
    const item = items[0];
    const montoNum = parseFloat(item.monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return bot.sendMessage(chatId, '⚠️ No pude identificar el monto. Por favor sé más específico (ej: "50k arreglo caño").');
    }

    const descripcion = (item.descripcion || 'Sin descripción').trim();
    const categoria = item.categoria || 'Otros';
    const subcategoria = item.subcategoria || 'Otros';
    const metodo_pago = item.metodo_pago || 'Debito_Efectivo';
    const cuotas = parseInt(item.cuotas) || 1;
    const fechaVal = item.fecha || null;

    const emojiCat = getCategoryEmoji(categoria);
    const catLimpia = categoria.replace(/_/g, ' ');
    const subLimpia = subcategoria.replace(/_/g, ' ');

    let fechaTexto = '';
    if (fechaVal) {
      const [y, m, d] = fechaVal.split('-');
      fechaTexto = `\n📅 <b>Fecha:</b> ${d}/${m}/${y}`;
    }

    // Si es con Tarjeta de Crédito en cuotas
    if (metodo_pago === 'Tarjeta_Credito' && cuotas > 1) {
      let monto_total = montoNum;
      let monto_por_cuota = montoNum;

      if (item.monto_tipo === 'total') {
        monto_total = montoNum;
        monto_por_cuota = montoNum / cuotas;
      } else {
        monto_por_cuota = montoNum;
        monto_total = montoNum * cuotas;
      }

      const queryCompra = `
        INSERT INTO compras_tarjeta (chat_id, descripcion, monto_total, cuotas_totales, monto_por_cuota, categoria, subcategoria, fecha_compra)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamp, CURRENT_TIMESTAMP)) RETURNING id;
      `;
      const resultCompra = await pool.query(queryCompra, [chatId, descripcion, monto_total, cuotas, monto_por_cuota, categoria, subcategoria, fechaVal]);
      const compraId = resultCompra.rows[0].id;

      const cuotasPromises = [];
      for (let i = 1; i <= cuotas; i++) {
         cuotasPromises.push(pool.query(
           `INSERT INTO cuotas_tarjeta (compra_id, numero_cuota, monto, estado) VALUES ($1, $2, $3, 'Pendiente')`,
           [compraId, i, monto_por_cuota]
         ));
      }
      await Promise.all(cuotasPromises);

      const replyMsg = `✅ <b>Compra en Cuotas Registrada</b>\n💳 <b>Monto Total:</b> $${monto_total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}\n🔢 <b>Plan:</b> ${cuotas} cuotas de $${monto_por_cuota.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n📝 <b>Detalle:</b> ${descripcion}\n📂 <b>Categoría:</b> ${emojiCat} ${catLimpia} → ${subLimpia}${fechaTexto}\n\n<i>Quedó en tu Bandeja de Tarjetas para liquidarla mes a mes.</i>`;

      await bot.sendMessage(chatId, replyMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑️ Deshacer compra', callback_data: `undo_compra_${compraId}` }]
          ]
        }
      });
      return;
    }

    // Compra común (Débito/Efectivo o 1 cuota)
    const query = `
      INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago, fecha)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamp, CURRENT_TIMESTAMP))
      RETURNING *;
    `;
    const values = [chatId, montoNum, descripcion, categoria, subcategoria, metodo_pago, fechaVal];
    const queryResult = await pool.query(query, values);
    const nuevoGasto = queryResult.rows[0];

    appendGastoToSheets(nuevoGasto);

    const iconoPago = metodo_pago === 'Tarjeta_Credito' ? '💳 Tarjeta de Crédito (1 pago)' : '💵 Débito / Efectivo';
    const replyMsg = `✅ <b>Gasto registrado</b>\n💰 <b>Monto:</b> $${montoNum.toLocaleString('es-AR', { maximumFractionDigits: 0 })}\n📝 <b>Detalle:</b> ${descripcion}\n📂 <b>Categoría:</b> ${emojiCat} ${catLimpia} → ${subLimpia}\n💳 <b>Medio:</b> ${iconoPago}${fechaTexto}`;

    await bot.sendMessage(chatId, replyMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑️ Deshacer gasto', callback_data: `undo_gasto_${nuevoGasto.id}` }]
        ]
      }
    });
  } catch (error) {
    console.error('Error procesando el gasto:', error);
    let detalle = 'Error inesperado procesando el registro.';
    if (error.code === '429' || (error.message && error.message.includes('429'))) {
      detalle = 'Límite de solicitudes de IA superado momentáneamente. Por favor probá en unos segundos.';
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      detalle = 'No se pudo conectar a la base de datos PostgreSQL.';
    } else if (error.message) {
      detalle = error.message;
    }
    bot.sendMessage(chatId, `❌ <b>No pude registrar el gasto:</b>\n<i>${detalle}</i>\n\n💡 <i>Formatos recomendados:</i>\n• <code>50000 arreglo caño de agua</code>\n• <code>50k nafta</code>`, { parse_mode: 'HTML' });
  }
});

// --- ⏰ LÓGICA DE RECORDATORIOS INTELIGENTES POR TELEGRAM ---
const enviarRecordatorioTelegram = async (targetChatId, isTest = false) => {
  try {
    const todayRes = await pool.query(`
      SELECT COALESCE(SUM(monto), 0) as total, COUNT(id) as cantidad
      FROM gastos
      WHERE chat_id = $1 AND fecha >= CURRENT_DATE;
    `, [targetChatId]);

    const totalHoy = parseFloat(todayRes.rows[0].total || 0);
    const cantHoy = parseInt(todayRes.rows[0].cantidad || 0);

    let mensaje = isTest ? '🔔 <b>Prueba de Recordatorio Diario</b>\n\n' : '';
    let buttons = [];

    if (totalHoy > 0) {
      mensaje += `👋 <b>Recordatorio Diario de Gastos</b>\n\nHoy llevás registrados <b>$${totalHoy.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</b> (${cantHoy} ${cantHoy === 1 ? 'gasto' : 'gastos'}).\n\n¿Te quedó algún gasto chico o en efectivo suelto por anotar antes de cerrar el día? 🌙`;
      buttons = [
        [{ text: '✅ Todo anotado por hoy', callback_data: 'rec_ok' }],
        [{ text: '📊 Ver gastos de hoy', callback_data: 'rec_ver_hoy' }]
      ];
    } else {
      mensaje += `👋 <b>Recordatorio Diario de Gastos</b>\n\nHoy no registraste ningún gasto.\n\n¿No tuviste consumos hoy o te olvidaste de anotarlos? Mandame un mensaje o audio rápido por acá 🎙️`;
      buttons = [
        [{ text: '🛒 Hoy gasté $0', callback_data: 'rec_cero' }],
        [{ text: '✅ Todo anotado por hoy', callback_data: 'rec_ok' }]
      ];
    }

    await bot.sendMessage(targetChatId, mensaje, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons }
    });
    console.log(`⏰ Recordatorio enviado con éxito a Telegram (${targetChatId})`);
  } catch (err) {
    console.error('Error al enviar el recordatorio:', err);
  }
};

// Helper para obtener chat_ids de usuarios a notificar
const obtenerChatIdsNotificaciones = async () => {
  const ids = new Set(USUARIOS_AUTORIZADOS.filter(id => id && id !== 0));
  try {
    const res = await pool.query('SELECT DISTINCT chat_id FROM gastos WHERE chat_id IS NOT NULL AND chat_id != 0;');
    res.rows.forEach(r => {
      const cid = parseInt(r.chat_id, 10);
      if (!isNaN(cid) && cid !== 0) ids.add(cid);
    });
  } catch (e) {}
  return Array.from(ids);
};

// Registrar handler para botón de prueba desde el Dashboard Web
setSendTestNotification(async () => {
  const chatIds = await obtenerChatIdsNotificaciones();
  if (chatIds.length === 0) {
    throw new Error('No se encontraron usuarios activos para enviar la notificación.');
  }
  for (const cid of chatIds) {
    await enviarRecordatorioTelegram(cid, true);
  }
});

// Respuestas a botones de Telegram (Inline Keyboard Callbacks)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'rec_ok') {
      await bot.answerCallbackQuery(query.id, { text: '¡Excelente!' });
      await bot.editMessageText(`✅ <b>¡Genial! Todo al día por hoy.</b>\nQue tengas buenas noches 😴`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      });
    } else if (data === 'rec_cero') {
      await bot.answerCallbackQuery(query.id, { text: '¡Día de $0 gasto anotado!' });
      await bot.editMessageText(`🎉 <b>¡Excelente! Día sin gastos registrado.</b>\n¡A seguir cuidando la billetera! 👏`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      });
    } else if (data === 'rec_ver_hoy') {
      await bot.answerCallbackQuery(query.id);
      const result = await pool.query(`
        SELECT descripcion, monto, categoria, metodo_pago
        FROM gastos
        WHERE chat_id = $1 AND fecha >= CURRENT_DATE
        ORDER BY fecha DESC;
      `, [chatId]);

      if (result.rows.length === 0) {
        return bot.sendMessage(chatId, 'No tenés gastos registrados hoy.');
      }
      let msg = `<b>Gastos registrados el día de hoy:</b>\n\n`;
      let total = 0;
      result.rows.forEach(g => {
        const montoNum = parseFloat(g.monto);
        total += montoNum;
        const icono = g.metodo_pago === 'Tarjeta_Credito' ? '💳' : '💵';
        msg += `• <b>$${montoNum.toLocaleString('es-AR')}</b> ${icono} - ${g.descripcion} (<i>${g.categoria.replace(/_/g, ' ')}</i>)\n`;
      });
      msg += `\n💰 <b>Total hoy: $${total.toLocaleString('es-AR')}</b>`;
      bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    } else if (data.startsWith('undo_gasto_')) {
      const gastoId = data.replace('undo_gasto_', '');
      const delRes = await pool.query('DELETE FROM gastos WHERE id = $1 AND chat_id = $2 RETURNING *', [gastoId, chatId]);
      if (delRes.rows.length > 0) {
        const g = delRes.rows[0];
        await bot.answerCallbackQuery(query.id, { text: '¡Gasto eliminado!' });
        await bot.editMessageText(`🗑️ <b>Gasto eliminado:</b>\n$${parseFloat(g.monto).toLocaleString('es-AR')} en <i>${g.descripcion}</i>`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
      } else {
        await bot.answerCallbackQuery(query.id, { text: 'El gasto ya no existe o fue eliminado.' });
      }
    } else if (data.startsWith('undo_compra_')) {
      const compraId = data.replace('undo_compra_', '');
      await pool.query('DELETE FROM cuotas_tarjeta WHERE compra_id = $1', [compraId]);
      const delRes = await pool.query('DELETE FROM compras_tarjeta WHERE id = $1 AND chat_id = $2 RETURNING *', [compraId, chatId]);
      if (delRes.rows.length > 0) {
        const c = delRes.rows[0];
        await bot.answerCallbackQuery(query.id, { text: '¡Compra eliminada!' });
        await bot.editMessageText(`🗑️ <b>Compra eliminada:</b>\n$${parseFloat(c.monto_total).toLocaleString('es-AR')} en <i>${c.descripcion}</i> (${c.cuotas_totales} cuotas)`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
      } else {
        await bot.answerCallbackQuery(query.id, { text: 'La compra ya fue eliminada.' });
      }
    } else if (data.startsWith('undo_batch_')) {
      const ids = data.replace('undo_batch_', '').split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        await pool.query('DELETE FROM gastos WHERE id = ANY($1::int[]) AND chat_id = $2', [ids, chatId]);
        await bot.answerCallbackQuery(query.id, { text: `Se eliminaron ${ids.length} gastos.` });
        await bot.editMessageText(`🗑️ <b>Se eliminaron los ${ids.length} gastos correctamente.</b>`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
      }
    }
  } catch (err) {
    console.error('Error procesando callback_query:', err);
  }
});

// Cron job en segundo plano: Revisa la hora cada minuto
let ultimoMinutoEnviado = '';
cron.schedule('* * * * *', async () => {
  try {
    const configRes = await pool.query('SELECT hora, activo FROM recordatorio_config WHERE id = 1;');
    if (configRes.rows.length === 0 || !configRes.rows[0].activo) return;

    const { hora } = configRes.rows[0];
    const now = new Date();
    // Horario Argentina (UTC-3)
    const argentinaTimeStr = now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });
    const [hh, mm] = argentinaTimeStr.split(':');
    const currentHHMM = `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;

    if (currentHHMM === hora && ultimoMinutoEnviado !== currentHHMM) {
      ultimoMinutoEnviado = currentHHMM;
      console.log(`⏰ Cron ejecutando recordatorio diario de las ${hora}...`);
      const targetIds = await obtenerChatIdsNotificaciones();
      for (const uid of targetIds) {
        await enviarRecordatorioTelegram(uid);
      }
    }
  } catch (err) {
    console.error('Error en cron de recordatorio:', err);
  }
});