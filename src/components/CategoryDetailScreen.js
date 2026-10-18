import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchCategoryMedia, getPosterUrl, formatYear } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - scale(44)) / 3;

export default function CategoryDetailScreen({ category, onBack, onMoviePress }) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 38) + verticalScale(6);
  const categoryTitle = category?.title || 'Explore Category';
  const categoryKey = category?.key || 'trending_all';
  const initialData = category?.data || [];

  const [items, setItems] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'rating' | 'popular'
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    async function loadCategoryItems() {
      setLoading(true);
      try {
        const fetched = await fetchCategoryMedia(categoryKey, 1);
        if (isMounted) {
          if (fetched && fetched.length > 0) {
            setItems(fetched);
          } else if (initialData.length > 0) {
            setItems(initialData);
          }
        }
      } catch (err) {
        console.warn('[CategoryDetailScreen] Error loading category:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCategoryItems();
    return () => { isMounted = false; };
  }, [categoryKey]);

  // Infinite scroll
  const loadMoreItems = async () => {
    if (loading || !hasMore || searchQuery.trim().length > 0) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const nextItems = await fetchCategoryMedia(categoryKey, nextPage);
      if (nextItems && nextItems.length > 0) {
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const unique = nextItems.filter(i => !existingIds.has(i.id));
          return [...prev, ...unique];
        });
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.warn('[CategoryDetailScreen] Error loading more:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter & Sort
  const processedItems = items
    .filter(item => {
      if (!searchQuery.trim()) return true;
      const title = (item.title || item.name || '').toLowerCase();
      return title.includes(searchQuery.toLowerCase().trim());
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = new Date(a.release_date || a.first_air_date || '1970-01-01').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '1970-01-01').getTime();
        return dateB - dateA;
      }
      if (sortBy === 'rating') {
        return (b.vote_average || 0) - (a.vote_average || 0);
      }
      if (sortBy === 'popular') {
        return (b.popularity || 0) - (a.popularity || 0);
      }
      return 0;
    });

  const renderMediaCard = ({ item }) => {
    const isTv = item.media_type === 'tv' || !item.title;
    const title = item.title || item.name || 'Untitled';
    const year = formatYear(item.release_date || item.first_air_date);
    const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : null;
    const posterUri = getPosterUrl(item.poster_path || item.image);

    return (
      <TouchableOpacity
        style={styles.cardContainer}
        activeOpacity={0.82}
        onPress={() => onMoviePress && onMoviePress(item)}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: posterUri }}
            style={styles.posterImage}
            resizeMode="cover"
          />
          {rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={scale(9)} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {year ? `${year} • ` : ''}{isTv ? 'Series' : 'Movie'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Back Button and Category Title */}
        <View style={[styles.header, { paddingTop: topPadding }]}>
          <TouchableOpacity 
            onPress={onBack} 
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={scale(22)} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{categoryTitle}</Text>
            <Text style={styles.headerSubtitle}>
              {processedItems.length} titles
            </Text>
          </View>
        </View>

        {/* In-Category Search Bar */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.inputContainer}>
            <Ionicons name="search" size={scale(16)} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.textInput}
              placeholder={`Search in ${categoryTitle}...`}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={scale(17)} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort Filter Pills */}
          <View style={styles.sortRow}>
            {[
              { id: 'newest', label: 'Newest' },
              { id: 'rating', label: 'Top Rated' },
              { id: 'popular', label: 'Popular' }
            ].map(s => {
              const active = sortBy === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sortPill, active && styles.sortPillActive]}
                  onPress={() => setSortBy(s.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Media Grid */}
        <FlatList
          data={processedItems}
          keyExtractor={(item, index) => `cat-${item.id}-${index}`}
          renderItem={renderMediaCard}
          numColumns={3}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreItems}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="film-outline" size={scale(44)} color={colors.borderLight} />
                <Text style={styles.emptyStateTitle}>No titles found</Text>
                <Text style={styles.emptyStateSub}>
                  No movies or series match "{searchQuery}" in this category.
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingTop: Platform.OS === 'android' ? verticalScale(10) : verticalScale(6),
    paddingBottom: verticalScale(10),
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: scale(4),
    marginRight: scale(10),
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(18),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: colors.primary,
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: verticalScale(1),
  },
  searchBarWrapper: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(8),
    backgroundColor: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    paddingHorizontal: scale(10),
    height: verticalScale(38),
  },
  searchIcon: {
    marginRight: scale(6),
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: moderateScale(13),
    paddingVertical: 0,
    fontWeight: '500',
  },
  sortRow: {
    flexDirection: 'row',
    marginTop: verticalScale(8),
    gap: scale(6),
  },
  sortPill: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(5),
    borderRadius: scale(16),
    backgroundColor: '#F3F4F6',
  },
  sortPillActive: {
    backgroundColor: colors.primary,
  },
  sortPillText: {
    color: colors.textSecondary,
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  sortPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(100),
  },
  cardContainer: {
    width: COLUMN_WIDTH,
    marginBottom: verticalScale(14),
    marginRight: scale(6),
  },
  imageWrapper: {
    width: '100%',
    height: COLUMN_WIDTH * 1.48,
    borderRadius: scale(12),
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: scale(6),
    left: scale(6),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: scale(5),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
    gap: scale(2),
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: moderateScale(9),
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    marginTop: verticalScale(5),
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: moderateScale(10),
    marginTop: verticalScale(1),
  },
  loaderContainer: {
    paddingVertical: verticalScale(20),
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: scale(30),
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginTop: verticalScale(10),
  },
  emptyStateSub: {
    color: colors.textSecondary,
    fontSize: moderateScale(12),
    textAlign: 'center',
    marginTop: verticalScale(4),
  }
});
