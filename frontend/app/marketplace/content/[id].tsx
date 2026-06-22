import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../utils/api';
import QuizPlayer from '../../../components/QuizPlayer';
import { useTranslation } from '../../../store/languageStore';

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  description?: string;
  file_url?: string;
  video_url?: string;
  is_available?: boolean;
  available_from?: string;
  content_data?: {
    url?: string;
    meeting_link?: string;
    duration_minutes?: number;
    file_url?: string;
    questions?: any[];
  };
}

interface PurchaseAccess {
  purchase: any;
  offer: any;
  contents: ContentItem[];
}

const CONTENT_CONFIG: Record<string, { icon: string; color: string; label: string; gradient: string[] }> = {
  pdf: { icon: 'document-text', color: '#EF4444', label: 'PDF', gradient: ['#EF4444', '#DC2626'] },
  video: { icon: 'play-circle', color: '#3B82F6', label: 'Video', gradient: ['#3B82F6', '#2563EB'] },
  audio: { icon: 'headset', color: '#8B5CF6', label: 'Audio', gradient: ['#8B5CF6', '#7C3AED'] },
  session: { icon: 'videocam', color: '#10B981', label: 'Session', gradient: ['#10B981', '#059669'] },
  quiz: { icon: 'help-circle', color: '#F59E0B', label: 'Quiz', gradient: ['#F59E0B', '#D97706'] },
  template: { icon: 'copy', color: '#EC4899', label: 'Template', gradient: ['#EC4899', '#DB2777'] },
  link: { icon: 'link', color: '#06B6D4', label: 'Link', gradient: ['#06B6D4', '#0891B2'] },
  text: { icon: 'document', color: '#6B7280', label: 'Article', gradient: ['#6B7280', '#4B5563'] },
};

