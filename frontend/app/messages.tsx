import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { messageAPI, profileAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_avatar_color: string;
  partner_is_vip: boolean;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface UserResult {
  id: string;
  name: string;
  avatar_color: string;
  is_vip: boolean;
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'conversations' | 'chat' | 'search'>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<FlatList>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      // Check if we have a userId param to open chat directly
      if (params.userId) {
        openChat(params.userId as string);
      }
    }
  }, [isAuthenticated, params.userId]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const res = await messageAPI.getConversations();
      setConversations(res.data.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const openChat = async (userId: string) => {
    setActiveTab('chat');
    setIsLoading(true);
    try {
      // Get user info
      const profileRes = await profileAPI.getUserProfile(userId);
      setSelectedUser({
        id: profileRes.data.data.id,
        name: profileRes.data.data.name,
        avatar_color: profileRes.data.data.avatar_color,
        is_vip: profileRes.data.data.is_vip,
      });
      
      // Load messages
      const msgRes = await messageAPI.getMessages(userId);
      setMessages(msgRes.data.data || []);
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || sending) return;
    
    setSending(true);
    try {
      const res = await messageAPI.sendMessage(selectedUser.id, newMessage.trim());
      setMessages(prev => [...prev, res.data.data]);
      setNewMessage('');
      scrollRef.current?.scrollToEnd();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const res = await profileAPI.searchUsers(query, 20);
      // Filter out current user
      setSearchResults((res.data.data || []).filter((u: UserResult) => u.id !== user?.id));
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loginPrompt}>
            <Ionicons name="chatbubbles" size={64} color="#7C3AED" />
            <Text style={styles.loginTitle}>{t('messages.title')}</Text>
            <Text style={styles.loginText}>{t('messages.loginToChat')}</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
              <Text style={styles.loginBtnText}>{t('messages.login')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const renderConversations = () => (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.partner_id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor="#7C3AED" />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#5A5A6E" />
          <Text style={styles.emptyTitle}>{t('messages.noConversation')}</Text>
          <Text style={styles.emptyText}>{t('messages.typeToSearch')}</Text>
          <TouchableOpacity style={styles.startChatBtn} onPress={() => setActiveTab('search')}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
            <Text style={styles.startChatBtnText}>{t('messages.findUsers')}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity 
          style={styles.conversationCard}
          onPress={() => openChat(item.partner_id)}
          data-testid={`conversation-${item.partner_id}`}
        >
          <View style={[styles.avatar, { backgroundColor: item.partner_avatar_color }]}>
            <Text style={styles.avatarText}>{item.partner_name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.partnerName}>{item.partner_name}</Text>
                {item.partner_is_vip && (
                  <View style={styles.vipBadge}>
                    <Ionicons name="diamond" size={10} color="#FFD700" />
                  </View>
                )}
              </View>
              <Text style={styles.timeText}>{formatTime(item.last_message_time)}</Text>
            </View>
            <View style={styles.lastMessageRow}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message || t('messages.newConversation')}
              </Text>
              {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );

  const renderChat = () => (
    <KeyboardAvoidingView 
      style={styles.chatContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {selectedUser && (
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveTab('conversations')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.chatUserInfo}
            onPress={() => router.push(`/user/${selectedUser.id}`)}
          >
            <View style={[styles.avatar, { backgroundColor: selectedUser.avatar_color, width: 40, height: 40 }]}>
              <Text style={[styles.avatarText, { fontSize: 14 }]}>{selectedUser.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.chatUserName}>{selectedUser.name}</Text>
                {selectedUser.is_vip && <Ionicons name="diamond" size={12} color="#FFD700" />}
              </View>
              <Text style={styles.tapToView}>{t("messages.viewProfile")}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        ref={scrollRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color="#5A5A6E" />
            <Text style={styles.emptyChatText}>{t('messages.startConversation')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return (
            <View style={[styles.messageWrapper, isMine && styles.messageWrapperMine]}>
              <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
                <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{item.content}</Text>
                <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>{formatTime(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder={t('messages.writeMessage')}
          placeholderTextColor="#5A5A6E"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderSearch = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputWrapper}>
        <Ionicons name="search" size={20} color="#5A5A6E" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('messages.searchUser')}
          placeholderTextColor="#5A5A6E"
          value={searchQuery}
          onChangeText={searchUsers}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color="#5A5A6E" />
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          searchQuery.length >= 2 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>{t('messages.noResults')}</Text>
            </View>
          ) : (
            <View style={styles.searchHint}>
              <Ionicons name="people" size={48} color="#5A5A6E" />
              <Text style={styles.searchHintText}>{t('messages.typeToSearch')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.userResult}
            onPress={() => openChat(item.id)}
          >
            <View style={[styles.avatar, { backgroundColor: item.avatar_color }]}>
              <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.userResultInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userResultName}>{item.name}</Text>
                {item.is_vip && <Ionicons name="diamond" size={12} color="#FFD700" />}
              </View>
            </View>
            <Ionicons name="chatbubble-outline" size={20} color="#7C3AED" />
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('messages.title')}</Text>
          <TouchableOpacity 
            style={styles.newChatBtn}
            onPress={() => setActiveTab(activeTab === 'search' ? 'conversations' : 'search')}
          >
            <Ionicons name={activeTab === 'search' ? 'chatbubbles' : 'person-add'} size={22} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading && activeTab !== 'search' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : (
          <>
            {activeTab === 'conversations' && renderConversations()}
            {activeTab === 'chat' && renderChat()}
            {activeTab === 'search' && renderSearch()}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  safeArea: { flex: 1 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  headerBackBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  newChatBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  
  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // Login Prompt
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loginTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  loginText: { fontSize: 16, color: '#8B8B9E', textAlign: 'center', marginBottom: 24 },
  loginBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  loginBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  
  // Conversations
  conversationCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  conversationInfo: { flex: 1, marginLeft: 14 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partnerName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  vipBadge: { backgroundColor: 'rgba(255,215,0,0.2)', padding: 4, borderRadius: 6 },
  timeText: { fontSize: 12, color: '#5A5A6E' },
  lastMessageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  lastMessage: { flex: 1, fontSize: 14, color: '#8B8B9E' },
  unreadBadge: { backgroundColor: '#7C3AED', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  
  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#8B8B9E', textAlign: 'center', marginBottom: 24 },
  startChatBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, gap: 8 },
  startChatBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  
  // Chat
  chatContainer: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  backBtn: { padding: 8 },
  chatUserInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  chatUserName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  tapToView: { fontSize: 12, color: '#8B8B9E' },
  
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  messageWrapper: { marginBottom: 12, alignItems: 'flex-start' },
  messageWrapperMine: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  messageBubbleOther: { backgroundColor: '#1A1A2E', borderBottomLeftRadius: 4 },
  messageBubbleMine: { backgroundColor: '#7C3AED', borderBottomRightRadius: 4 },
  messageText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  messageTextMine: { color: '#FFFFFF' },
  messageTime: { fontSize: 11, color: '#5A5A6E', marginTop: 4, alignSelf: 'flex-end' },
  messageTimeMine: { color: 'rgba(255,255,255,0.7)' },
  
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: 16, color: '#5A5A6E', marginTop: 12 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#1A1A2E', backgroundColor: '#0A0A1A' },
  messageInput: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#FFFFFF', maxHeight: 100, marginRight: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#5A5A6E' },
  
  // Search
  searchContainer: { flex: 1 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', margin: 16, paddingHorizontal: 16, borderRadius: 14, gap: 10 },
  searchInput: { flex: 1, height: 48, fontSize: 16, color: '#FFFFFF' },
  
  userResult: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  userResultInfo: { flex: 1, marginLeft: 14 },
  userResultName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  
  noResults: { alignItems: 'center', padding: 32 },
  noResultsText: { fontSize: 16, color: '#8B8B9E' },
  searchHint: { alignItems: 'center', padding: 32, marginTop: 40 },
  searchHintText: { fontSize: 15, color: '#5A5A6E', marginTop: 12, textAlign: 'center' },
});
