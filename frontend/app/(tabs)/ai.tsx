import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { aiAPI } from '../../utils/api';
import { vipAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { 
  AnimatedSection, 
  AnimatedCard, 
  AnimatedButton,
  FloatAnimation,
  PulseAnimation 
} from '../../components/AnimatedComponents';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  imageUri?: string;
  isChart?: boolean;
}

interface LimitInfo {
  questionsUsed: number;
  limit: number;
  secondsUntilReset: number;
  resetTime: string;
}

const getSuggestedQuestions = (t: any) => [
  t('ai.suggestion.whatIsBitcoin'),
  t('ai.suggestion.avoidScams'),
  t('ai.suggestion.whatIsBlockchain'),
  t('ai.suggestion.howToStart'),
];

// Parse structured chart analysis from AI response
const parseChartAnalysis = (text: string) => {
  const extract = (tag: string) => {
    const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  };
  
  const signal = extract('SIGNAL');
  const entry = extract('ENTRY');
  const stopLoss = extract('STOPLOSS');
  const takeProfit = extract('TAKEPROFIT');
  const ratio = extract('RATIO');
  const analyse = extract('ANALYSE');
  const news = extract('NEWS');
  const sentiment = extract('SENTIMENT');
  
  if (signal || entry || stopLoss) {
    return { signal, entry, stopLoss, takeProfit, ratio, analyse, news, sentiment };
  }
  return null;
};

const RiskDisclaimer = () => (
  <View style={styles.riskDisclaimer} data-testid="risk-disclaimer">
    <View style={styles.riskHeader}>
      <Ionicons name="warning" size={18} color="#F59E0B" />
      <Text style={styles.riskTitle}>Avertissement important</Text>
    </View>
    <Text style={styles.riskText}>
      Cette analyse est fournie à titre informatif uniquement et ne constitue en aucun cas un conseil financier.{'\n\n'}
      Ne prenez pas de risques inutiles. Faites toujours vos propres recherches (DYOR) avant d'investir.{'\n\n'}
      Le trading de futures/à effet de levier est particulièrement risqué et peut entraîner la perte totale de votre capital. Investissez uniquement ce que vous pouvez vous permettre de perdre.
    </Text>
  </View>
);

