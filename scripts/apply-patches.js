const fs = require('fs');
const path = require('path');

const vlcPlayerViewPath = path.join(__dirname, '..', 'node_modules', '@lunarr', 'vlc-player', 'android', 'src', 'main', 'java', 'com', 'lunarr', 'vlcplayer', 'VLCPlayerView.kt');

if (fs.existsSync(vlcPlayerViewPath)) {
  let content = fs.readFileSync(vlcPlayerViewPath, 'utf8');
  if (content.includes('player.setTime(targetMs, true)')) {
    content = content.replace('player.setTime(targetMs, true)', 'player.setTime(targetMs, false)');
    content = content.replace('player.setPosition(pos, true)', 'player.setPosition(pos, false)');
    fs.writeFileSync(vlcPlayerViewPath, content, 'utf8');
    console.log('[apply-patches] Successfully patched VLCPlayerView.kt for synchronous seek.');
  } else {
    console.log('[apply-patches] VLCPlayerView.kt already patched or up to date.');
  }
} else {
  console.log('[apply-patches] VLCPlayerView.kt not found (skipped).');
}
