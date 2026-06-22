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

interface ContentItem {
  id: string;
  content_type: string;
  title: string;
  description?: string;
  is_premium: boolean;
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
  subscription_interval?: string;
  included_content_ids: string[];
  included_service_ids: string[];
  included_course_ids: string[];
  access_duration_days?: number;
  max_participants?: number;
  category?: string;
  difficulty?: string;
  tags: string[];
  is_published: boolean;
  is_featured: boolean;
  total_sales: number;
  total_revenue: number;
  created_at: string;
}

const OFFER_TYPES = [
  { id: 'bundle', labelKey: 'offers.typeBundle', icon: 'layers', descKey: 'offers.typeBundleDesc' },
  { id: 'single_content', labelKey: 'offers.typeSingleContent', icon: 'document', descKey: 'offers.typeSingleContentDesc' },
  { id: 'subscription', labelKey: 'offers.typeSubscription', icon: 'repeat', descKey: 'offers.typeSubscriptionDesc' },
  { id: 'coaching_pack', labelKey: 'offers.typeCoachingPack', icon: 'people', descKey: 'offers.typeCoachingPackDesc' },
  { id: 'service_package', label: 'Pack Services', icon: 'briefcase', desc: 'Plusieurs services' },
  { id: 'custom', label: 'Sur mesure', icon: 'construct', desc: 'Configuration libre' },
];

const PRICING_MODELS = [
  { id: 'one_time', labelKey: 'offers.pricingOneTime' },
  { id: 'subscription', labelKey: 'offers.pricingSubscription' },
  { id: 'pay_what_you_want', label: 'Prix libre' },
  { id: 'installments', labelKey: 'offers.pricingInstallments' },
];

const DIFFICULTY_LEVELS = [
  { id: 'beginner', labelKey: 'offers.levelBeginner', color: '#10B981' },
  { id: 'intermediate', labelKey: 'offers.levelIntermediate', color: '#F59E0B' },
  { id: 'advanced', labelKey: 'offers.levelAdvanced', color: '#EF4444' },
  { id: 'all_levels', labelKey: 'offers.levelAll', color: '#3B82F6' },
];

