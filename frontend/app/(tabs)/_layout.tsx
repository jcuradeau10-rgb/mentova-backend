import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView, useWindowDimensions, Pressable } from 'react-native';
import { useTranslation } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useAtlasNavStore } from '../../store/atlasNavStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const BREAKPOINT = 768;

const NAV_ITEMS = [
  { name: 'index', icon: 'home', label: 'Home', labelKey: 'nav.home' },
  { name: 'market', icon: 'trending-up', label: 'Market', labelKey: 'nav.market' },
  { name: 'news', icon: 'newspaper', label: 'News', labelKey: 'nav.news' },
  { name: 'profile', icon: 'person', label: 'Profile', labelKey: 'nav.profile' },
];

interface ConvItem { id: string; title: string; updated_at: string; message_count: number; }

function groupConversations(convos: ConvItem[]): { label: string; items: ConvItem[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, ConvItem[]> = { today: [], yesterday: [], week: [], older: [] };
  for (const c of convos) {
    const d = new Date(c.updated_at);
    if (d >= today) groups.today.push(c);
    else if (d >= yesterday) groups.yesterday.push(c);
    else if (d >= last7) groups.week.push(c);
    else groups.older.push(c);
  }
  const result: { label: string; items: ConvItem[] }[] = [];
  if (groups.today.length) result.push({ label: 'Today', items: groups.today });
  if (groups.yesterday.length) result.push({ label: 'Yesterday', items: groups.yesterday });
  if (groups.week.length) result.push({ label: 'Last 7 days', items: groups.week });
  if (groups.older.length) result.push({ label: 'Older', items: groups.older });
  return result;
}

function Sidebar({ state, navigation }: any) {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();
  const { colors: c, mode, toggleTheme } = useThemeStore();
  const { selectConversation, selectedConversationId, newChat } = useAtlasNavStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(!isMobile);
  const [isVip, setIsVip] = useState(false);
  const [conversations, setConversations] = useState<ConvItem[]>([]);

  useEffect(() => {
    if (token) {
      fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setIsVip(!!d.is_vip)).catch(() => {});
    }
  }, [token]);

  // Fetch conversations
  const loadConvos = useCallback(() => {
    if (!token) return;
    fetch(`${API}/api/atlas/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setConversations(d.conversations || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => { loadConvos(); }, [loadConvos]);
  // Refresh every 30s
  useEffect(() => {
    const iv = setInterval(loadConvos, 30000);
    return () => clearInterval(iv);
  }, [loadConvos]);

  const activeIndex = state.index;
  const showLabels = isMobile || expanded;

  const handleNav = (routeName: string) => {
    navigation.navigate(routeName);
    if (isMobile) setOpen(false);
  };

  const handleSelectConv = (convId: string) => {
    selectConversation(convId);
    navigation.navigate('learn');
    if (isMobile) setOpen(false);
  };

  const handleNewChat = () => {
    newChat();
    navigation.navigate('learn');
    if (isMobile) setOpen(false);
  };

  // Mobile: hamburger
  if (isMobile && !open) {
    return (
      <TouchableOpacity
        style={[st.mobileHamburger, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={() => setOpen(true)}
        testID="sidebar-toggle"
      >
        <Ionicons name="menu" size={22} color={c.primary} />
      </TouchableOpacity>
    );
  }

  const sidebarWidth = isMobile ? 280 : (expanded ? 260 : 56);
  const convGroups = groupConversations(conversations);

  const sidebarContent = (
    <View style={[st.sidebar, { width: sidebarWidth, backgroundColor: c.bgSecondary, borderRightColor: c.border }]} testID="sidebar-panel">
      {/* Top */}
      <View style={st.sideTop}>
        {showLabels && <Text style={[st.logo, { color: c.text }]}>Mentova<Text style={{ color: c.primary }}>.</Text></Text>}
        <TouchableOpacity
          style={[st.toggleBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => isMobile ? setOpen(false) : setExpanded(!expanded)}
          testID="sidebar-close"
        >
          <Ionicons name={isMobile ? 'close' : (expanded ? 'chevron-back' : 'menu')} size={18} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      {/* New Chat */}
      <TouchableOpacity style={[st.newChatBtn, { borderColor: c.primary + '40' }]} onPress={handleNewChat} testID="sidebar-new-chat-button">
        <Ionicons name="add-circle" size={20} color={c.primary} />
        {showLabels && <Text style={[st.newChatText, { color: c.primary }]}>{t('nav.newChat') || 'New Chat'}</Text>}
      </TouchableOpacity>

      {/* Middle: scrollable conversations */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {showLabels && convGroups.length > 0 && (
          <View style={st.convSection}>
            {convGroups.map((group) => (
              <View key={group.label}>
                <Text style={[st.convGroupLabel, { color: c.textMuted }]}>{group.label}</Text>
                {group.items.slice(0, 15).map((conv) => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[st.convItem, selectedConversationId === conv.id && { backgroundColor: c.surfaceHover }]}
                    onPress={() => handleSelectConv(conv.id)}
                    testID={`sidebar-conv-${conv.id}`}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={selectedConversationId === conv.id ? c.primary : c.textMuted} />
                    <Text style={[st.convTitle, { color: selectedConversationId === conv.id ? c.text : c.textSecondary }]} numberOfLines={1}>{conv.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}
        {!showLabels && (
          <TouchableOpacity
            style={[st.navItem, activeIndex === 0 && { backgroundColor: c.surfaceHover }]}
            onPress={() => handleNav('learn')}
            testID="sidebar-nav-learn"
          >
            <Ionicons name={activeIndex === 0 ? 'planet' : 'planet-outline'} size={20} color={activeIndex === 0 ? c.primary : c.textMuted} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Bottom: Nav + VIP + Theme + User — always visible */}
      <View style={[st.bottomNav, { borderTopColor: c.borderSubtle }]}>
        {state.routes.map((route: any, i: number) => {
          const nav = NAV_ITEMS.find(n => n.name === route.name);
          if (!nav) return null;
          const active = activeIndex === i;
          return (
            <TouchableOpacity key={route.key} style={[st.navItem, active && { backgroundColor: c.surfaceHover }]} onPress={() => handleNav(route.name)} testID={`sidebar-nav-${nav.name}`}>
              <Ionicons name={(active ? nav.icon : `${nav.icon}-outline`) as any} size={20} color={active ? c.primary : c.textMuted} />
              {showLabels && <Text style={[st.navLabel, { color: active ? c.text : c.textSecondary }, active && { fontWeight: '600' }]}>{t(nav.labelKey) || nav.label}</Text>}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={[st.navItem, { marginTop: 4 }]} onPress={() => { router.push(isVip ? '/vip/hub' : '/vip'); if (isMobile) setOpen(false); }} testID="sidebar-vip-button">
          <Ionicons name="diamond" size={20} color="#FFD700" />
          {showLabels && <Text style={[st.navLabel, { color: '#FFD700' }]}>{isVip ? 'VIP Hub' : 'VIP'}</Text>}
        </TouchableOpacity>

        <View style={[st.userSection, { borderTopColor: c.borderSubtle }]}>
          <TouchableOpacity style={st.themeRow} onPress={toggleTheme} testID="theme-toggle">
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={c.textMuted} />
            {showLabels && <Text style={[st.themeLabel, { color: c.textMuted }]}>{mode === 'dark' ? 'Light' : 'Dark'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={st.userRow} onPress={() => handleNav('profile')} testID="sidebar-user-profile">
            <View style={[st.userAvatar, { backgroundColor: c.surfaceHover, borderColor: isVip ? '#FFD700' : c.primary + '50' }]}>
              <Text style={[st.userInitial, { color: c.primary }]}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</Text>
            </View>
            {showLabels && (
              <View style={{ flex: 1 }}>
                <Text style={[st.userName, { color: c.text }]} numberOfLines={1}>{user?.name || 'User'}</Text>
                <Text style={[st.userPlan, { color: c.textMuted }]}>{isVip ? 'VIP' : 'Free'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isMobile) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={st.overlay} onPress={() => setOpen(false)} testID="sidebar-overlay" />
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
    return <View style={[st.container, { backgroundColor: c.bg }]}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', opacity: 0.5 }} /></View></View>;
  }

  return (
    <View style={[st.container, { backgroundColor: c.bg }]}>
      <Tabs key={`tabs-${language}`} tabBar={(props) => <Sidebar {...props} />} screenOptions={{ headerShown: false }}>
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

const st = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  mobileHamburger: { position: 'absolute', top: Platform.OS === 'web' ? 12 : 50, left: 12, zIndex: 100, width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998 },
  sidebar: { borderRightWidth: 1, paddingTop: Platform.OS === 'web' ? 16 : 50, zIndex: 999, flex: 1 },
  sideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 12, minHeight: 32 },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  toggleBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 8, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  newChatText: { fontSize: 13, fontWeight: '600' },

  // Conversations
  convSection: { paddingHorizontal: 8, marginBottom: 4 },
  convGroupLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4, paddingVertical: 6, marginTop: 4 },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, marginBottom: 1 },
  convTitle: { fontSize: 13, fontWeight: '400', flex: 1 },
  separator: { borderBottomWidth: 1, marginHorizontal: 8, marginVertical: 8 },

  bottomNav: { borderTopWidth: 1, paddingTop: 8, paddingBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, marginHorizontal: 6, marginBottom: 1, borderRadius: 10 },
  navLabel: { fontSize: 14, fontWeight: '500' },
  userSection: { borderTopWidth: 1, paddingTop: 6, marginTop: 4 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 12 },
  themeLabel: { fontSize: 13, fontWeight: '500' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 12 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  userInitial: { fontSize: 13, fontWeight: '700' },
  userName: { fontSize: 13, fontWeight: '600' },
  userPlan: { fontSize: 11 },
});
