import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { proAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

type TabType = 'upcoming' | 'pending' | 'completed' | 'cancelled';
type ViewMode = 'client' | 'mentor';

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; bgColor: string; icon: string }> = {
  pending: { labelKey: 'booking.pending', color: '#F59E0B', bgColor: '#F59E0B20', icon: 'time' },
  confirmed: { labelKey: 'pro.confirmed', color: '#3B82F6', bgColor: '#3B82F620', icon: 'checkmark-circle' },
  completed: { labelKey: 'booking.completed', color: '#10B981', bgColor: '#10B98120', icon: 'checkmark-done' },
  cancelled: { labelKey: 'booking.cancelled', color: '#EF4444', bgColor: '#EF444420', icon: 'close-circle' },
  refunded: { labelKey: 'common.refunded', color: '#8B5CF6', bgColor: '#8B5CF620', icon: 'refresh' },
};

const SERVICE_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  mentoring: { icon: 'people', color: '#7C3AED' },
  course: { icon: 'school', color: '#3B82F6' },
  qa_session: { icon: 'chatbubbles', color: '#10B981' },
  live_stream: { icon: 'videocam', color: '#F59E0B' },
};

export default function MyBookingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string; payment?: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const isPro = user?.is_professional === true;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>(isPro ? 'mentor' : 'client');
  const [bookings, setBookings] = useState<any[]>([]);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Handle payment return from Stripe
  useEffect(() => {
    if (params.session_id && params.payment === 'success') {
      setPaymentProcessing(true);
      pollPaymentStatus(params.session_id);
    }
  }, [params.session_id, params.payment]);

  // Reset to default view when isPro changes
  useEffect(() => {
    setViewMode(isPro ? 'mentor' : 'client');
  }, [isPro]);

  const pollPaymentStatus = async (sessionId: string, attempts = 0) => {
    const maxAttempts = 5;
    if (attempts >= maxAttempts) {
      setPaymentProcessing(false);
      Alert.alert(t('booking.alert.info'), t('booking.alert.paymentVerifying'));
      return;
    }
    try {
      const response = await proAPI.getPaymentStatus(sessionId);
      if (response.data.success) {
        if (response.data.payment_status === 'paid') {
          setPaymentProcessing(false);
          Alert.alert(t('booking.alert.paymentSuccessTitle'), t('booking.alert.paymentSuccess'));
          loadBookings();
          return;
        } else if (response.data.payment_status === 'expired') {
          setPaymentProcessing(false);
          Alert.alert(t('booking.alert.sessionExpiredTitle'), t('booking.alert.sessionExpired'));
          return;
        }
      }
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (error) {
      setPaymentProcessing(false);
    }
  };

  const handlePayBooking = async (booking: any) => {
    try {
      const originUrl = Platform.OS === 'web' ? window.location.origin : 'https://mentova.app';
      const response = await proAPI.createBookingPayment(booking.id, originUrl);
      if (response.data.success && response.data.checkout_url) {
        if (Platform.OS === 'web') {
          window.location.href = response.data.checkout_url;
        } else {
          Linking.openURL(response.data.checkout_url);
        }
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('booking.alert.paymentError'));
    }
  };

  const loadBookings = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      let filteredBookings: any[] = [];
      const fetchFn = viewMode === 'mentor' ? proAPI.getBookings : proAPI.getMyBookings;

      // Normalize booking data (handle old & new format)
      const normalize = (b: any) => ({
        ...b,
        service_title: b.service_title || b.service_name || 'Session',
        service_type: b.service_type || 'mentoring',
        scheduled_at: b.scheduled_at || (b.date ? `${b.date}T${b.time_slot || '00:00'}:00` : b.created_at),
        total_amount: b.total_amount ?? b.amount ?? 0,
        duration_minutes: b.duration_minutes || 60,
        pro_name: b.pro_name || 'Mentor',
        client_name: b.client_name || 'Client',
      });

      if (activeTab === 'upcoming') {
        const [pendingRes, confirmedRes] = await Promise.all([
          fetchFn({ status: 'pending', limit: 50 }),
          fetchFn({ status: 'confirmed', limit: 50 })
        ]);
        const pending = (pendingRes.data.data || []).map(normalize).filter((b: any) => new Date(b.scheduled_at) > new Date());
        const confirmed = (confirmedRes.data.data || []).map(normalize).filter((b: any) => new Date(b.scheduled_at) > new Date());
        filteredBookings = [...pending, ...confirmed].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      } else {
        const response = await fetchFn({ status: activeTab, limit: 50 });
        filteredBookings = (response.data.data || []).map(normalize);
      }
      setBookings(filteredBookings);
    } catch (error) {
      console.log('Error loading bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, isAuthenticated, viewMode]);

  useEffect(() => { setLoading(true); loadBookings(); }, [loadBookings]);

  const handleCancelBooking = async (bookingId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('bookings.cancelConfirmMsg'));
      if (confirmed) {
        try {
          await proAPI.cancelBooking(bookingId);
          alert(t('bookings.cancelledSuccess'));
          loadBookings();
        } catch (error: any) {
          alert(error.response?.data?.detail || t('catalog.genericError'));
        }
      }
    } else {
      Alert.alert(t('bookings.cancelConfirmTitle'), t('booking.cancelConfirm'), [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui', style: 'destructive', onPress: async () => {
          try { await proAPI.cancelBooking(bookingId); loadBookings(); } catch (e) {}
        }}
      ]);
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    try {
      await proAPI.updateBookingStatus(bookingId, status);
      loadBookings();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || 'Erreur');
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedBooking) return;
    setReviewLoading(true);
    try {
      await proAPI.submitReview(selectedBooking.id, reviewRating, reviewComment || undefined);
      setShowReviewModal(false);
      setSelectedBooking(null);
      setReviewRating(5);
      setReviewComment('');
      Alert.alert(t('booking.alert.reviewSuccessTitle'), t('booking.alert.reviewSuccess'));
      loadBookings();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('booking.alert.reviewError'));
    } finally {
      setReviewLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (!isAuthenticated) {
    return (
      <View style={s.authContainer}>
        <Ionicons name="calendar-outline" size={64} color="#5A5A6E" />
        <Text style={s.authTitle}>{t('booking.loginRequired')}</Text>
        <Text style={s.authSubtitle}>{t('booking.loginToSee')}</Text>
        <Pressable style={s.authBtn} onPress={() => router.push('/login')}>
          <Text style={s.authBtnText}>{t('booking.login')}</Text>
        </Pressable>
      </View>
    );
  }

  const emptyMsg = viewMode === 'mentor'
    ? { upcoming: t('booking.mentorUpcoming'), pending: t('booking.mentorPending'), completed: t('booking.mentorCompleted'), cancelled: t('booking.mentorCancelled') }
    : { upcoming: t('booking.upcomingSessions'), pending: t('booking.pendingConfirmation'), completed: t('booking.completedSessions'), cancelled: t('booking.cancelledSessions') };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="bookings-back-btn">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={s.headerTitle}>
          {viewMode === 'mentor' ? t('booking.clientAppointments') : t('booking.myAppointments')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* View Mode Toggle (only for professionals) */}
      {isPro && (
        <View style={s.viewToggleRow}>
          <Pressable
            style={[s.viewToggleBtn, viewMode === 'mentor' && s.viewToggleBtnActive]}
            onPress={() => setViewMode('mentor')}
            data-testid="view-mode-mentor"
          >
            <Ionicons name="school" size={16} color={viewMode === 'mentor' ? '#FFF' : '#8B8B9E'} />
            <Text style={[s.viewToggleText, viewMode === 'mentor' && s.viewToggleTextActive]}>
              {t('booking.viewAsMentor')}
            </Text>
          </Pressable>
          <Pressable
            style={[s.viewToggleBtn, viewMode === 'client' && s.viewToggleBtnActive]}
            onPress={() => setViewMode('client')}
            data-testid="view-mode-client"
          >
            <Ionicons name="person" size={16} color={viewMode === 'client' ? '#FFF' : '#8B8B9E'} />
            <Text style={[s.viewToggleText, viewMode === 'client' && s.viewToggleTextActive]}>
              {t('booking.viewAsClient')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll}>
        <View style={s.tabsContainer}>
          {([
            { key: 'upcoming', labelKey: 'booking.upcoming', icon: 'calendar' },
            { key: 'pending', labelKey: 'booking.pending', icon: 'time' },
            { key: 'completed', labelKey: 'booking.completed', icon: 'checkmark-done' },
            { key: 'cancelled', labelKey: 'booking.cancelled', icon: 'close-circle' },
          ] as const).map((tab) => (
            <Pressable
              key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => { setActiveTab(tab.key); setLoading(true); }}
              data-testid={`tab-${tab.key}`}
            >
              <Ionicons name={tab.icon} size={18} color={activeTab === tab.key ? '#7C3AED' : '#8B8B9E'} />
              <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{t(tab.labelKey)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBookings(); }} tintColor="#7C3AED" />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingContainer}><ActivityIndicator size="large" color="#7C3AED" /></View>
        ) : bookings.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#2A2A4E" />
            <Text style={s.emptyTitle}>
              {viewMode === 'mentor' ? t('booking.noMentorBookings') : t('booking.noBookings')}
            </Text>
            <Text style={s.emptySubtitle}>{emptyMsg[activeTab]}</Text>
            {viewMode === 'client' && (
              <Pressable style={s.exploreCTA} onPress={() => router.push('/pro')}>
                <Ionicons name="search" size={18} color="#FFF" />
                <Text style={s.exploreCTAText}>{t('booking.explorePros')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          bookings.map((booking) => {
            const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
            const serviceConfig = SERVICE_TYPE_CONFIG[booking.service_type] || SERVICE_TYPE_CONFIG.mentoring;
            const isPast = new Date(booking.scheduled_at) < new Date();
            const canReview = viewMode === 'client' && booking.status === 'completed' && !booking.has_review;
            const canCancel = viewMode === 'client' && ['pending', 'confirmed'].includes(booking.status) && !isPast;
            const canConfirm = viewMode === 'mentor' && booking.status === 'pending';
            const canComplete = viewMode === 'mentor' && booking.status === 'confirmed' && isPast;
            const canMentorCancel = viewMode === 'mentor' && ['pending', 'confirmed'].includes(booking.status) && !isPast;

            return (
              <View key={booking.id} style={s.bookingCard} data-testid={`booking-card-${booking.id}`}>
                <View style={s.bookingHeader}>
                  <View style={[s.serviceIcon, { backgroundColor: `${serviceConfig.color}20` }]}>
                    <Ionicons name={serviceConfig.icon as any} size={22} color={serviceConfig.color} />
                  </View>
                  <View style={s.bookingInfo}>
                    <Text style={s.bookingTitle}>{booking.service_title}</Text>
                    <Text style={s.bookingPro}>
                      {viewMode === 'mentor'
                        ? `${t('booking.from')} ${booking.client_name || 'Client'}`
                        : `${t('booking.with')} ${booking.pro_name}`
                      }
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
                    <Text style={[s.statusText, { color: statusConfig.color }]}>{t(statusConfig.labelKey)}</Text>
                  </View>
                </View>

                <View style={s.bookingDetails}>
                  <View style={s.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#8B8B9E" />
                    <Text style={s.detailText}>{formatDate(booking.scheduled_at)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#8B8B9E" />
                    <Text style={s.detailText}>{booking.duration_minutes} {t('booking.minutes')}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Ionicons name="cash-outline" size={16} color="#10B981" />
                    <Text style={[s.detailText, { color: '#10B981' }]}>
                      {viewMode === 'mentor' ? `${booking.pro_earnings || booking.total_amount}$` : `${booking.total_amount}$`}
                    </Text>
                  </View>
                </View>

                {/* Client message */}
                {booking.client_message && (
                  <View style={s.messageBox}>
                    <Text style={s.messageLabel}>
                      {viewMode === 'mentor' ? t('booking.clientMessage') : t('booking.yourMessage')}
                    </Text>
                    <Text style={s.messageText}>{booking.client_message}</Text>
                  </View>
                )}

                {/* Payment info (client view only) */}
                {viewMode === 'client' && (booking.status === 'pending' || booking.status === 'confirmed') && booking.payment_status !== 'paid' && (
                  <View style={s.paymentInfoBanner}>
                    <Ionicons name="information-circle" size={18} color="#3B82F6" />
                    <Text style={s.paymentInfoText}>{t('booking.payment.proPaymentInfo')}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={s.bookingActions}>
                  {/* Mentor actions */}
                  {canConfirm && (
                    <Pressable style={[s.actionBtn, s.actionBtnConfirm]} onPress={() => handleUpdateStatus(booking.id, 'confirmed')} data-testid={`confirm-${booking.id}`}>
                      <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                      <Text style={s.actionBtnTextWhite}>{t('booking.confirmBooking')}</Text>
                    </Pressable>
                  )}
                  {canComplete && (
                    <Pressable style={[s.actionBtn, s.actionBtnComplete]} onPress={() => handleUpdateStatus(booking.id, 'completed')} data-testid={`complete-${booking.id}`}>
                      <Ionicons name="checkmark-done" size={16} color="#FFF" />
                      <Text style={s.actionBtnTextWhite}>{t('booking.completeBooking')}</Text>
                    </Pressable>
                  )}
                  {canMentorCancel && (
                    <Pressable style={[s.actionBtn, s.actionBtnDanger]} onPress={() => handleUpdateStatus(booking.id, 'cancelled')} data-testid={`mentor-cancel-${booking.id}`}>
                      <Ionicons name="close" size={16} color="#EF4444" />
                      <Text style={[s.actionBtnText, { color: '#EF4444' }]}>{t('common.cancel')}</Text>
                    </Pressable>
                  )}

                  {/* Client actions */}
                  {viewMode === 'client' && ['pending', 'confirmed'].includes(booking.status) && booking.payment_status !== 'paid' && (
                    <Pressable style={[s.actionBtn, s.actionBtnPayment]} onPress={() => handlePayBooking(booking)}>
                      <Ionicons name="card" size={16} color="#FFF" />
                      <Text style={s.actionBtnTextWhite}>{t('booking.payment.payNow')} - {booking.total_amount}$</Text>
                    </Pressable>
                  )}
                  {booking.payment_status === 'paid' && (
                    <View style={s.paidBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={s.paidBadgeText}>{t('booking.paid')}</Text>
                    </View>
                  )}
                  {canReview && (
                    <Pressable style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => { setSelectedBooking(booking); setReviewRating(5); setReviewComment(''); setShowReviewModal(true); }}>
                      <Ionicons name="star" size={16} color="#FFF" />
                      <Text style={s.actionBtnTextWhite}>{t('booking.leaveReview')}</Text>
                    </Pressable>
                  )}
                  {canCancel && (
                    <Pressable style={[s.actionBtn, s.actionBtnDanger]} onPress={() => handleCancelBooking(booking.id)}>
                      <Ionicons name="close" size={16} color="#EF4444" />
                      <Text style={[s.actionBtnText, { color: '#EF4444' }]}>{t('common.cancel')}</Text>
                    </Pressable>
                  )}
                  {viewMode === 'client' && (
                    <Pressable style={s.actionBtn} onPress={() => router.push(`/pro/${booking.pro_id}`)}>
                      <Ionicons name="person" size={16} color="#7C3AED" />
                      <Text style={[s.actionBtnText, { color: '#7C3AED' }]}>{t('booking.viewProfile')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}

        {paymentProcessing && (
          <View style={s.paymentProcessingOverlay}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={s.paymentProcessingText}>{t('bookings.paymentProcessing')}</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('booking.review')}</Text>
              <Pressable onPress={() => setShowReviewModal(false)} data-testid="close-review-modal">
                <Ionicons name="close" size={24} color="#FFF" />
              </Pressable>
            </View>
            {selectedBooking && (
              <ScrollView style={s.modalBody}>
                <View style={s.reviewServiceCard}>
                  <Text style={s.reviewServiceTitle}>{selectedBooking.service_title}</Text>
                  <Text style={s.reviewServicePro}>{t('booking.with')} {selectedBooking.pro_name}</Text>
                </View>
                <Text style={s.inputLabel}>{t('booking.rating')}</Text>
                <View style={s.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable key={star} onPress={() => setReviewRating(star)}>
                      <Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={36} color="#F59E0B" />
                    </Pressable>
                  ))}
                </View>
                <Text style={s.ratingText}>
                  {reviewRating === 1 && t('booking.veryUnsatisfied')}
                  {reviewRating === 2 && t('booking.unsatisfied')}
                  {reviewRating === 3 && t('booking.okay')}
                  {reviewRating === 4 && t('booking.satisfied')}
                  {reviewRating === 5 && t('booking.verySatisfied')}
                </Text>
                <Text style={s.inputLabel}>{t('booking.commentOptional')}</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder={t('booking.shareExperience')}
                  placeholderTextColor="#5A5A6E"
                  multiline
                  numberOfLines={4}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                />
                <Pressable style={s.submitBtn} onPress={handleSubmitReview} disabled={reviewLoading}>
                  {reviewLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#FFF" />
                      <Text style={s.submitBtnText}>{t('booking.sendReview')}</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A12' },
  authContainer: { flex: 1, backgroundColor: '#0A0A12', justifyContent: 'center', alignItems: 'center', padding: 24 },
  authTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 16 },
  authSubtitle: { fontSize: 14, color: '#8B8B9E', marginTop: 8, textAlign: 'center' },
  authBtn: { marginTop: 24, backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  authBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12 },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFF', textAlign: 'center' },

  // View toggle
  viewToggleRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1A1A2E', borderRadius: 14, padding: 4 },
  viewToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  viewToggleBtnActive: { backgroundColor: '#7C3AED' },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: '#8B8B9E' },
  viewToggleTextActive: { color: '#FFF' },

  tabsScroll: { maxHeight: 50 },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1A1A2E' },
  tabActive: { backgroundColor: '#7C3AED20' },
  tabLabel: { fontSize: 13, color: '#8B8B9E', fontWeight: '500' },
  tabLabelActive: { color: '#7C3AED' },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#8B8B9E', marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  exploreCTA: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 24 },
  exploreCTAText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  bookingCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12 },
  bookingHeader: { flexDirection: 'row', alignItems: 'center' },
  serviceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bookingInfo: { flex: 1, marginLeft: 12 },
  bookingTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  bookingPro: { fontSize: 13, color: '#8B8B9E', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },

  bookingDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2A2A4E' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: '#8B8B9E' },

  messageBox: { backgroundColor: '#0A0A12', borderRadius: 10, padding: 12, marginTop: 12 },
  messageLabel: { fontSize: 11, color: '#5A5A6E', marginBottom: 4 },
  messageText: { fontSize: 13, color: '#C4C4C4' },

  bookingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#0A0A12' },
  actionBtnPrimary: { backgroundColor: '#7C3AED' },
  actionBtnConfirm: { backgroundColor: '#3B82F6' },
  actionBtnComplete: { backgroundColor: '#10B981' },
  actionBtnDanger: { backgroundColor: '#EF444420' },
  actionBtnPayment: { backgroundColor: '#10B981' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  actionBtnTextWhite: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#10B98120' },
  paidBadgeText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  paymentInfoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#3B82F620', borderRadius: 10, padding: 12, marginTop: 12 },
  paymentInfoText: { flex: 1, fontSize: 12, color: '#93C5FD', lineHeight: 18 },
  paymentProcessingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,18,0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  paymentProcessingText: { color: '#10B981', fontSize: 16, fontWeight: '600', marginTop: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: 20 },

  reviewServiceCard: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 16, marginBottom: 20 },
  reviewServiceTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  reviewServicePro: { fontSize: 13, color: '#8B8B9E', marginTop: 4 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#8B8B9E', marginBottom: 8, marginTop: 12 },
  ratingSelector: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  ratingText: { fontSize: 14, color: '#F59E0B', textAlign: 'center', marginTop: 8 },

  input: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#2A2A4E' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, marginTop: 20 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
