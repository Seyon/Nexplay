import { Movies4uClient } from '../src/utils/Movies4uProvider.js';

async function main() {
  const client = new Movies4uClient();
  const url = 'https://new1.movies4u.garden/spider-man-brand-new-day-2026-multi-audio-full-movie/';
  console.log('Testing getPlayableStream on Movies4u...');
  const start = Date.now();
  const res = await client.getPlayableStream(url);
  console.log(`Resolved in ${((Date.now() - start)/1000).toFixed(2)}s:`);
  console.log('Stream URL:', res.streamUrl);
  console.log('Qualities:', Object.keys(res.qualities || {}));
  for (const [q, u] of Object.entries(res.qualities || {})) {
    console.log(`- ${q}: ${u.substring(0, 100)}...`);
  }
}

main().catch(console.error);
