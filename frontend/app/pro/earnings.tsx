import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { proAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

interface EarningsData {
  total_earned: number;
  pending_earnings: number;
  total_paid_out: number;
  available_for_payout: number;
  completed_bookings: number;
  pending_bookings: number;
  recent_payouts: any[];
}

export default function ProEarningsScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const loadEarnings = useCallback(async () => {
    try {
      const response = await proAPI.getEarnings();
      if (response.data.success) {
        setEarnings(response.data.data);
      }
    } catch (error: any) {
      console.error('Error loading earnings:', error);
      if (error.response?.status === 403) {
        Alert.alert(t('common.error'), t('pro.earnings.notPro'));
        router.back();
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.is_professional) {
      loadEarnings();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEarnings();
  }, [loadEarnings]);

  const handleRequestPayout = async () => {
    if (!earnings || earnings.available_for_payout < 10) {
      Alert.alert(t('common.error'), t('pro.earnings.minPayout'));
      return;
    }

    Alert.alert(
      t('pro.earnings.requestPayout'),
      t('pro.earnings.confirmPayout', { amount: earnings.available_for_payout.toFixed(2) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setRequestingPayout(true);
            try {
              const response = await proAPI.requestPayout();
              if (response.data.success) {
                Alert.alert(t('common.success'), response.data.message);
                loadEarnings();
              }
            } catch (error: any) {
              Alert.alert(
                t('common.error'),
                error.response?.data?.detail || t('pro.earnings.payoutError')
              );
            } finally {
              setRequestingPayout(false);
            }
          },
        },
      ]
    );
  };

  if (!isAuthenticated || !user?.is_professional) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <Ionicons name="lock-closed" size={60} color="#6B7280" />
            <Text style={styles.errorText}>{t('pro.earnings.proOnly')}</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('pro.earnings.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
          }
        >
          {/* Main Balance Card */}
          <LinearGradient
            colors={['#7C3AED', '#6366F1', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>{t('pro.earnings.availableBalance')}</Text>
            <Text style={styles.balanceAmount}>
              ${earnings?.available_for_payout.toFixed(2) || '0.00'}
            </Text>
            <Text style={styles.balanceSubtext}>
              {t('pro.earnings.minPayoutInfo')}
            </Text>

            <TouchableOpacity
              style={[
                styles.payoutButton,
                (!earnings || earnings.available_for_payout < 10) && styles.payoutButtonDisabled,
              ]}
              onPress={handleRequestPayout}
              disabled={requestingPayout || !earnings || earnings.available_for_payout < 10}
            >
              {requestingPayout ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={20} color="#7C3AED" />
                  <Text style={styles.payoutButtonText}>{t('pro.earnings.requestPayout')}</Text>
                </>
              )}
            </TouchableOpacity>
          </LinearGradient>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.statValue}>${earnings?.total_earned.toFixed(2) || '0.00'}</Text>
              <Text style={styles.statLabel}>{t('pro.earnings.totalEarned')}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <Ionicons name="time" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>${earnings?.pending_earnings.toFixed(2) || '0.00'}</Text>
              <Text style={styles.statLabel}>{t('pro.earnings.pending')}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                <Ionicons name="arrow-up-circle" size={24} color="#6366F1" />
              </View>
              <Text style={styles.statValue}>${earnings?.total_paid_out.toFixed(2) || '0.00'}</Text>
              <Text style={styles.statLabel}>{t('pro.earnings.paidOut')}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}>
                <Ionicons name="calendar" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.statValue}>{earnings?.completed_bookings || 0}</Text>
              <Text style={styles.statLabel}>{t('pro.earnings.completedBookings')}</Text>
            </View>
          </View>

          {/* Pending Info */}
          {earnings && earnings.pending_bookings > 0 && (
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#F59E0B" />
              <Text style={styles.infoText}>
                {t('pro.earnings.pendingInfo', { count: earnings.pending_bookings })}
              </Text>
            </View>
          )}

          {/* Recent Payouts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pro.earnings.recentPayouts')}</Text>
            
            {earnings?.recent_payouts && earnings.recent_payouts.length > 0 ? (
              earnings.recent_payouts.map((payout, index) => (
                <View key={index} style={styles.payoutItem}>
                  <View style={styles.payoutLeft}>
                    <View style={[
                      styles.payoutStatusDot,
                      payout.status === 'completed' && styles.statusCompleted,
                      payout.status === 'pending' && styles.statusPending,
                      payout.status === 'rejected' && styles.statusRejected,
                    ]} />
                    <View>
                      <Text style={styles.payoutAmount}>${payout.amount.toFixed(2)}</Text>
                      <Text style={styles.payoutDate}>
                        {new Date(payout.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.payoutStatusBadge,
                    payout.status === 'completed' && styles.badgeCompleted,
                    payout.status === 'pending' && styles.badgePending,
                    payout.status === 'rejected' && styles.badgeRejected,
                  ]}>
                    <Text style={styles.payoutStatusText}>
                      {payout.status === 'completed' ? t('pro.earnings.statusPaid') :
                       payout.status === 'pending' ? t('pro.earnings.statusPending') :
                       t('pro.earnings.statusRejected')}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyPayouts}>
                <Ionicons name="receipt-outline" size={40} color="#6B7280" />
                <Text style={styles.emptyText}>{t('pro.earnings.noPayouts')}</Text>
              </View>
            )}
          </View>

          {/* How it works */}
          <View style={styles.howItWorks}>
            <Text style={styles.sectionTitle}>{t('pro.earnings.howItWorks')}</Text>
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>{t('pro.earnings.step1')}</Text>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>{t('pro.earnings.step2')}</Text>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>{t('pro.earnings.step3')}</Text>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
              <Text style={styles.stepText}>{t('pro.earnings.step4')}</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  safeArea: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#A78BFA',
    fontWeight: '600',
  },

  // Balance Card
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    marginTop: 8,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  balanceSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  payoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  payoutButtonDisabled: {
    opacity: 0.5,
  },
  payoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#F59E0B',
  },

  // Section
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },

  // Payout Items
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoutStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6B7280',
  },
  statusCompleted: {
    backgroundColor: '#10B981',
  },
  statusPending: {
    backgroundColor: '#F59E0B',
  },
  statusRejected: {
    backgroundColor: '#EF4444',
  },
  payoutAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  payoutDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  payoutStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  badgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  payoutStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyPayouts: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },

  // How it works
  howItWorks: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A78BFA',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
});
