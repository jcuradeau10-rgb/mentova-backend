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

type TabType = 'overview' | 'catalog' | 'bookings' | 'reviews' | 'earnings';

interface ProReview {
  id: string;
  client_name: string;
  service_title: string;
  rating: number;
  comment?: string;
  pro_response?: string;
  pro_response_at?: string;
  created_at: string;
}

interface ProService {
  id: string;
  service_type: string;
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  max_participants: number;
  is_active: boolean;
  total_bookings: number;
}

interface ProStats {
  total_sessions: number;
  total_reviews: number;
  average_rating: number;
  total_earnings: number;
  available_earnings: number;
  monthly_earnings: number;
  pending_bookings: number;
}

interface DashboardData {
  profile: any;
  services: ProService[];
  recent_bookings: any[];
  recent_reviews: any[];
  withdrawals: any[];
  stats: ProStats;
}

const SERVICE_TYPE_LABELS: Record<string, { labelKey: string; icon: string; color: string }> = {
  mentoring: { labelKey: 'proDash.serviceType.mentoring', icon: 'people', color: '#7C3AED' },
  course: { labelKey: 'proDash.serviceType.course', icon: 'school', color: '#3B82F6' },
  qa_session: { labelKey: 'proDash.serviceType.qaSession', icon: 'chatbubbles', color: '#10B981' },
  live_stream: { labelKey: 'proDash.serviceType.liveStream', icon: 'videocam', color: '#F59E0B' },
};

const BADGE_CONFIG: Record<string, { labelKey: string; color: string; icon: string }> = {
  basic: { labelKey: 'proDash.badge.basic', color: '#6B7280', icon: 'checkmark-circle' },
  verified: { labelKey: 'proDash.badge.verified', color: '#3B82F6', icon: 'shield-checkmark' },
  premium: { labelKey: 'proDash.badge.premium', color: '#F59E0B', icon: 'diamond' },
};

