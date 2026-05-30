// Preflight check for app.json: valid JSON and has expo field.
// Usage: node preflight-app-json.js <path-to-app.json>
// Exit 0 = OK, 1 = invalid JSON or read error, 2 = missing expo field
const fs = require('fs');
const path = process.argv[2];
if (!path) process.exit(1);
try {
  const content = fs.readFileSync(path, 'utf8');
  const j = JSON.parse(content);
  if (!j || !j.expo) process.exit(2);
  process.exit(0);
} catch (e) {
  process.exit(1);
}
