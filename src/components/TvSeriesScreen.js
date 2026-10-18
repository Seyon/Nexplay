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
  fetchWeeklyTrendingTvSeries,
  fetchTrendingTvSeries,
  fetchPopularTvSeries,
  fetchActionAdventureTvSeries,
  fetchCrimeMysteryTvSeries,
  fetchSciFiTvSeries,
  fetchDramaTvSeries,
  fetchComedyTvSeries,
  fetchAnimationAnimeTvSeries,
  fetchClassicsTvSeries,
  fetchNewEpisodesTvSeries,
  fetchTopRatedTvSeries,
  fetchKoreanInternationalSeries,
  fetchIndianTvSerials,
  fetchHistoricalWarTvSeries,
  fetchHorrorTvSeries,
  fetchDocuseries,
  fetchKidsFamilyTvSeries
} from '../utils/api';
import { resolveSeriesHeroLineup } from '../utils/HeroManager';
import { verticalScale, scale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';
import { subscribeSettings, hasTmdbApiKey } from '../utils/AppSettings';

const SERIES_TABS = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Action & Adventure' },
  { id: 'drama', label: 'Drama' },
  { id: 'comedy', label: 'Comedy & Sitcoms' },
  { id: 'crime', label: 'Crime & Mystery' },
  { id: 'scifi', label: 'Sci-Fi & Fantasy' },
  { id: 'animation', label: 'Animation & Anime' },
  { id: 'classics', label: 'Classics' },
  { id: 'new', label: 'On The Air' },
  { id: 'top_rated', label: 'Top Rated' }
];

