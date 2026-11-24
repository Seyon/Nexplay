/**
 * ProviderUpdateManager.js
 * High-Speed Over-The-Air (OTA) Scraper & Provider Dynamic Update Service
 * 
 * Features:
 * - Checks GitHub repository for provider/scraper updates on app launch without freezing UI
 * - Multi-tier endpoints: jsDelivr CDN (fast & unblocked) + Fastly + GitHub Raw fallback
 * - Universal storage support: React Native AsyncStorage / Expo FileSystem / Browser localStorage / In-Memory
 * - Runtime hot-patching of HDHub4u, 4KHDHub, Movies4u domains, mirrors, and DoH endpoints
 * - Offline-first resilience: Seamlessly falls back to cached/bundled defaults on network failure
 */

import { HDHub4u, FourKHDHub, UniversalScraper } from './ScraperEngine.js';
import { Movies4u } from './Movies4uProvider.js';
import { AnimeSalt } from '../providers/animesalt/index.js';
import StorageAdapterService from '../services/StorageAdapter.js';

// Multi-Tier GitHub Endpoints with automatic fallback across CDNs and repositories
const PRIMARY_MANIFEST_URLS = [
  'https://raw.githubusercontent.com/ajith3211996-netizen/Providers-Nexplay/main/manifest.json',
  'https://raw.githubusercontent.com/Seyon/Providers-Nexplay/main/manifest.json',
  'https://cdn.jsdelivr.net/gh/ajith3211996-netizen/Providers-Nexplay@main/manifest.json',
  'https://cdn.jsdelivr.net/gh/Seyon/Providers-Nexplay@main/manifest.json',
  'https://fastly.jsdelivr.net/gh/ajith3211996-netizen/Providers-Nexplay@main/manifest.json'
];

const MANIFEST_FILENAME = 'providers_manifest.json';
const STORAGE_KEY_MANIFEST = '@nexplay_providers_manifest';
const STORAGE_KEY_VERSION = '@nexplay_providers_version';
const STORAGE_KEY_LAST_CHECK = '@nexplay_providers_last_check';

// Cross-Platform Storage Adapter
class StorageAdapter {
  constructor() {
    this.memoryStore = new Map();
    this.asyncStorage = null;
    this.initStorage();
  }

  initStorage() {
    try {
      if (typeof globalThis !== 'undefined') {
        if (globalThis.AsyncStorage) {
          this.asyncStorage = globalThis.AsyncStorage;
        } else if (globalThis.ReactNativeAsyncStorage) {
          this.asyncStorage = globalThis.ReactNativeAsyncStorage;
        }
      }
    } catch (e) {}
  }

