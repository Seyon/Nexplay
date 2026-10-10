/**
 * Netmirror Scraper Provider for Providers-Nexplay & Stitch-Nexplay (Server 5)
 * 
 * Target Website: https://net79.cc/
 * Characteristics:
 * - Direct TMDB-based streaming for Movies and TV Series
 * - Example Movie Search Query: https://net79.cc/#w=1339713-movie
 * - Example TV Series Query: https://net79.cc/#w=108978-tv-1-1
 * - Multi-quality MP4 Direct Streams (1080p, 720p, 480p, 360p) with zero countdown timers
 * - Subtitles / Captions support
 * - Secondary Mirror & Embed Fallbacks (Peachify / Netmirror Watch)
 */

const DEFAULT_BASE_URL = 'https://net79.cc';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ProviderNetmirrorClient {
  constructor() {
    this.id = 'netmirror';
    this.name = 'Server 5 (Netmirror)';
    this.short = 'Netmirror';
    this.serverNumber = 5;
    this.baseUrl = DEFAULT_BASE_URL;
    this.mirrors = [
      DEFAULT_BASE_URL,
      'https://net27.cc',
      'https://net77.in'
    ];
    this.headers = {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'application/json, text/html, */*'
    };

    // Instant in-memory resolved stream cache (15-min TTL)
    this.streamCache = new Map();
    // In-memory title/search cache (30-min TTL)
    this.catalogCache = new Map();
  }

  /**
   * Apply dynamic remote configuration received via OTA manifest
   */
  applyRemoteConfig(config = {}) {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (Array.isArray(config.mirrors) && config.mirrors.length > 0) this.mirrors = config.mirrors;
    if (config.headers) this.headers = { ...this.headers, ...config.headers };
  }

  /**
   * Safe fetch with rate-limit (HTTP 429) backoff & retries
   */
  async fetchJson(url, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            ...this.headers,
            'Referer': `${this.baseUrl}/`
          }
        });

        if (res.status === 429) {
          const retryAfterSec = parseInt(res.headers.get('retry-after') || '2', 10);
          console.warn(`[ProviderNetmirror] 429 Rate limited on ${url}, backing off for ${retryAfterSec}s...`);
          await sleep((retryAfterSec || 2) * 1000);
          continue;
        }

        if (res.status === 404) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        return await res.json();
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`[ProviderNetmirror] Error fetching ${url}:`, err?.message || err);
          return null;
        }
        await sleep(400 * attempt);
      }
    }
    return null;
  }

  /**
   * Parses Hash URL pattern:
   * e.g. https://net79.cc/#w=1339713-movie -> { tmdbId: 1339713, type: 'movie', season: 1, episode: 1 }
   * e.g. https://net79.cc/#w=108978-tv-1-1 -> { tmdbId: 108978, type: 'tv', season: 1, episode: 1 }
   */
  parseHashUrl(url = '') {
    if (!url) return null;
    const clean = String(url).trim();
    const match = clean.match(/#?w=(\d+)-(movie|tv)(?:-(\d+)(?:-(\d+))?)?/i) ||
                  clean.match(/watch-tmdb\/(\d+)(?:\?type=(movie|tv)(?:&se=(\d+))?(?:&ep=(\d+))?)?/i);
    if (!match) return null;
    return {
      tmdbId: parseInt(match[1], 10),
      type: (match[2] || 'movie').toLowerCase(),
      season: match[3] ? parseInt(match[3], 10) : 1,
      episode: match[4] ? parseInt(match[4], 10) : 1
    };
  }

  /**
   * Constructs Netmirror Hash URL:
   * Movie: https://net79.cc/#w=1339713-movie
   * TV Series: https://net79.cc/#w=108978-tv-1-1
   */
  buildHashUrl(tmdbId, type = 'movie', season = 1, episode = 1) {
    if (!tmdbId) return `${this.baseUrl}/`;
    const isTV = type === 'tv' || type === 'series';
    if (isTV) {
      return `${this.baseUrl}/#w=${tmdbId}-tv-${season || 1}-${episode || 1}`;
    }
    return `${this.baseUrl}/#w=${tmdbId}-movie`;
  }

  /**
   * Format bytes to readable string (e.g. "2.12 GB")
   */
  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleans title string for search lookup
   */
  sanitizeTitle(title = '') {
    return title
      .replace(/[:\/\\?*"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Search Provider for Movie or TV Series
   */
  async search(query) {
    if (!query) return [];
    console.log(`[ProviderNetmirror] Searching for: "${query}"`);

    // 1. Direct Hash URL check (e.g. https://net79.cc/#w=1339713-movie or #w=108978-tv-1-1)
    const hashInfo = this.parseHashUrl(query);
    if (hashInfo && hashInfo.tmdbId) {
      const details = await this.fetchTitleDetails(hashInfo.tmdbId, hashInfo.type);
      return [{
        title: details?.title || `TMDB ${hashInfo.tmdbId}`,
        cleanTitle: details?.title || `TMDB ${hashInfo.tmdbId}`,
        url: this.buildHashUrl(hashInfo.tmdbId, hashInfo.type, hashInfo.season, hashInfo.episode),
        thumbnail: details?.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
        quality: '1080p',
        year: details?.year,
        type: hashInfo.type === 'tv' ? 'series' : 'movie',
        mediaType: hashInfo.type === 'tv' ? 'tv' : 'movie',
        tmdbId: hashInfo.tmdbId,
        provider: 'netmirror'
      }];
    }

    // 2. Pure numeric TMDB ID search (e.g. "1339713" or "108978")
    if (/^\d{3,8}$/.test(query.trim())) {
      const numericId = parseInt(query.trim(), 10);
      const [mDetails, tvDetails] = await Promise.allSettled([
        this.fetchTitleDetails(numericId, 'movie'),
        this.fetchTitleDetails(numericId, 'tv')
      ]);

      const found = [];
      if (mDetails.status === 'fulfilled' && mDetails.value?.title) {
        found.push({
          title: mDetails.value.title,
          cleanTitle: mDetails.value.title,
          url: this.buildHashUrl(numericId, 'movie'),
          thumbnail: mDetails.value.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
          quality: '1080p',
          year: mDetails.value.year,
          type: 'movie',
          mediaType: 'movie',
          tmdbId: numericId,
          provider: 'netmirror'
        });
      }
      if (tvDetails.status === 'fulfilled' && tvDetails.value?.title) {
        found.push({
          title: tvDetails.value.title,
          cleanTitle: tvDetails.value.title,
          url: this.buildHashUrl(numericId, 'tv', 1, 1),
          thumbnail: tvDetails.value.poster || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500',
          quality: '1080p',
          year: tvDetails.value.year,
          type: 'series',
          mediaType: 'tv',
          tmdbId: numericId,
          provider: 'netmirror'
        });
      }
      if (found.length > 0) return found;
    }

    // 3. Hybrid Catalog Search by query title
    const cleanQuery = this.sanitizeTitle(query);
    const searchUrl = `${this.baseUrl}/api/catalog/search-hybrid?q=${encodeURIComponent(cleanQuery)}`;
    const data = await this.fetchJson(searchUrl);

    if (!data || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((item) => {
      const isTV = item.type === 'tv';
      return {
        title: item.title,
        cleanTitle: item.title,
        url: this.buildHashUrl(item.tmdbId, isTV ? 'tv' : 'movie', 1, 1),
        thumbnail: item.poster || (isTV 
          ? 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500' 
          : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'),
        quality: '1080p',
        year: item.year ? parseInt(item.year, 10) : undefined,
        type: isTV ? 'series' : 'movie',
        mediaType: isTV ? 'tv' : 'movie',
        tmdbId: item.tmdbId,
        provider: 'netmirror'
      };
    });
  }

  /**
   * Fetch Title details from Netmirror catalog
   */
  async fetchTitleDetails(tmdbId, type = 'movie') {
    if (!tmdbId) return null;
    const cacheKey = `title_${type}_${tmdbId}`;
    if (this.catalogCache.has(cacheKey)) {
      return this.catalogCache.get(cacheKey);
    }

    const isTV = type === 'tv' || type === 'series';
    const titleType = isTV ? 'tv' : 'movie';
    const url = `${this.baseUrl}/api/catalog/title/${titleType}/${tmdbId}`;
    const data = await this.fetchJson(url);

    if (data && data.title) {
      const result = {
        title: data.title,
        year: data.year ? parseInt(data.year, 10) : undefined,
        poster: data.poster || `https://image.tmdb.org/t/p/w500${data.poster_path || ''}`,
        overview: data.overview,
        type: titleType,
        tmdbId
      };
      this.catalogCache.set(cacheKey, result);
      return result;
    }
    return null;
  }

  /**
   * Fetch Season Episodes list for TV series
   */
  async fetchSeasonEpisodes(tmdbId, seasonNumber = 1) {
    if (!tmdbId) return [];
    const url = `${this.baseUrl}/api/catalog/season/${tmdbId}/${seasonNumber}`;
    const data = await this.fetchJson(url);

    if (data && Array.isArray(data.episodes)) {
      return data.episodes.map(ep => ({
        episodeNumber: ep.episode,
        seasonNumber,
        title: ep.name ? `S${seasonNumber}E${ep.episode} - ${ep.name}` : `S${seasonNumber}E${ep.episode}`,
        name: ep.name,
        overview: ep.overview,
        thumbnail: ep.still,
        airDate: ep.airDate,
        runtime: ep.runtime,
        url: this.buildHashUrl(tmdbId, 'tv', seasonNumber, ep.episode)
      }));
    }
    return [];
  }

  /**
   * Extract Details & Episodes list for Netmirror URL
   */
  async extractDetails(url, targetSeason = 1) {
    const hashInfo = this.parseHashUrl(url);
    if (!hashInfo || !hashInfo.tmdbId) {
      throw new Error(`[ProviderNetmirror] Cannot extract details from invalid URL: ${url}`);
    }

    const isTV = hashInfo.type === 'tv';
    const titleDetails = await this.fetchTitleDetails(hashInfo.tmdbId, hashInfo.type) || {
      title: `TMDB ${hashInfo.tmdbId}`,
      tmdbId: hashInfo.tmdbId
    };

    let episodes = [];
    if (isTV) {
      episodes = await this.fetchSeasonEpisodes(hashInfo.tmdbId, targetSeason || hashInfo.season || 1);
    }

    return {
      title: titleDetails.title,
      thumbnail: titleDetails.poster,
      year: titleDetails.year,
      type: isTV ? 'series' : 'movie',
      tmdbId: hashInfo.tmdbId,
      season: targetSeason,
      episodes
    };
  }

  /**
   * Direct 1-Click Playable Stream for VLC Player & Media3
   * Accepts both object config and positional parameters
   */
  async getPlayableStream(optionsOrUrl, isTVShowParam = false, episodeNumberParam = 1, seasonNumberParam = 1) {
    let targetTitle = '';
    let targetYear = undefined;
    let isTV = false;
    let targetSeason = 1;
    let targetEpisode = 1;
    let tmdbId = null;
    let folderUrl = '';

    if (typeof optionsOrUrl === 'object' && optionsOrUrl !== null) {
      targetTitle = optionsOrUrl.targetTitle || optionsOrUrl.title || '';
      targetYear = optionsOrUrl.targetYear || optionsOrUrl.year;
      isTV = Boolean(optionsOrUrl.isTVShow || optionsOrUrl.isTV);
      targetSeason = optionsOrUrl.seasonNumber ? parseInt(optionsOrUrl.seasonNumber, 10) : 1;
      targetEpisode = optionsOrUrl.episodeNumber ? parseInt(optionsOrUrl.episodeNumber, 10) : 1;
      tmdbId = optionsOrUrl.tmdbId || optionsOrUrl.id;
      folderUrl = optionsOrUrl.folderUrl || optionsOrUrl.url || optionsOrUrl.pageUrl || optionsOrUrl.link || '';
    } else {
      folderUrl = typeof optionsOrUrl === 'string' ? optionsOrUrl : '';
      isTV = Boolean(isTVShowParam);
      targetEpisode = episodeNumberParam ? parseInt(episodeNumberParam, 10) : 1;
      targetSeason = seasonNumberParam ? parseInt(seasonNumberParam, 10) : 1;
    }

    // 1. If folderUrl contains hash or watch path, extract tmdbId
    if (folderUrl) {
      const hashInfo = this.parseHashUrl(folderUrl);
      if (hashInfo && hashInfo.tmdbId) {
        tmdbId = hashInfo.tmdbId;
        isTV = hashInfo.type === 'tv';
        if (hashInfo.season) targetSeason = hashInfo.season;
        if (hashInfo.episode) targetEpisode = hashInfo.episode;
      }
    }

    // 2. Check instant in-memory cache
    const cacheKey = `stream_${tmdbId || targetTitle}_${isTV ? 'tv' : 'movie'}_${targetSeason}_${targetEpisode}`;
    if (this.streamCache.has(cacheKey)) {
      const cached = this.streamCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 15 * 60 * 1000) {
        console.log(`[ProviderNetmirror] ⚡ Instant stream cache HIT for: ${cacheKey}`);
        return cached.data;
      }
    }

    // 3. If tmdbId not available, search hybrid catalog by title
    if (!tmdbId && targetTitle) {
      console.log(`[ProviderNetmirror] Searching TMDB ID for: "${targetTitle}"`);
      const searchResults = await this.search(targetTitle);
      if (searchResults && searchResults.length > 0) {
        // Find best matching item
        const best = searchResults.find(r => r.type === (isTV ? 'series' : 'movie')) || searchResults[0];
        if (best && best.tmdbId) {
          tmdbId = best.tmdbId;
          if (!targetTitle) targetTitle = best.title;
        }
      }
    }

    if (!tmdbId) {
      throw new Error(`[ProviderNetmirror] Could not resolve TMDB ID for "${targetTitle || 'requested media'}"`);
    }

    const typeStr = isTV ? 'tv' : 'movie';
    const embedPath = isTV
      ? `/api/embed-tmdb/${tmdbId}?type=tv&se=${targetSeason}&ep=${targetEpisode}`
      : `/api/embed-tmdb/${tmdbId}?type=movie`;

    console.log(`[ProviderNetmirror] Resolving stream for TMDB ${tmdbId} (${typeStr}${isTV ? ` S${targetSeason}E${targetEpisode}` : ''})`);

    // 4. Concurrently or iteratively probe base URL and mirrors
    let embedData = null;
    const candidateBases = [this.baseUrl, ...this.mirrors.filter(m => m !== this.baseUrl)];

    for (const base of candidateBases) {
      const fullUrl = `${base}${embedPath}`;
      const data = await this.fetchJson(fullUrl);
      if (data && data.ok) {
        embedData = data;
        break;
      }
    }

    if (!embedData || (!embedData.mp4 && (!embedData.streams || embedData.streams.length === 0))) {
      throw new Error(`[ProviderNetmirror] No streaming sources available for TMDB ${tmdbId} on Netmirror`);
    }

    // 5. Organize multi-quality streams
    const streamsList = Array.isArray(embedData.streams) ? [...embedData.streams] : [];
    if (embedData.mp4 && !streamsList.some(s => s.url === embedData.mp4)) {
      streamsList.push({
        url: embedData.mp4,
        resolution: parseInt(embedData.resolution || '1080', 10) || 1080,
        size: 0
      });
    }

    // Sort streams: 1080p -> 720p -> 480p -> 360p
    streamsList.sort((a, b) => (Number(b.resolution) || 0) - (Number(a.resolution) || 0));

    const bestStream = streamsList[0] || { url: embedData.mp4, resolution: 1080, size: 0 };
    const qualities = {};
    const qualitySizes = {};

    streamsList.forEach((s) => {
      const q = `${s.resolution}p`;
      if (!qualities[q]) {
        qualities[q] = s.url;
        qualitySizes[q] = this.formatBytes(s.size);
      }
    });

    if (Object.keys(qualities).length === 0 && bestStream.url) {
      const q = `${bestStream.resolution || 1080}p`;
      qualities[q] = bestStream.url;
      qualitySizes[q] = this.formatBytes(bestStream.size);
    }

    // Format captions / subtitles
    const captions = Array.isArray(embedData.captions) ? embedData.captions.map((c, idx) => ({
      id: `sub-${idx}`,
      language: c.lang || 'en',
      displayLabel: c.name || c.lang || 'English',
      label: c.name || c.lang || 'English',
      url: c.url?.startsWith('http') ? c.url : `${this.baseUrl}${c.url}`
    })) : [];

    const displayTitle = embedData.title || targetTitle || `TMDB ${tmdbId}`;
    const result = {
      title: isTV ? `${displayTitle} - S${targetSeason}E${targetEpisode}` : displayTitle,
      mediaType: isTV ? 'series' : 'movie',
      seasonNumber: targetSeason,
      episodeNumber: targetEpisode,
      tmdbId,
      streamUrl: bestStream.url,
      qualities,
      qualitySizes,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': `${this.baseUrl}/`
      },
      mimeType: bestStream.url.includes('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp4',
      quality: `${bestStream.resolution || 1080}p`,
      sizeFormatted: this.formatBytes(bestStream.size),
      sizeBytes: bestStream.size || 0,
      server: 'Server 5 (Netmirror)',
      supports206: true,
      thumbnail: embedData.poster,
      captions,
      hashUrl: this.buildHashUrl(tmdbId, typeStr, targetSeason, targetEpisode),
      embedUrl: isTV
        ? `https://peachify.top/embed/tv/${tmdbId}/${targetSeason}/${targetEpisode}`
        : `https://peachify.top/embed/movie/${tmdbId}`,
      backupStreams: streamsList.filter(s => s.url !== bestStream.url)
    };

    if (this.streamCache) {
      this.streamCache.set(cacheKey, { timestamp: Date.now(), data: result });
    }

    return result;
  }
}

export const ProviderNetmirror = new ProviderNetmirrorClient();
export default ProviderNetmirror;
