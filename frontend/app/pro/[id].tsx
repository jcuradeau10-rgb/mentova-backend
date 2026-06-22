import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { proAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import ReportModal from '../../components/ReportModal';

const BADGE_CONFIG: Record<string, { label: string; colors: string[]; icon: string }> = {
  basic: { label: 'Basique', colors: ['#6B7280', '#4B5563'], icon: 'checkmark-circle' },
  verified: { labelKey: 'mentorProfile.badgeVerified', colors: ['#3B82F6', '#2563EB'], icon: 'shield-checkmark' },
  premium: { label: 'Expert Premium', colors: ['#F59E0B', '#D97706'], icon: 'diamond' },
};

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  mentoring: { label: 'Mentoring 1-on-1', icon: 'people', color: '#7C3AED' },
  course: { label: 'Cours/Formation', icon: 'school', color: '#3B82F6' },
  qa_session: { label: 'Session Q&A', icon: 'chatbubbles', color: '#10B981' },
  live_stream: { label: 'Live Stream', icon: 'videocam', color: '#F59E0B' },
};

const EXPERTISE_LABELS: Record<string, string> = {
  trading: 'Trading', defi: 'DeFi', nft: 'NFT', blockchain: 'Blockchain',
  investment: 'Investissement', security: 'Sécurité', mining: 'Mining', metaverse: 'Metaverse',
};

