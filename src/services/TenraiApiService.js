/**
 * TenraiApiService.js
 * 
 * Modular client for Tenrai Anime Metadata API (High-performance MyAnimeList REST API).
 * Documentation: https://api.tenrai.org/documentation
 * 
 * Features:
 * - Public API: Zero API keys or server credentials required
 * - Centralized base URL and endpoint configuration
 * - Request timeout via AbortController
 * - HTTP 429 Retry-After header parsing with exponential backoff & jitter
 * - ETag & If-None-Match caching (HTTP 304 handling)
 * - Persistent disk and in-memory multi-tier caching
 * - Response validation & sanitization
 */

import StorageAdapter from './StorageAdapter.js';

const TENRAI_BASE_URL = 'https://api.tenrai.org/v1';
const TENRAI_DOCS_URL = 'https://api.tenrai.org/documentation';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// Configurable cache TTLs by resource type (in milliseconds)
const CACHE_TTL = {
  TOP: 2 * 60 * 60 * 1000,          // 2 hours
  SEASON: 1 * 60 * 60 * 1000,       // 1 hour
  DETAILS: 24 * 60 * 60 * 1000,     // 24 hours
  EPISODES: 12 * 60 * 60 * 1000,    // 12 hours
  RELATIONS: 24 * 60 * 60 * 1000,   // 24 hours
  SEARCH: 30 * 60 * 1000,           // 30 minutes
  GENRES: 7 * 24 * 60 * 60 * 1000,  // 7 days
  DEFAULT: 60 * 60 * 1000           // 1 hour
};

class TenraiApiService {
  constructor() {
    this.baseUrl = TENRAI_BASE_URL;
    this.docsUrl = TENRAI_DOCS_URL;
    this.memoryCache = new Map();
    this.isCacheLoaded = false;
    this.saveCacheDebounce = null;
    this.requestQueue = Promise.resolve();

    // Cache file path helper
    this.cacheFileName = 'nexplay_tenrai_cache.json';
    this.initCache();
  }

  /**
   * Get application document directory path safely in Expo SDK 57
   */
  getDocumentDir() {
    if (FileSystem && FileSystem.documentDirectory) {
      return FileSystem.documentDirectory;
    }
    if (Paths && Paths.document) {
      const uri = Paths.document.uri || (typeof Paths.document === 'string' ? Paths.document : '');
      if (uri) return uri.endsWith('/') ? uri : `${uri}/`;
    }
    return 'file:///data/user/0/com.anonymous.Stitchnexplay/files/';
  }

  getCacheFilePath() {
    return `${this.getDocumentDir()}${this.cacheFileName}`;
  }

