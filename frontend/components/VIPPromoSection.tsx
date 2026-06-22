import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from '../store/languageStore';

const { width } = Dimensions.get('window');

// Types de professionnels avec vrais rôles
const PROFESSIONAL_TYPES = [
  {
    id: 'trader',
    icon: 'trending-up',
    color: '#00D9A5',
    bgColor: 'rgba(0, 217, 165, 0.15)',
    exampleKeys: ['vipPromo.tradingSignals', 'vipPromo.technicalAnalysis'],
  },
  {
    id: 'mentor',
    icon: 'school',
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.15)',
    exampleKeys: ['vipPromo.coaching', 'vipPromo.guidedPath'],
  },
  {
    id: 'analyst',
    icon: 'analytics',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    exampleKeys: ['vipPromo.marketReports', 'vipPromo.predictions'],
  },
  {
    id: 'developer',
    icon: 'code-slash',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    exampleKeys: ['vipPromo.smartContracts', 'vipPromo.smartContracts'],
  },
  {
    id: 'advisor',
    icon: 'briefcase',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    exampleKeys: ['vipPromo.taxAdvice', 'vipPromo.strategy'],
  },
  {
    id: 'security',
    icon: 'shield-checkmark',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    exampleKeys: ['vipPromo.securityAudit', 'vipPromo.protection'],
  },
];

// Vraies fonctionnalités VIP
const VIP_FEATURES = [
  { id: 'ai_plus', icon: 'sparkles', color: '#8B5CF6', titleKey: 'vipPromo.aiPlus', descKey: 'vipPromo.aiDesc' },
  { id: 'pros_access', icon: 'people', color: '#7C3AED', titleKey: 'vipPromo.accessPros', descKey: 'vipPromo.prosDesc' },
  { id: 'exclusive_offers', icon: 'pricetags', color: '#F59E0B', titleKey: 'vipPromo.exclusiveOffers', descKey: 'vipPromo.mentorBundles' },
  { id: 'courses', icon: 'book', color: '#3B82F6', titleKey: 'vipPromo.premiumCourses', descKey: 'vipPromo.courseDesc' },
  { id: 'wallet_tracking', icon: 'wallet', color: '#10B981', titleKey: 'vipPromo.portfolioTracking', descKey: 'vipPromo.walletDesc' },
  { id: 'alerts', icon: 'notifications', color: '#EF4444', titleKey: 'vipPromo.priceAlerts', descKey: 'vipPromo.alertsDesc' },
  { id: 'social', icon: 'chatbubbles', color: '#06B6D4', titleKey: 'vipPromo.communityVIP', descKey: 'vipPromo.exclusiveDiscussions' },
  { id: 'achievements', icon: 'trophy', color: '#FFD700', titleKey: 'vipPromo.gamification', descKey: 'vipPromo.gamificationDesc' },
];

interface VIPPromoSectionProps {
  onPress?: () => void;
}

