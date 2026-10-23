import { 
  getSettings, 
  initSettings, 
  getWatchHistory as getAppSettingsWatchHistory, 
  setWatchHistory,
  updatePlaybackProgressSettings,
  subscribeSettings 
} from './AppSettings';
import * as FileSystem from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';
import { getPosterUrl, getBackdropUrl } from './api';

// Completion threshold: 92% watched or less than 25 seconds remaining
const COMPLETION_PERCENTAGE_THRESHOLD = 92;
const COMPLETION_TIME_REMAINING_SECS = 25;
const MIN_TIME_TO_SAVE_SECS = 3;
const MAX_WATCH_HISTORY_ITEMS = 25;

let _memoryPlaybackProgress = {};
let _isManagerInitialized = false;
let _saveDebounceTimer = null;
const _progressListeners = new Set();

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

const getProgressFilePath = () => `${getDocumentDir()}nexplay_playback_cache.json`;

/**
 * Notify progress change listeners
 */
const notifyProgressListeners = (eventType, payload) => {
  _progressListeners.forEach((listener) => {
    try {
      if (typeof listener === 'function') {
        listener({ eventType, payload });
      }
    } catch (e) {
      console.warn('[PlaybackProgressManager] Listener error:', e);
    }
  });
};

/**
 * Generate unique storage key for a movie or TV episode
 */
export const getProgressKey = ({ mediaId, mediaType = 'movie', season, episode }) => {
  if (!mediaId) return null;
  const cleanId = String(mediaId).replace(/^(movie-|tv-)/, '');
  const isTV = mediaType === 'tv' || (season !== undefined && season !== null) || (episode !== undefined && episode !== null);
  if (isTV && (season !== undefined || episode !== undefined)) {
    const s = Number(season) || 1;
    const e = Number(episode) || 1;
    return `tv_${cleanId}_s${s}_e${e}`;
  }
  if (isTV) {
    return `tv_${cleanId}_latest`;
  }
  return `movie_${cleanId}`;
};

/**
 * Generate series latest watched episode pointer key
 */
export const getSeriesLatestKey = (mediaId) => {
  if (!mediaId) return null;
  const cleanId = String(mediaId).replace(/^(movie-|tv-)/, '');
  return `tv_${cleanId}_latest`;
};

/**
 * Format seconds into HH:MM:SS or MM:SS string
 */
export const formatPlaybackTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  if (hrs > 0) {
    const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${formattedMins}:${formattedSecs}`;
  }
  return `${mins < 10 ? `0${mins}` : `${mins}`}:${formattedSecs}`;
};

/**
 * Format remaining time nicely (e.g., "45m left", "1h 12m left")
 */
export const formatRemainingTime = (remainingSecs) => {
  if (!remainingSecs || isNaN(remainingSecs) || remainingSecs <= 0) return '';
  const totalMins = Math.max(1, Math.round(remainingSecs / 60));
  if (totalMins >= 60) {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hrs}h ${mins}m left` : `${hrs}h left`;
  }
  return `${totalMins}m left`;
};

/**
 * Disk persistence helper for dedicated progress cache
 */
const persistProgressCacheToDisk = async () => {
  try {
    const data = JSON.stringify(_memoryPlaybackProgress, null, 2);
    const filePath = getProgressFilePath();
    if (FileSystem && typeof FileSystem.writeAsStringAsync === 'function') {
      await FileSystem.writeAsStringAsync(filePath, data);
    } else if (Paths && Paths.document && typeof File === 'function') {
      const file = new File(Paths.document, 'nexplay_playback_cache.json');
      await file.write(data);
    }
  } catch (err) {
    console.warn('[PlaybackProgressManager] Failed saving cache to disk:', err?.message || err);
  }
};

/**
 * Initialize playback progress manager from local storage & settings
 */
