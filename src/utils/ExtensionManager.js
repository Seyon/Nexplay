import { Movies4u } from './Movies4uProvider.js';
import { 
  HDHub4u, 
  FourKHDHub, 
  UniversalScraper, 
  calculateTitleMatchScore, 
  findBestMatch, 
  cleanTitleKeywords, 
  normalizeString 
} from './ScraperEngine.js';
import { Provider111477 } from '../providers/111477/index.js';
import { ProviderNetmirror } from '../providers/netmirror/index.js';
import { TamilDhool } from '../providers/tamildhool/index.js';
import { TamilGun } from '../providers/tamilgun/index.js';
import { ProviderUpdateManager } from './ProviderUpdateManager.js';


/**
 * ExtensionManager
 * High-Speed Native Scraper Engine for React Native & Android
 * - Uses Native OkHttp / Fetch Networking (Zero CORS / Zero Browser Sandbox Restrictions)
 * - Intelligent Media Type & Title Matching (Zero False-Positives)
 * - HDHub4u (Server 1): Dedicated to Indian Regional Movies & Multi-Audio Releases
 * - 4KHDHub (Server 2): Dedicated to Hollywood, 4K HDR, Series, KDramas
 * - Movies4u (Server 3): Dedicated to Bollywood, Hollywood & PixelDrain / FSL high-speed streams
 * - 111477 (Server 4): High-speed direct streaming open-directory with zero redirect timers
 * - Netmirror (Server 5): Direct TMDB-based streaming for movies & TV series (https://net79.cc/)
 * - Extracts direct streams for VLC Player and ExoPlayer
 * - Dynamic OTA Over-The-Air GitHub update syncing on app open
 */
class ExtensionManagerService {
  constructor() {
    this.webViewRef = null;
    this.isReady = true;
    this.updateManager = ProviderUpdateManager;
    this.streamCache = new Map();
    console.log("[ExtensionManager] Native High-Speed Scraper Engine initialized.");
  }

  setWebViewRef(ref) {
    this.webViewRef = ref;
  }

  setReady() {
    this.isReady = true;
  }

  handleMessage(event) {
    // Retained for backward-compatibility
  }

  /**
   * Search provider for movie or series title
   */
  async getSearchPosts(provider, searchQuery) {
    console.log(`[ExtensionManager] Native search: "${searchQuery}" on ${provider}`);
    try {
      let engine;
      if (provider === 'netmirror' || provider === '5') engine = ProviderNetmirror;
      else if (provider === '111477' || provider === '4') engine = Provider111477;
      else if (provider === 'tamildhool' || provider === '6') engine = TamilDhool;
      else if (provider === 'tamilgun' || provider === '7') engine = TamilGun;
      else if (provider === 'movies4u' || provider === '3') engine = Movies4u;
      else if (provider === '4khdhub' || provider === '2') engine = FourKHDHub;
      else engine = HDHub4u;
      const results = await engine.search(searchQuery);
      return results.map(r => ({
        title: r.title,
        cleanTitle: r.cleanTitle || cleanTitleKeywords(r.title),
        link: r.url,
        image: r.thumbnail,
        quality: r.quality,
        year: r.year,
        type: r.type || (r.url?.includes('-series-') ? 'series' : 'movie'),
        mediaType: r.mediaType || (r.url?.includes('-series-') ? 'tv' : 'movie'),
        provider: r.provider || provider
      }));
    } catch (err) {
      console.warn(`[ExtensionManager] Error searching ${provider}:`, err?.message || err);
      return [];
    }
  }

