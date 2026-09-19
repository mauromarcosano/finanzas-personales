const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db');
const { appendGastoToSheets } = require('../googleSheets');

const USUARIOS_AUTORIZADOS = (process.env.TELEGRAM_ALLOWED_USERS || '')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

router.post('/opinion', async (req, res) => {
  try {
    const geminiApiKey = (process.env.GEMINI_API_KEY || '').replace(/['" ]/g, '');
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en .env' });
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const { month, totalMes, totalTarjeta, mayorGasto, categorias, topGastos } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Sos un asesor financiero personal e inteligente con tono cálido, argentino/rioplatense, amigable y perspicaz. Tu trabajo es dar una opinión honesta, constructiva y concisa sobre los gastos mensuales del usuario.

REGLAS DE FORMATO:
- Respondé ÚNICAMENTE con un objeto JSON válido (sin marcas markdown \`\`\`json, sin texto adicional) con esta estructura exacta:
{
  "titulo": "Título simpático y llamativo de 4-7 palabras",
  "diagnostico": "excelente" | "moderado" | "atencion",
  "opinion": "Explicación clara de 2 párrafos breves sobre el balance del mes, destacando virtudes y compras excesivas.",
  "destacados": [
    "🔥 Emoji + viñeta corta de aspecto clave 1",
    "💡 Emoji + viñeta corta de aspecto clave 2",
    "⚠️ Emoji + viñeta corta de aspecto clave 3"
  ],
  "tip": "Consejo financiero práctico y conciso de 1 sola oración para el próximo mes."
}`
    });

    const prompt = `Analizá los siguientes gastos del usuario correspondientes al período ${month || 'del mes'}:

- Dinero total gastado: $${totalMes || 0} ARS
- Consumo en tarjeta de crédito: $${totalTarjeta || 0} ARS
- Mayor gasto registrado: ${mayorGasto ? `${mayorGasto.descripcion} ($${mayorGasto.monto} - Categoría: ${mayorGasto.categoria})` : 'Ninguno'}
- Desglose por categorías (nombre, monto, %): ${JSON.stringify(categorias || [])}
- Muestra de gastos recientes: ${JSON.stringify((topGastos || []).slice(0, 10).map(g => ({ desc: g.descripcion, monto: g.monto, cat: g.categoria, pago: g.metodo_pago })))}

Generá la respuesta en el formato JSON especificado.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const json = JSON.parse(text);
    res.json(json);
  } catch (error) {
    console.error('Error al generar opinión con IA:', error);
    res.status(500).json({
      error: 'No se pudo obtener la opinión de la IA',
      details: error.message
    });
  }
});

// Endpoint para procesar PDF / Capturas de Resúmenes de Tarjeta con IA y Conciliación
router.post('/scan-resumen', async (req, res) => {
  try {
    const geminiApiKey = (process.env.GEMINI_API_KEY || '').replace(/['" ]/g, '');
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en .env' });
    }
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'No se adjuntó ningún archivo' });
    }

    // Extraer base64 puro
    let cleanBase64 = fileBase64;
    if (fileBase64.includes('base64,')) {
      cleanBase64 = fileBase64.split('base64,')[1];
    }

    // Consultar gastos, cuotas y suscripciones existentes en la BD para conciliar
    const gastosRes = await pool.query('SELECT id, descripcion, monto, categoria, subcategoria, fecha FROM gastos ORDER BY fecha DESC LIMIT 300');
    const cuotasRes = await pool.query(`
      SELECT ct.id as cuota_id, ct.numero_cuota, ct.monto, ct.estado, c.descripcion, c.monto_total, c.cuotas_totales, c.monto_por_cuota
      FROM cuotas_tarjeta ct
      JOIN compras_tarjeta c ON ct.compra_id = c.id
    `);
    const suscripcionesRes = await pool.query('SELECT id, descripcion, monto, categoria, moneda, monto_usd FROM suscripciones');

    const existingContext = {
      gastos_db: gastosRes.rows.map(g => ({ desc: g.descripcion, monto: parseFloat(g.monto), fecha: g.fecha })),
      cuotas_db: cuotasRes.rows.map(c => ({ desc: c.descripcion, cuota: `${c.numero_cuota}/${c.cuotas_totales}`, monto_cuota: parseFloat(c.monto), monto_total: parseFloat(c.monto_total), estado: c.estado })),
      suscripciones_db: suscripcionesRes.rows.map(s => ({ desc: s.descripcion, monto: parseFloat(s.monto), moneda: s.moneda || 'ARS', monto_usd: s.monto_usd ? parseFloat(s.monto_usd) : null }))
    };

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Sos un especialista en contabilidad e IA experto en escanear resúmenes de tarjeta de crédito (Visa, Mastercard, Amex) o comprobantes bancarios en Argentina.

TU TAREA:
1. Extraer la lista completa de todos los consumos/gastos presentes en el documento adjunto (PDF o Imagen).
2. Identificar claramente la MONEDA de cada consumo (ARS o USD en dólares).
3. Identificar si un consumo es una SUSCRIPCIÓN RECURRENTE (ej. YouTube Premium, Spotify, Netflix, Disney+, Amazon Prime, iCloud, Google One, ChatGPT, Servidores, Internet, etc.).
4. Comparar cada consumo hallado en el documento con la lista de gastos/cuotas/suscripciones que el usuario YA tiene en la base de datos (contexto provisto).

REGLAS DE COINCIDENCIA Y DEDUPLICACIÓN:
- En los resúmenes bancarios, los nombres suelen ser raros/genéricos (ej. "MERCADOPAGO*NEUMATICOS" vs "Cubiertas Moto", "GOOGLE YOUTUBE" vs "YouTube Premium", "EST SERV YPF" vs "Carga Nafta").
- Si el monto coincide (tolerancia ±$150 ARS o ±USD 0.50) o coincide el valor de la cuota/suscripción con los datos existentes, consideralo COINCIDENTE y marcá "ya_registrado": true, colocando el nombre coincidente en "coincidencia_con".
- Si NO coincide con ningún gasto previamente cargado, poné "ya_registrado": false.

TAXONOMÍA DE CATEGORÍAS (Elegir la mejor para cada ítem):
- Supermercado_y_Alimentacion (Compra_Fuerte_Mes, Carniceria_Verduleria, Panaderia)
- Kiosco_y_Despensa (Antojos_y_Snacks, Compras_de_Emergencia)
- Vivienda_y_Servicios (Luz_Agua_Gas, Internet_y_Suscripciones, Arreglos_Casa)
- Transporte (Nafta, Repuestos_y_Peajes, Uber_y_Publico)
- Ocio_y_Relaciones (Salidas_Pareja, Juntadas_Amigos, Regalos, Delivery_y_Comida_Hecha)
- Desarrollo_y_Trabajo (Herramientas_Trabajo, Gimnasio, Salud_y_Farmacia, Ropa)
- Otros (Otros)

FORMATO DE RESPUESTA JSON OBLIGATORIO (sin marcas markdown \`\`\`json):
{
  "periodo": "ej. Agosto 2026",
  "banco_tarjeta": "ej. Visa Banco Galicia",
  "total_resumen_ars": 150000.00,
  "total_resumen_usd": 15.99,
  "items": [
    {
      "id": "1",
      "fecha": "YYYY-MM-DD",
      "descripcion_resumen": "GOOGLE *YOUTUBE PREMIUM",
      "descripcion": "YouTube Premium",
      "moneda": "USD",
      "monto_usd": 3.99,
      "monto": 5386.50,
      "cuotas": 1,
      "cuota_actual": 1,
      "monto_tipo": "total",
      "es_suscripcion": true,
      "destino": "suscripcion",
      "categoria": "Vivienda_y_Servicios",
      "subcategoria": "Internet_y_Suscripciones",
      "metodo_pago": "Tarjeta_Credito",
      "ya_registrado": false,
      "coincidencia_con": null
    }
  ]
}`
    });

    const filePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType || 'application/pdf'
      }
    };

    const prompt = `Analizá y procesá este documento adjunto (resumen/factura) y comparalo contra mis gastos ya registrados en la base de datos:
${JSON.stringify(existingContext, null, 2)}

Extraé todos los consumos y devolvé el JSON especificado.`;

    const result = await model.generateContent([prompt, filePart]);
    let text = result.response.text();
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const jsonResult = JSON.parse(text);
    res.json(jsonResult);
  } catch (error) {
    console.error('Error procesando resumen con IA:', error);
    res.status(500).json({ error: 'Error al escanear el resumen con IA', details: error.message });
  }
});

