import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const isWide = width > 600;

const PILLARS = [
  {
    icon: 'school' as const,
    title: 'Learn',
    desc: 'Structured crypto courses from zero to advanced. Interactive quizzes, progress tracking, and certifications.',
    gradient: ['#3B82F6', '#1D4ED8'] as const,
  },
  {
    icon: 'trending-up' as const,
    title: 'Trade',
    desc: 'AI-powered chart analysis and real-time market insights. GPT-4o turns complex data into clear signals.',
    gradient: ['#10B981', '#059669'] as const,
  },
  {
    icon: 'people' as const,
    title: 'Grow',
    desc: 'Verified mentors, exclusive content, and an active community. Learn from the best, grow together.',
    gradient: ['#8B5CF6', '#6D28D9'] as const,
  },
];

const HIGHLIGHTS = [
  { icon: 'globe-outline' as const, label: '3 Languages', sub: 'FR / EN / ES' },
  { icon: 'flash-outline' as const, label: 'Real-time', sub: 'Live news & prices' },
  { icon: 'shield-checkmark-outline' as const, label: 'Stripe Payments', sub: 'Secure transactions' },
  { icon: 'sparkles-outline' as const, label: 'AI Inside', sub: 'GPT-4o powered' },
];

const FEATURES = [
  { icon: 'diamond' as const, title: 'VIP Hub', desc: 'Premium tools, AI analysis, portfolio tracking, daily briefings', color: '#FFD700' },
  { icon: 'storefront' as const, title: 'Marketplace', desc: 'Verified mentors sell courses, sessions, and exclusive content', color: '#10B981' },
  { icon: 'newspaper' as const, title: 'Live News', desc: 'Real-time crypto news, auto-translated, smart categorization', color: '#EF4444' },
  { icon: 'chatbubbles' as const, title: 'Community', desc: 'Moderated forum, strategy sharing, mentor interactions', color: '#F97316' },
  { icon: 'bar-chart' as const, title: 'AI Charts', desc: 'Upload any chart, get instant AI-powered technical analysis', color: '#8B5CF6' },
  { icon: 'ribbon' as const, title: 'Affiliates', desc: 'Full influencer program with Stripe Connect payouts', color: '#06B6D4' },
];

const TECH = ['React Native', 'Expo', 'FastAPI', 'MongoDB', 'Stripe', 'OpenAI GPT-4o', 'WebSocket', 'i18n'];

