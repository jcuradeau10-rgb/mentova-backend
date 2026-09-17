import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { useThemeStore } from '../../store/themeStore';
import { useAtlasNavStore } from '../../store/atlasNavStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SW } = Dimensions.get('window');

type Tab = 'chat' | 'modules' | 'progress';

// ============ i18n FOR ATLAS ============
const i18n: Record<string, Record<string, string>> = {
  // Tabs
  'tab.chat': { fr: 'Chat', en: 'Chat', es: 'Chat' },
  'tab.modules': { fr: 'Modules', en: 'Modules', es: 'Módulos' },
  'tab.progress': { fr: 'Progression', en: 'Progress', es: 'Progreso' },
  // Auth
  'auth.required': { fr: 'Connexion requise', en: 'Login required', es: 'Inicio de sesión requerido' },
  'auth.desc': { fr: 'Connecte-toi pour accéder à Caufid', en: 'Log in to access Caufid', es: 'Inicia sesión para acceder a Caufid' },
  // Chat
  'chat.placeholder': { fr: 'Écris ton message...', en: 'Write your message...', es: 'Escribe tu mensaje...' },
  'chat.welcome.title': { fr: "Caufid", en: "Caufid", es: "Caufid" },
  'chat.welcome.desc': { fr: 'Votre mentor personnel en crypto & finance', en: 'Your personal crypto & finance mentor', es: 'Tu mentor personal en crypto y finanzas' },
  'chat.welcome.greeting': { fr: 'Bonjour, comment puis-je vous aider ?', en: 'Hello, how can I help you?', es: 'Hola, como puedo ayudarte?' },
  'chat.error': { fr: 'Erreur de connexion. Réessaie.', en: 'Connection error. Try again.', es: 'Error de conexión. Inténtalo de nuevo.' },
  'chat.conversations': { fr: 'Conversations', en: 'Conversations', es: 'Conversaciones' },
  'chat.new': { fr: 'Nouvelle conversation', en: 'New conversation', es: 'Nueva conversación' },
  'chat.empty': { fr: 'Aucune conversation', en: 'No conversations', es: 'Sin conversaciones' },
  'chat.messages': { fr: 'messages', en: 'messages', es: 'mensajes' },
  // Thinking
  'chat.thinking': { fr: 'Caufid réfléchit', en: 'Caufid is thinking', es: 'Caufid está reflexionando' },
  'chat.analyzing': { fr: 'Analyse du graphique en cours', en: 'Analyzing chart', es: 'Analizando gráfico' },
  // Disclaimer
  'chat.disclaimer': { fr: 'Les réponses ne constituent pas des conseils financiers.', en: 'Responses do not constitute financial advice.', es: 'Las respuestas no constituyen asesoría financiera.' },
  // Modules
  'mod.empty.title': { fr: 'Aucun module', en: 'No modules', es: 'Sin módulos' },
  'mod.empty.desc': { fr: "Discute avec Caufid pour qu'il crée ton parcours personnalisé !", en: 'Chat with Caufid to create your personalized learning path!', es: '¡Habla con Caufid para que cree tu ruta de aprendizaje personalizada!' },
  'mod.back': { fr: 'Retour', en: 'Back', es: 'Volver' },
  'mod.mastery': { fr: 'Maîtrise', en: 'Mastery', es: 'Dominio' },
  'mod.understood': { fr: 'Compris', en: 'Understood', es: 'Comprendido' },
  'mod.weak': { fr: 'À revoir', en: 'Needs review', es: 'Por repasar' },
  'mod.best_quiz': { fr: 'Meilleur quiz', en: 'Best quiz', es: 'Mejor quiz' },
  'mod.content': { fr: 'Contenu du module', en: 'Module content', es: 'Contenido del módulo' },
  'mod.quiz_history': { fr: 'Historique des quiz', en: 'Quiz history', es: 'Historial de quiz' },
  'mod.objective': { fr: 'Objectif', en: 'Objective', es: 'Objetivo' },
  'mod.continue': { fr: 'Continuer ce module', en: 'Continue this module', es: 'Continuar este modulo' },
  // Filters
  'filter.all': { fr: 'Tous', en: 'All', es: 'Todos' },
  'filter.in_progress': { fr: 'En cours', en: 'In progress', es: 'En curso' },
  'filter.not_started': { fr: 'À faire', en: 'To do', es: 'Por hacer' },
  'filter.mastered': { fr: 'Maîtrisés', en: 'Mastered', es: 'Dominados' },
  // Status
  'status.not_started': { fr: 'À commencer', en: 'Not started', es: 'Sin empezar' },
  'status.in_progress': { fr: 'En cours', en: 'In progress', es: 'En curso' },
  'status.completed': { fr: 'Complété', en: 'Completed', es: 'Completado' },
  'status.mastered': { fr: 'Maîtrisé', en: 'Mastered', es: 'Dominado' },
  // Progress
  'prog.level': { fr: 'Niveau global', en: 'Overall level', es: 'Nivel global' },
  'prog.skills': { fr: 'Compétences', en: 'Skills', es: 'Competencias' },
  'prog.modules': { fr: 'Modules', en: 'Modules', es: 'Módulos' },
  'prog.categories': { fr: 'Par catégorie', en: 'By category', es: 'Por categoría' },
  'prog.recent_quiz': { fr: 'Derniers quiz', en: 'Recent quizzes', es: 'Últimos quiz' },
  'prog.total': { fr: 'Total', en: 'Total', es: 'Total' },
  'prog.in_progress': { fr: 'En cours', en: 'In progress', es: 'En curso' },
  'prog.mastered': { fr: 'Maîtrisés', en: 'Mastered', es: 'Dominados' },
  'prog.onboarding_hint': { fr: 'Discute avec Caufid pour évaluer ton niveau', en: 'Chat with Caufid to evaluate your level', es: 'Habla con Caufid para evaluar tu nivel' },
  'prog.error': { fr: 'Erreur de chargement', en: 'Loading error', es: 'Error de carga' },
  // Smart Upgrade Prompt
  'upgrade.title': { fr: 'Caufid peut aller encore plus loin', en: 'Caufid can go even further', es: 'Caufid puede ir aun mas lejos' },
  'upgrade.desc': { fr: 'Avec VIP, bénéficiez d\'une mémoire personnalisée, de l\'analyse de graphiques, et d\'une expérience Caufid complète.', en: 'With VIP, get personalized memory, chart analysis, and a complete Caufid experience.', es: 'Con VIP, obtén memoria personalizada, análisis de gráficos y una experiencia Caufid completa.' },
  'upgrade.cta': { fr: 'Passer à VIP', en: 'Upgrade to VIP', es: 'Pasar a VIP' },
  'upgrade.badge': { fr: 'Mettre à niveau', en: 'Upgrade', es: 'Mejorar' },
  'degrade.title': { fr: 'Caufid fonctionne en mode réduit', en: 'Caufid is running in reduced mode', es: 'Caufid está en modo reducido' },
  'degrade.desc': { fr: 'Pour retrouver la version complète, passez à VIP.', en: 'To get the full version, upgrade to VIP.', es: 'Para obtener la versión completa, pasa a VIP.' },
  // Welcome Suggestions
  'sug.1': { fr: 'Qu\'est-ce que le Bitcoin et comment ça fonctionne ?', en: 'What is Bitcoin and how does it work?', es: 'Qué es Bitcoin y cómo funciona?' },
  'sug.2': { fr: 'Explique-moi la DeFi simplement', en: 'Explain DeFi in simple terms', es: 'Explícame DeFi de forma sencilla' },
  'sug.3': { fr: 'Quelle est la différence entre un token et un coin ?', en: 'What is the difference between a token and a coin?', es: 'Cuál es la diferencia entre un token y una moneda?' },
  'sug.4': { fr: 'Comment lire un graphique de trading ?', en: 'How to read a trading chart?', es: 'Cómo leer un gráfico de trading?' },
  'sug.market': { fr: 'Quelles sont les dernières nouvelles et tendances du marché crypto ?', en: "What's happening in the crypto market today?", es: 'Cuáles son las últimas noticias y tendencias del mercado crypto?' },
  // Levels
  'level.unknown': { fr: 'Non évalué', en: 'Not evaluated', es: 'No evaluado' },
  'level.beginner': { fr: 'Débutant', en: 'Beginner', es: 'Principiante' },
  'level.intermediate': { fr: 'Intermédiaire', en: 'Intermediate', es: 'Intermedio' },
  'level.advanced': { fr: 'Avancé', en: 'Advanced', es: 'Avanzado' },
  'level.expert': { fr: 'Expert', en: 'Expert', es: 'Experto' },
  // Skills
  'skill.crypto': { fr: 'Crypto', en: 'Crypto', es: 'Crypto' },
  'skill.blockchain': { fr: 'Blockchain', en: 'Blockchain', es: 'Blockchain' },
  'skill.trading': { fr: 'Trading', en: 'Trading', es: 'Trading' },
  'skill.finance': { fr: 'Finance', en: 'Finance', es: 'Finanzas' },
  'skill.risk': { fr: 'Gestion risques', en: 'Risk management', es: 'Gestión de riesgos' },
  // VIP Modal
  'vip.title': { fr: 'Caufid VIP', en: 'Caufid VIP', es: 'Caufid VIP' },
  'vip.subtitle': { fr: 'Débloquez toute l\'expérience Caufid.', en: 'Unlock the full Caufid experience.', es: 'Desbloquea toda la experiencia Caufid.' },
  'vip.price': { fr: '21,99 $ / mois', en: '$21.99 / month', es: '$21.99 / mes' },
  'vip.cta': { fr: 'Mettre à niveau', en: 'Upgrade now', es: 'Mejorar ahora' },
  'vip.cancel': { fr: 'Annulable à tout moment via Stripe', en: 'Cancel anytime via Stripe', es: 'Cancela en cualquier momento vía Stripe' },
  'vip.memory': { fr: 'Mémoire', en: 'Memory', es: 'Memoria' },
  'vip.memory.desc': { fr: 'Caufid conserve le contexte et comprend mieux votre progression.', en: 'Caufid retains context and better understands your progress.', es: 'Caufid conserva el contexto y comprende mejor tu progreso.' },
  'vip.chart': { fr: 'Analyse de graphiques', en: 'Chart Analysis', es: 'Análisis de gráficos' },
  'vip.chart.desc': { fr: 'Analysez des graphiques et images directement avec Caufid.', en: 'Analyze charts and images directly with Caufid.', es: 'Analiza gráficos e imágenes directamente con Caufid.' },
  'vip.market': { fr: 'Market Intelligence', en: 'Market Intelligence', es: 'Market Intelligence' },
  'vip.market.desc': { fr: 'Accédez aux capacités avancées liées aux marchés.', en: 'Access advanced market-related capabilities.', es: 'Accede a capacidades avanzadas relacionadas con los mercados.' },
  'vip.learn': { fr: 'Apprentissage personnalisé', en: 'Personalized Learning', es: 'Aprendizaje personalizado' },
  'vip.learn.desc': { fr: 'Caufid adapte davantage l\'expérience à votre niveau et progression.', en: 'Caufid further adapts the experience to your level and progress.', es: 'Caufid adapta aún más la experiencia a tu nivel y progreso.' },
  'vip.briefing': { fr: 'Briefing quotidien', en: 'Daily Briefing', es: 'Briefing diario' },
  'vip.briefing.desc': { fr: 'Recevez un briefing personnalisé chaque jour.', en: 'Receive a personalized briefing every day.', es: 'Recibe un briefing personalizado cada día.' },
  'vip.back': { fr: 'Retour', en: 'Back', es: 'Volver' },
};

