/**
 * Movies4u Provider & Stream Extractor for Stitch-Nexplay (Server 3)
 * Bundled for React Native & Android Media3 ExoPlayer
 */

/**
 * Dean Edwards Packer (P.A.C.K.E.R.) Unpacker
 * Safely unpacks obfuscated JavaScript strings without calling eval()
 */
function toBase(num, radix) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let res = '';
    while (num > 0) {
        res = chars[num % radix] + res;
        num = Math.floor(num / radix);
    }
    return res || '0';
}
export function unpack(packedCode) {
    if (!packedCode || typeof packedCode !== 'string')
        return null;
    // Search for the packer signature pattern
    // Matches: eval(function(p,a,c,k,e,d)...}('payload', radix, count, 'keywords'.split('|')))
    const match = packedCode.match(/}\s*\('(.*)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/s);
    if (!match) {
        // Alternate format: function(p,a,c,k,e,r)...
        const altMatch = packedCode.match(/return\s+p}\s*\('(.*)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/s);
        if (!altMatch)
            return null;
        return decodePacker(altMatch[1], parseInt(altMatch[2], 10), parseInt(altMatch[3], 10), altMatch[4].split('|'));
    }
    const [, payload, radixStr, countStr, dictStr] = match;
    return decodePacker(payload, parseInt(radixStr, 10), parseInt(countStr, 10), dictStr.split('|'));
}
function decodePacker(payload, radix, count, dict) {
    let unescaped = payload
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    let c = count;
    while (c--) {
        const key = toBase(c, radix);
        const val = dict[c] !== undefined && dict[c] !== '' ? dict[c] : key;
        unescaped = unescaped.replace(new RegExp('\\b' + key + '\\b', 'g'), val);
    }
    return unescaped;
}
/**
 * Extracts all stream candidate URLs (e.g. .m3u8, .mp4, .mkv) from unpacked code
 */
export function extractStreamUrls(code) {
    if (!code)
        return [];
    const matches = [...code.matchAll(/https?:\/\/[^\s"'`<>\\]+\.(?:m3u8|mp4|mkv)(?:\?[^\s"'`<>\\]*)?/gi)];
    return Array.from(new Set(matches.map(m => m[0])));
}

export function getStreamPriority(url, serverLabel = '') {
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

export function getQualityWeight(qStr) {
    const q = (qStr || '').toLowerCase();
    // Default player playback strictly prefers 1080p as initial stream
    if (q === '1080p' || q === 'fhd') return 50;
    if (q === '720p' || q === 'hd') return 40;
    if (q === '4k' || q === '2160p' || q === 'uhd') return 30;
    if (q === '480p' || q === 'sd') return 10;
    return 25;
}

export function selectBestStreamCandidate(candidateStreams) {
    if (!Array.isArray(candidateStreams) || candidateStreams.length === 0) return null;

    // First: Filter verified HTTP 206 Partial Content streams from top 3: FSL (1) -> FSLv2 (2) -> Pixeldrain (3)
    const top3Candidates = candidateStreams.filter(c => {
        if (!c || !c.url) return false;
        const prio = c.priority ?? getStreamPriority(c.url, c.server);
        return prio <= 3 && c.supports206 === true;
    });

    if (top3Candidates.length > 0) {
        top3Candidates.sort((a, b) => {
            const prioA = a.priority ?? getStreamPriority(a.url, a.server);
            const prioB = b.priority ?? getStreamPriority(b.url, b.server);
            if (prioA !== prioB) {
                return prioA - prioB; // 1 (FSL) < 2 (FSLv2) < 3 (Pixeldrain)
            }
            const aIs1080 = (a.quality || a.q || '').toLowerCase().includes('1080');
            const bIs1080 = (b.quality || b.q || '').toLowerCase().includes('1080');
            if (aIs1080 && !bIs1080) return -1;
            if (!aIs1080 && bIs1080) return 1;
            return getQualityWeight(b.quality || b.q) - getQualityWeight(a.quality || a.q);
        });
        return top3Candidates[0];
    }

    // Fallback: If above all three streaming links are NOT available or none support 206,
    // move to [server:10gbps] which holds google cdn and does not support 206 partial content
    const fallbackCandidates = candidateStreams.filter(c => {
        if (!c || !c.url) return false;
        const prio = c.priority ?? getStreamPriority(c.url, c.server);
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
            return getQualityWeight(b.quality || b.q) - getQualityWeight(a.quality || a.q);
        });
        return fallbackCandidates[0];
    }

    return candidateStreams[0] || null;
}

/**
 * Detects the Audio Tier of a title or bridge label:
 * - Tier 1: Multi Audio OR releases containing Indian languages
 *   (Hindi, Tamil, Telugu, English, Malayalam, Kannada) or 3+ languages
 * - Tier 2: Dual Audio (e.g. Hindi English, Dual Audio)
 * - Tier 3: Single Audio English, other single language, or fallback
 */
export function getAudioTier(text) {
    const t = (text || '').toLowerCase();
    
    const hasMultiKeyword = t.includes('multi audio') || 
                             t.includes('multi-audio') || 
                             t.includes('multiaudio') || 
                             /\bmulti\b/i.test(t) ||
                             t.includes('org multi');

    const languages = [
        'hindi', 'tamil', 'telugu', 'english', 'malayalam', 'kannada'
    ];
    const matchedLangs = languages.filter(l => {
        const regex = new RegExp(`\\b${l}\\b|${l}-|-${l}`, 'i');
        return regex.test(t);
    });

    const otherLangs = ['bengali', 'marathi', 'punjabi', 'gujarati', 'urdu', 'odia', 'bhojpuri', 'korean', 'japanese', 'spanish', 'french'];
    const matchedOther = otherLangs.filter(l => new RegExp(`\\b${l}\\b`, 'i').test(t));
    const totalLangCount = matchedLangs.length + matchedOther.length;

    const hasDualKeyword = t.includes('dual audio') || 
                            t.includes('dual-audio') || 
                            t.includes('dualaudio') || 
                            /\bdual\b/i.test(t);

    const isDualHindiEnglish = (
        (/\bhindi\b/i.test(t) && (/\beng(?:lish)?\b/i.test(t))) ||
        /\b(?:hin|hindi)[-_\s+]+(?:eng|english)\b/i.test(t) ||
        /\b(?:eng|english)[-_\s+]+(?:hin|hindi)\b/i.test(t)
    );

    const hasRegionalSouth = ['tamil', 'telugu', 'malayalam', 'kannada'].some(l => t.includes(l));

    // Tier 1: Multi Audio or combinations with South Indian / Indian regional languages
    if (
        hasMultiKeyword || 
        totalLangCount >= 3 || 
        (hasRegionalSouth && (t.includes('hindi') || t.includes('english') || matchedLangs.length >= 2)) ||
        matchedLangs.length >= 3
    ) {
        return 1;
    }

    // Tier 2: Dual Audio (e.g. Hindi English)
    if (hasDualKeyword || (isDualHindiEnglish && totalLangCount === 2) || (totalLangCount === 2 && !hasRegionalSouth)) {
        return 2;
    }

    // South Indian regional single language release
    if (hasRegionalSouth) {
        return 1;
    }

    // Tier 3: Single audio English or other languages
    return 3;
}

export function getAudioRichnessScore(text) {
    const t = (text || '').toLowerCase();
    const tier = getAudioTier(t);

    const languages = [
        'hindi', 'tamil', 'telugu', 'english', 'malayalam', 'kannada'
    ];
    let langCount = 0;
    for (const lang of languages) {
        if (t.includes(lang)) langCount++;
    }
    const southLangs = ['tamil', 'telugu', 'malayalam', 'kannada'];
    const southCount = southLangs.filter(l => t.includes(l)).length;

    if (tier === 1) {
        let score = 10000;
        if (t.includes('multi audio') || t.includes('multi-audio') || /\bmulti\b/i.test(t)) {
            score += 2000;
        }
        score += (langCount * 500);
        score += (southCount * 600);
        return score;
    }

    if (tier === 2) {
        let score = 5000;
        if (t.includes('dual audio') || t.includes('dual-audio') || /\bdual\b/i.test(t)) {
            score += 1000;
        }
        score += (langCount * 200);
        return score;
    }

    // Tier 3: Single audio
    if (t.includes('english') || /\beng\b/i.test(t)) {
        return 2000;
    }
    if (t.includes('hindi') || /\bhin\b/i.test(t)) {
        return 1500;
    }
    return 1000;
}

export function sortBridgesByFidelity(bridges) {
    if (!bridges || !Array.isArray(bridges)) return [];
    const isZip = (b) => {
        const text = `${b.quality || ''} ${b.label || ''} ${b.bridgeUrl || ''}`.toLowerCase();
        return text.includes('.zip') || text.includes('.rar') || text.includes('.7z') || text.includes('.tar') || text.includes('zippack') || text.includes('zip_pack') || text.includes('zip pack') || text.includes('batch zip') || text.includes('season zip');
    };
    const validBridges = bridges.filter(b => !isZip(b));
    const scoreBridge = (b) => {
        const text = `${b.quality || ''} ${b.label || ''} ${b.bridgeUrl || ''}`.toLowerCase();
        let score = 0;
        if (/\b(2160p|4k|uhd)\b/i.test(text)) score += 500;
        else if (/\b(1080p|fhd)\b/i.test(text)) score += 250;
        else if (/\b(720p)\b/i.test(text)) score += 100;
        else if (/\b(480p)\b/i.test(text)) score += 50;

        // Strict Audio Richness Priority: Multi Audio (Tamil, Telugu, Hindi, English, Malayalam, Kannada) decisively beats Dual Audio
        const tier = getAudioTier(b.label || text);
        if (tier === 1) score += 100000;
        else if (tier === 2) score += 50000;
        score += getAudioRichnessScore(b.label || text);

        const targetKeywords = ['hevc', 'hdr', 'hdr10', 'hdr10+', 'sdr', 'dv', 'dolby vision', 'x265', 'x264', 'h.265', 'h.264', '10bit', '10-bit', 'atmos', 'dts', 'ddp5.1', 'web-dl', 'bluray', 'remux'];
        for (const kw of targetKeywords) {
            if (text.includes(kw)) score += 25;
        }
        const sizeMatch = text.match(/([\d.]+)\s*gb/i);
        if (sizeMatch) score += Math.min(100, Math.round(parseFloat(sizeMatch[1]) * 10));
        return score;
    };
    return [...validBridges].sort((a, b) => scoreBridge(b) - scoreBridge(a));
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
/**
 * Movies4u Provider & Stream Extractor
 * Optimized for Android Media3 ExoPlayer & Stitch-Nexplay Integration
 */
export class Movies4uClient {
    liveBaseUrl = 'https://new1.movies4u.garden';
    mirrors = ['https://new1.movies4u.garden', 'https://new2.movies4u.garden', 'https://movies4u.foo', 'https://movies4u.co', 'https://movies4u.vip'];
    domainResolved = false;
    constructor(customBaseUrl) {
        if (customBaseUrl) {
            this.liveBaseUrl = customBaseUrl.replace(/\/+$/, '');
            this.domainResolved = true;
        }
    }

    decodeBase64(str) {
        if (!str) return '';
        try {
            if (typeof atob === 'function') {
                return atob(str);
            }
            if (typeof Buffer !== 'undefined') {
                return Buffer.from(str, 'base64').toString('utf-8');
            }
        } catch (_) {}
        return '';
    }

    setBaseUrl(url) {
        if (url && typeof url === 'string') {
            const cleanUrl = url.replace(/\/+$/, '');
            this.liveBaseUrl = cleanUrl;
            this.domainResolved = true;
            if (!this.mirrors.includes(this.liveBaseUrl)) {
                this.mirrors.unshift(this.liveBaseUrl);
            }
        }
    }

    setMirrors(mirrors) {
        if (Array.isArray(mirrors) && mirrors.length > 0) {
            this.mirrors = mirrors.map(m => (m || '').replace(/\/+$/, '')).filter(Boolean);
            if (this.mirrors.length > 0) {
                this.liveBaseUrl = this.mirrors[0];
                this.domainResolved = true;
            }
        }
    }

    applyRemoteConfig(config = {}) {
        if (config.baseUrl) this.setBaseUrl(config.baseUrl);
        if (Array.isArray(config.mirrors)) this.setMirrors(config.mirrors);
    }
    /**
     * Resolves the active live mirror from the entry point https://movies4u.foo
     */
    async resolveLiveDomain(customHttpGet) {
        if (this.domainResolved && this.liveBaseUrl && !this.liveBaseUrl.includes('.clinic'))
            return this.liveBaseUrl;
        const fetchHtml = customHttpGet || this.defaultHttpGet.bind(this);
        try {
            const html = await fetchHtml('https://movies4u.foo/', { 'User-Agent': DEFAULT_USER_AGENT }, 8000);
            // Look for tinyurl redirect link in html or base64 atob matches
            const tinyMatch = html.match(/https?:\/\/tinyurl\.com\/[a-zA-Z0-9]+/i);
            const atobMatches = [...html.matchAll(/atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/g)];
            let targetTinyUrl = tinyMatch ? tinyMatch[0] : null;
            if (!targetTinyUrl) {
                for (const m of atobMatches) {
                    try {
                        const decoded = this.decodeBase64(m[1]);
                        const found = decoded.match(/https?:\/\/[^\s"'>]+/i);
                        if (found) {
                            targetTinyUrl = found[0];
                            break;
                        }
                    } catch (_) {}
                }
            }
            if (targetTinyUrl) {
                const res = await fetch(targetTinyUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    headers: { 'User-Agent': DEFAULT_USER_AGENT }
                });
                if (res.url && !res.url.includes('tinyurl.com')) {
                    const resolvedOrigin = new URL(res.url).origin;
                    this.liveBaseUrl = resolvedOrigin;
                    this.domainResolved = true;
                    if (!this.mirrors.includes(resolvedOrigin)) {
                        this.mirrors.unshift(resolvedOrigin);
                    }
                    console.log(`[Movies4u] 🔄 Live mirror auto-resolved from movies4u.foo: ${this.liveBaseUrl}`);
                    return this.liveBaseUrl;
                }
            }
        }
        catch (e) {
            console.warn('[Movies4u] Note resolving live domain from movies4u.foo:', e?.message || e);
        }
        this.liveBaseUrl = 'https://new1.movies4u.garden';
        this.domainResolved = true;
        return this.liveBaseUrl;
    }
    /**
     * Search Movies4u for movies and TV series
     */
    async search(query, page = 1, customHttpGet) {
        const cleanQuery = query.trim();
        if (!cleanQuery)
            return [];
        const baseTitle = cleanQuery.replace(/\b(19\d{2}|20\d{2})\b/g, '').trim();
        const searchQueries = [cleanQuery];
        if (baseTitle && baseTitle !== cleanQuery) {
            searchQueries.push(baseTitle);
        }

        const baseUrl = await this.resolveLiveDomain(customHttpGet);
        const candidateMirrors = Array.from(new Set([
            baseUrl,
            this.liveBaseUrl,
            ...this.mirrors,
            'https://new1.movies4u.garden',
            'https://new2.movies4u.garden'
        ])).map(m => (m || '').replace(/\/+$/, '')).filter(Boolean);

        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);

        for (const mirror of candidateMirrors) {
            for (const q of searchQueries) {
                const searchUrl = `${mirror}/lookup.php?q=${encodeURIComponent(q)}&page=${page}&per_page=30`;
                try {
                    const resText = await fetcher(searchUrl, {
                        'User-Agent': DEFAULT_USER_AGENT,
                        'Referer': `${mirror}/search.html?q=${encodeURIComponent(q)}`
                    }, 6000);
                    if (!resText || resText.startsWith('<') || resText.includes('<html')) {
                        continue; // Skip parked HTML or redirect responses
                    }
                    const data = JSON.parse(resText);
                    const hits = Array.isArray(data?.hits) ? data.hits : [];
                    if (hits.length === 0) {
                        continue;
                    }
                    this.liveBaseUrl = mirror;
                    this.domainResolved = true;
                    return hits.map((hit) => {
                        const rawTitle = hit.post_title || '';
                        const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
                        const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
                        const isSeries = /\b(?:season|s\d+|series|episodes?)\b/i.test(rawTitle);
                        const permalink = hit.permalink?.startsWith('http')
                            ? hit.permalink.replace(/new[1-8]\.movies4u\.clinic/g, 'new1.movies4u.garden')
                            : `${mirror}${hit.permalink?.startsWith('/') ? '' : '/'}${hit.permalink || ''}`;
                        return {
                            id: String(hit.id || ''),
                            title: rawTitle,
                            cleanTitle: this.cleanTitle(rawTitle),
                            url: permalink,
                            link: permalink,
                            thumbnail: hit.post_thumbnail || undefined,
                            image: hit.post_thumbnail || undefined,
                            quality: hit.movie_quality || this.detectQuality(rawTitle),
                            year,
                            mediaType: isSeries ? 'series' : 'movie',
                            provider: 'movies4u'
                        };
                    });
                }
                catch (err) {
                    console.warn(`[Movies4u] Mirror ${mirror} search note:`, err?.message || err);
                }
            }
        }
        return [];
    }
    /**
     * Extracts detailed metadata, download links, and episode map from a movie/series page
     */
    async extractDetails(pageUrl, targetSeason = 1, customHttpGet) {
        const baseUrl = await this.resolveLiveDomain(customHttpGet);
        let cleanPageUrl = (pageUrl || '').replace(/new[1-8]\.movies4u\.clinic/g, 'new1.movies4u.garden');
        const targetUrl = cleanPageUrl.startsWith('http') ? cleanPageUrl : `${baseUrl}/${cleanPageUrl.replace(/^\/+/, '')}`;
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        const html = await fetcher(targetUrl, {
            'User-Agent': DEFAULT_USER_AGENT,
            'Referer': `${baseUrl}/`
        });
        const rawTitle = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
            || html.match(/<title>(.*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
            || '';
        const thumbnail = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1]
            || html.match(/<img[^>]+class=["'][^"']*post-thumbnail[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1]
            || html.match(/https:\/\/image\.tmdb\.org\/t\/p\/[^\s"'>]+/i)?.[0];
        const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
        const isSeries = /\b(?:season|s\d+|series|complete all episodes)\b/i.test(rawTitle);
        const streamingLinks = [];
        // 1. Extract Watch Online embed player (m4uplay.*)
        const watchOnlineMatch = html.match(/href=["'](https?:\/\/m4uplay\.[a-z0-9.-]+\/file\/[a-zA-Z0-9]+)["']/i);
        if (watchOnlineMatch) {
            streamingLinks.push({
                quality: this.detectQuality(rawTitle) || '1080p',
                url: watchOnlineMatch[1],
                server: 'M4UPlay (Watch Online Embed)',
                type: 'embedded',
                headers: {
                    'User-Agent': DEFAULT_USER_AGENT,
                    'Referer': targetUrl
                },
                mimeType: 'application/vnd.apple.mpegurl'
            });
        }
        // 2. Extract Download Links / Quality Bridges (m4ulinks.*) strictly without swallowing other headings
        const sectionRegex = /<h[1-6][^>]*>((?:(?!<\/?h[1-6])[\s\S])*?)<\/h[1-6]>((?:(?!<h[1-6])[\s\S])*?)<a[^>]+href=["'](https?:\/\/m4ulinks\.[a-z0-9.-]+\/number\/\d+)["']/gi;
        let sMatch;
        const bridgeList = [];
        while ((sMatch = sectionRegex.exec(html)) !== null) {
            const label = sMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const bridgeUrl = sMatch[3];
            const lowerLabel = label.toLowerCase();
            const lowerBridge = bridgeUrl.toLowerCase();
            if (
                lowerLabel.includes('.zip') || lowerLabel.includes('zip pack') || lowerLabel.includes('zippack') || lowerLabel.includes('batch') || lowerLabel.includes('season zip') || lowerLabel.includes('all in one zip') ||
                lowerBridge.includes('.zip') || lowerBridge.includes('.rar') || lowerBridge.includes('zippack')
            ) {
                continue;
            }
            const quality = this.detectQuality(label);
            const sizeMatch = label.match(/\[([\d.]+\s*(?:GB|MB)(?:\/[Ee])?)\]/i);
            const size = sizeMatch ? sizeMatch[1] : undefined;
            bridgeList.push({ label, quality, size, bridgeUrl });
        }
        if (bridgeList.length === 0) {
            const genericMatches = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/m4ulinks\.[a-z0-9.-]+\/number\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
            for (const [_, bridgeUrl, rawLabel] of genericMatches) {
                const label = rawLabel.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || rawTitle;
                const quality = this.detectQuality(label) || '1080p';
                bridgeList.push({ label, quality, bridgeUrl });
            }
        }
        if (!isSeries) {
            // Group bridge items by bridgeUrl and compute accurate audio fidelity tier & richness score
            const bridgesByUrl = new Map();
            for (const b of bridgeList) {
                if (!bridgesByUrl.has(b.bridgeUrl)) {
                    bridgesByUrl.set(b.bridgeUrl, []);
                }
                bridgesByUrl.get(b.bridgeUrl).push(b);
            }

            const bridgeInfoMap = new Map();
            for (const [bUrl, items] of bridgesByUrl.entries()) {
                let totalScore = 0;
                let multiAudioCount = 0;
                let has1080pMulti = false;
                let hasImaxDual = false;

                for (const item of items) {
                    const score = getAudioRichnessScore(item.label || '');
                    const tier = getAudioTier(item.label || '');
                    totalScore += score;
                    if (tier === 1) multiAudioCount++;
                    const lLower = (item.label || '').toLowerCase();
                    if ((lLower.includes('1080p') || lLower.includes('fhd')) && tier === 1) {
                        has1080pMulti = true;
                    }
                    if (lLower.includes('imax') && (tier === 2 || lLower.includes('dual') || (lLower.includes('hindi') && lLower.includes('english')))) {
                        hasImaxDual = true;
                    }
                }

                const avgScore = totalScore / items.length;
                const multiRatio = multiAudioCount / items.length;

                // Priority:
                // Tier 1: True Multi Audio bridge (majority of items are Multi Audio OR 1080p is Multi Audio)
                // Tier 2: Dual Audio / IMAX fallback bridge
                // Tier 3: Single audio / other
                let overallTier = 3;
                if (multiRatio >= 0.5 || has1080pMulti) {
                    overallTier = 1;
                } else if (hasImaxDual || items.some(i => getAudioTier(i.label) === 2)) {
                    overallTier = 2;
                }

                let compositeScore = 0;
                if (overallTier === 1) compositeScore += 100000;
                else if (overallTier === 2) compositeScore += 50000;
                compositeScore += (multiRatio * 10000);
                compositeScore += avgScore;

                bridgeInfoMap.set(bUrl, {
                    overallTier,
                    compositeScore,
                    multiRatio,
                    avgScore
                });
            }

            const uniqueBridgeUrls = Array.from(bridgesByUrl.keys())
                .sort((a, b) => {
                    const aInfo = bridgeInfoMap.get(a) || {};
                    const bInfo = bridgeInfoMap.get(b) || {};
                    return (bInfo.compositeScore || 0) - (aInfo.compositeScore || 0);
                });

            for (const bUrl of uniqueBridgeUrls) {
                try {
                    const hubLinks = await this.extractHubCloudFromBridge(bUrl, '1080p', fetcher);
                    const bInfo = bridgeInfoMap.get(bUrl) || {};
                    for (const hl of hubLinks) {
                        hl.audioScore = bInfo.compositeScore || 0;
                        hl.audioTier = bInfo.overallTier || 3;
                        hl.bridgeUrl = bUrl;
                    }
                    streamingLinks.push(...hubLinks);
                } catch (_) {}
            }
            return {
                title: rawTitle,
                cleanTitle: this.cleanTitle(rawTitle),
                url: targetUrl,
                mediaType: 'movie',
                thumbnail,
                year,
                quality: this.detectQuality(rawTitle),
                streamingLinks,
                qualityBridges: bridgeList,
                downloadLinks: bridgeList
            };
        }
        // TV Series Handling: Group bridges by Season
        const seasonsMap = new Map();
        for (const b of bridgeList) {
            const sNumMatch = b.label.match(/Season\s*(\d+)/i);
            const sNum = sNumMatch ? parseInt(sNumMatch[1], 10) : 1;
            if (!seasonsMap.has(sNum)) {
                seasonsMap.set(sNum, []);
            }
            seasonsMap.get(sNum).push(b);
        }
        const seasons = [];
        let currentEpisodes = [];
        // Parse target season episodes
        const seasonToFetch = seasonsMap.has(targetSeason) ? targetSeason : (Array.from(seasonsMap.keys())[0] || 1);
        const targetSeasonBridges = seasonsMap.get(seasonToFetch) || [];
        const sortedSeasonBridges = sortBridgesByFidelity(targetSeasonBridges);
        const preferredBridge = sortedSeasonBridges[0];
        if (preferredBridge) {
            currentEpisodes = await this.extractEpisodesFromBridge(preferredBridge.bridgeUrl, preferredBridge.quality, fetcher);
        }
        for (const [sNum, bridges] of seasonsMap.entries()) {
            seasons.push({
                seasonNumber: sNum,
                qualityBridges: sortBridgesByFidelity(bridges),
                episodes: sNum === seasonToFetch ? currentEpisodes : []
            });
        }
        return {
            title: rawTitle,
            cleanTitle: this.cleanTitle(rawTitle),
            url: targetUrl,
            mediaType: 'series',
            thumbnail,
            year,
            quality: this.detectQuality(rawTitle),
            streamingLinks,
            seasons,
            episodes: currentEpisodes
        };
    }
    /**
     * Resolves a bridge URL (M4UPlay, HubCloud, or Gamerxyt) to direct playable stream URLs
     */
    async resolveStream(bridgeUrl, qualityHint = '1080p', customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        const lowerUrl = bridgeUrl.toLowerCase();
        // 1. M4UPlay Embed Resolver -> Direct HLS (.m3u8)
        if (lowerUrl.includes('m4uplay.store') || lowerUrl.includes('vidhide') || lowerUrl.includes('dramiyos')) {
            return this.resolveM4uPlay(bridgeUrl, qualityHint, fetcher);
        }
        // 2. HubCloud / HubDrive / Gamerxyt / VCloud Resolver -> Direct Cloudflare R2 / Lenin CDN / 10Gbps
        if (lowerUrl.includes('hubcloud') || lowerUrl.includes('vcloud') || lowerUrl.includes('gamerxyt.com') || lowerUrl.includes('hubdrive') || lowerUrl.includes('hubcdn') || lowerUrl.includes('drive')) {
            return this.resolveHubCloud(bridgeUrl, qualityHint, fetcher);
        }
        // 3. Ignore GDFlix strictly per requirement (only target is HubCloud)
        if (lowerUrl.includes('gdflix')) {
            return [];
        }
        // Direct link fallback
        if (this.isDirectMediaStream(bridgeUrl)) {
            return [{
                    quality: qualityHint,
                    url: bridgeUrl,
                    originalUrl: bridgeUrl,
                    server: 'Direct Media Stream',
                    type: 'direct',
                    headers: { 'User-Agent': DEFAULT_USER_AGENT },
                    mimeType: this.detectMimeType(bridgeUrl)
                }];
        }
        return [];
    }
    /**
     * High-level 1-Click Playable Stream Generator for Media3 ExoPlayer
     */
    extractDirectCdnUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const clean = url.trim();
        if (clean.includes("googleusercontent.com") || clean.includes("video-downloads")) {
            return null;
        }
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

    async verifyMediaStream(streamUrl, headers = {}, timeoutMs = 4000) {
        if (!streamUrl || !streamUrl.startsWith("http")) return { isLive: false, supports206: false };
        let controller = null;
        let timeoutId = null;
        try {
            const isGoogleCdn = streamUrl.includes("googleusercontent.com") || 
                                streamUrl.includes("video-downloads") || 
                                streamUrl.includes("gpdl");
            const isHls = streamUrl.toLowerCase().includes('.m3u8');
            if (typeof AbortController !== "undefined") {
                controller = new AbortController();
                timeoutId = setTimeout(() => {
                    try { controller.abort(); } catch (_) {}
                }, timeoutMs);
            }
            const isDirectCdn = streamUrl.includes("pixeldrain") || 
                                streamUrl.includes("cloudflarestorage.com") || 
                                streamUrl.includes("r2.dev") || 
                                streamUrl.includes("fastdl") || 
                                streamUrl.includes("bunker.monster");
            const reqHeaders = {
                "User-Agent": headers["User-Agent"] || DEFAULT_USER_AGENT,
                "Range": "bytes=0-1024",
                ...(headers["Referer"] && !isDirectCdn ? { "Referer": headers["Referer"] } : {})
            };
            const res = await fetch(streamUrl, {
                method: "GET",
                headers: reqHeaders,
                signal: controller ? controller.signal : void 0,
                redirect: "follow"
            });
            const status = res.status;
            const contentRange = res.headers.get("content-range");
            const contentType = (res.headers.get("content-type") || "").toLowerCase();

            // Strictly reject non-video responses (HTML web players, text, zip archives, JSON)
            if (status >= 400 || contentType.includes("zip") || contentType.includes("html") || contentType.includes("json") || contentType.includes("text")) {
                return { isLive: false, supports206: false };
            }
            if (streamUrl.includes("testzip.php") || streamUrl.includes("negn6f")) {
                return { isLive: false, supports206: false };
            }

            // Google CDN fallback check: Does NOT support HTTP 206 Partial Content,
            // but is acceptable as ultimate fallback if top 3 are not available
            if (isGoogleCdn) {
                return { isLive: status >= 200 && status < 400, supports206: false, status, contentType, isGoogleCdn: true };
            }

            const acceptRanges = (res.headers.get("accept-ranges") || "").toLowerCase();
            const supports206 = status === 206 || acceptRanges.includes("bytes") || Boolean(contentRange) || isDirectCdn;

            // For top 3 streaming links (FSL, FSLv2, Pixeldrain):
            // Verify that it is working AND supports HTTP 206 Partial Content (or is verified direct CDN)
            if (!isHls && !supports206) {
                return { isLive: false, supports206: false };
            }

            return { isLive: true, supports206: true, status, contentType };
        } catch {
            return { isLive: false, supports206: false };
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            try { if (controller) controller.abort(); } catch (_) {}
        }
    }

    /**
     * High-level 1-Click Playable Stream Generator for Media3 ExoPlayer
     */
    async getPlayableStream(pageUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1, customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        const details = await this.extractDetails(pageUrl, seasonNumber, fetcher);
        
        if (!isTVShow && details.mediaType === 'movie') {
            const qualities = {};
            const qualitySizes = {};
            let primaryHeaders = { 'User-Agent': DEFAULT_USER_AGENT };
            let primaryMime = 'video/x-matroska';
            let primaryServer = 'Server 3 (Movies4u)';

            for (const b of (details.qualityBridges || details.downloadLinks || [])) {
                const qLower = (b.quality || '').toLowerCase();
                if (qLower.includes('480') || qLower.includes('sd')) continue;
                const qKey = qLower.includes('4k') || qLower.includes('2160') ? '4k' : (qLower.includes('1080') ? '1080p' : '720p');
                if (b.size && !qualitySizes[qKey]) {
                    qualitySizes[qKey] = b.size.replace(/\/[Ee].*/i, '').trim();
                }
            }

            const rawCandidates = [
                ...(details.streamingLinks || []),
                ...(details.downloadLinks || [])
            ];
            // Filter out 480p and gdflix, strictly target HubCloud only
            const candidates = rawCandidates.filter(c => {
                const q = (c.quality || '').toLowerCase();
                const u = (c.url || '').toLowerCase();
                if (q.includes('480') || q.includes('sd')) return false;
                if (u.includes('gdflix')) return false;
                return true;
            });

            // Group candidates by quality bucket
            const qualityBuckets = {
                '1080p': candidates.filter(c => (c.quality || '').toLowerCase().includes('1080') || (c.quality || '').toLowerCase().includes('fhd')),
                '4k': candidates.filter(c => (c.quality || '').toLowerCase().includes('4k') || (c.quality || '').toLowerCase().includes('2160') || (c.quality || '').toLowerCase().includes('uhd')),
                '720p': candidates.filter(c => (c.quality || '').toLowerCase().includes('720') || (c.quality || '').toLowerCase().includes('hd'))
            };

            const liveCandidates = [];
            // Resolve all available qualities in parallel for maximum speed and complete quality availability
            const qualityPromises = Object.entries(qualityBuckets).map(async ([qKey, bucket]) => {
                if (!bucket || bucket.length === 0) return null;
                // Strictly prioritize Multi Audio (Tier 1) > Dual Audio / IMAX (Tier 2) > Single Audio (Tier 3)
                const sortedBucket = [...bucket].sort((a, b) => {
                    const aTier = a.audioTier ?? 3;
                    const bTier = b.audioTier ?? 3;
                    if (aTier !== bTier) return aTier - bTier;

                    const aAudio = a.audioScore ?? getAudioRichnessScore(a.label || a.server || '');
                    const bAudio = b.audioScore ?? getAudioRichnessScore(b.label || b.server || '');
                    if (aAudio !== bAudio) return bAudio - aAudio;

                    const aHub = (a.url || '').includes('hubcloud') || (a.server || '').includes('Hub');
                    const bHub = (b.url || '').includes('hubcloud') || (b.server || '').includes('Hub');
                    if (aHub && !bHub) return -1;
                    if (!aHub && bHub) return 1;
                    return 0;
                });
                const bucketCandidates = [];
                for (const cand of sortedBucket.slice(0, 4)) {
                    try {
                        const resolved = await this.resolveStream(cand.url, qKey, fetcher);
                        for (const primary of resolved) {
                            const check = await this.verifyMediaStream(primary.url, primary.headers);
                            if (check.isLive) {
                                const urlLower = decodeURIComponent(primary.url || '').toLowerCase();
                                const isUrlMulti = urlLower.includes('multi.audio') || urlLower.includes('multi-audio') || urlLower.includes('multi_audio') || urlLower.includes('multiaudio');
                                const isUrlDual = urlLower.includes('hindi-english') || urlLower.includes('hindi.5.1-english') || (urlLower.includes('hindi') && urlLower.includes('english') && !isUrlMulti);

                                let resolvedTier = cand.audioTier || 3;
                                if (isUrlMulti) resolvedTier = 1;
                                else if (isUrlDual) resolvedTier = 2;

                                bucketCandidates.push({
                                    quality: qKey === '4k' ? '4K' : (qKey === '1080p' ? '1080p' : '720p'),
                                    url: primary.url,
                                    headers: primary.headers || primaryHeaders,
                                    mimeType: primary.mimeType || primaryMime,
                                    server: primary.server || (qKey === '4k' ? 'Server 3 (Movies4u 4K Direct)' : 'Server 3 (Movies4u)'),
                                    priority: primary.priority ?? getStreamPriority(primary.url, primary.server),
                                    supports206: check.supports206,
                                    audioTier: resolvedTier,
                                    audioScore: cand.audioScore || 0
                                });

                                // Early exit ONLY if verified 206 Tier 1 (Multi Audio) Cloudflare R2 stream is found
                                if (resolvedTier === 1 && check.supports206 && (primary.priority ?? getStreamPriority(primary.url, primary.server)) === 1) {
                                    break;
                                }
                            }
                        }
                        if (bucketCandidates.some(c => c.audioTier === 1 && c.supports206 && c.priority === 1)) {
                            break;
                        }
                    } catch (_) {}
                }
                if (bucketCandidates.length > 0) {
                    bucketCandidates.sort((a, b) => {
                        const aTier = a.audioTier ?? 3;
                        const bTier = b.audioTier ?? 3;
                        if (aTier !== bTier) return aTier - bTier; // Tier 1 Multi Audio always wins!

                        const aAudio = a.audioScore ?? 0;
                        const bAudio = b.audioScore ?? 0;
                        if (aAudio !== bAudio) return bAudio - aAudio;

                        if (a.supports206 && !b.supports206) return -1;
                        if (!a.supports206 && b.supports206) return 1;
                        return a.priority - b.priority;
                    });
                    return {
                        qKey,
                        candidate: bucketCandidates[0]
                    };
                }
                return null;
            });

            const settled = await Promise.allSettled(qualityPromises);
            for (const r of settled) {
                if (r.status === 'fulfilled' && r.value) {
                    const { qKey, candidate } = r.value;
                    qualities[qKey] = candidate.url;
                    liveCandidates.push(candidate);
                    if (!qualitySizes[qKey]) {
                        qualitySizes[qKey] = qKey === '4k' ? '4.5 GB' : (qKey === '1080p' ? '2.1 GB' : '950 MB');
                    }
                }
            }

            const bestCandidate = selectBestStreamCandidate(liveCandidates);
            if (bestCandidate) {
                const multiCandidates = liveCandidates.filter(c => c.audioTier === 1);
                const pool = multiCandidates.length > 0 ? multiCandidates : liveCandidates;
                const best1080 = pool.find(c => (c.quality === '1080p' || c.quality === '1080') && c.supports206 !== false);
                const primaryCandidate = best1080 || selectBestStreamCandidate(pool) || bestCandidate;
                const primaryUrl = primaryCandidate.url;
                const isHls = primaryUrl.includes('.m3u8');
                return {
                    title: details.title,
                    mediaType: 'movie',
                    streamUrl: primaryUrl,
                    qualities,
                    qualitySizes,
                    headers: primaryCandidate.headers || primaryHeaders,
                    mimeType: isHls ? 'application/vnd.apple.mpegurl' : (primaryCandidate.mimeType || primaryMime),
                    quality: primaryCandidate.quality || '1080p',
                    server: primaryCandidate.server || 'Server 3 (Movies4u)',
                    supports206: primaryCandidate.supports206 ?? true,
                    thumbnail: details.thumbnail
                };
            }
        }

        // TV Series Handling
        if (isTVShow || details.mediaType === 'series') {
            const season = details.seasons?.find(s => s.seasonNumber === seasonNumber) || details.seasons?.[0];
            const sortedBridges = season && season.qualityBridges.length > 0 ? sortBridgesByFidelity(season.qualityBridges) : [];
            const qualities = {};
            const qualitySizes = {};
            const liveCandidates = [];

            // Group season quality bridges by quality bucket (4k, 1080p, 720p)
            const qualityBridgeMap = {};
            for (const b of sortedBridges) {
                const qLower = (b.quality || '').toLowerCase();
                if (qLower.includes('480') || qLower.includes('sd')) continue;
                const qKey = (qLower.includes('4k') || qLower.includes('2160')) ? '4k' : (qLower.includes('1080') ? '1080p' : (qLower.includes('720') ? '720p' : '1080p'));
                if (!qualityBridgeMap[qKey]) {
                    qualityBridgeMap[qKey] = b;
                }
                if (b.size && !qualitySizes[qKey]) {
                    qualitySizes[qKey] = b.size.replace(/\/[Ee].*/i, '').trim();
                }
            }

            // Resolve all available quality bridges in parallel (HubCloud only)
            const seriesPromises = Object.entries(qualityBridgeMap).map(async ([qKey, bridge]) => {
                try {
                    const episodes = await this.extractEpisodesFromBridge(bridge.bridgeUrl, qKey, fetcher);
                    const ep = episodes.find(e => e.episodeNumber === episodeNumber) || episodes[0];
                    if (ep && ep.links && ep.links.length > 0) {
                        // STRICTLY TARGET HUBCLOUD ONLY
                        const hubLinks = ep.links.filter(l => !l.url.toLowerCase().includes('gdflix'));
                        const epCandidates = [];
                        for (const l of hubLinks.slice(0, 3)) {
                            try {
                                const resolved = await this.resolveStream(l.url, qKey, fetcher);
                                for (const candidateStream of resolved) {
                                    const check = await this.verifyMediaStream(candidateStream.url, candidateStream.headers);
                                    if (check.isLive) {
                                        const urlLower = decodeURIComponent(candidateStream.url || '').toLowerCase();
                                        const isUrlMulti = urlLower.includes('multi.audio') || urlLower.includes('multi-audio') || urlLower.includes('multi_audio') || urlLower.includes('multiaudio');
                                        const isUrlDual = urlLower.includes('hindi-english') || urlLower.includes('hindi.5.1-english') || (urlLower.includes('hindi') && urlLower.includes('english') && !isUrlMulti);

                                        let resolvedTier = getAudioTier(bridge.label || '');
                                        if (isUrlMulti) resolvedTier = 1;
                                        else if (isUrlDual) resolvedTier = 2;

                                        epCandidates.push({
                                            quality: qKey === '4k' ? '4K' : (qKey === '1080p' ? '1080p' : '720p'),
                                            url: candidateStream.url,
                                            headers: candidateStream.headers || { 'User-Agent': DEFAULT_USER_AGENT },
                                            mimeType: candidateStream.mimeType || 'video/x-matroska',
                                            server: candidateStream.server || (qKey === '4k' ? 'Server 3 (Movies4u 4K Direct)' : 'Server 3 (Movies4u)'),
                                            priority: candidateStream.priority ?? getStreamPriority(candidateStream.url, candidateStream.server),
                                            supports206: check.supports206,
                                            audioTier: resolvedTier,
                                            audioScore: getAudioRichnessScore(bridge.label || '')
                                        });
                                        if (resolvedTier === 1 && check.supports206 && (candidateStream.priority ?? getStreamPriority(candidateStream.url, candidateStream.server)) === 1) {
                                            break;
                                        }
                                    }
                                }
                                if (epCandidates.some(c => c.audioTier === 1 && c.supports206 && c.priority === 1)) {
                                    break;
                                }
                            } catch (_) {}
                        }
                        if (epCandidates.length > 0) {
                            epCandidates.sort((a, b) => {
                                const aTier = a.audioTier ?? 3;
                                const bTier = b.audioTier ?? 3;
                                if (aTier !== bTier) return aTier - bTier;

                                if (a.supports206 && !b.supports206) return -1;
                                if (!a.supports206 && b.supports206) return 1;
                                return a.priority - b.priority;
                            });
                            return {
                                qKey,
                                ep,
                                candidate: epCandidates[0]
                            };
                        }
                    }
                } catch (_) {}
                return null;
            });

            const seriesSettled = await Promise.allSettled(seriesPromises);
            let targetEp = null;
            for (const r of seriesSettled) {
                if (r.status === 'fulfilled' && r.value) {
                    const { qKey, ep, candidate } = r.value;
                    qualities[qKey] = candidate.url;
                    liveCandidates.push(candidate);
                    if (ep) targetEp = ep;
                    if (!qualitySizes[qKey]) {
                        qualitySizes[qKey] = qKey === '4k' ? '1.8 GB' : (qKey === '1080p' ? '950 MB' : '500 MB');
                    }
                }
            }

            const bestCandidate = selectBestStreamCandidate(liveCandidates);
            if (bestCandidate) {
                const ep = targetEp || details.episodes?.find(e => e.episodeNumber === episodeNumber) || { episodeNumber };
                const best1080 = liveCandidates.find(c => (c.quality === '1080p' || c.quality === '1080') && c.supports206 !== false);
                const primaryCandidate = (qualities['1080p'] && best1080) ? best1080 : bestCandidate;
                const primaryUrl = (qualities['1080p'] && best1080) ? qualities['1080p'] : bestCandidate.url;
                return {
                    title: `${details.title} - S${seasonNumber}E${ep.episodeNumber}`,
                    mediaType: 'series',
                    seasonNumber,
                    episodeNumber: ep.episodeNumber,
                    streamUrl: primaryUrl,
                    qualities,
                    qualitySizes,
                    headers: primaryCandidate.headers || { 'User-Agent': DEFAULT_USER_AGENT },
                    mimeType: primaryCandidate.mimeType || 'video/x-matroska',
                    quality: (primaryUrl === qualities['1080p']) ? '1080p' : (primaryCandidate.quality || '1080p'),
                    server: primaryCandidate.server || 'Server 3 (Movies4u)',
                    supports206: primaryCandidate.supports206 ?? true,
                    thumbnail: details.thumbnail
                };
            }

            // Fallback to ep.links on details (HubCloud only)
            const ep = details.episodes?.find(e => e.episodeNumber === episodeNumber) || details.episodes?.[0];
            if (ep && ep.links && ep.links.length > 0) {
                const hubLinks = ep.links.filter(l => !l.url.toLowerCase().includes('gdflix'));
                for (const bridge of hubLinks) {
                    try {
                        const resolved = await this.resolveStream(bridge.url, bridge.quality || '1080p', fetcher);
                        if (resolved.length > 0) {
                            for (const candidateStream of resolved) {
                                const check = await this.verifyMediaStream(candidateStream.url, candidateStream.headers);
                                if (check.isLive) {
                                    return {
                                        title: `${details.title} - S${seasonNumber}E${ep.episodeNumber}`,
                                        mediaType: 'series',
                                        seasonNumber,
                                        episodeNumber: ep.episodeNumber,
                                        streamUrl: candidateStream.url,
                                        qualities: { '1080p': candidateStream.url },
                                        headers: candidateStream.headers || { 'User-Agent': DEFAULT_USER_AGENT },
                                        mimeType: candidateStream.mimeType || 'video/x-matroska',
                                        quality: candidateStream.quality || '1080p',
                                        server: candidateStream.server || 'Server 3 (Movies4u)',
                                        supports206: check.supports206,
                                        thumbnail: details.thumbnail,
                                        backupStreams: resolved.slice(1)
                                    };
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }
        return null;
    }
    /**
     * Extracts direct streaming links across all available qualities (480p, 720p, 1080p, 2160p 4K)
     * for a specific season and episode of a TV series
     */
    async getEpisodeStreamsAllQualities(pageUrl, seasonNumber = 1, episodeNumber = 1, customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        const details = await this.extractDetails(pageUrl, seasonNumber, customHttpGet);
        const season = details.seasons?.find(s => s.seasonNumber === seasonNumber);
        if (!season || season.qualityBridges.length === 0)
            return {};
        const results = {};
        const bridgePromises = season.qualityBridges.map(async (bridge) => {
            try {
                const episodes = await this.extractEpisodesFromBridge(bridge.bridgeUrl, bridge.quality, fetcher);
                const ep = episodes.find(e => e.episodeNumber === episodeNumber);
                if (ep && ep.links && ep.links.length > 0) {
                    // Iterate all candidate bridge links per episode until one resolves
                    for (const candidate of ep.links) {
                        try {
                            const directStreams = await this.resolveStream(candidate.url, bridge.quality, fetcher);
                            if (directStreams.length > 0) {
                                return { quality: bridge.quality, streams: directStreams };
                            }
                        } catch (e) {}
                    }
                }
            }
            catch {
                // continue
            }
            return null;
        });
        const settled = await Promise.allSettled(bridgePromises);
        for (const item of settled) {
            if (item.status === 'fulfilled' && item.value) {
                results[item.value.quality] = item.value.streams;
            }
        }
        return results;
    }
    /**
     * Generates Media3 ExoPlayer configuration
     */
    getMedia3Config(link) {
        return {
            uri: link.url,
            headers: link.headers || {
                'User-Agent': DEFAULT_USER_AGENT
            },
            mimeType: link.mimeType || this.detectMimeType(link.url),
            quality: link.quality,
            server: link.server
        };
    }
    /* -------------------------------------------------------------------------- */
    /*                              INTERNAL RESOLVERS                            */
    /* -------------------------------------------------------------------------- */
    async resolveM4uPlay(embedUrl, qualityHint, fetcher) {
        try {
            const html = await fetcher(embedUrl, {
                'User-Agent': DEFAULT_USER_AGENT,
                'Referer': 'https://movies4u.foo/'
            });
            // Unpack Dean Edwards packed script
            const unpacked = unpack(html);
            if (unpacked) {
                // Look for links.hls2 or direct master.m3u8 URL in unpacked code
                const m3u8Matches = extractStreamUrls(unpacked);
                const masterM3u8 = m3u8Matches.find(u => u.includes('.m3u8'))
                    || unpacked.match(/https?:\/\/[^\s"'`\\]+master\.m3u8[^\s"'`\\]*/i)?.[0];
                if (masterM3u8) {
                    return [{
                            quality: qualityHint,
                            url: masterM3u8,
                            originalUrl: embedUrl,
                            server: 'M4UPlay (Adaptive HLS Master Stream)',
                            type: 'direct',
                            headers: {
                                'User-Agent': DEFAULT_USER_AGENT,
                                'Referer': 'https://m4uplay.store/'
                            },
                            mimeType: 'application/vnd.apple.mpegurl'
                        }];
                }
            }
        }
        catch {
            // ignore
        }
        return [];
    }
    async resolveGpdlLink(gpdlUrl, refererUrl) {
        if (!gpdlUrl || !gpdlUrl.startsWith('http')) return null;
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => {
            try { controller.abort(); } catch (_) {}
        }, 6000) : null;
        try {
            const res = await fetch(gpdlUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': DEFAULT_USER_AGENT,
                    'Referer': refererUrl || 'https://gamerxyt.com/',
                    'Range': 'bytes=0-1024'
                },
                redirect: 'manual',
                signal: controller ? controller.signal : void 0
            });
            const location = res.headers.get('location');
            if (location) {
                const unwrapped = this.extractDirectCdnUrl(location);
                if (unwrapped && unwrapped.startsWith('http') && !unwrapped.includes('gpdl') && !unwrapped.includes('pixel.hubcloud') && !unwrapped.includes('pixel.rohitkiskk.workers.dev/?id=')) {
                    return unwrapped;
                }
                return await this.resolveGpdlLink(unwrapped || location, gpdlUrl);
            }
            if (res.url && res.url !== gpdlUrl) {
                const unwrapped = this.extractDirectCdnUrl(res.url);
                if (unwrapped && unwrapped.startsWith('http')) return unwrapped;
            }
        } catch {} finally {
            if (timeoutId) clearTimeout(timeoutId);
            try { if (controller) controller.abort(); } catch (_) {}
        }
        return null;
    }

    async resolveHubCloud(hubUrl, qualityHint, customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        const results = [];
        try {
            let currentUrl = hubUrl;
            let html = await fetcher(currentUrl, {
                'User-Agent': DEFAULT_USER_AGENT,
                'Referer': 'https://m4ulinks.site/'
            });

            // VCloud token resolver (double base64 redirect)
            if (currentUrl.includes('vcloud') || html.includes('atob(atob(')) {
                const atobMatch = html.match(/var\s+url\s*=\s*atob\(atob\(['"]([^'"]+)['"]\)\)/i);
                if (atobMatch && atobMatch[1]) {
                    try {
                        let dec = atobMatch[1];
                        try {
                            if (typeof atob === 'function') {
                                dec = atob(atob(dec));
                            } else if (typeof Buffer !== 'undefined') {
                                dec = Buffer.from(Buffer.from(dec, 'base64').toString('utf-8'), 'base64').toString('utf-8');
                            } else {
                                dec = this.decodeBase64(this.decodeBase64(dec));
                            }
                        } catch (_) {
                            dec = this.decodeBase64(this.decodeBase64(atobMatch[1]));
                        }
                        if (dec && dec.startsWith('http')) {
                            currentUrl = dec;
                            html = await fetcher(currentUrl, {
                                'User-Agent': DEFAULT_USER_AGENT,
                                'Referer': hubUrl
                            });
                        }
                    } catch (_) {}
                }
            }

            // HubCloud/HubDrive window.location.replace or meta redirect
            const locRedirect = html.match(/(?:window\.location(?:\.replace|\.href)?\s*=\s*['"]|location\.href\s*=\s*['"])(https?:\/\/[^'"]+)['"]/i);
            if (locRedirect && locRedirect[1] && !locRedirect[1].includes('workers.dev') && !locRedirect[1].includes('.mkv') && !locRedirect[1].includes('.mp4')) {
                currentUrl = locRedirect[1].replace(/&amp;/g, '&');
                html = await fetcher(currentUrl, {
                    'User-Agent': DEFAULT_USER_AGENT,
                    'Referer': hubUrl
                });
            }

            // HubCloud redirects or links to gamerxyt.com, sportverse.cc or hubcloud.php
            if (!currentUrl.includes('gamerxyt.com') && !currentUrl.includes('sportverse.cc')) {
                const gamerMatch = html.match(/href=["'](https?:\/\/[^"']*(?:gamerxyt|sportverse|hubcloud\.php)[^"']*)["']/i)
                    || html.match(/var\s+url\s*=\s*['"](https?:\/\/[^'"]*(?:gamerxyt|sportverse|hubcloud\.php)[^'"]*)['"]/i)
                    || html.match(/<a[^>]*id=["']download["'][^>]*href=["']([^"']+)["']/i);
                if (gamerMatch && gamerMatch[1]) {
                    currentUrl = gamerMatch[1].replace(/&amp;/g, '&');
                    html = await fetcher(currentUrl, {
                        'User-Agent': DEFAULT_USER_AGENT,
                        'Referer': hubUrl
                    });
                }
            }
            // Extract direct stream candidates from landing/gamerxyt/sportverse page
            const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
            for (const [_, href, rawLabel] of links) {
                const label = rawLabel.replace(/<[^>]+>/g, '').trim();
                const lowerHref = href.toLowerCase();
                const lowerLabel = label.toLowerCase();
                
                // Strictly ignore ZIP and compressed archive links
                if (
                    lowerHref.includes('.zip') || lowerHref.includes('.rar') || lowerHref.includes('.7z') || lowerHref.includes('.tar') || lowerHref.includes('.gz') || lowerHref.includes('zippack') ||
                    lowerLabel.includes('.zip') || lowerLabel.includes('zip pack') || lowerLabel.includes('zippack') || lowerLabel.includes('batch')
                ) {
                    continue;
                }

                // 1. [Download FSL server] (Cloudflare R2 Direct Stream) - Priority 1 (Primary Streaming Link)
                if (href.includes('r2.cloudflarestorage.com') || href.includes('r2.dev') || lowerLabel.includes('fsl server') || lowerLabel.includes('fsl 4k') || lowerLabel.includes('fsl 1080p') || lowerLabel.includes('fsl direct')) {
                    results.push({
                        quality: qualityHint,
                        url: href,
                        originalUrl: hubUrl,
                        server: 'Download [FSL Server] (10Gbps Cloudflare R2 Direct)',
                        type: 'direct',
                        headers: { 'User-Agent': DEFAULT_USER_AGENT },
                        mimeType: 'video/x-matroska',
                        priority: 1
                    });
                }
                // 2. [Download FSL v2 server] (FastDL / Bunker / Valentine / Lenin CDN) - Priority 2 (Second Streaming Link)
                else if (href.includes('fastdl') || href.includes('fsl.') || href.includes('bunker.monster') || href.includes('valentine.guru') || href.includes('cdn.lenin.buzz') || lowerLabel.includes('fastdl') || lowerLabel.includes('fslv2') || lowerLabel.includes('fsl v2')) {
                    results.push({
                        quality: qualityHint,
                        url: href,
                        originalUrl: hubUrl,
                        server: 'Download [FSL v2 server] (Fast CDN Direct Stream)',
                        type: 'direct',
                        headers: { 'User-Agent': DEFAULT_USER_AGENT },
                        mimeType: 'video/x-matroska',
                        priority: 2
                    });
                }
                // 3. pixeldrain (PixelDrain Direct CDN Stream) - Priority 3 (Third Streaming Link if FSL / FSLv2 not available)
                else if (lowerHref.includes('pixeld') || lowerLabel.includes('pixel')) {
                    let fileId = (href.includes('/u/') ? href.split('/u/')[1] : href.split('/api/file/')[1])?.split('?')[0]?.replace(/\/+$/, '');
                    if (!fileId || fileId === 'negn6f') {
                        const pxlMatch = html.match(/var\s+pxl\s*=\s*['"]([^'"]+)['"];?/i);
                        if (pxlMatch && pxlMatch[1]) {
                            fileId = pxlMatch[1].split('/u/')[1]?.split('?')[0]?.replace(/\/+$/, '');
                        }
                    }
                    if (fileId && fileId !== 'negn6f' && fileId.length >= 6) {
                        const pxlUrl = `https://pixeldrain.dev/api/file/${fileId}`;
                        if (!results.some(r => r.url === pxlUrl)) {
                            results.push({
                                quality: qualityHint,
                                url: pxlUrl,
                                originalUrl: hubUrl,
                                server: 'Download [PixelServer] (PixelDrain Direct CDN Stream)',
                                type: 'direct',
                                headers: { 'User-Agent': DEFAULT_USER_AGENT },
                                mimeType: 'video/x-matroska',
                                priority: 3
                            });
                        }
                    }
                }
                // 4. [server:10gbps] (Google CDN Stream) - Priority 10 (Fallback if top 3 not available)
                else if (
                    lowerLabel.includes('server : 10gbps') ||
                    lowerLabel.includes('server: 10gbps') ||
                    (lowerLabel.includes('10gbps') && !lowerLabel.includes('fsl') && !lowerLabel.includes('r2')) ||
                    lowerLabel.includes('google cdn') ||
                    lowerHref.includes('googleusercontent.com') ||
                    lowerHref.includes('video-downloads') ||
                    lowerHref.includes('gpdl')
                ) {
                    results.push({
                        quality: qualityHint,
                        url: href,
                        originalUrl: hubUrl,
                        server: 'Download [Server : 10Gbps] (Google CDN Stream)',
                        type: 'direct',
                        headers: { 'User-Agent': DEFAULT_USER_AGENT },
                        mimeType: 'video/x-matroska',
                        priority: 10
                    });
                }
            }

            // Check dynamic script var pxl if Pixeldrain not yet added
            if (!results.some(r => r.url.includes('pixeldrain'))) {
                const pxlMatch = html.match(/var\s+pxl\s*=\s*['"]([^'"]+)['"];?/i);
                if (pxlMatch && pxlMatch[1]) {
                    const clean = pxlMatch[1].replace(/[?&]download.*$/i, '').trim();
                    const fileId = clean.split('/u/')[1]?.split('?')[0]?.replace(/\/+$/, '') || clean.split('/').pop()?.split('?')[0];
                    if (fileId && fileId !== 'negn6f' && fileId.length >= 6) {
                        results.push({
                            quality: qualityHint,
                            url: `https://pixeldrain.dev/api/file/${fileId}`,
                            originalUrl: hubUrl,
                            server: 'Download [PixelServer] (PixelDrain Direct CDN Stream)',
                            type: 'direct',
                            headers: { 'User-Agent': DEFAULT_USER_AGENT },
                            mimeType: 'video/x-matroska',
                            priority: 3
                        });
                    }
                }
            }

            results.sort((a, b) => (a.priority || 50) - (b.priority || 50));
        }
        catch {
            // ignore
        }
        return results.filter(r => r && r.url);
    }
    async resolveGDFlix(gdFlixUrl, qualityHint, customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        try {
            const html = await fetcher(gdFlixUrl, {
                'User-Agent': DEFAULT_USER_AGENT,
                'Referer': 'https://m4ulinks.site/'
            });
            const instantMatch = html.match(/href=["'](https?:\/\/[^"']*busycdn\.[^"']*)["']/i);
            if (instantMatch && instantMatch[1]) {
                const busyUrl = instantMatch[1];
                let directCdn = this.extractDirectCdnUrl(busyUrl);
                if (!directCdn || directCdn.includes('busycdn')) {
                    const busyController = typeof AbortController !== "undefined" ? new AbortController() : null;
                    const busyTimer = busyController ? setTimeout(() => {
                        try { busyController.abort(); } catch (_) {}
                    }, 5000) : null;
                    try {
                        const res = await fetch(busyUrl, {
                            method: 'GET',
                            headers: { 
                                'User-Agent': DEFAULT_USER_AGENT,
                                'Range': 'bytes=0-1024'
                            },
                            signal: busyController ? busyController.signal : void 0,
                            redirect: 'follow'
                        });
                        if (res.url) {
                            directCdn = this.extractDirectCdnUrl(res.url);
                        }
                    } catch (e) {} finally {
                        if (busyTimer) clearTimeout(busyTimer);
                        try { if (busyController) busyController.abort(); } catch (_) {}
                    }
                }
                const finalUrl = (directCdn && directCdn.startsWith('http')) ? directCdn : busyUrl;
                return [{
                    quality: qualityHint,
                    url: finalUrl,
                    originalUrl: gdFlixUrl,
                    server: 'GDFlix [Instant 10GBPS 4K]',
                    type: 'direct',
                    headers: { 'User-Agent': DEFAULT_USER_AGENT },
                    mimeType: 'video/x-matroska'
                }];
            }
        }
        catch {
            // ignore
        }
        return [];
    }
    async extractHubCloudFromBridge(bridgeUrl, quality = '1080p', customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        try {
            const html = await fetcher(bridgeUrl, {
                'User-Agent': DEFAULT_USER_AGENT,
                'Referer': this.liveBaseUrl
            });
            const results = [];
            // Parse sections by headings to accurately map each HubCloud/VCloud link to its true quality (4K, 1080p, 720p)
            const sectionParts = html.split(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi);
            if (sectionParts.length > 1) {
                for (let i = 1; i < sectionParts.length; i += 2) {
                    const heading = sectionParts[i].replace(/<[^>]+>/g, '').trim();
                    const content = sectionParts[i + 1] || '';
                    const detectedQ = this.detectQuality(heading);
                    // Strictly ignore 480p
                    if (detectedQ === '480p' || heading.toLowerCase().includes('480p') || heading.toLowerCase().includes('480')) {
                        continue;
                    }
                    const qKey = (detectedQ === '2160p' || heading.toLowerCase().includes('4k') || heading.toLowerCase().includes('2160')) ? '4k' : detectedQ;
                    
                    // TARGET HUBCLOUD & VCLOUD
                    const links = [...content.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']*(?:hubcloud|vcloud|drive|hubcdn)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
                    for (const [_, href, rawText] of links) {
                        const lHref = href.toLowerCase();
                        if (lHref.includes('.zip') || lHref.includes('.rar') || lHref.includes('.7z') || lHref.includes('zippack')) {
                            continue;
                        }
                        const text = rawText.replace(/<[^>]+>/g, '').trim();
                        const cleanServer = (href.includes('hubcloud') || href.includes('vcloud') || href.includes('hubdrive') || href.includes('hubcdn') || href.includes('drive'))
                            ? 'Hub-Cloud [DD]'
                            : (text && !text.toLowerCase().includes('gdflix') ? text : 'Hub-Cloud [DD]');
                        results.push({
                            quality: qKey,
                            url: href,
                            originalUrl: bridgeUrl,
                            server: cleanServer,
                            type: 'download',
                            headers: { 'User-Agent': DEFAULT_USER_AGENT }
                        });
                    }
                }
            }

            // Fallback if no sections with headings were found
            if (results.length === 0) {
                const links = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']*(?:hubcloud|vcloud|drive|hubcdn)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
                for (const [_, href, rawText] of links) {
                    const lUrl = href.toLowerCase();
                    const lText = rawText.toLowerCase();
                    if (
                        lUrl.includes('.zip') || lUrl.includes('.rar') || lUrl.includes('.7z') || lUrl.includes('zippack') ||
                        lText.includes('.zip') || lText.includes('zip pack') || lText.includes('batch')
                    ) {
                        continue;
                    }
                    const text = rawText.replace(/<[^>]+>/g, '').trim();
                    const cleanQ = (quality === '2160p' || (quality || '').toLowerCase().includes('4k')) ? '4k' : quality;
                    const cleanServer = (href.includes('hubcloud') || href.includes('vcloud') || href.includes('hubdrive') || href.includes('hubcdn') || href.includes('drive'))
                        ? 'Hub-Cloud [DD]'
                        : (text && !text.toLowerCase().includes('gdflix') ? text : 'Hub-Cloud [DD]');
                    results.push({
                        quality: cleanQ,
                        url: href,
                        originalUrl: bridgeUrl,
                        server: cleanServer,
                        type: 'download',
                        headers: { 'User-Agent': DEFAULT_USER_AGENT }
                    });
                }
            }

            return results;
        }
        catch {
            return [];
        }
    }
    async extractEpisodesFromBridge(bridgeUrl, quality = '1080p', customHttpGet) {
        const fetcher = customHttpGet || this.defaultHttpGet.bind(this);
        try {
            const html = await fetcher(bridgeUrl, {
                'User-Agent': DEFAULT_USER_AGENT,
                'Referer': this.liveBaseUrl
            });
            const episodes = [];
            const parts = html.split(/<h[1-6][^>]*>\s*-:\s*Episodes?:?\s*(\d+)\s*:-?\s*<\/h[1-6]>/i);
            for (let i = 1; i < parts.length; i += 2) {
                const epNum = parseInt(parts[i], 10);
                const epContent = parts[i + 1] || '';
                // TARGET HUBCLOUD & VCLOUD
                const links = [...epContent.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']*(?:hubcloud|vcloud|drive|hubcdn)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
                const episodeLinks = links
                    .filter(([_, href, rawLabel]) => {
                        const lHref = href.toLowerCase();
                        const lLabel = rawLabel.toLowerCase();
                        return (
                            !lHref.includes('.zip') && !lHref.includes('.rar') && !lHref.includes('.7z') && !lHref.includes('zippack') &&
                            !lLabel.includes('.zip') && !lLabel.includes('zip pack') && !lLabel.includes('batch')
                        );
                    })
                    .map(([_, href, rawLabel]) => ({
                        title: rawLabel.replace(/<[^>]+>/g, '').trim(),
                        url: href,
                        server: 'Hub-Cloud [DD]',
                        quality
                    }));
                episodes.push({
                    episodeNumber: epNum,
                    title: `Episode ${epNum}`,
                    links: episodeLinks
                });
            }
            return episodes;
        }
        catch {
            return [];
        }
    }
    /* -------------------------------------------------------------------------- */
    /*                               HELPER METHODS                               */
    /* -------------------------------------------------------------------------- */
    cleanTitle(title) {
        return title
            .replace(/\b(480p|720p|1080p|2160p|4k|uhd|hdtc|bluray|web-dl|webrip|hdrip|hevc|x264|x265|10bit)\b/gi, ' ')
            .replace(/\b(hindi|english|tamil|telugu|korean|malayalam|kannada|dual audio|multi audio|org|dubbed|line)\b/gi, ' ')
            .replace(/\b(season\s*\d+(?:-\d+)?|s\d+(?:\s*ep\d+)?|complete|all episodes|full movie|movie)\b/gi, ' ')
            .replace(/[\[\](){}\-_+]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    detectQuality(text) {
        const s = text.toLowerCase();
        if (s.includes('2160p') || s.includes('4k'))
            return '2160p';
        if (s.includes('1080p'))
            return '1080p';
        if (s.includes('720p'))
            return '720p';
        if (s.includes('480p'))
            return '480p';
        return '1080p';
    }
    detectMimeType(url) {
        const lower = url.toLowerCase().split('?')[0];
        if (lower.endsWith('.m3u8'))
            return 'application/vnd.apple.mpegurl';
        if (lower.endsWith('.mpd'))
            return 'application/dash+xml';
        if (lower.endsWith('.mkv'))
            return 'video/x-matroska';
        if (lower.endsWith('.mp4'))
            return 'video/mp4';
        return 'video/mp4';
    }
    isDirectMediaStream(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
        const lower = url.toLowerCase().split('?')[0];
        if (
            lower.includes('.zip') ||
            lower.includes('.rar') ||
            lower.includes('.7z') ||
            lower.includes('.tar') ||
            lower.includes('.gz') ||
            lower.includes('.iso') ||
            lower.includes('zippack') ||
            lower.includes('zip_pack')
        ) {
            return false;
        }
        return lower.endsWith('.m3u8')
            || lower.endsWith('.mp4')
            || lower.endsWith('.mkv')
            || lower.endsWith('.mpd')
            || url.includes('r2.cloudflarestorage.com')
            || url.includes('cdn.lenin.buzz');
    }
    decodeBase64(str) {
        if (typeof atob === 'function') {
            return atob(str);
        }
        const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';
        let clean = String(str).replace(/=+$/, '');
        for (let bc = 0, bs = 0, buffer = 0, idx = 0; buffer = clean.charCodeAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
            buffer = b64.indexOf(String.fromCharCode(buffer));
        }
        return output;
    }
    async defaultHttpGet(url, headers, timeoutMs = 10000) {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
        }, timeoutMs);
        try {
            const res = await fetch(url, {
                headers: headers || { 'User-Agent': DEFAULT_USER_AGENT },
                signal: controller.signal
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status} fetching ${url}`);
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('video') || contentType.includes('octet-stream') || contentType.includes('audio')) {
                try { controller.abort(); } catch (_) {}
                return '';
            }
            return await res.text();
        }
        finally {
            clearTimeout(timer);
            try { controller.abort(); } catch (_) {}
        }
    }
}

export const Movies4u = new Movies4uClient();

