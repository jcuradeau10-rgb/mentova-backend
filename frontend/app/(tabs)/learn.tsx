import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../../store/languageStore';
import { useAuthStore } from '../../store/authStore';
import GlossaryText from '../../components/GlossaryText';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://mentova-api.onrender.com';
const { width: SW } = Dimensions.get('window');
const FREE_CHAPTERS = 2;

interface Message { id: string; role: 'user' | 'assistant'; content: string; }
interface Chapter { id: string; title: string; objective: string; }
interface Level { id: string; title: string; description: string; icon: string; color: string; chapters: Chapter[]; }
interface QuizQ { type: string; question: string; options?: string[]; correct?: any; explanation?: string; key_points?: string[]; }

// ============ ASSESSMENT COMPONENT ============
function Assessment({ onComplete, lang }: { onComplete: (level: string) => void; lang: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/atlas/assessment/questions?lang=${lang}`)
      .then(r => r.json()).then(d => { setQuestions(d.questions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleAnswer = async (answer: string) => {
    const q = questions[currentQ];
    const newAnswers = { ...answers, [q.id]: answer };
    setAnswers(newAnswers);
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Submit
      try {
        const res = await fetch(`${API}/api/atlas/assessment/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: newAnswers }),
        });
        const data = await res.json();
        onComplete(data.level);
      } catch { onComplete('beginner'); }
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />;
  if (!questions.length) return null;

  const q = questions[currentQ];
  const progress = ((currentQ) / questions.length) * 100;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 30 }}>
      <LinearGradient colors={['rgba(124,58,237,0.12)', 'rgba(59,130,246,0.08)']} style={a.card}>
        <LinearGradient colors={['#7C3AED', '#3B82F6']} style={a.iconWrap}>
          <Ionicons name="school" size={32} color="#FFF" />
        </LinearGradient>
        <Text style={a.title}>{lang === 'fr' ? 'Evaluation de niveau' : lang === 'es' ? 'Evaluacion de nivel' : 'Level Assessment'}</Text>
        <Text style={a.desc}>{lang === 'fr' ? 'Reponds a quelques questions pour que je puisse adapter ton parcours.' : 'Answer a few questions so I can adapt your learning path.'}</Text>

        <View style={a.progressBar}>
          <View style={[a.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={a.progressText}>{currentQ + 1} / {questions.length}</Text>

        <View style={a.questionBox}>
          <Text style={a.questionText}>{q.question}</Text>
        </View>

        <View style={a.btnRow}>
          <TouchableOpacity style={a.yesBtn} onPress={() => handleAnswer('yes')} data-testid="assessment-yes">
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={a.yesBtnText}>{lang === 'fr' ? 'Oui' : lang === 'es' ? 'Si' : 'Yes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={a.noBtn} onPress={() => handleAnswer('no')} data-testid="assessment-no">
            <Ionicons name="close-circle" size={24} color="#EF4444" />
            <Text style={a.noBtnText}>{lang === 'fr' ? 'Non' : 'No'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

// ============ CURRICULUM COMPONENT ============
function Curriculum({ level, curriculum, completedChapters, onSelectChapter, lang, isVip }: {
  level: string; curriculum: Record<string, Level>; completedChapters: string[];
  onSelectChapter: (levelId: string, chapterId: string) => void; lang: string; isVip: boolean;
}) {
  const lvl = curriculum[level];
  if (!lvl) return null;

  const totalCh = lvl.chapters.length;
  const doneCh = lvl.chapters.filter(c => completedChapters.includes(c.id)).length;
  const progress = totalCh > 0 ? (doneCh / totalCh) * 100 : 0;

  const levelLabels: Record<string, Record<string, string>> = {
    beginner: { fr: 'Debutant', en: 'Beginner', es: 'Principiante' },
    intermediate: { fr: 'Intermediaire', en: 'Intermediate', es: 'Intermedio' },
    advanced: { fr: 'Avance', en: 'Advanced', es: 'Avanzado' },
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Level Header */}
      <LinearGradient colors={[lvl.color + '20', lvl.color + '08']} style={c.levelCard}>
        <View style={c.levelRow}>
          <View style={[c.levelIcon, { backgroundColor: lvl.color + '30' }]}>
            <Ionicons name={lvl.icon as any} size={24} color={lvl.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[c.levelBadge, { color: lvl.color }]}>{levelLabels[level]?.[lang] || level}</Text>
            <Text style={c.levelTitle}>{lvl.title}</Text>
            <Text style={c.levelDesc}>{lvl.description}</Text>
          </View>
        </View>
        <View style={c.progressBar}>
          <View style={[c.progressFill, { width: `${progress}%`, backgroundColor: lvl.color }]} />
        </View>
        <Text style={c.progressText}>{doneCh}/{totalCh} {lang === 'fr' ? 'chapitres termines' : 'chapters completed'}</Text>
      </LinearGradient>

      {/* Chapters */}
      {lvl.chapters.map((ch, i) => {
        const isDone = completedChapters.includes(ch.id);
        const isNext = !isDone && (i === 0 || completedChapters.includes(lvl.chapters[i - 1]?.id));
        const isVipLocked = !isVip && i >= FREE_CHAPTERS && !isDone;
        const vipLabel: Record<string, string> = { fr: 'VIP', en: 'VIP', es: 'VIP' };
        return (
          <TouchableOpacity
            key={ch.id}
            style={[c.chapterCard, isDone && c.chapterDone, isNext && !isVipLocked && c.chapterNext, isVipLocked && c.chapterVipLocked]}
            onPress={() => isVipLocked ? null : onSelectChapter(level, ch.id)}
            disabled={isVipLocked}
            data-testid={`chapter-${ch.id}`}
          >
            <View style={c.chapterRow}>
              <View style={[c.chapterNum, isDone && { backgroundColor: '#10B981' }, isNext && !isVipLocked && { backgroundColor: lvl.color }, isVipLocked && { backgroundColor: '#B8860B' }]}>
                {isDone ? <Ionicons name="checkmark" size={16} color="#FFF" /> : isVipLocked ? <Ionicons name="diamond" size={14} color="#FFD700" /> : <Text style={c.chapterNumText}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[c.chapterTitle, isDone && { color: '#6B7280' }, isVipLocked && { color: '#888' }]}>{ch.title}</Text>
                  {isVipLocked && <View style={c.vipBadge}><Text style={c.vipBadgeText}>{vipLabel[lang] || 'VIP'}</Text></View>}
                </View>
                <Text style={c.chapterObj}>{isVipLocked ? (lang === 'fr' ? 'Abonne-toi VIP pour debloquer' : 'Subscribe VIP to unlock') : ch.objective}</Text>
              </View>
              <Ionicons name={isDone ? 'checkmark-circle' : isVipLocked ? 'diamond' : isNext ? 'play-circle' : 'lock-closed'} size={22} color={isDone ? '#10B981' : isVipLocked ? '#B8860B' : isNext ? lvl.color : '#333'} />
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Level switcher */}
      <Text style={c.otherLabel}>{lang === 'fr' ? 'Autres niveaux' : 'Other levels'}</Text>
      <View style={c.otherRow}>
        {Object.entries(curriculum).filter(([k]) => k !== level).map(([k, v]) => (
          <TouchableOpacity key={k} style={c.otherBtn} onPress={() => onSelectChapter(k, curriculum[k].chapters[0]?.id)}>
            <Ionicons name={v.icon as any} size={16} color={v.color} />
            <Text style={[c.otherText, { color: v.color }]}>{v.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ============ LESSON COMPONENT ============
function Lesson({ levelId, chapterId, chapterTitle, onBack, onQuiz, lang, token }: {
  levelId: string; chapterId: string; chapterTitle: string;
  onBack: () => void; onQuiz: () => void; lang: string; token?: string;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sessionId] = useState(() => `teach-${chapterId}-${Date.now()}`);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setContent(''); setLoading(true); setChatMessages([]);
    const fetchLesson = async () => {
      try {
        const res = await fetch(`${API}/api/atlas/teach`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapter_id: chapterId, level_id: levelId, lang }),
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');
        const decoder = new TextDecoder(); let full = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              full += data;
              setContent(full);
            }
          }
        }
      } catch { setContent(lang === 'fr' ? 'Erreur de chargement. Réessaie.' : 'Loading error. Try again.'); }
      setLoading(false);
    };
    fetchLesson();
  }, [chapterId]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput(''); setChatLoading(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/atlas/teach/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({ chapter_id: chapterId, level_id: levelId, message: userMsg, session_id: sessionId }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.response || 'Erreur' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Erreur de connexion' }]);
    }
    setChatLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const askLabel = lang === 'fr' ? 'Poser une question à Atlas' : lang === 'es' ? 'Hacer una pregunta a Atlas' : 'Ask Atlas a question';
  const quizLabel = lang === 'fr' ? 'Passer le Quiz (5 questions)' : lang === 'es' ? 'Tomar el Quiz (5 preguntas)' : 'Take the Quiz (5 questions)';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={l.header}>
        <TouchableOpacity onPress={onBack} style={l.backBtn}><Ionicons name="arrow-back" size={22} color="#FFF" /></TouchableOpacity>
        <Text style={l.headerTitle} numberOfLines={1}>{chapterTitle}</Text>
      </View>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {loading && !content && <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />}
        <GlossaryText text={content} style={l.lessonText} />

        {/* Chat messages during lesson */}
        {chatMessages.length > 0 && (
          <View style={l.chatSection}>
            <View style={l.chatDivider}><View style={l.chatDividerLine} /><Text style={l.chatDividerText}>{lang === 'fr' ? 'Discussion avec Atlas' : 'Chat with Atlas'}</Text><View style={l.chatDividerLine} /></View>
            {chatMessages.map((msg, i) => (
              <View key={i} style={[l.chatBubble, msg.role === 'user' ? l.chatUser : l.chatBot]}>
                {msg.role === 'assistant' && <Ionicons name="planet" size={14} color="#7C3AED" style={{ marginRight: 6, marginTop: 2 }} />}
                <Text style={[l.chatText, msg.role === 'user' && { color: '#FFF' }]}>{msg.text}</Text>
              </View>
            ))}
            {chatLoading && <ActivityIndicator size="small" color="#7C3AED" style={{ marginVertical: 8 }} />}
          </View>
        )}
      </ScrollView>

      {/* Bottom bar: Ask question + Quiz button */}
      {!loading && content.length > 50 && (
        <View style={l.bottomBar}>
          {showChat ? (
            <View style={l.chatInputRow}>
              <TextInput style={l.chatInput} value={chatInput} onChangeText={setChatInput} placeholder={askLabel} placeholderTextColor="#666" onSubmitEditing={sendChatMessage} />
              <TouchableOpacity onPress={sendChatMessage} disabled={chatLoading || !chatInput.trim()} style={l.chatSendBtn}>
                <Ionicons name="send" size={18} color={chatInput.trim() ? '#7C3AED' : '#444'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowChat(false)} style={l.chatCloseBtn}>
                <Ionicons name="close" size={18} color="#888" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={l.actionRow}>
              <TouchableOpacity style={l.askBtn} onPress={() => setShowChat(true)}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#7C3AED" />
                <Text style={l.askBtnText}>{lang === 'fr' ? 'Poser une question' : 'Ask a question'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={l.quizBtn} onPress={onQuiz} data-testid="start-quiz-btn">
                <LinearGradient colors={['#7C3AED', '#3B82F6']} style={l.quizBtnGrad}>
                  <Ionicons name="help-circle" size={18} color="#FFF" />
                  <Text style={l.quizBtnText}>{quizLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ============ QUIZ COMPONENT ============
function Quiz({ levelId, chapterId, chapterTitle, onComplete, lang }: {
  levelId: string; chapterId: string; chapterTitle: string;
  onComplete: (score: number) => void; lang: string;
}) {
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [correction, setCorrection] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [correcting, setCorrecting] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/atlas/quiz/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_id: chapterId, level_id: levelId, lang }),
    }).then(r => r.json()).then(d => { setQuestions(d.questions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleMCQ = (idx: number) => {
    if (answered) return;
    const q = questions[currentQ];
    const isCorrect = idx === q.correct;
    setSelectedAnswer(String(idx));
    setCorrection(q.explanation || '');
    if (isCorrect) setScore(s => s + 1);
    setAnswered(true);
  };

  const handleTF = (val: boolean) => {
    if (answered) return;
    const q = questions[currentQ];
    const isCorrect = val === q.correct;
    setSelectedAnswer(String(val));
    setCorrection(q.explanation || '');
    if (isCorrect) setScore(s => s + 1);
    setAnswered(true);
  };

  const handleOpen = async () => {
    if (!openAnswer.trim() || correcting) return;
    setCorrecting(true);
    const q = questions[currentQ];
    try {
      const res = await fetch(`${API}/api/atlas/quiz/correct`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: chapterId, question_index: currentQ, question_type: 'open', answer: openAnswer, question_text: q.question, key_points: q.key_points }),
      });
      const data = await res.json();
      setCorrection(data.correction || '');
      setScore(s => s + 0.5); // Partial credit for open questions
    } catch { setCorrection(lang === 'fr' ? 'Bonne tentative !' : 'Good try!'); }
    setAnswered(true);
    setCorrecting(false);
  };

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setAnswered(false); setSelectedAnswer(null); setCorrection(null); setOpenAnswer('');
    } else {
      const finalScore = Math.round((score / questions.length) * 100);
      onComplete(finalScore);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 60 }} />;
  if (!questions.length) return <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>Quiz non disponible</Text>;

  const q = questions[currentQ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <Text style={qz.counter}>{lang === 'fr' ? 'Question' : 'Question'} {currentQ + 1}/{questions.length}</Text>
      <View style={qz.progressBar}><View style={[qz.progressFill, { width: `${((currentQ) / questions.length) * 100}%` }]} /></View>

      <View style={qz.questionCard}>
        <Text style={qz.questionText}>{q.question}</Text>
      </View>

      {q.type === 'mcq' && q.options?.map((opt, idx) => (
        <TouchableOpacity key={idx} style={[qz.optionBtn, answered && idx === q.correct && qz.optionCorrect, answered && selectedAnswer === String(idx) && idx !== q.correct && qz.optionWrong]} onPress={() => handleMCQ(idx)} disabled={answered}>
          <Text style={[qz.optionText, answered && idx === q.correct && { color: '#10B981' }]}>{opt}</Text>
        </TouchableOpacity>
      ))}

      {q.type === 'truefalse' && (
        <View style={qz.tfRow}>
          <TouchableOpacity style={[qz.tfBtn, answered && q.correct === true && qz.optionCorrect, answered && selectedAnswer === 'true' && q.correct !== true && qz.optionWrong]} onPress={() => handleTF(true)} disabled={answered}>
            <Ionicons name="checkmark-circle" size={28} color={answered && q.correct === true ? '#10B981' : '#A78BFA'} />
            <Text style={qz.tfText}>{lang === 'fr' ? 'Vrai' : 'True'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[qz.tfBtn, answered && q.correct === false && qz.optionCorrect, answered && selectedAnswer === 'false' && q.correct !== false && qz.optionWrong]} onPress={() => handleTF(false)} disabled={answered}>
            <Ionicons name="close-circle" size={28} color={answered && q.correct === false ? '#10B981' : '#EF4444'} />
            <Text style={qz.tfText}>{lang === 'fr' ? 'Faux' : 'False'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {q.type === 'open' && !answered && (
        <View>
          <TextInput style={qz.openInput} value={openAnswer} onChangeText={setOpenAnswer} placeholder={lang === 'fr' ? 'Ta reponse...' : 'Your answer...'} placeholderTextColor="#555" multiline />
          <TouchableOpacity style={qz.submitBtn} onPress={handleOpen} disabled={correcting || !openAnswer.trim()}>
            <LinearGradient colors={['#7C3AED', '#3B82F6']} style={qz.submitGrad}>
              {correcting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={qz.submitText}>{lang === 'fr' ? 'Soumettre' : 'Submit'}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {answered && correction && (
        <View style={qz.correctionBox}>
          <Ionicons name="bulb" size={18} color="#F59E0B" />
          <Text style={qz.correctionText}>{correction}</Text>
        </View>
      )}

      {answered && (
        <TouchableOpacity style={qz.nextBtn} onPress={nextQuestion}>
          <Text style={qz.nextText}>{currentQ < questions.length - 1 ? (lang === 'fr' ? 'Suivant' : 'Next') : (lang === 'fr' ? 'Voir les resultats' : 'See results')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#7C3AED" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ============ QUIZ RESULTS COMPONENT ============
function QuizResults({ score, chapterTitle, chapterId, onContinue, lang }: {
  score: number; chapterTitle: string; chapterId: string; onContinue: () => void; lang: string;
}) {
  const isGreat = score >= 80;
  const isOk = score >= 50 && score < 80;
  const emoji = isGreat ? 'trophy' : isOk ? 'thumbs-up' : 'refresh';
  const color = isGreat ? '#10B981' : isOk ? '#F59E0B' : '#EF4444';
  const [badge, setBadge] = useState<{icon: string; name: string; color: string} | null>(null);

  useEffect(() => {
    // Fetch badge info for this chapter from curriculum
    fetch(`${API}/api/atlas/curriculum?lang=${lang}`)
      .then(r => r.json())
      .then(data => {
        for (const lvl of Object.values(data) as any[]) {
          const ch = lvl.chapters?.find((c: any) => c.id === chapterId);
          if (ch?.badge) { setBadge(ch.badge); break; }
        }
      }).catch(() => {});
  }, [chapterId]);

  const messages: Record<string, Record<string, string>> = {
    great: { fr: 'Excellent ! Tu maitrises ce sujet !', en: 'Excellent! You master this topic!', es: 'Excelente! Dominas este tema!' },
    ok: { fr: 'Bien joue ! Continue comme ca.', en: 'Well done! Keep it up.', es: 'Bien hecho! Sigue asi.' },
    retry: { fr: 'Continue a apprendre, tu vas y arriver !', en: 'Keep learning, you will get there!', es: 'Sigue aprendiendo, lo lograras!' },
  };
  const btnText: Record<string, string> = { fr: 'Chapitre suivant', en: 'Next Chapter', es: 'Siguiente Capitulo' };
  const scoreLabel: Record<string, string> = { fr: 'Ton score', en: 'Your score', es: 'Tu puntuacion' };
  const badgeLabel: Record<string, string> = { fr: 'Badge obtenu !', en: 'Badge earned!', es: 'Insignia obtenida!' };
  const msg = isGreat ? messages.great : isOk ? messages.ok : messages.retry;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, alignItems: 'center', paddingTop: 40 }}>
      <View style={[r.iconCircle, { backgroundColor: color + '20', borderColor: color + '40' }]}>
        <Ionicons name={emoji as any} size={48} color={color} />
      </View>
      <Text style={r.scoreLabel}>{scoreLabel[lang] || scoreLabel.en}</Text>
      <Text style={[r.scoreValue, { color }]}>{score}%</Text>
      <Text style={r.message}>{msg[lang] || msg.en}</Text>

      {/* Badge earned */}
      {badge && (
        <View style={r.badgeCard}>
          <View style={[r.badgeIcon, { backgroundColor: badge.color + '20' }]}>
            <Ionicons name={badge.icon as any} size={28} color={badge.color} />
          </View>
          <Text style={r.badgeEarned}>{badgeLabel[lang] || badgeLabel.en}</Text>
          <Text style={[r.badgeName, { color: badge.color }]}>{badge.name}</Text>
        </View>
      )}

      <TouchableOpacity style={r.continueBtn} onPress={onContinue}>
        <LinearGradient colors={['#7C3AED', '#3B82F6']} style={r.continueBtnGrad}>
          <Text style={r.continueBtnText}>{btnText[lang] || btnText.en}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ============ ATLAS CHAT COMPONENT ============
function AtlasChat({ lang, t }: { lang: string; t: (key: string) => string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `atlas-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const scrollRef = useRef<ScrollView>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => { loadHistory(); }, []);
  const loadHistory = async () => { try { const s = await AsyncStorage.getItem('atlas_chat_history'); if (s) { const p = JSON.parse(s); if (p.length > 0) { setMessages(p); setShowWelcome(false); } } } catch {} };
  const saveHistory = async (msgs: Message[]) => { try { await AsyncStorage.setItem('atlas_chat_history', JSON.stringify(msgs.slice(-50))); } catch {} };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setLoading(true); setShowWelcome(false);
    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
    try {
      const res = await fetch(`${API}/api/atlas/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg.content, session_id: sessionId, lang }) });
      if (!res.ok) throw new Error('API error');
      const reader = res.body?.getReader(); if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder(); let fullText = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; const chunk = decoder.decode(value, { stream: true }); for (const line of chunk.split('\n')) { if (line.startsWith('data: ')) { const data = line.slice(6); if (data === '[DONE]') continue; fullText += data; setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)); } } }
      const finalMsgs = [...newMessages, { id: assistantId, role: 'assistant' as const, content: fullText }]; setMessages(finalMsgs); saveHistory(finalMsgs);
    } catch {
      try { const res = await fetch(`${API}/api/atlas/chat/simple`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg.content, session_id: sessionId, lang }) }); const data = await res.json(); const finalMsgs = [...newMessages, { id: assistantId, role: 'assistant' as const, content: data.response || 'Erreur' }]; setMessages(finalMsgs); saveHistory(finalMsgs); } catch { setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Erreur de connexion' } : m)); }
    }
    setLoading(false); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, loading, messages, sessionId]);

  const clearChat = async () => { setMessages([]); setShowWelcome(true); await AsyncStorage.removeItem('atlas_chat_history'); };
  const quickPrompts = [t('atlas.quick1'), t('atlas.quick2'), t('atlas.quick3'), t('atlas.quick4')];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={140}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {showWelcome && (
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.1)']} style={{ width: '100%', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', marginBottom: 16 }}>
              <LinearGradient colors={['#7C3AED', '#3B82F6']} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Ionicons name="planet" size={28} color="#FFF" /></LinearGradient>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 6 }}>{t('atlas.welcome')}</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 }}>{t('atlas.welcome_desc')}</Text>
            </LinearGradient>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' }}>{quickPrompts.map((p, i) => (<TouchableOpacity key={i} style={{ backgroundColor: 'rgba(124,58,237,0.08)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }} onPress={() => setInput(p)}><Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '600' }}>{p}</Text></TouchableOpacity>))}</View>
          </View>
        )}
        {messages.map(msg => (
          <View key={msg.id} style={[s.msgRow, msg.role === 'user' && s.msgRowUser]}>
            {msg.role === 'assistant' && (<LinearGradient colors={['#7C3AED', '#3B82F6']} style={s.msgAvatar}><Ionicons name="planet" size={14} color="#FFF" /></LinearGradient>)}
            <View style={[s.msgBubble, msg.role === 'user' ? s.msgUser : s.msgBot]}>
              {msg.role === 'user' ? <Text style={[s.msgText, { color: '#FFF' }]}>{msg.content}</Text> : <GlossaryText text={msg.content || (loading ? '...' : '')} style={s.msgText} />}
            </View>
          </View>
        ))}
        {loading && messages[messages.length - 1]?.content === '' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}><ActivityIndicator size="small" color="#7C3AED" /><Text style={{ color: '#888', fontSize: 12 }}>{t('atlas.thinking')}</Text></View>}
      </ScrollView>
      <View style={s.inputBar}>
        {messages.length > 0 && <TouchableOpacity onPress={clearChat} style={{ padding: 8 }}><Ionicons name="trash-outline" size={18} color="#666" /></TouchableOpacity>}
        <TextInput style={s.input} value={input} onChangeText={setInput} placeholder={t('atlas.placeholder')} placeholderTextColor="#555" multiline maxLength={2000} onSubmitEditing={sendMessage} />
        <TouchableOpacity style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]} onPress={sendMessage} disabled={!input.trim() || loading}>
          <LinearGradient colors={input.trim() && !loading ? ['#7C3AED', '#3B82F6'] : ['#333', '#333']} style={s.sendGrad}><Ionicons name="send" size={18} color="#FFF" /></LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============ MAIN LEARN SCREEN ============
