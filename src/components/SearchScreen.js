import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  searchMulti, 
  fetchTopSearchesToday, 
  fetchPopularMovies, 
  fetchPopularTvSeries, 
  getPosterUrl, 
  formatYear 
} from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

const TMDB_GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

export default function SearchScreen({ onMoviePress, onBack }) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 38) + verticalScale(6);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [topSearches, setTopSearches] = useState([]);
  const [popularChips, setPopularChips] = useState([
    'Dune',
    'John Wick',
    'Interstellar',
    'Stranger Things',
    'The Batman',
    'Deadpool'
  ]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchDebounceTimer = useRef(null);
  const inputRef = useRef(null);

  const loadPopularAndTrending = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingPopular(true);
    }
    try {
      // Concurrently fetch popular movies, popular series, and daily trending from TMDB
      const [popMovies, popSeries, trendingItems] = await Promise.all([
        fetchPopularMovies().catch(() => []),
        fetchPopularTvSeries().catch(() => []),
        fetchTopSearchesToday().catch(() => []),
      ]);

      const pool = [
        ...(Array.isArray(trendingItems) ? trendingItems : []),
        ...(Array.isArray(popMovies) ? popMovies : []),
        ...(Array.isArray(popSeries) ? popSeries : []),
      ];

      const combined = [];
      const seenIds = new Set();

      for (const item of pool) {
        if (!item || !item.id) continue;
        const key = `${item.media_type || (item.title ? 'movie' : 'tv')}-${item.id}`;
        if (!seenIds.has(key) && (item.poster_path || item.backdrop_path)) {
          seenIds.add(key);
          combined.push(item);
        }
      }

      if (combined.length > 0) {
        setTopSearches(combined.slice(0, 15));

        // Dynamically extract up-to-date popular search chips from popular titles
        const dynamicChips = [];
        const seenTitles = new Set();
        for (const item of combined) {
          const title = (item.title || item.name || '').trim();
          if (title && !seenTitles.has(title.toLowerCase()) && title.length <= 26) {
            seenTitles.add(title.toLowerCase());
            dynamicChips.push(title);
            if (dynamicChips.length >= 8) break;
          }
        }
        if (dynamicChips.length >= 3) {
          setPopularChips(dynamicChips);
        }
      }
    } catch (err) {
      console.warn('[SearchScreen] Error loading popular searches:', err);
    } finally {
      setIsLoadingPopular(false);
      if (refresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadPopularAndTrending(false);
    return () => { isMounted = false; };
  }, [loadPopularAndTrending]);

  const performSearch = useCallback(async (query) => {
    if (!query || !query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchMulti(query);
      setSearchResults(results);
    } catch (err) {
      console.warn('[SearchScreen] Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchDebounceTimer.current = setTimeout(() => {
      performSearch(text);
    }, 350);
  };

  const handleChipPress = (term) => {
    setSearchQuery(term);
    Keyboard.dismiss();
    performSearch(term);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    inputRef.current?.focus();
  };

  const renderSearchResultItem = ({ item }) => {
    const posterUri = getPosterUrl(item.poster_path || item.backdrop_path);
    const title = item.title || item.name || '';
    const year = formatYear(item.release_date || item.first_air_date);
    const isTv = item.media_type === 'tv' || !item.title;

    return (
      <TouchableOpacity
        style={styles.trendingRow}
        activeOpacity={0.8}
        onPress={() => onMoviePress && onMoviePress(item)}
      >
        <Image
          source={{ uri: posterUri }}
          style={styles.itemThumb}
          resizeMode="cover"
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.itemSubtitle}>
            {isTv ? 'Series' : 'Movie'}{year ? ` • ${year}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={scale(18)} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar matching Image 2 Screen 8 with camera hole avoidance */}
      <View style={[styles.searchBarContainer, { paddingTop: topPadding }]}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={scale(22)} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={scale(19)} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search movies, series, actors..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleQueryChange}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={scale(18)} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* When searching, show live results */}
      {searchQuery.trim().length > 0 ? (
        isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item, index) => `search-${item.id || index}`}
            renderItem={renderSearchResultItem}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={scale(44)} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptySub}>We couldn't find anything matching "{searchQuery}".</Text>
          </View>
        )
      ) : (
        /* Default View matching Image 2 Screen 8 with pull-to-refresh */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadPopularAndTrending(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Section: Popular Searches */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular Searches</Text>
            <View style={styles.chipsContainer}>
              {popularChips.map((chip, idx) => (
                <TouchableOpacity
                  key={`chip-${idx}`}
                  style={styles.chip}
                  activeOpacity={0.75}
                  onPress={() => handleChipPress(chip)}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Section: Trending Now */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            {isLoadingPopular && topSearches.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading popular titles...</Text>
              </View>
            ) : topSearches.map((item, index) => {
              const posterUri = item.poster_path
                ? getPosterUrl(item.poster_path)
                : (item.image || getPosterUrl(item.backdrop_path));
              const title = item.title || item.name || '';
              const year = formatYear(item.release_date || item.first_air_date || item.year);
              const genre = item.genre || (Array.isArray(item.genre_ids) && item.genre_ids.length > 0 ? TMDB_GENRE_MAP[item.genre_ids[0]] : null) || (item.media_type === 'tv' ? 'Series' : 'Movie');

              return (
                <TouchableOpacity
                  key={`trending-${item.id || index}`}
                  style={styles.trendingRow}
                  activeOpacity={0.8}
                  onPress={() => onMoviePress && onMoviePress(item)}
                >
                  <Image
                    source={{ uri: posterUri }}
                    style={styles.itemThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                      {genre}{year ? ` • ${year}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={scale(18)} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(12),
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: scale(6),
    marginRight: scale(8),
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(14),
    paddingHorizontal: scale(12),
    height: verticalScale(44),
  },
  searchIcon: {
    marginRight: scale(8),
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: scale(4),
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(100),
  },
  section: {
    marginBottom: verticalScale(22),
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(17),
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: verticalScale(12),
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(7),
    borderRadius: scale(18),
  },
  chipText: {
    color: '#374151',
    fontSize: moderateScale(12.5),
    fontWeight: '600',
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
  },
  itemThumb: {
    width: scale(64),
    height: verticalScale(64),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
    marginLeft: scale(14),
    justifyContent: 'center',
  },
  itemTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(14.5),
    fontWeight: '700',
    marginBottom: verticalScale(3),
  },
  itemSubtitle: {
    color: colors.textSecondary,
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  resultsList: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(100),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: verticalScale(60),
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    marginTop: verticalScale(8),
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: verticalScale(60),
    paddingHorizontal: scale(32),
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginTop: verticalScale(12),
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: moderateScale(12.5),
    textAlign: 'center',
    marginTop: verticalScale(4),
  },
});
