import { Movies4uClient } from '../src/utils/Movies4uProvider.js';

async function main() {
  const client = new Movies4uClient();
  const hubUrl = 'https://hubcloud.ist/drive/2ei62qikngfe6qy';
  console.log('Resolving HubCloud link from Multi Audio bridge...');
  const streams = await client.resolveStream(hubUrl, '1080p');
  console.log('Resolved streams count:', streams.length);
  for (const s of streams) {
    console.log(`- Server: ${s.server}`);
    console.log(`  URL: ${s.url}`);
    const check = await client.verifyMediaStream(s.url, s.headers);
    console.log(`  Live: ${check.isLive}, supports206: ${check.supports206}`);
  }
}

main().catch(console.error);
