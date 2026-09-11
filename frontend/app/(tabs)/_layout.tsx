import React, { useState, useEffect } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useTranslation } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_W } = Dimensions.get('window');
const IS_WIDE = SCREEN_W > 768;

const NAV_ITEMS = [
  { name: 'learn', icon: 'planet', label: 'Atlas AI', labelKey: 'nav.atlas' },
  { name: 'index', icon: 'home', label: 'Home', labelKey: 'nav.home' },
  { name: 'market', icon: 'trending-up', label: 'Market', labelKey: 'nav.market' },
  { name: 'news', icon: 'newspaper', label: 'News', labelKey: 'nav.news' },
  { name: 'profile', icon: 'person', label: 'Profile', labelKey: 'nav.profile' },
];

function Sidebar({ state, descriptors, navigation }: any) {
  const { t, language } = useTranslation();
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(!IS_WIDE);
  const [isVip, setIsVip] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (token) {
      const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setIsVip(!!d.is_vip)).catch(() => {});
    }
  }, [token]);

  const activeIndex = state.index;
  const w = collapsed ? 56 : 240;

  return (
    <View style={[s.sidebar, { width: w }]}>
      {/* Top: Logo + Toggle */}
      <View style={s.sideTop}>
        {!collapsed && <Text style={s.logo}>Mentova<Text style={s.logoDot}>.</Text></Text>}
        <TouchableOpacity style={s.toggleBtn} onPress={() => setCollapsed(!collapsed)} testID="sidebar-toggle">
          <Ionicons name={collapsed ? 'menu' : 'close'} size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* New Chat */}
      <TouchableOpacity
        style={s.newChatBtn}
        onPress={() => { navigation.navigate('learn'); }}
        testID="sidebar-new-chat-button"
      >
        <Ionicons name="add-circle" size={20} color="#7C3AED" />
        {!collapsed && <Text style={s.newChatText}>{t('nav.newChat') || 'New Chat'}</Text>}
      </TouchableOpacity>

      {/* Nav Items */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {state.routes.map((route: any, i: number) => {
          const navItem = NAV_ITEMS.find(n => n.name === route.name);
          if (!navItem) return null;
          const isActive = activeIndex === i;
          return (
            <TouchableOpacity
              key={route.key}
              style={[s.navItem, isActive && s.navItemActive]}
              onPress={() => navigation.navigate(route.name)}
              testID={`sidebar-nav-${navItem.name}`}
            >
              <Ionicons
                name={(isActive ? navItem.icon : `${navItem.icon}-outline`) as any}
                size={20}
                color={isActive ? '#7C3AED' : '#64748B'}
              />
              {!collapsed && (
                <Text style={[s.navLabel, isActive && s.navLabelActive]}>
                  {t(navItem.labelKey) || navItem.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* VIP */}
        <TouchableOpacity
          style={[s.navItem, s.vipItem]}
          onPress={() => router.push(isVip ? '/vip/hub' : '/vip')}
          testID="sidebar-vip-button"
        >
          <Ionicons name="diamond" size={20} color="#FFD700" />
          {!collapsed && (
            <Text style={[s.navLabel, { color: '#FFD700' }]}>
              {isVip ? 'VIP Hub' : 'VIP'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom: User */}
      <View style={s.sideBottom}>
        <TouchableOpacity style={s.userRow} onPress={() => navigation.navigate('profile')} testID="sidebar-user-profile">
          <View style={[s.userAvatar, isVip && { borderColor: '#FFD700' }]}>
            <Text style={s.userInitial}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</Text>
          </View>
          {!collapsed && (
            <View style={{ flex: 1 }}>
              <Text style={s.userName} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={s.userPlan}>{isVip ? 'VIP' : 'Free'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { language, isLoaded } = useTranslation();

  if (!isLoaded) {
    return <View style={s.container}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', opacity: 0.5 }} /></View></View>;
  }

  return (
    <View style={s.container}>
      <Tabs
        key={`tabs-${language}`}
        tabBar={(props) => <Sidebar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="learn" options={{ title: 'Atlas' }} />
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="market" options={{ title: 'Market' }} />
        <Tabs.Screen name="news" options={{ title: 'News' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="ai" options={{ href: null }} />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="mentors" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06060F', flexDirection: 'row' },

  sidebar: { backgroundColor: '#0A0A1A', borderRightWidth: 1, borderRightColor: 'rgba(124,58,237,0.12)', paddingTop: Platform.OS === 'web' ? 16 : 50, paddingBottom: 12, justifyContent: 'flex-start' },
  sideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 16, minHeight: 32 },
  logo: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
  logoDot: { color: '#7C3AED' },
  toggleBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(124,58,237,0.08)', justifyContent: 'center', alignItems: 'center' },

  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 8, marginBottom: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', borderStyle: 'dashed' },
  newChatText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },

  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 6, marginBottom: 2, borderRadius: 10 },
  navItemActive: { backgroundColor: 'rgba(124,58,237,0.1)' },
  navLabel: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  navLabelActive: { color: '#F8FAFC', fontWeight: '600' },
  vipItem: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 16 },

  sideBottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 10, paddingHorizontal: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)' },
  userInitial: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  userName: { fontSize: 13, fontWeight: '600', color: '#F8FAFC' },
  userPlan: { fontSize: 11, color: '#64748B' },
});
