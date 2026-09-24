import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Modal, Animated, Easing, Share,
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
  'chat.welcome.greeting': { fr: 'Bonjour, comment puis-je vous aider ?', en: 'Hello, how can I help you?', es: 'Hola, ¿cómo puedo ayudarte?' },
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
  'mod.continue': { fr: 'Continuer ce module', en: 'Continue this module', es: 'Continuar este módulo' },
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
  // Gamification
  'gam.streak': { fr: 'Streak', en: 'Streak', es: 'Racha' },
  'gam.days': { fr: 'jours', en: 'days', es: 'días' },
  'gam.badges': { fr: 'Badges', en: 'Badges', es: 'Insignias' },
  'gam.earned': { fr: 'obtenus', en: 'earned', es: 'obtenidas' },
  'gam.unlocked': { fr: 'Nouveau badge !', en: 'Badge unlocked!', es: 'Nueva insignia!' },
  'gam.congrats': { fr: 'Félicitations !', en: 'Congratulations!', es: 'Felicidades!' },
  'gam.keep_going': { fr: 'Continue comme ça !', en: 'Keep it up!', es: 'Sigue asi!' },
  'prog.in_progress': { fr: 'En cours', en: 'In progress', es: 'En curso' },
  'prog.mastered': { fr: 'Maîtrisés', en: 'Mastered', es: 'Dominados' },
  'prog.onboarding_hint': { fr: 'Discute avec Caufid pour évaluer ton niveau', en: 'Chat with Caufid to evaluate your level', es: 'Habla con Caufid para evaluar tu nivel' },
  'prog.error': { fr: 'Erreur de chargement', en: 'Loading error', es: 'Error de carga' },
  // Smart Upgrade Prompt
  'upgrade.title': { fr: 'Caufid peut aller encore plus loin', en: 'Caufid can go even further', es: 'Caufid puede ir aún más lejos' },
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
  // Progression Hub
  'hub.daily_goals': { fr: 'Objectifs du jour', en: "Today's Goals", es: 'Objetivos del d\u00eda' },
  'hub.skills': { fr: 'Comp\u00e9tences', en: 'Skills', es: 'Competencias' },
  'hub.badges': { fr: 'Badges', en: 'Badges', es: 'Insignias' },
  'hub.modules_overview': { fr: 'Modules', en: 'Modules', es: 'M\u00f3dulos' },
  'hub.quiz_stats': { fr: 'Quiz', en: 'Quiz', es: 'Quiz' },
  'hub.avg_score': { fr: 'Score moyen', en: 'Avg. score', es: 'Puntuaci\u00f3n media' },
  'hub.perfect_scores': { fr: 'Parfaits', en: 'Perfect', es: 'Perfectos' },
  'hub.days_active': { fr: 'Jours actifs', en: 'Days active', es: 'D\u00edas activos' },
  'hub.in_progress': { fr: 'En cours', en: 'In progress', es: 'En curso' },
  'hub.completed': { fr: 'Compl\u00e9t\u00e9s', en: 'Completed', es: 'Completados' },
  'hub.mastered': { fr: 'Ma\u00eetris\u00e9s', en: 'Mastered', es: 'Dominados' },
  'hub.priority.resume': { fr: 'Reprendre', en: 'Resume', es: 'Continuar' },
  'hub.priority.start': { fr: 'Commence ton parcours', en: 'Start your journey', es: 'Comienza tu camino' },
  'hub.priority.start_desc': { fr: 'Discute avec Caufid pour cr\u00e9er ton premier module', en: 'Chat with Caufid to create your first module', es: 'Habla con Caufid para crear tu primer m\u00f3dulo' },
  'hub.priority.strengthen': { fr: 'Renforcer', en: 'Strengthen', es: 'Reforzar' },
  'hub.bonus_xp': { fr: 'Bonus', en: 'Bonus', es: 'Bonus' },
  'hub.almost': { fr: 'Presque d\u00e9bloqu\u00e9', en: 'Almost unlocked', es: 'Casi desbloqueado' },
  'hub.recent': { fr: 'R\u00e9cents', en: 'Recent', es: 'Recientes' },
  'hub.analyze': { fr: 'Analyser ma progression', en: 'Analyze my progress', es: 'Analizar mi progreso' },
  'hub.analyze_desc': { fr: 'Caufid analyse tes forces et faiblesses', en: 'Caufid analyzes your strengths and weaknesses', es: 'Caufid analiza tus fortalezas y debilidades' },
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

// ============ XP TOAST ============
function XpToast({ amount, onDone }: { amount: number; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(translateY, { toValue: -60, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute', top: 80, alignSelf: 'center', zIndex: 300,
      transform: [{ translateY }, { scale }], opacity,
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#0F0A1E', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12,
        borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
        shadowColor: '#A78BFA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
      }}>
        <Ionicons name="star" size={18} color="#F59E0B" />
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#F59E0B' }}>+{amount} XP</Text>
      </View>
    </Animated.View>
  );
}

// ============ LEVEL UP CELEBRATION ============
function LevelUpCelebration({ level, name, color, lang, onClose }: { level: number; name: string; color: string; lang: string; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.loop(Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring1, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])),
        Animated.loop(Animated.sequence([
          Animated.timing(ring2, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring2, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])),
      ]),
    ]).start();
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, []);

  const titleText = lang === 'fr' ? 'Niveau superieur !' : lang === 'es' ? 'Nuevo nivel!' : 'Level Up!';

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 250,
      opacity,
    }}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: color, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>
          {titleText}
        </Text>
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, marginBottom: 20 }}>
          <Animated.View style={{
            position: 'absolute', width: 120, height: 120, borderRadius: 60,
            borderWidth: 2, borderColor: color,
            opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }),
            transform: [{ scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
          }} />
          <Animated.View style={{
            position: 'absolute', width: 100, height: 100, borderRadius: 50,
            borderWidth: 1.5, borderColor: color,
            opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.3] }),
            transform: [{ scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }],
          }} />
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: `${color}20`, borderWidth: 3, borderColor: color,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: color }}>{level}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5 }}>{name}</Text>
        <TouchableOpacity onPress={onClose} style={{
          marginTop: 28, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
          backgroundColor: `${color}20`, borderWidth: 1, borderColor: `${color}40`,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: color }}>OK</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}



