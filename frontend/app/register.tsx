import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

const tr: Record<string, Record<string, string>> = {
  title: { en: 'Create account', fr: 'Creer un compte', es: 'Crear cuenta' },
  subtitle: { en: 'Start learning crypto with Atlas AI', fr: 'Commencez a apprendre la crypto avec Atlas', es: 'Empieza a aprender crypto con Atlas' },
  name: { en: 'Full name', fr: 'Nom complet', es: 'Nombre completo' },
  email: { en: 'Email', fr: 'Email', es: 'Email' },
  password: { en: 'Password', fr: 'Mot de passe', es: 'Contrasena' },
  confirm: { en: 'Confirm password', fr: 'Confirmer le mot de passe', es: 'Confirmar contrasena' },
  signup: { en: 'Create Account', fr: 'Creer le compte', es: 'Crear cuenta' },
  hasAccount: { en: 'Already have an account?', fr: 'Deja un compte ?', es: 'Ya tienes cuenta?' },
  signin: { en: 'Sign In', fr: 'Se connecter', es: 'Iniciar sesion' },
  pwHint: { en: '8+ characters required', fr: '8 caracteres minimum', es: '8 caracteres minimo' },
  mismatch: { en: 'Passwords do not match', fr: 'Les mots de passe ne correspondent pas', es: 'Las contrasenas no coinciden' },
};

function t(key: string, lang: string) { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();
  const { language } = useTranslation();
  const lang = language || 'en';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (password !== confirmPw) { setError(t('mismatch', lang)); return; }
    if (password.length < 8) { setError(t('pwHint', lang)); return; }
    setLoading(true); setError('');
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(tabs)/learn');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const canSubmit = name.trim() && email.trim() && password.length >= 8 && confirmPw;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} testID="register-back-btn">
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.glow} />

          <View style={s.form}>
            <View style={s.iconWrap}><Ionicons name="planet" size={28} color="#7C3AED" /></View>
            <Text style={s.title}>{t('title', lang)}</Text>
            <Text style={s.subtitle}>{t('subtitle', lang)}</Text>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('name', lang)} placeholderTextColor="#475569" value={name} onChangeText={setName} testID="register-name-input" />
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('email', lang)} placeholderTextColor="#475569" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="register-email-input" />
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('password', lang)} placeholderTextColor="#475569" value={password} onChangeText={setPassword} secureTextEntry={!showPw} testID="register-password-input" />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
              <TextInput style={s.input} placeholder={t('confirm', lang)} placeholderTextColor="#475569" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!showPw} testID="register-confirm-input" />
            </View>

            <Text style={s.hint}>{t('pwHint', lang)}</Text>

            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleRegister}
              disabled={loading || !canSubmit}
              testID="register-submit-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>{t('signup', lang)}</Text>}
            </TouchableOpacity>

            <View style={s.linkRow}>
              <Text style={s.linkText}>{t('hasAccount', lang)}</Text>
              <TouchableOpacity onPress={() => router.push('/login')} testID="register-login-link">
                <Text style={s.linkAction}> {t('signin', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06060F' },
  inner: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, position: 'relative' },
  glow: { position: 'absolute', top: '15%', right: '20%', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124,58,237,0.06)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 12, backgroundColor: '#120E26', justifyContent: 'center', alignItems: 'center' },

  form: { width: '100%', maxWidth: 380, alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 28, textAlign: 'center' },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 14, textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, width: '100%' },

  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#120E26', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 14 : 12, marginBottom: 12, width: '100%', borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)' },
  input: { flex: 1, fontSize: 15, color: '#F8FAFC', outlineStyle: 'none' as any },
  hint: { fontSize: 12, color: '#475569', alignSelf: 'flex-start', marginBottom: 20, marginTop: -4 },

  submitBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkText: { fontSize: 13, color: '#64748B' },
  linkAction: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
});
