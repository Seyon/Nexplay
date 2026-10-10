import { ExtensionManager } from '../src/utils/ExtensionManager.js';

async function testServer(serverName, provider) {
  console.log(`\n--- Testing ${serverName} (${provider}) for Spider-Man Brand New Day ---`);
  const start = Date.now();
  try {
    const res = await ExtensionManager.findAndResolvePlayableStream({
      targetTitle: 'Spider-Man Brand New Day',
      targetYear: 2026,
      isTVShow: false,
      provider: provider,
      allowCrossProviderFallback: false
    });
    console.log(`Resolved in ${((Date.now() - start)/1000).toFixed(2)}s:`);
    console.log('Title:', res.title);
    console.log('Primary streamUrl:', res.streamUrl);
    for (const [q, u] of Object.entries(res.qualities || {})) {
      console.log(`- ${q}: ${u.substring(0, 110)}...`);
    }
  } catch (err) {
    console.error(`Error on ${serverName}:`, err.message);
  }
}

async function main() {
  await testServer('Server 2 (4KHDHub)', '4khdhub');
  await testServer('Server 1 (HDHub4u)', 'hdhub4u');
}

main().catch(console.error);
