import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const tr: Record<string, Record<string, string>> = {
  title: { fr: 'Mentova VIP', en: 'Mentova VIP', es: 'Mentova VIP' },
  subtitle: { fr: "L'expérience Caufid complète", en: 'The complete Caufid experience', es: 'La experiencia Caufid completa' },
  price: { fr: '21,99', en: '21.99', es: '21.99' },
  perMonth: { fr: '$ USD / mois', en: '$ USD / month', es: '$ USD / mes' },
  cta: { fr: 'Passer à VIP', en: 'Upgrade to VIP', es: 'Pasar a VIP' },
  manage: { fr: 'Gérer mon abonnement', en: 'Manage subscription', es: 'Gestionar suscripción' },
  active: { fr: 'VIP Actif', en: 'VIP Active', es: 'VIP Activo' },
  activeDesc: { fr: 'Votre expérience premium est active', en: 'Your premium experience is active', es: 'Tu experiencia premium está activa' },
  cancel: { fr: 'Annulable à tout moment', en: 'Cancel anytime', es: 'Cancela cuando quieras' },
  secure: { fr: 'Paiement sécurisé par Stripe', en: 'Secure payment by Stripe', es: 'Pago seguro con Stripe' },
  why: { fr: 'Pourquoi VIP ?', en: 'Why VIP?', es: '¿Por qué VIP?' },
  whyDesc: { fr: "Le VIP transforme Caufid en votre mentor personnel. Il se souvient de vous, s'adapte à votre niveau, et vous accompagne avec des outils et des données que les utilisateurs gratuits n'ont pas.", en: "VIP transforms Caufid into your personal mentor. It remembers you, adapts to your level, and accompanies you with tools and data that free users don't have.", es: 'VIP transforma Caufid en tu mentor personal. Te recuerda, se adapta a tu nivel y te acompaña con herramientas y datos que los usuarios gratuitos no tienen.' },
  error: { fr: 'Erreur lors du paiement. Réessayez.', en: 'Payment error. Please try again.', es: 'Error de pago. Inténtalo de nuevo.' },
};

const FEATURES: Record<string, Array<{icon: string; color: string; title: string; desc: string}>> = {
  fr: [
    { icon: 'cloud', color: '#7C3AED', title: 'Mémoire de Caufid', desc: 'Caufid retient vos préférences, votre niveau et vos objectifs. Il devient progressivement votre mentor personnel.' },
    { icon: 'bar-chart', color: '#3B82F6', title: 'Analyse de graphiques', desc: 'Envoyez une image de graphique à Caufid pour une analyse technique adaptée à votre niveau.' },
    { icon: 'globe', color: '#10B981', title: 'Intelligence de marché', desc: 'Caufid utilise les actualités et données de marché en temps réel pour contextualiser ses réponses.' },
    { icon: 'school', color: '#F59E0B', title: 'Apprentissage personnalisé', desc: "Caufid adapte ses explications à votre niveau et évolue avec votre progression." },
    { icon: 'today', color: '#EF4444', title: 'Briefing quotidien', desc: "Chaque jour, un résumé personnalisé des événements importants du marché crypto." },
    { icon: 'rocket', color: '#EC4899', title: 'Accès anticipé', desc: "Soyez les premiers à tester les nouvelles fonctionnalités de Mentova avant tout le monde." },
  ],
  en: [
    { icon: 'cloud', color: '#7C3AED', title: 'Caufid Memory', desc: 'Caufid remembers your preferences, level, and goals. It progressively becomes your personal mentor.' },
    { icon: 'bar-chart', color: '#3B82F6', title: 'Chart Analysis', desc: 'Send a chart image to Caufid for technical analysis adapted to your level.' },
    { icon: 'globe', color: '#10B981', title: 'Market Intelligence', desc: 'Caufid uses real-time news and market data to contextualize its responses.' },
    { icon: 'school', color: '#F59E0B', title: 'Personalized Learning', desc: 'Caufid adapts its explanations to your level and evolves with your progress.' },
    { icon: 'today', color: '#EF4444', title: 'Daily Briefing', desc: 'Every day, a personalized summary of important crypto market events.' },
    { icon: 'rocket', color: '#EC4899', title: 'Early Access', desc: 'Be the first to test new Mentova features before everyone else.' },
  ],
  es: [
    { icon: 'cloud', color: '#7C3AED', title: 'Memoria de Caufid', desc: 'Caufid recuerda tus preferencias, nivel y objetivos. Se convierte progresivamente en tu mentor personal.' },
    { icon: 'bar-chart', color: '#3B82F6', title: 'Análisis de gráficos', desc: 'Envía una imagen de gráfico a Caufid para un análisis técnico adaptado a tu nivel.' },
    { icon: 'globe', color: '#10B981', title: 'Inteligencia de mercado', desc: 'Caufid usa noticias y datos de mercado en tiempo real para contextualizar sus respuestas.' },
    { icon: 'school', color: '#F59E0B', title: 'Aprendizaje personalizado', desc: 'Caufid adapta sus explicaciones a tu nivel y evoluciona con tu progreso.' },
    { icon: 'today', color: '#EF4444', title: 'Briefing diario', desc: 'Cada día, un resumen personalizado de los eventos importantes del mercado crypto.' },
    { icon: 'rocket', color: '#EC4899', title: 'Acceso anticipado', desc: 'Sé el primero en probar las nuevas funciones de Mentova antes que nadie.' },
  ],
};

function t(key: string, lang: string): string {
  return tr[key]?.[lang] || tr[key]?.['en'] || key;
}

