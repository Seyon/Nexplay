import { Movies4uClient } from '../src/utils/Movies4uProvider.js';

async function main() {
  const client = new Movies4uClient();
  const url = 'https://new1.movies4u.garden/spider-man-brand-new-day-2026-multi-audio-full-movie/';
  const details = await client.extractDetails(url);
  console.log('Title:', details.title);
  console.log('Quality Bridges count:', details.qualityBridges?.length);
  details.qualityBridges?.forEach((b, idx) => {
    console.log(`[${idx}] Label: ${b.label}`);
    console.log(`     Quality: ${b.quality}`);
    console.log(`     Size: ${b.size}`);
    console.log(`     BridgeUrl: ${b.bridgeUrl}`);
  });
}

main().catch(console.error);
