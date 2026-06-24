import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { t } = useTranslation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Safe setter that guarantees string type
  const setSafeError = (val: any) => {
    if (typeof val === 'string') { setError(val); return; }
    if (Array.isArray(val)) { setError(val.map((e: any) => typeof e === 'string' ? e : e?.msg || JSON.stringify(e)).join(', ')); return; }
    if (val && typeof val === 'object') { setError(val.msg || val.message || val.detail || JSON.stringify(val)); return; }
    setError(String(val ?? ''));
  };
  const [checked, setChecked] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const RECAPTCHA_SITE_KEY = '6LejZ4csAAAAAOhuqKb2Xesso7dU0__VyTFC5bhC';

  // Get reCAPTCHA v3 token (invisible) with timeout fallback
  const getCaptchaToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (val: string | null) => { if (!resolved) { resolved = true; resolve(val); } };
      // Timeout after 3s — never block login for captcha
      setTimeout(() => done(null), 3000);
      try {
        if (typeof window === 'undefined') { done(null); return; }
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha) { done(null); return; }
        grecaptcha.ready(() => {
          try {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' })
              .then((token: string) => done(token))
              .catch(() => done(null));
          } catch { done(null); }
        });
      } catch { done(null); }
    });
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formSlideAnim = useRef(new Animated.Value(50)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(formSlideAnim, {
        toValue: 0,
        friction: 8,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating orbs
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Anim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(orb1Anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(orb2Anim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!checked && Platform.OS === 'web' && typeof window !== 'undefined') {
      setChecked(true);
      const urlParams = new URLSearchParams(window.location.search);
      const resetParam = urlParams.get('reset');
      if (resetParam === 'success') {
        setSuccessMessage(t('login.passwordReset'));
        setTimeout(() => {
          window.history.replaceState({}, '', '/login');
        }, 100);
      }
    }
  }, [checked]);

  const handleLogin = async (totpOverride?: string) => {
    if (!email || !password) {
      setSafeError(t('auth.email') + ' et ' + t('auth.password') + ' requis');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Fire login immediately — captcha is optional and non-blocking
      const result = await login(email, password, undefined, totpOverride || undefined);
      if (result && result.requires_2fa) {
        setShow2FAModal(true);
        setIsLoading(false);
        return;
      }
      // Redirect Apple Review accounts to welcome page
      if (result?.user?.is_apple_review) {
        router.replace('/welcome-review');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setSafeError(detail || 'Email ou mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = () => {
    if (totpCode.length === 6) {
      setShow2FAModal(false);
      handleLogin(totpCode);
      setTotpCode('');
    }
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const orb1TranslateY = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const orb2TranslateX = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#06060F', '#0A0A1A', '#08061A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated Orbs - web only */}
      {Platform.OS === 'web' && (
        <>
          <Animated.View 
            style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1TranslateY }] }]} 
          />
          <Animated.View 
            style={[styles.orb, styles.orb2, { transform: [{ translateX: orb2TranslateX }] }]} 
          />
        </>
      )}

      {/* Native-friendly subtle animations */}
      {Platform.OS !== 'web' && (
        <>
          <Animated.View style={{ position: 'absolute', top: '20%', right: 30, width: 3, height: 3, borderRadius: 3, backgroundColor: '#7C3AED', opacity: fadeAnim }} />
          <Animated.View style={{ position: 'absolute', top: '35%', left: 40, width: 2, height: 2, borderRadius: 2, backgroundColor: '#06B6D4', opacity: fadeAnim }} />
          <Animated.View style={{ position: 'absolute', top: '60%', right: 60, width: 2.5, height: 2.5, borderRadius: 2.5, backgroundColor: '#F59E0B', opacity: fadeAnim }} />
          <Animated.View style={{ position: 'absolute', top: '10%', left: '50%', width: 1, height: 40, backgroundColor: '#7C3AED', opacity: 0.06, transform: [{ rotate: '45deg' }] }} />
          <Animated.View style={{ position: 'absolute', bottom: '30%', right: '20%', width: 1, height: 30, backgroundColor: '#06B6D4', opacity: 0.05, transform: [{ rotate: '-30deg' }] }} />
        </>
      )}

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back Button */}
            <Animated.View style={{ opacity: fadeAnim }}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <View style={styles.backButtonInner}>
                  <Ionicons name="arrow-back" size={20} color="#FFF" />
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Header */}
            <Animated.View 
              style={[
                styles.header,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#7C3AED', '#A855F7']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="person" size={28} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
              <Text style={styles.subtitle}>
                {t('login.connectToAccess')}
              </Text>
            </Animated.View>

            {/* Form */}
            <Animated.View 
              style={[
                styles.formContainer,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: formSlideAnim }],
                },
              ]}
            >
              {/* Success Message */}
              {successMessage ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'email' && styles.inputWrapperFocused,
                ]}>
                  <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color={focusedInput === 'email' ? '#7C3AED' : '#64748B'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="exemple@email.com"
                    placeholderTextColor="#4B5563"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'password' && styles.inputWrapperFocused,
                ]}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={focusedInput === 'password' ? '#7C3AED' : '#64748B'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#4B5563"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/forgot-password')}
              >
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => handleLogin()}
                  onPressIn={handleButtonPressIn}
                  onPressOut={handleButtonPressOut}
                  disabled={isLoading}
                  activeOpacity={0.9}
                  data-testid="login-submit-btn"
                >
                  <View
                    style={[styles.loginButtonGradient, { backgroundColor: '#7C3AED' }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>{t('auth.signIn')}</Text>
                        <View style={styles.buttonArrow}>
                          <Ionicons name="arrow-forward" size={18} color="#FFF" />
                        </View>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register Link */}
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.registerText}>
                  {t('auth.noAccount')} <Text style={styles.registerLink}>{t('auth.signUp')}</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 2FA Modal */}
      <Modal visible={show2FAModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="shield-checkmark" size={48} color="#7C3AED" />
            <Text style={styles.modalTitle}>{t('auth.2faRequired') || 'Two-Factor Authentication'}</Text>
            <Text style={styles.modalSubtitle}>{t('auth.enter2faCode') || 'Enter the 6-digit code from your authenticator app'}</Text>
            <TextInput
              style={styles.totpInput}
              value={totpCode}
              onChangeText={setTotpCode}
              placeholder="000000"
              placeholderTextColor="#4B5563"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              data-testid="totp-input"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShow2FAModal(false); setTotpCode(''); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, totpCode.length !== 6 && { opacity: 0.5 }]}
                onPress={handle2FASubmit}
                disabled={totpCode.length !== 6}
                data-testid="totp-submit-btn"
              >
                <Text style={styles.modalConfirmText}>{t('auth.verify') || 'Verify'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06060F',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Orbs
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 300,
    height: 300,
    top: -80,
    right: -100,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)', opacity: 0.15 } : { opacity: 0.04 }),
  },
  orb2: {
    width: 250,
    height: 250,
    bottom: 80,
    left: -80,
    backgroundColor: '#00D9A5',
    ...(Platform.OS === 'web' ? { filter: 'blur(100px)', opacity: 0.1 } : { opacity: 0.03 }),
  },

  // Back Button
  backButton: {
    marginTop: 16,
    width: 44,
    height: 44,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Header
  header: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },

  // Form
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },

  // Messages
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#10B981',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
  },

  // Input
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapperFocused: {
    borderColor: 'rgba(124,58,237,0.5)',
    backgroundColor: 'rgba(124,58,237,0.05)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    marginLeft: 12,
  },
  eyeButton: {
    padding: 4,
  },

  // Forgot Password
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '600',
  },

  // Login Button
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: '#64748B',
  },

  // Register
  registerButton: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  registerText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  registerLink: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  captchaContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8B8B9E',
    textAlign: 'center',
    marginBottom: 24,
  },
  totpInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D3F',
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D3F',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#8B8B9E',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
