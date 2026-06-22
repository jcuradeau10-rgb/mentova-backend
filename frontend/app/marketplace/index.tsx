import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { marketplaceAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';
import { useContentTranslation } from '../../hooks/useContentTranslation';

interface ContentPreview {
  id: string;
  title: string;
  content_type: string;
  duration_minutes?: number;
  is_premium?: boolean;
}

interface MarketplaceOffer {
  id: string;
  pro_id: string;
  pro_name?: string;
  pro_avatar?: string;
  pro?: {
    name: string;
    avatar_url?: string;
    expertise_area?: string;
    rating: number;
    total_reviews: number;
    bio?: string;
    badge?: string;
    display_name?: string;
  };
  offer_type: string;
  title: string;
  description?: string;
  short_description?: string;
  price: number;
  currency: string;
  pricing_model: string;
  subscription_interval?: string;
  included_content_ids: string[];
  included_contents_preview?: ContentPreview[];
  access_duration_days?: number;
  category?: string;
  difficulty?: string;
  tags: string[];
  total_sales: number;
  rating?: number;
  created_at: string;
}

export default function MarketplacePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const { translateContent, language } = useContentTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [translatedOffers, setTranslatedOffers] = useState<Record<string, Record<string, string>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOfferDetail, setShowOfferDetail] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<MarketplaceOffer | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const OFFER_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    bundle: { icon: 'layers', color: '#F59E0B', label: t('marketplace.offerType.bundle') },
    single: { icon: 'document', color: '#3B82F6', label: t('marketplace.offerType.single') },
    single_content: { icon: 'document', color: '#3B82F6', label: t('marketplace.offerType.single') },
    mentoring: { icon: 'people', color: '#7C3AED', label: t('marketplace.offerType.mentoring') },
    subscription: { icon: 'repeat', color: '#10B981', label: t('marketplace.offerType.subscription') },
    coaching_pack: { icon: 'school', color: '#EC4899', label: t('marketplace.offerType.coachingPack') },
    service_package: { icon: 'briefcase', color: '#06B6D4', label: t('marketplace.offerType.servicePack') },
    custom: { icon: 'construct', color: '#EF4444', label: t('marketplace.offerType.custom') },
  };

  const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
    beginner: { label: t('marketplace.difficulty.beginner'), color: '#10B981' },
    intermediate: { label: t('marketplace.difficulty.intermediate'), color: '#F59E0B' },
    advanced: { label: t('marketplace.difficulty.advanced'), color: '#EF4444' },
    all_levels: { label: t('marketplace.difficulty.allLevels'), color: '#3B82F6' },
  };

  const CONTENT_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    pdf: { icon: 'document-text', color: '#EF4444', label: t('marketplace.contentType.pdf') },
    video: { icon: 'videocam', color: '#3B82F6', label: t('marketplace.contentType.video') },
    audio: { icon: 'headset', color: '#8B5CF6', label: t('marketplace.contentType.audio') },
    text: { icon: 'document', color: '#6B7280', label: t('marketplace.contentType.text') },
    quiz: { icon: 'help-circle', color: '#F59E0B', label: t('marketplace.contentType.quiz') },
    session: { icon: 'people', color: '#10B981', label: t('marketplace.contentType.session') },
    'session-live': { icon: 'videocam', color: '#10B981', label: t('marketplace.contentType.session') },
    template: { icon: 'copy', color: '#EC4899', label: t('marketplace.contentType.template') },
    link: { icon: 'link', color: '#06B6D4', label: t('marketplace.contentType.link') },
    course: { icon: 'school', color: '#7C3AED', label: t('marketplace.contentType.course') },
  };

  const CATEGORIES = [
    { id: 'all', label: t('marketplace.category.all'), icon: 'grid' },
    { id: 'trading', label: t('marketplace.category.trading'), icon: 'trending-up' },
    { id: 'defi', label: t('marketplace.category.defi'), icon: 'swap-horizontal' },
    { id: 'nft', label: t('marketplace.category.nft'), icon: 'image' },
    { id: 'development', label: t('marketplace.category.dev'), icon: 'code-slash' },
    { id: 'security', label: t('marketplace.category.security'), icon: 'shield-checkmark' },
  ];

  const loadOffers = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      
      const response = await marketplaceAPI.getOffers(params);
      setOffers(response.data.data || []);
    } catch (error) {
      console.error('Error loading offers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  // Translate offer content when language changes
  useEffect(() => {
    if (language === 'en' || offers.length === 0) {
      setTranslatedOffers({});
      return;
    }
    const translateOffers = async () => {
      const textsToTranslate: Record<string, string> = {};
      offers.forEach((offer, i) => {
        if (offer.title) textsToTranslate[`title_${i}`] = offer.title;
        if (offer.short_description) textsToTranslate[`short_${i}`] = offer.short_description;
        if (offer.description) textsToTranslate[`desc_${i}`] = offer.description;
        if (offer.pro?.bio) textsToTranslate[`bio_${i}`] = offer.pro.bio;
      });
      const translated = await translateContent(textsToTranslate);
      const mapped: Record<string, Record<string, string>> = {};
      offers.forEach((offer, i) => {
        mapped[offer.id] = {
          title: translated[`title_${i}`] || offer.title,
          short_description: translated[`short_${i}`] || offer.short_description || '',
          description: translated[`desc_${i}`] || offer.description || '',
          bio: translated[`bio_${i}`] || offer.pro?.bio || '',
        };
      });
      setTranslatedOffers(mapped);
    };
    translateOffers();
  }, [offers, language]);

  const getOfferText = (offer: MarketplaceOffer, field: 'title' | 'short_description' | 'description' | 'bio') => {
    if (field === 'bio') {
      return translatedOffers[offer.id]?.bio || offer.pro?.bio || '';
    }
    return translatedOffers[offer.id]?.[field] || (offer as any)[field] || '';
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOffers();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const openOfferDetail = async (offer: MarketplaceOffer) => {
    setSelectedOffer(offer);
    setShowOfferDetail(true);
    setDetailLoading(true);
    
    try {
      const response = await marketplaceAPI.getOffer(offer.id);
      if (response.data.data) {
        setSelectedOffer(response.data.data);
      }
    } catch (error) {
      console.error('Error loading offer details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const getContentTypeConfig = (type: string) => {
    return CONTENT_TYPE_CONFIG[type] || { icon: 'cube', color: '#6B7280', label: t('marketplace.contentType.content') };
  };

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        t('marketplace.loginRequired'),
        t('marketplace.loginToPurchase'),
        [
          { text: t('marketplace.cancel'), style: 'cancel' },
          { text: t('marketplace.signIn'), onPress: () => router.push('/login') }
        ]
      );
      return;
    }

    if (!user?.is_vip) {
      // Allow browsing - just show a subtle upgrade message when purchasing
      Alert.alert(
        t('marketplace.upgradeTitle') || 'VIP',
        t('marketplace.upgradeSubtle') || 'Upgrade to VIP to purchase content from mentors.',
        [
          { text: t('marketplace.cancel') || 'Cancel', style: 'cancel' },
          { text: t('marketplace.learnMore') || 'Learn More', onPress: () => router.push('/vip') }
        ]
      );
      return;
    }

    if (!selectedOffer) {
      Alert.alert(t('marketplace.error'), t('marketplace.noOfferSelected'));
      return;
    }

    setPurchaseLoading(true);
    try {
      const response = await marketplaceAPI.purchaseOffer(selectedOffer.id);
      const checkoutUrl = response.data?.checkout_url;
      
      if (checkoutUrl) {
        setShowOfferDetail(false);
        setPurchaseLoading(false);
        
        if (Platform.OS !== 'web') {
          await WebBrowser.openBrowserAsync(checkoutUrl);
        } else {
          window.location.href = checkoutUrl;
        }
      } else {
        throw new Error(t('marketplace.paymentUrlError'));
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert(t('marketplace.error'), error.response?.data?.detail || error.message || t('marketplace.purchaseError'));
      setPurchaseLoading(false);
    }
  };

  const getOfferTypeConfig = (type: string) => {
    return OFFER_TYPE_CONFIG[type] || OFFER_TYPE_CONFIG.custom;
  };

  const getDifficultyConfig = (difficulty: string) => {
    return DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.all_levels;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t('marketplace.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('marketplace.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('marketplace.offersAvailable', { count: String(offers.length) })}</Text>
        </View>
        <TouchableOpacity 
          style={styles.myPurchasesBtn}
          onPress={() => router.push('/vip/purchases')}
        >
          <Ionicons name="bag" size={20} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('marketplace.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons 
              name={cat.icon as any} 
              size={16} 
              color={selectedCategory === cat.id ? '#FFF' : '#9CA3AF'} 
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === cat.id && styles.categoryTextActive
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Subtle VIP hint for non-VIP users */}
      {isAuthenticated && !user?.is_vip && (
        <TouchableOpacity 
          style={styles.vipHint}
          onPress={() => router.push('/vip')}
        >
          <Ionicons name="diamond-outline" size={14} color="#A78BFA" />
          <Text style={styles.vipHintText}>
            {t('marketplace.vipHint') || 'VIP members get exclusive discounts'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#6B7280" />
        </TouchableOpacity>
      )}

      {/* Offers Grid */}
      <ScrollView
        style={styles.offersContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {offers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyTitle}>{t('marketplace.noOffers')}</Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? t('marketplace.tryOtherSearch') 
                : t('marketplace.noOffersYet')
              }
            </Text>
          </View>
        ) : (
          <View style={styles.offersGrid}>
            {offers.map(offer => {
              const typeConfig = getOfferTypeConfig(offer.offer_type);
              const difficultyConfig = getDifficultyConfig(offer.difficulty || 'all_levels');
              
              return (
                <TouchableOpacity
                  key={offer.id}
                  style={styles.offerCard}
                  onPress={() => openOfferDetail(offer)}
                  data-testid={`marketplace-offer-${offer.id}`}
                >
                  <View style={[styles.offerTypeBadge, { backgroundColor: typeConfig.color + '20' }]}>
                    <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
                    <Text style={[styles.offerTypeText, { color: typeConfig.color }]}>
                      {typeConfig.label}
                    </Text>
                  </View>

                  <Text style={styles.offerTitle} numberOfLines={2}>{getOfferText(offer, 'title')}</Text>
                  {offer.short_description && (
                    <Text style={styles.offerDesc} numberOfLines={2}>{getOfferText(offer, 'short_description')}</Text>
                  )}

                  {/* Mentor Profile Section */}
                  <View style={styles.proInfo} data-testid={`offer-pro-info-${offer.id}`}>
                    <View style={styles.proAvatar}>
                      <Text style={styles.proAvatarText}>
                        {(offer.pro?.name || offer.pro_name || 'P').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.proDetails}>
                      <View style={styles.proNameRow}>
                        <Text style={styles.proName} numberOfLines={1}>{offer.pro?.display_name || offer.pro?.name || offer.pro_name || 'Pro'}</Text>
                        {offer.pro?.badge && (
                          <View style={styles.proBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#7C3AED" />
                          </View>
                        )}
                      </View>
                      <View style={styles.proRatingRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Ionicons
                            key={star}
                            name={star <= Math.round(offer.pro?.rating || 0) ? 'star' : 'star-outline'}
                            size={11}
                            color="#F59E0B"
                          />
                        ))}
                        <Text style={styles.proRatingText}>
                          {(offer.pro?.rating || 0).toFixed(1)} ({offer.pro?.total_reviews || 0})
                        </Text>
                      </View>
                      {offer.pro?.expertise_area && (
                        <Text style={styles.proExpertise} numberOfLines={1}>{offer.pro.expertise_area}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.offerMeta}>
                    {offer.difficulty && (
                      <View style={[styles.difficultyBadge, { backgroundColor: difficultyConfig.color + '20' }]}>
                        <Text style={[styles.difficultyText, { color: difficultyConfig.color }]}>
                          {difficultyConfig.label}
                        </Text>
                      </View>
                    )}
                    {(offer.included_content_ids?.length || 0) > 0 && (
                    <View style={styles.contentCount}>
                      <Ionicons name="cube-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.contentCountText}>
                        {offer.included_content_ids.length}
                      </Text>
                    </View>
                    )}
                    {offer.total_sales > 0 && (
                      <View style={styles.salesCount}>
                        <Ionicons name="cart-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.salesCountText}>{offer.total_sales}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.priceRow}>
                    <View style={styles.priceTag}>
                      <Text style={styles.priceValue}>
                        {offer.price === 0 ? t('marketplace.free') : `$${offer.price}`}
                      </Text>
                      {offer.pricing_model === 'subscription' && (
                        <Text style={styles.priceInterval}>
                          /{offer.subscription_interval === 'monthly' ? t('marketplace.monthly') : t('marketplace.yearly')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.viewBtn}>
                      <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Offer Detail Modal */}
      <Modal visible={showOfferDetail} animationType="slide" presentationStyle="pageSheet">
        {selectedOffer && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowOfferDetail(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('marketplace.offerDetail')}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={[
                styles.modalTypeBadge, 
                { backgroundColor: getOfferTypeConfig(selectedOffer.offer_type).color + '20' }
              ]}>
                <Ionicons 
                  name={getOfferTypeConfig(selectedOffer.offer_type).icon as any} 
                  size={18} 
                  color={getOfferTypeConfig(selectedOffer.offer_type).color} 
                />
                <Text style={[
                  styles.modalTypeText, 
                  { color: getOfferTypeConfig(selectedOffer.offer_type).color }
                ]}>
                  {getOfferTypeConfig(selectedOffer.offer_type).label}
                </Text>
              </View>

              <Text style={styles.modalOfferTitle}>{getOfferText(selectedOffer, 'title')}</Text>

              {/* Enhanced Mentor Profile Card */}
              <View style={styles.modalProCard} data-testid="modal-pro-card">
                <View style={styles.modalProRow}>
                  <View style={styles.modalProAvatar}>
                    <Text style={styles.modalProAvatarText}>
                      {(selectedOffer.pro?.name || selectedOffer.pro_name || 'P').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.modalProDetailsCol}>
                    <View style={styles.modalProNameRow}>
                      <Text style={styles.modalProName}>
                        {selectedOffer.pro?.display_name || selectedOffer.pro?.name || selectedOffer.pro_name || 'Mentor'}
                      </Text>
                      {selectedOffer.pro?.badge && (
                        <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />
                      )}
                    </View>
                    {selectedOffer.pro?.expertise_area && (
                      <Text style={styles.modalProExpertise}>{selectedOffer.pro.expertise_area}</Text>
                    )}
                    <View style={styles.modalProRatingRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Ionicons
                          key={star}
                          name={star <= Math.round(selectedOffer.pro?.rating || 0) ? 'star' : 'star-outline'}
                          size={14}
                          color="#F59E0B"
                        />
                      ))}
                      <Text style={styles.modalProRatingText}>
                        {(selectedOffer.pro?.rating || 0).toFixed(1)}/5 ({selectedOffer.pro?.total_reviews || 0} {t('marketplace.reviews')})
                      </Text>
                    </View>
                  </View>
                </View>
                {selectedOffer.pro?.bio && (
                  <Text style={styles.modalProBio} numberOfLines={3}>{getOfferText(selectedOffer, 'bio')}</Text>
                )}
              </View>

              {selectedOffer.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.sectionTitle}>{t('marketplace.description')}</Text>
                  <Text style={styles.descriptionText}>{getOfferText(selectedOffer, 'description')}</Text>
                </View>
              )}

              <View style={styles.includedSection}>
                <Text style={styles.sectionTitle}>{t('marketplace.whatsIncluded')}</Text>
                
                {detailLoading ? (
                  <View style={styles.contentLoadingContainer}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text style={styles.contentLoadingText}>{t('marketplace.loadingDetails')}</Text>
                  </View>
                ) : selectedOffer.included_contents_preview && selectedOffer.included_contents_preview.length > 0 ? (
                  <View style={styles.contentsList}>
                    {selectedOffer.included_contents_preview.map((content, index) => {
                      const contentConfig = getContentTypeConfig(content.content_type);
                      return (
                        <View key={content.id || index} style={styles.contentItem}>
                          <View style={[styles.contentIcon, { backgroundColor: contentConfig.color + '20' }]}>
                            <Ionicons name={contentConfig.icon as any} size={18} color={contentConfig.color} />
                          </View>
                          <View style={styles.contentInfo}>
                            <Text style={styles.contentTitle} numberOfLines={1}>{content.title}</Text>
                            <View style={styles.contentMeta}>
                              <Text style={[styles.contentType, { color: contentConfig.color }]}>
                                {contentConfig.label}
                              </Text>
                              {content.duration_minutes && (
                                <Text style={styles.contentDuration}>
                                  {content.duration_minutes} min
                                </Text>
                              )}
                              {content.is_premium && (
                                <View style={styles.premiumBadge}>
                                  <Ionicons name="diamond" size={10} color="#FFD700" />
                                  <Text style={styles.premiumText}>{t("marketplace.premium")}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : selectedOffer.included_content_ids?.length > 0 ? (
                  <View style={styles.includedList}>
                    <View style={styles.includedItem}>
                      <Ionicons name="cube" size={18} color="#7C3AED" />
                      <Text style={styles.includedText}>
                        {t('marketplace.premiumContents', { count: String(selectedOffer.included_content_ids.length) })}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.includedList}>
                    <View style={styles.includedItem}>
                      <Ionicons name="lock-closed" size={18} color="#7C3AED" />
                      <Text style={styles.includedText}>
                        {t('marketplace.exclusiveAccess')}
                      </Text>
                    </View>
                  </View>
                )}
                
                <View style={styles.accessDuration}>
                  {selectedOffer.access_duration_days ? (
                    <View style={styles.includedItem}>
                      <Ionicons name="time" size={18} color="#F59E0B" />
                      <Text style={styles.includedText}>
                        {t('marketplace.accessDuration', { days: String(selectedOffer.access_duration_days) })}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.includedItem}>
                      <Ionicons name="infinite" size={18} color="#10B981" />
                      <Text style={styles.includedText}>{t('marketplace.lifetimeAccess')}</Text>
                    </View>
                  )}
                </View>
              </View>

              {selectedOffer.tags?.length > 0 && (
                <View style={styles.tagsSection}>
                  <Text style={styles.sectionTitle}>{t('marketplace.tags')}</Text>
                  <View style={styles.tagsRow}>
                    {selectedOffer.tags.map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.statsSection}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{selectedOffer.total_sales}</Text>
                  <Text style={styles.statLabel}>{t('marketplace.sales')}</Text>
                </View>
                {selectedOffer.rating && (
                  <View style={styles.statBox}>
                    <View style={styles.ratingRow}>
                      <Text style={styles.statValue}>{selectedOffer.rating}</Text>
                      <Ionicons name="star" size={16} color="#FFD700" />
                    </View>
                    <Text style={styles.statLabel}>{t('marketplace.rating')}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.purchaseFooter}>
              <View style={styles.purchasePrice}>
                <Text style={styles.purchasePriceLabel}>{t('marketplace.price')}</Text>
                <Text style={styles.purchasePriceValue}>
                  {selectedOffer.price === 0 ? t('marketplace.free') : `$${selectedOffer.price}`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.purchaseBtn}
                onPress={handlePurchase}
                disabled={purchaseLoading}
              >
                <LinearGradient
                  colors={['#7C3AED', '#5B21B6']}
                  style={styles.purchaseBtnGradient}
                >
                  {purchaseLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="cart" size={18} color="#FFF" />
                      <Text style={styles.purchaseBtnText}>{t('marketplace.buyNow')}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  loadingText: { color: '#9CA3AF', marginTop: 12, fontSize: 16 },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { padding: 8 },
  headerContent: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  myPurchasesBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },
  categoriesContainer: { maxHeight: 50 },
  categoriesContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A', marginRight: 8, gap: 6 },
  categoryChipActive: { backgroundColor: '#7C3AED' },
  categoryText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  categoryTextActive: { color: '#FFF' },
  vipHint: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, paddingVertical: 8, paddingHorizontal: 12, gap: 6, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(124,58,237,0.1)' },
  vipHintText: { flex: 1, fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  offersContainer: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  offersGrid: { gap: 16 },
  offerCard: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  offerTypeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 6, marginBottom: 10 },
  offerTypeText: { fontSize: 11, fontWeight: '600' },
  offerTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  offerDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 18, marginBottom: 12 },
  proInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10, backgroundColor: '#12121F', padding: 10, borderRadius: 12 },
  proAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  proAvatarText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  proDetails: { flex: 1 },
  proNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  proName: { fontSize: 13, color: '#E0E0E0', fontWeight: '600' },
  proBadge: { marginLeft: 2 },
  proRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  proRatingText: { fontSize: 10, color: '#9CA3AF', marginLeft: 3 },
  proExpertise: { fontSize: 10, color: '#7C3AED', marginTop: 2 },
  offerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  difficultyText: { fontSize: 10, fontWeight: '600' },
  contentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contentCountText: { fontSize: 12, color: '#9CA3AF' },
  salesCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  salesCountText: { fontSize: 12, color: '#9CA3AF' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceTag: { flexDirection: 'row', alignItems: 'baseline' },
  priceValue: { fontSize: 20, fontWeight: '800', color: '#10B981' },
  priceInterval: { fontSize: 12, color: '#10B981', marginLeft: 2 },
  viewBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#7C3AED20', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, backgroundColor: '#0F0F0F' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#1A1A1A' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  modalContent: { flex: 1, padding: 16 },
  modalTypeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 8, marginBottom: 16 },
  modalTypeText: { fontSize: 13, fontWeight: '600' },
  modalOfferTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 16 },
  modalProCard: { backgroundColor: '#1A1A2E', borderRadius: 14, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#2D2D44' },
  modalProRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalProAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  modalProAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalProDetailsCol: { flex: 1 },
  modalProNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  modalProName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  modalProExpertise: { fontSize: 12, color: '#7C3AED', marginBottom: 4 },
  modalProRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  modalProRatingText: { fontSize: 12, color: '#9CA3AF', marginLeft: 4 },
  modalProBio: { fontSize: 13, color: '#9CA3AF', lineHeight: 18, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2D2D44' },
  descriptionSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 10 },
  descriptionText: { fontSize: 14, color: '#C4C4C4', lineHeight: 22 },
  includedSection: { marginBottom: 24 },
  includedList: { gap: 10 },
  includedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 14, borderRadius: 12, gap: 12 },
  includedText: { fontSize: 14, color: '#E0E0E0' },
  contentsList: { gap: 8 },
  contentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 12, borderRadius: 12, gap: 12 },
  contentIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contentInfo: { flex: 1 },
  contentTitle: { fontSize: 14, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  contentMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contentType: { fontSize: 12, fontWeight: '500' },
  contentDuration: { fontSize: 12, color: '#9CA3AF' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70020', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 3 },
  premiumText: { fontSize: 10, color: '#FFD700', fontWeight: '600' },
  accessDuration: { marginTop: 12 },
  contentLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  contentLoadingText: { fontSize: 14, color: '#9CA3AF' },
  tagsSection: { marginBottom: 24 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#2A2A2A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 12, color: '#9CA3AF' },
  statsSection: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: '#1A1A1A', padding: 16, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  purchaseFooter: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#2A2A2A', backgroundColor: '#1A1A1A' },
  purchasePrice: { marginRight: 16 },
  purchasePriceLabel: { fontSize: 12, color: '#9CA3AF' },
  purchasePriceValue: { fontSize: 24, fontWeight: '800', color: '#10B981' },
  purchaseBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  purchaseBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  purchaseBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
