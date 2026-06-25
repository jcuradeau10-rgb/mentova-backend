import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { cryptoAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');

const PERIODS = [
  { key: '1', label: '24H' },
  { key: '7', label: '7J' },
  { key: '30', label: '30J' },
  { key: '90', label: '90J' },
  { key: '365', label: '1A' },
];

interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  total_supply: number;
  ath: number;
  ath_change_percentage: number;
  image: string;
  sparkline_in_7d?: { price: number[] };
}

// Mini sparkline for list items
const SimpleChart = ({ data, color, width: chartWidth, height: chartHeight }: { 
  data: number[]; color: string; width: number; height: number;
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * chartWidth;
    const y = chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');
  const pathD = `M ${points.split(' ').join(' L ')}`;
  const areaPath = `${pathD} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`;
  return (
    <Svg width={chartWidth} height={chartHeight}>
      <Defs>
        <SvgLinearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#grad-${color.replace('#','')})`} />
      <Path d={pathD} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
};

// Interactive Chart Component with smooth pan gesture tracking
const InteractiveChart = ({ coinId, initialData, color = '#00D9A5', currentPrice }: { 
  coinId: string; initialData?: number[]; color?: string; currentPrice?: number;
}) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [isLoading, setIsLoading] = useState(true);
  const [touchIndex, setTouchIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const chartW = width - 48;
  const chartH = 240;
  const volumeH = 44;
  const totalH = chartH + volumeH + 10;
  const { t } = useTranslation();
  const panRef = React.useRef<any>(null);

  useEffect(() => {
    loadChart(selectedPeriod);
  }, [coinId, selectedPeriod]);

  const loadChart = async (days: string) => {
    setIsLoading(true);
    try {
      const res = await cryptoAPI.getChart(coinId, days);
      if (res.data.success && res.data.data?.length > 0) {
        const raw = res.data.data;
        // Keep up to 200 points for precision
        const step = Math.max(1, Math.floor(raw.length / 200));
        const sampled = raw.filter((_: any, i: number) => i % step === 0 || i === raw.length - 1);
        setChartData(sampled);
      }
    } catch (e) {
      console.error('Chart load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || chartData.length < 2) {
    return (
      <View style={iChartStyles.container}>
        <View style={iChartStyles.periodBar}>
          {PERIODS.map(p => (
            <Pressable key={p.key} style={[iChartStyles.periodBtn, selectedPeriod === p.key && iChartStyles.periodBtnActive]} onPress={() => setSelectedPeriod(p.key)}>
              <Text style={[iChartStyles.periodText, selectedPeriod === p.key && iChartStyles.periodTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[iChartStyles.chartBox, { height: totalH, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={color} />
        </View>
      </View>
    );
  }

  const prices = chartData.map(d => d.price);
  const volumes = chartData.map(d => d.volume || 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...volumes) || 1;

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const pctChange = ((lastPrice - firstPrice) / firstPrice) * 100;
  const isPositive = pctChange >= 0;
  const lineColor = isPositive ? '#00D9A5' : '#FF4757';

  // Build price line path with more precision
  const pricePath = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * chartW;
    const y = chartH - ((p - minPrice) / priceRange) * (chartH - 24);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const areaPath = `${pricePath} L ${chartW},${chartH} L 0,${chartH} Z`;

  // Y-axis labels (5 levels)
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    price: minPrice + f * priceRange,
    y: chartH - f * (chartH - 24),
  }));

  // X-axis date labels (5 labels)
  const xLabels = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const idx = Math.round(f * (chartData.length - 1));
    return { 
      x: f * chartW, 
      timestamp: chartData[idx]?.timestamp,
    };
  });

  const formatChartPrice = (p: number) => {
    if (p >= 10000) return `$${(p/1000).toFixed(1)}k`;
    if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  };

  const formatPrecisePrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(6)}`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    if (selectedPeriod === '1') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (selectedPeriod === '7' || selectedPeriod === '30') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const formatShortDate = (ts: number) => {
    const d = new Date(ts);
    if (selectedPeriod === '1') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatVolume = (v: number) => {
    if (v >= 1e9) return `${(v/1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v/1e6).toFixed(0)}M`;
    return `${(v/1e3).toFixed(0)}K`;
  };

  // Smooth touch handling — works for both touch (mobile) and mouse (web)
  const handleInteraction = (evt: any) => {
    const locationX = evt.nativeEvent?.locationX ?? evt.nativeEvent?.offsetX ?? evt.nativeEvent?.pageX;
    if (locationX !== undefined) {
      // Clamp to chart boundaries
      const clampedX = Math.max(0, Math.min(locationX, chartW));
      const idx = Math.round((clampedX / chartW) * (chartData.length - 1));
      const clampedIdx = Math.max(0, Math.min(idx, chartData.length - 1));
      setTouchIndex(clampedIdx);
      setIsDragging(true);
    }
  };

  const endInteraction = () => {
    // Keep the last touched point visible for 1.5s then fade
    setTimeout(() => {
      setTouchIndex(null);
      setIsDragging(false);
    }, 1500);
  };

  const touchPoint = touchIndex !== null ? chartData[touchIndex] : null;
  const touchX = touchIndex !== null ? (touchIndex / (chartData.length - 1)) * chartW : 0;
  const touchY = touchPoint ? chartH - ((touchPoint.price - minPrice) / priceRange) * (chartH - 24) : 0;
  
  // Use currentPrice from props as the "real" price, fallback to chart data
  const displayPrice = currentPrice || lastPrice;

  // Calculate change from first price to touched point
  const touchPctChange = touchPoint ? ((touchPoint.price - firstPrice) / firstPrice) * 100 : 0;
  const touchIsPositive = touchPctChange >= 0;

  // Period labels for clarity
  const periodLabels: Record<string, string> = { '1': '24h', '7': '7j', '30': '30j', '90': '90j', '365': '1a' };

  return (
    <View style={iChartStyles.container} data-testid="interactive-chart">
      {/* Period selector */}
      <View style={iChartStyles.periodBar}>
        {PERIODS.map(p => (
          <Pressable key={p.key} style={[iChartStyles.periodBtn, selectedPeriod === p.key && iChartStyles.periodBtnActive]} onPress={() => { setSelectedPeriod(p.key); setTouchIndex(null); setIsDragging(false); }} data-testid={`period-${p.key}`}>
            <Text style={[iChartStyles.periodText, selectedPeriod === p.key && iChartStyles.periodTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Price info — updates in real-time during drag */}
      <View style={iChartStyles.priceInfo}>
        {touchPoint ? (
          <View style={iChartStyles.touchInfoRow}>
            <Text style={iChartStyles.touchPrice}>{formatPrecisePrice(touchPoint.price)}</Text>
            <View style={iChartStyles.touchMeta}>
              <Text style={iChartStyles.touchDate}>{formatDate(touchPoint.timestamp)}</Text>
              <View style={[iChartStyles.touchChangePill, { backgroundColor: touchIsPositive ? '#00D9A518' : '#FF475718' }]}>
                <Text style={[iChartStyles.touchChangeText, { color: touchIsPositive ? '#00D9A5' : '#FF4757' }]}>
                  {touchIsPositive ? '+' : ''}{touchPctChange.toFixed(2)}%
                </Text>
              </View>
              {touchPoint.volume > 0 && <Text style={iChartStyles.touchVol}>Vol: {formatVolume(touchPoint.volume)}</Text>}
            </View>
          </View>
        ) : (
          <View style={iChartStyles.touchInfoRow}>
            <Text style={iChartStyles.touchPrice}>{formatPrecisePrice(displayPrice)}</Text>
            <View style={iChartStyles.touchMeta}>
              <View style={[iChartStyles.changePill, { backgroundColor: isPositive ? '#00D9A518' : '#FF475718' }]}>
                <Ionicons name={isPositive ? 'trending-up' : 'trending-down'} size={14} color={lineColor} />
                <Text style={[iChartStyles.changeText, { color: lineColor }]}>{isPositive ? '+' : ''}{pctChange.toFixed(2)}% ({periodLabels[selectedPeriod] || selectedPeriod})</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Interactive Chart with drag */}
      <View
        style={[iChartStyles.chartBox, { height: totalH + 24 }]}
        onTouchStart={handleInteraction}
        onTouchMove={handleInteraction}
        onTouchEnd={endInteraction}
        {...(Platform.OS === 'web' ? {
          onMouseDown: handleInteraction,
          onMouseMove: (e: any) => { if (isDragging || e.buttons === 1) handleInteraction(e); },
          onMouseUp: endInteraction,
          onMouseLeave: endInteraction,
        } : {})}
      >
        <Svg width={chartW} height={totalH + 24}>
          <Defs>
            <SvgLinearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lineColor} stopOpacity="0.20" />
              <Stop offset="50%" stopColor={lineColor} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </SvgLinearGradient>
            <SvgLinearGradient id="crosshairGlow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lineColor} stopOpacity="0" />
              <Stop offset="50%" stopColor={lineColor} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {/* Y-axis grid lines */}
          {yLabels.map((yl, i) => (
            <React.Fragment key={i}>
              <Line x1="0" y1={yl.y} x2={chartW} y2={yl.y} stroke="#1A1A35" strokeWidth={0.5} strokeDasharray="3,6" />
              <SvgText x={chartW - 4} y={yl.y - 5} fill="#5A5A6E" fontSize={9} textAnchor="end" fontWeight="500">
                {formatChartPrice(yl.price)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Area fill */}
          <Path d={areaPath} fill="url(#priceAreaGrad)" />

          {/* Price line with round joins for smoothness */}
          <Path d={pricePath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

          {/* Volume bars */}
          {volumes.map((v, i) => {
            const bw = Math.max(1.5, chartW / volumes.length - 0.5);
            const bh = Math.max(1, (v / maxVolume) * volumeH);
            const bx = (i / (volumes.length - 1)) * chartW - bw / 2;
            const by = chartH + 10 + volumeH - bh;
            const isHighlighted = touchIndex !== null && Math.abs(i - touchIndex) <= 1;
            return (
              <Rect key={i} x={bx} y={by} width={bw} height={bh} fill={lineColor} opacity={isHighlighted ? 0.5 : 0.12} rx={1} />
            );
          })}

          {/* X-axis date labels */}
          {xLabels.map((xl, i) => (
            <SvgText key={`x-${i}`} x={xl.x} y={chartH + volumeH + 22} fill="#5A5A6E" fontSize={9} textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'} fontWeight="500">
              {xl.timestamp ? formatShortDate(xl.timestamp) : ''}
            </SvgText>
          ))}

          {/* Crosshair with glow effect */}
          {touchIndex !== null && (
            <>
              {/* Vertical glow line */}
              <Rect x={touchX - 12} y={0} width={24} height={chartH} fill="url(#crosshairGlow)" />
              {/* Vertical dashed line */}
              <Line x1={touchX} y1={0} x2={touchX} y2={chartH + volumeH} stroke={lineColor} strokeWidth={0.8} strokeDasharray="4,4" opacity={0.6} />
              {/* Horizontal dashed line */}
              <Line x1={0} y1={touchY} x2={chartW} y2={touchY} stroke="#FFFFFF" strokeWidth={0.5} strokeDasharray="3,5" opacity={0.2} />
              
              {/* Outer glow circle */}
              <Circle cx={touchX} cy={touchY} r={12} fill={lineColor} opacity={0.12} />
              {/* Middle circle */}
              <Circle cx={touchX} cy={touchY} r={7} fill={lineColor} opacity={0.25} />
              {/* Inner dot */}
              <Circle cx={touchX} cy={touchY} r={4} fill="#FFFFFF" stroke={lineColor} strokeWidth={2.5} />
              
              {/* Price label on Y-axis */}
              <Rect x={chartW - 60} y={touchY - 10} width={58} height={20} rx={4} fill={lineColor} opacity={0.9} />
              <SvgText x={chartW - 31} y={touchY + 4} fill="#FFFFFF" fontSize={9} textAnchor="middle" fontWeight="700">
                {formatChartPrice(touchPoint?.price || 0)}
              </SvgText>
              
              {/* Date label on X-axis */}
              <Rect x={Math.max(0, Math.min(touchX - 32, chartW - 64))} y={chartH + volumeH + 2} width={64} height={18} rx={4} fill="#2A2A4E" />
              <SvgText x={Math.max(32, Math.min(touchX, chartW - 32))} y={chartH + volumeH + 14} fill="#FFFFFF" fontSize={9} textAnchor="middle" fontWeight="600">
                {touchPoint ? formatShortDate(touchPoint.timestamp) : ''}
              </SvgText>
            </>
          )}
        </Svg>
      </View>
    </View>
  );
};

const iChartStyles = StyleSheet.create({
  container: { marginBottom: 8 },
  periodBar: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#111125' },
  periodBtnActive: { backgroundColor: '#7C3AED' },
  periodText: { fontSize: 13, fontWeight: '700', color: '#5A5A6E' },
  periodTextActive: { color: '#FFFFFF' },
  priceInfo: { marginBottom: 10, minHeight: 48 },
  touchInfoRow: { gap: 4 },
  touchPrice: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  touchMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  touchDate: { fontSize: 13, color: '#8B8B9E', fontWeight: '600' },
  touchChangePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  touchChangeText: { fontSize: 12, fontWeight: '800' },
  touchVol: { fontSize: 11, color: '#5A5A6E', fontWeight: '600' },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  changeText: { fontSize: 13, fontWeight: '800' },
  chartBox: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#0D0D20' },
});

// Rainbow BTC Chart Component — faithful recreation of the classic blockchaincenter.net style
const RainbowBTCChart = ({ isVip = false }: { isVip?: boolean }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [touchIdx, setTouchIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const chartW = width - 32;
  const chartH = 320;
  const padLeft = 0;
  const padRight = 60;
  const padTop = 8;
  const padBot = 28;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBot;

  useEffect(() => { loadRainbow(); }, []);

  const loadRainbow = async () => {
    try {
      const res = await cryptoAPI.getRainbow();
      if (res.data.success) setData(res.data);
    } catch (e) { console.error('Rainbow load error:', e); }
    finally { setLoading(false); }
  };

  if (loading || !data) return (
    <View style={rbStyles.container}>
      <View style={rbStyles.header}><Text style={rbStyles.title}>Rainbow Chart BTC</Text></View>
      <View style={[rbStyles.chartBox, { height: chartH, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color="#FFD600" />
      </View>
    </View>
  );

  const prices = data.prices || [];
  const bands = data.bands || [];
  if (prices.length < 2) return null;

  // Time range: start from first data point, extend to 2032
  const BTC_GENESIS = 1230940800;
  const startTs = prices[0].timestamp;
  const endTs = new Date(2033, 0, 1).getTime(); // extend to 2033
  const tsRange = endTs - startTs;

  // Log Y range: $1 to $2,000,000
  const logMin = 0; // log10(1) = 0
  const logMax = 6.3; // log10(2,000,000) ≈ 6.3
  const logRange = logMax - logMin;

  const toX = (ts: number) => padLeft + ((ts - startTs) / tsRange) * plotW;
  const toY = (price: number) => padTop + plotH - ((Math.log10(Math.max(1, price)) - logMin) / logRange) * plotH;

  // Band calc (must match backend)
  const calcBands = (ts: number) => {
    const days = Math.max(1, (ts / 1000 - BTC_GENESIS) / 86400);
    const logDays = Math.log10(days);
    const base = 5.84 * logDays - 17.01;
    const bw = 0.35;
    const offset = 4.5 * bw;
    const result: { low: number; high: number }[] = [];
    for (let i = 0; i < 9; i++) {
      result.push({ low: Math.pow(10, base - offset + i * bw), high: Math.pow(10, base - offset + (i + 1) * bw) });
    }
    return result;
  };

  // Generate time samples for band rendering (including future to 2032)
  const sampleCount = 120;
  const timeSamples: number[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    timeSamples.push(startTs + (tsRange * i) / sampleCount);
  }

  // Classic rainbow colors (bottom to top): dark blue → purple → blue → teal → green → yellow → orange → dark orange → red
  const rainbowColors = ['#4A148C', '#6A1B9A', '#1565C0', '#00838F', '#2E7D32', '#9E9D24', '#FF8F00', '#E65100', '#B71C1C'];

  // Build band paths
  const bandPaths = rainbowColors.map((_, bandIdx) => {
    const topPts = timeSamples.map(ts => {
      const b = calcBands(ts);
      return `${toX(ts).toFixed(1)},${toY(b[bandIdx].high).toFixed(1)}`;
    });
    const botPts = [...timeSamples].reverse().map(ts => {
      const b = calcBands(ts);
      return `${toX(ts).toFixed(1)},${toY(b[bandIdx].low).toFixed(1)}`;
    });
    return `M ${topPts.join(' L ')} L ${botPts.join(' L ')} Z`;
  });

  // BTC price line (black, thick)
  const priceLine = prices.map((p: any, i: number) => {
    const x = toX(p.timestamp);
    const y = toY(p.price);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Y-axis labels (log scale)
  const yTicks = [1, 10, 100, 1000, 10000, 100000, 1000000];
  const yLabels = yTicks.filter(v => Math.log10(v) >= logMin && Math.log10(v) <= logMax);

  // X-axis year labels
  const years = [];
  for (let y = 2012; y <= 2032; y += 2) {
    const ts = new Date(y, 0, 1).getTime();
    if (ts >= startTs && ts <= endTs) years.push({ year: y, x: toX(ts) });
  }

  // Halving dates
  const halvings = [
    { date: new Date(2012, 10, 28).getTime(), label: 'Halving' },
    { date: new Date(2016, 6, 9).getTime(), label: 'Halving' },
    { date: new Date(2020, 4, 11).getTime(), label: 'Halving' },
    { date: new Date(2024, 3, 20).getTime(), label: 'Halving' },
    { date: new Date(2028, 3, 1).getTime(), label: 'Halving' },
  ].filter(h => h.date >= startTs && h.date <= endTs);

  // Touch (VIP only)
  const handleTouch = (evt: any) => {
    if (!isVip) return;
    const locX = evt.nativeEvent?.locationX ?? evt.nativeEvent?.offsetX;
    if (locX !== undefined) {
      const ts = startTs + ((Math.max(0, Math.min(locX - padLeft, plotW)) / plotW) * tsRange);
      let closest = 0;
      let minDist = Infinity;
      prices.forEach((p: any, i: number) => { const d = Math.abs(p.timestamp - ts); if (d < minDist) { minDist = d; closest = i; } });
      setTouchIdx(closest);
      setDragging(true);
    }
  };
  const endTouch = () => { setTimeout(() => { setTouchIdx(null); setDragging(false); }, 2000); };

  const tp = touchIdx !== null ? prices[touchIdx] : null;
  const tpBands = tp ? calcBands(tp.timestamp) : null;
  const tpBandIdx = tp && tpBands ? (() => { for (let i = 0; i < tpBands.length; i++) if (tp.price < tpBands[i].high) return i; return 8; })() : 0;

  return (
    <View style={rbStyles.container}>
      <View style={rbStyles.header}>
        <View>
          <Text style={rbStyles.title}>Rainbow Chart BTC</Text>
          <Text style={rbStyles.subtitle}>Logarithmic Regression 2010 — 2032</Text>
        </View>
        <View style={[rbStyles.currentBandPill, { backgroundColor: data.current_band_color + '25', borderColor: data.current_band_color + '50' }]}>
          <View style={[rbStyles.bandDot, { backgroundColor: data.current_band_color }]} />
          <Text style={[rbStyles.bandPillText, { color: data.current_band_color }]}>{data.current_band_label}</Text>
        </View>
      </View>

      {/* Touch info */}
      {tp && (
        <View style={rbStyles.touchInfo}>
          <Text style={rbStyles.touchPrice}>${tp.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
          <Text style={[rbStyles.touchBand, { color: rainbowColors[tpBandIdx] }]}>{bands[tpBandIdx]?.label}</Text>
          <Text style={rbStyles.touchDate}>{new Date(tp.timestamp).toLocaleDateString([], { year: 'numeric', month: 'short' })}</Text>
        </View>
      )}

      {/* Chart with white background */}
      <View
        style={[rbStyles.chartBox, { height: chartH }]}
        onTouchStart={handleTouch} onTouchMove={handleTouch} onTouchEnd={endTouch}
        {...(Platform.OS === 'web' ? { onMouseDown: handleTouch, onMouseMove: (e: any) => { if (dragging || e.buttons === 1) handleTouch(e); }, onMouseUp: endTouch, onMouseLeave: endTouch } : {})}
      >
        <Svg width={chartW} height={chartH}>
          {/* White background */}
          <Rect x={padLeft} y={padTop} width={plotW} height={plotH} fill="#FAFAFA" rx={4} />

          {/* Y-axis grid lines + labels */}
          {yLabels.map(v => {
            const y = toY(v);
            const label = v >= 1000000 ? `$${v / 1000000}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;
            return (
              <React.Fragment key={v}>
                <Line x1={padLeft} y1={y} x2={padLeft + plotW} y2={y} stroke="#DDD" strokeWidth={0.5} />
                <SvgText x={padLeft + plotW + 6} y={y + 4} fill="#888" fontSize={9} fontWeight="600">{label}</SvgText>
              </React.Fragment>
            );
          })}

          {/* Halving vertical lines */}
          {halvings.map((h, i) => (
            <React.Fragment key={`h-${i}`}>
              <Line x1={toX(h.date)} y1={padTop} x2={toX(h.date)} y2={padTop + plotH} stroke="#BBB" strokeWidth={0.5} />
              <SvgText x={toX(h.date)} y={padTop + plotH - 4} fill="#AAA" fontSize={7} textAnchor="middle" fontWeight="500">Halving</SvgText>
            </React.Fragment>
          ))}

          {/* Rainbow bands */}
          {bandPaths.map((d, i) => (
            <Path key={`rb-${i}`} d={d} fill={rainbowColors[i]} opacity={0.75} />
          ))}

          {/* BTC price line — black and bold */}
          <Path d={priceLine} stroke="#000000" strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

          {/* Year labels */}
          {years.map(yr => (
            <SvgText key={yr.year} x={yr.x} y={chartH - 4} fill="#888" fontSize={9} textAnchor="middle" fontWeight="600">{yr.year}</SvgText>
          ))}

          {/* Crosshair (VIP) */}
          {touchIdx !== null && tp && (
            <>
              <Line x1={toX(tp.timestamp)} y1={padTop} x2={toX(tp.timestamp)} y2={padTop + plotH} stroke="#000" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
              <Circle cx={toX(tp.timestamp)} cy={toY(tp.price)} r={5} fill="#000" stroke="#FFF" strokeWidth={2} />
            </>
          )}
        </Svg>

        {/* VIP Lock */}
        {!isVip && (
          <View style={rbStyles.lockOverlay}>
            <Ionicons name="lock-closed" size={16} color="#FFD600" />
            <Text style={rbStyles.lockText}>VIP: Glissez pour explorer</Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={rbStyles.legend}>
        {bands.slice().reverse().map((b: any, i: number) => (
          <View key={i} style={rbStyles.legendItem}>
            <View style={[rbStyles.legendDot, { backgroundColor: rainbowColors[8 - i] }]} />
            <Text style={rbStyles.legendLabel} numberOfLines={1}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const rbStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: '#8B8B9E', marginTop: 2 },
  currentBandPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  bandDot: { width: 8, height: 8, borderRadius: 4 },
  bandPillText: { fontSize: 11, fontWeight: '800' },
  touchInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  touchPrice: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  touchBand: { fontSize: 12, fontWeight: '700' },
  touchDate: { fontSize: 11, color: '#8B8B9E' },
  chartBox: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#FAFAFA', position: 'relative' as any, borderWidth: 1, borderColor: '#2A2A4E' },
  lockOverlay: { position: 'absolute' as any, bottom: 32, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.65)' },
  lockText: { fontSize: 12, fontWeight: '700', color: '#FFD600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 9, color: '#8B8B9E', fontWeight: '600' },
});

export default function MarketScreen() {
  const { t } = useTranslation();
  const [cryptoPrices, setCryptoPrices] = useState<CryptoData[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);

  const fetchData = async () => {
    try {
      const [pricesRes, globalRes] = await Promise.all([
        cryptoAPI.getPrices(),
        cryptoAPI.getGlobalStats(),
      ]);
      
      if (pricesRes.data.success) {
        setCryptoPrices(pricesRes.data.data || []);
      }
      if (globalRes.data.success) {
        setGlobalStats(globalRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatNumber = (num: number) => {
    if (!num) return '$0';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatPrice = (price: number) => {
    if (!price) return '$0.00';
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatSupply = (supply: number, symbol: string) => {
    if (!supply) return 'N/A';
    if (supply >= 1e9) return `${(supply / 1e9).toFixed(2)}B ${symbol.toUpperCase()}`;
    if (supply >= 1e6) return `${(supply / 1e6).toFixed(2)}M ${symbol.toUpperCase()}`;
    return `${supply.toLocaleString()} ${symbol.toUpperCase()}`;
  };

  const openCryptoDetail = (crypto: CryptoData) => {
    setSelectedCrypto(crypto);
    setShowCryptoModal(true);
  };

  // Generate mock sparkline if not available
  const generateMockSparkline = (currentPrice: number, change24h: number) => {
    const points = 24;
    const data = [];
    const startPrice = currentPrice / (1 + change24h / 100);
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      const randomVariation = (Math.random() - 0.5) * 0.02 * currentPrice;
      const price = startPrice + (currentPrice - startPrice) * progress + randomVariation;
      data.push(price);
    }
    return data;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="trending-up" size={40} color="#7C3AED" />
          </View>
          <Text style={styles.loadingText}>{t('market.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
          />
        }
      >
        <Text style={styles.pageTitle}>{t('market.title')}</Text>

        {/* Global Stats */}
        {globalStats && (
          <View style={styles.globalCard}>
            <Text style={styles.globalTitle}>{t('market.globalMarket')}</Text>
            
            <View style={styles.globalRow}>
              <View style={styles.globalItem}>
                <Text style={styles.globalLabel}>{t('market.marketCap')}</Text>
                <Text style={styles.globalValue}>
                  {formatNumber(globalStats.total_market_cap?.usd)}
                </Text>
              </View>
              <View style={styles.globalDivider} />
              <View style={styles.globalItem}>
                <Text style={styles.globalLabel}>{t('market.volume24h')}</Text>
                <Text style={styles.globalValue}>
                  {formatNumber(globalStats.total_volume?.usd)}
                </Text>
              </View>
            </View>

            {/* Dominance Bar */}
            <View style={styles.dominanceSection}>
              <Text style={styles.dominanceTitle}>{t('market.dominance')}</Text>
              <View style={styles.dominanceBarContainer}>
                <View 
                  style={[
                    styles.dominanceBar, 
                    { 
                      width: `${globalStats.market_cap_percentage?.btc || 50}%`,
                      backgroundColor: '#F7931A',
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                    }
                  ]} 
                />
                <View 
                  style={[
                    styles.dominanceBar, 
                    { 
                      width: `${globalStats.market_cap_percentage?.eth || 20}%`,
                      backgroundColor: '#627EEA',
                    }
                  ]} 
                />
              </View>
              <View style={styles.dominanceLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F7931A' }]} />
                  <Text style={styles.legendText}>BTC {(globalStats.market_cap_percentage?.btc || 0).toFixed(1)}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#627EEA' }]} />
                  <Text style={styles.legendText}>ETH {(globalStats.market_cap_percentage?.eth || 0).toFixed(1)}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#8B8B9E' }]} />
                  <Text style={styles.legendText}>{t('market.others')}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Crypto List */}
        <Text style={styles.sectionTitle}>{t('market.topCryptos')}</Text>
        
        {cryptoPrices.map((crypto, index) => {
          const isPositive = (crypto.price_change_percentage_24h || 0) >= 0;
          const sparklineData = crypto.sparkline_in_7d?.price || 
            generateMockSparkline(crypto.current_price, crypto.price_change_percentage_24h || 0);
          
          return (
            <TouchableOpacity 
              key={crypto.id || index} 
              style={styles.cryptoCard}
              onPress={() => openCryptoDetail(crypto)}
              activeOpacity={0.7}
            >
              <Text style={styles.cryptoRank}>{index + 1}</Text>
              
              <View style={styles.cryptoInfo}>
                {crypto.image && (
                  <Image source={{ uri: crypto.image }} style={styles.cryptoImage} />
                )}
                <View style={styles.cryptoNameBox}>
                  <Text style={styles.cryptoName} numberOfLines={1}>{crypto.name}</Text>
                  <Text style={styles.cryptoSymbol}>{crypto.symbol?.toUpperCase()}</Text>
                </View>
              </View>

              {/* Mini Chart */}
              <View style={styles.miniChart}>
                <SimpleChart 
                  data={sparklineData.slice(-24)} 
                  color={isPositive ? '#00D9A5' : '#FF4757'}
                  width={60}
                  height={30}
                />
              </View>

              <View style={styles.cryptoPriceBox}>
                <Text style={styles.cryptoPrice}>{formatPrice(crypto.current_price)}</Text>
                <View style={[
                  styles.changeBox,
                  { backgroundColor: isPositive ? '#00D9A520' : '#FF475720' }
                ]}>
                  <Ionicons 
                    name={isPositive ? 'caret-up' : 'caret-down'} 
                    size={10} 
                    color={isPositive ? '#00D9A5' : '#FF4757'} 
                  />
                  <Text style={[
                    styles.changeText,
                    { color: isPositive ? '#00D9A5' : '#FF4757' }
                  ]}>
                    {Math.abs(crypto.price_change_percentage_24h || 0).toFixed(2)}%
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#5A5A6E" />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Crypto Detail Modal */}
      <Modal
        visible={showCryptoModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCryptoModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {selectedCrypto && (
            <>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  onPress={() => setShowCryptoModal(false)} 
                  style={styles.modalBackBtn}
                >
                  <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.modalHeaderCenter}>
                  {selectedCrypto.image && (
                    <Image source={{ uri: selectedCrypto.image }} style={styles.modalCryptoImage} />
                  )}
                  <Text style={styles.modalCryptoName}>{selectedCrypto.name}</Text>
                  <Text style={styles.modalCryptoSymbol}>{selectedCrypto.symbol?.toUpperCase()}</Text>
                </View>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Price Section */}
                <View style={styles.priceSection}>
                  <Text style={styles.currentPrice}>{formatPrice(selectedCrypto.current_price)}</Text>
                  <View style={[
                    styles.priceChangeBox,
                    { 
                      backgroundColor: (selectedCrypto.price_change_percentage_24h || 0) >= 0 
                        ? '#00D9A520' : '#FF475720' 
                    }
                  ]}>
                    <Ionicons 
                      name={(selectedCrypto.price_change_percentage_24h || 0) >= 0 ? 'trending-up' : 'trending-down'} 
                      size={16} 
                      color={(selectedCrypto.price_change_percentage_24h || 0) >= 0 ? '#00D9A5' : '#FF4757'} 
                    />
                    <Text style={[
                      styles.priceChangeText,
                      { color: (selectedCrypto.price_change_percentage_24h || 0) >= 0 ? '#00D9A5' : '#FF4757' }
                    ]}>
                      {(selectedCrypto.price_change_percentage_24h || 0).toFixed(2)}% (24h)
                    </Text>
                  </View>
                </View>

                {/* Rainbow Chart (Bitcoin only) */}
                {selectedCrypto.id === 'bitcoin' && (
                  <RainbowBTCChart isVip={false} />
                )}

                {/* Interactive Chart */}
                <View style={styles.chartContainer}>
                  <InteractiveChart 
                    coinId={selectedCrypto.id}
                    currentPrice={selectedCrypto.current_price}
                    color={(selectedCrypto.price_change_percentage_24h || 0) >= 0 ? '#00D9A5' : '#FF4757'}
                  />
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('market.marketCap')}</Text>
                    <Text style={styles.statValue}>{formatNumber(selectedCrypto.market_cap)}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('market.volume24h')}</Text>
                    <Text style={styles.statValue}>{formatNumber(selectedCrypto.total_volume)}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('market.high24h')}</Text>
                    <Text style={[styles.statValue, { color: '#00D9A5' }]}>
                      {formatPrice(selectedCrypto.high_24h)}
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('market.low24h')}</Text>
                    <Text style={[styles.statValue, { color: '#FF4757' }]}>
                      {formatPrice(selectedCrypto.low_24h)}
                    </Text>
                  </View>
                </View>

                {/* Additional Info */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoTitle}>Informations</Text>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Supply en circulation</Text>
                    <Text style={styles.infoValue}>
                      {formatSupply(selectedCrypto.circulating_supply, selectedCrypto.symbol)}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Supply totale</Text>
                    <Text style={styles.infoValue}>
                      {selectedCrypto.total_supply 
                        ? formatSupply(selectedCrypto.total_supply, selectedCrypto.symbol)
                        : '∞'}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ATH (Plus haut historique)</Text>
                    <Text style={styles.infoValue}>{formatPrice(selectedCrypto.ath)}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Depuis l'ATH</Text>
                    <Text style={[styles.infoValue, { color: '#FF4757' }]}>
                      {(selectedCrypto.ath_change_percentage || 0).toFixed(2)}%
                    </Text>
                  </View>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#8B8B9E',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 20,
  },
  globalCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  globalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  globalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  globalItem: {
    flex: 1,
  },
  globalLabel: {
    fontSize: 13,
    color: '#8B8B9E',
    marginBottom: 4,
  },
  globalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  globalDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2A2A4E',
    marginHorizontal: 20,
  },
  dominanceSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4E',
  },
  dominanceTitle: {
    fontSize: 13,
    color: '#8B8B9E',
    marginBottom: 10,
  },
  dominanceBarContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A4E',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dominanceBar: {
    height: '100%',
  },
  dominanceLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#8B8B9E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  cryptoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  cryptoRank: {
    width: 24,
    fontSize: 13,
    fontWeight: '600',
    color: '#8B8B9E',
  },
  cryptoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cryptoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  cryptoNameBox: {
    flex: 1,
  },
  cryptoName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cryptoSymbol: {
    fontSize: 11,
    color: '#8B8B9E',
    marginTop: 2,
  },
  miniChart: {
    width: 60,
    height: 30,
    marginHorizontal: 10,
  },
  cryptoPriceBox: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  cryptoPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  changeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalCryptoImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  modalCryptoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCryptoSymbol: {
    fontSize: 14,
    color: '#8B8B9E',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  priceSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  currentPrice: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceChangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  priceChangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  chartBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  statLabel: {
    fontSize: 12,
    color: '#8B8B9E',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4E',
  },
  infoLabel: {
    fontSize: 13,
    color: '#8B8B9E',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'right',
    flex: 1,
  },
});
