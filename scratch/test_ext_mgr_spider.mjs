import { ExtensionManager } from '../src/utils/ExtensionManager.js';

async function main() {
  console.log('Testing ExtensionManager findAndResolvePlayableStream for Spider-Man on Server 3 (Movies4u)...');
  const start = Date.now();
  const res = await ExtensionManager.findAndResolvePlayableStream({
    targetTitle: 'Spider-Man Brand New Day',
    targetYear: 2026,
    isTVShow: false,
    provider: 'movies4u',
    allowCrossProviderFallback: false
  });
  console.log(`Resolved in ${((Date.now() - start)/1000).toFixed(2)}s:`);
  console.log('Title:', res.title);
  console.log('Primary streamUrl:', res.streamUrl);
  console.log('Qualities:');
  for (const [q, u] of Object.entries(res.qualities || {})) {
    console.log(`- ${q}: ${u}`);
  }
}

main().catch(console.error);