export const initPlaybackProgressManager = async () => {
  if (_isManagerInitialized) return _memoryPlaybackProgress;

  try {
    // 1. Ensure primary settings are initialized
    const settings = await initSettings();
    if (settings && typeof settings.playbackProgress === 'object' && settings.playbackProgress !== null) {
      _memoryPlaybackProgress = { ...settings.playbackProgress };
    }

    // 2. Also check dedicated cache file for any additional records
    try {
      const filePath = getProgressFilePath();
      let content = null;
      if (FileSystem && typeof FileSystem.getInfoAsync === 'function') {
        const info = await FileSystem.getInfoAsync(filePath);
        if (info && info.exists) {
          content = await FileSystem.readAsStringAsync(filePath);
        }
      }
      if (!content && Paths && Paths.document && typeof File === 'function') {
        const file = new File(Paths.document, 'nexplay_playback_cache.json');
        if (file && file.exists) {
          content = await file.text();
        }
      }
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          _memoryPlaybackProgress = {
            ...parsed,
            ..._memoryPlaybackProgress,
          };
        }
      }
    } catch (e) {
      // cache file optional fallback
    }

    // 3. Seed any in-progress records from watchHistory if missing
    const history = getAppSettingsWatchHistory();
    if (Array.isArray(history)) {
      history.forEach((item) => {
        if (!item || !item.id) return;
        const cleanId = String(item.id).replace(/^(movie-|tv-)/, '');
        const isTV = item.media_type === 'tv' || Boolean(item.season || item.episode || item.last_season || item.last_episode);
        const sNum = isTV ? (Number(item.season || item.last_season) || 1) : null;
        const eNum = isTV ? (Number(item.episode) || 1) : null;
        const key = getProgressKey({ mediaId: cleanId, mediaType: isTV ? 'tv' : 'movie', season: sNum, episode: eNum });
        const savedTime = Number(item.currentTime || item.position) || 0;
        if (key && !_memoryPlaybackProgress[key] && savedTime >= MIN_TIME_TO_SAVE_SECS) {
          _memoryPlaybackProgress[key] = {
            mediaId: cleanId,
            mediaType: isTV ? 'tv' : 'movie',
            title: item.title || item.name || '',
            poster_path: item.poster_path || null,
            backdrop_path: item.backdrop_path || null,
            image: item.image || null,
            season: sNum,
            episode: eNum,
            episodeTitle: item.last_episode || (isTV ? `Episode ${eNum}` : null),
            currentTime: savedTime,
            duration: Number(item.duration) || 0,
            progress: Number(item.progress) || 0,
            completed: Boolean(item.completed),
            quality: item.quality || 'HD',
            lastUpdated: item.last_watched || Date.now(),
          };
        }
        if (isTV) {
          const lKey = getSeriesLatestKey(cleanId);
          if (lKey && !_memoryPlaybackProgress[lKey] && _memoryPlaybackProgress[key]) {
            _memoryPlaybackProgress[lKey] = { ..._memoryPlaybackProgress[key] };
          }
        }
      });
    }

    _isManagerInitialized = true;
  } catch (e) {
    console.warn('[PlaybackProgressManager] Initialization error:', e);
  }

  return _memoryPlaybackProgress;
};

/**
 * Get saved playback progress for a movie or TV episode
 */
export const getPlaybackProgress = ({ mediaId, mediaType = 'movie', season, episode }) => {
  if (!mediaId) return null;
  const key = getProgressKey({ mediaId, mediaType, season, episode });
  if (!key) return null;

  const record = _memoryPlaybackProgress[key];
  if (!record) return null;

  return {
    ...record,
    currentTime: typeof record.currentTime === 'number' ? record.currentTime : 0,
    duration: typeof record.duration === 'number' ? record.duration : 0,
    progress: typeof record.progress === 'number' ? record.progress : 0,
    completed: Boolean(record.completed),
    season: record.season || (Number(season) || 1),
    episode: record.episode || (Number(episode) || 1),
  };
};

/**
 * Get latest series episode watched
 */
export const getLatestSeriesProgress = (mediaId) => {
  if (!mediaId) return null;
  const latestKey = getSeriesLatestKey(mediaId);
  const record = _memoryPlaybackProgress[latestKey];
  if (!record) return null;

  return {
    ...record,
    currentTime: typeof record.currentTime === 'number' ? record.currentTime : 0,
    duration: typeof record.duration === 'number' ? record.duration : 0,
    progress: typeof record.progress === 'number' ? record.progress : 0,
    completed: Boolean(record.completed),
    season: record.season || 1,
    episode: record.episode || 1,
  };
};

/**
 * Check if content has valid resume timestamp
 */
export const hasResumeProgress = ({ mediaId, mediaType = 'movie', season, episode }) => {
  const p = getPlaybackProgress({ mediaId, mediaType, season, episode });
  if (!p) return false;
  return !p.completed && p.currentTime >= MIN_TIME_TO_SAVE_SECS && p.progress < COMPLETION_PERCENTAGE_THRESHOLD;
};

/**
 * Save / Update Playback Progress automatically
 * Handles periodic updates, completion checking, and Continue Watching sync
 */
