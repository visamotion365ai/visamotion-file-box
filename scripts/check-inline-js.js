// Extracts inline <script> blocks from index.html and syntax-checks each.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, bad = 0;
while ((m = re.exec(src))) {
  i++;
  const code = m[1];
  if (/^\s*$/.test(code)) continue;
  try {
    new Function(code);
    console.log(`inline script #${i}: OK (${code.length} chars)`);
  } catch (e) {
    bad++;
    console.error(`inline script #${i}: SYNTAX ERROR -> ${e.message}`);
  }
}
console.log(`checked ${i} inline script blocks, ${bad} failed`);
if (bad) process.exit(1);
