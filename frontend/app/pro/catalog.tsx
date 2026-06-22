import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { proAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Types
interface ContentItem {
  id: string;
  content_type: 'pdf' | 'video' | 'quiz' | 'audio' | 'text' | 'checklist' | 'session' | 'course';
  title: string;
  description?: string;
  content_data?: any;
  file_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_minutes?: number;
  price?: number;
  tags: string[];
  is_premium: boolean;
  usage_count: number;
  created_at: string;
}

interface ProOffer {
  id: string;
  offer_type: string;
  title: string;
  description?: string;
  short_description?: string;
  price: number;
  currency: string;
  pricing_model: string;
  included_content_ids: string[];
  is_published: boolean;
  total_sales: number;
  total_revenue: number;
  created_at: string;
}

// Config
const CONTENT_TYPES = [
  { id: 'pdf', labelKey: 'catalog.typePDF', icon: 'document-text', color: '#EF4444' },
  { id: 'video', labelKey: 'catalog.typeVideo', icon: 'videocam', color: '#8B5CF6' },
  { id: 'quiz', labelKey: 'catalog.typeQuiz', icon: 'help-circle', color: '#3B82F6' },
  { id: 'audio', labelKey: 'catalog.typeAudio', icon: 'musical-notes', color: '#10B981' },
  { id: 'text', labelKey: 'catalog.typeArticle', icon: 'reader', color: '#F59E0B' },
  { id: 'checklist', labelKey: 'catalog.typeChecklist', icon: 'checkbox', color: '#EC4899' },
  { id: 'session', labelKey: 'catalog.typeSession', icon: 'people', color: '#06B6D4' },
  { id: 'course', labelKey: 'catalog.typeCourse', icon: 'school', color: '#7C3AED' },
];

const OFFER_TYPES = [
  { id: 'single', labelKey: 'catalog.offerTypeSingle', icon: 'document', descKey: 'catalog.offerTypeSingleDesc' },
  { id: 'bundle', labelKey: 'catalog.offerTypeBundle', icon: 'layers', descKey: 'catalog.offerTypeBundleDesc' },
  { id: 'mentoring', labelKey: 'catalog.offerTypeMentoring', icon: 'people', descKey: 'catalog.offerTypeMentoringDesc' },
  { id: 'subscription', labelKey: 'catalog.offerTypeSubscription', icon: 'repeat', descKey: 'catalog.offerTypeSubscriptionDesc' },
];

const PRICING_MODELS = [
  { id: 'one_time', labelKey: 'catalog.pricingOneTime', icon: 'card' },
  { id: 'subscription', labelKey: 'catalog.pricingSubscription', icon: 'repeat' },
  { id: 'free', labelKey: 'catalog.pricingFree', icon: 'gift' },
];

type ViewMode = 'contents' | 'offers';

export default function CatalogPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('contents');
  
  // Data
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [offers, setOffers] = useState<ProOffer[]>([]);
  
  // Modals
  const [showContentModal, setShowContentModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [editingOffer, setEditingOffer] = useState<ProOffer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Content Form
  const [contentForm, setContentForm] = useState({
    content_type: 'pdf' as string,
    title: '',
    description: '',
    file_url: '',
    video_url: '',
    duration_minutes: '',
    price: '',
    tags: '',
    is_premium: false,
    // Session specific
    max_participants: '1',
    session_type: 'one_on_one', // one_on_one, group, webinar
    meeting_link: '', // Zoom/Meet/Teams link
    // Availability scheduling
    has_scheduled_availability: false,
    available_from_date: '',
    available_from_time: '',
  });
  
  // Quiz questions
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    question: string;
    options: string[];
    correct_answer: number;
  }>>([{ question: '', options: ['', '', '', ''], correct_answer: 0 }]);
  
  // Offer Form
  const [offerForm, setOfferForm] = useState({
    offer_type: 'single',
    title: '',
    description: '',
    short_description: '',
    price: '',
    pricing_model: 'one_time',
    included_content_ids: [] as string[],
    is_published: false,
  });
  
  const [showContentPicker, setShowContentPicker] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [contentsRes, offersRes] = await Promise.all([
        proAPI.getContentLibrary(),
        proAPI.getOffers(),
      ]);
      setContents(contentsRes.data.data || []);
      setOffers(offersRes.data.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Reset forms
  const resetContentForm = () => {
    setContentForm({
      content_type: 'pdf',
      title: '',
      description: '',
      file_url: '',
      video_url: '',
      duration_minutes: '',
      price: '',
      tags: '',
      is_premium: false,
      max_participants: '1',
      session_type: 'one_on_one',
      meeting_link: '',
      has_scheduled_availability: false,
      available_from_date: '',
      available_from_time: '',
    });
    setQuizQuestions([{ question: '', options: ['', '', '', ''], correct_answer: 0 }]);
    setEditingContent(null);
  };

  const resetOfferForm = () => {
    setOfferForm({
      offer_type: 'single',
      title: '',
      description: '',
      short_description: '',
      price: '',
      pricing_model: 'one_time',
      included_content_ids: [],
      is_published: false,
    });
    setEditingOffer(null);
  };

  // Open modals
  const openContentModal = (content?: ContentItem) => {
    if (content) {
      setEditingContent(content);
      const availableFrom = (content as any).available_from;
      let hasScheduled = false;
      let dateStr = '';
      let timeStr = '';
      if (availableFrom) {
        hasScheduled = true;
        try {
          const dt = new Date(availableFrom);
          dateStr = dt.toISOString().split('T')[0];
          timeStr = dt.toISOString().split('T')[1]?.substring(0, 5) || '';
        } catch { }
      }
      setContentForm({
        content_type: content.content_type,
        title: content.title,
        description: content.description || '',
        file_url: content.file_url || '',
        video_url: content.video_url || '',
        duration_minutes: content.duration_minutes?.toString() || '',
        price: content.price?.toString() || '',
        tags: content.tags.join(', '),
        is_premium: content.is_premium,
        max_participants: content.content_data?.max_participants?.toString() || '1',
        session_type: content.content_data?.session_type || 'one_on_one',
        meeting_link: content.content_data?.meeting_link || '',
        has_scheduled_availability: hasScheduled,
        available_from_date: dateStr,
        available_from_time: timeStr,
      });
      if (content.content_type === 'quiz' && content.content_data?.questions) {
        setQuizQuestions(content.content_data.questions);
      }
    } else {
      resetContentForm();
    }
    setShowContentModal(true);
  };

  const openOfferModal = (offer?: ProOffer) => {
    if (offer) {
      setEditingOffer(offer);
      setOfferForm({
        offer_type: offer.offer_type,
        title: offer.title,
        description: offer.description || '',
        short_description: offer.short_description || '',
        price: offer.price.toString(),
        pricing_model: offer.pricing_model,
        included_content_ids: offer.included_content_ids || [],
        is_published: offer.is_published,
      });
    } else {
      resetOfferForm();
    }
    setShowOfferModal(true);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) return;
      
      const file = result.assets[0];
      if (!file) return;

      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/pdf',
      } as any);

      const token = useAuthStore.getState().token;
      const res = await axios.post(`${API_BASE}/api/pro/upload-file`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.data.success) {
        setContentForm(prev => ({ ...prev, file_url: res.data.url }));
        Alert.alert(t('catalog.fileUploadedTitle'), t('catalog.fileUploadedMsg', { name: file.name }));
      }
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.uploadError'));
    } finally {
      setUploadingFile(false);
    }
  };


  // Save content
  const handleSaveContent = async () => {
    if (!contentForm.title.trim()) {
      Alert.alert(t('catalog.error'), t('catalog.titleRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const data: any = {
        content_type: contentForm.content_type,
        title: contentForm.title.trim(),
        description: contentForm.description.trim() || undefined,
        file_url: contentForm.file_url.trim() || undefined,
        video_url: contentForm.video_url.trim() || undefined,
        duration_minutes: contentForm.duration_minutes ? parseInt(contentForm.duration_minutes) : undefined,
        tags: contentForm.tags ? contentForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_premium: contentForm.is_premium,
      };

      // Handle quiz data
      if (contentForm.content_type === 'quiz') {
        const validQuestions = quizQuestions.filter(q => 
          q.question.trim() && q.options.some(o => o.trim())
        );
        if (validQuestions.length === 0) {
          Alert.alert(t('catalog.error'), t('catalog.addValidQuestion'));
          setActionLoading(false);
          return;
        }
        data.content_data = { questions: validQuestions };
      }

      // Handle session data
      if (contentForm.content_type === 'session') {
        data.content_data = {
          session_type: contentForm.session_type,
          max_participants: parseInt(contentForm.max_participants) || 1,
          price: contentForm.price ? parseFloat(contentForm.price) : 0,
          meeting_link: contentForm.meeting_link.trim() || undefined,
        };
      }

      // Handle scheduled availability
      if (contentForm.has_scheduled_availability && contentForm.available_from_date) {
        const date = contentForm.available_from_date;
        const time = contentForm.available_from_time || '00:00';
        data.available_from = `${date}T${time}:00`;
      }

      if (editingContent) {
        await proAPI.updateContentItem(editingContent.id, data);
      } else {
        await proAPI.createContentItem(data);
      }

      setShowContentModal(false);
      resetContentForm();
      loadData();
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setActionLoading(false);
    }
  };

  // Save offer
  const handleSaveOffer = async () => {
    if (!offerForm.title.trim()) {
      Alert.alert(t('catalog.error'), t('catalog.titleRequired'));
      return;
    }
    if (!offerForm.price && offerForm.pricing_model !== 'free') {
      Alert.alert(t('catalog.error'), t('catalog.priceRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const data: any = {
        offer_type: offerForm.offer_type,
        title: offerForm.title.trim(),
        description: offerForm.description.trim() || undefined,
        short_description: offerForm.short_description.trim() || undefined,
        price: offerForm.pricing_model === 'free' ? 0 : parseFloat(offerForm.price),
        pricing_model: offerForm.pricing_model,
        included_content_ids: offerForm.included_content_ids,
        is_published: offerForm.is_published,
      };

      if (editingOffer) {
        await proAPI.updateOffer(editingOffer.id, data);
      } else {
        await proAPI.createOffer(data);
      }

      setShowOfferModal(false);
      resetOfferForm();
      loadData();

      // Show confirmation message based on publish status
      if (data.is_published) {
        Alert.alert(
          t('catalog.offerPublishedTitle'),
          t('catalog.offerPublishedMsg')
        );
      } else {
        Alert.alert(
          t('catalog.offerSavedTitle'),
          t('catalog.offerSavedDraftMsg')
        );
      }
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setActionLoading(false);
    }
  };

  // Delete handlers - direct delete without Alert confirmation (better mobile compat)
  const handleDeleteContent = async (contentId: string) => {
    try {
      setActionLoading(true);
      await proAPI.deleteContentItem(contentId);
      loadData();
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      setActionLoading(true);
      await proAPI.deleteOffer(offerId);
      loadData();
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle publish
  const handleTogglePublish = async (offer: ProOffer) => {
    try {
      const res = await proAPI.publishOffer(offer.id);
      loadData();
      
      // Show confirmation message
      const isNowPublished = res.data?.is_published;
      if (isNowPublished) {
        Alert.alert(
          t('catalog.offerPublishedTitle'),
          t('catalog.offerPublishedMsg')
        );
      } else {
        Alert.alert(
          t('catalog.offerUnpublishedTitle'),
          t('catalog.offerUnpublishedMsg')
        );
      }
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    }
  };

  // Quiz helpers
  const addQuizQuestion = () => {
    setQuizQuestions([...quizQuestions, { question: '', options: ['', '', '', ''], correct_answer: 0 }]);
  };

  const updateQuizQuestion = (index: number, field: string, value: any) => {
    const updated = [...quizQuestions];
    if (field === 'question') updated[index].question = value;
    else if (field === 'correct_answer') updated[index].correct_answer = value;
    setQuizQuestions(updated);
  };

  const updateQuizOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...quizQuestions];
    updated[qIndex].options[oIndex] = value;
    setQuizQuestions(updated);
  };

  const removeQuizQuestion = (index: number) => {
    if (quizQuestions.length > 1) {
      setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
    }
  };

  // Toggle content selection
  const toggleContentSelection = (contentId: string) => {
    setOfferForm(prev => ({
      ...prev,
      included_content_ids: prev.included_content_ids.includes(contentId)
        ? prev.included_content_ids.filter(id => id !== contentId)
        : [...prev.included_content_ids, contentId],
    }));
  };

  // Helpers
  const getTypeConfig = (type: string) => CONTENT_TYPES.find(t => t.id === type) || CONTENT_TYPES[0];
  const getOfferTypeConfig = (type: string) => OFFER_TYPES.find(t => t.id === type) || OFFER_TYPES[0];

  // Stats
  const publishedOffers = offers.filter(o => o.is_published).length;
  const totalRevenue = offers.reduce((sum, o) => sum + o.total_revenue, 0);
  const totalSales = offers.reduce((sum, o) => sum + o.total_sales, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
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
          <Text style={styles.headerTitle}>{t('catalog.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('catalog.headerSubtitle', { contents: String(contents.length), published: String(publishedOffers), total: String(offers.length) })}
          </Text>
        </View>
      </LinearGradient>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>${totalRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>{t("catalog.revenue")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSales}</Text>
          <Text style={styles.statLabel}>{t("catalog.sales")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{contents.length}</Text>
          <Text style={styles.statLabel}>{t("catalog.contents")}</Text>
        </View>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'contents' && styles.toggleBtnActive]}
          onPress={() => setViewMode('contents')}
        >
          <Ionicons name="folder-open" size={18} color={viewMode === 'contents' ? '#FFF' : '#9CA3AF'} />
          <Text style={[styles.toggleText, viewMode === 'contents' && styles.toggleTextActive]}>
            {t('catalog.myContents')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'offers' && styles.toggleBtnActive]}
          onPress={() => setViewMode('offers')}
        >
          <Ionicons name="pricetags" size={18} color={viewMode === 'offers' ? '#FFF' : '#9CA3AF'} />
          <Text style={[styles.toggleText, viewMode === 'offers' && styles.toggleTextActive]}>
            {t('catalog.myOffers')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workflow Info */}
      <View style={styles.workflowInfo}>
        <Ionicons name="bulb" size={16} color="#F59E0B" />
        <Text style={styles.workflowText}>
          {viewMode === 'contents' 
            ? t('catalog.getStartedHint')
            : t('catalog.workflowOffersHint')
          }
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {viewMode === 'contents' ? (
          <>
            {/* Add Content Button */}
            <TouchableOpacity
              style={styles.addCard}
              onPress={() => openContentModal()}
              data-testid="add-content-btn"
            >
              <LinearGradient colors={['#7C3AED20', '#5B21B620']} style={styles.addCardGradient}>
                <Ionicons name="add-circle" size={32} color="#7C3AED" />
                <Text style={styles.addCardTitle}>{t('catalog.createContentTitle')}</Text>
                <Text style={styles.addCardDesc}>{t('catalog.createContentDesc')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Content List */}
            {contents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color="#6B7280" />
                <Text style={styles.emptyTitle}>{t("catalog.noContent")}</Text>
                <Text style={styles.emptyText}>{t('catalog.createFirstContent')}</Text>
              </View>
            ) : (
              contents.map(content => {
                const typeConfig = getTypeConfig(content.content_type);
                return (
                  <View
                    key={content.id}
                    style={styles.contentCard}
                    data-testid={`content-${content.id}`}
                  >
                    <TouchableOpacity
                      style={styles.contentCardInner}
                      onPress={() => openContentModal(content)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.contentIcon, { backgroundColor: typeConfig.color + '20' }]}>
                        <Ionicons name={typeConfig.icon as any} size={22} color={typeConfig.color} />
                      </View>
                      <View style={styles.contentInfo}>
                        <View style={styles.contentHeader}>
                          <Text style={styles.contentTitle} numberOfLines={1}>{content.title}</Text>
                          {content.is_premium && (
                            <View style={styles.premiumBadge}>
                              <Ionicons name="star" size={10} color="#F59E0B" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.contentType}>{t(typeConfig.labelKey)}</Text>
                        <View style={styles.contentMeta}>
                          {content.duration_minutes && (
                            <Text style={styles.metaText}>{content.duration_minutes} min</Text>
                          )}
                          <Text style={styles.metaText}>{content.usage_count} {t('catalog.usages')}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                    </TouchableOpacity>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.editActionBtn}
                        onPress={() => openContentModal(content)}
                        data-testid={`edit-content-${content.id}`}
                      >
                        <Ionicons name="create-outline" size={16} color="#7C3AED" />
                        <Text style={styles.editActionText}>{t('catalog.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteActionBtn}
                        onPress={() => handleDeleteContent(content.id)}
                        data-testid={`delete-content-${content.id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={styles.deleteActionText}>{t('catalog.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            {/* Add Offer Button */}
            <TouchableOpacity
              style={styles.addCard}
              onPress={() => openOfferModal()}
              data-testid="add-offer-btn"
            >
              <LinearGradient colors={['#F59E0B20', '#D9770620']} style={styles.addCardGradient}>
                <Ionicons name="add-circle" size={32} color="#F59E0B" />
                <Text style={[styles.addCardTitle, { color: '#F59E0B' }]}>{t('catalog.createOffer')}</Text>
                <Text style={styles.addCardDesc}>{t("catalog.createOfferDesc")}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Offers List */}
            {offers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="pricetags-outline" size={48} color="#6B7280" />
                <Text style={styles.emptyTitle}>{t("catalog.noOffer")}</Text>
                <Text style={styles.emptyText}>
                  {t('catalog.createContentFirst')}
                </Text>
              </View>
            ) : (
              offers.map(offer => {
                const typeConfig = getOfferTypeConfig(offer.offer_type);
                return (
                  <View
                    key={offer.id}
                    style={styles.offerCard}
                    data-testid={`offer-${offer.id}`}
                  >
                    <TouchableOpacity
                      style={styles.offerCardInner}
                      onPress={() => openOfferModal(offer)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.offerHeader}>
                        <View style={styles.offerIcon}>
                          <Ionicons name={typeConfig.icon as any} size={20} color="#F59E0B" />
                        </View>
                        <View style={styles.offerInfo}>
                          <Text style={styles.offerTitle} numberOfLines={1}>{offer.title}</Text>
                          <Text style={styles.offerType}>{t(typeConfig.labelKey)}</Text>
                        </View>
                      </View>
                      <View style={styles.offerMeta}>
                        <View style={styles.priceTag}>
                          <Text style={styles.priceText}>
                            {offer.price === 0 ? t('catalog.free') : `$${offer.price}`}
                          </Text>
                        </View>
                        <Text style={styles.offerStats}>
                          {offer.included_content_ids?.length || 0} {t('catalog.contentsIncluded')} • {offer.total_sales} {t('catalog.salesCount')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.offerActions}>
                      <TouchableOpacity
                        style={[styles.publishBadge, offer.is_published ? styles.published : styles.draft]}
                        onPress={() => handleTogglePublish(offer)}
                        data-testid={`toggle-publish-${offer.id}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={offer.is_published ? 'eye' : 'eye-off'}
                          size={14}
                          color={offer.is_published ? '#10B981' : '#9CA3AF'}
                        />
                        <Text style={[styles.publishText, { color: offer.is_published ? '#10B981' : '#9CA3AF' }]}>
                          {offer.is_published ? t('catalog.published') : t('catalog.draft')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtnOffer}
                        onPress={() => handleDeleteOffer(offer.id)}
                        data-testid={`delete-offer-${offer.id}`}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ============ CONTENT MODAL ============ */}
      <Modal visible={showContentModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowContentModal(false); resetContentForm(); }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingContent ? t('catalog.editContent') : t('catalog.newContent')}
            </Text>
            <TouchableOpacity onPress={handleSaveContent} disabled={actionLoading}>
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveBtn}>{t("common.save")}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Content Type Grid */}
            <Text style={styles.fieldLabel}>{t('catalog.contentTypeLabel')}</Text>
            <View style={styles.typeGrid}>
              {CONTENT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeOption,
                    contentForm.content_type === type.id && { borderColor: type.color, backgroundColor: type.color + '15' }
                  ]}
                  onPress={() => setContentForm({ ...contentForm, content_type: type.id })}
                >
                  <Ionicons name={type.icon as any} size={22} color={type.color} />
                  <Text style={[styles.typeLabel, contentForm.content_type === type.id && { color: type.color }]}>
                    {t(type.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title */}
            <Text style={styles.fieldLabel}>{t('catalog.titleLabel')}</Text>
            <TextInput
              style={styles.input}
              value={contentForm.title}
              onChangeText={(text) => setContentForm({ ...contentForm, title: text })}
              placeholder={t('catalog.titlePlaceholder')}
              placeholderTextColor="#9CA3AF"
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>{t('catalog.descriptionLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={contentForm.description}
              onChangeText={(text) => setContentForm({ ...contentForm, description: text })}
              placeholder={t('catalog.descPlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />

            {/* Type-specific fields */}
            {(contentForm.content_type === 'pdf' || contentForm.content_type === 'audio') && (
              <>
                <Text style={styles.fieldLabel}>{t('catalog.fileLabel')}</Text>
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={handlePickFile}
                  disabled={uploadingFile}
                  data-testid="upload-file-btn"
                >
                  {uploadingFile ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={20} color="#7C3AED" />
                  )}
                  <Text style={styles.uploadButtonText}>
                    {uploadingFile ? t('catalog.uploadInProgress') : contentForm.file_url ? t('catalog.fileUploaded') : t('catalog.chooseFile')}
                  </Text>
                  {contentForm.file_url ? (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  ) : null}
                </TouchableOpacity>

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('catalog.pasteUrlLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={contentForm.file_url}
                  onChangeText={(text) => setContentForm({ ...contentForm, file_url: text })}
                  placeholder="https://..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </>
            )}

            {contentForm.content_type === 'video' && (
              <>
                <Text style={styles.fieldLabel}>{t('catalog.videoUrl')}</Text>
                <TextInput
                  style={styles.input}
                  value={contentForm.video_url}
                  onChangeText={(text) => setContentForm({ ...contentForm, video_url: text })}
                  placeholder="https://youtube.com/..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </>
            )}

            {['video', 'audio', 'session', 'course'].includes(contentForm.content_type) && (
              <>
                <Text style={styles.fieldLabel}>{t('catalog.durationMinutes')}</Text>
                <TextInput
                  style={styles.input}
                  value={contentForm.duration_minutes}
                  onChangeText={(text) => setContentForm({ ...contentForm, duration_minutes: text.replace(/[^0-9]/g, '') })}
                  placeholder="60"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </>
            )}

            {/* Session specific */}
            {contentForm.content_type === 'session' && (
              <>
                <Text style={styles.fieldLabel}>{t('catalog.sessionTypeLabel')}</Text>
                <View style={styles.sessionTypes}>
                  {[
                    { id: 'one_on_one', labelKey: 'catalog.sessionOneOnOne', icon: 'person' },
                    { id: 'group', labelKey: 'catalog.sessionGroup', icon: 'people' },
                    { id: 'webinar', labelKey: 'catalog.sessionWebinar', icon: 'videocam' },
                  ].map(st => (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.sessionTypeBtn, contentForm.session_type === st.id && styles.sessionTypeBtnActive]}
                      onPress={() => setContentForm({ ...contentForm, session_type: st.id })}
                    >
                      <Ionicons name={st.icon as any} size={18} color={contentForm.session_type === st.id ? '#FFF' : '#9CA3AF'} />
                      <Text style={[styles.sessionTypeText, contentForm.session_type === st.id && { color: '#FFF' }]}>
                        {t(st.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('catalog.maxParticipants')}</Text>
                <TextInput
                  style={styles.input}
                  value={contentForm.max_participants}
                  onChangeText={(text) => setContentForm({ ...contentForm, max_participants: text.replace(/[^0-9]/g, '') })}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>{t("catalog.pricePerSession")}</Text>
                <TextInput
                  style={styles.input}
                  value={contentForm.price}
                  onChangeText={(text) => setContentForm({ ...contentForm, price: text.replace(/[^0-9.]/g, '') })}
                  placeholder="50"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>{t('catalog.meetingLinkLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={contentForm.meeting_link}
                  onChangeText={(text) => setContentForm({ ...contentForm, meeting_link: text })}
                  placeholder="https://zoom.us/j/123456789"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  data-testid="meeting-link-input"
                />
                <View style={styles.meetingLinkHint}>
                  <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.meetingLinkHintText}>
                    {t('catalog.meetingLinkHint')}
                  </Text>
                </View>
              </>
            )}

            {/* Quiz Builder */}
            {contentForm.content_type === 'quiz' && (
              <View style={styles.quizBuilder}>
                <Text style={styles.sectionTitle}>{t("catalog.questions")}</Text>
                {quizQuestions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.questionNum}>Q{qIndex + 1}</Text>
                      {quizQuestions.length > 1 && (
                        <TouchableOpacity onPress={() => removeQuizQuestion(qIndex)}>
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.input}
                      value={q.question}
                      onChangeText={(text) => updateQuizQuestion(qIndex, 'question', text)}
                      placeholder={t('catalog.questionPlaceholder')}
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.optionsLabel}>{t('catalog.answerOptions')}</Text>
                    {q.options.map((opt, oIndex) => (
                      <View key={oIndex} style={styles.optionRow}>
                        <TouchableOpacity
                          style={[styles.radio, q.correct_answer === oIndex && styles.radioSelected]}
                          onPress={() => updateQuizQuestion(qIndex, 'correct_answer', oIndex)}
                        >
                          {q.correct_answer === oIndex && <Ionicons name="checkmark" size={12} color="#FFF" />}
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={opt}
                          onChangeText={(text) => updateQuizOption(qIndex, oIndex, text)}
                          placeholder={`Option ${oIndex + 1}`}
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    ))}
                  </View>
                ))}
                <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuizQuestion}>
                  <Ionicons name="add-circle" size={20} color="#7C3AED" />
                  <Text style={styles.addQuestionText}>{t("catalog.addQuestion")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tags */}
            <Text style={styles.fieldLabel}>{t('catalog.tagsSeparated')}</Text>
            <TextInput
              style={styles.input}
              value={contentForm.tags}
              onChangeText={(text) => setContentForm({ ...contentForm, tags: text })}
              placeholder={t('catalog.tagsPlaceholder')}
              placeholderTextColor="#9CA3AF"
            />

            {/* Scheduled Availability */}
            <View style={styles.scheduledSection}>
              <TouchableOpacity
                style={styles.scheduledToggle}
                onPress={() => setContentForm({ 
                  ...contentForm, 
                  has_scheduled_availability: !contentForm.has_scheduled_availability 
                })}
              >
                <Ionicons name="calendar" size={20} color={contentForm.has_scheduled_availability ? '#7C3AED' : '#6B7280'} />
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>{t('catalog.scheduleAvailability')}</Text>
                  <Text style={styles.premiumDesc}>{t('catalog.contentLocked')}</Text>
                </View>
                <View style={[styles.toggle, contentForm.has_scheduled_availability && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, contentForm.has_scheduled_availability && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>

              {contentForm.has_scheduled_availability && (
                <View style={styles.scheduledInputs}>
                  <View style={styles.dateTimeRow}>
                    <View style={styles.dateInput}>
                      <Text style={styles.smallLabel}>{t("catalog.date")}</Text>
                      <TextInput
                        style={styles.input}
                        value={contentForm.available_from_date}
                        onChangeText={(text) => setContentForm({ ...contentForm, available_from_date: text })}
                        placeholder="AAAA-MM-JJ"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.smallLabel}>{t("catalog.time")}</Text>
                      <TextInput
                        style={styles.input}
                        value={contentForm.available_from_time}
                        onChangeText={(text) => setContentForm({ ...contentForm, available_from_time: text })}
                        placeholder="HH:MM"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                  <View style={styles.scheduleHint}>
                    <Ionicons name="information-circle" size={14} color="#9CA3AF" />
                    <Text style={styles.scheduleHintText}>
                      {t('catalog.schedulingExample')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Premium Toggle */}
            <TouchableOpacity
              style={styles.premiumToggle}
              onPress={() => setContentForm({ ...contentForm, is_premium: !contentForm.is_premium })}
            >
              <Ionicons name="star" size={20} color={contentForm.is_premium ? '#F59E0B' : '#6B7280'} />
              <View style={styles.premiumInfo}>
                <Text style={styles.premiumTitle}>{t("catalog.premiumContent")}</Text>
                <Text style={styles.premiumDesc}>{t('catalog.premiumReserved')}</Text>
              </View>
              <View style={[styles.toggle, contentForm.is_premium && styles.toggleActive]}>
                <View style={[styles.toggleThumb, contentForm.is_premium && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ============ OFFER MODAL ============ */}
      <Modal visible={showOfferModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { backgroundColor: '#D97706' }]}>
            <TouchableOpacity onPress={() => { setShowOfferModal(false); resetOfferForm(); }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingOffer ? t('catalog.editOffer') : t('catalog.newOffer')}
            </Text>
            <TouchableOpacity onPress={handleSaveOffer} disabled={actionLoading}>
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveBtn}>{t('catalog.saveBtn')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Offer Type */}
            <Text style={styles.fieldLabel}>{t('catalog.offerTypeLabel')}</Text>
            <View style={styles.offerTypeGrid}>
              {OFFER_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.offerTypeOption, offerForm.offer_type === type.id && styles.offerTypeOptionActive]}
                  onPress={() => setOfferForm({ ...offerForm, offer_type: type.id })}
                >
                  <Ionicons name={type.icon as any} size={24} color={offerForm.offer_type === type.id ? '#F59E0B' : '#9CA3AF'} />
                  <Text style={[styles.offerTypeLabel, offerForm.offer_type === type.id && { color: '#F59E0B' }]}>
                    {t(type.labelKey)}
                  </Text>
                  <Text style={styles.offerTypeDesc}>{t(type.descKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title */}
            <Text style={styles.fieldLabel}>{t('catalog.offerTitleLabel')}</Text>
            <TextInput
              style={styles.input}
              value={offerForm.title}
              onChangeText={(text) => setOfferForm({ ...offerForm, title: text })}
              placeholder={t('catalog.offerNamePlaceholder')}
              placeholderTextColor="#9CA3AF"
            />

            {/* Short Description */}
            <Text style={styles.fieldLabel}>{t('catalog.catchphrase')}</Text>
            <TextInput
              style={styles.input}
              value={offerForm.short_description}
              onChangeText={(text) => setOfferForm({ ...offerForm, short_description: text })}
              placeholder={t('catalog.catchphrasePlaceholder')}
              placeholderTextColor="#9CA3AF"
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>{t('catalog.fullDescription')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={offerForm.description}
              onChangeText={(text) => setOfferForm({ ...offerForm, description: text })}
              placeholder={t('catalog.offerDescPlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />

            {/* Pricing */}
            <Text style={styles.fieldLabel}>{t("catalog.pricingModel")}</Text>
            <View style={styles.pricingRow}>
              {PRICING_MODELS.map(pm => (
                <TouchableOpacity
                  key={pm.id}
                  style={[styles.pricingOption, offerForm.pricing_model === pm.id && styles.pricingOptionActive]}
                  onPress={() => setOfferForm({ ...offerForm, pricing_model: pm.id })}
                >
                  <Ionicons name={pm.icon as any} size={16} color={offerForm.pricing_model === pm.id ? '#FFF' : '#9CA3AF'} />
                  <Text style={[styles.pricingText, offerForm.pricing_model === pm.id && { color: '#FFF' }]}>
                    {t(pm.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {offerForm.pricing_model !== 'free' && (
              <>
                <Text style={styles.fieldLabel}>{t("catalog.priceRequired")}</Text>
                <TextInput
                  style={styles.input}
                  value={offerForm.price}
                  onChangeText={(text) => setOfferForm({ ...offerForm, price: text.replace(/[^0-9.]/g, '') })}
                  placeholder="99.99"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </>
            )}

            {/* Content Selection */}
            <Text style={styles.fieldLabel}>{t('catalog.includedContents')} ({offerForm.included_content_ids.length})</Text>
            <TouchableOpacity
              style={styles.selectContentBtn}
              onPress={() => setShowContentPicker(true)}
            >
              <Ionicons name="add-circle" size={20} color="#7C3AED" />
              <Text style={styles.selectContentText}>{t("catalog.selectContents")}</Text>
            </TouchableOpacity>

            {offerForm.included_content_ids.length > 0 && (
              <View style={styles.selectedContents}>
                {offerForm.included_content_ids.map(id => {
                  const content = contents.find(c => c.id === id);
                  if (!content) return null;
                  const typeConfig = getTypeConfig(content.content_type);
                  return (
                    <View key={id} style={styles.selectedContentItem}>
                      <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
                      <Text style={styles.selectedContentTitle} numberOfLines={1}>{content.title}</Text>
                      <TouchableOpacity onPress={() => toggleContentSelection(id)}>
                        <Ionicons name="close-circle" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Publish Toggle - PROMINENT */}
            <View style={[styles.publishToggleWrap, offerForm.is_published ? styles.publishToggleActive : styles.publishToggleDraft]}>
              <TouchableOpacity
                style={styles.publishToggleInner}
                onPress={() => setOfferForm({ ...offerForm, is_published: !offerForm.is_published })}
                data-testid="offer-publish-toggle"
              >
                <Ionicons 
                  name={offerForm.is_published ? 'storefront' : 'eye-off'} 
                  size={24} 
                  color={offerForm.is_published ? '#10B981' : '#6B7280'} 
                />
                <View style={styles.premiumInfo}>
                  <Text style={[styles.premiumTitle, offerForm.is_published && { color: '#10B981' }]}>
                    {offerForm.is_published ? t('catalog.offerPublished') : t('catalog.offerDraft')}
                  </Text>
                  <Text style={[styles.premiumDesc, offerForm.is_published && { color: '#10B981' }]}>
                    {offerForm.is_published ? t('catalog.visibleOnMarketplace') : t('catalog.notVisiblePublicly')}
                  </Text>
                </View>
                <View style={[styles.toggle, offerForm.is_published && styles.toggleActiveGreen]}>
                  <View style={[styles.toggleThumb, offerForm.is_published && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
              {offerForm.is_published && (
                <View style={styles.publishConfirmBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.publishConfirmText}>{t('catalog.willBeOnMarketplace')}</Text>
                </View>
              )}
            </View>

            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ============ CONTENT PICKER MODAL ============ */}
      <Modal visible={showContentPicker} animationType="slide" transparent>
        <View style={styles.pickerModal}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t("catalog.selectContentsTitle")}</Text>
              <TouchableOpacity onPress={() => setShowContentPicker(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {contents.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Ionicons name="folder-open-outline" size={40} color="#6B7280" />
                  <Text style={styles.pickerEmptyText}>{t("catalog.noContentAvailable")}</Text>
                  <TouchableOpacity
                    style={styles.pickerCreateBtn}
                    onPress={() => {
                      setShowContentPicker(false);
                      setShowOfferModal(false);
                      setViewMode('contents');
                    }}
                  >
                    <Text style={styles.pickerCreateText}>{t("catalog.createContentAction")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                contents.map(content => {
                  const isSelected = offerForm.included_content_ids.includes(content.id);
                  const typeConfig = getTypeConfig(content.content_type);
                  return (
                    <TouchableOpacity
                      key={content.id}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => toggleContentSelection(content.id)}
                    >
                      <View style={[styles.pickerCheck, isSelected && styles.pickerCheckSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </View>
                      <Ionicons name={typeConfig.icon as any} size={18} color={typeConfig.color} />
                      <View style={styles.pickerItemInfo}>
                        <Text style={styles.pickerItemTitle}>{content.title}</Text>
                        <Text style={styles.pickerItemType}>{t(typeConfig.labelKey)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.pickerDone} onPress={() => setShowContentPicker(false)}>
              <Text style={styles.pickerDoneText}>{t('catalog.doneSelected', { count: String(offerForm.included_content_ids.length) })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  loadingText: { color: '#9CA3AF', marginTop: 12, fontSize: 16 },
  
  // Header
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { padding: 8 },
  headerContent: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  
  // Stats Bar
  statsBar: { flexDirection: 'row', backgroundColor: '#1A1A1A', marginHorizontal: 16, borderRadius: 12, padding: 16, marginTop: -10 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#2A2A2A', marginHorizontal: 12 },
  
  // View Toggle
  viewToggle: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  toggleBtnActive: { backgroundColor: '#7C3AED' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  toggleTextActive: { color: '#FFF' },
  
  // Workflow Info
  workflowInfo: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, padding: 12, backgroundColor: '#F59E0B10', borderRadius: 10, gap: 8 },
  workflowText: { flex: 1, fontSize: 13, color: '#F59E0B' },
  
  // Content
  content: { flex: 1, padding: 16 },
  
  // Add Card
  addCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  addCardGradient: { padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#7C3AED30', borderStyle: 'dashed', borderRadius: 16 },
  addCardTitle: { fontSize: 16, fontWeight: '700', color: '#7C3AED', marginTop: 8 },
  addCardDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  
  // Content Card
  contentCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginBottom: 10 },
  contentCardInner: { flexDirection: 'row', alignItems: 'center' },
  contentIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contentInfo: { flex: 1, marginLeft: 12 },
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contentTitle: { fontSize: 15, fontWeight: '600', color: '#FFF', flex: 1 },
  premiumBadge: { backgroundColor: '#F59E0B20', padding: 4, borderRadius: 6 },
  contentType: { fontSize: 12, color: '#7C3AED', marginTop: 2 },
  contentMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaText: { fontSize: 11, color: '#9CA3AF' },
  deleteBtn: { padding: 12, backgroundColor: '#EF444420', borderRadius: 10, marginLeft: 8 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  editActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#7C3AED15', borderRadius: 8 },
  editActionText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  deleteActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#EF444415', borderRadius: 8 },
  deleteActionText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  
  // Offer Card
  offerCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginBottom: 10 },
  offerCardInner: { flex: 1 },
  offerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  offerHeader: { flexDirection: 'row', alignItems: 'center' },
  offerIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F59E0B20', justifyContent: 'center', alignItems: 'center' },
  offerInfo: { flex: 1, marginLeft: 12 },
  offerTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  offerType: { fontSize: 12, color: '#F59E0B', marginTop: 2 },
  publishBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  published: { backgroundColor: '#10B98120' },
  publishToggleWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
  publishToggleActive: { backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2, borderColor: 'rgba(16,185,129,0.25)' },
  publishToggleDraft: { backgroundColor: '#111125', borderWidth: 1, borderColor: '#1E1E3A' },
  publishToggleInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  publishConfirmBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderTopWidth: 1, borderTopColor: 'rgba(16,185,129,0.15)' },
  publishConfirmText: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  draft: { backgroundColor: '#3A3A3A' },
  publishText: { fontSize: 12, fontWeight: '500' },
  offerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  priceTag: { backgroundColor: '#10B98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceText: { fontSize: 14, fontWeight: 'bold', color: '#10B981' },
  offerStats: { fontSize: 12, color: '#9CA3AF' },
  deleteBtnOffer: { position: 'absolute', right: 14, bottom: 14, padding: 6 },
  
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F0F0F' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#7C3AED' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  saveBtn: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  modalBody: { flex: 1, padding: 16 },
  
  // Form
  fieldLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 8, marginTop: 16 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C3AED40',
    borderStyle: 'dashed',
    backgroundColor: '#7C3AED10',
  },
  uploadButtonText: { fontSize: 14, color: '#7C3AED', fontWeight: '600', flex: 1 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  // Type Grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { width: '23%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 2, borderColor: '#2A2A2A' },
  typeLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  
  // Session Types
  sessionTypes: { flexDirection: 'row', gap: 8 },
  sessionTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  sessionTypeBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  sessionTypeText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  meetingLinkHint: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  meetingLinkHintText: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  
  // Quiz Builder
  quizBuilder: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  questionCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginBottom: 10 },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  questionNum: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  optionsLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 10, marginBottom: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
  radioSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  addQuestionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#7C3AED', borderStyle: 'dashed', gap: 8 },
  addQuestionText: { color: '#7C3AED', fontWeight: '600' },
  
  // Course Info
  courseInfo: { backgroundColor: '#3B82F610', borderRadius: 12, padding: 16, marginTop: 8, gap: 12 },
  courseInfoText: { fontSize: 14, color: '#3B82F6', lineHeight: 20 },
  goToCourseBtn: { backgroundColor: '#3B82F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  goToCourseBtnText: { color: '#FFF', fontWeight: '600' },
  
  // Premium Toggle
  premiumToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginTop: 16 },
  premiumInfo: { flex: 1, marginLeft: 12 },
  premiumTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  premiumDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: '#3A3A3A', padding: 2 },
  toggleActive: { backgroundColor: '#7C3AED' },
  toggleActiveGreen: { backgroundColor: '#10B981' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' },
  toggleThumbActive: { transform: [{ translateX: 22 }] },
  
  // Scheduled Availability
  scheduledSection: { marginTop: 16 },
  scheduledToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14 },
  scheduledInputs: { marginTop: 12, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14 },
  dateTimeRow: { flexDirection: 'row', gap: 12 },
  dateInput: { flex: 2 },
  timeInput: { flex: 1 },
  smallLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  scheduleHint: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  scheduleHintText: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  
  // Offer Type Grid
  offerTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offerTypeOption: { width: '48%', padding: 14, backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 2, borderColor: '#2A2A2A', alignItems: 'center' },
  offerTypeOptionActive: { borderColor: '#F59E0B', backgroundColor: '#F59E0B10' },
  offerTypeLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginTop: 6 },
  offerTypeDesc: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  
  // Pricing Row
  pricingRow: { flexDirection: 'row', gap: 8 },
  pricingOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  pricingOptionActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  pricingText: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  
  // Select Content
  selectContentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#7C3AED', borderStyle: 'dashed', gap: 8 },
  selectContentText: { color: '#7C3AED', fontWeight: '600' },
  selectedContents: { marginTop: 10, gap: 6 },
  selectedContentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 10, borderRadius: 8, gap: 8 },
  selectedContentTitle: { flex: 1, fontSize: 13, color: '#FFF' },
  
  // Picker Modal
  pickerModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  pickerList: { padding: 16, maxHeight: 350 },
  pickerEmpty: { alignItems: 'center', paddingVertical: 30 },
  pickerEmptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  pickerCreateBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#7C3AED', borderRadius: 8 },
  pickerCreateText: { color: '#FFF', fontWeight: '600' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#2A2A2A', marginBottom: 8, gap: 10 },
  pickerItemSelected: { backgroundColor: '#7C3AED30', borderWidth: 1, borderColor: '#7C3AED' },
  pickerCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
  pickerCheckSelected: { backgroundColor: '#7C3AED' },
  pickerItemInfo: { flex: 1 },
  pickerItemTitle: { fontSize: 14, fontWeight: '500', color: '#FFF' },
  pickerItemType: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  pickerDone: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  pickerDoneText: { fontSize: 16, fontWeight: '600', color: '#7C3AED' },
});
