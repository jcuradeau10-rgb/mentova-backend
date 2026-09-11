import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const vipI18n: Record<string, Record<string, string>> = {
  'v.title': { fr: 'Mentova VIP', en: 'Mentova VIP', es: 'Mentova VIP' },
  'v.subtitle': { fr: 'L\'experience Atlas complete', en: 'The complete Atlas experience', es: 'La experiencia Atlas completa' },
  'v.price': { fr: '21,99', en: '21.99', es: '21.99' },
  'v.perMonth': { fr: '$ / mois', en: '$ / month', es: '$ / mes' },
  'v.cta': { fr: 'Devenir VIP', en: 'Become VIP', es: 'Ser VIP' },
  'v.manage': { fr: 'Gerer mon abonnement', en: 'Manage subscription', es: 'Gestionar suscripcion' },
  'v.active': { fr: 'VIP Actif', en: 'VIP Active', es: 'VIP Activo' },
  'v.activeDesc': { fr: 'Profitez de votre experience premium', en: 'Enjoy your premium experience', es: 'Disfruta tu experiencia premium' },
  'v.guarantee': { fr: 'Annulable a tout moment', en: 'Cancel anytime', es: 'Cancela cuando quieras' },
  'v.secure': { fr: 'Paiement securise par Stripe', en: 'Secure payment by Stripe', es: 'Pago seguro con Stripe' },
  'v.loading': { fr: 'Chargement...', en: 'Loading...', es: 'Cargando...' },
  'v.error': { fr: 'Erreur de paiement', en: 'Payment error', es: 'Error de pago' },
  'v.whyTitle': { fr: 'Pourquoi VIP ?', en: 'Why VIP?', es: 'Por que VIP?' },
  'v.whyDesc': { fr: 'Le VIP transforme Atlas en votre mentor personnel. Il se souvient de vous, s\'adapte a votre niveau, et vous accompagne avec des outils et des donnees que les utilisateurs gratuits n\'ont pas.', en: 'VIP transforms Atlas into your personal mentor. It remembers you, adapts to your level, and accompanies you with tools and data that free users don\'t have.', es: 'VIP transforma Atlas en tu mentor personal. Te recuerda, se adapta a tu nivel y te acompana con herramientas y datos que los usuarios gratuitos no tienen.' },
};

const VIP_FEATURES = {
  fr: [
    { icon: 'planet', color: '#7C3AED', title: 'Atlas AI Personnel', desc: 'Un mentor IA qui apprend a vous connaitre et adapte chaque reponse a votre niveau et vos objectifs.' },
    { icon: 'cloud', color: '#3B82F6', title: 'Memoire d\'Atlas', desc: 'Atlas se souvient de vos conversations, vos preferences et votre progression entre chaque session.' },
    { icon: 'bar-chart', color: '#10B981', title: 'Analyse de graphiques', desc: 'Envoyez une image de graphique a Atlas pour une analyse technique detaillee et pedagogique.' },
    { icon: 'today', color: '#F59E0B', title: 'Briefing quotidien', desc: 'Chaque jour, recevez un resume personnalise des evenements importants du marche crypto.' },
    { icon: 'trending-up', color: '#00D9A5', title: 'Donnees crypto en temps reel', desc: 'Atlas utilise les donnees de marche actuelles pour enrichir ses reponses et analyses.' },
    { icon: 'newspaper', color: '#3B82F6', title: 'Actualites en temps reel', desc: 'Atlas integre les dernieres actualites crypto pour contextualiser ses explications.' },
    { icon: 'construct', color: '#EF4444', title: 'Outils professionnels', desc: 'Fear & Greed, Rainbow Chart, Whale Alerts, Halving, et bien plus encore.' },
    { icon: 'school', color: '#8B5CF6', title: 'Apprentissage premium', desc: 'Modules avances, quiz adaptatifs, et parcours personnalise selon votre progression.' },
  ],
  en: [
    { icon: 'planet', color: '#7C3AED', title: 'Personal Atlas AI', desc: 'An AI mentor that learns about you and adapts every response to your level and goals.' },
    { icon: 'cloud', color: '#3B82F6', title: 'Atlas Memory', desc: 'Atlas remembers your conversations, preferences, and progress between sessions.' },
    { icon: 'bar-chart', color: '#10B981', title: 'Chart Analysis', desc: 'Send a chart image to Atlas for detailed technical and educational analysis.' },
    { icon: 'today', color: '#F59E0B', title: 'Daily Briefing', desc: 'Every day, receive a personalized summary of important crypto market events.' },
    { icon: 'trending-up', color: '#00D9A5', title: 'Real-time Crypto Data', desc: 'Atlas uses current market data to enrich its responses and analyses.' },
    { icon: 'newspaper', color: '#3B82F6', title: 'Real-time News', desc: 'Atlas integrates the latest crypto news to contextualize its explanations.' },
    { icon: 'construct', color: '#EF4444', title: 'Professional Tools', desc: 'Fear & Greed, Rainbow Chart, Whale Alerts, Halving, and much more.' },
    { icon: 'school', color: '#8B5CF6', title: 'Premium Learning', desc: 'Advanced modules, adaptive quizzes, and personalized path based on your progress.' },
  ],
  es: [
    { icon: 'planet', color: '#7C3AED', title: 'Atlas AI Personal', desc: 'Un mentor IA que aprende sobre ti y adapta cada respuesta a tu nivel y objetivos.' },
    { icon: 'cloud', color: '#3B82F6', title: 'Memoria de Atlas', desc: 'Atlas recuerda tus conversaciones, preferencias y progreso entre sesiones.' },
    { icon: 'bar-chart', color: '#10B981', title: 'Analisis de graficos', desc: 'Envia una imagen de grafico a Atlas para un analisis tecnico detallado y pedagogico.' },
    { icon: 'today', color: '#F59E0B', title: 'Briefing diario', desc: 'Cada dia, recibe un resumen personalizado de los eventos importantes del mercado crypto.' },
    { icon: 'trending-up', color: '#00D9A5', title: 'Datos crypto en tiempo real', desc: 'Atlas usa datos de mercado actuales para enriquecer sus respuestas y analisis.' },
    { icon: 'newspaper', color: '#3B82F6', title: 'Noticias en tiempo real', desc: 'Atlas integra las ultimas noticias crypto para contextualizar sus explicaciones.' },
    { icon: 'construct', color: '#EF4444', title: 'Herramientas profesionales', desc: 'Fear & Greed, Rainbow Chart, Whale Alerts, Halving y mucho mas.' },
    { icon: 'school', color: '#8B5CF6', title: 'Aprendizaje premium', desc: 'Modulos avanzados, quizzes adaptativos y camino personalizado segun tu progreso.' },
  ],
};

