import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView, useWindowDimensions, Pressable, Animated, TextInput } from 'react-native';
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

function SidebarContent({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();
  const { colors: c, mode, toggleTheme } = useThemeStore();
  const { selectConversation, selectedConversationId, newChat } = useAtlasNavStore();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;
  const [isVip, setIsVip] = useState(false);
  const [conversations, setConversations] = useState<ConvItem[]>([]);

  // Session tracking
  useEffect(() => {
    if (!token) return;
    let sessionId: string | null = null;
    const startSession = async () => {
      try {
        const resp = await fetch(`${API}/api/track/session?action=start`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        const d = await resp.json();
        sessionId = d.session_id || null;
      } catch (e) { /* silent */ }
    };
    const endSession = () => {
      if (!sessionId) return;
      try {
        navigator.sendBeacon?.(`${API}/api/track/session?action=end&session_id=${sessionId}`);
      } catch (e) { /* silent */ }
    };
    startSession();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', endSession);
      return () => { endSession(); window.removeEventListener('beforeunload', endSession); };
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setIsVip(!!d.is_vip)).catch(() => {});
    }
  }, [token]);

  const loadConvos = useCallback(() => {
    if (!token) return;
    fetch(`${API}/api/atlas/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setConversations(d.conversations || [])).catch(() => {});
  }, [token]);

  useEffect(() => { loadConvos(); }, [loadConvos]);
  useEffect(() => { const iv = setInterval(loadConvos, 30000); return () => clearInterval(iv); }, [loadConvos]);

  const handleSelectConv = (convId: string) => { selectConversation(convId); onNavigate('learn'); };
  const handleNewChat = () => { newChat(); onNavigate('learn'); };
  const isActive = (name: string) => pathname.includes(name) || (name === 'learn' && pathname === '/');

  // Conversation actions
  const [convMenu, setConvMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const deleteConv = async (convId: string) => {
    setConvMenu(null);
    try {
      await fetch(`${API}/api/atlas/conversations/${convId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (selectedConversationId === convId) { newChat(); }
    } catch (e) { console.error(e); }
  };

  const startRename = (conv: ConvItem) => {
    setConvMenu(null);
    setRenaming(conv.id);
    setRenameText(conv.title);
  };

  const submitRename = async () => {
    if (!renaming || !renameText.trim()) { setRenaming(null); return; }
    try {
      await fetch(`${API}/api/atlas/conversations/${renaming}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: renameText.trim() }),
      });
      setConversations(prev => prev.map(c => c.id === renaming ? { ...c, title: renameText.trim() } : c));
    } catch (e) { console.error(e); }
    setRenaming(null);
  };

  const convGroups = groupConversations(conversations);

  return (
    <>
      {/* Top */}
      <View style={st.sideTop}>
        <Text style={[st.logo, { color: c.text }]}>Mentova<Text style={{ color: c.primary }}>.</Text></Text>
      </View>

      {/* New Chat */}
      <TouchableOpacity style={[st.newChatBtn, { borderColor: c.primary + '40' }]} onPress={handleNewChat} testID="sidebar-new-chat-button">
        <Ionicons name="add-circle" size={20} color={c.primary} />
        <Text style={[st.newChatText, { color: c.primary }]}>{t('nav.newChat') || 'New Chat'}</Text>
      </TouchableOpacity>

      {/* Conversations - scrollable */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} onTouchStart={() => { if (convMenu) setConvMenu(null); }}>
        {convGroups.length > 0 && (
          <View style={st.convSection}>
            {convGroups.map((group) => (
              <View key={group.label}>
                <Text style={[st.convGroupLabel, { color: c.textMuted }]}>{group.label}</Text>
                {group.items.slice(0, 15).map((conv) => (
                  <View key={conv.id} style={[st.convItemWrap, selectedConversationId === conv.id && { backgroundColor: c.surfaceHover }, convMenu === conv.id && { zIndex: 200 }]}>
                    {renaming === conv.id ? (
                      <View style={st.renameRow}>
                        <TextInput
                          style={[st.renameInput, { color: c.text, borderColor: c.primary }]}
                          value={renameText}
                          onChangeText={setRenameText}
                          autoFocus
                          onSubmitEditing={submitRename}
                          onBlur={submitRename}
                          maxLength={200}
                          testID="rename-input"
                        />
                        <TouchableOpacity onPress={submitRename} testID="rename-confirm" style={{ padding: 8 }}>
                          <Ionicons name="checkmark" size={18} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Pressable style={st.convItem} onPress={() => handleSelectConv(conv.id)}>
                        <Ionicons name="chatbubble-outline" size={14} color={selectedConversationId === conv.id ? c.primary : c.textMuted} />
                        <Text style={[st.convTitle, { color: selectedConversationId === conv.id ? c.text : c.textSecondary }]} numberOfLines={1}>{conv.title}</Text>
                      </Pressable>
                    )}
                    {renaming !== conv.id && (
                      <Pressable
                        style={st.convMenuBtn}
                        onPress={() => setConvMenu(convMenu === conv.id ? null : conv.id)}
                        testID={`conv-menu-${conv.id}`}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={c.textMuted} />
                      </Pressable>
                    )}
                    {convMenu === conv.id && (
                      <View style={[st.convDropdown, { backgroundColor: c.surface, borderColor: c.borderSubtle }]}>
                        <Pressable style={st.convDropItem} onPress={() => { startRename(conv); }} testID={`conv-rename-${conv.id}`}>
                          <Ionicons name="pencil" size={14} color={c.text} />
                          <Text style={[st.convDropText, { color: c.text }]}>Rename</Text>
                        </Pressable>
                        <Pressable style={st.convDropItem} onPress={() => { deleteConv(conv.id); }} testID={`conv-delete-${conv.id}`}>
                          <Ionicons name="trash" size={14} color="#EF4444" />
                          <Text style={[st.convDropText, { color: '#EF4444' }]}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Nav */}
      <View style={[st.bottomNav, { borderTopColor: c.borderSubtle }]}>
        {NAV_ITEMS.map(nav => {
          const active = isActive(nav.name);
          return (
            <TouchableOpacity key={nav.name} style={[st.navItem, active && { backgroundColor: c.surfaceHover }]} onPress={() => onNavigate(nav.name)} testID={`sidebar-nav-${nav.name}`}>
              <Ionicons name={(active ? nav.icon : `${nav.icon}-outline`) as any} size={20} color={active ? c.primary : c.textMuted} />
              <Text style={[st.navLabel, { color: active ? c.text : c.textSecondary }, active && { fontWeight: '600' }]}>{t(nav.labelKey) || nav.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[st.navItem, { marginTop: 4 }]} onPress={() => { router.push(isVip ? '/vip/hub' : '/vip'); }} testID="sidebar-vip-button">
          <Ionicons name="diamond" size={20} color="#FFD700" />
          <Text style={[st.navLabel, { color: '#FFD700' }]}>{isVip ? 'VIP Hub' : 'VIP'}</Text>
        </TouchableOpacity>

        <View style={[st.userSection, { borderTopColor: c.borderSubtle }]}>
          <TouchableOpacity style={st.themeRow} onPress={toggleTheme} testID="theme-toggle">
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={c.textMuted} />
            <Text style={[st.themeLabel, { color: c.textMuted }]}>{mode === 'dark' ? 'Light' : 'Dark'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.userRow} onPress={() => onNavigate('profile')} testID="sidebar-user-profile">
            <View style={[st.userAvatar, { backgroundColor: c.surfaceHover, borderColor: isVip ? '#FFD700' : c.primary + '50' }]}>
              <Text style={[st.userInitial, { color: c.primary }]}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.userName, { color: c.text }]} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={[st.userPlan, { color: c.textMuted }]}>{isVip ? 'VIP' : 'Free'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

export default function TabLayout() {
  const { language, isLoaded } = useTranslation();
  const { colors: c, loadTheme } = useThemeStore();
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const sidebarAnim = React.useRef(new Animated.Value(260)).current;
  const router = useRouter();

  useEffect(() => { loadTheme(); }, []);

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: desktopCollapsed ? 0 : 260,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [desktopCollapsed]);

  const handleNavigate = (route: string) => {
    // In Expo Router, 'index' maps to '/' not '/index'
    const path = route === 'index' ? '/(tabs)/' : `/(tabs)/${route}`;
    router.push(path as any);
    if (isMobile) setSidebarOpen(false);
  };

  if (!isLoaded) {
    return <View style={[st.container, { backgroundColor: c.bg }]} />;
  }

  return (
    <View style={[st.container, { backgroundColor: c.bg }]}>
      {/* Desktop sidebar — animated width */}
      {!isMobile && (
        <Animated.View style={[st.sidebar, { width: sidebarAnim, backgroundColor: c.bgSecondary, borderRightColor: c.border, overflow: 'hidden' }]}>
          {!desktopCollapsed && <SidebarContent onNavigate={handleNavigate} />}
        </Animated.View>
      )}

      {/* Desktop collapse toggle */}
      {!isMobile && (
        <TouchableOpacity
          style={[st.collapseBtn, { backgroundColor: c.surface, borderColor: c.border, left: desktopCollapsed ? 4 : 248 }]}
          onPress={() => setDesktopCollapsed(!desktopCollapsed)}
          testID="sidebar-collapse-toggle"
        >
          <Ionicons name={desktopCollapsed ? 'chevron-forward' : 'chevron-back'} size={16} color={c.primary} />
        </TouchableOpacity>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Tabs
          key={`tabs-${language}`}
          tabBar={() => null}
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

      {/* Mobile hamburger — rendered LAST to be on top */}
      {isMobile && !sidebarOpen && (
        <TouchableOpacity
          style={[st.mobileHamburger, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => setSidebarOpen(true)}
          testID="sidebar-toggle"
        >
          <Ionicons name="menu" size={22} color={c.primary} />
        </TouchableOpacity>
      )}

      {/* Mobile overlay — rendered LAST with highest z-index */}
      {isMobile && sidebarOpen && (
        <>
          <Pressable style={st.mobileOverlay} onPress={() => setSidebarOpen(false)} testID="sidebar-overlay" />
          <View style={[st.mobileSidebar, { backgroundColor: c.bgSecondary, borderRightColor: c.border }]}>
            <TouchableOpacity style={[st.closeBtn, { backgroundColor: c.surfaceHover }]} onPress={() => setSidebarOpen(false)}>
              <Ionicons name="close" size={18} color={c.textMuted} />
            </TouchableOpacity>
            <SidebarContent onNavigate={handleNavigate} />
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  mobileHamburger: { position: 'absolute', top: Platform.OS === 'web' ? 12 : 50, left: 12, zIndex: 100, width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  mobileOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998 },
  mobileSidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, borderRightWidth: 1, paddingTop: Platform.OS === 'web' ? 16 : 50, zIndex: 999 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998 },
  sidebar: { borderRightWidth: 1, paddingTop: Platform.OS === 'web' ? 16 : 50, zIndex: 999 },
  closeBtn: { position: 'absolute', top: Platform.OS === 'web' ? 16 : 50, right: 12, width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  collapseBtn: { position: 'absolute', top: '50%', zIndex: 100, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginTop: -14 },
  sideTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 14, minHeight: 32 },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, marginBottom: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  newChatText: { fontSize: 13, fontWeight: '600' },
  convSection: { paddingHorizontal: 8, marginBottom: 4 },
  convGroupLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4, paddingVertical: 6, marginTop: 4 },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, marginBottom: 1, flex: 1 },
  convTitle: { fontSize: 13, flex: 1 },
  convItemWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, marginBottom: 1, position: 'relative' as const },
  convMenuBtn: { padding: 10, marginRight: 0, zIndex: 10 },
  convDropdown: { position: 'absolute' as const, right: 0, top: 40, borderRadius: 10, borderWidth: 1, zIndex: 200, minWidth: 150, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  convDropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  convDropText: { fontSize: 14, fontWeight: '500' },
  renameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6, paddingHorizontal: 8, paddingVertical: 4 },
  renameInput: { flex: 1, fontSize: 13, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  bottomNav: { borderTopWidth: 1, paddingTop: 8, paddingBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14, marginHorizontal: 6, marginBottom: 1, borderRadius: 10 },
  navLabel: { fontSize: 14, fontWeight: '500' },
  userSection: { borderTopWidth: 1, paddingTop: 6, marginTop: 4 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 14 },
  themeLabel: { fontSize: 13, fontWeight: '500' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 14 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  userInitial: { fontSize: 13, fontWeight: '700' },
  userName: { fontSize: 13, fontWeight: '600' },
  userPlan: { fontSize: 11 },
});
