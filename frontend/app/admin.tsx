import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
  RefreshControl,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import api, { adminAPI, proAPI, adminReportAPI, revenueAPI, influencerAPI } from '../utils/api';

const { width } = Dimensions.get('window');

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_banned: boolean;
  created_at: string;
  community_score?: number;
}

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  author_name: string;
  author_email?: string;
  votes: number;
  comments_count: number;
  created_at: string;
}

interface AdminLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  timestamp: string;
}

type TabType = 'dashboard' | 'users' | 'posts' | 'pro' | 'revenue' | 'reports' | 'stats' | 'logs' | 'feedback' | 'affiliates' | 'analytics';

interface AdminStats {
  overview: {
    total_users: number;
    active_users: number;
    banned_users: number;
    admin_count: number;
    total_posts: number;
    total_comments: number;
    total_votes: number;
  };
  trends: {
    daily_registrations: Array<{date: string; day: string; count: number}>;
    daily_posts: Array<{date: string; day: string; count: number}>;
    daily_activity: Array<{date: string; day: string; posts: number; comments: number; total: number}>;
  };
  distributions: {
    roles: Array<{role: string; count: number; label: string}>;
    categories: Array<{category: string; count: number}>;
  };
}

const ROLE_CONFIG = {
  super_admin: { color: '#FF4757', icon: 'shield', label: 'Super Admin', bgColor: 'rgba(255, 71, 87, 0.15)' },
  admin: { color: '#7C3AED', icon: 'shield-half', label: 'Admin', bgColor: 'rgba(124, 58, 237, 0.15)' },
  user: { color: '#8B8B9E', icon: 'person', label: 'User', bgColor: 'rgba(139, 139, 158, 0.15)' },
};

const CATEGORY_COLORS: { [key: string]: string } = {
  question: '#3B82F6',
  discussion: '#10B981',
  tutorial: '#F59E0B',
  news: '#EF4444',
  other: '#8B8B9E',
};

