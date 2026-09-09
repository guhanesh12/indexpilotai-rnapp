import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  ScrollView,
} from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  G,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Text as SvgText,
  Polygon,
} from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, radius } from '../lib/theme';
import { intradayApi } from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 300;
const CHART_PADDING_LEFT = 50;
const CHART_PADDING_RIGHT = 10;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 30;
const VOLUME_HEIGHT = 40;
const TOOLBAR_HEIGHT = 44;

type ChartType = 'candle' | 'line';
type Timeframe = '5' | '15';
type DrawingMode = 'none' | 'horizontal' | 'vertical' | 'drag';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DrawnLine {
  id: string;
  type: 'horizontal' | 'vertical';
  value: number; // price for horizontal, time for vertical
  x?: number; // pixel position for vertical
  y?: number; // pixel position for horizontal
  color: string;
}

interface CrosshairData {
  x: number;
  y: number;
  price: number;
  time: number;
  visible: boolean;
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

const LINE_COLORS = ['#FFD700', '#00BFFF', '#FF69B4', '#7C5CFF', '#00FF66'];

/**
 * Convert a candle timestamp (which may be in seconds) to a Date.
 * Dhan API returns timestamps in seconds (Unix epoch).
 */
function toDate(time: number): Date {
  // If the timestamp is in seconds (< 1e12 i.e. before 2001-09-09), convert to ms
  return new Date(time < 100000000000 ? time * 1000 : time);
}

function formatCandleTime(time: number): string {
  return toDate(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function AdvancedChart() {
  const { user } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(INDICES[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>('15');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [zoomLevel, setZoomLevel] = useState(50); // number of visible candles
  const [scrollOffset, setScrollOffset] = useState(0); // scroll position in candles
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairData>({
    x: 0, y: 0, price: 0, time: 0, visible: false,
  });
  const [lineColorIndex, setLineColorIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(50);

  const chartRef = useRef<View>(null);
  const chartLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Chart drawing area dimensions
  const chartAreaWidth = SCREEN_WIDTH - spacing.base * 3 - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const chartAreaHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const result = await intradayApi.getOhlc({ securityId: selectedIndex.id, interval: timeframe });
      if (result?.candles && result.candles.length > 0) {
        setCandles(result.candles);
      } else {
        setError('No data available');
      }
    } catch (err: any) {
      console.warn('[AdvancedChart] Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedIndex.id, timeframe, user]);

  // Initial load + 5-minute polling (300000ms = 5 minutes)
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Get visible candles based on zoom and scroll
  const visibleCandles = candles.length > 0
    ? candles.slice(Math.max(0, candles.length - zoomLevel - scrollOffset), candles.length - scrollOffset || undefined)
    : [];

  // Calculate price range for visible candles
  const prices = visibleCandles.flatMap(c => [c.high, c.low]);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;
  const priceRange = maxPrice - minPrice || 1;
  const pricePadding = priceRange * 0.05;
  const low = minPrice - pricePadding;
  const high = maxPrice + pricePadding;
  const scale = chartAreaHeight / (high - low);

  // Calculate price grid - show 5 evenly spaced labels
  const priceGrid: number[] = [];
  const gridStep = priceRange / 5;
  for (let i = 0; i <= 5; i++) {
    priceGrid.push(Math.round((low + gridStep * i) * 100) / 100);
  }

  // Current price info
  const currentPrice = visibleCandles[visibleCandles.length - 1]?.close || 0;
  const previousClose = candles[candles.length - 2]?.close || currentPrice;
  const priceChange = currentPrice - previousClose;
  const positive = priceChange >= 0;
  const lineColor = positive ? '#00FF66' : '#FF3344';

  // Candle width calculation
  const candleWidth = visibleCandles.length > 0
    ? chartAreaWidth / visibleCandles.length
    : chartAreaWidth / 50;

  // Convert price to Y coordinate
  const priceToY = (price: number) => {
    return CHART_PADDING_TOP + chartAreaHeight - (price - low) * scale;
  };

  // Convert time to X coordinate
  const timeToX = (time: number, index: number) => {
    return CHART_PADDING_LEFT + index * candleWidth + candleWidth / 2;
  };

  // Convert pixel to price
  const yToPrice = (y: number) => {
    return low + (chartAreaHeight - (y - CHART_PADDING_TOP)) / scale;
  };

  // Convert pixel to candle index
  const xToIndex = (x: number) => {
    return Math.floor((x - CHART_PADDING_LEFT) / candleWidth);
  };

  // Generate line path
  const linePath = visibleCandles.map((c, i) => {
    const x = timeToX(c.time, i);
    const y = priceToY(c.close);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  // Generate area fill path
  const lastX = visibleCandles.length > 0
    ? timeToX(visibleCandles[visibleCandles.length - 1].time, visibleCandles.length - 1)
    : CHART_PADDING_LEFT;
  const areaPath = `${linePath} L ${lastX} ${CHART_PADDING_TOP + chartAreaHeight} L ${CHART_PADDING_LEFT} ${CHART_PADDING_TOP + chartAreaHeight} Z`;

  // Generate candle elements
  const candleElements = visibleCandles.map((c, i) => {
    const x = timeToX(c.time, i);
    const isBullish = c.close >= c.open;
    const candleColor = isBullish ? '#00FF66' : '#FF3344';
    const candleTop = Math.max(c.open, c.close);
    const candleBottom = Math.min(c.open, c.close);
    const candleHeight = Math.max((candleTop - candleBottom) * scale, 1);
    const candleY = priceToY(candleTop);
    const wickTop = priceToY(c.high);
    const wickBottom = priceToY(c.low);
    const halfCandleWidth = Math.max(candleWidth * 0.35, 1);

    return (
      <G key={`candle-${i}`}>
        <Line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={candleColor} strokeWidth={1} />
        <Rect
          x={x - halfCandleWidth}
          y={candleY}
          width={halfCandleWidth * 2}
          height={candleHeight}
          fill={candleColor}
          rx={0.5}
        />
      </G>
    );
  });

  // Volume bars
  const volumeMax = Math.max(...visibleCandles.map(c => c.volume), 1);
  const volumeBars = visibleCandles.map((c, i) => {
    const x = timeToX(c.time, i);
    const isBullish = c.close >= c.open;
    const volColor = isBullish ? 'rgba(0,255,102,0.3)' : 'rgba(255,51,68,0.3)';
    const volHeight = (c.volume / volumeMax) * VOLUME_HEIGHT;
    const volY = CHART_HEIGHT - VOLUME_HEIGHT + (VOLUME_HEIGHT - volHeight);

    return (
      <Rect
        key={`vol-${i}`}
        x={x - candleWidth * 0.3}
        y={volY}
        width={candleWidth * 0.6}
        height={volHeight}
        fill={volColor}
        rx={0.5}
      />
    );
  });

  // Drawn lines elements
  const drawnLineElements = drawnLines.map((line) => {
    if (line.type === 'horizontal') {
      const y = priceToY(line.value);
      const isSelected = selectedLineId === line.id;
      return (
        <G key={line.id}>
          <Line
            x1={CHART_PADDING_LEFT}
            y1={y}
            x2={CHART_PADDING_LEFT + chartAreaWidth}
            y2={y}
            stroke={line.color}
            strokeWidth={isSelected ? 2 : 1}
            strokeDasharray={isSelected ? undefined : '6,3'}
            opacity={isSelected ? 1 : 0.7}
          />
          <SvgText
            x={CHART_PADDING_LEFT + chartAreaWidth + 4}
            y={y + 4}
            fill={line.color}
            fontSize={10}
            fontWeight="bold"
          >
            {line.value.toFixed(2)}
          </SvgText>
        </G>
      );
    } else {
      // Vertical line
      const x = line.x || CHART_PADDING_LEFT;
      const isSelected = selectedLineId === line.id;
      return (
        <G key={line.id}>
          <Line
            x1={x}
            y1={CHART_PADDING_TOP}
            x2={x}
            y2={CHART_PADDING_TOP + chartAreaHeight}
            stroke={line.color}
            strokeWidth={isSelected ? 2 : 1}
            strokeDasharray={isSelected ? undefined : '6,3'}
            opacity={isSelected ? 1 : 0.7}
          />
        </G>
      );
    }
  });

  // Crosshair elements
  const crosshairElements = crosshair.visible ? (
    <G>
      <Line
        x1={CHART_PADDING_LEFT}
        y1={crosshair.y}
        x2={CHART_PADDING_LEFT + chartAreaWidth}
        y2={crosshair.y}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={0.5}
        strokeDasharray="4,4"
      />
      <Line
        x1={crosshair.x}
        y1={CHART_PADDING_TOP}
        x2={crosshair.x}
        y2={CHART_PADDING_TOP + chartAreaHeight}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={0.5}
        strokeDasharray="4,4"
      />
      <Circle cx={crosshair.x} cy={crosshair.y} r={4} fill="#fff" />
      {/* Price label */}
      <Rect
        x={CHART_PADDING_LEFT + chartAreaWidth - 80}
        y={crosshair.y - 10}
        width={80}
        height={20}
        fill="rgba(0,0,0,0.8)"
        rx={4}
      />
      <SvgText
        x={CHART_PADDING_LEFT + chartAreaWidth - 40}
        y={crosshair.y + 4}
        fill="#fff"
        fontSize={11}
        fontWeight="bold"
        textAnchor="middle"
      >
        {crosshair.price.toFixed(2)}
      </SvgText>
      {/* Time label */}
      <Rect
        x={crosshair.x - 40}
        y={CHART_PADDING_TOP + chartAreaHeight + 2}
        width={80}
        height={18}
        fill="rgba(0,0,0,0.8)"
        rx={4}
      />
      <SvgText
        x={crosshair.x}
        y={CHART_PADDING_TOP + chartAreaHeight + 14}
        fill="#fff"
        fontSize={10}
        fontWeight="bold"
        textAnchor="middle"
      >
        {formatCandleTime(crosshair.time)}
      </SvgText>
    </G>
  ) : null;

  // Time axis labels
  const timeLabels = visibleCandles
    .filter((_, i) => i % Math.max(Math.floor(visibleCandles.length / 6), 1) === 0)
    .map((c, i) => {
      const idx = visibleCandles.indexOf(c);
      const x = timeToX(c.time, idx);
      const timeStr = formatCandleTime(c.time);
      return (
        <SvgText
          key={`time-${i}`}
          x={x}
          y={CHART_PADDING_TOP + chartAreaHeight + 14}
          fill="#666"
          fontSize={9}
          textAnchor="middle"
        >
          {timeStr}
        </SvgText>
      );
    });

  // Pinch zoom refs
  const lastTouchDistanceRef = useRef<number | null>(null);
  const pinchZoomLevelRef = useRef(zoomLevel);

  // Keep pinch zoom ref in sync
  useEffect(() => {
    pinchZoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  // Refs for latest state values used in PanResponder callbacks
  const drawnLinesRef = useRef(drawnLines);
  const drawingModeRef = useRef(drawingMode);
  const selectedLineIdRef = useRef(selectedLineId);
  const lineColorIndexRef = useRef(lineColorIndex);
  const visibleCandlesRef = useRef(visibleCandles);
  const crosshairRef = useRef(crosshair);
  const isDraggingRef = useRef(isDragging);
  const dragLineIdRef = useRef(dragLineId);

  // Keep refs in sync
  useEffect(() => { drawnLinesRef.current = drawnLines; }, [drawnLines]);
  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);
  useEffect(() => { selectedLineIdRef.current = selectedLineId; }, [selectedLineId]);
  useEffect(() => { lineColorIndexRef.current = lineColorIndex; }, [lineColorIndex]);
  useEffect(() => { visibleCandlesRef.current = visibleCandles; }, [visibleCandles]);
  useEffect(() => { crosshairRef.current = crosshair; }, [crosshair]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { dragLineIdRef.current = dragLineId; }, [dragLineId]);

  // PanResponder for chart interactions - recreated on state changes via useMemo
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      const { locationX, locationY } = evt.nativeEvent;
      const chartX = locationX;
      const chartY = locationY;

      // Handle pinch-to-zoom start
      if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
        const t1 = evt.nativeEvent.touches[0];
        const t2 = evt.nativeEvent.touches[1];
        const dist = Math.sqrt(
          Math.pow(t2.pageX - t1.pageX, 2) + Math.pow(t2.pageY - t1.pageY, 2)
        );
        lastTouchDistanceRef.current = dist;
        return;
      }

      const currentDrawnLines = drawnLinesRef.current;
      const currentDrawingMode = drawingModeRef.current;
      const currentLineColorIndex = lineColorIndexRef.current;

      // Check if touching a drawn line
      let touchedLine: DrawnLine | null = null;
      for (const line of currentDrawnLines) {
        if (line.type === 'horizontal') {
          const lineY = priceToY(line.value);
          if (Math.abs(chartY - lineY) < 15) {
            touchedLine = line;
            break;
          }
        } else {
          const lineX = line.x || CHART_PADDING_LEFT;
          if (Math.abs(chartX - lineX) < 15) {
            touchedLine = line;
            break;
          }
        }
      }

      if (touchedLine) {
        setSelectedLineId(touchedLine.id);
        setDragLineId(touchedLine.id);
        setIsDragging(true);
      } else if (currentDrawingMode === 'horizontal') {
        const price = yToPrice(chartY);
        const newLine: DrawnLine = {
          id: `h-${Date.now()}`,
          type: 'horizontal',
          value: Math.round(price * 100) / 100,
          color: LINE_COLORS[currentLineColorIndex % LINE_COLORS.length],
        };
        setDrawnLines(prev => [...prev, newLine]);
        setLineColorIndex(prev => prev + 1);
      } else if (currentDrawingMode === 'vertical') {
        const newLine: DrawnLine = {
          id: `v-${Date.now()}`,
          type: 'vertical',
          value: 0,
          x: chartX,
          color: LINE_COLORS[currentLineColorIndex % LINE_COLORS.length],
        };
        setDrawnLines(prev => [...prev, newLine]);
        setLineColorIndex(prev => prev + 1);
      } else {
        // Show crosshair
        const price = yToPrice(chartY);
        const currentVisible = visibleCandlesRef.current;
        const candleIdx = xToIndex(chartX);
        const time = currentVisible[candleIdx]?.time || Date.now() / 1000;
        setCrosshair({
          x: chartX,
          y: chartY,
          price: Math.round(price * 100) / 100,
          time,
          visible: true,
        });
      }
    },
    onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const { locationX, locationY } = evt.nativeEvent;

      // Handle pinch-to-zoom
      if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
        const t1 = evt.nativeEvent.touches[0];
        const t2 = evt.nativeEvent.touches[1];
        const dist = Math.sqrt(
          Math.pow(t2.pageX - t1.pageX, 2) + Math.pow(t2.pageY - t1.pageY, 2)
        );
        if (lastTouchDistanceRef.current !== null) {
          const scale = dist / lastTouchDistanceRef.current;
          if (Math.abs(scale - 1) > 0.05) {
            const currentZoom = pinchZoomLevelRef.current;
            const newZoom = scale > 1
              ? Math.max(10, currentZoom - 5)
              : Math.min(200, currentZoom + 5);
            if (newZoom !== currentZoom) {
              setZoomLevel(newZoom);
            }
          }
        }
        lastTouchDistanceRef.current = dist;
        return;
      }

      const chartX = locationX;
      const chartY = locationY;
      const currentIsDragging = isDraggingRef.current;
      const currentDragLineId = dragLineIdRef.current;
      const currentDrawingMode = drawingModeRef.current;

      if (currentIsDragging && currentDragLineId) {
        setDrawnLines(prev => prev.map(line => {
          if (line.id === currentDragLineId) {
            if (line.type === 'horizontal') {
              const price = yToPrice(chartY);
              return { ...line, value: Math.round(price * 100) / 100 };
            } else {
              return { ...line, x: chartX };
            }
          }
          return line;
        }));
      } else if (currentDrawingMode === 'none') {
        const price = yToPrice(chartY);
        const currentVisible = visibleCandlesRef.current;
        const candleIdx = xToIndex(chartX);
        const time = currentVisible[candleIdx]?.time || Date.now() / 1000;
        setCrosshair({
          x: chartX,
          y: chartY,
          price: Math.round(price * 100) / 100,
          time,
          visible: true,
        });
      }
    },
    onPanResponderRelease: (evt: GestureResponderEvent) => {
      setIsDragging(false);
      setDragLineId(null);
      lastTouchDistanceRef.current = null;
      const currentDrawingMode = drawingModeRef.current;
      if (currentDrawingMode === 'none') {
        // Keep crosshair visible briefly
        setTimeout(() => {
          setCrosshair(prev => ({ ...prev, visible: false }));
        }, 3000);
      }
    },
  }), [drawnLines, drawingMode, isDragging, dragLineId, crosshair, visibleCandles, lineColorIndex, zoomLevel]);

  // Handle zoom
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.max(10, prev - 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.min(200, prev + 10));
  };

  const handleScrollLeft = () => {
    setScrollOffset(prev => Math.min(prev + 5, candles.length - zoomLevel));
  };

  const handleScrollRight = () => {
    setScrollOffset(prev => Math.max(0, prev - 5));
  };

  // Clear all drawn lines
  const clearLines = () => {
    setDrawnLines([]);
    setSelectedLineId(null);
  };

  // Delete selected line
  const deleteSelectedLine = () => {
    if (selectedLineId) {
      setDrawnLines(prev => prev.filter(l => l.id !== selectedLineId));
      setSelectedLineId(null);
    }
  };

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
              <Text style={[styles.indexBtnText, selectedIndex.id === idx.id && styles.indexBtnTextActive]}>
                {idx.label}
              </Text>
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
              <Text style={[styles.indexBtnText, selectedIndex.id === idx.id && styles.indexBtnTextActive]}>
                {idx.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'No data'}</Text>
        </View>
      </View>
    );
  }

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
            <Text style={[styles.indexBtnText, selectedIndex.id === idx.id && styles.indexBtnTextActive]}>
              {idx.label}
            </Text>
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

