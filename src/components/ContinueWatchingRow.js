import React from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBackdropUrl, getPosterUrl } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';
import { removeFromContinueWatching } from '../utils/PlaybackProgressManager';

export default function ContinueWatchingRow({ 
  title = 'Continue Watching', 
  data = [], 
  onMoviePress, 
  onSeeMore,
  onRemoveItem
}) {
  if (!data || data.length === 0) {
    return null;
  }

  const items = data;

  const handlePromptRemove = (item) => {
    const itemTitle = item.title || item.name || 'this title';
    Alert.alert(
      'Remove from Continue Watching?',
      `Do you want to remove "${itemTitle}" from your Continue Watching list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (onRemoveItem) {
              onRemoveItem(item);
            } else {
              await removeFromContinueWatching(item.id);
            }
          }
        }
      ]
    );
  };

  const resolveThumbnailUri = (item) => {
    if (!item) return getPosterUrl(null);

    // 1. Prioritize poster_path (especially for movies to show correct poster)
    if (item.poster_path && typeof item.poster_path === 'string') {
      return getPosterUrl(item.poster_path);
    }
    // 2. If item.image is set (full URL or relative TMDB path)
    if (item.image && typeof item.image === 'string') {
      if (item.image.startsWith('http')) {
        return item.image;
      }
      return getPosterUrl(item.image);
    }
    // 3. Fallback to backdrop_path
    if (item.backdrop_path && typeof item.backdrop_path === 'string') {
      return getBackdropUrl(item.backdrop_path);
    }
    return getPosterUrl(null);
  };

  const renderItem = ({ item }) => {
    const thumbnailUri = resolveThumbnailUri(item);

    const itemTitle = item.title || item.name || '';
    const progress = Math.min(100, Math.max(1, typeof item.progress === 'number' ? Math.round(item.progress) : 50));
    const isTV = item.media_type === 'tv' || Boolean(item.last_episode || item.season || item.episode);
    const subtitle = item.subtitle || (isTV 
      ? `${item.last_episode || (item.season && item.episode ? `S${item.season} E${item.episode}` : 'S1 E1')}${item.time_left ? `  •  ${item.time_left}` : ''}`
      : (item.time_left || 'In Progress')
    );
    const quality = item.quality || 'HD';

    return (
      <TouchableOpacity 
        style={styles.cardContainer}
        activeOpacity={0.84}
        onPress={() => onMoviePress && onMoviePress(item)}
        onLongPress={() => handlePromptRemove(item)}
        delayLongPress={500}
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

          {/* Top-Left Quick Remove Button */}
          <TouchableOpacity
            style={styles.removeButtonCircle}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e) => {
              e.stopPropagation();
              handlePromptRemove(item);
            }}
          >
            <Ionicons name="close" size={scale(9)} color="#FFFFFF" />
          </TouchableOpacity>

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
  removeButtonCircle: {
    position: 'absolute',
    top: scale(4),
    left: scale(4),
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
