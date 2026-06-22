import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Modal,
  Linking,
  Share,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { newsAPI } from '../../utils/api';
import { AnimatedSection, AnimatedCard } from '../../components/AnimatedComponents';
import { useTranslation } from '../../store/languageStore';

const { width } = Dimensions.get('window');
const POLL_INTERVAL = 30000; // 30 seconds
const NEWS_LIMIT = 25;

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
  views?: number;
  trending_score?: number;
}

interface FlashNewsItem {
  id: string;
  type: 'breaking' | 'alert' | 'update' | 'news';
  title: string;
  timestamp: string;
  impact: 'bullish' | 'bearish' | 'neutral';
  icon: string;
}

const getCategories = (t: (key: string) => string) => [
  { id: null, label: t('news.all'), icon: 'apps', color: '#7C3AED' },
  { id: 'macro', label: t('news.macro'), icon: 'globe', color: '#3B82F6' },
  { id: 'institutionnel', label: t('news.institutional'), icon: 'business', color: '#7C3AED' },
  { id: 'technologie', label: t('news.tech'), icon: 'code-slash', color: '#00D9A5' },
  { id: 'regulation', label: t('news.regulation'), icon: 'document-text', color: '#F59E0B' },
  { id: 'securite', label: t('news.security'), icon: 'shield', color: '#EF4444' },
  { id: 'adoption', label: t('news.adoption'), icon: 'people', color: '#10B981' },
  { id: 'analyse', label: t('news.analysis'), icon: 'analytics', color: '#8B5CF6' },
];

const getImpactFilters = (t: (key: string) => string) => [
  { id: null, label: t('news.allImpact'), icon: 'swap-horizontal' },
  { id: 'bullish', label: t('news.bullish'), icon: 'trending-up', color: '#00D9A5' },
  { id: 'bearish', label: t('news.bearish'), icon: 'trending-down', color: '#EF4444' },
  { id: 'neutral', label: t('news.neutral'), icon: 'remove', color: '#8B8B9E' },
];

