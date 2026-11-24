/**
 * AniSkipService.js
 * 
 * Dedicated AniSkip API client for NexPlay (Anime Section Exclusive).
 * Provides automated & 1-tap Skip Intro (Opening), Skip Outro (Ending),
 * and Skip Recap functionality using the community-driven AniSkip API (v2).
 * 
 * Documentation: https://github.com/aniskip
 * Endpoint: https://api.aniskip.com/v2/skip-times/{malId}/{episodeNumber}
 */

const ANISKIP_API_BASE = 'https://api.aniskip.com/v2/skip-times';
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in-memory cache

class AniSkipService {
  constructor() {
    this.cache = new Map(); // key -> { data, timestamp }
    this.malIdCache = new Map(); // title -> malId
  }

  /**
   * Helper to normalize MAL ID from number, string, or internal np_anime_ ID
   * @param {number|string} idOrMalId
   * @returns {number|null}
   */
  extractMalId(idOrMalId) {
    if (!idOrMalId) return null;
    if (typeof idOrMalId === 'number' && !isNaN(idOrMalId) && idOrMalId > 0) {
      return idOrMalId;
    }
    const str = String(idOrMalId).trim();
    if (str.startsWith('np_anime_')) {
      const parsed = parseInt(str.replace('np_anime_', ''), 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : null;
    }
    const num = parseInt(str, 10);
    return !isNaN(num) && num > 0 ? num : null;
  }

  /**
   * Resolve MAL ID from anime object or title
   * @param {Object|string|number} animeOrId
   * @param {string} [fallbackTitle]
   * @returns {number|null}
   */
  resolveMalId(animeOrId, fallbackTitle = '') {
    if (!animeOrId) return null;

    if (typeof animeOrId === 'object') {
      const directMal = this.extractMalId(animeOrId.mal_id || animeOrId.malId);
      if (directMal) return directMal;

      const fromId = this.extractMalId(animeOrId.id || animeOrId.internal_id);
      if (fromId) return fromId;
    } else {
      const fromVal = this.extractMalId(animeOrId);
      if (fromVal) return fromVal;
    }

    return null;
  }

  /**
   * Human-friendly label for AniSkip types
   * @param {string} skipType 
   * @returns {{ label: string, category: 'intro'|'outro'|'recap'|'unknown' }}
   */
  getLabelAndCategory(skipType) {
    const type = String(skipType || '').toLowerCase();
    switch (type) {
      case 'op':
        return { label: 'Skip Opening', category: 'intro' };
      case 'mixed-op':
        return { label: 'Skip Intro', category: 'intro' };
      case 'ed':
        return { label: 'Skip Ending', category: 'outro' };
      case 'mixed-ed':
        return { label: 'Skip Outro', category: 'outro' };
      case 'recap':
        return { label: 'Skip Recap', category: 'recap' };
      default:
        return { label: 'Skip', category: 'unknown' };
    }
  }

  /**
   * Fetch skip timestamps for a given Anime MAL ID and Episode Number
   * 
   * @param {Object} params
   * @param {number|string} params.malId - MyAnimeList ID or np_anime_ ID
   * @param {number|string} [params.episodeNumber=1] - Episode number (1-indexed)
   * @param {number} [params.episodeLength=0] - Video duration in seconds (optional)
   * @param {string} [params.title] - Optional title for logging / fallback
   * @returns {Promise<{ found: boolean, results: Array, intro: Object|null, outro: Object|null, recap: Object|null }>}
   */
  async getSkipTimes({ malId, episodeNumber = 1, episodeLength = 0, title = '' }) {
    const resolvedMalId = this.resolveMalId(malId, title);
    const epNum = Math.max(1, parseInt(episodeNumber, 10) || 1);
    const safeDuration = (typeof episodeLength === 'number' && !isNaN(episodeLength) && episodeLength > 0)
      ? Math.round(episodeLength)
      : 0;

    if (!resolvedMalId) {
      console.warn('[AniSkip] Cannot query AniSkip: Invalid or missing MAL ID', { malId, episodeNumber });
      return { found: false, results: [], intro: null, outro: null, recap: null };
    }

    const cacheKey = `${resolvedMalId}_${epNum}_${safeDuration}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    try {
      const url = `${ANISKIP_API_BASE}/${resolvedMalId}/${epNum}?types=op&types=ed&types=mixed-op&types=mixed-ed&types=recap&episodeLength=${safeDuration}`;
      
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NexPlay/2.5 (Android; AnimeSkip)'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          // No skip timestamps found for this episode
          const emptyResult = { found: false, results: [], intro: null, outro: null, recap: null };
          this.cache.set(cacheKey, { data: emptyResult, timestamp: now });
          return emptyResult;
        }
        throw new Error(`AniSkip API responded with status ${response.status}`);
      }

      const json = await response.json();
      if (!json || !json.found || !Array.isArray(json.results) || json.results.length === 0) {
        const emptyResult = { found: false, results: [], intro: null, outro: null, recap: null };
        this.cache.set(cacheKey, { data: emptyResult, timestamp: now });
        return emptyResult;
      }

      // Format intervals into normalized structures
      const formattedResults = json.results.map((item, idx) => {
        const start = Number(item?.interval?.startTime) || 0;
        const end = Number(item?.interval?.endTime) || 0;
        const { label, category } = this.getLabelAndCategory(item?.skipType);
        return {
          id: item?.skipId || `aniskip_${idx}`,
          skipType: item?.skipType || 'unknown',
          category,
          label,
          startTime: start,
          endTime: end,
          duration: Math.max(0, end - start),
          episodeLength: Number(item?.episodeLength) || 0
        };
      });

      // Best candidates for Intro (op / mixed-op), Outro (ed / mixed-ed), Recap
      const intro = formattedResults.find(r => r.category === 'intro') || null;
      const outro = formattedResults.find(r => r.category === 'outro') || null;
      const recap = formattedResults.find(r => r.category === 'recap') || null;

      const result = {
        found: true,
        malId: resolvedMalId,
        episodeNumber: epNum,
        results: formattedResults,
        intro,
        outro,
        recap
      };

      console.log(`[AniSkip] Loaded skip intervals for MAL ID ${resolvedMalId} (Ep ${epNum}):`, {
        intro: intro ? `${intro.label} (${intro.startTime.toFixed(1)}s - ${intro.endTime.toFixed(1)}s)` : 'None',
        outro: outro ? `${outro.label} (${outro.startTime.toFixed(1)}s - ${outro.endTime.toFixed(1)}s)` : 'None',
        recap: recap ? `${recap.label} (${recap.startTime.toFixed(1)}s - ${recap.endTime.toFixed(1)}s)` : 'None'
      });

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[AniSkip] Request timed out for MAL ID ${resolvedMalId} (Ep ${epNum})`);
      } else {
        console.warn(`[AniSkip] Error fetching skip times:`, error.message || error);
      }
      return { found: false, results: [], intro: null, outro: null, recap: null };
    }
  }

  /**
   * Determine if any skip interval is currently active at currentTimeSec
   * 
   * @param {Object} skipData - The result from getSkipTimes()
   * @param {number} currentTimeSec - Current playback position in seconds
   * @returns {{ active: boolean, segment: Object, targetTime: number, label: string }|null}
   */
  getActiveSkip(skipData, currentTimeSec) {
    if (!skipData || !skipData.found || !Array.isArray(skipData.results) || skipData.results.length === 0) {
      return null;
    }

    const cur = typeof currentTimeSec === 'number' && !isNaN(currentTimeSec) ? currentTimeSec : 0;

    // Find the matching interval where currentTime is inside [startTime, endTime)
    // Priority: Intro -> Recap -> Outro
    const activeSegment = skipData.results.find(seg => cur >= seg.startTime && cur < seg.endTime);

    if (!activeSegment) {
      return null;
    }

    return {
      active: true,
      segment: activeSegment,
      targetTime: activeSegment.endTime + 0.5,
      label: activeSegment.label || 'Skip',
      category: activeSegment.category,
      skipType: activeSegment.skipType
    };
  }

  /**
   * Clear cache (useful on unmount or refresh)
   */
  clearCache() {
    this.cache.clear();
  }
}

export const aniSkipService = new AniSkipService();
export default aniSkipService;
