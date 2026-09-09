import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  useAnimatedRef,
  runOnJS,
} from 'react-native-reanimated';
import { colors, radius, TAB_COLORS } from '../lib/theme';
import { getIconForSection, TAB_ICONS } from './icons/AppIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_MARGIN = 16;
const INDICATOR_HEIGHT = 3;
const INDICATOR_WIDTH = 40;

interface TabItemProps {
  route: { key: string; name: string };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  sectionName: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function TabItem({ route, isFocused, onPress, onLongPress, sectionName }: {
  route: { key: string; name: string };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  sectionName: string;
}) {
  const scale = useSharedValue(1);
  const iconRef = useAnimatedRef<Animated.View>();

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.2 : 1, {
      damping: 15,
      stiffness: 150,
    });
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const IconComponent = TAB_ICONS[sectionName];
  const iconColor = isFocused ? (TAB_COLORS[sectionName as keyof typeof TAB_COLORS] || colors.brand.primary) : colors.text.disabled;

  return (
    <AnimatedTouchable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View ref={iconRef} style={animatedIconStyle}>
        {IconComponent && <IconComponent size={24} color={iconColor} focused={isFocused} />}
      </Animated.View>
    </AnimatedTouchable>
  );
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const indicatorPosition = useSharedValue(0);

  // Calculate indicator position based on focused tab
  useEffect(() => {
    const tabWidth = (SCREEN_WIDTH - TAB_BAR_MARGIN * 2) / state.routes.length;
    indicatorPosition.value = withSpring(TAB_BAR_MARGIN + state.index * tabWidth + tabWidth / 2 - INDICATOR_WIDTH / 2, {
      damping: 20,
      stiffness: 200,
    });
  }, [state.index]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  // Floating bottom position: safe area + margin
  const floatingBottom = insets.bottom + TAB_BAR_MARGIN;

  return (
    <View style={[styles.container, { paddingBottom: floatingBottom }]}>
      {/* Blur background effect */}
      <BlurView
        intensity={90}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      
      {/* Floating tab bar container */}
      <View style={styles.tabBar}>
        {/* Sliding indicator */}
        <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />
        
        {/* Tab items */}
           {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              sectionName={route.name}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: TAB_BAR_MARGIN,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.xl + 8,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Android elevation
    elevation: 8,
    // Border for visual definition
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    backgroundColor: colors.brand.primary,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
});
