const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/mauro/.gemini/antigravity-ide/brain';

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDirectory(fullPath);
    } else if (file.endsWith('.jsonl') || file.endsWith('.log') || file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('gastos') || content.includes('INSERT INTO')) {
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('gastos') && (line.includes('INSERT') || line.includes('monto') || line.includes('descripcion') || line.includes('rows'))) {
              if (line.includes('Uber') || line.includes('Nafta') || line.includes('Supermercado') || line.includes('INSERT INTO gastos') || line.includes('SELECT')) {
                console.log(`[${file}:${idx + 1}]`);
                console.log(line.slice(0, 300));
              }
            }
          });
        }
      } catch (e) {}
    }
  }
}

searchDirectory(brainDir);
