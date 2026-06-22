import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Image,
  Animated,
  Easing,
  Dimensions,
  Modal,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { cryptoAPI, newsAPI } from '../../utils/api';
import { 
  AnimatedSection as ImportedAnimatedSection, 
  AnimatedCard as ImportedAnimatedCard, 
  AnimatedButton, 
  PulseAnimation,
  FloatAnimation 
} from '../../components/AnimatedComponents';
import NotificationCenter from '../../components/NotificationCenter';
import VIPPromoSection from '../../components/VIPPromoSection';
import LanguageSelector from '../../components/LanguageSelector';

// Fallback wrapper to prevent undefined errors
const AnimatedSection = ImportedAnimatedSection || (({ children, style }: any) => <View style={style}>{children}</View>);
const AnimatedCard = ImportedAnimatedCard || (({ children, style, onPress }: any) => (
  <TouchableOpacity style={style} onPress={onPress}>{children}</TouchableOpacity>
));

const { width } = Dimensions.get('window');

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  impact: 'bullish' | 'bearish' | 'neutral';
  impact_reason?: string;
  image_url: string;
  published_at: string;
  tags: string[];
  link?: string;
}

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
  badge?: string;
}

const getMenuItems = (t: (key: string) => string): MenuItem[] => [
  {
    id: 'market',
    title: t('home.market'),
    subtitle: t('home.livePrice'),
    icon: 'trending-up',
    color: '#00D9A5',
    bgColor: 'rgba(0, 217, 165, 0.15)',
    route: '/(tabs)/market',
  },
  {
    id: 'learn',
    title: t('home.learn'),
    subtitle: t('home.coursesQuiz'),
    icon: 'school',
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.15)',
    route: '/(tabs)/learn',
  },
  {
    id: 'community',
    title: t('home.community'),
    subtitle: t('home.forumWiki'),
    icon: 'people',
    color: '#FF6B35',
    bgColor: 'rgba(255, 107, 53, 0.15)',
    route: '/(tabs)/community',
  },
  {
    id: 'ai',
    title: t('home.aiAssistant'),
    subtitle: t('home.askQuestions'),
    icon: 'sparkles',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    route: '/(tabs)/ai',
    badge: 'IA',
  },
  {
    id: 'profile',
    title: t('home.myProfile'),
    subtitle: t('home.statsSettings'),
    icon: 'person',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    route: '/(tabs)/profile',
  },
  {
    id: 'admin',
    title: t('home.administration'),
    subtitle: t('home.manageMod'),
    icon: 'shield-checkmark',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    route: '/admin',
  },
];

