import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import api from '../utils/api';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  testimonial: { icon: 'heart', color: '#EC4899', label: 'Testimonial' },
  improvement: { icon: 'bulb', color: '#F59E0B', label: 'Improvement' },
  bug: { icon: 'bug', color: '#EF4444', label: 'Bug' },
  feature: { icon: 'rocket', color: '#3B82F6', label: 'Feature' },
};

export default function MyFeedbackScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    fetchMyFeedback();
  }, []);

  const fetchMyFeedback = async () => {
    try {
      const res = await api.get('/my-feedback');
      if (res.data.success) setFeedbacks(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} data-testid="myfb-back-btn">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={s.headerTitle}>{t('myFeedback.title')}</Text>
          <Pressable onPress={() => router.push('/feedback')} style={s.newBtn} data-testid="myfb-new-btn">
            <Ionicons name="add" size={22} color="#7C3AED" />
          </Pressable>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {feedbacks.length === 0 ? (
            <View style={s.emptyState} data-testid="myfb-empty">
              <Ionicons name="chatbubble-ellipses-outline" size={52} color="#3A3A5A" />
              <Text style={s.emptyTitle}>{t('myFeedback.emptyTitle')}</Text>
              <Text style={s.emptyDesc}>{t('myFeedback.emptyDesc')}</Text>
              <Pressable style={s.emptyBtn} onPress={() => router.push('/feedback')}>
                <Text style={s.emptyBtnText}>{t('myFeedback.sendFirst')}</Text>
              </Pressable>
            </View>
          ) : (
            feedbacks.map((fb) => {
              const cfg = TYPE_CONFIG[fb.type] || TYPE_CONFIG.improvement;
              const hasReplies = (fb.replies || []).length > 0;
              return (
                <Pressable
                  key={fb.id}
                  style={({ pressed }) => [s.card, hasReplies && s.cardWithReply, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelected(fb)}
                  data-testid={`myfb-card-${fb.id}`}
                >
                  <View style={s.cardHeader}>
                    <View style={[s.typeBadge, { backgroundColor: `${cfg.color}20` }]}>
                      <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                      <Text style={[s.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {hasReplies && (
                      <View style={s.replyBadge}>
                        <Ionicons name="chatbubble" size={12} color="#10B981" />
                        <Text style={s.replyBadgeText}>{(fb.replies || []).length} {t('myFeedback.reply')}</Text>
                      </View>
                    )}
                    {fb.rating && (
                      <View style={s.starsRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Ionicons key={star} name={star <= fb.rating ? 'star' : 'star-outline'} size={12} color="#FFD700" />
                        ))}
                      </View>
                    )}
                  </View>
                  <Text style={s.cardMessage} numberOfLines={2}>{fb.message}</Text>
                  <View style={s.cardFooter}>
                    <Text style={s.cardDate}>
                      {new Date(fb.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    {hasReplies ? (
                      <View style={s.viewReplyHint}>
                        <Text style={s.viewReplyText}>{t('myFeedback.viewReply')}</Text>
                        <Ionicons name="chevron-forward" size={14} color="#10B981" />
                      </View>
                    ) : (
                      <Text style={s.pendingText}>{t('myFeedback.pending')}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Detail Modal */}
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modal} data-testid="myfb-detail-modal">
              {selected && (() => {
                const fb = selected;
                const cfg = TYPE_CONFIG[fb.type] || TYPE_CONFIG.improvement;
                return (
                  <>
                    {/* Modal Header */}
                    <View style={s.modalHeader}>
                      <View style={[s.typeBadge, { backgroundColor: `${cfg.color}20` }]}>
                        <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                        <Text style={[s.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      <Text style={s.modalDate}>
                        {new Date(fb.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                      <Pressable onPress={() => setSelected(null)} style={s.modalCloseBtn} data-testid="myfb-close-modal">
                        <Ionicons name="close" size={22} color="#FFFFFF" />
                      </Pressable>
                    </View>

                    <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 30 }}>
                      {/* Original Message */}
                      <View style={s.originalSection}>
                        <Text style={s.sectionLabel}>{t('myFeedback.yourMessage')}</Text>
                        <Text style={s.originalMessage} selectable>{fb.message}</Text>
                      </View>

                      {/* Admin Replies */}
                      {(fb.replies || []).length > 0 ? (
                        <View style={s.repliesSection}>
                          <View style={s.repliesSectionHeader}>
                            <Ionicons name="shield-checkmark" size={18} color="#7C3AED" />
                            <Text style={s.sectionLabel}>{t('myFeedback.adminResponse')}</Text>
                          </View>
                          {(fb.replies || []).map((reply: any, idx: number) => (
                            <View key={reply.id || idx} style={s.replyCard}>
                              <View style={s.replyCardHeader}>
                                <View style={s.adminAvatar}>
                                  <Ionicons name="shield-checkmark" size={14} color="#7C3AED" />
                                </View>
                                <Text style={s.replyAdminName}>{reply.admin_name || 'Admin'}</Text>
                                <Text style={s.replyDate}>
                                  {new Date(reply.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                              </View>
                              <Text style={s.replyMessage} selectable>{reply.message}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={s.noReplySection}>
                          <Ionicons name="time-outline" size={32} color="#3A3A5A" />
                          <Text style={s.noReplyTitle}>{t('myFeedback.noReplyYet')}</Text>
                          <Text style={s.noReplyDesc}>{t('myFeedback.noReplyDesc')}</Text>
                        </View>
                      )}
                    </ScrollView>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  newBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: '#6B6B80', textAlign: 'center', maxWidth: 280, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Card
  card: { backgroundColor: '#0D0D1A', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1A1A2E' },
  cardWithReply: { borderColor: 'rgba(16,185,129,0.3)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  replyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  replyBadgeText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  starsRow: { flexDirection: 'row', gap: 2, marginLeft: 'auto' },
  cardMessage: { fontSize: 14, color: '#D1D1E0', lineHeight: 20, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDate: { fontSize: 12, color: '#5A5A6E' },
  viewReplyHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewReplyText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  pendingText: { fontSize: 12, color: '#5A5A6E', fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#0D0D1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', borderWidth: 1, borderColor: '#2A2A4E', borderBottomWidth: 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A2E', gap: 10 },
  modalDate: { flex: 1, fontSize: 12, color: '#6B6B80' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },

  // Original
  originalSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  originalMessage: { fontSize: 15, color: '#E5E5EA', lineHeight: 24 },

  // Replies
  repliesSection: { borderTopWidth: 1, borderTopColor: '#1A1A2E', paddingTop: 20 },
  repliesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  replyCard: { backgroundColor: '#151530', borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  replyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  adminAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' },
  replyAdminName: { fontSize: 14, fontWeight: '700', color: '#A78BFA', flex: 1 },
  replyDate: { fontSize: 11, color: '#5A5A6E' },
  replyMessage: { fontSize: 15, color: '#E5E5EA', lineHeight: 24 },

  // No Reply
  noReplySection: { alignItems: 'center', paddingVertical: 32, borderTopWidth: 1, borderTopColor: '#1A1A2E', marginTop: 10 },
  noReplyTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 12, marginBottom: 4 },
  noReplyDesc: { fontSize: 13, color: '#6B6B80', textAlign: 'center', maxWidth: 280 },
});
