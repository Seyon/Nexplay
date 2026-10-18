import { 
  TMDB_API_KEY, 
  TMDB_BASE_URL, 
  TMDB_IMAGE_BASE_URL, 
  TMDB_BACKDROP_BASE_URL
} from '../config/tmdb.js';
import { resolveDomain, resolveUrlWithDoh } from './DnsResolver.js';
import { getTmdbApiKey } from './AppSettings.js';

// Helper to format image paths
export const getPosterUrl = (path) => {
  if (!path) return 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=600&auto=format&fit=crop';
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

export const getBackdropUrl = (path) => {
  if (!path) return 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop';
  if (path.startsWith('http')) return path;
  return `${TMDB_BACKDROP_BASE_URL}${path}`;
};

export const getStillUrl = (path) => {
  if (!path) return 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop';
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

export const getProfileUrl = (path) => {
  if (!path) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop';
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE_URL}${path}`;
};

export const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
  }
  return `${mins}m`;
};

export const formatYear = (dateString) => {
  if (!dateString) return '';
  return dateString.split('-')[0] || '';
};

export const formatCurrency = (amount) => {
  if (!amount || amount === 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

export const getDirector = (crew = []) => {
  if (!crew || crew.length === 0) return null;
  const dir = crew.find(c => c.job === 'Director' || c.department === 'Directing');
  return dir ? dir.name : null;
};

export const getWriters = (crew = []) => {
  if (!crew || crew.length === 0) return null;
  const writers = crew.filter(c => c.job === 'Writer' || c.job === 'Screenplay' || c.job === 'Story');
  if (writers.length === 0) return null;
  return writers.slice(0, 3).map(w => w.name).join(', ');
};

// Global Headers for TMDB (Clean headers without Desktop UA to avoid Android OkHttp socket reset)
const headers = {
  'Accept': 'application/json'
};

// Fetch with Retry & Timeout utilizing native OkHttp DoH engine
export const fetchWithRetry = async (url, options = {}, retries = 2, delay = 400) => {
  let targetUrl = url;

  // Intercept and handle TMDB requests dynamically
  if (targetUrl && (targetUrl.includes('api.themoviedb.org') || targetUrl.includes('themoviedb.org'))) {
    const currentKey = getTmdbApiKey();
    if (!currentKey) {
      // User deleted key or key not yet set - strictly do not fetch TMDB
      return {
        ok: false,
        status: 401,
        json: async () => ({ results: [], page: 1, total_pages: 0, total_results: 0 })
      };
    }
    // Dynamically inject the active TMDB API key
    if (targetUrl.includes('api_key=')) {
      targetUrl = targetUrl.replace(/api_key=[^&]*/, 'api_key=' + encodeURIComponent(currentKey));
    } else {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'api_key=' + encodeURIComponent(currentKey);
    }
  }

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(targetUrl, {
        ...options,
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res && res.ok) return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        return null;
      }
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  return null;
};

// Fetch Daily Trending Movies
export const fetchTrendingMovies = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) {
      throw new Error(`TMDB HTTP error or request timed out`);
    }
    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results : [];
  } catch (error) {
    console.warn('Error fetching trending movies:', error);
    return [];
  }
};

// Fetch Weekly Top 10 Trending Movies & TV Shows
export const fetchWeeklyTrendingMovies = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) {
      throw new Error(`TMDB HTTP error or request timed out`);
    }
    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results : [];
  } catch (error) {
    console.warn('Error fetching weekly trending movies:', error);
    return [];
  }
};

// Fetch Popular Movies
export const fetchPopularMovies = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) {
      throw new Error(`TMDB HTTP error or request timed out`);
    }
    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results : [];
  } catch (error) {
    console.warn('Error fetching popular movies:', error);
    return [];
  }
};

// Fetch Tamil Movies (Tamil Tentkotta Category)
export const fetchTamilMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) {
      throw new Error(`TMDB HTTP error or request timed out`);
    }
    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results : [];
  } catch (error) {
    console.warn('Error fetching Tamil movies:', error);
    return [];
  }
};

// Fetch Hindi Movies
export const fetchHindiMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) {
      throw new Error(`TMDB HTTP error or request timed out`);
    }
    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results : [];
  } catch (error) {
    console.warn('Error fetching Hindi movies:', error);
    return [];
  }
};

// Fetch Comprehensive Details for Movie or TV Show
export const fetchMediaDetails = async (id, mediaType = 'movie') => {
  if (!id) return null;
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/${endpoint}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,recommendations,similar,videos`,
      { headers }
    );
    if (!response || !response.ok) {
      // Fallback: If 'movie' failed, try 'tv' or vice versa
      const altEndpoint = endpoint === 'movie' ? 'tv' : 'movie';
      const altResponse = await fetchWithRetry(
        `${TMDB_BASE_URL}/${altEndpoint}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,recommendations,similar,videos`,
        { headers }
      );
      if (altResponse && altResponse.ok) {
        return await altResponse.json();
      }
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`Error fetching details for ${endpoint} ID ${id}:`, error);
    return null;
  }
};

