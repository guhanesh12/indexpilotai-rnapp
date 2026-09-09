import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Animated as RNAnimated } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  FadeInDown,
  FadeInUp,
  FadeIn,
  ZoomIn,
  LightSpeedInRight,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop, Path } from 'react-native-svg';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, typography, spacing } from '../src/lib/theme';
import { InAppUpdateService } from '../src/services/InAppUpdateService';

const { width, height } = Dimensions.get('window');

// Use the splashscreen logo from assets
const SPLASH_LOGO = require('../assets/logo/splashscreen_logo.png');
// Fallback logo for better visibility
const SPLASH_LOGO_FALLBACK = require('../assets/logo/icon_320.png');

// Floating particles component
function Particle({ delay, x, y, size, color }: { delay: number; x: number; y: number; size: number; color: string }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.6, { duration: 500 }));
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-20, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(20, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

// Glowing orb component
function GlowingOrb({ delay, x, y, size, colors: gradColors }: { delay: number; x: number; y: number; size: number; colors: string[] }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.back(1.5)) }));
    opacity.value = withDelay(delay, withTiming(0.15, { duration: 1000 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        },
      ]}
    >
      <LinearGradient
        colors={gradColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

export default function SplashScreen() {
  const { authReady, signedIn, pinState } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const MIN_SPLASH_DURATION = 3000; // 3 seconds minimum display time

  // Animation values
  const ringOuter = useSharedValue(0);
  const ringMid = useSharedValue(0);
  const ringInner = useSharedValue(0);
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const titleY = useSharedValue(40);
  const titleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const orbitRotate = useSharedValue(0);
  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.5);
  const progressWidth = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    // Staggered ring expansion
    ringOuter.value = withDelay(0, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    ringMid.value = withDelay(200, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    ringInner.value = withDelay(400, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));

    // Logo pop + rotate with bounce
    logoScale.value = withDelay(500, withSequence(
      withTiming(1.25, { duration: 400, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(0.95, { duration: 150 }),
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 100 })
    ));
    logoRotate.value = withDelay(500, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }));

    // Splash image fade in with scale
    imageOpacity.value = withDelay(700, withTiming(1, { duration: 600 }));
    imageScale.value = withDelay(700, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.3)) }));

    // Title and tagline
    titleY.value = withDelay(900, withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) }));
    titleOpacity.value = withDelay(900, withTiming(1, { duration: 800 }));
    taglineOpacity.value = withDelay(1300, withTiming(1, { duration: 600 }));
    subtitleOpacity.value = withDelay(1500, withTiming(1, { duration: 500 }));

    // Progress bar animation
    progressWidth.value = withDelay(1600, withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }));

    // Animated SVG dash and orbit
    orbitRotate.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
  }, []);

  // Enforce minimum splash screen display time
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[Splash] Minimum display time reached');
      setMinTimeElapsed(true);
    }, MIN_SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Google Play In-App Updates on app start
  useEffect(() => {
    const initializeUpdates = async () => {
      console.log('[Splash] Initializing In-App Updates...');
      try {
        await InAppUpdateService.initialize();
        setTimeout(async () => {
          console.log('[Splash] Checking for app updates...');
          try {
            const updateInfo = await InAppUpdateService.checkForUpdates();
            console.log('[Splash] Update check complete:', updateInfo.isUpdateAvailable);
            if (updateInfo.isUpdateAvailable) {
              console.log('[Splash] 📱 Update available! Version:', updateInfo.availableVersionCode);
            }
          } catch (error) {
            console.log('[Splash] Update check failed:', error);
          }
        }, 3000);
      } catch (error) {
        console.log('[Splash] Update service init failed:', error);
      }
    };
    initializeUpdates();
  }, []);

  // Navigate away from splash screen when both conditions are met
  useEffect(() => {
    if (minTimeElapsed && authReady) {
      console.log('[Splash] Both conditions met - navigating based on auth state');
      // Signal that splash screen is ready to be hidden
      if (typeof global !== 'undefined' && (global as any).__setSplashReady) {
        (global as any).__setSplashReady(true);
      }
      // The RootNavigation in _layout.tsx will handle the actual redirect
      // This just ensures the splash screen doesn't block navigation
    }
  }, [minTimeElapsed, authReady]);

  const ringOuterStyle = useAnimatedStyle(() => ({
    opacity: ringOuter.value * 0.3,
    transform: [{ scale: 0.5 + ringOuter.value * 0.7 }],
  }));
  const ringMidStyle = useAnimatedStyle(() => ({
    opacity: ringMid.value * 0.5,
    transform: [{ scale: 0.5 + ringMid.value * 0.6 }],
  }));
  const ringInnerStyle = useAnimatedStyle(() => ({
    opacity: ringInner.value * 0.8,
    transform: [{ scale: 0.5 + ringInner.value * 0.55 }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value * 360}deg` },
    ],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotate.value * 360}deg` }],
  }));
  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ scale: imageScale.value }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#020010', '#06051F', '#0A0830', '#040012']}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating particles */}
      <Particle delay={0} x={width * 0.1} y={height * 0.15} size={4} color="#00FFE0" />
      <Particle delay={300} x={width * 0.85} y={height * 0.2} size={3} color="#FF4DD2" />
      <Particle delay={600} x={width * 0.2} y={height * 0.75} size={5} color="#7C5CFF" />
      <Particle delay={900} x={width * 0.75} y={height * 0.8} size={3} color="#00FF66" />
      <Particle delay={1200} x={width * 0.5} y={height * 0.1} size={4} color="#FFB800" />
      <Particle delay={1500} x={width * 0.9} y={height * 0.6} size={2} color="#00FFE0" />

      {/* Glowing orbs */}
      <GlowingOrb delay={0} x={width * 0.15} y={height * 0.3} size={120} colors={['#00FFE020', '#00FFE000']} />
      <GlowingOrb delay={500} x={width * 0.8} y={height * 0.7} size={100} colors={['#FF4DD220', '#FF4DD200']} />
      <GlowingOrb delay={1000} x={width * 0.5} y={height * 0.85} size={80} colors={['#7C5CFF20', '#7C5CFF00']} />

      <View style={styles.center}>
        {/* Concentric rings */}
        <Animated.View style={[styles.ring, styles.ringOuter, ringOuterStyle]} />
        <Animated.View style={[styles.ring, styles.ringMid, ringMidStyle]} />
        <Animated.View style={[styles.ring, styles.ringInner, ringInnerStyle]} />

        {/* SVG progress arc */}
        <View style={styles.svgWrap} pointerEvents="none">
          <Svg width={240} height={240} viewBox="0 0 240 240">
            <Defs>
              <SvgGrad id="g1" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#00FFE0" />
                <Stop offset="0.5" stopColor="#7C5CFF" />
                <Stop offset="1" stopColor="#FF4DD2" />
              </SvgGrad>
              <SvgGrad id="g2" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FF4DD2" />
                <Stop offset="0.5" stopColor="#7C5CFF" />
                <Stop offset="1" stopColor="#00FFE0" />
              </SvgGrad>
            </Defs>
            <Circle cx="120" cy="120" r="100" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
            <Circle
              cx="120"
              cy="120"
              r="100"
              stroke="url(#g1)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={630}
              strokeDashoffset={130}
              transform="rotate(-90 120 120)"
            />
            <Circle
              cx="120"
              cy="120"
              r="85"
              stroke="url(#g2)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={535}
              strokeDashoffset={400}
              transform="rotate(90 120 120)"
              opacity={0.5}
            />
          </Svg>
        </View>

        {/* Orbiting dots */}
        <Animated.View style={[styles.orbit, orbitStyle]}>
          <View style={[styles.orbitDot, { backgroundColor: '#00FFE0', top: -5, left: -5 }]} />
          <View style={[styles.orbitDot, { backgroundColor: '#FF4DD2', bottom: -5, right: -5 }]} />
          <View style={[styles.orbitDot, { backgroundColor: '#7C5CFF', top: -5, right: -5 }]} />
          <View style={[styles.orbitDot, { backgroundColor: '#FFB800', bottom: -5, left: -5 }]} />
        </Animated.View>

        {/* Animated logo with actual splash image */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <LinearGradient
            colors={['#00FFE0', '#7C5CFF', '#FF4DD2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Animated.View style={[styles.splashImageContainer, imageStyle]}>
              <Image
                source={SPLASH_LOGO}
                style={styles.splashImage}
                resizeMode="contain"
              />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text style={styles.title}>IndexPilot AI</Text>
        </Animated.View>

        <Animated.View style={taglineStyle}>
          <View style={styles.taglineRow}>
            <View style={[styles.dot, { backgroundColor: '#00FFE0' }]} />
            <Text style={[styles.tagline, { color: '#00FFE0' }]}>AI POWERED</Text>
            <View style={[styles.dot, { backgroundColor: '#7C5CFF' }]} />
            <Text style={[styles.tagline, { color: '#7C5CFF' }]}>OPTIONS TRADING</Text>
            <View style={[styles.dot, { backgroundColor: '#FF4DD2' }]} />
            <Text style={[styles.tagline, { color: '#FF4DD2' }]}>NSE · BSE</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.subtitleContainer, subtitleStyle]}>
          <Text style={styles.subtitleText}>Smart Trading • AI Powered • Real-time Analytics</Text>
        </Animated.View>
      </View>

      {/* Bottom section with progress bar */}
      <Animated.View style={[styles.bottom, taglineStyle]}>
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressBar, progressStyle]} />
        </View>
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <PulseDot key={i} delay={i * 200} />
          ))}
        </View>
        <Text style={styles.bottomText}>Initializing AI Engine...</Text>
      </Animated.View>
    </View>
  );
}

function PulseDot({ delay }: { delay: number }) {
  const scale = useSharedValue(0.5);
  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(0.5, { duration: 600 })
        ),
        -1,
        false
      )
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.dotSm, style]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020010' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ringOuter: {
    width: 340,
    height: 340,
    borderColor: '#00FFE0',
  },
  ringMid: {
    width: 260,
    height: 260,
    borderColor: '#7C5CFF',
  },
  ringInner: {
    width: 190,
    height: 190,
    borderColor: '#FF4DD2',
  },
  svgWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orbit: {
    position: 'absolute',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  logoWrap: {
    marginBottom: spacing.xl,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  splashImageContainer: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: 90,
    height: 90,
  },
  title: {
    ...(typography.h1 as any),
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 38,
    letterSpacing: -1,
    fontWeight: '900',
    textShadowColor: 'rgba(124,92,255,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.base,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  subtitleContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bottom: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 16,
    width: '80%',
  },
  progressContainer: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7C5CFF',
    borderRadius: 1.5,
  },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dotSm: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#7C5CFF' },
  bottomText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1.5, fontWeight: '600' },
});
