/**
 * AnimeDatabase.js
 * 
 * Persistent local database and catalogue store for NexPlay Anime Universe.
 * 
 * Features:
 * - Uses NexPlay internal IDs (`np_anime_${mal_id}`) as primary keys
 * - Keeps MyAnimeList (MAL) IDs as external provider identifiers
 * - Normalized table collections:
 *   - anime
 *   - anime_titles
 *   - external_provider_ids
 *   - genres & anime_genres
 *   - studios & anime_studios
 *   - anime_relations
 *   - episodes
 *   - anime_images
 *   - user_anime_watchlist
 *   - user_anime_progress
 *   - sync_logs
 * - Incremental & Resumable ingestion engine
 * - Full pagination, filtering, sorting, and full-text search
 * - Dual persistence via expo-file-system/legacy and new File API (Expo SDK 57 compatible)
 */

import StorageAdapter from './StorageAdapter.js';

const DB_FILE_NAME = 'nexplay_anime_db.json';

class AnimeDatabase {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
    this.saveDebounceTimer = null;

    // Database Tables
    this.tables = {
      anime: new Map(),                  // id -> anime record
      anime_titles: new Map(),           // anime_id -> titles record
      external_provider_ids: new Map(),  // id -> external id mapping
      genres: new Map(),                 // id -> genre record
      anime_genres: new Map(),           // id -> { anime_id, genre_id, name }
      studios: new Map(),                // id -> studio record
      anime_studios: new Map(),          // id -> { anime_id, studio_id, name }
      anime_relations: new Map(),        // id -> relation record
      episodes: new Map(),               // id -> episode record
      anime_images: new Map(),           // anime_id -> images record
      user_anime_watchlist: new Map(),   // anime_id -> watchlist record
      user_anime_progress: new Map(),    // key -> progress record
      sync_logs: []                      // array of sync log entries
    };

    // Incremental Ingestion State Tracker
    this.ingestionState = {
      trendingPage: 1,
      popularPage: 1,
      topRatedPage: 1,
      airingPage: 1,
      upcomingPage: 1,
      moviesPage: 1,
      lastSyncTimestamp: 0
    };

