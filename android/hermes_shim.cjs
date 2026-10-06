const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let outFile = null;
let inFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-out' && i + 1 < args.length) {
    outFile = args[i + 1];
    i++;
  } else if (!args[i].startsWith('-')) {
    inFile = args[i];
  }
}

console.log('[HermesShim] Bypassing native hermesc compile for Device Guard compatibility');
console.log('[HermesShim] In file:', inFile);
console.log('[HermesShim] Out file:', outFile);

if (inFile && outFile) {
  try {
    fs.copyFileSync(inFile, outFile);
    console.log('[HermesShim] Successfully copied bundle to target bytecode location');

    // Create sourcemap if requested
    const mapOut = outFile + '.map';
    const candidateMap = inFile + '.packager.map';
    if (fs.existsSync(candidateMap)) {
      fs.copyFileSync(candidateMap, mapOut);
    } else {
      fs.writeFileSync(mapOut, JSON.stringify({ version: 3, sources: [], mappings: '' }), 'utf8');
    }
  } catch (e) {
    console.error('[HermesShim] Error:', e);
    process.exit(1);
  }
} else {
  console.warn('[HermesShim] Missing inFile or outFile, exiting 0');
}

process.exit(0);
