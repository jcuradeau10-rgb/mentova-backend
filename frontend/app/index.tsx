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

const { width, height } = Dimensions.get('window');

// Floating particles data
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size: Math.random() * 4 + 2,
  x: Math.random() * width,
  y: Math.random() * height,
  duration: Math.random() * 3000 + 4000,
  delay: Math.random() * 2000,
}));

// Stats data
const STATS = [
  { value: '9+', labelKey: 'onboarding.stats.users' },
  { value: '24/7', labelKey: 'onboarding.stats.volume' },
  { value: '100%', labelKey: 'onboarding.stats.countries' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { t, loadLanguage, isLoaded: langLoaded } = useTranslation();
  const [activeFeature, setActiveFeature] = useState(0);

  // Main animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideUpAnim = useRef(new Animated.Value(60)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.5)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(100)).current;
  
  // Particle animations
  const particleAnims = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  // Feature animations
  const feature1Anim = useRef(new Animated.Value(0)).current;
  const feature2Anim = useRef(new Animated.Value(0)).current;
  const feature3Anim = useRef(new Animated.Value(0)).current;
  const feature4Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadLanguage();
  }, []);

  // Note: No automatic redirect to tabs - user should always see onboarding page when navigating to /
  // This allows proper logout flow to show onboarding instead of home

  // Entry animations
  useEffect(() => {
    if (langLoaded) {
      // Main entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(slideUpAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();

      // Logo rotation
      Animated.loop(
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        })
      ).start();

      // Glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0.5,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Staggered feature animations
      Animated.stagger(150, [
        Animated.spring(feature1Anim, { toValue: 1, friction: 8, useNativeDriver: true }),
        Animated.spring(feature2Anim, { toValue: 1, friction: 8, useNativeDriver: true }),
        Animated.spring(feature3Anim, { toValue: 1, friction: 8, useNativeDriver: true }),
        Animated.spring(feature4Anim, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();

      // Button entrance
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        delay: 800,
        useNativeDriver: true,
      }).start();

      // Stats slide
      Animated.timing(statsSlide, {
        toValue: 0,
        duration: 1000,
        delay: 600,
        useNativeDriver: true,
      }).start();

      // Particle animations
      particleAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: PARTICLES[index].duration,
              delay: PARTICLES[index].delay,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: PARTICLES[index].duration,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    }
  }, [langLoaded]);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!langLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#000000', '#0a0a1a', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContent}>
          <Animated.View style={[styles.loadingLogo, { transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient
              colors={['#8B5CF6', '#6366F1', '#4F46E5']}
              style={styles.loadingLogoGradient}
            >
              <Text style={styles.loadingLogoText}>M</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={styles.loadingBrand}>Mentova</Text>
        </View>
      </View>
    );
  }

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const features = [
    { icon: 'flash', title: t('onboarding.feature1.title'), desc: t('onboarding.feature1.desc'), color: '#8B5CF6', anim: feature1Anim },
    { icon: 'analytics', title: t('onboarding.feature2.title'), desc: t('onboarding.feature2.desc'), color: '#06B6D4', anim: feature2Anim },
    { icon: 'shield-checkmark', title: t('onboarding.feature3.title'), desc: t('onboarding.feature3.desc'), color: '#10B981', anim: feature3Anim },
    { icon: 'people', title: t('onboarding.feature4.title') || 'Community', desc: t('onboarding.feature4.desc') || 'Connect with traders', color: '#F59E0B', anim: feature4Anim },
  ];

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <LinearGradient
        colors={['#000000', '#0a0a1a', '#0f0a1f', '#000000']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated Gradient Orbs - only on web, native doesn't support blur */}
      {Platform.OS === 'web' && (
        <>
          <Animated.View style={[styles.gradientOrb, styles.orb1, { opacity: glowPulse }]} />
          <Animated.View style={[styles.gradientOrb, styles.orb2, { opacity: glowPulse }]} />
          <Animated.View style={[styles.gradientOrb, styles.orb3, { opacity: Animated.multiply(glowPulse, 0.7) }]} />
        </>
      )}

      {/* Native-friendly animated background elements */}
      {Platform.OS !== 'web' && (
        <>
          {/* Subtle pulsing accent lines */}
          <Animated.View style={[styles.nativeAccent1, { opacity: Animated.multiply(glowPulse, 0.4) }]} />
          <Animated.View style={[styles.nativeAccent2, { opacity: Animated.multiply(glowPulse, 0.3) }]} />
          {/* Twinkling stars */}
          {PARTICLES.slice(0, 8).map((p, i) => (
            <Animated.View
              key={`star-${p.id}`}
              style={{
                position: 'absolute',
                width: p.size * 0.8,
                height: p.size * 0.8,
                borderRadius: p.size,
                backgroundColor: i % 3 === 0 ? '#7C3AED' : i % 3 === 1 ? '#06B6D4' : '#F59E0B',
                left: p.x,
                top: p.y * 0.7,
                opacity: particleAnims[i].interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.05, 0.3, 0.05],
                }),
              }}
            />
          ))}
        </>
      )}

      {/* Floating Particles - web only */}
      {Platform.OS === 'web' && PARTICLES.map((particle, index) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              width: particle.size,
              height: particle.size,
              left: particle.x,
              top: particle.y,
              opacity: particleAnims[index].interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.6, 0],
              }),
              transform: [{
                translateY: particleAnims[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -100],
                }),
              }],
            },
          ]}
        />
      ))}

      {/* Grid Lines Effect - web only */}
      {Platform.OS === 'web' && <View style={styles.gridLines} />}

      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Section */}
          <Animated.View 
            style={[
              styles.heroSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideUpAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            {/* Animated Logo */}
            <View style={styles.logoWrapper}>
              <Animated.View style={[styles.logoRing, { transform: [{ rotate: logoRotation }] }]}>
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1', '#4F46E5', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoRingGradient}
                />
              </Animated.View>
              <View style={styles.logoInner}>
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  style={styles.logoGradient}
                >
                  <Text style={styles.logoText}>M</Text>
                </LinearGradient>
              </View>
              <Animated.View style={[styles.logoGlow, { opacity: glowPulse }]} />
            </View>

            {/* Brand */}
            <Text style={styles.brandName}>Mentova</Text>
            <View style={styles.taglineContainer}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.3)', 'rgba(99, 102, 241, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.taglineBadge}
              >
                <View style={styles.taglineDot} />
                <Text style={styles.taglineText}>Learn. Trade. Grow.</Text>
              </LinearGradient>
            </View>

            {/* Main Title */}
            <Text style={styles.heroTitle}>{t('onboarding.welcome')}</Text>
            <Text style={styles.heroSubtitle}>{t('onboarding.subtitle')}</Text>
          </Animated.View>

          {/* Stats Section */}
          <Animated.View 
            style={[
              styles.statsContainer,
              { transform: [{ translateX: statsSlide }] }
            ]}
          >
            {STATS.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{t(stat.labelKey)}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Features Grid */}
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.featureCard,
                  activeFeature === index && styles.featureCardActive,
                  {
                    opacity: feature.anim,
                    transform: [{
                      scale: feature.anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    }],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setActiveFeature(index)}
                  style={styles.featureCardInner}
                >
                  <View style={[styles.featureIconWrapper, { backgroundColor: `${feature.color}20` }]}>
                    <LinearGradient
                      colors={activeFeature === index ? [feature.color, `${feature.color}CC`] : ['transparent', 'transparent']}
                      style={styles.featureIconGradient}
                    >
                      <Ionicons 
                        name={feature.icon as any} 
                        size={22} 
                        color={activeFeature === index ? '#FFF' : feature.color} 
                      />
                    </LinearGradient>
                  </View>
                  <Text style={[
                    styles.featureTitle,
                    activeFeature === index && { color: feature.color }
                  ]}>
                    {feature.title}
                  </Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Progress Indicators */}
          <View style={styles.progressContainer}>
            {features.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setActiveFeature(index)}
                style={[
                  styles.progressDot,
                  activeFeature === index && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {/* CTA Section */}
          <Animated.View 
            style={[
              styles.ctaSection,
              { transform: [{ scale: buttonScale }] }
            ]}
          >
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/register')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#8B5CF6', '#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>{t('onboarding.getStarted')}</Text>
                <View style={styles.buttonArrow}>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>{t('onboarding.login')}</Text>
              <Ionicons name="log-in-outline" size={18} color="#A78BFA" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </Animated.View>

          {/* Trust Badges */}
          <View style={styles.trustBadges}>
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={styles.trustText}>Bank-Grade Security</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustBadge}>
              <Ionicons name="lock-closed" size={16} color="#10B981" />
              <Text style={styles.trustText}>256-bit Encryption</Text>
            </View>
          </View>

          {/* Legal Links */}
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => router.push('/terms')} data-testid="onboarding-terms-link">
              <Text style={styles.legalLinkText}>{t('register.terms')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>&middot;</Text>
            <TouchableOpacity onPress={() => router.push('/privacy')} data-testid="onboarding-privacy-link">
              <Text style={styles.legalLinkText}>{t('register.privacy')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    width: 100,
    height: 100,
    borderRadius: 30,
    overflow: 'hidden',
  },
  loadingLogoGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFF',
  },
  loadingBrand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    letterSpacing: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Native-friendly background elements
  nativeAccent1: {
    position: 'absolute',
    top: '15%',
    left: -50,
    width: 200,
    height: 1,
    backgroundColor: '#7C3AED',
    transform: [{ rotate: '45deg' }],
  },
  nativeAccent2: {
    position: 'absolute',
    bottom: '25%',
    right: -50,
    width: 180,
    height: 1,
    backgroundColor: '#06B6D4',
    transform: [{ rotate: '-30deg' }],
  },
  // Gradient Orbs
  gradientOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 400,
    height: 400,
    top: -150,
    left: -150,
    backgroundColor: '#8B5CF6',
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)', opacity: 0.2 } : { opacity: 0.05 }),
  },
  orb2: {
    width: 350,
    height: 350,
    bottom: 50,
    right: -150,
    backgroundColor: '#06B6D4',
    ...(Platform.OS === 'web' ? { filter: 'blur(100px)', opacity: 0.15 } : { opacity: 0.04 }),
  },
  orb3: {
    width: 300,
    height: 300,
    top: '45%',
    left: '30%',
    backgroundColor: '#F59E0B',
    ...(Platform.OS === 'web' ? { filter: 'blur(80px)', opacity: 0.1 } : { opacity: 0.03 }),
  },

  // Particles
  particle: {
    position: 'absolute',
    backgroundColor: '#8B5CF6',
    borderRadius: 999,
  },

  // Grid
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    ...(Platform.OS === 'web' ? {
      backgroundImage: `
        linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
        linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px',
    } : {}),
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginTop: 30,
  },
  logoWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 3,
  },
  logoRingGradient: {
    flex: 1,
    borderRadius: 60,
    opacity: 0.5,
  },
  logoInner: {
    width: 90,
    height: 90,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  logoGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#8B5CF6',
    ...(Platform.OS === 'web' ? { filter: 'blur(40px)' } : {}),
    zIndex: -1,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 20,
    letterSpacing: -1,
  },
  taglineContainer: {
    marginTop: 12,
  },
  taglineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  taglineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 10,
  },
  taglineText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 42,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 26,
    maxWidth: 320,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 36,
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Features
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 12,
  },
  featureCard: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  featureCardActive: {
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  featureCardInner: {
    padding: 20,
    alignItems: 'center',
  },
  featureIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  featureIconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    width: 28,
    backgroundColor: '#8B5CF6',
  },

  // CTA
  ctaSection: {
    marginTop: 40,
    gap: 14,
  },
  primaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginRight: 12,
  },
  buttonArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Trust
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  trustDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingBottom: 20,
  },
  legalLinkText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '500',
  },
  legalDot: {
    fontSize: 12,
    color: '#4B5563',
  },
});
