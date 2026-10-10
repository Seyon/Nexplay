/**
 * TamilGun / Arivumani Provider for Stitch-Nexplay
 * 
 * Target Domains:
 * - tamilgun.now (Movies & Hub)
 * - arivumani.net (TamilGun's TV Shows & Serials Network)
 */

import CryptoJS from 'crypto-js';

export interface TamilGunSearchResult {
  title: string;
  cleanTitle: string;
  link: string;
  image: string;
  quality: string;
  year: number;
  type: 'series' | 'movie';
  mediaType: 'tv' | 'movie';
  provider: 'tamilgun';
}

export interface TamilGunStreamLink {
  quality: string;
  server: string;
  url: string;
  headers?: Record<string, string>;
  mimeType?: string;
}

export interface TamilGunDetails {
  title: string;
  url: string;
  quality: string;
  thumbnail?: string;
  streamingLinks: TamilGunStreamLink[];
  episodes: any[];
}

export interface TamilGunPlayableStream {
  streamUrl: string;
  quality: string;
  server: string;
  headers?: Record<string, string>;
  mimeType?: string;
  qualities?: Record<string, string>;
  thumbnail?: string;
}

type HttpGetFunction = (url: string, referer?: string, timeoutMs?: number) => Promise<string>;

export const REQUIRED_PLAYALLU_HEADERS: Record<string, string> = {
  Referer: "https://play.playallu.xyz/",
  Origin: "https://play.playallu.xyz",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

export const REQUIRED_BUNNY_HEADERS: Record<string, string> = {
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

export interface ParsedDateInfo {
  day: string;
  month: string;
  year: string;
  monthName: string;
  shortYear: string;
  formatted: string;
  formattedShort: string;
  formattedText: string;
}

export function parseDateInput(input?: string): ParsedDateInfo | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  const now = new Date();
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  let d = '';
  let m = '';
  let y = '';

  if (raw === 'today') {
    d = String(now.getDate()).padStart(2, '0');
    m = String(now.getMonth() + 1).padStart(2, '0');
    y = String(now.getFullYear());
  } else if (raw === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    d = String(yest.getDate()).padStart(2, '0');
    m = String(yest.getMonth() + 1).padStart(2, '0');
    y = String(yest.getFullYear());
  } else {
    const numMatch = raw.match(/(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?/);
    if (numMatch) {
      d = String(numMatch[1]).padStart(2, '0');
      m = String(numMatch[2]).padStart(2, '0');
      y = numMatch[3] || String(now.getFullYear());
      if (y.length === 2) y = '20' + y;
    } else {
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        september: '09', october: '10', november: '11', december: '12',
        january: '01', february: '02', march: '03', april: '04', june: '06',
        july: '07', august: '08'
      };
      const wordMatch = raw.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{2,4}))?/i);
      if (wordMatch) {
        d = String(wordMatch[1]).padStart(2, '0');
        const monStr = wordMatch[2].toLowerCase();
        m = monthMap[monStr] || monthMap[monStr.slice(0, 3)] || '09';
        y = wordMatch[3] || String(now.getFullYear());
        if (y.length === 2) y = '20' + y;
      }
    }
  }

  if (!d || !m) return null;

  const monthIdx = parseInt(m, 10) - 1;
  const monthName = monthNames[monthIdx] || 'sep';
  const shortYear = y.slice(-2);

  return {
    day: d,
    month: m,
    year: y,
    monthName,
    shortYear,
    formatted: `${d}-${m}-${y}`,
    formattedShort: `${d}-${m}-${shortYear}`,
    formattedText: `${d}th ${monthName}`
  };
}

export interface PlayableEpisodeResult extends TamilGunPlayableStream {
  matchedTitle: string;
  matchedPageUrl: string;
  requestedSerial: string;
  requestedDate?: string;
  requestedChannel?: string;
  score: number;
}

export class TamilGunClient {
  public readonly baseUrl: string = "https://tamilgun.now";
  public readonly tvBaseUrl: string = "https://arivumani.net";
  public readonly providerName: string = "tamilgun";