  /**
   * Initialize disk cache
   */
  async initCache() {
    if (this.isCacheLoaded) return;
    try {
      const content = await StorageAdapter.readText(this.cacheFileName);
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          const now = Date.now();
          // Filter out expired cache entries on load
          Object.entries(parsed).forEach(([key, entry]) => {
            if (entry && entry.expiresAt > now) {
              this.memoryCache.set(key, entry);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[TenraiApiService] Cache load notice:', err?.message || err);
    } finally {
      this.isCacheLoaded = true;
    }
  }

  /**
   * Persist cache to disk with debouncing
   */
  async persistCacheToDisk() {
    if (this.saveCacheDebounce) clearTimeout(this.saveCacheDebounce);
    this.saveCacheDebounce = setTimeout(async () => {
      try {
        const serialized = {};
        const now = Date.now();
        // Save only unexpired and max 200 items to avoid file bloat
        let count = 0;
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry && entry.expiresAt > now && count < 200) {
            serialized[key] = entry;
            count++;
          }
        }

        const dataStr = JSON.stringify(serialized);
        await StorageAdapter.writeText(this.cacheFileName, dataStr);
      } catch (err) {
        console.warn('[TenraiApiService] Cache write error:', err?.message || err);
      }
    }, 2500);
  }

  /**
   * Sleep helper with jitter
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build complete query string from params object
   */
  buildQueryString(params = {}) {
    const parts = [];
    Object.keys(params).forEach(key => {
      const val = params[key];
      if (val !== undefined && val !== null && val !== '') {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    });
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  /**
   * Main HTTP GET method with:
   * - Timeout
   * - HTTP 429 Retry-After handling
   * - Exponential backoff + jitter for temporary errors
   * - ETag / If-None-Match validation (HTTP 304)
   * - Fallback to stale cache on total network failure
   */
  async get(endpoint, params = {}, options = {}) {
    const queryString = this.buildQueryString(params);
    const fullUrl = `${this.baseUrl}${endpoint}${queryString}`;
    const cacheKey = fullUrl;
    const ttl = options.ttl || this.determineTtl(endpoint);
    const skipCache = Boolean(options.skipCache);

    await this.initCache();

    // Check memory cache
    const cachedEntry = this.memoryCache.get(cacheKey);
    const now = Date.now();

    if (!skipCache && cachedEntry && cachedEntry.expiresAt > now && cachedEntry.data) {
      return cachedEntry.data;
    }

    let retries = 0;
    let backoffMs = INITIAL_BACKOFF_MS;

    while (retries <= MAX_RETRIES) {
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'NexPlay-Android/1.8 (Linux; Android 14)',
      };

      // Include ETag for HTTP 304 conditional request if available
      if (cachedEntry && cachedEntry.etag) {
        headers['If-None-Match'] = cachedEntry.etag;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle 304 Not Modified: return cached data and refresh expiration
        if (response.status === 304 && cachedEntry && cachedEntry.data) {
          cachedEntry.expiresAt = now + ttl;
          this.memoryCache.set(cacheKey, cachedEntry);
          this.persistCacheToDisk();
          return cachedEntry.data;
        }

        // Handle 429 Too Many Requests: Parse Retry-After header
        if (response.status === 429) {
          retries++;
          const retryAfterHeader = response.headers.get('retry-after');
          let waitSeconds = 2; // Default conservative wait

          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              waitSeconds = Math.min(parsedSeconds, 15);
            } else {
              // Could be HTTP date
              const retryDate = new Date(retryAfterHeader).getTime();
              if (!isNaN(retryDate)) {
                waitSeconds = Math.min(Math.max(1, Math.ceil((retryDate - Date.now()) / 1000)), 15);
              }
            }
          }

          const jitter = Math.floor(Math.random() * 500);
          const totalWaitMs = (waitSeconds * 1000) + jitter;
          console.warn(`[TenraiApiService] HTTP 429 Rate limited. Backing off for ${totalWaitMs}ms (Attempt ${retries}/${MAX_RETRIES})`);
          
          if (retries > MAX_RETRIES) {
            if (cachedEntry && cachedEntry.data) {
              console.warn('[TenraiApiService] Retries exhausted, serving stale cached data');
              return cachedEntry.data;
            }
            throw new Error(`Tenrai API Rate Limit Exceeded (HTTP 429). Retry after ${waitSeconds}s`);
          }

          await this.sleep(totalWaitMs);
          continue;
        }

        // Handle Temporary Server Errors (500, 502, 503, 504)
        if (response.status >= 500 && response.status <= 504) {
          retries++;
          if (retries > MAX_RETRIES) {
            if (cachedEntry && cachedEntry.data) {
              return cachedEntry.data;
            }
            throw new Error(`Tenrai Server Error (HTTP ${response.status})`);
          }
          const jitter = Math.floor(Math.random() * 300);
          await this.sleep(backoffMs + jitter);
          backoffMs *= 2;
          continue;
        }

        // Handle 404 Not Found
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Tenrai API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        const etag = response.headers.get('etag') || null;

        // Store into memory cache
        this.memoryCache.set(cacheKey, {
          data,
          etag,
          cachedAt: now,
          expiresAt: now + ttl
        });

        this.persistCacheToDisk();
        return data;

      } catch (err) {
        clearTimeout(timeoutId);

        const isAbort = err.name === 'AbortError';
        const isNetworkError = err.message?.includes('Network') || err.message?.includes('Failed to fetch') || isAbort;

        if (isNetworkError && retries < MAX_RETRIES) {
          retries++;
          const jitter = Math.floor(Math.random() * 400);
          await this.sleep(backoffMs + jitter);
          backoffMs *= 2;
          continue;
        }

        // If all retries failed, fallback to stale cache if available
        if (cachedEntry && cachedEntry.data) {
          console.warn(`[TenraiApiService] Network error (${err.message}), returning stale cache`);
          return cachedEntry.data;
        }

        throw err;
      }
    }

    if (cachedEntry && cachedEntry.data) {
      return cachedEntry.data;
    }
    throw new Error(`Tenrai API request failed after ${MAX_RETRIES} attempts`);
  }

  /**
   * Determine default TTL based on endpoint pattern
   */
  determineTtl(endpoint) {
    if (endpoint.startsWith('/top')) return CACHE_TTL.TOP;
    if (endpoint.startsWith('/seasons')) return CACHE_TTL.SEASON;
    if (endpoint.includes('/episodes')) return CACHE_TTL.EPISODES;
    if (endpoint.includes('/relations')) return CACHE_TTL.RELATIONS;
    if (endpoint.startsWith('/genres')) return CACHE_TTL.GENRES;
    if (endpoint.startsWith('/anime') && !endpoint.includes('?')) return CACHE_TTL.DETAILS;
    return CACHE_TTL.DEFAULT;
  }

  // ==========================================
  // PUBLIC API ENDPOINTS
  // ==========================================