export default function OffersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<ProOffer[]>([]);
  const [contentLibrary, setContentLibrary] = useState<ContentItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<ProOffer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showContentPicker, setShowContentPicker] = useState(false);

  const [form, setForm] = useState({
    offer_type: 'bundle',
    title: '',
    description: '',
    short_description: '',
    price: '',
    pricing_model: 'one_time',
    subscription_interval: 'monthly',
    included_content_ids: [] as string[],
    access_duration_days: '',
    max_participants: '',
    category: '',
    difficulty: 'all_levels',
    tags: '',
    is_published: false,
  });

  const loadData = useCallback(async () => {
    try {
      const [offersRes, contentRes] = await Promise.all([
        proAPI.getOffers(),
        proAPI.getContentLibrary(),
      ]);
      setOffers(offersRes.data.data || []);
      setContentLibrary(contentRes.data.data || []);
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

  const resetForm = () => {
    setForm({
      offer_type: 'bundle',
      title: '',
      description: '',
      short_description: '',
      price: '',
      pricing_model: 'one_time',
      subscription_interval: 'monthly',
      included_content_ids: [],
      access_duration_days: '',
      max_participants: '',
      category: '',
      difficulty: 'all_levels',
      tags: '',
      is_published: false,
    });
    setEditingOffer(null);
  };

  const handleOpenModal = (offer?: ProOffer) => {
    if (offer) {
      setEditingOffer(offer);
      setForm({
        offer_type: offer.offer_type,
        title: offer.title,
        description: offer.description || '',
        short_description: offer.short_description || '',
        price: offer.price.toString(),
        pricing_model: offer.pricing_model,
        subscription_interval: offer.subscription_interval || 'monthly',
        included_content_ids: offer.included_content_ids || [],
        access_duration_days: offer.access_duration_days?.toString() || '',
        max_participants: offer.max_participants?.toString() || '',
        category: offer.category || '',
        difficulty: offer.difficulty || 'all_levels',
        tags: offer.tags?.join(', ') || '',
        is_published: offer.is_published,
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSaveOffer = async () => {
    if (!form.title.trim()) {
      Alert.alert(t('catalog.error'), t('catalog.titleRequired'));
      return;
    }
    if (!form.price || parseFloat(form.price) < 0) {
      Alert.alert(t('catalog.error'), t('catalog.priceRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const data: any = {
        offer_type: form.offer_type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        short_description: form.short_description.trim() || undefined,
        price: parseFloat(form.price),
        pricing_model: form.pricing_model,
        subscription_interval: form.pricing_model === 'subscription' ? form.subscription_interval : undefined,
        included_content_ids: form.included_content_ids,
        access_duration_days: form.access_duration_days ? parseInt(form.access_duration_days) : undefined,
        max_participants: form.max_participants ? parseInt(form.max_participants) : undefined,
        category: form.category.trim() || undefined,
        difficulty: form.difficulty,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_published: form.is_published,
      };

      if (editingOffer) {
        await proAPI.updateOffer(editingOffer.id, data);
      } else {
        await proAPI.createOffer(data);
      }

      setShowModal(false);
      resetForm();
      loadData();
      Alert.alert(t('settings.success'), t('settings.success'));
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOffer = (offerId: string) => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await proAPI.deleteOffer(offerId);
              loadData();
              Alert.alert(t('settings.success'), t('settings.success'));
            } catch (error: any) {
              Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
            }
          },
        },
      ]
    );
  };

  const handleTogglePublish = async (offer: ProOffer) => {
    try {
      if (offer.is_published) {
        await proAPI.unpublishOffer(offer.id);
      } else {
        await proAPI.publishOffer(offer.id);
      }
      loadData();
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    }
  };

  const toggleContentSelection = (contentId: string) => {
    setForm(prev => ({
      ...prev,
      included_content_ids: prev.included_content_ids.includes(contentId)
        ? prev.included_content_ids.filter(id => id !== contentId)
        : [...prev.included_content_ids, contentId],
    }));
  };

  const getOfferTypeConfig = (type: string) => {
    return OFFER_TYPES.find(t => t.id === type) || OFFER_TYPES[0];
  };

  const getDifficultyConfig = (level: string) => {
    return DIFFICULTY_LEVELS.find(d => d.id === level) || DIFFICULTY_LEVELS[3];
  };

  const selectedContentItems = contentLibrary.filter(c => 
    form.included_content_ids.includes(c.id)
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t("offers.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t("offers.title")}</Text>
          <Text style={styles.headerSubtitle}>
            {offers.filter(o => o.is_published).length} publiées / {offers.length} total
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleOpenModal()} 
          style={styles.addButton}
          data-testid="create-offer-btn"
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            ${offers.reduce((sum, o) => sum + o.total_revenue, 0).toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>{t("offers.totalRevenue")}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {offers.reduce((sum, o) => sum + o.total_sales, 0)}
          </Text>
          <Text style={styles.statLabel}>{t("offers.sales")}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{contentLibrary.length}</Text>
          <Text style={styles.statLabel}>{t("offers.contents")}</Text>
        </View>
      </View>

      {/* Content Library Shortcut */}
      <TouchableOpacity 
        style={styles.libraryShortcut}
        onPress={() => router.push('/pro/content-library')}
        data-testid="go-to-library-btn"
      >
        <Ionicons name="folder-open" size={20} color="#7C3AED" />
        <Text style={styles.libraryShortcutText}>{t('offers.manageLibrary')}</Text>
        <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
      </TouchableOpacity>

      {/* Offers List */}
      <ScrollView
        style={styles.offersList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {offers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyTitle}>{t("offers.noOffers")}</Text>
            <Text style={styles.emptyText}>
              {t('offers.createOfferHint')}
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => handleOpenModal()}
              data-testid="create-first-offer-btn"
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>{t('offers.createOffer')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          offers.map(offer => {
            const typeConfig = getOfferTypeConfig(offer.offer_type);
            const difficultyConfig = getDifficultyConfig(offer.difficulty || 'all_levels');
            return (
              <TouchableOpacity 
                key={offer.id} 
                style={styles.offerCard}
                onPress={() => handleOpenModal(offer)}
                data-testid={`offer-item-${offer.id}`}
              >
                <View style={styles.offerHeader}>
                  <View style={styles.offerTypeIcon}>
                    <Ionicons name={typeConfig.icon as any} size={20} color="#F59E0B" />
                  </View>
                  <View style={styles.offerTitleArea}>
                    <Text style={styles.offerTitle} numberOfLines={1}>{offer.title}</Text>
                    <Text style={styles.offerType}>{typeConfig.label}</Text>
                  </View>
                  <View style={styles.offerActions}>
                    <TouchableOpacity 
                      style={[
                        styles.publishBadge,
                        offer.is_published ? styles.publishedBadge : styles.draftBadge
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTogglePublish(offer);
                      }}
                    >
                      <Ionicons 
                        name={offer.is_published ? 'eye' : 'eye-off'} 
                        size={14} 
                        color={offer.is_published ? '#10B981' : '#9CA3AF'} 
                      />
                      <Text style={[
                        styles.publishText,
                        { color: offer.is_published ? '#10B981' : '#9CA3AF' }
                      ]}>
                        {offer.is_published ? t('offers.published') : t('offers.draft')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {offer.short_description && (
                  <Text style={styles.offerDesc} numberOfLines={2}>{offer.short_description}</Text>
                )}

                <View style={styles.offerMeta}>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>${offer.price}</Text>
                    {offer.pricing_model === 'subscription' && (
                      <Text style={styles.priceInterval}>/{offer.subscription_interval === 'monthly' ? 'mois' : 'an'}</Text>
                    )}
                  </View>
                  {offer.difficulty && (
                    <View style={[styles.difficultyBadge, { backgroundColor: difficultyConfig.color + '20' }]}>
                      <Text style={[styles.difficultyText, { color: difficultyConfig.color }]}>
                        {difficultyConfig.label}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaItem}>
                    <Ionicons name="cube-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.metaText}>
                      {offer.included_content_ids?.length || 0} {t('offers.contents')}
                    </Text>
                  </View>
                </View>

                <View style={styles.offerStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="cart-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.statItemText}>{offer.total_sales} {t('offers.sales')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="cash-outline" size={14} color="#10B981" />
                    <Text style={[styles.statItemText, { color: '#10B981' }]}>
                      ${offer.total_revenue.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.deleteBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteOffer(offer.id);
                    }}
                    data-testid={`delete-offer-${offer.id}`}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingOffer ? 'Modifier l\'offre' : 'Nouvelle offre'}
            </Text>
            <TouchableOpacity 
              onPress={handleSaveOffer} 
              disabled={actionLoading}
              data-testid="save-offer-btn"
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Offer Type Selection */}
            <Text style={styles.fieldLabel}>Type d'offre</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {OFFER_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    form.offer_type === type.id && styles.typeCardSelected
                  ]}
                  onPress={() => setForm({ ...form, offer_type: type.id })}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={24} 
                    color={form.offer_type === type.id ? '#F59E0B' : '#9CA3AF'} 
                  />
                  <Text style={[
                    styles.typeCardLabel,
                    form.offer_type === type.id && styles.typeCardLabelSelected
                  ]}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeCardDesc}>{type.desc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Title */}
            <Text style={styles.fieldLabel}>Titre de l'offre *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
              placeholder="Ex: Pack Complet Trading Crypto"
              placeholderTextColor="#9CA3AF"
              data-testid="offer-title-input"
            />

            {/* Short Description */}
            <Text style={styles.fieldLabel}>Accroche (court)</Text>
            <TextInput
              style={styles.input}
              value={form.short_description}
              onChangeText={(text) => setForm({ ...form, short_description: text })}
              placeholder="Une phrase qui vend votre offre"
              placeholderTextColor="#9CA3AF"
            />

            {/* Full Description */}
            <Text style={styles.fieldLabel}>{t('offers.fullDescription')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              placeholder={t('offers.descPlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />

            {/* Price & Model */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>{t("offers.priceRequired")}</Text>
                <TextInput
                  style={styles.input}
                  value={form.price}
                  onChangeText={(text) => setForm({ ...form, price: text.replace(/[^0-9.]/g, '') })}
                  placeholder="99.99"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  data-testid="offer-price-input"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>{t('offers.pricingModel')}</Text>
                <View style={styles.pickerContainer}>
                  {PRICING_MODELS.map(model => (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.pickerOption,
                        form.pricing_model === model.id && styles.pickerOptionSelected
                      ]}
                      onPress={() => setForm({ ...form, pricing_model: model.id })}
                    >
                      <Text style={[
                        styles.pickerText,
                        form.pricing_model === model.id && styles.pickerTextSelected
                      ]}>
                        {model.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Content Selection */}
            <Text style={styles.fieldLabel}>{t('offers.includedContents')} ({form.included_content_ids.length} {t('offers.selected')})</Text>
            <TouchableOpacity 
              style={styles.contentPickerBtn}
              onPress={() => setShowContentPicker(true)}
              data-testid="select-content-btn"
            >
              <Ionicons name="add-circle" size={20} color="#7C3AED" />
              <Text style={styles.contentPickerText}>{t('offers.selectContent')}</Text>
            </TouchableOpacity>

            {selectedContentItems.length > 0 && (
              <View style={styles.selectedContentList}>
                {selectedContentItems.map(content => (
                  <View key={content.id} style={styles.selectedContentItem}>
                    <Text style={styles.selectedContentTitle} numberOfLines={1}>
                      {content.title}
                    </Text>
                    <TouchableOpacity onPress={() => toggleContentSelection(content.id)}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Difficulty Level */}
            <Text style={styles.fieldLabel}>Niveau</Text>
            <View style={styles.difficultyRow}>
              {DIFFICULTY_LEVELS.map(level => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.difficultyOption,
                    form.difficulty === level.id && { borderColor: level.color, backgroundColor: level.color + '10' }
                  ]}
                  onPress={() => setForm({ ...form, difficulty: level.id })}
                >
                  <Text style={[
                    styles.difficultyOptionText,
                    form.difficulty === level.id && { color: level.color }
                  ]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Access Duration */}
            <Text style={styles.fieldLabel}>{t('offers.accessDuration')}</Text>
            <TextInput
              style={styles.input}
              value={form.access_duration_days}
              onChangeText={(text) => setForm({ ...form, access_duration_days: text.replace(/[^0-9]/g, '') })}
              placeholder="365"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />

            {/* Tags */}
            <Text style={styles.fieldLabel}>{t('offers.tags')}</Text>
            <TextInput
              style={styles.input}
              value={form.tags}
              onChangeText={(text) => setForm({ ...form, tags: text })}
              placeholder={t('offers.tagsPlaceholder')}
              placeholderTextColor="#9CA3AF"
            />

            {/* Publish Toggle */}
            <TouchableOpacity
              style={styles.publishToggle}
              onPress={() => setForm({ ...form, is_published: !form.is_published })}
            >
              <View style={styles.publishToggleInfo}>
                <Ionicons 
                  name={form.is_published ? 'eye' : 'eye-off'} 
                  size={20} 
                  color={form.is_published ? '#10B981' : '#6B7280'} 
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.publishToggleTitle}>
                    {form.is_published ? t('offers.offerPublished') : t('offers.draft')}
                  </Text>
                  <Text style={styles.publishToggleDesc}>
                    {form.is_published 
                      ? 'Visible par les clients VIP sur le marketplace'
                      : 'Non visible publiquement'
                    }
                  </Text>
                </View>
              </View>
              <View style={[styles.toggle, form.is_published && styles.toggleActive]}>
                <View style={[styles.toggleThumb, form.is_published && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Content Picker Modal */}
      <Modal visible={showContentPicker} animationType="slide" transparent>
        <View style={styles.pickerModal}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{t('offers.selectContentTitle')}</Text>
              <TouchableOpacity onPress={() => setShowContentPicker(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerModalList}>
              {contentLibrary.length === 0 ? (
                <View style={styles.noContentState}>
                  <Ionicons name="folder-open-outline" size={48} color="#6B7280" />
                  <Text style={styles.noContentText}>{t('offers.noContentInLibrary')}</Text>
                  <TouchableOpacity 
                    style={styles.goToLibraryBtn}
                    onPress={() => {
                      setShowContentPicker(false);
                      setShowModal(false);
                      router.push('/pro/content-library');
                    }}
                  >
                    <Text style={styles.goToLibraryText}>{t('offers.createContentBtn')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                contentLibrary.map(content => (
                  <TouchableOpacity
                    key={content.id}
                    style={[
                      styles.contentPickerItem,
                      form.included_content_ids.includes(content.id) && styles.contentPickerItemSelected
                    ]}
                    onPress={() => toggleContentSelection(content.id)}
                  >
                    <View style={styles.contentPickerCheck}>
                      {form.included_content_ids.includes(content.id) && (
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                      )}
                    </View>
                    <View style={styles.contentPickerInfo}>
                      <Text style={styles.contentPickerTitle}>{content.title}</Text>
                      <Text style={styles.contentPickerType}>{content.content_type}</Text>
                    </View>
                    {content.is_premium && (
                      <Ionicons name="star" size={16} color="#F59E0B" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity 
              style={styles.pickerModalDone}
              onPress={() => setShowContentPicker(false)}
            >
              <Text style={styles.pickerModalDoneText}>
                {t('offers.doneSelected', { count: String(form.included_content_ids.length) })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  libraryShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED10',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C3AED30',
    gap: 10,
  },
  libraryShortcutText: {
    flex: 1,
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500',
  },
  offersList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  offerCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F59E0B20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerTitleArea: {
    flex: 1,
    marginLeft: 12,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  offerType: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
  },
  offerActions: {
    flexDirection: 'row',
  },
  publishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  publishedBadge: {
    backgroundColor: '#10B98120',
  },
  draftBadge: {
    backgroundColor: '#3A3A3A',
  },
  publishText: {
    fontSize: 12,
    fontWeight: '500',
  },
  offerDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 10,
  },
  offerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
    flexWrap: 'wrap',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#10B98120',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  priceInterval: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 2,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  offerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statItemText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  saveButtonText: {
    color: '#F59E0B',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeScroll: {
    flexDirection: 'row',
  },
  typeCard: {
    width: 120,
    padding: 12,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  typeCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B10',
  },
  typeCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  typeCardLabelSelected: {
    color: '#F59E0B',
  },
  typeCardDesc: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickerOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  pickerOptionSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B20',
  },
  pickerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  pickerTextSelected: {
    color: '#F59E0B',
  },
  contentPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    gap: 8,
  },
  contentPickerText: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  selectedContentList: {
    marginTop: 12,
    gap: 8,
  },
  selectedContentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 10,
    borderRadius: 8,
    gap: 10,
  },
  selectedContentTitle: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  difficultyOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  difficultyOptionText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  publishToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  publishToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  publishToggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  publishToggleDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3A3A3A',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  pickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  pickerModalList: {
    padding: 16,
    maxHeight: 400,
  },
  noContentState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noContentText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  goToLibraryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
  },
  goToLibraryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  contentPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#2A2A2A',
    marginBottom: 8,
  },
  contentPickerItemSelected: {
    backgroundColor: '#7C3AED30',
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  contentPickerCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentPickerInfo: {
    flex: 1,
  },
  contentPickerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  contentPickerType: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  pickerModalDone: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  pickerModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C3AED',
  },
});
