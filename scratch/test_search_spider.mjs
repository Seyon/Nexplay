import { Movies4uClient } from '../src/utils/Movies4uProvider.js';

async function main() {
  const client = new Movies4uClient();
  const results = await client.search('Spider-Man Brand New Day');
  console.log('Results count:', results.length);
  results.forEach((r, idx) => {
    console.log(`[${idx}] Title: ${r.title}`);
    console.log(`     Link: ${r.link}`);
  });
}

main().catch(console.error);
