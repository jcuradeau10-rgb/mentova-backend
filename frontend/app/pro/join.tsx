import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const { width } = Dimensions.get('window');

// Expertise domains with icons and descriptions
const EXPERTISE_DOMAINS = [
  { 
    id: 'trading', 
    icon: 'trending-up', 
    color: '#10B981',
    gradient: ['#10B981', '#059669']
  },
  { 
    id: 'defi', 
    icon: 'layers', 
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#7C3AED']
  },
  { 
    id: 'nft', 
    icon: 'images', 
    color: '#EC4899',
    gradient: ['#EC4899', '#DB2777']
  },
  { 
    id: 'blockchain', 
    icon: 'git-network', 
    color: '#3B82F6',
    gradient: ['#3B82F6', '#2563EB']
  },
  { 
    id: 'security', 
    icon: 'shield-checkmark', 
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706']
  },
  { 
    id: 'investment', 
    icon: 'wallet', 
    color: '#06B6D4',
    gradient: ['#06B6D4', '#0891B2']
  },
];

// Benefits for mentors
const MENTOR_BENEFITS = [
  { id: 'revenue', icon: 'cash', color: '#10B981' },
  { id: 'visibility', icon: 'eye', color: '#8B5CF6' },
  { id: 'community', icon: 'people', color: '#3B82F6' },
  { id: 'tools', icon: 'construct', color: '#F59E0B' },
  { id: 'flexibility', icon: 'time', color: '#EC4899' },
  { id: 'growth', icon: 'rocket', color: '#06B6D4' },
];

