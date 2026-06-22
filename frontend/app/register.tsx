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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();
  const { t } = useTranslation();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const RECAPTCHA_SITE_KEY = '6LejZ4csAAAAAOhuqKb2Xesso7dU0__VyTFC5bhC';

  // Get reCAPTCHA v3 token (invisible) with timeout fallback
  const getCaptchaToken = (): Promise<string | null> => {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (val: string | null) => { if (!resolved) { resolved = true; resolve(val); } };
      setTimeout(() => done(null), 3000);
      try {
        if (typeof window === 'undefined') { done(null); return; }
        const grecaptcha = (window as any).grecaptcha;
        if (!grecaptcha) { done(null); return; }
        grecaptcha.ready(() => {
          try {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'register' })
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

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError(t('register.fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('register.passwordsNoMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('register.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register(email, password, name, undefined);
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: any) => e.msg || '').join(', ') : 'Une erreur est survenue';
      setError(message);
    } finally {
      setIsLoading(false);
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
        colors={['#050505', '#0A0A15', '#0F0F1A']}
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
          <Animated.View style={{ position: 'absolute', top: '15%', left: 50, width: 3, height: 3, borderRadius: 3, backgroundColor: '#10B981', opacity: fadeAnim }} />
          <Animated.View style={{ position: 'absolute', top: '40%', right: 35, width: 2, height: 2, borderRadius: 2, backgroundColor: '#7C3AED', opacity: fadeAnim }} />
          <Animated.View style={{ position: 'absolute', bottom: '25%', left: 70, width: 2.5, height: 2.5, borderRadius: 2.5, backgroundColor: '#06B6D4', opacity: fadeAnim }} />
          <Animated.View style={{ position: 'absolute', top: '25%', right: '30%', width: 1, height: 35, backgroundColor: '#10B981', opacity: 0.06, transform: [{ rotate: '30deg' }] }} />
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
                  colors={['#10B981', '#059669']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="person-add" size={28} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>{t('auth.createAccount')}</Text>
              <Text style={styles.subtitle}>
                {t('register.joinCommunity')}
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
              {/* Error Message */}
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.name')}</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'name' && styles.inputWrapperFocused,
                ]}>
                  <Ionicons 
                    name="person-outline" 
                    size={20} 
                    color={focusedInput === 'name' ? '#10B981' : '#64748B'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('register.yourName')}
                    placeholderTextColor="#4B5563"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>
              </View>

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
                    color={focusedInput === 'email' ? '#10B981' : '#64748B'} 
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
                    color={focusedInput === 'password' ? '#10B981' : '#64748B'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('register.minChars')}
                    placeholderTextColor="#4B5563"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
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

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.confirmPassword')}</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'confirmPassword' && styles.inputWrapperFocused,
                ]}>
                  <Ionicons 
                    name="shield-checkmark-outline" 
                    size={20} 
                    color={focusedInput === 'confirmPassword' ? '#10B981' : '#64748B'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('register.confirmYourPassword')}
                    placeholderTextColor="#4B5563"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms Notice */}
              <Text style={styles.termsText}>
                {t('register.termsText')}{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/terms')}>{t('register.terms')}</Text>{' '}
                {t('register.and')}{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>{t('register.privacy')}</Text>
              </Text>

              {/* Register Button */}
              <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={handleRegister}
                  onPressIn={handleButtonPressIn}
                  onPressOut={handleButtonPressOut}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.registerButtonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.registerButtonText}>{t('auth.signUp')}</Text>
                        <View style={styles.buttonArrow}>
                          <Ionicons name="arrow-forward" size={18} color="#FFF" />
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Login Link */}
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.loginText}>
                  {t('auth.hasAccount')} <Text style={styles.loginLink}>{t('auth.signIn')}</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
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
    width: 250,
    height: 250,
    top: -50,
    left: -80,
    backgroundColor: '#10B981',
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)', opacity: 0.12 } : { opacity: 0.04 }),
  },
  orb2: {
    width: 200,
    height: 200,
    bottom: 150,
    right: -60,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)', opacity: 0.1 } : { opacity: 0.03 }),
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
    marginTop: 24,
    marginBottom: 32,
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
    shadowColor: '#10B981',
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

  // Error Message
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
    marginBottom: 18,
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
    backgroundColor: '#12121A',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapperFocused: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
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

  // Terms
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  termsLink: {
    color: '#10B981',
    fontWeight: '600',
  },

  // Register Button
  registerButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  registerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  registerButtonText: {
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
    marginVertical: 20,
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

  // Login
  loginButton: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loginText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  loginLink: {
    color: '#10B981',
    fontWeight: '700',
  },
  captchaContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
});