function tv(key: string, lang: string): string {
  return vipI18n[key]?.[lang] || vipI18n[key]?.['en'] || key;
}

export default function VIPPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    if (token) {
      fetch(`${API}/api/vip/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { setPermissions(d); setLoadingPerms(false); })
        .catch(() => setLoadingPerms(false));
    } else {
      setLoadingPerms(false);
    }
  }, [token]);

  const handleCheckout = async () => {
    if (!token) { router.push('/login'); return; }
    setLoading(true);
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
          window.open(data.checkout_url, '_self');
        } else {
          Linking.openURL(data.checkout_url);
        }
      } else {
        throw new Error(data.detail || 'Checkout error');
      }
    } catch (e: any) {
      console.error('Checkout error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    if (!token) return;
    try {
      const origin = Platform.OS === 'web' ? window.location.origin : 'https://app.mentova-academy.com';
      const res = await fetch(`${API}/api/vip/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ return_url: `${origin}/vip` }),
      });
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === 'web') window.open(data.url, '_blank');
        else Linking.openURL(data.url);
      }
    } catch (e) {
      console.error('Portal error:', e);
    }
  };

  const isVip = permissions?.is_vip;
  const features = VIP_FEATURES[lang as keyof typeof VIP_FEATURES] || VIP_FEATURES.fr;

  if (loadingPerms) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.loadingWrap}><ActivityIndicator size="large" color="#7C3AED" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="vip-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="diamond" size={36} color="#FFD700" />
          </View>
          <Text style={s.heroTitle} data-testid="vip-title">{tv('v.title', lang)}</Text>
          <Text style={s.heroSubtitle}>{tv('v.subtitle', lang)}</Text>
        </View>

        {/* VIP Active Badge */}
        {isVip && (
          <View style={s.activeCard} data-testid="vip-active-badge">
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.activeTitle}>{tv('v.active', lang)}</Text>
              <Text style={s.activeDesc}>{tv('v.activeDesc', lang)}</Text>
            </View>
          </View>
        )}

        {/* Why VIP */}
        {!isVip && (
          <View style={s.whyCard}>
            <Text style={s.whyTitle}>{tv('v.whyTitle', lang)}</Text>
            <Text style={s.whyDesc}>{tv('v.whyDesc', lang)}</Text>
          </View>
        )}

        {/* Pricing */}
        {!isVip && (
          <View style={s.priceCard} data-testid="vip-price-card">
            <View style={s.priceRow}>
              <Text style={s.priceAmount}>{tv('v.price', lang)}</Text>
              <Text style={s.pricePeriod}>{tv('v.perMonth', lang)}</Text>
            </View>
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={handleCheckout}
              disabled={loading}
              data-testid="vip-checkout-btn"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="diamond" size={18} color="#0A0A1A" />
                  <Text style={s.ctaText}>{tv('v.cta', lang)}</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={s.guaranteeRow}>
              <Ionicons name="shield-checkmark" size={14} color="#6B7280" />
              <Text style={s.guaranteeText}>{tv('v.secure', lang)}</Text>
            </View>
            <View style={s.guaranteeRow}>
              <Ionicons name="close-circle" size={14} color="#6B7280" />
              <Text style={s.guaranteeText}>{tv('v.guarantee', lang)}</Text>
            </View>
          </View>
        )}

        {/* Features */}
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

        {/* Manage subscription */}
        {isVip && (
          <TouchableOpacity style={s.manageBtn} onPress={handleManage} data-testid="vip-manage-btn">
            <Ionicons name="settings-outline" size={18} color="#7C3AED" />
            <Text style={s.manageBtnText}>{tv('v.manage', lang)}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
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
  guaranteeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  guaranteeText: { fontSize: 12, color: '#6B7280' },

  featuresSection: { paddingHorizontal: 16, gap: 10 },
  featureCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  featureIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  featureCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  featureTitle: { fontSize: 15, fontWeight: '700', color: '#E2E8F0', marginBottom: 4 },
  featureDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },

  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.08)' },
  manageBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
});
