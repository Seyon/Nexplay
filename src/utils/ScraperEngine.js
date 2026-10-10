import { Movies4u, Movies4uClient } from './Movies4uProvider.js';

import { TamilDhool, TamilDhoolClient } from '../providers/tamildhool/index.js';
import { TamilGun, TamilGunClient } from '../providers/tamilgun/index.js';
// src/utils/ScraperEngine.js
import { resolveDomain, resolveUrlWithDoh } from './DnsResolver.js';

function normalizeNumbers(str) {
  if (!str) return '';
  return str
    .replace(/\b(?:part|chapter|volume|vol)\s+([0-9]+)\b/gi, 'part $1')
    .replace(/\b(?:part|chapter|volume|vol)\s+one\b/gi, 'part 1')
    .replace(/\b(?:part|chapter|volume|vol)\s+two\b/gi, 'part 2')
    .replace(/\b(?:part|chapter|volume|vol)\s+three\b/gi, 'part 3')
    .replace(/\b(?:part|chapter|volume|vol)\s+four\b/gi, 'part 4')
    .replace(/\b(?:part|chapter|volume|vol)\s+five\b/gi, 'part 5')
    .replace(/\b(?:part|chapter|volume|vol)\s+i\b/gi, 'part 1')
    .replace(/\b(?:part|chapter|volume|vol)\s+ii\b/gi, 'part 2')
    .replace(/\b(?:part|chapter|volume|vol)\s+iii\b/gi, 'part 3')
    .replace(/\b(?:part|chapter|volume|vol)\s+iv\b/gi, 'part 4')
    .replace(/\b(?:part|chapter|volume|vol)\s+v\b/gi, 'part 5')
    .replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bthree\b/gi, '3')
    .replace(/\bfour\b/gi, '4')
    .replace(/\bfive\b/gi, '5')
    .replace(/\bsix\b/gi, '6')
    .replace(/\bseven\b/gi, '7')
    .replace(/\beight\b/gi, '8')
    .replace(/\bnine\b/gi, '9')
    .replace(/\bten\b/gi, '10')
    .replace(/\bii\b/gi, '2')
    .replace(/\biii\b/gi, '3')
    .replace(/\biv\b/gi, '4')
    .replace(/\bvi\b/gi, '6')
    .replace(/\bvii\b/gi, '7')
    .replace(/\bviii\b/gi, '8')
    .replace(/\bix\b/gi, '9');
}

/**
 * Normalization & Clean Keyword Extraction
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(str) {
  if (!str) return null;
  const m = String(str).match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function cleanTitleKeywords(raw) {
  if (!raw) return '';
  let s = raw;
  // Remove quality tags
  s = s.replace(/\b(4k|2160p|1080p|720p|480p|hevc|x264|x265|10bit|bluray|remux|web-dl|webrip|hdrip|dvdrip|hdtc|camrip)\b/gi, ' ');
  // Remove audio & source & network tags
  s = s.replace(/\b(hindi|english|tamil|telugu|malayalam|kannada|korean|dual audio|multi audio|org|dubbed|esubs|subtitles|line|nf|netflix|hotstar|zee5|sonyliv|prime video|amazon prime|amazon|prime|apple|paramount|hulu|disney|peacock|max|hbo|mgm|mgmp|marvel phase \d+)\b/gi, ' ');
  // Remove format & completion tags
  s = s.replace(/\b(full movie|complete|all episodes|movie|series|season \d+|season\s*\d+\s*[-–to]+\s*\d+|s\d+|ep \d+|ep-\d+|added|imax|extended|uncut|directors cut)\b/gi, ' ');
  return normalizeString(s);
}

function extractSeasonNumbers(str) {
  if (!str) return [];
  const s = String(str).toLowerCase();
  const seasons = new Set();
  
  // Range check: e.g. "season 1-4", "season 1 to 4", "s01-s04", "s1-s4", "s1 to s4"
  const rangeMatches = s.matchAll(/\b(?:season|s)\s*0*(\d{1,2})\s*(?:-|–|to|&)\s*(?:season|s)?\s*0*(\d{1,2})\b/gi);
  for (const match of rangeMatches) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end)) {
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        seasons.add(i);
      }
    }
  }

  // Single season check: e.g. "season 2", "season 02", "s02", "s2"
  const singleMatches = s.matchAll(/\b(?:season|s)\s*0*(\d{1,2})\b/gi);
  for (const match of singleMatches) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num < 100) {
      seasons.add(num);
    }
  }

  return Array.from(seasons);
}

/**
 * Intelligent Media & Title Matching Scorer
 * Evaluates Token overlap, Candidate coverage, Release Year, Media Type (Movie vs TV Series), and TV Season Number
 */
function calculateTitleMatchScore(
  targetTitle, 
  targetYear, 
  targetType = 'movie', 
  candidateTitle = '', 
  candidateYear = '', 
  candidateType = 'movie', 
  targetSeason = null,
  candidateUrl = ''
) {
  const normTarget = normalizeNumbers(normalizeString(targetTitle));
  const cleanTarget = normalizeNumbers(cleanTitleKeywords(targetTitle));
  const normCandidate = normalizeNumbers(normalizeString(candidateTitle));
  const cleanCandidate = normalizeNumbers(cleanTitleKeywords(candidateTitle));

  if (!normTarget || !normCandidate) return 0.0;

  // Media Type check (Strict penalty if user wanted movie but candidate is series, or vice versa)
  const isTargetSeries = targetType === 'tv' || targetType === 'series';
  const isCandidateSeries = candidateType === 'tv' || candidateType === 'series' || normCandidate.includes('season') || normCandidate.includes('series') || String(candidateUrl).includes('-series-');

  let typeMultiplier = 1.0;
  if (isTargetSeries !== isCandidateSeries) {
    typeMultiplier = 0.2; // 80% penalty for media type mismatch
  }

  // Strict Season Number Matching for TV Series (Eliminates scraping wrong seasons)
  let seasonMultiplier = 1.0;
  if (isTargetSeries && targetSeason != null) {
    const candidateCombined = `${candidateTitle} ${candidateYear || ''} ${candidateUrl || ''}`;
    const candidateSeasons = extractSeasonNumbers(candidateCombined);
    const requestedSeason = parseInt(targetSeason, 10);

    if (candidateSeasons.length > 0) {
      if (candidateSeasons.includes(requestedSeason)) {
        seasonMultiplier = 1.35; // Verified matching season!
      } else {
        seasonMultiplier = 0.05; // Critical penalty for wrong season (e.g. user selected Season 1, post is Season 2 or 4)
      }
    } else {
      // Post does not specify a season number in title (e.g. single season / anime / mini-series)
      seasonMultiplier = 0.85;
    }
  }

  // 1. Exact string match (strong bonus so exact titles decisively beat partials)
  if (normTarget === normCandidate || cleanTarget === cleanCandidate) {
    return 2.0 * typeMultiplier * seasonMultiplier;
  }

  const targetTokens = cleanTarget.split(' ').filter(t => t.length > 0);
  const candidateTokens = cleanCandidate.split(' ').filter(t => t.length > 0);

  if (targetTokens.length === 0 || candidateTokens.length === 0) return 0.0;

  // 2. Core candidate title matching (candidate tokens without meta/quality/season tokens)
  const metaTokens = new Set([
    'season', 'series', 'complete', 'all', 'episodes', 'episode', 'pack', 'dual', 'audio', 'hindi', 'english',
    'tamil', 'telugu', 'malayalam', 'kannada', 'korean', 'japanese', 'chinese', 'french', 'spanish', 'german',
    'org', 'web', 'dl', 'bluray', 'hdrip', 'webrip', 'webdl', 'full', 'movie', 'amzn', 'netflix', 'hbo', 'hotstar',
    'prime', 'video', 'amazon', 'disney', 'sonyliv', 'zee5', 'jio', 'hulu', 'apple', 'appletv', 'paramount',
    'peacock', 'max', 'mgm', 'mgmp', 'original', 'with', 'subtitles', 'subtitle', 'esub', 'esubs', 'uncut',
    'extended', 'directors', 'cut', 'edition', 'proper', 'repack', 'hevc', 'x264', 'x265', '1080p', '720p',
    '480p', '2160p', '4k', 'remux', 'hdr', 'dv', 'atmos', 'dts', 'ddp5', 'dd5'
  ]);
  const filteredCandidateTokens = candidateTokens.filter(t => !metaTokens.has(t) && !/^\d+$/.test(t));

  if (targetTokens.length === filteredCandidateTokens.length && targetTokens.every((t, i) => t === filteredCandidateTokens[i])) {
    return 1.8 * typeMultiplier * seasonMultiplier;
  }

  // 3. Target Token Recall: What portion of target words appear in candidate
  let matchedTargetTokens = 0;
  for (const token of targetTokens) {
    if (candidateTokens.includes(token)) {
      matchedTargetTokens++;
    }
  }
  const targetRecall = matchedTargetTokens / targetTokens.length;

  // 4. Candidate Precision: Avoid false positives on long candidate titles
  let matchedCandidateTokens = 0;
  for (const cToken of candidateTokens) {
    if (targetTokens.includes(cToken)) {
      matchedCandidateTokens++;
    }
  }
  const candidatePrecision = matchedCandidateTokens / candidateTokens.length;

  // 5. Release Year Comparison
  let yearMultiplier = 1.0;
  const tYear = extractYear(targetYear) || extractYear(targetTitle);
  const cYear = extractYear(candidateYear) || extractYear(candidateTitle);

  if (tYear && cYear) {
    const diff = Math.abs(tYear - cYear);
    if (diff === 0) yearMultiplier = 1.15; // exact year bonus
    else if (diff <= 1) yearMultiplier = 1.0;
    else if (diff <= 3) yearMultiplier = 0.85;
    else yearMultiplier = 0.4; // significant penalty for distant years (e.g. 2001 vs 2026)
  }

  // 6. Subtitle expansion bonus (e.g. "Stree 2: Sarkate Ka Aatank", "Spider-Man: No Way Home")
  // Only grant subtitle expansion if candidate starts with the target title tokens
  const isTargetPrefix = cleanCandidate.startsWith(cleanTarget) || 
    (filteredCandidateTokens.length >= targetTokens.length && targetTokens.every((t, i) => t === filteredCandidateTokens[i]));

  if (targetRecall === 1.0 && isTargetPrefix && yearMultiplier >= 1.0) {
    return Math.min(1.7, (1.2 + candidatePrecision * 0.4) * typeMultiplier * seasonMultiplier);
  }

  // Severe penalty for single-word targets (like "From") when candidate has extra non-meta words ("The Girl From Plainville", "Agent from Above")
  let precisionWeight = 0.3;
  if (targetTokens.length === 1 && filteredCandidateTokens.length > 1) {
    precisionWeight = 0.85;
  }

  let baseScore = (targetRecall * (1 - precisionWeight)) + (candidatePrecision * precisionWeight);
  if (!isTargetPrefix && targetTokens.length <= 2) {
    baseScore *= 0.4; // Strong penalty if target word appears in the middle of an unrelated title
  }
  // Cap partial matches at 0.95 so exact/core matches (>1.0) always take priority
  return Math.min(0.95, baseScore * yearMultiplier * typeMultiplier * seasonMultiplier);
}

/**
 * Filter & Rank search results with minimum confidence threshold and season verification
 */
function findBestMatch(targetTitle, targetYear, targetType = 'movie', candidates = [], minThreshold = 0.55, targetSeason = null) {
  if (!candidates || candidates.length === 0) return null;

  const scored = candidates.map(c => {
    const score = calculateTitleMatchScore(
      targetTitle, 
      targetYear, 
      targetType, 
      c.title, 
      c.year, 
      c.type || c.mediaType || (c.url?.includes('-series-') ? 'series' : 'movie'),
      targetSeason,
      c.url || c.link || ''
    );
    return { ...c, matchScore: score };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  if (scored.length > 0 && scored[0].matchScore >= minThreshold) {
    return scored[0];
  }
  return null;
}

function safeBase64Decode(str) {
  if (!str) return '';
  try {
    if (typeof atob === 'function') {
      return atob(str.trim());
    }
  } catch (e) {}
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str.trim(), 'base64').toString('utf8');
    }
  } catch (e) {}
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let input = (str || '').replace(/[^A-Za-z0-9\+\/\=]/g, '');
    let i = 0;
    while (i < input.length) {
      const enc1 = chars.indexOf(input.charAt(i++));
      const enc2 = chars.indexOf(input.charAt(i++));
      const enc3 = chars.indexOf(input.charAt(i++));
      const enc4 = chars.indexOf(input.charAt(i++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64 && enc3 !== -1) output += String.fromCharCode(chr2);
      if (enc4 !== 64 && enc4 !== -1) output += String.fromCharCode(chr3);
    }
    return output;
  } catch (e) {}
  return '';
}

function rot13(str) {
  return (str || '').replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode(
      (c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
        ? c
        : c - 26
    );
  });
}

function decodeGreenmountToken(token) {
  if (!token) return null;
  try {
    let d1 = safeBase64Decode(token);
    let d2 = safeBase64Decode(d1);
    let d3 = rot13(d2);
    let d4 = safeBase64Decode(d3);
    const json = JSON.parse(d4);
    if (json && json.o) {
      return safeBase64Decode(json.o);
    }
  } catch(e) {}
  return null;
}