export default function VIPPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [loading, setLoading] = useState(false);
  const [perms, setPerms] = useState<any>(null);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { setPerms(d); setLoadingPerms(false); }).catch(() => setLoadingPerms(false));
    } else { setLoadingPerms(false); }
  }, [token]);

  const handleCheckout = async () => {
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    setError('');
    try {
      const origin = Platform.OS === 'web' ? window.location.origin : 'https://app.mentova-academy.com';
      const res = await fetch(`${API}/api/vip/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin_url: origin }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        if (Platform.OS === 'web') {
          window.location.href = data.checkout_url;
        } else {
          await Linking.openURL(data.checkout_url);
        }
      } else {
        setError(data.detail || t('error', lang));
      }
    } catch (e) {
      console.error('Checkout error:', e);
      setError(t('error', lang));
    }
    finally { setLoading(false); }
  };

  const handleManage = async () => {
    try {
      const origin = Platform.OS === 'web' ? window.location.origin : 'https://app.mentova-academy.com';
      const res = await fetch(`${API}/api/vip/portal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ return_url: `${origin}/vip` }),
      });
      const data = await res.json();
      if (data.url) { if (Platform.OS === 'web') window.location.href = data.url; else Linking.openURL(data.url); }
    } catch (e) { console.error(e); }
  };

  const isVip = perms?.is_vip;
  const features = FEATURES[lang] || FEATURES.fr;

  if (loadingPerms) return <SafeAreaView style={s.container} edges={['top']}><View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="vip-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.hero}>
          <View style={s.heroIcon}><Ionicons name="diamond" size={36} color="#FFD700" /></View>
          <Text style={s.heroTitle} data-testid="vip-title">{t('title', lang)}</Text>
          <Text style={s.heroSubtitle}>{t('subtitle', lang)}</Text>
        </View>

        {isVip && (
          <View style={s.activeCard} data-testid="vip-active-badge">
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.activeTitle}>{t('active', lang)}</Text>
              <Text style={s.activeDesc}>{t('activeDesc', lang)}</Text>
            </View>
          </View>
        )}

        {!isVip && (
          <>
            <View style={s.whyCard}>
              <Text style={s.whyTitle}>{t('why', lang)}</Text>
              <Text style={s.whyDesc}>{t('whyDesc', lang)}</Text>
            </View>
            <View style={s.priceCard} data-testid="vip-price-card">
              <View style={s.priceRow}>
                <Text style={s.priceAmount}>{t('price', lang)}</Text>
                <Text style={s.pricePeriod}>{t('perMonth', lang)}</Text>
              </View>
              <TouchableOpacity style={[s.ctaBtn, loading && { opacity: 0.7 }]} onPress={handleCheckout} disabled={loading} data-testid="vip-checkout-btn">
                {loading ? <ActivityIndicator color="#0A0A1A" /> : <><Ionicons name="diamond" size={18} color="#0A0A1A" /><Text style={s.ctaText}>{t('cta', lang)}</Text></>}
              </TouchableOpacity>
              {error ? <Text style={s.errorText}>{error}</Text> : null}
              <View style={s.guaranteeRow}><Ionicons name="shield-checkmark" size={14} color="#6B7280" /><Text style={s.guaranteeText}>{t('secure', lang)}</Text></View>
              <View style={s.guaranteeRow}><Ionicons name="close-circle" size={14} color="#6B7280" /><Text style={s.guaranteeText}>{t('cancel', lang)}</Text></View>
            </View>
          </>
        )}

        <View style={s.featuresSection}>
          {features.map((f, i) => (
            <View key={i} style={s.featureCard} data-testid={`vip-feature-${i}`}>
              <View style={[s.featureIcon, { backgroundColor: f.color + '15' }]}>
                <Ionicons name={f.icon as any} size={24} color={f.color} />
                {isVip && <View style={s.featureCheck}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {isVip && (
          <View style={s.manageSection}>
            <TouchableOpacity style={s.hubBtn} onPress={() => router.push('/vip/hub')} data-testid="vip-hub-btn">
              <Ionicons name="apps" size={18} color="#FFD700" />
              <Text style={s.hubBtnText}>VIP Hub</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.manageBtn} onPress={handleManage} data-testid="vip-manage-btn">
              <Ionicons name="settings-outline" size={18} color="#7C3AED" />
              <Text style={s.manageBtnText}>{t('manage', lang)}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center' },
  hero: { alignItems: 'center', paddingVertical: 32 },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)', marginBottom: 16 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#FFD700', marginBottom: 6 },
  heroSubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', maxWidth: 280 },
  activeCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 20, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  activeTitle: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  activeDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  whyCard: { marginHorizontal: 16, marginBottom: 20, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
  whyTitle: { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  whyDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  priceCard: { marginHorizontal: 16, marginBottom: 24, backgroundColor: '#111128', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', alignItems: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  priceAmount: { fontSize: 44, fontWeight: '800', color: '#FFD700' },
  pricePeriod: { fontSize: 16, color: '#9CA3AF', marginLeft: 6 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFD700', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', marginBottom: 16 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#0A0A1A' },
  errorText: { fontSize: 12, color: '#EF4444', textAlign: 'center', marginBottom: 10 },
  guaranteeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  guaranteeText: { fontSize: 12, color: '#6B7280' },
  featuresSection: { paddingHorizontal: 16, gap: 10 },
  featureCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  featureIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  featureCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  featureTitle: { fontSize: 15, fontWeight: '700', color: '#E2E8F0', marginBottom: 4 },
  featureDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  manageSection: { paddingHorizontal: 16, marginTop: 20, gap: 10 },
  hubBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  hubBtnText: { fontSize: 15, fontWeight: '700', color: '#FFD700' },
  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.08)' },
  manageBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
});
