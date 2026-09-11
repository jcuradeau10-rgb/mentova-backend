import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, FlatList, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

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
  'auth.desc': { fr: 'Connecte-toi pour accéder à Atlas IA', en: 'Log in to access Atlas AI', es: 'Inicia sesión para acceder a Atlas IA' },
  // Chat
  'chat.placeholder': { fr: 'Écris ton message...', en: 'Write your message...', es: 'Escribe tu mensaje...' },
  'chat.welcome.title': { fr: 'Atlas IA', en: 'Atlas AI', es: 'Atlas IA' },
  'chat.welcome.desc': { fr: 'Ton mentor crypto personnel. Pose tes questions, apprends à ton rythme.', en: 'Your personal crypto mentor. Ask questions, learn at your pace.', es: 'Tu mentor crypto personal. Haz preguntas, aprende a tu ritmo.' },
  'chat.error': { fr: 'Erreur de connexion. Réessaie.', en: 'Connection error. Try again.', es: 'Error de conexión. Inténtalo de nuevo.' },
  'chat.conversations': { fr: 'Conversations', en: 'Conversations', es: 'Conversaciones' },
  'chat.new': { fr: 'Nouvelle conversation', en: 'New conversation', es: 'Nueva conversación' },
  'chat.empty': { fr: 'Aucune conversation', en: 'No conversations', es: 'Sin conversaciones' },
  'chat.messages': { fr: 'messages', en: 'messages', es: 'mensajes' },
  // Modules
  'mod.empty.title': { fr: 'Aucun module', en: 'No modules', es: 'Sin módulos' },
  'mod.empty.desc': { fr: "Discute avec Atlas pour qu'il crée ton parcours personnalisé !", en: 'Chat with Atlas to create your personalized learning path!', es: '¡Habla con Atlas para que cree tu ruta de aprendizaje personalizada!' },
  'mod.back': { fr: 'Retour', en: 'Back', es: 'Volver' },
  'mod.mastery': { fr: 'Maîtrise', en: 'Mastery', es: 'Dominio' },
  'mod.understood': { fr: 'Compris', en: 'Understood', es: 'Comprendido' },
  'mod.weak': { fr: 'À revoir', en: 'Needs review', es: 'Por repasar' },
  'mod.best_quiz': { fr: 'Meilleur quiz', en: 'Best quiz', es: 'Mejor quiz' },
  'mod.content': { fr: 'Contenu du module', en: 'Module content', es: 'Contenido del módulo' },
  'mod.quiz_history': { fr: 'Historique des quiz', en: 'Quiz history', es: 'Historial de quiz' },
  'mod.objective': { fr: 'Objectif', en: 'Objective', es: 'Objetivo' },
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
  'prog.onboarding_hint': { fr: 'Discute avec Atlas pour évaluer ton niveau', en: 'Chat with Atlas to evaluate your level', es: 'Habla con Atlas para evaluar tu nivel' },
  'prog.error': { fr: 'Erreur de chargement', en: 'Loading error', es: 'Error de carga' },
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

