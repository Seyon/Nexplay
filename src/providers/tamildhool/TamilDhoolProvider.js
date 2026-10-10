/**
 * TamilDhool Provider for Providers-Nexplay & Stitch-Nexplay (Server 4)
 * 
 * Features:
 * - Direct integration with ExtensionManager & ScraperEngine
 * - Native Bunny Stream CDN (.m3u8) extraction with zero ads or popups
 * - Automatic HTTP headers generation (Referer & Origin) for ExoPlayer / Media3
 * - Serial Episode & Movie title matching
 * - Built-in DNS-over-HTTPS fallback for ISP carrier bypass
 */

import { 
  DEFAULT_BUNNY_CDN_HOST, 
  REQUIRED_STREAM_HEADERS, 
  extractStreamsFromHtml, 
  parseMediaRequest, 
  buildProviderUrl 
} from './extractor.js';
import { parseDateInput, resilientHttpGet } from '../common/index.js';
import { resolveUrlWithDoh } from '../../utils/DnsResolver.js';

export const TAMILDHOOL_ALIASES = {
  'singapenne': 'Singappenne',
  'singa penne': 'Singappenne',
  'singapennae': 'Singappenne',
  'pandian stores': 'Pandian Stores 2',
  'anna': 'Annamalai Kudumbam',
  'thendral': 'Thendrale Mella Pesu',
  'suttum vizhi': 'Suttum Vizhi Sudare',
  'kanmani': 'Kanmani Anbudan',
  'ayyanar': 'Ayyanar Thunai',
  'vaagai sooda': 'Vaagai Sooda Vaa',
  'parijatham': 'Paarijatham',
  'paarijatham': 'Paarijatham',
  'chinnamarumagal': 'Chinna Marumagal',
  'chinna marumagal': 'Chinna Marumagal',
  'baakiya lakshmi': 'Baakiyalakshmi',
  'sundari': 'Sundari',
  'bigg boss 10': 'Bigg Boss Tamil Season 10',
  'bigg boss': 'Bigg Boss Tamil Season 10',
  'bigg boss tamil': 'Bigg Boss Tamil Season 10'
};

export class TamilDhoolClient {
  constructor() {
    this.baseUrl = "https://www.tamildhool.tech";
    this.providerName = "tamildhool";
    this.mirrors = [
      "https://www.tamildhool.tech",
      "https://tamildhool.tech"
    ];
  }

  /**
   * Internal HTTP GET helper with standard headers and DoH ISP bypass
   * @param {string} url
   * @param {string} [referer]
   * @param {number} [timeoutMs]
   * @returns {Promise<string>}
   */
  async defaultHttpGet(url, referer = "", timeoutMs = 8000) {
    return resilientHttpGet(url, referer, timeoutMs);
  }

  /**
   * Search for Tamil serials or movies on TamilDhool
   * Fully compatible with ExtensionManager.getSearchPosts()
   */
  async search(query, customHttpGet) {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    const cleanQuery = (query || '').replace(/[:\-?"']/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanQuery) return [];

    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(cleanQuery)}`;
    let html = '';
    try {
      html = await fetchFn(searchUrl, this.baseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilDhool] Search error for "${cleanQuery}":`, err?.message || err);
      return [];
    }

    if (!html || html.includes("<title>Just a moment...</title>")) {
      return [];
    }

    const results = [];
    const postRegex = /<article[^>]*id="post-(\d+)"[^>]*>([\s\S]*?)<\/article>/gi;
    let m;

