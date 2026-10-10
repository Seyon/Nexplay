import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

export default function BottomTabBar({ activeTab = 'Home', onTabPress }) {
  const tabs = [
    { name: 'Home', iconActive: 'home', iconInactive: 'home-outline', label: 'Home' },
    { name: 'Movies', iconActive: 'film', iconInactive: 'film-outline', label: 'Movies' },
    { name: 'Series', aliases: ['TV Series', 'Series'], iconActive: 'tv', iconInactive: 'tv-outline', label: 'Series' },
    { name: 'Live TV & Serials', aliases: ['TV Serials', 'Live TV & Serials'], iconActive: 'albums', iconInactive: 'albums-outline', label: 'Live & Serials' },
    { name: 'Search', iconActive: 'search', iconInactive: 'search-outline', label: 'Search' },
  ];

  const isTabActive = (tab) => {
    if (activeTab === tab.name) return true;
    if (tab.aliases && tab.aliases.includes(activeTab)) return true;
    return false;
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.glassContainer}>
        {/* Glass reflection top highlight */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.16)',
            'rgba(255, 255, 255, 0.04)',
            'rgba(10, 14, 24, 0.55)'
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={styles.tabBarPill}>
          {tabs.map((tab) => {
            const isActive = isTabActive(tab);
            const iconName = isActive ? tab.iconActive : tab.iconInactive;
            const tintColor = isActive ? '#38bdf8' : '#94a3b8';

            return (
              <Pressable
                key={tab.name}
                style={({ pressed }) => [
                  styles.tabButton,
                  isActive ? styles.tabButtonActive : styles.tabButtonInactive,
                  pressed && { opacity: 0.65 }
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                onPress={() => onTabPress && onTabPress(tab.name)}
              >
                {/* 1. Fixed-height icon slot for vertical baseline alignment */}
                <View style={styles.iconSlot}>
                  <Ionicons
                    name={iconName}
                    size={scale(19)}
                    color={tintColor}
                  />
                </View>

                {/* 2. Fixed-height label slot */}
                <View style={styles.labelSlot}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.75}
                    style={[
                      styles.tabLabel,
                      { color: tintColor, fontWeight: isActive ? '700' : '500' }
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>

                {/* 3. Fixed-height indicator slot so layout never shifts */}
                <View style={styles.indicatorSlot}>
                  {isActive ? (
                    <View style={styles.activeDot} />
                  ) : (
                    <View style={styles.inactivePlaceholder} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: verticalScale(14),
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(14),
    zIndex: 999,
  },
  glassContainer: {
    width: '100%',
    borderRadius: scale(40),
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 19, 28, 0.88)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 25,
  },
  tabBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(7),
    paddingHorizontal: scale(8),
    minHeight: verticalScale(62),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(3),
    borderRadius: scale(20),
  },
  tabButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  tabButtonInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconSlot: {
    height: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelSlot: {
    height: verticalScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: verticalScale(2),
  },
  tabLabel: {
    fontSize: moderateScale(9.5),
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  indicatorSlot: {
    height: verticalScale(5),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: verticalScale(2),
  },
  activeDot: {
    width: scale(12),
    height: verticalScale(3),
    borderRadius: scale(2),
    backgroundColor: '#38bdf8',
  },
  inactivePlaceholder: {
    width: scale(12),
    height: verticalScale(3),
    backgroundColor: 'transparent',
  },
});