// ============ BADGE CELEBRATION ============
function BadgeCelebration({ badge, lang, onClose }: { badge: any; lang: string; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shine, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(shine, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ]).start();
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, []);

  const badgeName = badge?.name?.[lang] || badge?.name?.en || '';

  return (
    <Animated.View style={[{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 200,
    }, { opacity }]} data-testid="badge-celebration">
      <Animated.View style={{
        transform: [{ scale }],
        alignItems: 'center', backgroundColor: '#0F0A1E', borderRadius: 24,
        padding: 36, borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
        minWidth: 260, maxWidth: 340,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#A78BFA', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          {tAtlas('gam.congrats', lang)}
        </Text>
        <Animated.View style={{
          width: 80, height: 80, borderRadius: 24,
          backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 2, borderColor: 'rgba(167,139,250,0.4)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
          transform: [{ scale: shine.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
        }}>
          <Ionicons name={(badge?.icon || 'ribbon') as any} size={36} color="#A78BFA" />
        </Animated.View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#F1F5F9', marginBottom: 4, textAlign: 'center' }}>
          {badgeName}
        </Text>
        <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
          {tAtlas('gam.keep_going', lang)}
        </Text>
        <TouchableOpacity onPress={onClose} style={{
          paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
          backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
        }} data-testid="badge-celebration-close">
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#A78BFA' }}>OK</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}


// ============ UPGRADE BANNER (animated, below header) ============
function UpgradeBanner({ lang, onPress }: { lang: string; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} data-testid="header-upgrade-btn" style={s.upgradeBanner}>
      <Animated.View style={[s.upgradeBannerInner, {
        opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
      }]}>
        <Animated.View style={{
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
        }}>
          <Ionicons name="diamond" size={14} color="#FFD700" />
        </Animated.View>
        <Text style={s.upgradeBannerText}>{tAtlas('upgrade.badge', lang)}</Text>
        <Ionicons name="arrow-forward" size={12} color="#A78BFA" />
      </Animated.View>
    </TouchableOpacity>
  );
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
function VipUpgradeModal({ visible, onClose, lang, token }: { visible: boolean; onClose: () => void; lang: string; token: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const features = [
    { key: 'memory', icon: 'bulb-outline' as const },
    { key: 'chart', icon: 'analytics-outline' as const },
    { key: 'market', icon: 'trending-up-outline' as const },
    { key: 'learn', icon: 'school-outline' as const },
    { key: 'briefing', icon: 'today-outline' as const },
  ];

  const handleUpgrade = async () => {
    if (!token) { onClose(); router.push('/login'); return; }
    setLoading(true);
    try {
      const origin = Platform.OS === 'web' ? window.location.origin : 'https://app.mentova-academy.com';
      const res = await fetch(`${API}/api/vip/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin_url: origin }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        onClose();
        if (Platform.OS === 'web') window.open(data.checkout_url, '_self');
      } else if (data.detail) {
        // Already VIP or error — navigate to VIP hub
        onClose();
        router.push('/vip/hub');
      }
    } catch (e) {
      console.error('Checkout error:', e);
      onClose();
      router.push('/vip');
    }
    finally { setLoading(false); }
  };

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
          <TouchableOpacity style={[s.vipCta, loading && { opacity: 0.6 }]} onPress={handleUpgrade} disabled={loading} data-testid="vip-upgrade-btn">
            {loading ? <ActivityIndicator size="small" color="#0B0914" /> : <Ionicons name="diamond" size={16} color="#0B0914" />}
            <Text style={s.vipCtaText}>{loading ? '...' : tAtlas('vip.cta', lang)}</Text>
          </TouchableOpacity>
          <Text style={s.vipCancel}>{tAtlas('vip.cancel', lang)}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ============ TYPEWRITER TEXT (Client-side streaming) ============
function TypewriterText({ text, style, speed = 12 }: { text: string; style?: any; speed?: number }) {
  const safeText = String(text ?? '').replace(/\bundefined\b/g, '');
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;
    if (!safeText) return;
    const words = safeText.split(' ').filter(w => w !== 'undefined');
    const interval = setInterval(() => {
      if (indexRef.current < words.length) {
        setDisplayedText(prev => prev + (indexRef.current > 0 ? ' ' : '') + words[indexRef.current]);
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [safeText, speed]);

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
  const [celebrationBadge, setCelebrationBadge] = useState<any>(null);
  const earnedBadgeIdsRef = useRef<Set<string>>(new Set());
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
              setMessages(prev => [...prev, { role: 'assistant', content: data.response || '' }]);
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
    // Load initial badges for comparison
    fetch(`${API}/api/atlas/gamification`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const earned = (d.badges || []).filter((b: any) => b.earned).map((b: any) => b.id);
        earnedBadgeIdsRef.current = new Set(earned);
      }).catch(() => {});
  }, [token]);

  const checkNewBadges = useCallback(async () => {
    try {
      const data = await api('/api/atlas/gamification', token);
      const currentEarned = (data.badges || []).filter((b: any) => b.earned);
      for (const badge of currentEarned) {
        if (!earnedBadgeIdsRef.current.has(badge.id)) {
          earnedBadgeIdsRef.current.add(badge.id);
          setCelebrationBadge(badge);
          return;
        }
      }
    } catch { /* silent */ }
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
      setMessages((data.messages || []).map((m: any) => ({ role: m.role, content: String(m.content ?? '').replace(/\bundefined\b/g, '') })));
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
        const responseText = String(data.response || data.message || data.text || '').replace(/\bundefined\b/g, '');
        if (responseText) {
          setMessages(prev => {
            const newMsgs = [...prev, { role: 'assistant' as const, content: responseText }];
            setLatestAssistantIdx(newMsgs.length - 1);
            return newMsgs;
          });
        }
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
    // Check for new badges after each response
    setTimeout(() => checkNewBadges(), 1500);
  }, [input, loading, activeConvId, token, lang, loadConversations, checkNewBadges]);

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
            <View key={c.id} style={[s.convItem, activeConvId === c.id && s.convItemActive]}>
              <TouchableOpacity style={{ flex: 1, overflow: 'hidden' }} onPress={() => loadConversation(c.id)} activeOpacity={0.7} data-testid={`conv-${c.id}`}>
                {renamingConvId === c.id ? (
                  <TextInput style={[s.convTitle, { borderBottomWidth: 1, borderBottomColor: '#A78BFA', paddingVertical: 2 }]} value={renameText} onChangeText={setRenameText} autoFocus onSubmitEditing={() => renameConversation(c.id)} onBlur={() => renameConversation(c.id)} maxLength={200} />
                ) : (
                  <><Text style={s.convTitle} numberOfLines={1}>{c.title}</Text><Text style={s.convMeta}>{c.message_count} {tAtlas("chat.messages", lang)}</Text></>
                )}
              </TouchableOpacity>
              {renamingConvId !== c.id && (
                <View style={{ flexDirection: 'row', gap: 4, flexShrink: 0, zIndex: 10 }}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); setRenamingConvId(c.id); setRenameText(c.title); }}
                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.08)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={0.6}
                    data-testid={`conv-rename-${c.id}`}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#A78BFA" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); deleteConversation(c.id); }}
                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={0.6}
                    data-testid={`conv-delete-${c.id}`}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          {conversations.length === 0 && !loadingConvos && <Text style={s.emptyText}>{tAtlas("chat.empty", lang)}</Text>}
        </ScrollView>
      </View>
    );
  }

// ============ PREMIUM INTRO GLOW ============
function CaufidIntroGlow({ children }: { children: React.ReactNode }) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: ['rgba(124,58,237,0.8)', 'rgba(167,139,250,0.9)', 'rgba(96,165,250,0.7)', 'rgba(124,58,237,0)'],
  });

  return (
    <Animated.View style={{
      flex: 1,
      borderWidth: 1.5,
      borderColor,
      borderRadius: 2,
    }}>
      {children}
    </Animated.View>
  );
}

  // Main chat view
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      {/* Header — compact column layout for mobile */}
      <View style={[s.chatHeader, { borderBottomColor: colors.borderSubtle }]} data-testid="atlas-chat-header">
        <View style={s.chatHeaderRow1}>
          <View style={s.chatHeaderLeft}>
            <View style={[s.atlasAvatar, { backgroundColor: colors.primaryGlow, borderColor: colors.border }]}><Text style={[s.atlasAvatarText, { color: colors.primary }]}>C</Text></View>
            <View>
              <View style={s.chatHeaderTitleRow}>
                <Text style={[s.chatHeaderTitle, { color: colors.text }]}>Caufid</Text>
                <View style={s.onlineDot} />
              </View>
              <Text style={[s.chatHeaderSub, { color: colors.textMuted }]}>{tAtlas('chat.welcome.desc', lang)}</Text>
            </View>
          </View>
          <View style={s.chatHeaderRight}>
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
        {/* VIP upgrade banner - below header, animated */}
        {!isVip && <UpgradeBanner lang={lang} onPress={() => setShowVipModal(true)} />}
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
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.messagesContainer}>
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
                  <TypewriterText text={String(m.content ?? '')} style={[s.msgText, { color: colors.text }]} speed={15} />
                ) : (
                  <Text style={[s.msgText, m.role === 'user' ? s.msgTextUser : { color: colors.text }]}>{String(m.content ?? '').replace(/\bundefined\b/g, '')}</Text>
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
      <VipUpgradeModal visible={showVipModal} onClose={() => setShowVipModal(false)} lang={lang} token={token} />

      {/* Badge Celebration */}
      {celebrationBadge && (
        <BadgeCelebration badge={celebrationBadge} lang={lang} onClose={() => setCelebrationBadge(null)} />
      )}
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
// ============ BADGE DETAIL MODAL ============
function BadgeDetailModal({ visible, badge, lang, onClose }: { visible: boolean; badge: any; lang: string; onClose: () => void }) {
  if (!badge) return null;
  const name = badge[`name_${lang}`] || badge.name_en;
  const catMap: Record<string, Record<string, string>> = {
    first_steps: { fr: 'Premiers pas', en: 'First Steps', es: 'Primeros pasos' },
    quiz: { fr: 'Quiz', en: 'Quiz', es: 'Quiz' },
    modules: { fr: 'Modules', en: 'Modules', es: 'Modules' },
    streak: { fr: 'Regularite', en: 'Streak', es: 'Racha' },
    excellence: { fr: 'Excellence', en: 'Excellence', es: 'Excelencia' },
    mastery: { fr: 'Maitrise', en: 'Mastery', es: 'Maestria' },
    milestones: { fr: 'Jalons XP', en: 'XP Milestones', es: 'Hitos XP' },
  };
  const metricDesc: Record<string, Record<string, string>> = {
    days_active: { fr: `Sois actif ${badge.threshold} jour(s)`, en: `Be active for ${badge.threshold} day(s)`, es: `Se activo ${badge.threshold} dia(s)` },
    modules_completed: { fr: `Complete ${badge.threshold} module(s)`, en: `Complete ${badge.threshold} module(s)`, es: `Completa ${badge.threshold} modulo(s)` },
    quiz_count: { fr: `Passe ${badge.threshold} quiz`, en: `Complete ${badge.threshold} quizzes`, es: `Completa ${badge.threshold} quiz` },
    perfect_scores: { fr: `Obtiens ${badge.threshold} score(s) parfait(s)`, en: `Get ${badge.threshold} perfect score(s)`, es: `Obten ${badge.threshold} nota(s) perfecta(s)` },
    modules_mastered: { fr: `Maitrise ${badge.threshold} module(s)`, en: `Master ${badge.threshold} module(s)`, es: `Domina ${badge.threshold} modulo(s)` },
    streak: { fr: `Serie de ${badge.threshold} jour(s)`, en: `${badge.threshold}-day streak`, es: `Racha de ${badge.threshold} dia(s)` },
    total_xp: { fr: `Gagne ${badge.threshold} XP`, en: `Earn ${badge.threshold} XP`, es: `Gana ${badge.threshold} XP` },
  };
  let desc = metricDesc[badge.metric]?.[lang] || metricDesc[badge.metric]?.en || '';
  if (badge.metric?.startsWith('skill_')) {
    const sk = badge.metric.replace('skill_', '');
    desc = lang === 'fr' ? `Atteins le niveau ${badge.threshold} en ${sk}` : lang === 'es' ? `Alcanza nivel ${badge.threshold} en ${sk}` : `Reach level ${badge.threshold} in ${sk}`;
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mds.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={mds.modal}>
          <TouchableOpacity style={mds.closeBtn} onPress={onClose}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          <View style={[mds.bigIcon, badge.earned && { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.35)' }]}>
            <Ionicons name={badge.icon as any} size={36} color={badge.earned ? '#A78BFA' : '#475569'} />
          </View>
          <Text style={mds.modalTitle}>{name}</Text>
          <Text style={mds.catLabel}>{catMap[badge.category]?.[lang] || badge.category}</Text>
          {badge.earned ? (
            <View style={mds.earnedPill}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={mds.earnedTxt}>{lang === 'fr' ? 'Obtenu' : lang === 'es' ? 'Obtenido' : 'Earned'}</Text></View>
          ) : (
            <>
              <Text style={mds.desc}>{desc}</Text>
              <View style={mds.progRow}>
                <View style={mds.progBg}><View style={[mds.progFill, { width: `${Math.round(badge.progress * 100)}%` }]} /></View>
                <Text style={mds.progTxt}>{badge.current_value}/{badge.threshold}</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ XP HISTORY MODAL ============
function XpHistoryModal({ visible, token, lang, onClose }: { visible: boolean; token: string; lang: string; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (visible) {
      setLoading(true);
      api('/api/atlas/progression/xp-history?limit=30', token)
        .then(d => setHistory(d?.history || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);
  const actionIcons: Record<string, string> = { MODULE_COMPLETED: 'book', MODULE_MASTERED: 'school', QUIZ_COMPLETED: 'ribbon', QUIZ_PERFECT: 'flash', DAILY_GOAL_ITEM: 'star', DAILY_GOAL_COMPLETED: 'trophy', STREAK_3: 'flame', STREAK_7: 'flame', MIGRATION: 'sync' };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mds.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[mds.modal, { maxHeight: '80%' }]}>
          <TouchableOpacity style={mds.closeBtn} onPress={onClose}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          <Text style={mds.modalTitle}>{lang === 'fr' ? 'Historique XP' : lang === 'es' ? 'Historial XP' : 'XP History'}</Text>
          {loading ? <ActivityIndicator color="#A78BFA" style={{ marginTop: 20 }} /> : (
            <ScrollView style={{ marginTop: 16, maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {history.length === 0 && <Text style={mds.emptyTxt}>{lang === 'fr' ? 'Aucune transaction' : 'No transactions'}</Text>}
              {history.map((h: any, i: number) => (
                <View key={i} style={mds.histRow}>
                  <View style={mds.histIcon}><Ionicons name={(actionIcons[h.action_type] || 'add-circle') as any} size={16} color="#A78BFA" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={mds.histDesc} numberOfLines={1}>{h.description || h.action_type}</Text>
                    {h.created_at && <Text style={mds.histDate}>{new Date(h.created_at).toLocaleDateString()}</Text>}
                  </View>
                  <Text style={mds.histXp}>+{h.xp_amount}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ SKILL DETAIL MODAL ============
function SkillDetailModal({ visible, skill, lang, relatedMods, userName, onShowCert, onClose }: { visible: boolean; skill: any; lang: string; relatedMods: any[]; userName?: string; onShowCert?: () => void; onClose: () => void }) {
  if (!skill) return null;
  const name = skill[`name_${lang}`] || skill.name_en;
  const scoreColor = skill.score >= 7 ? '#10B981' : skill.score >= 4 ? '#F59E0B' : '#A78BFA';
  const levelLabel = skill.score >= 8 ? (lang === 'fr' ? 'Expert' : 'Expert') : skill.score >= 5 ? (lang === 'fr' ? 'Intermediaire' : 'Intermediate') : skill.score >= 2 ? (lang === 'fr' ? 'Debutant' : 'Beginner') : (lang === 'fr' ? 'Non evalue' : 'Not evaluated');
  const mods = relatedMods.filter((m: any) => (m.category || '').toLowerCase().includes(skill.key));
  const canCertify = skill.score >= 5;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mds.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={mds.modal}>
          <TouchableOpacity style={mds.closeBtn} onPress={onClose}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          <View style={[mds.bigIcon, { borderColor: scoreColor }]}><Ionicons name={skill.icon as any} size={36} color={scoreColor} /></View>
          <Text style={mds.modalTitle}>{name}</Text>
          <Text style={[mds.catLabel, { color: scoreColor }]}>{levelLabel}</Text>
          <View style={mds.progRow}>
            <View style={mds.progBg}><View style={[mds.progFill, { width: `${Math.max(skill.score * 10, 2)}%`, backgroundColor: scoreColor }]} /></View>
            <Text style={mds.progTxt}>{skill.score}/10</Text>
          </View>
          {mods.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={mds.subLabel}>{lang === 'fr' ? 'Modules lies' : 'Related modules'}</Text>
              {mods.slice(0, 5).map((m: any) => (
                <View key={m.id} style={mds.relRow}>
                  <View style={[mds.relDot, { backgroundColor: m.status === 'mastered' ? '#F59E0B' : m.status === 'completed' ? '#10B981' : '#3B82F6' }]} />
                  <Text style={mds.relTitle} numberOfLines={1}>{m.title}</Text>
                </View>
              ))}
            </View>
          )}
          {canCertify && onShowCert ? (
            <TouchableOpacity onPress={() => { onClose(); setTimeout(onShowCert, 300); }} style={mds.certBtn} testID="show-certificate-btn">
              <Ionicons name="ribbon" size={16} color="#F59E0B" />
              <Text style={mds.certBtnTxt}>{lang === 'fr' ? 'Voir le certificat' : lang === 'es' ? 'Ver certificado' : 'View Certificate'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={mds.tipTxt}>
              {lang === 'fr' ? 'Demande a Caufid de creer un module pour ameliorer cette competence.' : lang === 'es' ? 'Pide a Caufid que cree un modulo para mejorar esta competencia.' : 'Ask Caufid to create a module to improve this skill.'}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ CERTIFICATE MODAL ============
function CertificateModal({ visible, skill, userName, levelName, levelNum, lang, onClose }: { visible: boolean; skill: any; userName: string; levelName: string; levelNum: number; lang: string; onClose: () => void }) {
  if (!skill) return null;
  const name = skill[`name_${lang}`] || skill.name_en;
  const scoreColor = skill.score >= 7 ? '#10B981' : skill.score >= 4 ? '#F59E0B' : '#A78BFA';
  const date = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleShare = async () => {
    const msg = lang === 'fr'
      ? `J'ai obtenu un certificat ${name} sur Mentova Academy ! Score: ${skill.score}/10, Niveau ${levelNum}. #Mentova #Crypto`
      : lang === 'es'
      ? `Obtuve un certificado de ${name} en Mentova Academy! Puntuacion: ${skill.score}/10, Nivel ${levelNum}. #Mentova #Crypto`
      : `I earned a ${name} certificate on Mentova Academy! Score: ${skill.score}/10, Level ${levelNum}. #Mentova #Crypto`;
    try {
      await Share.share({ message: msg });
    } catch {
      // Web fallback: copy to clipboard
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(msg);
        alert(lang === 'fr' ? 'Copie dans le presse-papiers !' : 'Copied to clipboard!');
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mds.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[mds.modal, { padding: 0, overflow: 'hidden' }]}>
          <TouchableOpacity style={[mds.closeBtn, { top: 10, right: 10 }]} onPress={onClose}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          {/* Certificate Card */}
          <View style={cert.card} testID="certificate-card">
            <View style={cert.header}>
              <Text style={cert.brand}>MENTOVA ACADEMY</Text>
              <View style={cert.dividerLine} />
              <Text style={cert.certLabel}>{lang === 'fr' ? 'CERTIFICAT' : lang === 'es' ? 'CERTIFICADO' : 'CERTIFICATE'}</Text>
            </View>
            <View style={[cert.iconWrap, { borderColor: scoreColor }]}>
              <Ionicons name={skill.icon as any} size={32} color={scoreColor} />
            </View>
            <Text style={cert.skillName}>{name}</Text>
            <View style={cert.scoreRow}>
              <View style={cert.scoreBg}>
                <View style={[cert.scoreFill, { width: `${skill.score * 10}%`, backgroundColor: scoreColor }]} />
              </View>
              <Text style={[cert.scoreText, { color: scoreColor }]}>{skill.score}/10</Text>
            </View>
            <View style={cert.awardRow}>
              <Text style={cert.awardLabel}>{lang === 'fr' ? 'Decerne a' : lang === 'es' ? 'Otorgado a' : 'Awarded to'}</Text>
              <Text style={cert.awardName}>{userName}</Text>
            </View>
            <View style={cert.footer}>
              <Text style={cert.footerText}>{lang === 'fr' ? 'Niveau' : 'Level'} {levelNum} — {levelName}</Text>
              <Text style={cert.footerDate}>{date}</Text>
            </View>
          </View>
          {/* Actions */}
          <View style={cert.actions}>
            <TouchableOpacity onPress={handleShare} style={cert.shareBtn} testID="share-certificate-btn">
              <Ionicons name="share-social" size={18} color="#A78BFA" />
              <Text style={cert.shareTxt}>{lang === 'fr' ? 'Partager' : lang === 'es' ? 'Compartir' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ LEVELS ROADMAP MODAL ============
function LevelsRoadmapModal({ visible, levels, currentLevel, totalXp, lang, onClose }: { visible: boolean; levels: any[]; currentLevel: number; totalXp: number; lang: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mds.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[mds.modal, { maxHeight: '80%' }]}>
          <TouchableOpacity style={mds.closeBtn} onPress={onClose}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          <Text style={mds.modalTitle}>{lang === 'fr' ? 'Niveaux' : lang === 'es' ? 'Niveles' : 'Levels'}</Text>
          <Text style={mds.desc}>{totalXp.toLocaleString()} XP</Text>
          <ScrollView style={{ marginTop: 12, maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {(levels || []).map((lvl: any, i: number) => {
              const past = lvl.level < currentLevel;
              const isCurrent = lvl.level === currentLevel;
              const name = lvl[`name_${lang}`] || lvl.name_en;
              return (
                <View key={lvl.level} style={mds.lvlRow}>
                  <View style={mds.lvlTL}>
                    <View style={[mds.lvlDot, { backgroundColor: (past || isCurrent) ? lvl.color : 'rgba(255,255,255,0.08)' }, isCurrent && { borderWidth: 2.5, borderColor: '#F1F5F9' }]} />
                    {i < (levels || []).length - 1 && <View style={[mds.lvlLine, { backgroundColor: past ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)' }]} />}
                  </View>
                  <View style={[mds.lvlCard, isCurrent && { borderColor: lvl.color, backgroundColor: `${lvl.color}10` }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[mds.lvlNum, { color: lvl.color }]}>{lvl.level}</Text>
                      <Text style={[mds.lvlName, (past || isCurrent) && { color: '#E2E8F0' }]}>{name}</Text>
                      {isCurrent && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: lvl.color, marginLeft: 'auto' }} />}
                    </View>
                    <Text style={mds.lvlXp}>{lvl.xp_threshold.toLocaleString()} XP</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}



function ProgressView({ token, lang, onAction }: { token: string; lang: string; onAction?: (type: string, data?: string) => void }) {
  const [hub, setHub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const xpAnim = useRef(new Animated.Value(0)).current;
  const [selBadge, setSelBadge] = useState<any>(null);
  const [showXpHist, setShowXpHist] = useState(false);
  const [selSkill, setSelSkill] = useState<any>(null);
  const [certSkill, setCertSkill] = useState<any>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [celebrations, setCelebrations] = useState<any[]>([]);
  const [showXpToast, setShowXpToast] = useState<number | null>(null);
  const [celebBadge, setCelebBadge] = useState<any>(null);
  const [celebLevel, setCelebLevel] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    api(`/api/atlas/progression/hub?lang=${lang}`, token)
      .then(data => {
        if (data?.success) {
          setHub(data);
          // Process celebrations
          const celebs = data.celebrations || [];
          if (celebs.length > 0) {
            setCelebrations(celebs);
            const first = celebs[0];
            if (first.type === 'xp_gained') setShowXpToast(first.amount);
            else if (first.type === 'level_up') setCelebLevel(first);
            else if (first.type === 'badge_earned') setCelebBadge(first.badge);
          }
          Animated.timing(xpAnim, {
            toValue: data.xp_progress || 0,
            duration: 1000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, lang]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
      <ActivityIndicator size="large" color="#A78BFA" />
    </View>
  );

  if (!hub) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <Ionicons name="alert-circle-outline" size={32} color="#475569" />
      <Text style={{ color: '#64748B', marginTop: 12, fontSize: 14 }}>{tAtlas('prog.error', lang)}</Text>
    </View>
  );

  const levelName = hub[`level_name_${lang}`] || hub.level_name_en;
  const goals = hub.daily_goals?.goals || [];
  const badges = hub.badges || [];
  const skills = hub.skills || [];
  const recentMods = hub.recent_modules || [];
  const stats = hub.stats || {};
  const streakBestLabel = lang === 'fr' ? 'Record' : lang === 'es' ? 'Record' : 'Best';

  const badgeCats: Record<string, any[]> = {};
  for (const b of badges) {
    if (!badgeCats[b.category]) badgeCats[b.category] = [];
    badgeCats[b.category].push(b);
  }

  const catLabels: Record<string, Record<string, string>> = {
    first_steps: { fr: 'Premiers pas', en: 'First Steps', es: 'Primeros pasos' },
    quiz: { fr: 'Quiz', en: 'Quiz', es: 'Quiz' },
    modules: { fr: 'Modules', en: 'Modules', es: 'Modulos' },
    streak: { fr: 'Regularite', en: 'Streak', es: 'Racha' },
    excellence: { fr: 'Excellence', en: 'Excellence', es: 'Excelencia' },
    mastery: { fr: 'Maitrise', en: 'Mastery', es: 'Maestria' },
    milestones: { fr: 'Jalons XP', en: 'XP Milestones', es: 'Hitos XP' },
  };

  const handlePriority = () => {
    if (!hub.priority || !onAction) return;
    if (hub.priority.type === 'resume_module') {
      const msg = lang === 'fr' ? `Je veux continuer le module "${hub.priority.title}". Reprends la ou on en etait.`
        : lang === 'es' ? `Quiero continuar el modulo "${hub.priority.title}". Retoma donde lo dejamos.`
        : `I want to continue the module "${hub.priority.title}". Pick up where we left off.`;
      onAction('chat', msg);
    } else if (hub.priority.type === 'start_learning') {
      const msg = lang === 'fr' ? 'Je veux commencer mon parcours. Propose-moi un premier module.'
        : lang === 'es' ? 'Quiero empezar mi camino de aprendizaje. Proponme un primer modulo.'
        : 'I want to start my learning journey. Suggest a first module for me.';
      onAction('chat', msg);
    } else if (hub.priority.type === 'strengthen_skill') {
      const msg = lang === 'fr' ? `Je veux renforcer ma competence en "${hub.priority.title}". Cree-moi un module adapte.`
        : lang === 'es' ? `Quiero reforzar mi competencia en "${hub.priority.title}". Creame un modulo adaptado.`
        : `I want to strengthen my "${hub.priority.title}" skill. Create a tailored module for me.`;
      onAction('chat', msg);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={ph.container} showsVerticalScrollIndicator={false} testID="progression-hub">

      {/* HERO: Level + XP */}
      <View style={ph.heroCard} testID="hero-level-card">
        <View style={ph.heroTop}>
          <TouchableOpacity onPress={() => setShowLevels(true)} style={[ph.levelCircle, { borderColor: hub.level_color }]}>
            <Text style={[ph.levelNum, { color: hub.level_color }]}>{hub.level}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={ph.heroLevelName}>{levelName}</Text>
            <Text style={ph.heroXpText}>{hub.total_xp.toLocaleString()} XP</Text>
          </View>
          {hub.streak > 0 && (
            <View style={ph.streakPill} testID="streak-badge">
              <Ionicons name="flame" size={16} color="#F59E0B" />
              <Text style={ph.streakPillNum}>{hub.streak}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowXpHist(true)} activeOpacity={0.7} style={ph.xpBarWrap}>
          <View style={ph.xpBarBg}>
            <Animated.View style={[ph.xpBarFill, {
              backgroundColor: hub.level_color,
              width: xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          {hub.next_level && (
            <Text style={ph.xpHint}>
              {hub.xp_for_next_level} XP {'\u2192'} {hub.next_level[`name_${lang}`] || hub.next_level.name_en}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* QUICK STATS */}
      <View style={ph.qkRow} testID="quick-stats">
        <View style={ph.qkCard}>
          <Ionicons name="flame" size={18} color={hub.streak > 0 ? '#F59E0B' : '#334155'} />
          <Text style={ph.qkVal}>{hub.streak}</Text>
          <Text style={ph.qkLabel}>{tAtlas('gam.streak', lang)}</Text>
          {hub.streak_best > 0 && <Text style={ph.qkSub}>{streakBestLabel}: {hub.streak_best}</Text>}
        </View>
        <View style={ph.qkCard}>
          <Ionicons name="ribbon" size={18} color="#A78BFA" />
          <Text style={ph.qkVal}>{hub.badges_earned}</Text>
          <Text style={ph.qkLabel}>{tAtlas('gam.badges', lang)}</Text>
          <Text style={ph.qkSub}>/ {hub.badges_total}</Text>
        </View>
        <View style={ph.qkCard}>
          <Ionicons name="library" size={18} color="#3B82F6" />
          <Text style={ph.qkVal}>{hub.modules_completed}</Text>
          <Text style={ph.qkLabel}>{tAtlas('prog.modules', lang)}</Text>
          <Text style={ph.qkSub}>/ {hub.modules_total}</Text>
        </View>
      </View>

      {/* PRIORITY CARD */}
      {hub.priority && (
        <TouchableOpacity style={ph.prioCard} onPress={handlePriority} activeOpacity={0.7} testID="priority-card">
          <View style={ph.prioIcon}>
            <Ionicons
              name={hub.priority.type === 'resume_module' ? 'play-circle' : hub.priority.type === 'start_learning' ? 'rocket' : 'fitness'}
              size={22} color="#A78BFA"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ph.prioLabel}>
              {hub.priority.type === 'resume_module' ? tAtlas('hub.priority.resume', lang)
                : hub.priority.type === 'start_learning' ? tAtlas('hub.priority.start', lang)
                : tAtlas('hub.priority.strengthen', lang)}
            </Text>
            <Text style={ph.prioTitle} numberOfLines={2}>
              {hub.priority.title || tAtlas('hub.priority.start_desc', lang)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>
      )}

      {/* DAILY GOALS */}
      {goals.length > 0 && (
        <View style={ph.sec} testID="daily-goals-section">
          <Text style={ph.secTitle}>{tAtlas('hub.daily_goals', lang)}</Text>
          <View style={ph.card}>
            {goals.map((g: any, i: number) => (
              <View key={g.id || i} style={[ph.goalRow, i < goals.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }]}>
                <View style={[ph.goalChk, g.completed && { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' }]}>
                  {g.completed
                    ? <Ionicons name="checkmark" size={12} color="#10B981" />
                    : <Text style={ph.goalChkTxt}>{g.current}/{g.target}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ph.goalName, g.completed && { color: '#64748B', textDecorationLine: 'line-through' }]}>
                    {g[`name_${lang}`] || g.name_en}
                  </Text>
                  {!g.completed && (
                    <View style={ph.goalBarBg}>
                      <View style={[ph.goalBarFill, { width: `${Math.min((g.current / g.target) * 100, 100)}%` }]} />
                    </View>
                  )}
                </View>
                <Text style={ph.goalXp}>+{g.xp_reward}</Text>
              </View>
            ))}
            {hub.daily_goals?.all_completed && (
              <View style={ph.goalBonus}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={ph.goalBonusTxt}>+{hub.daily_goals.bonus_xp} XP {tAtlas('hub.bonus_xp', lang)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* SKILLS */}
      <View style={ph.sec} testID="skills-section">
        <Text style={ph.secTitle}>{tAtlas('hub.skills', lang)}</Text>
        <View style={ph.card}>
          {skills.map((sk: any, i: number) => (
            <TouchableOpacity key={sk.key} onPress={() => setSelSkill(sk)} activeOpacity={0.7} style={i < skills.length - 1 ? { marginBottom: 14 } : undefined}>
              <View style={ph.skHead}>
                <Ionicons name={sk.icon as any} size={15} color="#A78BFA" />
                <Text style={ph.skName}>{sk[`name_${lang}`] || sk.name_en}</Text>
                <Text style={ph.skScore}>{sk.score}/10</Text>
              </View>
              <View style={ph.skBarBg}>
                <View style={[ph.skBarFill, {
                  width: `${Math.max(sk.score * 10, 2)}%`,
                  backgroundColor: sk.score >= 7 ? '#10B981' : sk.score >= 4 ? '#F59E0B' : '#A78BFA',
                }]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ALMOST UNLOCKED */}
      {hub.almost_unlocked?.length > 0 && (
        <View style={ph.sec} testID="almost-unlocked">
          <Text style={ph.secTitle}>{tAtlas('hub.almost', lang)}</Text>
          {hub.almost_unlocked.map((au: any) => (
            <View key={au.badge_id} style={ph.almostCard}>
              <Ionicons name="lock-open" size={16} color="#F59E0B" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={ph.almostName}>{au.name}</Text>
                <Text style={ph.almostSub}>
                  {au.remaining} {lang === 'fr' ? 'restant(s)' : lang === 'es' ? 'restante(s)' : 'remaining'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* BADGES */}
      <View style={ph.sec} testID="badges-section">
        <Text style={ph.secTitle}>{tAtlas('hub.badges', lang)} ({hub.badges_earned}/{hub.badges_total})</Text>
        {Object.entries(badgeCats).map(([cat, catBadges]) => (
          <View key={cat} style={{ marginBottom: 16 }}>
            <Text style={ph.bdgCatLabel}>{catLabels[cat]?.[lang] || catLabels[cat]?.en || cat}</Text>
            <View style={ph.bdgGrid}>
              {catBadges.map((b: any) => (
                <TouchableOpacity key={b.id} onPress={() => setSelBadge(b)} activeOpacity={0.6} style={[ph.bdgItem, !b.earned && { opacity: 0.35 }]} testID={`badge-${b.id}`}>
                  <View style={[ph.bdgIcon, b.earned && { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.3)' }]}>
                    <Ionicons name={b.icon as any} size={18} color={b.earned ? '#A78BFA' : '#475569'} />
                  </View>
                  <Text style={ph.bdgLabel} numberOfLines={2}>{b[`name_${lang}`] || b.name_en}</Text>
                  {!b.earned && b.progress > 0 && (
                    <View style={ph.bdgProgBg}>
                      <View style={[ph.bdgProgFill, { width: `${Math.round(b.progress * 100)}%` }]} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* MODULES OVERVIEW */}
      <View style={ph.sec} testID="modules-overview">
        <Text style={ph.secTitle}>{tAtlas('hub.modules_overview', lang)}</Text>
        <View style={ph.card}>
          <View style={ph.modRow}>
            <View style={ph.modItem}>
              <Text style={[ph.modNum, { color: '#F1F5F9' }]}>{hub.modules_total}</Text>
              <Text style={ph.modLabel}>{tAtlas('prog.total', lang)}</Text>
            </View>
            <View style={ph.modItem}>
              <Text style={[ph.modNum, { color: '#3B82F6' }]}>{hub.modules_in_progress}</Text>
              <Text style={ph.modLabel}>{tAtlas('hub.in_progress', lang)}</Text>
            </View>
            <View style={ph.modItem}>
              <Text style={[ph.modNum, { color: '#10B981' }]}>{hub.modules_completed}</Text>
              <Text style={ph.modLabel}>{tAtlas('hub.completed', lang)}</Text>
            </View>
            <View style={ph.modItem}>
              <Text style={[ph.modNum, { color: '#F59E0B' }]}>{hub.modules_mastered}</Text>
              <Text style={ph.modLabel}>{tAtlas('hub.mastered', lang)}</Text>
            </View>
          </View>
          {recentMods.length > 0 && (
            <>
              <View style={ph.divider} />
              <Text style={ph.rcLabel}>{tAtlas('hub.recent', lang)}</Text>
              {recentMods.map((m: any) => (
                <View key={m.id} style={ph.rcRow}>
                  <View style={[ph.rcDot, {
                    backgroundColor: m.status === 'mastered' ? '#F59E0B' : m.status === 'completed' ? '#10B981' : m.status === 'in_progress' ? '#3B82F6' : '#475569',
                  }]} />
                  <Text style={ph.rcTitle} numberOfLines={1}>{m.title}</Text>
                  <Text style={ph.rcScore}>{m.mastery_score}%</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>

      {/* QUIZ STATS */}
      {stats.quiz_count > 0 && (
        <View style={ph.sec} testID="quiz-stats">
          <Text style={ph.secTitle}>{tAtlas('hub.quiz_stats', lang)}</Text>
          <View style={ph.card}>
            <View style={ph.qzRow}>
              <View style={ph.qzItem}>
                <Ionicons name="document-text" size={16} color="#A78BFA" />
                <Text style={ph.qzVal}>{stats.quiz_count}</Text>
                <Text style={ph.qzLabel}>Quiz</Text>
              </View>
              <View style={ph.qzItem}>
                <Ionicons name="analytics" size={16} color="#3B82F6" />
                <Text style={ph.qzVal}>{stats.avg_quiz_score}%</Text>
                <Text style={ph.qzLabel}>{tAtlas('hub.avg_score', lang)}</Text>
              </View>
              <View style={ph.qzItem}>
                <Ionicons name="flash" size={16} color="#F59E0B" />
                <Text style={ph.qzVal}>{stats.perfect_scores}</Text>
                <Text style={ph.qzLabel}>{tAtlas('hub.perfect_scores', lang)}</Text>
              </View>
              <View style={ph.qzItem}>
                <Ionicons name="calendar" size={16} color="#10B981" />
                <Text style={ph.qzVal}>{stats.days_active}</Text>
                <Text style={ph.qzLabel}>{tAtlas('hub.days_active', lang)}</Text>
              </View>
            </View>
          </View>
        </View>
      )}


      {/* CAUFID ANALYSIS CTA */}
      <TouchableOpacity
        style={ph.ctaCard}
        activeOpacity={0.7}
        testID="analyze-progression-btn"
        onPress={() => {
          const msg = lang === 'fr'
            ? 'Analyse ma progression en detail. Identifie mes forces, mes faiblesses, et recommande-moi un plan d\'apprentissage personnalise.'
            : lang === 'es'
            ? 'Analiza mi progreso en detalle. Identifica mis fortalezas, debilidades, y recomiendame un plan de aprendizaje personalizado.'
            : 'Analyze my progress in detail. Identify my strengths, weaknesses, and recommend a personalized learning plan.';
          onAction?.('chat', msg);
        }}
      >
        <View style={ph.ctaLeft}>
          <View style={ph.ctaIcon}>
            <Ionicons name="sparkles" size={20} color="#A78BFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ph.ctaTitle}>{tAtlas('hub.analyze', lang)}</Text>
            <Text style={ph.ctaDesc}>{tAtlas('hub.analyze_desc', lang)}</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-circle" size={24} color="#A78BFA" />
      </TouchableOpacity>

      {/* DETAIL MODALS */}
      <BadgeDetailModal visible={!!selBadge} badge={selBadge} lang={lang} onClose={() => setSelBadge(null)} />
      <XpHistoryModal visible={showXpHist} token={token} lang={lang} onClose={() => setShowXpHist(false)} />
      <SkillDetailModal visible={!!selSkill} skill={selSkill} lang={lang} relatedMods={recentMods} userName={useAuthStore.getState().name || ''} onShowCert={() => setCertSkill(selSkill)} onClose={() => setSelSkill(null)} />
      <CertificateModal visible={!!certSkill} skill={certSkill} userName={useAuthStore.getState().name || ''} levelName={hub?.[`level_name_${lang}`] || hub?.level_name_en || ''} levelNum={hub?.level || 1} lang={lang} onClose={() => setCertSkill(null)} />
      <LevelsRoadmapModal visible={showLevels} levels={hub.levels || []} currentLevel={hub.level} totalXp={hub.total_xp} lang={lang} onClose={() => setShowLevels(false)} />

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* CELEBRATIONS */}
    {showXpToast && <XpToast amount={showXpToast} onDone={() => {
      setShowXpToast(null);
      const next = celebrations.find((c: any) => c.type === 'level_up');
      if (next) { setCelebLevel(next); }
      else { const nb = celebrations.find((c: any) => c.type === 'badge_earned'); if (nb) setCelebBadge(nb.badge); }
    }} />}
    {celebLevel && <LevelUpCelebration level={celebLevel.new_level} name={celebLevel[`name_${lang}`] || celebLevel.name_en} color={celebLevel.color} lang={lang} onClose={() => {
      setCelebLevel(null);
      const nb = celebrations.find((c: any) => c.type === 'badge_earned');
      if (nb) setCelebBadge(nb.badge);
    }} />}
    {celebBadge && <BadgeCelebration badge={{ ...celebBadge, name: { fr: celebBadge.name_fr, en: celebBadge.name_en, es: celebBadge.name_es } }} lang={lang} onClose={() => setCelebBadge(null)} />}
    </>
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
      {tab === 'progress' && <ProgressView token={token} lang={lang} onAction={(type, data) => { if (type === 'chat') { setContinueModuleMsg(data || null); setTab('chat'); } else if (type === 'modules') { setTab('modules'); } }} />}
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
  chatHeader: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  chatHeaderRow1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  chatHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#F1F5F9', letterSpacing: -0.3 },
  chatHeaderSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  chatHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  atlasAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  atlasAvatarText: { color: '#C4B5FD', fontSize: 14, fontWeight: '700' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },

  // Upgrade banner — animated, below header
  upgradeBanner: { marginTop: 6, marginHorizontal: 0 },
  upgradeBannerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.18)' },
  upgradeBannerText: { fontSize: 12, fontWeight: '700', color: '#C4B5FD', letterSpacing: 0.3 },

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

const ph = StyleSheet.create({
  container: { padding: 16, paddingTop: 8, paddingBottom: 20 },

  // Hero
  heroCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  levelCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  levelNum: { fontSize: 22, fontWeight: '800' },
  heroLevelName: { fontSize: 18, fontWeight: '700', color: '#F1F5F9', letterSpacing: -0.3 },
  heroXpText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  streakPillNum: { fontSize: 15, fontWeight: '800', color: '#F59E0B' },
  xpBarWrap: { marginTop: 16 },
  xpBarBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  xpBarFill: { height: 6, borderRadius: 3 },
  xpHint: { fontSize: 11, color: '#475569', marginTop: 6, textAlign: 'right' },

  // Quick stats
  qkRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  qkCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  qkVal: { fontSize: 20, fontWeight: '800', color: '#F1F5F9', marginTop: 6 },
  qkLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  qkSub: { fontSize: 10, color: '#334155', marginTop: 1 },

  // Priority
  prioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.06)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.12)', marginBottom: 16, gap: 12 },
  prioIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center' },
  prioLabel: { fontSize: 11, fontWeight: '700', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 0.5 },
  prioTitle: { fontSize: 14, fontWeight: '600', color: '#E2E8F0', marginTop: 2 },

  // Sections
  sec: { marginBottom: 16 },
  secTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

  // Daily goals
  goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  goalChk: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  goalChkTxt: { fontSize: 9, color: '#64748B', fontWeight: '600' },
  goalName: { fontSize: 13, fontWeight: '500', color: '#E2E8F0' },
  goalBarBg: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 6 },
  goalBarFill: { height: 3, borderRadius: 2, backgroundColor: '#A78BFA' },
  goalXp: { fontSize: 11, color: '#475569', fontWeight: '600' },
  goalBonus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  goalBonusTxt: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },

  // Skills
  skHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  skName: { fontSize: 13, color: '#E2E8F0', fontWeight: '500', flex: 1 },
  skScore: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  skBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  skBarFill: { height: 4, borderRadius: 2 },

  // Almost unlocked
  almostCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.12)', marginBottom: 8 },
  almostName: { fontSize: 13, fontWeight: '600', color: '#F59E0B' },
  almostSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Badges
  bdgCatLabel: { fontSize: 11, color: '#475569', fontWeight: '600', marginBottom: 8, textTransform: 'capitalize' },
  bdgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bdgItem: { alignItems: 'center', width: 68, marginBottom: 8 },
  bdgIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  bdgLabel: { fontSize: 9, color: '#94A3B8', textAlign: 'center', lineHeight: 12 },
  bdgProgBg: { width: 34, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 3 },
  bdgProgFill: { height: 2, borderRadius: 1, backgroundColor: '#A78BFA' },

  // Modules overview
  modRow: { flexDirection: 'row', justifyContent: 'space-around' },
  modItem: { alignItems: 'center', gap: 2 },
  modNum: { fontSize: 22, fontWeight: '800' },
  modLabel: { fontSize: 10, color: '#64748B' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 14 },
  rcLabel: { fontSize: 11, color: '#475569', fontWeight: '600', marginBottom: 8 },
  rcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rcDot: { width: 6, height: 6, borderRadius: 3 },
  rcTitle: { fontSize: 13, color: '#E2E8F0', flex: 1 },
  rcScore: { fontSize: 12, fontWeight: '700', color: '#64748B' },

  // Quiz stats
  qzRow: { flexDirection: 'row', justifyContent: 'space-around' },
  qzItem: { alignItems: 'center', gap: 4 },
  qzVal: { fontSize: 18, fontWeight: '800', color: '#F1F5F9' },
  qzLabel: { fontSize: 10, color: '#64748B' },

  // CTA
  ctaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.06)', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)', marginBottom: 8, gap: 12 },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0' },
  ctaDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },
});

const mds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 400, backgroundColor: '#0F0A1E', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: 'rgba(167,139,250,0.12)', position: 'relative' },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 10, padding: 4 },
  bigIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16, marginTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#F1F5F9', textAlign: 'center', marginBottom: 4 },
  catLabel: { fontSize: 12, color: '#64748B', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  earnedPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'center' },
  earnedTxt: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  desc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 12 },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  progBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  progFill: { height: 6, borderRadius: 3, backgroundColor: '#A78BFA' },
  progTxt: { fontSize: 12, color: '#64748B', fontWeight: '600', width: 40, textAlign: 'right' },
  emptyTxt: { fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 20 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  histIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.1)', alignItems: 'center', justifyContent: 'center' },
  histDesc: { fontSize: 13, color: '#E2E8F0' },
  histDate: { fontSize: 11, color: '#475569', marginTop: 2 },
  histXp: { fontSize: 14, fontWeight: '700', color: '#A78BFA' },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  relDot: { width: 6, height: 6, borderRadius: 3 },
  relTitle: { fontSize: 13, color: '#E2E8F0', flex: 1 },
  tipTxt: { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  lvlRow: { flexDirection: 'row', marginBottom: 0 },
  lvlTL: { width: 24, alignItems: 'center' },
  lvlDot: { width: 12, height: 12, borderRadius: 6 },
  lvlLine: { width: 2, flex: 1, marginVertical: 2 },
  lvlCard: { flex: 1, marginLeft: 12, marginBottom: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' },
  lvlNum: { fontSize: 16, fontWeight: '800' },
  lvlName: { fontSize: 14, fontWeight: '500', color: '#64748B', flex: 1 },
  lvlXp: { fontSize: 11, color: '#475569', marginTop: 2 },
  // Certificate button in skill modal
  certBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  certBtnTxt: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
});

const cert = StyleSheet.create({
  card: { backgroundColor: '#0A0718', padding: 28, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  brand: { fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 3 },
  dividerLine: { width: 40, height: 1, backgroundColor: 'rgba(167,139,250,0.3)', marginVertical: 10 },
  certLabel: { fontSize: 14, fontWeight: '800', color: '#A78BFA', letterSpacing: 2 },
  iconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  skillName: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '80%', marginBottom: 20 },
  scoreBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  scoreFill: { height: 6, borderRadius: 3 },
  scoreText: { fontSize: 14, fontWeight: '800' },
  awardRow: { alignItems: 'center', marginBottom: 16 },
  awardLabel: { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 },
  awardName: { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginTop: 4 },
  footer: { alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', width: '100%' },
  footerText: { fontSize: 12, color: '#64748B' },
  footerDate: { fontSize: 11, color: '#334155', marginTop: 2 },
  actions: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  shareTxt: { fontSize: 14, fontWeight: '600', color: '#A78BFA' },
});
