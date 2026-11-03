/**
 * StorageAdapter.js
 * 
 * Safe cross-environment persistent file storage adapter for Expo SDK 57 and Node.js testing.
 * Compatible with Expo 57 (`expo-file-system/legacy`, `File`, `Paths`) and Node.js `fs`.
 */

let FileSystem = null;
let ExpoFile = null;
let ExpoPaths = null;
let nodeFs = null;
let nodePath = null;

try {
  FileSystem = require('expo-file-system/legacy');
} catch (_) {}

try {
  const ef = require('expo-file-system');
  ExpoFile = ef?.File;
  ExpoPaths = ef?.Paths;
} catch (_) {}

try {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    nodeFs = require('fs');
    nodePath = require('path');
  }
} catch (_) {}

export class StorageAdapter {
  static getDocumentDir() {
    if (FileSystem && FileSystem.documentDirectory) {
      return FileSystem.documentDirectory;
    }
    if (ExpoPaths && ExpoPaths.document) {
      const uri = ExpoPaths.document.uri || (typeof ExpoPaths.document === 'string' ? ExpoPaths.document : '');
      if (uri) return uri.endsWith('/') ? uri : `${uri}/`;
    }
    if (nodeFs && nodePath) {
      const tmpDir = nodePath.join(process.cwd(), '.nexplay_cache');
      try {
        if (!nodeFs.existsSync(tmpDir)) {
          nodeFs.mkdirSync(tmpDir, { recursive: true });
        }
      } catch (_) {}
      return tmpDir + nodePath.sep;
    }
    return 'file:///data/user/0/com.anonymous.Stitchnexplay/files/';
  }

  static getFilePath(filename) {
    const dir = this.getDocumentDir();
    return `${dir}${filename}`;
  }

  static async readText(filename) {
    const filePath = this.getFilePath(filename);

    // 1. Expo legacy FileSystem
    try {
      if (FileSystem && typeof FileSystem.getInfoAsync === 'function') {
        const info = await FileSystem.getInfoAsync(filePath);
        if (info && info.exists) {
          return await FileSystem.readAsStringAsync(filePath);
        }
      }
    } catch (_) {}

    // 2. Expo new File API
    try {
      if (ExpoPaths && ExpoPaths.document && typeof ExpoFile === 'function') {
        const file = new ExpoFile(ExpoPaths.document, filename);
        if (file && file.exists) {
          return await file.text();
        }
      }
    } catch (_) {}

    // 3. Node.js fs fallback (for unit tests)
    try {
      if (nodeFs && nodeFs.existsSync(filePath)) {
        return nodeFs.readFileSync(filePath, 'utf8');
      }
    } catch (_) {}

    return null;
  }

  static async writeText(filename, content) {
    const filePath = this.getFilePath(filename);

    // 1. Expo legacy FileSystem
    try {
      if (FileSystem && typeof FileSystem.writeAsStringAsync === 'function') {
        await FileSystem.writeAsStringAsync(filePath, content);
        return true;
      }
    } catch (_) {}

    // 2. Expo new File API
    try {
      if (ExpoPaths && ExpoPaths.document && typeof ExpoFile === 'function') {
        const file = new ExpoFile(ExpoPaths.document, filename);
        await file.write(content);
        return true;
      }
    } catch (_) {}

    // 3. Node.js fs fallback (for unit tests)
    try {
      if (nodeFs) {
        nodeFs.writeFileSync(filePath, content, 'utf8');
        return true;
      }
    } catch (_) {}

    return false;
  }
}

export default StorageAdapter;

