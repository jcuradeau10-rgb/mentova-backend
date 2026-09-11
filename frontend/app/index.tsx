import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import { useThemeStore } from '../store/themeStore';

const { width } = Dimensions.get('window');

const tr: Record<string, Record<string, string>> = {
  tagline: { en: 'Your AI Crypto Mentor', fr: 'Votre mentor crypto IA', es: 'Tu mentor crypto IA' },
  title1: { en: 'Learn crypto', fr: 'Apprenez la crypto', es: 'Aprende crypto' },
  title2: { en: 'with Atlas AI', fr: 'avec Atlas AI', es: 'con Atlas AI' },
  desc: { en: 'Atlas is your personal AI mentor. It adapts to your level, remembers your progress, and guides you through the world of crypto and finance.', fr: 'Atlas est votre mentor IA personnel. Il s\'adapte a votre niveau, retient votre progression, et vous guide dans le monde de la crypto et de la finance.', es: 'Atlas es tu mentor IA personal. Se adapta a tu nivel, recuerda tu progreso y te guia en el mundo de las crypto y las finanzas.' },
  start: { en: 'Get Started', fr: 'Commencer', es: 'Comenzar' },
  login: { en: 'I have an account', fr: 'J\'ai deja un compte', es: 'Ya tengo una cuenta' },
  f1: { en: 'Personalized Learning', fr: 'Apprentissage personnalise', es: 'Aprendizaje personalizado' },
  f2: { en: 'Chart Analysis', fr: 'Analyse de graphiques', es: 'Analisis de graficos' },
  f3: { en: 'Market Intelligence', fr: 'Intelligence de marche', es: 'Inteligencia de mercado' },
  f4: { en: 'Daily Briefing', fr: 'Briefing quotidien', es: 'Briefing diario' },
};

function t(key: string, lang: string) { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { language, loadLanguage, isLoaded } = useTranslation();
  const { colors: c } = useThemeStore();
  const lang = language || 'en';

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const iconPulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => { loadLanguage(); }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isAuthenticated) { router.replace('/(tabs)/learn'); return; }
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 12, tension: 50, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(iconPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(iconPulse, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
    ])).start();
  }, [isLoaded, isAuthenticated]);

  if (!isLoaded) return <View style={s.container} />;

  const features = [
    { icon: 'school', color: '#F59E0B', text: t('f1', lang) },
    { icon: 'bar-chart', color: '#3B82F6', text: t('f2', lang) },
    { icon: 'globe', color: '#10B981', text: t('f3', lang) },
    { icon: 'today', color: '#EF4444', text: t('f4', lang) },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.inner}>
        {/* Glow bg */}
        <View style={s.glowOrb1} />
        <View style={s.glowOrb2} />

        <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          {/* Atlas Icon */}
          <Animated.View style={[s.iconWrap, { opacity: iconPulse }]}>
            <View style={s.iconCircle}>
              <Ionicons name="planet" size={40} color="#7C3AED" />
            </View>
          </Animated.View>

          {/* Brand */}
          <Text style={s.brand}>Mentova<Text style={s.brandDot}>.</Text></Text>
          <Text style={s.tagline}>{t('tagline', lang)}</Text>

          {/* Title */}
          <Text style={s.title}>{t('title1', lang)}</Text>
          <Text style={s.titleAccent}>{t('title2', lang)}</Text>

          {/* Description */}
          <Text style={s.desc}>{t('desc', lang)}</Text>

          {/* Feature pills */}
          <View style={s.featureRow}>
            {features.map((f, i) => (
              <View key={i} style={s.featurePill}>
                <Ionicons name={f.icon as any} size={14} color={f.color} />
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* CTAs */}
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/register')} testID="onboarding-get-started">
            <Text style={s.primaryBtnText}>{t('start', lang)}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/login')} testID="onboarding-login">
            <Text style={s.secondaryBtnText}>{t('login', lang)}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: undefined },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, maxWidth: 440, alignSelf: 'center', width: '100%', position: 'relative', overflow: 'hidden' },

  glowOrb1: { position: 'absolute', top: -80, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,58,237,0.08)' },
  glowOrb2: { position: 'absolute', bottom: -50, left: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(6,182,212,0.06)' },

  content: { alignItems: 'center', width: '100%' },

  iconWrap: { marginBottom: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },

  brand: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', letterSpacing: -1, marginBottom: 4 },
  brandDot: { color: '#7C3AED' },
  tagline: { fontSize: 13, color: '#64748B', marginBottom: 28, letterSpacing: 0.5 },

  title: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', lineHeight: 38 },
  titleAccent: { fontSize: 32, fontWeight: '800', color: '#7C3AED', textAlign: 'center', lineHeight: 38, marginBottom: 16 },

  desc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 360 },

  featureRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 36 },
  featurePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  featureText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, width: '100%', marginBottom: 12 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
});
