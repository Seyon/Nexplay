const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_BASE_URL = 'https://net79.cc';
const DEFAULT_PROXY_WORKER = 'https://streamhub-proxy.1545zoya.workers.dev';

export const LIBVLC_NET79_OPTIONS = [
  ':http-referrer=https://moviebox.ph/',
  `:http-user-agent=${DEFAULT_USER_AGENT}`
];

/**
 * Net79 (NetMirror) All-in-One Client for NexPlay & Stitch-Nexplay
 * Specialized for Android LibVLC and Media3 ExoPlayer
 */
export class Net79Client {
  constructor(baseUrl = DEFAULT_BASE_URL, proxyWorker = DEFAULT_PROXY_WORKER) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.proxyWorker = proxyWorker.replace(/\/+$/, '');
    this.mirrors = [this.baseUrl];
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
    if (config.proxyWorker) this.proxyWorker = config.proxyWorker.replace(/\/+$/, '');
  }

  async httpGet(url, customHeaders = {}) {
    const headers = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      Referer: `${this.baseUrl}/`,
      ...customHeaders
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), 12000);

    try {
      const resp = await fetch(url, {
        headers,
        signal: controller ? controller.signal : undefined
      });
      return await resp.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  cleanTitle(title) {
    return (title || '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseTmdbParam(param, defaultType = 'movie') {
    let tmdbId = 0;
    let type = defaultType;
    let season = 1;
    let episode = 1;

    if (typeof param === 'number') {
      return { tmdbId: param, type, season, episode };
    }

    const str = String(param);

    // 1. Support Net79 URL schema: #w=1367220-movie, #w=247718-tv
    const hashMatch = str.match(/#w=(\d+)-(movie|tv)/i);
    if (hashMatch) {
      tmdbId = parseInt(hashMatch[1], 10);
      type = hashMatch[2].toLowerCase() === 'tv' ? 'tv' : 'movie';
    } else {
      const idMatch = str.match(/\/watch-tmdb\/(\d+)/i) || str.match(/\/embed-tmdb\/(\d+)/i) || str.match(/^(\d+)$/);
      if (idMatch) {
        tmdbId = parseInt(idMatch[1], 10);
      }

      const typeMatch = str.match(/[?&]type=(movie|tv|series)/i);
      if (typeMatch) {
        type = typeMatch[1].toLowerCase() === 'series' ? 'tv' : typeMatch[1].toLowerCase();
      }
    }

    // Check for season & episode in format #w=247718-tv-1-2 or params
    const dashSeEpMatch = str.match(/#w=\d+-tv[_\-](\d+)[_\-](\d+)/i);
    if (dashSeEpMatch) {
      season = parseInt(dashSeEpMatch[1], 10);
      episode = parseInt(dashSeEpMatch[2], 10);
    } else {
      const seMatch = str.match(/[?&#]se=(\d+)/i) || str.match(/[?&#]season=(\d+)/i);
      if (seMatch) {
        season = parseInt(seMatch[1], 10);
      }

      const epMatch = str.match(/[?&#]ep=(\d+)/i) || str.match(/[?&#]episode=(\d+)/i);
      if (epMatch) {
        episode = parseInt(epMatch[1], 10);
      }
    }

    return { tmdbId, type, season, episode };
  }

  async search(query, page = 1) {
    const clean = query.trim();
    if (!clean) return [];

    const searchUrl = `${this.baseUrl}/api/catalog/search-hybrid?q=${encodeURIComponent(clean)}&page=${page}`;
    try {
      const text = await this.httpGet(searchUrl);
      const data = JSON.parse(text);
      const items = Array.isArray(data?.items) ? data.items : [];

      return items.map((item) => {
        const title = item.title || '';
        const yearNum = item.year ? parseInt(item.year, 10) : undefined;
        const mediaType = item.type === 'tv' ? 'series' : 'movie';
        const isTv = item.type === 'tv';
        const watchUrl = `${this.baseUrl}/#w=${item.tmdbId}-${isTv ? 'tv' : 'movie'}`;

        return {
          id: String(item.tmdbId),
          title,
          cleanTitle: this.cleanTitle(title),
          url: watchUrl,
          thumbnail: item.poster || item.backdrop,
          year: !isNaN(yearNum) ? yearNum : undefined,
          type: mediaType,
          mediaType: item.type,
          provider: 'net79'
        };
      });
    } catch (err) {
      console.warn('[Net79] Search error:', err?.message || err);
      return [];
    }
  }

  async getTrending(window = 'day') {
    const url = `${this.baseUrl}/api/catalog/trending?window=${window}`;
    try {
      const text = await this.httpGet(url);
      const data = JSON.parse(text);
      const items = Array.isArray(data?.items || data?.results) ? data.items || data.results : [];

      return items.map((item) => {
        const title = item.title || item.name || '';
        const yearStr = item.year || (item.release_date || item.first_air_date || '').split('-')[0];
        const yearNum = parseInt(yearStr, 10);
        const mediaType = item.type === 'tv' || item.media_type === 'tv' ? 'series' : 'movie';
        const tmdbId = item.tmdbId || item.id;
        const isTv = mediaType === 'series';
        const watchUrl = `${this.baseUrl}/#w=${tmdbId}-${isTv ? 'tv' : 'movie'}`;

        return {
          id: String(tmdbId),
          title,
          cleanTitle: this.cleanTitle(title),
          url: watchUrl,
          thumbnail: item.poster || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined),
          year: !isNaN(yearNum) ? yearNum : undefined,
          type: mediaType,
          mediaType: mediaType === 'series' ? 'tv' : 'movie',
          provider: 'net79'
        };
      });
    } catch {
      return [];
    }
  }

  async getAvailableAudioTracks(idOrUrl, type = 'movie') {
    const { tmdbId, type: parsedType } = this.parseTmdbParam(idOrUrl, type === 'series' ? 'tv' : type);
    const mediaType = type === 'series' ? 'tv' : type || parsedType;

    try {
      const titleUrl = `${this.baseUrl}/api/catalog/title/${mediaType}/${tmdbId}`;
      const titleText = await this.httpGet(titleUrl);
      const titleData = JSON.parse(titleText);
      const title = titleData?.title;
      if (!title) return [];

      const yearParam = titleData.year ? `&year=${titleData.year}` : '';
      const resolveUrl = `${this.baseUrl}/api/aoneroom/resolve?type=${mediaType}&title=${encodeURIComponent(title)}${yearParam}`;
      const resolveText = await this.httpGet(resolveUrl);
      const resolveData = JSON.parse(resolveText);

      if (!Array.isArray(resolveData?.dubs)) {
        return [
          {
            name: 'Original Audio',
            langCode: 'en',
            subjectId: resolveData?.subjectId || String(tmdbId),
            detailPath: resolveData?.detailPath,
            isOriginal: true
          }
        ];
      }

      const tracks = resolveData.dubs
        .filter((d) => !d.lanName.toLowerCase().includes('sub'))
        .map((d) => ({
          name: d.lanName,
          langCode: d.lanCode,
          subjectId: String(d.subjectId),
          detailPath: d.detailPath,
          isOriginal: d.lanCode === 'en' || d.lanName.toLowerCase().includes('original')
        }));

      tracks.sort((a, b) => (b.isOriginal ? 1 : 0) - (a.isOriginal ? 1 : 0));
      return tracks;
    } catch {
      return [];
    }
  }

  async extractDetails(idOrUrl, targetSeason = 1, isTV) {
    const { tmdbId, type: parsedType } = this.parseTmdbParam(idOrUrl, isTV ? 'tv' : undefined);
    const type = isTV !== undefined ? (isTV ? 'tv' : 'movie') : parsedType;
    const mediaType = type === 'tv' ? 'series' : 'movie';

    let titleData = null;
    try {
      const titleUrl = `${this.baseUrl}/api/catalog/title/${type}/${tmdbId}`;
      const text = await this.httpGet(titleUrl);
      titleData = JSON.parse(text);
    } catch {
      // ignore
    }

    const title = titleData?.title || `Title ${tmdbId}`;
    const yearNum = titleData?.year ? parseInt(titleData.year, 10) : undefined;
    const thumbnail = titleData?.poster || titleData?.backdrop;
    const synopsis = titleData?.overview || titleData?.tagline;

    const audioTracks = await this.getAvailableAudioTracks(tmdbId, type);
    const seasons = [];
    let initialEpisodes = [];

    if (type === 'tv') {
      const rawSeasons = Array.isArray(titleData?.seasons) ? titleData.seasons : [];
      for (const s of rawSeasons) {
        const sNum = s.season_number;
        if (sNum <= 0) continue;

        try {
          const seasonUrl = `${this.baseUrl}/api/catalog/season/${tmdbId}/${sNum}`;
          const seasonText = await this.httpGet(seasonUrl);
          const seasonData = JSON.parse(seasonText);
          const rawEps = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];

          const episodes = rawEps.map((ep) => ({
            episodeNumber: ep.episode,
            title: ep.name ? `Episode ${ep.episode}: ${ep.name}` : `Episode ${ep.episode}`,
            links: [
              {
                title: `Episode ${ep.episode}`,
                url: `${this.baseUrl}/#w=${tmdbId}-tv&se=${sNum}&ep=${ep.episode}`,
                server: 'NetMirror Server 4 [Universal Stream 1080p]',
                quality: '1080p'
              }
            ]
          }));

          seasons.push({ seasonNumber: sNum, episodes });
          if (sNum === targetSeason) {
            initialEpisodes = episodes;
          }
        } catch {
          // ignore
        }
      }

      if (initialEpisodes.length === 0 && seasons.length > 0) {
        initialEpisodes = seasons[0].episodes;
      }
    }

    const streamingLinks = await this.resolveStream(tmdbId, {
      type,
      season: targetSeason,
      episode: 1
    });

    return {
      title,
      cleanTitle: this.cleanTitle(title),
      url: `${this.baseUrl}/#w=${tmdbId}-${type}`,
      mediaType,
      thumbnail,
      year: !isNaN(yearNum) ? yearNum : undefined,
      quality: streamingLinks[0]?.quality || '1080p',
      synopsis,
      streamingLinks,
      audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
      seasons: seasons.length > 0 ? seasons : undefined,
      episodes: initialEpisodes.length > 0 ? initialEpisodes : undefined
    };
  }

  async resolveStream(idOrUrl, options = {}) {
    const { tmdbId, type: parsedType, season: parsedSeason, episode: parsedEpisode } = this.parseTmdbParam(idOrUrl);
    const mediaType = (options.isTVShow ? 'tv' : options.type || parsedType) || 'movie';
    const season = options.season || options.seasonNumber || parsedSeason || 1;
    const episode = options.episode || options.episodeNumber || parsedEpisode || 1;

    let dubParam = '';
    let activeTrackName = null;
    let activeLangCode = 'en';

    if (options.dubSubjectId) {
      dubParam = `&dub=${options.dubSubjectId}`;
      activeLangCode = options.audioLanguage || 'custom';
      activeTrackName = 'Custom Dub';
    } else if (options.audioLanguage && !['en', 'english', 'original'].includes(options.audioLanguage.toLowerCase().trim())) {
      const tracks = await this.getAvailableAudioTracks(tmdbId, mediaType);
      const req = options.audioLanguage.toLowerCase().trim();
      const matched = tracks.find(
        (t) =>
          t.langCode.toLowerCase() === req ||
          t.name.toLowerCase().includes(req) ||
          t.name.toLowerCase().replace(/\s+dub|\s+audio/g, '').trim() === req
      );
      if (matched && !matched.isOriginal) {
        dubParam = `&dub=${matched.subjectId}&dubdp=${encodeURIComponent(matched.detailPath || '')}`;
        activeTrackName = matched.name;
        activeLangCode = matched.langCode;
      }
    }

    const embedApiUrl = `${this.baseUrl}/api/embed-tmdb/${tmdbId}?type=${mediaType}&se=${season}&ep=${episode}${dubParam}`;
    const results = [];

    try {
      const text = await this.httpGet(embedApiUrl);
      const data = JSON.parse(text);

      if (data?.ok) {
        const sig = data.sig;
        const exp = data.exp;
        const streams = Array.isArray(data.streams) ? data.streams : [];
        const langSuffix = activeTrackName ? ` (${activeTrackName})` : '';

        const sorted = [...streams].sort((a, b) => b.resolution - a.resolution);

        for (const s of sorted) {
          const quality = `${s.resolution}p`;
          const sizeStr = s.size ? `${(s.size / (1024 * 1024)).toFixed(0)} MB` : undefined;

          // 1. Universal Proxy Stream (Server 4)
          const universalProxyUrl = `${this.baseUrl}/api/proxy/video?url=${encodeURIComponent(s.url)}&ref=${encodeURIComponent('https://moviebox.ph/')}&direct=1`;
          results.push({
            quality,
            url: universalProxyUrl,
            originalUrl: embedApiUrl,
            server: `NetMirror Server 4 [Universal Stream ${quality}]${langSuffix}`,
            type: 'direct',
            size: sizeStr,
            audioLanguage: activeLangCode,
            audioTrackName: activeTrackName || 'Original Audio',
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            mimeType: 'video/mp4'
          });

          // 2. Direct CDN Stream (Server 4)
          results.push({
            quality,
            url: s.url,
            originalUrl: embedApiUrl,
            server: `NetMirror Server 4 [Direct CDN ${quality}]${langSuffix}`,
            type: 'direct',
            size: sizeStr,
            audioLanguage: activeLangCode,
            audioTrackName: activeTrackName || 'Original Audio',
            headers: {
              'User-Agent': DEFAULT_USER_AGENT,
              Referer: 'https://moviebox.ph/'
            },
            mimeType: 'video/mp4'
          });

          // 3. Cloudflare Signed Proxy (Server 4)
          if (sig && exp) {
            const workerUrl = `${this.proxyWorker}/?url=${encodeURIComponent(s.url)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
            results.push({
              quality,
              url: workerUrl,
              originalUrl: embedApiUrl,
              server: `NetMirror Server 4 [Cloudflare Proxy ${quality}]${langSuffix}`,
              type: 'direct',
              size: sizeStr,
              audioLanguage: activeLangCode,
              audioTrackName: activeTrackName || 'Original Audio',
              headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                Referer: 'https://moviebox.ph/'
              },
              mimeType: 'video/mp4'
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // Server 1 direct streams only (Server 2 skipped as requested)
    return results;
  }

  async getPlayableStream(idOrUrl, isTVShow = false, episodeNumber = 1, seasonNumber = 1, audioLanguage) {
    const parsed = this.parseTmdbParam(idOrUrl, isTVShow ? 'tv' : 'movie');
    const effectiveIsTV = parsed.type === 'tv' || isTVShow;
    const effectiveEpisode = parsed.episode || episodeNumber;
    const effectiveSeason = parsed.season || seasonNumber;

    const streams = await this.resolveStream(idOrUrl, {
      isTVShow: effectiveIsTV,
      episodeNumber: effectiveEpisode,
      seasonNumber: effectiveSeason,
      audioLanguage
    });

    if (!streams || streams.length === 0) return null;

    const preferred =
      streams.find((s) => s.server.includes('Universal Stream') && s.quality === '1080p') ||
      streams.find((s) => s.quality === '1080p') ||
      streams[0];

    // Discover available audio dubs so VLC player audio selector can hot-swap languages
    let audioTracks = [];
    try {
      const rawTracks = await this.getAvailableAudioTracks(parsed.tmdbId || idOrUrl, effectiveIsTV ? 'tv' : 'movie');
      if (Array.isArray(rawTracks) && rawTracks.length > 0) {
        audioTracks = rawTracks.map((t, idx) => ({
          id: t.langCode || String(idx),
          trackId: idx,
          name: t.name,
          label: t.name,
          language: t.name,
          displayLabel: t.name,
          langCode: t.langCode,
          subjectId: t.subjectId,
          detailPath: t.detailPath,
          isOriginal: Boolean(t.isOriginal),
          isProviderDub: true
        }));
      }
    } catch (_) {}

    return {
      title: `TMDB ${parsed.tmdbId || idOrUrl}`,
      tmdbId: parsed.tmdbId || idOrUrl,
      isTVShow: effectiveIsTV,
      episodeNumber: effectiveIsTV ? effectiveEpisode : undefined,
      seasonNumber: effectiveIsTV ? effectiveSeason : undefined,
      streamUrl: preferred.url,
      headers: preferred.headers || { 'User-Agent': DEFAULT_USER_AGENT },
      mimeType: preferred.mimeType || 'video/mp4',
      quality: preferred.quality,
      server: preferred.server,
      audioLanguage: preferred.audioLanguage,
      audioTrackName: preferred.audioTrackName,
      audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
      backupStreams: streams.filter((s) => s.url !== preferred.url),
      media3Config: {
        uri: preferred.url,
        headers: preferred.headers || { 'User-Agent': DEFAULT_USER_AGENT },
        mimeType: preferred.mimeType || 'video/mp4',
        quality: preferred.quality,
        server: preferred.server,
        libVlcOptions: LIBVLC_NET79_OPTIONS
      }
    };
  }
}

export const Net79 = new Net79Client();

