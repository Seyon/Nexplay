import React, { useState, useEffect, useCallback, useRef, Component } from 'react';
import { View, ScrollView, ActivityIndicator, Text, BackHandler, StyleSheet, Platform, ToastAndroid, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';

// Top-level Crash-Protection Error Boundary
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[NexPlay ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider style={styles.darkBackground}>
          <View style={styles.errorBoundaryContainer}>
            <Ionicons name="film-outline" size={scale(56)} color="#38bdf8" />
            <Text style={styles.errorBoundaryTitle}>NexPlay Cinema</Text>
            <Text style={styles.errorBoundarySubtitle}>
              An unexpected display glitch occurred. Tap below to resume your cinema experience.
            </Text>
            <TouchableOpacity style={styles.errorBoundaryButton} activeOpacity={0.8} onPress={this.handleRetry}>
              <Text style={styles.errorBoundaryButtonText}>Resume NexPlay</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

// Components
import HeroCarousel from './src/components/HeroCarousel';
import MovieRow from './src/components/MovieRow';
import TopTenRow from './src/components/TopTenRow';
import ContinueWatchingRow from './src/components/ContinueWatchingRow';
import BottomTabBar from './src/components/BottomTabBar';
import MovieDetailScreen from './src/components/MovieDetailScreen';
import CategoryDetailScreen from './src/components/CategoryDetailScreen';
import SearchScreen from './src/components/SearchScreen';
import MoviesScreen from './src/components/MoviesScreen';
import TvSeriesScreen from './src/components/TvSeriesScreen';
import TvSerialsScreen from './src/components/TvSerialsScreen';
import AccountScreen from './src/components/AccountScreen';

// Utilities & Fetch helpers
import { 
  fetchTrendingMovies, 
  fetchPopularMovies, 
  fetchWeeklyTrendingMovies,
  fetchSciFiMovies,
  fetchActionAdventureMovies,
  fetchThrillerHorrorMovies,
  fetchTamilMovies,
  fetchHindiMovies,
  fetchWithRetry
} from './src/utils/api';
import { TMDB_BASE_URL } from './src/config/tmdb';
import AppSettings, {
  initSettings,
  getTmdbApiKey,
  hasTmdbApiKey,
  getDontShowDonationAgain,
  subscribeSettings
} from './src/utils/AppSettings';
import TmdbApiKeyModal from './src/components/TmdbApiKeyModal';
import DonationModal from './src/components/DonationModal';
import { scale, verticalScale, moderateScale } from './src/utils/responsive';
import { requestAppPermissions } from './src/utils/permissions';
import { ProviderUpdateManager } from './src/utils/ProviderUpdateManager';

const INITIAL_FALLBACK_MOVIES = [
  {
    id: 693134,
    title: 'Dune: Part Two',
    overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
    poster_path: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
    backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
    vote_average: 8.2,
    release_date: '2024-02-27',
    runtime: 166,
    genre_ids: [878, 12],
    media_type: 'movie',
    tag: 'New Release'
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    overview: 'The story of J. Robert Oppenheimer’s role in the development of the atomic bomb during World War II.',
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdrop_path: '/rLb2cw69zbTXGIxG06GqC5QZ87b.jpg',
    vote_average: 8.1,
    release_date: '2023-07-19',
    runtime: 180,
    genre_ids: [18, 36],
    media_type: 'movie',
    tag: 'New Release'
  },
  {
    id: 792307,
    title: 'Poor Things',
    overview: 'Brought back to life by an unorthodox scientist, a young woman runs off on a whirlwind adventure across the continents.',
    poster_path: '/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg',
    backdrop_path: '/bQS43HSLZzMjZkcHJz4fUgQ1Ky5.jpg',
    vote_average: 7.8,
    release_date: '2023-12-07',
    runtime: 141,
    genre_ids: [878, 10749],
    media_type: 'movie',
    tag: 'New Release'
  },
  {
    id: 466420,
    title: 'Killers of the Flower Moon',
    overview: 'When oil is discovered in 1920s Oklahoma under Osage Nation land, the Osage people are murdered one by one.',
    poster_path: '/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg',
    backdrop_path: '/1X7vZh9R9DHCKG7CRZ8zs15599Z.jpg',
    vote_average: 7.5,
    release_date: '2023-10-18',
    runtime: 206,
    genre_ids: [80, 18],
    media_type: 'movie',
    tag: 'New Release'
  },
  {
    id: 666277,
    title: 'Past Lives',
    overview: 'Nora and Hae Sung, two deeply connected childhood friends, are wrest apart after Nora’s family emigrates from South Korea.',
    poster_path: '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
    backdrop_path: '/5YZbUmjbMa3ClvSW1Wj3D6XGolb.jpg',
    vote_average: 7.9,
    release_date: '2023-06-02',
    runtime: 106,
    genre_ids: [18, 10749],
    media_type: 'movie',
    tag: 'New Release'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [tabHistory, setTabHistory] = useState(['Home']);
  const [loading, setLoading] = useState(true);
  const [weeklyTop10, setWeeklyTop10] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [scifiMovies, setScifiMovies] = useState([]);
  const [actionAdventureMovies, setActionAdventureMovies] = useState([]);
  const [thrillerHorrorMovies, setThrillerHorrorMovies] = useState([]);
  const [tamilMovies, setTamilMovies] = useState([]);
  const [hindiMovies, setHindiMovies] = useState([]);
  const [continueWatchingMovies, setContinueWatchingMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [navigationStack, setNavigationStack] = useState([]);
  const [isTvSerialsDetailOpen, setIsTvSerialsDetailOpen] = useState(false);
  const [hasTmdbKey, setHasTmdbKey] = useState(false);
  const [showTmdbModal, setShowTmdbModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const lastBackPressRef = useRef(0);

  // Tab Press Handler: record tab history
  const handleTabPress = (tab) => {
    if (tab === activeTab && !selectedMovie && !selectedCategory) return;
    
    // Clear movie stack and category when switching tabs directly
    setSelectedMovie(null);
    setSelectedCategory(null);
    setNavigationStack([]);
    
    if (tab !== activeTab) {
      setTabHistory((prev) => {
        const filtered = prev.filter((t) => t !== tab);
        return [...filtered, tab];
      });
      setActiveTab(tab);
    }
  };

  // Forward Navigation Handler (Home -> Movie A -> Movie B)
  const handleMoviePress = useCallback((movie) => {
    if (selectedMovie) {
      setNavigationStack((prev) => [...prev, selectedMovie]);
    }
    setSelectedMovie(movie);
  }, [selectedMovie]);

  // See More Handler (Explore Category)
  const handleSeeMore = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  // Play Downloaded Media Offline Handler
  const handlePlayOffline = useCallback((downloadItem) => {
    if (!downloadItem) return;
    setSelectedMovie({
      id: downloadItem.mediaId || downloadItem.id,
      title: downloadItem.title,
      name: downloadItem.title,
      overview: downloadItem.subtitle || 'Downloaded offline video media',
      poster_path: downloadItem.poster,
      backdrop_path: downloadItem.poster,
      media_type: downloadItem.mediaType || 'movie',
      isOffline: true,
      localFileUri: downloadItem.fileUri,
      quality: downloadItem.quality,
      seasonNumber: downloadItem.seasonNumber,
      episodeNumber: downloadItem.episodeNumber
    });
  }, []);

  // Backward Navigation Handler (Movie B -> Movie A -> Category -> Screen / Tab -> Home -> Exit)
  const handleBack = useCallback(() => {
    // 1. If inside nested movie/series details (Movie B -> Movie A)
    if (navigationStack.length > 0) {
      const prevMovie = navigationStack[navigationStack.length - 1];
      setNavigationStack((prev) => prev.slice(0, prev.length - 1));
      setSelectedMovie(prevMovie);
      return true;
    }
    // 2. If inside single movie/series detail view -> return to Category or Tab
    if (selectedMovie) {
      setSelectedMovie(null);
      return true;
    }
    // 3. If inside Category detail view -> return to current Tab
    if (selectedCategory) {
      setSelectedCategory(null);
      return true;
    }
    // 4. If on a non-Home tab (e.g. Movies, TV Series, Search, Account) -> navigate back through tab history to Home
    if (activeTab !== 'Home') {
      const newHistory = [...tabHistory];
      newHistory.pop();
      const prevTab = newHistory.length > 0 ? newHistory[newHistory.length - 1] : 'Home';
      setTabHistory(newHistory.length > 0 ? newHistory : ['Home']);
      setActiveTab(prevTab);
      return true;
    }
    // 5. If already on Home tab -> Double tap back button to exit
    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      BackHandler.exitApp();
      return true;
    }
    lastBackPressRef.current = now;
    if (Platform.OS === 'android') {
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
    }
    return true;
  }, [navigationStack, selectedMovie, selectedCategory, activeTab, tabHistory]);

  // System / Android Hardware Back Button Listener & Auto-Rotate Default
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});

    const onHardwareBackPress = () => {
      return handleBack();
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => backSubscription.remove();
  }, [handleBack]);

  useEffect(() => {
    // Request Android required permissions on initial launch
    requestAppPermissions();
    // Initialize OTA Scraper & Provider Dynamic Update Manager from GitHub
    ProviderUpdateManager.init({ autoCheck: true });

    async function loadData() {
      if (!hasTmdbApiKey()) {
        setWeeklyTop10([]);
        setTrendingMovies([]);
        setPopularMovies([]);
        setScifiMovies([]);
        setActionAdventureMovies([]);
        setThrillerHorrorMovies([]);
        setTamilMovies([]);
        setHindiMovies([]);
        setContinueWatchingMovies([]);
        setLoading(false);
        return;
      }
      try {
        const [weekly, trending, popular, scifi, actionAdv, thrillerHorror, tamil, hindi] = await Promise.all([
          fetchWeeklyTrendingMovies(),
          fetchTrendingMovies(),
          fetchPopularMovies(),
          fetchSciFiMovies(),
          fetchActionAdventureMovies(),
          fetchThrillerHorrorMovies(),
          fetchTamilMovies(),
          fetchHindiMovies()
        ]);
        
        const currentKey = getTmdbApiKey();
        const headers = { 'Accept': 'application/json' };

        // Enrich the top 10 weekly items with runtime, seasons, and vote averages
        const weeklySource = weekly.length > 0 ? weekly : trending;
        const detailedWeekly = await Promise.all(
          weeklySource.slice(0, 10).map(async (item) => {
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
                      number_of_seasons: details.number_of_seasons,
                      tag: 'New Episode'
                    };
                  }
                } else {
                  const res = await fetchWithRetry(`${TMDB_BASE_URL}/movie/${item.id}`, { headers });
                  if (res && res.ok) {
                    const details = await res.json();
                    return { 
                      ...item, 
                      media_type: 'movie',
                      runtime: details.runtime,
                      tag: 'New Release'
                    };
                  }
                }
              }
            } catch (err) {
              console.warn(`Failed fetching detailed info for TMDB ID: ${item.id}`, err);
            }
            const isTV = item.media_type === 'tv' ? true :
                         item.media_type === 'movie' ? false :
                         (Boolean(item.first_air_date) && !item.release_date && !item.title);
            return { ...item, media_type: isTV ? 'tv' : 'movie', tag: isTV ? 'New Episode' : 'New Release' };
          })
        );

        setWeeklyTop10(detailedWeekly.length > 0 ? detailedWeekly : []);
        setTrendingMovies(trending.length > 0 ? trending : []);
        setPopularMovies(popular.length > 0 ? popular : []);
        setScifiMovies(scifi.length > 0 ? scifi : []);
        setActionAdventureMovies(actionAdv.length > 0 ? actionAdv : []);
        setThrillerHorrorMovies(thrillerHorror.length > 0 ? thrillerHorror : []);
        setTamilMovies(tamil.length > 0 ? tamil : []);
        setHindiMovies(hindi.length > 0 ? hindi : []);
        
        // Build progress objects for Continue Watching row using a subset of items
        const cwSource = trending.length > 0 ? trending : [];
        const continueWatching = cwSource.slice(1, 6).map((movie, idx) => ({
          ...movie,
          progress: idx === 0 ? 80 : idx === 1 ? 50 : idx === 2 ? 50 : idx === 3 ? 50 : 65
        }));
        setContinueWatchingMovies(continueWatching);
      } catch (error) {
        console.error("Error loading movies from TMDB:", error);
      } finally {
        setLoading(false);
      }
    }

    // Startup flow: initialize settings, check TMDB API key
    (async () => {
      await initSettings();
      const keySet = hasTmdbApiKey();
      setHasTmdbKey(keySet);

      if (!keySet) {
        // First install / first run: mandatory prompt for TMDB API key
        setLoading(false);
        setShowTmdbModal(true);
      } else {
        // Key exists: load data immediately
        loadData();
        // Check donation popup
        if (!getDontShowDonationAgain()) {
          setTimeout(() => {
            setShowDonationModal(true);
          }, 2000);
        }
      }
    })();

    // Listen for settings changes (saving or deleting TMDB key)
    const unsub = subscribeSettings(({ eventType }) => {
      if (eventType === 'TMDB_KEY_SAVED') {
        setHasTmdbKey(true);
        setShowTmdbModal(false);
        loadData();
        if (!getDontShowDonationAgain()) {
          setTimeout(() => {
            setShowDonationModal(true);
          }, 1200);
        }
      } else if (eventType === 'TMDB_KEY_DELETED') {
        setHasTmdbKey(false);
        // Clear all cached media data - strictly do not fetch or use deleted key
        setWeeklyTop10([]);
        setTrendingMovies([]);
        setPopularMovies([]);
        setScifiMovies([]);
        setActionAdventureMovies([]);
        setThrillerHorrorMovies([]);
        setTamilMovies([]);
        setHindiMovies([]);
        setContinueWatchingMovies([]);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaProvider style={styles.darkBackground}>
        <View style={styles.loadingContainer}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color="#3fa9f5" />
          <Text style={styles.loadingText}>Loading NexPlay...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={styles.darkBackground}>
        <View style={styles.mainContainer}>
          <StatusBar style="light" translucent backgroundColor="transparent" />


          {selectedMovie ? (
            <MovieDetailScreen 
              movie={selectedMovie} 
              onBack={handleBack}
              onNavigateMovie={handleMoviePress}
            />
          ) : selectedCategory ? (
            <CategoryDetailScreen
              category={selectedCategory}
              onBack={handleBack}
              onMoviePress={handleMoviePress}
            />
          ) : (
          <View style={styles.screenWrapper}>
            {/* 1. HOME TAB */}
            {activeTab === 'Home' && (
              <ScrollView 
                bounces={true}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Missing TMDB API Key Banner */}
                {!hasTmdbKey && (
                  <TouchableOpacity
                    style={styles.tmdbMissingBanner}
                    activeOpacity={0.85}
                    onPress={() => setShowTmdbModal(true)}
                  >
                    <View style={styles.tmdbMissingLeft}>
                      <View style={styles.tmdbMissingIconCircle}>
                        <Ionicons name="key" size={scale(18)} color="#38bdf8" />
                      </View>
                      <View style={{ flex: 1, marginLeft: scale(10) }}>
                        <Text style={styles.tmdbMissingTitle}>TMDB API Key Required</Text>
                        <Text style={styles.tmdbMissingSubtitle}>Tap here to enter your key & load movies</Text>
                      </View>
                    </View>
                    <View style={styles.tmdbMissingBtn}>
                      <Text style={styles.tmdbMissingBtnText}>Enter Key</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Animated Weekly Top 10 Hero Carousel with Ratings, Duration, Year & Genres */}
                {weeklyTop10.length > 0 && (
                  <HeroCarousel 
                    movies={weeklyTop10.length > 0 ? weeklyTop10 : trendingMovies} 
                    onMoviePress={handleMoviePress}
                  />
                )}

                {/* Empty State when no TMDB Key */}
                {!hasTmdbKey && weeklyTop10.length === 0 && (
                  <View style={styles.emptyTmdbCard}>
                    <Ionicons name="film-outline" size={scale(48)} color="#38bdf8" />
                    <Text style={styles.emptyTmdbTitle}>No TMDB API Key Configured</Text>
                    <Text style={styles.emptyTmdbDesc}>
                      NexPlay requires your personal TMDB API key to fetch movie posters, descriptions, and trending lists.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyTmdbBtn}
                      activeOpacity={0.85}
                      onPress={() => setShowTmdbModal(true)}
                    >
                      <Ionicons name="key" size={scale(16)} color="#ffffff" style={{ marginRight: scale(6) }} />
                      <Text style={styles.emptyTmdbBtnText}>Enter TMDB API Key</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Dynamic Categories List */}
                <View style={styles.categoriesContainer}>
                  {/* 1. Trending Now */}
                  <MovieRow 
                    title="Trending Now" 
                    categoryKey="trending_all"
                    data={trendingMovies} 
                    onMoviePress={handleMoviePress} 
                    onSeeMore={handleSeeMore}
                  />
                  
                  {/* 2. Top 10 in your Country with Glowing Outlined Rank Numbers */}
                  <TopTenRow 
                    title="Top 10 in your Country" 
                    data={popularMovies} 
                    onMoviePress={handleMoviePress} 
                  />

                  {/* 3. Sci-Fi */}
                  {scifiMovies.length > 0 && (
                    <MovieRow 
                      title="Sci-Fi" 
                      categoryKey="scifi_movies"
                      data={scifiMovies} 
                      onMoviePress={handleMoviePress} 
                      onSeeMore={handleSeeMore}
                    />
                  )}

                  {/* 4. Action & Adventure */}
                  {actionAdventureMovies.length > 0 && (
                    <MovieRow 
                      title="Action & Adventure" 
                      categoryKey="action_adventure_movies"
                      data={actionAdventureMovies} 
                      onMoviePress={handleMoviePress} 
                      onSeeMore={handleSeeMore}
                    />
                  )}

                  {/* 5. Thriller & Horror */}
                  {thrillerHorrorMovies.length > 0 && (
                    <MovieRow 
                      title="Thriller & Horror" 
                      categoryKey="thriller_horror_movies"
                      data={thrillerHorrorMovies} 
                      onMoviePress={handleMoviePress} 
                      onSeeMore={handleSeeMore}
                    />
                  )}

                  {/* 6. Tamil Tentkotta */}
                  {tamilMovies.length > 0 && (
                    <MovieRow 
                      title="Tamil Tentkotta" 
                      categoryKey="tamil_movies"
                      data={tamilMovies} 
                      onMoviePress={handleMoviePress} 
                      onSeeMore={handleSeeMore}
                    />
                  )}

                  {/* 4. Hindi Movies */}
                  {hindiMovies.length > 0 && (
                    <MovieRow 
                      title="Hindi Movies" 
                      categoryKey="hindi_movies"
                      data={hindiMovies} 
                      onMoviePress={handleMoviePress} 
                      onSeeMore={handleSeeMore}
                    />
                  )}
                  
                  {/* 5. Continue Watching with Progress Indicators */}
                  <ContinueWatchingRow 
                    title="Continue Watching" 
                    data={continueWatchingMovies} 
                    onMoviePress={handleMoviePress} 
                  />
                </View>
              </ScrollView>
            )}

            {/* 2. MOVIES TAB */}
            {activeTab === 'Movies' && (
              <MoviesScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
              />
            )}

            {/* 3. SERIES TAB */}
            {(activeTab === 'Series' || activeTab === 'TV Series') && (
              <TvSeriesScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
              />
            )}

            {/* 4. LIVE TV & SERIALS TAB */}
            {(activeTab === 'Live TV & Serials' || activeTab === 'TV Serials') && (
              <TvSerialsScreen 
                onMoviePress={handleMoviePress} 
                onSeeMore={handleSeeMore}
                onDetailStateChange={setIsTvSerialsDetailOpen}
              />
            )}

            {/* 4. SEARCH TAB */}
            {activeTab === 'Search' && (
              <SearchScreen onMoviePress={handleMoviePress} />
            )}

            {/* 5. ACCOUNT TAB */}
            {activeTab === 'Account' && (
              <AccountScreen onPlayOffline={handlePlayOffline} />
            )}

            {/* Top-Right Account Profile Button */}
            {!isTvSerialsDetailOpen && (
              <TouchableOpacity
                style={[
                  styles.topAccountBtn,
                  activeTab === 'Account' && styles.topAccountBtnActive
                ]}
                activeOpacity={0.8}
                onPress={() => activeTab === 'Account' ? handleTabPress('Home') : handleTabPress('Account')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={activeTab === 'Account' ? 'person' : 'person-outline'}
                  size={scale(17)}
                  color={activeTab === 'Account' ? '#38bdf8' : '#ffffff'}
                />
              </TouchableOpacity>
            )}

            {/* Floating Glassmorphic Bottom Navigation Bar */}
            <BottomTabBar 
              activeTab={activeTab} 
              onTabPress={handleTabPress} 
            />

            {/* TMDB API Key First-Run & Management Modal */}
            <TmdbApiKeyModal
              visible={showTmdbModal}
              onClose={() => setShowTmdbModal(false)}
              onKeySaved={() => {
                setShowTmdbModal(false);
              }}
            />

            {/* Support NexPlay / Donation Modal */}
            <DonationModal
              visible={showDonationModal}
              onClose={() => setShowDonationModal(false)}
            />
          </View>
        )}
      </View>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  darkBackground: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  errorBoundaryContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
  },
  errorBoundaryTitle: {
    color: '#ffffff',
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginTop: verticalScale(16),
    letterSpacing: 0.5,
  },
  errorBoundarySubtitle: {
    color: '#94a3b8',
    fontSize: moderateScale(13),
    fontWeight: '400',
    textAlign: 'center',
    marginTop: verticalScale(8),
    lineHeight: moderateScale(20),
  },
  errorBoundaryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    borderRadius: scale(14),
    marginTop: verticalScale(24),
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  errorBoundaryButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: '#09090b',
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },
  categoriesContainer: {
    marginTop: verticalScale(-8),
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  accountContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  accountCard: {
    alignItems: 'center',
    backgroundColor: '#18181b',
    padding: scale(28),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    width: '100%',
  },
  accountTitle: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  accountSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  accountBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.20)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  accountBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topAccountBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : verticalScale(34)) : verticalScale(44),
    right: scale(16),
    zIndex: 998,
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  topAccountBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
  },
  tmdbMissingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: scale(14),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    marginHorizontal: scale(16),
    marginTop: verticalScale(10),
    marginBottom: verticalScale(14),
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  tmdbMissingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tmdbMissingIconCircle: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbMissingTitle: {
    color: '#ffffff',
    fontSize: moderateScale(13.5),
    fontWeight: '700',
  },
  tmdbMissingSubtitle: {
    color: '#94a3b8',
    fontSize: moderateScale(11),
    marginTop: verticalScale(1),
  },
  tmdbMissingBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(14),
  },
  tmdbMissingBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(11.5),
    fontWeight: '800',
  },
  emptyTmdbCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(48),
    paddingHorizontal: scale(28),
    marginHorizontal: scale(16),
    marginTop: verticalScale(20),
    backgroundColor: 'rgba(18, 18, 24, 0.65)',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTmdbTitle: {
    color: '#ffffff',
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginTop: verticalScale(14),
    textAlign: 'center',
  },
  emptyTmdbDesc: {
    color: '#94a3b8',
    fontSize: moderateScale(12.5),
    lineHeight: verticalScale(18),
    textAlign: 'center',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(20),
  },
  emptyTmdbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: scale(20),
    height: verticalScale(42),
    borderRadius: scale(21),
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  emptyTmdbBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(13.5),
    fontWeight: '800',
  },
});
