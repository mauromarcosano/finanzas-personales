const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/mauro/.gemini';

function searchLogs(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchLogs(fullPath);
        } else if (file.endsWith('.log') || file.endsWith('.txt') || file.endsWith('.jsonl')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('gastos') || content.includes('monto') || content.includes('septiembre') || content.includes('Septiembre')) {
            const matches = content.split('\n').filter(l => (l.includes('gastos') || l.includes('monto')) && (l.includes('2026-09') || l.includes('Septiembre') || l.includes('septiembre') || l.includes('SELECT') || l.includes('INSERT')));
            if (matches.length > 0) {
              console.log(`=== FOUND IN ${fullPath} ===`);
              matches.slice(0, 10).forEach(m => console.log(m.slice(0, 200)));
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

searchLogs(baseDir);
