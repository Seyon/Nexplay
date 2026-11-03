import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  AppState
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HeroCarousel from './HeroCarousel';
import MovieRow from './MovieRow';
import ContinueWatchingRow from './ContinueWatchingRow';
import TopTenRow from './TopTenRow';
import AppHeader from './AppHeader';
import nexPlayAnimeApi from '../services/NexPlayAnimeApi';
import animeDatabase from '../services/AnimeDatabase';
import { subscribePlaybackProgress } from '../utils/PlaybackProgressManager';
import { verticalScale, scale, moderateScale, SCREEN_WIDTH } from '../utils/responsive';
import { colors } from '../config/theme';
import { getPosterUrl } from '../utils/api';

/**
 * ANIME CATEGORY TABS
 * Quick navigation chips mirroring Home & Movies/Series screens
 */
const ANIME_TABS = [
  { id: 'all', label: 'All' },
  { id: 'airing', label: 'Currently Airing' },
  { id: 'movies', label: 'Anime Movies' },
  { id: 'series', label: 'TV Series' },
  { id: 'top_rated', label: 'Top Rated' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'shonen', label: 'Shonen & Action' },
  { id: 'fantasy', label: 'Fantasy & Isekai' },
  { id: 'romance', label: 'Romance & Drama' },
  { id: 'scifi', label: 'Sci-Fi & Cyberpunk' },
  { id: 'comedy', label: 'Comedy' }
];