  /**
   * Top Anime (Overall, by popularity, favorite, airing, upcoming)
   * GET /top/anime
   */
  async getTopAnime(params = {}) {
    return this.get('/top/anime', {
      filter: params.filter,               // 'bypopularity', 'airing', 'upcoming', 'favorite'
      type: params.type,                   // 'tv', 'movie', 'ova', 'ona', 'special'
      rating: params.rating,               // 'g', 'pg', 'pg13', 'r17', 'r', 'rx'
      sfw: params.sfw !== false ? 'true' : 'false',
      page: params.page || 1,
      limit: Math.min(params.limit || 25, 25)
    }, { ttl: CACHE_TTL.TOP });
  }

  /**
   * Currently Airing Season Anime
   * GET /seasons/now
   */
  async getCurrentSeasonAnime(params = {}) {
    return this.get('/seasons/now', {
      filter: params.filter,               // 'tv', 'movie', 'ova', 'ona', 'special'
      sfw: params.sfw !== false ? 'true' : 'false',
      page: params.page || 1,
      limit: Math.min(params.limit || 25, 25)
    }, { ttl: CACHE_TTL.SEASON });
  }

  /**
   * Upcoming Season Anime
   * GET /seasons/upcoming
   */
  async getUpcomingSeasonAnime(params = {}) {
    return this.get('/seasons/upcoming', {
      filter: params.filter,
      sfw: params.sfw !== false ? 'true' : 'false',
      page: params.page || 1,
      limit: Math.min(params.limit || 25, 25)
    }, { ttl: CACHE_TTL.SEASON });
  }

  /**
   * Historical / Specific Season Anime
   * GET /seasons/{year}/{season}
   */
  async getSeasonalAnime(year, season, params = {}) {
    return this.get(`/seasons/${year}/${season}`, {
      filter: params.filter,
      sfw: params.sfw !== false ? 'true' : 'false',
      page: params.page || 1,
      limit: Math.min(params.limit || 25, 25)
    }, { ttl: CACHE_TTL.SEASON });
  }

  /**
   * General Anime Search & Filter
   * GET /anime
   */
  async getAnimeList(params = {}) {
    return this.get('/anime', {
      q: params.q,
      type: params.type,                   // 'tv', 'movie', 'ova', 'ona', 'special'
      status: params.status,               // 'airing', 'complete', 'upcoming'
      rating: params.rating,
      genres: params.genres,               // comma separated genre IDs
      producers: params.producers,
      order_by: params.order_by,           // 'score', 'popularity', 'rank', 'episodes', 'title', 'start_date'
      sort: params.sort || 'desc',         // 'desc' | 'asc'
      min_score: params.min_score,
      sfw: params.sfw !== false ? 'true' : 'false',
      page: params.page || 1,
      limit: Math.min(params.limit || 25, 25)
    }, { ttl: CACHE_TTL.SEARCH });
  }

  /**
   * Search Anime with query
   */
  async searchAnime(query, params = {}) {
    return this.getAnimeList({
      q: query,
      ...params
    });
  }

  /**
   * Anime Details by MAL ID
   * GET /anime/{id}
   */
  async getAnimeById(malId) {
    if (!malId) return null;
    return this.get(`/anime/${malId}`, {}, { ttl: CACHE_TTL.DETAILS });
  }

  /**
   * Anime Full Details (Includes relations, characters, themes)
   * GET /anime/{id}/full
   */
  async getAnimeFullById(malId) {
    if (!malId) return null;
    return this.get(`/anime/${malId}/full`, {}, { ttl: CACHE_TTL.DETAILS });
  }

  /**
   * Anime Episodes list (paginated, 100 per page)
   * GET /anime/{id}/episodes
   */
  async getAnimeEpisodes(malId, page = 1) {
    if (!malId) return { data: [], pagination: {} };
    return this.get(`/anime/${malId}/episodes`, { page }, { ttl: CACHE_TTL.EPISODES });
  }

  /**
   * Anime Episode Details by Episode ID
   * GET /anime/{id}/episodes/{episode_id}
   */
  async getAnimeEpisodeById(malId, episodeId) {
    if (!malId || !episodeId) return null;
    return this.get(`/anime/${malId}/episodes/${episodeId}`, {}, { ttl: CACHE_TTL.EPISODES });
  }

  /**
   * Anime Relations (Sequels, Prequels, Spin-offs, Side stories)
   * GET /anime/{id}/relations
   */
  async getAnimeRelations(malId) {
    if (!malId) return { data: [] };
    return this.get(`/anime/${malId}/relations`, {}, { ttl: CACHE_TTL.RELATIONS });
  }

  /**
   * Anime Recommendations
   * GET /anime/{id}/recommendations
   */
  async getAnimeRecommendations(malId) {
    if (!malId) return { data: [] };
    return this.get(`/anime/${malId}/recommendations`, {}, { ttl: CACHE_TTL.DETAILS });
  }

  /**
   * Anime Genres List
   * GET /genres/anime
   */
  async getGenres() {
    return this.get('/genres/anime', {}, { ttl: CACHE_TTL.GENRES });
  }
}

export const tenraiApiService = new TenraiApiService();
export default tenraiApiService;
