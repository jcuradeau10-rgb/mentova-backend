import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: 'school', title: 'VIP Academy', desc: 'Structured courses with quizzes, certificates, and progress tracking — taught by verified mentors.' },
  { icon: 'storefront', title: 'Mentor Marketplace', desc: 'Browse and purchase exclusive content, strategies, and trading guides from certified professionals.' },
  { icon: 'trending-up', title: 'Live Tools', desc: 'Interactive charts, portfolio tracker, price alerts, and AI-powered analysis — all in real time.' },
  { icon: 'people', title: 'Private Community', desc: 'Join a VIP-only social feed. Share ideas, discuss trends, and learn from experienced professionals.' },
  { icon: 'chatbubbles', title: 'Direct Messaging', desc: 'Connect directly with mentors for personalized advice, session bookings, and follow-ups.' },
  { icon: 'ribbon', title: 'Verified Mentors', desc: 'Every mentor is vetted by our team. Minimum 2 years of proven experience required.' },
];

const STATS = [
  { value: '9+', label: 'Courses' },
  { value: '24/7', label: 'Access' },
  { value: '3', label: 'Languages' },
  { value: '100%', label: 'Secure' },
];

export default function LandingPage() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDownload = () => {
    if (Platform.OS === 'web') {
      window.open('https://apps.apple.com/app/mentova', '_blank');
    } else {
      Linking.openURL('https://apps.apple.com/app/mentova');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.badge}>
            <Ionicons name="diamond" size={12} color="#F59E0B" />
            <Text style={styles.badgeText}>Premium Mentor Platform</Text>
          </View>
          <Text style={styles.heroTitle}>Learn From{'\n'}The Best Mentors</Text>
          <Text style={styles.heroSubtitle}>
            Mentova connects you with verified experts. Access exclusive courses, powerful tools, and a private community — all in one app.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={handleDownload} data-testid="landing-download-btn">
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={styles.ctaText}>Download on the App Store</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsRow} data-testid="landing-stats">
          {STATS.map((stat, i) => (
            <View key={i} style={styles.statBox}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Features */}
        <View style={styles.featuresSection} data-testid="landing-features">
          <Text style={styles.sectionTitle}>Everything You Need</Text>
          <Text style={styles.sectionSub}>One app to learn, grow, and succeed with expert guidance</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureCard} data-testid={`feature-card-${i}`}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon as any} size={24} color="#7C3AED" />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.howSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepsContainer}>
            {[
              { step: '1', title: 'Create your account', desc: 'Sign up for free and explore basic features.' },
              { step: '2', title: 'Upgrade to VIP', desc: 'Unlock the academy, tools, community, and marketplace.' },
              { step: '3', title: 'Learn from mentors', desc: 'Follow courses, buy content, and book live sessions.' },
              { step: '4', title: 'Trade with confidence', desc: 'Apply what you learn with real-time tools and alerts.' },
            ].map((item, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNum}>{item.step}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(124,58,237,0.05)']} style={styles.ctaCard}>
            <Text style={styles.ctaSectionTitle}>Ready to Level Up?</Text>
            <Text style={styles.ctaSectionDesc}>
              Join thousands of learners growing with verified mentors on Mentova.
            </Text>
            <TouchableOpacity style={styles.ctaBtn2} onPress={handleDownload} data-testid="landing-cta-bottom">
              <Ionicons name="logo-apple" size={18} color="#fff" />
              <Text style={styles.ctaBtn2Text}>Get Mentova — It's Free</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/support')} data-testid="landing-support-link">
              <Text style={styles.footerLink}>Support</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>&middot;</Text>
            <TouchableOpacity onPress={() => router.push('/terms')} data-testid="landing-terms-link">
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>&middot;</Text>
            <TouchableOpacity onPress={() => router.push('/privacy')} data-testid="landing-privacy-link">
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>&middot;</Text>
            <TouchableOpacity onPress={() => {
              if (Platform.OS === 'web') window.open('mailto:info@mentova-academy.com', '_blank');
              else Linking.openURL('mailto:info@mentova-academy.com');
            }}>
              <Text style={styles.footerLink}>Contact</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerCopy}>&copy; 2026 Mentova Academy — mentova-academy.com</Text>
          <Text style={styles.footerDisclaimer}>
            Trading involves risk. Content is for educational purposes only and does not constitute financial advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 50, paddingBottom: 40, paddingHorizontal: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 20 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  heroTitle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 48, marginBottom: 16, letterSpacing: -1 },
  heroSubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, maxWidth: 380, marginBottom: 30 },
  ctaBtn: { borderRadius: 14, overflow: 'hidden' },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 28 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 24, marginHorizontal: 16, backgroundColor: '#111128', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.1)', marginBottom: 36 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#7C3AED' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  featuresSection: { paddingHorizontal: 16, marginBottom: 36 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  sectionSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 },
  featureGrid: { gap: 12 },
  featureCard: { backgroundColor: '#111128', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  featureIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: '#E5E7EB', marginBottom: 6 },
  featureDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
  howSection: { paddingHorizontal: 16, marginBottom: 36 },
  stepsContainer: { marginTop: 20, gap: 16 },
  stepItem: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: 15, fontWeight: '800', color: '#7C3AED' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#E5E7EB', marginBottom: 4 },
  stepDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  ctaSection: { paddingHorizontal: 16, marginBottom: 36 },
  ctaCard: { borderRadius: 16, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)' },
  ctaSectionTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  ctaSectionDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  ctaBtn2: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  ctaBtn2Text: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  footerLink: { fontSize: 13, color: '#7C3AED', fontWeight: '500' },
  footerDot: { color: '#4B5563' },
  footerCopy: { fontSize: 12, color: '#4B5563', marginBottom: 6 },
  footerDisclaimer: { fontSize: 10, color: '#374151', textAlign: 'center', lineHeight: 14, maxWidth: 320 },
});