  private async defaultHttpGet(url: string, referer: string = ""): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(referer ? { 'Referer': referer } : {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.text();
  }

  /**
   * Resolve PlayAllu obfuscated / AES encrypted video embeds into direct HLS .m3u8 stream
   */
  async resolvePlayAllu(playAlluUrl: string, referer: string = "https://arivumani.net/"): Promise<string | null> {
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

      const decryptHex = (hex: string, key: string) => {
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
      console.warn('[TamilGun] Error resolving PlayAllu embed:', err);
      return null;
    }
  }

  /**
   * Search for serials, TV shows, and movies on TamilGun / Arivumani
   */
  async search(query: string, customHttpGet?: HttpGetFunction): Promise<TamilGunSearchResult[]> {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    const cleanQuery = query.replace(/[:\-?"']/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanQuery) return [];

    // Search on Arivumani (TamilGun's TV shows network) first for serials/shows
    const searchUrl = `${this.tvBaseUrl}/?s=${encodeURIComponent(cleanQuery)}`;
    let html = '';
    try {
      html = await fetchFn(searchUrl, this.tvBaseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilGun] Search error for "${cleanQuery}":`, err);
      return [];
    }

    const results: TamilGunSearchResult[] = [];
    const postRegex = /<article[^>]*class=["'][^"']*(?:video|post)[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
    let m: RegExpExecArray | null;

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
  async extractDetails(pageUrl: string, targetSeason: number = 1, customHttpGet?: HttpGetFunction): Promise<TamilGunDetails> {
    const fetchFn = customHttpGet || this.defaultHttpGet.bind(this);
    let html = '';
    try {
      html = await fetchFn(pageUrl, this.tvBaseUrl, 6000);
    } catch (err) {
      console.warn(`[TamilGun] Error fetching details for ${pageUrl}:`, err);
    }

    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*(?:entry-title|post-title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : "TamilGun Episode";

    const iframes = [...html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
    const streamingLinks: TamilGunStreamLink[] = [];

    for (const ifr of iframes) {
      if (ifr.includes('playallu.xyz')) {
        // Try to resolve direct PlayAllu HLS stream
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
        // Fallback to iframe
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
      streamingLinks,
      episodes: []
    };
  }

  /**
   * Direct Playable Stream for Stitch-Nexplay
   */
  async getPlayableStream(pageUrl: string, isTVShow: boolean = false, episodeNumber: number = 1, seasonNumber: number = 1, customHttpGet?: HttpGetFunction): Promise<TamilGunPlayableStream | null> {
    const details = await this.extractDetails(pageUrl, seasonNumber, customHttpGet);
    if (details.streamingLinks.length === 0) return null;

    // Prioritize direct HLS streams first (e.g. PlayAllu Direct HLS or Bunny)
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
   * High-accuracy Serial & Date Finder for Media3 Player
   * Directly searches, matches the exact date & serial episode, and extracts the playable stream with full headers.
   *
   * @param serialName e.g. "Siragadikka Aasai", "Kayal", "Karthigai Deepam", "Bigg Boss"
   * @param dateStr e.g. "15-09-2026", "14-09-2026", "yesterday", "today", "15th Sep"
   * @param channel Optional e.g. "Vijay TV", "Sun TV", "Zee Tamil"
   */
  async findEpisodeByDate(
    serialName: string,
    dateStr?: string,
    channel?: string,
    customHttpGet?: HttpGetFunction
  ): Promise<PlayableEpisodeResult | null> {
    const parsedDate = parseDateInput(dateStr);
    const queries: string[] = [];

    if (parsedDate) {
      queries.push(`${serialName} ${parsedDate.formatted}`);
      queries.push(`${serialName} ${parsedDate.formattedShort}`);
    }
    queries.push(serialName);

    const candidatePosts: TamilGunSearchResult[] = [];
    const seenUrls = new Set<string>();

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
    let bestMatch: TamilGunSearchResult | null = null;
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
