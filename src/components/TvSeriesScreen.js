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
  fetchWeeklyTrendingTvSeries,
  fetchPopularTvSeries,
  fetchSciFiTvSeries,
  fetchActionAdventureTvSeries,
  fetchThrillerHorrorTvSeries,
  fetchTamilTvSeries,
  fetchHindiTvSeries,
  fetchTopRatedTvSeries
} from '../utils/api';
import { verticalScale, scale, moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { hasTmdbApiKey, subscribeSettings } from '../utils/AppSettings';

export default function TvSeriesScreen({ onMoviePress, onSeeMore }) {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [heroSeries, setHeroSeries] = useState([]);
  const [popularSeries, setPopularSeries] = useState([]);
  const [sciFiSeries, setSciFiSeries] = useState([]);
  const [actionAdventureSeries, setActionAdventureSeries] = useState([]);
  const [thrillerHorrorSeries, setThrillerHorrorSeries] = useState([]);
  const [tamilSeries, setTamilSeries] = useState([]);
  const [hindiSeries, setHindiSeries] = useState([]);
  const [topRatedSeries, setTopRatedSeries] = useState([]);

  const loadAllTvData = useCallback(async () => {
    try {
      const [
        heroData,
        popularData,
        sciFiData,
        actionData,
        thrillerData,
        tamilData,
        hindiData,
        topRatedData
      ] = await Promise.all([
        fetchWeeklyTrendingTvSeries(),
        fetchPopularTvSeries(),
        fetchSciFiTvSeries(),
        fetchActionAdventureTvSeries(),
        fetchThrillerHorrorTvSeries(),
        fetchTamilTvSeries(),
        fetchHindiTvSeries(),
        fetchTopRatedTvSeries()
      ]);

      setHeroSeries(heroData.length > 0 ? heroData : popularData);
      setPopularSeries(popularData);
      setSciFiSeries(sciFiData);
      setActionAdventureSeries(actionData);
      setThrillerHorrorSeries(thrillerData);
      setTamilSeries(tamilData);
      setHindiSeries(hindiData);
      setTopRatedSeries(topRatedData);
    } catch (err) {
      console.warn('[TvSeriesScreen] Error loading TV series collections:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllTvData();
    const unsub = subscribeSettings(({ eventType }) => {
      if (eventType === 'TMDB_KEY_SAVED') {
        loadAllTvData();
      } else if (eventType === 'TMDB_KEY_DELETED') {
        setHeroSeries([]);
        setPopularSeries([]);
        setSciFiSeries([]);
        setActionAdventureSeries([]);
        setThrillerHorrorSeries([]);
        setTamilSeries([]);
        setHindiSeries([]);
        setTopRatedSeries([]);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [loadAllTvData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllTvData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading TV Series...</Text>
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
        {/* Hero Carousel with Trending TV Series */}
        {heroSeries.length > 0 && (
          <HeroCarousel
            movies={heroSeries}
            onMoviePress={onMoviePress}
          />
        )}

        <View style={styles.categoriesContainer}>
          {/* 1. Top 10 TV Series */}
          {popularSeries.length > 0 && (
            <TopTenRow
              title="Top 10 Series in your Country"
              data={popularSeries}
              onMoviePress={onMoviePress}
            />
          )}

          {/* 2. Sci-Fi */}
          {sciFiSeries.length > 0 && (
            <MovieRow
              title="Sci-Fi"
              categoryKey="scifi_tv"
              data={sciFiSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 3. Action & Adventure */}
          {actionAdventureSeries.length > 0 && (
            <MovieRow
              title="Action & Adventure"
              categoryKey="action_adventure_tv"
              data={actionAdventureSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 4. Thriller & Horror */}
          {thrillerHorrorSeries.length > 0 && (
            <MovieRow
              title="Thriller & Horror"
              categoryKey="thriller_horror_tv"
              data={thrillerHorrorSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 5. Tamil Series */}
          {tamilSeries.length > 0 && (
            <MovieRow
              title="Tamil Series"
              categoryKey="tamil_tv"
              data={tamilSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 6. Hindi Web Series */}
          {hindiSeries.length > 0 && (
            <MovieRow
              title="Hindi Web Series"
              categoryKey="hindi_tv"
              data={hindiSeries}
              onMoviePress={onMoviePress}
              onSeeMore={onSeeMore}
            />
          )}

          {/* 7. Critically Acclaimed Series */}
          {topRatedSeries.length > 0 && (
            <MovieRow
              title="Critically Acclaimed Series"
              categoryKey="top_rated_tv"
              data={topRatedSeries}
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