export const savePlaybackProgress = async ({
  media,
  mediaType = 'movie',
  season,
  episode,
  episodeTitle,
  episodeImage,
  currentTime,
  duration,
  isImmediate = false,
}) => {
  if (!media || !media.id) return null;

  const mediaId = media.id;
  const cleanId = String(mediaId).replace(/^(movie-|tv-)/, '');
  const curTime = Math.max(0, Number(currentTime) || 0);
  const dur = Math.max(0, Number(duration) || 0);

  // Determine media type accurately
  const isTV = mediaType === 'tv' || media.media_type === 'tv' || (season !== undefined && season !== null) || (episode !== undefined && episode !== null);
  const sNum = isTV ? (Number(season) || 1) : null;
  const eNum = isTV ? (Number(episode) || 1) : null;

  // Calculate percentage progress
  const progressPercent = dur > 0 ? Math.min(100, Math.max(1, Math.round((curTime / dur) * 100))) : 0;
  const remainingSecs = dur > curTime ? dur - curTime : 0;
  const isCompleted = (dur > 60 && progressPercent >= COMPLETION_PERCENTAGE_THRESHOLD) ||
                      (dur > 60 && remainingSecs <= COMPLETION_TIME_REMAINING_SECS);

  const title = media.title || media.name || 'Featured Video';
  const posterPath = media.poster_path || (typeof media.image === 'string' && media.image.startsWith('/') ? media.image : null);
  const backdropPath = media.backdrop_path || null;
  const image = episodeImage || (media.image && media.image.startsWith('http') ? media.image : null) || (posterPath ? getPosterUrl(posterPath) : null) || (backdropPath ? getBackdropUrl(backdropPath) : null) || media.image || null;
  const quality = media.quality || 'HD';

  const progressKey = getProgressKey({ mediaId: cleanId, mediaType: isTV ? 'tv' : 'movie', season: sNum, episode: eNum });
  const latestKey = isTV ? getSeriesLatestKey(cleanId) : null;

  const record = {
    mediaId: cleanId,
    mediaType: isTV ? 'tv' : 'movie',
    title,
    poster_path: posterPath,
    backdrop_path: backdropPath,
    image,
    season: sNum,
    episode: eNum,
    episodeTitle: episodeTitle || (isTV ? `Episode ${eNum}` : null),
    currentTime: isCompleted ? 0 : curTime,
    duration: dur,
    progress: isCompleted ? 100 : progressPercent,
    completed: isCompleted,
    quality,
    lastUpdated: Date.now(),
  };

  // Update memory store
  _memoryPlaybackProgress[progressKey] = record;
  if (latestKey) {
    _memoryPlaybackProgress[latestKey] = {
      ...record,
      // If this episode completed, we still preserve the pointer so user knows what was finished
      completed: isCompleted,
    };
  }

  // Update Settings Watch History / Continue Watching Row
  const rawHistory = getAppSettingsWatchHistory();
  const history = Array.isArray(rawHistory) ? [...rawHistory] : [];
  const existingIdx = history.findIndex(h => String(h.id) === String(cleanId) || String(h.id) === String(mediaId));

  if (isCompleted) {
    // Content fully watched -> Remove from Continue Watching row!
    if (existingIdx >= 0) {
      history.splice(existingIdx, 1);
      await setWatchHistory(history);
    }
  } else if (curTime >= MIN_TIME_TO_SAVE_SECS) {
    // Unfinished content -> Add or update in Continue Watching row!
    const timeLeftStr = formatRemainingTime(remainingSecs);
    const subtitleStr = isTV
      ? `S${sNum} E${eNum}${timeLeftStr ? `  •  ${timeLeftStr}` : ''}`
      : (timeLeftStr || 'In Progress');

    const historyEntry = {
      ...media,
      id: cleanId,
      media_type: isTV ? 'tv' : 'movie',
      title,
      name: title,
      poster_path: posterPath,
      backdrop_path: backdropPath,
      image: episodeImage || (posterPath ? getPosterUrl(posterPath) : (backdropPath ? getBackdropUrl(backdropPath) : null)) || image,
      progress: progressPercent,
      position: curTime,
      currentTime: curTime,
      duration: dur,
      season: sNum,
      episode: eNum,
      last_season: sNum,
      last_episode: isTV ? `S${sNum} E${eNum}` : null,
      subtitle: subtitleStr,
      time_left: timeLeftStr,
      quality,
      last_watched: Date.now(),
    };

    if (existingIdx >= 0) {
      history.splice(existingIdx, 1);
    }
    history.unshift(historyEntry);

    const updatedHistory = history.slice(0, MAX_WATCH_HISTORY_ITEMS);
    await setWatchHistory(updatedHistory);
  }

  // Handle disk persistence
  if (isImmediate) {
    if (_saveDebounceTimer) {
      clearTimeout(_saveDebounceTimer);
      _saveDebounceTimer = null;
    }
    await Promise.all([
      persistProgressCacheToDisk(),
      updatePlaybackProgressSettings(_memoryPlaybackProgress),
    ]);
  } else {
    // Debounce periodic disk writes to avoid I/O bottlenecks during active streaming
    if (!_saveDebounceTimer) {
      _saveDebounceTimer = setTimeout(async () => {
        _saveDebounceTimer = null;
        await Promise.all([
          persistProgressCacheToDisk(),
          updatePlaybackProgressSettings(_memoryPlaybackProgress),
        ]);
      }, 3500);
    }
  }

  notifyProgressListeners('PLAYBACK_PROGRESS_SAVED', { record });
  return record;
};

