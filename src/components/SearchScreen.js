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
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchMulti, fetchTopSearchesToday, getPosterUrl, formatYear } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

const POPULAR_SEARCH_CHIPS = [
  'Dune',
  'John Wick',
  'Interstellar',
  'Money Heist',
  'The Batman',
  'Avengers Endgame',
];

const CURATED_TRENDING_ITEMS = [
  {
    id: 'tr-1',
    title: 'Dune',
    genre: 'Sci-Fi',
    year: '2021',
    poster_path: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    image: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    media_type: 'movie',
    overview: 'Paul Atreides leads nomadic tribes in a battle for control of the desert planet Arrakis.',
  },
  {
    id: 'tr-2',
    title: 'The Batman',
    genre: 'Action',
    year: '2022',
    poster_path: '/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    image: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    media_type: 'movie',
    overview: 'Batman ventures into Gotham City underworld when a sadistic killer leaves behind cryptic clues.',
  },
  {
    id: 'tr-3',
    title: 'Stranger Things',
    genre: 'Sci-Fi',
    year: '2016',
    poster_path: '/56v2ox9aywvYTN9vQJWvTwNVm77.jpg',
    image: 'https://image.tmdb.org/t/p/w500/56v2ox9aywvYTN9vQJWvTwNVm77.jpg',
    media_type: 'tv',
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments.',
  },
  {
    id: 'tr-4',
    title: 'Interstellar',
    genre: 'Sci-Fi',
    year: '2014',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    image: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    media_type: 'movie',
    overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
  },
  {
    id: 'tr-5',
    title: 'The Last of Us',
    genre: 'Drama',
    year: '2023',
    poster_path: '/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    image: 'https://image.tmdb.org/t/p/w500/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    media_type: 'tv',
    overview: 'Twenty years after a fungal outbreak ravages the planet, survivors struggle to stay alive.',
  },
];

export default function SearchScreen({ onMoviePress, onBack }) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 38) + verticalScale(6);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [topSearches, setTopSearches] = useState(CURATED_TRENDING_ITEMS);

  const searchDebounceTimer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function loadTrending() {
      try {
        const results = await fetchTopSearchesToday();
        if (isMounted && results && results.length > 0) {
          setTopSearches(results.slice(0, 10));
        }
      } catch (err) {
        console.warn('[SearchScreen] Error loading trending:', err);
      }
    }
    loadTrending();
    return () => { isMounted = false; };
  }, []);

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
        /* Default View matching Image 2 Screen 8 */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Section: Popular Searches */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular Searches</Text>
            <View style={styles.chipsContainer}>
              {POPULAR_SEARCH_CHIPS.map((chip, idx) => (
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
            {topSearches.map((item, index) => {
              const posterUri = item.image || getPosterUrl(item.poster_path);
              const title = item.title || item.name || '';
              const year = item.year || (item.release_date || item.first_air_date || '').split('-')[0] || '2022';
              const genre = item.genre || 'Action';

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
                      {genre} • {year}
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
