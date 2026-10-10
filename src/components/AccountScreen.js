import appVersionData from '../../version.json';
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  StyleSheet, 
  Switch, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
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

export default function AccountScreen() {
  const [dnsConfig, setDnsConfigState] = useState(getDnsConfig());
  const [customDnsInput, setCustomDnsInput] = useState(dnsConfig.customUrl || 'https://dns.google/resolve');
  const [testingDns, setTestingDns] = useState(false);
  const [testResult, setTestResult] = useState({ ok: true, latencyMs: 24, provider: 'google', ip: '8.8.8.8' });
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [tmdbKey, setTmdbKeyState] = useState(getTmdbApiKey());
  const [showTmdbModal, setShowTmdbModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);

  useEffect(() => {
    // Initial sync & latency check
    const current = getDnsConfig();
    setDnsConfigState(current);
    handleTestDns(current.providerId, current.customUrl);

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

  const handleProviderSelect = (providerId) => {
    const updated = {
      ...dnsConfig,
      providerId: providerId
    };
    setDnsConfig(updated);
    setDnsConfigState(updated);
    handleTestDns(providerId, updated.customUrl);
  };

  const handleToggleDoh = (enabled) => {
    const updated = {
      ...dnsConfig,
      enabled: enabled
    };
    setDnsConfig(updated);
    setDnsConfigState(updated);
  };

  const handleDeleteTmdbKey = () => {
    Alert.alert(
      '⚠️ Delete TMDB API Key?',
      'Deleting your TMDB API key will immediately stop all movie and TV show data fetching. Posters, metadata, and search for TMDB titles will become unavailable until you provide a new key.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Key',
          style: 'destructive',
          onPress: async () => {
            await deleteTmdbApiKey();
            setTmdbKeyState('');
            Alert.alert(
              'TMDB API Key Deleted',
              'Your TMDB API key has been removed. Media data fetching has stopped.'
            );
          }
        }
      ]
    );
  };

  const handleSaveCustomDns = () => {
    if (!customDnsInput.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Custom DoH URL must start with https://');
      return;
    }
    const updated = {
      ...dnsConfig,
      providerId: 'custom',
      customUrl: customDnsInput.trim()
    };
    setDnsConfig(updated);
    setDnsConfigState(updated);
    setIsEditingCustom(false);
    handleTestDns('custom', customDnsInput.trim());
  };

  const handleTestDns = async (providerId = dnsConfig.providerId, customUrl = dnsConfig.customUrl) => {
    setTestingDns(true);
    try {
      const result = await testDnsServer(providerId, customUrl);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, latencyMs: 0, error: err.message });
    } finally {
      setTestingDns(false);
    }
  };



  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      bounces={true}
    >
      {/* 1. PROFILE / VIP HEADER CARD */}
      <View style={styles.profileCard}>
        <View style={styles.avatarGlowContainer}>
          <View style={styles.avatarInner}>
            <Ionicons name="person" size={scale(34)} color="#38bdf8" />
          </View>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>Nexplay Ultra</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.userPlan}>Zero ISP Blocking • 4K UHD Master</Text>
          <Text style={styles.userExpiry}>Unlimited Access • High-Speed Scraper</Text>
        </View>
      </View>



      {/* 2b. TMDB API KEY SETTINGS CARD */}
      <View style={styles.tmdbCard}>
        <View style={styles.tmdbCardHeader}>
          <View style={styles.tmdbCardIconContainer}>
            <Ionicons name="key" size={scale(20)} color="#38bdf8" />
          </View>
          <View style={{ flex: 1, marginLeft: scale(10) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.tmdbCardTitle}>TMDB API Key</Text>
              <View style={[styles.statusPill, tmdbKey ? styles.statusPillActive : styles.statusPillInactive]}>
                <View style={[styles.statusDot, { backgroundColor: tmdbKey ? '#10b981' : '#f59e0b' }]} />
                <Text style={[styles.statusPillText, { color: tmdbKey ? '#10b981' : '#f59e0b' }]}>
                  {tmdbKey ? 'Active' : 'Not Set'}
                </Text>
              </View>
            </View>
            <Text style={styles.tmdbCardSubtitle}>
              Powers movie & TV metadata, posters, cast, and search
            </Text>
          </View>
        </View>

        {tmdbKey ? (
          <View style={styles.tmdbActiveBox}>
            <View style={styles.tmdbKeyDisplayRow}>
              <Text style={styles.tmdbKeyLabel}>Saved Key:</Text>
              <Text style={styles.tmdbKeyMasked}>
                ••••••••••••••••{tmdbKey.slice(-4)}
              </Text>
            </View>
            <View style={styles.tmdbActionsRow}>
              <TouchableOpacity
                style={styles.tmdbModifyBtn}
                activeOpacity={0.8}
                onPress={() => setShowTmdbModal(true)}
              >
                <Ionicons name="create-outline" size={scale(15)} color="#38bdf8" style={{ marginRight: scale(5) }} />
                <Text style={styles.tmdbModifyBtnText}>Modify / Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tmdbDeleteBtn}
                activeOpacity={0.8}
                onPress={handleDeleteTmdbKey}
              >
                <Ionicons name="trash-outline" size={scale(15)} color="#ef4444" style={{ marginRight: scale(5) }} />
                <Text style={styles.tmdbDeleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.tmdbInactiveBox}>
            <Text style={styles.tmdbInactiveText}>
              No TMDB API key saved. Movie and TV show catalog fetching is paused.
            </Text>
            <TouchableOpacity
              style={styles.tmdbAddBtn}
              activeOpacity={0.85}
              onPress={() => setShowTmdbModal(true)}
            >
              <Ionicons name="add-circle-outline" size={scale(17)} color="#ffffff" style={{ marginRight: scale(6) }} />
              <Text style={styles.tmdbAddBtnText}>Add TMDB API Key</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. DNS & NETWORK PRIVACY (ANTI-ISP BLOCKING SECTION) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <MaterialCommunityIcons name="shield-check-outline" size={scale(20)} color="#38bdf8" />
          </View>
          <View style={{ flex: 1, marginLeft: scale(10) }}>
            <Text style={styles.sectionTitle}>DNS & Network Anti-ISP Bypass</Text>
            <Text style={styles.sectionSubtitle}>
              Bypasses ISP DNS blocks, throttling, and regional firewalls
            </Text>
          </View>
        </View>

        {/* Master DoH Switch */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Secure DNS-over-HTTPS (DoH)</Text>
            <Text style={styles.switchDesc}>
              Encrypts all domain lookups to completely prevent ISP interception
            </Text>
          </View>
          <Switch
            value={dnsConfig.enabled}
            onValueChange={handleToggleDoh}
            trackColor={{ false: '#27272a', true: '#0284c7' }}
            thumbColor={dnsConfig.enabled ? '#38bdf8' : '#71717a'}
          />
        </View>

        {/* DNS Providers Selection */}
        {dnsConfig.enabled && (
          <View style={styles.dnsProvidersContainer}>
            <Text style={styles.subSectionTitle}>Select Secure DNS Provider</Text>
            
            {/* 1. Google DNS (Default) */}
            <TouchableOpacity
              onPress={() => handleProviderSelect('google')}
              style={[
                styles.dnsOptionCard,
                dnsConfig.providerId === 'google' && styles.dnsOptionSelected
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.dnsOptionLeft}>
                <View style={[styles.providerDot, { backgroundColor: '#34a853' }]} />
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                    <Text style={styles.dnsOptionName}>Google DNS</Text>
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>DEFAULT</Text>
                    </View>
                  </View>
                  <Text style={styles.dnsOptionDesc}>8.8.8.8 / 8.8.4.4 • Global ultra-low latency</Text>
                </View>
              </View>
              {dnsConfig.providerId === 'google' ? (
                <Ionicons name="checkmark-circle" size={scale(20)} color="#38bdf8" />
              ) : (
                <View style={styles.unselectedCircle} />
              )}
            </TouchableOpacity>

            {/* 2. Cloudflare DNS */}
            <TouchableOpacity
              onPress={() => handleProviderSelect('cloudflare')}
              style={[
                styles.dnsOptionCard,
                dnsConfig.providerId === 'cloudflare' && styles.dnsOptionSelected
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.dnsOptionLeft}>
                <View style={[styles.providerDot, { backgroundColor: '#f38020' }]} />
                <View>
                  <Text style={styles.dnsOptionName}>Cloudflare 1.1.1.1</Text>
                  <Text style={styles.dnsOptionDesc}>1.1.1.1 / 1.0.0.1 • Maximum speed & zero logging</Text>
                </View>
              </View>
              {dnsConfig.providerId === 'cloudflare' ? (
                <Ionicons name="checkmark-circle" size={scale(20)} color="#38bdf8" />
              ) : (
                <View style={styles.unselectedCircle} />
              )}
            </TouchableOpacity>

            {/* 3. AdGuard DNS */}
            <TouchableOpacity
              onPress={() => handleProviderSelect('adguard')}
              style={[
                styles.dnsOptionCard,
                dnsConfig.providerId === 'adguard' && styles.dnsOptionSelected
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.dnsOptionLeft}>
                <View style={[styles.providerDot, { backgroundColor: '#68bc71' }]} />
                <View>
                  <Text style={styles.dnsOptionName}>AdGuard DNS</Text>
                  <Text style={styles.dnsOptionDesc}>Ad & tracker blocking protection</Text>
                </View>
              </View>
              {dnsConfig.providerId === 'adguard' ? (
                <Ionicons name="checkmark-circle" size={scale(20)} color="#38bdf8" />
              ) : (
                <View style={styles.unselectedCircle} />
              )}
            </TouchableOpacity>

            {/* 4. Quad9 DNS */}
            <TouchableOpacity
              onPress={() => handleProviderSelect('quad9')}
              style={[
                styles.dnsOptionCard,
                dnsConfig.providerId === 'quad9' && styles.dnsOptionSelected
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.dnsOptionLeft}>
                <View style={[styles.providerDot, { backgroundColor: '#6366f1' }]} />
                <View>
                  <Text style={styles.dnsOptionName}>Quad9 (9.9.9.9)</Text>
                  <Text style={styles.dnsOptionDesc}>9.9.9.9 / 149.112.112.112 • Malware protection</Text>
                </View>
              </View>
              {dnsConfig.providerId === 'quad9' ? (
                <Ionicons name="checkmark-circle" size={scale(20)} color="#38bdf8" />
              ) : (
                <View style={styles.unselectedCircle} />
              )}
            </TouchableOpacity>

            {/* 5. Custom DNS */}
            <TouchableOpacity
              onPress={() => {
                handleProviderSelect('custom');
                setIsEditingCustom(true);
              }}
              style={[
                styles.dnsOptionCard,
                dnsConfig.providerId === 'custom' && styles.dnsOptionSelected
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.dnsOptionLeft}>
                <View style={[styles.providerDot, { backgroundColor: '#a855f7' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dnsOptionName}>Custom DNS-over-HTTPS</Text>
                  <Text style={styles.dnsOptionDesc} numberOfLines={1}>
                    {dnsConfig.customUrl || 'Enter custom DoH server URL'}
                  </Text>
                </View>
              </View>
              {dnsConfig.providerId === 'custom' ? (
                <Ionicons name="checkmark-circle" size={scale(20)} color="#38bdf8" />
              ) : (
                <View style={styles.unselectedCircle} />
              )}
            </TouchableOpacity>

            {/* Custom URL Input Field when Custom DNS is Active */}
            {(dnsConfig.providerId === 'custom' || isEditingCustom) && (
              <View style={styles.customInputCard}>
                <Text style={styles.inputLabel}>Custom DoH URL (RFC 8484 / JSON)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={customDnsInput}
                    onChangeText={setCustomDnsInput}
                    placeholder="https://dns.google/resolve"
                    placeholderTextColor="#71717a"
                    style={styles.textInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity 
                    onPress={handleSaveCustomDns}
                    style={styles.saveCustomBtn}
                  >
                    <Text style={styles.saveCustomBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Real-time Status & Diagnostic Box */}
            <View style={styles.diagnosticBox}>
              <View style={styles.diagRow}>
                <View style={styles.diagIndicatorRow}>
                  <View style={[
                    styles.statusIndicator, 
                    { backgroundColor: testResult.ok ? '#22c55e' : '#ef4444' }
                  ]} />
                  <Text style={styles.diagStatusText}>
                    {testResult.ok ? 'Protected by DoH' : 'DNS Resolution Error'}
                  </Text>
                </View>

                {testResult.ok && (
                  <View style={styles.latencyBadge}>
                    <Ionicons name="flash" size={scale(11)} color="#eab308" />
                    <Text style={styles.latencyText}>{testResult.latencyMs} ms</Text>
                  </View>
                )}
              </View>

              <Text style={styles.diagSubText}>
                Active Provider: {
                  dnsConfig.providerId === 'google' ? 'Google DNS (8.8.8.8)' :
                  dnsConfig.providerId === 'cloudflare' ? 'Cloudflare (1.1.1.1)' :
                  dnsConfig.providerId === 'adguard' ? 'AdGuard (94.140.14.14)' :
                  dnsConfig.providerId === 'quad9' ? 'Quad9 (9.9.9.9)' :
                  dnsConfig.providerId === 'opendns' ? 'OpenDNS (208.67.222.222)' : 'Custom DoH Endpoint'
                }
              </Text>

              <TouchableOpacity
                onPress={() => handleTestDns()}
                disabled={testingDns}
                style={styles.testDnsBtn}
                activeOpacity={0.8}
              >
                {testingDns ? (
                  <ActivityIndicator size="small" color="#38bdf8" />
                ) : (
                  <>
                    <Ionicons name="speedometer-outline" size={scale(15)} color="#38bdf8" />
                    <Text style={styles.testDnsBtnText}>Test DNS Health & Latency</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 3. PLAYBACK & STREAMING PREFERENCES */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <MaterialIcons name="tune" size={scale(20)} color="#38bdf8" />
          </View>
          <View style={{ flex: 1, marginLeft: scale(10) }}>
            <Text style={styles.sectionTitle}>Streaming Preferences</Text>
            <Text style={styles.sectionSubtitle}>Video player defaults and autoplay settings</Text>
          </View>
        </View>

        {/* Quality Selector */}
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>Preferred Quality</Text>
          <View style={styles.qualityPillsContainer}>
            {['1080p', '4k', '720p'].map((q) => (
              <TouchableOpacity
                key={`pref-q-${q}`}
                onPress={() => setSelectedQuality(q)}
                style={[
                  styles.qualityPill,
                  selectedQuality === q && styles.qualityPillActive
                ]}
              >
                <Text style={[
                  styles.qualityPillText,
                  selectedQuality === q && styles.qualityPillTextActive
                ]}>
                  {q.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Autoplay Next Switch */}
        <View style={[styles.switchRow, { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)', marginTop: verticalScale(10), paddingTop: verticalScale(12) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Autoplay Next Episode</Text>
            <Text style={styles.switchDesc}>Continuously play the next TV episode</Text>
          </View>
          <Switch
            value={autoPlayNext}
            onValueChange={setAutoPlayNext}
            trackColor={{ false: '#27272a', true: '#0284c7' }}
            thumbColor={autoPlayNext ? '#38bdf8' : '#71717a'}
          />
        </View>
      </View>

      {/* 3b. SUPPORT NEXPLAY (DONATION) CARD */}
      <View style={styles.supportCard}>
        <View style={styles.supportCardHeader}>
          <View style={styles.supportIconCircle}>
            <Ionicons name="heart" size={scale(22)} color="#ec4899" />
          </View>
          <View style={{ flex: 1, marginLeft: scale(12) }}>
            <Text style={styles.supportCardTitle}>Support NexPlay Development</Text>
            <Text style={styles.supportCardSubtitle}>
              Help us maintain high-speed scrapers, ISP bypass, and add new features
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.supportCardBtn}
          activeOpacity={0.85}
          onPress={() => setShowDonationModal(true)}
        >
          <Ionicons name="heart" size={scale(16)} color="#ffffff" style={{ marginRight: scale(6) }} />
          <Text style={styles.supportCardBtnText}>Support Us ❤️</Text>
        </TouchableOpacity>
      </View>

      {/* 4. APP & SYSTEM BUILD INFO */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>{appVersionData?.versionName || '1.0.8'} ({appVersionData?.updateType || 'Release'})</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Supported ABIs</Text>
          <Text style={styles.infoValue}>arm64-v8a • armeabi-v7a</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Android Target</Text>
          <Text style={styles.infoValue}>Android 8.0+ (API 26-36)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Scraper Engine</Text>
          <Text style={styles.infoValue}>Zero CORS High-Speed v3</Text>
        </View>
      </View>

      {/* Modals */}
      <TmdbApiKeyModal
        visible={showTmdbModal}
        onClose={() => setShowTmdbModal(false)}
        onKeySaved={(newKey) => {
          setTmdbKeyState(newKey);
          Alert.alert(
            'TMDB API Key Saved',
            'Your TMDB API key has been securely saved. NexPlay is now ready to fetch all movies and TV shows.'
          );
        }}
      />
      <DonationModal
        visible={showDonationModal}
        onClose={() => setShowDonationModal(false)}
      />

      {/* Footer Branding */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>NEXPLAY CINEMA STREAM</Text>
        <Text style={styles.footerDesc}>Designed for lightning fast media streaming with full ISP bypass</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  contentContainer: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(120),
  },
  profileCard: {
    backgroundColor: '#18181b',
    borderRadius: scale(16),
    padding: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  avatarGlowContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: scale(14),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(2),
  },
  userName: {
    color: '#ffffff',
    fontSize: moderateScale(16.5),
    fontWeight: '800',
  },
  proBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.40)',
  },
  proBadgeText: {
    color: '#38bdf8',
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userPlan: {
    color: '#d4d4d8',
    fontSize: moderateScale(12),
    fontWeight: '500',
    marginBottom: verticalScale(2),
  },
  userExpiry: {
    color: '#71717a',
    fontSize: moderateScale(11),
  },

  sectionCard: {
    backgroundColor: '#18181b',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(14),
  },
  sectionIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#a1a1aa',
    fontSize: moderateScale(11.5),
    marginTop: verticalScale(2),
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: moderateScale(13.5),
    fontWeight: '700',
  },
  switchDesc: {
    color: '#71717a',
    fontSize: moderateScale(11),
    marginTop: verticalScale(2),
    paddingRight: scale(10),
  },
  dnsProvidersContainer: {
    marginTop: verticalScale(14),
    paddingTop: verticalScale(14),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  subSectionTitle: {
    color: '#d4d4d8',
    fontSize: moderateScale(12.5),
    fontWeight: '700',
    marginBottom: verticalScale(10),
  },
  dnsOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dnsOptionSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
    borderColor: '#38bdf8',
  },
  dnsOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(10),
  },
  providerDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    marginRight: scale(10),
  },
  dnsOptionName: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  dnsOptionDesc: {
    color: '#a1a1aa',
    fontSize: moderateScale(11),
    marginTop: verticalScale(2),
  },
  defaultPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: scale(5),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  defaultPillText: {
    color: '#4ade80',
    fontSize: moderateScale(8.5),
    fontWeight: '800',
  },
  unselectedCircle: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    borderWidth: 1.5,
    borderColor: '#52525b',
  },
  customInputCard: {
    backgroundColor: '#27272a',
    borderRadius: scale(10),
    padding: scale(10),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(10),
  },
  inputLabel: {
    color: '#a1a1aa',
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginBottom: verticalScale(6),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  textInput: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    color: '#ffffff',
    fontSize: moderateScale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  saveCustomBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderRadius: scale(8),
  },
  saveCustomBtnText: {
    color: '#000000',
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  diagnosticBox: {
    backgroundColor: '#09090b',
    borderRadius: scale(12),
    padding: scale(12),
    marginTop: verticalScale(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  diagIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  statusIndicator: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  diagStatusText: {
    color: '#ffffff',
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  latencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
    gap: scale(3),
  },
  latencyText: {
    color: '#eab308',
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  diagSubText: {
    color: '#71717a',
    fontSize: moderateScale(11),
    marginBottom: verticalScale(10),
  },
  testDnsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: scale(8),
    paddingVertical: verticalScale(8),
    gap: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  testDnsBtnText: {
    color: '#38bdf8',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(4),
  },
  prefLabel: {
    color: '#ffffff',
    fontSize: moderateScale(13.5),
    fontWeight: '700',
  },
  qualityPillsContainer: {
    flexDirection: 'row',
    gap: scale(6),
  },
  qualityPill: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(8),
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  qualityPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  qualityPillText: {
    color: '#a1a1aa',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  qualityPillTextActive: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: '#18181b',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: verticalScale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(6),
  },
  infoLabel: {
    color: '#71717a',
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  infoValue: {
    color: '#d4d4d8',
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: verticalScale(6),
  },
  footerBrand: {
    color: '#52525b',
    fontSize: moderateScale(11.5),
    fontWeight: '900',
    letterSpacing: 2,
  },
  footerDesc: {
    color: '#3f3f46',
    fontSize: moderateScale(10),
    textAlign: 'center',
    marginTop: verticalScale(3),
    maxWidth: scale(260),
  },
  tmdbCard: {
    backgroundColor: '#18181b',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  tmdbCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  tmdbCardIconContainer: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  tmdbCardTitle: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  tmdbCardSubtitle: {
    color: '#a1a1aa',
    fontSize: moderateScale(11.5),
    marginTop: verticalScale(2),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: scale(12),
    gap: scale(4),
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statusPillInactive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  statusPillText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tmdbActiveBox: {
    backgroundColor: '#121215',
    borderRadius: scale(12),
    padding: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tmdbKeyDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },
  tmdbKeyLabel: {
    color: '#71717a',
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  tmdbKeyMasked: {
    color: '#38bdf8',
    fontSize: moderateScale(13),
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  tmdbActionsRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  tmdbModifyBtn: {
    flex: 1,
    flexDirection: 'row',
    height: verticalScale(38),
    borderRadius: scale(10),
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbModifyBtnText: {
    color: '#38bdf8',
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  tmdbDeleteBtn: {
    flex: 0.8,
    flexDirection: 'row',
    height: verticalScale(38),
    borderRadius: scale(10),
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbDeleteBtnText: {
    color: '#ef4444',
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  tmdbInactiveBox: {
    backgroundColor: '#121215',
    borderRadius: scale(12),
    padding: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  tmdbInactiveText: {
    color: '#94a3b8',
    fontSize: moderateScale(12),
    textAlign: 'center',
    marginBottom: verticalScale(12),
    lineHeight: verticalScale(17),
  },
  tmdbAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    height: verticalScale(40),
    paddingHorizontal: scale(18),
    borderRadius: scale(20),
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  tmdbAddBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  supportCard: {
    backgroundColor: '#18181b',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  supportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  supportIconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
  },
  supportCardTitle: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  supportCardSubtitle: {
    color: '#a1a1aa',
    fontSize: moderateScale(11.5),
    marginTop: verticalScale(2),
    lineHeight: verticalScale(16),
  },
  supportCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    height: verticalScale(42),
    borderRadius: scale(21),
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  supportCardBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
});
