import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { influencerAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';
import * as Clipboard from 'expo-clipboard';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function InfluencerDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversions' | 'payouts'>('overview');

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, stripeRes] = await Promise.all([
        influencerAPI.getMyStats(),
        influencerAPI.getStripeStatus()
      ]);
      setData(statsRes.data);
      setStripeStatus(stripeRes.data);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.detail || t('affiliate.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const copyLink = async () => {
    if (!data?.influencer?.code) return;
    const link = `${API_URL}/vip?ref=${data.influencer.code}`;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connectStripe = async () => {
    setStripeLoading(true);
    try {
      const returnUrl = `${API_URL}/influencer/dashboard`;
      const res = await influencerAPI.connectStripe(returnUrl);
      if (res.data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = res.data.url;
        } else {
          Linking.openURL(res.data.url);
        }
      } else {
        alert(t('affiliate.stripe.errorLink'));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '';
      if (msg.includes('responsibilities') || msg.includes('platform-profile')) {
        alert(t('affiliate.stripe.adminConfig'));
      } else {
        alert(msg || t('affiliate.stripe.errorGeneric'));
      }
    } finally {
      setStripeLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.container}>
        <FontAwesome5 name="lock" size={48} color="#6B6B80" />
        <Text style={s.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="influencer-error-back-btn">
          <Text style={s.backBtnText}>{t('affiliate.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const { influencer, stats, conversions = [], payouts = [] } = data || {};
  const affiliateLink = `${API_URL}/vip?ref=${influencer?.code}`;

  const stripeConnected = stripeStatus?.payouts_enabled;
  const stripePending = stripeStatus?.connected && stripeStatus?.details_submitted && !stripeStatus?.payouts_enabled;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} data-testid="influencer-back-btn">
          <FontAwesome5 name="arrow-left" size={18} color="#FFF" />
        </Pressable>
        <Text style={s.headerTitle}>{t('affiliate.dashboardTitle')}</Text>
        <View style={{ width: 18 }} />
      </View>

      {/* Affiliate Link */}
      <View style={s.linkCard} data-testid="affiliate-link-card">
        <Text style={s.linkLabel}>{t('affiliate.yourLink')}</Text>
        <View style={s.linkRow}>
          <Text style={s.linkText} numberOfLines={1}>{affiliateLink}</Text>
          <Pressable onPress={copyLink} style={s.copyBtn} data-testid="copy-affiliate-link">
            <FontAwesome5 name={copied ? 'check' : 'copy'} size={14} color="#000" />
            <Text style={s.copyBtnText}>{copied ? t('affiliate.copied') : t('affiliate.copy')}</Text>
          </Pressable>
        </View>
        <Text style={s.codeText}>Code: <Text style={s.codeValue}>{influencer?.code}</Text></Text>
      </View>

      {/* Stats Grid */}
      <View style={s.statsGrid} data-testid="influencer-stats-grid">
        <View style={s.statCard}>
          <FontAwesome5 name="mouse-pointer" size={20} color="#60A5FA" />
          <Text style={s.statValue}>{stats?.clicks || 0}</Text>
          <Text style={s.statLabel}>{t('affiliate.clicks')}</Text>
        </View>
        <View style={s.statCard}>
          <FontAwesome5 name="user-plus" size={20} color="#34D399" />
          <Text style={s.statValue}>{stats?.conversions || 0}</Text>
          <Text style={s.statLabel}>{t('affiliate.conversions')}</Text>
        </View>
        <View style={s.statCard}>
          <FontAwesome5 name="percentage" size={20} color="#FBBF24" />
          <Text style={s.statValue}>{stats?.conversion_rate || 0}%</Text>
          <Text style={s.statLabel}>{t('affiliate.rate')}</Text>
        </View>
        <View style={s.statCard}>
          <FontAwesome5 name="dollar-sign" size={20} color="#FFD700" />
          <Text style={s.statValue}>${stats?.total_commission?.toFixed(2) || '0.00'}</Text>
          <Text style={s.statLabel}>{t('affiliate.totalEarned')}</Text>
        </View>
        <View style={s.statCard}>
          <FontAwesome5 name="clock" size={20} color="#F97316" />
          <Text style={s.statValue}>${stats?.pending_commission?.toFixed(2) || '0.00'}</Text>
          <Text style={s.statLabel}>{t('affiliate.pending')}</Text>
        </View>
        <View style={s.statCard}>
          <FontAwesome5 name="check-circle" size={20} color="#10B981" />
          <Text style={s.statValue}>${stats?.paid_commission?.toFixed(2) || '0.00'}</Text>
          <Text style={s.statLabel}>{t('affiliate.paid')}</Text>
        </View>
      </View>

      {/* Stripe Connect - Enhanced UX */}
      <View style={s.stripeCard} data-testid="stripe-connect-card">
        <View style={s.stripeHeader}>
          <FontAwesome5 name="stripe-s" size={20} color="#635BFF" />
          <Text style={s.stripeTitle}>Stripe Connect</Text>
          <View style={[s.statusDot, { backgroundColor: stripeConnected ? '#10B981' : stripePending ? '#FBBF24' : '#EF4444' }]} />
        </View>

        {stripeConnected ? (
          <View data-testid="stripe-connected-status">
            <View style={s.stripeSuccessRow}>
              <FontAwesome5 name="check-circle" size={16} color="#10B981" />
              <Text style={s.stripeOk}>{t('affiliate.stripe.connected')}</Text>
            </View>
          </View>
        ) : stripePending ? (
          <View data-testid="stripe-pending-status">
            <View style={s.stripeSuccessRow}>
              <FontAwesome5 name="hourglass-half" size={16} color="#FBBF24" />
              <Text style={s.stripePendingText}>{t('affiliate.stripe.pendingVerification')}</Text>
            </View>
            <Text style={s.stripeHint}>{t('affiliate.stripe.pendingHint')}</Text>
          </View>
        ) : (
          <View data-testid="stripe-not-connected">
            {/* Step-by-step instructions */}
            <Text style={s.stripeWarn}>{t('affiliate.stripe.connectDesc')}</Text>
            <View style={s.stepsContainer}>
              <View style={s.stepRow}>
                <View style={s.stepCircle}><Text style={s.stepNum}>1</Text></View>
                <Text style={s.stepText}>{t('affiliate.stripe.step1')}</Text>
              </View>
              <View style={s.stepRow}>
                <View style={s.stepCircle}><Text style={s.stepNum}>2</Text></View>
                <Text style={s.stepText}>{t('affiliate.stripe.step2')}</Text>
              </View>
              <View style={s.stepRow}>
                <View style={s.stepCircle}><Text style={s.stepNum}>3</Text></View>
                <Text style={s.stepText}>{t('affiliate.stripe.step3')}</Text>
              </View>
            </View>
            <Pressable
              onPress={connectStripe}
              style={[s.stripeBtn, stripeLoading && { opacity: 0.6 }]}
              disabled={stripeLoading}
              data-testid="connect-stripe-btn"
            >
              {stripeLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <View style={s.stripeBtnInner}>
                  <FontAwesome5 name="link" size={14} color="#FFF" />
                  <Text style={s.stripeBtnText}>{t('affiliate.stripe.connectBtn')}</Text>
                </View>
              )}
            </Pressable>
            <Text style={s.stripeHint}>{t('affiliate.stripe.secureHint')}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['overview', 'conversions', 'payouts'] as const).map(tab => (
          <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[s.tab, activeTab === tab && s.tabActive]} data-testid={`tab-${tab}`}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'overview' ? t('affiliate.tabOverview') : tab === 'conversions' ? t('affiliate.tabConversions') : t('affiliate.tabPayouts')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'conversions' && (
        <View style={s.listSection} data-testid="conversions-list">
          {conversions.length === 0 ? (
            <Text style={s.emptyText}>{t('affiliate.noConversions')}</Text>
          ) : (
            conversions.map((c: any, i: number) => (
              <View key={c.id || i} style={s.listItem}>
                <View>
                  <Text style={s.itemDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                  <Text style={s.itemSub}>{c.user_email || t('affiliate.user')}</Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={s.itemAmount}>${c.subscription_amount}</Text>
                  <Text style={s.itemCommission}>+${c.commission?.toFixed(2)}</Text>
                  <View style={[s.badge, c.status === 'paid' ? s.badgePaid : s.badgePending]}>
                    <Text style={s.badgeText}>{c.status === 'paid' ? t('affiliate.statusPaid') : t('affiliate.statusPending')}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'payouts' && (
        <View style={s.listSection} data-testid="payouts-list">
          {payouts.length === 0 ? (
            <Text style={s.emptyText}>{t('affiliate.noPayouts')}</Text>
          ) : (
            payouts.map((p: any, i: number) => (
              <View key={p.id || i} style={s.listItem}>
                <View>
                  <Text style={s.itemDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
                  <Text style={s.itemSub}>Stripe Transfer</Text>
                </View>
                <Text style={s.payoutAmount}>${p.amount?.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'overview' && (
        <View style={s.listSection} data-testid="overview-section">
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('affiliate.commission')}</Text>
            <Text style={s.infoValue}>{((influencer?.commission_rate || 0.2) * 100).toFixed(0)}%</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('affiliate.vipPrice')}</Text>
            <Text style={s.infoValue}>$6.99/{t('affiliate.month')}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('affiliate.earnPerConversion')}</Text>
            <Text style={s.infoValue}>${(6.99 * (influencer?.commission_rate || 0.2)).toFixed(2)}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>{t('affiliate.status')}</Text>
            <View style={[s.badge, influencer?.status === 'active' ? s.badgePaid : s.badgePending]}>
              <Text style={s.badgeText}>{influencer?.status === 'active' ? t('affiliate.statusActive') : t('affiliate.statusInactive')}</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', padding: 20 },
  scroll: { flex: 1, backgroundColor: '#050505' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingTop: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  errorText: { color: '#6B6B80', fontSize: 16, marginTop: 12, textAlign: 'center' },
  backBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#1A1A2E', borderRadius: 8 },
  backBtnText: { color: '#FFF', fontWeight: '600' },
  linkCard: { backgroundColor: '#111127', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFD70033' },
  linkLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { flex: 1, color: '#FFF', fontSize: 13, backgroundColor: '#0A0A1A', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  copyBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  codeText: { color: '#6B6B80', fontSize: 12, marginTop: 8 },
  codeValue: { color: '#FFD700', fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '31%', backgroundColor: '#111127', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#6B6B80', fontSize: 11 },
  stripeCard: { backgroundColor: '#111127', borderRadius: 16, padding: 16, marginBottom: 16 },
  stripeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stripeTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  stripeSuccessRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripeOk: { color: '#10B981', fontSize: 14, fontWeight: '600' },
  stripePendingText: { color: '#FBBF24', fontSize: 14, fontWeight: '600' },
  stripeWarn: { color: '#9CA3AF', fontSize: 13, marginBottom: 12 },
  stripeHint: { color: '#6B6B80', fontSize: 11, marginTop: 10, textAlign: 'center' },
  stepsContainer: { marginBottom: 14, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#635BFF33', alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#635BFF', fontSize: 12, fontWeight: '700' },
  stepText: { color: '#D1D5DB', fontSize: 13, flex: 1 },
  stripeBtn: { backgroundColor: '#635BFF', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  stripeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  tabRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#111127', alignItems: 'center' },
  tabActive: { backgroundColor: '#FFD700' },
  tabText: { color: '#6B6B80', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#000' },
  listSection: { backgroundColor: '#111127', borderRadius: 16, padding: 16 },
  emptyText: { color: '#6B6B80', textAlign: 'center', paddingVertical: 20 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  itemDate: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  itemSub: { color: '#6B6B80', fontSize: 12, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemAmount: { color: '#9CA3AF', fontSize: 13 },
  itemCommission: { color: '#10B981', fontSize: 15, fontWeight: '700' },
  payoutAmount: { color: '#FFD700', fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePaid: { backgroundColor: '#10B98122' },
  badgePending: { backgroundColor: '#F9731622' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  infoLabel: { color: '#9CA3AF', fontSize: 14 },
  infoValue: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
