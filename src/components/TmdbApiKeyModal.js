import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import AppSettings, { saveTmdbApiKey, getTmdbApiKey } from '../utils/AppSettings';
import CinematicLogo from './CinematicLogo';
import { colors } from '../config/theme';

export default function TmdbApiKeyModal({
  visible,
  onClose,
  onKeySaved,
  isMandatory = true
}) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (visible) {
      const current = getTmdbApiKey();
      setApiKeyInput(current || '');
      setErrorMessage('');
      setIsSaving(false);
    }
  }, [visible]);

  const handleOpenTmdbWebsite = () => {
    Linking.openURL('https://www.themoviedb.org/settings/api').catch((err) => {
      console.warn('Failed to open TMDB URL:', err);
    });
  };

  const handleSave = async () => {
    const key = (apiKeyInput || '').trim();
    if (!key) {
      setErrorMessage('Please enter your TMDB API Key');
      return;
    }
    if (key.length < 16) {
      setErrorMessage('Invalid API key format. TMDB keys are typically 32 characters long.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      try {
        const testRes = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`);
        if (testRes.status === 401) {
          setErrorMessage('Invalid TMDB API Key. Please verify your key from themoviedb.org.');
          setIsSaving(false);
          return;
        }
      } catch (netErr) {
        // Continue if offline
      }

      await saveTmdbApiKey(key);
      if (onKeySaved) onKeySaved(key);
      if (onClose) onClose();
    } catch (err) {
      setErrorMessage('Failed to save API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLaterOrDismiss = () => {
    const currentKey = getTmdbApiKey();
    if (!currentKey) {
      Alert.alert(
        'TMDB API Key Required',
        'Without a TMDB API key, NexPlay cannot load movies, TV shows, posters, or metadata. Are you sure you want to skip for now?',
        [
          { text: 'Enter Key', style: 'cancel' },
          {
            text: 'Skip Anyway',
            style: 'destructive',
            onPress: () => {
              if (onClose) onClose();
            }
          }
        ]
      );
    } else {
      if (onClose) onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleLaterOrDismiss}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <View style={styles.card}>
              {/* Header: NexPlay logo + close button */}
              <View style={styles.headerRow}>
                <CinematicLogo size="sm" darkText={true} />
                <TouchableOpacity
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  onPress={handleLaterOrDismiss}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={scale(22)} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Graphic: TMDB Key Icon */}
              <View style={styles.graphicRow}>
                <View style={styles.keyIconCircle}>
                  <Ionicons name="key" size={scale(24)} color={colors.primary} />
                </View>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Enter TMDB API Key</Text>
              </View>

              {/* Description */}
              <Text style={styles.description}>
                To fetch movie and TV show details, posters, and recommendations, please enter your free TMDB API key.
              </Text>

              {/* Input Box */}
              <View style={[styles.inputBox, errorMessage ? styles.inputBoxError : null]}>
                <Ionicons name="key-outline" size={scale(18)} color={colors.textMuted} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter TMDB API Key"
                  placeholderTextColor={colors.textMuted}
                  value={apiKeyInput}
                  onChangeText={(val) => {
                    setApiKeyInput(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectTextOnFocus={true}
                />
                {apiKeyInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setApiKeyInput('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={scale(16)} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              {/* Hyperlink: Get your TMDB API key */}
              <TouchableOpacity
                style={styles.linkRow}
                activeOpacity={0.75}
                onPress={handleOpenTmdbWebsite}
              >
                <Ionicons name="open-outline" size={scale(14)} color={colors.primary} />
                <Text style={styles.linkText}>Get your free TMDB API key</Text>
                <Ionicons name="arrow-forward" size={scale(13)} color={colors.primary} />
              </TouchableOpacity>

              {/* Buttons: Later & Save */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.laterBtn}
                  activeOpacity={0.8}
                  onPress={handleLaterOrDismiss}
                >
                  <Text style={styles.laterBtnText}>Later</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  activeOpacity={0.85}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
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
  keyboardAvoid: {
    width: '100%',
    maxWidth: scale(360),
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(24),
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(20),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },
  closeBtn: {
    padding: scale(4),
  },
  graphicRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: verticalScale(10),
  },
  keyIconCircle: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    backgroundColor: 'rgba(229, 9, 20, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: moderateScale(20),
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  description: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    lineHeight: verticalScale(19),
    textAlign: 'center',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(16),
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(14),
    paddingHorizontal: scale(12),
    height: verticalScale(44),
  },
  inputBoxError: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: moderateScale(13),
    marginLeft: scale(8),
    fontWeight: '500',
  },
  errorText: {
    color: colors.primary,
    fontSize: moderateScale(11.5),
    fontWeight: '600',
    marginTop: verticalScale(5),
    marginLeft: scale(4),
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(5),
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(4),
  },
  linkText: {
    color: colors.primary,
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: verticalScale(20),
    gap: scale(10),
  },
  laterBtn: {
    flex: 1,
    height: verticalScale(44),
    borderRadius: scale(22),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laterBtnText: {
    color: colors.textSecondary,
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: verticalScale(44),
    borderRadius: scale(22),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
});
