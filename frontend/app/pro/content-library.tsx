import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { proAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';

interface ContentItem {
  id: string;
  content_type: 'pdf' | 'video' | 'quiz' | 'audio' | 'text' | 'checklist';
  title: string;
  description?: string;
  content_data?: any;
  file_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_minutes?: number;
  tags: string[];
  is_premium: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const CONTENT_TYPES = [
  { id: 'pdf', labelKey: 'contentLib.typeDocumentPdf', icon: 'document-text', color: '#EF4444' },
  { id: 'video', labelKey: 'contentLib.typeVideo', icon: 'videocam', color: '#8B5CF6' },
  { id: 'quiz', labelKey: 'contentLib.typeQuiz', icon: 'help-circle', color: '#3B82F6' },
  { id: 'audio', labelKey: 'contentLib.typeAudio', icon: 'musical-notes', color: '#10B981' },
  { id: 'text', label: 'Article', icon: 'reader', color: '#F59E0B' },
  { id: 'checklist', labelKey: 'contentLib.typeChecklist', icon: 'checkbox', color: '#EC4899' },
];

export default function ContentLibraryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  
  const [form, setForm] = useState({
    content_type: 'pdf' as ContentItem['content_type'],
    title: '',
    description: '',
    file_url: '',
    video_url: '',
    duration_minutes: '',
    tags: '',
    is_premium: false,
    content_data: {} as any,
  });

  // Quiz form state
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    question: string;
    options: string[];
    correct_answer: number;
  }>>([{ question: '', options: ['', '', '', ''], correct_answer: 0 }]);

  const loadContent = useCallback(async () => {
    try {
      const response = await proAPI.getContentLibrary();
      setContents(response.data.data || []);
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadContent();
  };

  const resetForm = () => {
    setForm({
      content_type: 'pdf',
      title: '',
      description: '',
      file_url: '',
      video_url: '',
      duration_minutes: '',
      tags: '',
      is_premium: false,
      content_data: {},
    });
    setQuizQuestions([{ question: '', options: ['', '', '', ''], correct_answer: 0 }]);
    setEditingContent(null);
  };

  const handleOpenModal = (content?: ContentItem) => {
    if (content) {
      setEditingContent(content);
      setForm({
        content_type: content.content_type,
        title: content.title,
        description: content.description || '',
        file_url: content.file_url || '',
        video_url: content.video_url || '',
        duration_minutes: content.duration_minutes?.toString() || '',
        tags: content.tags.join(', '),
        is_premium: content.is_premium,
        content_data: content.content_data || {},
      });
      if (content.content_type === 'quiz' && content.content_data?.questions) {
        setQuizQuestions(content.content_data.questions);
      }
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSaveContent = async () => {
    if (!form.title.trim()) {
      Alert.alert(t('catalog.error'), t('catalog.titleRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const data: any = {
        content_type: form.content_type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        file_url: form.file_url.trim() || undefined,
        video_url: form.video_url.trim() || undefined,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_premium: form.is_premium,
      };

      // Handle quiz data
      if (form.content_type === 'quiz') {
        const validQuestions = quizQuestions.filter(q => 
          q.question.trim() && q.options.some(o => o.trim())
        );
        if (validQuestions.length === 0) {
          Alert.alert(t('catalog.error'), t('catalog.addValidQuestion'));
          setActionLoading(false);
          return;
        }
        data.content_data = { questions: validQuestions };
      }

      if (editingContent) {
        await proAPI.updateContentItem(editingContent.id, data);
      } else {
        await proAPI.createContentItem(data);
      }

      setShowModal(false);
      resetForm();
      loadContent();
      Alert.alert(t('settings.success'), editingContent ? t('catalog.genericError') : t('settings.success'));
    } catch (error: any) {
      Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteContent = (contentId: string) => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await proAPI.deleteContentItem(contentId);
              loadContent();
              Alert.alert(t('settings.success'), t('admin.postDeleted'));
            } catch (error: any) {
              Alert.alert(t('catalog.error'), error.response?.data?.detail || t('catalog.genericError'));
            }
          },
        },
      ]
    );
  };

  const getTypeConfig = (type: string) => {
    return CONTENT_TYPES.find(t => t.id === type) || CONTENT_TYPES[0];
  };

  const filteredContents = filterType === 'all' 
    ? contents 
    : contents.filter(c => c.content_type === filterType);

  const addQuizQuestion = () => {
    setQuizQuestions([...quizQuestions, { question: '', options: ['', '', '', ''], correct_answer: 0 }]);
  };

  const updateQuizQuestion = (index: number, field: string, value: any) => {
    const updated = [...quizQuestions];
    if (field === 'question') {
      updated[index].question = value;
    } else if (field === 'correct_answer') {
      updated[index].correct_answer = value;
    }
    setQuizQuestions(updated);
  };

  const updateQuizOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...quizQuestions];
    updated[qIndex].options[oIndex] = value;
    setQuizQuestions(updated);
  };

  const removeQuizQuestion = (index: number) => {
    if (quizQuestions.length > 1) {
      setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t("contentLibrary.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('contentLib.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('contentLib.elementsCount', { count: String(contents.length) })}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleOpenModal()} 
          style={styles.addButton}
          data-testid="add-content-btn"
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
            Tous ({contents.length})
          </Text>
        </TouchableOpacity>
        {CONTENT_TYPES.map(type => {
          const count = contents.filter(c => c.content_type === type.id).length;
          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.filterChip, filterType === type.id && styles.filterChipActive]}
              onPress={() => setFilterType(type.id)}
            >
              <Ionicons 
                name={type.icon as any} 
                size={14} 
                color={filterType === type.id ? '#FFF' : type.color} 
              />
              <Text style={[styles.filterChipText, filterType === type.id && styles.filterChipTextActive]}>
                {type.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content List */}
      <ScrollView
        style={styles.contentList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {filteredContents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyTitle}>{t('contentLib.noContent')}</Text>
            <Text style={styles.emptyText}>
              {t('contentLib.createFirstContent')}
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => handleOpenModal()}
              data-testid="create-first-content-btn"
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>{t('contentLib.createContent')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredContents.map(content => {
            const typeConfig = getTypeConfig(content.content_type);
            return (
              <TouchableOpacity 
                key={content.id} 
                style={styles.contentCard}
                onPress={() => handleOpenModal(content)}
                data-testid={`content-item-${content.id}`}
              >
                <View style={[styles.contentIcon, { backgroundColor: typeConfig.color + '20' }]}>
                  <Ionicons name={typeConfig.icon as any} size={24} color={typeConfig.color} />
                </View>
                <View style={styles.contentInfo}>
                  <View style={styles.contentHeader}>
                    <Text style={styles.contentTitle} numberOfLines={1}>{content.title}</Text>
                    {content.is_premium && (
                      <View style={styles.premiumBadge}>
                        <Ionicons name="star" size={10} color="#F59E0B" />
                        <Text style={styles.premiumText}>{t("contentLibrary.premium")}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.contentType}>{typeConfig.label}</Text>
                  {content.description && (
                    <Text style={styles.contentDesc} numberOfLines={2}>{content.description}</Text>
                  )}
                  <View style={styles.contentMeta}>
                    {content.duration_minutes && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.metaText}>{content.duration_minutes} min</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="link-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.metaText}>{content.usage_count} utilisations</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteContent(content.id);
                  }}
                  data-testid={`delete-content-${content.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingContent ? t('contentLib.editContent') : t('contentLib.newContent')}
            </Text>
            <TouchableOpacity 
              onPress={handleSaveContent} 
              disabled={actionLoading}
              data-testid="save-content-btn"
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Content Type Selection */}
            <Text style={styles.fieldLabel}>Type de contenu</Text>
            <View style={styles.typeGrid}>
              {CONTENT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeOption,
                    form.content_type === type.id && { borderColor: type.color, backgroundColor: type.color + '10' }
                  ]}
                  onPress={() => setForm({ ...form, content_type: type.id as any })}
                  data-testid={`content-type-${type.id}`}
                >
                  <Ionicons name={type.icon as any} size={24} color={type.color} />
                  <Text style={[styles.typeLabel, form.content_type === type.id && { color: type.color }]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title */}
            <Text style={styles.fieldLabel}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
              placeholder="Ex: Guide complet du trading crypto"
              placeholderTextColor="#9CA3AF"
              data-testid="content-title-input"
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>{t('contentLib.description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              placeholder={t('contentLib.descPlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />

            {/* Type-specific fields */}
            {(form.content_type === 'pdf' || form.content_type === 'audio') && (
              <>
                <Text style={styles.fieldLabel}>{t('contentLib.fileUrl')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.file_url}
                  onChangeText={(text) => setForm({ ...form, file_url: text })}
                  placeholder="https://..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </>
            )}

            {form.content_type === 'video' && (
              <>
                <Text style={styles.fieldLabel}>{t('contentLib.videoUrl')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.video_url}
                  onChangeText={(text) => setForm({ ...form, video_url: text })}
                  placeholder="https://youtube.com/... ou lien direct"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </>
            )}

            {(form.content_type === 'video' || form.content_type === 'audio') && (
              <>
                <Text style={styles.fieldLabel}>{t('contentLib.durationMinutes')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.duration_minutes}
                  onChangeText={(text) => setForm({ ...form, duration_minutes: text.replace(/[^0-9]/g, '') })}
                  placeholder="30"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </>
            )}

            {/* Quiz Builder */}
            {form.content_type === 'quiz' && (
              <View style={styles.quizBuilder}>
                <Text style={styles.sectionTitle}>{t('contentLib.quizQuestions')}</Text>
                {quizQuestions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.questionNumber}>Question {qIndex + 1}</Text>
                      {quizQuestions.length > 1 && (
                        <TouchableOpacity onPress={() => removeQuizQuestion(qIndex)}>
                          <Ionicons name="close-circle" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.input}
                      value={q.question}
                      onChangeText={(text) => updateQuizQuestion(qIndex, 'question', text)}
                      placeholder={t('contentLib.questionPlaceholder')}
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.optionsLabel}>{t('contentLib.answerOptions')}</Text>
                    {q.options.map((option, oIndex) => (
                      <View key={oIndex} style={styles.optionRow}>
                        <TouchableOpacity
                          style={[
                            styles.radioButton,
                            q.correct_answer === oIndex && styles.radioButtonSelected
                          ]}
                          onPress={() => updateQuizQuestion(qIndex, 'correct_answer', oIndex)}
                        >
                          {q.correct_answer === oIndex && (
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          )}
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.input, styles.optionInput]}
                          value={option}
                          onChangeText={(text) => updateQuizOption(qIndex, oIndex, text)}
                          placeholder={`Option ${oIndex + 1}`}
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    ))}
                  </View>
                ))}
                <TouchableOpacity style={styles.addQuestionButton} onPress={addQuizQuestion}>
                  <Ionicons name="add-circle" size={20} color="#7C3AED" />
                  <Text style={styles.addQuestionText}>{t('contentLib.addQuestion')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tags */}
            <Text style={styles.fieldLabel}>{t('contentLib.tags')}</Text>
            <TextInput
              style={styles.input}
              value={form.tags}
              onChangeText={(text) => setForm({ ...form, tags: text })}
              placeholder={t('contentLib.tagsPlaceholder')}
              placeholderTextColor="#9CA3AF"
            />

            {/* Premium Toggle */}
            <TouchableOpacity
              style={styles.premiumToggle}
              onPress={() => setForm({ ...form, is_premium: !form.is_premium })}
            >
              <View style={styles.premiumToggleInfo}>
                <Ionicons name="star" size={20} color={form.is_premium ? '#F59E0B' : '#6B7280'} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.premiumToggleTitle}>{t('contentLib.premiumContent')}</Text>
                  <Text style={styles.premiumToggleDesc}>
                    {t('contentLib.premiumDesc')}
                  </Text>
                </View>
              </View>
              <View style={[styles.toggle, form.is_premium && styles.toggleActive]}>
                <View style={[styles.toggleThumb, form.is_premium && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    maxHeight: 50,
    backgroundColor: '#1A1A1A',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
  },
  filterChipText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  contentList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  contentCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  contentIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  premiumText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
  },
  contentType: {
    fontSize: 12,
    color: '#7C3AED',
    marginTop: 2,
  },
  contentDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  contentMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  saveButtonText: {
    color: '#7C3AED',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeOption: {
    width: '31%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  typeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
  quizBuilder: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  questionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  optionsLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  optionInput: {
    flex: 1,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    gap: 8,
  },
  addQuestionText: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  premiumToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  premiumToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumToggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  premiumToggleDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3A3A3A',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#7C3AED',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
});