export default function PurchaseContentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PurchaseAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quizVisible, setQuizVisible] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<ContentItem | null>(null);

  useEffect(() => {
    loadPurchaseAccess();
  }, [id]);

  const loadPurchaseAccess = async () => {
    try {
      const response = await api.get(`/marketplace/purchases/${id}/access`);
      // API returns { success: true, data: { offer, contents, ... } }
      setData(response.data?.data || response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('purchaseContent.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const getContentConfig = (type: string) => {
    return CONTENT_CONFIG[type] || CONTENT_CONFIG.text;
  };

  const formatAvailableDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  const handleOpenContent = async (content: ContentItem) => {
    // Block access if content is not yet available
    if (content.is_available === false) {
      Alert.alert(
        t('purchaseContent.contentLocked'),
        t('purchaseContent.availableOn', { date: formatAvailableDate(content.available_from || '') })
      );
      return;
    }

    // Check all possible URL locations
    const url = content.content_data?.url || 
                content.content_data?.file_url || 
                content.content_data?.meeting_link ||
                content.file_url ||
                content.video_url;
    
    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        Alert.alert(t('marketplace.error'), t('purchaseContent.openError'));
      }
    } else if (content.content_type === 'quiz' && content.content_data?.questions) {
      setSelectedQuiz(content);
      setQuizVisible(true);
    } else {
      Alert.alert(
        t('purchaseContent.notAvailable'),
        t('purchaseContent.notConfigured')
      );
    }
  };

  const getContentUrl = (content: ContentItem): string | null => {
    return content.content_data?.url || 
           content.content_data?.file_url || 
           content.content_data?.meeting_link ||
           content.file_url ||
           content.video_url ||
           null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>{t('purchaseContent.accessDenied')}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryText}>{t('purchaseContent.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <LinearGradient
        colors={['#7C3AED', '#5B21B6', '#1E1B4B']}
        style={styles.heroGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.heroContent}>
            <View style={styles.offerBadge}>
              <Ionicons name="diamond" size={14} color="#FFD700" />
              <Text style={styles.offerBadgeText}>{t('purchaseContent.premiumContent')}</Text>
            </View>
            <Text style={styles.heroTitle}>{data.offer?.title}</Text>
            <Text style={styles.heroSubtitle}>{t('purchaseContent.contentsIncluded', { count: String(data.contents?.length || 0) })}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <LinearGradient colors={['#7C3AED20', '#7C3AED10']} style={styles.statBg}>
              <Ionicons name="cube" size={24} color="#7C3AED" />
              <Text style={styles.statValue}>{data.contents?.length || 0}</Text>
              <Text style={styles.statLabel}>{t('purchaseContent.contents')}</Text>
            </LinearGradient>
          </View>
          <View style={styles.statItem}>
            <LinearGradient colors={['#10B98120', '#10B98110']} style={styles.statBg}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.statValue}>{t('purchaseContent.active')}</Text>
              <Text style={styles.statLabel}>{t('purchaseContent.status')}</Text>
            </LinearGradient>
          </View>
          <View style={styles.statItem}>
            <LinearGradient colors={['#F59E0B20', '#F59E0B10']} style={styles.statBg}>
              <Ionicons name="infinite" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>∞</Text>
              <Text style={styles.statLabel}>{t('purchaseContent.access')}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Content List */}
        <Text style={styles.sectionTitle}>{t('purchaseContent.yourContents')}</Text>
        
        {data.contents?.map((content, index) => {
          const config = getContentConfig(content.content_type);
          const contentUrl = getContentUrl(content);
          const isQuiz = content.content_type === 'quiz';
          const isLocked = content.is_available === false;
          
          return (
            <TouchableOpacity
              key={content.id}
              style={[styles.contentCard, isLocked && styles.contentCardLocked]}
              onPress={() => handleOpenContent(content)}
              activeOpacity={0.7}
              data-testid={`content-item-${content.id}`}
            >
              <LinearGradient
                colors={isLocked ? ['#4B5563', '#374151'] : config.gradient}
                style={styles.contentIconBg}
              >
                <Ionicons name={isLocked ? 'lock-closed' : config.icon as any} size={28} color="#FFFFFF" />
              </LinearGradient>
              
              <View style={styles.contentInfo}>
                <Text style={[styles.contentTitle, isLocked && { color: '#6B7280' }]}>{content.title}</Text>
                <View style={styles.contentMeta}>
                  <Text style={[styles.contentType, { color: isLocked ? '#6B7280' : config.color }]}>
                    {config.label}
                  </Text>
                  {content.content_data?.duration_minutes && (
                    <View style={styles.durationBadge}>
                      <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.durationText}>
                        {content.content_data.duration_minutes} min
                      </Text>
                    </View>
                  )}
                </View>
                {isLocked && content.available_from ? (
                  <View style={styles.lockedBadge}>
                    <Ionicons name="calendar-outline" size={12} color="#F59E0B" />
                    <Text style={styles.lockedText}>
                      {t('purchaseContent.availableFrom', { date: formatAvailableDate(content.available_from) })}
                    </Text>
                  </View>
                ) : content.description ? (
                  <Text style={styles.contentDesc} numberOfLines={2}>
                    {content.description}
                  </Text>
                ) : null}
              </View>
              
              {/* Action Button */}
              <LinearGradient
                colors={isLocked ? ['#6B7280', '#4B5563'] : contentUrl ? ['#7C3AED', '#5B21B6'] : isQuiz ? ['#F59E0B', '#D97706'] : ['#4B5563', '#374151']}
                style={styles.actionButton}
              >
                <Ionicons 
                  name={isLocked ? 'lock-closed' : contentUrl ? 'open-outline' : isQuiz ? 'help-circle' : 'alert-circle'} 
                  size={18} 
                  color="#FFFFFF" 
                />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        {/* Session Meeting Links */}
        {data.contents?.some(c => c.content_data?.meeting_link) && (
          <View style={styles.meetingSection}>
            <LinearGradient
              colors={['#10B98120', '#10B98110']}
              style={styles.meetingCard}
            >
              <View style={styles.meetingHeader}>
                <Ionicons name="videocam" size={24} color="#10B981" />
                <Text style={styles.meetingTitle}>{t('purchaseContent.sessionLinks')}</Text>
              </View>
              {data.contents
                .filter(c => c.content_data?.meeting_link)
                .map(content => (
                  <TouchableOpacity
                    key={content.id}
                    style={styles.meetingLink}
                    onPress={() => Linking.openURL(content.content_data!.meeting_link!)}
                  >
                    <Text style={styles.meetingLinkTitle}>{content.title}</Text>
                    <View style={styles.joinButton}>
                      <Text style={styles.joinButtonText}>{t('purchaseContent.join')}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quiz Player Modal */}
      {selectedQuiz && (
        <QuizPlayer
          visible={quizVisible}
          onClose={() => {
            setQuizVisible(false);
            setSelectedQuiz(null);
          }}
          title={selectedQuiz.title}
          questions={selectedQuiz.content_data?.questions || []}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 12,
  },
  offerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#0A0A1A',
    paddingTop: 24,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
  },
  statBg: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  contentCardLocked: {
    opacity: 0.7,
    borderColor: '#4B556330',
  },
  contentIconBg: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentInfo: {
    flex: 1,
    marginLeft: 14,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  contentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contentType: {
    fontSize: 13,
    fontWeight: '500',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  contentDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#F59E0B15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  lockedText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124,58,237,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(107,114,128,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  meetingCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  meetingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  meetingLinkTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
