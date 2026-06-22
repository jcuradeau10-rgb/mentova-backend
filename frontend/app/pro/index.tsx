import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { proAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { useContentTranslation } from '../../hooks/useContentTranslation';

const { width } = Dimensions.get('window');

const BADGE_CONFIG: Record<string, { label: string; colors: string[]; icon: string }> = {
  basic: { label: 'Basique', colors: ['#6B7280', '#4B5563'], icon: 'checkmark-circle' },
  verified: { labelKey: 'mentorIndex.badgeVerified', colors: ['#3B82F6', '#2563EB'], icon: 'shield-checkmark' },
  premium: { label: 'Premium', colors: ['#F59E0B', '#D97706'], icon: 'diamond' },
};

const EXPERTISE_LABELS: Record<string, string> = {
  trading: 'Trading',
  defi: 'DeFi',
  nft: 'NFT',
  blockchain: 'Blockchain',
  investment: 'Investissement',
  security: 'Sécurité',
  mining: 'Mining',
  metaverse: 'Metaverse',
};

export default function ProsListScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { translateContent, language } = useContentTranslation();
  
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [translatedBios, setTranslatedBios] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter options from API
  const [expertiseOptions, setExpertiseOptions] = useState<string[]>([]);

  const loadProfessionals = useCallback(async () => {
    try {
      const res = await proAPI.getProfessionals({
        search: search || undefined,
        expertise: selectedExpertise || undefined,
        badge_level: selectedBadge || undefined,
        sort_by: sortBy,
        limit: 50,
      });
      
      if (res.data.success) {
        setProfessionals(res.data.data || []);
        if (res.data.filters?.expertise_options) {
          setExpertiseOptions(res.data.filters.expertise_options);
        }
      }
    } catch (error) {
      console.log('Failed to load professionals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedExpertise, selectedBadge, sortBy]);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  useEffect(() => {
    if (language === 'fr' || professionals.length === 0) {
      setTranslatedBios({});
      return;
    }
    const translateBios = async () => {
      const textsToTranslate: Record<string, string> = {};
      professionals.forEach((pro, i) => {
        if (pro.bio) textsToTranslate[`bio_${i}`] = pro.bio;
      });
      const translated = await translateContent(textsToTranslate);
      const mapped: Record<string, string> = {};
      professionals.forEach((pro, i) => {
        mapped[pro.user_id || i] = translated[`bio_${i}`] || pro.bio || '';
      });
      setTranslatedBios(mapped);
    };
    translateBios();
  }, [professionals, language]);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i <= rating + 0.5 ? 'star-half' : 'star-outline'}
          size={14}
          color="#F59E0B"
        />
      );
    }
    return stars;
  };

  const renderProCard = (pro: any) => {
    const badge = BADGE_CONFIG[pro.badge_level] || BADGE_CONFIG.basic;
    
    return (
      <TouchableOpacity
        key={pro.id || pro.user_id}
        style={styles.proCard}
        onPress={() => router.push(`/pro/${pro.user_id}`)}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.proCardHeader}>
          <LinearGradient colors={badge.colors} style={styles.proAvatar}>
            <Text style={styles.proAvatarText}>
              {pro.display_name?.slice(0, 2).toUpperCase() || 'PR'}
            </Text>
          </LinearGradient>
          
          <View style={styles.proInfo}>
            <View style={styles.proNameRow}>
              <Text style={styles.proName} numberOfLines={1}>{pro.display_name}</Text>
              <LinearGradient colors={badge.colors} style={styles.proBadge}>
                <Ionicons name={badge.icon as any} size={10} color="#FFFFFF" />
                <Text style={styles.proBadgeText}>{badge.label}</Text>
              </LinearGradient>
            </View>
            <Text style={styles.proExpertise}>
              {EXPERTISE_LABELS[pro.main_expertise] || pro.main_expertise}
            </Text>
            <View style={styles.proRatingRow}>
              <View style={styles.proStars}>{renderStars(pro.average_rating || 0)}</View>
              <Text style={styles.proRatingText}>
                {pro.average_rating?.toFixed(1) || '0.0'} ({pro.total_reviews || 0} avis)
              </Text>
            </View>
          </View>
          
          {pro.is_available && (
            <View style={styles.availableBadge}>
              <View style={styles.availableDot} />
              <Text style={styles.availableText}>{t('mentorIndex.available')}</Text>
            </View>
          )}
        </View>
        
        {/* Bio */}
        <Text style={styles.proBio} numberOfLines={2}>{translatedBios[pro.user_id] || pro.bio}</Text>
        
        {/* Specializations */}
        {pro.specializations && pro.specializations.length > 0 && (
          <View style={styles.proTags}>
            {pro.specializations.slice(0, 3).map((spec: string, i: number) => (
              <View key={i} style={styles.proTag}>
                <Text style={styles.proTagText}>{EXPERTISE_LABELS[spec] || spec}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Footer */}
        <View style={styles.proCardFooter}>
          <View style={styles.proStats}>
            <View style={styles.proStat}>
              <Ionicons name="people" size={14} color="#8B8B9E" />
              <Text style={styles.proStatText}>{pro.total_sessions || 0} sessions</Text>
            </View>
            <View style={styles.proStat}>
              <Ionicons name="globe" size={14} color="#8B8B9E" />
              <Text style={styles.proStatText}>{pro.country || 'N/A'}</Text>
            </View>
          </View>
          
          {pro.hourly_rate && (
            <View style={styles.proPrice}>
              <Text style={styles.proPriceLabel}>{t("mentorIndex.startingAt")}</Text>
              <Text style={styles.proPriceValue}>{pro.hourly_rate}$/h</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trouver un Pro</Text>
        <TouchableOpacity 
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={22} color={showFilters ? '#FFFFFF' : '#8B8B9E'} />
        </TouchableOpacity>
      </View>
      
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#5A5A6E" />
        <TextInput
          style={styles.searchInput}
          placeholder={t("mentorIndex.searchPlaceholder")}
          placeholderTextColor="#5A5A6E"
          value={search}
          onChangeText={setSearch}
        />
        {search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#5A5A6E" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filters Panel */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Expertise Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t("mentorIndex.expertiseFilter")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedExpertise && styles.filterChipActive]}
                onPress={() => setSelectedExpertise(null)}
              >
                <Text style={[styles.filterChipText, !selectedExpertise && styles.filterChipTextActive]}>
                  Toutes
                </Text>
              </TouchableOpacity>
              {expertiseOptions.map((exp) => (
                <TouchableOpacity
                  key={exp}
                  style={[styles.filterChip, selectedExpertise === exp && styles.filterChipActive]}
                  onPress={() => setSelectedExpertise(exp)}
                >
                  <Text style={[styles.filterChipText, selectedExpertise === exp && styles.filterChipTextActive]}>
                    {EXPERTISE_LABELS[exp] || exp}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Badge Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t("mentorIndex.verificationLevel")}</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedBadge && styles.filterChipActive]}
                onPress={() => setSelectedBadge(null)}
              >
                <Text style={[styles.filterChipText, !selectedBadge && styles.filterChipTextActive]}>
                  Tous
                </Text>
              </TouchableOpacity>
              {Object.entries(BADGE_CONFIG).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, selectedBadge === key && styles.filterChipActive]}
                  onPress={() => setSelectedBadge(key)}
                >
                  <Ionicons name={config.icon as any} size={12} color={selectedBadge === key ? '#FFFFFF' : '#8B8B9E'} />
                  <Text style={[styles.filterChipText, selectedBadge === key && styles.filterChipTextActive]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Sort */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t("mentorIndex.sortBy")}</Text>
            <View style={styles.filterRow}>
              {[
                { id: 'rating', label: 'Note' },
                { id: 'price', label: 'Prix' },
                { id: 'sessions', label: 'Sessions' },
              ].map((sort) => (
                <TouchableOpacity
                  key={sort.id}
                  style={[styles.filterChip, sortBy === sort.id && styles.filterChipActive]}
                  onPress={() => setSortBy(sort.id)}
                >
                  <Text style={[styles.filterChipText, sortBy === sort.id && styles.filterChipTextActive]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
      
      {/* Results */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadProfessionals(); }}
            tintColor="#7C3AED"
          />
        }
      >
        {/* Stats */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>{professionals.length} mentors</Text>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : professionals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#2A2A4E" />
            <Text style={styles.emptyTitle}>{t("mentorIndex.noMentorFound")}</Text>
            <Text style={styles.emptySubtitle}>
              Essayez de modifier vos filtres ou revenez plus tard
            </Text>
          </View>
        ) : (
          professionals.map(renderProCard)
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Floating CTA */}
      <View style={styles.floatingCTA}>
        {user?.is_professional ? (
          <TouchableOpacity 
            style={styles.becomePro}
            onPress={() => router.push('/pro/dashboard')}
          >
            <LinearGradient colors={['#10B981', '#059669']} style={styles.becomeProGradient}>
              <Ionicons name="grid" size={20} color="#FFFFFF" />
              <Text style={styles.becomeProText}>Mon Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.becomePro}
            onPress={() => router.push('/pro/join')}
          >
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.becomeProGradient}>
              <Ionicons name="school" size={20} color="#FFFFFF" />
              <Text style={styles.becomeProText}>{t("mentorIndex.becomeMentor")}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginLeft: 12 },
  filterToggle: { padding: 10, borderRadius: 12, backgroundColor: '#1A1A2E' },
  filterToggleActive: { backgroundColor: '#7C3AED' },
  
  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A4E' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#FFFFFF' },
  
  // Filters
  filtersPanel: { paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  filterSection: { marginBottom: 16 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#8B8B9E', marginBottom: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E', marginRight: 8 },
  filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterChipText: { fontSize: 12, color: '#8B8B9E' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  
  // Content
  content: { flex: 1, paddingHorizontal: 16 },
  resultsHeader: { marginVertical: 12 },
  resultsCount: { fontSize: 13, color: '#8B8B9E' },
  
  // Loading & Empty
  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#5A5A6E', marginTop: 4, textAlign: 'center' },
  
  // Pro Card
  proCard: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#2A2A4E' },
  proCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  proAvatar: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  proAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  proInfo: { flex: 1, marginLeft: 14 },
  proNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proName: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  proBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  proExpertise: { fontSize: 13, color: '#8B8B9E', marginTop: 2 },
  proRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  proStars: { flexDirection: 'row' },
  proRatingText: { fontSize: 12, color: '#8B8B9E' },
  availableBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 8 },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  availableText: { fontSize: 11, fontWeight: '600', color: '#10B981' },
  proBio: { fontSize: 13, color: '#C4C4C4', lineHeight: 20, marginTop: 12 },
  proTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  proTag: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 8 },
  proTagText: { fontSize: 11, color: '#7C3AED', fontWeight: '500' },
  proCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A4E' },
  proStats: { flexDirection: 'row', gap: 16 },
  proStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  proStatText: { fontSize: 12, color: '#8B8B9E' },
  proPrice: { alignItems: 'flex-end' },
  proPriceLabel: { fontSize: 10, color: '#5A5A6E' },
  proPriceValue: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  
  // Floating CTA
  floatingCTA: { position: 'absolute', bottom: 30, right: 20 },
  becomePro: { borderRadius: 28, overflow: 'hidden', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  becomeProGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  becomeProText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
