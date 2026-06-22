import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import api from '../utils/api';

type FeedbackType = 'improvement' | 'bug' | 'testimonial' | 'feature';

const FEEDBACK_TYPES: { id: FeedbackType; iconName: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'testimonial', iconName: 'heart', color: '#EC4899' },
  { id: 'improvement', iconName: 'bulb', color: '#F59E0B' },
  { id: 'bug', iconName: 'bug', color: '#EF4444' },
  { id: 'feature', iconName: 'rocket', color: '#3B82F6' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();

  const [selectedType, setSelectedType] = useState<FeedbackType>('testimonial');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(t('feedback.error'), t('feedback.emptyMessage'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/feedback', {
        type: selectedType,
        message: message.trim(),
        rating: selectedType === 'testimonial' ? rating : undefined,
      });
      setSubmitted(true);
    } catch (error) {
      Alert.alert(t('feedback.error'), t('feedback.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="feedback-back-btn">
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('feedback.title')}</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.successContainer} data-testid="feedback-success">
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={72} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>{t('feedback.thankYou')}</Text>
            <Text style={styles.successText}>{t('feedback.thankYouDesc')}</Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => router.back()}
              data-testid="feedback-return-btn"
            >
              <Text style={styles.successBtnText}>{t('feedback.backToApp')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="feedback-back-btn">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('feedback.title')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection} data-testid="feedback-hero">
            <View style={styles.heroIconRow}>
              <Ionicons name="chatbubble-ellipses" size={32} color="#7C3AED" />
              <Ionicons name="heart" size={28} color="#EC4899" style={{ marginLeft: -4 }} />
            </View>
            <Text style={styles.heroTitle}>{t('feedback.heroTitle')}</Text>
            <Text style={styles.heroDescription}>{t('feedback.heroDescription')}</Text>
          </View>

          {/* Importance Banner */}
          <View style={styles.importanceBanner} data-testid="feedback-importance-banner">
            <View style={styles.importanceIcon}>
              <Ionicons name="star" size={20} color="#FFD700" />
            </View>
            <View style={styles.importanceContent}>
              <Text style={styles.importanceTitle}>{t('feedback.importanceTitle')}</Text>
              <Text style={styles.importanceText}>{t('feedback.importanceText')}</Text>
            </View>
          </View>

          {/* Feedback Type Selector */}
          <Text style={styles.sectionLabel}>{t('feedback.selectType')}</Text>
          <View style={styles.typeGrid} data-testid="feedback-type-selector">
            {FEEDBACK_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && { borderColor: type.color, borderWidth: 2 },
                ]}
                onPress={() => setSelectedType(type.id)}
                activeOpacity={0.7}
                data-testid={`feedback-type-${type.id}`}
              >
                <View style={[styles.typeIconCircle, { backgroundColor: `${type.color}20` }]}>
                  <Ionicons name={type.iconName} size={22} color={type.color} />
                </View>
                <Text style={[styles.typeLabel, selectedType === type.id && { color: type.color }]}>
                  {t(`feedback.type.${type.id}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Star Rating (only for testimonials) */}
          {selectedType === 'testimonial' && (
            <View style={styles.ratingSection} data-testid="feedback-rating">
              <Text style={styles.sectionLabel}>{t('feedback.rateExperience')}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                    data-testid={`feedback-star-${star}`}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={36}
                      color={star <= rating ? '#FFD700' : '#3A3A5A'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Message Input */}
          <Text style={styles.sectionLabel}>{t('feedback.yourMessage')}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={t(`feedback.placeholder.${selectedType}`)}
              placeholderTextColor="#5A5A6E"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              data-testid="feedback-message-input"
            />
            <Text style={styles.charCount}>{message.length}/2000</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, (!message.trim() || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            activeOpacity={0.8}
            data-testid="feedback-submit-btn"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>{t('feedback.submit')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark" size={16} color="#5A5A6E" />
            <Text style={styles.privacyText}>{t('feedback.privacyNote')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 400,
  },

  // Importance Banner
  importanceBanner: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },
  importanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  importanceContent: {
    flex: 1,
  },
  importanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 4,
  },
  importanceText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },

  // Type Selector
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#111125',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A2E',
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Rating
  ratingSection: {
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // Input
  inputContainer: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: '#111125',
    borderRadius: 14,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#1A1A2E',
    lineHeight: 22,
  },
  charCount: {
    textAlign: 'right',
    color: '#5A5A6E',
    fontSize: 12,
    marginTop: 6,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Privacy
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 12,
    color: '#5A5A6E',
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successIconCircle: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 340,
  },
  successBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  successBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