export default function AdminScreen() {
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, isLoading: authLoading } = useAuthStore();
  const { t } = useTranslation();
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsInterval = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [proApplications, setProApplications] = useState<any[]>([]);
  const [pendingProCount, setPendingProCount] = useState(0);
  const [reports, setReports] = useState<any[]>([]);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAdminNotes, setReportAdminNotes] = useState('');
  
  // Revenue data (super admin only)
  const [revenueData, setRevenueData] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState(0);

  // Feedback data
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const [feedbackFilter, setFeedbackFilter] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [adminReply, setAdminReply] = useState('');
  
  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string | null>(null);
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [postCategoryFilter, setPostCategoryFilter] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  
  // Modals
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedProApp, setSelectedProApp] = useState<any | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showProAppModal, setShowProAppModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Affiliation
  const [affiliateInfluencers, setAffiliateInfluencers] = useState<any[]>([]);
  const [affiliateConversions, setAffiliateConversions] = useState<any[]>([]);
  const [showCreateInfluencer, setShowCreateInfluencer] = useState(false);
  const [newInfluencer, setNewInfluencer] = useState({ name: '', email: '', commission_rate: '20' });
  const [editingRate, setEditingRate] = useState<{ id: string; rate: string } | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Stats computed
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => !u.is_banned).length,
    bannedUsers: users.filter(u => u.is_banned).length,
    admins: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
    totalPosts: posts.length,
    totalComments: posts.reduce((acc, p) => acc + (p.comments_count || 0), 0),
    totalVotes: posts.reduce((acc, p) => acc + (p.votes || 0), 0),
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAdmin) {
      setShouldRedirect(true);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
      fetchData();
    }
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (shouldRedirect) {
      router.replace('/(tabs)');
    }
  }, [shouldRedirect]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, postsRes, logsRes, statsRes, proRes, reportsRes] = await Promise.all([
        adminAPI.getUsers({ limit: 100 }),
        adminAPI.getPosts({ limit: 100 }),
        adminAPI.getLogs({ limit: 50 }).catch(() => ({ data: { success: true, data: [] } })),
        adminAPI.getStats().catch(() => ({ data: { success: true, data: null } })),
        proAPI.getApplications({ limit: 50 }).catch(() => ({ data: { success: true, data: [], stats: { pending: 0 } } })),
        adminReportAPI.getReports({ limit: 50 }).catch(() => ({ data: { success: true, data: [], stats: { pending: 0 } } })),
      ]);
      
      if (usersRes.data.success) setUsers(usersRes.data.data);
      if (postsRes.data.success) setPosts(postsRes.data.data);
      if (logsRes.data.success) setLogs(logsRes.data.data || []);
      if (statsRes.data.success && statsRes.data.data) setAdminStats(statsRes.data.data);
      if (proRes.data.success) {
        setProApplications(proRes.data.data || []);
        setPendingProCount(proRes.data.stats?.pending || 0);
      }
      if (reportsRes.data.success) {
        setReports(reportsRes.data.data || []);
        setPendingReportsCount(reportsRes.data.stats?.pending || 0);
      }
      
      // Fetch revenue data only for super admins
      if (isSuperAdmin) {
        try {
          const [revenueRes, withdrawalsRes, feedbackRes] = await Promise.all([
            revenueAPI.getRevenue(),
            revenueAPI.getWithdrawals(),
            api.get('/admin/feedback'),
          ]);
          if (revenueRes.data.success) setRevenueData(revenueRes.data.data);
          if (withdrawalsRes.data.success) {
            setWithdrawals(withdrawalsRes.data.data || []);
            setPendingWithdrawalsCount(withdrawalsRes.data.stats?.pending || 0);
          }
          if (feedbackRes.data.success) {
            setFeedbacks(feedbackRes.data.data || []);
            setNewFeedbackCount(feedbackRes.data.new_count || 0);
          }
          // Fetch affiliate data
          const [influencersRes, conversionsRes] = await Promise.all([
            influencerAPI.listInfluencers().catch(() => ({ data: { influencers: [] } })),
            influencerAPI.listConversions().catch(() => ({ data: { conversions: [] } })),
          ]);
          setAffiliateInfluencers(influencersRes.data.influencers || []);
          setAffiliateConversions(conversionsRes.data.conversions || []);
        } catch (e) {
          console.log('Revenue/feedback data fetch skipped');
        }
      }
    } catch (error) {
      console.error('Admin fetch error:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Server-side user search with debounce
  const searchUsersOnServer = async (query: string) => {
    if (query.length < 2) {
      // If search is cleared, reload all users
      try {
        const usersRes = await adminAPI.getUsers({ 
          limit: 100,
          role_filter: userRoleFilter || undefined,
          banned_only: userStatusFilter === 'banned'
        });
        if (usersRes.data.success) setUsers(usersRes.data.data);
      } catch (error) {
        console.error('Failed to reload users:', error);
      }
      return;
    }
    
    setSearchLoading(true);
    try {
      const usersRes = await adminAPI.getUsers({ 
        search: query,
        limit: 100,
        role_filter: userRoleFilter || undefined,
        banned_only: userStatusFilter === 'banned'
      });
      if (usersRes.data.success) setUsers(usersRes.data.data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUserSearchChange = (text: string) => {
    setUserSearch(text);
    
    // Clear previous debounce
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    // Set new debounce for server search
    const timeout = setTimeout(() => {
      searchUsersOnServer(text);
    }, 300);
    
    setSearchDebounce(timeout);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const handleBanUser = (targetUser: User) => {
    const isBanning = !targetUser.is_banned;
    setConfirmAction({
      type: isBanning ? 'ban' : 'unban',
      title: isBanning ? t('admin.banUser') : t('admin.unbanUser'),
      message: isBanning 
        ? t('admin.banConfirm', { name: targetUser.name })
        : t('admin.unbanConfirm', { name: targetUser.name }),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          if (isBanning) {
            await adminAPI.banUser(targetUser.id, 'Violation des règles');
          } else {
            await adminAPI.unbanUser(targetUser.id);
          }
          await fetchData();
          setShowUserModal(false);
          setShowConfirmModal(false);
          showSuccess(isBanning ? `${targetUser.name} a été banni` : `${targetUser.name} a été débanni`);
        } catch (error: any) {
          setShowConfirmModal(false);
          showSuccess('Erreur: ' + (error.response?.data?.detail || t('marketplace.error')));
        } finally {
          setActionLoading(false);
        }
      },
    });
    setShowConfirmModal(true);
  };

  const handlePromoteUser = (targetUser: User, newRole: string) => {
    if (targetUser.role === newRole) return;
    
    const roleLabel = ROLE_CONFIG[newRole as keyof typeof ROLE_CONFIG]?.label || newRole;
    setConfirmAction({
      type: 'promote',
      title: t('admin.changeRole'),
      message: t('admin.promoteConfirm', { name: targetUser.name, role: roleLabel }),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await adminAPI.promoteUser(targetUser.id, newRole);
          await fetchData();
          setShowUserModal(false);
          setShowConfirmModal(false);
          showSuccess(`${targetUser.name} est maintenant ${roleLabel}`);
        } catch (error: any) {
          setShowConfirmModal(false);
          showSuccess('Erreur: ' + (error.response?.data?.detail || t('marketplace.error')));
        } finally {
          setActionLoading(false);
        }
      },
    });
    setShowConfirmModal(true);
  };

  const handleDeletePost = (post: Post) => {
    setConfirmAction({
      type: 'delete_post',
      title: t('admin.deletePost'),
      message: t('admin.deleteConfirm', { title: post.title }),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await adminAPI.deletePost(post.id);
          setPosts(posts.filter(p => p.id !== post.id));
          setShowPostModal(false);
          setShowConfirmModal(false);
          showSuccess(t('admin.postDeleted'));
        } catch (error: any) {
          setShowConfirmModal(false);
          showSuccess('Erreur: ' + (error.response?.data?.detail || t('admin.deleteError')));
        } finally {
          setActionLoading(false);
        }
      },
    });
    setShowConfirmModal(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) return `il y a ${diffDays}j`;
      if (diffHours > 0) return `il y a ${diffHours}h`;
      return 'À l\'instant';
    } catch {
      return dateString;
    }
  };

  // Filtered data - now users are already filtered from server, only apply local status filter
  const filteredUsers = userStatusFilter === 'all' 
    ? users 
    : users.filter(u => 
        (userStatusFilter === 'banned' && u.is_banned) ||
        (userStatusFilter === 'active' && !u.is_banned)
      );

  const filteredPosts = posts.filter(p => {
    const matchesSearch = !postSearch || 
      p.title.toLowerCase().includes(postSearch.toLowerCase()) ||
      p.author_name?.toLowerCase().includes(postSearch.toLowerCase());
    const matchesCategory = !postCategoryFilter || p.category === postCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from posts
  const postCategories = [...new Set(posts.map(p => p.category).filter(Boolean))];

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0A0A1A', '#0F0520']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t("admin.checkingPermissions")}</Text>
      </View>
    );
  }

  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0A0A1A', '#0F0520']} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingIconContainer}>
          <Ionicons name="shield-checkmark" size={48} color="#7C3AED" />
        </View>
        <Text style={styles.loadingText}>{t('admin.loading')}</Text>
      </View>
    );
  }


  // ==================== ANALYTICS LIVE DASHBOARD ====================

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const res = await adminAPI.getAnalytics();
      setAnalyticsData(res.data);
    } catch (e: any) { console.error('Analytics error:', e); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      analyticsInterval.current = setInterval(fetchAnalytics, 30000); // auto-refresh 30s
    }
    return () => { if (analyticsInterval.current) clearInterval(analyticsInterval.current); };
  }, [activeTab]);

  const StatBox = ({ label, value, icon, color = '#7C3AED', sub }: { label: string; value: string | number; icon: string; color?: string; sub?: string }) => (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={14} color={color} />
        </View>
        <Text style={{ fontSize: 10, color: '#8B8B9E', fontWeight: '600', flex: 1 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 }}>{value}</Text>
      {sub && <Text style={{ fontSize: 10, color: '#5A5A6E', marginTop: 2 }}>{sub}</Text>}
    </View>
  );

  const ProgressBar = ({ value, max, color = '#7C3AED', label }: { value: number; max: number; color?: string; label?: string }) => (
    <View style={{ marginVertical: 6 }}>
      {label && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 10, color: '#8B8B9E' }}>{label}</Text>
        <Text style={{ fontSize: 10, color: color, fontWeight: '700' }}>{value}/{max}</Text>
      </View>}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${Math.min(100, (value / max) * 100)}%` }} />
      </View>
    </View>
  );

  const renderAnalytics = () => {
    const d = analyticsData;
    if (!d) return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ color: '#8B8B9E', marginTop: 12, fontSize: 13 }}>Chargement Analytics...</Text>
      </View>
    );

    const live = d.live || {};
    const api = d.api || {};
    const db = d.database || {};
    const cg = d.coingecko || {};
    const atlas = d.atlas || {};
    const eng = d.engagement || {};
    const sys = d.system || {};

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF' }}>Analytics Live</Text>
            <Text style={{ fontSize: 11, color: '#5A5A6E' }}>Auto-refresh: 30s | {new Date(d.timestamp).toLocaleTimeString()}</Text>
          </View>
          <TouchableOpacity onPress={fetchAnalytics} style={{ padding: 8, backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 10 }}>
            <Ionicons name="refresh" size={18} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* LIVE USERS */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#00D9A5', marginBottom: 8 }}>UTILISATEURS EN DIRECT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBox label="En ligne maintenant" value={live.active_now || 0} icon="radio" color="#00D9A5" sub="Derniere minute" />
          <StatBox label="Actifs (5 min)" value={live.active_5min || 0} icon="people" color="#10B981" />
          <StatBox label="Actifs (15 min)" value={live.active_15min || 0} icon="people-circle" color="#3B82F6" />
          <StatBox label="Actifs (1h)" value={live.active_1h || 0} icon="time" color="#6366F1" />
          <StatBox label="Sessions totales" value={live.total_sessions || 0} icon="globe" color="#8B5CF6" sub="Depuis le dernier redemarrage" />
          <StatBox label="Utilisateurs uniques" value={eng.unique_users_today || 0} icon="person" color="#EC4899" sub="Aujourd'hui" />
        </View>

        {/* API PERFORMANCE */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#3B82F6', marginBottom: 8 }}>PERFORMANCE API</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBox label="Requetes/min" value={api.calls_per_minute || 0} icon="flash" color="#F59E0B" />
          <StatBox label="Requetes (5 min)" value={api.calls_5min || 0} icon="trending-up" color="#3B82F6" />
          <StatBox label="Requetes (1h)" value={api.calls_1h || 0} icon="bar-chart" color="#6366F1" />
          <StatBox label="Requetes aujourd'hui" value={api.calls_today || 0} icon="stats-chart" color="#8B5CF6" />
          <StatBox label="Taux d'erreur (1h)" value={`${api.error_rate_1h || 0}%`} icon="warning" color={(api.error_rate_1h || 0) > 5 ? '#EF4444' : '#10B981'} />
        </View>
        {/* Status Distribution */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {Object.entries(api.status_distribution || {}).map(([code, count]) => (
            <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: code === '2xx' ? '#10B98118' : code === '4xx' ? '#F59E0B18' : '#EF444418' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: code === '2xx' ? '#10B981' : code === '4xx' ? '#F59E0B' : '#EF4444' }}>{code}: {count as number}</Text>
            </View>
          ))}
        </View>
        {/* Top Endpoints */}
        {api.top_endpoints?.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF', marginBottom: 8 }}>Top Endpoints (1h)</Text>
            {api.top_endpoints.slice(0, 8).map((ep: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: i < 7 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
                <Text style={{ fontSize: 10, color: '#8B8B9E', flex: 1 }} numberOfLines={1}>{ep.endpoint}</Text>
                <Text style={{ fontSize: 10, color: '#7C3AED', fontWeight: '800', minWidth: 30, textAlign: 'right' }}>{ep.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* DATABASE */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#EC4899', marginBottom: 8 }}>BASE DE DONNEES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBox label="Utilisateurs" value={db.total_users || 0} icon="people" color="#7C3AED" />
          <StatBox label="VIP" value={db.vip_users || 0} icon="diamond" color="#FFD600" sub={`${db.vip_conversion_rate || 0}% conversion`} />
          <StatBox label="Bannis" value={db.banned_users || 0} icon="ban" color="#EF4444" />
          <StatBox label="Pre-inscriptions" value={db.pre_registrations || 0} icon="mail" color="#3B82F6" />
          <StatBox label="Posts" value={db.total_posts || 0} icon="chatbubbles" color="#10B981" />
          <StatBox label="Commentaires" value={db.total_comments || 0} icon="chatbox" color="#6366F1" />
          <StatBox label="Notifications" value={db.total_notifications || 0} icon="notifications" color="#F59E0B" />
          <StatBox label="Messages" value={db.total_messages || 0} icon="mail-open" color="#EC4899" />
        </View>
        {/* New Users */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBox label="Nouveaux (Aujourd'hui)" value={db.new_users_today || 0} icon="person-add" color="#00D9A5" />
          <StatBox label="Nouveaux (7j)" value={db.new_users_week || 0} icon="trending-up" color="#3B82F6" />
          <StatBox label="Nouveaux (30j)" value={db.new_users_month || 0} icon="calendar" color="#8B5CF6" />
          <StatBox label="Posts (Aujourd'hui)" value={db.posts_today || 0} icon="create" color="#10B981" />
          <StatBox label="Posts (7j)" value={db.posts_week || 0} icon="document-text" color="#6366F1" />
        </View>
        {/* Top Contributors */}
        {db.top_contributors?.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF', marginBottom: 8 }}>Top Contributeurs</Text>
            {db.top_contributors.map((c: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, color: '#8B8B9E' }}>{i + 1}. {c.name}</Text>
                <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '800' }}>{c.posts} posts</Text>
              </View>
            ))}
          </View>
        )}

        {/* ATLAS AI */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#8B5CF6', marginBottom: 8 }}>ATLAS AI</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBox label="Appels aujourd'hui" value={atlas.calls_today || 0} icon="planet" color="#8B5CF6" />
          <StatBox label="Appels (7j)" value={atlas.calls_week || 0} icon="chatbubble" color="#6366F1" />
        </View>
        {Object.keys(atlas.language_distribution || {}).length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {Object.entries(atlas.language_distribution).map(([lang, count]) => (
              <View key={lang} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.12)' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#8B5CF6' }}>{lang.toUpperCase()}: {count as number}</Text>
              </View>
            ))}
          </View>
        )}

        {/* COINGECKO API BUDGET */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#F59E0B', marginBottom: 8 }}>BUDGET API COINGECKO</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBox label="Appels aujourd'hui" value={cg.calls_today || 0} icon="flash" color="#F59E0B" />
          <StatBox label="Appels/heure" value={cg.calls_per_hour || 0} icon="time" color="#FF8F00" />
          <StatBox label="Ce mois" value={cg.calls_this_month || 0} icon="calendar" color="#EF4444" sub={`/ ${(cg.monthly_limit || 100000).toLocaleString()}`} />
        </View>
        <ProgressBar value={cg.calls_this_month || 0} max={cg.monthly_limit || 100000} color={(cg.usage_percent || 0) > 80 ? '#EF4444' : '#F59E0B'} label={`Usage mensuel: ${cg.usage_percent || 0}%`} />
        <View style={{ height: 16 }} />

        {/* SYSTEM */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#6366F1', marginBottom: 8 }}>SYSTEME</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBox label="Uptime" value={`${sys.uptime_hours || 0}h`} icon="server" color="#6366F1" />
          <StatBox label="Python" value={sys.python_version || '?'} icon="code-slash" color="#3B82F6" />
          <StatBox label="Events suivis" value={sys.total_tracked_events || 0} icon="analytics" color="#10B981" />
        </View>

        {/* Hourly Activity Chart */}
        {eng.hourly_chart?.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF', marginBottom: 8 }}>Activite par heure (24h)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 1 }}>
              {eng.hourly_chart.map((h: any, i: number) => {
                const maxCalls = Math.max(...eng.hourly_chart.map((x: any) => x.calls), 1);
                const barH = Math.max(2, (h.calls / maxCalls) * 56);
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: '80%', height: barH, backgroundColor: h.calls > 0 ? '#7C3AED' : '#1A1A35', borderRadius: 2 }} />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              {[0, 6, 12, 18, 23].map(i => (
                <Text key={i} style={{ flex: 1, fontSize: 7, color: '#5A5A6E', textAlign: i === 0 ? 'left' : i === 23 ? 'right' : 'center' }}>{eng.hourly_chart[i]?.hour}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Request Rate Chart */}
        {api.rate_chart?.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF', marginBottom: 8 }}>Requetes/min (10 dernieres min)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 50, gap: 2 }}>
              {api.rate_chart.map((r: any, i: number) => {
                const maxReqs = Math.max(...api.rate_chart.map((x: any) => x.requests), 1);
                const barH = Math.max(2, (r.requests / maxReqs) * 46);
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: '#5A5A6E', marginBottom: 2 }}>{r.requests}</Text>
                    <View style={{ width: '80%', height: barH, backgroundColor: '#3B82F6', borderRadius: 2 }} />
                    <Text style={{ fontSize: 7, color: '#5A5A6E', marginTop: 2 }}>{r.minute}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Registration Trend */}
        {db.registration_trend?.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF', marginBottom: 8 }}>Inscriptions (30 jours)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 50, gap: 1 }}>
              {db.registration_trend.map((r: any, i: number) => {
                const maxCount = Math.max(...db.registration_trend.map((x: any) => x.count), 1);
                const barH = Math.max(1, (r.count / maxCount) * 46);
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: '80%', height: barH, backgroundColor: r.count > 0 ? '#10B981' : '#1A1A35', borderRadius: 1 }} />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 7, color: '#5A5A6E' }}>{db.registration_trend[0]?.date}</Text>
              <Text style={{ fontSize: 7, color: '#5A5A6E' }}>{db.registration_trend[db.registration_trend.length - 1]?.date}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };


  const renderDashboard = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <LinearGradient
          colors={['#7C3AED', '#5B21B6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeGradient}
        >
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeIcon}>
              <Ionicons name={isSuperAdmin ? 'shield' : 'shield-half'} size={32} color="#FFFFFF" />
            </View>
            <View style={styles.welcomeText}>
              <Text style={styles.welcomeTitle}>{t('admin.welcome')}, {user?.name}</Text>
              <Text style={styles.welcomeSubtitle}>
                {isSuperAdmin ? t('admin.superAdmin') : t('admin.administrator')}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Quick Stats Grid */}
      <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
      <View style={styles.statsGrid}>
        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => setActiveTab('users')}
          data-testid="stat-users"
        >
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Ionicons name="people" size={24} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Utilisateurs</Text>
          <View style={styles.statTrend}>
            <Ionicons name="arrow-up" size={12} color="#00D9A5" />
            <Text style={styles.statTrendText}>{stats.activeUsers} actifs</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => { setUserStatusFilter('banned'); setActiveTab('users'); }}
          data-testid="stat-banned"
        >
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="ban" size={24} color="#EF4444" />
          </View>
          <Text style={styles.statValue}>{stats.bannedUsers}</Text>
          <Text style={styles.statLabel}>Bannis</Text>
          <View style={styles.statTrend}>
            <Ionicons name="shield" size={12} color="#8B8B9E" />
            <Text style={styles.statTrendText}>{stats.admins} admins</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => setActiveTab('posts')}
          data-testid="stat-posts"
        >
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
            <Ionicons name="chatbubbles" size={24} color="#7C3AED" />
          </View>
          <Text style={styles.statValue}>{stats.totalPosts}</Text>
          <Text style={styles.statLabel}>{t("admin.publications")}</Text>
          <View style={styles.statTrend}>
            <Ionicons name="chatbubble" size={12} color="#7C3AED" />
            <Text style={styles.statTrendText}>{stats.totalComments} commentaires</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => setActiveTab('posts')}
          data-testid="stat-engagement"
        >
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(0, 217, 165, 0.15)' }]}>
            <Ionicons name="heart" size={24} color="#00D9A5" />
          </View>
          <Text style={styles.statValue}>{stats.totalVotes}</Text>
          <Text style={styles.statLabel}>Votes</Text>
          <View style={styles.statTrend}>
            <Ionicons name="trending-up" size={12} color="#00D9A5" />
            <Text style={styles.statTrendText}>engagement</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>{t("admin.recentActivity")}</Text>
      <View style={styles.activityCard}>
        {posts.slice(0, 5).map((post, index) => (
          <TouchableOpacity 
            key={post.id}
            style={[styles.activityItem, index === 4 && { borderBottomWidth: 0 }]}
            onPress={() => { setSelectedPost(post); setShowPostModal(true); }}
          >
            <View style={[styles.activityDot, { backgroundColor: CATEGORY_COLORS[post.category] || '#8B8B9E' }]} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>{post.title}</Text>
              <Text style={styles.activityMeta}>par {post.author_name} · {formatTimeAgo(post.created_at)}</Text>
            </View>
            <View style={styles.activityStats}>
              <Ionicons name="arrow-up" size={12} color="#00D9A5" />
              <Text style={styles.activityStatText}>{post.votes || 0}</Text>
            </View>
          </TouchableOpacity>
        ))}
        
        {posts.length === 0 && (
          <View style={styles.emptyActivity}>
            <Ionicons name="newspaper-outline" size={32} color="#5A5A6E" />
            <Text style={styles.emptyActivityText}>{t("admin.noRecentPosts")}</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Actions rapides</Text>
      <View style={styles.quickActionsRow}>
        <TouchableOpacity 
          style={styles.quickActionBtn}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons name="person-add" size={20} color="#3B82F6" />
          <Text style={styles.quickActionText}>{t("admin.manageUsers")}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionBtn}
          onPress={() => setActiveTab('posts')}
        >
          <Ionicons name="create" size={20} color="#7C3AED" />
          <Text style={styles.quickActionText}>{t("admin.moderatePosts")}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionBtn}
          onPress={() => setActiveTab('logs')}
        >
          <Ionicons name="time" size={20} color="#F59E0B" />
          <Text style={styles.quickActionText}>{t("admin.viewLogs")}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderUsers = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* Search & Filters */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#8B8B9E" />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.searchByNameEmail")}
          placeholderTextColor="#5A5A6E"
          value={userSearch}
          onChangeText={handleUserSearchChange}
          data-testid="user-search-input"
        />
        {searchLoading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : userSearch ? (
          <TouchableOpacity onPress={() => { setUserSearch(''); searchUsersOnServer(''); }}>
            <Ionicons name="close-circle" size={20} color="#8B8B9E" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterContainer}>
          {/* Status Filters */}
          {(['all', 'active', 'banned'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterPill, userStatusFilter === status && styles.filterPillActive]}
              onPress={() => setUserStatusFilter(status)}
            >
              <Text style={[styles.filterPillText, userStatusFilter === status && styles.filterPillTextActive]}>
                {status === 'all' ? t('admin.all') : status === 'active' ? t('admin.activeUsers') : t('admin.bannedUsers')}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Role Filters */}
          <View style={styles.filterDivider} />
          {Object.entries(ROLE_CONFIG).map(([role, config]) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterPill, 
                userRoleFilter === role && { backgroundColor: config.bgColor, borderColor: config.color }
              ]}
              onPress={() => setUserRoleFilter(userRoleFilter === role ? null : role)}
            >
              <Ionicons name={config.icon as any} size={12} color={userRoleFilter === role ? config.color : '#8B8B9E'} />
              <Text style={[styles.filterPillText, userRoleFilter === role && { color: config.color }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.resultCount}>{filteredUsers.length} utilisateur(s)</Text>

      {/* User List */}
      {filteredUsers.map((u) => {
        const roleConfig = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.user;
        return (
          <TouchableOpacity
            key={u.id}
            style={[styles.userCard, u.is_banned && styles.userCardBanned]}
            onPress={() => { setSelectedUser(u); setShowUserModal(true); }}
            activeOpacity={0.7}
            data-testid={`user-card-${u.id}`}
          >
            <View style={[styles.userAvatar, { backgroundColor: roleConfig.color }]}>
              <Text style={styles.userAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
              {u.is_banned && (
                <View style={styles.bannedIndicator}>
                  <Ionicons name="ban" size={10} color="#FFF" />
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{u.name}</Text>
                {u.role !== 'user' && (
                  <View style={[styles.roleBadgeMini, { backgroundColor: roleConfig.bgColor }]}>
                    <Ionicons name={roleConfig.icon as any} size={10} color={roleConfig.color} />
                  </View>
                )}
              </View>
              <Text style={styles.userEmail}>{u.email}</Text>
            </View>
            <View style={styles.userActions}>
              <TouchableOpacity 
                style={[styles.actionBtnSmall, u.is_banned ? styles.actionBtnSuccess : styles.actionBtnDanger]}
                onPress={() => handleBanUser(u)}
              >
                <Ionicons name={u.is_banned ? 'checkmark' : 'ban'} size={16} color="#FFF" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
            </View>
          </TouchableOpacity>
        );
      })}

      {filteredUsers.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t("admin.noUsers")}</Text>
        </View>
      )}
    </Animated.View>
  );

  const renderPosts = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#8B8B9E" />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.searchPublication")}
          placeholderTextColor="#5A5A6E"
          value={postSearch}
          onChangeText={setPostSearch}
        />
        {postSearch ? (
          <TouchableOpacity onPress={() => setPostSearch('')}>
            <Ionicons name="close-circle" size={20} color="#8B8B9E" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterPill, !postCategoryFilter && styles.filterPillActive]}
            onPress={() => setPostCategoryFilter(null)}
          >
            <Text style={[styles.filterPillText, !postCategoryFilter && styles.filterPillTextActive]}>Toutes</Text>
          </TouchableOpacity>
          {postCategories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterPill, 
                postCategoryFilter === category && { 
                  backgroundColor: `${CATEGORY_COLORS[category] || '#8B8B9E'}20`,
                  borderColor: CATEGORY_COLORS[category] || '#8B8B9E'
                }
              ]}
              onPress={() => setPostCategoryFilter(postCategoryFilter === category ? null : category)}
            >
              <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category] || '#8B8B9E' }]} />
              <Text style={[
                styles.filterPillText, 
                postCategoryFilter === category && { color: CATEGORY_COLORS[category] || '#8B8B9E' }
              ]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.resultCount}>{filteredPosts.length} publication(s)</Text>

      {/* Post List */}
      {filteredPosts.map((post) => (
        <TouchableOpacity 
          key={post.id} 
          style={styles.postCard}
          onPress={() => { setSelectedPost(post); setShowPostModal(true); }}
          activeOpacity={0.7}
        >
          <View style={styles.postHeader}>
            <View style={[styles.postCategoryBadge, { backgroundColor: `${CATEGORY_COLORS[post.category] || '#8B8B9E'}15` }]}>
              <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[post.category] || '#8B8B9E' }]} />
              <Text style={[styles.postCategoryText, { color: CATEGORY_COLORS[post.category] || '#8B8B9E' }]}>
                {post.category || 'autre'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeletePost(post)}
              data-testid={`delete-post-${post.id}`}
            >
              <Ionicons name="trash" size={18} color="#FF4757" />
            </TouchableOpacity>
          </View>
          <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
          <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
          <View style={styles.postFooter}>
            <View style={styles.postMeta}>
              <View style={styles.postAuthorAvatar}>
                <Text style={styles.postAuthorAvatarText}>
                  {(post.author_name || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.postAuthor}>{post.author_name || 'Anonyme'}</Text>
                <Text style={styles.postDate}>{formatTimeAgo(post.created_at)}</Text>
              </View>
            </View>
            <View style={styles.postStats}>
              <View style={styles.postStat}>
                <Ionicons name="arrow-up" size={14} color="#00D9A5" />
                <Text style={styles.postStatText}>{post.votes || 0}</Text>
              </View>
              <View style={styles.postStat}>
                <Ionicons name="chatbubble" size={14} color="#7C3AED" />
                <Text style={styles.postStatText}>{post.comments_count || 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {filteredPosts.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t("admin.noPosts")}</Text>
        </View>
      )}
    </Animated.View>
  );


  // Report reason labels
  const REPORT_REASON_LABELS: Record<string, string> = {
    spam: t('admin.reportReason.spam'),
    harassment: t('admin.reportReason.harassment'),
    inappropriate_content: t('admin.reportReason.inappropriateContent'),
    fraud: t('admin.reportReason.fraud'),
    impersonation: t('admin.reportReason.impersonation'),
    other: t('admin.reportReason.other'),
  };

  const REPORT_STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
    pending: { color: '#F59E0B', label: 'En attente', icon: 'time' },
    reviewed: { color: '#3B82F6', label: 'Examiné', icon: 'eye' },
    resolved: { color: '#10B981', label: 'Résolu', icon: 'checkmark-circle' },
    dismissed: { color: '#6B7280', label: 'Rejeté', icon: 'close-circle' },
  };

  const handleReviewReport = async (reportId: string, newStatus: string, banUser: boolean = false) => {
    setActionLoading(true);
    try {
      const res = await adminReportAPI.reviewReport(reportId, newStatus, reportAdminNotes || undefined, banUser);
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        setShowSuccessModal(true);
        setShowReportModal(false);
        setSelectedReport(null);
        setReportAdminNotes('');
        fetchData();
      }
    } catch (error: any) {
      console.error('Review report error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const renderReports = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Signalements ({reports.length})</Text>
        <View style={styles.filterChips}>
          <TouchableOpacity
            style={[styles.filterChip, !userStatusFilter && styles.filterChipActive]}
            onPress={() => setUserStatusFilter('all')}
          >
            <Text style={[styles.filterChipText, !userStatusFilter && styles.filterChipTextActive]}>
              Tous
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="flag-outline" size={48} color="#8B8B9E" />
          <Text style={styles.emptyStateText}>{t("admin.noReports")}</Text>
        </View>
      ) : (
        reports.map((report) => {
          const statusConfig = REPORT_STATUS_CONFIG[report.status] || REPORT_STATUS_CONFIG.pending;
          return (
            <TouchableOpacity
              key={report.id}
              style={styles.userCard}
              onPress={() => {
                setSelectedReport(report);
                setReportAdminNotes(report.admin_notes || '');
                setShowReportModal(true);
              }}
              data-testid={`report-${report.id}`}
            >
              <View style={[styles.userAvatar, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Ionicons name="flag" size={20} color="#EF4444" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{report.reported_user_name}</Text>
                <Text style={styles.userEmail}>
                  Signalé par: {report.reporter_name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={[styles.roleTag, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                    <Text style={[styles.roleText, { color: '#EF4444' }]}>
                      {REPORT_REASON_LABELS[report.reason] || report.reason}
                    </Text>
                  </View>
                  <View style={[styles.roleTag, { backgroundColor: `${statusConfig.color}20` }]}>
                    <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                    <Text style={[styles.roleText, { color: statusConfig.color, marginLeft: 4 }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8B8B9E" />
            </TouchableOpacity>
          );
        })
      )}
    </Animated.View>
  );


  const renderRevenue = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("admin.platformRevenue")}</Text>
      </View>

      {/* Revenue Summary Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#0D1F12' }]}>
          <Ionicons name="cash" size={24} color="#10B981" />
          <Text style={styles.statValue}>${revenueData?.summary?.total_revenue?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.statLabel}>{t("admin.totalRevenue")}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#1A1528' }]}>
          <Ionicons name="wallet" size={24} color="#7C3AED" />
          <Text style={styles.statValue}>${revenueData?.summary?.total_commission?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.statLabel}>Commission ({revenueData?.summary?.commission_rate || 25}%)</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#1A1A2E' }]}>
          <Ionicons name="receipt" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{revenueData?.summary?.total_transactions || 0}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#1F1A15' }]}>
          <Ionicons name="time" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>${revenueData?.summary?.pending_withdrawals?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.statLabel}>{t("admin.pendingWithdrawals")}</Text>
        </View>
      </View>

      {/* Top Professionals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("admin.topMentors")}</Text>
      </View>
      
      {(revenueData?.top_professionals || []).length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color="#8B8B9E" />
          <Text style={styles.emptyStateText}>Pas encore de transactions</Text>
        </View>
      ) : (
        (revenueData?.top_professionals || []).map((pro: any, index: number) => (
          <View key={pro.user_id} style={styles.userCard}>
            <View style={[styles.userAvatar, { backgroundColor: index < 3 ? 'rgba(245,158,11,0.15)' : 'rgba(124,58,237,0.15)' }]}>
              {index < 3 ? (
                <Text style={{ fontSize: 16 }}>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</Text>
              ) : (
                <Text style={{ color: '#7C3AED', fontWeight: 'bold' }}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{pro.display_name}</Text>
              <Text style={styles.userEmail}>{pro.total_sessions} sessions</Text>
            </View>
            <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 16 }}>${pro.total_earnings?.toFixed(2)}</Text>
          </View>
        ))
      )}

      {/* Pending Withdrawals */}
      {withdrawals.filter((w: any) => w.status === 'pending').length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("admin.pendingWithdrawalRequests")}</Text>
          </View>
          
          {withdrawals.filter((w: any) => w.status === 'pending').map((withdrawal: any) => (
            <View key={withdrawal.id} style={styles.userCard}>
              <View style={[styles.userAvatar, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                <Ionicons name="cash-outline" size={20} color="#F59E0B" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{withdrawal.pro_name || 'Pro'}</Text>
                <Text style={styles.userEmail}>Demande: ${withdrawal.amount?.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 8 }]}
                  onPress={async () => {
                    try {
                      await revenueAPI.processWithdrawal(withdrawal.id, 'approve');
                      setSuccessMessage(t('admin.revenue.withdrawalApproved'));
                      setShowSuccessModal(true);
                      fetchData();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 8 }]}
                  onPress={async () => {
                    try {
                      await revenueAPI.processWithdrawal(withdrawal.id, 'reject');
                      setSuccessMessage(t('admin.revenue.withdrawalRejected'));
                      setShowSuccessModal(true);
                      fetchData();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Recent Transactions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("admin.recentTransactions")}</Text>
      </View>
      
      {(revenueData?.recent_transactions || []).length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#8B8B9E" />
          <Text style={styles.emptyStateText}>{t("admin.noTransactions")}</Text>
        </View>
      ) : (
        (revenueData?.recent_transactions || []).slice(0, 10).map((tx: any) => (
          <View key={tx.id} style={styles.userCard}>
            <View style={[styles.userAvatar, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="receipt" size={20} color="#10B981" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{tx.service_title || 'Service'}</Text>
              <Text style={styles.userEmail}>Pro: {tx.pro_name || 'N/A'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#10B981', fontWeight: '700' }}>${tx.total_amount?.toFixed(2)}</Text>
              <Text style={{ color: '#7C3AED', fontSize: 11 }}>Com: ${tx.platform_commission?.toFixed(2)}</Text>
            </View>
          </View>
        ))
      )}
    </Animated.View>
  );



  const renderStats = () => {
    const maxRegistration = adminStats?.trends?.daily_registrations 
      ? Math.max(...adminStats.trends.daily_registrations.map(d => d.count), 1) 
      : 1;
    const maxActivity = adminStats?.trends?.daily_activity 
      ? Math.max(...adminStats.trends.daily_activity.map(d => d.total), 1) 
      : 1;

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Charts Header */}
        <View style={styles.statsHeader}>
          <Ionicons name="analytics" size={22} color="#7C3AED" />
          <Text style={styles.statsHeaderTitle}>Analyses & Tendances</Text>
        </View>

        {adminStats ? (
          <>
            {/* Registrations Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <Text style={styles.chartTitle}>{t("admin.registrations7Days")}</Text>
                <View style={styles.chartBadge}>
                  <Ionicons name="person-add" size={14} color="#3B82F6" />
                </View>
              </View>
              <View style={styles.barChart}>
                {adminStats.trends.daily_registrations.map((day, index) => (
                  <View key={index} style={styles.barColumn}>
                    <Text style={styles.barValue}>{day.count}</Text>
                    <View style={styles.barContainer}>
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: `${Math.max((day.count / maxRegistration) * 100, 5)}%`,
                            backgroundColor: '#3B82F6'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.barLabel}>{day.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Activity Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <Text style={styles.chartTitle}>{t("admin.communityActivity")}</Text>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} />
                    <Text style={styles.legendText}>Posts</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#00D9A5' }]} />
                    <Text style={styles.legendText}>Commentaires</Text>
                  </View>
                </View>
              </View>
              <View style={styles.barChart}>
                {adminStats.trends.daily_activity.map((day, index) => (
                  <View key={index} style={styles.barColumn}>
                    <Text style={styles.barValue}>{day.total}</Text>
                    <View style={styles.barContainer}>
                      <View 
                        style={[
                          styles.barStacked,
                          { height: `${Math.max((day.total / maxActivity) * 100, 5)}%` }
                        ]}
                      >
                        <View 
                          style={[
                            styles.barStackPart, 
                            { 
                              flex: day.posts || 1,
                              backgroundColor: '#7C3AED'
                            }
                          ]} 
                        />
                        <View 
                          style={[
                            styles.barStackPart, 
                            { 
                              flex: day.comments || 1,
                              backgroundColor: '#00D9A5'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                    <Text style={styles.barLabel}>{day.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Role Distribution */}
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <Text style={styles.chartTitle}>{t("admin.roleDistribution")}</Text>
                <View style={styles.chartBadge}>
                  <Ionicons name="pie-chart" size={14} color="#F59E0B" />
                </View>
              </View>
              <View style={styles.distributionList}>
                {adminStats.distributions.roles.map((role, index) => {
                  const total = adminStats.distributions.roles.reduce((acc, r) => acc + r.count, 0) || 1;
                  const percentage = Math.round((role.count / total) * 100);
                  const roleConfig = ROLE_CONFIG[role.role as keyof typeof ROLE_CONFIG];
                  
                  return (
                    <View key={index} style={styles.distributionItem}>
                      <View style={styles.distributionInfo}>
                        <View style={[styles.distributionIcon, { backgroundColor: roleConfig?.bgColor || 'rgba(139, 139, 158, 0.15)' }]}>
                          <Ionicons name={(roleConfig?.icon || 'person') as any} size={16} color={roleConfig?.color || '#8B8B9E'} />
                        </View>
                        <Text style={styles.distributionLabel}>{role.label}</Text>
                        <Text style={styles.distributionCount}>{role.count}</Text>
                      </View>
                      <View style={styles.distributionBarBg}>
                        <View 
                          style={[
                            styles.distributionBarFill, 
                            { 
                              width: `${percentage}%`,
                              backgroundColor: roleConfig?.color || '#8B8B9E'
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.distributionPercentage}>{percentage}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Category Distribution */}
            {adminStats.distributions.categories.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartCardHeader}>
                  <Text style={styles.chartTitle}>{t("admin.postCategories")}</Text>
                </View>
                <View style={styles.categoryGrid}>
                  {adminStats.distributions.categories.map((cat, index) => (
                    <View key={index} style={styles.categoryStatCard}>
                      <View style={[styles.categoryStatDot, { backgroundColor: CATEGORY_COLORS[cat.category] || '#8B8B9E' }]} />
                      <Text style={styles.categoryStatName}>{cat.category}</Text>
                      <Text style={styles.categoryStatCount}>{cat.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color="#5A5A6E" />
            <Text style={styles.emptyText}>{t('admin.loadingStats')}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderLogs = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.logsHeader}>
        <Ionicons name="time" size={20} color="#F59E0B" />
        <Text style={styles.logsTitle}>{t("admin.adminActivityLog")}</Text>
      </View>

      {logs.length > 0 ? (
        logs.map((log, index) => (
          <View key={log.id || index} style={styles.logCard}>
            <View style={styles.logIcon}>
              <Ionicons 
                name={
                  (log.action || '').includes('ban') ? 'ban' :
                  (log.action || '').includes('promote') ? 'arrow-up-circle' :
                  (log.action || '').includes('delete') ? 'trash' :
                  (log.action || '').includes('vip') ? 'diamond' :
                  (log.action || '').includes('pro') ? 'school' :
                  (log.action || '').includes('report') ? 'flag' : 'settings'
                } 
                size={16} 
                color={
                  (log.action || '').includes('ban') ? '#FF4757' :
                  (log.action || '').includes('unban') ? '#00D9A5' :
                  (log.action || '').includes('promote') ? '#7C3AED' :
                  (log.action || '').includes('delete') ? '#FF4757' :
                  (log.action || '').includes('vip') ? '#FFD700' :
                  (log.action || '').includes('report') ? '#F59E0B' : '#8B8B9E'
                } 
              />
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logAction}>{log.action || 'unknown'}</Text>
              <Text style={styles.logDetails}>
                {typeof log.details === 'string' ? log.details : log.details ? JSON.stringify(log.details) : ''}
              </Text>
              <Text style={styles.logMeta}>
                {log.admin_name ? `par ${log.admin_name}` : 'Système'} · {log.timestamp ? formatTimeAgo(log.timestamp) : '-'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t("admin.noLogs")}</Text>
          <Text style={styles.emptySubtext}>{t("admin.actionsRecorded")}</Text>
        </View>
      )}
    </Animated.View>
  );

  const EXPERTISE_LABELS: Record<string, string> = {
    trading: 'Trading', defi: 'DeFi', nft: 'NFT', blockchain: 'Blockchain',
    investment: 'Investissement', security: 'Sécurité', mining: 'Mining', metaverse: 'Metaverse',
  };

  const PRO_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: 'En attente', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)' },
    approved: { label: 'Approuvé', color: '#10B981', bgColor: 'rgba(16,185,129,0.15)' },
    rejected: { label: 'Refusé', color: '#EF4444', bgColor: 'rgba(239,68,68,0.15)' },
    suspended: { label: 'Suspendu', color: '#6B7280', bgColor: 'rgba(107,114,128,0.15)' },
  };

  const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
    basic: { label: 'Basique', color: '#6B7280' },
    verified: { label: 'Vérifié', color: '#3B82F6' },
    premium: { label: 'Premium', color: '#F59E0B' },
  };

  const handleReviewApplication = async (applicationId: string, decision: string, badgeLevel?: string) => {
    setActionLoading(true);
    try {
      await proAPI.reviewApplication(applicationId, decision, badgeLevel);
      setShowProAppModal(false);
      setSelectedProApp(null);
      setSuccessMessage(decision === 'approved' ? t('admin.pro.approved') : t('admin.pro.rejected'));
      setShowSuccessModal(true);
      fetchData();
    } catch (error) {
      console.error('Review error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const renderProApplications = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.proHeader}>
        <Ionicons name="school" size={20} color="#7C3AED" />
        <Text style={styles.proHeaderTitle}>{t("admin.mentorApplications")}</Text>
        {pendingProCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingProCount} en attente</Text>
          </View>
        )}
      </View>

      {proApplications.length > 0 ? (
        proApplications.map((app) => {
          const statusConfig = PRO_STATUS_CONFIG[app.status] || PRO_STATUS_CONFIG.pending;
          return (
            <TouchableOpacity
              key={app.id}
              style={styles.proAppCard}
              onPress={() => { setSelectedProApp(app); setShowProAppModal(true); }}
              data-testid={`pro-app-${app.id}`}
            >
              <View style={styles.proAppHeader}>
                <View style={[styles.proAppAvatar, { backgroundColor: statusConfig.color }]}>
                  <Text style={styles.proAppAvatarText}>
                    {app.full_name?.slice(0, 2).toUpperCase() || '??'}
                  </Text>
                </View>
                <View style={styles.proAppInfo}>
                  <Text style={styles.proAppName}>{app.full_name}</Text>
                  <Text style={styles.proAppEmail}>{app.user_email}</Text>
                  <View style={[styles.proAppStatusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Text style={[styles.proAppStatusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
              </View>
              
              <View style={styles.proAppDetails}>
                <View style={styles.proAppDetail}>
                  <Ionicons name="briefcase" size={14} color="#8B8B9E" />
                  <Text style={styles.proAppDetailText}>
                    {EXPERTISE_LABELS[app.main_expertise] || app.main_expertise}
                  </Text>
                </View>
                <View style={styles.proAppDetail}>
                  <Ionicons name="time" size={14} color="#8B8B9E" />
                  <Text style={styles.proAppDetailText}>{app.years_experience}+ ans</Text>
                </View>
                <View style={styles.proAppDetail}>
                  <Ionicons name="globe" size={14} color="#8B8B9E" />
                  <Text style={styles.proAppDetailText}>{app.country}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="school-outline" size={48} color="#5A5A6E" />
          <Text style={styles.emptyText}>{t("admin.noApplications")}</Text>
          <Text style={styles.emptySubtext}>{t("admin.applicationsWillAppear")}</Text>
        </View>
      )}
    </Animated.View>
  );

  const FEEDBACK_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    testimonial: { icon: 'heart', color: '#EC4899', label: 'Testimonial' },
    improvement: { icon: 'bulb', color: '#F59E0B', label: 'Improvement' },
    bug: { icon: 'bug', color: '#EF4444', label: 'Bug Report' },
    feature: { icon: 'rocket', color: '#3B82F6', label: 'Feature Request' },
  };

  const FEEDBACK_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    new: { color: '#EC4899', label: 'New' },
    read: { color: '#3B82F6', label: 'Read' },
    archived: { color: '#6B6B80', label: 'Archived' },
  };

  const handleUpdateFeedbackStatus = async (feedbackId: string) => {
    try {
      const res = await api.patch(`/admin/feedback/${feedbackId}`);
      if (res.data.success) {
        const updated = feedbacks.map(f => f.id === feedbackId ? { ...f, status: res.data.new_status } : f);
        setFeedbacks(updated);
        if (selectedFeedback?.id === feedbackId) setSelectedFeedback({ ...selectedFeedback, status: res.data.new_status });
        setNewFeedbackCount(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to update feedback:', e);
    }
  };

  const handleReplyToFeedback = async (feedbackId: string) => {
    if (!adminReply.trim()) return;
    try {
      const res = await api.post(`/admin/feedback/${feedbackId}/reply`, { message: adminReply.trim() });
      if (res.data.success) {
        const reply = res.data.reply;
        const updated = feedbacks.map(f => f.id === feedbackId ? { ...f, replies: [...(f.replies || []), reply], status: 'read' } : f);
        setFeedbacks(updated);
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback({ ...selectedFeedback, replies: [...(selectedFeedback.replies || []), reply], status: 'read' });
        }
        setAdminReply('');
      }
    } catch (e) {
      console.error('Failed to reply:', e);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    try {
      const res = await api.delete(`/admin/feedback/${feedbackId}`);
      if (res.data.success) {
        setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
        setSelectedFeedback(null);
      }
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // ---- Affiliates ----
  const handleCreateInfluencer = async () => {
    try {
      setActionLoading(true);
      const res = await influencerAPI.createInfluencer({
        name: newInfluencer.name,
        email: newInfluencer.email,
        commission_rate: parseFloat(newInfluencer.commission_rate) / 100
      });
      if (res.data.success) {
        setAffiliateInfluencers(prev => [...prev, { ...res.data.influencer, stats: { clicks: 0, conversions: 0, conversion_rate: 0, total_revenue: 0, total_commission: 0, paid_commission: 0, pending_commission: 0 } }]);
        setShowCreateInfluencer(false);
        setNewInfluencer({ name: '', email: '', commission_rate: '20' });
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRate = async (id: string, rate: string) => {
    try {
      await influencerAPI.updateInfluencer(id, { commission_rate: parseFloat(rate) / 100 });
      setAffiliateInfluencers(prev => prev.map(i => i.id === id ? { ...i, commission_rate: parseFloat(rate) / 100 } : i));
      setEditingRate(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await influencerAPI.updateInfluencer(id, { status: newStatus });
      setAffiliateInfluencers(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur');
    }
  };

  const handlePayout = async (id: string) => {
    try {
      setActionLoading(true);
      const res = await influencerAPI.triggerPayout(id);
      if (res.data.success) {
        alert(`Versement de $${res.data.payout.amount} effectué !`);
        fetchData();
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Erreur de versement');
    } finally {
      setActionLoading(false);
    }
  };

  const renderAffiliates = () => (
    <View>
      {/* Header + Create button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Gestion Affiliation</Text>
        <Pressable
          onPress={() => setShowCreateInfluencer(true)}
          style={{ backgroundColor: '#FFD700', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
          data-testid="create-influencer-btn"
        >
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>+ Nouvel Influenceur</Text>
        </Pressable>
      </View>

      {/* Create Form */}
      {showCreateInfluencer && (
        <View style={{ backgroundColor: '#111127', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFD70033' }}>
          <Text style={{ color: '#FFF', fontWeight: '600', marginBottom: 12 }}>Créer un influenceur</Text>
          <TextInput
            placeholder="Nom"
            placeholderTextColor="#6B6B80"
            value={newInfluencer.name}
            onChangeText={(v) => setNewInfluencer(p => ({ ...p, name: v }))}
            style={{ backgroundColor: '#0A0A1A', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 8 }}
            data-testid="influencer-name-input"
          />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#6B6B80"
            value={newInfluencer.email}
            onChangeText={(v) => setNewInfluencer(p => ({ ...p, email: v }))}
            style={{ backgroundColor: '#0A0A1A', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 8 }}
            data-testid="influencer-email-input"
          />
          <TextInput
            placeholder="Commission %"
            placeholderTextColor="#6B6B80"
            value={newInfluencer.commission_rate}
            onChangeText={(v) => setNewInfluencer(p => ({ ...p, commission_rate: v }))}
            keyboardType="numeric"
            style={{ backgroundColor: '#0A0A1A', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 12 }}
            data-testid="influencer-commission-input"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleCreateInfluencer}
              style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
              data-testid="submit-create-influencer"
            >
              <Text style={{ color: '#FFF', fontWeight: '700' }}>{actionLoading ? 'Création...' : 'Créer'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCreateInfluencer(false)}
              style={{ flex: 1, backgroundColor: '#1A1A2E', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B6B80', fontWeight: '600' }}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Stats Summary */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: '#111127', borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#60A5FA', fontSize: 22, fontWeight: '700' }}>{affiliateInfluencers.length}</Text>
          <Text style={{ color: '#6B6B80', fontSize: 11 }}>Influenceurs</Text>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: '#111127', borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#34D399', fontSize: 22, fontWeight: '700' }}>{affiliateConversions.length}</Text>
          <Text style={{ color: '#6B6B80', fontSize: 11 }}>Conversions</Text>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: '#111127', borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: '700' }}>
            ${affiliateInfluencers.reduce((s, i) => s + (i.stats?.total_commission || 0), 0).toFixed(2)}
          </Text>
          <Text style={{ color: '#6B6B80', fontSize: 11 }}>Total commissions</Text>
        </View>
      </View>

      {/* Influencers List */}
      {affiliateInfluencers.map((inf: any) => (
        <View key={inf.id} style={{ backgroundColor: '#111127', borderRadius: 12, padding: 16, marginBottom: 12 }} data-testid={`influencer-card-${inf.code}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>{inf.name}</Text>
              <Text style={{ color: '#6B6B80', fontSize: 12 }}>{inf.email}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => handleToggleStatus(inf.id, inf.status)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: inf.status === 'active' ? '#10B98122' : '#EF444422' }}
              >
                <Text style={{ color: inf.status === 'active' ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: '600' }}>
                  {inf.status === 'active' ? 'Actif' : 'Inactif'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Code + Commission */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Code: <Text style={{ color: '#FFD700' }}>{inf.code}</Text></Text>
            {editingRate?.id === inf.id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TextInput
                  value={editingRate.rate}
                  onChangeText={(v) => setEditingRate({ id: inf.id, rate: v })}
                  style={{ backgroundColor: '#0A0A1A', color: '#FFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 50, fontSize: 12 }}
                  keyboardType="numeric"
                />
                <Text style={{ color: '#6B6B80', fontSize: 12 }}>%</Text>
                <Pressable onPress={() => handleUpdateRate(inf.id, editingRate.rate)}>
                  <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>OK</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingRate({ id: inf.id, rate: ((inf.commission_rate || 0.2) * 100).toFixed(0) })}>
                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Commission: <Text style={{ color: '#FFD700' }}>{((inf.commission_rate || 0.2) * 100).toFixed(0)}%</Text> (modifier)</Text>
              </Pressable>
            )}
          </View>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1A1A2E' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>{inf.stats?.clicks || 0}</Text>
              <Text style={{ color: '#6B6B80', fontSize: 10 }}>Clics</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>{inf.stats?.conversions || 0}</Text>
              <Text style={{ color: '#6B6B80', fontSize: 10 }}>Conv.</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>{inf.stats?.conversion_rate || 0}%</Text>
              <Text style={{ color: '#6B6B80', fontSize: 10 }}>Taux</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#10B981', fontWeight: '600' }}>${inf.stats?.pending_commission?.toFixed(2) || '0.00'}</Text>
              <Text style={{ color: '#6B6B80', fontSize: 10 }}>En attente</Text>
            </View>
            <Pressable
              onPress={() => handlePayout(inf.id)}
              disabled={!inf.stats?.pending_commission || inf.stats?.pending_commission <= 0}
              style={{ backgroundColor: inf.stats?.pending_commission > 0 ? '#FFD700' : '#1A1A2E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
              data-testid={`payout-btn-${inf.code}`}
            >
              <Text style={{ color: inf.stats?.pending_commission > 0 ? '#000' : '#6B6B80', fontWeight: '700', fontSize: 12 }}>Verser</Text>
            </Pressable>
          </View>

          {/* Stripe status */}
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: inf.stripe_account_id ? '#10B981' : '#F97316', fontSize: 11 }}>
              Stripe: {inf.stripe_account_id ? 'Connecté' : 'Non connecté'}
            </Text>
          </View>
        </View>
      ))}

      {affiliateInfluencers.length === 0 && (
        <View style={{ backgroundColor: '#111127', borderRadius: 12, padding: 30, alignItems: 'center' }}>
          <Text style={{ color: '#6B6B80', fontSize: 14 }}>Aucun influenceur pour le moment</Text>
        </View>
      )}
    </View>
  );

  const renderFeedback = () => {
    const filteredFeedbacks = feedbackFilter
      ? feedbacks.filter(f => f.type === feedbackFilter)
      : feedbacks;

    return (
      <View>
        {/* Header */}
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Feedback & Testimonials</Text>
          <Text style={{ color: '#8B8B9E', fontSize: 13 }}>{feedbacks.length} total, {newFeedbackCount} new</Text>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.filterPill, !feedbackFilter && styles.filterPillActive]}
              onPress={() => setFeedbackFilter(null)}
              data-testid="feedback-filter-all"
            >
              <Text style={[styles.filterPillText, !feedbackFilter && styles.filterPillTextActive]}>All</Text>
            </TouchableOpacity>
            {Object.entries(FEEDBACK_TYPE_CONFIG).map(([key, config]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterPill, feedbackFilter === key && { borderColor: config.color, backgroundColor: `${config.color}15` }]}
                onPress={() => setFeedbackFilter(feedbackFilter === key ? null : key)}
                data-testid={`feedback-filter-${key}`}
              >
                <Ionicons name={config.icon as any} size={14} color={feedbackFilter === key ? config.color : '#8B8B9E'} />
                <Text style={[styles.filterPillText, feedbackFilter === key && { color: config.color }]}>{config.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Feedback List */}
        {filteredFeedbacks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color="#5A5A6E" />
            <Text style={styles.emptyText}>No feedback yet</Text>
          </View>
        ) : (
          filteredFeedbacks.map((fb) => {
            const typeConfig = FEEDBACK_TYPE_CONFIG[fb.type] || FEEDBACK_TYPE_CONFIG.improvement;
            const statusConfig = FEEDBACK_STATUS_CONFIG[fb.status] || FEEDBACK_STATUS_CONFIG.new;

            return (
              <Pressable
                key={fb.id}
                style={({ pressed }) => [styles.postCard, fb.status === 'new' && { borderLeftWidth: 3, borderLeftColor: '#EC4899' }, pressed && { opacity: 0.7 }]}
                onPress={() => { setSelectedFeedback(fb); setAdminReply(''); if (fb.status === 'new') handleUpdateFeedbackStatus(fb.id); }}
                accessibilityRole="button"
                data-testid={`feedback-item-${fb.id}`}
              >
                {/* Badges Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.rolePill, { backgroundColor: `${typeConfig.color}20` }]}>
                    <Ionicons name={typeConfig.icon as any} size={12} color={typeConfig.color} />
                    <Text style={[styles.rolePillText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: `${statusConfig.color}20`, marginLeft: 6 }]}>
                    <Text style={[styles.rolePillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                  </View>
                  {(fb.replies || []).length > 0 && (
                    <View style={[styles.rolePill, { backgroundColor: 'rgba(16,185,129,0.15)', marginLeft: 6 }]}>
                      <Ionicons name="chatbubble" size={10} color="#10B981" />
                      <Text style={[styles.rolePillText, { color: '#10B981' }]}>{(fb.replies || []).length} reply</Text>
                    </View>
                  )}
                  {fb.rating && (
                    <View style={{ flexDirection: 'row', marginLeft: 'auto', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Ionicons key={s} name={s <= fb.rating ? 'star' : 'star-outline'} size={14} color="#FFD700" />
                      ))}
                    </View>
                  )}
                </View>

                {/* Preview */}
                <Text style={{ color: '#E5E5EA', fontSize: 14, lineHeight: 20, marginBottom: 8 }} numberOfLines={2}>{fb.message}</Text>

                {/* Footer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#6B6B80', fontSize: 12 }}>
                    {fb.user_name || 'Anonymous'} · {new Date(fb.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#5A5A6E" />
                </View>
              </Pressable>
            );
          })
        )}

        {/* Feedback Detail Modal */}
        <Modal visible={!!selectedFeedback} transparent animationType="fade" onRequestClose={() => setSelectedFeedback(null)}>
          <View style={fbStyles.overlay}>
            <View style={fbStyles.modal} data-testid="feedback-detail-modal">
              {selectedFeedback && (() => {
                const fb = selectedFeedback;
                const typeConfig = FEEDBACK_TYPE_CONFIG[fb.type] || FEEDBACK_TYPE_CONFIG.improvement;
                const statusConfig = FEEDBACK_STATUS_CONFIG[fb.status] || FEEDBACK_STATUS_CONFIG.new;
                return (
                  <>
                    {/* Modal Header */}
                    <View style={fbStyles.header}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <View style={[styles.rolePill, { backgroundColor: `${typeConfig.color}20` }]}>
                            <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
                            <Text style={[styles.rolePillText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                          </View>
                          <View style={[styles.rolePill, { backgroundColor: `${statusConfig.color}20` }]}>
                            <Text style={[styles.rolePillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                          </View>
                          {fb.rating && (
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons key={s} name={s <= fb.rating ? 'star' : 'star-outline'} size={16} color="#FFD700" />
                              ))}
                            </View>
                          )}
                        </View>
                        <Text style={fbStyles.authorName}>{fb.user_name || 'Anonymous'}</Text>
                        <Text style={fbStyles.authorMeta}>
                          {fb.user_email || ''} · {new Date(fb.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedFeedback(null)} style={fbStyles.closeBtn} data-testid="feedback-close-modal">
                        <Ionicons name="close" size={22} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    {/* Full Message */}
                    <ScrollView style={fbStyles.bodyScroll} contentContainerStyle={{ paddingBottom: 20 }}>
                      <Text style={fbStyles.message} selectable>{fb.message}</Text>

                      {/* Replies */}
                      {(fb.replies || []).length > 0 && (
                        <View style={fbStyles.repliesSection}>
                          <Text style={fbStyles.repliesTitle}>Replies ({(fb.replies || []).length})</Text>
                          {(fb.replies || []).map((reply: any) => (
                            <View key={reply.id} style={fbStyles.replyCard}>
                              <View style={fbStyles.replyHeader}>
                                <View style={fbStyles.replyAvatar}>
                                  <Ionicons name="shield-checkmark" size={14} color="#7C3AED" />
                                </View>
                                <Text style={fbStyles.replyAuthor}>{reply.admin_name || 'Admin'}</Text>
                                <Text style={fbStyles.replyTime}>
                                  {new Date(reply.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                              </View>
                              <Text style={fbStyles.replyText} selectable>{reply.message}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </ScrollView>

                    {/* Reply Input + Actions */}
                    <View style={fbStyles.footer}>
                      <View style={fbStyles.replyInputRow}>
                        <TextInput
                          style={fbStyles.replyInput}
                          placeholder="Write a reply..."
                          placeholderTextColor="#5A5A6E"
                          value={adminReply}
                          onChangeText={setAdminReply}
                          multiline
                          data-testid="feedback-reply-input"
                        />
                        <TouchableOpacity
                          style={[fbStyles.sendBtn, !adminReply.trim() && { opacity: 0.4 }]}
                          onPress={() => handleReplyToFeedback(fb.id)}
                          disabled={!adminReply.trim()}
                          data-testid="feedback-reply-send"
                        >
                          <Ionicons name="send" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                      <View style={fbStyles.actionsRow}>
                        {fb.status !== 'archived' && (
                          <TouchableOpacity
                            style={fbStyles.actionBtn}
                            onPress={() => { handleUpdateFeedbackStatus(fb.id); }}
                            data-testid="feedback-modal-status"
                          >
                            <Ionicons name={fb.status === 'new' ? 'checkmark-circle' : 'archive'} size={16} color="#7C3AED" />
                            <Text style={fbStyles.actionBtnText}>{fb.status === 'new' ? 'Mark read' : 'Archive'}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[fbStyles.actionBtn, { borderColor: 'rgba(239,68,68,0.3)' }]}
                          onPress={() => handleDeleteFeedback(fb.id)}
                          data-testid="feedback-modal-delete"
                        >
                          <Ionicons name="trash" size={16} color="#EF4444" />
                          <Text style={[fbStyles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A1A', '#0F0520', '#0A0A1A']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="back-btn">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Panel Admin</Text>
            <View style={[styles.rolePill, { backgroundColor: isSuperAdmin ? 'rgba(255, 71, 87, 0.2)' : 'rgba(124, 58, 237, 0.2)' }]}>
              <Ionicons name={isSuperAdmin ? 'shield' : 'shield-half'} size={12} color={isSuperAdmin ? '#FF4757' : '#7C3AED'} />
              <Text style={[styles.rolePillText, { color: isSuperAdmin ? '#FF4757' : '#7C3AED' }]}>
                {isSuperAdmin ? t('admin.role.superAdmin') : t('admin.role.admin')}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={fetchData} style={styles.refreshBtn} data-testid="refresh-btn">
            <Ionicons name="refresh" size={22} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.tabsContainer}>
            {([
              { key: 'analytics', icon: 'pulse', label: 'Analytics Live', superAdminOnly: true },
              { key: 'dashboard', icon: 'grid', label: 'Tableau de bord', superAdminOnly: false },
              { key: 'users', icon: 'people', label: `Utilisateurs (${users.length})`, superAdminOnly: false },
              { key: 'posts', icon: 'chatbubbles', label: `Publications (${posts.length})`, superAdminOnly: false },
              { key: 'pro', icon: 'school', label: `Mentors${pendingProCount > 0 ? ` (${pendingProCount})` : ''}`, superAdminOnly: true },
              { key: 'revenue', icon: 'cash', label: `Revenus${pendingWithdrawalsCount > 0 ? ` (${pendingWithdrawalsCount})` : ''}`, superAdminOnly: true },
              { key: 'reports', icon: 'flag', label: `Signalements${pendingReportsCount > 0 ? ` (${pendingReportsCount})` : ''}`, superAdminOnly: false },
              { key: 'stats', icon: 'analytics', label: 'Statistiques', superAdminOnly: false },
              { key: 'logs', icon: 'time', label: 'Journaux', superAdminOnly: false },
              { key: 'feedback', icon: 'chatbubble-ellipses', label: `Feedback${newFeedbackCount > 0 ? ` (${newFeedbackCount})` : ''}`, superAdminOnly: true },
              { key: 'affiliates', icon: 'people-circle', label: 'Affiliation', superAdminOnly: true },
            ] as const)
              .filter(tab => !tab.superAdminOnly || isSuperAdmin)
              .map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                data-testid={`tab-${tab.key}`}
              >
                <Ionicons name={tab.icon} size={18} color={activeTab === tab.key ? '#7C3AED' : '#8B8B9E'} />
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.key === 'pro' && pendingProCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{pendingProCount}</Text>
                  </View>
                )}
                {tab.key === 'revenue' && pendingWithdrawalsCount > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: '#10B981' }]}>
                    <Text style={styles.tabBadgeText}>{pendingWithdrawalsCount}</Text>
                  </View>
                )}
                {tab.key === 'reports' && pendingReportsCount > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.tabBadgeText}>{pendingReportsCount}</Text>
                  </View>
                )}
                {tab.key === 'feedback' && newFeedbackCount > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: '#EC4899' }]}>
                    <Text style={styles.tabBadgeText}>{newFeedbackCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => { setRefreshing(true); fetchData(); }} 
              tintColor="#7C3AED" 
            />
          }
        >
          {activeTab === 'analytics' && isSuperAdmin && renderAnalytics()}
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'posts' && renderPosts()}
          {activeTab === 'pro' && isSuperAdmin && renderProApplications()}
          {activeTab === 'revenue' && isSuperAdmin && renderRevenue()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'stats' && renderStats()}
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'feedback' && isSuperAdmin && renderFeedback()}
          {activeTab === 'affiliates' && isSuperAdmin && renderAffiliates()}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* User Detail Modal */}
      <Modal visible={showUserModal} animationType="slide" transparent onRequestClose={() => setShowUserModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestion utilisateur</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalProfile}>
                  <View style={[styles.modalAvatar, { backgroundColor: ROLE_CONFIG[selectedUser.role as keyof typeof ROLE_CONFIG]?.color || '#8B8B9E' }]}>
                    <Text style={styles.modalAvatarText}>{selectedUser.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.modalUserName}>{selectedUser.name}</Text>
                  <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                  
                  <View style={[styles.modalRoleBadge, { backgroundColor: ROLE_CONFIG[selectedUser.role as keyof typeof ROLE_CONFIG]?.bgColor }]}>
                    <Ionicons 
                      name={(ROLE_CONFIG[selectedUser.role as keyof typeof ROLE_CONFIG]?.icon || 'person') as any}
                      size={14} 
                      color={ROLE_CONFIG[selectedUser.role as keyof typeof ROLE_CONFIG]?.color || '#8B8B9E'} 
                    />
                    <Text style={[styles.modalRoleText, { color: ROLE_CONFIG[selectedUser.role as keyof typeof ROLE_CONFIG]?.color || '#8B8B9E' }]}>
                      {ROLE_CONFIG[selectedUser.role as keyof typeof ROLE_CONFIG]?.label || t('admin.role.user')}
                    </Text>
                  </View>

                  {selectedUser.is_banned && (
                    <View style={styles.bannedBadge}>
                      <Ionicons name="ban" size={14} color="#FF4757" />
                      <Text style={styles.bannedText}>Compte banni</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalInfoCard}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>{t("admin.registeredOn")}</Text>
                    <Text style={styles.modalInfoValue}>{formatDate(selectedUser.created_at)}</Text>
                  </View>
                  <View style={[styles.modalInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.modalInfoLabel}>{t("admin.communityScore")}</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.community_score || 0}</Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Actions</Text>

                <TouchableOpacity
                  style={[styles.actionButton, selectedUser.is_banned ? styles.actionButtonSuccess : styles.actionButtonDanger]}
                  onPress={() => handleBanUser(selectedUser)}
                >
                  <Ionicons name={selectedUser.is_banned ? 'checkmark-circle' : 'ban'} size={22} color="#FFF" />
                  <Text style={styles.actionButtonText}>
                    {selectedUser.is_banned ? t('admin.unbanUser') : t('admin.banUser')}
                  </Text>
                </TouchableOpacity>

                {isSuperAdmin && selectedUser.id !== user?.id && (
                  <>
                    <Text style={styles.modalSectionTitle}>{t('admin.changeRole')}</Text>
                    <View style={styles.roleSelector}>
                      {(['user', 'admin', 'super_admin'] as const).map((role) => {
                        const config = ROLE_CONFIG[role];
                        const isActive = selectedUser.role === role;
                        return (
                          <TouchableOpacity
                            key={role}
                            style={[styles.roleSelectorBtn, isActive && { borderColor: config.color, backgroundColor: config.bgColor }]}
                            onPress={() => handlePromoteUser(selectedUser, role)}
                          >
                            <Ionicons name={config.icon as any} size={20} color={isActive ? config.color : '#8B8B9E'} />
                            <Text style={[styles.roleSelectorText, isActive && { color: config.color }]}>
                              {config.label}
                            </Text>
                            {isActive && <Ionicons name="checkmark-circle" size={18} color={config.color} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    
                    <Text style={styles.modalSectionTitle}>{t("admin.vipStatus")}</Text>
                    <View style={styles.vipProSelector}>
                      <TouchableOpacity
                        style={[
                          styles.vipProBtn,
                          selectedUser.is_vip && styles.vipProBtnActive,
                          { borderColor: '#FFD700' }
                        ]}
                        onPress={async () => {
                          try {
                            await adminAPI.setUserVIP(selectedUser.id, !selectedUser.is_vip, 1);
                            setShowUserModal(false);
                            fetchData();
                            setSuccessMessage(selectedUser.is_vip ? 'VIP retiré' : 'VIP activé (1 mois)');
                            setShowSuccessModal(true);
                          } catch (error) {
                            console.error('Error setting VIP:', error);
                          }
                        }}
                      >
                        <Ionicons name="diamond" size={20} color={selectedUser.is_vip ? '#FFD700' : '#8B8B9E'} />
                        <Text style={[styles.vipProBtnText, selectedUser.is_vip && { color: '#FFD700' }]}>
                          {selectedUser.is_vip ? 'VIP Actif' : 'Activer VIP'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.modalSectionTitle}>{t("admin.mentorStatus")}</Text>
                    <View style={styles.vipProSelector}>
                      <TouchableOpacity
                        style={[
                          styles.vipProBtn,
                          selectedUser.is_professional && styles.vipProBtnActivePro,
                          { borderColor: '#10B981' }
                        ]}
                        onPress={async () => {
                          try {
                            await adminAPI.setUserPro(selectedUser.id, !selectedUser.is_professional, 'verified');
                            setShowUserModal(false);
                            fetchData();
                            setSuccessMessage(selectedUser.is_professional ? 'Pro retiré' : 'Pro activé (Vérifié)');
                            setShowSuccessModal(true);
                          } catch (error) {
                            console.error('Error setting Pro:', error);
                          }
                        }}
                      >
                        <Ionicons name="briefcase" size={20} color={selectedUser.is_professional ? '#10B981' : '#8B8B9E'} />
                        <Text style={[styles.vipProBtnText, selectedUser.is_professional && { color: '#10B981' }]}>
                          {selectedUser.is_professional ? 'Pro Actif' : 'Activer Pro'}
                        </Text>
                        {selectedUser.pro_badge && (
                          <View style={[styles.proBadgeSmall, { backgroundColor: '#10B98120' }]}>
                            <Text style={styles.proBadgeSmallText}>{selectedUser.pro_badge}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Post Detail Modal */}
      <Modal visible={showPostModal} animationType="slide" transparent onRequestClose={() => setShowPostModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("admin.postDetail")}</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.postCategoryBadge, { backgroundColor: `${CATEGORY_COLORS[selectedPost.category] || '#8B8B9E'}15`, alignSelf: 'flex-start', marginBottom: 12 }]}>
                  <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[selectedPost.category] || '#8B8B9E' }]} />
                  <Text style={[styles.postCategoryText, { color: CATEGORY_COLORS[selectedPost.category] || '#8B8B9E' }]}>
                    {selectedPost.category || 'autre'}
                  </Text>
                </View>

                <Text style={styles.modalPostTitle}>{selectedPost.title}</Text>
                <Text style={styles.modalPostContent}>{selectedPost.content}</Text>

                <View style={styles.modalPostMeta}>
                  <View style={styles.modalPostAuthor}>
                    <View style={styles.postAuthorAvatar}>
                      <Text style={styles.postAuthorAvatarText}>
                        {(selectedPost.author_name || 'A').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.postAuthor}>{selectedPost.author_name}</Text>
                      <Text style={styles.postDate}>{selectedPost.author_email}</Text>
                    </View>
                  </View>
                  <Text style={styles.postDate}>{formatDate(selectedPost.created_at)}</Text>
                </View>

                <View style={styles.modalPostStats}>
                  <View style={styles.modalPostStatItem}>
                    <Ionicons name="arrow-up" size={20} color="#00D9A5" />
                    <Text style={styles.modalPostStatValue}>{selectedPost.votes || 0}</Text>
                    <Text style={styles.modalPostStatLabel}>votes</Text>
                  </View>
                  <View style={styles.modalPostStatItem}>
                    <Ionicons name="chatbubble" size={20} color="#7C3AED" />
                    <Text style={styles.modalPostStatValue}>{selectedPost.comments_count || 0}</Text>
                    <Text style={styles.modalPostStatLabel}>commentaires</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleDeletePost(selectedPost)}
                >
                  <Ionicons name="trash" size={22} color="#FFF" />
                  <Text style={styles.actionButtonText}>{t("admin.deletePost")}</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} animationType="fade" transparent onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.confirmIconContainer}>
              <Ionicons 
                name={
                  confirmAction?.type === 'ban' ? 'warning' :
                  confirmAction?.type === 'delete_post' ? 'trash' :
                  'help-circle'
                } 
                size={32} 
                color={confirmAction?.type === 'unban' || confirmAction?.type === 'promote' ? '#7C3AED' : '#FF4757'} 
              />
            </View>
            <Text style={styles.confirmTitle}>{confirmAction?.title}</Text>
            <Text style={styles.confirmMessage}>{confirmAction?.message}</Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                disabled={actionLoading}
              >
                <Text style={styles.confirmCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmActionBtn, 
                  (confirmAction?.type === 'ban' || confirmAction?.type === 'delete_post') ? styles.confirmActionBtnDanger : styles.confirmActionBtnPrimary
                ]}
                onPress={confirmAction?.onConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmActionText}>{t("common.confirm")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pro Application Modal */}
      <Modal visible={showProAppModal} animationType="slide" transparent onRequestClose={() => setShowProAppModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("admin.mentorApplication")}</Text>
              <TouchableOpacity onPress={() => setShowProAppModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedProApp && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalProfile}>
                  <View style={[styles.modalAvatar, { backgroundColor: PRO_STATUS_CONFIG[selectedProApp.status]?.color || '#F59E0B' }]}>
                    <Text style={styles.modalAvatarText}>{selectedProApp.full_name?.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.modalUserName}>{selectedProApp.full_name}</Text>
                  <Text style={styles.modalUserEmail}>{selectedProApp.user_email}</Text>
                  
                  <View style={[styles.proAppStatusBadge, { backgroundColor: PRO_STATUS_CONFIG[selectedProApp.status]?.bgColor }]}>
                    <Text style={[styles.proAppStatusText, { color: PRO_STATUS_CONFIG[selectedProApp.status]?.color }]}>
                      {PRO_STATUS_CONFIG[selectedProApp.status]?.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalInfoCard}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>{t("admin.expertise")}</Text>
                    <Text style={styles.modalInfoValue}>{EXPERTISE_LABELS[selectedProApp.main_expertise]}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>{t("admin.experienceLabel")}</Text>
                    <Text style={styles.modalInfoValue}>{selectedProApp.years_experience}+ ans</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Pays</Text>
                    <Text style={styles.modalInfoValue}>{selectedProApp.country}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Langues</Text>
                    <Text style={styles.modalInfoValue}>{selectedProApp.languages?.join(', ')}</Text>
                  </View>
                  <View style={[styles.modalInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.modalInfoLabel}>Tarif horaire</Text>
                    <Text style={[styles.modalInfoValue, { color: '#10B981' }]}>{selectedProApp.hourly_rate}$/h</Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Bio</Text>
                <Text style={styles.proAppBio}>{selectedProApp.bio}</Text>

                {selectedProApp.linkedin_url && (
                  <TouchableOpacity style={styles.proAppLink}>
                    <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                    <Text style={styles.proAppLinkText}>LinkedIn</Text>
                  </TouchableOpacity>
                )}
                {selectedProApp.twitter_url && (
                  <TouchableOpacity style={styles.proAppLink}>
                    <Ionicons name="logo-twitter" size={18} color="#1DA1F2" />
                    <Text style={styles.proAppLinkText}>Twitter</Text>
                  </TouchableOpacity>
                )}

                {selectedProApp.status === 'pending' && (
                  <>
                    <Text style={styles.modalSectionTitle}>Actions</Text>
                    
                    <Text style={[styles.modalInfoLabel, { marginBottom: 10 }]}>Niveau de badge</Text>
                    <View style={styles.badgeSelector}>
                      {(['basic', 'verified', 'premium'] as const).map((badge) => (
                        <TouchableOpacity
                          key={badge}
                          style={[styles.badgeSelectorBtn, { borderColor: BADGE_CONFIG[badge].color }]}
                          onPress={() => handleReviewApplication(selectedProApp.id, 'approved', badge)}
                          disabled={actionLoading}
                        >
                          <Ionicons 
                            name={badge === 'premium' ? 'diamond' : badge === 'verified' ? 'shield-checkmark' : 'checkmark-circle'} 
                            size={16} 
                            color={BADGE_CONFIG[badge].color} 
                          />
                          <Text style={[styles.badgeSelectorText, { color: BADGE_CONFIG[badge].color }]}>
                            {BADGE_CONFIG[badge].label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonDanger, { marginTop: 20 }]}
                      onPress={() => handleReviewApplication(selectedProApp.id, 'rejected')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="close-circle" size={22} color="#FFF" />
                          <Text style={styles.actionButtonText}>Refuser la candidature</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.userAvatar, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons name="flag" size={24} color="#EF4444" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.modalTitle}>{t("admin.reportDetail")}</Text>
                  <Text style={styles.userEmail}>{selectedReport?.reported_user_email}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={20} color="#8B8B9E" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
              {/* Reporter Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t("admin.reportedBy")}</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={16} color="#8B8B9E" />
                  <Text style={styles.infoText}>{selectedReport?.reporter_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={16} color="#8B8B9E" />
                  <Text style={styles.infoText}>{selectedReport?.reporter_email}</Text>
                </View>
              </View>

              {/* Reported User Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t("admin.reportedUser")}</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={16} color="#8B8B9E" />
                  <Text style={styles.infoText}>{selectedReport?.reported_user_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={16} color="#8B8B9E" />
                  <Text style={styles.infoText}>{selectedReport?.reported_user_email}</Text>
                </View>
              </View>

              {/* Reason */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Raison</Text>
                <View style={[styles.roleTag, { backgroundColor: 'rgba(239,68,68,0.15)', alignSelf: 'flex-start' }]}>
                  <Ionicons name="warning" size={14} color="#EF4444" />
                  <Text style={[styles.roleText, { color: '#EF4444', marginLeft: 6 }]}>
                    {REPORT_REASON_LABELS[selectedReport?.reason] || selectedReport?.reason}
                  </Text>
                </View>
              </View>

              {/* Details */}
              {selectedReport?.details && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t("admin.details")}</Text>
                  <Text style={[styles.infoText, { lineHeight: 20 }]}>{selectedReport.details}</Text>
                </View>
              )}

              {/* Status */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t("admin.currentStatus")}</Text>
                <View style={[styles.roleTag, { backgroundColor: `${REPORT_STATUS_CONFIG[selectedReport?.status]?.color || '#8B8B9E'}20`, alignSelf: 'flex-start' }]}>
                  <Ionicons 
                    name={REPORT_STATUS_CONFIG[selectedReport?.status]?.icon as any || 'time'} 
                    size={14} 
                    color={REPORT_STATUS_CONFIG[selectedReport?.status]?.color || '#8B8B9E'} 
                  />
                  <Text style={[styles.roleText, { color: REPORT_STATUS_CONFIG[selectedReport?.status]?.color || '#8B8B9E', marginLeft: 6 }]}>
                    {REPORT_STATUS_CONFIG[selectedReport?.status]?.label || 'Inconnu'}
                  </Text>
                </View>
              </View>

              {/* Admin Notes */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t("admin.adminNotes")}</Text>
                <TextInput
                  style={[styles.searchInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder={t("admin.addNotes")}
                  placeholderTextColor="#5A5A6E"
                  multiline
                  value={reportAdminNotes}
                  onChangeText={setReportAdminNotes}
                />
              </View>

              {/* Actions */}
              {selectedReport?.status === 'pending' && (
                <View style={{ gap: 12, marginTop: 12 }}>
                  <Text style={styles.modalSectionTitle}>Actions</Text>
                  
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(16,185,129,0.15)' }]}
                    onPress={() => handleReviewReport(selectedReport.id, 'resolved', false)}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={[styles.actionBtnText, { color: '#10B981' }]}>{t("admin.markResolved")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                    onPress={() => {
                      setConfirmAction({
                        type: 'ban_user',
                        title: t('admin.banUser'),
                        message: t('admin.banConfirm', { name: selectedReport.reported_user_name }),
                        onConfirm: () => handleReviewReport(selectedReport.id, 'resolved', true),
                      });
                      setShowConfirmModal(true);
                    }}
                    disabled={actionLoading}
                  >
                    <Ionicons name="ban" size={20} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>{t('admin.banUser')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(107,114,128,0.15)' }]}
                    onPress={() => handleReviewReport(selectedReport.id, 'dismissed', false)}
                    disabled={actionLoading}
                  >
                    <Ionicons name="close-circle" size={20} color="#6B7280" />
                    <Text style={[styles.actionBtnText, { color: '#6B7280' }]}>{t('admin.reportStatus.dismissed')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Success Modal */}
      <Modal visible={showSuccessModal} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <Ionicons name="checkmark-circle" size={56} color="#00D9A5" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingIconContainer: { width: 100, height: 100, borderRadius: 30, backgroundColor: 'rgba(124, 58, 237, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  loadingText: { fontSize: 16, color: '#8B8B9E', marginTop: 16 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  rolePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, marginTop: 6, gap: 5 },
  rolePillText: { fontSize: 11, fontWeight: '600' },
  refreshBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124, 58, 237, 0.15)', alignItems: 'center', justifyContent: 'center' },
  tabsScroll: { maxHeight: 50, marginTop: 8 },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#1A1A2E', gap: 8 },
  tabActive: { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#8B8B9E' },
  tabLabelActive: { color: '#7C3AED' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  
  // Welcome Card
  welcomeCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 24 },
  welcomeGradient: { padding: 20 },
  welcomeContent: { flexDirection: 'row', alignItems: 'center' },
  welcomeIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' },
  welcomeText: { marginLeft: 16, flex: 1 },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  welcomeSubtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', marginTop: 4 },

  // Section Title
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, marginTop: 8 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: (width - 44) / 2, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A4E' },
  statIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 13, color: '#8B8B9E', marginTop: 4 },
  statTrend: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  statTrendText: { fontSize: 11, color: '#8B8B9E' },

  // Activity Card
  activityCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A4E', marginBottom: 24 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  activityMeta: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  activityStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityStatText: { fontSize: 12, color: '#00D9A5' },
  emptyActivity: { alignItems: 'center', paddingVertical: 24 },
  emptyActivityText: { fontSize: 14, color: '#8B8B9E', marginTop: 8 },

  // Quick Actions
  quickActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickActionBtn: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A4E' },
  quickActionText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', marginTop: 8, textAlign: 'center' },

  // Search & Filters
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2A2A4E' },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14, paddingHorizontal: 10 },
  filterScroll: { marginTop: 12, marginBottom: 8 },
  filterContainer: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E', gap: 6 },
  filterPillActive: { backgroundColor: 'rgba(124, 58, 237, 0.2)', borderColor: '#7C3AED' },
  filterPillText: { fontSize: 12, fontWeight: '500', color: '#8B8B9E' },
  filterPillTextActive: { color: '#7C3AED' },
  filterDivider: { width: 1, height: 20, backgroundColor: '#2A2A4E', marginHorizontal: 4 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  resultCount: { fontSize: 13, color: '#5A5A6E', marginVertical: 12 },

  // User Card
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A4E' },
  userCardBanned: { borderColor: 'rgba(255, 71, 87, 0.3)', backgroundColor: 'rgba(255, 71, 87, 0.05)' },
  userAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  bannedIndicator: { position: 'absolute', bottom: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF4757', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1A1A2E' },
  userInfo: { flex: 1, marginLeft: 12 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  userEmail: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  roleBadgeMini: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionBtnSmall: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnDanger: { backgroundColor: '#FF4757' },
  actionBtnSuccess: { backgroundColor: '#00D9A5' },

  // Post Card
  postCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A4E' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  postCategoryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 6 },
  postCategoryText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255, 71, 87, 0.15)', alignItems: 'center', justifyContent: 'center' },
  postTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 6 },
  postContent: { fontSize: 13, color: '#8B8B9E', lineHeight: 18, marginBottom: 12 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A4E' },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAuthorAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  postAuthorAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  postAuthor: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  postDate: { fontSize: 11, color: '#8B8B9E' },
  postStats: { flexDirection: 'row', gap: 14 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 12, color: '#8B8B9E' },

  // Logs
  logsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logsTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  logCard: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A4E' },
  logIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2A2A4E', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logContent: { flex: 1 },
  logAction: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  logDetails: { fontSize: 12, color: '#8B8B9E', marginTop: 4 },
  logMeta: { fontSize: 11, color: '#5A5A6E', marginTop: 6 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: '#8B8B9E', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#5A5A6E', marginTop: 4 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0A0A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  modalCloseBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },
  modalProfile: { alignItems: 'center', marginBottom: 24 },
  modalAvatar: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalAvatarText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  modalUserName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  modalUserEmail: { fontSize: 14, color: '#8B8B9E', marginTop: 4 },
  modalRoleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginTop: 12, gap: 6 },
  modalRoleText: { fontSize: 13, fontWeight: '600' },
  bannedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 71, 87, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginTop: 10, gap: 6 },
  bannedText: { fontSize: 13, fontWeight: '600', color: '#FF4757' },
  modalInfoCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A4E' },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  modalInfoLabel: { fontSize: 14, color: '#8B8B9E' },
  modalInfoValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  modalSectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 24, marginBottom: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, gap: 10, marginTop: 8 },
  actionButtonDanger: { backgroundColor: '#FF4757' },
  actionButtonSuccess: { backgroundColor: '#00D9A5' },
  actionButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  roleSelector: { gap: 10 },
  roleSelectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, borderWidth: 2, borderColor: '#2A2A4E', gap: 12 },
  roleSelectorText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#8B8B9E' },

  // Post Modal
  modalPostTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  modalPostContent: { fontSize: 15, color: '#C4C4C4', lineHeight: 22, marginBottom: 20 },
  modalPostMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalPostAuthor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalPostStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20, marginBottom: 20 },
  modalPostStatItem: { alignItems: 'center' },
  modalPostStatValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginTop: 8 },
  modalPostStatLabel: { fontSize: 12, color: '#8B8B9E', marginTop: 4 },

  // Confirm Modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmContent: { backgroundColor: '#1A1A2E', borderRadius: 24, padding: 28, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#2A2A4E', alignItems: 'center' },
  confirmIconContainer: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255, 71, 87, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  confirmMessage: { fontSize: 15, color: '#8B8B9E', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: '#2A2A4E', alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: '#8B8B9E' },
  confirmActionBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmActionBtnDanger: { backgroundColor: '#FF4757' },
  confirmActionBtnPrimary: { backgroundColor: '#7C3AED' },
  confirmActionText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Success Modal
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  successContent: { backgroundColor: '#1A1A2E', borderRadius: 24, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A4E' },
  successText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginTop: 16, textAlign: 'center' },

  // Stats/Charts
  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  statsHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  chartCard: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A4E' },
  chartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  chartBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.15)', alignItems: 'center', justifyContent: 'center' },
  chartLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#8B8B9E' },
  
  // Bar Chart
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150, paddingTop: 20 },
  barColumn: { flex: 1, alignItems: 'center' },
  barValue: { fontSize: 11, fontWeight: '600', color: '#8B8B9E', marginBottom: 6 },
  barContainer: { width: 24, height: 100, backgroundColor: '#2A2A4E', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  barStacked: { width: '100%', borderRadius: 6, flexDirection: 'column', overflow: 'hidden' },
  barStackPart: { width: '100%' },
  barLabel: { fontSize: 10, color: '#5A5A6E', marginTop: 8 },
  
  // Distribution
  distributionList: { gap: 12 },
  distributionItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  distributionInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 130 },
  distributionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  distributionLabel: { flex: 1, fontSize: 13, color: '#FFFFFF' },
  distributionCount: { fontSize: 13, fontWeight: '600', color: '#8B8B9E' },
  distributionBarBg: { flex: 1, height: 8, backgroundColor: '#2A2A4E', borderRadius: 4, overflow: 'hidden' },
  distributionBarFill: { height: '100%', borderRadius: 4 },
  distributionPercentage: { fontSize: 12, fontWeight: '600', color: '#8B8B9E', width: 36, textAlign: 'right' },
  
  // Category Grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryStatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A4E', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 8 },
  categoryStatDot: { width: 8, height: 8, borderRadius: 4 },
  categoryStatName: { fontSize: 13, color: '#FFFFFF', textTransform: 'capitalize' },
  categoryStatCount: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  
  // Tab Badge
  tabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF4757', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  
  // Pro Applications
  proHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  proHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  pendingBadge: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  pendingBadgeText: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  proAppCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A4E' },
  proAppHeader: { flexDirection: 'row', alignItems: 'center' },
  proAppAvatar: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  proAppAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  proAppInfo: { flex: 1, marginLeft: 14 },
  proAppName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  proAppEmail: { fontSize: 12, color: '#8B8B9E', marginTop: 2 },
  proAppStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  proAppStatusText: { fontSize: 11, fontWeight: '600' },
  proAppDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A4E' },
  proAppDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proAppDetailText: { fontSize: 12, color: '#8B8B9E' },
  proAppBio: { fontSize: 14, color: '#C4C4C4', lineHeight: 20, backgroundColor: '#1A1A2E', padding: 14, borderRadius: 12 },
  proAppLink: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A2E', padding: 12, borderRadius: 12, marginTop: 10 },
  proAppLinkText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  badgeSelector: { flexDirection: 'row', gap: 10 },
  badgeSelectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 2, backgroundColor: '#1A1A2E' },
  badgeSelectorText: { fontSize: 13, fontWeight: '600' },
  
  // VIP/Pro Selector Styles
  vipProSelector: { gap: 10 },
  vipProBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, borderWidth: 2, borderColor: '#2A2A4E', backgroundColor: '#1A1A2E' },
  vipProBtnActive: { borderColor: '#FFD700', backgroundColor: '#FFD70010' },
  vipProBtnActivePro: { borderColor: '#10B981', backgroundColor: '#10B98110' },
  vipProBtnText: { fontSize: 14, fontWeight: '600', color: '#8B8B9E' },
  proBadgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  proBadgeSmallText: { fontSize: 10, fontWeight: '600', color: '#10B981', textTransform: 'uppercase' },
  
  // Report Modal Styles
  modalSection: { marginBottom: 20 },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  infoText: { fontSize: 14, color: '#C4C4C4', flex: 1 },
});

const fbStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: '#0D0D1A', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '85%', borderWidth: 1, borderColor: '#2A2A4E', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  authorName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  authorMeta: { fontSize: 12, color: '#6B6B80', marginTop: 2 },
  bodyScroll: { flex: 1, padding: 20 },
  message: { fontSize: 15, color: '#E5E5EA', lineHeight: 24 },
  repliesSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#1A1A2E', paddingTop: 16 },
  repliesTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  replyCard: { backgroundColor: '#151530', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: '#7C3AED' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  replyAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' },
  replyAuthor: { fontSize: 13, fontWeight: '700', color: '#A78BFA', flex: 1 },
  replyTime: { fontSize: 11, color: '#6B6B80' },
  replyText: { fontSize: 14, color: '#D1D1E0', lineHeight: 20 },
  footer: { borderTopWidth: 1, borderTopColor: '#1A1A2E', padding: 16 },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  replyInput: { flex: 1, backgroundColor: '#151530', borderRadius: 12, padding: 12, color: '#FFFFFF', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#2A2A4E' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.05)' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
});