export default function ProDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [courseStats, setCourseStats] = useState({
    total_courses: 0,
    published_courses: 0,
    total_students: 0,
    total_revenue: 0,
    completion_rate: 0,
    average_rating: 0,
  });
  
  // Modal states
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [editingService, setEditingService] = useState<ProService | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Days of week labels
  const DAYS_OF_WEEK = [
    { id: 0, label: t('proDash.day.mon') },
    { id: 1, label: t('proDash.day.tue') },
    { id: 2, label: t('proDash.day.wed') },
    { id: 3, label: t('proDash.day.thu') },
    { id: 4, label: t('proDash.day.fri') },
    { id: 5, label: t('proDash.day.sat') },
    { id: 6, label: t('proDash.day.sun') },
  ];
  
  // Form states
  const [serviceForm, setServiceForm] = useState({
    service_type: 'mentoring',
    title: '',
    description: '',
    price: '',
    duration_minutes: '60',
    max_participants: '1',
    is_active: true,
    available_days: [0, 1, 2, 3, 4] as number[],
    available_hours: [{ start: '09:00', end: '18:00' }] as { start: string; end: string }[],
    meeting_link: '',  // Zoom/Meet/Teams link for live sessions
  });
  
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_details: '',
  });
  
  // Reviews state
  const [myReviews, setMyReviews] = useState<ProReview[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ProReview | null>(null);
  const [responseText, setResponseText] = useState('');
  
  // Service Resources state
  const [showResourcesModal, setShowResourcesModal] = useState(false);
  const [selectedServiceForResources, setSelectedServiceForResources] = useState<ProService | null>(null);
  const [serviceResources, setServiceResources] = useState<any[]>([]);
  const [serviceQuizzes, setServiceQuizzes] = useState<any[]>([]);
  const [linkedCourse, setLinkedCourse] = useState<any>(null);
  const [resourceForm, setResourceForm] = useState({
    resource_type: 'document',
    title: '',
    description: '',
    file_url: '',
  });
  const [showAddQuizModal, setShowAddQuizModal] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: '',
    passing_score: '60',
    questions: [] as any[],
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    type: 'multiple_choice' as 'multiple_choice' | 'true_false' | 'short_answer',
    options: ['', '', '', ''],
    correct_answer: 0 as any,
    correct_keywords: [] as string[],
    explanation: '',
  });
  const [myCourses, setMyCourses] = useState<any[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await proAPI.getDashboard();
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
      
      // Fetch reviews separately
      const reviewsRes = await proAPI.getMyReviews({ limit: 50 }).catch(() => null);
      if (reviewsRes?.data?.success) {
        setMyReviews(reviewsRes.data.data || []);
        setPendingReviewsCount(reviewsRes.data.pending_responses || 0);
      }
      
      // Fetch course statistics
      const courseStatsRes = await proAPI.getCourseStatistics().catch(() => null);
      if (courseStatsRes?.data?.success) {
        setCourseStats(courseStatsRes.data.data);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        Alert.alert(t('pro.alert.accessDenied'), t('pro.alert.mustBeVerified'));
        router.back();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const handleCreateService = async () => {
    if (!serviceForm.title || !serviceForm.description || !serviceForm.price) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.fillAllFields'));
      return;
    }
    
    if (serviceForm.available_days.length === 0) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.selectDays'));
      return;
    }
    
    setActionLoading(true);
    try {
      await proAPI.createService({
        service_type: serviceForm.service_type,
        title: serviceForm.title,
        description: serviceForm.description,
        price: parseFloat(serviceForm.price),
        duration_minutes: parseInt(serviceForm.duration_minutes) || 60,
        max_participants: parseInt(serviceForm.max_participants) || 1,
        is_active: serviceForm.is_active,
        available_days: serviceForm.available_days,
        available_hours: serviceForm.available_hours,
        meeting_link: serviceForm.meeting_link || undefined,
      });
      setShowServiceModal(false);
      resetServiceForm();
      fetchDashboard();
      Alert.alert(t('pro.alert.success'), t('pro.alert.serviceCreated'));
    } catch (error) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.serviceCreateError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService) return;
    
    setActionLoading(true);
    try {
      await proAPI.updateService(editingService.id, {
        title: serviceForm.title,
        description: serviceForm.description,
        price: parseFloat(serviceForm.price),
        duration_minutes: parseInt(serviceForm.duration_minutes),
        is_active: serviceForm.is_active,
        available_days: serviceForm.available_days,
        available_hours: serviceForm.available_hours,
        meeting_link: serviceForm.meeting_link || undefined,
      });
      setShowServiceModal(false);
      setEditingService(null);
      resetServiceForm();
      fetchDashboard();
      Alert.alert(t('pro.alert.success'), t('pro.alert.serviceUpdated'));
    } catch (error) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.serviceUpdateError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('proDash.confirm.deleteServiceMsg'));
      if (confirmed) {
        try {
          await proAPI.deleteService(serviceId);
          fetchDashboard();
          alert(t('proDash.alert.serviceDeleted'));
        } catch (error) {
          alert(t('catalog.genericError'));
        }
      }
    } else {
      Alert.alert(
        t('proDash.confirm.deleteTitle'),
        t('proDash.confirm.deleteServiceMsg'),
        [
          { text: t('settings.cancel'), style: 'cancel' },
          {
            text: t('settings.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await proAPI.deleteService(serviceId);
                fetchDashboard();
              } catch (error) {
                Alert.alert(t('catalog.error'), t('catalog.genericError'));
              }
            },
          },
        ]
      );
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawForm.amount);
    if (!amount || amount < 50) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.minWithdrawal'));
      return;
    }
    if (!withdrawForm.payment_details) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.providePaymentDetails'));
      return;
    }
    
    setActionLoading(true);
    try {
      await proAPI.requestWithdrawal({
        amount,
        payment_method: withdrawForm.payment_method,
        payment_details: withdrawForm.payment_details,
      });
      setShowWithdrawModal(false);
      setWithdrawForm({ amount: '', payment_method: 'bank_transfer', payment_details: '' });
      fetchDashboard();
      Alert.alert(t('pro.alert.success'), t('pro.alert.withdrawalRequested'));
    } catch (error: any) {
      Alert.alert(t('pro.alert.error'), error.response?.data?.detail || t('pro.alert.withdrawalError'));
    } finally {
      setActionLoading(false);
    }
  };

  const resetServiceForm = () => {
    setServiceForm({
      service_type: 'mentoring',
      title: '',
      description: '',
      price: '',
      duration_minutes: '60',
      max_participants: '1',
      is_active: true,
      available_days: [0, 1, 2, 3, 4],
      available_hours: [{ start: '09:00', end: '18:00' }],
      meeting_link: '',
    });
  };

  const openEditService = (service: any) => {
    setEditingService(service);
    setServiceForm({
      service_type: service.service_type,
      title: service.title,
      description: service.description,
      price: service.price.toString(),
      duration_minutes: service.duration_minutes.toString(),
      max_participants: service.max_participants.toString(),
      is_active: service.is_active,
      available_days: service.available_days || [0, 1, 2, 3, 4],
      available_hours: service.available_hours || [{ start: '09:00', end: '18:00' }],
      meeting_link: service.meeting_link || '',
    });
    setShowServiceModal(true);
  };

  const toggleDay = (dayId: number) => {
    setServiceForm(prev => ({
      ...prev,
      available_days: prev.available_days.includes(dayId)
        ? prev.available_days.filter(d => d !== dayId)
        : [...prev.available_days, dayId].sort()
    }));
  };

  const updateTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
    setServiceForm(prev => ({
      ...prev,
      available_hours: prev.available_hours.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const addTimeSlot = () => {
    setServiceForm(prev => ({
      ...prev,
      available_hours: [...prev.available_hours, { start: '14:00', end: '18:00' }]
    }));
  };

  const removeTimeSlot = (index: number) => {
    if (serviceForm.available_hours.length > 1) {
      setServiceForm(prev => ({
        ...prev,
        available_hours: prev.available_hours.filter((_, i) => i !== index)
      }));
    }
  };

  // Resource management functions
  const openResourcesModal = async (service: ProService) => {
    setSelectedServiceForResources(service);
    setShowResourcesModal(true);
    setResourcesLoading(true);
    
    try {
      const response = await proAPI.getServiceResources(service.id);
      if (response.data.success) {
        setServiceResources(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
      setServiceResources([]);
    } finally {
      setResourcesLoading(false);
    }
  };

  const handleAddResource = async () => {
    if (!resourceForm.title.trim()) {
      Alert.alert(t('pro.alert.error'), t('catalog.titleRequired'));
      return;
    }
    if (resourceForm.resource_type !== 'link' && !resourceForm.file_url.trim()) {
      Alert.alert(t('pro.alert.error'), t('catalog.genericError'));
      return;
    }
    
    if (!selectedServiceForResources) return;
    
    setActionLoading(true);
    try {
      await proAPI.addServiceResource(selectedServiceForResources.id, {
        resource_type: resourceForm.resource_type,
        title: resourceForm.title,
        description: resourceForm.description || undefined,
        file_url: resourceForm.file_url || undefined,
        content: resourceForm.resource_type === 'link' ? resourceForm.file_url : undefined,
      });
      
      // Refresh resources
      const response = await proAPI.getServiceResources(selectedServiceForResources.id);
      if (response.data.success) {
        setServiceResources(response.data.data || []);
      }
      
      // Reset form
      setResourceForm({ resource_type: 'document', title: '', description: '', file_url: '' });
      Alert.alert(t('pro.alert.success'), t('proDash.alert.resourceAdded'));
    } catch (error: any) {
      Alert.alert(t('pro.alert.error'), error.response?.data?.detail || t('proDash.alert.addError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!selectedServiceForResources) return;
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('proDash.confirm.deleteResourceMsg'));
      if (!confirmed) return;
    }
    
    try {
      await proAPI.deleteServiceResource(selectedServiceForResources.id, resourceId);
      setServiceResources(prev => prev.filter(r => r.id !== resourceId));
    } catch (error) {
      Alert.alert(t('pro.alert.error'), t('catalog.genericError'));
    }
  };

  const [resourcesLoading, setResourcesLoading] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t('pro.loadingDashboard')}</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{t('proDash.errorLoad')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchDashboard}>
          <Text style={styles.retryBtnText}>{t('proDash.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile, stats, services } = dashboardData;
  const badgeConfig = BADGE_CONFIG[profile.badge_level] || BADGE_CONFIG.basic;

  const renderOverview = () => (
    <View>
      {/* Profile Card */}
      <LinearGradient colors={['#1A1A2E', '#2A2A4E']} style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={[styles.profileAvatar, { backgroundColor: badgeConfig.color }]}>
            <Text style={styles.profileAvatarText}>
              {profile.display_name?.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.display_name}</Text>
            <View style={[styles.badgeTag, { backgroundColor: `${badgeConfig.color}20` }]}>
              <Ionicons name={badgeConfig.icon as any} size={14} color={badgeConfig.color} />
              <Text style={[styles.badgeTagText, { color: badgeConfig.color }]}>
                {t(badgeConfig.labelKey)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.availabilityBtn, { backgroundColor: profile.is_available ? '#10B98120' : '#EF444420' }]}
            onPress={async () => {
              try {
                await proAPI.updateProfile({ is_available: !profile.is_available });
                fetchDashboard();
              } catch (error) {}
            }}
          >
            <View style={[styles.availabilityDot, { backgroundColor: profile.is_available ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.availabilityText, { color: profile.is_available ? '#10B981' : '#EF4444' }]}>
              {profile.is_available ? t('proDash.available') : t('proDash.unavailable')}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#7C3AED20' }]}>
            <Ionicons name="calendar" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.statValue}>{stats.total_sessions}</Text>
          <Text style={styles.statLabel}>{t('proDash.sessions')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="star" size={20} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{stats.average_rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>{t('proDash.reviewsCount', { count: String(stats.total_reviews) })}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="wallet" size={20} color="#10B981" />
          </View>
          <Text style={styles.statValue}>{stats.total_earnings.toFixed(0)}$</Text>
          <Text style={styles.statLabel}>{t('proDash.totalEarned')}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="trending-up" size={20} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>{stats.monthly_earnings.toFixed(0)}$</Text>
          <Text style={styles.statLabel}>{t('proDash.thisMonth')}</Text>
        </View>
      </View>

      {/* Advanced Stats Link */}
      <TouchableOpacity 
        style={styles.advancedStatsBtn}
        onPress={() => router.push('/pro/analytics')}
      >
        <Ionicons name="analytics" size={20} color="#7C3AED" />
        <Text style={styles.advancedStatsBtnText}>{t('pro.stats.title')}</Text>
        <Ionicons name="chevron-forward" size={18} color="#8B8B9E" />
      </TouchableOpacity>

      {/* Earnings Card */}
      <LinearGradient colors={['#10B981', '#059669']} style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <View>
            <Text style={styles.earningsLabel}>{t('proDash.availableBalance')}</Text>
            <Text style={styles.earningsValue}>{stats.available_earnings.toFixed(2)}$</Text>
          </View>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => setShowWithdrawModal(true)}
            disabled={stats.available_earnings < 50}
          >
            <Ionicons name="arrow-down-circle" size={20} color="#10B981" />
            <Text style={styles.withdrawBtnText}>{t('proDash.withdraw')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.earningsNote}>{t('proDash.minWithdrawal')}</Text>
      </LinearGradient>

      {/* Pending Bookings */}
      {stats.pending_bookings > 0 && (
        <TouchableOpacity style={styles.pendingCard} onPress={() => setActiveTab('bookings')}>
          <View style={styles.pendingIcon}>
            <Ionicons name="time" size={24} color="#F59E0B" />
          </View>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingTitle}>{t('proDash.pendingBookings', { count: String(stats.pending_bookings) })}</Text>
            <Text style={styles.pendingSubtitle}>{t('proDash.clickDetails')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8B8B9E" />
        </TouchableOpacity>
      )}
    </View>
  );

  // New unified Catalog tab
  const renderCatalog = () => (
    <View>
      {/* Catalog Header */}
      <View style={styles.catalogHeader}>
        <Text style={styles.catalogTitle}>{t('proDash.totalFlexibility')}</Text>
        <Text style={styles.catalogSubtitle}>
          {t('proDash.catalogSubtitle')}
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.catalogStats}>
        <View style={styles.catalogStatItem}>
          <Text style={styles.catalogStatValue}>{courseStats.total_courses}</Text>
          <Text style={styles.catalogStatLabel}>{t('proDash.contents')}</Text>
        </View>
        <View style={styles.catalogStatItem}>
          <Text style={styles.catalogStatValue}>{courseStats.total_students}</Text>
          <Text style={styles.catalogStatLabel}>{t('proDash.students')}</Text>
        </View>
        <View style={styles.catalogStatItem}>
          <Text style={styles.catalogStatValue}>${(stats?.total_earnings || 0).toFixed(0)}</Text>
          <Text style={styles.catalogStatLabel}>{t('proDash.revenue')}</Text>
        </View>
      </View>

      {/* Main CTA - Open Full Catalog */}
      <TouchableOpacity
        style={styles.catalogMainBtn}
        onPress={() => router.push('/pro/catalog')}
        data-testid="open-catalog-btn"
      >
        <LinearGradient 
          colors={['#7C3AED', '#5B21B6']} 
          style={styles.catalogMainBtnGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.catalogMainBtnContent}>
            <Ionicons name="layers" size={32} color="#FFF" />
            <View style={styles.catalogMainBtnText}>
              <Text style={styles.catalogMainBtnTitle}>{t('proDash.openCatalog')}</Text>
              <Text style={styles.catalogMainBtnDesc}>
                {t('proDash.manageCatalog')}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#FFF" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Workflow Explanation */}
      <View style={styles.workflowSection}>
        <Text style={styles.workflowTitle}>{t('proDash.howItWorks')}</Text>
        <View style={styles.workflowSteps}>
          <View style={styles.workflowStep}>
            <View style={[styles.workflowStepIcon, { backgroundColor: '#7C3AED20' }]}>
              <Ionicons name="create" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.workflowStepNum}>1</Text>
            <Text style={styles.workflowStepText}>{t('proDash.step1Title')}</Text>
            <Text style={styles.workflowStepDesc}>{t('proDash.step1Desc')}</Text>
          </View>
          <View style={styles.workflowArrow}>
            <Ionicons name="arrow-forward" size={16} color="#5A5A6E" />
          </View>
          <View style={styles.workflowStep}>
            <View style={[styles.workflowStepIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="layers" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.workflowStepNum}>2</Text>
            <Text style={styles.workflowStepText}>{t('proDash.step2Title')}</Text>
            <Text style={styles.workflowStepDesc}>{t('proDash.step2Desc')}</Text>
          </View>
          <View style={styles.workflowArrow}>
            <Ionicons name="arrow-forward" size={16} color="#5A5A6E" />
          </View>
          <View style={styles.workflowStep}>
            <View style={[styles.workflowStepIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="rocket" size={20} color="#10B981" />
            </View>
            <Text style={styles.workflowStepNum}>3</Text>
            <Text style={styles.workflowStepText}>{t('proDash.step3Title')}</Text>
            <Text style={styles.workflowStepDesc}>{t('proDash.step3Desc')}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.quickActionsTitle}>{t('proDash.quickActions')}</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => router.push('/pro/catalog')}
          >
            <Ionicons name="layers" size={24} color="#7C3AED" />
            <Text style={styles.quickActionText}>{t('proDash.openCatalog')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => router.push('/pro/analytics')}
          >
            <Ionicons name="stats-chart" size={24} color="#10B981" />
            <Text style={styles.quickActionText}>{t('proDash.analytics')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderServices = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('proDash.myServices', { count: String(services.length) })}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditingService(null);
            resetServiceForm();
            setShowServiceModal(true);
          }}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>{t('proDash.add')}</Text>
        </TouchableOpacity>
      </View>

      {services.length > 0 ? (
        services.map((service) => {
          const typeConfig = SERVICE_TYPE_LABELS[service.service_type] || SERVICE_TYPE_LABELS.mentoring;
          return (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <View style={[styles.serviceTypeIcon, { backgroundColor: `${typeConfig.color}20` }]}>
                  <Ionicons name={typeConfig.icon as any} size={20} color={typeConfig.color} />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                  <Text style={styles.serviceType}>{t(typeConfig.labelKey)}</Text>
                </View>
                <View style={[styles.servicePriceBadge, { opacity: service.is_active ? 1 : 0.5 }]}>
                  <Text style={styles.servicePriceText}>{service.price}$</Text>
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
                <View style={styles.serviceMeta}>
                  <Ionicons name="people-outline" size={14} color="#8B8B9E" />
                  <Text style={styles.serviceMetaText}>{t('proDash.bookingsCountLabel', { count: String(service.total_bookings) })}</Text>
                </View>
                <View style={styles.serviceActions}>
                  <TouchableOpacity 
                    style={[styles.serviceActionBtn, { backgroundColor: '#3B82F620' }]} 
                    onPress={() => openResourcesModal(service)}
                    data-testid={`service-resources-btn-${service.id}`}
                  >
                    <Ionicons name="attach-outline" size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.serviceActionBtn} 
                    onPress={() => openEditService(service)}
                    data-testid={`service-edit-btn-${service.id}`}
                  >
                    <Ionicons name="create-outline" size={18} color="#7C3AED" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.serviceActionBtn} 
                    onPress={() => handleDeleteService(service.id)}
                    data-testid={`service-delete-btn-${service.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Meeting Link Badge */}
              {service.meeting_link && (
                <View style={styles.meetingLinkBadge}>
                  <Ionicons name="videocam" size={12} color="#10B981" />
                  <Text style={styles.meetingLinkBadgeText}>{t('proDash.liveConfigured')}</Text>
                </View>
              )}
              
              {!service.is_active && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>{t('proDash.inactive')}</Text>
                </View>
              )}
            </View>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="briefcase-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t('proDash.noServices')}</Text>
          <Text style={styles.emptySubtext}>{t('proDash.createFirstService')}</Text>
        </View>
      )}
    </View>
  );

  const renderBookings = () => (
    <View>
      <Text style={styles.sectionTitle}>{t('proDash.bookingsTitle')}</Text>
      
      {dashboardData.recent_bookings.length > 0 ? (
        dashboardData.recent_bookings.map((booking: any) => (
          <View key={booking.id} style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingTitle}>{booking.service_title || t('proDash.session')}</Text>
              <View style={[styles.bookingStatusBadge, { 
                backgroundColor: booking.status === 'confirmed' ? '#10B98120' : 
                                booking.status === 'pending' ? '#F59E0B20' : '#EF444420' 
              }]}>
                <Text style={[styles.bookingStatusText, {
                  color: booking.status === 'confirmed' ? '#10B981' : 
                         booking.status === 'pending' ? '#F59E0B' : '#EF4444'
                }]}>
                  {booking.status === 'confirmed' ? t('proDash.statusConfirmed') : 
                   booking.status === 'pending' ? t('proDash.statusPending') : t('proDash.statusCancelled')}
                </Text>
              </View>
            </View>
            <Text style={styles.bookingClient}>{t('proDash.clientLabel', { name: booking.client_name })}</Text>
            <Text style={styles.bookingDate}>
              {new Date(booking.scheduled_at).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
            {booking.status === 'pending' && (
              <View style={styles.bookingActions}>
                <TouchableOpacity 
                  style={[styles.bookingActionBtn, { backgroundColor: '#10B98120' }]}
                  onPress={async () => {
                    await proAPI.updateBookingStatus(booking.id, 'confirmed');
                    fetchDashboard();
                  }}
                >
                  <Ionicons name="checkmark" size={18} color="#10B981" />
                  <Text style={[styles.bookingActionText, { color: '#10B981' }]}>{t('proDash.confirmAction')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.bookingActionBtn, { backgroundColor: '#EF444420' }]}
                  onPress={async () => {
                    await proAPI.updateBookingStatus(booking.id, 'cancelled');
                    fetchDashboard();
                  }}
                >
                  <Ionicons name="close" size={18} color="#EF4444" />
                  <Text style={[styles.bookingActionText, { color: '#EF4444' }]}>{t('proDash.rejectAction')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t('proDash.noBookings')}</Text>
          <Text style={styles.emptySubtext}>{t('proDash.bookingsEmptyDesc')}</Text>
        </View>
      )}
    </View>
  );

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color="#F59E0B"
        />
      );
    }
    return stars;
  };

  const handleRespondToReview = async () => {
    if (!selectedReview || !responseText.trim()) {
      Alert.alert(t('pro.alert.error'), t('pro.alert.writeResponse'));
      return;
    }
    
    setActionLoading(true);
    try {
      if (selectedReview.pro_response) {
        await proAPI.updateReviewResponse(selectedReview.id, responseText);
      } else {
        await proAPI.respondToReview(selectedReview.id, responseText);
      }
      setShowResponseModal(false);
      setSelectedReview(null);
      setResponseText('');
      fetchDashboard();
      Alert.alert(t('pro.alert.success'), t('pro.alert.responsePublished'));
    } catch (error: any) {
      Alert.alert(t('pro.alert.error'), error.response?.data?.detail || t('pro.alert.responseError'));
    } finally {
      setActionLoading(false);
    }
  };

  const renderReviews = () => (
    <View>
      <View style={styles.reviewsHeader}>
        <Text style={styles.sectionTitle}>{t('proDash.clientReviews', { count: String(myReviews.length) })}</Text>
        {pendingReviewsCount > 0 && (
          <View style={styles.pendingReviewsBadge}>
            <Ionicons name="chatbubble" size={14} color="#F59E0B" />
            <Text style={styles.pendingReviewsText}>{t('proDash.noResponseCount', { count: String(pendingReviewsCount) })}</Text>
          </View>
        )}
      </View>
      
      {stats && (
        <View style={styles.reviewsStatsCard}>
          <View style={styles.reviewsStatMain}>
            <Text style={styles.reviewsStatRating}>{stats.average_rating.toFixed(1)}</Text>
            <View style={styles.reviewsStatStars}>{renderStars(Math.round(stats.average_rating))}</View>
            <Text style={styles.reviewsStatCount}>{t('proDash.reviewsTotalCount', { count: String(stats.total_reviews) })}</Text>
          </View>
        </View>
      )}

      {myReviews.length > 0 ? (
        myReviews.map((review) => (
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
              <View style={styles.reviewRating}>{renderStars(review.rating)}</View>
            </View>
            
            {review.comment && (
              <Text style={styles.reviewComment}>{review.comment}</Text>
            )}
            
            {review.pro_response ? (
              <View style={styles.proResponseBox}>
                <View style={styles.proResponseHeader}>
                  <Ionicons name="chatbubble" size={14} color="#7C3AED" />
                  <Text style={styles.proResponseLabel}>{t('proDash.yourResponse')}</Text>
                </View>
                <Text style={styles.proResponseText}>{review.pro_response}</Text>
                <TouchableOpacity 
                  style={styles.editResponseBtn}
                  onPress={() => {
                    setSelectedReview(review);
                    setResponseText(review.pro_response || '');
                    setShowResponseModal(true);
                  }}
                >
                  <Ionicons name="create-outline" size={14} color="#8B8B9E" />
                  <Text style={styles.editResponseBtnText}>{t('proDash.editAction')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.respondBtn}
                onPress={() => {
                  setSelectedReview(review);
                  setResponseText('');
                  setShowResponseModal(true);
                }}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#7C3AED" />
                <Text style={styles.respondBtnText}>{t('proDash.respondAction')}</Text>
              </TouchableOpacity>
            )}
            
            <Text style={styles.reviewDate}>
              {new Date(review.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t('proDash.noReviews')}</Text>
          <Text style={styles.emptySubtext}>{t('proDash.reviewsEmptyDesc')}</Text>
        </View>
      )}
    </View>
  );

  const renderEarnings = () => (
    <View>
      <Text style={styles.sectionTitle}>{t('proDash.withdrawalHistory')}</Text>
      
      {dashboardData.withdrawals.length > 0 ? (
        dashboardData.withdrawals.map((withdrawal: any) => (
          <View key={withdrawal.id} style={styles.withdrawalCard}>
            <View style={styles.withdrawalInfo}>
              <Text style={styles.withdrawalAmount}>-{withdrawal.amount.toFixed(2)}$</Text>
              <Text style={styles.withdrawalDate}>
                {new Date(withdrawal.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <View style={[styles.withdrawalStatusBadge, {
              backgroundColor: withdrawal.status === 'completed' ? '#10B98120' : 
                             withdrawal.status === 'pending' ? '#F59E0B20' : '#EF444420'
            }]}>
              <Text style={[styles.withdrawalStatusText, {
                color: withdrawal.status === 'completed' ? '#10B981' : 
                       withdrawal.status === 'pending' ? '#F59E0B' : '#EF4444'
              }]}>
                {withdrawal.status === 'completed' ? t('proDash.statusCompleted') : 
                 withdrawal.status === 'pending' ? t('proDash.statusInProgress') : t('proDash.statusRejected')}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t('proDash.noWithdrawals')}</Text>
          <Text style={styles.emptySubtext}>{t('proDash.withdrawalsEmptyDesc')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
        <TouchableOpacity onPress={() => router.push('/pro')} style={styles.viewProfileBtn}>
          <Ionicons name="eye-outline" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabsContainer}>
          {[
            { key: 'overview', label: t('proDash.tab.overview'), icon: 'grid' },
            { key: 'catalog', label: t('proDash.tab.catalog'), icon: 'layers' },
            { key: 'bookings', label: t('proDash.tab.bookings'), icon: 'calendar' },
            { key: 'reviews', label: `${t('proDash.tab.reviews')}${pendingReviewsCount > 0 ? ` (${pendingReviewsCount})` : ''}`, icon: 'star' },
            { key: 'earnings', label: t('proDash.tab.earnings'), icon: 'cash' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as TabType)}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.key ? '#7C3AED' : '#8B8B9E'} 
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {tab.key === 'reviews' && pendingReviewsCount > 0 && (
                <View style={styles.reviewBadge}>
                  <Text style={styles.reviewBadgeText}>{pendingReviewsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7C3AED" />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'catalog' && renderCatalog()}
        {activeTab === 'bookings' && renderBookings()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'earnings' && renderEarnings()}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Service Modal */}
      <Modal visible={showServiceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingService ? t('proDash.modal.editService') : t('proDash.modal.newService')}
              </Text>
              <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>{t('proDash.modal.serviceType')}</Text>
              <View style={styles.serviceTypeGrid}>
                {Object.entries(SERVICE_TYPE_LABELS).map(([key, config]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.serviceTypeOption,
                      serviceForm.service_type === key && { borderColor: config.color, backgroundColor: `${config.color}10` }
                    ]}
                    onPress={() => setServiceForm({ ...serviceForm, service_type: key })}
                  >
                    <Ionicons name={config.icon as any} size={20} color={config.color} />
                    <Text style={[styles.serviceTypeOptionText, { color: serviceForm.service_type === key ? config.color : '#8B8B9E' }]}>
                      {t(config.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>{t('proDash.modal.titleLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('proDash.modal.titlePlaceholder')}
                placeholderTextColor="#5A5A6E"
                value={serviceForm.title}
                onChangeText={(text) => setServiceForm({ ...serviceForm, title: text })}
              />

              <Text style={styles.inputLabel}>{t('proDash.modal.descriptionLabel')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('proDash.modal.descPlaceholder')}
                placeholderTextColor="#5A5A6E"
                multiline
                numberOfLines={4}
                value={serviceForm.description}
                onChangeText={(text) => setServiceForm({ ...serviceForm, description: text })}
              />

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>{t('proDash.modal.priceLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="75"
                    placeholderTextColor="#5A5A6E"
                    keyboardType="numeric"
                    value={serviceForm.price}
                    onChangeText={(text) => setServiceForm({ ...serviceForm, price: text })}
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>{t('proDash.modal.durationLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="60"
                    placeholderTextColor="#5A5A6E"
                    keyboardType="numeric"
                    value={serviceForm.duration_minutes}
                    onChangeText={(text) => setServiceForm({ ...serviceForm, duration_minutes: text })}
                  />
                </View>
              </View>

              {/* Availability Section */}
              <View style={styles.availabilitySection}>
                <Text style={styles.inputLabel}>{t('proDash.modal.availableDays')}</Text>
                <View style={styles.daysContainer}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day.id}
                      style={[
                        styles.dayButton,
                        serviceForm.available_days.includes(day.id) && styles.dayButtonActive
                      ]}
                      onPress={() => toggleDay(day.id)}
                    >
                      <Text style={[
                        styles.dayButtonText,
                        serviceForm.available_days.includes(day.id) && styles.dayButtonTextActive
                      ]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { marginTop: 16 }]}>{t('proDash.modal.timeSlots')}</Text>
                {serviceForm.available_hours.map((slot, index) => (
                  <View key={index} style={styles.timeSlotRow}>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeInputLabel}>{t('proDash.modal.from')}</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={slot.start}
                        onChangeText={(text) => updateTimeSlot(index, 'start', text)}
                        placeholder="09:00"
                        placeholderTextColor="#5A5A6E"
                      />
                    </View>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeInputLabel}>{t('proDash.modal.to')}</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={slot.end}
                        onChangeText={(text) => updateTimeSlot(index, 'end', text)}
                        placeholder="18:00"
                        placeholderTextColor="#5A5A6E"
                      />
                    </View>
                    {serviceForm.available_hours.length > 1 && (
                      <TouchableOpacity 
                        style={styles.removeSlotBtn}
                        onPress={() => removeTimeSlot(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addSlotBtn} onPress={addTimeSlot}>
                  <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
                  <Text style={styles.addSlotBtnText}>{t('proDash.modal.addTimeSlot')}</Text>
                </TouchableOpacity>
              </View>

              {/* Meeting Link for Live Sessions */}
              <View style={styles.meetingLinkSection}>
                <Text style={styles.inputLabel}>
                  <Ionicons name="videocam" size={14} color="#10B981" /> {t('proDash.modal.meetingLink')}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://zoom.us/j/... ou https://meet.google.com/..."
                  placeholderTextColor="#5A5A6E"
                  value={serviceForm.meeting_link}
                  onChangeText={(text) => setServiceForm({ ...serviceForm, meeting_link: text })}
                />
                <Text style={styles.meetingLinkHint}>
                  {t('proDash.modal.meetingLinkHint')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.switchRow}
                onPress={() => setServiceForm({ ...serviceForm, is_active: !serviceForm.is_active })}
              >
                <Text style={styles.switchLabel}>{t('proDash.modal.serviceActive')}</Text>
                <View style={[styles.switch, serviceForm.is_active && styles.switchActive]}>
                  <View style={[styles.switchThumb, serviceForm.is_active && styles.switchThumbActive]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={editingService ? handleUpdateService : handleCreateService}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingService ? t('proDash.modal.update') : t('proDash.modal.createService')}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('proDash.modal.withdrawRequest')}</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.withdrawBalanceCard}>
                <Text style={styles.withdrawBalanceLabel}>{t('proDash.availableBalance')}</Text>
                <Text style={styles.withdrawBalanceValue}>{stats.available_earnings.toFixed(2)}$</Text>
              </View>

              <Text style={styles.inputLabel}>{t('proDash.modal.withdrawAmount')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('proDash.modal.minAmount')}
                placeholderTextColor="#5A5A6E"
                keyboardType="numeric"
                value={withdrawForm.amount}
                onChangeText={(text) => setWithdrawForm({ ...withdrawForm, amount: text })}
              />

              <Text style={styles.inputLabel}>{t('proDash.modal.paymentMethod')}</Text>
              <View style={styles.paymentMethods}>
                {[
                  { key: 'bank_transfer', label: t('proDash.modal.bankTransfer'), icon: 'business' },
                  { key: 'paypal', label: t('proDash.modal.paypal'), icon: 'logo-paypal' },
                  { key: 'crypto', label: t('proDash.modal.crypto'), icon: 'wallet' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentMethodOption,
                      withdrawForm.payment_method === method.key && styles.paymentMethodSelected
                    ]}
                    onPress={() => setWithdrawForm({ ...withdrawForm, payment_method: method.key })}
                  >
                    <Ionicons 
                      name={method.icon as any} 
                      size={20} 
                      color={withdrawForm.payment_method === method.key ? '#7C3AED' : '#8B8B9E'} 
                    />
                    <Text style={[
                      styles.paymentMethodText,
                      withdrawForm.payment_method === method.key && { color: '#7C3AED' }
                    ]}>
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>{t('proDash.modal.paymentDetails')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={
                  withdrawForm.payment_method === 'bank_transfer' 
                    ? t('proDash.modal.ibanPlaceholder') 
                    : withdrawForm.payment_method === 'paypal'
                    ? t('proDash.modal.paypalPlaceholder')
                    : t('proDash.modal.cryptoPlaceholder')
                }
                placeholderTextColor="#5A5A6E"
                multiline
                numberOfLines={3}
                value={withdrawForm.payment_details}
                onChangeText={(text) => setWithdrawForm({ ...withdrawForm, payment_details: text })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#10B981' }]}
                onPress={handleWithdraw}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{t('proDash.modal.requestWithdrawal')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Review Response Modal */}
      <Modal visible={showResponseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedReview?.pro_response ? t('proDash.modal.editResponse') : t('proDash.modal.respondReview')}
              </Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedReview && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.originalReviewCard}>
                  <View style={styles.originalReviewHeader}>
                    <Text style={styles.originalReviewClient}>{selectedReview.client_name}</Text>
                    <View style={{ flexDirection: 'row' }}>{renderStars(selectedReview.rating)}</View>
                  </View>
                  <Text style={styles.originalReviewService}>{selectedReview.service_title}</Text>
                  {selectedReview.comment && (
                    <Text style={styles.originalReviewComment}>{selectedReview.comment}</Text>
                  )}
                </View>

                <Text style={styles.inputLabel}>{t('proDash.modal.yourResponse')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('proDash.modal.responsePlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  multiline
                  numberOfLines={5}
                  value={responseText}
                  onChangeText={setResponseText}
                />

                <Text style={styles.responseHint}>
                  {t('proDash.modal.responseHint')}
                </Text>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleRespondToReview}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#FFF" />
                      <Text style={styles.submitBtnText}>{t('proDash.modal.publishResponse')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Service Resources Modal */}
      <Modal visible={showResourcesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('proDash.modal.resourcesTitle', { title: selectedServiceForResources?.title || '' })}
              </Text>
              <TouchableOpacity onPress={() => setShowResourcesModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Existing Resources */}
              {resourcesLoading ? (
                <ActivityIndicator size="small" color="#7C3AED" style={{ marginVertical: 20 }} />
              ) : serviceResources.length > 0 ? (
                <View style={styles.resourcesList}>
                  <Text style={styles.resourcesListTitle}>
                    {t('proDash.modal.attachedResources', { count: String(serviceResources.length) })}
                  </Text>
                  {serviceResources.map((resource) => (
                    <View key={resource.id} style={styles.resourceItem}>
                      <View style={styles.resourceIcon}>
                        <Ionicons 
                          name={
                            resource.resource_type === 'document' ? 'document-text' :
                            resource.resource_type === 'video' ? 'videocam' :
                            resource.resource_type === 'link' ? 'link' : 'attach'
                          } 
                          size={20} 
                          color={
                            resource.resource_type === 'document' ? '#3B82F6' :
                            resource.resource_type === 'video' ? '#EF4444' :
                            resource.resource_type === 'link' ? '#10B981' : '#7C3AED'
                          } 
                        />
                      </View>
                      <View style={styles.resourceInfo}>
                        <Text style={styles.resourceTitle}>{resource.title}</Text>
                        <Text style={styles.resourceType}>
                          {resource.resource_type === 'document' ? t('proDash.resource.documentPdf') :
                           resource.resource_type === 'video' ? t('proDash.resource.video') :
                           resource.resource_type === 'link' ? t('proDash.resource.externalLink') : t('proDash.resource.file')}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.resourceDeleteBtn}
                        onPress={() => handleDeleteResource(resource.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noResourcesBox}>
                  <Ionicons name="folder-open-outline" size={40} color="#5A5A6E" />
                  <Text style={styles.noResourcesText}>{t('proDash.resource.noResources')}</Text>
                  <Text style={styles.noResourcesSubtext}>
                    {t('proDash.resource.noResourcesDesc')}
                  </Text>
                </View>
              )}

              {/* Add Resource Form */}
              <View style={styles.addResourceSection}>
                <Text style={styles.addResourceTitle}>{t('proDash.resource.addResource')}</Text>
                
                <Text style={styles.inputLabel}>{t('proDash.resource.typeLabel')}</Text>
                <View style={styles.resourceTypeGrid}>
                  {[
                    { id: 'document', label: t('proDash.resource.documentLabel'), icon: 'document-text', color: '#3B82F6' },
                    { id: 'video', label: t('proDash.resource.videoLabel'), icon: 'videocam', color: '#EF4444' },
                    { id: 'link', label: t('proDash.resource.linkLabel'), icon: 'link', color: '#10B981' },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.resourceTypeOption,
                        resourceForm.resource_type === type.id && { 
                          borderColor: type.color, 
                          backgroundColor: `${type.color}15` 
                        }
                      ]}
                      onPress={() => setResourceForm({ ...resourceForm, resource_type: type.id })}
                    >
                      <Ionicons 
                        name={type.icon as any} 
                        size={20} 
                        color={resourceForm.resource_type === type.id ? type.color : '#8B8B9E'} 
                      />
                      <Text style={[
                        styles.resourceTypeLabel,
                        resourceForm.resource_type === type.id && { color: type.color }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>{t('proDash.modal.titleLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('proDash.resource.titlePlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  value={resourceForm.title}
                  onChangeText={(text) => setResourceForm({ ...resourceForm, title: text })}
                />

                <Text style={styles.inputLabel}>
                  {resourceForm.resource_type === 'link' ? t('proDash.resource.linkUrl') : t('proDash.resource.fileUrl')}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    resourceForm.resource_type === 'document' ? 'https://example.com/guide.pdf' :
                    resourceForm.resource_type === 'video' ? 'https://youtube.com/watch?v=...' :
                    'https://example.com/page'
                  }
                  placeholderTextColor="#5A5A6E"
                  value={resourceForm.file_url}
                  onChangeText={(text) => setResourceForm({ ...resourceForm, file_url: text })}
                />

                <Text style={styles.inputLabel}>{t('proDash.resource.descriptionLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('proDash.resource.descPlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  multiline
                  numberOfLines={2}
                  value={resourceForm.description}
                  onChangeText={(text) => setResourceForm({ ...resourceForm, description: text })}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: '#3B82F6' }]}
                  onPress={handleAddResource}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={18} color="#FFF" />
                      <Text style={styles.submitBtnText}>{t('proDash.resource.addBtn')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Info Box */}
              <View style={styles.resourceInfoBox}>
                <Ionicons name="information-circle" size={20} color="#F59E0B" />
                <Text style={styles.resourceInfoText}>
                  {t('proDash.resource.infoText')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A12' },
  loadingContainer: { flex: 1, backgroundColor: '#0A0A12', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8B8B9E', marginTop: 12, fontSize: 14 },
  errorContainer: { flex: 1, backgroundColor: '#0A0A12', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#EF4444', fontSize: 16, marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#FFF', fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, backgroundColor: '#0A0A12' },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFF', marginLeft: 8 },
  viewProfileBtn: { padding: 8, backgroundColor: '#7C3AED20', borderRadius: 10 },

  tabsScroll: { maxHeight: 50, backgroundColor: '#0A0A12' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1A1A2E' },
  tabActive: { backgroundColor: '#7C3AED20' },
  tabLabel: { fontSize: 13, color: '#8B8B9E', fontWeight: '500' },
  tabLabelActive: { color: '#7C3AED' },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  profileCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  profileAvatar: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  badgeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  badgeTagText: { fontSize: 12, fontWeight: '600' },
  availabilityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  availabilityDot: { width: 8, height: 8, borderRadius: 4 },
  availabilityText: { fontSize: 12, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, alignItems: 'center' },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#8B8B9E', marginTop: 4 },

  earningsCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
  earningsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earningsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  earningsValue: { fontSize: 32, fontWeight: '800', color: '#FFF', marginTop: 4 },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  withdrawBtnText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  earningsNote: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 12 },

  pendingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B10', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F59E0B30' },
  pendingIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center' },
  pendingInfo: { flex: 1, marginLeft: 12 },
  pendingTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  pendingSubtitle: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },

  serviceCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12, position: 'relative' },
  serviceHeader: { flexDirection: 'row', alignItems: 'center' },
  serviceTypeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceInfo: { flex: 1, marginLeft: 12 },
  serviceTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  serviceType: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  servicePriceBadge: { backgroundColor: '#10B98120', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  servicePriceText: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  serviceDescription: { fontSize: 13, color: '#C4C4C4', marginTop: 12, lineHeight: 18 },
  serviceFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A4E' },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 16 },
  serviceMetaText: { fontSize: 12, color: '#8B8B9E' },
  serviceActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  serviceActionBtn: { padding: 8, backgroundColor: '#0A0A12', borderRadius: 8 },
  inactiveBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#EF444420', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  inactiveBadgeText: { fontSize: 10, fontWeight: '600', color: '#EF4444' },
  meetingLinkBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: '#10B98115', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  meetingLinkBadgeText: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#10B981' 
  },

  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#FFF', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#8B8B9E', textAlign: 'center', marginTop: 8 },

  bookingCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  bookingStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bookingStatusText: { fontSize: 12, fontWeight: '600' },
  bookingClient: { fontSize: 13, color: '#8B8B9E', marginTop: 8 },
  bookingDate: { fontSize: 13, color: '#7C3AED', marginTop: 4 },
  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  bookingActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  bookingActionText: { fontSize: 13, fontWeight: '600' },

  withdrawalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12 },
  withdrawalInfo: {},
  withdrawalAmount: { fontSize: 18, fontWeight: '700', color: '#EF4444' },
  withdrawalDate: { fontSize: 12, color: '#8B8B9E', marginTop: 4 },
  withdrawalStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  withdrawalStatusText: { fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalBody: { padding: 20 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#8B8B9E', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#2A2A4E' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },

  serviceTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceTypeOption: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A4E', backgroundColor: '#0A0A12' },
  serviceTypeOptionText: { fontSize: 12, fontWeight: '500' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  switchLabel: { fontSize: 14, color: '#FFF' },
  switch: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#2A2A4E', padding: 2 },
  switchActive: { backgroundColor: '#7C3AED' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  switchThumbActive: { marginLeft: 22 },

  submitBtn: { backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  withdrawBalanceCard: { backgroundColor: '#10B98120', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 10 },
  withdrawBalanceLabel: { fontSize: 14, color: '#10B981' },
  withdrawBalanceValue: { fontSize: 32, fontWeight: '800', color: '#10B981', marginTop: 4 },

  paymentMethods: { gap: 10 },
  paymentMethodOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A4E', backgroundColor: '#0A0A12' },
  paymentMethodSelected: { borderColor: '#7C3AED', backgroundColor: '#7C3AED10' },
  paymentMethodText: { fontSize: 14, color: '#8B8B9E', fontWeight: '500' },

  // Reviews styles
  reviewBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#F59E0B', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  reviewBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pendingReviewsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F59E0B20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  pendingReviewsText: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  reviewsStatsCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' },
  reviewsStatMain: { alignItems: 'center' },
  reviewsStatRating: { fontSize: 48, fontWeight: '800', color: '#F59E0B' },
  reviewsStatStars: { flexDirection: 'row', marginTop: 8 },
  reviewsStatCount: { fontSize: 14, color: '#8B8B9E', marginTop: 4 },
  reviewCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  reviewInfo: { flex: 1, marginLeft: 12 },
  reviewName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  reviewService: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  reviewRating: { flexDirection: 'row' },
  reviewComment: { fontSize: 14, color: '#C4C4C4', marginTop: 12, lineHeight: 20 },
  reviewDate: { fontSize: 12, color: '#5A5A6E', marginTop: 12 },
  proResponseBox: { backgroundColor: '#7C3AED10', borderRadius: 12, padding: 14, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  proResponseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  proResponseLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  proResponseText: { fontSize: 14, color: '#C4C4C4', lineHeight: 18 },
  editResponseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-end' },
  editResponseBtnText: { fontSize: 12, color: '#8B8B9E' },
  respondBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#7C3AED20', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
  respondBtnText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  originalReviewCard: { backgroundColor: '#0A0A12', borderRadius: 12, padding: 16, marginBottom: 20 },
  originalReviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  originalReviewClient: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  originalReviewService: { fontSize: 13, color: '#8B8B9E', marginTop: 4 },
  originalReviewComment: { fontSize: 14, color: '#C4C4C4', marginTop: 12, fontStyle: 'italic' },
  responseHint: { fontSize: 12, color: '#5A5A6E', marginTop: 12, textAlign: 'center', lineHeight: 18 },
  
  // Availability styles
  availabilitySection: { marginTop: 16, marginBottom: 16 },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  dayButton: { 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 10, 
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  dayButtonActive: { 
    backgroundColor: '#7C3AED20', 
    borderColor: '#7C3AED',
  },
  dayButtonText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#8B8B9E' 
  },
  dayButtonTextActive: { 
    color: '#7C3AED' 
  },
  timeSlotRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginTop: 10 
  },
  timeInputContainer: { 
    flex: 1 
  },
  timeInputLabel: { 
    fontSize: 12, 
    color: '#8B8B9E', 
    marginBottom: 4 
  },
  timeInput: { 
    backgroundColor: '#1A1A2E', 
    borderRadius: 10, 
    padding: 12, 
    color: '#FFF', 
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    textAlign: 'center',
  },
  removeSlotBtn: { 
    padding: 4,
    marginTop: 16,
  },
  addSlotBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 12,
    padding: 10,
  },
  addSlotBtnText: { 
    fontSize: 13, 
    color: '#7C3AED', 
    fontWeight: '500' 
  },
  advancedStatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  advancedStatsBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#A78BFA',
  },
  
  // Courses Tab Styles
  courseStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  courseStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  courseStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  courseStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  courseStatSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  courseActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  courseActionBtn: {
    flex: 1,
  },
  courseActionGradient: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  courseActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
  },
  courseActionDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  vipInfoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  vipInfoContent: {
    flex: 1,
  },
  vipInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  vipInfoText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  
  // Resource management styles
  resourcesList: {
    marginBottom: 24,
  },
  resourcesListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8B9E',
    marginBottom: 12,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A12',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  resourceType: {
    fontSize: 12,
    color: '#8B8B9E',
    marginTop: 2,
  },
  resourceDeleteBtn: {
    padding: 8,
  },
  noResourcesBox: {
    backgroundColor: '#0A0A12',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  noResourcesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B8B9E',
    marginTop: 12,
  },
  noResourcesSubtext: {
    fontSize: 12,
    color: '#5A5A6E',
    marginTop: 4,
    textAlign: 'center',
  },
  addResourceSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4E',
  },
  addResourceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  resourceTypeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  resourceTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A4E',
    backgroundColor: '#0A0A12',
  },
  resourceTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B8B9E',
  },
  resourceInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B10',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
  },
  resourceInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
    lineHeight: 18,
  },
  
  // Meeting link styles
  meetingLinkSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4E',
  },
  meetingLinkHint: {
    fontSize: 12,
    color: '#5A5A6E',
    marginTop: 6,
    lineHeight: 16,
  },
  
  // Total Flexibility Section
  flexibilitySection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
  },
  flexibilitySectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  flexibilitySectionDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  flexibilityActions: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  flexibilityActionBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  flexibilityGradient: {
    padding: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  flexibilityActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  flexibilityActionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  
  // Catalog Tab Styles
  catalogHeader: {
    marginBottom: 20,
  },
  catalogTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  catalogSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  catalogStats: {
    flexDirection: 'row' as const,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  catalogStatItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  catalogStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  catalogStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  catalogMainBtn: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  catalogMainBtnGradient: {
    padding: 20,
  },
  catalogMainBtnContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  catalogMainBtnText: {
    flex: 1,
    marginLeft: 16,
  },
  catalogMainBtnTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  catalogMainBtnDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  workflowSection: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  workflowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  workflowSteps: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  workflowStep: {
    flex: 1,
    alignItems: 'center' as const,
  },
  workflowStepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  workflowStepNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 4,
  },
  workflowStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center' as const,
  },
  workflowStepDesc: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 2,
  },
  workflowArrow: {
    paddingHorizontal: 4,
  },
  quickActionsSection: {
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFF',
    textAlign: 'center' as const,
  },
});
