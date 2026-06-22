import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../store/languageStore';

interface Question {
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

interface QuizPlayerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  questions: Question[];
}

export default function QuizPlayer({ visible, onClose, title, questions }: QuizPlayerProps) {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset quiz state when opening
      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setScore(0);
      setAnswers(new Array(questions.length).fill(null));
      setQuizCompleted(false);
    }
  }, [visible, questions.length]);

  const question = questions[currentQuestion];
  const isCorrect = selectedAnswer === question?.correct_answer;
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleSelectAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
  };

  const handleConfirm = () => {
    if (selectedAnswer === null) return;
    
    setShowResult(true);
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedAnswer;
    setAnswers(newAnswers);
    
    if (selectedAnswer === question.correct_answer) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswers(new Array(questions.length).fill(null));
    setQuizCompleted(false);
  };

  const getScoreMessage = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage === 100) return { text: t('quiz.perfect'), color: '#10B981', icon: 'trophy' };
    if (percentage >= 80) return { text: t('quiz.excellent'), color: '#10B981', icon: 'star' };
    if (percentage >= 60) return { text: t('quiz.wellDone'), color: '#F59E0B', icon: 'thumbs-up' };
    if (percentage >= 40) return { text: t('quiz.notBad'), color: '#F59E0B', icon: 'bulb' };
    return { text: t('quiz.keepLearning'), color: '#EF4444', icon: 'book' };
  };

  if (!question) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                <Text style={styles.headerSubtitle}>
                  {t('quiz.question')} {currentQuestion + 1}/{questions.length}
                </Text>
              </View>
              <View style={styles.scoreDisplay}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.scoreText}>{score}</Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
          </LinearGradient>

          {quizCompleted ? (
            /* Results Screen */
            <View style={styles.resultsContainer}>
              <View style={[styles.resultIcon, { backgroundColor: getScoreMessage().color + '20' }]}>
                <Ionicons name={getScoreMessage().icon as any} size={48} color={getScoreMessage().color} />
              </View>
              <Text style={styles.resultTitle}>{getScoreMessage().text}</Text>
              <Text style={styles.resultScore}>
                {score} / {questions.length} {t('quiz.correctAnswers')}
              </Text>
              <Text style={styles.resultPercentage}>
                {Math.round((score / questions.length) * 100)}%
              </Text>
              
              {/* Answer Summary */}
              <View style={styles.summaryContainer}>
                {questions.map((q, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.summaryDot,
                      { backgroundColor: answers[i] === q.correct_answer ? '#10B981' : '#EF4444' }
                    ]} 
                  />
                ))}
              </View>

              <View style={styles.resultButtons}>
                <TouchableOpacity style={styles.restartBtn} onPress={handleRestart}>
                  <Ionicons name="refresh" size={20} color="#7C3AED" />
                  <Text style={styles.restartText}>{t('quiz.restart')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}>
                  <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.finishBtn}>
                    <Text style={styles.finishText}>{t('quiz.finish')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Quiz Content */
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Question */}
              <View style={styles.questionCard}>
                <Text style={styles.questionText}>{question.question}</Text>
              </View>

              {/* Options */}
              <View style={styles.optionsContainer}>
                {question.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrectAnswer = index === question.correct_answer;
                  
                  let backgroundColor = '#1A1A2E';
                  let borderColor = '#2A2A4E';
                  
                  if (showResult) {
                    if (isCorrectAnswer) {
                      backgroundColor = '#10B98120';
                      borderColor = '#10B981';
                    } else if (isSelected && !isCorrectAnswer) {
                      backgroundColor = '#EF444420';
                      borderColor = '#EF4444';
                    }
                  } else if (isSelected) {
                    backgroundColor = '#7C3AED20';
                    borderColor = '#7C3AED';
                  }
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.optionCard, { backgroundColor, borderColor }]}
                      onPress={() => handleSelectAnswer(index)}
                      disabled={showResult}
                    >
                      <View style={[
                        styles.optionIndex,
                        isSelected && !showResult && styles.optionIndexSelected,
                        showResult && isCorrectAnswer && styles.optionIndexCorrect,
                        showResult && isSelected && !isCorrectAnswer && styles.optionIndexWrong,
                      ]}>
                        <Text style={styles.optionIndexText}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                      </View>
                      <Text style={styles.optionText}>{option}</Text>
                      {showResult && (
                        <Ionicons 
                          name={isCorrectAnswer ? 'checkmark-circle' : (isSelected ? 'close-circle' : 'ellipse-outline')} 
                          size={24} 
                          color={isCorrectAnswer ? '#10B981' : (isSelected ? '#EF4444' : '#4B5563')} 
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Explanation */}
              {showResult && question.explanation && (
                <View style={styles.explanationCard}>
                  <View style={styles.explanationHeader}>
                    <Ionicons name="bulb" size={20} color="#F59E0B" />
                    <Text style={styles.explanationTitle}>{t('quiz.explanation')}</Text>
                  </View>
                  <Text style={styles.explanationText}>{question.explanation}</Text>
                </View>
              )}

              {/* Action Button */}
              <View style={styles.actionContainer}>
                {!showResult ? (
                  <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={selectedAnswer === null}
                    style={{ opacity: selectedAnswer === null ? 0.5 : 1 }}
                  >
                    <LinearGradient 
                      colors={['#7C3AED', '#5B21B6']} 
                      style={styles.confirmBtn}
                    >
                      <Text style={styles.confirmText}>{t('quiz.validateAnswer')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleNext}>
                    <LinearGradient 
                      colors={isCorrect ? ['#10B981', '#059669'] : ['#7C3AED', '#5B21B6']} 
                      style={styles.confirmBtn}
                    >
                      <Text style={styles.confirmText}>
                        {currentQuestion < questions.length - 1 ? t('quiz.nextQuestion') : t('quiz.viewResults')}
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0A0A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
    minHeight: '80%',
  },
  header: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  questionCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    gap: 14,
  },
  optionIndex: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2A2A4E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndexSelected: {
    backgroundColor: '#7C3AED',
  },
  optionIndexCorrect: {
    backgroundColor: '#10B981',
  },
  optionIndexWrong: {
    backgroundColor: '#EF4444',
  },
  optionIndexText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    lineHeight: 22,
  },
  explanationCard: {
    backgroundColor: '#F59E0B15',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#F59E0B30',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  explanationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  explanationText: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 22,
  },
  actionContainer: {
    marginTop: 24,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    gap: 10,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  // Results
  resultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  resultIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 18,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  resultPercentage: {
    fontSize: 48,
    fontWeight: '800',
    color: '#7C3AED',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    marginBottom: 32,
  },
  summaryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',
    gap: 8,
  },
  restartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C3AED',
  },
  finishBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  finishText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