var ClientUtils = class {
  static async httpGet(url, referer = "", timeoutMs = 7000) {
    if (!url || typeof url !== 'string') return "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => {
        try { controller.abort(); } catch (_) {}
      }, timeoutMs) : null;
      try {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        };
        if (referer) headers["Referer"] = referer;
        const res = await fetch(url, {
          headers,
          signal: controller ? controller.signal : void 0,
          redirect: "follow"
        });
        if (res && res.ok) {
          const contentType = (res.headers.get("content-type") || "").toLowerCase();
          if (contentType.includes("video") || contentType.includes("octet-stream") || contentType.includes("audio")) {
            try { if (controller) controller.abort(); } catch (_) {}
            return "";
          }
          return await res.text();
        }
      } catch (e) {
        // If initial fetch failed due to carrier DNS poisoning, resolve IP via DoH and retry
        try {
          const dohResolved = await resolveUrlWithDoh(url);
          if (dohResolved && dohResolved.url && dohResolved.url !== url) {
            const dohHeaders = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              ...(dohResolved.headers || {})
            };
            if (referer) dohHeaders["Referer"] = referer;
            const retryRes = await fetch(dohResolved.url, {
              headers: dohHeaders,
              redirect: "follow"
            });
            if (retryRes && retryRes.ok) {
              const contentType = (retryRes.headers.get("content-type") || "").toLowerCase();
              if (contentType.includes("video") || contentType.includes("octet-stream") || contentType.includes("audio")) {
                return "";
              }
              return await retryRes.text();
            }
          }
        } catch (dohErr) {}

        if (attempt === 1) return "";
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        try { if (controller) controller.abort(); } catch (_) {}
      }
    }
    return "";
  }

  static isDirectMediaStream(url) {
    if (!url || typeof url !== 'string' || !url.startsWith("http")) return false;
    const lower = url.toLowerCase();

    // STRICTLY REJECT ALL ZIP AND COMPRESSED ARCHIVE FORMATS
    if (
      lower.includes(".zip") || 
      lower.includes(".rar") || 
      lower.includes(".7z") || 
      lower.includes(".tar") || 
      lower.includes(".gz") ||
      lower.includes("zippack") ||
      lower.includes("zip_pack")
    ) {
      return false;
    }

    // Intermediate web pages & wrapper landing scripts that MUST be unwrapped
    if (
      lower.includes("dl.php?link=") ||
      lower.includes("link.php?link=") ||
      lower.includes("fastdl-one.pages.dev/?url=") ||
      lower.includes("load.php") ||
      lower.includes("how-to") ||
      lower.includes("snvhost")
    ) {
      return false;
    }

    const intermediateDomains = [
      "hubcloud.",
      "gamerxyt.com",
      "hubdrive.",
      "greenmount.",
      "greenmotors.",
      "homelander",
      "linksdrive.",
      "ceciliacdn.",
      "google.com/search",
      "google.com/url",
      "t.me",
      "tinyurl.com"
    ];
    if (intermediateDomains.some((d) => lower.includes(d))) {
      return false;
    }

    if (
      lower.includes("googleusercontent.com") ||
      lower.includes("video-downloads") ||
      lower.includes("r2.cloudflarestorage.com") || 
      (lower.includes("workers.dev") && !lower.includes("/?id=")) ||
      lower.includes("bunker.monster") || 
      lower.includes("valentine.guru") || 
      lower.includes("pongala.life") || 
      lower.includes("lenin.buzz") || 
      (lower.includes("pixeldrain.com/api/file") && !lower.includes("negn6f")) || 
      (lower.includes("pixeldrain.dev/api/file") && !lower.includes("negn6f")) || 
      (lower.includes("fastdl") && !lower.includes(".pages.dev"))
    ) {
      return true;
    }

    const mediaExtensions = [".mp4", ".mkv", ".m3u8", ".mpd", ".webm", ".avi"];
    return mediaExtensions.some((ext) => lower.includes(ext));
  }

  static extractDirectCdnUrl(url) {
    if (!url || typeof url !== 'string') return null;
    let clean = url.trim();
    // First, unwrap any wrapper parameter if present (e.g. ?link= or ?url= or ?file=)
    try {
      const u = new URL(clean);
      const linkParam = u.searchParams.get('link') || u.searchParams.get('url') || u.searchParams.get('file');
      if (linkParam && linkParam.startsWith('http')) {
        return this.extractDirectCdnUrl(linkParam);
      }
    } catch (e) {
      const m = clean.match(/(?:[?&](?:link|url|file)=)(https?%3A%2F%2F[^\s"'<>]+|https?:\/\/[^\s"'<>]+)/i);
      if (m && m[1]) {
        const decoded = decodeURIComponent(m[1]);
        if (decoded.startsWith('http')) return this.extractDirectCdnUrl(decoded);
      }
    }
    return clean;
  }

  static detectQualityFromUrl(url, fallbackHint = "1080p") {
    if (!url || typeof url !== 'string') return fallbackHint.toLowerCase();
    
    // Extract and decode filename from URL query params or path
    let target = url;
    try {
      const fnMatch = url.match(/filename[*]?=([^&]+)/i);
      if (fnMatch && fnMatch[1]) {
        target = decodeURIComponent(fnMatch[1]);
      }
    } catch {}

    // Strip known provider names & AWS query param keywords that collide with 4k / hd
    const cleanTarget = target
      .replace(/4khdhub\.[a-z0-9]+/gi, '')
      .replace(/hdhub4u\.[a-z0-9]+/gi, '')
      .replace(/AWS4-[A-Z0-9-]+/gi, '')
      .replace(/4khdhub/gi, '')
      .replace(/hdhub4u/gi, '');

    if (/\b(2160p|2160|4k\s*uhd|4k\s*hdr|\b4k\b|uhd)\b/i.test(cleanTarget)) {
      return "4k";
    }
    if (/\b(1080p|1080|fhd)\b/i.test(cleanTarget)) {
      return "1080p";
    }
    if (/\b(720p|720|\bhd\b)\b/i.test(cleanTarget)) {
      return "720p";
    }
    if (/\b(480p|480|490p|490|sd)\b/i.test(cleanTarget)) {
      return "480p";
    }
    return fallbackHint.toLowerCase();
  }

  static detectMimeType(url) {
    if (!url || typeof url !== 'string') return 'video/mp4';
    const lower = url.toLowerCase();
    if (lower.includes(".m3u8")) return "application/x-mpegURL";
    if (lower.includes(".mpd")) return "application/dash+xml";
    if (lower.includes(".mkv")) return "video/x-matroska";
    if (lower.includes(".webm")) return "video/webm";
    return "video/mp4";
  }

  static decodeBase64(input) {
    try {
      let str = decodeURIComponent(input).trim();
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      const pureB64 = (s) => {
        let out = "";
        let c1, c2, c3, e1, e2, e3, e4;
        let i = 0;
        const clean = s.replace(/[^A-Za-z0-9+/=]/g, "");
        while (i < clean.length) {
          e1 = chars.indexOf(clean.charAt(i++));
          e2 = chars.indexOf(clean.charAt(i++));
          e3 = chars.indexOf(clean.charAt(i++));
          e4 = chars.indexOf(clean.charAt(i++));
          c1 = e1 << 2 | e2 >> 4;
          c2 = (e2 & 15) << 4 | e3 >> 2;
          c3 = (e3 & 3) << 6 | e4;
          out += String.fromCharCode(c1);
          if (e3 !== 64 && e3 !== -1) out += String.fromCharCode(c2);
          if (e4 !== 64 && e4 !== -1) out += String.fromCharCode(c3);
        }
        return out;
      };
      for (let i = 0; i < 3; i++) {
        if (!/^[A-Za-z0-9+/=]+$/.test(str) || str.length < 4) break;
        let decoded = "";
        if (typeof atob === "function") {
          decoded = atob(str);
        } else if (typeof Buffer !== "undefined") {
          decoded = Buffer.from(str, "base64").toString("utf8");
        } else {
          decoded = pureB64(str);
        }
        if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
        str = decoded;
      }
    } catch {
    }
    return null;
  }

  static sanitizeStreamUrl(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    const trimmed = url.trim();
    try {
      return encodeURI(decodeURI(trimmed));
    } catch (_) {
      return encodeURI(trimmed);
    }
  }

  static getStreamPriority(url, serverLabel = '') {
    const u = (url || '').toLowerCase();
    const s = (serverLabel || '').toLowerCase();
    // 1. [Download FSL server] (Cloudflare R2 Direct) - Primary streaming link
    if (u.includes('r2.cloudflarestorage.com') || u.includes('r2.dev') || s.includes('fsl server') || s.includes('fsl 4k') || s.includes('fsl 1080p') || s.includes('fsl direct')) {
      return 1;
    }
    // 2. [Download FSL v2 server] (FastDL / Bunker / Valentine / Lenin CDN / Pongala) - Second streaming link
    if (u.includes('fastdl') || u.includes('bunker.monster') || u.includes('valentine.guru') || u.includes('pongala.life') || u.includes('lenin.buzz') || s.includes('fslv2') || s.includes('fsl v2')) {
      return 2;
    }
    // 3. pixeldrain (PixelDrain Direct CDN Stream) - Third streaming link if FSL / FSLv2 not available
    if (u.includes('pixeldrain.dev/api/file') || u.includes('pixeldrain.com/api/file') || s.includes('pixel') || s.includes('pixeldrain')) {
      return 3;
    }
    // 4. [server:10gbps] (Google CDN) - Ultimate fallback if top 3 not available (does not support 206)
    if (u.includes('googleusercontent.com') || u.includes('video-downloads') || u.includes('gpdl') || s.includes('10gbps') || s.includes('google cdn')) {
      return 10;
    }
    return 999;
  }

  static getQualityWeight(qStr) {
    const q = (qStr || '').toLowerCase();
    // Default player playback strictly prefers 1080p as initial stream
    if (q === '1080p' || q === 'fhd') return 50;
    if (q === '720p' || q === 'hd') return 40;
    if (q === '4k' || q === '2160p' || q === 'uhd') return 30;
    if (q === '480p' || q === 'sd') return 10;
    return 25;
  }

  static selectBestStreamCandidate(candidateStreams) {
    if (!Array.isArray(candidateStreams) || candidateStreams.length === 0) return null;

    // First: Filter verified HTTP 206 Partial Content streams from top 3: FSL (1) -> FSLv2 (2) -> Pixeldrain (3)
    const top3Candidates = candidateStreams.filter(c => {
      if (!c || !c.url) return false;
      const prio = c.priority ?? this.getStreamPriority(c.url, c.server);
      return prio <= 3 && c.supports206 === true;
    });

    if (top3Candidates.length > 0) {
      top3Candidates.sort((a, b) => {
        const prioA = a.priority ?? this.getStreamPriority(a.url, a.server);
        const prioB = b.priority ?? this.getStreamPriority(b.url, b.server);
        if (prioA !== prioB) {
          return prioA - prioB; // 1 (FSL) < 2 (FSLv2) < 3 (Pixeldrain)
        }
        const aIs1080 = (a.quality || a.q || '').toLowerCase().includes('1080');
        const bIs1080 = (b.quality || b.q || '').toLowerCase().includes('1080');
        if (aIs1080 && !bIs1080) return -1;
        if (!aIs1080 && bIs1080) return 1;
        return this.getQualityWeight(b.quality || b.q) - this.getQualityWeight(a.quality || a.q);
      });
      return top3Candidates[0];
    }

    // Fallback: If above all three streaming links are NOT available or none support 206,
    // move to [server:10gbps] which holds google cdn and does not support 206 partial content
    const fallbackCandidates = candidateStreams.filter(c => {
      if (!c || !c.url) return false;
      const prio = c.priority ?? this.getStreamPriority(c.url, c.server);
      const u = c.url.toLowerCase();
      const s = (c.server || '').toLowerCase();
      return (prio === 10 || u.includes('googleusercontent.com') || u.includes('video-downloads') || u.includes('gpdl') || s.includes('10gbps') || s.includes('google cdn'));
    });

    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => {
        const aIs1080 = (a.quality || a.q || '').toLowerCase().includes('1080');
        const bIs1080 = (b.quality || b.q || '').toLowerCase().includes('1080');
        if (aIs1080 && !bIs1080) return -1;
        if (!aIs1080 && bIs1080) return 1;
        return this.getQualityWeight(b.quality || b.q) - this.getQualityWeight(a.quality || a.q);
      });
      return fallbackCandidates[0];
    }

    return candidateStreams[0] || null;
  }

  /**
   * Pre-flight video stream health check (verifies HTTP 206 Partial Content and 200 streaming availability)
   */
  static async verifyMediaStream(streamUrl, headers = {}, timeoutMs = 6000) {
    if (!streamUrl || !streamUrl.startsWith("http")) return { isLive: false, supports206: false };
    let controller = null;
    let timeoutId = null;
    try {
      const safeUrl = this.sanitizeStreamUrl(streamUrl);
      const isGoogleCdn = safeUrl.includes("googleusercontent.com") || 
                          safeUrl.includes("video-downloads") || 
                          safeUrl.includes("gpdl");
      const isHls = safeUrl.toLowerCase().includes('.m3u8');
      if (typeof AbortController !== "undefined") {
        controller = new AbortController();
        timeoutId = setTimeout(() => {
          try { controller.abort(); } catch (_) {}
        }, timeoutMs);
      }
      
      const reqHeaders = {
        "User-Agent": headers["User-Agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Range": "bytes=0-1024",
        ...(headers["Referer"] && !safeUrl.includes("pixeldrain") ? { "Referer": headers["Referer"] } : {})
      };

      const res = await fetch(safeUrl, {
        method: "GET",
        headers: reqHeaders,
        signal: controller ? controller.signal : void 0,
        redirect: "follow"
      });

      const status = res.status;
      const acceptRanges = (res.headers.get("accept-ranges") || "").toLowerCase();
      const contentRange = res.headers.get("content-range");
      const contentType = (res.headers.get("content-type") || "").toLowerCase();

      // Strictly reject non-video responses (HTML web players, text, zip archives, JSON)
      if (status >= 400 || contentType.includes("zip") || contentType.includes("html") || contentType.includes("json") || contentType.includes("text")) {
        return { isLive: false, supports206: false };
      }
      if (safeUrl.includes("testzip.php") || safeUrl.includes("negn6f")) {
        return { isLive: false, supports206: false };
      }

      // Google CDN fallback check: Does NOT always send 206 header on initial probe,
      // but plays flawlessly in VLC Media Player
      if (isGoogleCdn) {
        return { isLive: true, supports206: true, status: 200, isGoogleCdn: true };
      }

      // For top streaming links:
      // Strictly verify that it is working AND supports HTTP 206 Partial Content or Google CDN
      if (!isHls && (status !== 206 || !contentRange)) {
        return { isLive: false, supports206: false };
      }

      return { isLive: true, supports206: true, status: 206, contentType };
    } catch {
      return { isLive: false, supports206: false };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      try { if (controller) controller.abort(); } catch (_) {}
    }
  }

  static async selectFirstLiveStream(candidateList, headers = {}, fallbackQuality = "1080p") {
    if (!Array.isArray(candidateList) || candidateList.length === 0) return null;
    const sorted = [...candidateList]
      .filter(c => c && c.url)
      .sort((a, b) => (a.priority || 50) - (b.priority || 50));
    
    // 1. Primary: Only return live streams that strictly support playback from top candidates (FSL -> FSLv2 -> Google CDN -> Pixeldrain)
    const topPrimary = sorted.filter(item => item && item.url && (item.priority || 50) <= 10).slice(0, 4);
    for (const item of topPrimary) {
      const streamHeaders = item.headers || headers;
      const check = await this.verifyMediaStream(item.url, streamHeaders, 2000);
      if (check.isLive && (check.supports206 || check.isGoogleCdn)) {
        const detectedQ = this.detectQualityFromUrl(item.url, fallbackQuality);
        const safeUrl = this.sanitizeStreamUrl(item.url);
        return { q: detectedQ, url: safeUrl, item: { ...item, url: safeUrl, supports206: check.supports206 ?? true } };
      }
    }

    // Optimistic fast fallback: if top item is known direct CDN (Cloudflare R2, PixelDrain, FastDL, Google CDN)
    if (topPrimary.length > 0) {
      const topDirect = topPrimary[0];
      if (topDirect && (topDirect.url.includes('r2.dev') || topDirect.url.includes('cloudflarestorage') || topDirect.url.includes('pixeldrain') || topDirect.url.includes('fastdl') || topDirect.url.includes('googleusercontent.com') || topDirect.url.includes('video-downloads'))) {
        const detectedQ = this.detectQualityFromUrl(topDirect.url, fallbackQuality);
        const safeUrl = this.sanitizeStreamUrl(topDirect.url);
        return { q: detectedQ, url: safeUrl, item: { ...topDirect, url: safeUrl, supports206: true } };
      }
    }

    // 2. Fallback: If above all three streaming links not available, move to [server:10gbps] which holds google cdn and does not support 206
    for (const item of sorted) {
      if (item && item.url && ((item.priority || 50) === 10 || item.server?.toLowerCase().includes('10gbps') || item.server?.toLowerCase().includes('google cdn') || item.url.includes('googleusercontent.com') || item.url.includes('video-downloads') || item.url.includes('gpdl'))) {
        const streamHeaders = item.headers || headers;
        const check = await this.verifyMediaStream(item.url, streamHeaders, 2000);
        if (check.isLive) {
          const detectedQ = this.detectQualityFromUrl(item.url, fallbackQuality);
          const safeUrl = this.sanitizeStreamUrl(item.url);
          return { q: detectedQ, url: safeUrl, item: { ...item, url: safeUrl, supports206: false, isGoogleCdn: true } };
        }
      }
    }
    return null;
  }

  /**
   * Resolve HDStream4u / HubStream direct HLS (.m3u8) adaptive multi-audio streams
   */
  static async resolveHDStream4u(url, qualityHint = "1080p") {
    try {
      const html = await this.httpGet(url);
      const evalMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
      if (evalMatch) {
        const fn = new Function("return (" + evalMatch[0].replace(/^eval/, '') + ")");
        const unpacked = fn();
        const hlsMatch = unpacked.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i) ||
                         unpacked.match(/["'](https?:\/\/[^"'\s<>]+\/master\.m3u8[^"'\s<>]*)["']/i);
        if (hlsMatch) {
          const directUrl = hlsMatch[0].replace(/\\/g, '');
          return [{
            quality: qualityHint,
            url: directUrl,
            originalUrl: url,
            server: 'HDStream4u High-Speed HLS (Multi-Audio)',
            type: 'hls',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Referer': 'https://hdstream4u.com/'
            },
            mimeType: 'application/x-mpegURL'
          }];
        }
      }
    } catch (e) {
      console.warn("[ClientUtils] resolveHDStream4u error:", e);
    }
    return [];
  }

  static getPixelDrainUrl(html) {
    if (!html) return '';
    const pxlMatch = html.match(/var\s+pxl\s*=\s*['"]([^'"]+)['"];?/i);
    if (pxlMatch && pxlMatch[1]) {
      const cleanVal = pxlMatch[1].replace(/[?&]download.*$/i, '').trim();
      const token = cleanVal.split('/u/')[1]?.split('?')[0]?.replace(/\/+$/, '') || cleanVal.split('/').pop()?.split('?')[0];
      if (token && token !== 'negn6f' && token.length >= 6) {
        return `https://pixeldrain.dev/api/file/${token}`;
      }
    }
    const ogMatch = html.match(/<meta\s+[^>]*property=["']og:video(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:video(?::secure_url)?["']/i) ||
                    html.match(/https?:\/\/pixeldrain\.(?:dev|com)\/(?:api\/file|u)\/([a-zA-Z0-9_-]+)/i);
    if (ogMatch) {
      const rawUrl = ogMatch[1] || ogMatch[0];
      const token = rawUrl.split('/u/')[1]?.split('?')[0]?.replace(/\/+$/, '') || rawUrl.split('/api/file/')[1]?.split('?')[0] || rawUrl.split('/').pop()?.split('?')[0];
      if (token && token !== 'negn6f' && token.length >= 6) {
        return `https://pixeldrain.dev/api/file/${token}`;
      }
    }
    return '';
  }

  static getRedirectedPixelDrainUrl(...htmlSources) {
    for (const html of htmlSources) {
      if (!html) continue;
      const redirectedUrl = this.getPixelDrainUrl(html);
      if (redirectedUrl) return redirectedUrl;
    }
    return '';
  }

  static async getRedirectLocation(url, referer = "") {
    if (!url || typeof url !== 'string') return null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => {
      try { controller.abort(); } catch (_) {}
    }, 5000) : null;
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      };
      if (referer) headers["Referer"] = referer;
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller ? controller.signal : void 0,
        redirect: "manual"
      });
      const loc = res.headers.get("location");
      if (loc) {
        if (!loc.startsWith("http")) {
          const u = new URL(url);
          return `${u.protocol}//${u.host}${loc}`;
        }
        return loc;
      }
    } catch (e) {} finally {
      if (timeoutId) clearTimeout(timeoutId);
      try { if (controller) controller.abort(); } catch (_) {}
    }
    return null;
  }

  static async resolveGpdlLink(gpdlUrl, referer = "https://gamerxyt.com/") {
    if (!gpdlUrl || typeof gpdlUrl !== 'string') return null;
    try {
      const direct = this.extractDirectCdnUrl(gpdlUrl);
      if (direct && this.isDirectMediaStream(direct)) return direct;

      // Follow redirects to unwrap landing pages
      let current = gpdlUrl;
      for (let i = 0; i < 3; i++) {
        const loc = await this.getRedirectLocation(current, referer);
        if (!loc) break;
        const unwrapLoc = this.extractDirectCdnUrl(loc);
        if (unwrapLoc && this.isDirectMediaStream(unwrapLoc)) return unwrapLoc;
        current = loc;
      }

      // Fetch HTML body to extract dl.php?link= URLs
      const html = await this.httpGet(current, referer);
      const linkParamMatch = html.match(/(?:dl\.php\?link|link\.php\?link|\?url=|\?link=)(https?%3A%2F%2F[^\s"'<>]+|https?:\/\/[^\s"'<>]+)/i);
      if (linkParamMatch && linkParamMatch[1]) {
        const decoded = decodeURIComponent(linkParamMatch[1]);
        const extracted = this.extractDirectCdnUrl(decoded);
        if (extracted && this.isDirectMediaStream(extracted)) return extracted;
      }
    } catch (e) {
      console.warn("[ClientUtils] resolveGpdlLink error:", e?.message || e);
    }
    return null;
  }

  /**
   * Deep Multi-Tier HubCloud & HubDrive Stream Unwrapper
   * Resolves intermediate landing pages -> Direct High-Speed Video URLs for Media3 ExoPlayer
   */
  static async resolveDeepHubCloudChain(startUrl, qualityHint = "1080p") {
    const results = [];
    let currentUrl = startUrl;
    try {
      // 1. Unwrap Greenmount / Greenmotors / Homelander intermediate bridges
      if (currentUrl.includes("greenmount.") || currentUrl.includes("greenmotors.") || currentUrl.includes("homelander")) {
        try {
          const gHtml = await this.httpGet(currentUrl, startUrl);
          const tokenMatch = gHtml.match(/s\(['"]o['"],\s*['"]([^'"]+)['"]/i);
          if (tokenMatch && tokenMatch[1]) {
            const destUrl = decodeGreenmountToken(tokenMatch[1]);
            if (destUrl && destUrl.startsWith('http')) {
              currentUrl = destUrl;
            }
          }
        } catch (gErr) {
          console.warn("[ClientUtils] Greenmount/Greenmotors unwrap error:", gErr?.message || gErr);
        }
      }

      // 2. Unwrap HBLinks intermediate bridge
      if (currentUrl.includes("hblinks.")) {
        try {
          const hHtml = await this.httpGet(currentUrl, startUrl);
          const aMatches = [...hHtml.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']*(?:hubcloud|hubdrive|hubcdn|drive)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
          let selected = null;
          if (aMatches.length > 0) {
            const is4K = qualityHint === '4k' || qualityHint === '2160p';
            const is1080p = qualityHint === '1080p';
            const is720p = qualityHint === '720p';

            const candidates = aMatches.map(m => {
              const url = m[1];
              const text = m[2].replace(/<[^>]+>/g, '').trim();
              const pos = m.index;
              const pre = hHtml.substring(Math.max(0, pos - 200), pos).replace(/<[^>]+>/g, ' ');
              const combined = `${text} ${pre}`.toLowerCase();
              return { url, text, combined };
            });

            if (is4K) {
              selected = candidates.find(c => /\b(2160p|4k|uhd|sdr|hdr|dv)\b/i.test(c.combined));
            } else if (is1080p) {
              selected = candidates.find(c => /\b(1080p|fhd|hevc|10bit)\b/i.test(c.combined) && !/\b(2160p|4k)\b/i.test(c.combined)) ||
                         candidates.find(c => /\b1080p\b/i.test(c.combined));
            } else if (is720p) {
              selected = candidates.find(c => /\b720p\b/i.test(c.combined));
            }

            if (!selected) {
              selected = candidates.find(c => /\b(2160p|4k)\b/i.test(c.combined)) ||
                         candidates.find(c => /\b1080p\b/i.test(c.combined)) ||
                         candidates.find(c => /\b720p\b/i.test(c.combined)) ||
                         candidates[0];
            }
          }
          if (selected && selected.url) {
            currentUrl = selected.url;
          } else {
            const m = hHtml.match(/href=["'](https?:\/\/[^"']*(?:hubcloud|hubdrive)[^"']*)["']/i);
            if (m && m[1]) {
              currentUrl = m[1];
            }
          }
        } catch (hErr) {
          console.warn("[ClientUtils] HBLinks unwrap error:", hErr?.message || hErr);
        }
      }

      // 3. Unwrap Hubdrive / HubCDN intermediate bridge
      let hubdriveText = '';
      if (currentUrl.includes("hubdrive.") || currentUrl.includes("hubcdn.")) {
        hubdriveText = await this.httpGet(currentUrl, startUrl);
        const match = hubdriveText.match(/href=["'](https?:\/\/[^"']*hubcloud\.[^"']*)["']/i);
        if (match && match[1]) currentUrl = match[1];
      }

      // 4. Unwrap Hubcloud intermediate landing page
      let hubcloudText = '';
      if (currentUrl.includes("hubcloud.") || currentUrl.includes("/drive/") || currentUrl.includes("/video/")) {
        hubcloudText = await this.httpGet(currentUrl, startUrl);
      }

      // 5. Find gamerxyt or sportverse landing url
      let vcloudLink = '';
      const gamerMatch = (hubcloudText || hubdriveText).match(/href=["'](https?:\/\/[^"']*(?:gamerxyt|sportverse|hubcloud\.php)[^"']*)["']/i);
      if (gamerMatch && gamerMatch[1]) vcloudLink = gamerMatch[1].replace(/&amp;/g, '&');
      if (!vcloudLink) {
        const idMatch = (hubcloudText || hubdriveText).match(/<a[^>]*id=["']download["'][^>]*href=["']([^"']+)["']/i);
        if (idMatch && idMatch[1]) vcloudLink = idMatch[1].replace(/&amp;/g, '&');
      }
      if (!vcloudLink) {
        const varMatch = (hubcloudText || hubdriveText).match(/var\s+url\s*=\s*['"]([^'"]+)['"]/i);
        if (varMatch && varMatch[1]) vcloudLink = varMatch[1].replace(/&amp;/g, '&');
      }

      let vcloudText = '';
      if (vcloudLink && vcloudLink.startsWith('http')) {
        vcloudText = await this.httpGet(vcloudLink, vcloudLink);
      }

      const defaultHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*"
      };

      const streamLinks = [];
      const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;

      while ((m = anchorRegex.exec(vcloudText)) !== null) {
        let link = m[1];
        const text = m[2].replace(/<[^>]+>/g, "").trim();
        const lowerLink = (link || '').toLowerCase();
        const lowerText = (text || '').toLowerCase();
        if (!link || link.startsWith('#') || link.includes('google.com/search') || link.includes('tinyurl') || link.includes('t.me') || link.includes('one.one.one') || link.includes('snvhost')) continue;
        if (link.includes('.zip') || link.includes('.rar') || text.includes('.zip') || text.includes('batch')) continue;

        // 1. [Download FSL server] (Cloudflare R2 Direct) - Priority 1 (Primary Streaming Link)
        if (link.includes('cloudflarestorage') || link.includes('r2.dev') || text.includes('FSL Server') || text.includes('FSL 4K') || text.includes('FSL 1080p') || text.includes('FSL Direct')) {
          streamLinks.push({
            server: "Download [FSL Server] (10Gbps Cloudflare R2 Direct)",
            url: link,
            quality: qualityHint,
            originalUrl: startUrl,
            type: "direct",
            headers: defaultHeaders,
            mimeType: this.detectMimeType(link),
            priority: 1
          });
        }
        // 2. [Download FSL v2 server] (FastDL / FSLv2 / Lenin CDN / Bunker / Valentine) - Priority 2 (Second Streaming Link)
        else if (link.includes('fastdl') || link.includes('fsl.') || link.includes('bunker.monster') || link.includes('valentine.guru') || link.includes('pongala.life') || link.includes('lenin.buzz') || text.includes('FastDL') || text.includes('FSLv2') || text.includes('FSL v2') || text.includes('FSL Server v2')) {
          streamLinks.push({
            server: "Download [FSL v2 server] (Fast CDN Direct Stream)",
            url: link,
            quality: qualityHint,
            originalUrl: startUrl,
            type: "direct",
            headers: defaultHeaders,
            mimeType: this.detectMimeType(link),
            priority: 2
          });
        }
        // 3. pixeldrain (PixelDrain Direct CDN Stream) - Priority 3 (Third Streaming Link if FSL / FSLv2 not available)
        else if (link.includes('pixeld') || text.toLowerCase().includes('pixel')) {
          let cleanPixelUrl = '';
          const redirected = this.getRedirectedPixelDrainUrl(vcloudText, hubcloudText, hubdriveText);
          if (redirected && redirected.includes('api/file')) {
            cleanPixelUrl = redirected;
          } else {
            const token = link.split('/u/')[1]?.split('?')[0]?.replace(/\/+$/, '') || link.split('/').pop()?.split('?')[0];
            if (token && token !== 'negn6f' && token.length >= 6) {
              cleanPixelUrl = `https://pixeldrain.dev/api/file/${token}`;
            }
          }
          if (cleanPixelUrl && cleanPixelUrl.includes('api/file') && !cleanPixelUrl.includes('negn6f')) {
            if (!streamLinks.some(s => s.url === cleanPixelUrl)) {
              streamLinks.push({
                server: "Download [PixelServer] (PixelDrain Direct CDN Stream)",
                url: cleanPixelUrl,
                quality: qualityHint,
                originalUrl: startUrl,
                type: "direct",
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  "Accept": "*/*"
                },
                mimeType: this.detectMimeType(cleanPixelUrl),
                priority: 3
              });
            }
          }
        }
        // 4. [server:10gbps] (Google CDN Stream) - Priority 2
        else if (
          lowerText.includes('server : 10gbps') ||
          lowerText.includes('server: 10gbps') ||
          (lowerText.includes('10gbps') && !lowerText.includes('fsl') && !lowerText.includes('r2')) ||
          lowerText.includes('google cdn') ||
          lowerLink.includes('googleusercontent.com') ||
          lowerLink.includes('video-downloads') ||
          lowerLink.includes('pixel.hubcloud') ||
          lowerLink.includes('gpdl')
        ) {
          let directGoogleUrl = link;
          if (link.includes('pixel.hubcloud') || link.includes('gamerxyt.com/dl.php') || link.includes('gpdl') || link.includes('dl.php?link=')) {
            const unwrapped = await this.resolveGpdlLink(link);
            if (unwrapped) directGoogleUrl = unwrapped;
          }
          if (directGoogleUrl && (directGoogleUrl.includes('googleusercontent.com') || directGoogleUrl.includes('video-downloads') || this.isDirectMediaStream(directGoogleUrl))) {
            streamLinks.push({
              server: "Download [Server : 10Gbps] (Google CDN Stream)",
              url: directGoogleUrl,
              quality: qualityHint,
              originalUrl: startUrl,
              type: "direct",
              headers: defaultHeaders,
              mimeType: this.detectMimeType(directGoogleUrl),
              priority: 2
            });
          }
        }
      }

      // Check for pixel.hubcloud.ist in vcloudText if not captured in anchors
      if (!streamLinks.some(s => s.url.includes('googleusercontent') || s.url.includes('video-downloads'))) {
        const pixelMatch = vcloudText.match(/href=["'](https?:\/\/[^"']*pixel\.hubcloud[^"']*)["']/i);
        if (pixelMatch && pixelMatch[1]) {
          const directGoogleUrl = await this.resolveGpdlLink(pixelMatch[1]);
          if (directGoogleUrl) {
            streamLinks.push({
              server: "Download [Server : 10Gbps] (Google CDN Stream)",
              url: directGoogleUrl,
              quality: qualityHint,
              originalUrl: startUrl,
              type: "direct",
              headers: defaultHeaders,
              mimeType: this.detectMimeType(directGoogleUrl),
              priority: 2
            });
          }
        }
      }

      // Explicit check for Pixeldrain in scripts/HTML if not captured during anchor loop
      if (!streamLinks.some(s => s.url.includes('pixeldrain'))) {
        const redirected = this.getRedirectedPixelDrainUrl(vcloudText, hubcloudText, hubdriveText);
        if (redirected && redirected.includes('api/file') && !redirected.includes('negn6f')) {
          streamLinks.push({
            server: "Download [PixelServer] (PixelDrain Direct CDN Stream)",
            url: redirected,
            quality: qualityHint,
            originalUrl: startUrl,
            type: "direct",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "*/*"
            },
            mimeType: this.detectMimeType(redirected),
            priority: 3
          });
        }
      }

      // Check script tags on vcloudText for hidden R2 links
      const scriptRegex = /<script[\s\S]*?<\/script>/gi;
      let sm;
      while ((sm = scriptRegex.exec(vcloudText)) !== null) {
        const sContent = sm[0];
        const r2Matches = sContent.matchAll(/https?:\/\/[^"'\s<>]+\.r2\.cloudflarestorage\.com\/[^"'\s<>]+/gi);
        for (const rm of r2Matches) {
          if (!streamLinks.some(s => s.url === rm[0])) {
            streamLinks.push({
              server: "Download [FSL Server] (10Gbps Cloudflare R2 Direct)",
              url: rm[0],
              quality: qualityHint,
              originalUrl: startUrl,
              type: "direct",
              headers: defaultHeaders,
              mimeType: this.detectMimeType(rm[0]),
              priority: 1
            });
          }
        }
      }

      const filteredLinks = streamLinks.filter(s => {
        if (!s || !s.url) return false;
        const u = s.url.toLowerCase();
        const srv = (s.server || '').toLowerCase();

        const isFsl = srv.includes('fsl server') || u.includes('r2.cloudflarestorage.com') || u.includes('r2.dev');
        const isFslV2 = srv.includes('fslv2') || srv.includes('fsl v2') || u.includes('fastdl') || u.includes('bunker.monster') || u.includes('valentine.guru') || u.includes('pongala.life') || u.includes('lenin.buzz');
        const isPixel = srv.includes('pixel') || u.includes('pixeldrain.com') || u.includes('pixeldrain.dev');
        const isGoogle = u.includes('googleusercontent.com') || u.includes('video-downloads') || srv.includes('server : 10gbps') || srv.includes('google cdn');

        if (!isFsl && !isFslV2 && !isPixel && !isGoogle) {
          return false;
        }

        return true;
      });
      filteredLinks.sort((a, b) => a.priority - b.priority);
      return filteredLinks;
    } catch (e) {
      console.warn("[ClientUtils] resolveDeepHubCloudChain error:", e?.message || e);
    }
    return results;
  }
};

function findLastRegexIndex(regex, str) {
  let lastIndex = -1;
  let m;
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  while ((m = re.exec(str)) !== null) {
    lastIndex = m.index;
  }
  return lastIndex;
}

/// Helper to extract episodes and media bridges with season context
function parseMediaBridges(html, pageTitle = '') {
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const pageSeasonMatch = pageTitle.match(/(?:Season|S)\s*0*(\d{1,2})/i);
  const defaultPageSeason = pageSeasonMatch ? parseInt(pageSeasonMatch[1], 10) : 1;

  const episodeMap = new Map(); // key: "s-e" -> array of { seasonNumber, episodeNumber, quality, sizeMB, url, label }
  const movieBridges = []; // array of { quality, sizeMB, url, label }
  const watchBridges = []; // array of { url, label, quality }

  // Extract any Watch Online / Stream links from post HTML
  const allLinksRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let wMatch;
  while ((wMatch = allLinksRegex.exec(cleanHtml)) !== null) {
    const wUrl = wMatch[1];
    const wText = wMatch[2].replace(/<[^>]+>/g, '').trim();
    const lUrl = wUrl.toLowerCase();
    const lTxt = wText.toLowerCase();
    if (
      lUrl.includes('hdstream4u') || lUrl.includes('hubstream') || lUrl.includes('streamhub') || lUrl.includes('m4uplay') ||
      lTxt.includes('watch online') || lTxt.includes('player-') || lTxt === 'watch' || lTxt === 'player 1' || lTxt === 'player 2' || lTxt === 'play'
    ) {
      if (wUrl.startsWith('http') && !lUrl.includes('.zip') && !lUrl.includes('tutorial') && !lUrl.includes('snvhost') && !lUrl.includes('winexch')) {
        if (!watchBridges.some(wb => wb.url === wUrl)) {
          watchBridges.push({ url: wUrl, label: wText, quality: '1080p' });
        }
      }
    }
  }

  const aRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']*(?:hubdrive|hubcloud|greenmount|greenmotors|homelander|hubcdn|gamerxyt|gadgets|fastdrive|drive|hblinks|hburl|linkstumble)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let aMatch;

  while ((aMatch = aRegex.exec(cleanHtml)) !== null) {
    const hubUrl = aMatch[1];
    const linkText = aMatch[2].replace(/<[^>]+>/g, '').trim();
    const lowerHub = hubUrl.toLowerCase();
    const lowerText = linkText.toLowerCase();

    // STRICTLY IGNORE WATCH ONLINE LINKS, THIRD-PARTY EMBED PLAYERS & ARCHIVES FOR DIRECT FILE BRIDGES
    if (
      lowerHub.includes('.zip') || lowerHub.includes('.rar') || lowerHub.includes('zippack') || lowerHub.includes('zip_pack') ||
      lowerHub.includes('hdstream4u') || lowerHub.includes('hubstream') || lowerHub.includes('streamhub') ||
      lowerText.includes('.zip') || lowerText.includes('zip pack') || lowerText.includes('batch') || lowerText.includes('all in one zip') || lowerText.includes('pack [') || lowerText.includes('pack]') ||
      lowerText.includes('watch online') || lowerText.includes('watch') || lowerText.includes('player-') || lowerText === 'player 1' || lowerText === 'player 2' || lowerText === 'play'
    ) {
      continue;
    }

    const pos = aMatch.index;
    const rawPrecedingContext = cleanHtml.substring(Math.max(0, pos - 1500), pos);

    const precedingContext = rawPrecedingContext
      .replace(/<[^>]+>/g, ' ')
      .replace(/4khdhub\.[a-z0-9]+/gi, '')
      .replace(/hdhub4u\.[a-z0-9]+/gi, '')
      .replace(/4khdhub|hdhub4u/gi, '')
      .replace(/\s+/g, ' ');

    const followingContext = cleanHtml.substring(pos, Math.min(cleanHtml.length, pos + 100))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    const combined = `${linkText} ${precedingContext} ${followingContext}`;

    // Check season and episode (Strictly prioritize linkText first, then closest precedingContext)
    const linkSeMatch = linkText.match(/\bS0*(\d{1,2})[\s._-]*E(?:P|pisode)?0*(\d{1,2})\b/i) ||
                        linkText.match(/\bSeason\s*0*(\d{1,2})[\s._-]*Episode\s*0*(\d{1,2})\b/i);
    const linkEpMatch = linkText.match(/\b(?:Episode|EP|Ep)[\s._-]*0*(\d{1,2})\b/i) ||
                        linkText.match(/\bE[\s._-]*0*(\d{1,2})\b/i);

    const seRegex = /\bS0*(\d{1,2})[\s._-]*E(?:P|pisode)?0*(\d{1,2})\b|\bSeason\s*0*(\d{1,2})[\s._-]*Episode\s*0*(\d{1,2})\b/gi;
    let lastSeMatch = null;
    let sem;
    while ((sem = seRegex.exec(precedingContext)) !== null) {
      lastSeMatch = sem;
    }

    const sHeaderRegex = /\b(?:Season|S)\s*0*(\d{1,2})\b/gi;
    let lastSHeaderMatch = null;
    let shm;
    while ((shm = sHeaderRegex.exec(precedingContext)) !== null) {
      lastSHeaderMatch = shm;
    }

    let seasonNum = defaultPageSeason;
    let epNum = null;

    if (linkSeMatch) {
      seasonNum = parseInt(linkSeMatch[1], 10);
      epNum = parseInt(linkSeMatch[2], 10);
    } else if (lastSeMatch) {
      seasonNum = parseInt(lastSeMatch[1] || lastSeMatch[3], 10);
      epNum = parseInt(lastSeMatch[2] || lastSeMatch[4], 10);
    } else if (linkEpMatch) {
      epNum = parseInt(linkEpMatch[1], 10);
      if (lastSHeaderMatch) {
        seasonNum = parseInt(lastSHeaderMatch[1], 10);
      }
    } else {
      const epRegex = /\b(?:Episode|EP|Ep)[\s._-]*0*(\d{1,2})\b/gi;
      let lastEpMatch = null;
      let em;
      while ((em = epRegex.exec(precedingContext)) !== null) {
        lastEpMatch = em;
      }
      if (lastEpMatch) {
        epNum = parseInt(lastEpMatch[1], 10);
        if (lastSHeaderMatch) {
          seasonNum = parseInt(lastSHeaderMatch[1], 10);
        }
      }
    }

    // Quality detection (Strictly prioritize anchor link text first, then closest preceding header, then combined)
    let linkQuality = null;
    if (/\b(2160p|4k\s*uhd|4k\s*hdr|\b4k\b|2160|uhd)\b/i.test(linkText)) linkQuality = '4k';
    else if (/\b(1080p|fhd|1080)\b/i.test(linkText)) linkQuality = '1080p';
    else if (/\b(720p|720|\bhd\b)\b/i.test(linkText)) linkQuality = '720p';
    else if (/\b(480p|480|sd)\b/i.test(linkText)) linkQuality = '480p';

    const pos4K = findLastRegexIndex(/\b(2160p|4k\s*uhd|4k\s*hdr|\b4k\b|2160|uhd)\b/i, precedingContext);
    const pos1080p = findLastRegexIndex(/\b(1080p|fhd|1080)\b/i, precedingContext);
    const pos720p = findLastRegexIndex(/\b(720p|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i, precedingContext);
    const pos480p = findLastRegexIndex(/\b(480p|480|sd)\b/i, precedingContext);

    let quality = '1080p';
    if (linkQuality) {
      quality = linkQuality;
    } else if (pos4K !== -1 || pos1080p !== -1 || pos720p !== -1 || pos480p !== -1) {
      const maxPos = Math.max(pos4K, pos1080p, pos720p, pos480p);
      if (maxPos === pos4K) quality = '4k';
      else if (maxPos === pos1080p) quality = '1080p';
      else if (maxPos === pos720p) quality = '720p';
      else quality = '480p';
    } else if (/\b(2160p|4k\s*uhd|4k\s*hdr|\b4k\b|2160|uhd)\b/i.test(combined)) {
      quality = '4k';
    } else if (/\b(720p|hd|720)\b/i.test(combined)) {
      quality = '720p';
    } else if (/\b(480p|480|sd)\b/i.test(combined)) {
      quality = '480p';
    }

    // File size detection (Prioritize linkText, then closest precedingContext size)
    let sizeMB = 0;
    const gbInLink = linkText.match(/([0-9.]+)\s*GB/i);
    const mbInLink = linkText.match(/([0-9.]+)\s*MB/i);

    if (gbInLink) {
      sizeMB = parseFloat(gbInLink[1]) * 1024;
    } else if (mbInLink) {
      sizeMB = parseFloat(mbInLink[1]);
    } else {
      const sizeRegex = /([0-9.]+)\s*(GB|MB)/gi;
      let lastSizeMatch = null;
      let sm;
      while ((sm = sizeRegex.exec(precedingContext)) !== null) {
        lastSizeMatch = sm;
      }
      if (lastSizeMatch) {
        const val = parseFloat(lastSizeMatch[1]);
        const unit = lastSizeMatch[2].toUpperCase();
        sizeMB = unit === 'GB' ? val * 1024 : val;
      }
    }

    // Fidelity tag matching & scoring (x265, HEVC, HDR, SDR, DV, Multi, 10-bit, Remux, BluRay, WEB-DL)
    const targetKeywords = [
      'hevc', 'hdr', 'hdr10', 'hdr10+', 'sdr', 'dv', 'dolby vision', 'multi audio', 'multi', 'dual audio', 
      'x265', 'x264', 'h.265', 'h.264', '10bit', '10-bit', 'atmos', 'dts', 'ddp5.1', 'web-dl', 'webrip', 'bluray', 'remux'
    ];
    const highExtensionSet = new Set(['hevc', 'hdr', 'hdr10', 'hdr10+', 'sdr', 'dv', 'dolby vision', 'multi audio', 'multi', 'dual audio', 'x265', 'x264', 'h.265', 'h.264', '10bit', '10-bit']);
    const matchedTags = [];
    let highExtMatches = 0;
    const lowerCombined = combined.toLowerCase();
    for (const kw of targetKeywords) {
      if (lowerCombined.includes(kw)) {
        matchedTags.push(kw.toUpperCase());
        if (highExtensionSet.has(kw)) {
          highExtMatches++;
        }
      }
    }
    
    // Resolution base score (4K: 500, 1080p: 250, 720p: 100, 480p: 50)
    const resScore = quality === '4k' ? 500 : (quality === '1080p' ? 250 : (quality === '720p' ? 100 : 50));
    const tagScore = matchedTags.length * 25 + (highExtMatches > 0 ? 50 : 0);
    const sizeScore = Math.min(150, Math.round(sizeMB / 100));
    const totalScore = resScore + tagScore + sizeScore;

    const bridgeObj = {
      seasonNumber: seasonNum,
      episodeNumber: epNum,
      quality,
      sizeMB,
      url: hubUrl,
      label: linkText,
      tags: matchedTags,
      score: totalScore
    };

    if (epNum != null) {
      const key = `${seasonNum}-${epNum}`;
      if (!episodeMap.has(key)) episodeMap.set(key, []);
      episodeMap.get(key).push(bridgeObj);
    } else {
      movieBridges.push(bridgeObj);
    }
  }

  // Helper: If both WEB-DL and WEBRip are available, strictly consider ONLY WEB-DL
  const filterWebDlOverWebRip = (bridgeList) => {
    if (!Array.isArray(bridgeList) || bridgeList.length === 0) return bridgeList;
    const isWebDl = (b) => /\bweb[-._]?dl\b/i.test(((b.label || '') + ' ' + (b.url || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase());
    const isWebRip = (b) => /\b(?:web[-._]?rip|webrip)\b/i.test(((b.label || '') + ' ' + (b.url || '') + ' ' + (b.tags?.join(' ') || '')).toLowerCase());
    const hasWebDl = bridgeList.some(isWebDl);
    const hasWebRip = bridgeList.some(isWebRip);
    if (hasWebDl && hasWebRip) {
      return bridgeList.filter(b => !isWebRip(b));
    }
    return bridgeList;
  };

  const finalMovieBridges = filterWebDlOverWebRip(movieBridges);
  finalMovieBridges.sort((a, b) => (b.score || 0) - (a.score || 0));

  for (const [key, list] of episodeMap.entries()) {
    const filteredList = filterWebDlOverWebRip(list);
    filteredList.sort((a, b) => (b.score || 0) - (a.score || 0));
    episodeMap.set(key, filteredList);
  }

  return { episodeMap, movieBridges: finalMovieBridges, watchBridges, defaultPageSeason };
}

function getHubServerLabel(url, quality, providerName = 'Server 1 (HDHub4u)') {
  if (!url) return providerName;
  if (url.includes('cloudflarestorage') || url.includes('r2.dev')) {
    return (quality === '4k' || quality === '2160p') ? 'Download [FSL 4K Server] (10Gbps Cloudflare R2 Direct)' : 'Download [FSL Server] (10Gbps Cloudflare R2 Direct)';
  }
  if (url.includes('fastdl') || url.includes('fsl.') || url.includes('bunker.monster') || url.includes('valentine.guru') || url.includes('pongala.life') || url.includes('lenin.buzz')) {
    return 'Download [FSL v2 server] (Fast CDN Direct Stream)';
  }
  if (url.includes('pixeldrain')) {
    return 'Download [PixelServer] (PixelDrain Direct CDN Stream)';
  }
  if (url.includes('hdstream4u') || url.includes('dramiyos') || url.includes('m3u8') || url.includes('m4uplay') || url.includes('hubstream') || url.includes('acek-cdn')) {
    return 'Watch Online (High-Speed Stream)';
  }
  if (url.includes('workers.dev')) {
    return 'Download File (Cloudflare Worker Stream)';
  }
  return `${providerName} Direct Stream`;
}

export function formatSizeMB(mb) {
  if (!mb || isNaN(mb) || mb <= 0) return null;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function defaultSizeForQuality(q) {
  const lower = (q || '').toLowerCase();
  if (lower.includes('4k') || lower.includes('2160')) return '5.8 GB';
  if (lower.includes('1080')) return '2.2 GB';
  if (lower.includes('720')) return '1.1 GB';
  if (lower.includes('480') || lower.includes('490') || lower.includes('sd')) return '450 MB';
  return '1.5 GB';
}

var HDHub4uClient = class {
  constructor() {
    this.baseUrl = "https://new2.hdhub4u.free";
    this.mirrors = [
      "https://new2.hdhub4u.free",
      "https://hdhub4u.pro",
      "https://hdhub4u.bi",
      "https://hdhub4u.tv",
      "https://hdhub4u.ms"
    ];
  }

  setBaseUrl(url) {
    if (url && typeof url === 'string') {
      this.baseUrl = url.replace(/\/+$/, '');
      if (!this.mirrors.includes(this.baseUrl)) {
        this.mirrors.unshift(this.baseUrl);
      }
    }
  }

  setMirrors(mirrors) {
    if (Array.isArray(mirrors) && mirrors.length > 0) {
      this.mirrors = mirrors.map(m => m.replace(/\/+$/, ''));
      if (this.mirrors.length > 0) {
        this.baseUrl = this.mirrors[0];
      }
    }
  }

  applyRemoteConfig(config = {}) {
    if (config.baseUrl) this.setBaseUrl(config.baseUrl);
    if (Array.isArray(config.mirrors)) this.setMirrors(config.mirrors);
  }

  async search(query) {
    const results = [];
    const cleanQuery = query.replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryPlus = cleanQuery.replace(/\s+/g, '+');
    const baseTitle = cleanQuery.replace(/\b(19\d{2}|20\d{2})\b/g, '').trim();

    const searchQueries = [cleanQuery];
    if (baseTitle && baseTitle !== cleanQuery) searchQueries.push(baseTitle);

    const noEra = cleanQuery.replace(/\b(?:ad|ce|bc|bce)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (noEra && noEra !== cleanQuery && !searchQueries.includes(noEra)) searchQueries.push(noEra);

    const firstWord = cleanQuery.split(' ')[0];
    if (firstWord && firstWord.length >= 4 && !searchQueries.includes(firstWord) && !['the', 'this', 'that', 'with'].includes(firstWord.toLowerCase())) {
      searchQueries.push(firstWord);
    }

    const ignoreSlugs = ['category', 'tag', 'page', 'disclaimer', 'how-to-download', 'join-our-group', 'request-a-movie', 'dmca', 'search', 'faq', 'about-us', 'contact-us'];

    for (const mirror of this.mirrors) {
      for (const q of searchQueries) {
        try {
          const searchUrls = [
            `${mirror}/search/${encodeURIComponent(q)}/`,
            `${mirror}/?s=${encodeURIComponent(q)}`
          ];

          for (const sUrl of searchUrls) {
            const html = await ClientUtils.httpGet(sUrl, mirror, 3500);
            if (!html || html.includes("<title>Just a moment...</title>") || html.length < 500) continue;

            const linkRegex = /<a\s+[^>]*href=["']((?:https?:\/\/[^"']*\/|\/)([^"'\/\s]+)\/?)["']([^>]*)>([\s\S]*?)<\/a>/gi;
            let m;

            while ((m = linkRegex.exec(html)) !== null) {
              const url = m[1];
              const slug = m[2].toLowerCase();
              const tagAttrs = m[3] || '';
              const innerHtml = m[4] || '';

              if (ignoreSlugs.includes(slug) || slug.includes('request-a-movie') || slug.includes('feed') || slug.includes('wp-json') || slug.includes('xmlrpc')) continue;

              const ariaMatch = tagAttrs.match(/aria-label=["']([^"']+)["']/i);
              const titleMatch = ariaMatch ||
                                 innerHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || 
                                 innerHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) ||
                                 innerHtml.match(/alt=["']([^"']+)["']/i);
              
              let title = titleMatch ? titleMatch[1] : innerHtml;
              title = title.replace(/<[^>]+>/g, '').replace(/&#038;/g, '&').replace(/&#8217;/g, "'").replace(/&#8211;/g, '-').trim().replace(/\s+/g, ' ');

              if (title && title.length > 5 && !title.toLowerCase().includes("how to download") && !title.toLowerCase().includes("disclaimer") && !title.toLowerCase().includes("join our group") && !title.toLowerCase().includes("whatsapp")) {
                const fullUrl = url.startsWith('http') ? (url.endsWith('/') ? url : `${url}/`) : `${mirror}${url.startsWith('/') ? '' : '/'}${url}${url.endsWith('/') ? '' : '/'}`;
                if (!results.some(r => r.url === fullUrl)) {
                  const isSeries = fullUrl.includes("-series-") || fullUrl.includes("-all-episodes") || fullUrl.includes("-season-") || title.toLowerCase().includes("season") || title.toLowerCase().includes("series");
                  const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
                  results.push({
                    title,
                    cleanTitle: cleanTitleKeywords(title),
                    url: fullUrl,
                    year: yearMatch ? yearMatch[1] : '',
                    type: isSeries ? 'series' : 'movie',
                    mediaType: isSeries ? 'tv' : 'movie',
                    provider: 'hdhub4u'
                  });
                }
              }
            }
            if (results.length > 0) return results;
          }
        } catch (e) {
          // mirror failed fast, try next
        }
      }
    }

    return results;
  }

  async extractDetails(pageUrl, targetSeason = 1) {
    const html = await ClientUtils.httpGet(pageUrl);
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().replace(/&#038;/g, "&") : "Media Details";
    const isSeries = pageUrl.includes("-series-") || title.toLowerCase().includes("season") || title.toLowerCase().includes("series");

    const { episodeMap, movieBridges, watchBridges, defaultPageSeason } = parseMediaBridges(html, title);
    const effectiveSeason = targetSeason || defaultPageSeason || 1;

    const episodes = [];
    if (isSeries && episodeMap.size > 0) {
      const allKeys = Array.from(episodeMap.keys());
      const seasonKeys = allKeys.filter(k => k.startsWith(`${effectiveSeason}-`));
      const targetKeys = seasonKeys.length > 0 ? seasonKeys : allKeys;

      const sortedKeys = targetKeys.sort((a, b) => {
        const epA = parseInt(a.split('-')[1], 10) || 0;
        const epB = parseInt(b.split('-')[1], 10) || 0;
        return epA - epB;
      });

      for (const key of sortedKeys) {
        const [sNum, eNum] = key.split('-').map(n => parseInt(n, 10));
        const bridgeList = episodeMap.get(key) || [];
        episodes.push({
          seasonNumber: sNum,
          episodeNumber: eNum,
          title: `Episode ${eNum}`,
          bridges: bridgeList,
          links: []
        });
      }
    }

    return {
      title,
      url: pageUrl,
      quality: "1080p",
      streamingLinks: [],
      downloadLinks: [],
      episodes: isSeries ? episodes : void 0
    };
  }

  async resolveEpisodeStream(rawBridgeUrl, qualityHint = "1080p") {
    return ClientUtils.resolveDeepHubCloudChain(rawBridgeUrl, qualityHint);
  }

  /**
   * Fast, On-Demand Playable Stream Extraction for Media3 ExoPlayer
   * Extracts both 1080p and 4K high-GB streams, prioritizing 1080p as initial streamUrl
   */
  async getPlayableStream(pageUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1) {
    const html = await ClientUtils.httpGet(pageUrl);
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().replace(/&#038;/g, "&") : "Media Details";
    const isSeries = Boolean(isTVShow) || pageUrl.includes("-series-") || pageUrl.includes("-all-episodes");

    const { episodeMap, movieBridges, watchBridges, defaultPageSeason } = parseMediaBridges(html, title);
    const targetSeason = parseInt(seasonNumber || defaultPageSeason || 1, 10);
    const targetEp = parseInt(episodeNumber || 1, 10);

    const qualities = {};
    const qualitySizes = {};
    const defaultHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*"
    };

    if (isSeries) {
      const exactBridges = episodeMap.get(`${targetSeason}-${targetEp}`) ||
                           Array.from(episodeMap.entries()).find(([k]) => k.endsWith(`-${targetEp}`))?.[1] ||
                           Array.from(episodeMap.values())[0] ||
                           movieBridges;

      if (exactBridges && exactBridges.length > 0) {
        const is4K = (b) => {
          const q = (b.quality || '').toLowerCase();
          if (q === '4k' || q === '2160p' || q === 'uhd') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(2160p?|4k\s*uhd|4k\s*hdr|\b4k\b|uhd)\b/i.test(cleanText) ||
                 /\b(2160p?|\b4k\b|uhd)\b/i.test(cleanUrl);
        };
        const is1080p = (b) => {
          if (is4K(b)) return false;
          const q = (b.quality || '').toLowerCase();
          if (q === '1080p' || q === 'fhd') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(1080p?|fhd)\b/i.test(cleanText) ||
                 /\b(1080p?|fhd)\b/i.test(cleanUrl);
        };
        const is720p = (b) => {
          if (is4K(b) || is1080p(b)) return false;
          const q = (b.quality || '').toLowerCase();
          if (q === '720p') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanText) ||
                 /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanUrl);
        };
        const is480p = (b) => {
          if (is4K(b) || is1080p(b) || is720p(b)) return false;
          const q = (b.quality || '').toLowerCase();
          if (q === '480p' || q === '480' || q === 'sd') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(480p?|480|sd)\b/i.test(cleanText) ||
                 /\b(480p?|480|sd)\b/i.test(cleanUrl);
        };

        // Strict Server 1 & Server 2 rule: If both WEB-DL and WEBRip are available, consider ONLY WEB-DL
        const filterWebDl = (bList) => {
          const isDl = (b) => /\bweb[-._]?dl\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
          const isRip = (b) => /\b(?:web[-._]?rip|webrip)\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
          if (bList.some(isDl) && bList.some(isRip)) {
            return bList.filter(b => !isRip(b));
          }
          return bList;
        };

        const activeBridges = filterWebDl(exactBridges);
        const fourK = filterWebDl(activeBridges.filter(is4K).sort((a, b) => b.sizeMB - a.sizeMB));
        const tenEighty = filterWebDl(activeBridges.filter(is1080p).sort((a, b) => b.sizeMB - a.sizeMB));
        const sevenTwenty = filterWebDl(activeBridges.filter(is720p).sort((a, b) => b.sizeMB - a.sizeMB));
        const fourEighty = filterWebDl(activeBridges.filter(is480p).sort((a, b) => b.sizeMB - a.sizeMB));

        const resolvePromises = [];
        const liveCandidates = [];

        // Concurrently resolve all 4 qualities (1080p, 4K, 720p, 480p)
        if (tenEighty.length > 0) {
          resolvePromises.push(
            (async () => {
              for (const b of tenEighty.slice(0, 2)) {
                try {
                  const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "1080p");
                  const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "1080p");
                  if (live && live.url) {
                    qualities[live.q] = live.url;
                    if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                    liveCandidates.push({
                      q: live.q,
                      url: live.url,
                      server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                      priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                      supports206: live.item?.supports206 ?? true
                    });
                    if (live.q === '1080p') break;
                  }
                } catch (e) {}
              }
            })()
          );
        }

        if (fourK.length > 0) {
          resolvePromises.push(
            (async () => {
              for (const b of fourK.slice(0, 2)) {
                try {
                  const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "4k");
                  const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "4k");
                  if (live && live.url) {
                    qualities[live.q] = live.url;
                    if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                    liveCandidates.push({
                      q: live.q,
                      url: live.url,
                      server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                      priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                      supports206: live.item?.supports206 ?? true
                    });
                    if (live.q === '4k') break;
                  }
                } catch (e) {}
              }
            })()
          );
        }

        if (sevenTwenty.length > 0) {
          resolvePromises.push(
            (async () => {
              for (const b of sevenTwenty.slice(0, 2)) {
                try {
                  const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "720p");
                  const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "720p");
                  if (live && live.url) {
                    qualities[live.q] = live.url;
                    if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                    liveCandidates.push({
                      q: live.q,
                      url: live.url,
                      server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                      priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                      supports206: live.item?.supports206 ?? true
                    });
                    if (live.q === '720p') break;
                  }
                } catch (e) {}
              }
            })()
          );
        }

// 480p eliminated per user requirement

        await Promise.allSettled(resolvePromises);

        if (liveCandidates.length === 0) {
          for (const b of exactBridges.slice(0, 4)) {
            try {
              const res = await ClientUtils.resolveDeepHubCloudChain(b.url, b.quality || "1080p");
              const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, b.quality || "1080p");
              if (live && live.url) {
                qualities[live.q] = live.url;
                if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                liveCandidates.push({
                  q: live.q,
                  url: live.url,
                  server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                  priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                  supports206: live.item?.supports206 ?? true
                });
                break;
              }
            } catch (e) {}
          }
        }

        // Check Watch Online bridges if all candidates are Google CDN (no HTTP 206) or to offer alternative
        const hasNonGoogle = liveCandidates.some(c => (c.priority || 50) < 90);
        if (!hasNonGoogle && watchBridges && watchBridges.length > 0) {
          for (const wb of watchBridges) {
            try {
              if (wb.url.includes('hdstream4u') || wb.url.includes('hubstream') || wb.url.includes('m4uplay')) {
                const hlsStreams = await ClientUtils.resolveHDStream4u(wb.url, '1080p');
                if (hlsStreams && hlsStreams.length > 0) {
                  const hls = hlsStreams[0];
                  qualities['1080p'] = qualities['1080p'] || hls.url;
                  liveCandidates.push({
                    q: '1080p',
                    url: hls.url,
                    server: 'Watch Online (High-Speed Stream)',
                    priority: 4,
                    supports206: true
                  });
                  break;
                }
              }
            } catch (e) {}
          }
        }

        // Fallback default sizes for any qualities lacking size
        for (const [qKey] of Object.entries(qualities)) {
          if (!qualitySizes[qKey]) qualitySizes[qKey] = defaultSizeForQuality(qKey);
        }

        // Strictly prioritize: FSL (1) -> FSLv2 (2) -> Pixeldrain (3) -> Watch Online (4) -> Workers (5) -> Google CDN 10Gbps (99)
        const bestCandidate = ClientUtils.selectBestStreamCandidate(liveCandidates);
        if (bestCandidate) {
          // Strictly play 1080p as default if available among live candidates
          const best1080 = liveCandidates.find(c => (c.q === '1080p' || c.quality === '1080p') && c.supports206 !== false);
          const rawPrimary = (qualities['1080p'] && best1080) ? qualities['1080p'] : bestCandidate.url;
          const primaryUrl = ClientUtils.sanitizeStreamUrl(rawPrimary);
          const chosenQuality = (primaryUrl === ClientUtils.sanitizeStreamUrl(qualities['1080p'])) ? '1080p' : (bestCandidate.q === '4k' ? '4K' : (bestCandidate.q === '1080p' ? '1080p' : (bestCandidate.q === '720p' ? '720p' : (bestCandidate.q === '480p' ? '480p' : '1080p'))));
          const sanitizedQualities = {};
          for (const [k, v] of Object.entries(qualities)) {
            sanitizedQualities[k] = ClientUtils.sanitizeStreamUrl(v);
          }
          return {
            title: `${title} - Season ${targetSeason} Episode ${targetEp}`,
            seasonNumber: targetSeason,
            episodeNumber: targetEp,
            streamUrl: primaryUrl,
            qualities: sanitizedQualities,
            qualitySizes,
            headers: defaultHeaders,
            mimeType: ClientUtils.detectMimeType(primaryUrl),
            quality: chosenQuality,
            server: bestCandidate.server || getHubServerLabel(primaryUrl, chosenQuality, 'Server 1 (HDHub4u)'),
            supports206: bestCandidate.supports206 ?? true
          };
        }
      }
    }

    // Movie stream resolution
    const rawMovieBridges = movieBridges.length > 0 ? movieBridges : Array.from(episodeMap.values()).flat();
    if (rawMovieBridges.length > 0) {
      // Strict Server 1 & Server 2 rule: If both WEB-DL and WEBRip are available, consider ONLY WEB-DL
      const filterWebDl = (bList) => {
        const isDl = (b) => /\bweb[-._]?dl\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
        const isRip = (b) => /\b(?:web[-._]?rip|webrip)\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
        if (bList.some(isDl) && bList.some(isRip)) {
          return bList.filter(b => !isRip(b));
        }
        return bList;
      };

      const targetMovieBridges = filterWebDl(rawMovieBridges);

      const is4K = (b) => {
        const q = (b.quality || '').toLowerCase();
        if (q === '4k' || q === '2160p' || q === 'uhd') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(2160p?|4k\s*uhd|4k\s*hdr|\b4k\b|uhd)\b/i.test(cleanText) ||
               /\b(2160p?|\b4k\b|uhd)\b/i.test(cleanUrl);
      };
      const is1080p = (b) => {
        if (is4K(b)) return false;
        const q = (b.quality || '').toLowerCase();
        if (q === '1080p' || q === 'fhd') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(1080p?|fhd)\b/i.test(cleanText) ||
               /\b(1080p?|fhd)\b/i.test(cleanUrl);
      };
      const is720p = (b) => {
        if (is4K(b) || is1080p(b)) return false;
        const q = (b.quality || '').toLowerCase();
        if (q === '720p') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanText) ||
               /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanUrl);
      };
      const is480p = (b) => {
        if (is4K(b) || is1080p(b) || is720p(b)) return false;
        const q = (b.quality || '').toLowerCase();
        if (q === '480p' || q === '480' || q === 'sd') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(480p?|480|sd)\b/i.test(cleanText) ||
               /\b(480p?|480|sd)\b/i.test(cleanUrl);
      };

      const rankScore = (b) => {
        let score = (b.sizeMB || 0);
        const label = ((b.label || '') + ' ' + (b.url || '')).toLowerCase();
        if (label.includes('multi') || label.includes('dual')) score += 100000;
        if (label.includes('web-dl') || label.includes('bluray') || label.includes('remux') || label.includes('ds4k')) score += 50000;
        if (label.includes('ddp') || label.includes('atmos') || label.includes('5.1') || label.includes('7.1')) score += 30000;
        return score;
      };

      const fourK = filterWebDl(targetMovieBridges.filter(is4K).sort((a, b) => rankScore(b) - rankScore(a)));
      const tenEighty = filterWebDl(targetMovieBridges.filter(is1080p).sort((a, b) => rankScore(b) - rankScore(a)));
      const sevenTwenty = filterWebDl(targetMovieBridges.filter(is720p).sort((a, b) => rankScore(b) - rankScore(a)));
      const fourEighty = filterWebDl(targetMovieBridges.filter(is480p).sort((a, b) => rankScore(b) - rankScore(a)));

      const resolvePromises = [];
      const liveCandidates = [];

      // Concurrently resolve all 4 qualities (1080p, 4K, 720p, 480p)
      if (tenEighty.length > 0) {
        resolvePromises.push(
          (async () => {
            const topBridges = tenEighty.slice(0, 3);
            for (const b of topBridges) {
              try {
                const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "1080p");
                const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "1080p");
                if (live && live.url) {
                  qualities[live.q] = live.url;
                  if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                  liveCandidates.push({
                    q: live.q,
                    url: live.url,
                    server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                    priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                    supports206: live.item?.supports206 ?? true
                  });
                  if (live.q === '1080p') break;
                }
              } catch (e) {}
            }
          })()
        );
      }

      const fourKCandidates = fourK.length > 0 ? fourK : targetMovieBridges;
      resolvePromises.push(
        (async () => {
          const topBridges = fourKCandidates.slice(0, 3);
          for (const b of topBridges) {
            try {
              const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "4k");
              const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "4k");
              if (live && live.url) {
                qualities[live.q] = live.url;
                if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                liveCandidates.push({
                  q: live.q,
                  url: live.url,
                  server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                  priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                  supports206: live.item?.supports206 ?? true
                });
                if (live.q === '4k') break;
              }
            } catch (e) {}
          }
        })()
      );

      if (sevenTwenty.length > 0) {
        resolvePromises.push(
          (async () => {
            const topBridges = sevenTwenty.slice(0, 3);
            for (const b of topBridges) {
              try {
                const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "720p");
                const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "720p");
                if (live && live.url) {
                  qualities[live.q] = live.url;
                  if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                  liveCandidates.push({
                    q: live.q,
                    url: live.url,
                    server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                    priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                    supports206: live.item?.supports206 ?? true
                  });
                  if (live.q === '720p') break;
                }
              } catch (e) {}
            }
          })()
        );
      }

      // 480p eliminated per user requirement

      await Promise.allSettled(resolvePromises);

      if (liveCandidates.length === 0) {
        for (const b of targetMovieBridges.slice(0, 10)) {
          try {
            const res = await ClientUtils.resolveDeepHubCloudChain(b.url, b.quality || "1080p");
            const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, b.quality || "1080p");
            if (live && live.url) {
              qualities[live.q] = live.url;
              if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
              liveCandidates.push({
                q: live.q,
                url: live.url,
                server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 1 (HDHub4u)'),
                priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                supports206: live.item?.supports206 ?? true
              });
              break;
            }
          } catch (e) {}
        }
      }

      // Check Watch Online bridges if all candidates are Google CDN (no HTTP 206) or to offer alternative
      const hasNonGoogle = liveCandidates.some(c => (c.priority || 50) < 90);
      if (!hasNonGoogle && watchBridges && watchBridges.length > 0) {
        for (const wb of watchBridges) {
          try {
            if (wb.url.includes('hdstream4u') || wb.url.includes('hubstream') || wb.url.includes('m4uplay')) {
              const hlsStreams = await ClientUtils.resolveHDStream4u(wb.url, '1080p');
              if (hlsStreams && hlsStreams.length > 0) {
                const hls = hlsStreams[0];
                qualities['1080p'] = qualities['1080p'] || hls.url;
                liveCandidates.push({
                  q: '1080p',
                  url: hls.url,
                  server: 'Watch Online (High-Speed Stream)',
                  priority: 4,
                  supports206: true
                });
                break;
              }
            }
          } catch (e) {}
        }
      }

      // Fallback default sizes for any qualities lacking size
      for (const [qKey] of Object.entries(qualities)) {
        if (!qualitySizes[qKey]) qualitySizes[qKey] = defaultSizeForQuality(qKey);
      }

      // Strictly prioritize: FSL (1) -> FSLv2 (2) -> Pixeldrain (3) -> Watch Online (4) -> Workers (5) -> Google CDN 10Gbps (99)
      const bestCandidate = ClientUtils.selectBestStreamCandidate(liveCandidates);
      if (bestCandidate) {
        // Strictly play 1080p as default if available among live candidates
        const best1080 = liveCandidates.find(c => (c.q === '1080p' || c.quality === '1080p') && c.supports206 !== false);
        const rawPrimary = (qualities['1080p'] && best1080) ? qualities['1080p'] : bestCandidate.url;
        const primaryUrl = ClientUtils.sanitizeStreamUrl(rawPrimary);
        const chosenQuality = (primaryUrl === ClientUtils.sanitizeStreamUrl(qualities['1080p'])) ? '1080p' : (bestCandidate.q === '4k' ? '4K' : (bestCandidate.q === '1080p' ? '1080p' : (bestCandidate.q === '720p' ? '720p' : (bestCandidate.q === '480p' ? '480p' : '1080p'))));
        const sanitizedQualities = {};
        for (const [k, v] of Object.entries(qualities)) {
          sanitizedQualities[k] = ClientUtils.sanitizeStreamUrl(v);
        }
        return {
          title,
          streamUrl: primaryUrl,
          qualities: sanitizedQualities,
          qualitySizes,
          headers: defaultHeaders,
          mimeType: ClientUtils.detectMimeType(primaryUrl),
          quality: chosenQuality,
          server: bestCandidate.server || getHubServerLabel(primaryUrl, chosenQuality, 'Server 1 (HDHub4u)'),
          supports206: bestCandidate.supports206 ?? true
        };
      }
    }

    return null;
  }
};

