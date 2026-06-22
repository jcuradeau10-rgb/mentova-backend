import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { courseAPI } from '../../../utils/api';
import { useAuthStore } from '../../../store/authStore';
import { useTranslation } from '../../../store/languageStore';

const { width } = Dimensions.get('window');

interface Module {
  id: string;
  title: string;
  description: string;
  lessons_count?: number;
  has_quiz?: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail_url?: string;
  pro_id: string;
  pro_name: string;
  category: string;
  difficulty: string;
  total_students: number;
  average_rating?: number;
  reviews_count?: number;
  modules?: Module[];
  total_duration_minutes?: number;
  what_you_will_learn?: string[];
  requirements?: string[];
}

interface Review {
  id: string;
  user_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export default function CourseDetailScreen() {
  const router = useRouter();
  const { id: courseId } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const loadCourse = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await courseAPI.getCoursePublic(courseId);
      if (res.data.success) {
        setCourse(res.data.data);
      }
      
      // Load reviews
      const reviewsRes = await courseAPI.getCourseReviews(courseId, { limit: 5 });
      if (reviewsRes.data.success) {
        setReviews(reviewsRes.data.data);
      }
      
      // Check enrollment status
      if (isAuthenticated) {
        try {
          const enrollmentsRes = await courseAPI.getMyEnrollments();
          if (enrollmentsRes.data.success) {
            const enrolled = enrollmentsRes.data.data.some(
              (e: any) => e.course_id === courseId && e.status === 'active'
            );
            setIsEnrolled(enrolled);
          }
        } catch {}
      }
    } catch (error) {
      console.error('Error loading course:', error);
      Alert.alert(t('catalog.error'), t('catalog.genericError'));
    } finally {
      setLoading(false);
    }
  }, [courseId, isAuthenticated]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      Alert.alert(t('marketplace.loginRequired'), t('marketplace.loginToPurchase'), [
        { text: t('marketplace.cancel'), style: 'cancel' },
        { text: t('marketplace.signIn'), onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    // Check VIP status
    if (!user?.is_vip) {
      Alert.alert(
        t('marketplace.vipRequired'),
        t('marketplace.vipRequiredMsg'),
        [
          { text: t('marketplace.cancel'), style: 'cancel' },
          { text: t('marketplace.becomeVip'), onPress: () => router.push('/vip') },
        ]
      );
      return;
    }

    setEnrolling(true);
    try {
      const res = await courseAPI.enrollInCourse(courseId!, 'single');
      if (res.data.success) {
        if (res.data.checkout_url) {
          // Redirect to Stripe
          Linking.openURL(res.data.checkout_url);
        } else {
          // Free course - auto enrolled
          Alert.alert(t('settings.success'), t('settings.success'));
          setIsEnrolled(true);
        }
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('catalog.genericError');
      if (errorMsg.includes('VIP')) {
        Alert.alert(t('marketplace.vipRequired'), errorMsg, [
          { text: t('marketplace.cancel'), style: 'cancel' },
          { text: t('marketplace.becomeVip'), onPress: () => router.push('/vip') },
        ]);
      } else {
        Alert.alert(t('catalog.error'), errorMsg);
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartLearning = () => {
    router.push(`/courses/${courseId}/learn`);
  };

  const getDifficultyInfo = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return { label: t('courseDetail.levelBeginner'), color: '#10B981' };
      case 'intermediate': return { label: t('courseDetail.levelIntermediate'), color: '#F59E0B' };
      case 'advanced': return { label: t('courseDetail.levelAdvanced'), color: '#EF4444' };
      default: return { label: difficulty, color: '#6B7280' };
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= Math.round(rating) ? 'star' : 'star-outline'}
            size={16}
            color="#F59E0B"
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>{t("courseDetail.loading")}</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>{t('courseDetail.notFound')}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("common.back")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const difficultyInfo = getDifficultyInfo(course.difficulty);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.shareBtn}>
            <Ionicons name="share-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Thumbnail */}
          <View style={styles.thumbnailContainer}>
            {course.thumbnail_url ? (
              <Image source={{ uri: course.thumbnail_url }} style={styles.thumbnail} />
            ) : (
              <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.thumbnailPlaceholder}>
                <Ionicons name="school" size={64} color="#FFF" />
              </LinearGradient>
            )}
            <View style={styles.playOverlay}>
              <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.9)" />
            </View>
          </View>

          {/* Course Info */}
          <View style={styles.courseInfo}>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: difficultyInfo.color }]}>
                <Text style={styles.badgeText}>{difficultyInfo.label}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{course.category}</Text>
              </View>
            </View>

            <Text style={styles.courseTitle}>{course.title}</Text>
            
            <TouchableOpacity style={styles.instructorRow}>
              <View style={styles.instructorAvatar}>
                <Text style={styles.instructorAvatarText}>{course.pro_name.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.instructorLabel}>Instructeur</Text>
                <Text style={styles.instructorName}>{course.pro_name}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={20} color="#9CA3AF" />
                <Text style={styles.statValue}>{course.total_students}</Text>
                <Text style={styles.statLabel}>{t('courseDetail.students')}</Text>
              </View>
              {course.average_rating && (
                <View style={styles.statItem}>
                  <Ionicons name="star" size={20} color="#F59E0B" />
                  <Text style={styles.statValue}>{course.average_rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>({course.reviews_count} avis)</Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Ionicons name="library" size={20} color="#9CA3AF" />
                <Text style={styles.statValue}>{course.modules?.length || 0}</Text>
                <Text style={styles.statLabel}>modules</Text>
              </View>
            </View>

            <Text style={styles.description}>{course.description}</Text>

            {/* What you'll learn */}
            {course.what_you_will_learn && course.what_you_will_learn.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ce que vous apprendrez</Text>
                {course.what_you_will_learn.map((item, index) => (
                  <View key={index} style={styles.learnItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.learnText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Course Content */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("courseDetail.courseContent")}</Text>
              {course.modules?.map((module, index) => (
                <TouchableOpacity
                  key={module.id}
                  style={styles.moduleItem}
                  onPress={() => {
                    setExpandedModules(prev =>
                      prev.includes(module.id)
                        ? prev.filter(id => id !== module.id)
                        : [...prev, module.id]
                    );
                  }}
                >
                  <View style={styles.moduleNumber}>
                    <Text style={styles.moduleNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.moduleInfo}>
                    <Text style={styles.moduleTitle}>{module.title}</Text>
                    <Text style={styles.moduleDesc}>{module.description}</Text>
                    <View style={styles.moduleMeta}>
                      {module.lessons_count && (
                        <Text style={styles.moduleMetaText}>
                          {t('courseDetail.lessonsCount', { count: String(module.lessons_count) })}
                        </Text>
                      )}
                      {module.has_quiz && (
                        <View style={styles.quizBadge}>
                          <Ionicons name="help-circle" size={12} color="#F59E0B" />
                          <Text style={styles.quizBadgeText}>{t("courseDetail.quiz")}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={expandedModules.includes(module.id) ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Reviews */}
            {reviews.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('courseDetail.studentReviews')}</Text>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{review.user_name.charAt(0)}</Text>
                      </View>
                      <View style={styles.reviewInfo}>
                        <Text style={styles.reviewName}>{review.user_name}</Text>
                        {renderStars(review.rating)}
                      </View>
                    </View>
                    {review.comment && (
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 120 }} />
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>{t("courseDetail.price")}</Text>
            <Text style={styles.price}>
              {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Gratuit'}
            </Text>
            {!user?.is_vip && (
              <View style={styles.vipRequired}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.vipRequiredText}>VIP requis</Text>
              </View>
            )}
          </View>
          
          {isEnrolled ? (
            <TouchableOpacity style={styles.startBtn} onPress={handleStartLearning}>
              <Ionicons name="play" size={20} color="#FFF" />
              <Text style={styles.startBtnText}>Continuer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.enrollBtn, enrolling && styles.enrollBtnDisabled]}
              onPress={handleEnroll}
              disabled={enrolling}
            >
              {enrolling ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name={user?.is_vip ? "cart" : "star"} size={20} color="#FFF" />
                  <Text style={styles.enrollBtnText}>
                    {user?.is_vip 
                      ? (course.price > 0 ? 'Acheter maintenant' : 'S\'inscrire gratuitement')
                      : 'Devenir VIP'
                    }
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#9CA3AF', marginTop: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  errorTitle: { fontSize: 20, fontWeight: '600', color: '#FFF', marginTop: 16 },
  backButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(124, 58, 237, 0.2)', borderRadius: 12 },
  backButtonText: { color: '#A78BFA', fontWeight: '600' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollView: { flex: 1 },

  thumbnailContainer: {
    width: width,
    height: 250,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  courseInfo: {
    padding: 20,
    marginTop: -20,
    backgroundColor: '#0a0a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  badges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge: { backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#FFF' },

  courseTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', marginBottom: 16 },

  instructorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  instructorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  instructorAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  instructorLabel: { fontSize: 12, color: '#6B7280' },
  instructorName: { fontSize: 16, fontWeight: '600', color: '#FFF' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24, paddingVertical: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 4 },
  statLabel: { fontSize: 12, color: '#6B7280' },

  description: { fontSize: 15, lineHeight: 24, color: '#D1D5DB', marginBottom: 24 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 16 },

  learnItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  learnText: { flex: 1, fontSize: 14, color: '#D1D5DB', lineHeight: 20 },

  moduleItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 8 },
  moduleNumber: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  moduleNumberText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  moduleInfo: { flex: 1, marginLeft: 12 },
  moduleTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  moduleDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  moduleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  moduleMetaText: { fontSize: 12, color: '#6B7280' },
  quizBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  quizBadgeText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },

  reviewItem: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  reviewInfo: { marginLeft: 12 },
  reviewName: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  starsContainer: { flexDirection: 'row', marginTop: 4 },
  reviewComment: { fontSize: 14, color: '#D1D5DB', lineHeight: 20 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(10, 10, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  priceContainer: { flex: 1 },
  priceLabel: { fontSize: 12, color: '#6B7280' },
  price: { fontSize: 24, fontWeight: '800', color: '#10B981' },
  vipRequired: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  vipRequiredText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },

  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  enrollBtnDisabled: { opacity: 0.7 },
  enrollBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
