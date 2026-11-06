const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_BASE_URL = 'https://animesalt.cx';

export const LIBVLC_ANIMESALT_OPTIONS = [
  ':http-referrer=https://ravok.buzz/',
  `:http-user-agent=${DEFAULT_USER_AGENT}`
];

function safeDecodeBase64(str) {
  if (!str) return '';
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(str)));
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString('utf-8');
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    const clean = String(str).replace(/=+$/, '');
    for (
      let bc = 0, bs, buffer, idx = 0;
      (buffer = clean.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  } catch (_) {
    return '';
  }
}

/**
 * AnimeSalt.cx Dedicated Anime Series & Movies Provider Client
 * Specialized for Android LibVLC and Media3 ExoPlayer in NexPlay (Server 4)
 * Pure JavaScript & React Native Native Fetch Implementation
 */
export class AnimeSaltClient {
  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.mirrors = [this.baseUrl];
    this.providerName = 'animesalt';
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
      this.mirrors = mirrors.map(m => (m || '').replace(/\/+$/, '')).filter(Boolean);
      if (this.mirrors.length > 0) {
        this.baseUrl = this.mirrors[0];
      }
    }
  }

  applyRemoteConfig(config = {}) {
    if (config.baseUrl) this.setBaseUrl(config.baseUrl);
    if (Array.isArray(config.mirrors)) this.setMirrors(config.mirrors);
  }

  cleanTitle(title) {
    return (title || '')
      .replace(/<[^>]+>/g, '')
      .replace(/ - Anime Salt.*/i, '')
      .replace(/ - Watch Now.*/i, '')
      .replace(/\s*\([^)]*(?:dub|sub|audio|hindi|tamil|telugu)[^)]*\)/gi, '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeImageUrl(src) {
    if (!src) return 'https://animesalt.cx/wp-content/uploads/cropped-AnimeSalticon-192x192.png';
    let url = src.trim();
    if (url.startsWith('//')) {
      url = `https:${url}`;
    } else if (url.startsWith('/')) {
      url = `${this.baseUrl}${url}`;
    }
    return url;
  }

  async httpGet(url, customHeaders = {}, timeoutMs = 10000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: `${this.baseUrl}/`,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...customHeaders
        },
        signal: controller ? controller.signal : undefined
      });
      return await resp.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  async httpPost(url, body, customHeaders = {}, timeoutMs = 10000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: `${this.baseUrl}/`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          ...customHeaders
        },
        body,
        signal: controller ? controller.signal : undefined
      });
      return await resp.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Search AnimeSalt.cx for Anime Series and Movies
   */
  async search(query, page = 1) {
    const cleanQuery = this.cleanTitle(query);
    if (!cleanQuery) return [];

    const searchUrl = page === 1 
      ? `${this.baseUrl}/?s=${encodeURIComponent(cleanQuery)}`
      : `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(cleanQuery)}`;

    try {
      const html = await this.httpGet(searchUrl);
      const results = [];
      const seen = new Set();
      const articleRegex = /<article[\s\S]*?<\/article>/gi;
      let match;

      while ((match = articleRegex.exec(html)) !== null) {
        const art = match[0];
        if (art.includes('episodes') && art.includes('episode_by_temp')) continue;

        const linkMatch = art.match(/class=["']lnk-blk["'][^>]*href=["']([^"']+)["']/i) ||
                          art.match(/href=["'](https?:\/\/[^"']*(?:movies|series)[^"']*)["']/i);
        const titleMatch = art.match(/class=["']entry-title["'][^>]*>([\s\S]*?)<\/(?:h2|h3|h1|a)>/i) ||
                           art.match(/<(?:h2|h3)[^>]*>([\s\S]*?)<\/(?:h2|h3)>/i);
        const imgMatch = art.match(/(?:data-src|data-lazy-src|src)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
        const yearMatch = art.match(/class=["']year["'][^>]*>(\d{4})<\/span>/i);

        if (linkMatch && titleMatch) {
          const fullLink = linkMatch[1].startsWith('http') ? linkMatch[1] : new URL(linkMatch[1], this.baseUrl).href;
          if (seen.has(fullLink)) continue;
          seen.add(fullLink);

          const rawTitle = this.cleanTitle(titleMatch[1]);
          const image = this.normalizeImageUrl(imgMatch ? imgMatch[1] : '');
          const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
          const isSeries = fullLink.includes('/series/');

          results.push({
            id: fullLink,
            title: rawTitle,
            cleanTitle: this.cleanTitle(rawTitle),
            url: fullLink,
            link: fullLink,
            thumbnail: image,
            image: image,
            year,
            type: isSeries ? 'series' : 'movie',
            mediaType: isSeries ? 'tv' : 'movie',
            quality: '1080p',
            provider: 'animesalt'
          });
        }
      }

      return results;
    } catch (err) {
      console.warn('[AnimeSalt] Search error:', err?.message || err);
      return [];
    }
  }

  /**
   * Extract Details & Episodes list for an anime series/movie
   */
  async extractDetails(link, targetSeason = 1) {
    const fullUrl = link.startsWith('http') ? link : new URL(link, this.baseUrl).href;
    const html = await this.httpGet(fullUrl);

    const isSeries = fullUrl.includes('/series/') || html.includes('single-series') || html.includes('episode_by_temp') || html.includes('season-btn');
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = this.cleanTitle(titleMatch ? titleMatch[1] : '');

    let image = '';
    const scriptImgMatch = html.match(/let\s+image\s*=\s*["']([^"']+)["']/i);
    if (scriptImgMatch && scriptImgMatch[1]) {
      image = scriptImgMatch[1];
    }
    if (!image) {
      const tmdbImg = html.match(/img[^>]+(?:data-src|src)=["']([^"']*image\.tmdb\.org[^"']*)["']/i);
      if (tmdbImg) image = tmdbImg[1];
    }
    if (!image) {
      const postImg = html.match(/class=["']poster["'][\s\S]*?(?:data-src|src)=["']([^"']+)["']/i);
      if (postImg) image = postImg[1];
    }
    image = this.normalizeImageUrl(image);

    const seasons = [];
    let episodes = [];

    if (isSeries) {
      const seasonBtnRegex = /class=["'][^"']*season-btn[^"']*["'][^>]*data-season=["'](\d+)["'][^>]*data-post=["'](\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let sMatch;
      while ((sMatch = seasonBtnRegex.exec(html)) !== null) {
        const seasonNum = parseInt(sMatch[1], 10);
        const postId = sMatch[2];
        const sTitle = this.cleanTitle(sMatch[3]) || `Season ${seasonNum}`;
        const episodesAjaxUrl = `${this.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(seasonNum)}&post=${encodeURIComponent(postId)}`;
        seasons.push({
          id: seasonNum,
          seasonNumber: seasonNum,
          title: sTitle,
          episodesLink: episodesAjaxUrl
        });
      }

      if (seasons.length === 0) {
        seasons.push({
          id: 1,
          seasonNumber: 1,
          title: 'Season 1',
          episodesLink: fullUrl
        });
      }

      const targetSeasonObj = seasons.find(s => s.seasonNumber === targetSeason) || seasons[0];
      if (targetSeasonObj) {
        episodes = await this.getEpisodeList(targetSeasonObj.episodesLink || fullUrl);
      }
    }

    return {
      title: rawTitle,
      cleanTitle: this.cleanTitle(rawTitle),
      url: fullUrl,
      thumbnail: image,
      type: isSeries ? 'series' : 'movie',
      mediaType: isSeries ? 'tv' : 'movie',
      quality: '1080p',
      seasons,
      episodes,
      streamingLinks: []
    };
  }

  /**
   * Parse episode list from series season HTML or AJAX endpoint
   */
  async getEpisodeList(url) {
    const isAjaxSeason = url.includes('action=action_select_season');
    const targetUrl = url.startsWith('http') ? url : new URL(url, this.baseUrl).href;

    try {
      const html = await this.httpGet(targetUrl, {
        Referer: this.baseUrl,
        'X-Requested-With': isAjaxSeason ? 'XMLHttpRequest' : undefined
      });

      const episodes = [];
      const epRegex = /<article[^>]*class=["'][^"']*episodes[^"']*["'][\s\S]*?<\/article>/gi;
      let em;
      let idx = 0;

      while ((em = epRegex.exec(html)) !== null) {
        const art = em[0];
        const linkMatch = art.match(/href=["'](https?:\/\/[^"']*(?:episode)[^"']*)["']/i) || art.match(/class=["']lnk-blk["'][^>]*href=["']([^"']+)["']/i);
        const titleMatch = art.match(/class=["']entry-title["'][^>]*>([\s\S]*?)<\/(?:h2|h3|h1|a)>/i);
        const numMatch = art.match(/class=["']num-epi["']>([^<]+)</i);
        const imgMatch = art.match(/(?:data-src|data-lazy-src|src)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);

        if (linkMatch) {
          idx++;
          const numStr = numMatch ? numMatch[1].trim() : String(idx);
          const epNum = parseInt(numStr.match(/\d+/)?.[0] || String(idx), 10);
          const title = titleMatch ? this.cleanTitle(titleMatch[1]) : `Episode ${epNum}`;
          const fullLink = linkMatch[1].startsWith('http') ? linkMatch[1] : new URL(linkMatch[1], this.baseUrl).href;

          episodes.push({
            id: fullLink,
            title,
            episodeNumber: epNum,
            link: fullLink,
            url: fullLink,
            image: this.normalizeImageUrl(imgMatch ? imgMatch[1] : '')
          });
        }
      }

      if (episodes.length === 0) {
        const aRegex = /<a[^>]*href=["'](https?:\/\/[^"']*\/episode\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let am;
        const seen = new Set();
        while ((am = aRegex.exec(html)) !== null) {
          const epUrl = am[1];
          if (seen.has(epUrl)) continue;
          seen.add(epUrl);
          idx++;
          const text = this.cleanTitle(am[2]) || `Episode ${idx}`;
          const numMatch = text.match(/(?:ep|episode|x)\s*(\d+)/i) || text.match(/\b(\d+)\b/);
          const epNum = numMatch ? parseInt(numMatch[1], 10) : idx;

          episodes.push({
            id: epUrl,
            title: text,
            episodeNumber: epNum,
            link: epUrl,
            url: epUrl
          });
        }
      }

      return episodes;
    } catch (err) {
      console.warn('[AnimeSalt] Episode list error:', err?.message || err);
      return [];
    }
  }

  /**
   * Resolve Ravok Buzz embed player into Master HLS (.m3u8) stream and sub-qualities
   */
  async resolveRavokEmbed(embedUrlOrHash) {
    let hash = embedUrlOrHash;
    if (embedUrlOrHash.includes('/')) {
      const parts = embedUrlOrHash.split('?')[0].split('/');
      hash = parts[parts.length - 1] || parts[parts.length - 2];
    }
    if (!hash) return [];

    try {
      const apiUrl = `https://ravok.buzz/player/index.php?data=${hash}&do=getVideo`;
      const postData = `hash=${encodeURIComponent(hash)}&r=https://animesalt.cx/`;

      const text = await this.httpPost(apiUrl, postData, {
        Referer: `https://ravok.buzz/video/${hash}`,
        Origin: 'https://ravok.buzz',
        'X-Requested-With': 'XMLHttpRequest'
      });

      const data = JSON.parse(text);
      const streamUrl = data?.videoSource || data?.securedLink;
      if (!streamUrl || typeof streamUrl !== 'string') return [];

      const streams = [];
      const masterHeaders = {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://ravok.buzz/',
        Origin: 'https://ravok.buzz'
      };

      streams.push({
        server: 'Ravok Play (Master HLS)',
        link: streamUrl,
        type: 'hls',
        quality: '1080p',
        headers: masterHeaders
      });

      // Parse Master .m3u8 playlist for individual qualities
      try {
        const m3u8Text = await this.httpGet(streamUrl, masterHeaders, 6000);
        if (m3u8Text.includes('#EXT-X-STREAM-INF')) {
          const lines = m3u8Text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF')) {
              const qualityMatch = line.match(/NAME="([^"]+)"/) || line.match(/RESOLUTION=\d+x(\d+)/);
              const qualityStr = qualityMatch ? (qualityMatch[1].endsWith('p') ? qualityMatch[1] : `${qualityMatch[1]}p`) : undefined;
              const uriLine = lines[i + 1]?.trim();
              if (uriLine && !uriLine.startsWith('#')) {
                const subStreamUrl = uriLine.startsWith('http')
                  ? uriLine
                  : `https://ravok.buzz${uriLine.startsWith('/') ? '' : '/'}${uriLine}`;
                streams.push({
                  server: `Ravok Play (${qualityStr || 'HLS'})`,
                  link: subStreamUrl,
                  type: 'hls',
                  quality: qualityStr,
                  headers: masterHeaders
                });
              }
            }
          }
        }
      } catch (_) {}

      return streams;
    } catch (err) {
      console.warn('[AnimeSalt] Ravok resolve error:', err?.message || err);
      return [];
    }
  }

  /**
   * Resolve streams for any anime episode or movie page URL
   */
  async getStreams(pageUrl) {
    const html = await this.httpGet(pageUrl);
    const streams = [];

    // 1. Ravok Buzz player iframe or raw link
    const ravokMatch = html.match(/https?:\/\/ravok\.buzz\/video\/([a-zA-Z0-9_-]+)/i);
    if (ravokMatch) {
      const ravokStreams = await this.resolveRavokEmbed(ravokMatch[1]);
      streams.push(...ravokStreams);
    }

    // 2. Plyr Multi-language embeds (Abyss Player)
    const plyrMatch = html.match(/player\.php\?data=([A-Za-z0-9+/=]+)/);
    if (plyrMatch) {
      try {
        const decoded = safeDecodeBase64(plyrMatch[1]);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.link) {
              streams.push({
                server: `Abyss Player (${item.language || 'Multi-Audio'})`,
                link: item.link,
                type: 'embed',
                quality: '1080p',
                headers: {
                  'User-Agent': DEFAULT_USER_AGENT,
                  Referer: `${this.baseUrl}/`
                }
              });
            }
          }
        }
      } catch (_) {}
    }

    return streams;
  }

  /**
   * Primary Entry Point for ExtensionManager & VLC Player
   * Returns direct 1-Click Playable Stream with Multi-Quality support
   */
  async getPlayableStream(idOrUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1, audioLanguage) {
    let targetUrl = idOrUrl;
    const isEpisodeUrl = targetUrl.includes('/episode/');

    if (!isEpisodeUrl && (isTVShow || targetUrl.includes('/series/'))) {
      const details = await this.extractDetails(targetUrl, seasonNumber);
      if (details.episodes && details.episodes.length > 0) {
        const ep = details.episodes.find(e => e.episodeNumber === episodeNumber) || details.episodes[episodeNumber - 1] || details.episodes[0];
        if (ep && ep.link) {
          targetUrl = ep.link;
        }
      }
    }

    console.log(`[AnimeSalt] Resolving anime stream for: ${targetUrl}`);
    const streams = await this.getStreams(targetUrl);

    if (!streams || streams.length === 0) {
      throw new Error(`No working anime video streams found on AnimeSalt.cx for ${targetUrl}`);
    }

    // Master HLS Stream is primary
    const masterStream = streams.find(s => s.server.includes('Master')) || streams.find(s => s.type === 'hls') || streams[0];

    const qualities = {};
    for (const s of streams) {
      if (s.quality && !qualities[s.quality] && s.type === 'hls') {
        qualities[s.quality] = s.link;
      }
    }
    if (!qualities['1080p'] && masterStream) {
      qualities['1080p'] = masterStream.link;
    }

    // Map audio dub options if present from Abyss player
    const audioTracks = [];
    streams.filter(s => s.server.includes('Abyss Player')).forEach((s, idx) => {
      const langMatch = s.server.match(/\(([^)]+)\)/);
      const lang = langMatch ? langMatch[1] : `Audio ${idx + 1}`;
      audioTracks.push({
        id: `animesalt_audio_${idx}`,
        name: `${lang} Audio`,
        label: `${lang} Audio`,
        language: lang,
        streamUrl: s.link,
        isProviderDub: true
      });
    });

    return {
      streamUrl: masterStream.link,
      qualities,
      quality: '1080p',
      server: 'Server 4 (AnimeSalt Direct Stream)',
      headers: masterStream.headers || {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://ravok.buzz/',
        Origin: 'https://ravok.buzz'
      },
      mimeType: masterStream.type === 'hls' ? 'application/x-mpegURL' : 'video/mp4',
      supports206: true,
      audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
      subtitles: []
    };
  }
}

export const AnimeSalt = new AnimeSaltClient();
export default AnimeSalt;
