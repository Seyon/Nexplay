/**
 * TamilGun / Arivumani Provider for Providers-Nexplay & Stitch-Nexplay (Server 5)
 * 
 * Target Domains:
 * - tamilgun.now (Movies & Hub)
 * - arivumani.net (TamilGun's TV Shows & Serials Network)
 * - PlayAllu encrypted stream resolution (AES-CBC / CryptoJS)
 * - Bunny CDN & Vimeo video extraction
 */

import CryptoJS from 'crypto-js';
import { parseDateInput, resilientHttpGet } from '../common/index.js';
import { resolveUrlWithDoh } from '../../utils/DnsResolver.js';

export const REQUIRED_PLAYALLU_HEADERS = {
  Referer: "https://play.playallu.xyz/",
  Origin: "https://play.playallu.xyz",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

export const REQUIRED_BUNNY_HEADERS = {
  Referer: "https://futuregentrends.com/",
  Origin: "https://futuregentrends.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

const PLAYALLU_KEYS = {
  idfile: 'jcLycoRJT6OWjoWspgLMOZwS3aSS0lEn',
  iduser: 'PZZ3J3LDbLT0GY7qSA5wW5vchqgpO36O',
  apiPayload: 'vlVbUQhkOhoSfyteyzGeeDzU0BHoeTyZ',
  apiSignature: 'KRWN3AdgmxEMcd2vLN1ju9qKe8Feco5h',
  streamDecrypt: 'oJwmvmVBajMaRCTklxbfjavpQO7SZpsL'
};

export class TamilGunClient {
  constructor() {
    this.baseUrl = "https://tamilgun.now";
    this.tvBaseUrl = "https://arivumani.net";
    this.providerName = "tamilgun";
    this.mirrors = [
      "https://tamilgun.now",
      "https://arivumani.net"
    ];
  }

  /**
   * Internal HTTP GET helper with standard headers and DoH ISP bypass
   */
  async defaultHttpGet(url, referer = "", timeoutMs = 8000) {
    return resilientHttpGet(url, referer, timeoutMs);
  }

  /**
   * Resolve PlayAllu obfuscated / AES encrypted video embeds into direct HLS .m3u8 stream
   */
  async resolvePlayAllu(playAlluUrl, referer = "https://arivumani.net/") {
    try {
      const pageRes = await fetch(playAlluUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': referer
        }
      });
      const html = await pageRes.text();

      const idfileMatch = html.match(/const\s+idfile_enc\s*=\s*["']([^"']+)["']/);
      const idUserMatch = html.match(/const\s+idUser_enc\s*=\s*["']([^"']+)["']/);
      if (!idfileMatch || !idUserMatch) return null;

      const idfile_enc = idfileMatch[1];
      const idUser_enc = idUserMatch[1];

      const decryptHex = (hex, key) => {
        const parsedHex = CryptoJS.enc.Hex.parse(hex);
        const b64 = parsedHex.toString(CryptoJS.enc.Base64);
        return CryptoJS.AES.decrypt(b64, key).toString(CryptoJS.enc.Utf8);
      };

      const idfile = decryptHex(idfile_enc, PLAYALLU_KEYS.idfile);
      const iduser = decryptHex(idUser_enc, PLAYALLU_KEYS.iduser);
      if (!idfile || !iduser) return null;

      // Register view ping (best-effort)
      fetch(`https://api-view.vnstream.net/api/view/${idfile}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': playAlluUrl }
      }).catch(() => {});

      const payload = {
        idfile,
        iduser,
        domain_play: 'https://arivumani.net',
        platform: 'Win32',
        hlsSupport: false,
        jwplayer: {}
      };

      // Encrypt payload for API
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), PLAYALLU_KEYS.apiPayload).toString();
      const hexPayload = CryptoJS.enc.Base64.parse(encrypted).toString(CryptoJS.enc.Hex);
      const signature = CryptoJS.MD5(hexPayload + PLAYALLU_KEYS.apiSignature).toString();
      const postBody = `${hexPayload}|${signature}`;

      const apiRes = await fetch('https://api-play-151024.playallu.xyz/api/tp1ts/playiframe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': 'https://play.playallu.xyz',
          'Referer': 'https://play.playallu.xyz/'
        },
        body: new URLSearchParams({ data: postBody })
      });

      const apiJson = await apiRes.json();
      if (!apiJson || !apiJson.data) return null;

      const directM3u8 = decryptHex(apiJson.data, PLAYALLU_KEYS.streamDecrypt);
      return directM3u8 && directM3u8.startsWith('http') ? directM3u8 : null;
    } catch (err) {
      console.warn('[TamilGun] Error resolving PlayAllu embed:', err?.message || err);
      return null;
    }
  }

  /**
   * Search for serials, TV shows, and movies on TamilGun / Arivumani
   */
  async search(query, customHttpGet) {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    const cleanQuery = (query || '').replace(/[:\-?"']/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanQuery) return [];

    // Search on Arivumani (TamilGun's TV shows network) for serials/shows
    const searchUrl = `${this.tvBaseUrl}/?s=${encodeURIComponent(cleanQuery)}`;
    let html = '';
    try {
      html = await fetchFn(searchUrl, this.tvBaseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilGun] Search error for "${cleanQuery}":`, err?.message || err);
      return [];
    }

    const results = [];
    const postRegex = /<article[^>]*class=["'][^"']*(?:video|post)[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
    let m;

    while ((m = postRegex.exec(html)) !== null) {
      const postBody = m[1];
      const linkMatch = postBody.match(/<a\s+[^>]*href=["'](https?:\/\/[^"']*arivumani\.net\/[^"']+)["'][^>]*>/i);
      const titleMatch = postBody.match(/<h[1-6][^>]*class=["'][^"']*post-title[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
                         postBody.match(/title=["']([^"']+)["']/i);
      const imgMatch = postBody.match(/src=["'](https?:\/\/[^"']+\.(?:avif|webp|jpg|png))["']/i);

      if (linkMatch && titleMatch) {
        const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const link = linkMatch[1];
        const image = imgMatch ? imgMatch[1] : '';
        const yearMatch = rawTitle.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

        // Skip 24x7 live feeds if requesting daily episodes
        if (cleanQuery.includes('yesterday') || cleanQuery.includes('09') || cleanQuery.includes('episode') || cleanQuery.includes('day')) {
          if (rawTitle.toLowerCase().includes('24/7') || rawTitle.toLowerCase().includes('24x7 live')) {
            continue;
          }
        }

        results.push({
          title: rawTitle,
          cleanTitle: rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(),
          link,
          image,
          quality: '720p',
          year,
          type: 'series',
          mediaType: 'tv',
          provider: 'tamilgun'
        });
      }
    }

    return results;
  }

  /**
   * Extract Details and Video Embeds from an episode page
   */
  async extractDetails(pageUrl, targetSeason = 1, customHttpGet) {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    let html = '';
    try {
      html = await fetchFn(pageUrl, this.tvBaseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilGun] Error fetching details for ${pageUrl}:`, err?.message || err);
    }

    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*(?:entry-title|post-title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : "TamilGun Episode";

    const iframes = [...html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
    const streamingLinks = [];

    for (const ifr of iframes) {
      if (ifr.includes('playallu.xyz')) {
        const directHls = await this.resolvePlayAllu(ifr, pageUrl);
        if (directHls) {
          streamingLinks.push({
            quality: '720p',
            server: 'PlayAllu Direct HLS',
            url: directHls,
            headers: REQUIRED_PLAYALLU_HEADERS,
            mimeType: 'application/x-mpegURL'
          });
        }
        streamingLinks.push({
          quality: '720p',
          server: 'PlayAllu Embed',
          url: ifr,
          headers: { Referer: 'https://arivumani.net/' }
        });
      } else if (ifr.includes('vimeo.com')) {
        const vimeoId = ifr.match(/\/video\/(\d+)/)?.[1];
        streamingLinks.push({
          quality: '720p',
          server: 'Vimeo HD Player',
          url: vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : ifr,
          headers: { Referer: 'https://arivumani.net/' }
        });
      } else if (ifr.includes('spirituallifewell.com') || ifr.includes('b-cdn.net')) {
        const uuidMatch = ifr.match(/([a-f0-9-]{36})/i);
        if (uuidMatch) {
          streamingLinks.push({
            quality: '720p',
            server: 'Bunny Stream HLS',
            url: `https://vz-8cf4325c-bc5.b-cdn.net/${uuidMatch[1]}/playlist.m3u8`,
            headers: REQUIRED_BUNNY_HEADERS,
            mimeType: 'application/x-mpegURL'
          });
        }
      }
    }

    return {
      title,
      url: pageUrl,
      quality: '720p',
      thumbnail: undefined,
      streamingLinks,
      episodes: []
    };
  }

  /**
   * Direct Playable Stream for Stitch-Nexplay & ExoPlayer
   */
  async getPlayableStream(pageUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1, customHttpGet) {
    const details = await this.extractDetails(pageUrl, seasonNumber, customHttpGet);
    if (!details || !details.streamingLinks || details.streamingLinks.length === 0) return null;

    const primary = details.streamingLinks.find(l => l.mimeType === 'application/x-mpegURL') || details.streamingLinks[0];
    const defaultHeaders = primary.url.includes('b-cdn.net') ? REQUIRED_BUNNY_HEADERS : REQUIRED_PLAYALLU_HEADERS;

    return {
      streamUrl: primary.url,
      quality: primary.quality,
      server: primary.server,
      headers: primary.headers || defaultHeaders,
      mimeType: primary.mimeType || 'application/x-mpegURL',
      qualities: {
        '720p': primary.url
      }
    };
  }

  /**
   * Universal resolver for direct links
   */
  async resolveLink(rawUrl) {
    if (rawUrl.includes('playallu.xyz')) {
      const direct = await this.resolvePlayAllu(rawUrl);
      if (direct) {
        return [{
          quality: '720p',
          server: 'PlayAllu Direct HLS',
          url: direct,
          headers: REQUIRED_PLAYALLU_HEADERS,
          mimeType: 'application/x-mpegURL'
        }];
      }
    }
    return [];
  }

  /**
   * High-accuracy Serial & Date Finder for Media3 Player
   * @param {string} serialName e.g. "Siragadikka Aasai", "Kayal", "Karthigai Deepam", "Bigg Boss"
   * @param {string} [dateStr] e.g. "15-09-2026", "yesterday", "today", "15th Sep"
   * @param {string} [channel] e.g. "Vijay TV", "Sun TV", "Zee Tamil"
   * @param {Function} [customHttpGet]
   */
  async findEpisodeByDate(serialName, dateStr, channel, customHttpGet) {
    const parsedDate = parseDateInput(dateStr);
    const queries = [];

    if (parsedDate) {
      queries.push(`${serialName} ${parsedDate.formatted}`);
      queries.push(`${serialName} ${parsedDate.formattedShort}`);
    }
    queries.push(serialName);

    const candidatePosts = [];
    const seenUrls = new Set();

    for (const q of queries) {
      const results = await this.search(q, customHttpGet);
      for (const r of results) {
        if (!seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          candidatePosts.push(r);
        }
      }
      if (candidatePosts.length > 0) break;
    }

    if (candidatePosts.length === 0) return null;

    const nameTokens = serialName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
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

    const stream = await this.getPlayableStream(bestMatch.link, true, 1, 1, customHttpGet);
    if (!stream) return null;

    return {
      ...stream,
      matchedTitle: bestMatch.title,
      matchedPageUrl: bestMatch.link,
      requestedSerial: serialName,
      requestedDate: dateStr,
      requestedChannel: channel,
      score: highestScore
    };
  }
}

export const TamilGun = new TamilGunClient();
export { parseDateInput };
export default TamilGun;
