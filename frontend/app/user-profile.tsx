import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput,
  ActivityIndicator, Platform, Animated, Modal, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../store/languageStore';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';

const { width: W } = Dimensions.get('window');

export default function UserProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user: currentUser } = useAuthStore();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (id) fetchProfile(id as string);
  }, [id]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(headerScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  const fetchProfile = async (userId: string) => {
    try {
      const res = await api.get(`/users/${userId}/profile`);
      if (res.data?.data) {
        setProfile(res.data.data);
        setIsFollowing(res.data.data.is_following || false);
        setEditBio(res.data.data.bio || '');
        setEditUsername(res.data.data.username || '');
        setEditPublic(res.data.data.is_profile_public !== false);
      }
      // Fetch posts
      try {
        const postsRes = await api.get(`/community/posts?author_id=${userId}&limit=20`);
        if (postsRes.data?.posts) setPosts(postsRes.data.posts);
      } catch {}
    } catch (e) {
      console.log('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser) { Alert.alert('', 'Login to follow users'); return; }
    if (!profile) return;
    try {
      if (isFollowing) {
        await api.delete(`/users/${profile.id}/follow`);
        setIsFollowing(false);
        setProfile((p: any) => ({ ...p, followers_count: Math.max(0, (p.followers_count || 1) - 1) }));
      } else {
        await api.post(`/users/${profile.id}/follow`);
        setIsFollowing(true);
        setProfile((p: any) => ({ ...p, followers_count: (p.followers_count || 0) + 1 }));
      }
    } catch {}
  };

  const saveProfile = async () => {
    try {
      await api.put('/users/me/profile', { bio: editBio, username: editUsername, is_profile_public: editPublic });
      setProfile((p: any) => ({ ...p, bio: editBio, username: editUsername, is_profile_public: editPublic }));
      setShowEdit(false);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update');
    }
  };

  const loadFollowers = async () => {
    try {
      const res = await api.get(`/users/${profile.id}/followers`);
      setFollowersList(res.data?.data || []);
      setShowFollowers(true);
    } catch {}
  };

  const loadFollowing = async () => {
    try {
      const res = await api.get(`/users/${profile.id}/following`);
      setFollowingList(res.data?.data || []);
      setShowFollowing(true);
    } catch {}
  };

  if (loading) return <View style={s.loadingWrap}><ActivityIndicator size="large" color="#7C3AED" /></View>;
  if (!profile) return <View style={s.loadingWrap}><Text style={s.errorText}>User not found</Text></View>;
  if (profile.is_private) {
    return (
      <View style={s.container}>
        <View style={s.privateWrap}>
          <Ionicons name="lock-closed" size={48} color="#5A5A6E" />
          <Text style={s.privateName}>{profile.name}</Text>
          <Text style={s.privateText}>This profile is private</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOwn = profile.is_own;
  const initial = (profile.username || profile.name || 'U')[0].toUpperCase();

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: headerScale }] }}>
          {/* Cover */}
          <View style={s.coverWrap}>
            {profile.cover_url ? (
              <Image source={{ uri: profile.cover_url }} style={s.coverImg} />
            ) : (
              <View style={s.coverPlaceholder} />
            )}
            <TouchableOpacity style={s.backArrow} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Avatar + Name */}
          <View style={s.profileHeader}>
            <View style={s.avatarWrap}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: profile.avatar_color || '#7C3AED' }]}>
                  <Text style={s.avatarLetter}>{initial}</Text>
                </View>
              )}
              {profile.is_vip && (
                <View style={s.vipBadge}>
                  <Ionicons name="diamond" size={10} color="#FFD700" />
                </View>
              )}
            </View>

            <View style={s.nameSection}>
              <View style={s.nameRow}>
                <Text style={s.displayName}>{profile.username || profile.name}</Text>
                {profile.is_professional && (
                  <Ionicons name="checkmark-circle" size={16} color="#7C3AED" style={{ marginLeft: 4 }} />
                )}
              </View>
              {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{profile.posts_count || 0}</Text>
              <Text style={s.statLabel}>Posts</Text>
            </View>
            <TouchableOpacity style={s.statItem} onPress={loadFollowers}>
              <Text style={s.statNum}>{profile.followers_count || 0}</Text>
              <Text style={s.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statItem} onPress={loadFollowing}>
              <Text style={s.statNum}>{profile.following_count || 0}</Text>
              <Text style={s.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={s.actionsRow}>
            {isOwn ? (
              <TouchableOpacity style={s.editBtn} onPress={() => setShowEdit(true)} data-testid="edit-profile-btn">
                <Ionicons name="create-outline" size={16} color="#C4B5FD" />
                <Text style={s.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[s.followBtn, isFollowing && s.followBtnActive]}
                  onPress={toggleFollow}
                  data-testid="follow-user-btn"
                >
                  <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.msgBtn} onPress={() => router.push(`/messages?userId=${profile.id}` as any)}>
                  <Ionicons name="chatbubble-outline" size={18} color="#C4B5FD" />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Tabs */}
          <View style={s.tabsRow}>
            <TouchableOpacity style={[s.tab, activeTab === 'posts' && s.tabActive]} onPress={() => setActiveTab('posts')}>
              <Ionicons name="grid-outline" size={18} color={activeTab === 'posts' ? '#C4B5FD' : '#5A5A6E'} />
              <Text style={[s.tabText, activeTab === 'posts' && s.tabTextActive]}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, activeTab === 'about' && s.tabActive]} onPress={() => setActiveTab('about')}>
              <Ionicons name="information-circle-outline" size={18} color={activeTab === 'about' ? '#C4B5FD' : '#5A5A6E'} />
              <Text style={[s.tabText, activeTab === 'about' && s.tabTextActive]}>About</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'posts' ? (
            posts.length > 0 ? (
              <View style={s.postsGrid}>
                {posts.map((post: any) => (
                  <TouchableOpacity key={post.id} style={s.postCard} onPress={() => router.push(`/(tabs)/community` as any)}>
                    {post.image_url && (
                      <Image source={{ uri: post.image_url.startsWith('http') ? post.image_url : `https://mentova-api.onrender.com${post.image_url}` }} style={s.postImage} />
                    )}
                    <Text style={s.postContent} numberOfLines={post.image_url ? 2 : 4}>{post.content}</Text>
                    <View style={s.postMeta}>
                      <Ionicons name="heart" size={12} color="#EF4444" />
                      <Text style={s.postMetaText}>{post.likes_count || 0}</Text>
                      <Ionicons name="chatbubble" size={12} color="#6B7280" style={{ marginLeft: 8 }} />
                      <Text style={s.postMetaText}>{post.comments_count || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={s.emptyPosts}>
                <Ionicons name="document-text-outline" size={40} color="#2A2A4E" />
                <Text style={s.emptyText}>No posts yet</Text>
              </View>
            )
          ) : (
            <View style={s.aboutSection}>
              {profile.is_professional && (
                <View style={s.aboutItem}>
                  <Ionicons name="ribbon" size={16} color="#7C3AED" />
                  <Text style={s.aboutText}>Verified Mentor</Text>
                </View>
              )}
              {profile.is_vip && (
                <View style={s.aboutItem}>
                  <Ionicons name="diamond" size={16} color="#FFD700" />
                  <Text style={s.aboutText}>VIP Member</Text>
                </View>
              )}
              <View style={s.aboutItem}>
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <Text style={s.aboutText}>Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</Text>
              </View>
            </View>
          )}
          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Username</Text>
            <TextInput style={s.fieldInput} value={editUsername} onChangeText={setEditUsername} maxLength={30} placeholderTextColor="#5A5A6E" placeholder="Your username" />
            <Text style={s.fieldLabel}>Bio</Text>
            <TextInput style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]} value={editBio} onChangeText={setEditBio} maxLength={300} multiline placeholderTextColor="#5A5A6E" placeholder="Write something about yourself..." />
            <Text style={s.charCount}>{editBio.length}/300</Text>
            <TouchableOpacity style={s.privacyToggle} onPress={() => setEditPublic(!editPublic)}>
              <Ionicons name={editPublic ? 'globe-outline' : 'lock-closed-outline'} size={18} color="#C4B5FD" />
              <Text style={s.privacyText}>{editPublic ? 'Public profile' : 'Private profile'}</Text>
              <View style={[s.toggleDot, editPublic && s.toggleDotActive]} />
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={saveProfile}>
              <Text style={s.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Followers/Following List Modal */}
      <Modal visible={showFollowers || showFollowing} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{showFollowers ? 'Followers' : 'Following'}</Text>
              <TouchableOpacity onPress={() => { setShowFollowers(false); setShowFollowing(false); }}>
                <Ionicons name="close" size={24} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {(showFollowers ? followersList : followingList).map((u: any) => (
                <TouchableOpacity key={u.id} style={s.userListItem} onPress={() => { setShowFollowers(false); setShowFollowing(false); router.push(`/user-profile?id=${u.id}` as any); }}>
                  <View style={[s.listAvatar, { backgroundColor: '#7C3AED' }]}>
                    <Text style={s.listAvatarText}>{(u.username || u.name || 'U')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listName}>{u.username || u.name}</Text>
                    {u.bio && <Text style={s.listBio} numberOfLines={1}>{u.bio}</Text>}
                  </View>
                  {u.is_vip && <Ionicons name="diamond" size={14} color="#FFD700" />}
                  {u.is_professional && <Ionicons name="checkmark-circle" size={14} color="#7C3AED" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              ))}
              {(showFollowers ? followersList : followingList).length === 0 && (
                <Text style={s.emptyText}>No users yet</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  loadingWrap: { flex: 1, backgroundColor: '#0A0A1A', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#EF4444', fontSize: 16 },

  // Cover
  coverWrap: { height: 160, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1A1A30' },
  backArrow: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },

  // Profile Header
  profileHeader: { paddingHorizontal: 20, marginTop: -40, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#0A0A1A' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  vipBadge: { position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1A1A30', borderWidth: 2, borderColor: '#0A0A1A', alignItems: 'center', justifyContent: 'center' },
  nameSection: { flex: 1, paddingBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  displayName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  bio: { fontSize: 13, color: '#9CA3AF', marginTop: 4, lineHeight: 18 },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 0 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, paddingBottom: 16 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1A1A30', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#C4B5FD' },
  followBtn: { flex: 1, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  followBtnActive: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7C3AED' },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  followBtnTextActive: { color: '#7C3AED' },
  msgBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1A1A30', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1A1A2E', marginHorizontal: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#5A5A6E' },
  tabTextActive: { color: '#C4B5FD' },

  // Posts
  postsGrid: { paddingHorizontal: 20, gap: 10, paddingTop: 16 },
  postCard: { backgroundColor: '#111127', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1A1A2E' },
  postContent: { fontSize: 13, color: '#D1D5DB', lineHeight: 18 },
  postImage: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  postMetaText: { fontSize: 11, color: '#6B7280' },
  emptyPosts: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#5A5A6E', textAlign: 'center', paddingVertical: 20 },

  // About
  aboutSection: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  aboutItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aboutText: { fontSize: 14, color: '#B0B0C0' },

  // Private
  privateWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  privateName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  privateText: { fontSize: 14, color: '#6B7280' },
  backBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#12122A', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 12, marginBottom: 6 },
  fieldInput: { backgroundColor: '#0A0A1A', borderRadius: 10, padding: 12, fontSize: 14, color: '#E5E7EB', borderWidth: 1, borderColor: '#1A1A2E' },
  charCount: { fontSize: 11, color: '#5A5A6E', textAlign: 'right', marginTop: 4 },
  privacyToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, marginTop: 8 },
  privacyText: { flex: 1, fontSize: 14, color: '#C4B5FD' },
  toggleDot: { width: 40, height: 22, borderRadius: 11, backgroundColor: '#2A2A4E', padding: 2 },
  toggleDotActive: { backgroundColor: '#7C3AED' },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // User list
  userListItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  listAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  listAvatarText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  listName: { fontSize: 14, fontWeight: '600', color: '#E5E7EB' },
  listBio: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
