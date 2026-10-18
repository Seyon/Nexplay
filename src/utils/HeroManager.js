import * as FileSystem from 'expo-file-system/legacy';
import { Paths, File } from 'expo-file-system';
import { TMDB_BASE_URL } from '../config/tmdb';
import { fetchWithRetry, fetchWeeklyTrendingMovies, fetchWeeklyTrendingTvSeries } from './api';
import { getTmdbApiKey, hasTmdbApiKey } from './AppSettings';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getDocumentDir = () => {
  if (FileSystem && FileSystem.documentDirectory) {
    return FileSystem.documentDirectory;
  }
  if (Paths && Paths.document) {
    const uri = Paths.document.uri || (typeof Paths.document === 'string' ? Paths.document : '');
    if (uri) return uri.endsWith('/') ? uri : `${uri}/`;
  }
  return 'file:///data/user/0/com.anonymous.Stitchnexplay/files/';
};

const getHeroCacheFilePath = () => `${getDocumentDir()}nexplay_hero_cache.json`;

let _memoryHeroCache = {
  weeklyTimestamp: 0,
  weeklyHeroList: [],
  combinedHeroList: []
};

/**
 * Load cached hero carousel lineup from disk into memory
 */
export const getCachedHeroLineup = async () => {
  if (_memoryHeroCache.combinedHeroList && _memoryHeroCache.combinedHeroList.length > 0) {
    return _memoryHeroCache.combinedHeroList;
  }

  try {
    const filePath = getHeroCacheFilePath();
    if (FileSystem && typeof FileSystem.getInfoAsync === 'function') {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info && info.exists) {
        const raw = await FileSystem.readAsStringAsync(filePath);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.combinedHeroList) && parsed.combinedHeroList.length > 0) {
            _memoryHeroCache = {
              weeklyTimestamp: parsed.weeklyTimestamp || 0,
              weeklyHeroList: parsed.weeklyHeroList || [],
              combinedHeroList: parsed.combinedHeroList || []
            };
            return _memoryHeroCache.combinedHeroList;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[HeroManager] Failed to read hero cache from disk:', e?.message || e);
  }

  return [];
};

/**
 * Save hero cache to local disk
 */
const persistHeroCache = async () => {
  try {
    const filePath = getHeroCacheFilePath();
    const data = JSON.stringify(_memoryHeroCache, null, 2);
    if (FileSystem && typeof FileSystem.writeAsStringAsync === 'function') {
      await FileSystem.writeAsStringAsync(filePath, data);
    }
  } catch (e) {
    console.warn('[HeroManager] Failed to persist hero cache:', e?.message || e);
  }
};

/**
 * Enrich raw TMDB item with runtime or season counts
 */
const enrichItem = async (item, currentKey) => {
  const headers = { 'Accept': 'application/json' };
  try {
    if (currentKey) {
      const isTVShow = item.media_type === 'tv' ? true :
                       item.media_type === 'movie' ? false :
                       (Boolean(item.first_air_date) && !item.release_date && !item.title);
      if (isTVShow) {
        const res = await fetchWithRetry(`${TMDB_BASE_URL}/tv/${item.id}`, { headers });
        if (res && res.ok) {
          const details = await res.json();
          return { 
            ...item, 
            media_type: 'tv',
            number_of_seasons: details.number_of_seasons || item.number_of_seasons,
            tag: item.tag || 'New Episode'
          };
        }
      } else {
        const res = await fetchWithRetry(`${TMDB_BASE_URL}/movie/${item.id}`, { headers });
        if (res && res.ok) {
          const details = await res.json();
          return { 
            ...item, 
            media_type: 'movie',
            runtime: details.runtime || item.runtime,
            tag: item.tag || 'New Release'
          };
        }
      }
    }
  } catch (err) {
    // Return original item if detail fetch fails
  }

  const isTV = item.media_type === 'tv' ? true :
               item.media_type === 'movie' ? false :
               (Boolean(item.first_air_date) && !item.release_date && !item.title);
  return { 
    ...item, 
    media_type: isTV ? 'tv' : 'movie', 
    tag: item.tag || (isTV ? 'New Episode' : 'New Release') 
  };
};

/**
 * Resolve Hero Carousel Lineup:
 * 1. Updates weekly items once a week (7 days) entirely.
 * 2. In between, checks daily trending movies & series; if any are hot/trending,
 *    prepends and weaves them into the hero lineup so users see trending breakouts immediately.
 */
