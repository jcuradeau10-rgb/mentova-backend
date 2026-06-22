import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import api from '../../utils/api';
import { useTranslation } from '../../store/languageStore';

const { width } = Dimensions.get('window');

interface Purchase {
  id: string;
  offer_id: string;
  offer?: {
    title?: string;
    offer_type?: string;
    thumbnail_url?: string;
  };
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

const STATUS_CONFIG = {
  completed: { 
    label: 'completed', 
    color: '#10B981', 
    bg: '#10B98120',
    icon: 'checkmark-circle' 
  },
  pending: { 
    label: 'pending', 
    color: '#F59E0B', 
    bg: '#F59E0B20',
    icon: 'time' 
  },
  failed: { 
    label: 'failed', 
    color: '#EF4444', 
    bg: '#EF444420',
    icon: 'close-circle' 
  },
};

const OFFER_TYPE_CONFIG: Record<string, { icon: string; gradient: string[] }> = {
  bundle: { icon: 'cube', gradient: ['#7C3AED', '#5B21B6'] },
  mentoring: { icon: 'people', gradient: ['#10B981', '#059669'] },
  course: { icon: 'school', gradient: ['#3B82F6', '#2563EB'] },
  subscription: { icon: 'card', gradient: ['#F59E0B', '#D97706'] },
};

export default function PurchasesScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const loadPurchases = async () => {
    try {
      const response = await api.get('/marketplace/purchases');
      setPurchases(response.data?.data || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPurchases();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPurchases();
  }, []);

  const filteredPurchases = purchases.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const totalSpent = purchases
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getOfferConfig = (type: string) => {
    return OFFER_TYPE_CONFIG[type] || OFFER_TYPE_CONFIG.bundle;
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  };

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.heroSmall}>
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t('purchases.title')}</Text>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        
        <View style={styles.authRequired}>
          <View style={styles.lockCircle}>
            <Ionicons name="lock-closed" size={40} color="#7C3AED" />
          </View>
          <Text style={styles.authTitle}>{t('purchases.loginRequired')}</Text>
          <Text style={styles.authText}>
            {t('purchases.loginText')}
          </Text>
          <TouchableOpacity 
            style={styles.authButton}
            onPress={() => router.push('/login')}
          >
            <LinearGradient 
              colors={['#7C3AED', '#5B21B6']} 
              style={styles.authButtonGradient}
            >
              <Ionicons name="log-in" size={20} color="#FFF" />
              <Text style={styles.authButtonText}>{t('purchases.signIn')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading view
  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.heroSmall}>
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t('purchases.title')}</Text>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>{t('purchases.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <LinearGradient
        colors={['#7C3AED', '#5B21B6', '#1E1B4B']}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('purchases.title')}</Text>
            <TouchableOpacity 
              style={styles.backBtn}
              onPress={() => router.push('/marketplace')}
            >
              <Ionicons name="storefront" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={styles.statIconBg}>
                <Ionicons name="bag-check" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.statValue}>{purchases.length}</Text>
              <Text style={styles.statLabel}>{t('purchases.purchases')}</Text>
            </View>
            
            <View style={[styles.statCard, styles.statCardMain]}>
              <View style={[styles.statIconBg, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="wallet" size={24} color="#10B981" />
              </View>
              <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
              <Text style={styles.statLabel}>{t('purchases.totalSpent')}</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="star" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>
                {purchases.filter(p => p.status === 'completed').length}
              </Text>
              <Text style={styles.statLabel}>{t('purchases.completed')}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
          />
        }
      >
        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(['all', 'completed', 'pending'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? t('purchases.all') : f === 'completed' ? t('purchases.completedFilter') : t('purchases.pendingFilter')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty State */}
        {filteredPurchases.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bag-outline" size={48} color="#5A5A6E" />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? t('purchases.noPurchases') : filter === 'completed' ? t('purchases.noPurchasesCompleted') : t('purchases.noPurchasesPending')}
            </Text>
            <Text style={styles.emptyText}>
              {t('purchases.discoverOffers')}
            </Text>
            <TouchableOpacity 
              style={styles.exploreBtn}
              onPress={() => router.push('/marketplace')}
            >
              <LinearGradient 
                colors={['#7C3AED', '#5B21B6']} 
                style={styles.exploreBtnGradient}
              >
                <Ionicons name="compass" size={18} color="#FFF" />
                <Text style={styles.exploreBtnText}>{t('purchases.explore')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          /* Purchases List */
          <View style={styles.purchasesList}>
            {filteredPurchases.map((purchase, index) => {
              const offerConfig = getOfferConfig(purchase.offer?.offer_type || 'bundle');
              const statusConfig = getStatusConfig(purchase.status);
              const isCompleted = purchase.status === 'completed';
              
              return (
                <TouchableOpacity
                  key={purchase.id}
                  style={styles.purchaseCard}
                  onPress={() => {
                    if (isCompleted) {
                      router.push(`/marketplace/content/${purchase.id}`);
                    }
                  }}
                  activeOpacity={isCompleted ? 0.7 : 1}
                >
                  {/* Card Header with gradient */}
                  <LinearGradient
                    colors={offerConfig.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardHeader}
                  >
                    <View style={styles.cardIconCircle}>
                      <Ionicons name={offerConfig.icon as any} size={24} color="#FFF" />
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {t(`purchases.status${statusConfig.label.charAt(0).toUpperCase() + statusConfig.label.slice(1)}`)}
                      </Text>
                    </View>
                  </LinearGradient>
                  
                  {/* Card Body */}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {purchase.offer?.title || 'Offre'}
                    </Text>
                    
                    <View style={styles.cardMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.metaText}>{formatDate(purchase.created_at)}</Text>
                      </View>
                      <View style={styles.priceTag}>
                        <Text style={styles.priceText}>${purchase.amount.toFixed(2)}</Text>
                      </View>
                    </View>
                    
                    {isCompleted && (
                      <View style={styles.accessRow}>
                        <LinearGradient
                          colors={['#7C3AED20', '#7C3AED10']}
                          style={styles.accessBtn}
                        >
                          <Ionicons name="play-circle" size={18} color="#7C3AED" />
                          <Text style={styles.accessText}>{t('purchases.accessContent')}</Text>
                          <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
                        </LinearGradient>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  hero: {
    paddingBottom: 20,
  },
  heroSmall: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statCardMain: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    marginTop: -10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#0A0A1A',
  },
  scrollContent: {
    paddingTop: 20,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  filterPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  filterTextActive: {
    color: '#FFF',
  },
  purchasesList: {
    paddingHorizontal: 16,
  },
  purchaseCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
    paddingTop: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  priceTag: {
    backgroundColor: '#0A0A1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  accessRow: {
    marginTop: 14,
  },
  accessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  accessText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  exploreBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  exploreBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  loadingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  authText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  authButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  authButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 10,
  },
  authButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
});