var FourKHDHubClient = class {
  constructor() {
    this.baseUrl = "https://4khdhub.one";
    this.mirrors = [
      "https://4khdhub.one",
      "https://4khdhub.dad"
    ];
  }

  setBaseUrl(url) {
    if (url && typeof url === 'string') {
      this.baseUrl = url.replace(/\/+$/, '');
      if (!this.mirrors.includes(this.baseUrl)) {
        this.mirrors.unshift(this.baseUrl);
      }
    }
  }

  setMirrors(mirrors) {
    if (Array.isArray(mirrors) && mirrors.length > 0) {
      this.mirrors = mirrors.map(m => m.replace(/\/+$/, ''));
      if (this.mirrors.length > 0) {
        this.baseUrl = this.mirrors[0];
      }
    }
  }

  applyRemoteConfig(config = {}) {
    if (config.baseUrl) this.setBaseUrl(config.baseUrl);
    if (Array.isArray(config.mirrors)) this.setMirrors(config.mirrors);
  }

  async search(query) {
    const results = [];
    const cleanQuery = query.replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryPlus = cleanQuery.replace(/\s+/g, '+');
    const baseTitle = cleanQuery.replace(/\b(19\d{2}|20\d{2})\b/g, '').trim();
    const queries = [cleanQuery];
    if (queryPlus !== cleanQuery) queries.push(queryPlus);
    if (baseTitle && baseTitle !== cleanQuery) queries.push(baseTitle);

    const noEra = cleanQuery.replace(/\b(?:ad|ce|bc|bce)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (noEra && noEra !== cleanQuery && !queries.includes(noEra)) queries.push(noEra);

    const firstWord = cleanQuery.split(' ')[0];
    if (firstWord && firstWord.length >= 4 && !queries.includes(firstWord) && !['the', 'this', 'that', 'with'].includes(firstWord.toLowerCase())) {
      queries.push(firstWord);
    }

    for (const mirror of this.mirrors) {
      for (const q of queries) {
        try {
          const sUrl = `${mirror}/?s=${encodeURIComponent(q)}`;
          const html = await ClientUtils.httpGet(sUrl, mirror, 3500);
          if (!html || html.includes("502 Bad Gateway") || html.includes("<title>Just a moment...</title>") || html.length < 500) continue;

          const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:-movie-|-series-)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let m;
          while ((m = linkRegex.exec(html)) !== null) {
            const href = m[1];
            const innerHtml = m[2];
            
            const titleMatch = innerHtml.match(/<h3[^>]*class=["'][^"']*movie-card-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i) 
                            || innerHtml.match(/alt=["']([^"']+)["']/i);
            const yearMatch = innerHtml.match(/<p[^>]*class=["'][^"']*movie-card-meta[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
            const imgMatch = innerHtml.match(/src=["'](https?:\/\/[^"']+)["']/i);

            let cleanT = titleMatch 
              ? titleMatch[1].replace(/<[^>]+>/g, "").trim() 
              : innerHtml.replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");
            
            const yearText = yearMatch ? yearMatch[1].replace(/<[^>]+>/g, "").trim() : "";
            const isSeries = href.includes("-series-") || yearText.includes("S0") || yearText.includes("S1") || yearText.includes("Season");

            const fullUrl = href.startsWith("http") ? href : `${mirror}${href}`;
            if (!results.some((r) => r.url === fullUrl)) {
              results.push({
                title: cleanT,
                cleanTitle: cleanTitleKeywords(cleanT),
                url: fullUrl,
                thumbnail: imgMatch ? imgMatch[1] : void 0,
                year: yearText,
                type: isSeries ? "series" : "movie",
                mediaType: isSeries ? "tv" : "movie",
                provider: "4khdhub"
              });
            }
          }
          if (results.length > 0) return results;
        } catch (e) {
          // mirror failed, try next
        }
      }
    }
    return results;
  }

  async extractDetails(pageUrl, targetSeason = 1) {
    const html = await ClientUtils.httpGet(pageUrl);
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().replace(/&#038;/g, "&") : "Media Details";
    const isSeries = pageUrl.includes("-series-") || title.toLowerCase().includes("season") || title.toLowerCase().includes("series");

    const { episodeMap, movieBridges, watchBridges, defaultPageSeason } = parseMediaBridges(html, title);
    const effectiveSeason = targetSeason || defaultPageSeason || 1;

    const episodes = [];
    if (isSeries && episodeMap.size > 0) {
      const allKeys = Array.from(episodeMap.keys());
      const seasonKeys = allKeys.filter(k => k.startsWith(`${effectiveSeason}-`));
      const targetKeys = seasonKeys.length > 0 ? seasonKeys : allKeys;

      const sortedKeys = targetKeys.sort((a, b) => {
        const epA = parseInt(a.split('-')[1], 10) || 0;
        const epB = parseInt(b.split('-')[1], 10) || 0;
        return epA - epB;
      });

      for (const key of sortedKeys) {
        const [sNum, eNum] = key.split('-').map(n => parseInt(n, 10));
        const bridgeList = episodeMap.get(key) || [];
        episodes.push({
          seasonNumber: sNum,
          episodeNumber: eNum,
          title: `Episode ${eNum}`,
          bridges: bridgeList,
          links: []
        });
      }
    }

    return {
      title,
      url: pageUrl,
      quality: "1080p",
      streamingLinks: [],
      downloadLinks: [],
      episodes: isSeries ? episodes : void 0
    };
  }

  async resolveEpisodeStream(rawBridgeUrl, qualityHint = "1080p") {
    return ClientUtils.resolveDeepHubCloudChain(rawBridgeUrl, qualityHint);
  }

  /**
   * Fast, On-Demand Playable Stream Extraction for Media3 ExoPlayer
   * Extracts both 1080p and 4K high-GB streams, prioritizing 1080p as initial streamUrl
   */
  async getPlayableStream(pageUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1) {
    const html = await ClientUtils.httpGet(pageUrl);
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().replace(/&#038;/g, "&") : "Media Details";
    const isSeries = Boolean(isTVShow) || pageUrl.includes("-series-") || pageUrl.includes("-all-episodes");

    const { episodeMap, movieBridges, watchBridges, defaultPageSeason } = parseMediaBridges(html, title);
    const targetSeason = parseInt(seasonNumber || defaultPageSeason || 1, 10);
    const targetEp = parseInt(episodeNumber || 1, 10);
    const qualities = {};
    const qualitySizes = {};
    const defaultHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*"
    };

    if (isSeries) {
      const exactBridges = episodeMap.get(`${targetSeason}-${targetEp}`) ||
                           Array.from(episodeMap.entries()).find(([k]) => k.endsWith(`-${targetEp}`))?.[1] ||
                           Array.from(episodeMap.values())[0] ||
                           movieBridges;

      if (exactBridges && exactBridges.length > 0) {
        const is4K = (b) => {
          const q = (b.quality || '').toLowerCase();
          if (q === '4k' || q === '2160p' || q === 'uhd') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(2160p?|4k\s*uhd|4k\s*hdr|\b4k\b|uhd)\b/i.test(cleanText) ||
                 /\b(2160p?|\b4k\b|uhd)\b/i.test(cleanUrl);
        };
        const is1080p = (b) => {
          if (is4K(b)) return false;
          const q = (b.quality || '').toLowerCase();
          if (q === '1080p' || q === 'fhd') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(1080p?|fhd)\b/i.test(cleanText) ||
                 /\b(1080p?|fhd)\b/i.test(cleanUrl);
        };
        const is720p = (b) => {
          if (is4K(b) || is1080p(b)) return false;
          const q = (b.quality || '').toLowerCase();
          if (q === '720p') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanText) ||
                 /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanUrl);
        };
        const is480p = (b) => {
          if (is4K(b) || is1080p(b) || is720p(b)) return false;
          const q = (b.quality || '').toLowerCase();
          if (q === '480p' || q === '480' || q === 'sd') return true;
          const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
          return /\b(480p?|480|sd)\b/i.test(cleanText) ||
                 /\b(480p?|480|sd)\b/i.test(cleanUrl);
        };

        // Strict Server 1 & Server 2 rule: If both WEB-DL and WEBRip are available, consider ONLY WEB-DL
        const filterWebDl = (bList) => {
          const isDl = (b) => /\bweb[-._]?dl\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
          const isRip = (b) => /\b(?:web[-._]?rip|webrip)\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
          if (bList.some(isDl) && bList.some(isRip)) {
            return bList.filter(b => !isRip(b));
          }
          return bList;
        };

        const activeBridges = filterWebDl(exactBridges);
        const fourK = filterWebDl(activeBridges.filter(is4K).sort((a, b) => b.sizeMB - a.sizeMB));
        const tenEighty = filterWebDl(activeBridges.filter(is1080p).sort((a, b) => b.sizeMB - a.sizeMB));
        const sevenTwenty = filterWebDl(activeBridges.filter(is720p).sort((a, b) => b.sizeMB - a.sizeMB));
        const fourEighty = filterWebDl(activeBridges.filter(is480p).sort((a, b) => b.sizeMB - a.sizeMB));

        const resolvePromises = [];
        const liveCandidates = [];

        // Concurrently resolve all 4 qualities (1080p, 4K, 720p, 480p)
        if (tenEighty.length > 0) {
          resolvePromises.push(
            (async () => {
              for (const b of tenEighty.slice(0, 2)) {
                try {
                  const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "1080p");
                  const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "1080p");
                  if (live && live.url) {
                    qualities[live.q] = live.url;
                    if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                    liveCandidates.push({
                      q: live.q,
                      url: live.url,
                      server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                      priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                      supports206: live.item?.supports206 ?? true
                    });
                    if (live.q === '1080p') break;
                  }
                } catch (e) {}
              }
            })()
          );
        }

        if (fourK.length > 0) {
          resolvePromises.push(
            (async () => {
              for (const b of fourK.slice(0, 2)) {
                try {
                  const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "4k");
                  const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "4k");
                  if (live && live.url) {
                    qualities[live.q] = live.url;
                    if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                    liveCandidates.push({
                      q: live.q,
                      url: live.url,
                      server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                      priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                      supports206: live.item?.supports206 ?? true
                    });
                    if (live.q === '4k') break;
                  }
                } catch (e) {}
              }
            })()
          );
        }

        if (sevenTwenty.length > 0) {
          resolvePromises.push(
            (async () => {
              for (const b of sevenTwenty.slice(0, 2)) {
                try {
                  const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "720p");
                  const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "720p");
                  if (live && live.url) {
                    qualities[live.q] = live.url;
                    if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                    liveCandidates.push({
                      q: live.q,
                      url: live.url,
                      server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                      priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                      supports206: live.item?.supports206 ?? true
                    });
                    if (live.q === '720p') break;
                  }
                } catch (e) {}
              }
            })()
          );
        }

// 480p eliminated per user requirement

        await Promise.allSettled(resolvePromises);

        if (liveCandidates.length === 0) {
          for (const b of exactBridges.slice(0, 10)) {
            try {
              const res = await ClientUtils.resolveDeepHubCloudChain(b.url, b.quality || "1080p");
              const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, b.quality || "1080p");
              if (live && live.url) {
                qualities[live.q] = live.url;
                if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                liveCandidates.push({
                  q: live.q,
                  url: live.url,
                  server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                  priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                  supports206: live.item?.supports206 ?? true
                });
                break;
              }
            } catch (e) {}
          }
        }

        // Check Watch Online bridges if all candidates are Google CDN (no HTTP 206) or to offer alternative
        const hasNonGoogle = liveCandidates.some(c => (c.priority || 50) < 90);
        if (!hasNonGoogle && watchBridges && watchBridges.length > 0) {
          for (const wb of watchBridges) {
            try {
              if (wb.url.includes('hdstream4u') || wb.url.includes('hubstream') || wb.url.includes('m4uplay')) {
                const hlsStreams = await ClientUtils.resolveHDStream4u(wb.url, '1080p');
                if (hlsStreams && hlsStreams.length > 0) {
                  const hls = hlsStreams[0];
                  qualities['1080p'] = qualities['1080p'] || hls.url;
                  liveCandidates.push({
                    q: '1080p',
                    url: hls.url,
                    server: 'Watch Online (High-Speed Stream)',
                    priority: 4,
                    supports206: true
                  });
                  break;
                }
              }
            } catch (e) {}
          }
        }

        // Fallback default sizes for any qualities lacking size
        for (const [qKey] of Object.entries(qualities)) {
          if (!qualitySizes[qKey]) qualitySizes[qKey] = defaultSizeForQuality(qKey);
        }

        // Strictly prioritize: FSL (1) -> FSLv2 (2) -> Pixeldrain (3) -> Watch Online (4) -> Workers (5) -> Google CDN 10Gbps (99)
        const bestCandidate = ClientUtils.selectBestStreamCandidate(liveCandidates);
        if (bestCandidate) {
          // Strictly play 1080p as default if available among live candidates
          const best1080 = liveCandidates.find(c => (c.q === '1080p' || c.quality === '1080p') && c.supports206 !== false);
          const rawPrimary = (qualities['1080p'] && best1080) ? qualities['1080p'] : bestCandidate.url;
          const primaryUrl = ClientUtils.sanitizeStreamUrl(rawPrimary);
          const chosenQuality = (primaryUrl === ClientUtils.sanitizeStreamUrl(qualities['1080p'])) ? '1080p' : (bestCandidate.q === '4k' ? '4K' : (bestCandidate.q === '1080p' ? '1080p' : (bestCandidate.q === '720p' ? '720p' : (bestCandidate.q === '480p' ? '480p' : '1080p'))));
          const sanitizedQualities = {};
          for (const [k, v] of Object.entries(qualities)) {
            sanitizedQualities[k] = ClientUtils.sanitizeStreamUrl(v);
          }
          return {
            title: `${title} - Season ${targetSeason} Episode ${targetEp}`,
            seasonNumber: targetSeason,
            episodeNumber: targetEp,
            streamUrl: primaryUrl,
            qualities: sanitizedQualities,
            qualitySizes,
            headers: defaultHeaders,
            mimeType: ClientUtils.detectMimeType(primaryUrl),
            quality: chosenQuality,
            server: bestCandidate.server || getHubServerLabel(primaryUrl, chosenQuality, 'Server 2 (4KHDHub)'),
            supports206: bestCandidate.supports206 ?? true
          };
        }
      }
    }

    // Movie stream resolution
    const rawMovieBridges = movieBridges.length > 0 ? movieBridges : Array.from(episodeMap.values()).flat();
    if (rawMovieBridges.length > 0) {
      // Strict Server 1 & Server 2 rule: If both WEB-DL and WEBRip are available, consider ONLY WEB-DL
      const filterWebDl = (bList) => {
        const isDl = (b) => /\bweb[-._]?dl\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
        const isRip = (b) => /\b(?:web[-._]?rip|webrip)\b/i.test(((b.label || '') + ' ' + (b.url || '')).toLowerCase());
        if (bList.some(isDl) && bList.some(isRip)) {
          return bList.filter(b => !isRip(b));
        }
        return bList;
      };

      const targetMovieBridges = filterWebDl(rawMovieBridges);

      const is4K = (b) => {
        const q = (b.quality || '').toLowerCase();
        if (q === '4k' || q === '2160p' || q === 'uhd') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(2160p?|4k\s*uhd|4k\s*hdr|\b4k\b|uhd)\b/i.test(cleanText) ||
               /\b(2160p?|\b4k\b|uhd)\b/i.test(cleanUrl);
      };
      const is1080p = (b) => {
        if (is4K(b)) return false;
        const q = (b.quality || '').toLowerCase();
        if (q === '1080p' || q === 'fhd') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(1080p?|fhd)\b/i.test(cleanText) ||
               /\b(1080p?|fhd)\b/i.test(cleanUrl);
      };
      const is720p = (b) => {
        if (is4K(b) || is1080p(b)) return false;
        const q = (b.quality || '').toLowerCase();
        if (q === '720p') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanText) ||
               /\b(720p?|720)\b|\bhd\b(?!\s*hub|\s*stream|\s*r)/i.test(cleanUrl);
      };
      const is480p = (b) => {
        if (is4K(b) || is1080p(b) || is720p(b)) return false;
        const q = (b.quality || '').toLowerCase();
        if (q === '480p' || q === '480' || q === 'sd') return true;
        const cleanText = (b.label || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        const cleanUrl = (b.url || '').replace(/4khdhub\.[a-z0-9]+/gi, '').replace(/hdhub4u\.[a-z0-9]+/gi, '').replace(/4khdhub|hdhub4u/gi, '');
        return /\b(480p?|480|sd)\b/i.test(cleanText) ||
               /\b(480p?|480|sd)\b/i.test(cleanUrl);
      };

      const rankScore = (b) => {
        let score = (b.sizeMB || 0);
        const label = ((b.label || '') + ' ' + (b.url || '')).toLowerCase();
        if (label.includes('multi') || label.includes('dual')) score += 100000;
        if (label.includes('web-dl') || label.includes('bluray') || label.includes('remux') || label.includes('ds4k')) score += 50000;
        if (label.includes('ddp') || label.includes('atmos') || label.includes('5.1') || label.includes('7.1')) score += 30000;
        return score;
      };

      const fourK = filterWebDl(targetMovieBridges.filter(is4K).sort((a, b) => rankScore(b) - rankScore(a)));
      const tenEighty = filterWebDl(targetMovieBridges.filter(is1080p).sort((a, b) => rankScore(b) - rankScore(a)));
      const sevenTwenty = filterWebDl(targetMovieBridges.filter(is720p).sort((a, b) => rankScore(b) - rankScore(a)));
      const fourEighty = filterWebDl(targetMovieBridges.filter(is480p).sort((a, b) => rankScore(b) - rankScore(a)));

      const resolvePromises = [];
      const liveCandidates = [];

      // Concurrently resolve all 4 qualities (1080p, 4K, 720p, 480p)
      if (tenEighty.length > 0) {
        resolvePromises.push(
          (async () => {
            const topBridges = tenEighty.slice(0, 3);
            for (const b of topBridges) {
              try {
                const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "1080p");
                const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "1080p");
                if (live && live.url) {
                  qualities[live.q] = live.url;
                  if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                  liveCandidates.push({
                    q: live.q,
                    url: live.url,
                    server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                    priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                    supports206: live.item?.supports206 ?? true
                  });
                  if (live.q === '1080p') break;
                }
              } catch (e) {}
            }
          })()
        );
      }

      const fourKCandidates = fourK.length > 0 ? fourK : targetMovieBridges;
      resolvePromises.push(
        (async () => {
          const topBridges = fourKCandidates.slice(0, 3);
          for (const b of topBridges) {
            try {
              const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "4k");
              const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "4k");
              if (live && live.url) {
                qualities[live.q] = live.url;
                if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                liveCandidates.push({
                  q: live.q,
                  url: live.url,
                  server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                  priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                  supports206: live.item?.supports206 ?? true
                });
                if (live.q === '4k') break;
              }
            } catch (e) {}
          }
        })()
      );

      if (sevenTwenty.length > 0) {
        resolvePromises.push(
          (async () => {
            const topBridges = sevenTwenty.slice(0, 3);
            for (const b of topBridges) {
              try {
                const res = await ClientUtils.resolveDeepHubCloudChain(b.url, "720p");
                const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, "720p");
                if (live && live.url) {
                  qualities[live.q] = live.url;
                  if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
                  liveCandidates.push({
                    q: live.q,
                    url: live.url,
                    server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                    priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                    supports206: live.item?.supports206 ?? true
                  });
                  if (live.q === '720p') break;
                }
              } catch (e) {}
            }
          })()
        );
      }

      // 480p eliminated per user requirement

      await Promise.allSettled(resolvePromises);

      if (liveCandidates.length === 0) {
        for (const b of targetMovieBridges.slice(0, 10)) {
          try {
            const res = await ClientUtils.resolveDeepHubCloudChain(b.url, b.quality || "1080p");
            const live = await ClientUtils.selectFirstLiveStream(res, defaultHeaders, b.quality || "1080p");
            if (live && live.url) {
              qualities[live.q] = live.url;
              if (b.sizeMB && !qualitySizes[live.q]) qualitySizes[live.q] = formatSizeMB(b.sizeMB);
              liveCandidates.push({
                q: live.q,
                url: live.url,
                server: live.item?.server || getHubServerLabel(live.url, live.q, 'Server 2 (4KHDHub)'),
                priority: live.item?.priority ?? ClientUtils.getStreamPriority(live.url, live.item?.server),
                supports206: live.item?.supports206 ?? true
              });
              break;
            }
          } catch (e) {}
        }
      }

      // Check Watch Online bridges if all candidates are Google CDN (no HTTP 206) or to offer alternative
      const hasNonGoogle = liveCandidates.some(c => (c.priority || 50) < 90);
      if (!hasNonGoogle && watchBridges && watchBridges.length > 0) {
        for (const wb of watchBridges) {
          try {
            if (wb.url.includes('hdstream4u') || wb.url.includes('hubstream') || wb.url.includes('m4uplay')) {
              const hlsStreams = await ClientUtils.resolveHDStream4u(wb.url, '1080p');
              if (hlsStreams && hlsStreams.length > 0) {
                const hls = hlsStreams[0];
                qualities['1080p'] = qualities['1080p'] || hls.url;
                liveCandidates.push({
                  q: '1080p',
                  url: hls.url,
                  server: 'Watch Online (High-Speed Stream)',
                  priority: 4,
                  supports206: true
                });
                break;
              }
            }
          } catch (e) {}
        }
      }

      // Fallback default sizes for any qualities lacking size
      for (const [qKey] of Object.entries(qualities)) {
        if (!qualitySizes[qKey]) qualitySizes[qKey] = defaultSizeForQuality(qKey);
      }

      // Strictly prioritize: FSL (1) -> FSLv2 (2) -> Pixeldrain (3) -> Watch Online (4) -> Workers (5) -> Google CDN 10Gbps (99)
      const bestCandidate = ClientUtils.selectBestStreamCandidate(liveCandidates);
      if (bestCandidate) {
        // Strictly play 1080p as default if available among live candidates
        const best1080 = liveCandidates.find(c => (c.q === '1080p' || c.quality === '1080p') && c.supports206 !== false);
        const rawPrimary = (qualities['1080p'] && best1080) ? qualities['1080p'] : bestCandidate.url;
        const primaryUrl = ClientUtils.sanitizeStreamUrl(rawPrimary);
        const chosenQuality = (primaryUrl === ClientUtils.sanitizeStreamUrl(qualities['1080p'])) ? '1080p' : (bestCandidate.q === '4k' ? '4K' : (bestCandidate.q === '1080p' ? '1080p' : (bestCandidate.q === '720p' ? '720p' : (bestCandidate.q === '480p' ? '480p' : '1080p'))));
        const sanitizedQualities = {};
        for (const [k, v] of Object.entries(qualities)) {
          sanitizedQualities[k] = ClientUtils.sanitizeStreamUrl(v);
        }
        return {
          title,
          streamUrl: primaryUrl,
          qualities: sanitizedQualities,
          qualitySizes,
          headers: defaultHeaders,
          mimeType: ClientUtils.detectMimeType(primaryUrl),
          quality: chosenQuality,
          server: bestCandidate.server || getHubServerLabel(primaryUrl, chosenQuality, 'Server 2 (4KHDHub)'),
          supports206: bestCandidate.supports206 ?? true
        };
      }
    }

    return null;
  }
};

