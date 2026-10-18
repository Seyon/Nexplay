import React from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity } from 'react-native';
import { getPosterUrl } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

export default function TopTenRow({ title = 'Top 10 This Week', data, onMoviePress }) {
  if (!data || data.length === 0) return null;

  const renderItem = ({ item, index }) => {
    const rankNumber = index + 1;
    const posterUri = getPosterUrl(item.poster_path || item.image);
    const itemTitle = item.title || item.name || '';

    return (
      <TouchableOpacity 
        style={styles.itemContainer}
        activeOpacity={0.82}
        onPress={() => onMoviePress && onMoviePress(item)}
      >
        <View style={styles.cardWrapper}>
          {/* Poster */}
          <View style={styles.posterWrapper}>
            <Image 
              source={{ uri: posterUri }} 
              style={styles.posterImage}
              resizeMode="cover"
            />
            {/* Rank badge at bottom left of card */}
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{rankNumber}</Text>
            </View>
          </View>
        </View>
        
        {/* Title */}
        <Text 
          numberOfLines={1} 
          style={styles.titleText}
        >
          {itemTitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        data={data.slice(0, 10)}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => (item.id ? `top10-${item.id}` : `top10-idx-${index}`)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: verticalScale(14),
    marginBottom: verticalScale(6),
  },
  sectionHeader: {
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(8),
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(17),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  listContent: {
    paddingHorizontal: scale(16),
  },
  itemContainer: {
    width: scale(110),
    marginRight: scale(12),
  },
  cardWrapper: {
    position: 'relative',
  },
  posterWrapper: {
    width: scale(110),
    height: Math.round(scale(110) * 1.50),
    borderRadius: scale(12),
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  rankBadge: {
    position: 'absolute',
    bottom: scale(6),
    left: scale(6),
    width: scale(22),
    height: scale(22),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  rankBadgeText: {
    color: colors.textPrimary,
    fontSize: moderateScale(12),
    fontWeight: '900',
  },
  titleText: {
    color: colors.textPrimary,
    fontSize: moderateScale(12.5),
    fontWeight: '700',
    marginTop: verticalScale(5),
    lineHeight: moderateScale(16),
  },
});
