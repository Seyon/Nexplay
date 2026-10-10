import { Movies4uClient } from '../src/utils/Movies4uProvider.js';

async function main() {
  const client = new Movies4uClient();
  const bridge61158 = 'https://m4ulinks.site/number/61158';
  console.log('Resolving Multi Audio bridge 61158...');
  const hubLinks = await client.extractHubCloudFromBridge(bridge61158, '1080p');
  console.log('Extracted hubLinks count:', hubLinks.length);
  hubLinks.forEach((h, idx) => {
    console.log(`[${idx}] Quality: ${h.quality}, Server: ${h.server}, URL: ${h.url}`);
  });
}

main().catch(console.error);
