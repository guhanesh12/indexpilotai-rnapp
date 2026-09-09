import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../lib/theme';

// ─── Types ────────────────────────────────────────
interface ChartImage {
  id: string;
  uri?: string;
  label: string;
  type: 'chart' | 'screenshot' | 'analysis';
  timestamp?: string;
}

interface ImageAvailableModuleProps {
  images?: ChartImage[];
  onViewAll?: () => void;
  onCaptureScreenshot?: () => void;
  onShareAll?: () => void;
  onDownload?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

// ─── Default images for demo/empty state ──────────
const DEFAULT_IMAGES: ChartImage[] = [
  { id: '1', label: 'NIFTY Chart', type: 'chart', timestamp: '2m ago' },
  { id: '2', label: 'BANKNIFTY Analysis', type: 'analysis', timestamp: '5m ago' },
  { id: '3', label: 'Portfolio Snapshot', type: 'screenshot', timestamp: '10m ago' },
  { id: '4', label: 'P&L Performance', type: 'screenshot', timestamp: '15m ago' },
];

// ─── Component ────────────────────────────────────
export default function ImageAvailableModule({
  images = DEFAULT_IMAGES,
  onViewAll,
  onCaptureScreenshot,
  onShareAll,
  onDownload,
  onRefresh,
  loading = false,
}: ImageAvailableModuleProps) {
  return (
    <LinearGradient
      colors={['#1A1A2E', '#12121A']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={20} color="#B49AFF" />
          <View>
            <Text style={styles.title}>Chart Images</Text>
            <Text style={styles.subtitle}>{images.length} available</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color="#B49AFF" />
        </TouchableOpacity>
      </View>

      {/* Compact Image Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.slice(0, 3).map((image, index) => (
          <ImageCard key={image.id} image={image} index={index} />
        ))}

        {/* Compact Camera Icon Button */}
        <TouchableOpacity onPress={onCaptureScreenshot} style={styles.captureBtn}>
          <Ionicons name="camera" size={24} color="#7C5CFF" />
          <Text style={styles.captureBtnText}>Capture</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onShareAll}>
          <Ionicons name="share-outline" size={16} color="#fff" />
          <Text style={styles.actionText}>Share All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDownload}>
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={styles.actionText}>Download</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.actionText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ─── Image Card ───────────────────────────────────
function ImageCard({ image, index }: { image: ChartImage; index: number }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const typeIcon = {
    chart: 'bar-chart-outline',
    screenshot: 'aperture-outline',
    analysis: 'analytics-outline',
  }[image.type] || 'image-outline';

  const typeColor = {
    chart: '#00B4FF',
    screenshot: '#00FF66',
    analysis: '#FFB800',
  }[image.type] || '#7C5CFF';

  return (
    <Animated.View style={[animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={() => { scale.value = withSpring(0.95); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={styles.imageCard}
      >
        {/* Placeholder gradient for image */}
        <LinearGradient
          colors={[typeColor + '22', typeColor + '44']}
          style={styles.imagePlaceholder}
        >
          <Ionicons name={typeIcon as any} size={32} color={typeColor} />
        </LinearGradient>

        {/* Label */}
        <View style={styles.imageInfo}>
          <Text style={styles.imageLabel} numberOfLines={1}>{image.label}</Text>
          <View style={styles.imageMeta}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '22' }]}>
              <Text style={[styles.typeText, { color: typeColor }]}>{image.type}</Text>
            </View>
            {image.timestamp && (
              <Text style={styles.timestamp}>{image.timestamp}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    padding: spacing.base,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(180,154,255,0.15)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    color: '#B49AFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  imageCard: {
    width: 140,
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  imagePlaceholder: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageInfo: {
    padding: spacing.sm,
  },
  imageLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  imageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timestamp: {
    color: colors.text.disabled,
    fontSize: 9,
  },
  captureBtn: {
    width: 90,
    backgroundColor: 'rgba(124,92,255,0.08)',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(124,92,255,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: 4,
  },
  captureBtnText: {
    color: '#7C5CFF',
    fontSize: 11,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
