import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Switch, 
  Alert,
  Image,
  Dimensions,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from './AppHeader';
import CinematicLogo from './CinematicLogo';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { colors } from '../config/theme';
import { 
  DNS_PROVIDERS, 
  getDnsConfig, 
  setDnsConfig, 
  testDnsServer 
} from '../utils/DnsResolver';
import AppSettings, {
  getTmdbApiKey,
  hasTmdbApiKey,
  deleteTmdbApiKey,
  subscribeSettings
} from '../utils/AppSettings';
import TmdbApiKeyModal from './TmdbApiKeyModal';
import DonationModal from './DonationModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AccountScreen({ onBack, onNavigateTab }) {
  const [dnsConfig, setDnsConfigState] = useState(getDnsConfig());
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [tmdbKey, setTmdbKeyState] = useState(getTmdbApiKey());
  const [showTmdbModal, setShowTmdbModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const current = getDnsConfig();
    setDnsConfigState(current);

    const unsubSettings = subscribeSettings(({ eventType, payload }) => {
      if (eventType === 'TMDB_KEY_SAVED') {
        setTmdbKeyState(payload.key || '');
      } else if (eventType === 'TMDB_KEY_DELETED') {
        setTmdbKeyState('');
      }
    });

    return () => {
      if (unsubSettings) unsubSettings();
    };
  }, []);

  const handleDeleteTmdbKey = () => {
    Alert.alert(
      'Delete TMDB API Key?',
      'Deleting your TMDB API key will immediately stop all movie and TV show data fetching.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Key',
          style: 'destructive',
          onPress: async () => {
            await deleteTmdbApiKey();
            setTmdbKeyState('');
            Alert.alert('TMDB API Key Deleted', 'Your key has been removed.');
          }
        }
      ]
    );
  };

  const menuItems = [
    {
      id: 'profile',
      title: 'My Profile',
      icon: 'person-outline',
      onPress: () => {
        Alert.alert('My Profile', 'Profile: Aji\nStatus: Premium Member\nEmail: aji@example.com');
      }
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      onPress: () => setShowSettingsModal(true)
    },
  ];

  return (
    <View style={styles.screenWrapper}>
      {/* Top Header matching Image 2 Screen 7 */}
      <AppHeader
        type="screen"
        title=""
        onBack={onBack}
        showSearch={false}
        showSettings={true}
        onSettingsPress={() => setShowSettingsModal(true)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* Profile Avatar & Info Card */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop' }}
              style={styles.avatarImage}
            />
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>Hello, Aji</Text>
            <Text style={styles.userEmail}>aji@example.com</Text>
          </View>
        </View>

        {/* Menu Items List */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={item.onPress}
            >
              <View style={styles.menuLeft}>
                <Ionicons name={item.icon} size={scale(21)} color={colors.textPrimary} style={styles.menuIcon} />
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={scale(18)} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom Branding with NexPlay logo + tagline + red wave */}
        <View style={styles.bottomBranding}>
          <CinematicLogo
            size="md"
            showTagline={true}
            tagline="More to Watch. Always."
            darkText={true}
          />
        </View>
      </ScrollView>

      {/* Decorative Red Wave Accent in Bottom Right */}
      <View style={styles.bottomWaveContainer} pointerEvents="none">
        <LinearGradient
          colors={['rgba(244, 63, 94, 0.08)', 'rgba(229, 9, 20, 0.2)', '#E50914']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.bottomWaveGradient}
        />
      </View>

      {/* Settings Modal (TMDB Key, DNS Server, Auto-Play) */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={scale(22)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* TMDB API Key Section */}
            <View style={styles.settingCard}>
              <View style={styles.settingHeaderRow}>
                <Ionicons name="key-outline" size={scale(20)} color={colors.primary} />
                <Text style={styles.settingCardTitle}>TMDB API Key</Text>
              </View>
              <Text style={styles.settingCardDesc}>
                {hasTmdbApiKey() 
                  ? 'Personal API key active. Movies and TV metadata loaded.' 
                  : 'Enter your free TMDB API key to load trending movies and TV shows.'}
              </Text>
              <View style={styles.settingActionRow}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    setShowSettingsModal(false);
                    setShowTmdbModal(true);
                  }}
                >
                  <Text style={styles.primaryBtnText}>
                    {hasTmdbApiKey() ? 'Change API Key' : 'Enter API Key'}
                  </Text>
                </TouchableOpacity>
                {hasTmdbApiKey() && (
                  <TouchableOpacity
                    style={styles.destructiveBtn}
                    onPress={handleDeleteTmdbKey}
                  >
                    <Text style={styles.destructiveBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* DNS / DoH Selector */}
            <View style={styles.settingCard}>
              <View style={styles.settingHeaderRow}>
                <Ionicons name="shield-checkmark-outline" size={scale(20)} color={colors.primary} />
                <Text style={styles.settingCardTitle}>Private DNS / Scraper Bypass</Text>
              </View>
              <Text style={styles.settingCardDesc}>
                Active provider: {dnsConfig.providerId.toUpperCase()} (Bypasses ISP DNS blocking)
              </Text>
              <View style={styles.providerRow}>
                {['google', 'cloudflare', 'adguard'].map((p) => {
                  const isSelected = dnsConfig.providerId === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.providerPill,
                        isSelected && styles.providerPillActive
                      ]}
                      onPress={() => {
                        const updated = { ...dnsConfig, providerId: p };
                        setDnsConfig(updated);
                        setDnsConfigState(updated);
                      }}
                    >
                      <Text style={[
                        styles.providerPillText,
                        isSelected && styles.providerPillTextActive
                      ]}>
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Auto-Play Next Toggle */}
            <View style={styles.settingCard}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingCardTitle}>Auto-Play Next Episode</Text>
                  <Text style={styles.settingCardDesc}>
                    Seamlessly start next episode when current finishes.
                  </Text>
                </View>
                <Switch
                  value={autoPlayNext}
                  onValueChange={setAutoPlayNext}
                  trackColor={{ false: '#E5E7EB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* TMDB API Key Modal */}
      <TmdbApiKeyModal
        visible={showTmdbModal}
        onClose={() => setShowTmdbModal(false)}
        onKeySaved={() => setShowTmdbModal(false)}
      />

      {/* Support / Donation Modal */}
      <DonationModal
        visible={showDonationModal}
        onClose={() => setShowDonationModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(120),
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    marginBottom: verticalScale(10),
  },
  avatarWrapper: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    marginLeft: scale(16),
  },
  userName: {
    color: colors.textPrimary,
    fontSize: moderateScale(20),
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: verticalScale(2),
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  menuContainer: {
    marginTop: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: scale(28),
    marginRight: scale(12),
  },
  menuTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  bottomBranding: {
    marginTop: verticalScale(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomWaveContainer: {
    position: 'absolute',
    bottom: -scale(60),
    right: -scale(60),
    width: scale(220),
    height: scale(220),
    overflow: 'hidden',
  },
  bottomWaveGradient: {
    width: scale(220),
    height: scale(220),
    borderRadius: scale(110),
    transform: [{ rotate: '-25deg' }],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: verticalScale(16),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(18),
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: scale(4),
  },
  modalBody: {
    padding: scale(16),
  },
  settingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(14),
    padding: scale(16),
    marginBottom: verticalScale(14),
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  settingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(6),
  },
  settingCardTitle: {
    color: colors.textPrimary,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  settingCardDesc: {
    color: colors.textSecondary,
    fontSize: moderateScale(12.5),
    lineHeight: moderateScale(18),
    marginBottom: verticalScale(10),
  },
  settingActionRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(12),
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  destructiveBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(12),
  },
  destructiveBtnText: {
    color: '#DC2626',
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  providerPill: {
    flex: 1,
    paddingVertical: verticalScale(7),
    alignItems: 'center',
    borderRadius: scale(8),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  providerPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  providerPillText: {
    color: colors.textSecondary,
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  providerPillTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
