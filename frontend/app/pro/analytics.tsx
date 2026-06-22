import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { proAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';

const { width } = Dimensions.get('window');

// Interactive Line Chart Component
const LineChart = ({ data, height = 200 }: { data: any[]; height?: number }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.total || 0), 1);
  const chartWidth = width - 80;
  const pointSpacing = chartWidth / Math.max(data.length - 1, 1);
  
  // Create SVG path for the line
  const points = data.map((item, index) => ({
    x: index * pointSpacing,
    y: height - 40 - ((item.total / maxValue) * (height - 60)),
  }));
  
  return (
    <View style={[styles.chartContainer, { height }]}>
      {/* Y-axis labels */}
      <View style={styles.yAxisLabels}>
        <Text style={styles.axisLabel}>${maxValue.toFixed(0)}</Text>
        <Text style={styles.axisLabel}>${(maxValue / 2).toFixed(0)}</Text>
        <Text style={styles.axisLabel}>$0</Text>
      </View>
      
      {/* Chart area */}
      <View style={styles.chartArea}>
        {/* Grid lines */}
        <View style={[styles.gridLine, { top: 0 }]} />
        <View style={[styles.gridLine, { top: '50%' }]} />
        <View style={[styles.gridLine, { bottom: 20 }]} />
        
        {/* Area fill */}
        <View style={styles.areaFill}>
          {points.map((point, index) => (
            <View
              key={index}
              style={[
                styles.areaBar,
                {
                  left: point.x - 2,
                  height: height - 40 - point.y,
                  bottom: 20,
                }
              ]}
            />
          ))}
        </View>
        
        {/* Line and points */}
        {points.map((point, index) => (
          <React.Fragment key={index}>
            {/* Connect line to next point */}
            {index < points.length - 1 && (
              <View
                style={[
                  styles.lineSegment,
                  {
                    left: point.x,
                    top: point.y,
                    width: Math.sqrt(
                      Math.pow(points[index + 1].x - point.x, 2) +
                      Math.pow(points[index + 1].y - point.y, 2)
                    ),
                    transform: [
                      {
                        rotate: `${Math.atan2(
                          points[index + 1].y - point.y,
                          points[index + 1].x - point.x
                        ) * (180 / Math.PI)}deg`,
                      },
                    ],
                  },
                ]}
              />
            )}
            {/* Data point */}
            <View
              style={[
                styles.dataPoint,
                {
                  left: point.x - 5,
                  top: point.y - 5,
                  backgroundColor: data[index].total > 0 ? '#7C3AED' : '#3A3A5E',
                },
              ]}
            />
          </React.Fragment>
        ))}
        
        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map((item, index) => (
            <Text key={index} style={styles.axisLabel}>
              {item.date?.slice(5) || ''}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

// Pie Chart Component for Revenue Distribution
const PieChart = ({ bookings, courses }: { bookings: number; courses: number }) => {
  const total = bookings + courses;
  if (total === 0) return null;
  
  const bookingsPercentage = (bookings / total) * 100;
  const coursesPercentage = (courses / total) * 100;
  
  return (
    <View style={styles.pieContainer}>
      <View style={styles.pieChart}>
        <View style={[styles.pieSlice, styles.pieSliceBookings, { transform: [{ rotate: '0deg' }] }]}>
          <View style={[styles.pieInner, { backgroundColor: '#7C3AED' }]} />
        </View>
        {coursesPercentage > 0 && (
          <View style={[styles.pieSlice, styles.pieSliceCourses, { transform: [{ rotate: `${bookingsPercentage * 3.6}deg` }] }]}>
            <View style={[styles.pieInner, { backgroundColor: '#10B981' }]} />
          </View>
        )}
        <View style={styles.pieCenter}>
          <Text style={styles.pieCenterValue}>${total.toFixed(0)}</Text>
          <Text style={styles.pieCenterLabel}>Total</Text>
        </View>
      </View>
      <View style={styles.pieLegend}>
        <View style={styles.pieLegendItem}>
          <View style={[styles.pieLegendDot, { backgroundColor: '#7C3AED' }]} />
          <Text style={styles.pieLegendText}>Services ({bookingsPercentage.toFixed(0)}%)</Text>
        </View>
        <View style={styles.pieLegendItem}>
          <View style={[styles.pieLegendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.pieLegendText}>Cours ({coursesPercentage.toFixed(0)}%)</Text>
        </View>
      </View>
    </View>
  );
};

// Horizontal Bar Chart for Ratings
const RatingsBarChart = ({ distribution }: { distribution: { [key: number]: number } }) => {
  const { t } = useTranslation();
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <View style={styles.noDataBox}>
        <Ionicons name="star-outline" size={32} color="#5A5A6E" />
        <Text style={styles.noDataText}>{t("analytics.noReviews")}</Text>
      </View>
    );
  }
  
  const colors = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E'];
  
  return (
    <View style={styles.ratingsChart}>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = distribution[rating] || 0;
        const percentage = (count / total) * 100;
        return (
          <View key={rating} style={styles.ratingRow}>
            <View style={styles.ratingStars}>
              <Text style={styles.ratingNumber}>{rating}</Text>
              <Ionicons name="star" size={14} color="#FFD700" />
            </View>
            <View style={styles.ratingBarBg}>
              <LinearGradient
                colors={[colors[rating - 1], colors[rating - 1] + '80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ratingBarFill, { width: `${percentage}%` }]}
              />
            </View>
            <Text style={styles.ratingCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default function ProAnalyticsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [revenueData, setRevenueData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [revenueRes, performanceRes] = await Promise.all([
        proAPI.getRevenueAnalytics(period),
        proAPI.getPerformanceAnalytics()
      ]);
      
      if (revenueRes.data.success) {
        setRevenueData(revenueRes.data.data);
      }
      if (performanceRes.data.success) {
        setPerformanceData(performanceRes.data.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting('csv');
    try {
      const response = await proAPI.exportBookings('csv');
      if (response.data.success && response.data.content) {
        if (Platform.OS === 'web') {
          const blob = new Blob([response.data.content], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = response.data.filename;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const response = await proAPI.exportRevenuePDF(new Date().getFullYear());
      if (response.data && Platform.OS === 'web') {
        // Convert base64 to blob and download
        const byteCharacters = atob(response.data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('PDF Export error:', error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportJSON = async () => {
    setExporting('json');
    try {
      const response = await proAPI.exportRevenue(new Date().getFullYear());
      if (response.data.success && Platform.OS === 'web') {
        const content = JSON.stringify(response.data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `revenue_${response.data.year}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("analytics.title")}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {['7d', '30d', '90d', '1y'].map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
              data-testid={`period-btn-${p}`}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p === '7d' ? '7J' : p === '30d' ? '30J' : p === '90d' ? '3M' : '1A'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Revenue Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardMain]}>
            <LinearGradient
              colors={['#7C3AED', '#5B21B6']}
              style={styles.summaryGradient}
            >
              <Ionicons name="wallet" size={28} color="#FFF" />
              <Text style={styles.summaryValueLarge}>
                ${revenueData?.summary?.total_revenue?.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.summaryLabelLight}>{t("analytics.totalRevenue")}</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.summaryCardSmall}>
            <View style={styles.summaryCard}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <Text style={styles.summaryValue}>
                ${revenueData?.summary?.pending_revenue?.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.summaryLabel}>En attente</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="calendar-outline" size={20} color="#10B981" />
              <Text style={styles.summaryValue}>{revenueData?.summary?.total_bookings || 0}</Text>
              <Text style={styles.summaryLabel}>{t("analytics.bookings")}</Text>
            </View>
          </View>
          
          <View style={styles.summaryCardSmall}>
            <View style={styles.summaryCard}>
              <Ionicons name="cart-outline" size={20} color="#7C3AED" />
              <Text style={styles.summaryValue}>{revenueData?.summary?.total_enrollments || 0}</Text>
              <Text style={styles.summaryLabel}>Ventes</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="hourglass-outline" size={20} color="#8B5CF6" />
              <Text style={styles.summaryValue}>{revenueData?.summary?.pending_offers || 0}</Text>
              <Text style={styles.summaryLabel}>En cours</Text>
            </View>
          </View>
        </View>

        {/* Revenue Line Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("analytics.revenueEvolution")}</Text>
            <View style={styles.chartTypeBadge}>
              <Ionicons name="trending-up" size={14} color="#7C3AED" />
              <Text style={styles.chartTypeBadgeText}>Courbe</Text>
            </View>
          </View>
          <View style={styles.chartCard}>
            <LineChart data={revenueData?.chart_data || []} height={200} />
          </View>
        </View>

        {/* Revenue Distribution Pie Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("analytics.revenueBreakdown")}</Text>
            <View style={styles.chartTypeBadge}>
              <Ionicons name="pie-chart" size={14} color="#10B981" />
              <Text style={styles.chartTypeBadgeText}>Camembert</Text>
            </View>
          </View>
          <View style={styles.chartCard}>
            <PieChart 
              bookings={revenueData?.summary?.bookings_revenue || 0}
              courses={revenueData?.summary?.courses_revenue || 0}
            />
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicateurs de performance</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.metricLabel}>{t("analytics.completion")}</Text>
              </View>
              <Text style={styles.metricValue}>
                {performanceData?.bookings?.completion_rate?.toFixed(0) || 0}%
              </Text>
              <View style={styles.metricBar}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.metricBarFill, { width: `${performanceData?.bookings?.completion_rate || 0}%` }]}
                />
              </View>
            </View>
            
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Ionicons name="flash" size={20} color="#F59E0B" />
                <Text style={styles.metricLabel}>Conversion</Text>
              </View>
              <Text style={styles.metricValue}>
                {performanceData?.conversion?.rate?.toFixed(1) || 0}%
              </Text>
              <View style={styles.metricBar}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.metricBarFill, { width: `${Math.min(performanceData?.conversion?.rate || 0, 100)}%` }]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Ratings Distribution */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Distribution des avis</Text>
            <View style={styles.avgRatingBadge}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.avgRatingText}>
                {performanceData?.reviews?.average_rating?.toFixed(1) || '0.0'}
              </Text>
            </View>
          </View>
          <View style={styles.chartCard}>
            <RatingsBarChart distribution={performanceData?.reviews?.distribution || {}} />
          </View>
        </View>

        {/* Export Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("analytics.exportReports")}</Text>
          <View style={styles.exportGrid}>
            <TouchableOpacity 
              style={styles.exportCard} 
              onPress={handleExportCSV}
              disabled={exporting !== null}
              data-testid="export-csv-btn"
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.exportGradient}
              >
                {exporting === 'csv' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="grid-outline" size={28} color="#FFF" />
                    <Text style={styles.exportTitle}>{t("analytics.bookingsExport")}</Text>
                    <Text style={styles.exportFormat}>CSV</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.exportCard} 
              onPress={handleExportPDF}
              disabled={exporting !== null}
              data-testid="export-pdf-btn"
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.exportGradient}
              >
                {exporting === 'pdf' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={28} color="#FFF" />
                    <Text style={styles.exportTitle}>Rapport Fiscal</Text>
                    <Text style={styles.exportFormat}>PDF</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.exportCard} 
              onPress={handleExportJSON}
              disabled={exporting !== null}
              data-testid="export-json-btn"
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.exportGradient}
              >
                {exporting === 'json' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="code-slash" size={28} color="#FFF" />
                    <Text style={styles.exportTitle}>{t("analytics.rawData")}</Text>
                    <Text style={styles.exportFormat}>JSON</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  loadingContainer: { flex: 1, backgroundColor: '#0D0D1A', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#8B8B9E', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  content: { flex: 1, paddingHorizontal: 16 },
  
  periodSelector: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 12, padding: 4, marginVertical: 16 },
  periodBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  periodBtnActive: { backgroundColor: '#7C3AED' },
  periodBtnText: { fontSize: 14, fontWeight: '700', color: '#8B8B9E' },
  periodBtnTextActive: { color: '#FFF' },
  
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, alignItems: 'center', flex: 1 },
  summaryCardMain: { flex: 1.2, padding: 0, overflow: 'hidden' },
  summaryGradient: { padding: 20, alignItems: 'center', width: '100%', height: '100%', justifyContent: 'center' },
  summaryCardSmall: { flex: 0.8, gap: 12 },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: 8 },
  summaryValueLarge: { fontSize: 28, fontWeight: '800', color: '#FFF', marginTop: 8 },
  summaryLabel: { fontSize: 11, color: '#8B8B9E', marginTop: 4 },
  summaryLabelLight: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  chartTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1A1A2E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chartTypeBadgeText: { fontSize: 11, color: '#8B8B9E', fontWeight: '600' },
  avgRatingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD70020', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  avgRatingText: { fontSize: 14, color: '#FFD700', fontWeight: '700' },
  
  chartCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16 },
  chartContainer: { width: '100%', position: 'relative' },
  yAxisLabels: { position: 'absolute', left: 0, top: 0, bottom: 20, width: 40, justifyContent: 'space-between' },
  axisLabel: { fontSize: 9, color: '#5A5A6E' },
  chartArea: { marginLeft: 45, position: 'relative', height: '100%' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#2A2A4E' },
  areaFill: { position: 'absolute', left: 0, right: 0, bottom: 20 },
  areaBar: { position: 'absolute', width: 4, backgroundColor: '#7C3AED20', borderRadius: 2 },
  lineSegment: { position: 'absolute', height: 2, backgroundColor: '#7C3AED', transformOrigin: 'left center' },
  dataPoint: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#1A1A2E' },
  xAxisLabels: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  
  pieContainer: { alignItems: 'center', paddingVertical: 10 },
  pieChart: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#2A2A4E', position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pieSlice: { position: 'absolute', width: '100%', height: '100%' },
  pieSliceBookings: { backgroundColor: '#7C3AED' },
  pieSliceCourses: { backgroundColor: '#10B981' },
  pieInner: { width: '100%', height: '50%' },
  pieCenter: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  pieCenterValue: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  pieCenterLabel: { fontSize: 10, color: '#8B8B9E' },
  pieLegend: { flexDirection: 'row', gap: 20, marginTop: 16 },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pieLegendDot: { width: 10, height: 10, borderRadius: 5 },
  pieLegendText: { fontSize: 12, color: '#8B8B9E' },
  
  metricsGrid: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metricLabel: { fontSize: 12, color: '#8B8B9E', fontWeight: '600' },
  metricValue: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 12 },
  metricBar: { height: 6, backgroundColor: '#2A2A4E', borderRadius: 3, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 3 },
  
  ratingsChart: { gap: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingStars: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 35 },
  ratingNumber: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  ratingBarBg: { flex: 1, height: 12, backgroundColor: '#2A2A4E', borderRadius: 6, overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 6 },
  ratingCount: { width: 30, fontSize: 12, color: '#8B8B9E', textAlign: 'right', fontWeight: '600' },
  noDataBox: { alignItems: 'center', paddingVertical: 30 },
  noDataText: { fontSize: 13, color: '#5A5A6E', marginTop: 8 },
  
  exportGrid: { flexDirection: 'row', gap: 10 },
  exportCard: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  exportGradient: { padding: 20, alignItems: 'center', minHeight: 110, justifyContent: 'center' },
  exportTitle: { fontSize: 12, fontWeight: '700', color: '#FFF', marginTop: 8, textAlign: 'center' },
  exportFormat: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
