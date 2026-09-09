import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/lib/theme';

// Tab bar constants - matches professional trading app UI (Dhan/Zerodha)
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_MARGIN = 12;

// Custom tab icon colors based on your requirements:
// Home = cyan (#00FFE0)
// Signals/Symbols = orange (#FF9500)
// Broker = purple (#7C5CFF)
// Positions = gold (#FFB800)
// Journal = green (#00FF66)
// Support = blue (#00B4FF)
// Logs = gray (#888888)

const TAB_COLORS: Record<string, string> = {
  home: '#00FFE0',      // Cyan
  symbols: '#FF9500',    // Orange
  broker: '#7C5CFF',    // Purple
  positions: '#FFB800',  // Gold
  journal: '#00FF66',    // Green
  support: '#00B4FF',   // Blue
  logs: '#888888',      // Gray
};

// Animated tab icon component with scale animation
function AnimatedTabIcon({ 
  name, 
  focused, 
  color,
  size = 24 
}: { 
  name: string; 
  focused: boolean; 
  color: string;
  size?: number;
}) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.3 : 1, {
      damping: 12,
      stiffness: 180,
    });
    glow.value = withSpring(focused ? 1 : 0, {
      damping: 15,
      stiffness: 100,
    });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: focused ? 1 : 0.7,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + glow.value * 0.2,
    transform: [{ scale: 1 + glow.value * 0.3 }],
  }));

  return (
    <View>
      <Animated.View style={[glowStyle, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, backgroundColor: color }]} />
      <Animated.View style={animatedStyle}>
        <Ionicons name={name as any} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

// Special BIG glowing animated icon for Positions tab - bigger, pulsing, with glow ring
function GlowingTabIcon({ 
  name, 
  focused, 
}: { 
  name: string; 
  focused: boolean; 
}) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0.85);
  const glow = useSharedValue(0);

  useEffect(() => {
    // Scale animation on focus
    scale.value = withSpring(focused ? 1.2 : 1, {
      damping: 10,
      stiffness: 200,
    });
    
    // Glow effect on focus
    glow.value = withSpring(focused ? 1 : 0, {
      damping: 15,
      stiffness: 100,
    });
    
    // Continuous subtle pulse animation always running
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.85, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
    opacity: focused ? 1 : 0.85,
  }));

  const glowOuterStyle = useAnimatedStyle(() => ({
    opacity: (focused ? 0.5 : 0.35) + glow.value * 0.4,
    transform: [{ scale: 1.2 + glow.value * 0.3 }],
  }));

  const glowInnerStyle = useAnimatedStyle(() => ({
    opacity: (focused ? 0.4 : 0.25) + glow.value * 0.3,
    transform: [{ scale: 0.9 + pulse.value * 0.1 }],
  }));

  const color = '#FFB800';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 56, height: 56, marginTop: -12 }}>
      {/* Inner pulsing ring */}
      <Animated.View style={[glowInnerStyle, {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: `${color}25`,
        borderWidth: 2.5,
        borderColor: `${color}DD`,
      }]} />
      
      {/* Icon */}
      <Animated.View style={[{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: focused ? `${color}35` : `${color}15`,
        alignItems: 'center',
        justifyContent: 'center',
      }, animatedStyle]}>
        <Ionicons name={name as any} size={focused ? 28 : 26} color={color} />
      </Animated.View>
    </View>
  );
}


