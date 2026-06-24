import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

const { width } = Dimensions.get('window');

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { t, loadLanguage, isLoaded: langLoaded } = useTranslation();
  const [activeFeature, setActiveFeature] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.4)).current;
  const btnScale = useRef(new Animated.Value(0)).current;
  const tagFade = useRef(new Animated.Value(0)).current;
  const statAnims = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
  const featAnims = [0, 1, 2, 3].map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => { loadLanguage(); }, []);

  useEffect(() => {
    if (!langLoaded) return;

    // Main entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }),
    ]).start();

    // Tag fade
    Animated.timing(tagFade, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();

    // Logo float
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 0.8, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Staggered stats
    Animated.stagger(120, statAnims.map(a =>
      Animated.spring(a, { toValue: 1, friction: 8, useNativeDriver: true })
    )).start();

    // Staggered features
    Animated.stagger(100, featAnims.map(a =>
      Animated.spring(a, { toValue: 1, friction: 8, delay: 400, useNativeDriver: true })
    )).start();

    // Button
    Animated.spring(btnScale, { toValue: 1, friction: 6, delay: 700, useNativeDriver: true }).start();
  }, [langLoaded]);

  // Auto-rotate features
  useEffect(() => {
    const iv = setInterval(() => setActiveFeature(p => (p + 1) % 4), 3500);
    return () => clearInterval(iv);
  }, []);

  if (!langLoaded) {
    return (
      <View style={s.loading}>
        <LinearGradient colors={['#06060F', '#0A0A1A', '#06060F']} style={StyleSheet.absoluteFill} />
        <View style={s.loadingInner}>
          <Text style={[s.brandLogo, { fontSize: 42 }]}>Mentova<Text style={[s.brandDot, { fontSize: 42 }]}>.</Text></Text>
        </View>
      </View>
    );
  }

  const features = [
    { icon: 'flash', title: t('onboarding.feature1.title'), desc: t('onboarding.feature1.desc'), color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
    { icon: 'analytics', title: t('onboarding.feature2.title'), desc: t('onboarding.feature2.desc'), color: '#00D9A5', bg: 'rgba(0,217,165,0.12)' },
    { icon: 'shield-checkmark', title: t('onboarding.feature3.title'), desc: t('onboarding.feature3.desc'), color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
    { icon: 'people', title: t('onboarding.feature4.title') || 'Community', desc: t('onboarding.feature4.desc') || 'Connect with traders', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  ];

  const stats = [
    { val: '9+', label: t('onboarding.stats.users'), icon: 'cube', color: '#7C3AED' },
    { val: '24/7', label: t('onboarding.stats.volume'), icon: 'pulse', color: '#00D9A5' },
    { val: '3', label: t('onboarding.stats.countries'), icon: 'globe', color: '#06B6D4' },
  ];

  return (
    <View style={s.container} testID="onboarding-screen" data-testid="onboarding-screen">
      {/* Deep Background */}
      <LinearGradient colors={['#06060F', '#0A0A1A', '#08061A', '#06060F']} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />

      {/* Aurora Gradient Background */}
      {Platform.OS === 'web' && (
        <View style={s.auroraContainer}>
          <View style={s.aurora1} />
          <View style={s.aurora2} />
          <View style={s.aurora3} />
        </View>
      )}

      <SafeAreaView style={s.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ═══ HERO ═══ */}
          <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideUp }] }]}>

            {/* Brand with glow */}
            <Animated.View style={[s.logoWrap, { transform: [{ translateY: logoFloat }] }]}>
              {Platform.OS === 'web' && <View style={s.logoGlow} />}
              <Text style={s.brandLogo}>Mentova<Text style={s.brandDot}>.</Text></Text>
            </Animated.View>

            {/* Tag */}
            <Animated.View style={[s.tagWrap, { opacity: tagFade }]}>
              <View style={s.tag}>
                <View style={s.tagDot} />
                <Text style={s.tagText}>LEARN. TRADE. GROW.</Text>
              </View>
            </Animated.View>

            {/* Title */}
            <Text style={s.title} testID="hero-title" data-testid="hero-title">
              {t('onboarding.welcome')}
            </Text>
            <Text style={s.subtitle} testID="hero-subtitle" data-testid="hero-subtitle">
              {t('onboarding.subtitle')}
            </Text>
          </Animated.View>

          {/* ═══ STATS ═══ */}
          <View style={s.statsRow}>
            {stats.map((st, i) => (
              <Animated.View key={i} style={[s.statCard, {
                opacity: statAnims[i],
                transform: [{ scale: statAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              }]}>
                <View style={[s.statIcon, { backgroundColor: `${st.color}18` }]}>
                  <Ionicons name={st.icon as any} size={16} color={st.color} />
                </View>
                <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </Animated.View>
            ))}
          </View>

          {/* ═══ FEATURES ═══ */}
          <View style={s.featGrid}>
            {features.map((f, i) => {
              const isActive = activeFeature === i;
              return (
                <Animated.View key={i} style={[
                  s.featCard,
                  isActive && { backgroundColor: 'transparent' },
                  { opacity: featAnims[i], transform: [{ scale: featAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
                ]}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveFeature(i)}
                    style={s.featInner}
                    testID={`feature-card-${i}`}
                    data-testid={`feature-card-${i}`}
                  >
                    <View style={[s.featIconWrap, { backgroundColor: isActive ? f.bg : 'rgba(255,255,255,0.04)' }]}>
                      <Ionicons name={f.icon as any} size={20} color={isActive ? f.color : 'rgba(255,255,255,0.4)'} />
                    </View>
                    <Text style={[s.featTitle, isActive && { color: f.color }]}>{f.title}</Text>
                    <Text style={s.featDesc} numberOfLines={2}>{f.desc}</Text>
                    {isActive && <View style={[s.featAccent, { backgroundColor: f.color }]} />}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* Progress dots */}
          <View style={s.dots}>
            {features.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => setActiveFeature(i)}>
                <View style={[s.dot, activeFeature === i && { width: 24, backgroundColor: f.color }]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ═══ CTA ═══ */}
          <Animated.View style={[s.ctaSection, { transform: [{ scale: btnScale }] }]}>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => router.push('/register')}
              activeOpacity={0.9}
              testID="get-started-btn"
              data-testid="get-started-btn"
            >
              <LinearGradient colors={['#7C3AED', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryGrad}>
                <Text style={s.primaryText}>{t('onboarding.getStarted')}</Text>
                <View style={s.primaryArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
              testID="login-btn"
              data-testid="login-btn"
            >
              <Text style={s.secondaryText}>{t('onboarding.login')}</Text>
              <Ionicons name="log-in-outline" size={16} color="#A78BFA" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </Animated.View>

          {/* ═══ TRUST ═══ */}
          <View style={s.trustRow}>
            <View style={s.trustItem}>
              <Ionicons name="shield-checkmark" size={14} color="#00D9A5" />
              <Text style={s.trustText}>Bank-Grade Security</Text>
            </View>
            <View style={s.trustDivider} />
            <View style={s.trustItem}>
              <Ionicons name="lock-closed" size={14} color="#00D9A5" />
              <Text style={s.trustText}>256-bit Encryption</Text>
            </View>
          </View>

          {/* ═══ LEGAL ═══ */}
          <View style={s.legal}>
            <TouchableOpacity onPress={() => router.push('/terms')} data-testid="onboarding-terms-link">
              <Text style={s.legalLink}>{t('register.terms')}</Text>
            </TouchableOpacity>
            <Text style={s.legalSep}>·</Text>
            <TouchableOpacity onPress={() => router.push('/privacy')} data-testid="onboarding-privacy-link">
              <Text style={s.legalLink}>{t('register.privacy')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06060F' },

  // Loading
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingInner: { alignItems: 'center' },
  loadingLogo: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  loadingLogoText: { fontSize: 40, fontWeight: '900', color: '#FFF' },
  loadingBrand: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: 12, letterSpacing: -0.5 },

  // Orbs
  orb: { position: 'absolute', borderRadius: 999 },
  orbPurple: {
    width: 350, height: 350, top: -120, right: -100,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web' ? { filter: 'blur(140px)' } : {}),
  },
  orbGreen: {
    width: 280, height: 280, bottom: 100, left: -80,
    backgroundColor: '#00D9A5',
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : {}),
  },

  // Aurora
  auroraContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { pointerEvents: 'none' } : {}),
  },
  aurora1: {
    position: 'absolute', width: 400, height: 400, borderRadius: 999,
    top: -150, left: -100,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web' ? {
      filter: 'blur(120px)', opacity: 0.12,
      animationName: 'auroraMove1',
      animationDuration: '8s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
      animationDirection: 'alternate',
    } : {}),
  },
  aurora2: {
    position: 'absolute', width: 350, height: 350, borderRadius: 999,
    bottom: 100, right: -80,
    backgroundColor: '#00D9A5',
    ...(Platform.OS === 'web' ? {
      filter: 'blur(110px)', opacity: 0.08,
      animationName: 'auroraMove2',
      animationDuration: '10s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
      animationDirection: 'alternate',
    } : {}),
  },
  aurora3: {
    position: 'absolute', width: 300, height: 300, borderRadius: 999,
    top: '40%', left: '30%',
    backgroundColor: '#5B21B6',
    ...(Platform.OS === 'web' ? {
      filter: 'blur(100px)', opacity: 0.06,
      animationName: 'auroraMove3',
      animationDuration: '12s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
      animationDirection: 'alternate',
    } : {}),
  },

  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },

  // ═══ HERO ═══
  hero: { alignItems: 'center', marginTop: 24 },

  logoWrap: { marginBottom: 8, position: 'relative', alignItems: 'center' },
  logoGlow: {
    position: 'absolute',
    width: 200, height: 80, borderRadius: 999,
    top: -10,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web' ? {
      filter: 'blur(50px)',
      animationName: 'glowPulse',
      animationDuration: '3s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
    } : { opacity: 0.3 }),
  },
  brandLogo: {
    fontSize: 48, fontWeight: '900', color: '#FFF', letterSpacing: -2,
    fontStyle: 'italic',
  },
  brandDot: { color: '#A78BFA', fontSize: 48 },

  tagWrap: { marginTop: 10, marginBottom: 24 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,217,165,0.08)',
  },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D9A5', marginRight: 8 },
  tagText: { fontSize: 10, fontWeight: '800', color: '#00D9A5', letterSpacing: 2 },

  title: {
    fontSize: 30, fontWeight: '900', color: '#FFF',
    textAlign: 'center', lineHeight: 38, letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', marginTop: 10, lineHeight: 22, maxWidth: 300,
  },

  // ═══ STATS ═══
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, gap: 8 },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8,
    borderRadius: 20,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statVal: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ═══ FEATURES ═══
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 24, gap: 10 },
  featCard: {
    width: (width - 58) / 2,
    borderRadius: 22,
    overflow: 'hidden',
  },
  featInner: { padding: 18, alignItems: 'center', position: 'relative' },
  featIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  featTitle: { fontSize: 14, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  featDesc: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 16 },
  featAccent: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, borderRadius: 1 },

  // Dots
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },

  // ═══ CTA ═══
  ctaSection: { marginTop: 32, gap: 12 },
  primaryBtn: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  primaryGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, paddingHorizontal: 32,
  },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#FFF', marginRight: 12 },
  primaryArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },

  // ═══ TRUST ═══
  trustRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 28, paddingVertical: 14,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  trustDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 14 },

  // ═══ LEGAL ═══
  legal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingBottom: 16 },
  legalLink: { fontSize: 12, color: '#A78BFA', fontWeight: '500' },
  legalSep: { fontSize: 12, color: 'rgba(255,255,255,0.15)' },
});