    while ((m = postRegex.exec(html)) !== null) {
      const postBody = m[2];
      const linkMatch = postBody.match(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/[^"']+)["'][^>]*>/i);
      const titleMatch = postBody.match(/<h[1-6][^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
                         postBody.match(/title=["']([^"']+)["']/i);
      const imgMatch = postBody.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|png|webp))["']/i);
      const catMatch = postBody.match(/rel=["']category tag["'][^>]*>([\s\S]*?)<\/a>/i);

      if (linkMatch && titleMatch) {
        const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const link = linkMatch[1];
        const image = imgMatch ? imgMatch[1] : '';
        const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
        const isMovie = link.includes('/movie/') || (catMatch?.[1] && catMatch[1].toLowerCase().includes('movie'));

        results.push({
          title: rawTitle,
          cleanTitle: rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(),
          link,
          image,
          quality: '720p',
          year,
          type: isMovie ? 'movie' : 'series',
          mediaType: isMovie ? 'movie' : 'tv',
          provider: 'tamildhool'
        });
      }
    }

    return results;
  }

  /**
   * Extract Episode / Media Details
   * Fully compatible with ExtensionManager.getMeta()
   */
  async extractDetails(pageUrl, targetSeason = 1, customHttpGet) {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    let html = '';
    try {
      html = await fetchFn(pageUrl, this.baseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilDhool] Error fetching details for ${pageUrl}:`, err?.message || err);
    }

    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim().replace(/&#038;/g, '&') : "TamilDhool Episode";

    const extracted = extractStreamsFromHtml(html, pageUrl);
    const streamingLinks = [];

    if (extracted.best) {
      streamingLinks.push({
        quality: extracted.best.quality,
        server: extracted.best.server || "Bunny Stream (Master)",
        url: extracted.best.url,
        headers: extracted.best.headers || REQUIRED_STREAM_HEADERS,
        mimeType: "application/x-mpegURL"
      });
    }

    for (const s of extracted.streams) {
      if (s.url !== extracted.best?.url) {
        streamingLinks.push({
          quality: s.quality,
          server: s.server || "Bunny Stream",
          url: s.url,
          headers: s.headers || REQUIRED_STREAM_HEADERS,
          mimeType: "application/x-mpegURL"
        });
      }
    }

    // Parse adjacent episode links for episode navigation
    const episodes = [];
    const epLinks = [...html.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    let epCount = 1;
    for (const [ , epUrl, epText ] of epLinks) {
      if (epUrl.includes('-serial/') && !epUrl.endsWith('/kayal/') && !epUrl.endsWith('/sun-tv/')) {
        const cleanEpText = epText.replace(/<[^>]+>/g, '').trim();
        if (cleanEpText && cleanEpText.length > 5) {
          episodes.push({
            seasonNumber: targetSeason || 1,
            episodeNumber: epCount++,
            title: cleanEpText,
            bridges: [{ url: epUrl, label: cleanEpText }],
            links: streamingLinks
          });
        }
      }
    }

    return {
      title,
      url: pageUrl,
      quality: extracted.best?.quality || "720p",
      thumbnail: extracted.thumbnail,
      streamingLinks,
      downloadLinks: [],
      episodes
    };
  }

  /**
   * Direct 1-Click Playable Stream for Media3 ExoPlayer / Expo Video
   * Fully compatible with ExtensionManager.getPlayableStream()
   */
  async getPlayableStream(
    pageUrl, 
    isTVShow = false, 
    episodeNumber = 1, 
    seasonNumber = 1, 
    customHttpGet
  ) {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    let html = '';
    try {
      html = await fetchFn(pageUrl, this.baseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilDhool] Error extracting stream for ${pageUrl}:`, err?.message || err);
      return null;
    }

    const extracted = extractStreamsFromHtml(html, pageUrl);
    if (!extracted || !extracted.streams || extracted.streams.length === 0) {
      return null;
    }

    const bestStream = extracted.best || extracted.streams[0];
    const qualities = {};
    for (const s of extracted.streams) {
      if (!qualities[s.quality]) {
        qualities[s.quality] = s.url;
      }
    }

    return {
      streamUrl: bestStream.url,
      quality: bestStream.quality,
      server: bestStream.server || "TamilDhool Stream",
      headers: {
        ...(bestStream.headers || REQUIRED_STREAM_HEADERS),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      mimeType: bestStream.type || "application/x-mpegURL",
      qualities,
      thumbnail: extracted.thumbnail
    };
  }

  /**
   * Universal resolver for direct links
   */
  async resolveLink(rawUrl) {
    if (rawUrl.includes('b-cdn.net') || rawUrl.includes('playlist.m3u8')) {
      return [{
        quality: '720p',
        server: 'Bunny Stream',
        url: rawUrl,
        headers: REQUIRED_STREAM_HEADERS,
        mimeType: 'application/x-mpegURL'
      }];
    }
    return [];
  }

  /**
   * High-accuracy Serial & Date Finder for Media3 Player on TamilDhool
   * @param {string} serialName Serial or show name (e.g. "Kayal", "Siragadikka Aasai", "Bigg Boss")
   * @param {string} [dateStr] Date (e.g. "15-09-2026", "yesterday", "today", "15th Sep")
   * @param {string} [channel] Channel (e.g. "Sun TV", "Vijay TV", "Zee Tamil")
   * @param {Function} [customHttpGet]
   */
  async findEpisodeByDate(serialName, dateStr, channel, customHttpGet) {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    const cleanLower = (serialName || '').toLowerCase().trim();
    let canonicalTitle = serialName;
    for (const [alias, real] of Object.entries(TAMILDHOOL_ALIASES)) {
      if (cleanLower === alias || cleanLower.startsWith(alias) || cleanLower.replace(/[^a-z0-9]/g, '') === alias.replace(/[^a-z0-9]/g, '')) {
        canonicalTitle = real;
        break;
      }
    }

    const parsedDate = parseDateInput(dateStr);
    const channelSlug = (channel || 'sun-tv').toLowerCase().includes('vijay') ? 'vijay-tv'
      : (channel || '').toLowerCase().includes('zee') ? 'zee-tamil'
      : 'sun-tv';
    const slug = canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 1. Direct Category URL Lookup (Instant & 100% accurate date matching)
    const categoryUrl = `${this.baseUrl}/${channelSlug}/${channelSlug}-serial/${slug}/`;
    try {
      const catHtml = await fetchFn(categoryUrl, this.baseUrl, 7000);
      if (catHtml && !catHtml.includes("<title>Just a moment...</title>")) {
        const postRegex = /<article[^>]*id="post-(\d+)"[^>]*>([\s\S]*?)<\/article>/gi;
        let pm;
        while ((pm = postRegex.exec(catHtml)) !== null) {
          const pBody = pm[2];
          const lMatch = pBody.match(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/[^"']+)["'][^>]*>/i);
          const tMatch = pBody.match(/<h[1-6][^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
          if (lMatch && tMatch) {
            const rTitle = tMatch[1].replace(/<[^>]+>/g, '').trim();
            const rLink = lMatch[1];
            if (parsedDate && (rTitle.includes(parsedDate.formatted) || rLink.includes(parsedDate.formatted))) {
              const stream = await this.getPlayableStream(rLink, true, 1, 1, fetchFn);
              if (stream) {
                return {
                  ...stream,
                  matchedTitle: rTitle,
                  matchedPageUrl: rLink,
                  requestedSerial: serialName,
                  canonicalTitle,
                  requestedDate: dateStr,
                  requestedChannel: channel,
                  score: 100
                };
              }
            }
          }
        }
      }
    } catch (e) {
      // Category fallback silent, proceed to search
    }

    // 2. Search Fallback with Server 1 formatted queries
    const queries = [];
    if (parsedDate) {
      queries.push(`${canonicalTitle} | ${parsedDate.formatted} |`);
      queries.push(`${canonicalTitle} ${parsedDate.formatted}`);
      queries.push(`${canonicalTitle} ${parsedDate.formattedShort}`);
      queries.push(`${canonicalTitle} ${parsedDate.day}`);
    }
    queries.push(canonicalTitle);

    const candidatePosts = [];
    const seenUrls = new Set();

    for (const q of queries) {
      const results = await this.search(q, fetchFn);
      for (const r of results) {
        if (!seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          candidatePosts.push(r);
        }
      }
      if (candidatePosts.length >= 10) break;
    }

    if (candidatePosts.length === 0) return null;

    const nameTokens = canonicalTitle.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = null;
    let highestScore = -1;

    for (const post of candidatePosts) {
      const titleLower = post.title.toLowerCase();
      const linkLower = post.link.toLowerCase();
      let score = 0;

      const matchedTokens = nameTokens.filter(t => titleLower.includes(t) || linkLower.includes(t));
      if (matchedTokens.length === nameTokens.length) {
        score += 50;
      } else {
        score += (matchedTokens.length / nameTokens.length) * 30;
      }

      if (parsedDate) {
        const d1 = parsedDate.formatted.toLowerCase();
        const d2 = parsedDate.formattedShort.toLowerCase();
        const d3 = parsedDate.formattedText.toLowerCase();
        const d4 = `${parsedDate.day}-${parsedDate.month}`;
        const d5 = `${parsedDate.day}`;
        const dayNum = parseInt(parsedDate.day, 10);
        const dayPattern = new RegExp(`day\\s*0?${dayNum}\\b`, 'i');

        if (titleLower.includes(d1) || linkLower.includes(d1)) {
          score += 60;
        } else if (titleLower.includes(d2) || linkLower.includes(d2)) {
          score += 60;
        } else if (titleLower.includes(d3) || linkLower.includes(d3) || linkLower.includes(`${parsedDate.day}th-sep`)) {
          score += 55;
        } else if (dayPattern.test(titleLower) || dayPattern.test(linkLower)) {
          score += 50;
        } else if (titleLower.includes(d4) || linkLower.includes(d4)) {
          score += 40;
        } else if (titleLower.includes(d5) || linkLower.includes(d5)) {
          score += 15;
        }
      } else {
        score += 20;
      }

      if (channel && (titleLower.includes(channel.toLowerCase()) || linkLower.includes(channel.toLowerCase()))) {
        score += 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = post;
      }
    }

    if (!bestMatch) return null;

    const stream = await this.getPlayableStream(bestMatch.link, true, 1, 1, fetchFn);
    if (!stream) return null;

    return {
      ...stream,
      matchedTitle: bestMatch.title,
      matchedPageUrl: bestMatch.link,
      requestedSerial: serialName,
      canonicalTitle,
      requestedDate: dateStr,
      requestedChannel: channel,
      score: highestScore
    };
  }

}

export const TamilDhool = new TamilDhoolClient();
export {
  parseMediaRequest,
  buildProviderUrl,
  extractStreamsFromHtml
};
export default TamilDhool;