export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Set Android system navigation bar to solid black background with light buttons
  useEffect(() => {
    (async () => {
      try {
        // Set background color to pure black (required for trading app look)
        await NavigationBar.setBackgroundColorAsync('#000000');
        // Set button style to light (white icons)
        await NavigationBar.setButtonStyleAsync('light');
        // Set visibility to always show the navigation bar
        await NavigationBar.setVisibilityAsync('visible');
      } catch (e) {
        // Only available on Android - silently fail on other platforms
        console.log('Navigation bar setup:', e);
      }
    })();
  }, []);

  /**
   * TWO-LAYER UI STRUCTURE (Professional Trading App Layout):
   * 
   * Layer 1 (System area): Fixed black strip at bottom
   * - Height = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_MARGIN
   * - BackgroundColor = #000000 (pure black)
   * - This covers the 3-button navigation (Back, Home, Recent)
   * 
   * Layer 2 (Tab bar): Floating above system bar  
   * - Position: absolute, bottom = insets.bottom
   * - This places the tab bar right above the system navigation
   * - No overlap, no gap, clean separation like Dhan/Zerodha
   */

  // Tab bar position: sits directly above system navigation bar
  const tabBarBottom = insets.bottom;
  
  // Black background strip height: extends from bottom up to tab bar
  // Covers the 3-button navigation (Back, Home, Recent) plus area behind tabs
  const blackBackgroundHeight = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_MARGIN;

  return (
    <View style={styles.container}>
      {/* Layer 1: Solid black background for system navigation area - covers 3-button nav */}
      <View 
        style={[
          styles.systemBarBackground, 
          { height: blackBackgroundHeight }
        ]} 
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          // Each tab gets its unique active color
          tabBarActiveTintColor: TAB_COLORS.home, // Will be overridden per-screen
          tabBarInactiveTintColor: colors.text.disabled,
          // Floating tab bar - positioned at bottom = insets.bottom (right above system bar)
          tabBarStyle: {
            position: 'absolute',
            bottom: tabBarBottom,
            left: TAB_BAR_MARGIN,
            right: TAB_BAR_MARGIN,
            backgroundColor: '#000000ff',
            borderRadius: 20,
            height: TAB_BAR_HEIGHT,
            borderTopWidth: 0,
            // iOS shadow for floating effect
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            // Android elevation
            elevation: 12,
            // Border for visual definition
            borderWidth: 1,
            borderColor: colors.border.default,
          },
          tabBarLabelStyle: { 
            fontSize: 10, 
            fontWeight: '700', 
            letterSpacing: 0.5,
          },
        }}
>
        <Tabs.Screen 
          name="home" 
          options={{
            title: 'Home', 
            tabBarActiveTintColor: TAB_COLORS.home,
            tabBarIcon: ({ focused, color }) => (
              <AnimatedTabIcon 
                name={focused ? 'grid' : 'grid-outline'} 
                focused={focused} 
                color={focused ? TAB_COLORS.home : colors.text.disabled}
              />
            )
          }} 
        />
        <Tabs.Screen
          name="symbols" 
          options={{ 
            title: 'Symbols', 
            tabBarActiveTintColor: TAB_COLORS.symbols,
            tabBarIcon: ({ focused, color }) => (
              <AnimatedTabIcon 
                name={focused ? 'list' : 'list-outline'} 
                focused={focused} 
                color={focused ? TAB_COLORS.symbols : colors.text.disabled}
              />
            )
          }} 
        />
        {/* Positions - 3rd tab with BIG glowing animated icon */}
        <Tabs.Screen
          name="position-monitor"
          options={{ 
            title: 'Positions', 
            tabBarActiveTintColor: TAB_COLORS.positions,
            tabBarIcon: ({ focused }) => (
              <GlowingTabIcon 
                name={focused ? 'analytics' : 'analytics-outline'} 
                focused={focused} 
              />
            ),
            tabBarLabelStyle: {
              fontSize: 10, 
              fontWeight: '900', 
              letterSpacing: 0.5,
            },
          }} 
        />
        <Tabs.Screen
          name="broker" 
          options={{ 
            title: 'Broker', 
            tabBarActiveTintColor: TAB_COLORS.broker,
            tabBarIcon: ({ focused, color }) => (
              <AnimatedTabIcon 
                name={focused ? 'flash' : 'flash-outline'} 
                focused={focused} 
                color={focused ? TAB_COLORS.broker : colors.text.disabled}
              />
            )
          }} 
        />
        <Tabs.Screen 
          name="journal" 
          options={{ 
            title: 'Journal', 
            tabBarActiveTintColor: TAB_COLORS.journal,
            tabBarIcon: ({ focused, color }) => (
              <AnimatedTabIcon 
                name={focused ? 'book' : 'book-outline'} 
                focused={focused} 
                color={focused ? TAB_COLORS.journal : colors.text.disabled}
              />
            )
          }} 
        />
        {/* Support and Logs - hidden from tab bar, accessible from Profile screen */}
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="logs" options={{ href: null }} />
        {/* Hidden tabs - accessed via navigation from other screens */}
        <Tabs.Screen name="strategies" options={{ href: null }} />
        <Tabs.Screen name="advanced-positions" options={{ href: null }} />
        <Tabs.Screen name="backtest" options={{ href: null }} />
        {/* Hide profile from tab bar - accessed via header button */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="notifications-test" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  // System navigation bar background - solid black to cover 3-button navigation
  systemBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    zIndex: -1,
  },
});
