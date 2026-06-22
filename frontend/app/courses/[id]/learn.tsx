import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { courseAPI } from '../../../utils/api';
import { useAuthStore } from '../../../store/authStore';
import { useTranslation } from '../../../store/languageStore';

import GlossaryText from '../../../components/GlossaryText';

const { width } = Dimensions.get('window');

interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  explanation?: string;
}

interface Quiz {
  id: string;
  title: string;
  passing_score: number;
  questions: QuizQuestion[];
}

interface Lesson {
  id: string;
  title: string;
  content: string;
  video_url?: string;
  duration_minutes: number;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
  quiz?: Quiz;
}

interface Course {
  id: string;
  title: string;
  description: string;
  pro_name: string;
  modules: Module[];
  enrollment: {
    id: string;
    progress: {
      completed_lessons: string[];
      completed_modules: string[];
      quiz_results: Record<string, any>;
      percent_complete: number;
    };
  };
  resources: any[];
}

export default function CourseLearningScreen() {
  const router = useRouter();
  const { id: courseId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<any[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [discussionInput, setDiscussionInput] = useState('');

  const loadCourse = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await courseAPI.getCourseContent(courseId);
      if (res.data.success) {
        setCourse(res.data.data);
        // Auto-select first module and lesson
        if (res.data.data.modules?.length > 0) {
          setSelectedModule(res.data.data.modules[0]);
          if (res.data.data.modules[0].lessons?.length > 0) {
            setSelectedLesson(res.data.data.modules[0].lessons[0]);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading course:', error);
      if (error.response?.status === 403) {
        Alert.alert(t('courseLearn.accessDenied'), t('courseLearn.mustBeEnrolled'));
        router.back();
      }
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const isLessonCompleted = (lessonId: string) => {
    return course?.enrollment?.progress?.completed_lessons?.includes(lessonId);
  };

  const isModuleCompleted = (moduleId: string) => {
    return course?.enrollment?.progress?.completed_modules?.includes(moduleId);
  };

  const handleMarkComplete = async () => {
    if (!selectedLesson || !courseId) return;
    try {
      await courseAPI.markLessonComplete(courseId, selectedLesson.id);
      loadCourse();
      Alert.alert(t('courseLearn.congratulations'), t('courseLearn.lessonCompleted'));
    } catch (error) {
      console.error('Error marking complete:', error);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!selectedModule?.quiz || !courseId) return;
    setQuizSubmitting(true);
    try {
      const res = await courseAPI.submitQuiz(courseId, selectedModule.id, quizAnswers);
      if (res.data.success) {
        setQuizResults(res.data);
        if (res.data.passed) {
          Alert.alert(t('courseLearn.bravo'), t('courseLearn.scoreResult', { score: String(res.data.score) }));
        } else {
          Alert.alert('Dommage', `Score: ${res.data.score}%. Score requis: ${selectedModule.quiz.passing_score}%`);
        }
        loadCourse();
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      Alert.alert(t('catalog.error'), t('catalog.genericError'));
    } finally {
      setQuizSubmitting(false);
    }
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.sidebarTitle} numberOfLines={2}>{course?.title}</Text>
      </View>
      
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${course?.enrollment?.progress?.percent_complete || 0}%` }]} />
      </View>
      <Text style={styles.progressText}>{t('courseLearn.completed', { percent: String(course?.enrollment?.progress?.percent_complete || 0) })}</Text>

      <ScrollView style={styles.modulesList}>
        {course?.modules?.map((module, index) => (
          <View key={module.id} style={styles.moduleItem}>
            <TouchableOpacity
              style={[
                styles.moduleHeader,
                selectedModule?.id === module.id && styles.moduleHeaderActive
              ]}
              onPress={() => {
                setSelectedModule(module);
                setShowQuiz(false);
                if (module.lessons?.length > 0) {
                  setSelectedLesson(module.lessons[0]);
                }
              }}
            >
              <View style={styles.moduleNumber}>
                {isModuleCompleted(module.id) ? (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                ) : (
                  <Text style={styles.moduleNumberText}>{index + 1}</Text>
                )}
              </View>
              <Text style={styles.moduleTitle} numberOfLines={2}>{module.title}</Text>
            </TouchableOpacity>

            {selectedModule?.id === module.id && (
              <View style={styles.lessonsList}>
                {module.lessons?.map((lesson) => (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[
                      styles.lessonItem,
                      selectedLesson?.id === lesson.id && styles.lessonItemActive
                    ]}
                    onPress={() => {
                      setSelectedLesson(lesson);
                      setShowQuiz(false);
                    }}
                  >
                    {isLessonCompleted(lesson.id) ? (
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    ) : (
                      <Ionicons name="play-circle-outline" size={16} color="#9CA3AF" />
                    )}
                    <Text style={styles.lessonTitle} numberOfLines={1}>{lesson.title}</Text>
                  </TouchableOpacity>
                ))}
                
                {module.quiz && (
                  <TouchableOpacity
                    style={[
                      styles.lessonItem,
                      styles.quizItem,
                      showQuiz && selectedModule?.id === module.id && styles.lessonItemActive
                    ]}
                    onPress={() => {
                      setShowQuiz(true);
                      setQuizResults(null);
                      setQuizAnswers([]);
                    }}
                  >
                    <Ionicons name="help-circle" size={16} color="#F59E0B" />
                    <Text style={[styles.lessonTitle, { color: '#F59E0B' }]}>{t("courseLearn.quizLabel")}</Text>
                    {course?.enrollment?.progress?.quiz_results?.[module.id]?.passed && (
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderQuiz = () => {
    if (!selectedModule?.quiz) return null;
    const quiz = selectedModule.quiz;

    return (
      <ScrollView style={styles.quizContainer}>
        <Text style={styles.quizTitle}>{quiz.title}</Text>
        <Text style={styles.quizInfo}>Score minimum: {quiz.passing_score}%</Text>

        {quiz.questions.map((q, index) => (
          <View key={index} style={styles.questionCard}>
            <Text style={styles.questionNumber}>Question {index + 1}</Text>
            <Text style={styles.questionText}>{q.question}</Text>

            {q.type === 'multiple_choice' && q.options?.map((option, optIndex) => (
              <TouchableOpacity
                key={optIndex}
                style={[
                  styles.optionItem,
                  quizAnswers.find(a => a.question_index === index)?.answer === optIndex && styles.optionSelected,
                  quizResults?.results?.[index]?.is_correct === false &&
                    quizAnswers.find(a => a.question_index === index)?.answer === optIndex && styles.optionWrong,
                  quizResults?.results?.[index]?.correct_answer === optIndex && styles.optionCorrect
                ]}
                onPress={() => {
                  if (quizResults) return;
                  setQuizAnswers(prev => {
                    const filtered = prev.filter(a => a.question_index !== index);
                    return [...filtered, { question_index: index, answer: optIndex }];
                  });
                }}
                disabled={!!quizResults}
              >
                <View style={styles.optionRadio}>
                  {quizAnswers.find(a => a.question_index === index)?.answer === optIndex && (
                    <View style={styles.optionRadioSelected} />
                  )}
                </View>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}

            {q.type === 'true_false' && (
              <View style={styles.trueFalseContainer}>
                {['Vrai', 'Faux'].map((option, optIndex) => (
                  <TouchableOpacity
                    key={optIndex}
                    style={[
                      styles.trueFalseBtn,
                      quizAnswers.find(a => a.question_index === index)?.answer === (optIndex === 0) && styles.trueFalseBtnSelected
                    ]}
                    onPress={() => {
                      if (quizResults) return;
                      setQuizAnswers(prev => {
                        const filtered = prev.filter(a => a.question_index !== index);
                        return [...filtered, { question_index: index, answer: optIndex === 0 }];
                      });
                    }}
                    disabled={!!quizResults}
                  >
                    <Text style={styles.trueFalseText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {q.type === 'short_answer' && (
              <TextInput
                style={styles.shortAnswerInput}
                placeholder={t('courseLearn.answerPlaceholder')}
                placeholderTextColor="#6B7280"
                value={quizAnswers.find(a => a.question_index === index)?.answer || ''}
                onChangeText={(text) => {
                  if (quizResults) return;
                  setQuizAnswers(prev => {
                    const filtered = prev.filter(a => a.question_index !== index);
                    return [...filtered, { question_index: index, answer: text }];
                  });
                }}
                editable={!quizResults}
              />
            )}

            {quizResults?.results?.[index] && (
              <View style={[
                styles.resultBadge,
                quizResults.results[index].is_correct ? styles.resultCorrect : styles.resultWrong
              ]}>
                <Ionicons
                  name={quizResults.results[index].is_correct ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color="#FFF"
                />
                <Text style={styles.resultText}>
                  {quizResults.results[index].is_correct ? 'Correct' : 'Incorrect'}
                </Text>
              </View>
            )}

            {quizResults?.results?.[index]?.explanation && (
              <Text style={styles.explanationText}>
                {quizResults.results[index].explanation}
              </Text>
            )}
          </View>
        ))}

        {!quizResults && (
          <TouchableOpacity
            style={[styles.submitBtn, quizSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmitQuiz}
            disabled={quizSubmitting || quizAnswers.length !== quiz.questions.length}
          >
            {quizSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Soumettre le quiz</Text>
            )}
          </TouchableOpacity>
        )}

        {quizResults && (
          <View style={styles.finalScore}>
            <Text style={styles.finalScoreTitle}>{t('courseLearn.finalResult')}</Text>
            <Text style={[styles.finalScoreValue, quizResults.passed ? styles.scorePassed : styles.scoreFailed]}>
              {quizResults.score}%
            </Text>
            <Text style={styles.finalScoreStatus}>
              {quizResults.passed ? '✅ Réussi!' : '❌ Échoué - Réessayez'}
            </Text>
            {!quizResults.passed && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setQuizResults(null);
                  setQuizAnswers([]);
                }}
              >
                <Text style={styles.retryBtnText}>{t('courseLearn.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderLessonContent = () => {
    if (!selectedLesson) {
      return (
        <View style={styles.emptyContent}>
          <Ionicons name="book-outline" size={64} color="#4B5563" />
          <Text style={styles.emptyText}>{t('courseLearn.selectLesson')}</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.lessonContent}>
        <View style={styles.lessonHeader}>
          <Text style={styles.lessonHeaderTitle}>{selectedLesson.title}</Text>
          <View style={styles.lessonMeta}>
            <Ionicons name="time-outline" size={16} color="#9CA3AF" />
            <Text style={styles.lessonMetaText}>{selectedLesson.duration_minutes} min</Text>
          </View>
        </View>

        {selectedLesson.video_url && (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="play-circle" size={64} color="#8B5CF6" />
            <Text style={styles.videoText}>{t('courseLearn.videoAvailable')}</Text>
          </View>
        )}

        <GlossaryText text={selectedLesson.content} style={styles.lessonBody} />

        <View style={styles.lessonActions}>
          {!isLessonCompleted(selectedLesson.id) && (
            <TouchableOpacity style={styles.completeBtn} onPress={handleMarkComplete}>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.completeBtnText}>{t('courseLearn.markComplete')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.discussionBtn}
            onPress={() => setShowDiscussion(!showDiscussion)}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#8B5CF6" />
            <Text style={styles.discussionBtnText}>Discussion</Text>
          </TouchableOpacity>
        </View>

        {showDiscussion && (
          <View style={styles.discussionSection}>
            <Text style={styles.discussionTitle}>Discussion</Text>
            <TextInput
              style={styles.discussionInput}
              placeholder="Posez une question..."
              placeholderTextColor="#6B7280"
              value={discussionInput}
              onChangeText={setDiscussionInput}
              multiline
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={async () => {
                if (!discussionInput.trim()) return;
                try {
                  await courseAPI.createDiscussion(
                    courseId!,
                    discussionInput,
                    selectedModule?.id,
                    selectedLesson?.id
                  );
                  setDiscussionInput('');
                  Alert.alert(t('courseLearn.sent'), t('courseLearn.questionPublished'));
                } catch (error) {
                  Alert.alert(t('catalog.error'), t('catalog.genericError'));
                }
              }}
            >
              <Text style={styles.sendBtnText}>{t("courseLearn.send")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>{t("courseLearn.loadingCourse")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.layout}>
        {renderSidebar()}
        <View style={styles.mainContent}>
          {showQuiz ? renderQuiz() : renderLessonContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    backgroundColor: '#111118',
    borderRightWidth: 1,
    borderRightColor: '#1F1F2E',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F2E',
  },
  backBtn: {
    marginRight: 12,
  },
  sidebarTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#1F1F2E',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  modulesList: {
    flex: 1,
  },
  moduleItem: {
    marginBottom: 4,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  moduleHeaderActive: {
    backgroundColor: '#1F1F2E',
  },
  moduleNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D2D3D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleNumberText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  moduleTitle: {
    color: '#FFF',
    fontSize: 14,
    flex: 1,
  },
  lessonsList: {
    paddingLeft: 52,
    paddingRight: 12,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  lessonItemActive: {
    backgroundColor: '#8B5CF620',
  },
  lessonTitle: {
    color: '#D1D5DB',
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
  },
  quizItem: {
    backgroundColor: '#F59E0B10',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 16,
    fontSize: 16,
  },
  lessonContent: {
    flex: 1,
    padding: 32,
  },
  lessonHeader: {
    marginBottom: 24,
  },
  lessonHeaderTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonMetaText: {
    color: '#9CA3AF',
    marginLeft: 6,
  },
  videoPlaceholder: {
    backgroundColor: '#1F1F2E',
    borderRadius: 12,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  videoText: {
    color: '#9CA3AF',
    marginTop: 12,
  },
  lessonBody: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 28,
  },
  lessonActions: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  completeBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  discussionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF620',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  discussionBtnText: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  discussionSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#111118',
    borderRadius: 12,
  },
  discussionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  discussionInput: {
    backgroundColor: '#1F1F2E',
    borderRadius: 8,
    padding: 16,
    color: '#FFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  sendBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  quizContainer: {
    flex: 1,
    padding: 32,
  },
  quizTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  quizInfo: {
    color: '#9CA3AF',
    marginBottom: 24,
  },
  questionCard: {
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  questionNumber: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionText: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1F1F2E',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#8B5CF620',
  },
  optionCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#10B98120',
  },
  optionWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#EF444420',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4B5563',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  optionText: {
    color: '#D1D5DB',
    flex: 1,
  },
  trueFalseContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  trueFalseBtn: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1F1F2E',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  trueFalseBtnSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#8B5CF620',
  },
  trueFalseText: {
    color: '#FFF',
    fontWeight: '600',
  },
  shortAnswerInput: {
    backgroundColor: '#1F1F2E',
    borderRadius: 8,
    padding: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2D2D3D',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
    gap: 6,
  },
  resultCorrect: {
    backgroundColor: '#10B981',
  },
  resultWrong: {
    backgroundColor: '#EF4444',
  },
  resultText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  explanationText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontStyle: 'italic',
  },
  submitBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  finalScore: {
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  finalScoreTitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  finalScoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  scorePassed: {
    color: '#10B981',
  },
  scoreFailed: {
    color: '#EF4444',
  },
  finalScoreStatus: {
    color: '#FFF',
    fontSize: 18,
    marginTop: 12,
  },
  retryBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
