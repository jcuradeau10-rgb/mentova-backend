import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import { useThemeStore } from '../store/themeStore';

const tr: Record<string, Record<string, string>> = {
  welcome: { en: 'Welcome back', fr: 'Bon retour', es: 'Bienvenido de nuevo' },
  subtitle: { en: 'Sign in to continue with Atlas', fr: 'Connectez-vous pour continuer avec Atlas', es: 'Inicia sesion para continuar con Atlas' },
  email: { en: 'Email', fr: 'Email', es: 'Email' },
  password: { en: 'Password', fr: 'Mot de passe', es: 'Contrasena' },
  signin: { en: 'Sign In', fr: 'Se connecter', es: 'Iniciar sesion' },
  forgot: { en: 'Forgot password?', fr: 'Mot de passe oublie ?', es: 'Olvidaste tu contrasena?' },
  noAccount: { en: "Don't have an account?", fr: "Pas encore de compte ?", es: 'No tienes cuenta?' },
  signup: { en: 'Sign Up', fr: "S'inscrire", es: 'Registrarse' },
};

function t(key: string, lang: string) { return tr[key]?.[lang] || tr[key]?.['en'] || key; }

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { language } = useTranslation();
  const { colors: c } = useThemeStore();
  const lang = language || 'en';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError('');
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/learn');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} testID="login-back-btn">
          <Ionicons name="arrow-back" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* Glow */}
        <View style={s.glow} />

        <View style={s.form}>
          {/* Header */}
          <View style={s.iconWrap}>
            <Ionicons name="planet" size={28} color="#7C3AED" />
          </View>
          <Text style={s.title}>{t('welcome', lang)}</Text>
          <Text style={s.subtitle}>{t('subtitle', lang)}</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* Email */}
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#64748B" />
            <TextInput
              style={s.input}
              placeholder={t('email', lang)}
              placeholderTextColor="#475569"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="login-email-input"
            />
          </View>

          {/* Password */}
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
            <TextInput
              style={s.input}
              placeholder={t('password', lang)}
              placeholderTextColor="#475569"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              testID="login-password-input"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Forgot */}
          <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/forgot-password')} testID="login-forgot-btn">
            <Text style={s.forgotText}>{t('forgot', lang)}</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, (!email.trim() || !password.trim()) && s.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || !email.trim() || !password.trim()}
            testID="login-submit-btn"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>{t('signin', lang)}</Text>}
          </TouchableOpacity>

          {/* Register link */}
          <View style={s.linkRow}>
            <Text style={s.linkText}>{t('noAccount', lang)}</Text>
            <TouchableOpacity onPress={() => router.push('/register')} testID="login-register-link">
              <Text style={s.linkAction}> {t('signup', lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, position: 'relative' },
  glow: { position: 'absolute', top: '20%', left: '30%', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124,58,237,0.06)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(18,14,38,0.7)' },

  form: { width: '100%', maxWidth: 380, alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  title: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 28, textAlign: 'center' },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 14, textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.08)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, width: '100%' },

  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#120E26', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 14 : 12, marginBottom: 12, width: '100%', borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)' },
  input: { flex: 1, fontSize: 15, color: '#F8FAFC', outlineStyle: 'none' as any },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: '#7C3AED', fontWeight: '500' },

  submitBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkText: { fontSize: 13, color: '#64748B' },
  linkAction: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
});