export default function BecomeMentorScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleApply = () => {
    if (!user) {
      router.push('/login');
    } else if (user.is_professional) {
      router.push('/pro/dashboard');
    } else {
      router.push('/pro/apply');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#0a0a1a', '#1a1a2e', '#16213e', '#0a0a1a']} 
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Decorative elements */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Section */}
          <Animated.View 
            style={[
              styles.heroSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={14} color="#F59E0B" />
              <Text style={styles.badgeText}>{t('becomeMentor.badge')}</Text>
            </View>
            
            <Text style={styles.heroTitle}>{t('becomeMentor.title')}</Text>
            <Text style={styles.heroSubtitle}>{t('becomeMentor.subtitle')}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>500+</Text>
                <Text style={styles.statLabel}>{t('becomeMentor.stats.students')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>50+</Text>
                <Text style={styles.statLabel}>{t('becomeMentor.stats.mentors')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>10+</Text>
                <Text style={styles.statLabel}>{t('becomeMentor.stats.domains')}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Vision Section */}
          <Animated.View 
            style={[
              styles.section,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="eye" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.sectionTitle}>{t('becomeMentor.vision.title')}</Text>
            </View>
            
            <Text style={styles.visionText}>{t('becomeMentor.vision.description')}</Text>
            
            <View style={styles.visionPoints}>
              <View style={styles.visionPoint}>
                <View style={[styles.pointDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.pointText}>{t('becomeMentor.vision.point1')}</Text>
              </View>
              <View style={styles.visionPoint}>
                <View style={[styles.pointDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.pointText}>{t('becomeMentor.vision.point2')}</Text>
              </View>
              <View style={styles.visionPoint}>
                <View style={[styles.pointDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.pointText}>{t('becomeMentor.vision.point3')}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Expertise Domains */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="grid" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.sectionTitle}>{t('becomeMentor.domains.title')}</Text>
            </View>
            
            <Text style={styles.sectionSubtitle}>{t('becomeMentor.domains.subtitle')}</Text>
            
            <View style={styles.domainsGrid}>
              {EXPERTISE_DOMAINS.map((domain, index) => (
                <Animated.View
                  key={domain.id}
                  style={[
                    styles.domainCard,
                    {
                      opacity: fadeAnim,
                      transform: [{
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 50],
                          outputRange: [0, 50 + index * 10]
                        })
                      }]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={domain.gradient}
                    style={styles.domainGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={domain.icon as any} size={28} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.domainName}>{t(`becomeMentor.domains.${domain.id}`)}</Text>
                  <Text style={styles.domainDesc}>{t(`becomeMentor.domains.${domain.id}Desc`)}</Text>
                </Animated.View>
              ))}
            </View>
            
            <View style={styles.moreDomainsHint}>
              <Ionicons name="add-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.moreDomainsText}>{t('becomeMentor.domains.andMore')}</Text>
            </View>
          </View>

          {/* Who We're Looking For */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="search" size={24} color="#10B981" />
              </View>
              <Text style={styles.sectionTitle}>{t('becomeMentor.lookingFor.title')}</Text>
            </View>
            
            <View style={styles.profileTypes}>
              <View style={styles.profileCard}>
                <View style={[styles.profileIcon, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
                  <Ionicons name="school" size={28} color="#7C3AED" />
                </View>
                <Text style={styles.profileTitle}>{t('becomeMentor.lookingFor.educators')}</Text>
                <Text style={styles.profileDesc}>{t('becomeMentor.lookingFor.educatorsDesc')}</Text>
              </View>
              
              <View style={styles.profileCard}>
                <View style={[styles.profileIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="bar-chart" size={28} color="#10B981" />
                </View>
                <Text style={styles.profileTitle}>{t('becomeMentor.lookingFor.traders')}</Text>
                <Text style={styles.profileDesc}>{t('becomeMentor.lookingFor.tradersDesc')}</Text>
              </View>
              
              <View style={styles.profileCard}>
                <View style={[styles.profileIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Ionicons name="code-slash" size={28} color="#F59E0B" />
                </View>
                <Text style={styles.profileTitle}>{t('becomeMentor.lookingFor.developers')}</Text>
                <Text style={styles.profileDesc}>{t('becomeMentor.lookingFor.developersDesc')}</Text>
              </View>
              
              <View style={styles.profileCard}>
                <View style={[styles.profileIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                  <Ionicons name="bulb" size={28} color="#EC4899" />
                </View>
                <Text style={styles.profileTitle}>{t('becomeMentor.lookingFor.experts')}</Text>
                <Text style={styles.profileDesc}>{t('becomeMentor.lookingFor.expertsDesc')}</Text>
              </View>
            </View>
          </View>

          {/* Benefits Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="gift" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>{t('becomeMentor.benefits.title')}</Text>
            </View>
            
            <View style={styles.benefitsGrid}>
              {MENTOR_BENEFITS.map((benefit) => (
                <View key={benefit.id} style={styles.benefitCard}>
                  <View style={[styles.benefitIcon, { backgroundColor: `${benefit.color}20` }]}>
                    <Ionicons name={benefit.icon as any} size={22} color={benefit.color} />
                  </View>
                  <Text style={styles.benefitTitle}>{t(`becomeMentor.benefits.${benefit.id}`)}</Text>
                  <Text style={styles.benefitDesc}>{t(`becomeMentor.benefits.${benefit.id}Desc`)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* How It Works */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <Ionicons name="rocket" size={24} color="#06B6D4" />
              </View>
              <Text style={styles.sectionTitle}>{t('becomeMentor.howItWorks.title')}</Text>
            </View>
            
            <View style={styles.stepsContainer}>
              <View style={styles.stepLine} />
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: '#7C3AED' }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{t('becomeMentor.howItWorks.step1')}</Text>
                  <Text style={styles.stepDesc}>{t('becomeMentor.howItWorks.step1Desc')}</Text>
                </View>
              </View>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{t('becomeMentor.howItWorks.step2')}</Text>
                  <Text style={styles.stepDesc}>{t('becomeMentor.howItWorks.step2Desc')}</Text>
                </View>
              </View>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{t('becomeMentor.howItWorks.step3')}</Text>
                  <Text style={styles.stepDesc}>{t('becomeMentor.howItWorks.step3Desc')}</Text>
                </View>
              </View>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: '#EC4899' }]}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{t('becomeMentor.howItWorks.step4')}</Text>
                  <Text style={styles.stepDesc}>{t('becomeMentor.howItWorks.step4Desc')}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* CTA Section */}
          <View style={styles.ctaSection}>
            <LinearGradient
              colors={['rgba(124, 58, 237, 0.2)', 'rgba(124, 58, 237, 0.05)']}
              style={styles.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="star" size={32} color="#F59E0B" />
              </View>
              <Text style={styles.ctaTitle}>{t('becomeMentor.cta.title')}</Text>
              <Text style={styles.ctaSubtitle}>{t('becomeMentor.cta.subtitle')}</Text>
              
              <TouchableOpacity style={styles.ctaButton} onPress={handleApply}>
                <LinearGradient
                  colors={['#7C3AED', '#6D28D9']}
                  style={styles.ctaButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.ctaButtonText}>
                    {user?.is_professional 
                      ? t('becomeMentor.cta.goDashboard')
                      : t('becomeMentor.cta.applyNow')
                    }
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
              
              <Text style={styles.ctaNote}>{t('becomeMentor.cta.note')}</Text>
            </LinearGradient>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  safeArea: { flex: 1 },
  
  decorCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12 
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  
  // Hero
  heroSection: { 
    alignItems: 'center', 
    paddingTop: 20,
    paddingBottom: 40 
  },
  badge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(245, 158, 11, 0.15)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20,
    gap: 6,
    marginBottom: 20 
  },
  badgeText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#F59E0B' 
  },
  heroTitle: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#FFF', 
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 12 
  },
  heroSubtitle: { 
    fontSize: 16, 
    color: '#9CA3AF', 
    textAlign: 'center', 
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 30 
  },
  statsRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  
  // Sections
  section: { marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    backgroundColor: 'rgba(124, 58, 237, 0.15)', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 14 
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', flex: 1 },
  sectionSubtitle: { fontSize: 15, color: '#9CA3AF', lineHeight: 22, marginBottom: 20 },
  
  // Vision
  visionText: { 
    fontSize: 16, 
    color: '#D1D5DB', 
    lineHeight: 26,
    marginBottom: 20 
  },
  visionPoints: { gap: 12 },
  visionPoint: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointDot: { width: 8, height: 8, borderRadius: 4 },
  pointText: { fontSize: 15, color: '#E5E7EB', flex: 1 },
  
  // Domains Grid
  domainsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  domainCard: { 
    width: (width - 52) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  domainGradient: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  domainName: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 6 },
  domainDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  moreDomainsHint: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  moreDomainsText: { fontSize: 14, color: '#6B7280' },
  
  // Profile Types
  profileTypes: { gap: 12 },
  profileCard: { 
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: 8 },
  profileDesc: { fontSize: 14, color: '#9CA3AF', lineHeight: 20 },
  
  // Benefits Grid
  benefitsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  benefitCard: { 
    width: (width - 52) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 16,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitTitle: { fontSize: 15, fontWeight: '600', color: '#FFF', marginBottom: 6 },
  benefitDesc: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  
  // Steps
  stepsContainer: { position: 'relative', paddingLeft: 24 },
  stepLine: { 
    position: 'absolute', 
    left: 15, 
    top: 20, 
    bottom: 20, 
    width: 2, 
    backgroundColor: 'rgba(255,255,255,0.1)' 
  },
  step: { flexDirection: 'row', marginBottom: 24 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    zIndex: 1,
  },
  stepNumberText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  stepContent: { flex: 1, paddingTop: 4 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 6 },
  stepDesc: { fontSize: 14, color: '#9CA3AF', lineHeight: 20 },
  
  // CTA
  ctaSection: { marginTop: 20 },
  ctaGradient: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  ctaIcon: { marginBottom: 16 },
  ctaTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  ctaSubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 },
  ctaButton: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  ctaButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
  },
  ctaButtonText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  ctaNote: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
});
