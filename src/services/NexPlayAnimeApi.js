/**
 * NexPlayAnimeApi.js
 * 
 * NexPlay Internal API Service & REST Router for Anime.
 * Integrates Tenrai Anime Metadata API with NexPlay's persistent AnimeDatabase.
 * 
 * Implements endpoints:
 * - GET /api/anime/home
 * - GET /api/anime
 * - GET /api/anime/search?q=
 * - GET /api/anime/trending
 * - GET /api/anime/popular
 * - GET /api/anime/top-rated
 * - GET /api/anime/airing
 * - GET /api/anime/upcoming
 * - GET /api/anime/movies
 * - GET /api/anime/{id}
 * - GET /api/anime/{id}/episodes
 * - GET /api/anime/{id}/relations
 * 
 * Supports both programmatic calls and unified REST dispatcher.
 */

import tenraiApiService from './TenraiApiService.js';
import animeDatabase from './AnimeDatabase.js';

class NexPlayAnimeApi {
  constructor() {
    this.isReady = false;
    this.initPromise = null;
  }

  async ensureInitialized() {
    if (this.isReady) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await animeDatabase.init();
      this.isReady = true;
    })();
    return this.initPromise;
  }

  /**
   * Helper to normalize pagination parameters
   */
  parsePagination(params = {}) {
    return {
      page: Math.max(1, parseInt(params.page, 10) || 1),
      limit: Math.min(Math.max(1, parseInt(params.limit, 10) || 20), 50)
    };
  }

  // ==========================================
  // CORE ENDPOINT IMPLEMENTATIONS
  // ==========================================

  /**
   * GET /api/anime/home
   * Assembles a rich homepage payload mirroring NexPlay Home UI
   */
  async getHome() {
    await this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Fetch high-priority sections in parallel with resilient fallbacks
      const [
        topPopularRes,
        airingRes,
        topRatedRes,
        upcomingRes,
        moviesRes
      ] = await Promise.allSettled([
        tenraiApiService.getTopAnime({ filter: 'bypopularity', limit: 20 }),
        tenraiApiService.getCurrentSeasonAnime({ limit: 20 }),
        tenraiApiService.getTopAnime({ limit: 20 }),
        tenraiApiService.getUpcomingSeasonAnime({ limit: 15 }),
        tenraiApiService.getTopAnime({ type: 'movie', limit: 15 })
      ]);

      // Ingest live results into local database
      if (topPopularRes.status === 'fulfilled' && topPopularRes.value?.data) {
        animeDatabase.ingestAnimeBatch(topPopularRes.value.data);
      }
      if (airingRes.status === 'fulfilled' && airingRes.value?.data) {
        animeDatabase.ingestAnimeBatch(airingRes.value.data);
      }
      if (topRatedRes.status === 'fulfilled' && topRatedRes.value?.data) {
        animeDatabase.ingestAnimeBatch(topRatedRes.value.data);
      }
      if (upcomingRes.status === 'fulfilled' && upcomingRes.value?.data) {
        animeDatabase.ingestAnimeBatch(upcomingRes.value.data);
      }
      if (moviesRes.status === 'fulfilled' && moviesRes.value?.data) {
        animeDatabase.ingestAnimeBatch(moviesRes.value.data);
      }

      animeDatabase.logSync('home_sync', 80, 'success', null, Date.now() - startTime);
    } catch (err) {
      console.warn('[NexPlayAnimeApi] Home live sync warning, using cached catalogue:', err?.message || err);
      animeDatabase.logSync('home_sync', 0, 'partial', err?.message, Date.now() - startTime);
    }

    // Now query database for formatted responses
    const continueWatching = animeDatabase.getContinueWatchingList();
    const popularQuery = animeDatabase.queryAnime({ sort_by: 'popularity', order: 'asc', limit: 20 });
    const topRatedQuery = animeDatabase.queryAnime({ sort_by: 'score', order: 'desc', limit: 20 });
    const airingQuery = animeDatabase.queryAnime({ status: 'airing', sort_by: 'score', limit: 20 });
    const upcomingQuery = animeDatabase.queryAnime({ status: 'upcoming', sort_by: 'popularity', limit: 15 });
    const moviesQuery = animeDatabase.queryAnime({ type: 'Movie', sort_by: 'score', limit: 15 });

    // Curated Genre Queries
    const shonenQuery = animeDatabase.queryAnime({ genre: 'Action', sort_by: 'score', limit: 15 });
    const fantasyQuery = animeDatabase.queryAnime({ genre: 'Fantasy', sort_by: 'score', limit: 15 });
    const romanceQuery = animeDatabase.queryAnime({ genre: 'Romance', sort_by: 'score', limit: 15 });
    const scifiQuery = animeDatabase.queryAnime({ genre: 'Sci-Fi', sort_by: 'score', limit: 15 });
    const comedyQuery = animeDatabase.queryAnime({ genre: 'Comedy', sort_by: 'score', limit: 15 });

    const heroItems = popularQuery.data.slice(0, 8);
    const top10Items = topRatedQuery.data.slice(0, 10);

    return {
      success: true,
      data: {
        hero: heroItems,
        continueWatching,
        top10: top10Items,
        trending: popularQuery.data,
        airing: airingQuery.data,
        popularSeries: popularQuery.data.filter(i => i.type === 'TV'),
        movies: moviesQuery.data,
        upcoming: upcomingQuery.data,
        topRated: topRatedQuery.data,
        actionShonen: shonenQuery.data,
        fantasyIsekai: fantasyQuery.data,
        romanceDrama: romanceQuery.data,
        scifiMecha: scifiQuery.data,
        comedy: comedyQuery.data,
      }
    };
  }

  /**
   * GET /api/anime
   * General catalogue listing with filtering, sorting, and pagination
   */
  async getAnimeList(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    // Try fetching from Tenrai if querying online
    try {
      const tenraiParams = {
        page,
        limit,
        type: params.type ? params.type.toLowerCase() : undefined,
        status: params.status,
        order_by: params.sort_by || 'score',
        sort: params.order || 'desc',
        genres: params.genres
      };

      const res = await tenraiApiService.getAnimeList(tenraiParams);
      if (res && Array.isArray(res.data)) {
        animeDatabase.ingestAnimeBatch(res.data);
      }
    } catch (e) {
      console.warn('[NexPlayAnimeApi] Catalogue online fetch fallback:', e?.message || e);
    }

    // Query local database for populated response
    const result = animeDatabase.queryAnime({
      type: params.type,
      status: params.status,
      genre: params.genre,
      sort_by: params.sort_by,
      order: params.order,
      page,
      limit
    });

    return {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  /**
   * GET /api/anime/search?q=
   * Search anime catalogue
   */
  async search(params = {}) {
    await this.ensureInitialized();
    const query = (params.q || '').trim();
    if (!query) {
      return { success: true, data: [], pagination: { current_page: 1, total_items: 0, total_pages: 0 } };
    }

    const { page, limit } = this.parsePagination(params);

    try {
      const tenraiRes = await tenraiApiService.searchAnime(query, {
        page,
        limit,
        type: params.type ? params.type.toLowerCase() : undefined
      });
      if (tenraiRes && Array.isArray(tenraiRes.data)) {
        animeDatabase.ingestAnimeBatch(tenraiRes.data);
      }
    } catch (e) {
      console.warn('[NexPlayAnimeApi] Online search error, querying local db:', e?.message || e);
    }

    const searchResult = animeDatabase.queryAnime({
      q: query,
      type: params.type,
      page,
      limit
    });

    return {
      success: true,
      data: searchResult.data,
      pagination: searchResult.pagination
    };
  }

  /**
   * GET /api/anime/trending
   */
  async getTrending(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    try {
      const res = await tenraiApiService.getTopAnime({ filter: 'bypopularity', page, limit });
      if (res?.data) animeDatabase.ingestAnimeBatch(res.data);
    } catch (e) {}

    const result = animeDatabase.queryAnime({ sort_by: 'popularity', order: 'asc', page, limit });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  /**
   * GET /api/anime/popular
   */
  async getPopular(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    try {
      const res = await tenraiApiService.getTopAnime({ filter: 'favorite', page, limit });
      if (res?.data) animeDatabase.ingestAnimeBatch(res.data);
    } catch (e) {}

    const result = animeDatabase.queryAnime({ sort_by: 'popularity', order: 'asc', page, limit });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  /**
   * GET /api/anime/top-rated
   */
  async getTopRated(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    try {
      const res = await tenraiApiService.getTopAnime({ page, limit });
      if (res?.data) animeDatabase.ingestAnimeBatch(res.data);
    } catch (e) {}

    const result = animeDatabase.queryAnime({ sort_by: 'score', order: 'desc', page, limit });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  /**
   * GET /api/anime/airing
   */
  async getAiring(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    try {
      const res = await tenraiApiService.getCurrentSeasonAnime({ page, limit });
      if (res?.data) animeDatabase.ingestAnimeBatch(res.data);
    } catch (e) {}

    const result = animeDatabase.queryAnime({ status: 'airing', sort_by: 'score', order: 'desc', page, limit });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  /**
   * GET /api/anime/upcoming
   */
  async getUpcoming(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    try {
      const res = await tenraiApiService.getUpcomingSeasonAnime({ page, limit });
      if (res?.data) animeDatabase.ingestAnimeBatch(res.data);
    } catch (e) {}

    const result = animeDatabase.queryAnime({ status: 'upcoming', sort_by: 'popularity', order: 'asc', page, limit });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  /**
   * GET /api/anime/movies
   */
  async getMovies(params = {}) {
    await this.ensureInitialized();
    const { page, limit } = this.parsePagination(params);

    try {
      const res = await tenraiApiService.getTopAnime({ type: 'movie', page, limit });
      if (res?.data) animeDatabase.ingestAnimeBatch(res.data);
    } catch (e) {}

    const result = animeDatabase.queryAnime({ type: 'Movie', sort_by: 'score', order: 'desc', page, limit });
    return { success: true, data: result.data, pagination: result.pagination };
  }

  /**
   * GET /api/anime/{id}
   * Get single anime details by NexPlay ID or MAL ID
   */
  async getAnimeById(id) {
    if (!id) return { success: false, error: 'Missing anime ID' };
    await this.ensureInitialized();

    const malId = animeDatabase.extractMalId(id);
    let anime = animeDatabase.getAnimeById(id);

    // If not in database or missing synopsis, fetch from Tenrai
    if (!anime || !anime.overview || anime.overview.length < 20) {
      try {
        const fullDetails = await tenraiApiService.getAnimeFullById(malId) || await tenraiApiService.getAnimeById(malId);
        if (fullDetails?.data) {
          animeDatabase.ingestAnimeItem(fullDetails.data);
          anime = animeDatabase.getAnimeById(id);
        }
      } catch (err) {
        console.warn(`[NexPlayAnimeApi] Failed fetching anime ${id} details:`, err?.message || err);
      }
    }

    if (!anime) {
      return { success: false, error: 'Anime not found' };
    }

    // Attach next episode recommendation and watchlist status
    const nextEp = animeDatabase.getNextEpisode(id);
    const watchlistStatus = animeDatabase.tables.user_anime_watchlist.get(animeDatabase.generateInternalId(malId));

    return {
      success: true,
      data: {
        ...anime,
        next_episode_info: nextEp,
        watchlist_status: watchlistStatus?.status || null
      }
    };
  }

  /**
   * GET /api/anime/{id}/episodes
   */
  async getAnimeEpisodes(id, params = {}) {
    if (!id) return { success: false, error: 'Missing anime ID' };
    await this.ensureInitialized();

    const { page, limit } = this.parsePagination(params);
    const malId = animeDatabase.extractMalId(id);

    // Check local database episodes
    let result = animeDatabase.getEpisodes(id, page, limit);

    // If local database has no episodes for this anime, fetch from Tenrai
    if (result.data.length === 0) {
      try {
        const epRes = await tenraiApiService.getAnimeEpisodes(malId, page);
        if (epRes?.data && Array.isArray(epRes.data)) {
          animeDatabase.ingestEpisodes(id, epRes.data);
          result = animeDatabase.getEpisodes(id, page, limit);
        }
      } catch (err) {
        console.warn(`[NexPlayAnimeApi] Failed fetching episodes for ${id}:`, err?.message || err);
      }
    }

    return {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  }

  /**
   * GET /api/anime/{id}/relations
   */
  async getAnimeRelations(id) {
    if (!id) return { success: false, error: 'Missing anime ID' };
    await this.ensureInitialized();

    const malId = animeDatabase.extractMalId(id);
    let result = animeDatabase.getRelations(id);

    // If no relations in database, fetch from Tenrai
    if (result.data.length === 0) {
      try {
        const relRes = await tenraiApiService.getAnimeRelations(malId);
        if (relRes?.data && Array.isArray(relRes.data)) {
          animeDatabase.ingestRelations(id, relRes.data);
          result = animeDatabase.getRelations(id);
        }
      } catch (err) {
        console.warn(`[NexPlayAnimeApi] Failed fetching relations for ${id}:`, err?.message || err);
      }
    }

    return {
      success: true,
      data: result.data
    };
  }

  // ==========================================
  // UNIFIED REST REQUEST DISPATCHER
  // ==========================================

  /**
   * Handles simulated HTTP REST requests to /api/anime/*
   * @param {string} method - 'GET'
   * @param {string} path - e.g. '/api/anime/trending' or '/api/anime/np_anime_20/episodes'
   * @param {Object} queryParams - Query parameters object
   */
  async handleRequest(method = 'GET', path = '', queryParams = {}) {
    if (method.toUpperCase() !== 'GET') {
      return { success: false, status: 405, error: 'Method Not Allowed' };
    }

    const cleanPath = path.split('?')[0].replace(/\/+$/, '');

    // 1. Exact match endpoints
    if (cleanPath === '/api/anime/home') {
      return this.getHome();
    }
    if (cleanPath === '/api/anime/trending') {
      return this.getTrending(queryParams);
    }
    if (cleanPath === '/api/anime/popular') {
      return this.getPopular(queryParams);
    }
    if (cleanPath === '/api/anime/top-rated') {
      return this.getTopRated(queryParams);
    }
    if (cleanPath === '/api/anime/airing') {
      return this.getAiring(queryParams);
    }
    if (cleanPath === '/api/anime/upcoming') {
      return this.getUpcoming(queryParams);
    }
    if (cleanPath === '/api/anime/movies') {
      return this.getMovies(queryParams);
    }
    if (cleanPath === '/api/anime/search') {
      return this.search(queryParams);
    }
    if (cleanPath === '/api/anime') {
      return this.getAnimeList(queryParams);
    }

    // 2. Parameterized endpoints: /api/anime/{id}/...
    const epMatch = cleanPath.match(/^\/api\/anime\/([^\/]+)\/episodes$/);
    if (epMatch) {
      return this.getAnimeEpisodes(epMatch[1], queryParams);
    }

    const relMatch = cleanPath.match(/^\/api\/anime\/([^\/]+)\/relations$/);
    if (relMatch) {
      return this.getAnimeRelations(relMatch[1]);
    }

    const idMatch = cleanPath.match(/^\/api\/anime\/([^\/]+)$/);
    if (idMatch) {
      return this.getAnimeById(idMatch[1]);
    }

    return { success: false, status: 404, error: `Endpoint not found: ${path}` };
  }
}

export const nexPlayAnimeApi = new NexPlayAnimeApi();
export default nexPlayAnimeApi;
