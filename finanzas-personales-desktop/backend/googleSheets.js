const { google } = require('googleapis');

/**
 * Sincroniza un gasto en una planilla de Google Sheets.
 * Requiere en .env:
 * - GOOGLE_SHEETS_SPREADSHEET_ID
 * - GOOGLE_CLIENT_EMAIL
 * - GOOGLE_PRIVATE_KEY
 */
async function appendGastoToSheets(gasto) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    console.log('ℹ️ Sincronización con Google Sheets omitida: faltan configurar variables de entorno (GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY).');
    return { success: false, reason: 'unconfigured' };
  }

  try {
    privateKey = privateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Rango dinámico o pestaña por defecto "Gastos"
    const sheetName = process.env.GOOGLE_SHEETS_TAB_NAME || 'Gastos';

    const fechaFormateada = gasto.fecha 
      ? new Date(gasto.fecha).toISOString().replace('T', ' ').substring(0, 19)
      : new Date().toISOString().replace('T', ' ').substring(0, 19);

    const values = [
      [
        fechaFormateada,
        gasto.categoria ? gasto.categoria.replace(/_/g, ' ') : 'Otros',
        gasto.subcategoria ? gasto.subcategoria.replace(/_/g, ' ') : 'Otros',
        gasto.descripcion || 'Sin descripción',
        gasto.monto || 0,
        gasto.metodo_pago ? gasto.metodo_pago.replace(/_/g, ' ') : 'Debito/Efectivo'
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    console.log('✅ Gasto sincronizado exitosamente en Google Sheets');
    return { success: true };
  } catch (error) {
    console.error('❌ Error al sincronizar con Google Sheets:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { appendGastoToSheets };
