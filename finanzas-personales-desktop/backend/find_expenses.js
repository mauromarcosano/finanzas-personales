const fs = require('fs');

const logPath = 'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('gastos') && !line.includes('gastos.js') && !line.includes('routes') && !line.includes('TarjetasBandeja')) {
    if (line.includes('INSERT') || line.includes('monto') || line.includes('descripcion') || line.includes('Supermercado') || line.includes('Uber') || line.includes('Nafta') || line.includes('Carniceria') || line.includes('Kiosco') || line.includes('Efectivo')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.content) {
          console.log(`=== Line ${idx} ===`);
          console.log(typeof parsed.content === 'string' ? parsed.content.slice(0, 400) : JSON.stringify(parsed.content).slice(0, 400));
        }
      } catch(e){}
    }
  }
});
