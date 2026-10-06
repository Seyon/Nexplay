import * as FileSystem from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';

const getDocumentDir = () => {
  if (FileSystem && FileSystem.documentDirectory) {
    return FileSystem.documentDirectory;
  }
  if (Paths && Paths.document) {
    const uri = Paths.document.uri || (typeof Paths.document === 'string' ? Paths.document : '');
    if (uri) return uri.endsWith('/') ? uri : `${uri}/`;
  }
  return 'file:///data/user/0/com.anonymous.Stitchnexplay/files/';
};

const getSettingsFilePath = () => `${getDocumentDir()}nexplay_settings.json`;
const getBackupKeyFilePath = () => `${getDocumentDir()}tmdb_key.txt`;

let _settings = {
  tmdbApiKey: '',
  hasConfiguredTmdbKey: false,
  dontShowDonationAgain: false,
  donationDismissedCount: 0,
  lastDonationShownTime: 0,
};

let _isInitialized = false;
let _initPromise = null;
const _listeners = new Set();

/**
 * Notify all subscribed components of settings changes
 */
const notifyListeners = (eventType, payload) => {
  _listeners.forEach((listener) => {
    try {
      if (typeof listener === 'function') {
        listener({ eventType, payload, settings: { ..._settings } });
      }
    } catch (e) {
      console.warn('[AppSettings] Listener error:', e);
    }
  });
};

/**
 * Initialize settings from local storage on startup.
 * Uses expo-file-system/legacy with fallback to new File API & raw backup key file.
 */
export const initSettings = async () => {
  if (_isInitialized) return { ..._settings };
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    let loadedContent = null;
    const settingsPath = getSettingsFilePath();

    // 1. Try reading primary settings JSON via legacy FileSystem
    try {
      if (FileSystem && typeof FileSystem.getInfoAsync === 'function') {
        const info = await FileSystem.getInfoAsync(settingsPath);
        if (info && info.exists) {
          loadedContent = await FileSystem.readAsStringAsync(settingsPath);
        }
      }
    } catch (e) {
      console.warn('[AppSettings] Legacy read error:', e?.message || e);
    }

    // 2. Fallback to new File API if legacy read yielded nothing
    if (!loadedContent) {
      try {
        if (Paths && Paths.document && typeof File === 'function') {
          const file = new File(Paths.document, 'nexplay_settings.json');
          if (file && file.exists) {
            loadedContent = await file.text();
          }
        }
      } catch (e) {
        console.warn('[AppSettings] New File API read error:', e?.message || e);
      }
    }

    // Parse loaded JSON settings
    if (loadedContent) {
      try {
        const parsed = JSON.parse(loadedContent);
        _settings = {
          ..._settings,
          ...parsed,
          tmdbApiKey: (parsed.tmdbApiKey || '').trim(),
          hasConfiguredTmdbKey: Boolean(parsed.tmdbApiKey && parsed.tmdbApiKey.trim().length >= 8),
          dontShowDonationAgain: Boolean(parsed.dontShowDonationAgain),
        };
      } catch (err) {
        console.warn('[AppSettings] Corrupted settings JSON:', err);
      }
    }

    // 3. Fallback: check backup key file if no key was found in JSON
    if (!_settings.tmdbApiKey) {
      try {
        const backupPath = getBackupKeyFilePath();
        if (FileSystem && typeof FileSystem.getInfoAsync === 'function') {
          const bInfo = await FileSystem.getInfoAsync(backupPath);
          if (bInfo && bInfo.exists) {
            const rawKey = await FileSystem.readAsStringAsync(backupPath);
            const cleaned = (rawKey || '').trim();
            if (cleaned.length >= 8) {
              _settings.tmdbApiKey = cleaned;
              _settings.hasConfiguredTmdbKey = true;
            }
          }
        }
      } catch (bErr) {
        // silent fallback
      }
    }

    _isInitialized = true;
    _initPromise = null;
    return { ..._settings };
  })();

  return _initPromise;
};

/**
 * Persist in-memory settings to local disk using dual-strategy
 */
