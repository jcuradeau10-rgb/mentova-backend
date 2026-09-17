import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const tr: Record<string, Record<string, string>> = {
  title: { fr: 'VIP Hub', en: 'VIP Hub', es: 'VIP Hub' },
  briefing: { fr: 'Briefing du jour', en: "Today's Briefing", es: 'Briefing del dia' },
  briefingLoading: { fr: 'Generation en cours...', en: 'Generating...', es: 'Generando...' },
  briefingTap: { fr: 'Appuyez pour generer le briefing', en: 'Tap to generate briefing', es: 'Toque para generar el briefing' },
  sentiment: { fr: 'Sentiment', en: 'Sentiment', es: 'Sentimiento' },
  events: { fr: 'Evenements cles', en: 'Key Events', es: 'Eventos clave' },
  opportunity: { fr: 'Opportunite', en: 'Opportunity', es: 'Oportunidad' },
  risk: { fr: 'Risque', en: 'Risk', es: 'Riesgo' },
  features: { fr: 'Vos fonctionnalités VIP', en: 'Your VIP Features', es: 'Tus funciones VIP' },
  memory: { fr: 'Mémoire d\'Atlas', en: 'Caufid Memory', es: 'Memoria de Caufid' },
  memoryDesc: { fr: 'Caufid retient vos informations entre les sessions', en: 'Caufid remembers your info between sessions', es: 'Caufid recuerda tu informacion entre sesiones' },
  chart: { fr: 'Analyse de graphiques', en: 'Chart Analysis', es: 'Analisis de graficos' },
  chartDesc: { fr: 'Envoyez une image dans le chat Caufid', en: 'Send an image in Caufid chat', es: 'Envia una imagen en el chat Caufid' },
  market: { fr: 'Intelligence de marché', en: 'Market Intelligence', es: 'Inteligencia de mercado' },
  marketDesc: { fr: 'Caufid utilise les données et actualités en temps reel', en: 'Caufid uses real-time data and news', es: 'Caufid usa datos y noticias en tiempo real' },
  learning: { fr: 'Apprentissage personnalisé', en: 'Personalized Learning', es: 'Aprendizaje personalizado' },
  learningDesc: { fr: 'Caufid adapté ses explications à votre niveau', en: 'Caufid adapts explanations to your level', es: 'Caufid adapta sus explicaciones a tu nivel' },
  dailyBriefing: { fr: 'Briefing quotidien', en: 'Daily Briefing', es: 'Briefing diario' },
  dailyBriefingDesc: { fr: 'Resume quotidien des marchés', en: 'Daily market summary', es: 'Resumen diario de los mercados' },
  tools: { fr: 'Outils avances', en: 'Advanced Tools', es: 'Herramientas avanzadas' },
  toolsDesc: { fr: 'Rainbow Chart, Halving, alertes, portefeuille', en: 'Rainbow Chart, Halving, alerts, portfolio', es: 'Rainbow Chart, Halving, alertas, portafolio' },
  earlyAccess: { fr: 'Acces anticipé', en: 'Early Access', es: 'Acceso anticipado' },
  earlyAccessDesc: { fr: 'Testez les nouvelles fonctionnalités avant tout le monde', en: 'Test new features before everyone else', es: 'Prueba las nuevas funciones antes que nadie' },
  premiumMsg: { fr: 'Vous avez acces a la meilleure version d\'Atlas', en: 'You have access to the best version of Caufid', es: 'Tienes acceso a la mejor version de Caufid' },
  premiumDesc: { fr: 'Mémoire personnalisée, intelligence de marché, apprentissage adapté à votre niveau, briefing quotidien et analyse de graphiques — Caufid VIP est conçu pour vous accompagner comme un vrai mentor.', en: 'Personalized memory, market intelligence, learning adapted to your level, daily briefing and chart analysis — Caufid VIP is designed to guide you like a real mentor.', es: 'Memoria personalizada, inteligencia de mercado, aprendizaje adaptado a tu nivel, briefing diario y análisis de gráficos — Caufid VIP está diseñado para guiarte como un verdadero mentor.' },
  openAtlas: { fr: 'Ouvrir Caufid', en: 'Open Caufid', es: 'Abrir Caufid' },
  locked: { fr: 'Passez VIP pour debloquer', en: 'Upgrade to VIP to unlock', es: 'Pase a VIP para desbloquear' },
};