export default function VIPPromoSection({ onPress }: VIPPromoSectionProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedProIndex, setSelectedProIndex] = useState(0);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const aiGlowAnim = useRef(new Animated.Value(0)).current;
  
  // Individual card animations
  const cardAnims = useRef(
    PROFESSIONAL_TYPES.map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    // Main entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered card animations
    cardAnims.forEach((anim, index) => {
      Animated.sequence([
        Animated.delay(300 + index * 100),
        Animated.parallel([
          Animated.spring(anim.scale, {
            toValue: 1,
            tension: 60,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    // Continuous pulse animation for CTA
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Shimmer animation
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    shimmer.start();

    // AI Glow animation
    const aiGlow = Animated.loop(
      Animated.sequence([
        Animated.timing(aiGlowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(aiGlowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    aiGlow.start();

    // Auto-rotate pros
    const interval = setInterval(() => {
      setSelectedProIndex(prev => (prev + 1) % PROFESSIONAL_TYPES.length);
    }, 3000);

    return () => {
      pulse.stop();
      shimmer.stop();
      aiGlow.stop();
      clearInterval(interval);
    };
  }, []);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/vip');
    }
  };

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const aiGlowOpacity = aiGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {/* Background Gradient */}
      <LinearGradient
        colors={['#1A0A2E', '#2D1B4E', '#1A0A2E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        {/* Shimmer Effect */}
        <Animated.View
          style={[
            styles.shimmer,
            { transform: [{ translateX: shimmerTranslate }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,215,0,0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.diamondWrapper}>
              <Ionicons name="diamond" size={28} color="#FFD700" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>{t('vip.upgrade')}</Text>
              <Text style={styles.sectionSubtitle}>{t('vipPromo.unlockPotential')}</Text>
            </View>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>$6.99</Text>
            <Text style={styles.periodText}>/mois</Text>
          </View>
        </View>

        {/* ========== AI PLUS HERO SECTION ========== */}
        <Animated.View style={[styles.aiHeroSection, { opacity: aiGlowOpacity }]}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.2)', 'rgba(124, 58, 237, 0.1)']}
            style={styles.aiHeroGradient}
          >
            <View style={styles.aiHeroContent}>
              <View style={styles.aiIconWrapper}>
                <Ionicons name="sparkles" size={32} color="#8B5CF6" />
              </View>
              <View style={styles.aiHeroText}>
                <Text style={styles.aiHeroTitle}>IA Plus</Text>
                <Text style={styles.aiHeroDesc}>
                  {t('vipPromo.aiPersonalDesc')}
                </Text>
              </View>
            </View>
            <View style={styles.aiFeatures}>
              <View style={styles.aiFeatureItem}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#8B5CF6" />
                <Text style={styles.aiFeatureText}>{t('vipPromo.unlimitedQuestions')}</Text>
              </View>
              <View style={styles.aiFeatureItem}>
                <Ionicons name="analytics" size={16} color="#8B5CF6" />
                <Text style={styles.aiFeatureText}>{t('vipPromo.realtimeAnalysis')}</Text>
              </View>
              <View style={styles.aiFeatureItem}>
                <Ionicons name="image" size={16} color="#8B5CF6" />
                <Text style={styles.aiFeatureText}>Analyse de graphiques</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ========== PROS HERO SECTION ========== */}
        <View style={styles.prosHeroSection}>
          <View style={styles.prosHeroHeader}>
            <Text style={styles.prosHeroTitle}>{t('vipPromo.accessBestPros')}</Text>
            <Text style={styles.prosHeroSubtitle}>
              {t('vipPromo.verifiedExperts')}
            </Text>
          </View>
          
          {/* Pro Type Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.prosScroll}
          >
            {PROFESSIONAL_TYPES.map((pro, index) => (
              <Animated.View
                key={pro.id}
                style={[
                  styles.proCard,
                  selectedProIndex === index && styles.proCardActive,
                  {
                    opacity: cardAnims[index].opacity,
                    transform: [{ scale: cardAnims[index].scale }],
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setSelectedProIndex(index)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.proIconBg, { backgroundColor: pro.bgColor }]}>
                    <Ionicons name={pro.icon as any} size={28} color={pro.color} />
                  </View>
                  <Text style={styles.proLabel}>{t(`vipPromo.pros.${pro.id}`)}</Text>
                  <View style={styles.proExamples}>
                    {pro.exampleKeys.map((key, i) => (
                      <Text key={i} style={styles.proExampleText}>• {t(key)}</Text>
                    ))}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>

          {/* Pro Stats */}
          <View style={styles.proStatsRow}>
            <View style={styles.proStatItem}>
              <Text style={styles.proStatValue}>50+</Text>
              <Text style={styles.proStatLabel}>{t('vipPromo.verifiedProsLabel')}</Text>
            </View>
            <View style={styles.proStatDivider} />
            <View style={styles.proStatItem}>
              <Text style={styles.proStatValue}>1000+</Text>
              <Text style={styles.proStatLabel}>{t('vipPromo.sessionsGiven')}</Text>
            </View>
            <View style={styles.proStatDivider} />
            <View style={styles.proStatItem}>
              <Text style={styles.proStatValue}>4.9★</Text>
              <Text style={styles.proStatLabel}>{t('vipPromo.averageRating')}</Text>
            </View>
          </View>

          {/* What Pros Offer */}
          <View style={styles.prosOfferGrid}>
            <View style={styles.prosOfferItem}>
              <Ionicons name="videocam" size={20} color="#00D9A5" />
              <Text style={styles.prosOfferText}>{t('vipPromo.liveSessions1on1')}</Text>
            </View>
            <View style={styles.prosOfferItem}>
              <Ionicons name="layers" size={20} color="#F59E0B" />
              <Text style={styles.prosOfferText}>{t('vipPromo.exclusiveBundles')}</Text>
            </View>
            <View style={styles.prosOfferItem}>
              <Ionicons name="school" size={20} color="#7C3AED" />
              <Text style={styles.prosOfferText}>{t('vipPromo.certifiedCourses')}</Text>
            </View>
            <View style={styles.prosOfferItem}>
              <Ionicons name="chatbubbles" size={20} color="#3B82F6" />
              <Text style={styles.prosOfferText}>{t('vipPromo.personalizedQA')}</Text>
            </View>
          </View>
        </View>

        {/* ========== ALL VIP FEATURES ========== */}
        <View style={styles.allFeaturesSection}>
          <Text style={styles.allFeaturesTitle}>{t('vipPromo.allIncluded')}</Text>
          <View style={styles.featuresGrid}>
            {VIP_FEATURES.map((feature) => (
              <View key={feature.id} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                  <Ionicons name={feature.icon as any} size={20} color={feature.color} />
                </View>
                <Text style={styles.featureTitle}>{t(feature.titleKey)}</Text>
                <Text style={styles.featureDesc}>{t(feature.descKey)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ========== TESTIMONIAL ========== */}
        <View style={styles.testimonialSection}>
          <View style={styles.testimonialCard}>
            <View style={styles.testimonialQuote}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.testimonialText}>
              "{t('vipPromo.testimonial')}"
            </Text>
            <View style={styles.testimonialAuthor}>
              <View style={styles.testimonialAvatar}>
                <Text style={styles.testimonialAvatarText}>MD</Text>
              </View>
              <View>
                <Text style={styles.testimonialName}>Marc D.</Text>
                <View style={styles.testimonialStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={12} color="#FFD700" />
                  ))}
                </View>
              </View>
              <View style={styles.testimonialBadge}>
                <Text style={styles.testimonialBadgeText}>{t('vipPromo.vipMember')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ========== CTA BUTTON ========== */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handlePress}
            activeOpacity={0.9}
            data-testid="vip-promo-cta"
          >
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FFD700']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Ionicons name="diamond" size={20} color="#1A0A2E" />
              <Text style={styles.ctaText}>{t('vipPromo.becomeVIPNow')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#1A0A2E" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ========== GUARANTEE ========== */}
        <View style={styles.guaranteeSection}>
          <View style={styles.guaranteeRow}>
            <Ionicons name="shield-checkmark" size={16} color="#00D9A5" />
            <Text style={styles.guaranteeText}>{t('vipPromo.cancelAnytime')}</Text>
          </View>
          <View style={styles.guaranteeRow}>
            <Ionicons name="card" size={16} color="#00D9A5" />
            <Text style={styles.guaranteeText}>{t('vipPromo.securePayment')}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  gradientBg: {
    padding: 20,
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  shimmerGradient: {
    width: 100,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    zIndex: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diamondWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#C4C4C4',
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFD700',
  },
  periodText: {
    fontSize: 11,
    color: '#C4C4C4',
    marginTop: 2,
  },
  
  // AI HERO SECTION
  aiHeroSection: {
    marginBottom: 24,
    zIndex: 2,
  },
  aiHeroGradient: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  aiHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  aiIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHeroText: {
    flex: 1,
  },
  aiHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  aiHeroDesc: {
    fontSize: 12,
    color: '#C4C4C4',
    marginTop: 4,
    lineHeight: 18,
  },
  aiFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  aiFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  aiFeatureText: {
    fontSize: 11,
    color: '#C4C4C4',
    fontWeight: '500',
  },
  
  // PROS HERO SECTION
  prosHeroSection: {
    marginBottom: 20,
    zIndex: 2,
  },
  prosHeroHeader: {
    marginBottom: 16,
  },
  prosHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  prosHeroSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  prosScroll: {
    paddingRight: 20,
    gap: 12,
  },
  proCard: {
    alignItems: 'center',
    width: 100,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  proCardActive: {
    borderColor: 'rgba(255, 215, 0, 0.5)',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  proIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  proLabel: {
    fontSize: 12,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 6,
  },
  proExamples: {
    alignItems: 'flex-start',
  },
  proExampleText: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  proStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  proStatItem: {
    alignItems: 'center',
  },
  proStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFD700',
  },
  proStatLabel: {
    fontSize: 10,
    color: '#8B8B9E',
    marginTop: 2,
  },
  proStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  prosOfferGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prosOfferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    width: '48%',
  },
  prosOfferText: {
    fontSize: 11,
    color: '#E0E0E0',
    fontWeight: '500',
    flex: 1,
  },
  
  // ALL FEATURES SECTION
  allFeaturesSection: {
    marginBottom: 20,
    zIndex: 2,
  },
  allFeaturesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 14,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  featureDesc: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    lineHeight: 14,
  },
  
  // TESTIMONIAL
  testimonialSection: {
    marginBottom: 20,
    zIndex: 2,
  },
  testimonialCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  testimonialQuote: {
    position: 'absolute',
    top: -10,
    left: 16,
    backgroundColor: '#1A0A2E',
    padding: 4,
    borderRadius: 8,
  },
  testimonialText: {
    fontSize: 13,
    color: '#E0E0E0',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  testimonialAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  testimonialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testimonialAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  testimonialName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  testimonialStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  testimonialBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  testimonialBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFD700',
  },
  
  // CTA
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    zIndex: 2,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A0A2E',
    letterSpacing: 0.5,
  },
  
  // GUARANTEE
  guaranteeSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    zIndex: 2,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guaranteeText: {
    fontSize: 11,
    color: '#00D9A5',
    fontWeight: '500',
  },
});