export default function NewsScreen() {
  const router = useRouter();
  const { t, language: currentLang } = useTranslation();
  
  // Dynamic categories and filters with translations
  const CATEGORIES = getCategories(t);
  const IMPACT_FILTERS = getImpactFilters(t);
  
  const [news, setNews] = useState<NewsItem[]>([]);
  const [trendingNews, setTrendingNews] = useState<NewsItem[]>([]);
  const [flashNews, setFlashNews] = useState<FlashNewsItem[]>([]);
  const [featuredNews, setFeaturedNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalNews, setTotalNews] = useState(0);
  const [newArticleIds, setNewArticleIds] = useState<Set<string>>(new Set());
  
  // Refs for polling
  const knownIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstLoadRef = useRef(true);
  const newArticleAnimRef = useRef(new Animated.Value(0)).current;
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedImpact, setSelectedImpact] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'latest' | 'trending' | 'bookmarked'>('latest');
  
  // Modal
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [bookmarkedNews, setBookmarkedNews] = useState<Set<string>>(new Set());
  
  // Stats
  const [marketSentiment, setMarketSentiment] = useState({ bullish: 0, bearish: 0, neutral: 0 });

  // Flash news animation
  const flashScrollAnim = useState(new Animated.Value(0))[0];

  const fetchNews = useCallback(async (reset = false) => {
    try {
      const currentPage = reset ? 0 : page;
      const response = await newsAPI.getNews({
        category: selectedCategory || undefined,
        limit: NEWS_LIMIT,
        skip: currentPage * NEWS_LIMIT,
        query: searchQuery || undefined,
        lang: currentLang || undefined,
      });
      
      if (response.data.success) {
        const newNews = response.data.data;
        
        if (reset) {
          // On first load, register all IDs as known
          if (isFirstLoadRef.current) {
            newNews.forEach((n: NewsItem) => knownIdsRef.current.add(n.id));
            isFirstLoadRef.current = false;
          }
          
          setNews(newNews);
          setFeaturedNews(newNews.slice(0, 3));
          setPage(1);
          
          // Calculate sentiment
          const sentiment = { bullish: 0, bearish: 0, neutral: 0 };
          newNews.forEach((n: NewsItem) => {
            sentiment[n.impact]++;
          });
          setMarketSentiment(sentiment);
        } else {
          setNews(prev => [...prev, ...newNews]);
          setPage(prev => prev + 1);
        }
        
        // Register all fetched IDs
        newNews.forEach((n: NewsItem) => knownIdsRef.current.add(n.id));
        
        setTotalNews(response.data.total || newNews.length);
        setHasMore(newNews.length === NEWS_LIMIT);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [page, selectedCategory, searchQuery, currentLang]);

  const fetchTrendingNews = async () => {
    try {
      const response = await newsAPI.getTrendingNews({ lang: currentLang || undefined });
      if (response.data.success) {
        setTrendingNews(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching trending news:', error);
    }
  };

  const fetchFlashNews = async () => {
    try {
      const response = await newsAPI.getFlashNews({ lang: currentLang || undefined });
      if (response.data.success) {
        setFlashNews(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching flash news:', error);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setPage(0);
    isFirstLoadRef.current = true;
    fetchNews(true);
    fetchTrendingNews();
    fetchFlashNews();
  }, [selectedCategory, currentLang]);

  // Auto-polling for real-time updates every 30 seconds
  const pollForNewArticles = useCallback(async () => {
    try {
      const response = await newsAPI.getNews({
        category: selectedCategory || undefined,
        limit: NEWS_LIMIT,
        skip: 0,
        query: searchQuery || undefined,
        lang: currentLang || undefined,
      });
      
      if (response.data.success) {
        const freshArticles: NewsItem[] = response.data.data;
        const freshIds = new Set(freshArticles.map((a: NewsItem) => a.id));
        
        // Find genuinely new articles
        const brandNew = freshArticles.filter((a: NewsItem) => !knownIdsRef.current.has(a.id));
        
        if (brandNew.length > 0) {
          // Mark them as new for the badge
          const newIds = new Set(brandNew.map((a: NewsItem) => a.id));
          setNewArticleIds(prev => new Set([...prev, ...newIds]));
          
          // Register in known
          brandNew.forEach((a: NewsItem) => knownIdsRef.current.add(a.id));
          
          // Prepend new articles to the list
          setNews(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const toAdd = brandNew.filter(a => !existingIds.has(a.id));
            return [...toAdd, ...prev];
          });
          
          setTotalNews(response.data.total || freshArticles.length);
          
          // Trigger slide-in animation
          newArticleAnimRef.setValue(0);
          Animated.spring(newArticleAnimRef, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }).start();
          
          // Auto-clear "new" badges after 15 seconds
          setTimeout(() => {
            setNewArticleIds(prev => {
              const next = new Set(prev);
              newIds.forEach(id => next.delete(id));
              return next;
            });
          }, 15000);
        }
      }
    } catch (error) {
      // Silent fail for background polling
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    // Start polling
    pollTimerRef.current = setInterval(pollForNewArticles, POLL_INTERVAL);
    
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [pollForNewArticles]);

  // Flash news scroll animation
  useEffect(() => {
    if (flashNews.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashScrollAnim, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: true,
          }),
          Animated.timing(flashScrollAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [flashNews]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetchNews(true);
    fetchTrendingNews();
    fetchFlashNews();
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      fetchNews(false);
    }
  };

  const handleSearch = () => {
    setIsLoading(true);
    setPage(0);
    fetchNews(true);
  };

  const handleNewsPress = (item: NewsItem) => {
    setSelectedNews(item);
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

  const handleShareNews = async (item: NewsItem) => {
    try {
      await Share.share({
        title: item.title,
        message: `${item.title}\n\n${item.summary}\n\nSource: ${item.source}${item.link ? `\n\nLire plus: ${item.link}` : ''}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBookmark = (newsId: string) => {
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

  const getImpactColor = (impact: string): string => {
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

  const getImpactText = (impact: string): string => {
    switch (impact) {
      case 'bullish': return t('news.bullish');
      case 'bearish': return t('news.bearish');
      default: return t('news.neutral');
    }
  };

  const getCategoryColor = (category: string): string => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.color || '#8B8B9E';
  };

  const getCategoryLabel = (category: string): string => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.label || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const formatTimeAgo = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 60) return `${diffMins}min ${t('common.ago')}`;
      if (diffDays > 0) return `${diffDays}${t('common.daysAbbr')} ${t('common.ago')}`;
      if (diffHours > 0) return `${diffHours}h ${t('common.ago')}`;
      return t('common.justNow');
    } catch {
      return dateString;
    }
  };

  const getFlashTypeColor = (type: string): string => {
    switch (type) {
      case 'breaking': return '#EF4444';
      case 'alert': return '#F59E0B';
      case 'update': return '#3B82F6';
      default: return '#7C3AED';
    }
  };

  const filteredNews = news.filter(item => {
    if (selectedImpact && item.impact !== selectedImpact) return false;
    return true;
  });

  const bookmarkedItems = news.filter(item => bookmarkedNews.has(item.id));
  const displayNews = activeSection === 'bookmarked' ? bookmarkedItems : 
                      activeSection === 'trending' ? trendingNews : filteredNews;

  const renderFlashNewsBanner = () => (
    <View style={styles.flashBanner}>
      <View style={styles.flashBadge}>
        <Ionicons name="flash" size={12} color="#FFFFFF" />
        <Text style={styles.flashBadgeText}>FLASH</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flashScroll}>
        {flashNews.map((item, index) => (
          <View key={item.id} style={styles.flashItem}>
            <View style={[styles.flashDot, { backgroundColor: getImpactColor(item.impact) }]} />
            <Text style={styles.flashText} numberOfLines={1}>{item.title}</Text>
            {index < flashNews.length - 1 && <Text style={styles.flashDivider}>•</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderMarketSentiment = () => {
    const total = marketSentiment.bullish + marketSentiment.bearish + marketSentiment.neutral;
    const bullishPercent = total > 0 ? Math.round((marketSentiment.bullish / total) * 100) : 33;
    const bearishPercent = total > 0 ? Math.round((marketSentiment.bearish / total) * 100) : 33;
    
    return (
      <View style={styles.sentimentCard}>
        <View style={styles.sentimentHeader}>
          <Ionicons name="pulse" size={18} color="#7C3AED" />
          <Text style={styles.sentimentTitle}>{t('news.marketSentiment')}</Text>
        </View>
        <View style={styles.sentimentBar}>
          <View style={[styles.sentimentFill, styles.bullishFill, { width: `${bullishPercent}%` }]} />
          <View style={[styles.sentimentFill, styles.bearishFill, { width: `${bearishPercent}%` }]} />
        </View>
        <View style={styles.sentimentLabels}>
          <View style={styles.sentimentLabel}>
            <View style={[styles.sentimentDot, { backgroundColor: '#00D9A5' }]} />
            <Text style={styles.sentimentLabelText}>{t('news.bullish')} {bullishPercent}%</Text>
          </View>
          <View style={styles.sentimentLabel}>
            <View style={[styles.sentimentDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.sentimentLabelText}>{t('news.bearish')} {bearishPercent}%</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTrendingCard = (item: NewsItem, index: number) => (
    <TouchableOpacity
      key={item.id}
      style={styles.trendingCard}
      onPress={() => handleNewsPress(item)}
      activeOpacity={0.9}
      data-testid={`trending-news-${item.id}`}
    >
      <Image source={{ uri: item.image_url }} style={styles.trendingImage} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        style={styles.trendingGradient}
      >
        <View style={styles.trendingRank}>
          <Text style={styles.trendingRankText}>#{index + 1}</Text>
        </View>
        <View style={[styles.trendingImpactBadge, { backgroundColor: `${getImpactColor(item.impact)}20` }]}>
          <Ionicons name={getImpactIcon(item.impact)} size={12} color={getImpactColor(item.impact)} />
          <Text style={[styles.trendingImpactText, { color: getImpactColor(item.impact) }]}>
            {getImpactText(item.impact)}
          </Text>
        </View>
        <Text style={styles.trendingTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.trendingMeta}>
          <Text style={styles.trendingSource}>{item.source}</Text>
          {item.views && (
            <View style={styles.trendingViews}>
              <Ionicons name="eye-outline" size={12} color="#8B8B9E" />
              <Text style={styles.trendingViewsText}>{(item.views / 1000).toFixed(1)}k</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderFeaturedCard = (item: NewsItem, index: number) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.featuredCard, index === 0 && styles.featuredCardLarge]}
      onPress={() => handleNewsPress(item)}
      activeOpacity={0.9}
      data-testid={`featured-news-${item.id}`}
    >
      <Image source={{ uri: item.image_url }} style={styles.featuredImage} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.featuredGradient}
      >
        <View style={[styles.featuredImpactBadge, { backgroundColor: `${getImpactColor(item.impact)}20` }]}>
          <Ionicons name={getImpactIcon(item.impact)} size={12} color={getImpactColor(item.impact)} />
          <Text style={[styles.featuredImpactText, { color: getImpactColor(item.impact) }]}>
            {getImpactText(item.impact)}
          </Text>
        </View>
        <Text style={styles.featuredTitle} numberOfLines={index === 0 ? 3 : 2}>{item.title}</Text>
        <View style={styles.featuredMeta}>
          <Text style={styles.featuredSource}>{item.source}</Text>
          <Text style={styles.featuredTime}>· {formatTimeAgo(item.published_at)}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderNewsCard = (item: NewsItem, index: number) => {
    const isNew = newArticleIds.has(item.id);
    return (
    <AnimatedCard key={item.id} delay={index * 50} onPress={() => handleNewsPress(item)}>
      <View style={[styles.newsCard, isNew && styles.newsCardNew]} data-testid={`news-item-${item.id}`}>
        <Image source={{ uri: item.image_url }} style={styles.newsImage} resizeMode="cover" />
        <View style={styles.newsContent}>
          <View style={styles.newsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <View style={[styles.categoryBadge, { backgroundColor: `${getCategoryColor(item.category)}15` }]}>
                <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
                  {getCategoryLabel(item.category)}
                </Text>
              </View>
              {isNew && (
                <View style={styles.newBadge} data-testid={`new-badge-${item.id}`}>
                  <View style={styles.newBadgeDot} />
                  <Text style={styles.newBadgeText}>{t('news.new')}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => handleBookmark(item.id)} style={styles.bookmarkBtn}>
              <Ionicons
                name={bookmarkedNews.has(item.id) ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={bookmarkedNews.has(item.id) ? '#7C3AED' : '#8B8B9E'}
              />
            </TouchableOpacity>
          </View>
          
          {item.impact_reason && (
            <View style={[styles.impactReasonBadge, { backgroundColor: `${getImpactColor(item.impact)}10`, borderColor: `${getImpactColor(item.impact)}30` }]}>
              <Ionicons name={getImpactIcon(item.impact)} size={12} color={getImpactColor(item.impact)} />
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
              <TouchableOpacity onPress={() => handleShareNews(item)} style={styles.actionBtn}>
                <Ionicons name="share-outline" size={16} color="#8B8B9E" />
              </TouchableOpacity>
              {item.link && (
                <TouchableOpacity onPress={() => handleOpenLink(item.link)} style={styles.actionBtn}>
                  <Ionicons name="open-outline" size={16} color="#7C3AED" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </AnimatedCard>
    );
  };

  if (isLoading && news.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0A0A1A', '#0F0520']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t('news.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A1A', '#0F0520', '#0A0A1A']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('news.title')}</Text>
            <View style={styles.headerSubRow}>
              <View style={styles.liveDot} />
              <Text style={styles.headerSubtitle}>{totalNews} {t('news.articles')} • {t('news.realTime')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} data-testid="refresh-news-btn">
            <Ionicons name="refresh" size={22} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* Flash News Banner */}
        {flashNews.length > 0 && renderFlashNewsBanner()}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#8B8B9E" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('news.searchNews')}
              placeholderTextColor="#5A5A6E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              data-testid="news-search-input"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }}>
                <Ionicons name="close-circle" size={20} color="#8B8B9E" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Section Tabs */}
        <View style={styles.sectionTabs}>
          {[
            { id: 'latest', label: t('news.latest'), icon: 'time' },
            { id: 'trending', label: t('news.trending'), icon: 'flame', count: trendingNews.length },
            { id: 'bookmarked', label: t('news.saved'), icon: 'bookmark', count: bookmarkedNews.size },
          ].map(section => (
            <TouchableOpacity
              key={section.id}
              style={[styles.sectionTab, activeSection === section.id && styles.sectionTabActive]}
              onPress={() => setActiveSection(section.id as any)}
              data-testid={`news-tab-${section.id}`}
            >
              <Ionicons
                name={section.icon as any}
                size={18}
                color={activeSection === section.id ? '#7C3AED' : '#8B8B9E'}
              />
              <Text style={[styles.sectionTabText, activeSection === section.id && styles.sectionTabTextActive]}>
                {section.label}
              </Text>
              {section.count !== undefined && section.count > 0 && (
                <View style={styles.sectionTabBadge}>
                  <Text style={styles.sectionTabBadgeText}>{section.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 500) {
              if (!isLoadingMore && hasMore && activeSection === 'latest') {
                setIsLoadingMore(true);
                fetchNews(false);
              }
            }
          }}
          scrollEventThrottle={400}
        >
          {/* Market Sentiment */}
          {activeSection === 'latest' && renderMarketSentiment()}

          {/* Categories Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            <View style={styles.categoriesContainer}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id || 'all'}
                  style={[
                    styles.categoryPill,
                    selectedCategory === cat.id && styles.categoryPillActive,
                    selectedCategory === cat.id && cat.color && { borderColor: cat.color }
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  data-testid={`news-category-${cat.id || 'all'}`}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={14}
                    color={selectedCategory === cat.id ? (cat.color || '#7C3AED') : '#8B8B9E'}
                  />
                  <Text style={[
                    styles.categoryPillText,
                    selectedCategory === cat.id && { color: cat.color || '#7C3AED' }
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Impact Filter */}
          <View style={styles.impactFilterRow}>
            <Text style={styles.filterLabel}>Impact:</Text>
            <View style={styles.impactFilters}>
              {IMPACT_FILTERS.map(filter => (
                <TouchableOpacity
                  key={filter.id || 'all'}
                  style={[
                    styles.impactPill,
                    selectedImpact === filter.id && styles.impactPillActive,
                    selectedImpact === filter.id && filter.color && { backgroundColor: `${filter.color}20`, borderColor: filter.color }
                  ]}
                  onPress={() => setSelectedImpact(filter.id)}
                  data-testid={`news-impact-${filter.id || 'all'}`}
                >
                  <Ionicons
                    name={filter.icon as any}
                    size={12}
                    color={selectedImpact === filter.id ? (filter.color || '#7C3AED') : '#8B8B9E'}
                  />
                  <Text style={[
                    styles.impactPillText,
                    selectedImpact === filter.id && { color: filter.color || '#7C3AED' }
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Trending Section (horizontal scroll on Trending tab) */}
          {activeSection === 'trending' && trendingNews.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flame" size={20} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Top Tendances</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.trendingGrid}>
                  {trendingNews.map((item, index) => renderTrendingCard(item, index))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Featured Section (only on Latest tab) */}
          {activeSection === 'latest' && featuredNews.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.sectionTitle}>{t('news.featured')}</Text>
              </View>
              <View style={styles.featuredGrid}>
                {featuredNews.map((item, index) => renderFeaturedCard(item, index))}
              </View>
            </View>
          )}

          {/* News List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name={activeSection === 'bookmarked' ? 'bookmark' : activeSection === 'trending' ? 'flame' : 'newspaper'}
                size={20}
                color="#7C3AED"
              />
              <Text style={styles.sectionTitle}>
                {activeSection === 'bookmarked' ? t('news.savedArticles') : 
                 activeSection === 'trending' ? t('news.trendingArticles') : t('news.allNews')}
              </Text>
              <Text style={styles.sectionCount}>{displayNews.length} articles</Text>
            </View>

            {displayNews.length > 0 ? (
              <View style={styles.newsList}>
                {displayNews.map((item, index) => renderNewsCard(item, index))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name={activeSection === 'bookmarked' ? 'bookmark-outline' : 'newspaper-outline'}
                  size={48}
                  color="#5A5A6E"
                />
                <Text style={styles.emptyText}>
                  {activeSection === 'bookmarked'
                    ? t('news.noSaved')
                    : t('news.noNews')}
                </Text>
                <Text style={styles.emptySubtext}>
                  {activeSection === 'bookmarked'
                    ? t('news.clickBookmark')
                    : t('news.modifyFilters')}
                </Text>
              </View>
            )}

            {/* Load More */}
            {hasMore && displayNews.length > 0 && activeSection === 'latest' && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} data-testid="load-more-news-btn">
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#7C3AED" />
                    <Text style={styles.loadMoreText}>{t("news.loadMore")}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* News Detail Modal */}
      <Modal
        visible={showNewsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNews && (
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowNewsModal(false)} style={styles.modalCloseBtn} data-testid="close-news-modal">
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={styles.modalActions}>
                    <TouchableOpacity onPress={() => handleBookmark(selectedNews.id)} style={styles.modalActionBtn}>
                      <Ionicons
                        name={bookmarkedNews.has(selectedNews.id) ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={bookmarkedNews.has(selectedNews.id) ? '#7C3AED' : '#8B8B9E'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShareNews(selectedNews)} style={styles.modalActionBtn}>
                      <Ionicons name="share-outline" size={22} color="#8B8B9E" />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Image source={{ uri: selectedNews.image_url }} style={styles.modalImage} resizeMode="cover" />

                  <View style={styles.modalMeta}>
                    <View style={[styles.modalCategoryBadge, { backgroundColor: `${getCategoryColor(selectedNews.category)}15` }]}>
                      <Text style={[styles.modalCategoryText, { color: getCategoryColor(selectedNews.category) }]}>
                        {getCategoryLabel(selectedNews.category)}
                      </Text>
                    </View>
                    <View style={[styles.modalImpactBadge, { backgroundColor: `${getImpactColor(selectedNews.impact)}15` }]}>
                      <Ionicons name={getImpactIcon(selectedNews.impact)} size={14} color={getImpactColor(selectedNews.impact)} />
                      <Text style={[styles.modalImpactText, { color: getImpactColor(selectedNews.impact) }]}>
                        {getImpactText(selectedNews.impact)}
                      </Text>
                    </View>
                  </View>

                  {selectedNews.impact_reason && (
                    <View style={[styles.modalImpactReason, { backgroundColor: `${getImpactColor(selectedNews.impact)}08`, borderColor: getImpactColor(selectedNews.impact) }]}>
                      <Ionicons
                        name={selectedNews.impact === 'bullish' ? 'trending-up' : selectedNews.impact === 'bearish' ? 'trending-down' : 'information-circle'}
                        size={24}
                        color={getImpactColor(selectedNews.impact)}
                      />
                      <View style={styles.modalImpactReasonContent}>
                        <Text style={styles.modalImpactReasonLabel}>
                          Pourquoi c'est {getImpactText(selectedNews.impact).toLowerCase()} ?
                        </Text>
                        <Text style={[styles.modalImpactReasonText, { color: getImpactColor(selectedNews.impact) }]}>
                          {selectedNews.impact_reason}
                        </Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.modalTitle}>{selectedNews.title}</Text>

                  <View style={styles.modalSourceRow}>
                    <View style={styles.modalSourceInfo}>
                      <View style={styles.modalSourceIcon}>
                        <Ionicons name="newspaper" size={14} color="#7C3AED" />
                      </View>
                      <Text style={styles.modalSourceText}>{selectedNews.source}</Text>
                    </View>
                    <Text style={styles.modalDate}>{formatTimeAgo(selectedNews.published_at)}</Text>
                  </View>

                  <Text style={styles.modalSummary}>{selectedNews.summary}</Text>

                  {selectedNews.tags && selectedNews.tags.length > 0 && (
                    <View style={styles.modalTags}>
                      {selectedNews.tags.map((tag, index) => (
                        <View key={index} style={styles.modalTag}>
                          <Text style={styles.modalTagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    {selectedNews.link && (
                      <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => handleOpenLink(selectedNews.link)} data-testid="open-news-link">
                        <Ionicons name="open-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.modalPrimaryBtnText}>Lire l'article complet</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => handleShareNews(selectedNews)}>
                      <Ionicons name="share-social" size={20} color="#7C3AED" />
                      <Text style={styles.modalSecondaryBtnText}>{t("common.share")}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 30 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: '#8B8B9E', marginTop: 16 },
  safeArea: { flex: 1 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D9A5' },
  refreshBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124, 58, 237, 0.15)', alignItems: 'center', justifyContent: 'center' },

  // Flash Banner
  flashBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 16, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  flashBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10, gap: 4 },
  flashBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  flashScroll: { flex: 1 },
  flashItem: { flexDirection: 'row', alignItems: 'center' },
  flashDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  flashText: { fontSize: 12, color: '#FFFFFF', fontWeight: '500', marginRight: 8 },
  flashDivider: { color: '#5A5A6E', marginRight: 8 },

  // Sentiment Card
  sentimentCard: { marginHorizontal: 16, backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A4E' },
  sentimentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sentimentTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  sentimentBar: { height: 8, backgroundColor: '#2A2A4E', borderRadius: 4, flexDirection: 'row', overflow: 'hidden', marginBottom: 10 },
  sentimentFill: { height: '100%' },
  bullishFill: { backgroundColor: '#00D9A5' },
  bearishFill: { backgroundColor: '#EF4444' },
  sentimentLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sentimentLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sentimentDot: { width: 8, height: 8, borderRadius: 4 },
  sentimentLabelText: { fontSize: 12, color: '#8B8B9E' },

  // Search
  searchContainer: { paddingHorizontal: 16, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2A2A4E' },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14, paddingHorizontal: 10 },

  // Section Tabs
  sectionTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  sectionTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#1A1A2E', gap: 8 },
  sectionTabActive: { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
  sectionTabText: { fontSize: 13, fontWeight: '600', color: '#8B8B9E' },
  sectionTabTextActive: { color: '#7C3AED' },
  sectionTabBadge: { backgroundColor: '#7C3AED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  sectionTabBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  scrollView: { flex: 1 },

  // Categories
  categoriesScroll: { marginBottom: 12 },
  categoriesContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E', gap: 6 },
  categoryPillActive: { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: '#7C3AED' },
  categoryPillText: { fontSize: 12, fontWeight: '500', color: '#8B8B9E' },

  // Impact Filter
  impactFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  filterLabel: { fontSize: 13, color: '#8B8B9E', marginRight: 10 },
  impactFilters: { flexDirection: 'row', gap: 8 },
  impactPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E', gap: 4 },
  impactPillActive: { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: '#7C3AED' },
  impactPillText: { fontSize: 11, fontWeight: '500', color: '#8B8B9E' },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  sectionCount: { fontSize: 13, color: '#8B8B9E' },

  // Trending
  trendingGrid: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  trendingCard: { width: 260, height: 200, borderRadius: 16, overflow: 'hidden' },
  trendingImage: { width: '100%', height: '100%', backgroundColor: '#2A2A4E' },
  trendingGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 50 },
  trendingRank: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(124, 58, 237, 0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  trendingRankText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  trendingImpactBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4, marginBottom: 8 },
  trendingImpactText: { fontSize: 11, fontWeight: '600' },
  trendingTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', lineHeight: 20 },
  trendingMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  trendingSource: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  trendingViews: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendingViewsText: { fontSize: 11, color: '#8B8B9E' },

  // Featured
  featuredGrid: { gap: 12 },
  featuredCard: { height: 180, borderRadius: 16, overflow: 'hidden' },
  featuredCardLarge: { height: 220 },
  featuredImage: { width: '100%', height: '100%', backgroundColor: '#2A2A4E' },
  featuredGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 40 },
  featuredImpactBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4, marginBottom: 8 },
  featuredImpactText: { fontSize: 11, fontWeight: '600' },
  featuredTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', lineHeight: 22 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  featuredSource: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  featuredTime: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 4 },

  // News List
  newsList: { gap: 12 },
  newsCard: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A4E' },
  newsCardNew: { borderColor: '#00D9A5', borderWidth: 1.5 },
  newBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 217, 165, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 },
  newBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D9A5' },
  newBadgeText: { fontSize: 10, fontWeight: '700', color: '#00D9A5' },
  newsImage: { width: 110, height: 140, backgroundColor: '#2A2A4E' },
  newsContent: { flex: 1, padding: 14 },
  newsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 10, fontWeight: '600' },
  bookmarkBtn: { padding: 4 },
  impactReasonBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginBottom: 8, gap: 4 },
  impactReasonText: { fontSize: 10, fontWeight: '600' },
  newsTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', lineHeight: 20, marginBottom: 4 },
  newsSummary: { fontSize: 12, color: '#8B8B9E', lineHeight: 16, marginBottom: 8 },
  newsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newsSourceRow: { flexDirection: 'row', alignItems: 'center' },
  newsSource: { fontSize: 11, color: '#7C3AED', fontWeight: '500' },
  newsTime: { fontSize: 11, color: '#5A5A6E', marginLeft: 4 },
  newsActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, backgroundColor: '#2A2A4E', borderRadius: 6 },

  // Load More
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124, 58, 237, 0.15)', paddingVertical: 14, borderRadius: 14, marginTop: 16, gap: 8 },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#8B8B9E', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#5A5A6E', marginTop: 4, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0A0A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', borderWidth: 1, borderColor: '#2A2A4E', borderBottomWidth: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  modalCloseBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalActionBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },
  modalImage: { width: '100%', height: 200, borderRadius: 16, backgroundColor: '#2A2A4E', marginBottom: 16 },
  modalMeta: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modalCategoryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  modalCategoryText: { fontSize: 12, fontWeight: '600' },
  modalImpactBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 6 },
  modalImpactText: { fontSize: 12, fontWeight: '600' },
  modalImpactReason: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16, gap: 12 },
  modalImpactReasonContent: { flex: 1 },
  modalImpactReasonLabel: { fontSize: 12, color: '#8B8B9E', marginBottom: 4 },
  modalImpactReasonText: { fontSize: 16, fontWeight: '700' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  modalSourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalSourceInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalSourceIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.15)', alignItems: 'center', justifyContent: 'center' },
  modalSourceText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  modalDate: { fontSize: 13, color: '#8B8B9E' },
  modalSummary: { fontSize: 16, color: '#C4C4C4', lineHeight: 26, marginBottom: 20 },
  modalTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  modalTag: { backgroundColor: '#1A1A2E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2A2A4E' },
  modalTagText: { fontSize: 13, color: '#8B8B9E', fontWeight: '500' },
  modalButtons: { gap: 12 },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, gap: 10 },
  modalPrimaryBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  modalSecondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124, 58, 237, 0.15)', paddingVertical: 16, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: '#7C3AED' },
  modalSecondaryBtnText: { fontSize: 16, fontWeight: '600', color: '#7C3AED' },
});
