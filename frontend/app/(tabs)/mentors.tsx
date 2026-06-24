import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../store/languageStore';

export default function MentorsScreen() {
  const { t } = useTranslation();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const card0 = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const card3 = useRef(new Animated.Value(0)).current;
  const cardAnims = [card0, card1, card2, card3];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.9, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    Animated.stagger(100, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, friction: 8, delay: 300, useNativeDriver: true })
    )).start();
  }, []);

  const openMentorApplication = () => {
    const url = 'https://mentova-academy.com/fr/mentors';
    if (Platform.OS === 'web') { window.open(url, '_blank'); }
    else { Linking.openURL(url); }
  };

  const features = [
    { icon: 'school', title: t('mentors.feat1_title'), desc: t('mentors.feat1_desc'), color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
    { icon: 'videocam', title: t('mentors.feat2_title'), desc: t('mentors.feat2_desc'), color: '#00D9A5', bg: 'rgba(0,217,165,0.1)' },
    { icon: 'cash', title: t('mentors.feat3_title'), desc: t('mentors.feat3_desc'), color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
    { icon: 'shield-checkmark', title: t('mentors.feat4_title'), desc: t('mentors.feat4_desc'), color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient colors={['#06060F', '#0A0A1A', '#06060F']} style={StyleSheet.absoluteFill} />

      {/* Clean background */}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[s.heroSection, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          <View style={s.statusPill}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>{t('mentors.badge') || 'COMING SOON'}</Text>
          </View>

          <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(0,217,165,0.05)']} style={s.heroCard}>
            <View style={s.heroIconWrap}>
              <LinearGradient colors={['#7C3AED', '#5B21B6']} style={s.heroIcon}>
                <Ionicons name="people" size={36} color="#FFF" />
              </LinearGradient>
            </View>
            <Text style={s.heroTitle}>{t('mentors.title') || 'Mentor Marketplace'}</Text>
            <Text style={s.heroDesc}>{t('mentors.recruiting_desc') || 'Connect with certified crypto mentors for personalized guidance.'}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Section Label */}
        <Text style={s.sectionLabel}>{t('mentors.recruiting') || 'WHAT TO EXPECT'}</Text>

        {/* Feature Cards - 2x2 Grid */}
        <View style={s.featGrid}>
          {features.map((f, i) => (
            <Animated.View key={i} style={[s.featCard, {
              opacity: cardAnims[i],
              transform: [{ scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            }]}>
              <View style={[s.featIconWrap, { backgroundColor: f.bg }]}>
                <Ionicons name={f.icon as any} size={22} color={f.color} />
              </View>
              <Text style={s.featTitle}>{f.title}</Text>
              <Text style={s.featDesc}>{f.desc}</Text>
            </Animated.View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.ctaWrap} onPress={openMentorApplication} activeOpacity={0.85} data-testid="apply-mentor-btn">
          <LinearGradient colors={['#7C3AED', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Ionicons name="rocket" size={20} color="#FFF" />
            <Text style={s.ctaText}>{t('mentors.apply') || 'Apply as a Mentor'}</Text>
            <View style={s.ctaArrow}>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Note */}
        <View style={s.infoCard}>
          <Ionicons name="calendar" size={18} color="#7C3AED" />
          <Text style={s.infoText}>{t('mentors.launch_note') || 'Launching August 2026. Apply now to be a founding mentor.'}</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#06060F' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  // Orbs
  orb: { position: 'absolute', borderRadius: 999 },
  orbPurple: {
    width: 300, height: 300, top: -80, right: -80,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : {}),
  },
  orbCyan: {
    width: 240, height: 240, bottom: 150, left: -60,
    backgroundColor: '#06B6D4',
    ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } : {}),
  },

  // Hero
  heroSection: { alignItems: 'center', marginBottom: 32 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.08)',
    marginBottom: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#F59E0B', letterSpacing: 2, textTransform: 'uppercase' },

  heroCard: {
    width: '100%', borderRadius: 24, padding: 28, alignItems: 'center',
    
  },
  heroIconWrap: { marginBottom: 16 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, maxWidth: 300 },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16,
  },

  // Features grid
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 28 },
  featCard: {
    width: '48%',
    borderRadius: 20, padding: 20,
  },
  featIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  featTitle: { fontSize: 14, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  featDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },

  // CTA
  ctaWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18, paddingHorizontal: 24,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  ctaArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Info card
  infoCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 16, padding: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
});