// Search both Movies and TV Shows across TMDB
export const searchMulti = async (query) => {
  if (!query || !query.trim()) return [];
  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodedQuery}&include_adult=false&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    if (!data.results) return [];
    // Filter to only movie and tv results with valid poster or backdrop
    return data.results.filter(item => 
      (item.media_type === 'movie' || item.media_type === 'tv') && 
      (item.poster_path || item.backdrop_path)
    );
  } catch (error) {
    console.warn('Error searching multi:', error);
    return [];
  }
};

// Fetch Top Searches Today (Daily Trending across all media)
export const fetchTopSearchesToday = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return data.results ? data.results.filter(item => item.poster_path || item.backdrop_path) : [];
  } catch (error) {
    console.warn('Error fetching top searches today:', error);
    return [];
  }
};

// ==================== MOVIES SECTION ENDPOINTS ====================

// Fetch Weekly Trending Movies Only (for Movies Hero Carousel)
export const fetchWeeklyTrendingMoviesOnly = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching weekly trending movies:', error);
    return [];
  }
};

// Fetch Daily Trending Movies Only
export const fetchDailyTrendingMoviesOnly = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching daily trending movies:', error);
    return [];
  }
};

// Fetch Top Rated Movies
export const fetchTopRatedMovies = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching top rated movies:', error);
    return [];
  }
};

// Fetch Sci-Fi Movies
export const fetchSciFiMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching sci-fi movies:', error);
    return [];
  }
};

// Fetch Pure Action Movies (Genre 28)
export const fetchActionMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching action movies:', error);
    return [];
  }
};
export const fetchActionAdventureMovies = fetchActionMovies;

// Fetch Epic Adventure Movies (Genre 12)
export const fetchAdventureMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=12&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching adventure movies:', error);
    return [];
  }
};

// Fetch Edge-of-Seat Thriller Movies (Genre 53)
export const fetchThrillerMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=53&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching thriller movies:', error);
    return [];
  }
};
export const fetchThrillerHorrorMovies = fetchThrillerMovies;

// Fetch Spine-Chilling Horror Movies (Genre 27)
export const fetchHorrorMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching horror movies:', error);
    return [];
  }
};

// Fetch Comedy & Entertainment Movies (Genre 35)
export const fetchComedyMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching comedy movies:', error);
    return [];
  }
};

// Fetch Crime, Mystery & Thriller Movies (Genres 80, 9648, 53)
export const fetchCrimeMysteryMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=80,9648,53&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching crime mystery thriller movies:', error);
    return [];
  }
};

// Fetch Sci-Fi & Fantasy Movies (Genres 878, 14)
export const fetchSciFiFantasyMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878,14&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching sci-fi fantasy movies:', error);
    return [];
  }
};