export const resolveHeroLineup = async (dailyTrending = [], weeklySource = []) => {
  const currentKey = getTmdbApiKey();
  const now = Date.now();

  let source = Array.isArray(weeklySource) && weeklySource.length > 0 ? weeklySource : [];
  if (source.length === 0) {
    try {
      const [wMovies, wSeries] = await Promise.all([
        fetchWeeklyTrendingMovies(),
        fetchWeeklyTrendingTvSeries()
      ]);
      // Interleave top weekly trending movies and series for rich representation
      const combined = [];
      const maxLen = Math.max(wMovies.length, wSeries.length);
      for (let i = 0; i < maxLen; i++) {
        if (wMovies[i]) combined.push({ ...wMovies[i], media_type: 'movie' });
        if (wSeries[i]) combined.push({ ...wSeries[i], media_type: 'tv' });
      }
      source = combined.length > 0 ? combined : dailyTrending;
    } catch (e) {
      source = dailyTrending;
    }
  }

  // Filter items with backdrops and take top 10
  const filteredWeekly = source
    .filter((item) => item && (item.backdrop_path || item.poster_path))
    .slice(0, 10);

  const enrichedWeekly = await Promise.all(
    filteredWeekly.map(async (item) => {
      const isTV = item.media_type === 'tv' || Boolean(item.first_air_date);
      const enriched = await enrichItem(item, currentKey);
      return {
        ...enriched,
        tag: isTV ? 'Top Series' : 'Top 10 This Week'
      };
    })
  );

  let currentWeeklyItems = enrichedWeekly.length > 0 ? enrichedWeekly : (_memoryHeroCache.weeklyHeroList || []);
  _memoryHeroCache.weeklyTimestamp = now;
  _memoryHeroCache.weeklyHeroList = currentWeeklyItems;

  // 2. Check daily trending movies & series for breakout hits
  const trendingCandidates = (Array.isArray(dailyTrending) ? dailyTrending : [])
    .filter((item) => item && (item.backdrop_path || item.poster_path));

  const breakoutDailyItems = [];
  for (const item of trendingCandidates.slice(0, 5)) {
    const isTV = item.media_type === 'tv' || Boolean(item.first_air_date);
    const enriched = await enrichItem(item, currentKey);
    breakoutDailyItems.push({
      ...enriched,
      tag: isTV ? 'Trending Series' : 'Trending Today'
    });
  }

  // 3. Merge: Breakout daily trending items take top priority, followed by weekly top items
  const finalMerged = [];
  const addedIds = new Set();

  for (const item of breakoutDailyItems) {
    if (!addedIds.has(item.id)) {
      addedIds.add(item.id);
      finalMerged.push(item);
      if (finalMerged.length >= 4) break;
    }
  }

  for (const item of currentWeeklyItems) {
    if (!addedIds.has(item.id)) {
      addedIds.add(item.id);
      finalMerged.push(item);
      if (finalMerged.length >= 10) break;
    }
  }

  _memoryHeroCache.combinedHeroList = finalMerged.length > 0 ? finalMerged : currentWeeklyItems;
  persistHeroCache();

  return _memoryHeroCache.combinedHeroList;
};

/**
 * Resolve dedicated Movies Hero Carousel lineup (Movies only, top 10)
 */
export const resolveMoviesHeroLineup = async (movies = []) => {
  const currentKey = getTmdbApiKey();
  const source = Array.isArray(movies) && movies.length > 0 ? movies : await fetchWeeklyTrendingMovies();
  const filtered = source
    .filter(m => m && (m.backdrop_path || m.poster_path))
    .slice(0, 10);

  return Promise.all(
    filtered.map(async (m) => {
      const enriched = await enrichItem(m, currentKey);
      return {
        ...enriched,
        media_type: 'movie',
        tag: 'Featured Movie'
      };
    })
  );
};

/**
 * Resolve dedicated Series Hero Carousel lineup (Series only, top 10)
 */
export const resolveSeriesHeroLineup = async (series = []) => {
  const currentKey = getTmdbApiKey();
  const source = Array.isArray(series) && series.length > 0 ? series : await fetchWeeklyTrendingTvSeries();
  const filtered = source
    .filter(s => s && (s.backdrop_path || s.poster_path))
    .slice(0, 10);

  return Promise.all(
    filtered.map(async (s) => {
      const enriched = await enrichItem(s, currentKey);
      return {
        ...enriched,
        media_type: 'tv',
        tag: 'Featured Series'
      };
    })
  );
};

