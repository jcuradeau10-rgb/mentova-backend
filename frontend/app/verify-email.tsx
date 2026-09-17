import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../store/languageStore';
import { useAuthStore } from '../store/authStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const tr: Record<string, Record<string, string>> = {
  title: { fr: 'Verifiez votre email', en: 'Verify your email', es: 'Verifica tu email' },
  subtitle: { fr: 'Un code a 6 chiffres a ete envoye a', en: 'A 6-digit code was sent to', es: 'Un codigo de 6 digitos fue enviado a' },
  placeholder: { fr: 'Code a 6 chiffres', en: '6-digit code', es: 'Codigo de 6 digitos' },
  verify: { fr: 'Verifier', en: 'Verify', es: 'Verificar' },
  resend: { fr: 'Renvoyer le code', en: 'Resend code', es: 'Reenviar codigo' },
  resent: { fr: 'Code renvoye!', en: 'Code resent!', es: 'Codigo reenviado!' },
  invalid: { fr: 'Code invalide', en: 'Invalid code', es: 'Codigo invalido' },
  success: { fr: 'Email verifie!', en: 'Email verified!', es: 'Email verificado!' },
  check: { fr: 'Verifiez vos emails (et les spams)', en: 'Check your inbox (and spam folder)', es: 'Revisa tu correo (y la carpeta de spam)' },
};

function t(key: string, lang: string) { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const { login } = useAuthStore();
  const lang = language || 'fr';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('pending_verify_email').then(e => { if (e) setEmail(e); });
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;
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
        setTimeout(() => { router.replace('/login'); }, 1500);
      } else {
        setError(t('invalid', lang));
      }
    } catch {
      setError(t('invalid', lang));
    } finally { setLoading(false); }
  };

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
          <View style={s.successCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={s.successText}>{t('success', lang)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.centerContent}>
          <View style={s.iconWrap}>
            <Ionicons name="mail-open" size={36} color="#7C3AED" />
          </View>
          <Text style={s.title} data-testid="verify-email-title">{t('title', lang)}</Text>
          <Text style={s.subtitle}>{t('subtitle', lang)}</Text>
          <Text style={s.emailText}>{email}</Text>
          <Text style={s.checkHint}>{t('check', lang)}</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TextInput
            style={s.codeInput}
            placeholder={t('placeholder', lang)}
            placeholderTextColor="#475569"
            value={code}
            onChangeText={c => setCode(c.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            data-testid="verify-email-code-input"
          />

          <TouchableOpacity
            style={[s.verifyBtn, code.length !== 6 && s.verifyBtnDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
            data-testid="verify-email-submit-btn"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.verifyBtnText}>{t('verify', lang)}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.resendBtn} onPress={handleResend} disabled={resending} data-testid="verify-email-resend-btn">
            {resending ? (
              <ActivityIndicator color="#7C3AED" size="small" />
            ) : (
              <Text style={s.resendText}>{resent ? t('resent', lang) : t('resend', lang)}</Text>
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
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  emailText: { fontSize: 16, color: '#A78BFA', fontWeight: '700', marginTop: 4, marginBottom: 8 },
  checkHint: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 28 },
  error: { color: '#EF4444', fontSize: 14, marginBottom: 16, textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  codeInput: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', letterSpacing: 12, backgroundColor: '#120E26', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 24, width: '100%', maxWidth: 280, textAlign: 'center', borderWidth: 2, borderColor: 'rgba(124,58,237,0.25)', marginBottom: 20, outlineStyle: 'none' as any },
  verifyBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 16, width: '100%', maxWidth: 280, alignItems: 'center', marginBottom: 16 },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  resendBtn: { paddingVertical: 8 },
  resendText: { fontSize: 14, color: '#7C3AED', fontWeight: '600' },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successText: { fontSize: 24, fontWeight: '800', color: '#10B981' },
});