      {/* Drawing Tools Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, drawingMode === 'horizontal' && styles.toolBtnActive]}
          onPress={() => setDrawingMode(drawingMode === 'horizontal' ? 'none' : 'horizontal')}
        >
          <Text style={[styles.toolBtnText, drawingMode === 'horizontal' && styles.toolBtnTextActive]}>
            ― H
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, drawingMode === 'vertical' && styles.toolBtnActive]}
          onPress={() => setDrawingMode(drawingMode === 'vertical' ? 'none' : 'vertical')}
        >
          <Text style={[styles.toolBtnText, drawingMode === 'vertical' && styles.toolBtnTextActive]}>
            │ V
          </Text>
        </TouchableOpacity>
        <View style={styles.toolDivider} />
        <TouchableOpacity
          style={[styles.toolBtn, selectedLineId ? styles.toolBtnDanger : styles.toolBtnDisabled]}
          onPress={deleteSelectedLine}
          disabled={!selectedLineId}
        >
          <Text style={[styles.toolBtnText, selectedLineId ? styles.toolBtnTextDanger : styles.toolBtnTextDisabled]}>
            ✕ Del
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={clearLines}
        >
          <Text style={styles.toolBtnText}>✕ All</Text>
        </TouchableOpacity>
        <View style={styles.toolDivider} />
        <TouchableOpacity
          style={[styles.toolBtn, drawingMode === 'none' && !crosshair.visible && styles.toolBtnActive]}
          onPress={() => setDrawingMode('none')}
        >
          <Text style={[styles.toolBtnText, drawingMode === 'none' && styles.toolBtnTextActive]}>
            ⊹ Cross
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chart Area */}
      <View
        ref={chartRef}
        style={styles.chartWrapper}
        onLayout={(e) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          chartLayoutRef.current = { x, y, width, height };
        }}
        {...panResponder.panHandlers}
      >
        <Svg width={SCREEN_WIDTH - spacing.base * 3} height={CHART_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          {/* Background grid */}
          <Rect
            x={CHART_PADDING_LEFT}
            y={CHART_PADDING_TOP}
            width={chartAreaWidth}
            height={chartAreaHeight}
            fill="rgba(255,255,255,0.02)"
          />

          {/* 5 evenly spaced price grid lines with backdrop labels */}
          {priceGrid.map((price, i) => {
            const y = priceToY(price);
            if (y < CHART_PADDING_TOP || y > CHART_PADDING_TOP + chartAreaHeight) return null;
            const labelWidth = 42;
            const labelHeight = 14;
            return (
              <G key={`grid-${i}`}>
                <Line
                  x1={CHART_PADDING_LEFT}
                  y1={y}
                  x2={CHART_PADDING_LEFT + chartAreaWidth}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={0.5}
                  strokeDasharray="4,4"
                />
                <Rect
                  x={CHART_PADDING_LEFT - labelWidth - 2}
                  y={y - labelHeight / 2}
                  width={labelWidth}
                  height={labelHeight}
                  fill="rgba(10,10,15,0.85)"
                  rx={3}
                />
                <SvgText
                  x={CHART_PADDING_LEFT - 4}
                  y={y + 3}
                  fill="#888"
                  fontSize={9}
                  textAnchor="end"
                >
                  {price.toFixed(0)}
                </SvgText>
              </G>
            );
          })}

          {/* Time axis labels */}
          {timeLabels}

          {/* Volume bars */}
          {volumeBars}

          {/* Chart content */}
          {chartType === 'line' ? (
            <>
              <Path d={areaPath} fill="url(#areaGradient)" />
              <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" />
              {visibleCandles.length > 0 && (
                <Circle
                  cx={timeToX(visibleCandles[visibleCandles.length - 1].time, visibleCandles.length - 1)}
                  cy={priceToY(currentPrice)}
                  r={4}
                  fill={lineColor}
                />
              )}
            </>
          ) : (
            candleElements
          )}

          {/* Drawn lines */}
          {drawnLineElements}

          {/* Crosshair */}
          {crosshairElements}
        </Svg>
      </View>

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn}>
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.zoomLabel}>{zoomLevel}c</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut}>
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={handleScrollLeft}>
          <Text style={styles.zoomBtnText}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleScrollRight}>
          <Text style={styles.zoomBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

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
                <Text style={[styles.toggleText, timeframe === tf.value && styles.toggleTextActive]}>
                  {tf.label}
                </Text>
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

      <Text style={styles.subtitle}>
        {timeframe}-minute candles · Real-time data · 5m auto-update
        {drawnLines.length > 0 ? ` · ${drawnLines.length} lines` : ''}
      </Text>
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.sm,
    padding: 4,
    marginBottom: spacing.sm,
    gap: 4,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(124,92,255,0.3)',
  },
  toolBtnDanger: {
    backgroundColor: 'rgba(255,51,68,0.2)',
  },
  toolBtnDisabled: {
    opacity: 0.3,
  },
  toolBtnText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  toolBtnTextActive: {
    color: '#B49AFF',
  },
  toolBtnTextDanger: {
    color: '#FF3344',
  },
  toolBtnTextDisabled: {
    color: colors.text.disabled,
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  chartWrapper: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  zoomBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  zoomLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  zoomDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
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