// Helper para parsear fecha del período si el ítem no trae fecha exacta
function parsePeriodDate(periodoStr, itemFechaStr) {
  if (itemFechaStr && /^\d{4}-\d{2}-\d{2}/.test(itemFechaStr)) {
    return itemFechaStr;
  }

  if (periodoStr) {
    const mesesMap = {
      enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
      julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    };
    const cleanStr = periodoStr.toLowerCase();
    let foundMonth = null;
    for (const [mName, mNum] of Object.entries(mesesMap)) {
      if (cleanStr.includes(mName)) {
        foundMonth = mNum;
        break;
      }
    }
    const yearMatch = cleanStr.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    if (foundMonth) {
      return `${year}-${foundMonth}-01`;
    }
  }

  return new Date().toISOString();
}

// Endpoint para importar en lote los gastos escaneados que no estaban cargados
router.post('/import-scanned-gastos', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { items, periodo, chat_id } = req.body;
    const cid = chat_id || (USUARIOS_AUTORIZADOS[0] || 0);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay ítems seleccionados para importar' });
    }

    let importedCount = 0;

    for (const item of items) {
      const fechaTarget = parsePeriodDate(periodo, item.fecha);
      const moneda = item.moneda || (item.monto_usd > 0 ? 'USD' : 'ARS');
      const montoUsd = parseFloat(item.monto_usd) || null;
      const montoIngresado = parseFloat(item.monto) || 0;
      const destino = item.destino || (item.es_suscripcion ? 'suscripcion' : (item.metodo_pago === 'Debito_Efectivo' ? 'debito' : 'tarjeta'));

      if (destino === 'suscripcion') {
        // Guardar como suscripción recurrente
        await client.query(`
          INSERT INTO suscripciones (chat_id, descripcion, monto, categoria, subcategoria, moneda, monto_usd)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          cid,
          item.descripcion || item.descripcion_resumen,
          montoIngresado,
          item.categoria || 'Vivienda_y_Servicios',
          item.subcategoria || 'Internet_y_Suscripciones',
          moneda,
          montoUsd
        ]);
        importedCount++;
      } else if (destino === 'tarjeta' || item.metodo_pago === 'Tarjeta_Credito') {
        const c = parseInt(item.cuotas) || 1;
        const cuotaActual = parseInt(item.cuota_actual) || 1;
        const esTotal = item.monto_tipo === 'total';
        let monto_total = montoIngresado;
        let monto_por_cuota = montoIngresado;

        if (c > 1) {
          if (esTotal) {
            monto_total = montoIngresado;
            monto_por_cuota = montoIngresado / c;
          } else {
            monto_por_cuota = montoIngresado;
            monto_total = montoIngresado * c;
          }
        }

        const queryCompra = `
          INSERT INTO compras_tarjeta (chat_id, descripcion, monto_total, cuotas_totales, monto_por_cuota, categoria, subcategoria, cuota_inicial, fecha_compra, moneda, monto_usd)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamp, $10, $11) RETURNING id;
        `;
        const resCompra = await client.query(queryCompra, [
          cid,
          item.descripcion || item.descripcion_resumen,
          monto_total,
          c,
          monto_por_cuota,
          item.categoria || 'Otros',
          item.subcategoria || 'Otros',
          cuotaActual,
          fechaTarget,
          moneda,
          montoUsd
        ]);
        const compraId = resCompra.rows[0].id;

        for (let i = 1; i <= c; i++) {
          const estado = i < cuotaActual ? 'Pagada' : 'Pendiente';
          await client.query(
            `INSERT INTO cuotas_tarjeta (compra_id, numero_cuota, monto, estado, moneda, monto_usd) VALUES ($1, $2, $3, $4, $5, $6)`,
            [compraId, i, monto_por_cuota, estado, moneda, montoUsd]
          );
        }
        importedCount++;
      } else {
        // Débito / Efectivo
        const gastoRes = await client.query(`
          INSERT INTO gastos (chat_id, monto, descripcion, categoria, subcategoria, metodo_pago, fecha, moneda, monto_usd)
          VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9)
          RETURNING *;
        `, [
          cid,
          montoIngresado,
          item.descripcion || item.descripcion_resumen,
          item.categoria || 'Otros',
          item.subcategoria || 'Otros',
          item.metodo_pago || 'Debito_Efectivo',
          fechaTarget,
          moneda,
          montoUsd
        ]);
        
        appendGastoToSheets(gastoRes.rows[0]);
        importedCount++;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `¡Se importaron ${importedCount} consumos exitosamente!`, count: importedCount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importando gastos escaneados:', error);
    res.status(500).json({ error: 'Error al importar los gastos', details: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
