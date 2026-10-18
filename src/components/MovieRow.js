import React from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPosterUrl } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

// Common Genre ID map for subtitle fallback
const GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Doc", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
  10752: "War", 37: "Western", 10759: "Action", 10765: "Sci-Fi"
};

export default function MovieRow({ 
  title, 
  data, 
  categoryKey, 
  onMoviePress, 
  onSeeMore,
  showRating = true,
  showSeasons = false 
}) {
  if (!data || data.length === 0) return null;

  const displayData = data.slice(0, 12);

  const handleSeeMore = () => {
    if (onSeeMore) {
      onSeeMore({
        title,
        key: categoryKey || 'trending',
        data,
      });
    }
  };

  const getGenreName = (item) => {
    if (showSeasons) {
      const s = item.number_of_seasons || 1;
      return s === 1 ? '1 Season' : `${s} Seasons`;
    }
    if (item.genre) return item.genre;
    if (item.genre_ids && item.genre_ids.length > 0) {
      return GENRE_MAP[item.genre_ids[0]] || 'Sci-Fi';
    }
    if (item.genres && item.genres.length > 0) {
      return typeof item.genres[0] === 'object' ? item.genres[0].name : item.genres[0];
    }
    return 'Action';
  };

  const getSubtitle = (item) => {
    const genre = getGenreName(item);
    const year = item.year || (item.release_date || item.first_air_date || '').split('-')[0];
    if (year) {
      return `${genre}  •  ${year}`;
    }
    return genre;
  };

  const renderItem = ({ item }) => {
    let posterUri = item.image;
    if (!posterUri && item.poster_path) {
      posterUri = getPosterUrl(item.poster_path);
    } else if (!posterUri && item.backdrop_path) {
      posterUri = getPosterUrl(item.backdrop_path);
    }
    if (!posterUri) {
      posterUri = 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg';
    }

    const itemTitle = item.title || item.name || '';
    const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : '8.0';
    const subtitle = getSubtitle(item);
    const quality = item.quality || 'HD';

    return (
      <TouchableOpacity 
        style={styles.cardContainer}
        activeOpacity={0.84}
        onPress={() => onMoviePress && onMoviePress(item)}
      >
        {/* Rounded Poster with Badges (proportions matching Image 1: 3.5 cards visible) */}
        <View style={styles.imageWrapper}>
          <Image 
            source={{ uri: posterUri }} 
            style={styles.posterImage}
            resizeMode="cover"
          />

          {/* Top-Right HD Badge */}
          <View style={styles.hdBadge}>
            <Text style={styles.hdText}>{quality}</Text>
          </View>

          {/* Bottom-Left Gold Star Rating Overlay */}
          {showRating && rating ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={scale(8.5)} color="#FACC15" />
              <Text style={styles.ratingBadgeText}>{rating}</Text>
            </View>
          ) : null}
        </View>

        {/* Title Below */}
        <Text numberOfLines={1} style={styles.titleText}>
          {itemTitle}
        </Text>

        {/* Subtitle: Genre • Year */}
        <Text numberOfLines={1} style={styles.subtitleText}>
          {subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sectionContainer}>
      {/* Section Header with Vertical Red Bar, Title & See All > link */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.verticalBar} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        {onSeeMore && (
          <TouchableOpacity 
            style={styles.seeAllButton} 
            activeOpacity={0.7} 
            onPress={handleSeeMore}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={scale(12)} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={displayData}
        horizontal
        showsHorizontalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={3}
        keyExtractor={(item, index) => (item.id ? `movie-${categoryKey || 'cat'}-${item.id}` : `movie-idx-${index}`)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(4),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(6),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalBar: {
    width: scale(3.5),
    height: verticalScale(15),
    backgroundColor: colors.primary,
    borderRadius: scale(1.5),
    marginRight: scale(6),
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: moderateScale(15.5),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  seeAllText: {
    color: '#64748B',
    fontSize: moderateScale(11.5),
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: scale(16),
  },
  cardContainer: {
    width: scale(98),
    marginRight: scale(10),
  },
  imageWrapper: {
    width: scale(98),
    height: Math.round(scale(98) * 1.48),
    borderRadius: scale(10),
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  hdBadge: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: scale(3.5),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
  },
  hdText: {
    color: '#FFFFFF',
    fontSize: moderateScale(8),
    fontWeight: '700',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: scale(4),
    left: scale(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: moderateScale(9),
    fontWeight: '700',
  },
  titleText: {
    color: '#0F172A',
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    marginTop: verticalScale(4),
    lineHeight: moderateScale(15),
  },
  subtitleText: {
    color: '#64748B',
    fontSize: moderateScale(10),
    fontWeight: '500',
    marginTop: verticalScale(1),
  },
});
