import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { adminAPI } from '../../utils/api';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SW } = Dimensions.get('window');

type Section = 'overview' | 'engagement' | 'atlas' | 'learning' | 'features' | 'revenue' | 'timeline';

interface IntelData {
  summary: string;
  user_info: any;
  engagement: any;
  atlas: any;
  learning: any;
  feature_usage: any[];
  revenue: any;
  timeline: any[];
}

const PERIODS = [
  { key: 'all', label: 'All Time' },
  { key: '90', label: '90 days' },
  { key: '30', label: '30 days' },
  { key: '7', label: '7 days' },
];

const TIMELINE_FILTERS = ['All', 'session', 'atlas', 'learning', 'feature_use', 'billing'];

function InfoCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <View style={s.infoCard}>
      <View style={[s.infoCardIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={s.infoCardValue}>{String(value ?? 'N/A')}</Text>
      <Text style={s.infoCardLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon as any} size={18} color="#7C3AED" />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <View style={s.dataRow}>
      <Text style={s.dataLabel}>{label}</Text>
      <Text style={s.dataValue}>{String(value ?? 'N/A')}</Text>
    </View>
  );
}

function ScoreBadge({ score, level }: { score: number; level: string }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#3B82F6' : score >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <View style={[s.scoreBadge, { borderColor: color }]}>
      <Text style={[s.scoreNumber, { color }]}>{score}</Text>
      <Text style={s.scoreMax}>/100</Text>
      <Text style={[s.scoreLevel, { color }]}>{level}</Text>
    </View>
  );
}

