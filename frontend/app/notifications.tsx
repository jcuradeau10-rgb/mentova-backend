import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://mentova-api.onrender.com';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  is_read?: boolean;
  read?: boolean;
  created_at: string;
}

const typeIcons: Record<string, { icon: string; color: string }> = {
  new_message: { icon: 'chatbubble', color: '#3B82F6' },
  community_like: { icon: 'heart', color: '#EF4444' },
  community_comment: { icon: 'chatbubble-ellipses', color: '#10B981' },
  admin_report: { icon: 'flag', color: '#F59E0B' },
  vip_activated: { icon: 'diamond', color: '#B8860B' },
  price_alert: { icon: 'trending-up', color: '#8B5CF6' },
  story_reaction: { icon: 'star', color: '#F59E0B' },
  default: { icon: 'notifications', color: '#7C3AED' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'maintenant';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { language } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const headers: any = { 'Authorization': `Bearer ${token}` };
      // Try both endpoints
      let res = await fetch(`${API}/api/notifications`, { headers });
      let data = await res.json();
      if (data.success && data.data) {
        setNotifications(data.data);
      } else {
        res = await fetch(`${API}/api/notifications/history?limit=50`, { headers });
        data = await res.json();
        setNotifications(data.data || data.notifications || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch(`${API}/api/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ notification_ids: notifications.filter(n => !(n.is_read || n.read)).map(n => n.id) }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read: true })));
    } catch {}
  };

  const handleNotifPress = (notif: Notification) => {
    if (notif.type === 'new_message' && notif.data?.sender_id) {
      router.push('/messages');
    } else if (notif.type === 'community_like' || notif.type === 'community_comment') {
      router.push('/(tabs)/community');
    } else if (notif.type === 'admin_report') {
      router.push('/admin');
    }
  };

  const emptyLabel = language === 'fr' ? 'Aucune notification' : language === 'es' ? 'Sin notificaciones' : 'No notifications';
  const titleLabel = language === 'fr' ? 'Notifications' : 'Notifications';
  const readAllLabel = language === 'fr' ? 'Tout lire' : 'Read all';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{titleLabel}</Text>
        {notifications.some(n => !(n.is_read || n.read)) && (
          <TouchableOpacity onPress={markAllRead} style={s.readAllBtn}>
            <Text style={s.readAllText}>{readAllLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={48} color="#333" />
              <Text style={s.emptyText}>{emptyLabel}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = !(item.is_read || item.read);
            const ti = typeIcons[item.type] || typeIcons.default;
            return (
              <TouchableOpacity style={[s.notifItem, isUnread && s.notifUnread]} onPress={() => handleNotifPress(item)}>
                <View style={[s.notifIcon, { backgroundColor: ti.color + '20' }]}>
                  <Ionicons name={ti.icon as any} size={18} color={ti.color} />
                </View>
                <View style={s.notifContent}>
                  <Text style={s.notifTitle}>{item.title}</Text>
                  <Text style={s.notifBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={s.notifTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {isUnread && <View style={s.notifDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#06060F' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', flex: 1 },
  readAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(124,58,237,0.1)' },
  readAllText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#666' },
  notifItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 12 },
  notifUnread: { backgroundColor: 'rgba(124,58,237,0.04)' },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  notifBody: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  notifTime: { fontSize: 11, color: '#555', marginTop: 4 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
});