// Fetch Romance & Emotional Drama Movies (Genres 10749, 18)
export const fetchRomanceDramaMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10749,18&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching romance drama movies:', error);
    return [];
  }
};

// Fetch Animation & Anime Movies (Genre 16)
export const fetchAnimationAnimeMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching animation anime movies:', error);
    return [];
  }
};

// Fetch Classics & All-Time Favorites
export const fetchClassicsMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&vote_average.gte=8.0&vote_count.gte=1000&primary_release_date.lte=2012-01-01&sort_by=vote_average.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching classics movies:', error);
    return [];
  }
};

// Fetch New Releases (Now Playing in Theaters / Digital)
export const fetchNewReleases = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching new releases:', error);
    return [];
  }
};

// Fetch Indian Cinema (Tamil, Telugu, Hindi, Malayalam, Kannada)
export const fetchIndianCinema = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta|hi|te|ml|kn&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching Indian cinema:', error);
    return [];
  }
};

// Fetch Korean Dramas & International Series
export const fetchKoreanInternationalSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko|ja|es|fr&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching Korean & international series:', error);
    return [];
  }
};

// Fetch Award-Winning Movies
export const fetchAwardWinningMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&vote_average.gte=7.8&vote_count.gte=2500&sort_by=vote_average.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching award winning movies:', error);
    return [];
  }
};

// Fetch Historical & War Movies (Genres 36, 10752)
export const fetchHistoricalWarMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=36,10752&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching historical war movies:', error);
    return [];
  }
};

// Fetch Horror & Supernatural Movies (Genres 27, 9648)
export const fetchHorrorSupernaturalMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27,9648&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching horror supernatural movies:', error);
    return [];
  }
};

// Fetch Documentaries (Genre 99)
export const fetchDocumentaries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=99&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching documentaries:', error);
    return [];
  }
};

// Fetch Family & Kids Movies (Genres 10751, 16)
export const fetchFamilyKidsMovies = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10751,16&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
  } catch (error) {
    console.warn('Error fetching family kids movies:', error);
    return [];
  }
};

// ==================== TV SERIES SECTION ENDPOINTS ====================

// Fetch Weekly Trending TV Series Only (for TV Series Hero Carousel)
export const fetchWeeklyTrendingTvSeries = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching weekly trending TV series:', error);
    return [];
  }
};

// Fetch Daily Trending TV Series Only
export const fetchTrendingTvSeries = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/trending/tv/day?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching daily trending TV series:', error);
    return [];
  }
};

// Fetch Popular TV Series
export const fetchPopularTvSeries = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching popular TV series:', error);
    return [];
  }
};

// Fetch Top Rated TV Series
export const fetchTopRatedTvSeries = async () => {
  try {
    const response = await fetchWithRetry(`${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}`, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching top rated TV series:', error);
    return [];
  }
};

// Fetch Sci-Fi TV Series
export const fetchSciFiTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10765&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching sci-fi TV series:', error);
    return [];
  }
};

// Fetch Action & Adventure TV Series
export const fetchActionAdventureTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10759&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching action & adventure TV series:', error);
    return [];
  }
};
export const fetchActionSciFiTvSeries = fetchActionAdventureTvSeries;

// Fetch Dark Crime & Suspense Mystery Thriller TV Series (Genres 80, 9648)
export const fetchCrimeMysteryTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=80,9648&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching crime & thriller TV series:', error);
    return [];
  }
};
export const fetchThrillerHorrorTvSeries = fetchCrimeMysteryTvSeries;
export const fetchCrimeDramaTvSeries = fetchCrimeMysteryTvSeries;

// Fetch Supernatural & Horror TV Series (Genres 9648, 10765)
export const fetchHorrorTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=9648,10765&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching horror TV series:', error);
    return [];
  }
};