export default function WelcomeReview() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pillarAnims = useRef(PILLARS.map(() => new Animated.Value(0))).current;
  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();

    pillarAnims.forEach((anim, i) => {
      Animated.spring(anim, { toValue: 1, friction: 7, tension: 50, delay: 400 + i * 200, useNativeDriver: true }).start();
    });
    featureAnims.forEach((anim, i) => {
      Animated.timing(anim, { toValue: 1, duration: 400, delay: 800 + i * 80, useNativeDriver: true }).start();
    });
  }, []);

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <LinearGradient colors={['#0A0A1A', '#0F0826', '#050510']} style={s.hero}>
            <View style={s.heroBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#10B981" />
              <Text style={s.heroBadgeText}>App Store Review Build</Text>
            </View>

            <View style={s.logoRow}>
              <LinearGradient colors={['#FFD700', '#F59E0B']} style={s.logoBox}>
                <Text style={s.logoLetter}>M</Text>
              </LinearGradient>
            </View>

            <Text style={s.heroTitle}>Welcome to Mentova</Text>
            <View style={s.heroLine} />
            <Text style={s.heroSub}>
              The all-in-one platform to learn, understand,{'\n'}and navigate cryptocurrency — with confidence.
            </Text>

            <View style={s.highlightRow}>
              {HIGHLIGHTS.map(h => (
                <View key={h.label} style={s.highlightItem}>
                  <Ionicons name={h.icon} size={18} color="#FFD700" />
                  <Text style={s.highlightLabel}>{h.label}</Text>
                  <Text style={s.highlightSub}>{h.sub}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Three Pillars ── */}
        <Text style={s.sectionLabel}>OUR VISION</Text>
        <Text style={s.sectionTitle}>Learn. Trade. Grow.</Text>
        <View style={s.pillarRow}>
          {PILLARS.map((p, i) => (
            <Animated.View
              key={p.title}
              style={[
                s.pillarCard,
                {
                  opacity: pillarAnims[i],
                  transform: [{ translateY: pillarAnims[i].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
                },
              ]}
            >
              <LinearGradient colors={p.gradient} style={s.pillarIcon}>
                <Ionicons name={p.icon} size={24} color="#FFF" />
              </LinearGradient>
              <Text style={s.pillarTitle}>{p.title}</Text>
              <Text style={s.pillarDesc}>{p.desc}</Text>
            </Animated.View>
          ))}
        </View>

        {/* ── Why Mentova ── */}
        <View style={s.whyCard}>
          <LinearGradient colors={['#FFD70010', '#FFD70003']} style={s.whyGradient}>
            <View style={s.quoteIcon}>
              <Ionicons name="chatbox-ellipses" size={24} color="#FFD700" />
            </View>
            <Text style={s.whyTitle}>Why we built this</Text>
            <Text style={s.whyText}>
              Crypto education today is fragmented, often misleading, and inaccessible to most. 
              Mentova exists to fix that. We combine AI technology, verified mentors, and a real 
              community into one platform — so anyone can learn crypto the right way.
            </Text>
            <Text style={s.whyText}>
              Every feature is designed with the user in mind. We listen, iterate, and ship — driven 
              by real feedback from real people.
            </Text>
          </LinearGradient>
        </View>

        {/* ── Features Grid ── */}
        <Text style={s.sectionLabel}>PLATFORM</Text>
        <Text style={s.sectionTitle}>What you can explore</Text>
        <View style={s.featGrid}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={f.title}
              style={[
                s.featCard,
                {
                  opacity: featureAnims[i],
                  transform: [{ scale: featureAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
                },
              ]}
            >
              <View style={[s.featDot, { backgroundColor: f.color }]} />
              <View style={s.featContent}>
                <View style={s.featHeader}>
                  <Ionicons name={f.icon} size={18} color={f.color} />
                  <Text style={s.featTitle}>{f.title}</Text>
                </View>
                <Text style={s.featDesc}>{f.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* ── Account Info ── */}
        <View style={s.accountCard}>
          <LinearGradient colors={['#10B98115', '#10B98105']} style={s.accountGradient}>
            <View style={s.accountBadges}>
              <View style={s.badgeVip}>
                <Ionicons name="diamond" size={14} color="#0A0A1A" />
                <Text style={s.badgeVipText}>VIP MEMBER</Text>
              </View>
              <View style={s.badgeMentor}>
                <Ionicons name="school" size={14} color="#0A0A1A" />
                <Text style={s.badgeMentorText}>CERTIFIED MENTOR</Text>
              </View>
            </View>
            <Text style={s.accountTitle}>Your account has full access</Text>
            <Text style={s.accountText}>
              On this account, you are both a VIP member and a certified mentor. This gives you unrestricted access to every feature the platform offers:
            </Text>
            <View style={s.accountFeatures}>
              <View style={s.accountFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={s.accountFeatureText}>Full VIP Academy with 9 training modules and quizzes</Text>
              </View>
              <View style={s.accountFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={s.accountFeatureText}>AI Assistant, interactive charts, and real-time alerts</Text>
              </View>
              <View style={s.accountFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={s.accountFeatureText}>Private VIP community, messaging, and live news</Text>
              </View>
              <View style={s.accountFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={s.accountFeatureText}>Mentor dashboard: create and publish offers, manage catalog</Text>
              </View>
              <View style={s.accountFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={s.accountFeatureText}>Marketplace access: browse and purchase mentor content</Text>
              </View>
            </View>
            <Text style={s.accountNote}>
              This is the complete Mentova experience with zero restrictions. Feel free to explore every section of the app.
            </Text>
          </LinearGradient>
        </View>

        {/* ── Tech Stack ── */}
        <View style={s.techCard}>
          <Text style={s.techLabel}>BUILT WITH</Text>
          <View style={s.techRow}>
            {TECH.map(t => (
              <View key={t} style={s.techBadge}>
                <Text style={s.techText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CTA ── */}
        <Pressable
          style={s.ctaBtn}
          onPress={() => router.replace('/(tabs)')}
          data-testid="welcome-explore-btn"
        >
          <LinearGradient
            colors={['#FFD700', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGradient}
          >
            <Text style={s.ctaText}>Explore Mentova</Text>
            <Ionicons name="arrow-forward" size={20} color="#0A0A1A" />
          </LinearGradient>
        </Pressable>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerMain}>Thank you for your time and consideration.</Text>
          <Text style={s.footerSub}>Built with care by the Mentova team.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050510' },
  scroll: { flex: 1 },
  content: { paddingBottom: 60 },

  // Hero
  hero: { paddingTop: 50, paddingBottom: 32, paddingHorizontal: 20, alignItems: 'center' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B98115', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#10B98130', marginBottom: 24 },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981', letterSpacing: 0.5 },
  logoRow: { marginBottom: 20 },
  logoBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 32, fontWeight: '900', color: '#0A0A1A' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5 },
  heroLine: { width: 40, height: 3, backgroundColor: '#FFD700', borderRadius: 2, marginVertical: 14 },
  heroSub: { fontSize: 14, color: '#9090B0', textAlign: 'center', lineHeight: 22 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 28 },
  highlightItem: { alignItems: 'center', backgroundColor: '#0F0F25', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, minWidth: 80, borderWidth: 1, borderColor: '#1A1A3A' },
  highlightLabel: { fontSize: 11, fontWeight: '700', color: '#E0E0F0', marginTop: 6 },
  highlightSub: { fontSize: 9, color: '#6B6B90', marginTop: 2 },

  // Sections
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#FFD700', letterSpacing: 3, marginHorizontal: 20, marginTop: 36, marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginHorizontal: 20, marginBottom: 18 },

  // Pillars
  pillarRow: { flexDirection: isWide ? 'row' : 'column', paddingHorizontal: 16, gap: 12 },
  pillarCard: { flex: isWide ? 1 : undefined, backgroundColor: '#0B0B1E', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1A1A3A' },
  pillarIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pillarTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  pillarDesc: { fontSize: 13, color: '#8888A8', lineHeight: 20 },

  // Why
  whyCard: { marginHorizontal: 16, marginTop: 28, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFD70020' },
  whyGradient: { padding: 24 },
  quoteIcon: { marginBottom: 12 },
  whyTitle: { fontSize: 18, fontWeight: '700', color: '#FFD700', marginBottom: 12 },
  whyText: { fontSize: 13, color: '#A0A0BC', lineHeight: 21, marginBottom: 10 },

  // Features
  featGrid: { paddingHorizontal: 16, gap: 8 },
  featCard: { flexDirection: 'row', backgroundColor: '#0B0B1E', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1A1A3A', overflow: 'hidden' },
  featDot: { width: 3, borderRadius: 2, marginRight: 12 },
  featContent: { flex: 1 },
  featHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  featTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  featDesc: { fontSize: 12, color: '#7878A0', lineHeight: 17 },

  // Account
  accountCard: { marginHorizontal: 16, marginTop: 28, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#10B98120' },
  accountGradient: { padding: 22, alignItems: 'center' },
  accountBadges: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  badgeVip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeVipText: { fontSize: 11, fontWeight: '800', color: '#0A0A1A', letterSpacing: 0.5 },
  badgeMentor: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeMentorText: { fontSize: 11, fontWeight: '800', color: '#0A0A1A', letterSpacing: 0.5 },
  accountTitle: { fontSize: 17, fontWeight: '700', color: '#10B981', marginBottom: 10 },
  accountText: { fontSize: 13, color: '#A0A0BC', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  accountFeatures: { alignSelf: 'stretch', gap: 8, marginBottom: 12 },
  accountFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  accountFeatureText: { fontSize: 12, color: '#C0C0D0', lineHeight: 18, flex: 1 },
  accountNote: { fontSize: 12, color: '#8888A8', textAlign: 'center', lineHeight: 18, fontStyle: 'italic', marginTop: 4 },

  // Tech
  techCard: { marginHorizontal: 16, marginTop: 20, backgroundColor: '#0B0B1E', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1A1A3A', alignItems: 'center' },
  techLabel: { fontSize: 10, fontWeight: '800', color: '#6B6B90', letterSpacing: 2, marginBottom: 12 },
  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  techBadge: { backgroundColor: '#15152A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#25254A' },
  techText: { fontSize: 11, fontWeight: '600', color: '#9090B0' },

  // CTA
  ctaBtn: { marginHorizontal: 16, marginTop: 28 },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#0A0A1A' },

  // Footer
  footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24, marginBottom: 20 },
  footerMain: { fontSize: 13, color: '#8888A8', fontWeight: '600', textAlign: 'center' },
  footerSub: { fontSize: 12, color: '#5A5A7A', marginTop: 6 },
});