/**
 * Explicitly mark content as completed and remove it from Continue Watching
 */
export const markPlaybackCompleted = async ({
  mediaId,
  mediaType = 'movie',
  season,
  episode,
}) => {
  if (!mediaId) return;
  const cleanId = String(mediaId).replace(/^(movie-|tv-)/, '');
  const isTV = mediaType === 'tv' || (season !== undefined && season !== null) || (episode !== undefined && episode !== null);
  const sNum = isTV ? (Number(season) || 1) : null;
  const eNum = isTV ? (Number(episode) || 1) : null;

  const progressKey = getProgressKey({ mediaId: cleanId, mediaType: isTV ? 'tv' : 'movie', season: sNum, episode: eNum });
  const latestKey = isTV ? getSeriesLatestKey(cleanId) : null;

  if (_memoryPlaybackProgress[progressKey]) {
    _memoryPlaybackProgress[progressKey] = {
      ..._memoryPlaybackProgress[progressKey],
      currentTime: 0,
      progress: 100,
      completed: true,
      lastUpdated: Date.now(),
    };
  } else {
    _memoryPlaybackProgress[progressKey] = {
      mediaId: cleanId,
      mediaType: isTV ? 'tv' : 'movie',
      season: sNum,
      episode: eNum,
      currentTime: 0,
      progress: 100,
      completed: true,
      lastUpdated: Date.now(),
    };
  }

  if (latestKey && _memoryPlaybackProgress[latestKey]) {
    _memoryPlaybackProgress[latestKey].completed = true;
  }

  // Remove from Settings Watch History
  const rawHistory = getAppSettingsWatchHistory();
  const history = Array.isArray(rawHistory) ? [...rawHistory] : [];
  const existingIdx = history.findIndex(h => String(h.id) === String(cleanId) || String(h.id) === String(mediaId));
  if (existingIdx >= 0) {
    history.splice(existingIdx, 1);
    await setWatchHistory(history);
  }

  await Promise.all([
    persistProgressCacheToDisk(),
    updatePlaybackProgressSettings(_memoryPlaybackProgress),
  ]);
  notifyProgressListeners('WATCH_HISTORY_UPDATED', { watchHistory: getAppSettingsWatchHistory() });
  notifyProgressListeners('PLAYBACK_COMPLETED', { mediaId: cleanId, season: sNum, episode: eNum });
};

/**
 * Remove an item from the Continue Watching list
 */
export const removeFromContinueWatching = async (mediaId) => {
  if (!mediaId) return [];
  const cleanId = String(mediaId).replace(/^(movie-|tv-)/, '');
  const rawHistory = getAppSettingsWatchHistory();
  const history = Array.isArray(rawHistory) ? [...rawHistory] : [];
  const filtered = history.filter(h => String(h.id) !== String(cleanId) && String(h.id) !== String(mediaId));

  await setWatchHistory(filtered);
  await Promise.all([
    persistProgressCacheToDisk(),
    updatePlaybackProgressSettings(_memoryPlaybackProgress),
  ]);
  notifyProgressListeners('WATCH_HISTORY_UPDATED', { watchHistory: filtered });
  return filtered;
};

/**
 * Subscribe to playback progress and continue watching changes
 */
export const subscribePlaybackProgress = (callback) => {
  _progressListeners.add(callback);
  return () => {
    _progressListeners.delete(callback);
  };
};

export default {
  getProgressKey,
  getSeriesLatestKey,
  formatPlaybackTime,
  formatRemainingTime,
  initPlaybackProgressManager,
  getPlaybackProgress,
  getLatestSeriesProgress,
  hasResumeProgress,
  savePlaybackProgress,
  markPlaybackCompleted,
  removeFromContinueWatching,
  subscribePlaybackProgress,
};

