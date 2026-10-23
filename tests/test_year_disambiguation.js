const fs = require('fs');

const code = fs.readFileSync('src/utils/ScraperEngine.js', 'utf8');

// Extract pure algorithmic matching functions (lines ~9 to 375)
const startIdx = code.indexOf('function normalizeNumbers');
const endIdx = code.indexOf('function safeBase64Decode');
if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not find slice boundaries in ScraperEngine.js');
}

const slice = code.substring(startIdx, endIdx).replace(/export\s+/g, '');

const fn = new Function(slice + '; return { calculateTitleMatchScore, findBestMatch };');
const { calculateTitleMatchScore, findBestMatch } = fn();

console.log('Testing calculateTitleMatchScore & findBestMatch:\n');

// Test 1: Moana 2026 vs Moana 2016 vs Moana 2 (2024)
const c2016 = { title: 'Moana (2016) Hindi English Dual Audio 1080p Bluray', year: '2016' };
const c2026 = { title: 'Moana (2026) Multi Audio Hindi Tamil Telugu English 1080p WEB-DL', year: '2026' };
const c2024 = { title: 'Moana 2 (2024) Hindi English 1080p WEB-DL', year: '2024' };

const s2016_for_2026 = calculateTitleMatchScore('Moana', 2026, 'movie', c2016.title, c2016.year, 'movie');
const s2026_for_2026 = calculateTitleMatchScore('Moana', 2026, 'movie', c2026.title, c2026.year, 'movie');
const s2024_for_2026 = calculateTitleMatchScore('Moana', 2026, 'movie', c2024.title, c2024.year, 'movie');

console.log('Target: Moana (2026)');
console.log('  Score for Moana 2016 (diff 10):', s2016_for_2026.toFixed(3));
console.log('  Score for Moana 2026 (diff 0):', s2026_for_2026.toFixed(3));
console.log('  Score for Moana 2 2024:', s2024_for_2026.toFixed(3));

const bestFor2026 = findBestMatch('Moana', 2026, 'movie', [c2016, c2026, c2024]);
console.log('  Result -> Best match for Moana 2026:', bestFor2026 ? bestFor2026.title : 'NONE');

// Test 2: Target Moana 2016
const s2016_for_2016 = calculateTitleMatchScore('Moana', 2016, 'movie', c2016.title, c2016.year, 'movie');
const s2026_for_2016 = calculateTitleMatchScore('Moana', 2016, 'movie', c2026.title, c2026.year, 'movie');
console.log('\nTarget: Moana (2016)');
console.log('  Score for Moana 2016 (diff 0):', s2016_for_2016.toFixed(3));
console.log('  Score for Moana 2026 (diff 10):', s2026_for_2016.toFixed(3));
const bestFor2016 = findBestMatch('Moana', 2016, 'movie', [c2016, c2026, c2024]);
console.log('  Result -> Best match for Moana 2016:', bestFor2016 ? bestFor2016.title : 'NONE');

// Test 3: Target Moana 2 (2024)
const s2024_for_2024 = calculateTitleMatchScore('Moana 2', 2024, 'movie', c2024.title, c2024.year, 'movie');
console.log('\nTarget: Moana 2 (2024)');
console.log('  Score for Moana 2 2024:', s2024_for_2024.toFixed(3));
const bestFor2024 = findBestMatch('Moana 2', 2024, 'movie', [c2016, c2026, c2024]);
console.log('  Result -> Best match for Moana 2 2024:', bestFor2024 ? bestFor2024.title : 'NONE');

// Test 4: Pinocchio 2022 vs 1940
const p1940 = { title: 'Pinocchio (1940) Dual Audio 720p', year: '1940' };
const p2022 = { title: 'Pinocchio (2022) Multi Audio 1080p WEB-DL', year: '2022' };
const bestPinocchio = findBestMatch('Pinocchio', 2022, 'movie', [p1940, p2022]);
console.log('\nTarget: Pinocchio (2022)');
console.log('  Result -> Best match:', bestPinocchio ? bestPinocchio.title : 'NONE');

if (
  bestFor2026 && bestFor2026.year === '2026' &&
  bestFor2016 && bestFor2016.year === '2016' &&
  bestFor2024 && bestFor2024.year === '2024' &&
  bestPinocchio && bestPinocchio.year === '2022'
) {
  console.log('\n>>> ALL 4 YEAR DISAMBIGUATION TESTS PASSED PERFECTLY! <<<');
} else {
  console.error('\n>>> SOME TESTS FAILED <<<');
  process.exit(1);
}