// Fetch Binge-Worthy Comedy TV Series (Genre 35)
export const fetchComedyTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=35&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching comedy TV series:', error);
    return [];
  }
};

// Fetch Tamil TV Series
export const fetchTamilTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching Tamil TV series:', error);
    return [];
  }
};

// Fetch Hindi TV Series
export const fetchHindiTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching Hindi TV series:', error);
    return [];
  }
};


// Fetch Compelling Drama TV Series (Genre 18)
export const fetchDramaTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=18&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching drama TV series:', error);
    return [];
  }
};

// Fetch Animation & Anime TV Series (Genre 16)
export const fetchAnimationAnimeTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=16&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching animation anime TV series:', error);
    return [];
  }
};

// Fetch Classics & All-Time Favorite TV Series
export const fetchClassicsTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&vote_average.gte=8.0&vote_count.gte=300&first_air_date.lte=2016-01-01&sort_by=vote_average.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching classics TV series:', error);
    return [];
  }
};

// Fetch New Episodes & On The Air Series
export const fetchNewEpisodesTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching on the air TV series:', error);
    return [];
  }
};

// Fetch Historical, War & Politics Series (Genre 10768)
export const fetchHistoricalWarTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10768&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching historical war TV series:', error);
    return [];
  }
};

// Fetch Docuseries & Documentaries (Genre 99)
export const fetchDocuseries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=99&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching docuseries:', error);
    return [];
  }
};

// Fetch Kids & Family TV Series (Genre 10762)
export const fetchKidsFamilyTvSeries = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10762&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
  } catch (error) {
    console.warn('Error fetching kids family TV series:', error);
    return [];
  }
};

// Fetch Indian TV Serials (Daily Soaps & Television Dramas)
export const fetchIndianTvSerials = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv', tag: 'Daily Serial' }));
  } catch (error) {
    console.warn('Error fetching Indian TV serials:', error);
    return [];
  }
};

// Fetch Tamil TV Serials (Sun TV, Vijay TV, Zee Tamil)
export const fetchTamilTvSerials = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&with_original_language=ta&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv', tag: 'Tamil Serial' }));
  } catch (error) {
    console.warn('Error fetching Tamil TV serials:', error);
    return [];
  }
};

// Fetch Hindi TV Serials (Star Plus, Zee TV, Sony, Colors)
export const fetchHindiTvSerials = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&with_original_language=hi&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv', tag: 'Hindi Serial' }));
  } catch (error) {
    console.warn('Error fetching Hindi TV serials:', error);
    return [];
  }
};

// Fetch Telugu TV Serials (Star Maa, Zee Telugu, ETV)
export const fetchTeluguTvSerials = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&with_original_language=te&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv', tag: 'Telugu Serial' }));
  } catch (error) {
    console.warn('Error fetching Telugu TV serials:', error);
    return [];
  }
};

// Fetch Malayalam TV Serials (Asianet, Surya TV, Zee Keralam)
export const fetchMalayalamTvSerials = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&with_original_language=ml&sort_by=popularity.desc&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv', tag: 'Malayalam Serial' }));
  } catch (error) {
    console.warn('Error fetching Malayalam TV serials:', error);
    return [];
  }
};

// Fetch Top Rated Indian TV Serials
export const fetchTopRatedTvSerials = async () => {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&sort_by=vote_average.desc&vote_count.gte=3&page=1`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(s => ({ ...s, media_type: 'tv', tag: 'Top Rated Serial' }));
  } catch (error) {
    console.warn('Error fetching top rated TV serials:', error);
    return [];
  }
};

// Fetch TV Season Details (Episodes list)
export const fetchTvSeasonEpisodes = async (tvId, seasonNumber = 1) => {
  if (!tvId) return [];
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`,
      { headers }
    );
    if (!response || !response.ok) return [];
    const data = await response.json();
    return data.episodes || [];
  } catch (error) {
    console.warn(`Error fetching Season ${seasonNumber} for TV ID ${tvId}:`, error);
    return [];
  }
};

