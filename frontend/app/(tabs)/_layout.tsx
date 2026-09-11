import React, { useState, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView, useWindowDimensions, Pressable } from 'react-native';
import { useTranslation } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const BREAKPOINT = 768;

const NAV_ITEMS = [
  { name: 'learn', icon: 'planet', label: 'Atlas AI', labelKey: 'nav.atlas' },
  { name: 'index', icon: 'home', label: 'Home', labelKey: 'nav.home' },
  { name: 'market', icon: 'trending-up', label: 'Market', labelKey: 'nav.market' },
  { name: 'news', icon: 'newspaper', label: 'News', labelKey: 'nav.news' },
  { name: 'profile', icon: 'person', label: 'Profile', labelKey: 'nav.profile' },
];

function Sidebar({ state, navigation }: any) {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();
  const { colors: c, mode, toggleTheme } = useThemeStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(!isMobile);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    if (token) {
      const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setIsVip(!!d.is_vip)).catch(() => {});
    }
  }, [token]);

  // On mobile: closed by default, opens as overlay
  // On desktop: always visible, collapsible
  const activeIndex = state.index;

  const handleNav = (routeName: string) => {
    navigation.navigate(routeName);
    if (isMobile) setOpen(false);
  };

  // Mobile: hamburger icon floats on top of content
  if (isMobile && !open) {
    return (
      <TouchableOpacity
        style={[styles.mobileHamburger, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={() => setOpen(true)}
        testID="sidebar-toggle"
      >
        <Ionicons name="menu" size={22} color={c.primary} />
      </TouchableOpacity>
    );
  }

  const sidebarWidth = isMobile ? 260 : (expanded ? 240 : 56);

  const sidebarContent = (
    <View style={[styles.sidebar, { width: sidebarWidth, backgroundColor: c.bgSecondary, borderRightColor: c.border }]} testID="sidebar-panel">
      {/* Top */}
      <View style={styles.sideTop}>
        {(isMobile || expanded) && <Text style={[styles.logo, { color: c.text }]}>Mentova<Text style={{ color: c.primary }}>.</Text></Text>}
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => isMobile ? setOpen(false) : setExpanded(!expanded)}
          testID="sidebar-close"
        >
          <Ionicons name={isMobile ? 'close' : (expanded ? 'chevron-back' : 'menu')} size={18} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      {/* New Chat */}
      <TouchableOpacity
        style={[styles.newChatBtn, { borderColor: c.primary + '40' }]}
        onPress={() => handleNav('learn')}
        testID="sidebar-new-chat-button"
      >
        <Ionicons name="add-circle" size={20} color={c.primary} />
        {(isMobile || expanded) && <Text style={[styles.newChatText, { color: c.primary }]}>{t('nav.newChat') || 'New Chat'}</Text>}
      </TouchableOpacity>

      {/* Nav */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {state.routes.map((route: any, i: number) => {
          const nav = NAV_ITEMS.find(n => n.name === route.name);
          if (!nav) return null;
          const active = activeIndex === i;
          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.navItem, active && { backgroundColor: c.surfaceHover }]}
              onPress={() => handleNav(route.name)}
              testID={`sidebar-nav-${nav.name}`}
            >
              <Ionicons name={(active ? nav.icon : `${nav.icon}-outline`) as any} size={20} color={active ? c.primary : c.textMuted} />
              {(isMobile || expanded) && (
                <Text style={[styles.navLabel, { color: active ? c.text : c.textSecondary }, active && { fontWeight: '600' }]}>
                  {t(nav.labelKey) || nav.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* VIP */}
        <TouchableOpacity
          style={[styles.navItem, styles.vipItem, { borderTopColor: c.borderSubtle }]}
          onPress={() => { router.push(isVip ? '/vip/hub' : '/vip'); if (isMobile) setOpen(false); }}
          testID="sidebar-vip-button"
        >
          <Ionicons name="diamond" size={20} color="#FFD700" />
          {(isMobile || expanded) && <Text style={[styles.navLabel, { color: '#FFD700' }]}>{isVip ? 'VIP Hub' : 'VIP'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom: Theme + User */}
      <View style={[styles.sideBottom, { borderTopColor: c.borderSubtle }]}>
        {/* Theme Toggle */}
        <TouchableOpacity style={styles.themeRow} onPress={toggleTheme} testID="theme-toggle">
          <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={c.textMuted} />
          {(isMobile || expanded) && <Text style={[styles.themeLabel, { color: c.textMuted }]}>{mode === 'dark' ? 'Light' : 'Dark'}</Text>}
        </TouchableOpacity>

        {/* User */}
        <TouchableOpacity style={styles.userRow} onPress={() => handleNav('profile')} testID="sidebar-user-profile">
          <View style={[styles.userAvatar, { backgroundColor: c.surfaceHover, borderColor: isVip ? '#FFD700' : c.primary + '50' }]}>
            <Text style={[styles.userInitial, { color: c.primary }]}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</Text>
          </View>
          {(isMobile || expanded) && (
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={[styles.userPlan, { color: c.textMuted }]}>{isVip ? 'VIP' : 'Free'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Mobile: overlay with backdrop
  if (isMobile) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} testID="sidebar-overlay" />
        {sidebarContent}
      </View>
    );
  }

  return sidebarContent;
}

export default function TabLayout() {
  const { language, isLoaded } = useTranslation();
  const { colors: c, loadTheme } = useThemeStore();

  useEffect(() => { loadTheme(); }, []);

  if (!isLoaded) {
    return <View style={[styles.container, { backgroundColor: c.bg }]}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', opacity: 0.5 }} /></View></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },

  // Mobile hamburger button
  mobileHamburger: { position: 'absolute', top: Platform.OS === 'web' ? 12 : 50, left: 12, zIndex: 100, width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },

  // Overlay backdrop
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998 },

  // Sidebar
  sidebar: { borderRightWidth: 1, paddingTop: Platform.OS === 'web' ? 16 : 50, paddingBottom: 12, justifyContent: 'flex-start', zIndex: 999 },
  sideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 16, minHeight: 32 },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  toggleBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 8, marginBottom: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  newChatText: { fontSize: 13, fontWeight: '600' },

  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 6, marginBottom: 2, borderRadius: 10 },
  navLabel: { fontSize: 14, fontWeight: '500' },
  vipItem: { marginTop: 12, borderTopWidth: 1, paddingTop: 16 },

  sideBottom: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 8 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  themeLabel: { fontSize: 13, fontWeight: '500' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  userInitial: { fontSize: 13, fontWeight: '700' },
  userName: { fontSize: 13, fontWeight: '600' },
  userPlan: { fontSize: 11 },
});
