import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import CinematicLogo from './CinematicLogo';
import { colors } from '../config/theme';

/**
 * AppHeader
 * Exact match for reference image:
 * - Automatically accounts for status bar & device punch-hole
 * - 'home': NexPlay Logo on left, Search + Notification Bell (with red badge) + Avatar on right
 * - 'screen': Back arrow on left, Title in bold black, Search or Settings on right
 */
export default function AppHeader({
  type = 'home',
  title = '',
  onBack,
  onSearchPress,
  onAccountPress,
  onNotificationPress,
  onSettingsPress,
  showSearch = true,
  showAvatar = true,
  showSettings = false,
}) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 28) + verticalScale(2);

  if (type === 'home') {
    return (
      <View style={[styles.homeHeader, { paddingTop: topPadding }]}>
        {/* Left: Brand Logo */}
        <CinematicLogo size="sm" darkText={true} />

        {/* Right: Actions (Search Icon in place of notification bell + Profile Avatar) */}
        <View style={styles.rightActions}>
          {showSearch && (
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={onSearchPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="search-outline" size={scale(22)} color="#0F172A" />
            </TouchableOpacity>
          )}

          {/* User Profile Avatar */}
          {showAvatar && (
            <TouchableOpacity
              style={styles.avatarBtn}
              activeOpacity={0.8}
              onPress={onAccountPress}
            >
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop' }}
                style={styles.avatarImage}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Generic Screen Header (Movies, Series, Downloads, Account)
  return (
    <View style={[styles.screenHeader, { paddingTop: topPadding }]}>
      <View style={styles.leftContainer}>
        {onBack && (
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={scale(22)} color="#0F172A" />
          </TouchableOpacity>
        )}
        {title ? (
          <Text style={styles.screenTitle}>{title}</Text>
        ) : null}
      </View>

      <View style={styles.rightActions}>
        {showSearch && (
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={onSearchPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="search-outline" size={scale(22)} color="#0F172A" />
          </TouchableOpacity>
        )}

        {showSettings && (
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={onSettingsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={scale(22)} color="#0F172A" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(8),
    backgroundColor: '#FFFFFF',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(10),
    backgroundColor: '#FFFFFF',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  backBtn: {
    padding: scale(4),
  },
  screenTitle: {
    color: '#0F172A',
    fontSize: moderateScale(22),
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  iconBtn: {
    padding: scale(3),
  },
  bellWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: scale(1),
    right: scale(1),
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avatarBtn: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
