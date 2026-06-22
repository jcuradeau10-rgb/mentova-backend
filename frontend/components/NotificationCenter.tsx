import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { vipAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTranslation } from '../store/languageStore';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_ICONS: Record<string, { icon: string; colors: string[] }> = {
  price_alert: { icon: 'trending-up', colors: ['#10B981', '#059669'] },
  story_reaction: { icon: 'heart', colors: ['#EC4899', '#DB2777'] },
  post_like: { icon: 'heart', colors: ['#EF4444', '#DC2626'] },
  post_comment: { icon: 'chatbubble', colors: ['#06B6D4', '#0891B2'] },
  achievement: { icon: 'trophy', colors: ['#F59E0B', '#D97706'] },
  vip_announcement: { icon: 'megaphone', colors: ['#8B5CF6', '#7C3AED'] },
  new_message: { icon: 'mail', colors: ['#3B82F6', '#2563EB'] },
  admin_report: { icon: 'flag', colors: ['#F97316', '#EA580C'] },
  post_report: { icon: 'flag', colors: ['#F97316', '#EA580C'] },
  new_booking: { icon: 'calendar', colors: ['#10B981', '#059669'] },
  booking_confirmed: { icon: 'checkmark-circle', colors: ['#10B981', '#059669'] },
  booking_cancelled: { icon: 'close-circle', colors: ['#EF4444', '#DC2626'] },
  booking_status: { icon: 'calendar', colors: ['#7C3AED', '#6D28D9'] },
  pro_approved: { icon: 'shield-checkmark', colors: ['#10B981', '#059669'] },
  pro_rejected: { icon: 'shield', colors: ['#EF4444', '#DC2626'] },
  new_sale: { icon: 'cash', colors: ['#10B981', '#059669'] },
  new_offer: { icon: 'storefront', colors: ['#7C3AED', '#6D28D9'] },
  follow: { icon: 'person-add', colors: ['#8B5CF6', '#7C3AED'] },
  default: { icon: 'notifications', colors: ['#6B7280', '#4B5563'] },
};