export default function LearnScreen() {
  const { t, language } = useTranslation();
  const { user, token } = useAuthStore();
  const userId = user?.id || user?.user_id || 'anonymous';
  const lang = language || 'fr';

  const [tab, setTab] = useState<'parcours' | 'chat'>('parcours');
  const [curriculum, setCurriculum] = useState<Record<string, Level>>({});
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [loadingProg, setLoadingProg] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [msgRemaining, setMsgRemaining] = useState(20);
  const [limitResetAt, setLimitResetAt] = useState(0);

  // Lesson/Quiz state
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeChapterTitle, setActiveChapterTitle] = useState('');
  const [viewMode, setViewMode] = useState<'curriculum' | 'lesson' | 'quiz' | 'results'>('curriculum');
  const [lastQuizScore, setLastQuizScore] = useState(0);

  useEffect(() => {
    // Load curriculum + progress + usage
    fetch(`${API}/api/atlas/curriculum?lang=${lang}`).then(r => r.json()).then(setCurriculum).catch(() => {});

    // Fetch usage/VIP status
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${API}/api/atlas/usage?user_id=${userId}`, { headers }).then(r => r.json()).then(d => {
      setIsVip(d.is_vip || false);
      setMsgRemaining(d.remaining ?? 20);
      setLimitResetAt(d.reset_at || 0);
    }).catch(() => {});

    if (userId !== 'anonymous') {
      fetch(`${API}/api/atlas/progress/${userId}`).then(r => r.json()).then(d => {
        setUserLevel(d.level); setCompletedChapters(d.completed_chapters || []);
        setAssessmentDone(d.assessment_done || false);
        setLoadingProg(false);
      }).catch(() => setLoadingProg(false));
    } else {
      // Check AsyncStorage for anonymous progress
      AsyncStorage.multiGet(['atlas_level', 'atlas_completed']).then(stores => {
        const level = stores[0][1];
        const completed = stores[1][1];
        if (level) { setUserLevel(level); setAssessmentDone(true); }
        if (completed) { try { setCompletedChapters(JSON.parse(completed)); } catch {} }
        setLoadingProg(false);
      }).catch(() => setLoadingProg(false));
    }
  }, [lang, userId]);

  const handleAssessmentComplete = async (level: string) => {
    setUserLevel(level); setAssessmentDone(true);
    if (userId !== 'anonymous') {
      try { await fetch(`${API}/api/atlas/progress/${userId}/level`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }) }); } catch {}
    }
    await AsyncStorage.setItem('atlas_level', level);
  };

  const handleSelectChapter = (levelId: string, chapterId: string) => {
    const lvl = curriculum[levelId];
    const ch = lvl?.chapters.find(c => c.id === chapterId);
    // Check if chapter is unlocked (sequential)
    if (ch && lvl) {
      const chIdx = lvl.chapters.findIndex(c => c.id === chapterId);
      const isFirst = chIdx === 0;
      const prevDone = chIdx > 0 && completedChapters.includes(lvl.chapters[chIdx - 1]?.id);
      const isDone = completedChapters.includes(chapterId);
      if (isFirst || prevDone || isDone || levelId !== userLevel) {
        setActiveLevelId(levelId); setActiveChapterId(chapterId); setActiveChapterTitle(ch.title);
        setViewMode('lesson');
      }
    }
  };

  const handleQuizComplete = async (score: number) => {
    setLastQuizScore(score);
    if (activeChapterId && userId !== 'anonymous') {
      const lvl = curriculum[activeLevelId || ''];
      const chIdx = lvl?.chapters.findIndex(c => c.id === activeChapterId) ?? -1;
      const nextCh = lvl?.chapters[chIdx + 1]?.id || null;
      try { await fetch(`${API}/api/atlas/progress/${userId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chapter_id: activeChapterId, score, next_chapter: nextCh }) }); } catch {}
    }
    if (activeChapterId) setCompletedChapters(prev => [...new Set([...prev, activeChapterId!])]);
    await AsyncStorage.setItem('atlas_completed', JSON.stringify([...new Set([...completedChapters, activeChapterId!])]));
    setViewMode('results');
  };

  const handleResultsContinue = () => {
    setViewMode('curriculum');
  };

  const parcoursLabel = lang === 'fr' ? 'Mon Parcours' : lang === 'es' ? 'Mi Camino' : 'My Path';
  const chatLabel = lang === 'fr' ? 'Chat Atlas' : 'Atlas Chat';

  return (
    <SafeAreaView style={s.safe}>
      {/* Atlas Header */}
      <View style={s.atlasHeader}>
        <View style={s.atlasHeaderLeft}>
          <LinearGradient colors={['#7C3AED', '#5B21B6']} style={s.atlasLogo}>
            <Ionicons name="planet" size={20} color="#FFF" />
          </LinearGradient>
          <View>
            <Text style={s.atlasTitle}>Atlas</Text>
            <Text style={s.atlasSubtitle}>{isVip ? 'VIP Unlimited' : `${msgRemaining} msg`}</Text>
          </View>
        </View>
        {isVip && <View style={s.vipPill}><Ionicons name="diamond" size={12} color="#FFD700" /><Text style={s.vipPillText}>VIP</Text></View>}
      </View>

      {/* Tab Switcher */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, tab === 'parcours' && s.tabActive]} onPress={() => { setTab('parcours'); setViewMode('curriculum'); }} data-testid="tab-parcours">
          <Ionicons name="map" size={18} color={tab === 'parcours' ? '#7C3AED' : '#666'} />
          <Text style={[s.tabText, tab === 'parcours' && s.tabTextActive]}>{parcoursLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'chat' && s.tabActive]} onPress={() => setTab('chat')} data-testid="tab-chat">
          <Ionicons name="chatbubbles" size={18} color={tab === 'chat' ? '#7C3AED' : '#666'} />
          <Text style={[s.tabText, tab === 'chat' && s.tabTextActive]}>{chatLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'chat' ? (
        <AtlasChat lang={lang} t={t} />
      ) : loadingProg ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : !assessmentDone ? (
        <Assessment onComplete={handleAssessmentComplete} lang={lang} />
      ) : viewMode === 'lesson' && activeLevelId && activeChapterId ? (
        <Lesson levelId={activeLevelId} chapterId={activeChapterId} chapterTitle={activeChapterTitle} onBack={() => setViewMode('curriculum')} onQuiz={() => setViewMode('quiz')} lang={lang} token={token || undefined} />
      ) : viewMode === 'quiz' && activeLevelId && activeChapterId ? (
        <Quiz levelId={activeLevelId} chapterId={activeChapterId} chapterTitle={activeChapterTitle} onComplete={handleQuizComplete} lang={lang} />
      ) : viewMode === 'results' ? (
        <QuizResults score={lastQuizScore} chapterTitle={activeChapterTitle} chapterId={activeChapterId || ''} onContinue={handleResultsContinue} lang={lang} />
      ) : userLevel && Object.keys(curriculum).length > 0 ? (
        <Curriculum level={userLevel} curriculum={curriculum} completedChapters={completedChapters} onSelectChapter={handleSelectChapter} lang={lang} isVip={isVip} />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#7C3AED" /></View>
      )}
    </SafeAreaView>
  );
}