export default function ProfessionalProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  
  // Booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  
  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Generate next 14 days for date selection
  const getNextDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('fr-FR', { month: 'short' }),
      });
    }
    return days;
  };

  const loadAvailableSlots = async (serviceId: string, date: string) => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const response = await proAPI.getAvailableSlots(serviceId, date);
      if (response.data.success) {
        setAvailableSlots(response.data.data || []);
      }
    } catch (error) {
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  // Ensure auth is checked when component mounts
  useEffect(() => {
    if (authLoading) {
      checkAuth();
    }
  }, [authLoading, checkAuth]);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    
    try {
      const [profileRes, servicesRes] = await Promise.all([
        proAPI.getProfessionalById(id),
        proAPI.getProServices(id),
      ]);
      
      if (profileRes.data.success) {
        setProfessional(profileRes.data.data);
        setReviews(profileRes.data.data.recent_reviews || []);
      }
      if (servicesRes.data.success) {
        setServices(servicesRes.data.data || []);
      }
    } catch (error) {
      console.log('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleBookService = (service: any) => {
    if (!isAuthenticated) {
      Alert.alert(t('common.loginRequired'), t('common.loginToBook'), [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: 'Se connecter', onPress: () => router.push('/login') }
      ]);
      return;
    }
    
    if (user?.id === id) {
      Alert.alert(t('catalog.error'), t('catalog.genericError'));
      return;
    }
    
    setSelectedService(service);
    setBookingDate('');
    setBookingTime('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setShowBookingModal(true);
  };

  const handleDateSelect = (date: string) => {
    setBookingDate(date);
    setSelectedSlot(null);
    if (selectedService) {
      loadAvailableSlots(selectedService.id, date);
    }
  };

  const handleSlotSelect = (slot: any) => {
    setSelectedSlot(slot);
    setBookingTime(slot.start);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) {
      Alert.alert(t('vip.hub.alert.error'), t('booking.selectSlot'));
      return;
    }
    
    // Create scheduled_at from bookingDate and selectedSlot
    const scheduledAt = new Date(`${bookingDate}T${selectedSlot.start}:00`).toISOString();
    
    setBookingLoading(true);
    try {
      const response = await proAPI.createBooking({
        service_id: selectedService.id,
        scheduled_at: scheduledAt,
        message: bookingMessage || undefined,
      });
      
      if (response.data.success) {
        setShowBookingModal(false);
        setSelectedService(null);
        setBookingDate('');
        setBookingTime('');
        setBookingMessage('');
        setSelectedSlot(null);
        setAvailableSlots([]);
        
        // Redirect directly to bookings page
        router.push('/bookings');
      }
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setBookingLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i <= rating + 0.5 ? 'star-half' : 'star-outline'}
          size={16}
          color="#F59E0B"
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!professional) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{t("mentorProfile.notFound")}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("common.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badge = BADGE_CONFIG[professional.badge_level] || BADGE_CONFIG.basic;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#1A1A2E', '#0A0A12']} style={styles.header}>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            {/* Report button - only show if not viewing own profile */}
            {isAuthenticated && user?.id !== id && (
              <TouchableOpacity 
                style={styles.reportBtn} 
                onPress={() => setShowReportModal(true)}
                data-testid="report-user-btn"
              >
                <Ionicons name="flag-outline" size={22} color="#8B8B9E" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.profileSection}>
            <LinearGradient colors={badge.colors} style={styles.avatar}>
              <Text style={styles.avatarText}>
                {professional.display_name?.slice(0, 2).toUpperCase()}
              </Text>
            </LinearGradient>
            
            <Text style={styles.name}>{professional.display_name}</Text>
            
            <View style={styles.badgeContainer}>
              <LinearGradient colors={badge.colors} style={styles.badge}>
                <Ionicons name={badge.icon as any} size={14} color="#FFF" />
                <Text style={styles.badgeText}>{badge.label}</Text>
              </LinearGradient>
              {professional.is_available && (
                <View style={styles.availableBadge}>
                  <View style={styles.availableDot} />
                  <Text style={styles.availableText}>Disponible</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.expertise}>
              {EXPERTISE_LABELS[professional.main_expertise] || professional.main_expertise}
            </Text>
            
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <View style={styles.statStars}>{renderStars(professional.average_rating || 0)}</View>
                <Text style={styles.statText}>
                  {professional.average_rating?.toFixed(1) || '0.0'} ({professional.total_reviews || 0} avis)
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="calendar" size={16} color="#8B8B9E" />
                <Text style={styles.statText}>{professional.total_sessions || 0} sessions</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mentorProfile.about")}</Text>
          <Text style={styles.bio}>{professional.bio}</Text>
          
          {professional.specializations && professional.specializations.length > 0 && (
            <View style={styles.tags}>
              {professional.specializations.map((spec: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{EXPERTISE_LABELS[spec] || spec}</Text>
                </View>
              ))}
            </View>
          )}
          
          {professional.languages && professional.languages.length > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="globe" size={16} color="#8B8B9E" />
              <Text style={styles.infoText}>{professional.languages.join(', ')}</Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color="#8B8B9E" />
            <Text style={styles.infoText}>{professional.country}</Text>
          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services ({services.length})</Text>
          
          {services.length > 0 ? (
            services.map((service) => {
              const typeConfig = SERVICE_TYPE_CONFIG[service.service_type] || SERVICE_TYPE_CONFIG.mentoring;
              return (
                <View key={service.id} style={styles.serviceCard}>
                  <View style={styles.serviceHeader}>
                    <View style={[styles.serviceIcon, { backgroundColor: `${typeConfig.color}20` }]}>
                      <Ionicons name={typeConfig.icon as any} size={22} color={typeConfig.color} />
                    </View>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      <Text style={styles.serviceType}>{typeConfig.label}</Text>
                    </View>
                    <View style={styles.servicePrice}>
                      <Text style={styles.servicePriceValue}>{service.price}$</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.serviceDescription} numberOfLines={2}>
                    {service.description}
                  </Text>
                  
                  <View style={styles.serviceFooter}>
                    <View style={styles.serviceMeta}>
                      <Ionicons name="time-outline" size={14} color="#8B8B9E" />
                      <Text style={styles.serviceMetaText}>{service.duration_minutes} min</Text>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.bookBtn}
                      onPress={() => handleBookService(service)}
                    >
                      <Ionicons name="calendar" size={16} color="#FFF" />
                      <Text style={styles.bookBtnText}>{t("mentorProfile.book")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={40} color="#5A5A6E" />
              <Text style={styles.emptyText}>{t("mentorProfile.noServices")}</Text>
            </View>
          )}
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mentorProfile.recentReviews")}</Text>
          
          {reviews.length > 0 ? (
            reviews.map((review: any) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>
                      {review.client_name?.slice(0, 2).toUpperCase() || 'CL'}
                    </Text>
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewName}>{review.client_name}</Text>
                    <Text style={styles.reviewService}>{review.service_title}</Text>
                  </View>
                  <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
                {review.pro_response && (
                  <View style={styles.proResponseBox}>
                    <View style={styles.proResponseHeader}>
                      <Ionicons name="chatbubble" size={14} color="#7C3AED" />
                      <Text style={styles.proResponseLabel}>{t("mentorProfile.mentorResponse")}</Text>
                    </View>
                    <Text style={styles.proResponseText}>{review.pro_response}</Text>
                  </View>
                )}
                <Text style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={40} color="#5A5A6E" />
              <Text style={styles.emptyText}>{t("mentorProfile.noReviews")}</Text>
            </View>
          )}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showBookingModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("mentorProfile.book")}</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedService && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.selectedServiceCard}>
                  <Text style={styles.selectedServiceTitle}>{selectedService.title}</Text>
                  <View style={styles.selectedServiceMeta}>
                    <Text style={styles.selectedServicePrice}>{selectedService.price}$</Text>
                    <Text style={styles.selectedServiceDuration}>
                      {selectedService.duration_minutes} min
                    </Text>
                  </View>
                </View>

                {/* Date Selection */}
                <Text style={styles.inputLabel}>{t("mentorProfile.selectDate")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScrollView}>
                  <View style={styles.datesContainer}>
                    {getNextDays().map((day) => (
                      <TouchableOpacity
                        key={day.date}
                        style={[
                          styles.dateCard,
                          bookingDate === day.date && styles.dateCardActive
                        ]}
                        onPress={() => handleDateSelect(day.date)}
                      >
                        <Text style={[
                          styles.dateDayName,
                          bookingDate === day.date && styles.dateTextActive
                        ]}>{day.dayName}</Text>
                        <Text style={[
                          styles.dateDayNum,
                          bookingDate === day.date && styles.dateTextActive
                        ]}>{day.dayNum}</Text>
                        <Text style={[
                          styles.dateMonth,
                          bookingDate === day.date && styles.dateTextActive
                        ]}>{day.month}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Time Slots */}
                {bookingDate && (
                  <>
                    <Text style={styles.inputLabel}>{t("mentorProfile.availableSlots")}</Text>
                    {slotsLoading ? (
                      <View style={styles.slotsLoadingContainer}>
                        <ActivityIndicator size="small" color="#7C3AED" />
                        <Text style={styles.slotsLoadingText}>{t('booking.loadingSlots')}</Text>
                      </View>
                    ) : availableSlots.length > 0 ? (
                      <View style={styles.slotsGrid}>
                        {availableSlots.map((slot, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.slotCard,
                              selectedSlot?.start === slot.start && styles.slotCardActive
                            ]}
                            onPress={() => handleSlotSelect(slot)}
                          >
                            <Text style={[
                              styles.slotTime,
                              selectedSlot?.start === slot.start && styles.slotTextActive
                            ]}>
                              {slot.start}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noSlotsContainer}>
                        <Ionicons name="calendar-outline" size={32} color="#5A5A6E" />
                        <Text style={styles.noSlotsText}>{t("mentorProfile.noSlots")}</Text>
                        <Text style={styles.noSlotsSubtext}>Essayez une autre date</Text>
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.inputLabel}>{t("mentorProfile.messageOptional")}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('mentorProfile.descPlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  multiline
                  numberOfLines={4}
                  value={bookingMessage}
                  onChangeText={setBookingMessage}
                />

                {selectedSlot && (
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>{t("mentorProfile.summary")}</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{t("mentorProfile.summaryDate")}</Text>
                      <Text style={styles.summaryValue}>{bookingDate}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{t("mentorProfile.summaryTime")}</Text>
                      <Text style={styles.summaryValue}>{selectedSlot.start} - {selectedSlot.end}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Service</Text>
                      <Text style={styles.summaryValue}>{selectedService.price}$</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                      <Text style={styles.summaryTotalLabel}>Total</Text>
                      <Text style={styles.summaryTotalValue}>{selectedService.price}$</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.confirmBtn, !selectedSlot && styles.confirmBtnDisabled]}
                  onPress={handleConfirmBooking}
                  disabled={bookingLoading || !selectedSlot}
                >
                  {bookingLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.confirmBtnText}>{t('booking.confirm')}</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Payment info */}
                <View style={styles.paymentInfoBox}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                  <View style={styles.paymentInfoContent}>
                    <Text style={styles.paymentInfoTitle}>{t('booking.securePayment')}</Text>
                    <Text style={styles.paymentInfoText}>{t('booking.proPaymentInfo')}</Text>
                  </View>
                </View>

                <Text style={styles.disclaimer}>
                  {t('booking.disclaimer')}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={id || ''}
        reportedUserName={professional?.display_name || t('admin.role.user')}
        contextType="profile"
        contextId={id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A12' },
  loadingContainer: { flex: 1, backgroundColor: '#0A0A12', justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, backgroundColor: '#0A0A12', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#EF4444', fontSize: 16, marginTop: 12 },
  backButton: { marginTop: 16, backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backButtonText: { color: '#FFF', fontWeight: '600' },

  header: { paddingTop: 50, paddingBottom: 24, paddingHorizontal: 16 },
  headerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 8 },
  reportBtn: { padding: 8 },
  
  profileSection: { alignItems: 'center', marginTop: 10 },
  avatar: { width: 90, height: 90, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  name: { fontSize: 24, fontWeight: '700', color: '#FFF', marginTop: 16 },
  
  badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  availableBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  availableDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  availableText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  
  expertise: { fontSize: 16, color: '#8B8B9E', marginTop: 8 },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statStars: { flexDirection: 'row' },
  statText: { fontSize: 13, color: '#8B8B9E' },

  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  
  bio: { fontSize: 14, color: '#C4C4C4', lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { backgroundColor: '#7C3AED20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 12, color: '#7C3AED', fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  infoText: { fontSize: 14, color: '#8B8B9E' },

  serviceCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12 },
  serviceHeader: { flexDirection: 'row', alignItems: 'center' },
  serviceIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  serviceInfo: { flex: 1, marginLeft: 12 },
  serviceTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  serviceType: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  servicePrice: { backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  servicePriceValue: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  serviceDescription: { fontSize: 13, color: '#C4C4C4', marginTop: 12, lineHeight: 18 },
  serviceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A4E' },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serviceMetaText: { fontSize: 13, color: '#8B8B9E' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  bookBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  emptyState: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: '#5A5A6E', marginTop: 12 },

  reviewCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  reviewInfo: { flex: 1, marginLeft: 12 },
  reviewName: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  reviewService: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  reviewStars: { flexDirection: 'row' },
  reviewComment: { fontSize: 14, color: '#C4C4C4', marginTop: 12, lineHeight: 20 },
  reviewDate: { fontSize: 12, color: '#5A5A6E', marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: 20 },

  selectedServiceCard: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 16, marginBottom: 20 },
  selectedServiceTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  selectedServiceMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  selectedServicePrice: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  selectedServiceDuration: { fontSize: 14, color: '#8B8B9E' },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#8B8B9E', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#2A2A4E' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  summaryCard: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 16, marginTop: 20 },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: '#8B8B9E' },
  summaryValue: { fontSize: 14, color: '#FFF' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: '#2A2A4E', marginTop: 8, paddingTop: 12 },
  summaryTotalLabel: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  summaryTotalValue: { fontSize: 18, fontWeight: '700', color: '#10B981' },

  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, marginTop: 20 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  disclaimer: { fontSize: 12, color: '#5A5A6E', textAlign: 'center', marginTop: 16, lineHeight: 18 },

  // Date selection styles
  datesScrollView: { marginVertical: 12 },
  datesContainer: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  dateCard: { 
    width: 70, 
    paddingVertical: 12, 
    paddingHorizontal: 8,
    borderRadius: 12, 
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A4E',
  },
  dateCardActive: { 
    backgroundColor: '#7C3AED20',
    borderColor: '#7C3AED',
  },
  dateDayName: { fontSize: 12, color: '#8B8B9E', fontWeight: '500', textTransform: 'capitalize' },
  dateDayNum: { fontSize: 22, fontWeight: '700', color: '#FFF', marginVertical: 4 },
  dateMonth: { fontSize: 11, color: '#8B8B9E', textTransform: 'capitalize' },
  dateTextActive: { color: '#7C3AED' },

  // Time slots styles
  slotsLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  slotsLoadingText: { fontSize: 14, color: '#8B8B9E' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  slotCard: { 
    paddingVertical: 12, 
    paddingHorizontal: 18,
    borderRadius: 10, 
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#2A2A4E',
  },
  slotCardActive: { 
    backgroundColor: '#10B98120',
    borderColor: '#10B981',
  },
  slotTime: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  slotTextActive: { color: '#10B981' },
  noSlotsContainer: { alignItems: 'center', padding: 24 },
  noSlotsText: { fontSize: 15, color: '#8B8B9E', marginTop: 10 },
  noSlotsSubtext: { fontSize: 13, color: '#5A5A6E', marginTop: 4 },

  // Pro Response styles
  proResponseBox: { backgroundColor: '#7C3AED10', borderRadius: 12, padding: 14, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  proResponseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  proResponseLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  proResponseText: { fontSize: 13, color: '#C4C4C4', lineHeight: 18 },
  
  // Payment info box
  paymentInfoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#10B98115', borderRadius: 12, padding: 14, marginTop: 16, marginBottom: 12, borderWidth: 1, borderColor: '#10B98130' },
  paymentInfoContent: { flex: 1, marginLeft: 12 },
  paymentInfoTitle: { fontSize: 14, fontWeight: '700', color: '#10B981', marginBottom: 4 },
  paymentInfoText: { fontSize: 12, color: '#86EFAC', lineHeight: 18 },
});
