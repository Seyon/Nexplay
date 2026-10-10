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
      // Validate key directly against TMDB
      try {
        const testRes = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`);
        if (testRes.status === 401) {
          setErrorMessage('Invalid TMDB API Key. Please verify your key from themoviedb.org.');
          setIsSaving(false);
          return;
        }
      } catch (netErr) {
        // In case of offline or local network issue, continue to save key
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
                <View style={styles.logoRow}>
                  <View style={styles.logoIcon}>
                    <Ionicons name="play-forward" size={scale(16)} color="#38bdf8" />
                  </View>
                  <Text style={styles.logoText}>NexPlay</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  onPress={handleLaterOrDismiss}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={scale(22)} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Graphic: TMDB Capsule + Glowing Blue Key with Sparkles */}
              <View style={styles.graphicRow}>
                <View style={styles.tmdbCapsule}>
                  <Text style={styles.tmdbCapsuleText}>TMDB</Text>
                  <View style={styles.tmdbIndicatorPill} />
                </View>
                <View style={styles.keyContainer}>
                  <Ionicons name="key" size={scale(26)} color="#38bdf8" />
                  <View style={styles.sparkleRow}>
                    <View style={[styles.sparkleRay, { transform: [{ rotate: '-35deg' }] }]} />
                    <View style={[styles.sparkleRay, { width: scale(8) }]} />
                    <View style={[styles.sparkleRay, { transform: [{ rotate: '35deg' }] }]} />
                  </View>
                </View>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.titleWhite}>Enter Your</Text>
                <Text style={styles.titleBlue}>TMDB API Key</Text>
              </View>

              {/* Description */}
              <Text style={styles.description}>
                To fetch movie and TV show details, please enter your TMDB API key. This helps us provide accurate metadata, posters and more.
              </Text>

              {/* Input Box */}
              <View style={[styles.inputBox, errorMessage ? styles.inputBoxError : null]}>
                <Ionicons name="key-outline" size={scale(18)} color="#64748b" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter TMDB API Key"
                  placeholderTextColor="#64748b"
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
                    <Ionicons name="close-circle" size={scale(16)} color="#64748b" />
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
                <Ionicons name="open-outline" size={scale(15)} color="#38bdf8" />
                <Text style={styles.linkText}>Get your TMDB API key</Text>
                <Ionicons name="arrow-forward" size={scale(14)} color="#38bdf8" />
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
                    <ActivityIndicator size="small" color="#ffffff" />
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
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: scale(380),
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#0a0f1d',
    borderRadius: scale(24),
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(20),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 25,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(14),
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
  graphicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: verticalScale(12),
    gap: scale(14),
  },
  tmdbCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00d2ff',
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    gap: scale(6),
  },
  tmdbCapsuleText: {
    color: '#00d2ff',
    fontWeight: '900',
    fontSize: moderateScale(13),
    letterSpacing: 1.2,
  },
  tmdbIndicatorPill: {
    width: scale(26),
    height: verticalScale(12),
    borderRadius: scale(6),
    backgroundColor: '#00d2ff',
  },
  keyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleRow: {
    marginLeft: scale(4),
    gap: scale(3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleRay: {
    width: scale(6),
    height: scale(2),
    borderRadius: scale(1),
    backgroundColor: '#38bdf8',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  titleWhite: {
    color: '#ffffff',
    fontSize: moderateScale(22),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  titleBlue: {
    color: '#38bdf8',
    fontSize: moderateScale(22),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: verticalScale(2),
  },
  description: {
    color: '#94a3b8',
    fontSize: moderateScale(13),
    lineHeight: verticalScale(19),
    textAlign: 'center',
    marginTop: verticalScale(10),
    paddingHorizontal: scale(6),
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070b14',
    borderWidth: 1.2,
    borderColor: '#1e293b',
    borderRadius: scale(16),
    paddingHorizontal: scale(14),
    height: verticalScale(48),
    marginTop: verticalScale(18),
  },
  inputBoxError: {
    borderColor: '#ef4444',
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: moderateScale(14),
    marginLeft: scale(10),
    paddingVertical: 0,
  },
  errorText: {
    color: '#ef4444',
    fontSize: moderateScale(11.5),
    textAlign: 'center',
    marginTop: verticalScale(6),
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(14),
    marginBottom: verticalScale(16),
    gap: scale(6),
  },
  linkText: {
    color: '#38bdf8',
    fontSize: moderateScale(13.5),
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginTop: verticalScale(6),
  },
  laterBtn: {
    flex: 1,
    height: verticalScale(46),
    borderRadius: scale(23),
    backgroundColor: '#0c1322',
    borderWidth: 1.2,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laterBtnText: {
    color: '#cbd5e1',
    fontSize: moderateScale(14.5),
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: verticalScale(46),
    borderRadius: scale(23),
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
});