export default function TvSeriesScreen({ onMoviePress, onSeeMore, onBack, onSearchPress }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 14 Categories (Series Only)
  const [heroSeries, setHeroSeries] = useState([]);
  const [trendingSeries, setTrendingSeries] = useState([]);
  const [popularSeries, setPopularSeries] = useState([]);
  const [top10Series, setTop10Series] = useState([]);
  const [actionSeries, setActionSeries] = useState([]);
  const [crimeSeries, setCrimeSeries] = useState([]);
  const [scifiSeries, setScifiSeries] = useState([]);
  const [dramaSeries, setDramaSeries] = useState([]);
  const [comedySeries, setComedySeries] = useState([]);
  const [animationSeries, setAnimationSeries] = useState([]);
  const [classicsSeries, setClassicsSeries] = useState([]);
  const [newEpisodesSeries, setNewEpisodesSeries] = useState([]);
  const [topRatedSeries, setTopRatedSeries] = useState([]);
  const [koreanSeries, setKoreanSeries] = useState([]);
  const [indianSerials, setIndianSerials] = useState([]);
  const [historicalWarSeries, setHistoricalWarSeries] = useState([]);
  const [horrorSeries, setHorrorSeries] = useState([]);
  const [docuseries, setDocuseries] = useState([]);
  const [kidsFamilySeries, setKidsFamilySeries] = useState([]);

  const isMountedRef = useRef(true);

  const loadAllTvData = useCallback(async () => {
    if (!hasTmdbApiKey()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Phase 1: High priority top rows for instant render
      const [weeklyTrending, dailyTrending, popular] = await Promise.all([
        fetchWeeklyTrendingTvSeries(),
        fetchTrendingTvSeries(),
        fetchPopularTvSeries()
      ]);

      const weeklyList = (weeklyTrending || []).map(s => ({ ...s, media_type: 'tv' }));
      const dailyList = (dailyTrending || []).map(s => ({ ...s, media_type: 'tv' }));
      const popularList = (popular || []).map(s => ({ ...s, media_type: 'tv' }));

      // Resolve Top 10 Weekly Trending Featured Series for Hero Carousel
      const heroLineup = await resolveSeriesHeroLineup(weeklyList.length > 0 ? weeklyList : popularList);

      if (isMountedRef.current) {
        setHeroSeries(heroLineup.length > 0 ? heroLineup : weeklyList);
        setTrendingSeries(dailyList.length > 0 ? dailyList : weeklyList);
        setPopularSeries(popularList);
        setTop10Series(weeklyList.length > 0 ? weeklyList.slice(0, 10) : popularList.slice(0, 10));
        setLoading(false);
      }

      // Phase 2: Concurrent background hydration of all discovery rows
      Promise.all([
        fetchActionAdventureTvSeries().then(d => isMountedRef.current && setActionSeries(d || [])),
        fetchCrimeMysteryTvSeries().then(d => isMountedRef.current && setCrimeSeries(d || [])),
        fetchSciFiTvSeries().then(d => isMountedRef.current && setScifiSeries(d || [])),
        fetchDramaTvSeries().then(d => isMountedRef.current && setDramaSeries(d || [])),
        fetchComedyTvSeries().then(d => isMountedRef.current && setComedySeries(d || [])),
        fetchAnimationAnimeTvSeries().then(d => isMountedRef.current && setAnimationSeries(d || [])),
        fetchClassicsTvSeries().then(d => isMountedRef.current && setClassicsSeries(d || [])),
        fetchNewEpisodesTvSeries().then(d => isMountedRef.current && setNewEpisodesSeries(d || [])),
        fetchTopRatedTvSeries().then(d => isMountedRef.current && setTopRatedSeries(d || [])),
        fetchKoreanInternationalSeries().then(d => isMountedRef.current && setKoreanSeries(d || [])),
        fetchIndianTvSerials().then(d => isMountedRef.current && setIndianSerials(d || [])),
        fetchHistoricalWarTvSeries().then(d => isMountedRef.current && setHistoricalWarSeries(d || [])),
        fetchHorrorTvSeries().then(d => isMountedRef.current && setHorrorSeries(d || [])),
        fetchDocuseries().then(d => isMountedRef.current && setDocuseries(d || [])),
        fetchKidsFamilyTvSeries().then(d => isMountedRef.current && setKidsFamilySeries(d || []))
      ]).catch(err => {
        console.warn('[TvSeriesScreen] Background hydration error:', err);
      });
    } catch (err) {
      console.warn('[TvSeriesScreen] Error loading TV series collections:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadAllTvData();
    const unsub = subscribeSettings(({ eventType }) => {
      if (eventType === 'TMDB_KEY_SAVED') {
        loadAllTvData();
      }
    });
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && hasTmdbApiKey()) {
        loadAllTvData();
      }
    });
    return () => {
      isMountedRef.current = false;
      if (unsub) unsub();
      if (appStateSub) appStateSub.remove();
    };
  }, [loadAllTvData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllTvData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Series...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      {/* Screen Header */}
      <AppHeader
        type="screen"
        title="Series"
        onBack={onBack}
        onSearchPress={onSearchPress}
        showSearch={true}
      />

      {/* Category Pills Row */}
      <View style={styles.categoryPillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsScroll}
        >
          {SERIES_TABS.map((tab) => {
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
        {/* 1. Featured Series Hero Banner (Top 10 TMDB Weekly Trending Series) */}
        {heroSeries.length > 0 && (
          <HeroCarousel
            movies={heroSeries}
            onMoviePress={onMoviePress}
            badgeTitle="Featured Series"
          />
        )}

        <View style={styles.rowsContainer}>
          {/* 2. Trending Series */}
          {activeCategory === 'all' && trendingSeries.length > 0 && (
            <MovieRow
              title="Trending Series"
              categoryKey="trending_tv"
              data={trendingSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 3. Popular Series */}
          {activeCategory === 'all' && popularSeries.length > 0 && (
            <MovieRow
              title="Popular Series"
              categoryKey="popular_tv"
              data={popularSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 4. Top 10 Series This Week (Ranked Number Cards) */}
          {activeCategory === 'all' && top10Series.length > 0 && (
            <TopTenRow
              title="Top 10 Series This Week"
              data={top10Series}
              onMoviePress={onMoviePress}
            />
          )}

          {/* 5. Action & Adventure Series */}
          {(activeCategory === 'all' || activeCategory === 'action') && actionSeries.length > 0 && (
            <MovieRow
              title="Action & Adventure"
              categoryKey="action_adventure_tv"
              data={actionSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 6. Crime, Mystery & Thriller Series */}
          {(activeCategory === 'all' || activeCategory === 'crime') && crimeSeries.length > 0 && (
            <MovieRow
              title="Crime & Mystery Thrillers"
              categoryKey="crime_drama_tv"
              data={crimeSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 7. Sci-Fi & Fantasy Series */}
          {(activeCategory === 'all' || activeCategory === 'scifi') && scifiSeries.length > 0 && (
            <MovieRow
              title="Sci-Fi & Fantasy"
              categoryKey="scifi_tv"
              data={scifiSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 8. Drama Series */}
          {(activeCategory === 'all' || activeCategory === 'drama') && dramaSeries.length > 0 && (
            <MovieRow
              title="Compelling Drama Series"
              categoryKey="drama_series"
              data={dramaSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 9. Comedy & Sitcoms */}
          {(activeCategory === 'all' || activeCategory === 'comedy') && comedySeries.length > 0 && (
            <MovieRow
              title="Binge-Worthy Comedies"
              categoryKey="comedy_tv"
              data={comedySeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 10. Animation & Anime Series */}
          {(activeCategory === 'all' || activeCategory === 'animation') && animationSeries.length > 0 && (
            <MovieRow
              title="Animation & Anime Series"
              categoryKey="animation_anime_series"
              data={animationSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 11. Classics & All-Time Favorite Series */}
          {(activeCategory === 'all' || activeCategory === 'classics') && classicsSeries.length > 0 && (
            <MovieRow
              title="Classics & All-Time Favorites"
              categoryKey="classics_series"
              data={classicsSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 12. New Episodes & On The Air */}
          {(activeCategory === 'all' || activeCategory === 'new') && newEpisodesSeries.length > 0 && (
            <MovieRow
              title="New Episodes & On The Air"
              categoryKey="on_the_air_series"
              data={newEpisodesSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 13. Top Rated Series */}
          {(activeCategory === 'all' || activeCategory === 'top_rated') && topRatedSeries.length > 0 && (
            <MovieRow
              title="Critically Acclaimed Series"
              categoryKey="top_rated_tv"
              data={topRatedSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {/* 14. Discovery Rows (Series Only) */}
          {activeCategory === 'all' && koreanSeries.length > 0 && (
            <MovieRow
              title="Korean Dramas & International"
              categoryKey="korean_international_series"
              data={koreanSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {activeCategory === 'all' && indianSerials.length > 0 && (
            <MovieRow
              title="Indian TV Serials & Daily Soaps"
              categoryKey="indian_tv_serials"
              data={indianSerials}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {activeCategory === 'all' && historicalWarSeries.length > 0 && (
            <MovieRow
              title="Historical, War & Politics"
              categoryKey="historical_war_series"
              data={historicalWarSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {activeCategory === 'all' && horrorSeries.length > 0 && (
            <MovieRow
              title="Supernatural & Mystery Series"
              categoryKey="horror_tv"
              data={horrorSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {activeCategory === 'all' && docuseries.length > 0 && (
            <MovieRow
              title="Fascinating Docuseries"
              categoryKey="docuseries"
              data={docuseries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
            />
          )}

          {activeCategory === 'all' && kidsFamilySeries.length > 0 && (
            <MovieRow
              title="Kids & Family Series"
              categoryKey="kids_family_series"
              data={kidsFamilySeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
              showSeasons={true}
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
