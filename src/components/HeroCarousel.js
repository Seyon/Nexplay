import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getBackdropUrl, getPosterUrl } from '../utils/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = WINDOW_WIDTH;
const CARD_WIDTH = WINDOW_WIDTH - scale(32);
// Compact landscape cinematic banner matching Image 1 target (~0.63 aspect ratio, ~225-230dp)
const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.63);

// Genre ID to name mapping
const GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Doc", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
  10752: "War", 37: "Western", 10759: "Action", 10765: "Sci-Fi"
};

export default function HeroCarousel({ 
  movies = [], 
  onMoviePress,
  badgeTitle = 'Trending Now'
}) {
  if (!movies || movies.length === 0) return null;

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const isInteracting = useRef(false);

  // Take up to 10 curated hero items
  const data = movies.slice(0, 10);
  if (data.length === 0) return null;

  // Auto-play interval
  useEffect(() => {
    if (data.length <= 1) return;

    const interval = setInterval(() => {
      if (isInteracting.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % data.length;
        try {
          flatListRef.current?.scrollToIndex({
            index: next,
            animated: true,
          });
        } catch (e) {
          flatListRef.current?.scrollToOffset({
            offset: next * SLIDE_WIDTH,
            animated: true
          });
        }
        return next;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [data.length]);

  const onMomentumScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
    isInteracting.current = false;
  };

  const renderSlide = ({ item }) => {
    const titleText = item.title || item.name || 'John Wick';
    
    // Resolve backdrop/poster URI with reliable fallback
    let imageUri = 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg';
    if (item.image) {
      imageUri = item.image;
    } else if (item.backdrop_path) {
      imageUri = getBackdropUrl(item.backdrop_path);
    } else if (item.poster_path) {
      imageUri = getPosterUrl(item.poster_path);
    }

    const dateStr = item.release_date || item.first_air_date || '';
    const year = item.year || (dateStr ? dateStr.split('-')[0] : '2014');

    // Genre names formatted with bullet
    let genreNames = item.genre_names;
    if (!genreNames) {
      const genreIds = item.genre_ids || (item.genres ? item.genres.map(g => typeof g === 'object' ? g.name : GENRE_MAP[g]) : []);
      if (Array.isArray(genreIds) && genreIds.length > 0) {
        genreNames = genreIds
          .map(id => typeof id === 'string' ? id : GENRE_MAP[id])
          .filter(Boolean)
          .slice(0, 2)
          .join('  •  ');
      }
    }
    if (!genreNames) {
      genreNames = 'Action  •  Thriller';
    }

    // Synopsis / Overview text (compact 2 lines)
    const overviewText = item.overview || 
      (item.title === 'John Wick' 
        ? 'An ex-hitman comes out of retirement to track down the people who killed his dog.'
        : 'An exciting story unfolds as the journey takes an unexpected turn into high-stakes thrills.');

    const qualityText = item.quality || 'HD';
    const ageRatingText = item.age_rating || '16+';
    const currentBadge = item.badge || badgeTitle;

    return (
      <View style={styles.slideContainer}>
        <TouchableOpacity 
          style={styles.cardContainer}
          activeOpacity={0.94}
          onPress={() => onMoviePress && onMoviePress(item)}
        >
          {/* 1. Backdrop image layer */}
          <Image
            source={{ uri: imageUri }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />

          {/* 2. Full-bleed gradient overlay with explicit zIndex and bottom-pinning */}
          <LinearGradient
            colors={[
              'transparent',
              'rgba(15, 23, 42, 0.22)',
              'rgba(15, 23, 42, 0.78)',
              'rgba(10, 15, 30, 0.98)'
            ]}
            locations={[0, 0.30, 0.62, 1.0]}
            style={styles.gradient}
          >
            <View style={styles.contentOverlay}>
              {/* 1. Red "Trending Now" Pill Badge at top-left */}
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{currentBadge}</Text>
              </View>

              {/* 2. Featured movie or series title directly beneath badge */}
              <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">
                {titleText}
              </Text>

              {/* 3. One compact metadata row: Genre • Year | [HD] [16+] */}
              <View style={styles.metaRow}>
                <Text style={styles.metaGenresText}>{genreNames}</Text>
                <Text style={styles.metaBullet}>•</Text>
                <Text style={styles.metaYearText}>{year}</Text>

                <Text style={styles.metaDivider}>|</Text>

                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>{qualityText}</Text>
                </View>

                <View style={styles.specBadge}>
                  <Text style={styles.specBadgeText}>{ageRatingText}</Text>
                </View>
              </View>

              {/* 4. Short description with a maximum of two lines */}
              <Text style={styles.overviewText} numberOfLines={2} ellipsizeMode="tail">
                {overviewText}
              </Text>

              {/* 5. One horizontal action row containing Play and My List buttons side by side */}
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={styles.playButton}
                  activeOpacity={0.85}
                  onPress={() => onMoviePress && onMoviePress(item)}
                >
                  <Ionicons name="play" size={scale(13.5)} color="#FFFFFF" />
                  <Text style={styles.playButtonText}>Play</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.myListButton}
                  activeOpacity={0.8}
                  onPress={() => onMoviePress && onMoviePress(item)}
                >
                  <Ionicons name="add" size={scale(15.5)} color="#FFFFFF" />
                  <Text style={styles.myListButtonText}>My List</Text>
                </TouchableOpacity>
              </View>

              {/* 6. Carousel pagination dots positioned immediately beneath action row */}
              {data.length > 1 && (
                <View style={styles.paginationRow}>
                  {data.map((_, idx) => (
                    <View 
                      key={idx} 
                      style={[
                        styles.dot, 
                        idx === activeIndex ? styles.activeDot : styles.inactiveDot
                      ]} 
                    />
                  ))}
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatListRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => (item.id ? `hero-${item.id}` : `hero-idx-${index}`)}
        renderItem={renderSlide}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={() => { isInteracting.current = true; }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: verticalScale(2),
    marginBottom: verticalScale(4),
  },
  slideContainer: {
    width: SLIDE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(16),
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: scale(16),
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
    elevation: 10,
    justifyContent: 'flex-end',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(6),
    paddingTop: verticalScale(10),
  },
  contentOverlay: {
    width: '100%',
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: scale(8),
    height: verticalScale(22),
    borderRadius: scale(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(3),
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: moderateScale(21),
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: moderateScale(25),
    marginBottom: verticalScale(2),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(3),
  },
  metaGenresText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: moderateScale(11.5),
    fontWeight: '600',
  },
  metaBullet: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: moderateScale(10.5),
    marginHorizontal: scale(4),
  },
  metaYearText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: moderateScale(11.5),
    fontWeight: '600',
  },
  metaDivider: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: moderateScale(10.5),
    marginHorizontal: scale(6),
    fontWeight: '300',
  },
  specBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
    marginRight: scale(4),
  },
  specBadgeText: {
    color: '#FFFFFF',
    fontSize: moderateScale(8.5),
    fontWeight: '700',
  },
  overviewText: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: moderateScale(10.5),
    lineHeight: moderateScale(14.5),
    fontWeight: '400',
    marginBottom: verticalScale(6),
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: verticalScale(2),
  },
  playButton: {
    flex: 1,
    minWidth: 0,
    height: verticalScale(38),
    backgroundColor: colors.primary,
    borderRadius: scale(19),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(5),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(13),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  myListButton: {
    flex: 1,
    minWidth: 0,
    height: verticalScale(38),
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: scale(19),
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.40)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  myListButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(5),
    marginBottom: verticalScale(2),
    gap: scale(5),
  },
  dot: {
    borderRadius: scale(2),
  },
  activeDot: {
    width: scale(16),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: colors.primary,
  },
  inactiveDot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
