import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text
} from 'react-native';
import HeroCarousel from './HeroCarousel';
import MovieRow from './MovieRow';
import TopTenRow from './TopTenRow';
import {
  fetchWeeklyTrendingMoviesOnly,
  fetchPopularMovies,
  fetchTrendingMovies,
  fetchSciFiMovies,
  fetchActionAdventureMovies,
  fetchThrillerHorrorMovies,
  fetchTamilMovies,
  fetchHindiMovies,
  fetchTopRatedMovies
} from '../utils/api';
import { verticalScale, scale, moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { hasTmdbApiKey, subscribeSettings } from '../utils/AppSettings';

export default function MoviesScreen({ onMoviePress, onSeeMore }) {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [weeklyHeroMovies, setWeeklyHeroMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [sciFiMovies, setSciFiMovies] = useState([]);
  const [actionMovies, setActionMovies] = useState([]);
  const [horrorMovies, setHorrorMovies] = useState([]);
  const [tamilMovies, setTamilMovies] = useState([]);
  const [hindiMovies, setHindiMovies] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);

  const loadAllMoviesData = useCallback(async () => {
    try {
      const [
        heroData,
        popularData,
        trendingData,
        sciFiData,
        actionData,
        horrorData,
        tamilData,
        hindiData,
        topRatedData
      ] = await Promise.all([
        fetchWeeklyTrendingMoviesOnly(),
        fetchPopularMovies(),
        fetchTrendingMovies(),
        fetchSciFiMovies(),
        fetchActionAdventureMovies(),
        fetchThrillerHorrorMovies(),
        fetchTamilMovies(),
        fetchHindiMovies(),
        fetchTopRatedMovies()
      ]);

      setWeeklyHeroMovies(heroData.length > 0 ? heroData : popularData);
      setPopularMovies(popularData);
      setTrendingMovies((trendingData || []).filter(m => m.media_type !== 'tv'));
      setSciFiMovies(sciFiData);
      setActionMovies(actionData);
      setHorrorMovies(horrorData);
      setTamilMovies(tamilData);
      setHindiMovies(hindiData);
      setTopRatedMovies(topRatedData);
    } catch (err) {
      console.warn('[MoviesScreen] Error loading movie collections:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllMoviesData();
    const unsub = subscribeSettings(({ eventType }) => {
      if (eventType === 'TMDB_KEY_SAVED') {
        loadAllMoviesData();
      } else if (eventType === 'TMDB_KEY_DELETED') {
        setWeeklyHeroMovies([]);
        setPopularMovies([]);
        setTrendingMovies([]);
        setSciFiMovies([]);
        setActionMovies([]);
        setHorrorMovies([]);
        setTamilMovies([]);
        setHindiMovies([]);
        setTopRatedMovies([]);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [loadAllMoviesData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllMoviesData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading Movies...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        bounces={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#38bdf8"
            colors={['#38bdf8']}
          />
        }
      >
        {/* Empty state when no TMDB key */}
        {!hasTmdbApiKey() && weeklyHeroMovies.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={scale(48)} color="#38bdf8" />
            <Text style={styles.emptyTitle}>TMDB API Key Required</Text>
            <Text style={styles.emptyDesc}>
              Movies catalog requires your personal TMDB API key. Please configure your key in Account Settings.
            </Text>
          </View>
        )}

        {/* Hero Carousel with Weekly Top Movies */}
        {weeklyHeroMovies.length > 0 && (
          <HeroCarousel
            movies={weeklyHeroMovies}
            onMoviePress={onMoviePress}
          />
        )}

        <View style={styles.categoriesContainer}>
          {/* 1. Top 10 Movies in your Country */}
          {popularMovies.length > 0 && (
            <TopTenRow
              title="Top 10 Movies in your Country"
              data={popularMovies}
              onMoviePress={onMoviePress}
            />
          )}

          {/* 2. Trending Movies */}
          {trendingMovies.length > 0 && (
            <MovieRow
              title="Trending Movies"
              categoryKey="trending_movies"
              data={trendingMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 3. Sci-Fi */}
          {sciFiMovies.length > 0 && (
            <MovieRow
              title="Sci-Fi"
              categoryKey="scifi_movies"
              data={sciFiMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 4. Action & Adventure */}
          {actionMovies.length > 0 && (
            <MovieRow
              title="Action & Adventure"
              categoryKey="action_adventure_movies"
              data={actionMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 5. Thriller & Horror */}
          {horrorMovies.length > 0 && (
            <MovieRow
              title="Thriller & Horror"
              categoryKey="thriller_horror_movies"
              data={horrorMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 6. Tamil Tentkotta */}
          {tamilMovies.length > 0 && (
            <MovieRow
              title="Tamil Tentkotta"
              categoryKey="tamil_movies"
              data={tamilMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 7. Bollywood Blockbusters */}
          {hindiMovies.length > 0 && (
            <MovieRow
              title="Bollywood Blockbusters"
              categoryKey="hindi_movies"
              data={hindiMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 8. Top Rated of All Time */}
          {topRatedMovies.length > 0 && (
            <MovieRow
              title="Critically Acclaimed"
              categoryKey="top_rated_movies"
              data={topRatedMovies}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
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
    backgroundColor: '#09090b',
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
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: scale(28),
    marginTop: verticalScale(30),
    marginHorizontal: scale(16),
    backgroundColor: 'rgba(18, 18, 24, 0.65)',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginTop: verticalScale(14),
    textAlign: 'center',
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: moderateScale(12.5),
    lineHeight: verticalScale(18),
    textAlign: 'center',
    marginTop: verticalScale(8),
  }
});