export default function AnimeScreen({
  onMoviePress,
  onSeeMore,
  onBack,
  onSearchPress,
  onAccountPress
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // In-Screen Search State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef(null);

  // Continue Watching state
  const [continueWatchingAnime, setContinueWatchingAnime] = useState([]);

  // Anime categories data
  const [heroAnime, setHeroAnime] = useState([]);
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [top10Anime, setTop10Anime] = useState([]);
  const [airingAnime, setAiringAnime] = useState([]);
  const [popularSeries, setPopularSeries] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [upcomingAnime, setUpcomingAnime] = useState([]);
  const [topRatedAnime, setTopRatedAnime] = useState([]);
  const [actionShonen, setActionShonen] = useState([]);
  const [fantasyIsekai, setFantasyIsekai] = useState([]);
  const [romanceDrama, setRomanceDrama] = useState([]);
  const [scifiMecha, setScifiMecha] = useState([]);
  const [comedyAnime, setComedyAnime] = useState([]);

  const isMountedRef = useRef(true);

  // Sync Continue Watching for Anime content
  const refreshContinueWatching = useCallback(() => {
    try {
      const cw = animeDatabase.getContinueWatchingList();
      if (isMountedRef.current) {
        setContinueWatchingAnime(cw || []);
      }
    } catch (e) {
      console.warn('[AnimeScreen] Error loading continue watching:', e?.message || e);
    }
  }, []);

  /**
   * Main data loader:
   * Connects to NexPlay's own Anime API (`GET /api/anime/home`)
   */
  const loadAllAnimeData = useCallback(async () => {
    try {
      setErrorMessage(null);
      refreshContinueWatching();

      const res = await nexPlayAnimeApi.getHome();
      if (!isMountedRef.current) return;

      if (res?.success && res.data) {
        const d = res.data;
        if (d.hero?.length > 0) setHeroAnime(d.hero);
        if (d.top10?.length > 0) setTop10Anime(d.top10);
        if (d.trending?.length > 0) setTrendingAnime(d.trending);
        if (d.airing?.length > 0) setAiringAnime(d.airing);
        if (d.popularSeries?.length > 0) setPopularSeries(d.popularSeries);
        if (d.movies?.length > 0) setPopularMovies(d.movies);
        if (d.upcoming?.length > 0) setUpcomingAnime(d.upcoming);
        if (d.topRated?.length > 0) setTopRatedAnime(d.topRated);
        if (d.actionShonen?.length > 0) setActionShonen(d.actionShonen);
        if (d.fantasyIsekai?.length > 0) setFantasyIsekai(d.fantasyIsekai);
        if (d.romanceDrama?.length > 0) setRomanceDrama(d.romanceDrama);
        if (d.scifiMecha?.length > 0) setScifiMecha(d.scifiMecha);
        if (d.comedy?.length > 0) setComedyAnime(d.comedy);
        if (d.continueWatching?.length > 0) setContinueWatchingAnime(d.continueWatching);
      } else {
        throw new Error(res?.error || 'Failed to load anime feed');
      }
    } catch (err) {
      console.warn('[AnimeScreen] Failed to load anime data:', err?.message || err);
      if (isMountedRef.current && heroAnime.length === 0) {
        setErrorMessage('Unable to load Anime catalogue. Please check your connection and try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [refreshContinueWatching, heroAnime.length]);

  useEffect(() => {
    isMountedRef.current = true;
    loadAllAnimeData();

    // Listen for progress updates to sync Continue Watching row
    const unsubPlayback = subscribePlaybackProgress(() => {
      refreshContinueWatching();
    });

    const unsubDb = animeDatabase.subscribe(() => {
      refreshContinueWatching();
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshContinueWatching();
      }
    });

    return () => {
      isMountedRef.current = false;
      if (typeof unsubPlayback === 'function') unsubPlayback();
      if (typeof unsubDb === 'function') unsubDb();
      if (appStateSub && typeof appStateSub.remove === 'function') appStateSub.remove();
    };
  }, [loadAllAnimeData, refreshContinueWatching]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllAnimeData();
  }, [loadAllAnimeData]);

  // Handle Search Query Changes (Debounced)
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await nexPlayAnimeApi.search({ q: text.trim(), limit: 30 });
        if (isMountedRef.current) {
          setSearchResults(res?.data || []);
        }
      } catch (err) {
        console.warn('[AnimeScreen] Search error:', err);
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    }, 450);
  };

  const handleToggleSearch = () => {
    if (isSearchActive) {
      setIsSearchActive(false);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setIsSearchActive(true);
    }
  };

  // Render Search Result Item (Grid Poster Card)
  const renderSearchResultCard = ({ item }) => {
    const posterUri = item.image || item.poster_path || 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg';
    const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : '8.0';

    return (
      <TouchableOpacity
        style={styles.searchCard}
        activeOpacity={0.84}
        onPress={() => onMoviePress && onMoviePress(item)}
      >
        <Image source={{ uri: posterUri }} style={styles.searchPoster} resizeMode="cover" />
        <View style={styles.searchRatingBadge}>
          <Ionicons name="star" size={scale(10)} color="#F59E0B" />
          <Text style={styles.searchRatingText}>{rating}</Text>
        </View>
        <Text style={styles.searchCardTitle} numberOfLines={1}>{item.title || item.name}</Text>
        <Text style={styles.searchCardSubtitle} numberOfLines={1}>
          {item.genre || 'Anime'} {item.year ? `• ${item.year}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  // 1. Loading State
  if (loading && !refreshing && heroAnime.length === 0 && !errorMessage) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Tenrai Anime Universe...</Text>
      </View>
    );
  }

  // 2. Error State
  if (errorMessage && heroAnime.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline-outline" size={scale(56)} color={colors.primary} />
        <Text style={styles.errorTitle}>Anime Catalogue Unavailable</Text>
        <Text style={styles.errorSubtitle}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={loadAllAnimeData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      {/* 1. Header (NexPlay Logo + Search + Profile Avatar) */}
      <AppHeader
        type="home"
        onSearchPress={handleToggleSearch}
        onAccountPress={onAccountPress}
      />

      {/* 2. In-Screen Search Bar when activated */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={scale(18)} color="#9CA3AF" style={{ marginRight: scale(8) }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search anime series, movies, characters..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus={true}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')}>
                <Ionicons name="close-circle" size={scale(18)} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchCancelButton} onPress={handleToggleSearch}>
            <Text style={styles.searchCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Search Results Overlay / View */}
      {isSearchActive ? (
        <View style={styles.searchResultsContainer}>
          {isSearching ? (
            <View style={styles.searchSpinnerContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.searchSpinnerText}>Searching Tenrai Anime Database...</Text>
            </View>
          ) : searchQuery.trim().length > 0 && searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={scale(48)} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Anime Found</Text>
              <Text style={styles.emptySubtitle}>Try searching for another anime title or keyword.</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id || item.mal_id)}
              renderItem={renderSearchResultCard}
              numColumns={3}
              contentContainerStyle={styles.searchGridList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        <>
          {/* 4. Category Filter Pills */}
          <View style={styles.categoryPillsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPillsScroll}
            >
              {ANIME_TABS.map((tab) => {
                const isActive = activeCategory === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.categoryPill,
                      isActive ? styles.categoryPillActive : styles.categoryPillInactive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setActiveCategory(tab.id)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive ? styles.categoryPillTextActive : styles.categoryPillTextInactive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. Main Scrollable Content */}
          <ScrollView
            bounces={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {/* Featured Hero Carousel (Only on All or Airing) */}
            {(activeCategory === 'all' || activeCategory === 'airing') && heroAnime && heroAnime.length > 0 && (
              <HeroCarousel
                movies={heroAnime}
                onMoviePress={onMoviePress}
                badgeTitle="Tenrai Spotlight"
              />
            )}

            <View style={styles.rowsContainer}>
              {/* Continue Watching (Recently played anime with live progress) */}
              {continueWatchingAnime && continueWatchingAnime.length > 0 && (
                <ContinueWatchingRow
                  title="Continue Watching"
                  data={continueWatchingAnime}
                  onMoviePress={onMoviePress}
                  onSeeMore={() =>
                    onSeeMore &&
                    onSeeMore({
                      key: 'continue_watching',
                      title: 'Continue Watching',
                      data: continueWatchingAnime
                    })
                  }
                />
              )}

              {/* Top 10 Anime This Season / All-Time */}
              {(activeCategory === 'all' || activeCategory === 'top_rated') && top10Anime && top10Anime.length > 0 && (
                <TopTenRow
                  title="Top 10 Anime"
                  data={top10Anime}
                  onMoviePress={onMoviePress}
                />
              )}

              {/* Currently Airing Anime */}
              {(activeCategory === 'all' || activeCategory === 'airing') && airingAnime.length > 0 && (
                <MovieRow
                  title="Currently Airing Anime"
                  categoryKey="airing_anime"
                  data={airingAnime}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Trending Anime */}
              {(activeCategory === 'all' || activeCategory === 'shonen') && trendingAnime.length > 0 && (
                <MovieRow
                  title="Trending Anime"
                  categoryKey="trending_anime"
                  data={trendingAnime}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Popular Anime Series */}
              {(activeCategory === 'all' || activeCategory === 'series') && popularSeries.length > 0 && (
                <MovieRow
                  title="Popular Anime Series"
                  categoryKey="popular_anime_series"
                  data={popularSeries}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Top Rated Anime Feature Films */}
              {(activeCategory === 'all' || activeCategory === 'movies') && popularMovies.length > 0 && (
                <MovieRow
                  title="Anime Movies"
                  categoryKey="popular_anime_movies"
                  data={popularMovies}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Upcoming Releases */}
              {(activeCategory === 'all' || activeCategory === 'upcoming') && upcomingAnime.length > 0 && (
                <MovieRow
                  title="Upcoming Releases"
                  categoryKey="upcoming_anime"
                  data={upcomingAnime}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Shonen & Action */}
              {(activeCategory === 'all' || activeCategory === 'shonen') && actionShonen.length > 0 && (
                <MovieRow
                  title="Shonen & Action"
                  categoryKey="action_shonen_anime"
                  data={actionShonen}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Fantasy & Isekai */}
              {(activeCategory === 'all' || activeCategory === 'fantasy') && fantasyIsekai.length > 0 && (
                <MovieRow
                  title="Fantasy & Isekai"
                  categoryKey="fantasy_isekai_anime"
                  data={fantasyIsekai}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Romance & Drama */}
              {(activeCategory === 'all' || activeCategory === 'romance') && romanceDrama.length > 0 && (
                <MovieRow
                  title="Romance & Drama"
                  categoryKey="romance_drama_anime"
                  data={romanceDrama}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Sci-Fi & Cyberpunk */}
              {(activeCategory === 'all' || activeCategory === 'scifi') && scifiMecha.length > 0 && (
                <MovieRow
                  title="Sci-Fi & Cyberpunk"
                  categoryKey="scifi_mecha_anime"
                  data={scifiMecha}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Comedy & Feel-Good */}
              {(activeCategory === 'all' || activeCategory === 'comedy') && comedyAnime.length > 0 && (
                <MovieRow
                  title="Comedy & Slice of Life"
                  categoryKey="comedy_anime"
                  data={comedyAnime}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}

              {/* Top Rated Classics */}
              {(activeCategory === 'all' || activeCategory === 'top_rated') && topRatedAnime.length > 0 && (
                <MovieRow
                  title="All-Time Highest Rated Anime"
                  categoryKey="top_rated_anime"
                  data={topRatedAnime}
                  showSeasons={true}
                  onMoviePress={onMoviePress}
                  onSeeMore={onSeeMore}
                  showRating={true}
                />
              )}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    fontWeight: '600',
    marginTop: verticalScale(12),
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
  },
  errorTitle: {
    color: '#111827',
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginTop: verticalScale(16),
  },
  errorSubtitle: {
    color: '#6B7280',
    fontSize: moderateScale(13),
    textAlign: 'center',
    marginTop: verticalScale(8),
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
    marginTop: verticalScale(20),
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    height: verticalScale(40),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(13.5),
    color: '#111827',
    paddingVertical: 0,
  },
  searchCancelButton: {
    marginLeft: scale(12),
  },
  searchCancelText: {
    fontSize: moderateScale(13.5),
    color: colors.primary,
    fontWeight: '600',
  },
  searchResultsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchSpinnerContainer: {
    paddingVertical: verticalScale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSpinnerText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#111827',
    marginTop: verticalScale(12),
  },
  emptySubtitle: {
    fontSize: moderateScale(12.5),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: verticalScale(6),
  },
  searchGridList: {
    padding: scale(12),
  },
  searchCard: {
    width: (SCREEN_WIDTH - scale(40)) / 3,
    margin: scale(4),
    marginBottom: verticalScale(14),
  },
  searchPoster: {
    width: '100%',
    height: verticalScale(150),
    borderRadius: scale(8),
    backgroundColor: '#F3F4F6',
  },
  searchRatingBadge: {
    position: 'absolute',
    top: scale(6),
    left: scale(6),
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: scale(4),
    paddingHorizontal: scale(5),
    paddingVertical: verticalScale(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  searchRatingText: {
    color: '#FFFFFF',
    fontSize: moderateScale(10),
    fontWeight: '700',
  },
  searchCardTitle: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#111827',
    marginTop: verticalScale(5),
  },
  searchCardSubtitle: {
    fontSize: moderateScale(10.5),
    color: '#6B7280',
    marginTop: verticalScale(2),
  },
  categoryPillsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: verticalScale(8),
  },
  categoryPillsScroll: {
    paddingHorizontal: scale(16),
    gap: scale(8),
  },
  categoryPill: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(6.5),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
  },
  categoryPillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryPillText: {
    fontSize: moderateScale(12.5),
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryPillTextInactive: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },
  rowsContainer: {
    marginTop: verticalScale(4),
  },
});
