import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  AppState
} from 'react-native';
import HeroCarousel from './HeroCarousel';
import MovieRow from './MovieRow';
import TopTenRow from './TopTenRow';
import AppHeader from './AppHeader';
import {
  fetchWeeklyTrendingMoviesOnly,
  fetchDailyTrendingMoviesOnly,
  fetchPopularMovies,
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
  fetchAwardWinningMovies,
  fetchHistoricalWarMovies,
  fetchHorrorSupernaturalMovies,
  fetchDocumentaries,
  fetchFamilyKidsMovies
} from '../utils/api';
import { resolveMoviesHeroLineup } from '../utils/HeroManager';
import { verticalScale, scale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';
import { subscribeSettings, hasTmdbApiKey } from '../utils/AppSettings';

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Action & Adventure' },
  { id: 'crime', label: 'Crime & Mystery' },
  { id: 'scifi', label: 'Sci-Fi & Fantasy' },
  { id: 'romance', label: 'Romance & Drama' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'animation', label: 'Animation' },
  { id: 'classics', label: 'Classics' },
  { id: 'new', label: 'New Releases' },
  { id: 'top_rated', label: 'Top Rated' }
];

export default function MoviesScreen({ onMoviePress, onSeeMore, onBack, onSearchPress }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 14 Categories (Movies Only)
  const [heroMovies, setHeroMovies] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [top10Movies, setTop10Movies] = useState([]);
  const [actionMovies, setActionMovies] = useState([]);
  const [crimeMovies, setCrimeMovies] = useState([]);
  const [scifiMovies, setScifiMovies] = useState([]);
  const [romanceMovies, setRomanceMovies] = useState([]);
  const [comedyMovies, setComedyMovies] = useState([]);
  const [animationMovies, setAnimationMovies] = useState([]);
  const [classicsMovies, setClassicsMovies] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [indianCinema, setIndianCinema] = useState([]);
  const [awardWinning, setAwardWinning] = useState([]);
  const [historicalWar, setHistoricalWar] = useState([]);
  const [horrorMovies, setHorrorMovies] = useState([]);
  const [documentaries, setDocumentaries] = useState([]);
  const [familyKids, setFamilyKids] = useState([]);

  const isMountedRef = useRef(true);

  const loadAllMoviesData = useCallback(async () => {
    if (!hasTmdbApiKey()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Phase 1: High priority top rows for instant render
      const [weeklyTrending, dailyTrending, popular] = await Promise.all([
        fetchWeeklyTrendingMoviesOnly(),
        fetchDailyTrendingMoviesOnly(),
        fetchPopularMovies()
      ]);

      const weeklyList = (weeklyTrending || []).map(m => ({ ...m, media_type: 'movie' }));
      const dailyList = (dailyTrending || []).map(m => ({ ...m, media_type: 'movie' }));
      const popularList = (popular || []).map(m => ({ ...m, media_type: 'movie' }));

      // Resolve Top 10 Weekly Trending Featured Movies for Hero Carousel
      const heroLineup = await resolveMoviesHeroLineup(weeklyList.length > 0 ? weeklyList : popularList);

      if (isMountedRef.current) {
        setHeroMovies(heroLineup.length > 0 ? heroLineup : weeklyList);
        setTrendingMovies(dailyList.length > 0 ? dailyList : weeklyList);
        setPopularMovies(popularList);
        setTop10Movies(weeklyList.length > 0 ? weeklyList.slice(0, 10) : popularList.slice(0, 10));
        setLoading(false);
      }

      // Phase 2: Concurrent background hydration of all discovery rows
      Promise.all([
        fetchActionAdventureMovies().then(d => isMountedRef.current && setActionMovies(d || [])),
        fetchCrimeMysteryMovies().then(d => isMountedRef.current && setCrimeMovies(d || [])),
        fetchSciFiFantasyMovies().then(d => isMountedRef.current && setScifiMovies(d || [])),
        fetchRomanceDramaMovies().then(d => isMountedRef.current && setRomanceMovies(d || [])),
        fetchComedyMovies().then(d => isMountedRef.current && setComedyMovies(d || [])),
        fetchAnimationAnimeMovies().then(d => isMountedRef.current && setAnimationMovies(d || [])),
        fetchClassicsMovies().then(d => isMountedRef.current && setClassicsMovies(d || [])),
        fetchNewReleases().then(d => isMountedRef.current && setNewReleases(d || [])),
        fetchTopRatedMovies().then(d => isMountedRef.current && setTopRatedMovies(d || [])),
        fetchIndianCinema().then(d => isMountedRef.current && setIndianCinema(d || [])),
        fetchAwardWinningMovies().then(d => isMountedRef.current && setAwardWinning(d || [])),
        fetchHistoricalWarMovies().then(d => isMountedRef.current && setHistoricalWar(d || [])),
        fetchHorrorSupernaturalMovies().then(d => isMountedRef.current && setHorrorMovies(d || [])),
        fetchDocumentaries().then(d => isMountedRef.current && setDocumentaries(d || [])),
        fetchFamilyKidsMovies().then(d => isMountedRef.current && setFamilyKids(d || []))
      ]).catch(err => {
        console.warn('[MoviesScreen] Background hydration error:', err);
      });
    } catch (err) {
      console.warn('[MoviesScreen] Error loading movie collections:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadAllMoviesData();
    const unsub = subscribeSettings(({ eventType }) => {
      if (eventType === 'TMDB_KEY_SAVED') {
        loadAllMoviesData();
      }
    });
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && hasTmdbApiKey()) {
        loadAllMoviesData();
      }
    });
    return () => {
      isMountedRef.current = false;
      if (unsub) unsub();
      if (appStateSub) appStateSub.remove();
    };
  }, [loadAllMoviesData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllMoviesData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Movies...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      {/* Screen Header */}
      <AppHeader
        type="screen"
        title="Movies"
        onBack={onBack}
        onSearchPress={onSearchPress}
        showSearch={true}
      />

      {/* Horizontal Category Filter Pills */}
      <View style={styles.categoryPillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsScroll}
        >
          {CATEGORY_TABS.map((tab) => {
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
        {/* 1. Hero Featured Carousel (Top 10 TMDB Weekly Trending Movies) */}
        {heroMovies.length > 0 && (
          <HeroCarousel
            movies={heroMovies}
            onMoviePress={onMoviePress}
            badgeTitle="Featured Movie"
          />
        )}

        {/* Categories / Rows based on active filter */}
        <View style={styles.rowsContainer}>
          {/* 2. Trending Movies */}
          {activeCategory === 'all' && trendingMovies.length > 0 && (
            <MovieRow
              title="Trending Movies"
              categoryKey="trending_movies"
              data={trendingMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 3. Popular Movies */}
          {activeCategory === 'all' && popularMovies.length > 0 && (
            <MovieRow
              title="Popular Movies"
              categoryKey="popular_movies"
              data={popularMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 4. Top 10 Movies This Week (Ranked Number Cards) */}
          {activeCategory === 'all' && top10Movies.length > 0 && (
            <TopTenRow
              title="Top 10 Movies This Week"
              data={top10Movies}
              onMoviePress={onMoviePress}
            />
          )}

          {/* 5. Action & Adventure Movies */}
          {(activeCategory === 'all' || activeCategory === 'action') && actionMovies.length > 0 && (
            <MovieRow
              title="Action & Adventure"
              categoryKey="action_adventure_movies"
              data={actionMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 6. Crime, Mystery & Thriller Movies */}
          {(activeCategory === 'all' || activeCategory === 'crime') && crimeMovies.length > 0 && (
            <MovieRow
              title="Crime, Mystery & Thriller"
              categoryKey="crime_mystery_thriller"
              data={crimeMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 7. Sci-Fi & Fantasy Movies */}
          {(activeCategory === 'all' || activeCategory === 'scifi') && scifiMovies.length > 0 && (
            <MovieRow
              title="Sci-Fi & Fantasy"
              categoryKey="scifi_fantasy_movies"
              data={scifiMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 8. Romance & Emotional Drama Movies */}
          {(activeCategory === 'all' || activeCategory === 'romance') && romanceMovies.length > 0 && (
            <MovieRow
              title="Romance & Drama"
              categoryKey="romance_drama_movies"
              data={romanceMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 9. Comedy & Feel-Good Movies */}
          {(activeCategory === 'all' || activeCategory === 'comedy') && comedyMovies.length > 0 && (
            <MovieRow
              title="Comedy & Feel-Good"
              categoryKey="comedy_movies"
              data={comedyMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 10. Animation & Anime Movies */}
          {(activeCategory === 'all' || activeCategory === 'animation') && animationMovies.length > 0 && (
            <MovieRow
              title="Animation & Anime"
              categoryKey="animation_anime"
              data={animationMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 11. Classics & All-Time Favorites */}
          {(activeCategory === 'all' || activeCategory === 'classics') && classicsMovies.length > 0 && (
            <MovieRow
              title="Classics & All-Time Favorites"
              categoryKey="classics_movies"
              data={classicsMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 12. New Releases (Now in Theaters / Digital) */}
          {(activeCategory === 'all' || activeCategory === 'new') && newReleases.length > 0 && (
            <MovieRow
              title="New Releases"
              categoryKey="new_releases"
              data={newReleases}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 13. Top Rated Movies */}
          {(activeCategory === 'all' || activeCategory === 'top_rated') && topRatedMovies.length > 0 && (
            <MovieRow
              title="Top Rated Movies"
              categoryKey="top_rated_movies"
              data={topRatedMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {/* 14. Discovery Rows (Movies Only) */}
          {activeCategory === 'all' && indianCinema.length > 0 && (
            <MovieRow
              title="Indian Cinema (Tamil, Telugu, Hindi)"
              categoryKey="indian_cinema"
              data={indianCinema}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {activeCategory === 'all' && awardWinning.length > 0 && (
            <MovieRow
              title="Award-Winning Masterpieces"
              categoryKey="award_winning_movies"
              data={awardWinning}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {activeCategory === 'all' && historicalWar.length > 0 && (
            <MovieRow
              title="Historical & War Movies"
              categoryKey="historical_war_movies"
              data={historicalWar}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {activeCategory === 'all' && horrorMovies.length > 0 && (
            <MovieRow
              title="Spine-Chilling Horror"
              categoryKey="horror_supernatural_movies"
              data={horrorMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {activeCategory === 'all' && documentaries.length > 0 && (
            <MovieRow
              title="Fascinating Documentaries"
              categoryKey="documentary_movies"
              data={documentaries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}

          {activeCategory === 'all' && familyKids.length > 0 && (
            <MovieRow
              title="Family & Kids"
              categoryKey="family_kids_movies"
              data={familyKids}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showRating={true}
            />
          )}
        </View>
      </ScrollView>
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
    paddingBottom: verticalScale(90),
  },
  rowsContainer: {
    marginTop: verticalScale(4),
  },
});