function t(key: string, lang: string): string { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

export default function VIPHubScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [perms, setPerms] = useState<any>(null);
  const [briefing, setBriefing] = useState<any>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setPerms).catch(() => {});
  }, [token]);

  const isVip = perms?.is_vip;

  const loadBriefing = async () => {
    if (!isVip || briefingLoading) return;
    setBriefingLoading(true);
    try {
      const res = await fetch(`${API}/api/vip/daily-briefing?lang=${lang}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setBriefing(data.data);
    } catch (e) { console.error(e); }
    finally { setBriefingLoading(false); }
  };

  useEffect(() => { if (isVip) loadBriefing(); }, [isVip]);

  if (!isVip) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
          <Text style={s.headerTitle}>{t('title', lang)}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.lockedWrap}>
          <Ionicons name="lock-closed" size={48} color="#7C3AED" />
          <Text style={s.lockedText}>{t('locked', lang)}</Text>
          <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/vip')}><Ionicons name="diamond" size={16} color="#0A0A1A" /><Text style={s.upgradeBtnText}>VIP</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sentimentColors: Record<string, string> = { bullish: '#10B981', bearish: '#EF4444', neutral: '#F59E0B' };
  const sentimentLabels: Record<string, Record<string, string>> = {
    bullish: { fr: 'Haussier', en: 'Bullish', es: 'Alcista' },
    bearish: { fr: 'Baissier', en: 'Bearish', es: 'Bajista' },
    neutral: { fr: 'Neutre', en: 'Neutral', es: 'Neutral' },
  };

  const VIP_FEATURE_CARDS = [
    { key: 'memory', icon: 'cloud', color: '#7C3AED', action: () => router.push('/(tabs)/learn') },
    { key: 'chart', icon: 'bar-chart', color: '#3B82F6', action: () => router.push('/(tabs)/learn') },
    { key: 'market', icon: 'globe', color: '#10B981', action: () => router.push('/(tabs)/learn') },
    { key: 'learning', icon: 'school', color: '#F59E0B', action: () => router.push('/(tabs)/learn') },
    { key: 'dailyBriefing', icon: 'today', color: '#EF4444', action: loadBriefing },
    { key: 'tools', icon: 'construct', color: '#6366F1', action: () => router.push('/(tabs)/learn') },
    { key: 'earlyAccess', icon: 'rocket', color: '#EC4899', action: () => {} },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.headerTitle}>{t('title', lang)}</Text>
        <View style={s.vipBadge}><Ionicons name="diamond" size={14} color="#FFD700" /></View>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Daily Briefing */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="today" size={20} color="#EF4444" />
            <Text style={s.sectionTitle}>{t('briefing', lang)}</Text>
          </View>
          {briefingLoading ? (
            <View style={s.briefingPlaceholder}><ActivityIndicator color="#7C3AED" /><Text style={s.placeholderText}>{t('briefingLoading', lang)}</Text></View>
          ) : briefing ? (
            <View style={s.briefingCard} data-testid="daily-briefing-card">
              <Text style={s.briefingSummary}>{briefing.market_summary}</Text>
              {briefing.sentiment && (
                <View style={[s.sentimentBadge, { backgroundColor: (sentimentColors[briefing.sentiment] || '#F59E0B') + '20' }]}>
                  <Ionicons name={briefing.sentiment === 'bullish' ? 'trending-up' : briefing.sentiment === 'bearish' ? 'trending-down' : 'remove'} size={14} color={sentimentColors[briefing.sentiment] || '#F59E0B'} />
                  <Text style={[s.sentimentText, { color: sentimentColors[briefing.sentiment] || '#F59E0B' }]}>{sentimentLabels[briefing.sentiment]?.[lang] || briefing.sentiment}</Text>
                </View>
              )}
              {briefing.btc_analysis && <View style={s.briefingItem}><Text style={s.briefingLabel}>Bitcoin</Text><Text style={s.briefingValue}>{briefing.btc_analysis}</Text></View>}
              {briefing.eth_analysis && <View style={s.briefingItem}><Text style={s.briefingLabel}>Ethereum</Text><Text style={s.briefingValue}>{briefing.eth_analysis}</Text></View>}
              {briefing.key_events?.length > 0 && (
                <View style={s.briefingItem}>
                  <Text style={s.briefingLabel}>{t('events', lang)}</Text>
                  {briefing.key_events.map((e: string, i: number) => <Text key={i} style={s.eventItem}>- {e}</Text>)}
                </View>
              )}
              {briefing.opportunity && <View style={s.briefingItem}><Text style={s.briefingLabel}>{t('opportunity', lang)}</Text><Text style={[s.briefingValue, { color: '#10B981' }]}>{briefing.opportunity}</Text></View>}
              {briefing.risk_alert && <View style={s.briefingItem}><Text style={s.briefingLabel}>{t('risk', lang)}</Text><Text style={[s.briefingValue, { color: '#EF4444' }]}>{briefing.risk_alert}</Text></View>}
            </View>
          ) : (
            <TouchableOpacity style={s.briefingPlaceholder} onPress={loadBriefing}><Ionicons name="refresh" size={20} color="#7C3AED" /><Text style={s.placeholderText}>{t('briefingTap', lang)}</Text></TouchableOpacity>
          )}
        </View>

        {/* 6 VIP Feature Cards */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('features', lang)}</Text>
          <View style={s.featureGrid}>
            {VIP_FEATURE_CARDS.map(f => (
              <TouchableOpacity key={f.key} style={s.featureCard} onPress={f.action} data-testid={`vip-hub-${f.key}`}>
                <View style={[s.featureIcon, { backgroundColor: f.color + '15' }]}>
                  <Ionicons name={f.icon as any} size={24} color={f.color} />
                </View>
                <Text style={s.featureTitle}>{t(f.key, lang)}</Text>
                <Text style={s.featureDesc} numberOfLines={2}>{t(`${f.key}Desc`, lang)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Open Caufid CTA */}
        <View style={s.section}>
          {/* Premium Message */}
          <View style={s.premiumCard}>
            <Ionicons name="star" size={24} color="#FFD700" />
            <Text style={s.premiumTitle}>{t('premiumMsg', lang)}</Text>
            <Text style={s.premiumDesc}>{t('premiumDesc', lang)}</Text>
          </View>

          <TouchableOpacity style={s.atlasBtn} onPress={() => router.push('/(tabs)/learn')} data-testid="open-atlas-btn">
            <Ionicons name="planet" size={20} color="#fff" />
            <Text style={s.atlasBtnText}>{t('openAtlas', lang)}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  vipBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  lockedWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  lockedText: { fontSize: 16, color: '#9CA3AF', textAlign: 'center' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFD700', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#0A0A1A' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginBottom: 12 },
  briefingPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111128', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
  placeholderText: { color: '#9CA3AF', fontSize: 13 },
  briefingCard: { backgroundColor: '#111128', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', gap: 12 },
  briefingSummary: { fontSize: 14, color: '#E2E8F0', lineHeight: 22 },
  sentimentBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sentimentText: { fontSize: 12, fontWeight: '700' },
  briefingItem: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 10 },
  briefingLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED', marginBottom: 4 },
  briefingValue: { fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
  eventItem: { fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '47%', backgroundColor: '#111128', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  featureIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 13, fontWeight: '700', color: '#E2E8F0', marginBottom: 4 },
  featureDesc: { fontSize: 11, color: '#6B7280', lineHeight: 15 },
  atlasBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16 },
  atlasBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  premiumCard: { backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)', alignItems: 'center', gap: 10, marginBottom: 16 },
  premiumTitle: { fontSize: 16, fontWeight: '700', color: '#FFD700', textAlign: 'center' },
  premiumDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
});