var UniversalClientScraper = class {
  constructor() {
    this.hdhub4u = new HDHub4uClient();
    this.movies4u = Movies4u;
    this.fourkhdhub = new FourKHDHubClient();
  }

  async search(query, provider) {
    if (provider === "hdhub4u" || provider === "1") return this.hdhub4u.search(query);
    if (provider === "4khdhub" || provider === "2") return this.fourkhdhub.search(query);
    if (provider === "movies4u" || provider === "3") return this.movies4u.search(query);
    const [h, f] = await Promise.allSettled([this.hdhub4u.search(query), this.fourkhdhub.search(query)]);
    const res = [];
    if (h.status === "fulfilled") res.push(...h.value);
    if (f.status === "fulfilled") res.push(...f.value);
    return res;
  }

  async extractDetails(url, targetSeason = 1) {
    if (url.includes("movies4u.") || url.includes("movies4u.clinic")) {
      return this.movies4u.extractDetails(url, targetSeason);
    }
    if (url.includes("4khdhub.one")) {
      return this.fourkhdhub.extractDetails(url, targetSeason);
    }
    return this.hdhub4u.extractDetails(url, targetSeason);
  }

  async resolveLink(rawBridgeUrl, qualityHint = "1080p") {
    return ClientUtils.resolveDeepHubCloudChain(rawBridgeUrl, qualityHint);
  }

  async getPlayableStream(pageUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1) {
    if (pageUrl.includes("movies4u.") || pageUrl.includes("movies4u.clinic")) {
      return this.movies4u.getPlayableStream(pageUrl, isTVShow, episodeNumber, seasonNumber);
    }
    if (pageUrl.includes("4khdhub.one")) {
      return this.fourkhdhub.getPlayableStream(pageUrl, isTVShow, episodeNumber, seasonNumber);
    }
    return this.hdhub4u.getPlayableStream(pageUrl, isTVShow, episodeNumber, seasonNumber);
  }

  getMedia3Config(link) {
    return {
      uri: link.url,
      headers: link.headers || {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://gamerxyt.com/"
      },
      mimeType: link.mimeType || "video/mp4"
    };
  }

  applyRemoteConfig(config = {}) {
    if (config.providers) {
      if (config.providers.hdhub4u) this.hdhub4u.applyRemoteConfig(config.providers.hdhub4u);
      if (config.providers['4khdhub']) this.fourkhdhub.applyRemoteConfig(config.providers['4khdhub']);
      if (config.providers.movies4u && this.movies4u && typeof this.movies4u.applyRemoteConfig === 'function') {
        this.movies4u.applyRemoteConfig(config.providers.movies4u);
      }
    }
  }
};

