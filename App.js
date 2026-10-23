import React, { useState, useEffect, useCallback, useRef, Component } from 'react';
import { View, ScrollView, ActivityIndicator, Text, BackHandler, StyleSheet, Platform, ToastAndroid, TouchableOpacity, Animated, Easing, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from './src/utils/responsive';
import { colors } from './src/config/theme';

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
        <SafeAreaProvider style={styles.mainBackground}>
          <View style={styles.errorBoundaryContainer}>
            <Ionicons name="film-outline" size={scale(56)} color={colors.primary} />
            <Text style={styles.errorBoundaryTitle}>NexPlay</Text>
            <Text style={styles.errorBoundarySubtitle}>
              An unexpected display glitch occurred. Tap below to resume your entertainment experience.
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
import AppHeader from './src/components/AppHeader';
import HeroCarousel from './src/components/HeroCarousel';
import MovieRow from './src/components/MovieRow';
import ContinueWatchingRow from './src/components/ContinueWatchingRow';
import TopTenRow from './src/components/TopTenRow';
import BottomTabBar from './src/components/BottomTabBar';
import MovieDetailScreen from './src/components/MovieDetailScreen';
import CategoryDetailScreen from './src/components/CategoryDetailScreen';
import MoviesScreen from './src/components/MoviesScreen';
import TvSeriesScreen from './src/components/TvSeriesScreen';
import TvSerialsScreen from './src/components/TvSerialsScreen';
import SearchScreen from './src/components/SearchScreen';
import AccountScreen from './src/components/AccountScreen';

// Utilities & Fetch helpers
import { 
  fetchTrendingMovies, 
  fetchPopularMovies, 
  fetchWeeklyTrendingMovies,
  fetchPopularTvSeries,
  fetchActionAdventureMovies,
  fetchCrimeMysteryMovies,
  fetchSciFiFantasyMovies,
  fetchRomanceDramaMovies,
  fetchComedyMovies,
  fetchAnimationAnimeMovies,
  fetchClassicsMovies,
  fetchNewReleases,
  fetchTopRatedMovies,
  fetchIndianCinema,
  fetchKoreanInternationalSeries,
  fetchAwardWinningMovies,
  fetchHistoricalWarMovies,
  fetchHorrorSupernaturalMovies,
  fetchDocumentaries,
  fetchFamilyKidsMovies,
} from './src/utils/api';
import { resolveHeroLineup, getCachedHeroLineup } from './src/utils/HeroManager';
import {
  initSettings,
  hasTmdbApiKey,
  getDontShowDonationAgain,
  subscribeSettings,
  getWatchHistory,
} from './src/utils/AppSettings';
import {
  initPlaybackProgressManager,
  subscribePlaybackProgress,
} from './src/utils/PlaybackProgressManager';
import TmdbApiKeyModal from './src/components/TmdbApiKeyModal';
import DonationModal from './src/components/DonationModal';
import CinematicSplashScreen from './src/components/CinematicSplashScreen';
import { requestAppPermissions } from './src/utils/permissions';
import { ProviderUpdateManager } from './src/utils/ProviderUpdateManager';
import { HERO_ITEMS, TRENDING_NOW, TOP_TEN } from './src/data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [tabHistory, setTabHistory] = useState(['Home']);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [isTmdbReady, setIsTmdbReady] = useState(false);

  // 1-14 Recommended Primary Home Screen Categories
  const [weeklyTop10, setWeeklyTop10] = useState(HERO_ITEMS);
  const [trendingMovies, setTrendingMovies] = useState(TRENDING_NOW);
  const [continueWatching, setContinueWatching] = useState([]);
  const [popularMovies, setPopularMovies] = useState(TOP_TEN);
  const [popularSeries, setPopularSeries] = useState([]);
  const [actionAdventureMovies, setActionAdventureMovies] = useState([]);
  const [crimeMysteryMovies, setCrimeMysteryMovies] = useState([]);
  const [scifiFantasyMovies, setScifiFantasyMovies] = useState([]);
  const [romanceDramaMovies, setRomanceDramaMovies] = useState([]);
  const [comedyMovies, setComedyMovies] = useState([]);
  const [animationAnimeMovies, setAnimationAnimeMovies] = useState([]);
  const [classicsMovies, setClassicsMovies] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);

  // Deep Scroll Discovery Lineup (Section 2: More categories to keep scrolling)
  const [indianCinemaMovies, setIndianCinemaMovies] = useState([]);
  const [koreanSeries, setKoreanSeries] = useState([]);
  const [awardWinningMovies, setAwardWinningMovies] = useState([]);
  const [historicalWarMovies, setHistoricalWarMovies] = useState([]);
  const [horrorMovies, setHorrorMovies] = useState([]);
  const [documentaryMovies, setDocumentaryMovies] = useState([]);
  const [familyKidsMovies, setFamilyKidsMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [navigationStack, setNavigationStack] = useState([]);
  const [hasTmdbKey, setHasTmdbKey] = useState(false);
  const [showTmdbModal, setShowTmdbModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [homeLayoutReady, setHomeLayoutReady] = useState(false);
  const lastBackPressRef = useRef(0);

  // Home screen smooth reveal animation values
  const homeFadeAnim = useRef(new Animated.Value(0)).current;
  const homeScaleAnim = useRef(new Animated.Value(0.97)).current;
  const homeTranslateY = useRef(new Animated.Value(14)).current;

  // Called the exact instant launch screen starts fading out
  const handleRevealStart = useCallback(() => {
    Animated.parallel([
      Animated.timing(homeFadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(homeScaleAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(homeTranslateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [homeFadeAnim, homeScaleAnim, homeTranslateY]);

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

  // Backward Navigation Handler
  const handleBack = useCallback(() => {
    // 1. If inside nested movie/series details
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
    // 4. If on a non-Home tab/screen -> navigate back through tab history to Home
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

  // Hardware Back Button Listener & Orientation Unlock
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});

    const onHardwareBackPress = () => {
      return handleBack();
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => backSubscription.remove();
  }, [handleBack]);

  useEffect(() => {
    ProviderUpdateManager.init({ autoCheck: true });

    async function loadData() {
      // 3. Load Continue Watching from stored playback history
      setContinueWatching(getWatchHistory());

      if (!hasTmdbApiKey()) {
        setWeeklyTop10(HERO_ITEMS);
        setTrendingMovies(TRENDING_NOW);
        setPopularMovies(TOP_TEN);
        setPopularSeries([]);
        setActionAdventureMovies([]);
        setCrimeMysteryMovies([]);
        setScifiFantasyMovies([]);
        setRomanceDramaMovies([]);
        setComedyMovies([]);
        setAnimationAnimeMovies([]);
        setClassicsMovies([]);
        setNewReleases([]);
        setTopRatedMovies([]);
        setIndianCinemaMovies([]);
        setKoreanSeries([]);
        setAwardWinningMovies([]);
        setHistoricalWarMovies([]);
        setHorrorMovies([]);
        setDocumentaryMovies([]);
        setFamilyKidsMovies([]);
        setLoading(false);
        setIsTmdbReady(true);
        return;
      }
      try {
        // Fast Phase 1: High priority top rows for rapid launch screen reveal
        const [
          weekly,
          trending, 
          popularM, 
          popularS,
        ] = await Promise.all([
          fetchWeeklyTrendingMovies(),
          fetchTrendingMovies(),
          fetchPopularMovies(),
          fetchPopularTvSeries(),
        ]);
        
        const heroList = await resolveHeroLineup(trending, weekly);
        setWeeklyTop10(heroList.length > 0 ? heroList : (trending || []));
        setTrendingMovies(trending || []);
        setPopularMovies(popularM || []);
        setPopularSeries(popularS || []);

        // Immediately signal layout readiness for smooth launch screen reveal
        setLoading(false);
        setIsTmdbReady(true);

        // Async Phase 2: Fetch discovery categories concurrently in background without blocking launch
        Promise.all([
          fetchActionAdventureMovies().then(d => setActionAdventureMovies(d || [])),
          fetchCrimeMysteryMovies().then(d => setCrimeMysteryMovies(d || [])),
          fetchSciFiFantasyMovies().then(d => setScifiFantasyMovies(d || [])),
          fetchRomanceDramaMovies().then(d => setRomanceDramaMovies(d || [])),
          fetchComedyMovies().then(d => setComedyMovies(d || [])),
          fetchAnimationAnimeMovies().then(d => setAnimationAnimeMovies(d || [])),
          fetchClassicsMovies().then(d => setClassicsMovies(d || [])),
          fetchNewReleases().then(d => setNewReleases(d || [])),
          fetchTopRatedMovies().then(d => setTopRatedMovies(d || [])),
          fetchIndianCinema().then(d => setIndianCinemaMovies(d || [])),
          fetchKoreanInternationalSeries().then(d => setKoreanSeries(d || [])),
          fetchAwardWinningMovies().then(d => setAwardWinningMovies(d || [])),
          fetchHistoricalWarMovies().then(d => setHistoricalWarMovies(d || [])),
          fetchHorrorSupernaturalMovies().then(d => setHorrorMovies(d || [])),
          fetchDocumentaries().then(d => setDocumentaryMovies(d || [])),
          fetchFamilyKidsMovies().then(d => setFamilyKidsMovies(d || [])),
        ]).catch(err => {
          console.warn('[HomeFeed] Discovery rows background fetch error:', err);
        });
      } catch (error) {
        console.error("Error loading movies from TMDB:", error);
      } finally {
        setLoading(false);
        setIsTmdbReady(true);
      }
    }

    // Startup flow: initialize settings & playback progress, check TMDB API key
    (async () => {
      await Promise.all([
        initSettings(),
        initPlaybackProgressManager(),
      ]);
      const keySet = hasTmdbApiKey();
      setHasTmdbKey(keySet);

      if (!keySet) {
        setLoading(false);
        setIsTmdbReady(true);
      } else {
        getCachedHeroLineup().then((cached) => {
          if (cached && cached.length > 0) {
            setWeeklyTop10(cached);
          }
        });
        loadData();
      }
    })();

    const safetyTimer = setTimeout(() => {
      setIsTmdbReady(true);
      setLoading(false);
    }, 5000);

    const unsub = subscribeSettings(({ eventType }) => {
      if (eventType === 'WATCH_HISTORY_UPDATED') {
        setContinueWatching(getWatchHistory());
      } else if (eventType === 'TMDB_KEY_SAVED') {
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
        setWeeklyTop10(HERO_ITEMS);
        setTrendingMovies(TRENDING_NOW);
        setPopularMovies(TOP_TEN);
        setPopularSeries([]);
        setActionAdventureMovies([]);
        setCrimeMysteryMovies([]);
        setScifiFantasyMovies([]);
        setRomanceDramaMovies([]);
        setComedyMovies([]);
        setAnimationAnimeMovies([]);
        setClassicsMovies([]);
        setNewReleases([]);
        setTopRatedMovies([]);
        setIndianCinemaMovies([]);
        setKoreanSeries([]);
        setAwardWinningMovies([]);
        setHistoricalWarMovies([]);
        setHorrorMovies([]);
        setDocumentaryMovies([]);
        setFamilyKidsMovies([]);
      }
    });

    const unsubProgress = subscribePlaybackProgress(({ eventType }) => {
      if (eventType === 'WATCH_HISTORY_UPDATED') {
        setContinueWatching(getWatchHistory());
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setContinueWatching(getWatchHistory());
        if (hasTmdbApiKey()) {
          loadData();
        }
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      if (unsub) unsub();
      if (unsubProgress) unsubProgress();
      if (appStateSub) appStateSub.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={styles.mainBackground}>
        <Animated.View 
          style={[
            styles.mainContainer,
            showIntro ? {
              opacity: homeFadeAnim,
              transform: [
                { scale: homeScaleAnim },
                { translateY: homeTranslateY },
              ],
            } : null,
          ]}
        >
          <StatusBar style="dark" translucent backgroundColor="transparent" />

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
                <View 
                  style={styles.tabContainer}
                  onLayout={() => setHomeLayoutReady(true)}
                >
                  {/* Image 2 Screen 2 Top Header */}
                  <AppHeader
                    type="home"
                    onSearchPress={() => handleTabPress('Search')}
                    onAccountPress={() => handleTabPress('Account')}
                  />

                  <ScrollView 
                    bounces={true}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    onLayout={() => setHomeLayoutReady(true)}
                  >
                    {/* 1. Featured Hero Carousel */}
                    <HeroCarousel 
                      movies={weeklyTop10 && weeklyTop10.length > 0 ? weeklyTop10 : HERO_ITEMS} 
                      onMoviePress={handleMoviePress}
                    />

                    {/* 2. Trending Now */}
                    {trendingMovies && trendingMovies.length > 0 && (
                      <MovieRow 
                        title="Trending Now" 
                        categoryKey="trending_all"
                        data={trendingMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 3. Continue Watching (Recently played content with progress, hidden when empty) */}
                    {continueWatching && continueWatching.length > 0 && (
                      <ContinueWatchingRow 
                        title="Continue Watching" 
                        data={continueWatching} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={() => handleSeeMore({ key: 'continue_watching', title: 'Continue Watching', data: continueWatching })}
                      />
                    )}

                    {/* 4. Popular Movies */}
                    {popularMovies && popularMovies.length > 0 && (
                      <MovieRow 
                        title="Popular Movies" 
                        categoryKey="popular_movies"
                        data={popularMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 5. Popular Series */}
                    {popularSeries && popularSeries.length > 0 && (
                      <MovieRow 
                        title="Popular Series" 
                        categoryKey="popular_tv"
                        data={popularSeries} 
                        showSeasons={true}
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 6. Action & Adventure */}
                    {actionAdventureMovies && actionAdventureMovies.length > 0 && (
                      <MovieRow 
                        title="Action & Adventure" 
                        categoryKey="action_adventure_movies"
                        data={actionAdventureMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 7. Crime, Mystery & Thriller */}
                    {crimeMysteryMovies && crimeMysteryMovies.length > 0 && (
                      <MovieRow 
                        title="Crime, Mystery & Thriller" 
                        categoryKey="crime_mystery_thriller"
                        data={crimeMysteryMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 8. Sci-Fi & Fantasy */}
                    {scifiFantasyMovies && scifiFantasyMovies.length > 0 && (
                      <MovieRow 
                        title="Sci-Fi & Fantasy" 
                        categoryKey="scifi_fantasy_movies"
                        data={scifiFantasyMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 9. Romance & Drama */}
                    {romanceDramaMovies && romanceDramaMovies.length > 0 && (
                      <MovieRow 
                        title="Romance & Drama" 
                        categoryKey="romance_drama_movies"
                        data={romanceDramaMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 10. Comedy & Feel-Good */}
                    {comedyMovies && comedyMovies.length > 0 && (
                      <MovieRow 
                        title="Comedy & Feel-Good" 
                        categoryKey="comedy_movies"
                        data={comedyMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 11. Animation & Anime */}
                    {animationAnimeMovies && animationAnimeMovies.length > 0 && (
                      <MovieRow 
                        title="Animation & Anime" 
                        categoryKey="animation_anime"
                        data={animationAnimeMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 12. Classics & All-Time Favorites */}
                    {classicsMovies && classicsMovies.length > 0 && (
                      <MovieRow 
                        title="Classics & All-Time Favorites" 
                        categoryKey="classics_movies"
                        data={classicsMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 13. New Releases */}
                    {newReleases && newReleases.length > 0 && (
                      <MovieRow 
                        title="New Releases" 
                        categoryKey="new_releases"
                        data={newReleases} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* 14. Top Rated */}
                    {topRatedMovies && topRatedMovies.length > 0 && (
                      <MovieRow 
                        title="Top Rated" 
                        categoryKey="top_rated_movies"
                        data={topRatedMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* ==================== 2. More categories to keep scrolling ==================== */}

                    {/* Indian Cinema (Tamil, Telugu, Hindi, Malayalam, Kannada) */}
                    {indianCinemaMovies && indianCinemaMovies.length > 0 && (
                      <MovieRow 
                        title="Indian Cinema" 
                        categoryKey="indian_cinema"
                        data={indianCinemaMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* Korean Dramas & International Series */}
                    {koreanSeries && koreanSeries.length > 0 && (
                      <MovieRow 
                        title="Korean Dramas & International Series" 
                        categoryKey="korean_international_series"
                        data={koreanSeries} 
                        showSeasons={true}
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* Award-Winning Movies */}
                    {awardWinningMovies && awardWinningMovies.length > 0 && (
                      <MovieRow 
                        title="Award-Winning Movies" 
                        categoryKey="award_winning_movies"
                        data={awardWinningMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* Historical & War */}
                    {historicalWarMovies && historicalWarMovies.length > 0 && (
                      <MovieRow 
                        title="Historical & War" 
                        categoryKey="historical_war_movies"
                        data={historicalWarMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* Horror & Supernatural */}
                    {horrorMovies && horrorMovies.length > 0 && (
                      <MovieRow 
                        title="Horror & Supernatural" 
                        categoryKey="horror_supernatural_movies"
                        data={horrorMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* Documentaries */}
                    {documentaryMovies && documentaryMovies.length > 0 && (
                      <MovieRow 
                        title="Documentaries" 
                        categoryKey="documentary_movies"
                        data={documentaryMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}

                    {/* Family & Kids */}
                    {familyKidsMovies && familyKidsMovies.length > 0 && (
                      <MovieRow 
                        title="Family & Kids" 
                        categoryKey="family_kids_movies"
                        data={familyKidsMovies} 
                        onMoviePress={handleMoviePress} 
                        onSeeMore={handleSeeMore}
                      />
                    )}
                  </ScrollView>
                </View>
              )}

              {/* 2. MOVIES TAB (Image 2 Screen 3) */}
              {activeTab === 'Movies' && (
                <MoviesScreen 
                  onMoviePress={handleMoviePress} 
                  onSeeMore={handleSeeMore}
                  onBack={() => handleTabPress('Home')}
                  onSearchPress={() => handleTabPress('Search')}
                />
              )}

              {/* 3. SERIES TAB (Image 2 Screen 4) */}
              {(activeTab === 'Series' || activeTab === 'TV Series') && (
                <TvSeriesScreen 
                  onMoviePress={handleMoviePress} 
                  onSeeMore={handleSeeMore}
                  onBack={() => handleTabPress('Home')}
                  onSearchPress={() => handleTabPress('Search')}
                />
              )}

              {/* 4. TV SERIALS TAB (Attached Reference Design) */}
              {(activeTab === 'TV Serials' || activeTab === 'My List' || activeTab === 'TvSerials' || activeTab === 'Serials') && (
                <TvSerialsScreen 
                  onMoviePress={handleMoviePress} 
                  onSearchPress={() => handleTabPress('Search')}
                  onAccountPress={() => handleTabPress('Account')}
                  onBack={() => handleTabPress('Home')}
                />
              )}


              {/* 6. SEARCH SCREEN (Image 2 Screen 8) */}
              {activeTab === 'Search' && (
                <SearchScreen 
                  onMoviePress={handleMoviePress} 
                  onBack={() => handleBack()}
                />
              )}

              {/* 7. ACCOUNT SCREEN (Image 2 Screen 7) */}
              {activeTab === 'Account' && (
                <AccountScreen 
                  onBack={() => handleBack()}
                  onNavigateTab={(tab) => handleTabPress(tab)}
                />
              )}

              {/* Docked White Bottom Navigation Bar (Image 2) */}
              <BottomTabBar 
                activeTab={activeTab} 
                onTabPress={handleTabPress} 
              />

              {/* TMDB API Key First-Run & Management Modal */}
              <TmdbApiKeyModal
                visible={showTmdbModal && !showIntro}
                onClose={() => setShowTmdbModal(false)}
                onKeySaved={() => {
                  setShowTmdbModal(false);
                }}
              />

              {/* Support NexPlay / Donation Modal */}
              <DonationModal
                visible={showDonationModal && !showIntro}
                onClose={() => setShowDonationModal(false)}
              />
            </View>
          )}
        </Animated.View>

        {/* Studio Launch Screen (Image 1) */}
        {showIntro && (
          <CinematicSplashScreen 
            onFinish={() => {
              setShowIntro(false);
              requestAppPermissions();
            }} 
            onRevealStart={handleRevealStart}
            isDataReady={isTmdbReady && homeLayoutReady} 
          />
        )}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  mainBackground: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  tabContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },
  errorBoundaryContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
  },
  errorBoundaryTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginTop: verticalScale(16),
    letterSpacing: 0.5,
  },
  errorBoundarySubtitle: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    fontWeight: '400',
    textAlign: 'center',
    marginTop: verticalScale(8),
    lineHeight: moderateScale(20),
  },
  errorBoundaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    borderRadius: scale(14),
    marginTop: verticalScale(24),
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  errorBoundaryButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tmdbMissingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1.2,
    borderColor: '#FECDD3',
    borderRadius: scale(14),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    marginHorizontal: scale(16),
    marginTop: verticalScale(10),
    marginBottom: verticalScale(14),
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
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbMissingTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(13.5),
    fontWeight: '700',
  },
  tmdbMissingSubtitle: {
    color: colors.textSecondary,
    fontSize: moderateScale(11),
    marginTop: verticalScale(1),
  },
  tmdbMissingBtn: {
    backgroundColor: colors.primary,
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
    backgroundColor: '#F9FAFB',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTmdbTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginTop: verticalScale(14),
    textAlign: 'center',
  },
  emptyTmdbDesc: {
    color: colors.textSecondary,
    fontSize: moderateScale(12.5),
    lineHeight: verticalScale(18),
    textAlign: 'center',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(20),
  },
  emptyTmdbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: scale(20),
    height: verticalScale(42),
    borderRadius: scale(21),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyTmdbBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(13.5),
    fontWeight: '800',
  },
});
