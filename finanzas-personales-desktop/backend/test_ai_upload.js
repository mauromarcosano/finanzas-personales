const fs = require('fs');
const path = require('path');

const pdfs = [
  'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.user_uploaded/media_1789094982370.pdf',
  'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.user_uploaded/media_1789094982373.pdf',
  'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.user_uploaded/media_1789094982409.pdf'
];

async function scanAndImport(pdfPath, index) {
  try {
    console.log(`\n=== Procesando PDF ${index + 1} ===`);
    console.log(`Leyendo archivo: ${pdfPath}`);
    const fileData = fs.readFileSync(pdfPath);
    const base64 = fileData.toString('base64');

    console.log(`[1] Enviando a /api/ai/scan-resumen...`);
    const scanRes = await fetch('http://localhost:3000/api/ai/scan-resumen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: base64, mimeType: 'application/pdf' })
    });
    
    if (!scanRes.ok) {
      const err = await scanRes.text();
      console.error(`Error en scan-resumen: ${scanRes.status} - ${err}`);
      return;
    }
    
    const scanData = await scanRes.json();
    console.log(`✅ Escaneo exitoso. Período: ${scanData.periodo}, Total ARS: ${scanData.total_resumen_ars}, Total USD: ${scanData.total_resumen_usd}`);
    console.log(`   Items encontrados: ${scanData.items.length}`);
    
    // Guardar el JSON para revisar
    const outPath = `C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/scratch/scan_result_${index + 1}.json`;
    fs.writeFileSync(outPath, JSON.stringify(scanData, null, 2));
    console.log(`   JSON guardado en: ${outPath}`);

    // Solo importar si hay items que no estén ya registrados
    const itemsToImport = scanData.items.filter(i => !i.ya_registrado);
    if (itemsToImport.length > 0) {
      console.log(`[2] Importando ${itemsToImport.length} ítems nuevos...`);
      const importRes = await fetch('http://localhost:3000/api/ai/import-scanned-gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo: scanData.periodo,
          items: itemsToImport,
          chat_id: 0
        })
      });
      
      const importData = await importRes.json();
      console.log(`✅ Importación:`, importData);
    } else {
      console.log(`[2] No hay ítems nuevos para importar (todos ya registrados).`);
    }

  } catch (error) {
    console.error(`Error procesando el PDF ${index + 1}:`, error);
  }
}

async function main() {
  for (let i = 0; i < pdfs.length; i++) {
    await scanAndImport(pdfs[i], i);
  }
  console.log('\n✅ Proceso completado.');
}

main();
