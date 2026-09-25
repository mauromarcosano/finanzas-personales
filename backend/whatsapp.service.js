const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const pool = require('./db');
const { appendGastoToSheets } = require('./googleSheets');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiApiKey = process.env.GEMINI_API_KEY;
const cleanGeminiKey = (geminiApiKey || '').replace(/['" ]/g, '');
const genAI = new GoogleGenerativeAI(cleanGeminiKey);

const MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.5-flash'
];

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

const getGeminiModel = async (modelName = 'gemini-1.5-flash') => {
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
1. 'gastos': DEVOLVÉ SIEMPRE UN ARRAY con los gastos detectados en el mensaje.
2. 'monto': número float positivo limpio, sin símbolos ($ / ARS) ni puntos de miles. Interpreta TODAS las formas y modismos argentinos.
3. 'descripcion': texto conciso, limpio y con ortografía corregida (2 a 5 palabras).
4. 'categoria' y 'subcategoria':
   - Elegí la categoría y subcategoría de la lista que mejor correspondan al gasto.
5. 'metodo_pago':
   - "Tarjeta_Credito": si menciona "tarjeta", "crédito", "tc", "visa", "master", o cuotas ("en 3 cuotas", "6 pagos").
   - "Debito_Efectivo": débito, transferencia, mercado pago, efectivo o si no especifica.
6. 'cuotas': número entero de cuotas. Si es en 1 pago o no especifica, poné 1.
7. 'monto_tipo': "por_cuota" o "total".
8. 'fecha': fecha del gasto en formato YYYY-MM-DD.
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

const fallbackLocalParse = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  const parseSingle = (lineText) => {
    let clean = lineText.replace(/^[-•*–—]+\s*/, '').trim();

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

    const bigNumMatch = clean.match(/\b(\d{1,3}(?:\.\d{3})+|\d{4,8})\b/);
    const kMatch = clean.match(/\b(\d+(?:[.,]\d+)?)\s*k\b/i);

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
    } else if (bigNumMatch && (!kMatch || parseFloat(bigNumMatch[1].replace(/\./g, '')) >= 1000)) {
      monto = parseFloat(bigNumMatch[1].replace(/\./g, ''));
      clean = clean.replace(bigNumMatch[0], '').trim();
    } else if (kMatch) {
      monto = parseFloat(kMatch[1].replace(',', '.')) * 1000;
      clean = clean.replace(kMatch[0], '').trim();
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

const initWhatsAppBot = () => {
  console.log('Inicializando WhatsApp Bot...');
  
  // Puppeteer config adapted to current environment
  const puppeteerConfig = {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  // If we are on Linux (like Render), we usually need to specify the executable path
  // If we are on Windows, puppeteer downloads chrome natively.
  if (process.platform === 'linux') {
    puppeteerConfig.executablePath = '/usr/bin/google-chrome-stable';
  }

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
  });

  client.on('qr', (qr) => {
    console.log('Escanea este código QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('✅ Bot de WhatsApp inicializado y listo!');
  });

  client.on('message', async (msg) => {
    // Only respond to private messages, not group messages unless specified
    if (msg.from.includes('@g.us')) return;

    // Use a numeric format for chatId to match PostgreSQL schema (BIGINT)
    // We can use the hash of the phone number or just string stripped of non-digits
    const chatIdString = msg.from.replace(/\D/g, '');
    const chatId = parseInt(chatIdString.substring(0, 15), 10); 
    
    const text = msg.body || '';
    const hasMedia = msg.hasMedia;

    if (chatId) {
      try {
        const contact = await msg.getContact();
        await pool.query(`
          INSERT INTO telegram_users (chat_id, first_name, username, last_active)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (chat_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP, first_name = COALESCE(EXCLUDED.first_name, telegram_users.first_name), username = COALESCE(EXCLUDED.username, telegram_users.username);
        `, [chatId, contact.pushname || 'Usuario WA', contact.number || '']);
      } catch (e) {}
    }

    if (!text && !hasMedia) return;
    console.log(`📩 [WhatsApp] Mensaje de ${chatId}:`, text ? `"${text}"` : '[Media/Audio]');

    if (text.toLowerCase().startsWith('hola') || text.toLowerCase().startsWith('/start')) {
      return msg.reply('¡Hola! Soy tu bot de gastos. Escríbeme qué gastaste (ej: "Gasté 5000 en el kiosco") o mándame un audio, y lo guardaré limpio en tu base de datos.\n\nPuedes escribir "resumen" para ver tus métricas del mes.');
    }

    if (text.toLowerCase().startsWith('resumen') || text.toLowerCase().startsWith('/resumen')) {
      try {
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
          return msg.reply(`No tienes gastos registrados en ${mesCapitalizado}.`);
        }

        let totalMes = 0;
        let mensaje = `*Resumen de ${mesCapitalizado}:*\n\n`;

        result.rows.forEach(row => {
          const monto = parseFloat(row.total);
          totalMes += monto;
          const catLimpia = row.categoria.replace(/_/g, ' ');
          mensaje += `🔸 ${catLimpia}: $${monto.toFixed(2)}\n`;
        });

        mensaje += `\n💰 *Total gastado:* $${totalMes.toFixed(2)}`;

        return msg.reply(mensaje);
      } catch (error) {
        console.error('Error obteniendo el resumen:', error);
        return msg.reply('Hubo un error al obtener tu resumen de gastos.');
      }
    }

    if (text.toLowerCase().startsWith('hoy') || text.toLowerCase().startsWith('/hoy')) {
      try {
        const query = `
          SELECT categoria, SUM(monto) as total
          FROM gastos
          WHERE chat_id = $1
          AND (fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
          GROUP BY categoria
          ORDER BY total DESC;
        `;
        const result = await pool.query(query, [chatId]);

        if (result.rows.length === 0) {
          return msg.reply('No tenés gastos registrados en el día de hoy.');
        }

        let totalHoy = 0;
        let mensaje = `☀️ *Gastos de Hoy:*\n\n`;

        result.rows.forEach(row => {
          const monto = parseFloat(row.total);
          totalHoy += monto;
          const catLimpia = row.categoria.replace(/_/g, ' ');
          mensaje += `🔸 ${catLimpia}: $${monto.toFixed(2)}\n`;
        });

        mensaje += `\n💰 *Total de hoy:* $${totalHoy.toFixed(2)}`;

        return msg.reply(mensaje);
      } catch (error) {
        console.error('Error obteniendo gastos de hoy:', error);
        return msg.reply('Hubo un error al obtener tus gastos de hoy.');
      }
    }

    if (text.toLowerCase().startsWith('deshacer') || text.toLowerCase().startsWith('/deshacer')) {
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
          return msg.reply('No encontré ningún gasto reciente para borrar.');
        }

        const gastoBorrado = result.rows[0];
        return msg.reply(`🗑️ *Gasto eliminado:*\n$${gastoBorrado.monto} en ${gastoBorrado.descripcion}`);
      } catch (error) {
        console.error('Error al deshacer:', error);
        return msg.reply('❌ Hubo un error al intentar borrar el último gasto.');
      }
    }

    // LÓGICA DE REGISTRO DE GASTOS
    try {
      let data = null;

      if (hasMedia && msg.type === 'ptt') {
        const media = await msg.downloadMedia();
        if (media && media.mimetype.includes('audio')) {
          msg.reply('🎙️ Procesando audio...');
          
          for (const modelName of MODEL_CANDIDATES) {
            try {
              const dynamicModel = await getGeminiModel(modelName);
              const geminiResult = await dynamicModel.generateContent([
                {
                  inlineData: {
                    mimeType: media.mimetype,
                    data: media.data
                  }
                },
                { text: 'Extrae los datos al JSON solicitado a partir del audio.' }
              ]);
              let jsonText = geminiResult.response.text();
              jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
              data = JSON.parse(jsonText);
              if (data) break;
            } catch (err) {
              console.warn(`[Audio WA] Modelo ${modelName} falló:`, err.message);
            }
          }
        }
      } else if (text) {
        // Es texto: Intentamos con Gemini primero
        for (const modelName of MODEL_CANDIDATES) {
          try {
            const dynamicModel = await getGeminiModel(modelName);
            const prompt = `Extrae los datos al JSON solicitado: "${text}"`;
            const geminiResult = await dynamicModel.generateContent(prompt);
            let jsonText = geminiResult.response.text();
            jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
            data = JSON.parse(jsonText);
            if (data) break;
          } catch (err) {
            console.warn(`[Texto WA] Modelo ${modelName} falló. Intentando alternativa...`);
          }
        }

        // Si Gemini falló, usamos el parser local
        if (!data || data.error) {
          const localParsed = fallbackLocalParse(text);
          if (localParsed) {
            data = localParsed;
          }
        }
      }

      if (!data || data.error) {
        return msg.reply('🤔 *No entendí eso como un gasto.*\n\n💡 _Podés escribir de forma simple, por ejemplo:_\n• `50000 arreglo caño de agua`\n• `50k nafta`\n• `3500 almuerzo`\n• `ayer 15k supermercado`');
      }

      const items = Array.isArray(data.gastos) ? data.gastos : (data.monto !== undefined ? [data] : []);

      if (items.length === 0) {
        return msg.reply('⚠️ *No pude identificar el monto en tu mensaje.*\n\n💡 _Asegurate de incluir el número (ej: `50k arreglo caño` o `50000 arreglo caño`)._');
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
          lines.push(`• ${emoji} *${desc}:* $${montoNum.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ${iconoPago} (_${cat.replace(/_/g, ' ')}_)`);
        }

        const replyMsg = `✅ *${lines.length} gastos registrados con éxito:*\n\n${lines.join('\n')}\n\n💰 *Total sumado:* $${totalBatch.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
        return msg.reply(replyMsg);
      }

      // Caso B: Un solo gasto
      const item = items[0];
      const montoNum = parseFloat(item.monto);
      if (isNaN(montoNum) || montoNum <= 0) {
        return msg.reply('⚠️ No pude identificar el monto. Por favor sé más específico (ej: "50k arreglo caño").');
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
        fechaTexto = `\n📅 *Fecha:* ${d}/${m}/${y}`;
      }

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

        const replyMsg = `✅ *Compra en Cuotas Registrada*\n💳 *Monto Total:* $${monto_total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}\n🔢 *Plan:* ${cuotas} cuotas de $${monto_por_cuota.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n📝 *Detalle:* ${descripcion}\n📂 *Categoría:* ${emojiCat} ${catLimpia} → ${subLimpia}${fechaTexto}\n\n_Quedó en tu Bandeja de Tarjetas para liquidarla mes a mes._`;
        return msg.reply(replyMsg);
      }

      // Compra común
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
      const replyMsg = `✅ *Gasto registrado*\n💰 *Monto:* $${montoNum.toLocaleString('es-AR', { maximumFractionDigits: 0 })}\n📝 *Detalle:* ${descripcion}\n📂 *Categoría:* ${emojiCat} ${catLimpia} → ${subLimpia}\n💳 *Medio:* ${iconoPago}${fechaTexto}`;
      
      return msg.reply(replyMsg);
    } catch (error) {
      console.error('Error procesando el gasto en WA:', error);
      let detalle = 'Error inesperado procesando el registro.';
      if (error.message && error.message.includes('ECONNREFUSED')) {
        detalle = 'No se pudo conectar a la base de datos PostgreSQL.';
      } else if (error.message) {
        detalle = error.message;
      }
      return msg.reply(`❌ *No pude registrar el gasto:*\n_${detalle}_`);
    }
  });

  client.initialize();
};

module.exports = { initWhatsAppBot };