// ============ CHAT VIEW ============
function ChatView({ token, lang }: { token: string; lang: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api('/api/atlas/conversations', token);
      setConversations(data.conversations || []);
    } catch (e) { console.error('Load convos error:', e); }
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
      const data = await api('/api/atlas/chat', token, {
        method: 'POST',
        body: JSON.stringify({ message: msg, conversation_id: activeConvId, lang }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      if (!activeConvId && data.conversation_id) {
        setActiveConvId(data.conversation_id);
        loadConversations();
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: tAtlas("chat.error", lang) }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [input, loading, activeConvId, token, lang, loadConversations]);

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setShowSidebar(false);
  };

  const deleteConversation = async (convId: string) => {
    try {
      await api(`/api/atlas/conversations/${convId}`, token, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) { setActiveConvId(null); setMessages([]); }
    } catch (e) { console.error('Delete conv error:', e); }
  };

  // Sidebar (conversation list)
  if (showSidebar) {
    return (
      <View style={s.sidebarWrap}>
        <View style={s.sidebarHeader}>
          <Text style={s.sidebarTitle}>{tAtlas("chat.conversations", lang)}</Text>
          <TouchableOpacity onPress={() => setShowSidebar(false)} data-testid="close-sidebar">
            <Ionicons name="close" size={24} color="#E2E8F0" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.newConvBtn} onPress={newConversation} data-testid="new-conversation-btn">
          <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
          <Text style={s.newConvText}>{tAtlas("chat.new", lang)}</Text>
        </TouchableOpacity>
        <ScrollView style={{ flex: 1 }}>
          {conversations.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[s.convItem, activeConvId === c.id && s.convItemActive]}
              onPress={() => loadConversation(c.id)}
              data-testid={`conv-${c.id}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.convTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={s.convMeta}>{c.message_count} {tAtlas("chat.messages", lang)}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteConversation(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {conversations.length === 0 && !loadingConvos && (
            <Text style={s.emptyText}>{tAtlas("chat.empty", lang)}</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // Main chat view
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      {/* Header */}
      <View style={s.chatHeader}>
        <TouchableOpacity onPress={() => setShowSidebar(true)} data-testid="open-sidebar">
          <Ionicons name="menu" size={24} color="#E2E8F0" />
        </TouchableOpacity>
        <View style={s.chatHeaderCenter}>
          <View style={s.atlasAvatar}><Text style={s.atlasAvatarText}>A</Text></View>
          <Text style={s.chatHeaderTitle}>Atlas IA</Text>
          <View style={s.onlineDot} />
        </View>
        <TouchableOpacity onPress={newConversation} data-testid="new-chat-btn">
          <Ionicons name="create-outline" size={22} color="#E2E8F0" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.messagesContainer}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 && (
          <View style={s.welcomeWrap}>
            <View style={s.welcomeIcon}><Ionicons name="planet" size={48} color="#7C3AED" /></View>
            <Text style={s.welcomeTitle}>{tAtlas("chat.welcome.title", lang)}</Text>
            <Text style={s.welcomeDesc}>{tAtlas("chat.welcome.desc", lang)}</Text>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[s.msgRow, m.role === 'user' && s.msgRowUser]}>
            {m.role === 'assistant' && <View style={s.msgAvatar}><Text style={s.msgAvatarText}>A</Text></View>}
            <View style={[s.msgBubble, m.role === 'user' ? s.msgBubbleUser : s.msgBubbleAtlas]}>
              <Text style={[s.msgText, m.role === 'user' && s.msgTextUser]}>{m.content}</Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={s.msgRow}>
            <View style={s.msgAvatar}><Text style={s.msgAvatarText}>A</Text></View>
            <View style={[s.msgBubble, s.msgBubbleAtlas]}>
              <ActivityIndicator size="small" color="#7C3AED" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={tAtlas("chat.placeholder", lang)}
          placeholderTextColor="#6B7280"
          multiline
          maxLength={2000}
          onKeyPress={(e: any) => { if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) { e.preventDefault?.(); sendMessage(); } }}
          data-testid="chat-input"
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
          accessibilityLabel="Send message"
          data-testid="send-message-btn"
        >
          <Ionicons name="send" size={18} color={input.trim() && !loading ? '#FFF' : '#6B7280'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============ MODULES VIEW ============
function ModulesView({ token, lang }: { token: string; lang: string }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<any>(null);

  const loadModules = useCallback(async () => {
    try {
      const url = filter ? `/api/atlas/modules?status=${filter}` : '/api/atlas/modules';
      const data = await api(url, token);
      setModules(data.modules || []);
    } catch (e) { console.error('Load modules error:', e); }
    setLoading(false);
  }, [token, filter]);

  useEffect(() => { loadModules(); }, [loadModules]);

  const loadDetail = async (moduleId: string) => {
    try {
      const data = await api(`/api/atlas/modules/${moduleId}`, token);
      setSelectedModule(data);
    } catch (e) { console.error(e); }
  };

  const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
    not_started: { icon: 'ellipse-outline', color: '#6B7280', label: tAtlas('status.not_started', lang) },
    in_progress: { icon: 'play-circle', color: '#3B82F6', label: tAtlas('status.in_progress', lang) },
    completed: { icon: 'checkmark-circle', color: '#10B981', label: tAtlas('status.completed', lang) },
    mastered: { icon: 'star', color: '#F59E0B', label: tAtlas('status.mastered', lang) },
  };

  const categoryIcons: Record<string, string> = {
    crypto: 'logo-bitcoin', blockchain: 'cube', trading: 'trending-up',
    defi: 'swap-horizontal', security: 'shield-checkmark', nft: 'image',
    regulation: 'document-text', portfolio: 'pie-chart', general: 'school',
  };

  if (selectedModule) {
    const mod = selectedModule.module;
    const prog = selectedModule.progress;
    const quizzes = selectedModule.recent_quizzes || [];
    const sc = statusConfig[mod.status] || statusConfig.not_started;
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => setSelectedModule(null)} style={s.backBtn} data-testid="modules-back-btn">
          <Ionicons name="arrow-back" size={20} color="#E2E8F0" />
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

          {/* Mastery bar */}
          <View style={s.masterySection}>
            <Text style={s.masteryLabel}>{tAtlas("mod.mastery", lang)}</Text>
            <View style={s.masteryBarBg}>
              <View style={[s.masteryBarFill, { width: `${mod.mastery_score || 0}%`, backgroundColor: (mod.mastery_score || 0) >= 80 ? '#10B981' : (mod.mastery_score || 0) >= 50 ? '#F59E0B' : '#3B82F6' }]} />
            </View>
            <Text style={s.masteryPct}>{Math.round(mod.mastery_score || 0)}%</Text>
          </View>

          {/* Progress details */}
          {prog && (
            <View style={s.progDetails}>
              {prog.concepts_understood?.length > 0 && (
                <View style={s.conceptRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={s.conceptText}>{tAtlas("mod.understood", lang)} : {prog.concepts_understood.join(', ')}</Text>
                </View>
              )}
              {prog.concepts_weak?.length > 0 && (
                <View style={s.conceptRow}>
                  <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                  <Text style={s.conceptText}>{tAtlas("mod.weak", lang)} : {prog.concepts_weak.join(', ')}</Text>
                </View>
              )}
              {prog.best_quiz_score > 0 && (
                <View style={s.conceptRow}>
                  <Ionicons name="trophy" size={14} color="#F59E0B" />
                  <Text style={s.conceptText}>{tAtlas("mod.best_quiz", lang)} : {Math.round(prog.best_quiz_score)}%</Text>
                </View>
              )}
            </View>
          )}

          {/* Content */}
          {mod.content ? (
            <View style={s.contentSection}>
              <Text style={s.contentTitle}>{tAtlas("mod.content", lang)}</Text>
              <Text style={s.contentText}>{mod.content}</Text>
            </View>
          ) : null}

          {/* Quiz history */}
          {quizzes.length > 0 && (
            <View style={s.quizHistory}>
              <Text style={s.quizHistoryTitle}>{tAtlas("mod.quiz_history", lang)}</Text>
              {quizzes.map((q: any, i: number) => (
                <View key={i} style={s.quizRow}>
                  <Text style={s.quizScore}>{Math.round(q.score)}%</Text>
                  <Text style={s.quizMeta}>{q.correct_answers}/{q.questions_count} correct</Text>
                  <Text style={s.quizDate}>{new Date(q.created_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  const filters = [
    { key: null, label: tAtlas('filter.all', lang) },
    { key: 'in_progress', label: tAtlas('filter.in_progress', lang) },
    { key: 'not_started', label: tAtlas('filter.not_started', lang) },
    { key: 'mastered', label: tAtlas('filter.mastered', lang) },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key ?? 'all'}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => { setFilter(f.key); setLoading(true); }}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : modules.length === 0 ? (
        <View style={s.emptyModules}>
          <Ionicons name="school-outline" size={48} color="#4B5563" />
          <Text style={s.emptyModulesTitle}>{tAtlas("mod.empty.title", lang)}</Text>
          <Text style={s.emptyModulesDesc}>{tAtlas("mod.empty.desc", lang)}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {modules.map(m => {
            const sc = statusConfig[m.status] || statusConfig.not_started;
            const catIcon = categoryIcons[m.category] || 'school';
            return (
              <TouchableOpacity key={m.id} style={s.moduleCard} onPress={() => loadDetail(m.id)} data-testid={`module-${m.id}`}>
                <View style={s.moduleCardLeft}>
                  <View style={[s.moduleCatIcon, { backgroundColor: sc.color + '15' }]}>
                    <Ionicons name={catIcon as any} size={20} color={sc.color} />
                  </View>
                </View>
                <View style={s.moduleCardCenter}>
                  <Text style={s.moduleCardTitle} numberOfLines={2}>{m.title}</Text>
                  <View style={s.moduleCardMeta}>
                    <View style={[s.moduleStatusBadge, { backgroundColor: sc.color + '20' }]}>
                      <Ionicons name={sc.icon as any} size={10} color={sc.color} />
                      <Text style={[s.moduleStatusText, { color: sc.color, fontSize: 10 }]}>{sc.label}</Text>
                    </View>
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

  useEffect(() => {
    api('/api/atlas/progress', token)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />;
  if (!data) return <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 40 }}>{tAtlas('prog.error', lang)}</Text>;

  const profile = data.profile || {};
  const summary = data.modules_summary || {};
  const categories = data.categories || {};
  const quizzes = data.recent_quizzes || [];

  const levelColors: Record<string, string> = { unknown: '#6B7280', beginner: '#10B981', intermediate: '#F59E0B', advanced: '#EF4444', expert: '#7C3AED' };
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
      {/* Level card */}
      <View style={s.progressCard}>
        <Text style={s.progressCardTitle}>{tAtlas('prog.level', lang)}</Text>
        <View style={s.levelRow}>
          <View style={[s.levelBadge, { backgroundColor: (levelColors[profile.overall_level] || '#6B7280') + '20' }]}>
            <Text style={[s.levelBadgeText, { color: levelColors[profile.overall_level] || '#6B7280' }]}>
              {levelLabels(profile.overall_level || 'unknown')}
            </Text>
          </View>
          {!profile.onboarding_completed && (
            <Text style={s.onboardingHint}>{tAtlas('prog.onboarding_hint', lang)}</Text>
          )}
        </View>
      </View>

      {/* Skills radar */}
      <View style={s.progressCard}>
        <Text style={s.progressCardTitle}>{tAtlas('prog.skills', lang)}</Text>
        {skillFields.map(sf => {
          const val = profile[sf.key] || 0;
          return (
            <View key={sf.key} style={s.skillRow}>
              <Ionicons name={sf.icon as any} size={16} color="#9CA3AF" style={{ width: 24 }} />
              <Text style={s.skillLabel}>{sf.label}</Text>
              <View style={s.skillBarBg}>
                <View style={[s.skillBarFill, { width: `${val * 10}%` }]} />
              </View>
              <Text style={s.skillVal}>{val}/10</Text>
            </View>
          );
        })}
      </View>

      {/* Modules summary */}
      <View style={s.progressCard}>
        <Text style={s.progressCardTitle}>{tAtlas('prog.modules', lang)}</Text>
        <View style={s.statsRow}>
          <View style={s.statBox}><Text style={s.statNum}>{summary.total || 0}</Text><Text style={s.statLabel}>{tAtlas('prog.total', lang)}</Text></View>
          <View style={s.statBox}><Text style={[s.statNum, { color: '#3B82F6' }]}>{summary.in_progress || 0}</Text><Text style={s.statLabel}>{tAtlas('prog.in_progress', lang)}</Text></View>
          <View style={s.statBox}><Text style={[s.statNum, { color: '#F59E0B' }]}>{summary.mastered || 0}</Text><Text style={s.statLabel}>{tAtlas('prog.mastered', lang)}</Text></View>
        </View>
      </View>

      {/* Categories */}
      {Object.keys(categories).length > 0 && (
        <View style={s.progressCard}>
          <Text style={s.progressCardTitle}>{tAtlas('prog.categories', lang)}</Text>
          {Object.entries(categories).map(([cat, info]: [string, any]) => (
            <View key={cat} style={s.catRow}>
              <Text style={s.catName}>{cat}</Text>
              <View style={s.catBarBg}><View style={[s.catBarFill, { width: `${info.avg_mastery}%` }]} /></View>
              <Text style={s.catPct}>{Math.round(info.avg_mastery)}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent quizzes */}
      {quizzes.length > 0 && (
        <View style={s.progressCard}>
          <Text style={s.progressCardTitle}>{tAtlas('prog.recent_quiz', lang)}</Text>
          {quizzes.slice(0, 5).map((q: any, i: number) => (
            <View key={i} style={s.quizRow}>
              <Ionicons name="document-text" size={14} color="#7C3AED" />
              <Text style={s.quizScore}>{Math.round(q.score)}%</Text>
              <Text style={s.quizMeta}>{q.correct_answers}/{q.questions_count}</Text>
              <Text style={s.quizDate}>{new Date(q.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ============ MAIN COMPONENT ============
export default function LearnScreen() {
  const { token } = useAuthStore();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [tab, setTab] = useState<Tab>('chat');

  if (!token) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.authPrompt}>
          <Ionicons name="lock-closed" size={48} color="#4B5563" />
          <Text style={s.authTitle}>{tAtlas("auth.required", lang)}</Text>
          <Text style={s.authDesc}>{tAtlas("auth.desc", lang)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Top tab bar */}
      <View style={s.topTabs}>
        {([
          { key: 'chat' as Tab, icon: 'chatbubbles', label: tAtlas('tab.chat', lang) },
          { key: 'modules' as Tab, icon: 'library', label: tAtlas('tab.modules', lang) },
          { key: 'progress' as Tab, icon: 'stats-chart', label: tAtlas('tab.progress', lang) },
        ]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.topTab, tab === t.key && s.topTabActive]}
            onPress={() => setTab(t.key)}
            data-testid={`atlas-tab-${t.key}`}
          >
            <Ionicons name={(tab === t.key ? t.icon : t.icon + '-outline') as any} size={18} color={tab === t.key ? '#7C3AED' : '#6B7280'} />
            <Text style={[s.topTabText, tab === t.key && s.topTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'chat' && <ChatView token={token} lang={language || 'fr'} />}
      {tab === 'modules' && <ModulesView token={token} lang={language || 'fr'} />}
      {tab === 'progress' && <ProgressView token={token} lang={language || 'fr'} />}
    </SafeAreaView>
  );
}

// ============ STYLES ============
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0914' },

  // Top tabs
  topTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16 },
  topTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  topTabActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  topTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  topTabTextActive: { color: '#7C3AED' },

  // Auth prompt
  authPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  authTitle: { fontSize: 18, fontWeight: '700', color: '#E2E8F0' },
  authDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center' },

  // Chat header
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  chatHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#E2E8F0' },
  atlasAvatar: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  atlasAvatarText: { color: '#C4B5FD', fontSize: 13, fontWeight: '700' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },

  // Messages
  messagesContainer: { padding: 16, paddingBottom: 8 },
  welcomeWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  welcomeIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: '#E2E8F0' },
  welcomeDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 300 },
  msgRow: { flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.25)', alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { color: '#C4B5FD', fontSize: 12, fontWeight: '700' },
  msgBubble: { maxWidth: '78%', padding: 12, borderRadius: 16 },
  msgBubbleAtlas: { backgroundColor: 'rgba(124,58,237,0.1)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
  msgBubbleUser: { backgroundColor: '#7C3AED', borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 21, color: '#E2E8F0' },
  msgTextUser: { color: '#FFF' },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#E2E8F0', fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },

  // Sidebar
  sidebarWrap: { flex: 1, backgroundColor: '#0B0914' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sidebarTitle: { fontSize: 18, fontWeight: '700', color: '#E2E8F0' },
  newConvBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderStyle: 'dashed' },
  newConvText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  convItem: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 12, marginBottom: 4, borderRadius: 10, gap: 12 },
  convItemActive: { backgroundColor: 'rgba(124,58,237,0.1)' },
  convTitle: { fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  convMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#4B5563', marginTop: 40, fontSize: 14 },

  // Modules
  filterBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, marginRight: 8 },
  filterChipActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#7C3AED' },
  emptyModules: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, marginTop: 40 },
  emptyModulesTitle: { fontSize: 18, fontWeight: '700', color: '#E2E8F0' },
  emptyModulesDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  moduleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, gap: 12 },
  moduleCardLeft: {},
  moduleCatIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moduleCardCenter: { flex: 1, gap: 6 },
  moduleCardTitle: { fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  moduleCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moduleStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  moduleStatusText: { fontSize: 11, fontWeight: '600' },
  moduleLevelText: { fontSize: 11, color: '#6B7280', textTransform: 'capitalize' },
  moduleCardRight: { alignItems: 'flex-end', gap: 4, width: 50 },
  moduleMasteryPct: { fontSize: 14, fontWeight: '700' },
  miniBar: { width: 40, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  miniBarFill: { height: 3, borderRadius: 2 },

  // Module detail
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: '#E2E8F0', fontWeight: '500' },
  moduleDetailCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 },
  moduleDetailTitle: { fontSize: 20, fontWeight: '700', color: '#E2E8F0', marginTop: 12 },
  moduleDetailDesc: { fontSize: 14, color: '#9CA3AF', marginTop: 8, lineHeight: 22 },
  moduleDetailObj: { fontSize: 13, color: '#7C3AED', marginTop: 12, fontStyle: 'italic' },
  masterySection: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  masteryLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', width: 60 },
  masteryBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  masteryBarFill: { height: 6, borderRadius: 3 },
  masteryPct: { fontSize: 13, fontWeight: '700', color: '#E2E8F0', width: 36, textAlign: 'right' },
  progDetails: { marginTop: 16, gap: 8 },
  conceptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  conceptText: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  contentSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  contentTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  contentText: { fontSize: 13, color: '#9CA3AF', lineHeight: 22 },
  quizHistory: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  quizHistoryTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 12 },

  // Progress
  progressCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 },
  progressCardTitle: { fontSize: 15, fontWeight: '700', color: '#E2E8F0', marginBottom: 14 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  levelBadgeText: { fontSize: 14, fontWeight: '700' },
  onboardingHint: { fontSize: 12, color: '#6B7280', flex: 1 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  skillLabel: { fontSize: 12, color: '#9CA3AF', width: 90 },
  skillBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  skillBarFill: { height: 5, borderRadius: 3, backgroundColor: '#7C3AED' },
  skillVal: { fontSize: 11, color: '#6B7280', width: 30, textAlign: 'right' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: 24, fontWeight: '800', color: '#E2E8F0' },
  statLabel: { fontSize: 11, color: '#6B7280' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catName: { fontSize: 12, color: '#9CA3AF', width: 80, textTransform: 'capitalize' },
  catBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  catBarFill: { height: 5, borderRadius: 3, backgroundColor: '#7C3AED' },
  catPct: { fontSize: 11, color: '#6B7280', width: 32, textAlign: 'right' },
  quizRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  quizScore: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', width: 40 },
  quizMeta: { fontSize: 12, color: '#6B7280', flex: 1 },
  quizDate: { fontSize: 11, color: '#4B5563' },
});
