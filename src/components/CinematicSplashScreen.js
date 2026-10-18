import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  StatusBar, 
  Easing, 
  Dimensions,
  ImageBackground,
  ActivityIndicator
} from 'react-native';
import { scale, verticalScale } from '../utils/responsive';
import { colors } from '../config/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * CinematicSplashScreen
 * Exact 1:1 match for the attached launch screen design:
 * - High-res launch screen artwork (launch_screen_clean.png) with flowing red gradient waves
 * - NexPlay 3D faceted ruby-red ribbon play logo
 * - "NexPlay" bold typography & "Your World of Entertainment" tagline
 * - Google Material-style rolling circular spinner in brand red (#E50914)
 * - Spins smoothly with native hardware-accelerated 60/120fps choreography
 * - Spins until Home screen data is ready, then smoothly reveals Home without interruption
 */
export default function CinematicSplashScreen({ onFinish, onRevealStart, isDataReady = true }) {
  const masterFade = useRef(new Animated.Value(1)).current;
  const masterScale = useRef(new Animated.Value(1)).current;
  const spinnerFade = useRef(new Animated.Value(1)).current;

  const [minTimerDone, setMinTimerDone] = useState(false);
  const isTransitioningRef = useRef(false);

  const triggerReveal = () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // Notify parent (App.js) so Home screen simultaneously animates into view smoothly
    if (onRevealStart) {
      onRevealStart();
    }

    Animated.parallel([
      // 1. Gently fade out the rolling spinner first
      Animated.timing(spinnerFade, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // 2. Smoothly fade out the launch screen
      Animated.timing(masterFade, {
        toValue: 0,
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      // 3. Gentle cinematic scale expansion
      Animated.timing(masterScale, {
        toValue: 1.035,
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinish) onFinish();
    });
  };

  useEffect(() => {
    // 1. Minimum presentation duration (~1.1s) for branding & smooth rolling spinner
    const minTimer = setTimeout(() => {
      setMinTimerDone(true);
    }, 1100);

    // 2. Fallback safety timer (3.8s) so it never gets permanently stuck
    const safetyTimer = setTimeout(() => {
      setMinTimerDone(true);
      triggerReveal();
    }, 3800);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  // When minimum display time has passed AND data/layout is ready -> trigger reveal
  useEffect(() => {
    if (minTimerDone && isDataReady) {
      triggerReveal();
    }
  }, [minTimerDone, isDataReady]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: masterFade,
          transform: [{ scale: masterScale }],
        },
      ]}
      pointerEvents={isTransitioningRef.current ? 'none' : 'auto'}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Clean lossless launch screen artwork matching attached reference */}
      <ImageBackground
        source={require('../../assets/launch_screen_clean.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Google Material Design rolling circular spinner */}
        <Animated.View style={[styles.spinnerAnchor, { opacity: spinnerFade }]}>
          <ActivityIndicator 
            size="large" 
            color="#E50914" 
            style={styles.googleSpinner}
          />
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
    elevation: 99999,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerAnchor: {
    position: 'absolute',
    top: '56%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: scale(50),
    height: scale(50),
  },
  googleSpinner: {
    transform: [{ scale: 1.1 }],
  },
});