const ChartAnalysisCard = ({ data }: { data: ReturnType<typeof parseChartAnalysis> }) => {
  if (!data) return null;
  
  const signalColor = data.signal?.toLowerCase().includes('achat') ? '#10B981' 
    : data.signal?.toLowerCase().includes('vente') ? '#EF4444' : '#F59E0B';
  const sentimentColor = data.sentiment?.toLowerCase().includes('bullish') ? '#10B981'
    : data.sentiment?.toLowerCase().includes('bearish') ? '#EF4444' : '#F59E0B';
  
  return (
    <View style={styles.chartCard} data-testid="chart-analysis-card">
      {/* Signal */}
      {data.signal && (
        <View style={[styles.signalBanner, { backgroundColor: `${signalColor}20` }]}>
          <Ionicons name={data.signal.toLowerCase().includes('achat') ? 'trending-up' : data.signal.toLowerCase().includes('vente') ? 'trending-down' : 'pause'} size={24} color={signalColor} />
          <Text style={[styles.signalText, { color: signalColor }]}>{data.signal}</Text>
        </View>
      )}
      
      {/* Key levels */}
      <View style={styles.levelsGrid}>
        {data.entry && (
          <View style={styles.levelBox}>
            <Text style={styles.levelLabel}>Point d'entrée</Text>
            <Text style={[styles.levelValue, { color: '#7C3AED' }]}>{data.entry}</Text>
          </View>
        )}
        {data.stopLoss && (
          <View style={styles.levelBox}>
            <Text style={styles.levelLabel}>Stop Loss</Text>
            <Text style={[styles.levelValue, { color: '#EF4444' }]}>{data.stopLoss}</Text>
          </View>
        )}
      </View>
      
      {/* Take Profit */}
      {data.takeProfit && (
        <View style={styles.tpSection}>
          <Text style={styles.tpLabel}>Take Profit</Text>
          <Text style={[styles.tpValue, { color: '#10B981' }]}>{data.takeProfit}</Text>
        </View>
      )}
      
      {/* Ratio */}
      {data.ratio && (
        <View style={styles.ratioRow}>
          <Text style={styles.ratioLabel}>Risque/Récompense</Text>
          <View style={styles.ratioBadge}>
            <Text style={styles.ratioValue}>{data.ratio}</Text>
          </View>
        </View>
      )}
      
      {/* Analysis */}
      {data.analyse && (
        <View style={styles.analyseSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart" size={16} color="#7C3AED" />
            <Text style={styles.sectionTitle}>Analyse technique</Text>
          </View>
          <Text style={styles.analyseText}>{data.analyse}</Text>
        </View>
      )}
      
      {/* News Context */}
      {data.news && (
        <View style={styles.newsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="newspaper" size={16} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Contexte actualités</Text>
          </View>
          <Text style={styles.newsText}>{data.news}</Text>
        </View>
      )}
      
      {/* Sentiment */}
      {data.sentiment && (
        <View style={[styles.sentimentBadge, { backgroundColor: `${sentimentColor}15` }]}>
          <View style={[styles.sentimentDot, { backgroundColor: sentimentColor }]} />
          <Text style={[styles.sentimentText, { color: sentimentColor }]}>
            Sentiment: {data.sentiment}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function AIScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputScaleAnim = useRef(new Animated.Value(1)).current;

  const isVip = user?.is_vip;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!limitInfo || !showLimitModal) return;
    const updateCountdown = () => {
      const now = new Date().getTime();
      const resetTime = new Date(limitInfo.resetTime).getTime();
      const diff = resetTime - now;
      if (diff <= 0) { setCountdown('00:00:00'); setShowLimitModal(false); setLimitInfo(null); return; }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [limitInfo, showLimitModal]);

  const pickImage = async () => {
    if (!isVip) {
      router.push('/vip');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setSelectedImageBase64(result.assets[0].base64 || null);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setSelectedImageBase64(null);
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !selectedImageBase64) || isLoading) return;

    const hasImage = !!selectedImageBase64;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim() || (hasImage ? 'Analyse ce graphique' : ''),
      isUser: true,
      timestamp: new Date(),
      imageUri: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    const imageBase64 = selectedImageBase64;
    removeImage();
    setIsLoading(true);

    try {
      let responseText: string;
      let isChart = false;
      
      if (hasImage && imageBase64 && isVip) {
        // VIP chart analysis
        const response = await vipAPI.analyzeImageWithAI({
          query: text.trim() || 'Analyse ce graphique de trading et donne-moi tes recommandations avec points d\'entrée, stop loss et take profit.',
          image_base64: imageBase64,
          analysis_type: 'chart_analysis',
        });
        responseText = response.data.data.analysis;
        isChart = response.data.data.is_chart || false;
      } else {
        // Standard text query
        const response = await aiAPI.ask(text.trim(), 'crypto_education');
        responseText = response.data.response;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date(),
        isChart,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      if (error.response?.status === 429) {
        const detail = error.response.data?.detail;
        if (detail?.error === 'limit_exceeded') {
          setLimitInfo({ questionsUsed: detail.questions_used, limit: detail.limit, secondsUntilReset: detail.seconds_until_reset, resetTime: detail.reset_time });
          setShowLimitModal(true);
          setMessages((prev) => prev.slice(0, -1));
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: t('ai.errorResponse'),
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = (message: Message) => {
    const chartData = !message.isUser && message.isChart ? parseChartAnalysis(message.text) : null;
    
    return (
      <AnimatedSection key={message.id} delay={0}>
        <View style={[styles.messageBubble, message.isUser ? styles.userBubble : styles.aiBubble]}>
          {!message.isUser && (
            <View style={styles.aiMessageIcon}>
              <Ionicons name={message.isChart ? 'analytics' : 'sparkles'} size={14} color="#7C3AED" />
            </View>
          )}
          {/* User image preview */}
          {message.isUser && message.imageUri && (
            <Image source={{ uri: message.imageUri }} style={styles.messageImage} resizeMode="cover" />
          )}
          {/* Chart analysis card OR plain text */}
          {chartData ? (
            <ChartAnalysisCard data={chartData} />
          ) : (
            <Text style={[styles.messageText, message.isUser ? styles.userMessageText : styles.aiMessageText]}>
              {message.text}
            </Text>
          )}
        </View>
        {/* Risk disclaimer — ONLY for chart analysis */}
        {!message.isUser && message.isChart && <RiskDisclaimer />}
      </AnimatedSection>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <AnimatedSection delay={0}>
          <View style={styles.header}>
            <FloatAnimation distance={5} duration={4000}>
              <View style={styles.aiAvatar}>
                <PulseAnimation duration={2000} maxScale={1.1}>
                  <Ionicons name="sparkles" size={24} color="#7C3AED" />
                </PulseAnimation>
              </View>
            </FloatAnimation>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{t('ai.title')}</Text>
              <Text style={styles.headerSubtitle}>
                {isVip ? 'VIP - Analyse de graphiques activée' : t('ai.subtitle')}
              </Text>
              <View style={styles.poweredByBadge}>
                <Ionicons name="flash" size={10} color="#10B981" />
                <Text style={styles.poweredByText}>{t('ai.poweredBy')}</Text>
              </View>
            </View>
            {isVip && (
              <View style={styles.vipHeaderBadge}>
                <Ionicons name="diamond" size={14} color="#FFD700" />
              </View>
            )}
          </View>
        </AnimatedSection>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Animated.View style={[styles.welcomeContainer, { opacity: fadeAnim }]}>
              <AnimatedSection delay={100}>
                <FloatAnimation distance={10} duration={5000}>
                  <View style={styles.welcomeIcon}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#7C3AED" />
                  </View>
                </FloatAnimation>
              </AnimatedSection>
              
              <AnimatedSection delay={200}>
                <Text style={styles.welcomeTitle}>{t('ai.howCanIHelp')}</Text>
                <Text style={styles.welcomeText}>{t('ai.welcomeText')}</Text>
              </AnimatedSection>

              {/* Chart analysis promo for VIP */}
              {isVip && (
                <AnimatedSection delay={250}>
                  <View style={styles.chartPromo} data-testid="chart-promo">
                    <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(16,185,129,0.1)']} style={styles.chartPromoGradient}>
                      <Ionicons name="camera" size={28} color="#7C3AED" />
                      <Text style={styles.chartPromoTitle}>Analysez vos graphiques</Text>
                      <Text style={styles.chartPromoText}>
                        Envoyez un screenshot de graphique pour obtenir signal, point d'entrée, stop loss et take profit
                      </Text>
                    </LinearGradient>
                  </View>
                </AnimatedSection>
              )}

              <View style={styles.suggestionsContainer}>
                <AnimatedSection delay={300}>
                  <Text style={styles.suggestionsTitle}>{t('ai.suggestions')}</Text>
                </AnimatedSection>
                {getSuggestedQuestions(t).map((question, index) => (
                  <AnimatedCard key={index} style={styles.suggestionButton} delay={400 + index * 100} onPress={() => sendMessage(question)}>
                    <Text style={styles.suggestionText}>{question}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
                  </AnimatedCard>
                ))}
              </View>
            </Animated.View>
          ) : (
            messages.map(renderMessage)
          )}
          {isLoading && (
            <AnimatedSection delay={0}>
              <View style={styles.loadingContainer}>
                <PulseAnimation duration={1000} maxScale={1.2}>
                  <ActivityIndicator size="small" color="#7C3AED" />
                </PulseAnimation>
                <Text style={styles.loadingText}>
                  {selectedImage ? 'Analyse du graphique en cours...' : t("ai.thinking")}
                </Text>
              </View>
            </AnimatedSection>
          )}
        </ScrollView>

        {/* Image preview */}
        {selectedImage && (
          <View style={styles.imagePreview} data-testid="image-preview">
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity style={styles.removeImageBtn} onPress={removeImage}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
            <View style={styles.chartBadge}>
              <Ionicons name="analytics" size={12} color="#7C3AED" />
              <Text style={styles.chartBadgeText}>Analyse graphique</Text>
            </View>
          </View>
        )}

        {/* Input */}
        <AnimatedSection delay={500}>
          <View style={styles.inputContainer}>
            <Animated.View style={[styles.inputWrapper, { transform: [{ scale: inputScaleAnim }] }]}>
              {/* Image picker button - VIP only */}
              <TouchableOpacity
                style={[styles.imagePickerBtn, !isVip && styles.imagePickerBtnLocked]}
                onPress={pickImage}
                data-testid="image-picker-btn"
              >
                <Ionicons name={isVip ? 'camera' : 'lock-closed'} size={20} color={isVip ? '#7C3AED' : '#5A5A6E'} />
              </TouchableOpacity>
              
              <TextInput
                style={styles.input}
                placeholder={selectedImage ? 'Ajoutez un commentaire (optionnel)...' : t('ai.askYourQuestion')}
                placeholderTextColor="#5A5A6E"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isLoading}
              />
              <AnimatedButton
                style={[styles.sendButton, (!inputText.trim() && !selectedImage || isLoading) && styles.sendButtonDisabled]}
                onPress={() => sendMessage(inputText)}
                disabled={(!inputText.trim() && !selectedImage) || isLoading}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={(inputText.trim() || selectedImage) && !isLoading ? '#FFFFFF' : '#5A5A6E'}
                />
              </AnimatedButton>
            </Animated.View>
            <Text style={styles.disclaimer}>
              Les réponses ne constituent pas des conseils financiers.
            </Text>
          </View>
        </AnimatedSection>
      </KeyboardAvoidingView>

      {/* Limit Exceeded Modal */}
      <Modal visible={showLimitModal} transparent={true} animationType="fade" onRequestClose={() => setShowLimitModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#1A1A2E', '#0A0A1A']} style={styles.modalGradient}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowLimitModal(false)}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
              <View style={styles.modalIconWrapper}>
                <View style={styles.modalIconBg}>
                  <Ionicons name="time-outline" size={48} color="#F59E0B" />
                </View>
              </View>
              <Text style={styles.modalTitle}>Limite atteinte !</Text>
              <Text style={styles.modalDescription}>
                Vous avez utilisé vos {limitInfo?.limit || 3} questions gratuites aujourd'hui.
              </Text>
              <View style={styles.countdownContainer}>
                <Text style={styles.countdownLabel}>{t("ai.nextReset")}</Text>
                <View style={styles.countdownBox}>
                  <Text style={styles.countdownTime}>{countdown}</Text>
                </View>
              </View>
              <View style={styles.vipPromoContainer}>
                <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(109,40,217,0.2)']} style={styles.vipPromoGradient}>
                  <View style={styles.vipPromoHeader}>
                    <Ionicons name="diamond" size={24} color="#FFD700" />
                    <Text style={styles.vipPromoTitle}>Passez VIP</Text>
                  </View>
                  <Text style={styles.vipPromoText}>Questions illimitées + Analyse de graphiques</Text>
                  <View style={styles.vipPromoFeatures}>
                    <View style={styles.vipPromoFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.vipPromoFeatureText}>{t("ai.unlimitedAI")}</Text>
                    </View>
                    <View style={styles.vipPromoFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.vipPromoFeatureText}>Analyse de graphiques par IA</Text>
                    </View>
                    <View style={styles.vipPromoFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.vipPromoFeatureText}>Signal, Entrée, SL, TP</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
              <TouchableOpacity style={styles.vipCtaBtn} onPress={() => { setShowLimitModal(false); router.push('/vip'); }}>
                <LinearGradient colors={['#FFD700', '#F59E0B']} style={styles.vipCtaBtnGradient}>
                  <Ionicons name="diamond" size={20} color="#1A0A2E" />
                  <Text style={styles.vipCtaBtnText}>Devenir VIP - $6.99/mois</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setShowLimitModal(false)}>
                <Text style={styles.skipBtnText}>Revenir demain</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  keyboardView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  aiAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(124, 58, 237, 0.15)', alignItems: 'center', justifyContent: 'center' },
  headerText: { marginLeft: 14, flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#8B8B9E', marginTop: 2 },
  poweredByBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  poweredByText: { fontSize: 10, color: '#10B981', fontWeight: '600' },
  vipHeaderBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,215,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 20, paddingBottom: 10 },
  welcomeContainer: { alignItems: 'center', paddingVertical: 20 },
  welcomeIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(124, 58, 237, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  welcomeText: { fontSize: 14, color: '#8B8B9E', textAlign: 'center', marginTop: 10, lineHeight: 20, paddingHorizontal: 20 },
  chartPromo: { width: '100%', marginTop: 20 },
  chartPromoGradient: { borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  chartPromoTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 10 },
  chartPromoText: { fontSize: 13, color: '#8B8B9E', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  suggestionsContainer: { width: '100%', marginTop: 28 },
  suggestionsTitle: { fontSize: 14, fontWeight: '600', color: '#8B8B9E', marginBottom: 12 },
  suggestionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A4E' },
  suggestionText: { fontSize: 14, color: '#FFFFFF', flex: 1 },
  messageBubble: { maxWidth: '90%', borderRadius: 16, padding: 14, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#7C3AED', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#1A1A2E', borderBottomLeftRadius: 4, maxWidth: '95%' },
  aiMessageIcon: { marginBottom: 6 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userMessageText: { color: '#FFFFFF' },
  aiMessageText: { color: '#FFFFFF' },
  messageImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 8 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#1A1A2E', borderRadius: 16, padding: 14, gap: 10 },
  loadingText: { fontSize: 13, color: '#8B8B9E' },
  
  // Image preview
  imagePreview: { marginHorizontal: 16, marginBottom: 8, position: 'relative' },
  previewImage: { width: 120, height: 90, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A4E' },
  removeImageBtn: { position: 'absolute', top: -8, left: 112, zIndex: 10 },
  chartBadge: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(10,10,26,0.85)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chartBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: '600' },
  
  // Input
  inputContainer: { padding: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#1A1A2E' },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1A1A2E', borderRadius: 24, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#2A2A4E' },
  imagePickerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  imagePickerBtnLocked: { backgroundColor: 'rgba(90,90,110,0.15)' },
  input: { flex: 1, color: '#FFFFFF', fontSize: 15, maxHeight: 100, paddingVertical: 8, marginHorizontal: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#2A2A4E' },
  disclaimer: { fontSize: 11, color: '#5A5A6E', textAlign: 'center', marginTop: 10 },
  
  // Chart Analysis Card
  chartCard: { marginTop: 4 },
  signalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 12 },
  signalText: { fontSize: 18, fontWeight: '800', textTransform: 'uppercase' },
  levelsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  levelBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 },
  levelLabel: { fontSize: 11, color: '#8B8B9E', marginBottom: 4 },
  levelValue: { fontSize: 15, fontWeight: '700' },
  tpSection: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10, padding: 10, marginBottom: 10 },
  tpLabel: { fontSize: 11, color: '#8B8B9E', marginBottom: 4 },
  tpValue: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  ratioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  ratioLabel: { fontSize: 13, color: '#8B8B9E' },
  ratioBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  ratioValue: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  analyseSection: { marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  analyseText: { fontSize: 13, color: '#C4C4C4', lineHeight: 20 },
  newsSection: { marginBottom: 12, backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: 10 },
  newsText: { fontSize: 13, color: '#C4C4C4', lineHeight: 20 },
  sentimentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, alignSelf: 'flex-start' },
  sentimentDot: { width: 8, height: 8, borderRadius: 4 },
  sentimentText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  
  // Risk Disclaimer
  riskDisclaimer: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderRadius: 12, padding: 14, marginBottom: 16, marginTop: 4, maxWidth: '95%' },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  riskTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  riskText: { fontSize: 12, color: '#8B8B9E', lineHeight: 18 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, overflow: 'hidden' },
  modalGradient: { padding: 24, alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8 },
  modalIconWrapper: { marginBottom: 20 },
  modalIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245, 158, 11, 0.15)', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  modalDescription: { fontSize: 15, color: '#8B8B9E', textAlign: 'center', marginBottom: 20 },
  countdownContainer: { alignItems: 'center', marginBottom: 24 },
  countdownLabel: { fontSize: 13, color: '#8B8B9E', marginBottom: 8 },
  countdownBox: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#2A2A4E' },
  countdownTime: { fontSize: 28, fontWeight: '700', color: '#F59E0B', fontVariant: ['tabular-nums'] },
  vipPromoContainer: { width: '100%', marginBottom: 20 },
  vipPromoGradient: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.3)' },
  vipPromoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  vipPromoTitle: { fontSize: 18, fontWeight: '700', color: '#FFD700' },
  vipPromoText: { fontSize: 14, color: '#C4C4C4', marginBottom: 12 },
  vipPromoFeatures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vipPromoFeature: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vipPromoFeatureText: { fontSize: 13, color: '#FFFFFF' },
  vipCtaBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  vipCtaBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  vipCtaBtnText: { fontSize: 16, fontWeight: '700', color: '#1A0A2E' },
  skipBtn: { paddingVertical: 12 },
  skipBtnText: { fontSize: 14, color: '#8B8B9E' },
});
