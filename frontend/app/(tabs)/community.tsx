import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput, Modal, Image, FlatList, Platform, Pressable, ActivityIndicator, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://mentova-api.onrender.com';

const imgUrl = (u?: string | null) => {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  return `${API}${u}`;
};

const timeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  if (s < 604800) return `${Math.floor(s/86400)}d`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

interface Post { id: string; content: string; category: string; image_url?: string; author_id: string; author_name: string; author_avatar?: string; author_is_vip: boolean; votes: number; likes: string[]; comments_count: number; created_at: string; bookmarked?: boolean; title?: string; }

const TAGS = [
  { id: 'all', label: 'All', icon: 'globe-outline' },
  { id: 'general', label: 'General', icon: 'chatbubble-outline' },
  { id: 'trading', label: 'Trading', icon: 'trending-up-outline' },
  { id: 'defi', label: 'DeFi', icon: 'layers-outline' },
  { id: 'nft', label: 'NFT', icon: 'image-outline' },
  { id: 'debutants', label: 'Beginners', icon: 'school-outline' },
  { id: 'news', label: 'News', icon: 'newspaper-outline' },
];

export default function CommunityScreen() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('recent');
  const [tag, setTag] = useState('all');
  const [lang, setLang] = useState('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [detail, setDetail] = useState<Post | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);

  const fetchPosts = useCallback(async (reset = false) => {
    try {
      const p = reset ? 0 : page;
      const params = new URLSearchParams({ sort: filter, skip: String(p * 20), limit: '20' });
      if (tag !== 'all') params.append('category', tag);
      if (lang !== 'all') params.append('language', lang);
      if (search) params.append('search', search);
      const r = await fetch(`${API}/api/community/posts?${params}`, { headers: isAuthenticated ? { 'Authorization': `Bearer ${useAuthStore.getState().token}` } : {} });
      const d = await r.json();
      const newPosts = d.data || d.posts || [];
      if (reset) { setPosts(newPosts); setPage(1); } else { setPosts(prev => [...prev, ...newPosts]); setPage(p + 1); }
      setHasMore(newPosts.length === 20);
    } catch (e) {}
  }, [filter, tag, search, page, isAuthenticated]);

  useEffect(() => { setLoading(true); fetchPosts(true).then(() => setLoading(false)); }, [filter, tag, lang]);

  const refresh = async () => { setRefreshing(true); await fetchPosts(true); setRefreshing(false); };
  const loadMore = async () => { if (loadingMore || !hasMore) return; setLoadingMore(true); await fetchPosts(false); setLoadingMore(false); };

  const toggleLike = async (postId: string) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`${API}/api/community/posts/${postId}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` } });
      const updateLikes = (p: Post) => {
        if (p.id !== postId) return p;
        const liked = p.likes.includes(user?.id || '');
        return { ...p, likes: liked ? p.likes.filter(l => l !== user?.id) : [...p.likes, user?.id || ''] };
      };
      setPosts(prev => prev.map(updateLikes));
      if (detail && detail.id === postId) setDetail(prev => prev ? updateLikes(prev) : prev);
    } catch (e) {}
  };

  const toggleBookmark = async (postId: string) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`${API}/api/community/posts/${postId}/bookmark`, { method: 'POST', headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` } });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, bookmarked: !p.bookmarked } : p));
      if (detail && detail.id === postId) setDetail(prev => prev ? { ...prev, bookmarked: !prev.bookmarked } : prev);
    } catch (e) {}
  };

  const sharePost = async (post: Post) => {
    const text = `${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}\n\n— ${post.author_name} on Mentova`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: 'Mentova Community', text });
        } else {
          await navigator.clipboard.writeText(text);
          // Could show a toast here
        }
      } else {
        const { Share } = require('react-native');
        await Share.share({ message: text });
      }
    } catch (e) {}
  };

  const deletePost = async (postId: string) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`${API}/api/community/posts/${postId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` } });
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (detail?.id === postId) setDetail(null);
    } catch (e) {}
    setMenuPostId(null);
  };

  const reportPost = async (postId: string) => {
    if (!isAuthenticated) return;
    try {
      await fetch(`${API}/api/community/posts/${postId}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${useAuthStore.getState().token}` }, body: JSON.stringify({ reason: 'inappropriate' }) });
      Alert.alert('Signalement', 'Post signalé. Merci !');
    } catch (e) {}
    setMenuPostId(null);
  };


  const openPost = async (post: Post) => {
    setDetail(post);
    try {
      const r = await fetch(`${API}/api/community/posts/${post.id}`, { headers: isAuthenticated ? { 'Authorization': `Bearer ${useAuthStore.getState().token}` } : {} });
      const d = await r.json();
      const postData = d.data || d;
      setComments(postData.comments || []);
      // Update detail with full data from API
      if (postData.likes) {
        setDetail(prev => prev ? { ...prev, likes: postData.likes, comments_count: (postData.comments || []).length } : prev);
      }
    } catch (e) {}
  };

  const sendComment = async () => {
    if (!newComment.trim() || !detail) return;
    try {
      await fetch(`${API}/api/community/posts/${detail.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${useAuthStore.getState().token}` },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      setNewComment('');
      const r = await fetch(`${API}/api/community/posts/${detail.id}`, { headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` } });
      const d = await r.json();
      const postData = d.data || d;
      setComments(postData.comments || []);
      setPosts(prev => prev.map(p => p.id === detail.id ? { ...p, comments_count: (postData.comments || []).length } : p));
    } catch (e) {}
  };

  const liked = (post: Post) => post.likes.includes(user?.id || '');

  // Translation
  const [translating, setTranslating] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const translatePost = async (postId: string, content: string) => {
    if (translations[postId]) { setTranslations(prev => { const n = {...prev}; delete n[postId]; return n; }); return; }
    setTranslating(postId);
    try {
      const r = await fetch(`${API}/api/atlas/chat/simple`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Translate this to my language. Just return the translation, nothing else:\n\n${content}`, session_id: `translate-${postId}` }),
      });
      const d = await r.json();
      setTranslations(prev => ({ ...prev, [postId]: d.response || content }));
    } catch (e) { setTranslations(prev => ({ ...prev, [postId]: content })); }
    setTranslating(null);
  };

  // ─── RENDER POST CARD ───
  const renderPost = ({ item: post }: { item: Post }) => (
    <Pressable style={s.post} onPress={() => openPost(post)} data-testid={`post-${post.id}`}>
      {/* Author row */}
      <View style={s.postHead}>
        <View style={s.avatar}>
          {post.author_avatar ? <Image source={{ uri: imgUrl(post.author_avatar)! }} style={s.avatarImg} /> : <Text style={s.avatarLetter}>{(post.author_name || '?')[0].toUpperCase()}</Text>}
          {post.author_is_vip && <View style={s.vipDot}><Ionicons name="diamond" size={8} color="#FFD700" /></View>}
        </View>
        <View style={s.postMeta}>
          <View style={s.nameRow}>
            <Text style={s.authorName} numberOfLines={1}>{post.author_name}</Text>
            {post.author_is_vip && <Ionicons name="checkmark-circle" size={14} color="#7C3AED" style={{ marginLeft: 4 }} />}
          </View>
          <Text style={s.postTime}>{timeAgo(post.created_at)}</Text>
        </View>
        <TouchableOpacity style={s.moreBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setMenuPostId(menuPostId === post.id ? null : post.id)}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Post menu */}
      {menuPostId === post.id && (
        <View style={s.postMenu}>
          {post.author_id === user?.id && (
            <TouchableOpacity style={s.menuItem} onPress={() => deletePost(post.id)}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={[s.menuText, { color: '#EF4444' }]}>Supprimer</Text>
            </TouchableOpacity>
          )}
          {post.author_id !== user?.id && (
            <TouchableOpacity style={s.menuItem} onPress={() => reportPost(post.id)}>
              <Ionicons name="flag-outline" size={16} color="#F59E0B" />
              <Text style={[s.menuText, { color: '#F59E0B' }]}>Signaler</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.menuItem} onPress={() => { sharePost(post); setMenuPostId(null); }}>
            <Ionicons name="share-social-outline" size={16} color="#3B82F6" />
            <Text style={[s.menuText, { color: '#3B82F6' }]}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.menuItem} onPress={() => setMenuPostId(null)}>
            <Ionicons name="close-outline" size={16} color="#888" />
            <Text style={s.menuText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <Text style={s.postContent} numberOfLines={6}>{translations[post.id] || post.content}</Text>

      {/* Translate button */}
      <TouchableOpacity style={s.translateBtn} onPress={() => translatePost(post.id, post.content)} data-testid={`translate-${post.id}`}>
        <Ionicons name={translations[post.id] ? 'close-circle-outline' : 'language-outline'} size={14} color="#3B82F6" />
        <Text style={s.translateText}>{translating === post.id ? '...' : translations[post.id] ? 'Original' : 'Translate'}</Text>
      </TouchableOpacity>

      {/* Image */}
      {post.image_url && <Image source={{ uri: imgUrl(post.image_url)! }} style={s.postImage} resizeMode="cover" />}

      {/* Tag */}
      {post.category && post.category !== 'all' && (
        <View style={s.tagWrap}>
          <View style={s.tag}><Text style={s.tagText}>#{post.category}</Text></View>
        </View>
      )}

      {/* Actions bar */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(post.id)} data-testid={`like-${post.id}`}>
          <Ionicons name={liked(post) ? 'heart' : 'heart-outline'} size={18} color={liked(post) ? '#EF4444' : '#666'} />
          <Text style={[s.actionCount, liked(post) && { color: '#EF4444' }]}>{post.likes.length || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => openPost(post)} data-testid={`comment-${post.id}`}>
          <Ionicons name="chatbubble-outline" size={17} color="#666" />
          <Text style={s.actionCount}>{post.comments_count || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => sharePost(post)}>
          <Ionicons name="share-social-outline" size={17} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => toggleBookmark(post.id)} data-testid={`bookmark-${post.id}`}>
          <Ionicons name={post.bookmarked ? 'bookmark' : 'bookmark-outline'} size={17} color={post.bookmarked ? '#7C3AED' : '#666'} />
        </TouchableOpacity>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ─── HEADER ─── */}
      <View style={s.header}>
        {showSearch ? (
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput style={s.searchInput} placeholder={t('community.search_placeholder') || 'Search...'} placeholderTextColor="#555" value={search} onChangeText={setSearch} onSubmitEditing={() => fetchPosts(true)} autoFocus returnKeyType="search" data-testid="search-input" />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearch(''); fetchPosts(true); }}><Ionicons name="close" size={20} color="#888" /></TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.headerTitle}>Community</Text>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.headerBtn} onPress={() => setShowSearch(true)} data-testid="search-btn"><Ionicons name="search-outline" size={22} color="#FFF" /></TouchableOpacity>
              <TouchableOpacity style={s.composeBtn} onPress={() => setShowCompose(true)} data-testid="compose-btn">
                <LinearGradient colors={['#7C3AED', '#A855F7']} style={s.composeBtnGrad}><Ionicons name="create-outline" size={18} color="#FFF" /></LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ─── FILTERS ─── */}
      <View style={s.filters}>
        {[
          { id: 'recent', icon: 'time-outline', label: t('community.recent') || 'Recent' },
          { id: 'popular', icon: 'flame-outline', label: t('community.popular') || 'Popular' },
          { id: 'trending', icon: 'rocket-outline', label: t('community.trending') || 'Trending' },
        ].map(f => (
          <TouchableOpacity key={f.id} style={[s.filterBtn, filter === f.id && s.filterActive]} onPress={() => setFilter(f.id)} data-testid={`filter-${f.id}`}>
            <Ionicons name={f.icon as any} size={14} color={filter === f.id ? '#FFF' : '#888'} />
            <Text style={[s.filterText, filter === f.id && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.langSpacer} />
        {[
          { id: 'all', label: 'All' },
          { id: 'fr', label: 'FR' },
          { id: 'en', label: 'EN' },
          { id: 'es', label: 'ES' },
        ].map(l => (
          <TouchableOpacity key={l.id} style={[s.langBtn, lang === l.id && s.langBtnActive]} onPress={() => setLang(l.id)} data-testid={`lang-${l.id}`}>
            <Text style={[s.langText, lang === l.id && s.langTextActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── TAGS + FEED ─── */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : (
        <FlatList
          ref={flatRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7C3AED" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={() => (
            <View style={s.tagsRow}>
              {TAGS.map(item => (
                <TouchableOpacity key={item.id} style={[s.tagBtn, tag === item.id && s.tagBtnActive]} onPress={() => setTag(item.id)} data-testid={`tag-${item.id}`}>
                  <Ionicons name={item.icon as any} size={13} color={tag === item.id ? '#FFF' : '#888'} />
                  <Text style={[s.tagBtnText, tag === item.id && s.tagBtnTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 20 }} color="#7C3AED" /> : null}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="chatbubbles-outline" size={48} color="#333" /><Text style={s.emptyText}>No posts yet</Text><Text style={s.emptyHint}>Be the first to post!</Text></View>}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}

      {/* ─── COMPOSE MODAL ─── */}
      <ComposeModal visible={showCompose} onClose={() => setShowCompose(false)} onPost={() => { setShowCompose(false); fetchPosts(true); }} />

      {/* ─── POST DETAIL MODAL ─── */}
      <Modal visible={!!detail} animationType="slide" transparent={false}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Detail Header */}
            <View style={s.detailHeader}>
              <TouchableOpacity onPress={() => { setDetail(null); setComments([]); }} data-testid="detail-back"><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
              <Text style={s.detailTitle}>Post</Text>
              <View style={{ width: 24 }} />
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item, i) => item.id || String(i)}
              ListHeaderComponent={() => detail ? (
                <View style={s.detailPost}>
                  <View style={s.postHead}>
                    <View style={s.avatar}>
                      {detail.author_avatar ? <Image source={{ uri: imgUrl(detail.author_avatar)! }} style={s.avatarImg} /> : <Text style={s.avatarLetter}>{(detail.author_name || '?')[0].toUpperCase()}</Text>}
                    </View>
                    <View style={s.postMeta}>
                      <Text style={s.authorName}>{detail.author_name}</Text>
                      <Text style={s.postTime}>{timeAgo(detail.created_at)}</Text>
                    </View>
                  </View>
                  <Text style={s.detailContent}>{detail.content}</Text>
                  {detail.image_url && <Image source={{ uri: imgUrl(detail.image_url)! }} style={s.detailImage} resizeMode="cover" />}
                  <View style={s.detailStats}>
                    <Text style={s.detailStat}>{detail.likes.length} likes</Text>
                    <Text style={s.detailStat}>{comments.length} comments</Text>
                  </View>
                  <View style={[s.actions, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 }]}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(detail.id)}><Ionicons name={liked(detail) ? 'heart' : 'heart-outline'} size={20} color={liked(detail) ? '#EF4444' : '#666'} /><Text style={[s.actionCount, liked(detail) && { color: '#EF4444' }]}>{liked(detail) ? 'Liked' : 'Like'}</Text></TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => sharePost(detail)}><Ionicons name="share-social-outline" size={20} color="#666" /><Text style={s.actionCount}>Share</Text></TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => toggleBookmark(detail.id)}><Ionicons name={detail.bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={detail.bookmarked ? '#7C3AED' : '#666'} /><Text style={s.actionCount}>Save</Text></TouchableOpacity>
                  </View>
                  <View style={s.commentsDivider}><Text style={s.commentsDividerText}>Comments</Text></View>
                </View>
              ) : null}
              renderItem={({ item: c }) => (
                <View style={s.comment}>
                  <View style={s.commentAvatar}><Text style={s.commentAvatarLetter}>{(c.author_name || '?')[0].toUpperCase()}</Text></View>
                  <View style={s.commentBody}>
                    <View style={s.commentHead}><Text style={s.commentAuthor}>{c.author_name}</Text><Text style={s.commentTime}>{timeAgo(c.created_at)}</Text></View>
                    <Text style={s.commentText}>{c.content}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<View style={s.emptyComments}><Text style={s.emptyCommentsText}>No comments yet</Text></View>}
              contentContainerStyle={{ paddingBottom: 80 }}
            />

            {/* Comment input */}
            <View style={s.commentBar}>
              <TextInput style={s.commentInput} value={newComment} onChangeText={setNewComment} placeholder="Write a comment..." placeholderTextColor="#555" data-testid="comment-input" />
              <TouchableOpacity style={[s.commentSend, !newComment.trim() && { opacity: 0.3 }]} onPress={sendComment} disabled={!newComment.trim()} data-testid="comment-send">
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── COMPOSE MODAL COMPONENT ───
function ComposeModal({ visible, onClose, onPost }: { visible: boolean; onClose: () => void; onPost: () => void }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [image, setImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0].uri);
  };

  const submit = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('category', category);
      if (image) {
        const ext = image.split('.').pop() || 'jpg';
        formData.append('image', { uri: image, name: `photo.${ext}`, type: `image/${ext}` } as any);
      }
      await fetch(`${API}/api/community/posts`, { method: 'POST', headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }, body: formData });
      setContent(''); setImage(null); setCategory('general');
      onPost();
    } catch (e) {}
    setPosting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.composeHeader}>
          <TouchableOpacity onPress={onClose} data-testid="compose-cancel"><Text style={s.composeCancel}>Cancel</Text></TouchableOpacity>
          <Text style={s.composeTitle}>New Post</Text>
          <TouchableOpacity style={[s.postBtn, (!content.trim() || posting) && { opacity: 0.4 }]} onPress={submit} disabled={!content.trim() || posting} data-testid="compose-submit">
            <LinearGradient colors={['#7C3AED', '#A855F7']} style={s.postBtnGrad}><Text style={s.postBtnText}>{posting ? '...' : 'Post'}</Text></LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={s.composeBody}>
          <View style={s.composeUser}>
            <View style={s.avatar}><Text style={s.avatarLetter}>{(user?.name || '?')[0].toUpperCase()}</Text></View>
            <Text style={s.authorName}>{user?.name || 'You'}</Text>
          </View>
          <TextInput style={s.composeInput} placeholder="What's happening in crypto?" placeholderTextColor="#555" multiline value={content} onChangeText={setContent} maxLength={1000} autoFocus data-testid="compose-text" />
          {image && (
            <View style={s.composeImageWrap}>
              <Image source={{ uri: image }} style={s.composeImage} />
              <TouchableOpacity style={s.composeImageRemove} onPress={() => setImage(null)}><Ionicons name="close-circle" size={24} color="#FFF" /></TouchableOpacity>
            </View>
          )}
        </View>

        {/* Category picker */}
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={TAGS.filter(t => t.id !== 'all')} keyExtractor={i => i.id}
          contentContainerStyle={s.composeTags}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.tagBtn, category === item.id && s.tagBtnActive]} onPress={() => setCategory(item.id)}>
              <Text style={[s.tagBtnText, category === item.id && s.tagBtnTextActive]}>#{item.label}</Text>
            </TouchableOpacity>
          )}
        />

        <View style={s.composeTools}>
          <TouchableOpacity style={s.composeTool} onPress={pickImage} data-testid="compose-image"><Ionicons name="image-outline" size={24} color="#7C3AED" /></TouchableOpacity>
          <Text style={s.composeCount}>{content.length}/1000</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#06060F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  composeBtn: {},
  composeBtnGrad: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, gap: 8, height: 42 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },

  // Filters
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' },
  filterActive: { backgroundColor: '#7C3AED' },
  filterText: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFF' },
  langSpacer: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' },
  langBtnActive: { backgroundColor: '#3B82F6' },
  langText: { color: '#888', fontSize: 12, fontWeight: '700' },
  langTextActive: { color: '#FFF' },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 6 },
  tagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', height: 32 },
  tagBtnActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: '#7C3AED' },
  tagBtnText: { color: '#888', fontSize: 12, fontWeight: '600' },
  tagBtnTextActive: { color: '#A78BFA' },

  // Post
  post: { paddingHorizontal: 16, paddingVertical: 14 },
  postHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarLetter: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  vipDot: { position: 'absolute', bottom: -1, right: -1, backgroundColor: '#1a1a2e', borderRadius: 8, padding: 2 },
  postMeta: { flex: 1, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  postTime: { color: '#555', fontSize: 12, marginTop: 1 },
  moreBtn: { padding: 4 },
  postMenu: { position: 'absolute', top: 50, right: 16, backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 100, minWidth: 160 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { fontSize: 14, fontWeight: '600', color: '#888' },
  postContent: { color: '#E5E7EB', fontSize: 15, lineHeight: 22, marginBottom: 4 },
  translateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, marginBottom: 8 },
  translateText: { color: '#3B82F6', fontSize: 12, fontWeight: '600' },
  postImage: { width: '100%', height: 220, borderRadius: 14, marginBottom: 8, backgroundColor: '#111' },
  tagWrap: { flexDirection: 'row', marginBottom: 8 },
  tag: { backgroundColor: 'rgba(124,58,237,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: '#A78BFA', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 4 },
  actionCount: { color: '#666', fontSize: 13 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#555', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyHint: { color: '#444', fontSize: 13, marginTop: 4 },

  // Detail
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  detailTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  detailPost: { paddingHorizontal: 16, paddingTop: 14 },
  detailContent: { color: '#E5E7EB', fontSize: 16, lineHeight: 24, marginBottom: 12 },
  detailImage: { width: '100%', height: 260, borderRadius: 14, marginBottom: 12, backgroundColor: '#111' },
  detailStats: { flexDirection: 'row', gap: 16, paddingVertical: 10 },
  detailStat: { color: '#666', fontSize: 13 },
  commentsDivider: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 8 },
  commentsDividerText: { color: '#888', fontSize: 14, fontWeight: '700' },

  // Comments
  comment: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  commentAvatarLetter: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  commentAuthor: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  commentTime: { color: '#555', fontSize: 11 },
  commentText: { color: '#CCC', fontSize: 14, lineHeight: 20 },
  emptyComments: { padding: 40, alignItems: 'center' },
  emptyCommentsText: { color: '#555', fontSize: 14 },
  commentBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#06060F', gap: 8 },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#FFF', fontSize: 14 },
  commentSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },

  // Compose
  composeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  composeTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  composeCancel: { color: '#888', fontSize: 15 },
  postBtn: {},
  postBtnGrad: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  composeBody: { padding: 16 },
  composeUser: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  composeInput: { color: '#FFF', fontSize: 17, lineHeight: 24, minHeight: 100, textAlignVertical: 'top' },
  composeImageWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 12, position: 'relative' },
  composeImage: { width: '100%', height: 200, borderRadius: 14 },
  composeImageRemove: { position: 'absolute', top: 8, right: 8 },
  composeTags: { paddingHorizontal: 16, gap: 6, paddingVertical: 8 },
  composeTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  composeTool: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.1)' },
  composeCount: { color: '#555', fontSize: 13 },
});