// ============ STYLES ============
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#06060F' },
  atlasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  atlasHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  atlasLogo: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  atlasTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  atlasSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  vipPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  vipPillText: { fontSize: 11, fontWeight: '800', color: '#FFD700' },
  tabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.02)' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.25)' },
  tabText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  tabTextActive: { color: '#A78BFA' },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgAvatar: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  msgBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgUser: { backgroundColor: '#7C3AED', borderBottomRightRadius: 4 },
  msgBot: { backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, color: '#E5E7EB', lineHeight: 21 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#06060F', gap: 8 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, color: '#FFF', fontSize: 16, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sendBtn: {},
  sendGrad: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

const a = StyleSheet.create({
  card: { borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  desc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  progressBar: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: '#7C3AED', borderRadius: 3 },
  progressText: { fontSize: 12, color: '#888', marginBottom: 24 },
  questionBox: { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  questionText: { fontSize: 17, fontWeight: '700', color: '#FFF', textAlign: 'center', lineHeight: 26 },
  btnRow: { flexDirection: 'row', gap: 16 },
  yesBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 16, paddingVertical: 16 },
  yesBtnText: { fontSize: 17, fontWeight: '700', color: '#10B981' },
  noBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 16, paddingVertical: 16 },
  noBtnText: { fontSize: 17, fontWeight: '700', color: '#EF4444' },
});

