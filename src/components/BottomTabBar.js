import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';

/**
 * BottomTabBar
 * Exact 1:1 match for reference screenshot:
 * - Floating white pill dock with smooth drop shadow
 * - 4 Tabs: Home, Movies, Series, My List
 * - Active tab has elevated crimson red (#E50914) circle with white icon and red label
 * - Inactive tabs have clean charcoal slate icon and label
 */
export default function BottomTabBar({ activeTab = 'Home', onTabPress }) {
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(insets.bottom, 12);

  const tabs = [
    { 
      name: 'Home', 
      label: 'Home', 
      iconActive: 'home', 
      iconInactive: 'home-outline',
      iconType: 'ionicons'
    },
    { 
      name: 'Movies', 
      label: 'Movies', 
      iconActive: 'film', 
      iconInactive: 'film-outline',
      iconType: 'ionicons'
    },
    { 
      name: 'TV Series', 
      label: 'TV Series', 
      aliases: ['Series', 'TvSeries'],
      iconActive: 'albums', 
      iconInactive: 'albums-outline',
      iconType: 'ionicons'
    },
    { 
      name: 'TV Serials', 
      label: 'TV Serials', 
      aliases: ['My List', 'MyList', 'Serials', 'TvSerials'],
      iconActive: 'tv', 
      iconInactive: 'tv-outline',
      iconType: 'ionicons'
    },
  ];

  const isTabActive = (tab) => {
    if (activeTab === tab.name) return true;
    if (tab.aliases && tab.aliases.includes(activeTab)) return true;
    return false;
  };

  const renderIcon = (tab, isActive) => {
    const iconColor = isActive ? '#FFFFFF' : '#64748B';
    const iconName = isActive ? tab.iconActive : tab.iconInactive;

    if (tab.iconType === 'feather') {
      return <Feather name={iconName} size={scale(isActive ? 22 : 21)} color={iconColor} />;
    }
    return <Ionicons name={iconName} size={scale(isActive ? 22 : 22)} color={iconColor} />;
  };

  return (
    <View style={[styles.floatingWrapper, { bottom: bottomMargin }]} pointerEvents="box-none">
      <View style={styles.pillContainer}>
        {tabs.map((tab) => {
          const isActive = isTabActive(tab);

          if (isActive) {
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.activeTabButton}
                activeOpacity={0.88}
                hitSlop={{ top: 12, bottom: 8, left: 10, right: 10 }}
                onPress={() => onTabPress && onTabPress(tab.name)}
              >
                {/* Elevated Crimson Red Circle with White Icon */}
                <View style={styles.raisedCircle}>
                  {renderIcon(tab, true)}
                </View>

                {/* Tab label in red */}
                <Text numberOfLines={1} style={styles.activeTabLabel}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }

          // Inactive tab: clean slate outline icon and label
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => onTabPress && onTabPress(tab.name)}
            >
              <View style={styles.iconSlot}>
                {renderIcon(tab, false)}
              </View>

              <Text numberOfLines={1} style={styles.inactiveTabLabel}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: scale(20),
    right: scale(20),
    zIndex: 9999,
    elevation: 16,
    alignItems: 'center',
  },
  pillContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(32),
    height: verticalScale(60),
    paddingHorizontal: scale(10),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(4),
  },
  activeTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: -verticalScale(10),
  },
  iconSlot: {
    height: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  raisedCircle: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  activeTabLabel: {
    fontSize: moderateScale(11),
    textAlign: 'center',
    marginTop: verticalScale(3),
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  inactiveTabLabel: {
    fontSize: moderateScale(11),
    textAlign: 'center',
    marginTop: verticalScale(2),
    fontWeight: '500',
    color: '#64748B',
    letterSpacing: -0.2,
  },
});