// Fetch Category Media with New-to-Old sorting and pagination
export const fetchCategoryMedia = async (categoryKey, page = 1) => {
  try {
    let url = '';
    const isMovie = !categoryKey.includes('tv') && !categoryKey.includes('series');

    switch (categoryKey) {
      case 'trending':
      case 'trending_movies':
        url = `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'trending_all':
        url = `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'popular':
      case 'popular_movies':
        url = `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'scifi_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'action_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'adventure_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=12&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'action_adventure_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28,12&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'thriller_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=53&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'horror_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'thriller_horror_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=53,27&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'comedy_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'crime_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=80&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'tamil_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=2`;
        break;
      case 'hindi_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=primary_release_date.desc&page=${page}&vote_count.gte=2`;
        break;
      case 'top_rated_movies':
        url = `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'trending_tv':
        url = `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'popular_tv':
        url = `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'scifi_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10765&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'action_adventure_tv':
      case 'action_scifi_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10759&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'thriller_tv':
      case 'thriller_horror_tv':
      case 'crime_drama_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=80,9648&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'horror_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=9648,10765&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'comedy_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=35&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'tamil_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=first_air_date.desc&page=${page}`;
        break;
      case 'hindi_tv':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=first_air_date.desc&page=${page}`;
        break;
      case 'top_rated_tv':
        url = `${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'crime_mystery_thriller':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=80,9648,53&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'scifi_fantasy_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878,14&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'romance_drama_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10749,18&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'animation_anime':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'classics_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&vote_average.gte=8.0&vote_count.gte=1000&primary_release_date.lte=2012-01-01&sort_by=vote_average.desc&page=${page}`;
        break;
      case 'new_releases':
        url = `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'indian_cinema':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta|hi|te|ml|kn&sort_by=popularity.desc&page=${page}`;
        break;
      case 'korean_international_series':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko|ja|es|fr&sort_by=popularity.desc&page=${page}`;
        break;
      case 'award_winning_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&vote_average.gte=7.8&vote_count.gte=2500&sort_by=vote_average.desc&page=${page}`;
        break;
      case 'historical_war_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=36,10752&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'horror_supernatural_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27,9648&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'documentary_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=99&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'family_kids_movies':
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10751,16&sort_by=popularity.desc&page=${page}&vote_count.gte=5`;
        break;
      case 'drama_tv':
      case 'drama_series':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=18&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'animation_anime_tv':
      case 'animation_anime_series':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=16&sort_by=first_air_date.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'classics_tv':
      case 'classics_series':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&vote_average.gte=8.0&vote_count.gte=300&first_air_date.lte=2016-01-01&sort_by=vote_average.desc&page=${page}`;
        break;
      case 'new_episodes_tv':
      case 'on_the_air_series':
        url = `${TMDB_BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}&page=${page}`;
        break;
      case 'historical_war_tv':
      case 'historical_war_series':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10768&sort_by=popularity.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'docuseries_tv':
      case 'docuseries':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=99&sort_by=popularity.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'kids_family_tv':
      case 'kids_family_series':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=10762&sort_by=popularity.desc&page=${page}&vote_count.gte=3`;
        break;
      case 'indian_tv_serials':
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=IN&sort_by=popularity.desc&page=${page}`;
        break;
      default:
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=primary_release_date.desc&page=${page}`;
        break;
    }

    const response = await fetchWithRetry(url, { headers });
    if (!response || !response.ok) return [];
    const data = await response.json();
    const results = (data.results || []).filter(item => item.poster_path || item.backdrop_path);
    
    // Explicitly set media_type
    return results.map(item => ({
      ...item,
      media_type: item.media_type || (isMovie ? 'movie' : 'tv')
    }));
  } catch (error) {
    console.warn(`Error fetching category media for ${categoryKey}:`, error);
    return [];
  }
};

