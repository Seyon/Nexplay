import React from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBackdropUrl, getPosterUrl } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

export default function ContinueWatchingRow({ 
  title = 'Continue Watching', 
  data = [], 
  onMoviePress, 
  onSeeMore 
}) {
  if (!data || data.length === 0) {
    return null;
  }

  const items = data;

  const renderItem = ({ item }) => {
    let thumbnailUri = item.image;
    if (!thumbnailUri && item.backdrop_path) {
      thumbnailUri = getBackdropUrl(item.backdrop_path);
    } else if (!thumbnailUri && item.poster_path) {
      thumbnailUri = getPosterUrl(item.poster_path);
    }
    if (!thumbnailUri) {
      thumbnailUri = 'https://image.tmdb.org/t/p/w500/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg';
    }

    const itemTitle = item.title || item.name || '';
    const progress = item.progress || 50;
    const subtitle = item.subtitle || `${item.last_episode || 'S1 E1'}  •  ${item.time_left || '45m left'}`;
    const quality = item.quality || 'HD';

    return (
      <TouchableOpacity 
        style={styles.cardContainer}
        activeOpacity={0.84}
        onPress={() => onMoviePress && onMoviePress(item)}
      >
        <View style={styles.imageWrapper}>
          <Image 
            source={{ uri: thumbnailUri }} 
            style={styles.thumbnailImage}
            resizeMode="cover"
          />

          {/* Top-Right HD Badge */}
          <View style={styles.hdBadge}>
            <Text style={styles.hdText}>{quality}</Text>
          </View>

          {/* Bottom-Left Circular Play Button Overlay */}
          <View style={styles.playButtonCircle}>
            <Ionicons name="play" size={scale(8)} color="#FFFFFF" style={{ marginLeft: scale(1) }} />
          </View>

          {/* Horizontal Red Progress Track Bar at bottom */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Title Below */}
        <Text numberOfLines={1} style={styles.titleText}>
          {itemTitle}
        </Text>

        {/* Subtitle / Episode & Time left */}
        <Text numberOfLines={1} style={styles.subtitleText}>
          {subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.verticalBar} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        {onSeeMore && (
          <TouchableOpacity 
            style={styles.seeAllButton} 
            activeOpacity={0.7} 
            onPress={onSeeMore}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={scale(12)} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => (item.id ? `cw-${item.id}` : `cw-idx-${index}`)}
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
    width: scale(134),
    marginRight: scale(10),
  },
  imageWrapper: {
    width: scale(134),
    height: Math.round(scale(134) * 0.5625),
    borderRadius: scale(10),
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    justifyContent: 'flex-end',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  hdBadge: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: scale(3.5),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
    zIndex: 2,
  },
  hdText: {
    color: '#FFFFFF',
    fontSize: moderateScale(8),
    fontWeight: '700',
  },
  playButtonCircle: {
    position: 'absolute',
    bottom: scale(6),
    left: scale(6),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    borderWidth: 1.1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  progressBarBackground: {
    width: '100%',
    height: verticalScale(2.5),
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 1,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
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
