import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const LANGS = [
  { code: 'fr', label: 'Francais', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Espanol', flag: '🇪🇸' },
];

const tr: Record<string, Record<string, string>> = {
  title: { en: 'Create account', fr: 'Creer un compte', es: 'Crear cuenta' },
  subtitle: { en: 'Start learning crypto with Caufid', fr: 'Commencez a apprendre la crypto avec Caufid', es: 'Empieza a aprender crypto con Caufid' },
  name: { en: 'Full name', fr: 'Nom complet', es: 'Nombre completo' },
  email: { en: 'Email', fr: 'Email', es: 'Email' },
  password: { en: 'Password', fr: 'Mot de passe', es: 'Contrasena' },
  confirm: { en: 'Confirm password', fr: 'Confirmer le mot de passe', es: 'Confirmar contrasena' },
  signup: { en: 'Create Account', fr: 'Creer le compte', es: 'Crear cuenta' },
  hasAccount: { en: 'Already have an account?', fr: 'Deja un compte ?', es: 'Ya tienes cuenta?' },
  signin: { en: 'Sign In', fr: 'Se connecter', es: 'Iniciar sesion' },
  mismatch: { en: 'Passwords do not match', fr: 'Les mots de passe ne correspondent pas', es: 'Las contrasenas no coinciden' },
  langLabel: { en: 'Language', fr: 'Langue', es: 'Idioma' },
  pwMin: { en: '8 characters minimum', fr: '8 caracteres minimum', es: '8 caracteres minimo' },
  pwSpecial: { en: '1 special character (!@#$...)', fr: '1 caractere special (!@#$...)', es: '1 caracter especial (!@#$...)' },
  emailInUse: { en: 'This email is already in use', fr: 'Cet email est deja utilise', es: 'Este email ya esta en uso' },
  pwNeedSpecial: { en: 'Password must contain a special character', fr: 'Le mot de passe doit contenir un caractere special', es: 'La contrasena debe contener un caracter especial' },
};

function t(key: string, lang: string) { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

const hasSpecialChar = (pw: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(pw);

export default function RegisterScreen() {
  const router = useRouter();
  const { setLanguage } = useTranslation();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [selectedLang, setSelectedLang] = useState(lang);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pwLongEnough = password.length >= 8;
  const pwHasSpecial = hasSpecialChar(password);
  const pwValid = pwLongEnough && pwHasSpecial;

  const handleLangSelect = async (code: string) => {
    setSelectedLang(code);
    await setLanguage(code as any);
  };

  const handleRegister = async () => {
    if (password !== confirmPw) { setError(t('mismatch', selectedLang)); return; }
    if (!pwValid) { setError(t('pwNeedSpecial', selectedLang)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim(), language: selectedLang }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail || 'Registration failed';
        const translated = detail === 'This email is already in use' ? t('emailInUse', selectedLang) : detail;
        setError(translated);
        return;
      }
      // Save token temporarily for verify-email page
      const { access_token } = data;
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('pending_verify_email', email.trim());
      router.replace('/verify-email');
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const canSubmit = name.trim() && email.trim() && pwValid && confirmPw;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} data-testid="register-back-btn">
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.glow} />

          <View style={s.form}>
            <View style={s.iconWrap}><Ionicons name="planet" size={28} color="#7C3AED" /></View>
            <Text style={s.title}>{t('title', selectedLang)}</Text>
            <Text style={s.subtitle}>{t('subtitle', selectedLang)}</Text>

            {/* Language selector */}
            <Text style={s.langLabel}>{t('langLabel', selectedLang)}</Text>
            <View style={s.langRow} data-testid="register-lang-selector">
              {LANGS.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={[s.langBtn, selectedLang === l.code && s.langBtnActive]}
                  onPress={() => handleLangSelect(l.code)}
                  data-testid={`register-lang-${l.code}`}
                >
                  <Text style={s.langFlag}>{l.flag}</Text>
                  <Text style={[s.langText, selectedLang === l.code && s.langTextActive]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('name', selectedLang)} placeholderTextColor="#475569" value={name} onChangeText={setName} data-testid="register-name-input" />
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('email', selectedLang)} placeholderTextColor="#475569" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" data-testid="register-email-input" />
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('password', selectedLang)} placeholderTextColor="#475569" value={password} onChangeText={setPassword} secureTextEntry={!showPw} data-testid="register-password-input" />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('confirm', selectedLang)} placeholderTextColor="#475569" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!showPw} data-testid="register-confirm-input" />
            </View>

            {/* Password requirements */}
            {password.length > 0 && (
              <View style={s.pwReqs}>
                <View style={s.pwReqRow}>
                  <Ionicons name={pwLongEnough ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={pwLongEnough ? '#10B981' : '#475569'} />
                  <Text style={[s.pwReqText, pwLongEnough && s.pwReqMet]}>{t('pwMin', selectedLang)}</Text>
                </View>
                <View style={s.pwReqRow}>
                  <Ionicons name={pwHasSpecial ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={pwHasSpecial ? '#10B981' : '#475569'} />
                  <Text style={[s.pwReqText, pwHasSpecial && s.pwReqMet]}>{t('pwSpecial', selectedLang)}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleRegister}
              disabled={loading || !canSubmit}
              data-testid="register-submit-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>{t('signup', selectedLang)}</Text>}
            </TouchableOpacity>

            <View style={s.linkRow}>
              <Text style={s.linkText}>{t('hasAccount', selectedLang)}</Text>
              <TouchableOpacity onPress={() => router.push('/login')} data-testid="register-login-link">
                <Text style={s.linkAction}> {t('signin', selectedLang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  inner: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, position: 'relative' },
  glow: { position: 'absolute', top: '15%', right: '20%', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124,58,237,0.06)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(18,14,38,0.7)' },
  form: { width: '100%', maxWidth: 380, alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20, textAlign: 'center' },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 14, textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, width: '100%' },
  langLabel: { fontSize: 13, color: '#64748B', alignSelf: 'flex-start', marginBottom: 8, fontWeight: '600' },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 20, width: '100%' },
  langBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#120E26', borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)' },
  langBtnActive: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.12)' },
  langFlag: { fontSize: 18 },
  langText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  langTextActive: { color: '#A78BFA' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#120E26', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 14 : 12, marginBottom: 12, width: '100%', borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)' },
  input: { flex: 1, fontSize: 15, color: '#F8FAFC', outlineStyle: 'none' as any },
  pwReqs: { alignSelf: 'flex-start', marginBottom: 16, marginTop: -4, gap: 4 },
  pwReqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwReqText: { fontSize: 12, color: '#475569' },
  pwReqMet: { color: '#10B981' },
  submitBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkText: { fontSize: 13, color: '#64748B' },
  linkAction: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
});
