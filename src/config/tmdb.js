// TMDB API Configuration
// NOTE: Hardcoded API key removed. Key is dynamically retrieved from persistent AppSettings.
import { getTmdbApiKey, subscribeSettings } from '../utils/AppSettings';

export let TMDB_API_KEY = '';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
export const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/original';

export const getActiveTmdbApiKey = () => getTmdbApiKey();

// Automatically keep TMDB_API_KEY synchronized whenever user saves or deletes key
subscribeSettings(({ eventType, payload }) => {
  if (eventType === 'TMDB_KEY_SAVED') {
    TMDB_API_KEY = payload.key || '';
  } else if (eventType === 'TMDB_KEY_DELETED') {
    TMDB_API_KEY = '';
  }
});