const c = StyleSheet.create({
  levelCard: { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  levelIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  levelBadge: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  levelTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  levelDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 12, color: '#888' },
  chapterCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  chapterDone: { borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.04)' },
  chapterNext: { borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.06)' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterNum: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  chapterNumText: { fontSize: 14, fontWeight: '700', color: '#888' },
  chapterTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  chapterObj: { fontSize: 12, color: '#888', lineHeight: 18 },
  chapterVipLocked: { borderColor: 'rgba(184,134,11,0.2)', backgroundColor: 'rgba(184,134,11,0.04)', opacity: 0.7 },
  vipBadge: { backgroundColor: '#B8860B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  vipBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: '800' },
  otherLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  otherRow: { flexDirection: 'row', gap: 10 },
  otherBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  otherText: { fontSize: 13, fontWeight: '600' },
});

const l = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', flex: 1 },
  lessonText: { fontSize: 15, color: '#E5E7EB', lineHeight: 24 },
  bottomBar: { padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#06060F' },
  actionRow: { gap: 8 },
  askBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.06)', marginBottom: 8 },
  askBtnText: { fontSize: 14, fontWeight: '600', color: '#A78BFA' },
  quizBtn: { borderRadius: 14, overflow: 'hidden' },
  quizBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  quizBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chatSendBtn: { padding: 8 },
  chatCloseBtn: { padding: 8 },
  chatSection: { marginTop: 24 },
  chatDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  chatDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(124,58,237,0.2)' },
  chatDividerText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  chatBubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, flexDirection: 'row' },
  chatUser: { backgroundColor: '#7C3AED', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBot: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatText: { fontSize: 14, color: '#E5E7EB', lineHeight: 20, flex: 1 },
});

const qz = StyleSheet.create({
  counter: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 20 },
  progressFill: { height: 4, backgroundColor: '#7C3AED', borderRadius: 2 },
  questionCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  questionText: { fontSize: 16, fontWeight: '700', color: '#FFF', lineHeight: 24 },
  optionBtn: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  optionCorrect: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)' },
  optionWrong: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  optionText: { fontSize: 14, color: '#E5E7EB' },
  tfRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingVertical: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tfText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  openInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, color: '#FFF', fontSize: 15, minHeight: 80, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  submitGrad: { paddingVertical: 14, alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  correctionBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 14, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  correctionText: { flex: 1, fontSize: 13, color: '#D1D5DB', lineHeight: 20 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  nextText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
});

const r = StyleSheet.create({
  iconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 3, marginBottom: 24 },
  scoreLabel: { fontSize: 14, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  scoreValue: { fontSize: 56, fontWeight: '900', marginBottom: 20 },
  doneLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  chapterName: { fontSize: 18, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 16 },
  message: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 20 },
  badgeCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 24, marginBottom: 32, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  badgeIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeEarned: { fontSize: 12, color: '#888', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  badgeName: { fontSize: 20, fontWeight: '800' },
  continueBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  continueBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  continueBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
});
