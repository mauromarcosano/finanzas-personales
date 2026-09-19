const fs = require('fs');

const logPath = 'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

console.log(`Total lines in log: ${lines.length}`);

lines.forEach((line, idx) => {
  if (line.includes('compras_tarjeta') || line.includes('Cubiertas Moto') || line.includes('inspect_db')) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.content) {
        console.log(`--- Line ${idx} ---`);
        console.log(typeof parsed.content === 'string' ? parsed.content.slice(0, 500) : JSON.stringify(parsed.content).slice(0, 500));
      }
    } catch(e){}
  }
});
