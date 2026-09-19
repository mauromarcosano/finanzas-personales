const fs = require('fs');

const logPath = 'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

const keywords = ['Uber', 'YouTube', 'Supermercado', 'Nafta', 'Comida', 'Gasto', 'gasto', '45000', '15000', '6694', '50000', '30000', '10000'];

lines.forEach((line, idx) => {
  keywords.forEach(kw => {
    if (line.includes(kw) && line.includes('USER_INPUT')) {
      try {
        const parsed = JSON.parse(line);
        console.log(`[Line ${idx}] ${parsed.content}`);
      } catch(e) {}
    }
  });
});