const QUICK_STATS = [
  { id: 'btc', label: 'Bitcoin', icon: 'logo-bitcoin', color: '#F7931A' },
  { id: 'eth', label: 'Ethereum', icon: 'diamond', color: '#627EEA' },
  { id: 'market', label: 'Cap Totale', icon: 'pie-chart', color: '#00D9A5' },
  { id: 'trend', label: 'Tendance', icon: 'analytics', color: '#7C3AED' },
];

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { t, loadLanguage } = useTranslation();
  const [cryptoPrices, setCryptoPrices] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNewsCategory, setSelectedNewsCategory] = useState<string | null>(null);
  
  // News Modal state
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [bookmarkedNews, setBookmarkedNews] = useState<Set<string>>(new Set());

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  // Load language on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  const fetchData = async () => {
    try {
      const [pricesRes, globalRes, newsRes] = await Promise.all([
        cryptoAPI.getPrices(),
        cryptoAPI.getGlobalStats(),
        newsAPI.getNews({ limit: 10 }),
      ]);
      
      if (pricesRes.data.success) {
        setCryptoPrices(pricesRes.data.data.slice(0, 5));
      }
      if (globalRes.data.success) {
        setGlobalStats(globalRes.data.data);
      }
      if (newsRes.data.success) {
        setNews(newsRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // News interaction functions
  const handleNewsPress = (newsItem: NewsItem) => {
    setSelectedNews(newsItem);
    setShowNewsModal(true);
  };

  const handleOpenLink = async (url: string | undefined) => {
    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error('Cannot open URL:', error);
      }
    }
  };

  const handleShareNews = async (newsItem: NewsItem) => {
    try {
      await Share.share({
        title: newsItem.title,
        message: `${newsItem.title}\n\n${newsItem.summary}\n\nSource: ${newsItem.source}${newsItem.link ? `\n\nLire plus: ${newsItem.link}` : ''}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBookmarkNews = (newsId: string) => {
    setBookmarkedNews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(newsId)) {
        newSet.delete(newsId);
      } else {
        newSet.add(newsId);
      }
      return newSet;
    });
  };

  const getCategoryLabel = (category: string): string => {
    const labels: { [key: string]: string } = {
      macro: t('home.macroeconomics'),
      institutionnel: t('home.institutional'),
      technologie: t('home.technology'),
      regulation: t('home.regulation'),
      securite: t('home.security'),
      adoption: t('home.adoption'),
      analyse: t('home.analysis'),
      general: t('home.general'),
    };
    return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      macro: '#3B82F6',
      institutionnel: '#7C3AED',
      technologie: '#00D9A5',
      regulation: '#F59E0B',
      securite: '#EF4444',
      adoption: '#10B981',
      analyse: '#8B5CF6',
      general: '#8B8B9E',
    };
    return colors[category] || '#8B8B9E';
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatPrice = (num: number) => {
    if (num >= 1000) return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `$${num.toFixed(2)}`;
  };

  const getProgressPercentage = () => {
    const completed = user?.progress?.modules_completed?.length || 0;
    const total = 12;
    const percentage = Math.round((completed / total) * 100);
    return Math.min(percentage, 100); // Cap at 100%
  };

  const getLevelText = () => {
    switch (user?.progress?.current_level) {
      case 'advanced': return t('home.advanced');
      case 'intermediate': return t('home.intermediate');
      default: return t('home.beginner');
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'bullish': return '#00D9A5';
      case 'bearish': return '#EF4444';
      default: return '#8B8B9E';
    }
  };

  const getImpactIcon = (impact: string): keyof typeof Ionicons.glyphMap => {
    switch (impact) {
      case 'bullish': return 'arrow-up-circle';
      case 'bearish': return 'arrow-down-circle';
      default: return 'remove-circle';
    }
  };

  const getImpactText = (impact: string) => {
    switch (impact) {
      case 'bullish': return t('home.bullish');
      case 'bearish': return t('home.bearish');
      default: return t('home.neutral');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return t('common.agoDay', { count: diffDays.toString() });
    if (diffHours > 0) return t('common.agoHour', { count: diffHours.toString() });
    return t('common.justNow');
  };

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const MENU_ITEMS = getMenuItems(t);
  const visibleMenuItems = MENU_ITEMS.filter(item => {
    if (item.id === 'admin') return isAdmin;
    return true;
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <FloatAnimation>
            <View style={styles.loadingIcon}>
              <Ionicons name="diamond" size={50} color="#7C3AED" />
            </View>
          </FloatAnimation>
          <Text style={styles.loadingText}>{t('common.loadingDashboard')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
            colors={['#7C3AED']}
          />
        }
      >
        {/* Hero Header */}
        <AnimatedSection delay={0}>
          <Animated.View style={[styles.heroHeader, { transform: [{ scale: headerScale }] }]}>
            <View style={styles.heroContent}>
              <View style={styles.greetingRow}>
                <View>
                  <Text style={styles.greeting}>{t('home.greeting')},</Text>
                  <Text style={styles.userName}>{user?.name || t('common.user')}</Text>
                </View>
                <View style={styles.headerActions}>
                  <LanguageSelector />
                  <NotificationCenter />
                </View>
              </View>
              
              <View style={styles.levelRow}>
                <PulseAnimation duration={2000} maxScale={1.05}>
                  <View style={styles.levelBadge}>
                    <Ionicons name="trophy" size={16} color="#FFD700" />
                    <Text style={styles.levelText}>{getLevelText()}</Text>
                  </View>
                </PulseAnimation>
                <View style={styles.progressMini}>
                  <Text style={styles.progressMiniText}>{getProgressPercentage()}% {t('home.completed')}</Text>
                  <View style={styles.progressMiniBar}>
                    <View style={[styles.progressMiniFill, { width: `${getProgressPercentage()}%` }]} />
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </AnimatedSection>

        {/* Quick Market Stats */}
        <AnimatedSection delay={100}>
          <View style={styles.quickStatsContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickStatsScroll}
            >
              {cryptoPrices.slice(0, 3).map((crypto, index) => (
                <TouchableOpacity 
                  key={crypto.id || index}
                  style={styles.quickStatCard}
                  onPress={() => router.push('/(tabs)/market')}
                  data-testid={`quick-stat-${crypto.symbol}`}
                >
                  <View style={styles.quickStatHeader}>
                    <Image 
                      source={{ uri: crypto.image }} 
                      style={styles.cryptoIcon}
                    />
                    <Text style={styles.quickStatSymbol}>{crypto.symbol?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.quickStatPrice}>{formatPrice(crypto.current_price)}</Text>
                  <View style={[
                    styles.quickStatChange,
                    { backgroundColor: crypto.price_change_percentage_24h >= 0 ? 'rgba(0, 217, 165, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
                  ]}>
                    <Ionicons 
                      name={crypto.price_change_percentage_24h >= 0 ? 'arrow-up' : 'arrow-down'} 
                      size={12} 
                      color={crypto.price_change_percentage_24h >= 0 ? '#00D9A5' : '#EF4444'} 
                    />
                    <Text style={[
                      styles.quickStatChangeText,
                      { color: crypto.price_change_percentage_24h >= 0 ? '#00D9A5' : '#EF4444' }
                    ]}>
                      {Math.abs(crypto.price_change_percentage_24h).toFixed(2)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              {globalStats && (
                <TouchableOpacity 
                  style={[styles.quickStatCard, styles.quickStatCardWide]}
                  onPress={() => router.push('/(tabs)/market')}
                  data-testid="quick-stat-global"
                >
                  <View style={styles.quickStatHeader}>
                    <View style={[styles.quickStatIconBg, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
                      <Ionicons name="globe" size={18} color="#7C3AED" />
                    </View>
                    <Text style={styles.quickStatSymbol}>{t('home.global')}</Text>
                  </View>
                  <Text style={styles.quickStatPrice}>{formatNumber(globalStats.total_market_cap?.usd || 0)}</Text>
                  <Text style={styles.quickStatLabel}>{t('home.totalCap')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </AnimatedSection>

        {/* Dynamic Menu Grid */}
        <AnimatedSection delay={200}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{visibleMenuItems.length} {t('common.options')}</Text>
              </View>
            </View>
            
            <View style={styles.menuGrid}>
              {visibleMenuItems.map((item, index) => (
                <AnimatedCard 
                  key={item.id} 
                  delay={250 + index * 60}
                  onPress={() => handleMenuPress(item.route)}
                >
                  <View style={styles.menuCard} data-testid={`menu-${item.id}`}>
                    <View style={[styles.menuIconContainer, { backgroundColor: item.bgColor }]}>
                      <Ionicons name={item.icon} size={26} color={item.color} />
                      {item.badge && (
                        <View style={[styles.menuBadge, { backgroundColor: item.color }]}>
                          <Text style={styles.menuBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                    <View style={[styles.menuArrow, { backgroundColor: item.bgColor }]}>
                      <Ionicons name="chevron-forward" size={16} color={item.color} />
                    </View>
                  </View>
                </AnimatedCard>
              ))}
            </View>
          </View>
        </AnimatedSection>

        {/* VIP Section - Dynamic based on VIP status */}
        <AnimatedSection delay={350}>
          {user?.is_vip ? (
            // VIP Member Quick Access Card - Modern Design
            <TouchableOpacity 
              style={styles.vipMemberSection}
              onPress={() => router.push('/vip/hub')}
              activeOpacity={0.9}
              data-testid="home-vip-hub-access"
            >
              <View style={styles.vipMemberGradientBg}>
                <View style={styles.vipMemberContent}>
                  {/* Header with icon and title */}
                  <View style={styles.vipMemberHeader}>
                    <View style={styles.vipMemberIconWrapper}>
                      <Ionicons name="diamond" size={28} color="#FFD700" />
                    </View>
                    <View style={styles.vipMemberInfo}>
                      <View style={styles.vipMemberBadgeRow}>
                        <Text style={styles.vipMemberTitle}>{t('home.vipSpace')}</Text>
                        <View style={styles.vipActiveBadge}>
                          <View style={styles.vipActiveDot} />
                          <Text style={styles.vipActiveBadgeText}>{t('common.active')}</Text>
                        </View>
                      </View>
                      <Text style={styles.vipMemberSubtitle}>{t('home.accessPremium')}</Text>
                    </View>
                    <View style={styles.vipArrowCircle}>
                      <Ionicons name="arrow-forward" size={18} color="#FFD700" />
                    </View>
                  </View>
                  
                  {/* Feature pills */}
                  <View style={styles.vipMemberFeatures}>
                    <View style={styles.vipMemberFeature}>
                      <Ionicons name="school" size={15} color="#A78BFA" />
                      <Text style={styles.vipMemberFeatureText}>{t('home.academy')}</Text>
                    </View>
                    <View style={styles.vipMemberFeature}>
                      <Ionicons name="construct" size={15} color="#00D9A5" />
                      <Text style={styles.vipMemberFeatureText}>{t('home.tools')}</Text>
                    </View>
                    <View style={styles.vipMemberFeature}>
                      <Ionicons name="chatbubbles" size={15} color="#3B82F6" />
                      <Text style={styles.vipMemberFeatureText}>{t('home.community')}</Text>
                    </View>
                    <View style={styles.vipMemberFeature}>
                      <Ionicons name="storefront" size={15} color="#F59E0B" />
                      <Text style={styles.vipMemberFeatureText}>{t('home.marketplace')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            // Non-VIP: Show a subtle, non-aggressive VIP hint instead of a big promo
            <TouchableOpacity 
              style={{ marginHorizontal: 16, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.1)', flexDirection: 'row', alignItems: 'center', gap: 12 }}
              onPress={() => router.push('/vip')}
              activeOpacity={0.8}
              data-testid="home-vip-subtle-hint"
            >
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="diamond-outline" size={20} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5E7EB' }}>{t('home.discoverVip') || 'Discover VIP'}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{t('home.vipSubtle') || 'Academy, tools, and exclusive content'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </AnimatedSection>

        {/* Become a Mentor CTA */}
        <AnimatedSection delay={420}>
          <Pressable
            style={({ pressed }) => [styles.mentorCtaCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/pro/join')}
            data-testid="home-become-mentor-cta"
          >
            <View style={styles.mentorCtaGlow} />
            <View style={styles.mentorCtaContent}>
              <View style={styles.mentorCtaBadgeRow}>
                <View style={styles.mentorCtaBadge}>
                  <Ionicons name="flame" size={14} color="#FF6B35" />
                  <Text style={styles.mentorCtaBadgeText}>{t('home.becomeMentorBadge')}</Text>
                </View>
              </View>
              <View style={styles.mentorCtaBody}>
                <View style={styles.mentorCtaTextBlock}>
                  <Text style={styles.mentorCtaTitle}>{t('home.becomeMentorTitle')}</Text>
                  <Text style={styles.mentorCtaDesc}>{t('home.becomeMentorDesc')}</Text>
                </View>
                <View style={styles.mentorCtaIconBlock}>
                  <View style={styles.mentorCtaIconCircle}>
                    <Ionicons name="school" size={28} color="#FFFFFF" />
                  </View>
                </View>
              </View>
              <View style={styles.mentorCtaBtnRow}>
                <View style={styles.mentorCtaBtn}>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  <Text style={styles.mentorCtaBtnText}>{t('home.becomeMentorCta')}</Text>
                </View>
                <View style={styles.mentorCtaStats}>
                  <View style={styles.mentorCtaStat}>
                    <Ionicons name="people" size={14} color="#10B981" />
                    <Text style={styles.mentorCtaStatText}>500+</Text>
                  </View>
                  <View style={styles.mentorCtaStat}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.mentorCtaStatText}>4.9</Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        </AnimatedSection>

        {/* News Section */}
        <AnimatedSection delay={500}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="newspaper" size={22} color="#7C3AED" />
                <Text style={styles.sectionTitle}>{t('home.news')}</Text>
              </View>
              <TouchableOpacity 
                style={styles.seeAllBtn}
                onPress={() => router.push('/(tabs)/news')}
                data-testid="see-all-news-btn"
              >
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
                <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
              </TouchableOpacity>
            </View>

            {/* News Categories */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.newsCategoriesScroll}
              contentContainerStyle={styles.newsCategoriesContainer}
            >
              {[
                { id: null, label: 'Tout', icon: 'apps' },
                { id: 'macro', label: 'Macro', icon: 'business' },
                { id: 'institutionnel', label: 'Institutionnel', icon: 'briefcase' },
                { id: 'technologie', label: 'Tech', icon: 'code-slash' },
                { id: 'regulation', label: 'Régulation', icon: 'document-text' },
                { id: 'securite', label: 'Sécurité', icon: 'shield' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id || 'all'}
                  style={[
                    styles.newsCategoryBtn,
                    selectedNewsCategory === cat.id && styles.newsCategoryBtnActive
                  ]}
                  onPress={() => setSelectedNewsCategory(cat.id)}
                  data-testid={`news-category-${cat.id || 'all'}`}
                >
                  <Ionicons 
                    name={cat.icon as any} 
                    size={14} 
                    color={selectedNewsCategory === cat.id ? '#FFFFFF' : '#8B8B9E'} 
                  />
                  <Text style={[
                    styles.newsCategoryText,
                    selectedNewsCategory === cat.id && styles.newsCategoryTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* News Cards */}
            <View style={styles.newsContainer}>
              {news
                .filter(item => !selectedNewsCategory || item.category === selectedNewsCategory)
                .slice(0, 6)
                .map((item, index) => (
                <AnimatedCard 
                  key={item.id} 
                  delay={550 + index * 80}
                  onPress={() => handleNewsPress(item)}
                >
                  <View style={styles.newsCard} data-testid={`news-item-${item.id}`}>
                    <Image 
                      source={{ uri: item.image_url }} 
                      style={styles.newsImage}
                      resizeMode="cover"
                    />
                    <View style={styles.newsContent}>
                      <View style={styles.newsHeader}>
                        <View style={[styles.newsImpactBadge, { backgroundColor: `${getImpactColor(item.impact)}20` }]}>
                          <Ionicons name={getImpactIcon(item.impact)} size={12} color={getImpactColor(item.impact)} />
                          <Text style={[styles.newsImpactText, { color: getImpactColor(item.impact) }]}>
                            {getImpactText(item.impact)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); handleBookmarkNews(item.id); }}
                          style={styles.bookmarkBtn}
                        >
                          <Ionicons 
                            name={bookmarkedNews.has(item.id) ? 'bookmark' : 'bookmark-outline'} 
                            size={16} 
                            color={bookmarkedNews.has(item.id) ? '#7C3AED' : '#8B8B9E'} 
                          />
                        </TouchableOpacity>
                      </View>
                      
                      {/* Impact Reason Bubble */}
                      {item.impact_reason && (
                        <View style={[
                          styles.impactReasonBubble,
                          { 
                            backgroundColor: item.impact === 'bullish' ? 'rgba(0, 217, 165, 0.1)' : 
                                           item.impact === 'bearish' ? 'rgba(239, 68, 68, 0.1)' : 
                                           'rgba(139, 139, 158, 0.1)',
                            borderColor: item.impact === 'bullish' ? 'rgba(0, 217, 165, 0.3)' : 
                                        item.impact === 'bearish' ? 'rgba(239, 68, 68, 0.3)' : 
                                        'rgba(139, 139, 158, 0.3)'
                          }
                        ]}>
                          <Ionicons 
                            name={item.impact === 'bullish' ? 'trending-up' : 
                                  item.impact === 'bearish' ? 'trending-down' : 'information-circle'} 
                            size={11} 
                            color={getImpactColor(item.impact)} 
                          />
                          <Text style={[styles.impactReasonText, { color: getImpactColor(item.impact) }]}>
                            {item.impact_reason}
                          </Text>
                        </View>
                      )}
                      
                      <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text>
                      <View style={styles.newsFooter}>
                        <View style={styles.newsSourceRow}>
                          <Text style={styles.newsSource}>{item.source}</Text>
                          <Text style={styles.newsTime}>· {formatTimeAgo(item.published_at)}</Text>
                        </View>
                        <View style={styles.newsActions}>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); handleShareNews(item); }}
                            style={styles.newsActionBtn}
                          >
                            <Ionicons name="share-outline" size={14} color="#8B8B9E" />
                          </TouchableOpacity>
                          {item.link && (
                            <TouchableOpacity
                              onPress={(e) => { e.stopPropagation(); handleOpenLink(item.link); }}
                              style={styles.newsActionBtn}
                            >
                              <Ionicons name="open-outline" size={14} color="#7C3AED" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                </AnimatedCard>
              ))}
            </View>
          </View>
        </AnimatedSection>

        {/* Learning Progress Section */}
        <AnimatedSection delay={800}>
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.progressCard}
              onPress={() => router.push('/(tabs)/learn')}
              data-testid="learning-progress-card"
            >
              <View style={styles.progressCardHeader}>
                <View style={styles.progressCardIcon}>
                  <Ionicons name="school" size={24} color="#7C3AED" />
                </View>
                <View style={styles.progressCardInfo}>
                  <Text style={styles.progressCardTitle}>Continuer votre apprentissage</Text>
                  <Text style={styles.progressCardSubtitle}>
                    {user?.progress?.modules_completed?.length || 0}/12 leçons complétées
                  </Text>
                </View>
                <View style={styles.progressCardPercentage}>
                  <Text style={styles.progressCardPercentageText}>{getProgressPercentage()}%</Text>
                </View>
              </View>
              <View style={styles.progressCardBar}>
                <Animated.View style={[styles.progressCardBarFill, { width: `${getProgressPercentage()}%` }]} />
              </View>
              <View style={styles.progressCardAction}>
                <Text style={styles.progressCardActionText}>Reprendre le cours</Text>
                <Ionicons name="arrow-forward-circle" size={22} color="#7C3AED" />
              </View>
            </TouchableOpacity>
          </View>
        </AnimatedSection>

        {/* Quick Actions */}
        <AnimatedSection delay={900}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions Rapides</Text>
            <View style={styles.quickActionsGrid}>
              <AnimatedButton 
                style={styles.quickActionCard}
                onPress={() => router.push('/(tabs)/ai')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="chatbubble-ellipses" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.quickActionText}>Poser une question</Text>
              </AnimatedButton>
              
              <AnimatedButton 
                style={styles.quickActionCard}
                onPress={() => router.push('/(tabs)/community')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}>
                  <Ionicons name="create" size={24} color="#FF6B35" />
                </View>
                <Text style={styles.quickActionText}>{t("home.createPost")}</Text>
              </AnimatedButton>
              
              <AnimatedButton 
                style={styles.quickActionCard}
                onPress={() => router.push('/(tabs)/market')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 217, 165, 0.15)' }]}>
                  <Ionicons name="search" size={24} color="#00D9A5" />
                </View>
                <Text style={styles.quickActionText}>{t("home.exploreMarket")}</Text>
              </AnimatedButton>
            </View>
          </View>
        </AnimatedSection>

        <View style={{ height: 32 }} />
      </Animated.ScrollView>

      {/* News Detail Modal */}
      <Modal
        visible={showNewsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewsModal(false)}
      >
        <View style={styles.newsModalOverlay}>
          <View style={styles.newsModalContent}>
            {selectedNews && (
              <>
                <View style={styles.newsModalHeader}>
                  <TouchableOpacity 
                    onPress={() => setShowNewsModal(false)} 
                    style={styles.newsModalCloseBtn}
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={styles.newsModalActions}>
                    <TouchableOpacity
                      onPress={() => handleBookmarkNews(selectedNews.id)}
                      style={styles.newsModalActionBtn}
                    >
                      <Ionicons 
                        name={bookmarkedNews.has(selectedNews.id) ? 'bookmark' : 'bookmark-outline'} 
                        size={22} 
                        color={bookmarkedNews.has(selectedNews.id) ? '#7C3AED' : '#8B8B9E'} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleShareNews(selectedNews)}
                      style={styles.newsModalActionBtn}
                    >
                      <Ionicons name="share-outline" size={22} color="#8B8B9E" />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.newsModalBody} showsVerticalScrollIndicator={false}>
                  <Image 
                    source={{ uri: selectedNews.image_url }} 
                    style={styles.newsModalImage}
                    resizeMode="cover"
                  />

                  <View style={styles.newsModalMeta}>
                    <View style={[
                      styles.newsModalCategoryBadge, 
                      { backgroundColor: `${getCategoryColor(selectedNews.category)}15` }
                    ]}>
                      <View style={[styles.newsModalCategoryDot, { backgroundColor: getCategoryColor(selectedNews.category) }]} />
                      <Text style={[styles.newsModalCategoryText, { color: getCategoryColor(selectedNews.category) }]}>
                        {getCategoryLabel(selectedNews.category)}
                      </Text>
                    </View>

                    <View style={[
                      styles.newsModalImpactBadge,
                      { backgroundColor: `${getImpactColor(selectedNews.impact)}15` }
                    ]}>
                      <Ionicons 
                        name={getImpactIcon(selectedNews.impact)} 
                        size={14} 
                        color={getImpactColor(selectedNews.impact)} 
                      />
                      <Text style={[styles.newsModalImpactText, { color: getImpactColor(selectedNews.impact) }]}>
                        {getImpactText(selectedNews.impact)}
                      </Text>
                    </View>
                  </View>

                  {/* Impact Reason - Prominent Display */}
                  {selectedNews.impact_reason && (
                    <View style={[
                      styles.newsModalImpactReason,
                      { 
                        backgroundColor: selectedNews.impact === 'bullish' ? 'rgba(0, 217, 165, 0.08)' : 
                                        selectedNews.impact === 'bearish' ? 'rgba(239, 68, 68, 0.08)' : 
                                        'rgba(139, 139, 158, 0.08)',
                        borderColor: getImpactColor(selectedNews.impact)
                      }
                    ]}>
                      <Ionicons 
                        name={selectedNews.impact === 'bullish' ? 'trending-up' : 
                              selectedNews.impact === 'bearish' ? 'trending-down' : 'information-circle'} 
                        size={20} 
                        color={getImpactColor(selectedNews.impact)} 
                      />
                      <View style={styles.newsModalImpactReasonContent}>
                        <Text style={styles.newsModalImpactReasonLabel}>Pourquoi c'est {getImpactText(selectedNews.impact).toLowerCase()} ?</Text>
                        <Text style={[styles.newsModalImpactReasonText, { color: getImpactColor(selectedNews.impact) }]}>
                          {selectedNews.impact_reason}
                        </Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.newsModalTitle}>{selectedNews.title}</Text>
                  
                  <View style={styles.newsModalSourceRow}>
                    <View style={styles.newsModalSourceInfo}>
                      <View style={styles.newsModalSourceIcon}>
                        <Ionicons name="newspaper" size={14} color="#7C3AED" />
                      </View>
                      <Text style={styles.newsModalSourceText}>{selectedNews.source}</Text>
                    </View>
                    <Text style={styles.newsModalDate}>{formatTimeAgo(selectedNews.published_at)}</Text>
                  </View>

                  <Text style={styles.newsModalSummary}>{selectedNews.summary}</Text>

                  {/* Tags */}
                  {selectedNews.tags && selectedNews.tags.length > 0 && (
                    <View style={styles.newsModalTags}>
                      {selectedNews.tags.map((tag, index) => (
                        <View key={index} style={styles.newsModalTag}>
                          <Text style={styles.newsModalTagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.newsModalButtonsRow}>
                    {selectedNews.link && (
                      <TouchableOpacity
                        style={styles.newsModalPrimaryBtn}
                        onPress={() => handleOpenLink(selectedNews.link)}
                      >
                        <Ionicons name="open-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.newsModalPrimaryBtnText}>Lire l'article complet</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={styles.newsModalSecondaryBtn}
                      onPress={() => handleShareNews(selectedNews)}
                    >
                      <Ionicons name="share-social" size={20} color="#7C3AED" />
                      <Text style={styles.newsModalSecondaryBtnText}>{t("common.share")}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 30 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#8B8B9E',
  },
  scrollView: {
    flex: 1,
  },
  
  // Hero Header - Modernized with Glassmorphism
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroContent: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greeting: {
    fontSize: 14,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  levelText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  progressMini: {
    alignItems: 'flex-end',
  },
  progressMiniText: {
    fontSize: 12,
    color: '#8B8B9E',
    marginBottom: 6,
  },
  progressMiniBar: {
    width: 100,
    height: 4,
    backgroundColor: '#2A2A4E',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressMiniFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },

  // Quick Stats - Modernized
  quickStatsContainer: {
    marginTop: 8,
  },
  quickStatsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  quickStatCard: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 20,
    padding: 18,
    minWidth: 140,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  quickStatCardWide: {
    minWidth: 160,
  },
  quickStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  cryptoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  quickStatIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8B9E',
  },
  quickStatPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#8B8B9E',
  },
  quickStatChange: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  quickStatChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Section - Modernized
  section: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  sectionBadgeText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 20,
  },
  seeAllText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
  },

  // Menu Grid - Modernized
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuCard: {
    width: (width - 52) / 2,
    backgroundColor: 'rgba(20, 20, 40, 0.85)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  menuBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  menuBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#7B7B92',
    lineHeight: 15,
  },
  menuArrow: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // News Categories
  newsCategoriesScroll: {
    marginBottom: 16,
    marginHorizontal: -20,
  },
  newsCategoriesContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  newsCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 10,
    gap: 6,
  },
  newsCategoryBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  newsCategoryText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  newsCategoryTextActive: {
    color: '#FFFFFF',
  },

  // News Cards - Modernized
  newsContainer: {
    gap: 14,
  },
  newsCard: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  newsImage: {
    width: 110,
    height: 130,
    backgroundColor: '#1A1A2E',
  },
  newsContent: {
    flex: 1,
    padding: 16,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  newsImpactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  newsImpactText: {
    fontSize: 10,
    fontWeight: '700',
  },
  newsTime: {
    fontSize: 11,
    color: '#64748B',
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 21,
    marginBottom: 6,
  },
  newsSummary: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 10,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newsSource: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '500',
  },
  newsTags: {
    flexDirection: 'row',
    gap: 4,
  },
  newsTag: {
    backgroundColor: '#2A2A4E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newsTagText: {
    fontSize: 9,
    color: '#8B8B9E',
  },
  bookmarkBtn: {
    padding: 4,
  },
  newsSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newsActions: {
    flexDirection: 'row',
    gap: 8,
  },
  newsActionBtn: {
    padding: 6,
    backgroundColor: '#2A2A4E',
    borderRadius: 6,
  },
  
  // Impact Reason Bubble
  impactReasonBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 5,
  },
  impactReasonText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Progress Card
  progressCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  progressCardInfo: {
    flex: 1,
  },
  progressCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  progressCardSubtitle: {
    fontSize: 13,
    color: '#8B8B9E',
  },
  progressCardPercentage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCardPercentageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  progressCardBar: {
    height: 6,
    backgroundColor: '#2A2A4E',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressCardBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  progressCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  progressCardActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // News Modal
  newsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  newsModalContent: {
    backgroundColor: '#0A0A1A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#2A2A4E',
    borderBottomWidth: 0,
  },
  newsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  newsModalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsModalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  newsModalActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsModalBody: {
    padding: 20,
  },
  newsModalImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#2A2A4E',
    marginBottom: 16,
  },
  newsModalMeta: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  newsModalCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  newsModalCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  newsModalCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newsModalImpactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  newsModalImpactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newsModalImpactReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  newsModalImpactReasonContent: {
    flex: 1,
  },
  newsModalImpactReasonLabel: {
    fontSize: 12,
    color: '#8B8B9E',
    marginBottom: 4,
  },
  newsModalImpactReasonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  newsModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 12,
  },
  newsModalSourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  newsModalSourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsModalSourceIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsModalSourceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  newsModalDate: {
    fontSize: 13,
    color: '#8B8B9E',
  },
  newsModalSummary: {
    fontSize: 16,
    color: '#C4C4C4',
    lineHeight: 26,
    marginBottom: 20,
  },
  newsModalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  newsModalTag: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  newsModalTagText: {
    fontSize: 13,
    color: '#8B8B9E',
    fontWeight: '500',
  },
  newsModalButtonsRow: {
    gap: 12,
  },
  newsModalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  newsModalPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  newsModalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  newsModalSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C3AED',
  },

  // VIP Section Styles
  vipSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  vipGradientBorder: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#1A0A2E',
    overflow: 'hidden',
  },
  vipContent: {
    padding: 20,
  },
  vipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  vipIconWrapper: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipIconGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  vipTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  vipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vipBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vipBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A0A2E',
  },
  vipSubtitle: {
    fontSize: 13,
    color: '#8B8B9E',
    marginTop: 2,
  },
  vipPriceTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  vipPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  vipPeriod: {
    fontSize: 12,
    color: '#FFD700',
    opacity: 0.8,
  },
  vipFeaturesGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  vipFeatureColumn: {
    flex: 1,
    backgroundColor: 'rgba(139, 139, 158, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 139, 158, 0.15)',
  },
  vipFeatureColumnVip: {
    flex: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  vipColumnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B8B9E',
    marginBottom: 12,
    textAlign: 'center',
  },
  vipColumnTitleVip: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 12,
    textAlign: 'center',
  },
  vipFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  vipFeatureTextFree: {
    fontSize: 12,
    color: '#8B8B9E',
    flex: 1,
  },
  vipFeatureTextVip: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  vipCtaContainer: {
    marginTop: 4,
  },
  vipCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  vipCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A0A2E',
  },

  // VIP Member Section (for active VIP users)
  vipMemberSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  vipMemberGradientBg: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    backgroundColor: 'rgba(26, 10, 46, 0.9)',
    overflow: 'hidden',
  },
  vipMemberContent: {
    padding: 18,
  },
  vipMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  vipMemberIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  vipMemberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vipMemberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipMemberTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vipActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 165, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  vipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D9A5',
  },
  vipActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00D9A5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vipMemberSubtitle: {
    fontSize: 12,
    color: '#8B8B9E',
    marginTop: 2,
  },
  vipArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  vipMemberFeatures: {
    flexDirection: 'row',
    gap: 8,
  },
  vipMemberFeature: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  vipMemberFeatureText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C4C4D4',
  },

  // Become a Mentor CTA
  mentorCtaCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: '#0D1A14',
    position: 'relative',
  },
  mentorCtaGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  mentorCtaContent: {
    padding: 20,
  },
  mentorCtaBadgeRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  mentorCtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  mentorCtaBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mentorCtaBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mentorCtaTextBlock: {
    flex: 1,
    marginRight: 16,
  },
  mentorCtaTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  mentorCtaDesc: {
    fontSize: 13,
    color: '#8B9DA5',
    lineHeight: 19,
  },
  mentorCtaIconBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorCtaIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorCtaBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mentorCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  mentorCtaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mentorCtaStats: {
    flexDirection: 'row',
    gap: 16,
  },
  mentorCtaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mentorCtaStatText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B9DA5',
  },
});