export default function NotificationCenter() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { onNotification } = useWebSocket();
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const res = await vipAPI.getNotificationHistory(50);
      setNotifications(res.data.data || []);
    } catch (error) {
      console.log('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      // Fallback poll every 60 seconds (WebSocket is primary)
      const interval = setInterval(loadNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadNotifications]);

  // Listen for real-time WebSocket notifications
  useEffect(() => {
    const unsubscribe = onNotification((notification) => {
      const newNotif: Notification = {
        id: notification.id || `ws-${Date.now()}`,
        title: notification.title || 'Notification',
        body: notification.body || '',
        type: notification.type,
        data: notification.data,
        is_read: false,
        created_at: notification.timestamp,
      };
      setNotifications(prev => [newNotif, ...prev]);
    });
    return unsubscribe;
  }, [onNotification]);

  const handleMarkAllRead = async () => {
    try {
      await vipAPI.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.log('Failed to mark all as read:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await vipAPI.markNotificationsRead([notificationId]);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.log('Failed to mark as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    setShowModal(false);
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'price_alert':
        router.push('/vip/hub');
        break;
      case 'story_reaction':
      case 'post_like':
      case 'post_comment':
        router.push('/(tabs)/community');
        break;
      case 'new_message':
        router.push('/messages');
        break;
      case 'achievement':
        router.push('/vip/hub');
        break;
      case 'admin_report':
      case 'post_report':
        router.push('/admin');
        break;
      case 'new_booking':
      case 'booking_status':
        router.push('/pro/dashboard');
        break;
      case 'booking_confirmed':
      case 'booking_cancelled':
        router.push('/bookings');
        break;
      case 'pro_approved':
        router.push('/pro/dashboard');
        break;
      case 'pro_rejected':
        router.push('/pro/apply');
        break;
      case 'feedback':
        router.push('/admin');
        break;
      case 'feedback_reply':
        router.push('/my-feedback');
        break;
      case 'new_offer':
        router.push('/marketplace');
        break;
      case 'follow':
        router.push('/profile');
        break;
      default:
        break;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return t('notifications.justNow');
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getNotificationConfig = (type: string) => {
    return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : filter === 'unread' 
      ? notifications.filter(n => !n.is_read)
      : notifications.filter(n => n.type === filter);

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Notification Bell Button */}
      <TouchableOpacity 
        style={styles.bellButton}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
        data-testid="notification-bell"
      >
        <View style={styles.bellIconContainer}>
          <Ionicons name="notifications" size={24} color="#FFFFFF" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Notification Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="notifications" size={24} color="#7C3AED" />
                <Text style={styles.modalTitle}>{t('notifications.title')}</Text>
                {unreadCount > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            </View>

            {/* Filters */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.filtersContainer}
              contentContainerStyle={styles.filtersContent}
            >
              {[
                { id: 'all', label: t('notifications.all'), icon: 'apps' },
                { id: 'unread', label: t('notifications.unread'), icon: 'mail-unread' },
                { id: 'new_message', label: 'Messages', icon: 'mail' },
                { id: 'price_alert', label: t('notifications.alerts'), icon: 'trending-up' },
                { id: 'post_comment', label: t('notifications.social'), icon: 'chatbubble' },
                { id: 'post_like', label: 'Likes', icon: 'heart' },
                { id: 'achievement', label: t('notifications.badges'), icon: 'trophy' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
                  onPress={() => setFilter(f.id)}
                >
                  <Ionicons 
                    name={f.icon as any} 
                    size={14} 
                    color={filter === f.id ? '#FFFFFF' : '#8B8B9E'} 
                  />
                  <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Mark All Read Button */}
            {unreadCount > 0 && (
              <TouchableOpacity 
                style={styles.markAllReadBtn}
                onPress={handleMarkAllRead}
              >
                <Ionicons name="checkmark-done" size={16} color="#7C3AED" />
                <Text style={styles.markAllReadText}>{t('notifications.markAllRead')}</Text>
              </TouchableOpacity>
            )}

            {/* Notifications List */}
            <ScrollView 
              style={styles.notificationsList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); loadNotifications(); }}
                  tintColor="#7C3AED"
                />
              }
            >
              {loading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                </View>
              ) : filteredNotifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off-outline" size={48} color="#5A5A6E" />
                  <Text style={styles.emptyTitle}>{t('notifications.none')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {filter === 'unread' 
                      ? t('notifications.allRead')
                      : t('notifications.noNotifications')}
                  </Text>
                </View>
              ) : (
                filteredNotifications.map((notification) => {
                  const config = getNotificationConfig(notification.type);
                  return (
                    <TouchableOpacity
                      key={notification.id}
                      style={[
                        styles.notificationItem,
                        !notification.is_read && styles.notificationItemUnread
                      ]}
                      onPress={() => handleNotificationPress(notification)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={config.colors}
                        style={styles.notificationIcon}
                      >
                        <Ionicons name={config.icon as any} size={18} color="#FFFFFF" />
                      </LinearGradient>
                      
                      <View style={styles.notificationContent}>
                        <Text style={styles.notificationTitle} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text style={styles.notificationBody} numberOfLines={2}>
                          {notification.body}
                        </Text>
                        <Text style={styles.notificationTime}>
                          {formatTimeAgo(notification.created_at)}
                        </Text>
                      </View>

                      {!notification.is_read && (
                        <View style={styles.unreadDot} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Bell Button
  bellButton: {
    padding: 8,
  },
  bellIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0A0A1A',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filters
  filtersContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1A1A2E',
    marginRight: 8,
    gap: 6,
  },
  filterBtnActive: {
    backgroundColor: '#7C3AED',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B8B9E',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },

  // Mark All Read
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 10,
  },
  markAllReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },

  // Notifications List
  notificationsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#5A5A6E',
    marginTop: 4,
    textAlign: 'center',
  },

  // Notification Item
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginVertical: 4,
    borderRadius: 14,
    backgroundColor: '#1A1A2E',
  },
  notificationItemUnread: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notificationBody: {
    fontSize: 13,
    color: '#8B8B9E',
    marginTop: 2,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: '#5A5A6E',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
    marginLeft: 8,
  },
});
