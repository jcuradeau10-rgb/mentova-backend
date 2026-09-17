import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const tr: Record<string, Record<string, string>> = {
  title: { fr: 'Verifiez votre email', en: 'Verify your email', es: 'Verifica tu email' },
  subtitle: { fr: 'Un code a 6 chiffres a ete envoye a', en: 'A 6-digit code was sent to', es: 'Un codigo de 6 digitos fue enviado a' },
  verify: { fr: 'Verifier', en: 'Verify', es: 'Verificar' },
  resend: { fr: 'Renvoyer le code', en: 'Resend code', es: 'Reenviar codigo' },
  resent: { fr: 'Code renvoye!', en: 'Code resent!', es: 'Codigo reenviado!' },
  invalid: { fr: 'Code invalide', en: 'Invalid code', es: 'Codigo invalido' },
  success: { fr: 'Email verifie!', en: 'Email verified!', es: 'Email verificado!' },
  check: { fr: 'Verifiez vos emails (et les spams)', en: 'Check your inbox (and spam folder)', es: 'Revisa tu correo (y la carpeta de spam)' },
  successSub: { fr: 'Redirection en cours...', en: 'Redirecting...', es: 'Redirigiendo...' },
};

function t(key: string, lang: string) { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('pending_verify_email').then(e => { if (e) setEmail(e); });
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (success) {
      Animated.spring(successScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    }
  }, [success]);

  const handleDigitChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (clean.length > 1) {
      // Paste handling
      const pasted = clean.slice(0, 6).split('');
      const newDigits = [...digits];
      pasted.forEach((d, i) => { if (i + index < 6) newDigits[i + index] = d; });
      setDigits(newDigits);
      const nextIdx = Math.min(index + pasted.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }
    const newDigits = [...digits];
    newDigits[index] = clean;
    setDigits(newDigits);
    setError('');
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
    }
  };

  const code = digits.join('');
  const codeComplete = code.length === 6;

  const handleVerify = async () => {
    if (!codeComplete) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        await AsyncStorage.removeItem('pending_verify_email');
        setTimeout(() => router.replace('/login'), 2000);
      } else {
        setError(t('invalid', lang));
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError(t('invalid', lang));
    } finally { setLoading(false); }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (codeComplete && !loading && !success) handleVerify();
  }, [digits]);

  const handleResend = async () => {
    setResending(true); setResent(false);
    try {
      await fetch(`${API}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch {} finally { setResending(false); }
  };

  if (success) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.centerContent}>
          <Animated.View style={[s.successCircle, { transform: [{ scale: successScale }] }]}>
            <Ionicons name="checkmark" size={52} color="#fff" />
          </Animated.View>
          <Text style={s.successText}>{t('success', lang)}</Text>
          <Text style={s.successSub}>{t('successSub', lang)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.centerContent}>
          {/* Animated icon */}
          <Animated.View style={[s.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <View style={s.iconInner}>
              <Ionicons name="mail-open" size={32} color="#A78BFA" />
            </View>
          </Animated.View>

          <Text style={s.title} data-testid="verify-email-title">{t('title', lang)}</Text>
          <Text style={s.subtitle}>{t('subtitle', lang)}</Text>
          <Text style={s.emailText}>{email}</Text>
          <Text style={s.checkHint}>{t('check', lang)}</Text>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* 6 individual digit inputs */}
          <View style={s.digitRow} data-testid="verify-email-code-input">
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref; }}
                style={[
                  s.digitInput,
                  d ? s.digitInputFilled : {},
                  error ? s.digitInputError : {},
                ]}
                value={d}
                onChangeText={text => handleDigitChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                selectTextOnFocus
                data-testid={`verify-digit-${i}`}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[s.verifyBtn, !codeComplete && s.verifyBtnDisabled]}
            onPress={handleVerify}
            disabled={loading || !codeComplete}
            data-testid="verify-email-submit-btn"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.verifyBtnText}>{t('verify', lang)}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.resendBtn} onPress={handleResend} disabled={resending} data-testid="verify-email-resend-btn">
            {resending ? (
              <ActivityIndicator color="#7C3AED" size="small" />
            ) : resent ? (
              <View style={s.resentRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[s.resendText, { color: '#10B981' }]}>{t('resent', lang)}</Text>
              </View>
            ) : (
              <Text style={s.resendText}>{t('resend', lang)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconWrap: { marginBottom: 28 },
  iconInner: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  emailText: { fontSize: 15, color: '#A78BFA', fontWeight: '700', marginTop: 4, marginBottom: 6 },
  checkHint: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 28 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '500' },
  digitRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  digitInput: {
    width: 46, height: 56, borderRadius: 14,
    backgroundColor: '#120E26', borderWidth: 2, borderColor: 'rgba(124,58,237,0.15)',
    fontSize: 24, fontWeight: '800', color: '#F8FAFC',
    textAlign: 'center',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  digitInputFilled: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.08)' },
  digitInputError: { borderColor: 'rgba(239,68,68,0.4)' },
  verifyBtn: { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, width: '100%', maxWidth: 300, alignItems: 'center', marginBottom: 16 },
  verifyBtnDisabled: { opacity: 0.4 },
  verifyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  resendBtn: { paddingVertical: 10 },
  resendText: { fontSize: 14, color: '#7C3AED', fontWeight: '600' },
  resentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  successCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successText: { fontSize: 26, fontWeight: '800', color: '#10B981', marginBottom: 8 },
  successSub: { fontSize: 14, color: '#9CA3AF' },
});