    this.listeners = new Set();
  }

  getDocumentDir() {
    if (FileSystem && FileSystem.documentDirectory) {
      return FileSystem.documentDirectory;
    }
    if (Paths && Paths.document) {
      const uri = Paths.document.uri || (typeof Paths.document === 'string' ? Paths.document : '');
      if (uri) return uri.endsWith('/') ? uri : `${uri}/`;
    }
    return 'file:///data/user/0/com.anonymous.Stitchnexplay/files/';
  }

  getDbFilePath() {
    return `${this.getDocumentDir()}${DB_FILE_NAME}`;
  }

  /**
   * Helper to format NexPlay internal ID from MAL ID
   */
  generateInternalId(malId) {
    if (!malId) return `np_anime_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    return `np_anime_${malId}`;
  }

  /**
   * Extract MAL ID from internal ID or return malId directly
   */
  extractMalId(idOrMalId) {
    if (!idOrMalId) return null;
    const str = String(idOrMalId);
    if (str.startsWith('np_anime_')) {
      const parsed = parseInt(str.replace('np_anime_', ''), 10);
      return !isNaN(parsed) ? parsed : str;
    }
    const num = parseInt(str, 10);
    return !isNaN(num) ? num : str;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(eventType, payload) {
    this.listeners.forEach(l => {
      try {
        if (typeof l === 'function') l({ eventType, payload });
      } catch (e) {
        console.warn('[AnimeDatabase] Listener error:', e);
      }
    });
  }

  /**
   * Initialize and hydrate database from local disk
   */
  async init() {
    if (this.isInitialized) return this;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const content = await StorageAdapter.readText(DB_FILE_NAME);

        if (content) {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') {
            // Hydrate maps from parsed JSON objects
            if (parsed.anime) this.tables.anime = new Map(Object.entries(parsed.anime));
            if (parsed.anime_titles) this.tables.anime_titles = new Map(Object.entries(parsed.anime_titles));
            if (parsed.external_provider_ids) this.tables.external_provider_ids = new Map(Object.entries(parsed.external_provider_ids));
            if (parsed.genres) this.tables.genres = new Map(Object.entries(parsed.genres));
            if (parsed.anime_genres) this.tables.anime_genres = new Map(Object.entries(parsed.anime_genres));
            if (parsed.studios) this.tables.studios = new Map(Object.entries(parsed.studios));
            if (parsed.anime_studios) this.tables.anime_studios = new Map(Object.entries(parsed.anime_studios));
            if (parsed.anime_relations) this.tables.anime_relations = new Map(Object.entries(parsed.anime_relations));
            if (parsed.episodes) this.tables.episodes = new Map(Object.entries(parsed.episodes));
            if (parsed.anime_images) this.tables.anime_images = new Map(Object.entries(parsed.anime_images));
            if (parsed.user_anime_watchlist) this.tables.user_anime_watchlist = new Map(Object.entries(parsed.user_anime_watchlist));
            if (parsed.user_anime_progress) this.tables.user_anime_progress = new Map(Object.entries(parsed.user_anime_progress));
            if (Array.isArray(parsed.sync_logs)) this.tables.sync_logs = parsed.sync_logs;
            if (parsed.ingestionState) this.ingestionState = { ...this.ingestionState, ...parsed.ingestionState };
          }
        }
      } catch (err) {
        console.warn('[AnimeDatabase] Failed to load local database:', err?.message || err);
      } finally {
        this.isInitialized = true;
      }
      return this;
    })();

    return this.initPromise;
  }

  /**
   * Persist database tables to disk (Debounced)
   */
  async persist() {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(async () => {
      try {
        const payload = {
          version: 1,
          updatedAt: Date.now(),
          ingestionState: this.ingestionState,
          anime: Object.fromEntries(this.tables.anime),
          anime_titles: Object.fromEntries(this.tables.anime_titles),
          external_provider_ids: Object.fromEntries(this.tables.external_provider_ids),
          genres: Object.fromEntries(this.tables.genres),
          anime_genres: Object.fromEntries(this.tables.anime_genres),
          studios: Object.fromEntries(this.tables.studios),
          anime_studios: Object.fromEntries(this.tables.anime_studios),
          anime_relations: Object.fromEntries(this.tables.anime_relations),
          episodes: Object.fromEntries(this.tables.episodes),
          anime_images: Object.fromEntries(this.tables.anime_images),
          user_anime_watchlist: Object.fromEntries(this.tables.user_anime_watchlist),
          user_anime_progress: Object.fromEntries(this.tables.user_anime_progress),
          sync_logs: this.tables.sync_logs.slice(0, 100) // Keep last 100 logs
        };

        const jsonStr = JSON.stringify(payload);
        await StorageAdapter.writeText(DB_FILE_NAME, jsonStr);
      } catch (err) {
        console.warn('[AnimeDatabase] Failed to persist database:', err?.message || err);
      }
    }, 1500);
  }

  // ==========================================
  // INGESTION & NORMALIZATION
  // ==========================================

  /**
   * Ingest / Upsert a single raw Tenrai / MAL anime payload into normalized tables
   * @param {Object} raw - Raw anime object from Tenrai API
   * @returns {string} internal NexPlay ID
   */
  ingestAnimeItem(raw) {
    if (!raw || !raw.mal_id) return null;
    const malId = Number(raw.mal_id);
    const internalId = this.generateInternalId(malId);
    const now = Date.now();

    // 1. Ingest Anime core table
    const existingAnime = this.tables.anime.get(internalId) || {};
    const normalizedAnime = {
      id: internalId,
      mal_id: malId,
      type: raw.type || existingAnime.type || 'TV',
      source: raw.source || existingAnime.source || 'Original',
      episodes: raw.episodes != null ? Number(raw.episodes) : (existingAnime.episodes || null),
      status: raw.status || existingAnime.status || 'Finished Airing',
      airing: Boolean(raw.airing ?? (raw.status === 'Currently Airing')),
      duration: raw.duration || existingAnime.duration || '24 min',
      rating: raw.rating || existingAnime.rating || 'PG-13',
      score: raw.score != null ? Number(raw.score) : (existingAnime.score || 0),
      scored_by: raw.scored_by != null ? Number(raw.scored_by) : (existingAnime.scored_by || 0),
      rank: raw.rank != null ? Number(raw.rank) : (existingAnime.rank || null),
      popularity: raw.popularity != null ? Number(raw.popularity) : (existingAnime.popularity || null),
      members: raw.members != null ? Number(raw.members) : (existingAnime.members || 0),
      favorites: raw.favorites != null ? Number(raw.favorites) : (existingAnime.favorites || 0),
      synopsis: raw.synopsis || existingAnime.synopsis || 'No synopsis available.',
      background: raw.background || existingAnime.background || '',
      season: raw.season || existingAnime.season || null,
      year: raw.year != null ? Number(raw.year) : (existingAnime.year || null),
      aired_string: raw.aired?.string || existingAnime.aired_string || '',
      aired_from: raw.aired?.from || existingAnime.aired_from || null,
      aired_to: raw.aired?.to || existingAnime.aired_to || null,
      created_at: existingAnime.created_at || now,
      updated_at: now
    };
    this.tables.anime.set(internalId, normalizedAnime);

    // 2. Ingest Anime Titles
    const titlesRecord = {
      id: `np_title_${internalId}`,
      anime_id: internalId,
      title: raw.title || existingAnime.title || 'Unknown Title',
      title_english: raw.title_english || raw.title || '',
      title_japanese: raw.title_japanese || '',
      title_synonyms: Array.isArray(raw.title_synonyms) ? raw.title_synonyms : []
    };
    this.tables.anime_titles.set(internalId, titlesRecord);

    // 3. Ingest External Provider IDs
    const extId = `np_ext_${internalId}_mal`;
    this.tables.external_provider_ids.set(extId, {
      id: extId,
      anime_id: internalId,
      provider: 'myanimelist',
      external_id: String(malId)
    });

    // 4. Ingest Images & Metadata
    const imagesRecord = {
      id: `np_img_${internalId}`,
      anime_id: internalId,
      poster_url: raw.images?.jpg?.large_image_url || raw.images?.jpg?.image_url || raw.images?.webp?.large_image_url || null,
      backdrop_url: raw.images?.jpg?.large_image_url || raw.images?.jpg?.image_url || null,
      small_url: raw.images?.jpg?.small_image_url || null,
      large_url: raw.images?.jpg?.large_image_url || null,
      webp_url: raw.images?.webp?.image_url || null,
      trailer_url: raw.trailer?.url || raw.trailer?.embed_url || null,
      trailer_thumbnail: raw.trailer?.images?.maximum_image_url || raw.trailer?.images?.large_image_url || null
    };
    this.tables.anime_images.set(internalId, imagesRecord);

    // 5. Ingest Genres
    if (Array.isArray(raw.genres)) {
      raw.genres.forEach(g => {
        if (!g || !g.name) return;
        const gMalId = g.mal_id || g.id;
        const genreId = `np_genre_${gMalId || g.name.toLowerCase().replace(/\s+/g, '_')}`;
        this.tables.genres.set(genreId, {
          id: genreId,
          name: g.name,
          mal_id: gMalId
        });

        const animeGenreKey = `np_ag_${internalId}_${genreId}`;
        this.tables.anime_genres.set(animeGenreKey, {
          id: animeGenreKey,
          anime_id: internalId,
          genre_id: genreId,
          name: g.name
        });
      });
    }

    // 6. Ingest Studios / Producers
    if (Array.isArray(raw.studios)) {
      raw.studios.forEach(s => {
        if (!s || !s.name) return;
        const sMalId = s.mal_id || s.id;
        const studioId = `np_studio_${sMalId || s.name.toLowerCase().replace(/\s+/g, '_')}`;
        this.tables.studios.set(studioId, {
          id: studioId,
          name: s.name,
          mal_id: sMalId
        });

        const animeStudioKey = `np_as_${internalId}_${studioId}`;
        this.tables.anime_studios.set(animeStudioKey, {
          id: animeStudioKey,
          anime_id: internalId,
          studio_id: studioId,
          name: s.name
        });
      });
    }

    this.persist();
    return internalId;
  }

  /**
   * Bulk Ingest a list of raw anime items
   */
  ingestAnimeBatch(rawList = []) {
    if (!Array.isArray(rawList)) return [];
    const ids = [];
    rawList.forEach(raw => {
      const id = this.ingestAnimeItem(raw);
      if (id) ids.push(id);
    });
    return ids;
  }

  /**
   * Ingest Episodes for an Anime
   */
  ingestEpisodes(animeIdOrMalId, episodes = []) {
    if (!Array.isArray(episodes) || episodes.length === 0) return;
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));

    episodes.forEach(ep => {
      const epNum = ep.mal_id || ep.episode_number || ep.number;
      if (!epNum) return;
      const epKey = `np_ep_${internalId}_${epNum}`;

      this.tables.episodes.set(epKey, {
        id: epKey,
        anime_id: internalId,
        episode_number: Number(epNum),
        title: ep.title || `Episode ${epNum}`,
        title_japanese: ep.title_japanese || null,
        title_romanji: ep.title_romanji || null,
        aired: ep.aired || null,
        score: ep.score != null ? Number(ep.score) : null,
        filler: Boolean(ep.filler),
        recap: Boolean(ep.recap),
        synopsis: ep.synopsis || null,
        video_url: ep.video_url || null
      });
    });

    this.persist();
  }

  /**
   * Ingest Relations for an Anime
   */
  ingestRelations(animeIdOrMalId, relations = []) {
    if (!Array.isArray(relations) || relations.length === 0) return;
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));

    relations.forEach(relGroup => {
      const relType = relGroup.relation || 'Related';
      const entries = Array.isArray(relGroup.entry) ? relGroup.entry : [];

      entries.forEach(entry => {
        if (!entry || !entry.mal_id) return;
        const relKey = `np_rel_${internalId}_${entry.mal_id}`;
        const relatedInternalId = this.generateInternalId(entry.mal_id);

        this.tables.anime_relations.set(relKey, {
          id: relKey,
          anime_id: internalId,
          relation_type: relType,
          related_anime_id: this.tables.anime.has(relatedInternalId) ? relatedInternalId : null,
          related_mal_id: Number(entry.mal_id),
          related_title: entry.name || entry.title || 'Related Anime',
          related_type: entry.type || 'anime',
          related_media_type: entry.media_type || 'TV',
          related_image: entry.images?.jpg?.large_image_url || entry.images?.jpg?.image_url || null
        });
      });
    });

    this.persist();
  }

  /**
   * Log synchronization event
   */
  logSync(syncType, itemsSynced, status, error = null, durationMs = 0) {
    const entry = {
      id: `np_sync_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sync_type: syncType,
      timestamp: Date.now(),
      items_synced: itemsSynced,
      status,
      error: error ? String(error) : null,
      duration_ms: durationMs
    };
    this.tables.sync_logs.unshift(entry);
    if (this.tables.sync_logs.length > 100) {
      this.tables.sync_logs.pop();
    }
    this.persist();
  }

  // ==========================================
  // QUERY & RETRIEVAL METHODS
  // ==========================================

  /**
   * Assemble complete hydrated anime payload matching NexPlay UI expectations
   */
  assembleAnimeObject(animeRecord) {
    if (!animeRecord) return null;
    const id = animeRecord.id;
    const titles = this.tables.anime_titles.get(id) || {};
    const images = this.tables.anime_images.get(id) || {};

    // Collect genres
    const genreNames = [];
    for (const ag of this.tables.anime_genres.values()) {
      if (ag.anime_id === id) {
        genreNames.push(ag.name);
      }
    }

    // Collect studios
    const studioNames = [];
    for (const as of this.tables.anime_studios.values()) {
      if (as.anime_id === id) {
        studioNames.push(as.name);
      }
    }

    const title = titles.title_english || titles.title || 'Unknown Anime';
    const releaseYear = animeRecord.year ? String(animeRecord.year) : (animeRecord.aired_from ? String(animeRecord.aired_from).substring(0, 4) : '2024');

    return {
      // Primary NexPlay identification
      id: animeRecord.id,
      internal_id: animeRecord.id,
      mal_id: animeRecord.mal_id,
      media_type: 'anime',
      isAnime: true,

      // Display fields formatted for NexPlay components (MovieRow, HeroCarousel, DetailScreen)
      title,
      name: title,
      title_english: titles.title_english,
      title_japanese: titles.title_japanese,
      title_synonyms: titles.title_synonyms || [],

      overview: animeRecord.synopsis,
      synopsis: animeRecord.synopsis,
      background: animeRecord.background,

      poster_path: images.poster_url,
      backdrop_path: images.backdrop_url || images.poster_url,
      image: images.poster_url,
      images,

      vote_average: animeRecord.score || 8.0,
      score: animeRecord.score || 8.0,
      scored_by: animeRecord.scored_by || 0,
      popularity: animeRecord.popularity,
      rank: animeRecord.rank,

      genres: genreNames,
      genre: genreNames[0] || 'Anime',
      genre_names: genreNames.join(', '),
      studios: studioNames,

      type: animeRecord.type || 'TV',
      format: animeRecord.type || 'TV',
      status: animeRecord.status,
      airing: animeRecord.airing,
      number_of_episodes: animeRecord.episodes,
      episodes: animeRecord.episodes,
      duration: animeRecord.duration,
      rating: animeRecord.rating,

      year: releaseYear,
      release_date: animeRecord.aired_from || `${releaseYear}-01-01`,
      first_air_date: animeRecord.aired_from || `${releaseYear}-01-01`,
      season: animeRecord.season,
      quality: 'HD'
    };
  }

  /**
   * Get single anime by NexPlay internal ID or MAL ID
   */
  getAnimeById(idOrMalId) {
    if (!idOrMalId) return null;
    const internalId = this.generateInternalId(this.extractMalId(idOrMalId));
    const record = this.tables.anime.get(internalId);
    return this.assembleAnimeObject(record);
  }

  /**
   * Query anime with filtering, sorting, and pagination
   */
  queryAnime(options = {}) {
    const {
      type,                    // 'TV', 'Movie', 'OVA', 'ONA', 'Special'
      status,                  // 'airing', 'complete', 'upcoming'
      genre,                   // Genre name (e.g., 'Action', 'Fantasy')
      q,                       // Full-text search query
      sort_by = 'score',       // 'score', 'popularity', 'year', 'episodes', 'title'
      order = 'desc',          // 'desc' | 'asc'
      page = 1,
      limit = 20
    } = options;

    let items = Array.from(this.tables.anime.values());

    // 1. Filter by Type
    if (type) {
      const typeLower = type.toLowerCase();
      items = items.filter(a => (a.type || '').toLowerCase() === typeLower);
    }

    // 2. Filter by Status
    if (status) {
      const stLower = status.toLowerCase();
      if (stLower === 'airing') {
        items = items.filter(a => a.airing || (a.status || '').toLowerCase().includes('airing'));
      } else if (stLower === 'complete' || stLower === 'completed') {
        items = items.filter(a => (a.status || '').toLowerCase().includes('finished'));
      } else if (stLower === 'upcoming') {
        items = items.filter(a => (a.status || '').toLowerCase().includes('not yet'));
      }
    }

    // 3. Filter by Genre
    if (genre) {
      const gLower = genre.toLowerCase();
      const matchingAnimeIds = new Set();
      for (const ag of this.tables.anime_genres.values()) {
        if ((ag.name || '').toLowerCase() === gLower) {
          matchingAnimeIds.add(ag.anime_id);
        }
      }
      items = items.filter(a => matchingAnimeIds.has(a.id));
    }

    // 4. Text Search
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      items = items.filter(a => {
        const titles = this.tables.anime_titles.get(a.id);
        if (!titles) return false;
        return (
          (titles.title || '').toLowerCase().includes(term) ||
          (titles.title_english || '').toLowerCase().includes(term) ||
          (titles.title_japanese || '').toLowerCase().includes(term) ||
          (titles.title_synonyms || []).some(s => s.toLowerCase().includes(term)) ||
          (a.synopsis || '').toLowerCase().includes(term)
        );
      });
    }

    // 5. Sorting
    items.sort((a, b) => {
      let valA, valB;
      if (sort_by === 'popularity') {
        valA = a.popularity ?? 999999;
        valB = b.popularity ?? 999999;
        return order === 'asc' ? valA - valB : valB - valA;
      } else if (sort_by === 'year') {
        valA = a.year || 0;
        valB = b.year || 0;
      } else if (sort_by === 'episodes') {
        valA = a.episodes || 0;
        valB = b.episodes || 0;
      } else if (sort_by === 'title') {
        const tA = (this.tables.anime_titles.get(a.id)?.title || '').toLowerCase();
        const tB = (this.tables.anime_titles.get(b.id)?.title || '').toLowerCase();
        return order === 'asc' ? tA.localeCompare(tB) : tB.localeCompare(tA);
      } else {
        // default: score
        valA = a.score || 0;
        valB = b.score || 0;
      }
      return order === 'asc' ? valA - valB : valB - valA;
    });

    // 6. Pagination
    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      data: paginatedItems.map(item => this.assembleAnimeObject(item)),
      pagination: {
        current_page: page,
        has_next_page: startIndex + limit < total,
        total_items: total,
        total_pages: Math.ceil(total / limit) || 1,
        per_page: limit
      }
    };
  }

  /**
   * Get episodes for an Anime (paginated)
   */
  getEpisodes(animeIdOrMalId, page = 1, limit = 100) {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const eps = [];

    for (const ep of this.tables.episodes.values()) {
      if (ep.anime_id === internalId) {
        eps.push(ep);
      }
    }

    eps.sort((a, b) => a.episode_number - b.episode_number);

    const total = eps.length;
    const startIndex = (page - 1) * limit;
    const paginatedEps = eps.slice(startIndex, startIndex + limit);

    return {
      data: paginatedEps,
      pagination: {
        current_page: page,
        has_next_page: startIndex + limit < total,
        total_items: total,
        total_pages: Math.ceil(total / limit) || 1,
        per_page: limit
      }
    };
  }

  /**
   * Get relations for an Anime
   */
  getRelations(animeIdOrMalId) {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const relations = [];

    for (const rel of this.tables.anime_relations.values()) {
      if (rel.anime_id === internalId) {
        relations.push(rel);
      }
    }

    return {
      data: relations
    };
  }

  // ==========================================
  // USER WATCHLIST & PROGRESS METHODS
  // ==========================================

  /**
   * Get user watchlist
   */
  getWatchlist(statusFilter = null) {
    const list = [];
    for (const item of this.tables.user_anime_watchlist.values()) {
      if (!statusFilter || item.status === statusFilter) {
        const anime = this.getAnimeById(item.anime_id);
        if (anime) {
          list.push({
            ...item,
            anime
          });
        }
      }
    }
    list.sort((a, b) => b.updated_at - a.updated_at);
    return list;
  }

  /**
   * Add / Update Anime in user watchlist
   */
  setWatchlistStatus(animeIdOrMalId, status = 'plan_to_watch') {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const now = Date.now();
    const existing = this.tables.user_anime_watchlist.get(internalId);

    const record = {
      id: `np_wl_${internalId}`,
      anime_id: internalId,
      status, // 'plan_to_watch' | 'watching' | 'completed' | 'on_hold' | 'dropped'
      added_at: existing?.added_at || now,
      updated_at: now
    };

    this.tables.user_anime_watchlist.set(internalId, record);
    this.persist();
    this.notify('WATCHLIST_UPDATED', record);
    return record;
  }

  /**
   * Remove Anime from user watchlist
   */
  removeFromWatchlist(animeIdOrMalId) {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const deleted = this.tables.user_anime_watchlist.delete(internalId);
    if (deleted) {
      this.persist();
      this.notify('WATCHLIST_REMOVED', { anime_id: internalId });
    }
    return deleted;
  }

  /**
   * Save episode watch progress
   */
  saveEpisodeProgress(animeIdOrMalId, progressData = {}) {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const epNum = Number(progressData.episodeNumber || progressData.episode_number || 1);
    const key = `np_prog_${internalId}_e${epNum}`;
    const now = Date.now();

    const record = {
      id: key,
      anime_id: internalId,
      episode_id: progressData.episodeId || `np_ep_${internalId}_${epNum}`,
      episode_number: epNum,
      season: Number(progressData.seasonNumber || 1),
      current_time: Number(progressData.currentTime || 0),
      duration: Number(progressData.duration || 0),
      progress: Number(progressData.progress || 0),
      completed: Boolean(progressData.completed),
      last_watched_at: now
    };

    this.tables.user_anime_progress.set(key, record);

    // Auto-update watchlist to 'watching' if not completed, or 'completed'
    if (record.completed) {
      const anime = this.tables.anime.get(internalId);
      if (anime && anime.episodes && epNum >= anime.episodes) {
        this.setWatchlistStatus(internalId, 'completed');
      }
    } else {
      this.setWatchlistStatus(internalId, 'watching');
    }

    this.persist();
    this.notify('PROGRESS_UPDATED', record);
    return record;
  }

  /**
   * Get progress for specific episode
   */
  getEpisodeProgress(animeIdOrMalId, epNum = 1) {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const key = `np_prog_${internalId}_e${Number(epNum)}`;
    return this.tables.user_anime_progress.get(key) || null;
  }

  /**
   * Calculate Next Episode to watch for an anime
   */
  getNextEpisode(animeIdOrMalId) {
    const internalId = this.generateInternalId(this.extractMalId(animeIdOrMalId));
    const anime = this.tables.anime.get(internalId);
    if (!anime) return { nextEpisodeNumber: 1, isSequel: false };

    // Find all watched episodes for this anime
    let highestWatchedEp = 0;
    let lastWatchedProgress = null;

    for (const prog of this.tables.user_anime_progress.values()) {
      if (prog.anime_id === internalId) {
        if (prog.episode_number > highestWatchedEp) {
          highestWatchedEp = prog.episode_number;
          lastWatchedProgress = prog;
        }
      }
    }

    if (highestWatchedEp === 0) {
      return { nextEpisodeNumber: 1, isSequel: false };
    }

    // If latest watched is completed, suggest next episode
    if (lastWatchedProgress?.completed) {
      const nextEp = highestWatchedEp + 1;
      if (anime.episodes && nextEp > anime.episodes) {
        // Current entry finished! Look for Sequel relation
        let sequelRelation = null;
        for (const rel of this.tables.anime_relations.values()) {
          if (rel.anime_id === internalId && (rel.relation_type || '').toLowerCase() === 'sequel') {
            sequelRelation = rel;
            break;
          }
        }
        return {
          nextEpisodeNumber: nextEp,
          completedAll: true,
          sequel: sequelRelation
        };
      }
      return { nextEpisodeNumber: nextEp, isSequel: false };
    }

    // Still in progress
    return {
      nextEpisodeNumber: highestWatchedEp,
      resumeTime: lastWatchedProgress?.current_time || 0,
      duration: lastWatchedProgress?.duration || 0,
      progress: lastWatchedProgress?.progress || 0
    };
  }

  /**
   * Get user's Continue Watching list for Anime
   */
  getContinueWatchingList() {
    const latestProgressMap = new Map();

    for (const prog of this.tables.user_anime_progress.values()) {
      const currentLatest = latestProgressMap.get(prog.anime_id);
      if (!currentLatest || prog.last_watched_at > currentLatest.last_watched_at) {
        latestProgressMap.set(prog.anime_id, prog);
      }
    }

    const continueWatching = [];
    for (const [animeId, prog] of latestProgressMap.entries()) {
      const anime = this.getAnimeById(animeId);
      if (anime) {
        const remainingSecs = Math.max(0, (prog.duration || 0) - (prog.current_time || 0));
        const minsLeft = Math.max(1, Math.round(remainingSecs / 60));

        continueWatching.push({
          ...anime,
          subtitle: `Episode ${prog.episode_number} • ${minsLeft}m left`,
          last_episode: `Ep ${prog.episode_number}`,
          time_left: `${minsLeft}m left`,
          currentTime: prog.current_time,
          duration: prog.duration,
          progress: prog.progress,
          completed: prog.completed,
          currentEpisodeNumber: prog.episode_number,
          media_type: 'anime',
          isAnime: true
        });
      }
    }

    continueWatching.sort((a, b) => (b.last_watched_at || 0) - (a.last_watched_at || 0));
    return continueWatching;
  }
}

export const animeDatabase = new AnimeDatabase();
export default animeDatabase;
