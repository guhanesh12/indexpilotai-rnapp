import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Path, Line, Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, radius } from '../lib/theme';
import { intradayApi } from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;
const CHART_PADDING = 40;

type ChartType = 'line' | 'candle';
type Timeframe = '5' | '15';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INDICES = [
  { id: '13', name: 'NIFTY', label: 'NIFTY' },
  { id: '25', name: 'BANKNIFTY', label: 'BNK' },
  { id: '51', name: 'SENSEX', label: 'SEN' },
];

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '5', label: '5M' },
  { value: '15', label: '15M' },
];

export default function IntradayChart() {
  const { user } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(INDICES[0]); // Default NIFTY
  const [timeframe, setTimeframe] = useState<Timeframe>('15'); // Default 15M
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('candle'); // Default candle

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const result = await intradayApi.getOhlc({ securityId: selectedIndex.id, interval: timeframe });
      if (result?.candles && result.candles.length > 0) {
        setCandles(result.candles.slice(-50));
      } else {
        setError('No data available');
      }
    } catch (err: any) {
      console.warn('[Chart] Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedIndex.id, timeframe, user]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && candles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.selectorRow}>
          {INDICES.map((idx) => (
            <TouchableOpacity
              key={idx.id}
              style={[styles.indexBtn, selectedIndex.id === idx.id && styles.indexBtnActive]}
              onPress={() => setSelectedIndex(idx)}
            >
              <Text style={[styles.indexBtnText, selectedIndex.id === idx.id && styles.indexBtnTextActive]}>{idx.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading {selectedIndex.name}...</Text>
        </View>
      </View>
    );
  }

  if (error || candles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.selectorRow}>
          {INDICES.map((idx) => (
            <TouchableOpacity
              key={idx.id}
              style={[styles.indexBtn, selectedIndex.id === idx.id && styles.indexBtnActive]}
              onPress={() => setSelectedIndex(idx)}
            >
              <Text style={[styles.indexBtnText, selectedIndex.id === idx.id && styles.indexBtnTextActive]}>{idx.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'No data'}</Text>
        </View>
      </View>
    );
  }

  // Calculate chart dimensions
  const chartWidth = SCREEN_WIDTH - spacing.base * 3 - CHART_PADDING * 2;
  const candleWidth = chartWidth / candles.length;

  // Find price range
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  const pricePadding = priceRange * 0.1;

  const low = minPrice - pricePadding;
  const high = maxPrice + pricePadding;
  const scale = (CHART_HEIGHT - 40) / (high - low);

  // Current price
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const previousClose = candles[candles.length - 2]?.close || currentPrice;
  const priceChange = currentPrice - previousClose;
  const positive = priceChange >= 0;
  const lineColor = positive ? '#00FF66' : '#FF3344';
  const gradientColors = positive
    ? { start: '#00FF66', end: '#00B4A0' }
    : { start: '#FF3344', end: '#FF6B6B' };

  // Price labels
  const priceLabels = [high, (high + low) / 2, low];

  // Generate line path
  const linePath = candles.map((c, i) => {
    const x = i * candleWidth + candleWidth / 2;
    const y = CHART_HEIGHT - 20 - (c.close - low) * scale;
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  // Generate area fill path
  const areaPath = `${linePath} L ${(candles.length - 1) * candleWidth + candleWidth / 2} ${CHART_HEIGHT - 20} L ${candleWidth / 2} ${CHART_HEIGHT - 20} Z`;

  // Generate candle paths
  const candleElements = candles.map((c, i) => {
    const x = i * candleWidth + candleWidth / 2;
    const isBullish = c.close >= c.open;
    const candleColor = isBullish ? '#00FF66' : '#FF3344';
    const candleTop = Math.max(c.open, c.close);
    const candleBottom = Math.min(c.open, c.close);
    const candleHeight = Math.max((candleTop - candleBottom) * scale, 1);
    const candleY = CHART_HEIGHT - 20 - (candleTop - low) * scale;
    const wickTop = CHART_HEIGHT - 20 - (c.high - low) * scale;
    const wickBottom = CHART_HEIGHT - 20 - (c.low - low) * scale;
    const halfCandleWidth = Math.max(candleWidth * 0.3, 1);

    return (
      <G key={i}>
        <Line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={candleColor} strokeWidth={1} />
        <Rect x={x - halfCandleWidth} y={candleY} width={halfCandleWidth * 2} height={candleHeight} fill={candleColor} rx={1} />
      </G>
    );
  });

  return (
    <View style={styles.container}>
      {/* Index Selector Row */}
      <View style={styles.selectorRow}>
        {INDICES.map((idx) => (
          <TouchableOpacity
            key={idx.id}
            style={[styles.indexBtn, selectedIndex.id === idx.id && styles.indexBtnActive]}
            onPress={() => setSelectedIndex(idx)}
          >
            <Text style={[styles.indexBtnText, selectedIndex.id === idx.id && styles.indexBtnTextActive]}>{idx.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Price Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.indexName}>{selectedIndex.name}</Text>
          <Text style={[styles.price, { color: lineColor }]}>
            {currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.changeContainer}>
            <Text style={[styles.change, { color: lineColor }]}>
              {positive ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}
            </Text>
            <Text style={[styles.changePercent, { color: lineColor }]}>
              ({Math.abs((priceChange / previousClose) * 100).toFixed(2)}%)
            </Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      <Svg width={chartWidth + CHART_PADDING} height={CHART_HEIGHT}>
        <Defs>
          <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors.start} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={gradientColors.end} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>

        {priceLabels.map((price, i) => (
          <G key={i}>
            <Line
              x1={0} y1={CHART_HEIGHT - 20 - (price - low) * scale}
              x2={chartWidth} y2={CHART_HEIGHT - 20 - (price - low) * scale}
              stroke="#333" strokeWidth={0.5} strokeDasharray="4,4"
            />
            <SvgText
              x={chartWidth + 5} y={CHART_HEIGHT - 20 - (price - low) * scale + 4}
              fill="#666" fontSize={10}
            >
              {price.toFixed(0)}
            </SvgText>
          </G>
        ))}

        {chartType === 'line' ? (
          <>
            <Path d={areaPath} fill="url(#areaGradient)" />
            <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" />
            <Circle
              cx={(candles.length - 1) * candleWidth + candleWidth / 2}
              cy={CHART_HEIGHT - 20 - (currentPrice - low) * scale}
              r={4} fill={lineColor}
            />
          </>
        ) : (
          candleElements
        )}
      </Svg>

      {/* Controls Row: Timeframe + Chart Type */}
      <View style={styles.controlsRow}>
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>TF</Text>
          <View style={styles.toggleContainer}>
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf.value}
                style={[styles.toggleBtn, timeframe === tf.value && styles.toggleBtnActive]}
                onPress={() => setTimeframe(tf.value)}
              >
                <Text style={[styles.toggleText, timeframe === tf.value && styles.toggleTextActive]}>{tf.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>View</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, chartType === 'line' && styles.toggleBtnActive]}
              onPress={() => setChartType('line')}
            >
              <Text style={[styles.toggleText, chartType === 'line' && styles.toggleTextActive]}>Line</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, chartType === 'candle' && styles.toggleBtnActive]}
              onPress={() => setChartType('candle')}
            >
              <Text style={[styles.toggleText, chartType === 'candle' && styles.toggleTextActive]}>Candle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.subtitle}>{timeframe}-minute candles · Real-time data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginTop: spacing.base,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  indexBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  indexBtnActive: {
    backgroundColor: 'rgba(124,92,255,0.2)',
    borderColor: '#7C5CFF',
  },
  indexBtnText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  indexBtnTextActive: {
    color: '#B49AFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  indexName: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  price: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  changeContainer: {
    alignItems: 'flex-end',
  },
  change: {
    fontSize: 14,
    fontWeight: '800',
  },
  changePercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.base,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlLabel: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toggleBtnActive: {
    backgroundColor: '#7C5CFF',
  },
  toggleText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: CHART_HEIGHT,
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.sm,
    fontSize: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: CHART_HEIGHT,
  },
  errorText: {
    color: colors.text.disabled,
    fontSize: 12,
  },
  subtitle: {
    color: colors.text.disabled,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
