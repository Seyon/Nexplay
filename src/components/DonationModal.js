import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import AppSettings, { setDontShowDonationAgain, recordDonationDismissed } from '../utils/AppSettings';

export default function DonationModal({
  visible,
  onClose,
}) {
  const [dontShowChecked, setDontShowChecked] = useState(false);

  const handleSupportUs = () => {
    // Open donation link or show options
    Alert.alert(
      'Support NexPlay Development ❤️',
      'Thank you for loving NexPlay! You can support us through any of the options below to help keep our high-speed scrapers and infrastructure ad-free.',
      [
        {
          text: 'Buy Me a Coffee ☕',
          onPress: () => {
            Linking.openURL('https://buymeacoffee.com').catch(() => {});
            handleClose();
          }
        },
        {
          text: 'Crypto / UPI / GitHub',
          onPress: () => {
            Linking.openURL('https://github.com/sponsors').catch(() => {});
            handleClose();
          }
        },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  const handleMaybeLater = async () => {
    if (dontShowChecked) {
      await setDontShowDonationAgain(true);
    } else {
      await recordDonationDismissed();
    }
    if (onClose) onClose();
  };

  const handleClose = async () => {
    if (dontShowChecked) {
      await setDontShowDonationAgain(true);
    } else {
      await recordDonationDismissed();
    }
    if (onClose) onClose();
  };

  const handleToggleDontShowAgain = async () => {
    const nextVal = !dontShowChecked;
    setDontShowChecked(nextVal);
    if (nextVal) {
      await setDontShowDonationAgain(true);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Row: NexPlay logo + close button */}
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Ionicons name="play-forward" size={scale(16)} color="#38bdf8" />
              </View>
              <Text style={styles.logoText}>NexPlay</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              activeOpacity={0.7}
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={scale(22)} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Center Illustration: 3D Hand holding glowing heart */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require('../../assets/donation_heart.jpg')}
              style={styles.heartImage}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleWhite}>Support</Text>
            <Text style={styles.titleBlue}>NexPlay</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Enjoying NexPlay? Help us keep improving the app and bringing you more features, content and a better experience.
          </Text>

          <Text style={styles.subtext}>
            Every contribution helps ❤️
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={styles.supportBtn}
              activeOpacity={0.85}
              onPress={handleSupportUs}
            >
              <Ionicons name="heart" size={scale(18)} color="#ffffff" style={{ marginRight: scale(8) }} />
              <Text style={styles.supportBtnText}>Support Us</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.maybeLaterBtn}
              activeOpacity={0.8}
              onPress={handleMaybeLater}
            >
              <Text style={styles.maybeLaterBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>

          {/* Don't show again toggle */}
          <TouchableOpacity
            style={styles.dontShowRow}
            activeOpacity={0.75}
            onPress={handleToggleDontShowAgain}
          >
            <Ionicons
              name={dontShowChecked ? 'checkbox' : 'square-outline'}
              size={scale(16)}
              color={dontShowChecked ? '#38bdf8' : '#64748b'}
            />
            <Text style={[styles.dontShowText, dontShowChecked && styles.dontShowTextActive]}>
              Don't show again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  card: {
    width: '100%',
    maxWidth: scale(380),
    backgroundColor: '#0a0f1d',
    borderRadius: scale(24),
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(20),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 25,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
  },
  logoText: {
    color: '#ffffff',
    fontSize: moderateScale(19),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: scale(4),
  },
  illustrationContainer: {
    width: scale(150),
    height: scale(150),
    borderRadius: scale(20),
    overflow: 'hidden',
    marginVertical: verticalScale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartImage: {
    width: '100%',
    height: '100%',
    borderRadius: scale(18),
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  titleWhite: {
    color: '#ffffff',
    fontSize: moderateScale(24),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  titleBlue: {
    color: '#38bdf8',
    fontSize: moderateScale(24),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: verticalScale(1),
  },
  description: {
    color: '#94a3b8',
    fontSize: moderateScale(13),
    lineHeight: verticalScale(19),
    textAlign: 'center',
    marginTop: verticalScale(10),
    paddingHorizontal: scale(8),
  },
  subtext: {
    color: '#cbd5e1',
    fontSize: moderateScale(13.5),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: verticalScale(10),
  },
  buttonStack: {
    width: '100%',
    marginTop: verticalScale(20),
    gap: verticalScale(10),
  },
  supportBtn: {
    width: '100%',
    height: verticalScale(48),
    borderRadius: scale(24),
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  supportBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  maybeLaterBtn: {
    width: '100%',
    height: verticalScale(48),
    borderRadius: scale(24),
    backgroundColor: '#0c1322',
    borderWidth: 1.2,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maybeLaterBtnText: {
    color: '#cbd5e1',
    fontSize: moderateScale(14.5),
    fontWeight: '700',
  },
  dontShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(4),
  },
  dontShowText: {
    color: '#64748b',
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  dontShowTextActive: {
    color: '#38bdf8',
  }
});