const persistSettings = async () => {
  const data = JSON.stringify(_settings, null, 2);
  const settingsPath = getSettingsFilePath();
  let writeSuccess = false;

  // 1. Primary write via legacy FileSystem
  try {
    if (FileSystem && typeof FileSystem.writeAsStringAsync === 'function') {
      await FileSystem.writeAsStringAsync(settingsPath, data);
      writeSuccess = true;
    }
  } catch (e) {
    console.warn('[AppSettings] Legacy write error:', e?.message || e);
  }

  // 2. Secondary write via new File API
  try {
    if (Paths && Paths.document && typeof File === 'function') {
      const file = new File(Paths.document, 'nexplay_settings.json');
      await file.write(data);
      writeSuccess = true;
    }
  } catch (e) {
    // silent fallback
  }

  // 3. Persist backup key file
  if (_settings.tmdbApiKey) {
    try {
      const backupPath = getBackupKeyFilePath();
      if (FileSystem && typeof FileSystem.writeAsStringAsync === 'function') {
        await FileSystem.writeAsStringAsync(backupPath, _settings.tmdbApiKey);
      }
    } catch (e) {
      // silent
    }
  } else {
    try {
      const backupPath = getBackupKeyFilePath();
      if (FileSystem && typeof FileSystem.deleteAsync === 'function') {
        await FileSystem.deleteAsync(backupPath, { idempotent: true });
      }
    } catch (e) {
      // silent
    }
  }

  if (!writeSuccess) {
    console.warn('[AppSettings] Warning: Could not confirm disk write.');
  }
};

/**
 * Synchronous getter for TMDB API key
 */
export const getTmdbApiKey = () => {
  return (_settings.tmdbApiKey || '').trim();
};

/**
 * Check if a valid TMDB API key is currently saved
 */
export const hasTmdbApiKey = () => {
  const key = getTmdbApiKey();
  return Boolean(key && key.length >= 8);
};

/**
 * Save / replace TMDB API Key
 */
export const saveTmdbApiKey = async (newKey) => {
  const sanitized = (newKey || '').trim();
  _settings.tmdbApiKey = sanitized;
  _settings.hasConfiguredTmdbKey = Boolean(sanitized && sanitized.length >= 8);
  await persistSettings();
  notifyListeners('TMDB_KEY_SAVED', { key: sanitized });
  return _settings;
};

/**
 * Delete TMDB API Key completely
 */
export const deleteTmdbApiKey = async () => {
  _settings.tmdbApiKey = '';
  _settings.hasConfiguredTmdbKey = false;
  await persistSettings();
  notifyListeners('TMDB_KEY_DELETED', {});
  return _settings;
};

/**
 * Check if the donation popup should never be shown again
 */
export const getDontShowDonationAgain = () => {
  return Boolean(_settings.dontShowDonationAgain);
};

/**
 * Update donation popup preference
 */
export const setDontShowDonationAgain = async (dontShow = true) => {
  _settings.dontShowDonationAgain = Boolean(dontShow);
  await persistSettings();
  notifyListeners('DONATION_PREF_CHANGED', { dontShowAgain: _settings.dontShowDonationAgain });
  return _settings;
};

/**
 * Record that donation popup was dismissed for this session / time
 */
export const recordDonationDismissed = async () => {
  _settings.donationDismissedCount = (_settings.donationDismissedCount || 0) + 1;
  _settings.lastDonationShownTime = Date.now();
  await persistSettings();
};

/**
 * Get current settings snapshot
 */
export const getSettings = () => ({ ..._settings });

/**
 * Subscribe to settings mutations
 */
export const subscribeSettings = (callback) => {
  _listeners.add(callback);
  return () => {
    _listeners.delete(callback);
  };
};

export default {
  initSettings,
  getTmdbApiKey,
  hasTmdbApiKey,
  saveTmdbApiKey,
  deleteTmdbApiKey,
  getDontShowDonationAgain,
  setDontShowDonationAgain,
  recordDonationDismissed,
  getSettings,
  subscribeSettings,
};