function tAtlas(key: string, lang: string): string {
  const entry = i18n[key];
  if (!entry) return key;
  return entry[lang] || entry['en'] || key;
}

interface Message { role: 'user' | 'assistant'; content: string; }
interface Conversation { id: string; title: string; message_count: number; updated_at: string; }
interface Module { id: string; title: string; description: string; level: string; category: string; status: string; mastery_score: number; learning_objective: string; }

function api(path: string, token: string, opts: any = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) },
  }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
}

// ============ THINKING ANIMATION ============
function ThinkingIndicator({ lang, isChart }: { lang: string; isChart?: boolean }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    };
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.8, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start(); a2.start(); a3.start(); glowAnim.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); glowAnim.stop(); };
  }, []);

  const label = isChart ? tAtlas('chat.analyzing', lang) : tAtlas('chat.thinking', lang);

  return (
    <View style={s.thinkingWrap} data-testid="thinking-indicator">
      <Animated.View style={[s.thinkingGlow, { opacity: glow }]}>
        <View style={s.thinkingAvatarSmall}>
          <Text style={s.thinkingAvatarText}>C</Text>
        </View>
      </Animated.View>
      <View style={s.thinkingContent}>
        <Text style={s.thinkingLabel}>{label}</Text>
        <View style={s.thinkingDots}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[s.thinkingDot, { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ============ VIP UPGRADE MODAL ============
function VipUpgradeModal({ visible, onClose, lang, onUpgrade }: { visible: boolean; onClose: () => void; lang: string; onUpgrade: () => void }) {
  const features = [
    { key: 'memory', icon: 'bulb-outline' as const },
    { key: 'chart', icon: 'analytics-outline' as const },
    { key: 'market', icon: 'trending-up-outline' as const },
    { key: 'learn', icon: 'school-outline' as const },
    { key: 'briefing', icon: 'today-outline' as const },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.vipOverlay} data-testid="vip-modal">
        <View style={s.vipModal}>
          {/* Close */}
          <TouchableOpacity style={s.vipClose} onPress={onClose} data-testid="vip-modal-close">
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>

          {/* Header */}
          <View style={s.vipHeader}>
            <View style={s.vipIconWrap}>
              <Ionicons name="diamond" size={28} color="#A78BFA" />
            </View>
            <Text style={s.vipTitle}>{tAtlas('vip.title', lang)}</Text>
            <Text style={s.vipSubtitle}>{tAtlas('vip.subtitle', lang)}</Text>
          </View>

          {/* Price */}
          <View style={s.vipPriceWrap}>
            <Text style={s.vipPrice}>{tAtlas('vip.price', lang)}</Text>
          </View>

          {/* Features */}
          <View style={s.vipFeatures}>
            {features.map(f => (
              <View key={f.key} style={s.vipFeatureRow}>
                <View style={s.vipFeatureIcon}>
                  <Ionicons name={f.icon} size={18} color="#A78BFA" />
                </View>
                <View style={s.vipFeatureText}>
                  <Text style={s.vipFeatureName}>{tAtlas(`vip.${f.key}`, lang)}</Text>
                  <Text style={s.vipFeatureDesc}>{tAtlas(`vip.${f.key}.desc`, lang)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity style={s.vipCta} onPress={onUpgrade} data-testid="vip-upgrade-btn">
            <Ionicons name="diamond" size={16} color="#0B0914" />
            <Text style={s.vipCtaText}>{tAtlas('vip.cta', lang)}</Text>
          </TouchableOpacity>
          <Text style={s.vipCancel}>{tAtlas('vip.cancel', lang)}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ============ TYPEWRITER TEXT (Client-side streaming) ============
function TypewriterText({ text, style, speed = 12 }: { text: string; style?: any; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;
    const words = text.split(' ');
    const interval = setInterval(() => {
      if (indexRef.current < words.length) {
        setDisplayedText(prev => prev + (indexRef.current > 0 ? ' ' : '') + words[indexRef.current]);
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <Text style={style}>{displayedText}</Text>;
}

// ============ FADE IN MESSAGE ============
function FadeInMessage({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ============ CHAT VIEW ============
function ChatView({ token, lang, initialMessage, onMessageSent }: { token: string; lang: string; initialMessage?: string | null; onMessageSent?: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [modelDegraded, setModelDegraded] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [latestAssistantIdx, setLatestAssistantIdx] = useState<number>(-1);
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { setLanguage } = useTranslation();
  const { colors, mode } = useThemeStore();

  const { selectedConversationId, triggerNewChat } = useAtlasNavStore();

  useEffect(() => {
    if (selectedConversationId && selectedConversationId !== activeConvId) {
      loadConversation(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (triggerNewChat > 0) { setActiveConvId(null); setMessages([]); }
  }, [triggerNewChat]);

  useEffect(() => {
    if (initialMessage && !loading) {
      setInput(initialMessage);
      onMessageSent?.();
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'user', content: initialMessage }]);
        setInput('');
        (async () => {
          setLoading(true);
          try {
            const res = await fetch(`${API}/api/atlas/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ message: initialMessage, conversation_id: activeConvId, lang }),
            });
            const data = await res.json();
            if (data.response) {
              setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
              if (!activeConvId && data.conversation_id) { setActiveConvId(data.conversation_id); loadConversations(); }
            }
          } catch (e) { console.error(e); }
          finally { setLoading(false); }
        })();
      }, 200);
    }
  }, [initialMessage]);

  useEffect(() => {
    fetch(`${API}/api/vip/permissions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setIsVip(!!d.is_vip)).catch(() => {});
  }, [token]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api('/api/atlas/conversations', token);
      setConversations(data.conversations || []);
    } catch (e) { /* silent */ }
    setLoadingConvos(false);
  }, [token]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const data = await api(`/api/atlas/conversations/${convId}`, token);
      setMessages(data.messages || []);
      setActiveConvId(convId);
      setShowSidebar(false);
    } catch (e) { console.error('Load conv error:', e); }
  }, [token]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(`${API}/api/atlas/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: msg, conversation_id: activeConvId, lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setMessages(prev => {
          const newMsgs = [...prev, { role: 'assistant' as const, content: data.response }];
          setLatestAssistantIdx(newMsgs.length - 1);
          return newMsgs;
        });
        if (data.upgrade_prompt && !isVip) setShowUpgradePrompt(true);
        if (data.model_degraded && !isVip) setModelDegraded(true);
        if (!activeConvId && data.conversation_id) { setActiveConvId(data.conversation_id); loadConversations(); }
      } else {
        const text = await res.text();
        let fullText = '';
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') fullText += line.slice(6);
        }
        if (fullText) setMessages(prev => [...prev, { role: 'assistant', content: fullText.trim() }]);
        else throw new Error('Empty response');
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: tAtlas("chat.error", lang) }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [input, loading, activeConvId, token, lang, loadConversations]);

  const newConversation = () => { setActiveConvId(null); setMessages([]); setShowSidebar(false); };

  const handleImageUpload = async () => {
    if (!isVip || imageAnalyzing) return;
    if (Platform.OS === 'web') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file'; fileInput.accept = 'image/*';
      fileInput.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageAnalyzing(true);
        setMessages(prev => [...prev, { role: 'user', content: `[Image: ${file.name}] ${input.trim() || 'Analyse ce graphique'}` }]);
        setLoading(true);
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const res = await fetch(`${API}/api/vip/ai/analyze-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ query: input.trim() || 'Analyse ce graphique de trading', image_base64: base64, analysis_type: 'chart_analysis' }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.data?.analysis || data.detail || 'Erreur d\'analyse' }]);
            setImageAnalyzing(false); setLoading(false); setInput('');
          };
          reader.readAsDataURL(file);
        } catch (e) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur lors de l\'analyse' }]);
          setImageAnalyzing(false); setLoading(false);
        }
      };
      fileInput.click();
    }
  };

  const deleteConversation = async (convId: string) => {
    try {
      await api(`/api/atlas/conversations/${convId}`, token, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) { setActiveConvId(null); setMessages([]); }
    } catch (e) { console.error(e); }
  };

  const renameConversation = async (convId: string) => {
    if (!renameText.trim()) { setRenamingConvId(null); return; }
    try {
      await fetch(`${API}/api/atlas/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: renameText.trim() }),
      });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: renameText.trim() } : c));
    } catch (e) { console.error(e); }
    setRenamingConvId(null);
  };

  // Sidebar
  if (showSidebar) {
    return (
      <View style={[s.sidebarWrap, { backgroundColor: colors.bg }]}>
        <View style={[s.sidebarHeader, { borderBottomColor: colors.borderSubtle }]}>
          <Text style={[s.sidebarTitle, { color: colors.text }]}>{tAtlas("chat.conversations", lang)}</Text>
          <TouchableOpacity onPress={() => setShowSidebar(false)} data-testid="close-sidebar">
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.newConvBtn} onPress={newConversation} data-testid="new-conversation-btn">
          <Ionicons name="add-circle-outline" size={20} color="#A78BFA" />
          <Text style={s.newConvText}>{tAtlas("chat.new", lang)}</Text>
        </TouchableOpacity>
        <ScrollView style={{ flex: 1 }}>
          {conversations.map(c => (
            <TouchableOpacity key={c.id} style={[s.convItem, activeConvId === c.id && s.convItemActive]} onPress={() => loadConversation(c.id)} data-testid={`conv-${c.id}`}>
              <View style={{ flex: 1 }}>
                {renamingConvId === c.id ? (
                  <TextInput style={[s.convTitle, { borderBottomWidth: 1, borderBottomColor: '#A78BFA', paddingVertical: 2 }]} value={renameText} onChangeText={setRenameText} autoFocus onSubmitEditing={() => renameConversation(c.id)} onBlur={() => renameConversation(c.id)} maxLength={200} />
                ) : (
                  <><Text style={s.convTitle} numberOfLines={1}>{c.title}</Text><Text style={s.convMeta}>{c.message_count} {tAtlas("chat.messages", lang)}</Text></>
                )}
              </View>
              {renamingConvId !== c.id && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => { setRenamingConvId(c.id); setRenameText(c.title); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="pencil-outline" size={16} color="#475569" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteConversation(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="trash-outline" size={16} color="#475569" /></TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
          {conversations.length === 0 && !loadingConvos && <Text style={s.emptyText}>{tAtlas("chat.empty", lang)}</Text>}
        </ScrollView>
      </View>
    );
  }

  // Main chat view
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      {/* Header — minimal and clean */}
      <View style={[s.chatHeader, { borderBottomColor: colors.borderSubtle }]} data-testid="atlas-chat-header">
        <View style={s.chatHeaderLeft}>
          <View style={[s.atlasAvatar, { backgroundColor: colors.primaryGlow, borderColor: colors.border }]}><Text style={[s.atlasAvatarText, { color: colors.primary }]}>C</Text></View>
          <View>
            <View style={s.chatHeaderTitleRow}>
              <Text style={[s.chatHeaderTitle, { color: colors.text }]}>Caufid</Text>
              <View style={s.onlineDot} />
            </View>
            <Text style={s.chatHeaderSub}>{tAtlas('chat.welcome.desc', lang)}</Text>
          </View>
        </View>
        <View style={s.chatHeaderRight}>
          {/* VIP upgrade for FREE users */}
          {!isVip && (
            <TouchableOpacity style={s.upgradeHeaderBtn} onPress={() => setShowVipModal(true)} data-testid="header-upgrade-btn">
              <Ionicons name="diamond-outline" size={14} color="#A78BFA" />
              <Text style={s.upgradeHeaderText}>{tAtlas('upgrade.badge', lang)}</Text>
            </TouchableOpacity>
          )}
          {/* Language picker */}
          <TouchableOpacity onPress={() => setShowLangPicker(!showLangPicker)} testID="chat-lang-picker" style={s.langBtn}>
            <Text style={s.langBtnText}>{lang.toUpperCase()}</Text>
          </TouchableOpacity>
          {isVip && (
            <TouchableOpacity onPress={() => { setInput(tAtlas('sug.market', lang)); }} testID="market-intel-btn" style={s.headerIconBtn}>
              <Ionicons name="globe-outline" size={18} color="#10B981" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={newConversation} testID="new-chat-btn" style={s.headerIconBtn}>
            <Ionicons name="create-outline" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Language dropdown */}
      {showLangPicker && (
        <View style={s.langDropdown}>
          {[{code: 'fr', label: 'Français'}, {code: 'en', label: 'English'}, {code: 'es', label: 'Español'}].map(l => (
            <TouchableOpacity key={l.code} style={[s.langOption, lang === l.code && s.langOptionActive]} onPress={() => { setLanguage(l.code as any); setShowLangPicker(false); }} testID={`chat-lang-${l.code}`}>
              <Text style={[s.langOptionText, lang === l.code && { color: '#A78BFA', fontWeight: '700' }]}>{l.label}</Text>
              {lang === l.code && <Ionicons name="checkmark" size={16} color="#A78BFA" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.messagesContainer} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {messages.length === 0 && (
          <View style={s.welcomeWrap}>
            <View style={s.welcomeAvatarWrap}>
              <View style={[s.welcomeAvatar, { backgroundColor: colors.primaryGlow, borderColor: colors.border }]}><Text style={[s.welcomeAvatarText, { color: colors.primary }]}>C</Text></View>
            </View>
            <Text style={[s.welcomeGreeting, { color: colors.text }]}>{tAtlas("chat.welcome.greeting", lang)}</Text>
            <Text style={[s.welcomeDesc, { color: colors.textMuted }]}>{tAtlas("chat.welcome.desc", lang)}</Text>
            {/* Suggestion Cards */}
            <View style={s.sugGrid}>
              {['sug.1', 'sug.2', 'sug.3', 'sug.4'].map((key, i) => (
                <TouchableOpacity key={key} style={[s.sugCard, { backgroundColor: mode === 'light' ? colors.surface : 'rgba(255,255,255,0.02)', borderColor: mode === 'light' ? colors.border : 'rgba(255,255,255,0.05)' }]} onPress={() => { setInput(tAtlas(key, lang)); }} testID={`suggestion-${i}`}>
                  <Ionicons name={['logo-bitcoin', 'layers-outline', 'swap-horizontal-outline', 'bar-chart-outline'][i] as any} size={16} color={['#F59E0B', '#60A5FA', '#34D399', '#F87171'][i]} />
                  <Text style={[s.sugText, { color: colors.textSecondary }]} numberOfLines={2}>{tAtlas(key, lang)}</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.textMuted} style={{ marginTop: 6 }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {messages.map((m, i) => (
          <FadeInMessage key={i} delay={m.role === 'assistant' ? 80 : 0}>
            <View style={[s.msgRow, m.role === 'user' && s.msgRowUser]} data-testid={`message-${i}`}>
              {m.role === 'assistant' && <View style={[s.msgAvatar, { backgroundColor: colors.primaryGlow, borderColor: colors.border }]}><Text style={[s.msgAvatarText, { color: colors.primary }]}>C</Text></View>}
              <View style={[s.msgBubble, m.role === 'user' ? s.msgBubbleUser : [s.msgBubbleAtlas, { backgroundColor: mode === 'light' ? colors.surface : 'rgba(167,139,250,0.06)', borderColor: mode === 'light' ? colors.border : 'rgba(167,139,250,0.08)' }]]}>
                {m.role === 'assistant' && i === latestAssistantIdx ? (
                  <TypewriterText text={m.content} style={[s.msgText, { color: colors.text }]} speed={15} />
                ) : (
                  <Text style={[s.msgText, m.role === 'user' ? s.msgTextUser : { color: colors.text }]}>{m.content}</Text>
                )}
              </View>
            </View>
          </FadeInMessage>
        ))}
        {loading && <ThinkingIndicator lang={lang} isChart={imageAnalyzing} />}
      </ScrollView>

      {/* Degradation Banner */}
      {modelDegraded && !isVip && (
        <View style={s.degradeBanner} data-testid="degrade-banner">
          <View style={s.degradeContent}>
            <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
            <Text style={s.degradeText}>{tAtlas("degrade.title", lang)}</Text>
          </View>
          <TouchableOpacity style={s.degradeCta} onPress={() => setShowVipModal(true)} data-testid="degrade-cta-btn">
            <Text style={s.degradeCtaText}>{tAtlas("upgrade.cta", lang)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Upgrade Prompt */}
      {showUpgradePrompt && !isVip && (
        <View style={s.upgradePrompt} data-testid="upgrade-prompt" testID="upgrade-prompt">
          <View style={s.upgradePromptContent}>
            <Ionicons name="diamond-outline" size={18} color="#A78BFA" />
            <View style={{ flex: 1 }}>
              <Text style={s.upgradeTitle}>{tAtlas("upgrade.title", lang)}</Text>
              <Text style={s.upgradeDesc}>{tAtlas("upgrade.desc", lang)}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowUpgradePrompt(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.upgradeCta} onPress={() => { setShowUpgradePrompt(false); setShowVipModal(true); }} data-testid="upgrade-cta-btn" testID="upgrade-cta-btn">
            <Text style={s.upgradeCtaText}>{tAtlas("upgrade.cta", lang)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar — premium floating */}
      <View style={[s.inputBarWrap, { borderTopColor: colors.borderSubtle }]}>
        <View style={[s.inputBar, { backgroundColor: mode === 'light' ? colors.inputBg : 'rgba(255,255,255,0.03)', borderColor: mode === 'light' ? colors.border : 'rgba(255,255,255,0.06)' }]} data-testid="chat-input-bar">
          {isVip && Platform.OS === 'web' && (
            <TouchableOpacity style={s.imageBtn} onPress={handleImageUpload} disabled={imageAnalyzing} data-testid="chart-upload-btn" testID="chart-upload-btn">
              <Ionicons name={imageAnalyzing ? 'hourglass-outline' : 'image-outline'} size={18} color={imageAnalyzing ? '#475569' : '#A78BFA'} />
            </TouchableOpacity>
          )}
          <TextInput
            style={[s.input, { color: colors.text }]}
            value={input}
            onChangeText={setInput}
            placeholder={tAtlas("chat.placeholder", lang)}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            onKeyPress={(e: any) => { if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) { e.preventDefault?.(); sendMessage(); } }}
            data-testid="chat-input" testID="chat-input"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
            data-testid="send-message-btn" testID="send-message-btn"
          >
            <Ionicons name="arrow-up" size={18} color={input.trim() && !loading ? '#0B0914' : '#475569'} />
          </TouchableOpacity>
        </View>
        <Text style={s.disclaimer}>{tAtlas('chat.disclaimer', lang)}</Text>
      </View>

      {/* VIP Modal */}
      <VipUpgradeModal visible={showVipModal} onClose={() => setShowVipModal(false)} lang={lang} onUpgrade={() => { setShowVipModal(false); router.push('/vip'); }} />
    </KeyboardAvoidingView>
  );
}

// ============ MODULES VIEW ============
function ModulesView({ token, lang, onContinueModule }: { token: string; lang: string; onContinueModule?: (title: string) => void }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<any>(null);

  const loadModules = useCallback(async () => {
    try {
      const url = filter ? `/api/atlas/modules?status=${filter}` : '/api/atlas/modules';
      const data = await api(url, token);
      setModules(data.modules || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => { loadModules(); }, [loadModules]);

  const loadDetail = async (moduleId: string) => {
    try { const data = await api(`/api/atlas/modules/${moduleId}`, token); setSelectedModule(data); } catch (e) { console.error(e); }
  };

  const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
    not_started: { icon: 'ellipse-outline', color: '#64748B', label: tAtlas('status.not_started', lang) },
    in_progress: { icon: 'play-circle', color: '#3B82F6', label: tAtlas('status.in_progress', lang) },
    completed: { icon: 'checkmark-circle', color: '#10B981', label: tAtlas('status.completed', lang) },
    mastered: { icon: 'star', color: '#F59E0B', label: tAtlas('status.mastered', lang) },
  };
  const categoryIcons: Record<string, string> = { crypto: 'logo-bitcoin', blockchain: 'cube', trading: 'trending-up', defi: 'swap-horizontal', security: 'shield-checkmark', nft: 'image', regulation: 'document-text', portfolio: 'pie-chart', general: 'school' };

  if (selectedModule) {
    const mod = selectedModule.module;
    const prog = selectedModule.progress;
    const quizzes = selectedModule.recent_quizzes || [];
    const sc = statusConfig[mod.status] || statusConfig.not_started;
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => setSelectedModule(null)} style={s.backBtn} data-testid="modules-back-btn">
          <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          <Text style={s.backText}>{tAtlas("mod.back", lang)}</Text>
        </TouchableOpacity>
        <View style={s.moduleDetailCard}>
          <View style={[s.moduleStatusBadge, { backgroundColor: sc.color + '20' }]}>
            <Ionicons name={sc.icon as any} size={14} color={sc.color} />
            <Text style={[s.moduleStatusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
          <Text style={s.moduleDetailTitle}>{mod.title}</Text>
          <Text style={s.moduleDetailDesc}>{mod.description}</Text>
          {mod.learning_objective ? <Text style={s.moduleDetailObj}>{tAtlas("mod.objective", lang)} : {mod.learning_objective}</Text> : null}
          <View style={s.masterySection}>
            <Text style={s.masteryLabel}>{tAtlas("mod.mastery", lang)}</Text>
            <View style={s.masteryBarBg}><View style={[s.masteryBarFill, { width: `${mod.mastery_score || 0}%`, backgroundColor: (mod.mastery_score || 0) >= 80 ? '#10B981' : (mod.mastery_score || 0) >= 50 ? '#F59E0B' : '#3B82F6' }]} /></View>
            <Text style={s.masteryPct}>{Math.round(mod.mastery_score || 0)}%</Text>
          </View>
          {prog && (
            <View style={s.progDetails}>
              {prog.concepts_understood?.length > 0 && <View style={s.conceptRow}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={s.conceptText}>{tAtlas("mod.understood", lang)} : {prog.concepts_understood.join(', ')}</Text></View>}
              {prog.concepts_weak?.length > 0 && <View style={s.conceptRow}><Ionicons name="alert-circle" size={14} color="#F59E0B" /><Text style={s.conceptText}>{tAtlas("mod.weak", lang)} : {prog.concepts_weak.join(', ')}</Text></View>}
              {prog.best_quiz_score > 0 && <View style={s.conceptRow}><Ionicons name="trophy" size={14} color="#F59E0B" /><Text style={s.conceptText}>{tAtlas("mod.best_quiz", lang)} : {Math.round(prog.best_quiz_score)}%</Text></View>}
            </View>
          )}
          {mod.content ? <View style={s.contentSection}><Text style={s.contentTitle}>{tAtlas("mod.content", lang)}</Text><Text style={s.contentText}>{mod.content}</Text></View> : null}
          {quizzes.length > 0 && (
            <View style={s.quizHistory}><Text style={s.quizHistoryTitle}>{tAtlas("mod.quiz_history", lang)}</Text>
              {quizzes.map((q: any, i: number) => <View key={i} style={s.quizRow}><Text style={s.quizScore}>{Math.round(q.score)}%</Text><Text style={s.quizMeta}>{q.correct_answers}/{q.questions_count} correct</Text><Text style={s.quizDate}>{new Date(q.created_at).toLocaleDateString()}</Text></View>)}
            </View>
          )}
          <TouchableOpacity style={s.continueModuleBtn} onPress={() => onContinueModule?.(mod.title)} testID="continue-module-btn">
            <Ionicons name="chatbubbles" size={18} color="#fff" />
            <Text style={s.continueModuleBtnText}>{tAtlas("mod.continue", lang)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const filters = [
    { key: null, label: tAtlas('filter.all', lang) }, { key: 'in_progress', label: tAtlas('filter.in_progress', lang) },
    { key: 'not_started', label: tAtlas('filter.not_started', lang) }, { key: 'mastered', label: tAtlas('filter.mastered', lang) },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {filters.map(f => <TouchableOpacity key={f.key ?? 'all'} style={[s.filterChip, filter === f.key && s.filterChipActive]} onPress={() => { setFilter(f.key); setLoading(true); }}><Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text></TouchableOpacity>)}
      </ScrollView>
      {loading ? <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 40 }} /> : modules.length === 0 ? (
        <View style={s.emptyModules}><Ionicons name="school-outline" size={48} color="#334155" /><Text style={s.emptyModulesTitle}>{tAtlas("mod.empty.title", lang)}</Text><Text style={s.emptyModulesDesc}>{tAtlas("mod.empty.desc", lang)}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {modules.map(m => {
            const sc = statusConfig[m.status] || statusConfig.not_started;
            const catIcon = categoryIcons[m.category] || 'school';
            return (
              <TouchableOpacity key={m.id} style={s.moduleCard} onPress={() => loadDetail(m.id)} data-testid={`module-${m.id}`}>
                <View style={[s.moduleCatIcon, { backgroundColor: sc.color + '15' }]}><Ionicons name={catIcon as any} size={20} color={sc.color} /></View>
                <View style={s.moduleCardCenter}>
                  <Text style={s.moduleCardTitle} numberOfLines={2}>{m.title}</Text>
                  <View style={s.moduleCardMeta}>
                    <View style={[s.moduleStatusBadge, { backgroundColor: sc.color + '20' }]}><Ionicons name={sc.icon as any} size={10} color={sc.color} /><Text style={[s.moduleStatusText, { color: sc.color, fontSize: 10 }]}>{sc.label}</Text></View>
                    <Text style={s.moduleLevelText}>{m.level}</Text>
                  </View>
                </View>
                <View style={s.moduleCardRight}>
                  <Text style={[s.moduleMasteryPct, { color: sc.color }]}>{Math.round(m.mastery_score)}%</Text>
                  <View style={s.miniBar}><View style={[s.miniBarFill, { width: `${m.mastery_score}%`, backgroundColor: sc.color }]} /></View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ============ PROGRESS VIEW ============
function ProgressView({ token, lang }: { token: string; lang: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api('/api/atlas/progress', token).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false)); }, [token]);

  if (loading) return <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 40 }} />;
  if (!data) return <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 40 }}>{tAtlas('prog.error', lang)}</Text>;

  const profile = data.profile || {};
  const summary = data.modules_summary || {};
  const categories = data.categories || {};
  const quizzes = data.recent_quizzes || [];
  const levelColors: Record<string, string> = { unknown: '#64748B', beginner: '#10B981', intermediate: '#F59E0B', advanced: '#EF4444', expert: '#A78BFA' };
  const levelLabels = (l: string) => tAtlas(`level.${l}`, lang);
  const skillFields = [
    { key: 'crypto_level', label: tAtlas('skill.crypto', lang), icon: 'logo-bitcoin' },
    { key: 'blockchain_level', label: tAtlas('skill.blockchain', lang), icon: 'cube' },
    { key: 'trading_level', label: tAtlas('skill.trading', lang), icon: 'trending-up' },
    { key: 'finance_level', label: tAtlas('skill.finance', lang), icon: 'cash' },
    { key: 'risk_management_level', label: tAtlas('skill.risk', lang), icon: 'shield-checkmark' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={s.progressCard}><Text style={s.progressCardTitle}>{tAtlas('prog.level', lang)}</Text><View style={s.levelRow}><View style={[s.levelBadge, { backgroundColor: (levelColors[profile.overall_level] || '#64748B') + '20' }]}><Text style={[s.levelBadgeText, { color: levelColors[profile.overall_level] || '#64748B' }]}>{levelLabels(profile.overall_level || 'unknown')}</Text></View>{!profile.onboarding_completed && <Text style={s.onboardingHint}>{tAtlas('prog.onboarding_hint', lang)}</Text>}</View></View>
      <View style={s.progressCard}><Text style={s.progressCardTitle}>{tAtlas('prog.skills', lang)}</Text>{skillFields.map(sf => { const val = profile[sf.key] || 0; return <View key={sf.key} style={s.skillRow}><Ionicons name={sf.icon as any} size={16} color="#64748B" style={{ width: 24 }} /><Text style={s.skillLabel}>{sf.label}</Text><View style={s.skillBarBg}><View style={[s.skillBarFill, { width: `${val * 10}%` }]} /></View><Text style={s.skillVal}>{val}/10</Text></View>; })}</View>
      <View style={s.progressCard}><Text style={s.progressCardTitle}>{tAtlas('prog.modules', lang)}</Text><View style={s.statsRow}><View style={s.statBox}><Text style={s.statNum}>{summary.total || 0}</Text><Text style={s.statLabel}>{tAtlas('prog.total', lang)}</Text></View><View style={s.statBox}><Text style={[s.statNum, { color: '#3B82F6' }]}>{summary.in_progress || 0}</Text><Text style={s.statLabel}>{tAtlas('prog.in_progress', lang)}</Text></View><View style={s.statBox}><Text style={[s.statNum, { color: '#F59E0B' }]}>{summary.mastered || 0}</Text><Text style={s.statLabel}>{tAtlas('prog.mastered', lang)}</Text></View></View></View>
      {Object.keys(categories).length > 0 && <View style={s.progressCard}><Text style={s.progressCardTitle}>{tAtlas('prog.categories', lang)}</Text>{Object.entries(categories).map(([cat, info]: [string, any]) => <View key={cat} style={s.catRow}><Text style={s.catName}>{cat}</Text><View style={s.catBarBg}><View style={[s.catBarFill, { width: `${info.avg_mastery}%` }]} /></View><Text style={s.catPct}>{Math.round(info.avg_mastery)}%</Text></View>)}</View>}
      {quizzes.length > 0 && <View style={s.progressCard}><Text style={s.progressCardTitle}>{tAtlas('prog.recent_quiz', lang)}</Text>{quizzes.slice(0, 5).map((q: any, i: number) => <View key={i} style={s.quizRow}><Ionicons name="document-text" size={14} color="#A78BFA" /><Text style={s.quizScore}>{Math.round(q.score)}%</Text><Text style={s.quizMeta}>{q.correct_answers}/{q.questions_count}</Text><Text style={s.quizDate}>{new Date(q.created_at).toLocaleDateString()}</Text></View>)}</View>}
    </ScrollView>
  );
}

// ============ MAIN COMPONENT ============
export default function LearnScreen() {
  const { token } = useAuthStore();
  const { language } = useTranslation();
  const { colors, mode } = useThemeStore();
  const lang = language || 'fr';
  const [tab, setTab] = useState<Tab>('chat');
  const [continueModuleMsg, setContinueModuleMsg] = useState<string | null>(null);

  const handleContinueModule = (moduleTitle: string) => {
    const msg = lang === 'fr' ? `Je veux continuer le module "${moduleTitle}". Reprends là où on en était.`
      : lang === 'es' ? `Quiero continuar el módulo "${moduleTitle}". Retoma donde lo dejamos.`
      : `I want to continue the module "${moduleTitle}". Pick up where we left off.`;
    setContinueModuleMsg(msg);
    setTab('chat');
  };

  if (!token) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.authPrompt}>
          <Ionicons name="lock-closed-outline" size={40} color="#334155" />
          <Text style={s.authTitle}>{tAtlas("auth.required", lang)}</Text>
          <Text style={s.authDesc}>{tAtlas("auth.desc", lang)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={[]}>
      {/* Sub-nav */}
      <View style={[s.subNav, { borderBottomColor: colors.borderSubtle }]}>
        {([
          { key: 'chat' as Tab, icon: 'chatbubbles', label: tAtlas('tab.chat', lang) },
          { key: 'modules' as Tab, icon: 'library', label: tAtlas('tab.modules', lang) },
          { key: 'progress' as Tab, icon: 'stats-chart', label: tAtlas('tab.progress', lang) },
        ]).map(item => (
          <TouchableOpacity key={item.key} style={[s.subNavItem, tab === item.key && s.subNavActive]} onPress={() => setTab(item.key)} testID={`atlas-tab-${item.key}`}>
            <Ionicons name={(tab === item.key ? item.icon : item.icon + '-outline') as any} size={14} color={tab === item.key ? '#A78BFA' : colors.textMuted} />
            <Text style={[s.subNavText, { color: colors.textMuted }, tab === item.key && s.subNavTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'chat' && <ChatView token={token} lang={lang} initialMessage={continueModuleMsg} onMessageSent={() => setContinueModuleMsg(null)} />}
      {tab === 'modules' && <ModulesView token={token} lang={lang} onContinueModule={handleContinueModule} />}
      {tab === 'progress' && <ProgressView token={token} lang={lang} />}
    </SafeAreaView>
  );
}

// ============ STYLES ============
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0914' },
  subNav: { flexDirection: 'row', paddingLeft: 56, paddingRight: 12, paddingVertical: 6, gap: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  subNavItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  subNavActive: { backgroundColor: 'rgba(167,139,250,0.1)' },
  subNavText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  subNavTextActive: { color: '#A78BFA', fontWeight: '600' },

  // Auth
  authPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  authTitle: { fontSize: 17, fontWeight: '600', color: '#E2E8F0' },
  authDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },

  // Chat header — premium minimal
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#F1F5F9', letterSpacing: -0.3 },
  chatHeaderSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  chatHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  atlasAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  atlasAvatarText: { color: '#C4B5FD', fontSize: 14, fontWeight: '700' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },

  // Upgrade header button
  upgradeHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', backgroundColor: 'rgba(167,139,250,0.06)' },
  upgradeHeaderText: { fontSize: 11, fontWeight: '600', color: '#A78BFA' },

  headerIconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },

  // Language
  langBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', backgroundColor: 'rgba(167,139,250,0.06)' },
  langBtnText: { fontSize: 11, fontWeight: '700', color: '#A78BFA' },
  langDropdown: { position: 'absolute', top: 92, right: 16, backgroundColor: '#151022', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)', zIndex: 100, minWidth: 140, overflow: 'hidden' },
  langOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  langOptionActive: { backgroundColor: 'rgba(167,139,250,0.08)' },
  langOptionText: { fontSize: 13, color: '#CBD5E1', fontWeight: '500' },

  // Messages
  messagesContainer: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 8 },

  // Welcome — clean and centered
  welcomeWrap: { alignItems: 'center', paddingTop: 80, paddingBottom: 40 },
  welcomeAvatarWrap: { marginBottom: 20 },
  welcomeAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', alignItems: 'center', justifyContent: 'center' },
  welcomeAvatarText: { color: '#C4B5FD', fontSize: 22, fontWeight: '700' },
  welcomeGreeting: { fontSize: 22, fontWeight: '700', color: '#F1F5F9', letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  welcomeDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', maxWidth: 320, lineHeight: 20 },

  // Suggestions — elegant cards
  sugGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 32, maxWidth: 440, justifyContent: 'center' },
  sugCard: { width: '47%', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'column', gap: 6 },
  sugText: { fontSize: 12, color: '#94A3B8', lineHeight: 17 },

  // Messages — modern AI style
  msgRow: { flexDirection: 'row', marginBottom: 20, gap: 10, alignItems: 'flex-start' },
  msgRowUser: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)' },
  msgAvatarText: { color: '#C4B5FD', fontSize: 12, fontWeight: '700' },
  msgBubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  msgBubbleAtlas: { backgroundColor: 'rgba(167,139,250,0.06)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.08)', borderTopLeftRadius: 4 },
  msgBubbleUser: { backgroundColor: '#A78BFA', borderTopRightRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 22, color: '#E2E8F0' },
  msgTextUser: { color: '#0B0914' },

  // Thinking indicator
  thinkingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingVertical: 4 },
  thinkingGlow: { },
  thinkingAvatarSmall: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  thinkingAvatarText: { color: '#C4B5FD', fontSize: 12, fontWeight: '700' },
  thinkingContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkingLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  thinkingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  thinkingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A78BFA' },

  // Input — premium floating bar
  inputBarWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 22, paddingHorizontal: 6, paddingVertical: 6 },
  input: { flex: 1, color: '#E2E8F0', fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.04)' },
  imageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(167,139,250,0.1)', alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 6 },

  // Upgrade prompt
  upgradePrompt: { marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(167,139,250,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.12)' },
  upgradePromptContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  upgradeTitle: { fontSize: 13, fontWeight: '600', color: '#C4B5FD', marginBottom: 3 },
  upgradeDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  upgradeCta: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#A78BFA', borderRadius: 10, paddingVertical: 10 },
  upgradeCtaText: { fontSize: 13, fontWeight: '700', color: '#0B0914' },

  // Degrade banner
  degradeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  degradeContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  degradeText: { fontSize: 12, color: '#F59E0B', fontWeight: '500' },
  degradeCta: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.15)' },
  degradeCtaText: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },

  // Sidebar
  sidebarWrap: { flex: 1, backgroundColor: '#0B0914' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  sidebarTitle: { fontSize: 17, fontWeight: '700', color: '#F1F5F9' },
  newConvBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', borderStyle: 'dashed' },
  newConvText: { fontSize: 14, fontWeight: '600', color: '#A78BFA' },
  convItem: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 12, marginBottom: 4, borderRadius: 10, gap: 12 },
  convItemActive: { backgroundColor: 'rgba(167,139,250,0.08)' },
  convTitle: { fontSize: 14, fontWeight: '500', color: '#E2E8F0' },
  convMeta: { fontSize: 11, color: '#475569', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#334155', marginTop: 40, fontSize: 14 },

  // Modules
  filterBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, marginRight: 8 },
  filterChipActive: { borderBottomWidth: 2, borderBottomColor: '#A78BFA' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterTextActive: { color: '#A78BFA' },
  emptyModules: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, marginTop: 40 },
  emptyModulesTitle: { fontSize: 17, fontWeight: '600', color: '#E2E8F0' },
  emptyModulesDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  moduleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, gap: 12 },
  moduleCatIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moduleCardCenter: { flex: 1, gap: 6 },
  moduleCardTitle: { fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  moduleCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moduleStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  moduleStatusText: { fontSize: 11, fontWeight: '600' },
  moduleLevelText: { fontSize: 11, color: '#475569', textTransform: 'capitalize' },
  moduleCardRight: { alignItems: 'flex-end', gap: 4, width: 50 },
  moduleMasteryPct: { fontSize: 14, fontWeight: '700' },
  miniBar: { width: 40, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  miniBarFill: { height: 3, borderRadius: 2 },

  // Module detail
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  moduleDetailCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20 },
  moduleDetailTitle: { fontSize: 20, fontWeight: '700', color: '#F1F5F9', marginTop: 12 },
  moduleDetailDesc: { fontSize: 14, color: '#94A3B8', marginTop: 8, lineHeight: 22 },
  moduleDetailObj: { fontSize: 13, color: '#A78BFA', marginTop: 12, fontStyle: 'italic' },
  masterySection: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  masteryLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', width: 60 },
  masteryBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  masteryBarFill: { height: 5, borderRadius: 3 },
  masteryPct: { fontSize: 13, fontWeight: '700', color: '#E2E8F0', width: 36, textAlign: 'right' },
  progDetails: { marginTop: 16, gap: 8 },
  conceptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  conceptText: { fontSize: 12, color: '#94A3B8', flex: 1 },
  contentSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  contentTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  contentText: { fontSize: 13, color: '#94A3B8', lineHeight: 22 },
  quizHistory: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  quizHistoryTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 12 },

  // Progress
  progressCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16 },
  progressCardTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 14 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  levelBadgeText: { fontSize: 14, fontWeight: '700' },
  onboardingHint: { fontSize: 12, color: '#64748B', flex: 1 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  skillLabel: { fontSize: 12, color: '#94A3B8', width: 90 },
  skillBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  skillBarFill: { height: 4, borderRadius: 2, backgroundColor: '#A78BFA' },
  skillVal: { fontSize: 11, color: '#475569', width: 30, textAlign: 'right' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: 24, fontWeight: '800', color: '#F1F5F9' },
  statLabel: { fontSize: 11, color: '#64748B' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catName: { fontSize: 12, color: '#94A3B8', width: 80, textTransform: 'capitalize' },
  catBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  catBarFill: { height: 4, borderRadius: 2, backgroundColor: '#A78BFA' },
  catPct: { fontSize: 11, color: '#475569', width: 32, textAlign: 'right' },
  quizRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  quizScore: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', width: 40 },
  quizMeta: { fontSize: 12, color: '#64748B', flex: 1 },
  quizDate: { fontSize: 11, color: '#334155' },
  continueModuleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#A78BFA', borderRadius: 12, paddingVertical: 14, marginTop: 20 },
  continueModuleBtnText: { fontSize: 15, fontWeight: '700', color: '#0B0914' },

  // VIP Modal
  vipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  vipModal: { width: '100%', maxWidth: 420, backgroundColor: '#0F0A1E', borderRadius: 20, padding: 32, borderWidth: 1, borderColor: 'rgba(167,139,250,0.12)' },
  vipClose: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
  vipHeader: { alignItems: 'center', marginBottom: 24 },
  vipIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  vipTitle: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5 },
  vipSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4, textAlign: 'center' },
  vipPriceWrap: { alignItems: 'center', marginBottom: 24 },
  vipPrice: { fontSize: 28, fontWeight: '800', color: '#A78BFA', letterSpacing: -0.5 },
  vipFeatures: { gap: 16, marginBottom: 28 },
  vipFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  vipFeatureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  vipFeatureText: { flex: 1 },
  vipFeatureName: { fontSize: 14, fontWeight: '600', color: '#E2E8F0', marginBottom: 2 },
  vipFeatureDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  vipCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#A78BFA', borderRadius: 12, paddingVertical: 14, marginBottom: 12 },
  vipCtaText: { fontSize: 15, fontWeight: '700', color: '#0B0914' },
  vipCancel: { fontSize: 11, color: '#475569', textAlign: 'center' },
});