export default function UserIntelligencePage() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { token, isAdmin } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const resp = await adminAPI.getUserIntelligence(userId, period);
      setData(resp.data?.data || resp.data);
    } catch (e) {
      console.error('Intelligence load error:', e);
    }
    setLoading(false);
  }, [userId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownloadPDF = async () => {
    if (!userId || !token) return;
    setDownloading('pdf');
    try {
      const url = `${API}/api/admin/users/${userId}/intelligence/pdf`;
      if (Platform.OS === 'web') {
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mentova_intelligence_${userId}.pdf`;
        a.click();
      }
    } catch (e) { console.error('PDF download error:', e); }
    setDownloading(null);
  };

  const handleDownloadFullExport = async () => {
    if (!userId || !token) return;
    setDownloading('full');
    try {
      const url = `${API}/api/admin/users/${userId}/full-export`;
      if (Platform.OS === 'web') {
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mentova_full_export_${userId}.json`;
        a.click();
      }
    } catch (e) { console.error('Full export error:', e); }
    setDownloading(null);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={{ color: '#EF4444', textAlign: 'center', marginTop: 80 }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  if (loading || !data) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} testID="intel-back-btn">
            <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
          </TouchableOpacity>
          <Text style={s.topTitle}>User Intelligence</Text>
          <View style={{ width: 22 }} />
        </View>
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const info = data.user_info;
  const eng = data.engagement;
  const atlas = data.atlas;
  const learn = data.learning;
  const rev = data.revenue;

  const filteredTimeline = timelineFilter === 'All'
    ? data.timeline
    : data.timeline.filter(e => e.type === timelineFilter);

  const sections: { key: Section; icon: string; label: string }[] = [
    { key: 'overview', icon: 'person-circle', label: 'Overview' },
    { key: 'engagement', icon: 'pulse', label: 'Engagement' },
    { key: 'atlas', icon: 'planet', label: 'Atlas AI' },
    { key: 'learning', icon: 'school', label: 'Learning' },
    { key: 'features', icon: 'apps', label: 'Features' },
    { key: 'revenue', icon: 'card', label: 'Revenue' },
    { key: 'timeline', icon: 'time', label: 'Timeline' },
  ];

  return (
    <SafeAreaView style={s.container} edges={[]}>
      {/* Top Bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="intel-back-btn">
          <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
        </TouchableOpacity>
        <Text style={s.topTitle}>User Intelligence</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* User Header */}
      <View style={s.userHeader}>
        <View style={[s.avatar, { backgroundColor: info.is_vip ? '#FFD700' : '#7C3AED' }]}>
          <Text style={s.avatarText}>{(info.name || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.userName}>{info.name}</Text>
          <Text style={s.userEmail}>{info.email}</Text>
          <View style={s.badges}>
            <View style={[s.badge, { backgroundColor: info.is_vip ? 'rgba(255,215,0,0.15)' : 'rgba(124,58,237,0.15)' }]}>
              <Text style={[s.badgeText, { color: info.is_vip ? '#FFD700' : '#7C3AED' }]}>{info.is_vip ? 'VIP' : 'FREE'}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Text style={[s.badgeText, { color: '#6366F1' }]}>{info.role}</Text>
            </View>
          </View>
        </View>
        <ScoreBadge score={eng.engagement_score} level={eng.engagement_level} />
      </View>

      {/* Summary */}
      <View style={s.summaryCard}>
        <Ionicons name="analytics" size={16} color="#7C3AED" />
        <Text style={s.summaryText}>{data.summary}</Text>
      </View>

      {/* Period Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodChip, period === p.key && s.periodChipActive]}
            onPress={() => setPeriod(p.key)}
            data-testid={`period-${p.key}`}
          >
            <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Section Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sectionTabs}>
        {sections.map(sec => (
          <TouchableOpacity
            key={sec.key}
            style={[s.sectionTab, activeSection === sec.key && s.sectionTabActive]}
            onPress={() => setActiveSection(sec.key)}
            data-testid={`section-${sec.key}`}
          >
            <Ionicons name={sec.icon as any} size={14} color={activeSection === sec.key ? '#7C3AED' : '#64748B'} />
            <Text style={[s.sectionTabText, activeSection === sec.key && s.sectionTabTextActive]}>{sec.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        {activeSection === 'overview' && (
          <>
            <SectionHeader title="User Information" icon="person" />
            <View style={s.card}>
              <DataRow label="User ID" value={info.user_id} />
              <DataRow label="Name" value={info.name} />
              <DataRow label="Email" value={info.email} />
              <DataRow label="Country" value={info.country} />
              <DataRow label="Language" value={info.language} />
              <DataRow label="Account Created" value={info.created_at?.slice(0, 10)} />
              <DataRow label="Account Age" value={`${info.account_age_days} days`} />
              <DataRow label="Role" value={info.role} />
              <DataRow label="Plan" value={info.is_vip ? 'VIP' : 'Free'} />
              <DataRow label="Last Active" value={info.last_active?.slice(0, 16) || 'Never'} />
              <DataRow label="Banned" value={info.is_banned ? 'Yes' : 'No'} />
            </View>

            <View style={s.statsGrid}>
              <InfoCard label="Sessions" value={eng.total_sessions} icon="layers" color="#7C3AED" />
              <InfoCard label="Time in App" value={eng.total_time_formatted} icon="time" color="#3B82F6" />
              <InfoCard label="Conversations" value={atlas.total_conversations} icon="chatbubbles" color="#10B981" />
              <InfoCard label="Modules" value={learn.modules_started} icon="school" color="#F59E0B" />
            </View>
          </>
        )}

        {activeSection === 'engagement' && (
          <>
            <SectionHeader title="Engagement Analytics" icon="pulse" />
            <View style={s.card}>
              <DataRow label="Total Sessions" value={eng.total_sessions} />
              <DataRow label="Total Time" value={eng.total_time_formatted} />
              <DataRow label="Average Session" value={eng.average_session_formatted} />
              <DataRow label="Active Days" value={eng.active_days} />
              <DataRow label="Days Since Last Activity" value={eng.days_since_last_activity} />
              <DataRow label="First Activity" value={eng.first_activity?.slice(0, 10) || 'N/A'} />
              <DataRow label="Engagement Score" value={`${eng.engagement_score}/100`} />
              <DataRow label="Engagement Level" value={eng.engagement_level} />
            </View>

            <SectionHeader title="Score Breakdown" icon="bar-chart" />
            <View style={s.card}>
              {eng.score_factors && Object.entries(eng.score_factors).map(([k, v]) => (
                <View key={k} style={s.factorRow}>
                  <Text style={s.factorLabel}>{k.replace(/_/g, ' ')}</Text>
                  <View style={s.factorBarBg}>
                    <View style={[s.factorBarFill, { width: `${Math.min(100, (Number(v) / 25) * 100)}%` }]} />
                  </View>
                  <Text style={s.factorValue}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeSection === 'atlas' && (
          <>
            <SectionHeader title="Atlas AI Analytics" icon="planet" />
            <View style={s.statsGrid}>
              <InfoCard label="Conversations" value={atlas.total_conversations} icon="chatbubbles" color="#7C3AED" />
              <InfoCard label="Messages" value={atlas.total_messages} icon="chatbox" color="#3B82F6" />
              <InfoCard label="Avg Msgs/Conv" value={atlas.average_messages_per_conversation} icon="bar-chart" color="#10B981" />
            </View>
            <View style={s.card}>
              <DataRow label="First Interaction" value={atlas.first_interaction?.slice(0, 16) || 'Never'} />
              <DataRow label="Last Interaction" value={atlas.last_interaction?.slice(0, 16) || 'Never'} />
              <DataRow label="VIP Features Used" value={atlas.vip_features_used?.join(', ') || 'None'} />
            </View>
          </>
        )}

        {activeSection === 'learning' && (
          <>
            <SectionHeader title="Learning Progress" icon="school" />
            <View style={s.statsGrid}>
              <InfoCard label="Modules Started" value={learn.modules_started} icon="book" color="#3B82F6" />
              <InfoCard label="Completed" value={learn.modules_completed} icon="checkmark-circle" color="#10B981" />
              <InfoCard label="Completion" value={`${learn.completion_percentage}%`} icon="pie-chart" color="#F59E0B" />
              <InfoCard label="Quizzes" value={learn.quizzes_completed} icon="document-text" color="#EF4444" />
            </View>
            <View style={s.card}>
              <DataRow label="Overall Level" value={learn.overall_level} />
              <DataRow label="Avg Quiz Score" value={`${learn.average_quiz_score}%`} />
              <DataRow label="Best Quiz Score" value={`${learn.best_quiz_score}%`} />
            </View>

            <SectionHeader title="Skills" icon="fitness" />
            <View style={s.card}>
              {learn.skills && Object.entries(learn.skills).map(([k, v]) => (
                <View key={k} style={s.factorRow}>
                  <Text style={s.factorLabel}>{k.replace(/_/g, ' ')}</Text>
                  <View style={s.factorBarBg}>
                    <View style={[s.factorBarFill, { width: `${(Number(v) / 10) * 100}%`, backgroundColor: '#7C3AED' }]} />
                  </View>
                  <Text style={s.factorValue}>{String(v)}/10</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeSection === 'features' && (
          <>
            <SectionHeader title="Feature Usage" icon="apps" />
            {data.feature_usage.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="analytics-outline" size={40} color="#4B5563" />
                <Text style={s.emptyText}>No feature usage data yet</Text>
                <Text style={s.emptySubtext}>Data will appear as the user interacts with features</Text>
              </View>
            ) : (
              data.feature_usage.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <View style={s.featureLeft}>
                    <Ionicons name="cube" size={16} color="#7C3AED" />
                    <Text style={s.featureName}>{f.feature}</Text>
                  </View>
                  <View style={s.featureStats}>
                    <View style={s.featureStat}>
                      <Text style={s.featureStatNum}>{f.total}</Text>
                      <Text style={s.featureStatLabel}>Total</Text>
                    </View>
                    <View style={s.featureStat}>
                      <Text style={s.featureStatNum}>{f.last_7d}</Text>
                      <Text style={s.featureStatLabel}>7d</Text>
                    </View>
                    <View style={s.featureStat}>
                      <Text style={s.featureStatNum}>{f.last_30d}</Text>
                      <Text style={s.featureStatLabel}>30d</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeSection === 'revenue' && (
          <>
            <SectionHeader title="Revenue & Subscription" icon="card" />
            <View style={s.card}>
              <DataRow label="Current Plan" value={rev.current_plan} />
              <DataRow label="Status" value={rev.subscription_status} />
              <DataRow label="Subscription Start" value={rev.subscription_start?.slice(0, 10) || 'N/A'} />
              <DataRow label="Renewal Date" value={rev.renewal_date?.slice(0, 10) || 'N/A'} />
              <DataRow label="Total Payments" value={rev.total_payments} />
              <DataRow label="Total Spent" value={`$${rev.total_spent} ${rev.currency}`} />
              <DataRow label="Last Payment" value={rev.last_payment_amount ? `$${rev.last_payment_amount}` : 'N/A'} />
              <DataRow label="Last Payment Date" value={rev.last_payment_date?.slice(0, 10) || 'N/A'} />
            </View>
          </>
        )}

        {activeSection === 'timeline' && (
          <>
            <SectionHeader title="Activity Timeline" icon="time" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {TIMELINE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.periodChip, timelineFilter === f && s.periodChipActive]}
                  onPress={() => setTimelineFilter(f)}
                >
                  <Text style={[s.periodText, timelineFilter === f && s.periodTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredTimeline.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="time-outline" size={40} color="#4B5563" />
                <Text style={s.emptyText}>No activity recorded</Text>
              </View>
            ) : (
              filteredTimeline.slice(0, 50).map((ev, i) => (
                <View key={i} style={s.timelineItem}>
                  <View style={s.timelineDot} />
                  <View style={s.timelineContent}>
                    <Text style={s.timelineTime}>{ev.timestamp?.slice(0, 16) || ''}</Text>
                    <Text style={s.timelineAction}>{ev.action}</Text>
                    {ev.detail ? <Text style={s.timelineDetail}>{ev.detail}</Text> : null}
                  </View>
                  <View style={[s.timelineTypeBadge, { backgroundColor: ev.type === 'atlas' ? 'rgba(124,58,237,0.15)' : ev.type === 'learning' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)' }]}>
                    <Text style={[s.timelineTypeText, { color: ev.type === 'atlas' ? '#7C3AED' : ev.type === 'learning' ? '#3B82F6' : '#64748B' }]}>{ev.type}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Download Buttons */}
        <View style={s.downloadSection}>
          <TouchableOpacity style={s.downloadBtn} onPress={handleDownloadPDF} disabled={downloading === 'pdf'} testID="download-pdf-btn">
            {downloading === 'pdf' ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="document-text" size={18} color="#FFF" />}
            <Text style={s.downloadBtnText}>Download Intelligence PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.downloadBtn, s.downloadBtnFull]} onPress={handleDownloadFullExport} disabled={downloading === 'full'} testID="download-full-export-btn">
            {downloading === 'full' ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="download" size={18} color="#FFF" />}
            <Text style={s.downloadBtnText}>Download Full User Data (JSON)</Text>
          </TouchableOpacity>
          <Text style={s.downloadDisclaimer}>Full export includes all collected data — for legal/litigation purposes only.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0914' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#E2E8F0' },

  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  avatar: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  userName: { fontSize: 16, fontWeight: '700', color: '#E2E8F0' },
  userEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  scoreBadge: { alignItems: 'center', borderWidth: 2, borderRadius: 14, padding: 10, minWidth: 70 },
  scoreNumber: { fontSize: 22, fontWeight: '800' },
  scoreMax: { fontSize: 10, color: '#64748B', marginTop: -4 },
  scoreLevel: { fontSize: 9, fontWeight: '700', marginTop: 2 },

  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, margin: 12, padding: 14, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
  summaryText: { flex: 1, fontSize: 13, color: '#94A3B8', lineHeight: 20 },

  periodBar: { maxHeight: 44, paddingHorizontal: 12, paddingVertical: 6 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  periodChipActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: '#7C3AED' },
  periodText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  periodTextActive: { color: '#7C3AED' },

  sectionTabs: { maxHeight: 42, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  sectionTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, marginRight: 4, borderRadius: 8 },
  sectionTabActive: { backgroundColor: 'rgba(124,58,237,0.12)' },
  sectionTabText: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  sectionTabTextActive: { color: '#7C3AED', fontWeight: '600' },

  content: { padding: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#E2E8F0' },

  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 14 },

  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  dataLabel: { fontSize: 13, color: '#64748B' },
  dataValue: { fontSize: 13, fontWeight: '600', color: '#E2E8F0', maxWidth: '55%', textAlign: 'right' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  infoCard: { width: (SW - 46) / 2, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  infoCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoCardValue: { fontSize: 18, fontWeight: '800', color: '#E2E8F0' },
  infoCardLabel: { fontSize: 11, color: '#64748B' },

  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  factorLabel: { fontSize: 12, color: '#94A3B8', width: 100, textTransform: 'capitalize' },
  factorBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  factorBarFill: { height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  factorValue: { fontSize: 11, fontWeight: '700', color: '#E2E8F0', width: 36, textAlign: 'right' },

  featureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 8 },
  featureLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureName: { fontSize: 13, fontWeight: '600', color: '#E2E8F0', textTransform: 'capitalize' },
  featureStats: { flexDirection: 'row', gap: 16 },
  featureStat: { alignItems: 'center' },
  featureStatNum: { fontSize: 14, fontWeight: '700', color: '#E2E8F0' },
  featureStatLabel: { fontSize: 9, color: '#64748B' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  emptySubtext: { fontSize: 12, color: '#4B5563' },

  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED', marginTop: 6 },
  timelineContent: { flex: 1 },
  timelineTime: { fontSize: 11, color: '#4B5563', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  timelineAction: { fontSize: 13, fontWeight: '600', color: '#E2E8F0', marginTop: 2 },
  timelineDetail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  timelineTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  timelineTypeText: { fontSize: 10, fontWeight: '600' },

  downloadSection: { marginTop: 24, gap: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 14 },
  downloadBtnFull: { backgroundColor: '#1E40AF' },
  downloadBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  downloadDisclaimer: { fontSize: 11, color: '#4B5563', textAlign: 'center', fontStyle: 'italic' },
});