var HDHub4u = new HDHub4uClient();
var FourKHDHub = new FourKHDHubClient();
var UniversalScraper = new UniversalClientScraper();

var globalObj = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {};
globalObj.HDHub4u = HDHub4u;
globalObj.FourKHDHub = FourKHDHub;
globalObj.UniversalScraper = UniversalScraper;
globalObj.Movies4u = Movies4u;
globalObj.TamilDhool = TamilDhool;
globalObj.TamilGun = TamilGun;
globalObj.getPlayableStream = (url, ep, s) => UniversalScraper.getPlayableStream(url, ep, s);
globalObj.calculateTitleMatchScore = calculateTitleMatchScore;
globalObj.findBestMatch = findBestMatch;

export const getStreamPriority = (url, s) => ClientUtils.getStreamPriority(url, s);
export const getQualityWeight = (q) => ClientUtils.getQualityWeight(q);
export const selectBestStreamCandidate = (c) => ClientUtils.selectBestStreamCandidate(c);

export {
  Movies4u,
  Movies4uClient,
  TamilDhool,
  TamilDhoolClient,
  TamilGun,
  TamilGunClient,
  ClientUtils,
  FourKHDHub,
  FourKHDHubClient,
  HDHub4u,
  HDHub4uClient,
  UniversalClientScraper,
  UniversalScraper,
  calculateTitleMatchScore,
  findBestMatch,
  normalizeString,
  cleanTitleKeywords,
  parseMediaBridges,
  getStreamPriority as getPriority,
  selectBestStreamCandidate as selectBestCandidate
};