  /**
   * Search provider and gather all candidate matches across query strategies
   */
  async findCandidatesMedia({ provider = 'hdhub4u', targetTitle, targetYear, isTVShow, seasonNumber = 1, originalLanguage, isIndianRegion }) {
    const cleanTitle = (targetTitle || '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const targetType = isTVShow ? 'tv' : 'movie';
    const targetSeason = isTVShow ? seasonNumber : null;
    const activeProvider = provider || 'hdhub4u';

    console.log(`[ExtensionManager] Strict Single-Provider Search on ${activeProvider} for: "${cleanTitle}" (${targetYear || 'N/A'}, Type: ${targetType}${isTVShow ? `, Season: ${seasonNumber}` : ''})`);

    const digitTitle = cleanTitle
      .replace(/\bpart\s+(?:one|1)\b/gi, 'part 1')
      .replace(/\bpart\s+(?:two|2)\b/gi, 'part 2')
      .replace(/\bpart\s+(?:three|3)\b/gi, 'part 3')
      .replace(/\bpart\s+(?:four|4)\b/gi, 'part 4')
      .replace(/\bone\b/gi, '1')
      .replace(/\btwo\b/gi, '2')
      .replace(/\bthree\b/gi, '3')
      .replace(/\bfour\b/gi, '4')
      .replace(/\s+/g, ' ')
      .trim();

    const wordTitle = cleanTitle
      .replace(/\bpart\s+1\b/gi, 'part one')
      .replace(/\bpart\s+2\b/gi, 'part two')
      .replace(/\bpart\s+3\b/gi, 'part three')
      .replace(/\bpart\s+4\b/gi, 'part four')
      .replace(/\s+/g, ' ')
      .trim();

    const rootTitle = cleanTitle
      .replace(/\b(part|chapter|volume|vol)\s*\d+\b/gi, '')
      .replace(/\b(part|chapter|volume|vol)\s*(one|two|three|four|five)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const noEraTitle = cleanTitle
      .replace(/\b(?:ad|ce|bc|bce)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const mainTitle = cleanTitle
      .split(/[:\-–—]/)[0]
      .replace(/\s+/g, ' ')
      .trim();

    const titleWords = cleanTitle.split(/\s+/).filter(w => w.length > 0);
    const primaryWord = titleWords.length > 1 ? titleWords[0] : '';
    const twoWords = titleWords.length > 2 ? `${titleWords[0]} ${titleWords[1]}` : '';

    const candidateQueries = [];
    let primaryQueries = [];
    if (isTVShow) {
      primaryQueries = [
        `${cleanTitle} Season ${seasonNumber}`,
        cleanTitle
      ];
      candidateQueries.push(`${cleanTitle} (Season ${seasonNumber})`);
      candidateQueries.push(`${cleanTitle} (S0${seasonNumber})`);
      candidateQueries.push(`${cleanTitle} S0${seasonNumber}`);
      if (digitTitle !== cleanTitle) {
        candidateQueries.push(`${digitTitle} Season ${seasonNumber}`);
      }
      if (mainTitle !== cleanTitle && mainTitle.length >= 3) {
        candidateQueries.push(`${mainTitle} Season ${seasonNumber}`);
      }
    } else {
      primaryQueries = [
        targetYear ? `${cleanTitle} ${targetYear}` : cleanTitle,
        cleanTitle
      ];
      if (digitTitle !== cleanTitle) candidateQueries.push(digitTitle);
      if (wordTitle !== cleanTitle) candidateQueries.push(wordTitle);
      if (mainTitle !== cleanTitle && mainTitle.length >= 3) candidateQueries.push(mainTitle);
      if (rootTitle && rootTitle.length > 2 && rootTitle !== cleanTitle) {
        candidateQueries.push(rootTitle);
      }
    }

    const uniquePrimaryQueries = Array.from(new Set(primaryQueries.filter(Boolean)));
    const uniqueFallbackQueries = Array.from(new Set(candidateQueries.filter(q => q && !uniquePrimaryQueries.includes(q))));
    let allMatches = [];
    const seenUrls = new Set();

    const processResults = (results) => {
      if (!Array.isArray(results)) return;
      for (const c of results) {
        const postLink = c.link || c.url;
        if (postLink && !seenUrls.has(postLink)) {
          seenUrls.add(postLink);
          const score = calculateTitleMatchScore(
            cleanTitle,
            targetYear,
            targetType,
            c.title,
            c.year,
            c.type || c.mediaType || (postLink.includes('-series-') ? 'series' : 'movie'),
            targetSeason,
            postLink
          );
          if (score >= 0.55) {
            allMatches.push({
              match: { ...c, matchScore: score, link: postLink },
              matchScore: score,
              provider: activeProvider
            });
          }
        }
      }
    };

    // 1. Concurrent execution of top primary queries
    const primaryPromises = uniquePrimaryQueries.map(q => this.getSearchPosts(activeProvider, q));
    const primarySettled = await Promise.allSettled(primaryPromises);
    for (const res of primarySettled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        processResults(res.value);
      }
    }

    // Early termination: If we already found a confident match (score >= 0.85), skip all fallback queries!
    const hasConfidentMatch = allMatches.some(m => m.matchScore >= 0.85);
    if (!hasConfidentMatch && uniqueFallbackQueries.length > 0) {
      // Execute top 2 fallback queries in parallel
      const fallbackPromises = uniqueFallbackQueries.slice(0, 3).map(q => this.getSearchPosts(activeProvider, q));
      const fallbackSettled = await Promise.allSettled(fallbackPromises);
      for (const res of fallbackSettled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          processResults(res.value);
        }
      }
    }

    allMatches.sort((a, b) => b.matchScore - a.matchScore);

    // Strict Server 1 (HDHub4u) & Server 2 (4KHDHub) rule: If both WEB-DL and WEBRip are available, consider ONLY WEB-DL
    if (activeProvider === 'hdhub4u' || activeProvider === '4khdhub') {
      const isDl = (m) => /\bweb[-._]?dl\b/i.test(m.match?.title || '');
      const isRipOnly = (m) => /\b(?:web[-._]?rip|webrip)\b/i.test(m.match?.title || '') && !isDl(m);
      if (allMatches.some(isDl) && allMatches.some(isRipOnly)) {
        allMatches = allMatches.filter(m => !isRipOnly(m));
      }
    }

    return allMatches;
  }

  /**
   * Smart Media Matcher:
   * Finds the authentic matching movie or TV show across providers with confidence threshold.
   */
  async findBestMatchingMedia(params) {
    const candidates = await this.findCandidatesMedia(params);
    if (candidates.length > 0) {
      const best = candidates[0];
      console.log(`[ExtensionManager] ✅ Found verified match on ${best.provider} (Score: ${(best.matchScore * 100).toFixed(1)}%): "${best.match.title}"`);
      return best;
    }
    console.warn(`[ExtensionManager] ⚠️ No verified stream match found for "${params.targetTitle}" on ${params.provider || 'hdhub4u'}.`);
    return null;
  }

  /**
   * Extract Details & Single Episodes
   */
  async getMeta(provider, link, targetSeason = 1) {
    console.log(`[ExtensionManager] Native extract details: ${link} (Season ${targetSeason})`);
    let engine;
    if (link.includes('net79.cc') || link.includes('netmirror') || provider === 'netmirror' || provider === '5') engine = ProviderNetmirror;
    else if (link.includes('111477') || provider === '111477' || provider === '4') engine = Provider111477;
    else if (link.includes('tamildhool') || provider === 'tamildhool' || provider === '6') engine = TamilDhool;
    else if (link.includes('tamilgun') || link.includes('arivumani') || provider === 'tamilgun' || provider === '7') engine = TamilGun;
    else if (link.includes('movies4u') || provider === 'movies4u' || provider === '3') engine = Movies4u;
    else if (link.includes('hdhub4u') || provider === 'hdhub4u' || provider === '1') engine = HDHub4u;
    else engine = FourKHDHub;
    
    const details = await engine.extractDetails(link, targetSeason);
    return {
      title: details.title,
      image: details.thumbnail,
      quality: details.quality,
      linkList: (details.streamingLinks || []).map(s => ({
        title: s.quality + ' - ' + s.server,
        directLinks: [{ link: s.url, title: s.server, quality: s.quality, headers: s.headers, mimeType: s.mimeType }]
      })),
      episodes: details.episodes
    };
  }

  /**
   * Direct 1-Click Playable Stream for VLC Player & Media3
   */
  async getPlayableStream(provider, link, isTVShow = false, episodeNumber = 1, seasonNumber = 1) {
    let engine;
    if (link.includes('net79.cc') || link.includes('netmirror') || provider === 'netmirror' || provider === '5') engine = ProviderNetmirror;
    else if (link.includes('111477') || provider === '111477' || provider === '4') engine = Provider111477;
    else if (link.includes('tamildhool') || provider === 'tamildhool' || provider === '6') engine = TamilDhool;
    else if (link.includes('tamilgun') || link.includes('arivumani') || provider === 'tamilgun' || provider === '7') engine = TamilGun;
    else if (link.includes('movies4u') || provider === 'movies4u' || provider === '3') engine = Movies4u;
    else if (link.includes('4khdhub') || provider === '4khdhub' || provider === '2') engine = FourKHDHub;
    else engine = HDHub4u;
    return await engine.getPlayableStream(link, isTVShow, episodeNumber, seasonNumber);
  }

  /**
   * Resolve direct playable stream links
   */
  async getStream(provider, link, type = 'movie', episodeNumber = 1, seasonNumber = 1) {
    const isTV = type === 'series' || type === 'tv';
    console.log(`[ExtensionManager] Native resolve direct stream: ${link}${isTV ? ` (Season ${seasonNumber}, Ep ${episodeNumber})` : ' (Movie)'}`);
    const lower = link.toLowerCase();
    if (lower.includes('.zip') || lower.includes('.rar') || lower.includes('.7z') || lower.includes('.tar')) {
      console.warn(`[ExtensionManager] ⚠️ Ignoring archive/zip link: ${link}`);
      return [];
    }

    if (link.startsWith('http') && (
      link.includes('r2.cloudflarestorage.com') || 
      link.includes('r2.dev') ||
      link.includes('fastdl') ||
      link.includes('bunker.monster') ||
      link.includes('valentine.guru') ||
      link.includes('pongala.life') ||
      link.includes('lenin.buzz') ||
      link.includes('pixeldrain.com') ||
      link.includes('pixeldrain.dev')
    )) {
      let detectedQ = '1080p';
      if (lower.includes('2160') || lower.includes('4k') || lower.includes('uhd')) {
        detectedQ = '4K';
      } else if (lower.includes('720')) {
        detectedQ = '720p';
      }
      return [{ link: link, quality: detectedQ, server: 'FSL Direct Stream' }];
    }

    if (link.includes('movies4u.') || link.includes('movies4u.clinic') || provider === 'movies4u') {
      const playable = await Movies4u.getPlayableStream(link, isTV, episodeNumber, seasonNumber);
      if (playable && playable.streamUrl) {
        const streamList = [];
        if (playable.qualities && Object.keys(playable.qualities).length > 0) {
          const orderedKeys = ['4k', '2160p', '1080p', '720p', ...Object.keys(playable.qualities).filter(k => !['4k', '2160p', '1080p', '720p', '480p'].includes(k))];
          for (const q of orderedKeys) {
            if (playable.qualities[q] && q !== '480p') {
              streamList.push({
                link: playable.qualities[q],
                quality: (q.toUpperCase() === '4K' || q === '2160p') ? '4K' : (q === '1080p' ? '1080p' : (q === '720p' ? '720p' : q)),
                server: playable.server || 'Movies4u Direct',
                headers: playable.headers,
                mimeType: playable.mimeType
              });
            }
          }
        }
        if (streamList.length === 0) {
          streamList.push({
            link: playable.streamUrl,
            quality: playable.quality || '1080p',
            server: playable.server || 'Movies4u Direct',
            headers: playable.headers,
            mimeType: playable.mimeType
          });
        }
        return streamList;
      }
    }

    if (link.includes('hdhub4u.') || link.includes('4khdhub.')) {
      const playable = await this.getPlayableStream(provider, link, isTV, episodeNumber, seasonNumber);
      if (playable && playable.streamUrl) {
        const streamList = [];
        if (playable.qualities && Object.keys(playable.qualities).length > 0) {
          const orderedKeys = ['4k', '2160p', '1080p', '720p', ...Object.keys(playable.qualities).filter(k => !['4k', '2160p', '1080p', '720p', '480p'].includes(k))];
          for (const q of orderedKeys) {
            if (playable.qualities[q] && q !== '480p') {
              streamList.push({
                link: playable.qualities[q],
                quality: (q.toUpperCase() === '4K' || q === '2160p') ? '4K' : (q === '1080p' ? '1080p' : (q === '720p' ? '720p' : q)),
                server: playable.server || 'Direct Stream',
                headers: playable.headers,
                mimeType: playable.mimeType
              });
            }
          }
        }
        if (streamList.length === 0) {
          streamList.push({
            link: playable.streamUrl,
            quality: playable.quality || '4K',
            server: playable.server || 'Direct Stream',
            headers: playable.headers,
            mimeType: playable.mimeType
          });
        }
        return streamList;
      }
    }

    if (link.includes('tamildhool.') || provider === 'tamildhool' || provider === '4') {
      const playable = await TamilDhool.getPlayableStream(link, isTV, episodeNumber, seasonNumber);
      if (playable && playable.streamUrl) {
        return [{
          link: playable.streamUrl,
          quality: playable.quality || '720p',
          server: playable.server || 'TamilDhool Stream',
          headers: playable.headers,
          mimeType: playable.mimeType
        }];
      }
    }

    if (link.includes('tamilgun.') || link.includes('arivumani.') || provider === 'tamilgun' || provider === '5') {
      const playable = await TamilGun.getPlayableStream(link, isTV, episodeNumber, seasonNumber);
      if (playable && playable.streamUrl) {
        return [{
          link: playable.streamUrl,
          quality: playable.quality || '720p',
          server: playable.server || 'TamilGun Stream',
          headers: playable.headers,
          mimeType: playable.mimeType
        }];
      }
    }

    const resolved = await UniversalScraper.resolveLink(link);
    return (resolved || []).map(r => ({
      link: r.url,
      quality: r.quality,
      server: r.server,
      headers: r.headers,
      mimeType: r.mimeType
    }));
  }

  /**
   * Unified Dynamic Find & Resolve Method used by MovieDetailScreen
   * Automatically cascades through all available providers (Movies4u, 4KHDHub, HDHub4u)
   * so that "Playback Unavailable" is NEVER thrown if any provider has a working stream!
   */
  async findAndResolvePlayableStream(params = {}) {
    return this.findAndResolvePlayableStreamInternal(params);
  }

  async findAndResolvePlayableStreamInternal({
    targetTitle,
    targetYear,
    isTVShow = false,
    seasonNumber = 1,
    episodeNumber = 1,
    originalLanguage = 'en',
    isIndianRegion = false,
    provider = 'hdhub4u',
    allowCrossProviderFallback = false,
    tmdbId,
    movie,
    details
  } = {}) {
    const cleanTitle = (targetTitle || '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const targetEp = isTVShow ? parseInt(episodeNumber, 10) : 1;
    const targetSeason = isTVShow ? parseInt(seasonNumber, 10) : 1;
    const activeProvider = provider || 'hdhub4u';
    const effectiveTmdbId = tmdbId || movie?.id || details?.id;

    // Instant in-memory cache check (15-min TTL)
    const cacheKey = `${activeProvider}_${effectiveTmdbId || cleanTitle}_${targetYear || ''}_${isTVShow ? 'tv' : 'movie'}_${targetSeason}_${targetEp}`;
    if (this.streamCache && this.streamCache.has(cacheKey)) {
      const cached = this.streamCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 15 * 60 * 1000) {
        console.log(`[ExtensionManager] ⚡ Instant stream cache HIT for: ${cacheKey}`);
        return cached.data;
      }
    }

    console.log(`[ExtensionManager] Resolve on "${activeProvider}" for "${cleanTitle}" (Type: ${isTVShow ? `TV S${targetSeason}E${targetEp}` : 'Movie'})`);

    // Direct fast probe for Netmirror (Server 5)
    if (activeProvider === 'netmirror' || activeProvider === '5') {
      try {
        console.log(`[ExtensionManager] Direct Netmirror stream resolution for: "${cleanTitle}" (TMDB: ${effectiveTmdbId || 'N/A'}, Type: ${isTVShow ? `TV S${targetSeason}E${targetEp}` : 'Movie'})`);
        const stream = await ProviderNetmirror.getPlayableStream({
          targetTitle: cleanTitle,
          targetYear,
          isTVShow,
          seasonNumber: targetSeason,
          episodeNumber: targetEp,
          tmdbId: effectiveTmdbId
        });
        if (stream && stream.streamUrl) {
          const res = {
            ...stream,
            server: 'Server 5 (Netmirror)'
          };
          if (this.streamCache) {
            this.streamCache.set(cacheKey, { timestamp: Date.now(), data: res });
          }
          return res;
        }
      } catch (err) {
        console.warn(`[ExtensionManager] Direct Netmirror probe notice:`, err?.message || err);
      }

      // If direct Netmirror resolution failed or rate-limited (429), immediately engage high-speed fallback for Server 5
      if (allowCrossProviderFallback) {
        const otherProviders = ['movies4u', '4khdhub', 'hdhub4u'];
        for (const alt of otherProviders) {
          try {
            console.log(`[ExtensionManager] Engaging Server 5 high-speed fallback on provider: ${alt}`);
            const res = await this.findAndResolvePlayableStreamInternal({
              targetTitle: cleanTitle,
              targetYear,
              isTVShow,
              seasonNumber: targetSeason,
              episodeNumber: targetEp,
              originalLanguage,
              isIndianRegion,
              provider: alt,
              allowCrossProviderFallback: false,
              tmdbId: effectiveTmdbId,
              movie,
              details
            });
            if (res) {
              const serverRes = {
                ...res,
                server: 'Server 5 (Direct Stream)'
              };
              if (this.streamCache) {
                this.streamCache.set(cacheKey, { timestamp: Date.now(), data: serverRes });
              }
              return serverRes;
            }
          } catch (_) {}
        }
      }
    }

    // Direct fast probe for 111477 (zero countdown timer, direct open directory streaming)
    if (activeProvider === '111477' || activeProvider === '4') {
      try {
        console.log(`[ExtensionManager] Direct 111477 stream resolution for: "${cleanTitle}" (${targetYear || 'N/A'})`);
        const stream = await Provider111477.getPlayableStream({
          targetTitle: cleanTitle,
          targetYear,
          isTVShow,
          seasonNumber: targetSeason,
          episodeNumber: targetEp
        });
        if (stream && stream.streamUrl) {
          const res = {
            ...stream,
            server: 'Server 4 (111477)'
          };
          if (this.streamCache) {
            this.streamCache.set(cacheKey, { timestamp: Date.now(), data: res });
          }
          return res;
        }
      } catch (err) {
        console.warn(`[ExtensionManager] Direct 111477 probe notice:`, err?.message || err);
      }

      // If direct 111477 probe failed or is blocked by Cloudflare (403), immediately engage high-speed fallback for Server 4
      if (allowCrossProviderFallback) {
        const otherProviders = ['movies4u', 'netmirror', '4khdhub', 'hdhub4u'];
        for (const alt of otherProviders) {
          try {
            console.log(`[ExtensionManager] Engaging Server 4 high-speed fallback on provider: ${alt}`);
            const res = await this.findAndResolvePlayableStreamInternal({
              targetTitle: cleanTitle,
              targetYear,
              isTVShow,
              seasonNumber: targetSeason,
              episodeNumber: targetEp,
              originalLanguage,
              isIndianRegion,
              provider: alt,
              allowCrossProviderFallback: false,
              tmdbId: effectiveTmdbId,
              movie,
              details
            });
            if (res) {
              const serverRes = {
                ...res,
                server: 'Server 4 (Direct Stream)'
              };
              if (this.streamCache) {
                this.streamCache.set(cacheKey, { timestamp: Date.now(), data: serverRes });
              }
              return serverRes;
            }
          } catch (_) {}
        }
      }
    }

    const candidates = await this.findCandidatesMedia({
      provider: activeProvider,
      targetTitle: cleanTitle,
      targetYear,
      isTVShow,
      seasonNumber: targetSeason,
      originalLanguage,
      isIndianRegion
    });

    if (!candidates || candidates.length === 0) {
      if (allowCrossProviderFallback) {
        const otherProviders = ['movies4u', 'netmirror', '4khdhub', 'hdhub4u'].filter(p => p !== activeProvider);
        for (const alt of otherProviders) {
          try {
            console.log(`[ExtensionManager] Provider ${activeProvider} had no candidates, trying alternative provider: ${alt}`);
            const res = await this.findAndResolvePlayableStreamInternal({
              targetTitle: cleanTitle,
              targetYear,
              isTVShow,
              seasonNumber: targetSeason,
              episodeNumber: targetEp,
              originalLanguage,
              isIndianRegion,
              provider: alt,
              allowCrossProviderFallback: false,
              tmdbId: effectiveTmdbId,
              movie,
              details
            });
            if (res) {
              let finalServer = res.server;
              if (activeProvider === '111477' || activeProvider === '4') {
                finalServer = 'Server 4 (Direct Stream)';
              } else if (activeProvider === 'netmirror' || activeProvider === '5') {
                finalServer = 'Server 5 (Direct Stream)';
              } else if (activeProvider === 'hdhub4u' || activeProvider === '1') {
                finalServer = 'Server 1 (Direct Stream)';
              } else if (activeProvider === '4khdhub' || activeProvider === '2') {
                finalServer = 'Server 2 (Direct Stream)';
              } else if (activeProvider === 'movies4u' || activeProvider === '3') {
                finalServer = 'Server 3 (Direct Stream)';
              }
              return {
                ...res,
                server: finalServer
              };
            }
          } catch (_) {}
        }
      }
      throw new Error(`No matching media post found for "${cleanTitle}" on ${activeProvider}.`);
    }

    // Iterate through top candidate matching posts until a live playable stream is resolved
    for (const c of candidates.slice(0, 5)) {
      const match = c.match;
      const matchedProvider = c.provider || activeProvider;
      try {
        console.log(`[ExtensionManager] Trying post on ${matchedProvider} (Score: ${(c.matchScore * 100).toFixed(1)}%): "${match.title}" -> ${match.link}`);
        const playable = await this.getPlayableStream(
          matchedProvider,
          match.link,
          isTVShow,
          targetEp,
          targetSeason
        );

        if (playable && playable.streamUrl) {
          const isGoogleCdn = (playable.streamUrl || '').includes('googleusercontent.com') || (playable.streamUrl || '').includes('video-downloads') || (playable.streamUrl || '').includes('gpdl');
          if (isGoogleCdn) {
            console.log(`[ExtensionManager] Utilizing [Server:10Gbps] Google CDN fallback stream from ${matchedProvider}`);
          }
          const supports206 = playable.supports206 ?? !isGoogleCdn;
          const serverLabel = matchedProvider === 'netmirror' ? 'Server 5 (Netmirror)'
            : (matchedProvider === '111477' ? 'Server 4 (111477)'
            : (matchedProvider === 'tamildhool' ? 'Server 6 (TamilDhool)' 
            : (matchedProvider === 'tamilgun' ? 'Server 7 (TamilGun)' 
            : (matchedProvider === 'movies4u' ? 'Server 3 (Movies4u)' 
            : (matchedProvider === '4khdhub' ? 'Server 2 (4KHDHub)' : 'Server 1 (HDHub4u)')))));
          
          // Strictly default playback to 1080p if available among resolved stream qualities
          const qualities = { ...(playable.qualities || {}) };
          delete qualities['480p'];
          delete qualities['480'];
          delete qualities['sd'];

          // If range-supporting streams exist, prioritize non-Google CDN; otherwise keep Google CDN fallback
          const hasNonGoogleCdn = Object.values(qualities).some(v => v && !v.includes('googleusercontent.com') && !v.includes('video-downloads'));
          if (hasNonGoogleCdn) {
            for (const [k, v] of Object.entries(qualities)) {
              if (v && (v.includes('googleusercontent.com') || v.includes('video-downloads'))) {
                delete qualities[k];
              }
            }
          }

          const qualitySizes = { ...(playable.qualitySizes || {}) };
          delete qualitySizes['480p'];
          delete qualitySizes['480'];
          delete qualitySizes['sd'];
          const has1080 = Boolean(qualities['1080p']);
          const primaryStreamUrl = has1080 ? qualities['1080p'] : playable.streamUrl;
          const primaryQuality = has1080 ? '1080p' : (playable.quality || '1080p');

          if (!primaryStreamUrl) {
            continue;
          }

          const candidateResult = {
            title: match.title,
            streamUrl: primaryStreamUrl,
            qualities: qualities,
            qualitySizes: playable.qualitySizes || {},
            headers: playable.headers || {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            mimeType: playable.mimeType || 'video/x-matroska',
            quality: primaryQuality,
            server: playable.server || serverLabel,
            supports206: supports206,
            thumbnail: match.image || playable.thumbnail,
            subtitles: playable.subtitles || []
          };

          if (!supports206 && !isGoogleCdn) {
            continue;
          }

          console.log(`[ExtensionManager] ✅ Successfully resolved playable stream from ${matchedProvider} (${playable.quality || '1080p'}) [${candidateResult.server}]!`);
          if (this.streamCache) {
            this.streamCache.set(cacheKey, { timestamp: Date.now(), data: candidateResult });
          }
          return candidateResult;
        }
      } catch (err) {
        console.warn(`[ExtensionManager] Candidate post resolution error on ${matchedProvider}:`, err?.message || err);
      }
    }

    // Cross-provider fallback if stream not resolved on primary provider
    if (allowCrossProviderFallback) {
      const otherProviders = ['movies4u', 'netmirror', '4khdhub', 'hdhub4u'].filter(p => p !== activeProvider);
      for (const alt of otherProviders) {
        try {
          console.log(`[ExtensionManager] Checking alternative provider ${alt} for stream...`);
          const altResult = await this.findAndResolvePlayableStreamInternal({
            targetTitle: cleanTitle,
            targetYear,
            isTVShow,
            seasonNumber: targetSeason,
            episodeNumber: targetEp,
            originalLanguage,
            isIndianRegion,
            provider: alt,
            allowCrossProviderFallback: false
          });
          if (altResult && (altResult.supports206 !== false || (altResult.streamUrl && altResult.streamUrl.includes('googleusercontent.com')))) {
            console.log(`[ExtensionManager] ✅ Alternative provider ${alt} resolved stream: [${altResult.server}]!`);
            const finalServer = (activeProvider === '111477' || activeProvider === '4')
              ? 'Server 4 (Direct Stream)'
              : altResult.server;
            return {
              ...altResult,
              server: finalServer
            };
          }
        } catch (_) {}
      }
    }

    throw new Error(`Could not resolve direct stream for "${cleanTitle}" on ${activeProvider}.`);
  }

  /**
   * High-Level Convenience Method to resolve a stream given a media object and server identifier
   * @param {Object} media TMDB media item or simple object { title/name, release_date/first_air_date, media_type }
   * @param {number|string} server 1 (HDHub4u), 2 (4KHDHub), 3 (Movies4u) or provider string name
   * @param {number} seasonNumber Season number for TV shows (default: 1)
   * @param {number} episodeNumber Episode number for TV shows (default: 1)
   */
  async resolveMediaStream(media, server = 1, seasonNumber = 1, episodeNumber = 1) {
    if (!media) throw new Error("Media object is required.");
    const isTVShow = media.media_type === 'tv' || (!!media.first_air_date && !media.release_date);
    const targetTitle = media.title || media.name;
    const yearStr = media.release_date || media.first_air_date;
    const targetYear = yearStr ? (typeof yearStr === 'number' ? yearStr : parseInt(yearStr.toString().substring(0, 4), 10)) : undefined;

    let provider = 'hdhub4u';
    if (server === 2 || server === '2' || server === '4khdhub') {
      provider = '4khdhub';
    } else if (server === 3 || server === '3' || server === 'movies4u') {
      provider = 'movies4u';
    } else if (server === 4 || server === '4' || server === '111477') {
      provider = '111477';
    } else if (server === 5 || server === '5' || server === 'netmirror') {
      provider = 'netmirror';
    } else if (server === 6 || server === '6' || server === 'tamildhool') {
      provider = 'tamildhool';
    } else if (server === 7 || server === '7' || server === 'tamilgun') {
      provider = 'tamilgun';
    }

    return this.findAndResolvePlayableStream({
      targetTitle,
      targetYear,
      isTVShow,
      seasonNumber,
      episodeNumber,
      originalLanguage: media.original_language || 'en',
      provider,
      allowCrossProviderFallback: false,
      tmdbId: media.id,
      movie: media
    });
  }

  /**
   * High-accuracy Serial & Date Finder for Media3 Player
   * Finds daily serial episodes on TamilDhool or TamilGun / Arivumani
   * @param {string} serialName e.g. "Kayal", "Siragadikka Aasai", "Bigg Boss"
   * @param {string} [dateStr] e.g. "15-09-2026", "yesterday", "today"
   * @param {string} [channel] e.g. "Sun TV", "Vijay TV"
   * @param {string|number} [provider] 'tamildhool' (Server 4) or 'tamilgun' (Server 5)
   */
  async findEpisodeByDate(serialName, dateStr, channel, provider = 'tamildhool') {
    const active = (provider === 'tamilgun' || provider === 5 || provider === '5') ? TamilGun : TamilDhool;
    return await active.findEpisodeByDate(serialName, dateStr, channel);
  }

  /**
   * Initialize Dynamic OTA updates from GitHub on App Launch
   */
  async initRemoteUpdates(options) {
    return ProviderUpdateManager.init(options);
  }

  /**
   * Check for remote updates from GitHub repository
   */
  async checkForUpdates(force = false) {
    return ProviderUpdateManager.checkForUpdates({ force });
  }

  /**
   * Get current OTA update status
   */
  getUpdateStatus() {
    return ProviderUpdateManager.getStatus();
  }

  /**
   * Subscribe to OTA update events
   */
  onUpdate(listener) {
    return ProviderUpdateManager.addListener(listener);
  }
}

export const ExtensionManager = new ExtensionManagerService();

export {
  HDHub4u,
  FourKHDHub,
  UniversalScraper,
  TamilDhool,
  TamilGun,
  calculateTitleMatchScore,
  findBestMatch,
  cleanTitleKeywords,
  normalizeString,
  ProviderUpdateManager
};

export const getSandboxHtml = () => '<!DOCTYPE html><html><body><h3>Scraper Engine Ready</h3></body></html>';
export default ExtensionManager;
