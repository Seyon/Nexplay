/**
 * 111477 Scraper Provider for Providers-Nexplay & Stitch-Nexplay (Server 4)
 * 
 * Target Website: https://a.111477.xyz/
 * Characteristics:
 * - High-speed open directory with over 1.3 PB / 570,000+ media files
 * - Zero redirect countdown timers
 * - Instant direct streaming links for movies and TV series
 * - MKV / MP4 direct playable streams for VLC player and ExoPlayer
 */

const DEFAULT_BASE_URL = 'https://a.111477.xyz';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Provider111477Client {
  constructor() {
    this.id = '111477';
    this.name = 'Server 4 (111477)';
    this.short = '111477';
    this.serverNumber = 4;
    this.baseUrl = DEFAULT_BASE_URL;
    this.mirrors = [DEFAULT_BASE_URL];
    this.headers = {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };

    // In-memory catalog cache with TTL to avoid redundant heavy downloads
    this.catalogCache = {
      movies: null,
      tvs: null,
      lastFetchedMovies: 0,
      lastFetchedTvs: 0,
      ttlMs: 30 * 60 * 1000 // 30 minutes
    };

    // Instant in-memory resolved stream cache (15-min TTL)
    this.streamCache = new Map();
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
  async fetchHtml(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: this.headers
        });

        if (res.status === 429 || res.status === 403) {
          console.warn(`[Provider111477] Cloudflare rate limited/challenged (${res.status}) on ${url}.`);
          return null;
        }

        if (res.status === 404) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        return await res.text();
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`[Provider111477] Error fetching ${url}:`, err?.message || err);
          return null;
        }
        await sleep(500 * attempt);
      }
    }
    return null;
  }

  /**
   * Probe whether a stream URL is reachable and returning video content,
   * detecting Cloudflare Turnstile bot challenges (403/Challenge) and rate limits.
   */
  async isStreamPlayable(url, referer) {
    if (!url) return false;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Referer': referer || this.baseUrl,
          'Range': 'bytes=0-1024'
        },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res.status === 403 || res.status === 429) return false;
      const cType = (res.headers.get('content-type') || '').toLowerCase();
      const cfMitigated = res.headers.get('cf-mitigated');
      if (cfMitigated === 'challenge' || cType.includes('text/html')) {
        return false;
      }
      return (res.status === 200 || res.status === 206);
    } catch (e) {
      return false;
    }
  }

  /**
   * Parses table rows from 111477 directory HTML
   */
  parseTableEntries(html, currentPath = '') {
    if (!html) return [];
    const entries = [];
    const rowRegex = /<tr[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rawUrl = match[1];
      const rowHtml = match[2];

      // Extract file size in bytes
      const sizeMatch = rowHtml.match(/data-sort="([^"]+)"/);
      const sizeBytes = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

      const isDir = rawUrl.endsWith('/');
      const cleanName = decodeURIComponent(rawUrl.replace(/^\/+/g, '').replace(/\/+$/g, '').split('/').pop() || '');

      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${this.baseUrl}${rawUrl}`;

      entries.push({
        url: fullUrl,
        relativePath: rawUrl,
        name: cleanName,
        isDirectory: isDir,
        sizeBytes,
        quality: this.detectQuality(cleanName),
        sizeFormatted: this.formatBytes(sizeBytes)
      });
    }

    return entries;
  }

  /**
   * Detects video quality label from filename
   */
  detectQuality(filename = '') {
    const fn = filename.toLowerCase();
    if (fn.includes('2160p') || fn.includes('4k') || fn.includes('uhd')) return '4k';
    if (fn.includes('1080p') || fn.includes('fhd')) return '1080p';
    if (fn.includes('720p') || fn.includes('hd')) return '720p';
    if (fn.includes('480p') || fn.includes('sd')) return '480p';
    return '1080p';
  }

  /**
   * Format bytes to readable string (e.g. "3.13 GB")
   */
  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleans title string for directory lookup
   */
  sanitizeTitle(title = '') {
    return title
      .replace(/[:\/\\?*"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Fast O(1) Concurrent Probe for Movie Directory
   */
  async probeMovieDirectory(title, year) {
    const clean = this.sanitizeTitle(title);
    const candidates = [];

    if (year) {
      candidates.push(`/movies/${encodeURIComponent(`${clean} (${year})`)}/`);
      candidates.push(`/movies/${encodeURIComponent(`${clean} ${year}`)}/`);
    }
    candidates.push(`/movies/${encodeURIComponent(clean)}/`);

    // Concurrent probing with Promise.any: whichever directory responds 200 first returns immediately
    const probePromises = candidates.map(async (path) => {
      const url = `${this.baseUrl}${path}`;
      const html = await this.fetchHtml(url);
      if (html) {
        return { folderUrl: url, html, path };
      }
      throw new Error(`Directory not found: ${path}`);
    });

    try {
      return await Promise.any(probePromises);
    } catch {
      return null;
    }
  }

  /**
   * Fast O(1) Concurrent Probe for TV Show Directory
   */
  async probeTvShowDirectory(title, year) {
    const clean = this.sanitizeTitle(title);
    const candidateBases = ['/tvs/', '/asiandrama/', '/kdrama/'];
    const candidateNames = [];

    if (year) {
      candidateNames.push(`${clean} (${year})`);
    }
    candidateNames.push(clean);

    const probePromises = [];
    for (const base of candidateBases) {
      for (const name of candidateNames) {
        const path = `${base}${encodeURIComponent(name)}/`;
        const url = `${this.baseUrl}${path}`;
        probePromises.push((async () => {
          const html = await this.fetchHtml(url);
          if (html) {
            return { folderUrl: url, html, path };
          }
          throw new Error(`Directory not found: ${path}`);
        })());
      }
    }

    try {
      return await Promise.any(probePromises);
    } catch {
      return null;
    }
  }

  /**
   * Search Provider for Movie or TV Series
   */
  async search(query) {
    if (!query) return [];
    console.log(`[Provider111477] Searching for: "${query}"`);

    // Extract year if specified (e.g. "Swapped 2026" or "Swapped (2026)")
    let targetYear = null;
    const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      targetYear = parseInt(yearMatch[1], 10);
    }
    const cleanQuery = query.replace(/\b(19\d{2}|20\d{2})\b/g, '').replace(/[()]/g, '').trim();

    const results = [];

    // 1. Direct fast probe on Movie folder
    const movieProbe = await this.probeMovieDirectory(cleanQuery, targetYear);
    if (movieProbe) {
      results.push({
        title: targetYear ? `${cleanQuery} (${targetYear})` : cleanQuery,
        cleanTitle: cleanQuery,
        url: movieProbe.folderUrl,
        thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
        quality: '1080p',
        year: targetYear,
        type: 'movie',
        mediaType: 'movie',
        provider: '111477'
      });
    }

    // 2. Direct fast probe on TV Show folder
    const tvProbe = await this.probeTvShowDirectory(cleanQuery, targetYear);
    if (tvProbe) {
      results.push({
        title: cleanQuery,
        cleanTitle: cleanQuery,
        url: tvProbe.folderUrl,
        thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500',
        quality: '1080p',
        year: targetYear,
        type: 'series',
        mediaType: 'tv',
        provider: '111477'
      });
    }

    // 3. Fallback: Search in-memory cached catalog if no direct match found
    if (results.length === 0) {
      const q = cleanQuery.toLowerCase();
      try {
        const movieResults = await this.searchCachedSection('movies', q);
        results.push(...movieResults);
        const tvResults = await this.searchCachedSection('tvs', q);
        results.push(...tvResults);
      } catch (err) {
        console.warn('[Provider111477] Fallback search error:', err?.message || err);
      }
    }

    return results;
  }

  /**
   * Search cached directory section (e.g. 'movies' or 'tvs')
   */
  async searchCachedSection(section, keyword) {
    const now = Date.now();
    const cacheKey = section === 'movies' ? 'movies' : 'tvs';
    const lastKey = section === 'movies' ? 'lastFetchedMovies' : 'lastFetchedTvs';

    if (!this.catalogCache[cacheKey] || (now - this.catalogCache[lastKey] > this.catalogCache.ttlMs)) {
      console.log(`[Provider111477] Populating index cache for /${section}/...`);
      const html = await this.fetchHtml(`${this.baseUrl}/${section}/`);
      if (html) {
        const entries = this.parseTableEntries(html).filter(e => e.isDirectory);
        this.catalogCache[cacheKey] = entries;
        this.catalogCache[lastKey] = now;
      }
    }

    const catalog = this.catalogCache[cacheKey] || [];
    const matches = catalog.filter(e => e.name.toLowerCase().includes(keyword)).slice(0, 8);

    return matches.map(e => {
      const yrMatch = e.name.match(/\((\d{4})\)/);
      const year = yrMatch ? parseInt(yrMatch[1], 10) : undefined;
      return {
        title: e.name,
        cleanTitle: e.name.replace(/\(\d{4}\)/g, '').trim(),
        url: e.url,
        thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
        quality: '1080p',
        year,
        type: section === 'movies' ? 'movie' : 'series',
        mediaType: section === 'movies' ? 'movie' : 'tv',
        provider: '111477'
      };
    });
  }

  /**
   * Extract Details & Streams from Movie or Series Directory
   */
  async extractDetails(folderUrl, targetSeason = 1, cachedHtml = null) {
    console.log(`[Provider111477] extractDetails for: ${folderUrl} (Season ${targetSeason})`);
    const html = cachedHtml || await this.fetchHtml(folderUrl);
    if (!html) return null;

    const entries = this.parseTableEntries(html);
    const isTV = folderUrl.includes('/tvs/') || folderUrl.includes('/asiandrama/') || folderUrl.includes('/kdrama/');

    if (isTV) {
      // Find seasons
      const seasonDirs = entries.filter(e => e.isDirectory);
      const targetSeasonStr = String(targetSeason).padStart(2, '0');
      const targetSeasonEntry = seasonDirs.find(s => {
        const norm = s.name.toLowerCase();
        return norm.includes(`season ${targetSeason}`) || norm.includes(`season ${targetSeasonStr}`) || norm.includes(`s${targetSeasonStr}`);
      }) || seasonDirs[0];

      let episodes = [];
      if (targetSeasonEntry) {
        const seasonHtml = await this.fetchHtml(targetSeasonEntry.url);
        if (seasonHtml) {
          const epEntries = this.parseTableEntries(seasonHtml);
          episodes = epEntries.filter(e => !e.isDirectory && (e.name.endsWith('.mkv') || e.name.endsWith('.mp4')));
        }
      }

      return {
        title: decodeURIComponent(folderUrl.replace(/\/+$/, '').split('/').pop() || ''),
        mediaType: 'tv',
        seasons: seasonDirs,
        currentSeason: targetSeason,
        episodes,
        thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500'
      };
    } else {
      // Movie folder: files are video streams
      const videoFiles = entries.filter(e => !e.isDirectory && (e.name.endsWith('.mkv') || e.name.endsWith('.mp4')));
      return {
        title: decodeURIComponent(folderUrl.replace(/\/+$/, '').split('/').pop() || ''),
        mediaType: 'movie',
        videoFiles,
        thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'
      };
    }
  }

  /**
   * Get Playable Stream directly for Movie or Episode
   * Direct output piped into VLC Player
   */
  async getPlayableStream(pageUrlOrOptions, isTVShow = false, episodeNumber = 1, seasonNumber = 1) {
    let folderUrl = '';
    let targetSeason = seasonNumber;
    let targetEpisode = episodeNumber;
    let isTV = isTVShow;
    let targetTitle = '';
    let targetYear = null;

    if (typeof pageUrlOrOptions === 'object' && pageUrlOrOptions !== null) {
      folderUrl = pageUrlOrOptions.pageUrl || pageUrlOrOptions.url || '';
      targetSeason = pageUrlOrOptions.seasonNumber || seasonNumber;
      targetEpisode = pageUrlOrOptions.episodeNumber || episodeNumber;
      isTV = pageUrlOrOptions.isTVShow ?? isTVShow;
      targetTitle = pageUrlOrOptions.targetTitle || pageUrlOrOptions.title || '';
      targetYear = pageUrlOrOptions.targetYear || pageUrlOrOptions.year;
    } else if (typeof pageUrlOrOptions === 'string') {
      folderUrl = pageUrlOrOptions;
    }

    // Check memory stream cache first (Instant 0ms resolution)
    const cacheKey = `${targetTitle || folderUrl}_${targetYear || ''}_${isTV ? 'tv' : 'movie'}_${targetSeason}_${targetEpisode}`;
    if (this.streamCache && this.streamCache.has(cacheKey)) {
      const cached = this.streamCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 15 * 60 * 1000) {
        console.log(`[Provider111477] ⚡ Instant stream cache HIT for: ${cacheKey}`);
        return cached.data;
      }
    }

    console.log(`[Provider111477] getPlayableStream:`, {
      folderUrl,
      isTV,
      targetSeason,
      targetEpisode,
      targetTitle,
      targetYear
    });

    let preloadedHtml = null;
    // 1. If folderUrl not provided, probe directly using title and year
    if (!folderUrl && targetTitle) {
      if (isTV) {
        const tvProbe = await this.probeTvShowDirectory(targetTitle, targetYear);
        if (tvProbe) {
          folderUrl = tvProbe.folderUrl;
          preloadedHtml = tvProbe.html;
        }
      } else {
        const movieProbe = await this.probeMovieDirectory(targetTitle, targetYear);
        if (movieProbe) {
          folderUrl = movieProbe.folderUrl;
          preloadedHtml = movieProbe.html;
        }
      }
    }

    if (!folderUrl) {
      throw new Error(`[Provider111477] Could not resolve folder directory for "${targetTitle || 'requested media'}"`);
    }

    // 2. Extract details reusing preloadedHtml if already fetched
    const details = await this.extractDetails(folderUrl, targetSeason, preloadedHtml);
    if (!details) {
      throw new Error(`[Provider111477] Failed to extract directory details from ${folderUrl}`);
    }

    let result = null;

    if (isTV) {
      // Find matching episode
      const episodes = details.episodes || [];
      if (episodes.length === 0) {
        throw new Error(`[Provider111477] No playable episodes found in Season ${targetSeason}`);
      }

      const epRegex1 = new RegExp(`[sS]0*${targetSeason}[eE]0*${targetEpisode}\\b`, 'i');
      const epRegex2 = new RegExp(`[eE]pisode\\s*0*${targetEpisode}\\b`, 'i');
      const epRegex3 = new RegExp(`\\b0*${targetEpisode}\\b`);

      const matchingEp = episodes.find(e => epRegex1.test(e.name)) ||
                         episodes.find(e => epRegex2.test(e.name)) ||
                         episodes.find(e => epRegex3.test(e.name)) ||
                         episodes[targetEpisode - 1] ||
                         episodes[0];

      const qualities = {};
      const qualitySizes = {};
      episodes.forEach(e => {
        if (epRegex1.test(e.name) || epRegex2.test(e.name)) {
          const q = e.quality || '1080p';
          if (!qualities[q]) {
            qualities[q] = e.url;
            qualitySizes[q] = e.sizeFormatted;
          }
        }
      });
      if (Object.keys(qualities).length === 0) {
        qualities[matchingEp.quality || '1080p'] = matchingEp.url;
        qualitySizes[matchingEp.quality || '1080p'] = matchingEp.sizeFormatted;
      }

      result = {
        title: `${details.title} - S${targetSeason}E${targetEpisode}`,
        mediaType: 'series',
        seasonNumber: targetSeason,
        episodeNumber: targetEpisode,
        streamUrl: matchingEp.url,
        qualities,
        qualitySizes,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Referer': folderUrl
        },
        mimeType: matchingEp.url.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4',
        quality: matchingEp.quality || '1080p',
        sizeFormatted: matchingEp.sizeFormatted,
        sizeBytes: matchingEp.sizeBytes,
        server: 'Server 4 (111477)',
        supports206: true,
        thumbnail: details.thumbnail,
        backupStreams: episodes.filter(e => e.url !== matchingEp.url)
      };
    } else {
      // Movie
      const videoFiles = details.videoFiles || [];
      if (videoFiles.length === 0) {
        throw new Error(`[Provider111477] No video streams found in movie folder`);
      }

      // Sort files: prefer 1080p WEB-DL / Webrip / BluRay with highest clarity or lowest compression
      const sorted = [...videoFiles].sort((a, b) => {
        // Prefer 1080p first if general, or higher quality
        const a1080 = a.name.includes('1080p');
        const b1080 = b.name.includes('1080p');
        if (a1080 && !b1080) return -1;
        if (!a1080 && b1080) return 1;
        return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      });

      const bestStream = sorted[0];
      const qualities = {};
      const qualitySizes = {};
      videoFiles.forEach(f => {
        const q = f.quality || '1080p';
        if (!qualities[q]) {
          qualities[q] = f.url;
          qualitySizes[q] = f.sizeFormatted;
        }
      });

      result = {
        title: details.title,
        mediaType: 'movie',
        streamUrl: bestStream.url,
        qualities,
        qualitySizes,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Referer': folderUrl
        },
        mimeType: bestStream.url.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4',
        quality: bestStream.quality || '1080p',
        sizeFormatted: bestStream.sizeFormatted,
        sizeBytes: bestStream.sizeBytes,
        server: 'Server 4 (111477)',
        supports206: true,
        thumbnail: details.thumbnail,
        backupStreams: videoFiles.filter(f => f.url !== bestStream.url)
      };
    }

    if (result && result.streamUrl) {
      const isPlayable = await this.isStreamPlayable(result.streamUrl, result.headers?.Referer);
      if (!isPlayable) {
        console.warn(`[Provider111477] 111477 stream URL is blocked (Cloudflare 403/Challenge): ${result.streamUrl}`);
        throw new Error(`[Provider111477] Stream blocked by Cloudflare (403 Challenge) on ${this.baseUrl}`);
      }
    }

    if (result && this.streamCache) {
      this.streamCache.set(cacheKey, { timestamp: Date.now(), data: result });
    }
    return result;
  }
}

export const Provider111477 = new Provider111477Client();
export default Provider111477;
