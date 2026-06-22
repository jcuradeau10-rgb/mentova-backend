import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { profileAPI, communityAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  bio: string;
  avatar_color: string;
  favorite_crypto: string;
  trading_experience: string;
  is_public: boolean;
  is_vip: boolean;
  role: string;
  posts_count: number;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
  joined_at: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  likes: number;
  comments_count: number;
  created_at: string;
}

const AVATAR_COLORS = [
  '#7C3AED', '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
];

const EXPERIENCE_LEVELS = [
  { value: 'débutant', label: 'Débutant' },
  { value: 'intermédiaire', label: 'Intermédiaire' },
  { value: 'avancé', label: 'Avancé' },
  { value: 'expert', label: 'Expert' },
];

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.id as string;
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    avatar_color: '',
    favorite_crypto: '',
    trading_experience: '',
    is_public: true,
  });
  const [saving, setSaving] = useState(false);

  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const res = isOwnProfile 
        ? await profileAPI.getMyProfile()
        : await profileAPI.getUserProfile(userId);
      
      setProfile(res.data.data);
      setEditForm({
        name: res.data.data.name || '',
        bio: res.data.data.bio || '',
        avatar_color: res.data.data.avatar_color || '#7C3AED',
        favorite_crypto: res.data.data.favorite_crypto || '',
        trading_experience: res.data.data.trading_experience || 'débutant',
        is_public: res.data.data.is_public !== false,
      });
      
      // Load user's posts
      if (res.data.data.is_public || isOwnProfile) {
        try {
          const postsRes = await communityAPI.getPosts({ limit: 10 });
          const userPosts = (postsRes.data.data || []).filter(
            (p: any) => p.author_id === (isOwnProfile ? currentUser?.id : userId)
          );
          setPosts(userPosts);
        } catch (e) {
          console.error('Error loading posts:', e);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('vip.hub.alert.error'), t('userProfile.errorLoading'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async () => {
    if (!profile || followLoading) return;
    
    setFollowLoading(true);
    try {
      const res = await profileAPI.followUser(profile.id);
      setProfile(prev => prev ? {
        ...prev,
        is_following: res.data.action === 'followed',
        followers_count: prev.followers_count + (res.data.action === 'followed' ? 1 : -1)
      } : null);
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await profileAPI.updateMyProfile(editForm);
      setProfile(prev => prev ? { ...prev, ...editForm } : null);
      setShowEditModal(false);
      Alert.alert(t('vip.hub.alert.success'), t('userProfile.profileUpdated'));
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t('vip.hub.alert.error'), t('userProfile.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  const loadFollowers = async () => {
    if (!profile) return;
    try {
      const res = await profileAPI.getFollowers(profile.id);
      setFollowers(res.data.data || []);
      setShowFollowersModal(true);
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const loadFollowing = async () => {
    if (!profile) return;
    try {
      const res = await profileAPI.getFollowing(profile.id);
      setFollowing(res.data.data || []);
      setShowFollowingModal(true);
    } catch (error) {
      console.error('Error loading following:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loginPrompt}>
            <Ionicons name="person" size={64} color="#7C3AED" />
            <Text style={styles.loginTitle}>{t('userProfile.profile')}</Text>
            <Text style={styles.loginText}>{t('userProfile.loginToSee')}</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
              <Text style={styles.loginBtnText}>{t('common.login')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
            <Text style={styles.errorText}>{t('userProfile.profileNotFound')}</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>{t('userProfile.back')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isOwnProfile ? t('userProfile.myProfile') : t('userProfile.profile')}</Text>
          {isOwnProfile ? (
            <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.headerBtn}>
              <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => router.push(`/messages?userId=${profile.id}`)} 
              style={styles.headerBtn}
            >
              <Ionicons name="chatbubble-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} tintColor="#7C3AED" />}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: profile.avatar_color }]}>
              <Text style={styles.avatarText}>{profile.name.slice(0, 2).toUpperCase()}</Text>
              {profile.is_vip && (
                <View style={styles.vipBadgeAvatar}>
                  <Ionicons name="diamond" size={14} color="#FFD700" />
                </View>
              )}
            </View>
            
            <Text style={styles.profileName}>{profile.name}</Text>
            
            <View style={styles.roleRow}>
              {profile.is_vip && (
                <View style={styles.vipTag}>
                  <Ionicons name="diamond" size={12} color="#FFD700" />
                  <Text style={styles.vipTagText}>VIP</Text>
                </View>
              )}
              {profile.role !== 'user' && (
                <View style={[styles.roleTag, profile.role === 'super_admin' ? styles.superAdminTag : styles.adminTag]}>
                  <Text style={styles.roleTagText}>{profile.role === 'super_admin' ? t('admin.role.superAdmin') : t('admin.role.admin')}</Text>
                </View>
              )}
            </View>

            {profile.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : isOwnProfile ? (
              <TouchableOpacity onPress={() => setShowEditModal(true)}>
                <Text style={styles.addBio}>{t('userProfile.addBio')}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Stats */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={loadFollowers}>
                <Text style={styles.statValue}>{profile.followers_count}</Text>
                <Text style={styles.statLabel}>{t('userProfile.followers')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem} onPress={loadFollowing}>
                <Text style={styles.statValue}>{profile.following_count}</Text>
                <Text style={styles.statLabel}>{t('userProfile.following')}</Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.posts_count}</Text>
                <Text style={styles.statLabel}>{t('userProfile.posts')}</Text>
              </View>
            </View>

            {/* Follow Button */}
            {!isOwnProfile && (
              <TouchableOpacity
                style={[styles.followBtn, profile.is_following && styles.followBtnActive]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={profile.is_following ? '#7C3AED' : '#FFFFFF'} />
                ) : (
                  <>
                    <Ionicons 
                      name={profile.is_following ? 'checkmark' : 'person-add'} 
                      size={18} 
                      color={profile.is_following ? '#7C3AED' : '#FFFFFF'} 
                    />
                    <Text style={[styles.followBtnText, profile.is_following && styles.followBtnTextActive]}>
                      {profile.is_following ? t('userProfile.subscribed') : t('userProfile.subscribe')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Info Cards */}
          <View style={styles.infoSection}>
            {profile.favorite_crypto && (
              <View style={styles.infoCard}>
                <Ionicons name="heart" size={20} color="#EC4899" />
                <Text style={styles.infoLabel}>{t('userProfile.favoriteCrypto')}</Text>
                <Text style={styles.infoValue}>{profile.favorite_crypto}</Text>
              </View>
            )}
            <View style={styles.infoCard}>
              <Ionicons name="school" size={20} color="#3B82F6" />
              <Text style={styles.infoLabel}>{t('userProfile.experience')}</Text>
              <Text style={styles.infoValue}>{EXPERIENCE_LEVELS.find(e => e.value === profile.trading_experience)?.label || profile.trading_experience}</Text>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="calendar" size={20} color="#10B981" />
              <Text style={styles.infoLabel}>{t('userProfile.memberSince')}</Text>
              <Text style={styles.infoValue}>{formatDate(profile.joined_at)}</Text>
            </View>
          </View>

          {/* Posts */}
          {posts.length > 0 && (
            <View style={styles.postsSection}>
              <Text style={styles.sectionTitle}>{t('userProfile.recentPosts')}</Text>
              {posts.map(post => (
                <TouchableOpacity 
                  key={post.id} 
                  style={styles.postCard}
                  onPress={() => router.push(`/(tabs)/community?postId=${post.id}`)}
                >
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
                  <View style={styles.postStats}>
                    <View style={styles.postStat}>
                      <Ionicons name="heart-outline" size={16} color="#8B8B9E" />
                      <Text style={styles.postStatText}>{post.likes}</Text>
                    </View>
                    <View style={styles.postStat}>
                      <Ionicons name="chatbubble-outline" size={16} color="#8B8B9E" />
                      <Text style={styles.postStatText}>{post.comments_count}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('userProfile.editProfile')}</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color="#8B8B9E" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <Text style={styles.inputLabel}>{t('userProfile.name')}</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                  placeholder={t('userProfile.yourName')}
                  placeholderTextColor="#5A5A6E"
                />

                <Text style={styles.inputLabel}>{t('userProfile.bio')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editForm.bio}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
                  placeholder={t('userProfile.aboutYou')}
                  placeholderTextColor="#5A5A6E"
                  multiline
                  maxLength={200}
                />

                <Text style={styles.inputLabel}>{t('userProfile.avatarColor')}</Text>
                <View style={styles.colorPicker}>
                  {AVATAR_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorOption, { backgroundColor: color }, editForm.avatar_color === color && styles.colorOptionActive]}
                      onPress={() => setEditForm(prev => ({ ...prev, avatar_color: color }))}
                    />
                  ))}
                </View>

                <Text style={styles.inputLabel}>{t('userProfile.favoriteCrypto')}</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.favorite_crypto}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, favorite_crypto: text.toUpperCase() }))}
                  placeholder="Ex: BTC, ETH..."
                  placeholderTextColor="#5A5A6E"
                />

                <Text style={styles.inputLabel}>{t('userProfile.tradingExperience')}</Text>
                <View style={styles.experiencePicker}>
                  {EXPERIENCE_LEVELS.map(level => (
                    <TouchableOpacity
                      key={level.value}
                      style={[styles.expOption, editForm.trading_experience === level.value && styles.expOptionActive]}
                      onPress={() => setEditForm(prev => ({ ...prev, trading_experience: level.value }))}
                    >
                      <Text style={[styles.expOptionText, editForm.trading_experience === level.value && styles.expOptionTextActive]}>
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{t('userProfile.publicProfile')}</Text>
                  <TouchableOpacity
                    style={[styles.toggle, editForm.is_public && styles.toggleActive]}
                    onPress={() => setEditForm(prev => ({ ...prev, is_public: !prev.is_public }))}
                  >
                    <View style={[styles.toggleThumb, editForm.is_public && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{t('userProfile.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Followers Modal */}
        <Modal visible={showFollowersModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('userProfile.followers')}</Text>
                <TouchableOpacity onPress={() => setShowFollowersModal(false)}>
                  <Ionicons name="close" size={24} color="#8B8B9E" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {followers.length === 0 ? (
                  <Text style={styles.noFollowers}>{t('userProfile.noFollowers')}</Text>
                ) : (
                  followers.map(f => (
                    <TouchableOpacity 
                      key={f.id} 
                      style={styles.followerItem}
                      onPress={() => { setShowFollowersModal(false); router.push(`/user/${f.id}`); }}
                    >
                      <View style={[styles.smallAvatar, { backgroundColor: f.avatar_color }]}>
                        <Text style={styles.smallAvatarText}>{f.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.followerName}>{f.name}</Text>
                      {f.is_vip && <Ionicons name="diamond" size={14} color="#FFD700" />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Following Modal */}
        <Modal visible={showFollowingModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('userProfile.following')}</Text>
                <TouchableOpacity onPress={() => setShowFollowingModal(false)}>
                  <Ionicons name="close" size={24} color="#8B8B9E" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {following.length === 0 ? (
                  <Text style={styles.noFollowers}>{t('userProfile.noFollowing')}</Text>
                ) : (
                  following.map(f => (
                    <TouchableOpacity 
                      key={f.id} 
                      style={styles.followerItem}
                      onPress={() => { setShowFollowingModal(false); router.push(`/user/${f.id}`); }}
                    >
                      <View style={[styles.smallAvatar, { backgroundColor: f.avatar_color }]}>
                        <Text style={styles.smallAvatarText}>{f.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.followerName}>{f.name}</Text>
                      {f.is_vip && <Ionicons name="diamond" size={14} color="#FFD700" />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  safeArea: { flex: 1 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  headerBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  
  // Loading & Error
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 18, color: '#EF4444', marginTop: 16, marginBottom: 24 },
  backButton: { backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  
  // Login Prompt
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loginTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  loginText: { fontSize: 16, color: '#8B8B9E', textAlign: 'center', marginBottom: 24 },
  loginBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  loginBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  
  // Profile Header
  profileHeader: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  vipBadgeAvatar: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1A0A2E', padding: 6, borderRadius: 12, borderWidth: 2, borderColor: '#0A0A1A' },
  profileName: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  vipTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, gap: 4 },
  vipTagText: { fontSize: 12, fontWeight: '700', color: '#FFD700' },
  roleTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  adminTag: { backgroundColor: 'rgba(59,130,246,0.15)' },
  superAdminTag: { backgroundColor: 'rgba(239,68,68,0.15)' },
  roleTagText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  bio: { fontSize: 15, color: '#C4C4C4', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20, lineHeight: 22 },
  addBio: { fontSize: 14, color: '#7C3AED', marginBottom: 16 },
  
  // Stats
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 13, color: '#8B8B9E', marginTop: 2 },
  
  // Follow Button
  followBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, gap: 8 },
  followBtnActive: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#7C3AED' },
  followBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  followBtnTextActive: { color: '#7C3AED' },
  
  // Info Section
  infoSection: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  infoCard: { flex: 1, minWidth: '45%', backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#8B8B9E', marginTop: 8 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginTop: 4 },
  
  // Posts
  postsSection: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  postCard: { backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16, marginBottom: 12 },
  postTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  postContent: { fontSize: 14, color: '#8B8B9E', lineHeight: 20, marginBottom: 12 },
  postStats: { flexDirection: 'row', gap: 16 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 13, color: '#8B8B9E' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  modalScroll: { maxHeight: 400 },
  
  // Form
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#0A0A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#2A2A4E' },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorOption: { width: 40, height: 40, borderRadius: 20 },
  colorOptionActive: { borderWidth: 3, borderColor: '#FFFFFF' },
  
  experiencePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0A0A1A', borderWidth: 1, borderColor: '#2A2A4E' },
  expOptionActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  expOptionText: { fontSize: 14, color: '#8B8B9E' },
  expOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  toggle: { width: 52, height: 28, borderRadius: 14, backgroundColor: '#5A5A6E', padding: 2 },
  toggleActive: { backgroundColor: '#7C3AED' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  toggleThumbActive: { marginLeft: 24 },
  
  saveBtn: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  
  // Followers Modal
  noFollowers: { textAlign: 'center', color: '#8B8B9E', paddingVertical: 32 },
  followerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A4E', gap: 12 },
  smallAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  followerName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
