import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, TAB_COLORS } from '../lib/theme';
import { TAB_ICONS } from './icons/AppIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 65;
const TAB_BAR_MARGIN = 16;
const INDICATOR_WIDTH = 40;
const INDICATOR_HEIGHT = 3;

function AnimatedTabIcon({
  sectionName,
  isFocused,
  color,
  size,
}: {
  sectionName: string;
  isFocused: boolean;
  color: string;
  size: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.2 : 1, {
      damping: 15,
      stiffness: 150,
    });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const IconComponent = TAB_ICONS[sectionName];
  return (
    <Animated.View style={animatedStyle}>
      {IconComponent && <IconComponent size={size} color={color} focused={isFocused} />}
    </Animated.View>
  );
}

export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const indicatorPosition = useSharedValue(TAB_BAR_MARGIN);

  const tabWidth = (SCREEN_WIDTH - TAB_BAR_MARGIN * 2) / state.routes.length;

  useEffect(() => {
    const targetPosition = TAB_BAR_MARGIN + state.index * tabWidth + tabWidth / 2 - INDICATOR_WIDTH / 2;
    indicatorPosition.value = withSpring(targetPosition, {
      damping: 20,
      stiffness: 200,
    });
  }, [state.index, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const floatingBottom = insets.bottom + 10;

  return (
    <View style={[styles.container, { paddingBottom: floatingBottom }]}>
      <View style={styles.tabBar}>
        <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const sectionColor = TAB_COLORS[route.name as keyof typeof TAB_COLORS] || colors.brand.primary;

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

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <AnimatedTabIcon
                sectionName={route.name}
                isFocused={isFocused}
                color={isFocused ? sectionColor : colors.text.disabled}
                size={24}
              />
            </TouchableOpacity>
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
    backgroundColor: '#111111',
    borderRadius: 20,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
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
