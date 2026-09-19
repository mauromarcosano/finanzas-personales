const fs = require('fs');

const logPath = 'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('gastos') && (line.includes('SELECT') || line.includes('rows'))) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.content && typeof parsed.content === 'string' && parsed.content.includes('gastos')) {
        console.log(`=== Line ${idx} ===`);
        console.log(parsed.content.slice(0, 400));
      }
    } catch(e){}
  }
});
