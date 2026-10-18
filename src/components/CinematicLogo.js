import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

/**
 * CinematicLogo
 * NexPlay Master Brand Component matching reference screenshot:
 * - Red rounded play triangle symbol pointing right
 * - "Nex" in dark charcoal (#0F172A) + "Play" in vibrant crimson red (#E50914)
 * Sizes: 'sm' (Header), 'md' (Card/Header Large), 'lg' (Splash/Profile)
 */
export default function CinematicLogo({ 
  size = 'md', 
  showTagline = false, 
  tagline = 'Your World of Entertainment',
  darkText = true 
}) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  const playIconSize = isLarge ? scale(42) : isSmall ? scale(26) : scale(32);
  const nexFontSize = isLarge ? moderateScale(34) : isSmall ? moderateScale(21) : moderateScale(25);
  const playFontSize = isLarge ? moderateScale(34) : isSmall ? moderateScale(21) : moderateScale(25);
  const taglineFontSize = isLarge ? moderateScale(12) : moderateScale(9.5);

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        {/* Play Triangle Glyph */}
        <View style={styles.iconContainer}>
          <Ionicons 
            name="play" 
            size={playIconSize} 
            color={colors.primary} 
          />
        </View>

        {/* NexPlay Typography: "Nex" (charcoal) + "Play" (crimson red) */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.nexText, 
              { 
                fontSize: nexFontSize, 
                color: darkText ? '#0F172A' : '#FFFFFF' 
              }
            ]}>
              Nex
            </Text>
            <Text style={[styles.playText, { fontSize: playFontSize }]}>
              Play
            </Text>
          </View>
        </View>
      </View>

      {/* Optional Tagline Subtitle */}
      {showTagline && (
        <View style={styles.taglineWrapper}>
          <Text style={[styles.taglineText, { fontSize: taglineFontSize }]}>
            {tagline}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nexText: {
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  playText: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  taglineWrapper: {
    marginTop: verticalScale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineText: {
    color: '#64748B',
    fontWeight: '500',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
