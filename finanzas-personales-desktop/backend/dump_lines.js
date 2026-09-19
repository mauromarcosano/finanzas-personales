const fs = require('fs');

const logPath = 'C:/Users/mauro/.gemini/antigravity-ide/brain/29054943-58e8-41bc-be80-73dc3eb8fa48/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 680; i <= 700; i++) {
  if (lines[i]) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.content) {
        console.log(`=== LINE ${i} ===`);
        console.log(parsed.content);
      }
    } catch(e) {}
  }
}