  async getItem(key) {
    try {
      if (StorageAdapterService && typeof StorageAdapterService.readText === 'function') {
        const text = await StorageAdapterService.readText(MANIFEST_FILENAME);
        if (text) return text;
      }
    } catch (_) {}
    if (this.asyncStorage && typeof this.asyncStorage.getItem === 'function') {
      try {
        return await this.asyncStorage.getItem(key);
      } catch (e) {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (e) {}
    }
    return this.memoryStore.get(key) || null;
  }

  async setItem(key, value) {
    this.memoryStore.set(key, value);
    try {
      if (StorageAdapterService && typeof StorageAdapterService.writeText === 'function') {
        await StorageAdapterService.writeText(MANIFEST_FILENAME, value);
      }
    } catch (_) {}
    if (this.asyncStorage && typeof this.asyncStorage.setItem === 'function') {
      try {
        await this.asyncStorage.setItem(key, value);
      } catch (e) {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {}
    }
  }
}

class ProviderUpdateManagerService {
  constructor() {
    this.storage = new StorageAdapter();
    this.currentVersion = '1.2.0';
    this.currentManifest = null;
    this.isChecking = false;
    this.lastCheckTime = 0;
    this.listeners = new Set();
    this.initialized = false;
  }

  /**
   * Subscribe to OTA update events:
   * 'checking' | 'update-available' | 'update-applied' | 'up-to-date' | 'error'
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  emit(event, data = {}) {
    for (const listener of this.listeners) {
      try {
        listener({ event, data, timestamp: Date.now() });
      } catch (err) {
        console.warn('[ProviderUpdateManager] Error in event listener:', err);
      }
    }
  }

  /**
   * Initialize Provider Update Manager on App Launch
   * Fast, non-blocking startup: Loads cached config first, then triggers immediate background update check.
   */
  async init({ autoCheck = true, checkIntervalMs = 1000 * 60 * 15 } = {}) {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // 1. Load cached manifest immediately (Zero Startup Delay)
      const cachedManifestStr = await this.storage.getItem(STORAGE_KEY_MANIFEST);
      if (cachedManifestStr) {
        try {
          const cached = JSON.parse(cachedManifestStr);
          if (cached && cached.providers) {
            this.currentVersion = cached.version || this.currentVersion;
            this.currentManifest = cached;
            this.applyConfigToEngines(cached);
            console.log(`[ProviderUpdateManager] Loaded cached providers (v${this.currentVersion})`);
          }
        } catch (e) {
          console.warn('[ProviderUpdateManager] Error parsing cached manifest:', e);
        }
      }
    } catch (e) {
      console.warn('[ProviderUpdateManager] Storage load error:', e);
    }

    // 2. Trigger non-blocking update check immediately in background (zero delay)
    if (autoCheck) {
      this.checkForUpdates({ force: false, checkIntervalMs }).catch((err) => {
        console.warn('[ProviderUpdateManager] Background check failed silently:', err?.message || err);
      });
    }
  }

  /**
   * Compare semantic versions: returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;
    const p1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const p2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  /**
   * Fetch manifest with parallel racing across fast CDNs and GitHub Raw
   */
  async fetchRemoteManifest() {
    const endpoints = PRIMARY_MANIFEST_URLS.map(u => `${u}?_t=${Date.now()}`);

    const fetchSingle = async (url) => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 6000) : null;
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          signal: controller ? controller.signal : undefined
        });
        if (timeout) clearTimeout(timeout);
        if (res && res.ok) {
          const manifest = await res.json();
          if (manifest && manifest.providers) {
            return manifest;
          }
        }
        throw new Error(`Endpoint ${url} returned invalid status`);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        throw err;
      }
    };

    // 1. Try fastest direct raw GitHub first (instant live commit)
    try {
      const rawManifest = await Promise.any([
        fetchSingle(endpoints[0]),
        fetchSingle(endpoints[1])
      ]);
      if (rawManifest && rawManifest.providers) {
        return rawManifest;
      }
    } catch (_) {}

    // 2. Fallback to all endpoints (CDN + proxies)
    try {
      return await Promise.any(endpoints.map(fetchSingle));
    } catch (_) {
      // Sequential fallback if parallel fetch encountered network anomalies
      for (const url of endpoints) {
        try {
          return await fetchSingle(url);
        } catch (_) {}
      }
    }

    throw new Error('Failed to fetch remote providers manifest from all endpoints.');
  }

  /**
   * Check for remote updates from GitHub repository
   * @param {Object} options
   * @param {boolean} options.force - Bypass interval throttling and force check
   * @param {number} options.checkIntervalMs - Minimum time between automatic checks
   */
  async checkForUpdates({ force = false, checkIntervalMs = 1000 * 60 * 5 } = {}) {
    const now = Date.now();
    if (this.isChecking) return { status: 'in-progress' };
    if (!force && (now - this.lastCheckTime < checkIntervalMs)) {
      return { status: 'throttled', currentVersion: this.currentVersion };
    }

    this.isChecking = true;
    this.lastCheckTime = now;
    this.emit('checking');

    try {
      console.log(`[ProviderUpdateManager] Checking for updates on GitHub (Current: v${this.currentVersion})...`);
      const remoteManifest = await this.fetchRemoteManifest();

      const isNewerVersion = this.compareVersions(remoteManifest.version, this.currentVersion) > 0;
      const hasNewTimestamp = remoteManifest.updatedAt && (!this.currentManifest || new Date(remoteManifest.updatedAt) > new Date(this.currentManifest.updatedAt || 0));
      const currentProvidersStr = JSON.stringify(this.currentManifest?.providers || {});
      const remoteProvidersStr = JSON.stringify(remoteManifest.providers || {});
      const hasProvidersChanged = currentProvidersStr !== remoteProvidersStr;

      if (isNewerVersion || hasNewTimestamp || hasProvidersChanged || force) {
        console.log(`[ProviderUpdateManager] 🚀 New provider configuration found (v${remoteManifest.version})! Applying updates...`);
        this.emit('update-available', {
          currentVersion: this.currentVersion,
          newVersion: remoteManifest.version,
          manifest: remoteManifest
        });

        await this.applyUpdate(remoteManifest);
        return {
          status: 'updated',
          previousVersion: this.currentVersion,
          newVersion: remoteManifest.version,
          manifest: remoteManifest
        };
      } else {
        console.log(`[ProviderUpdateManager] ✅ Providers are up to date (v${this.currentVersion}).`);
        this.emit('up-to-date', { version: this.currentVersion });
        return { status: 'up-to-date', version: this.currentVersion };
      }
    } catch (err) {
      console.warn('[ProviderUpdateManager] ⚠️ Update check failed, maintaining current providers:', err?.message || err);
      this.emit('error', { error: err?.message || err });
      return { status: 'error', error: err?.message || err, fallbackVersion: this.currentVersion };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Apply updated configuration into runtime scraper engines and persist to storage
   */
  async applyUpdate(manifest) {
    if (!manifest || !manifest.providers) return;

    this.currentVersion = manifest.version || this.currentVersion;
    this.currentManifest = manifest;

    // 1. Hot patch in-memory scraper instances
    this.applyConfigToEngines(manifest);

    // 2. Persist to local storage for instant offline boot
    try {
      await this.storage.setItem(STORAGE_KEY_MANIFEST, JSON.stringify(manifest));
      await this.storage.setItem(STORAGE_KEY_VERSION, this.currentVersion);
      await this.storage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());
    } catch (e) {
      console.warn('[ProviderUpdateManager] Storage persist error:', e);
    }

    this.emit('update-applied', {
      version: this.currentVersion,
      manifest
    });
    console.log(`[ProviderUpdateManager] ✅ Successfully hot-applied updated provider rules (v${this.currentVersion})!`);
  }

  /**
   * Hot-patch active engines in memory.
   * Resilient domain extraction: Whether user edits baseUrl, mirrors[0], or Referer in GitHub,
   * the live engine is automatically updated and synchronized!
   */
  applyConfigToEngines(manifest) {
    if (!manifest || !manifest.providers) return;

    // Helper to safely extract live domain from baseUrl, mirrors, or headers
    const extractDomain = (providerConfig) => {
      if (!providerConfig) return null;
      if (typeof providerConfig.baseUrl === 'string' && providerConfig.baseUrl.startsWith('http')) {
        return providerConfig.baseUrl.replace(/\/+$/, '');
      }
      if (Array.isArray(providerConfig.mirrors) && providerConfig.mirrors[0] && typeof providerConfig.mirrors[0] === 'string') {
        return providerConfig.mirrors[0].replace(/\/+$/, '');
      }
      if (providerConfig.headers?.Referer) {
        try {
          return new URL(providerConfig.headers.Referer).origin;
        } catch (_) {}
      }
      return null;
    };

    // Server 1: HDHub4u
    if (manifest.providers.hdhub4u && HDHub4u) {
      const live = extractDomain(manifest.providers.hdhub4u);
      if (live) {
        manifest.providers.hdhub4u.baseUrl = live;
        if (!Array.isArray(manifest.providers.hdhub4u.mirrors)) manifest.providers.hdhub4u.mirrors = [];
        if (!manifest.providers.hdhub4u.mirrors.includes(live)) {
          manifest.providers.hdhub4u.mirrors.unshift(live);
        }
        if (!manifest.providers.hdhub4u.headers) manifest.providers.hdhub4u.headers = {};
        manifest.providers.hdhub4u.headers.Referer = `${live}/`;
      }
      HDHub4u.applyRemoteConfig(manifest.providers.hdhub4u);
      console.log(`[ProviderUpdateManager] Live BaseUrl for HDHub4u set to: ${HDHub4u.baseUrl}`);
    }

    // Server 2: 4KHDHub
    if (manifest.providers['4khdhub'] && FourKHDHub) {
      const live = extractDomain(manifest.providers['4khdhub']);
      if (live) {
        manifest.providers['4khdhub'].baseUrl = live;
        if (!Array.isArray(manifest.providers['4khdhub'].mirrors)) manifest.providers['4khdhub'].mirrors = [];
        if (!manifest.providers['4khdhub'].mirrors.includes(live)) {
          manifest.providers['4khdhub'].mirrors.unshift(live);
        }
      }
      FourKHDHub.applyRemoteConfig(manifest.providers['4khdhub']);
      console.log(`[ProviderUpdateManager] Live BaseUrl for 4KHDHub set to: ${FourKHDHub.baseUrl}`);
    }

    // Server 3: Movies4u
    if (manifest.providers.movies4u && Movies4u) {
      const live = extractDomain(manifest.providers.movies4u);
      if (live) {
        manifest.providers.movies4u.baseUrl = live;
        if (!Array.isArray(manifest.providers.movies4u.mirrors)) manifest.providers.movies4u.mirrors = [];
        if (!manifest.providers.movies4u.mirrors.includes(live)) {
          manifest.providers.movies4u.mirrors.unshift(live);
        }
        if (!manifest.providers.movies4u.headers) manifest.providers.movies4u.headers = {};
        manifest.providers.movies4u.headers.Referer = `${live}/`;
      }
      Movies4u.applyRemoteConfig(manifest.providers.movies4u);
      console.log(`[ProviderUpdateManager] Live BaseUrl for Movies4u set to: ${Movies4u.liveBaseUrl}`);
    }

    // Server 4: AnimeSalt.cx (Anime Series & Movies)
    if (manifest.providers.animesalt && AnimeSalt) {
      const live = extractDomain(manifest.providers.animesalt);
      if (live) {
        manifest.providers.animesalt.baseUrl = live;
      }
      AnimeSalt.applyRemoteConfig(manifest.providers.animesalt);
      console.log(`[ProviderUpdateManager] Live BaseUrl for AnimeSalt set to: ${AnimeSalt.baseUrl}`);
    }

    // Universal Scraper
    if (UniversalScraper && typeof UniversalScraper.applyRemoteConfig === 'function') {
      UniversalScraper.applyRemoteConfig(manifest);
    }
  }

  /**
   * Get current OTA status summary
   */
  getStatus() {
    return {
      version: this.currentVersion,
      isChecking: this.isChecking,
      lastCheckTime: this.lastCheckTime,
      hasManifest: !!this.currentManifest,
      providers: this.currentManifest?.providers || {
        hdhub4u: { baseUrl: HDHub4u?.baseUrl },
        '4khdhub': { baseUrl: FourKHDHub?.baseUrl },
        movies4u: { baseUrl: Movies4u?.liveBaseUrl }
      }
    };
  }
}

export const ProviderUpdateManager = new ProviderUpdateManagerService();
export default ProviderUpdateManager;
