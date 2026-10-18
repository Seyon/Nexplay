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
import CinematicLogo from './CinematicLogo';
import { colors } from '../config/theme';

export default function DonationModal({
  visible,
  onClose,
}) {
  const [dontShowChecked, setDontShowChecked] = useState(false);

  const handleSupportUs = () => {
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
            <CinematicLogo size="sm" darkText={true} />
            <TouchableOpacity
              style={styles.closeBtn}
              activeOpacity={0.7}
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={scale(22)} color={colors.textSecondary} />
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
            <Text style={styles.title}>Support NexPlay</Text>
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
              <Ionicons name="heart" size={scale(18)} color="#FFFFFF" style={{ marginRight: scale(8) }} />
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
              size={scale(17)}
              color={dontShowChecked ? colors.primary : colors.textMuted}
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
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  card: {
    width: '100%',
    maxWidth: scale(360),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(24),
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(20),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  closeBtn: {
    padding: scale(4),
  },
  illustrationContainer: {
    width: scale(140),
    height: scale(140),
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
  title: {
    color: colors.textPrimary,
    fontSize: moderateScale(22),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    lineHeight: verticalScale(19),
    textAlign: 'center',
    marginTop: verticalScale(8),
    paddingHorizontal: scale(8),
  },
  subtext: {
    color: colors.primary,
    fontSize: moderateScale(13),
    fontWeight: '700',
    textAlign: 'center',
    marginTop: verticalScale(10),
  },
  buttonStack: {
    width: '100%',
    marginTop: verticalScale(18),
    gap: verticalScale(10),
  },
  supportBtn: {
    width: '100%',
    height: verticalScale(46),
    borderRadius: scale(23),
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  supportBtnText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14.5),
    fontWeight: '800',
  },
  maybeLaterBtn: {
    width: '100%',
    height: verticalScale(46),
    borderRadius: scale(23),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maybeLaterBtnText: {
    color: colors.textSecondary,
    fontSize: moderateScale(14),
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
    color: colors.textMuted,
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  dontShowTextActive: {
    color: colors.primary,
    fontWeight: '600',
  }
});
