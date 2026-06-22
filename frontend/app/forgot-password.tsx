import React, { useState } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../utils/api';
import { useTranslation } from '../store/languageStore';

type Step = 'email' | 'code' | 'newPassword' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetComplete, setResetComplete] = useState(false);

  // Handle redirect when reset is complete
  React.useEffect(() => {
    if (resetComplete) {
      // Show success step immediately
      setStep('success');
    }
  }, [resetComplete]);

  const handleRequestCode = async () => {
    if (!email) {
      setError(t('forgotPassword.enterEmailError'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.forgotPassword(email);
      if (response.data.success) {
        setSuccessMessage(response.data.message);
        setStep('code');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: any) => e.msg || '').join(', ') : t('common.error');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setError(t('forgotPassword.enterCodeError'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.verifyResetCode(email, code);
      if (response.data.success) {
        setStep('newPassword');
        setSuccessMessage('');
      } else {
        setError(response.data.message || t('forgotPassword.invalidCode'));
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: any) => e.msg || '').join(', ') : t('forgotPassword.invalidCode');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError(t('forgotPassword.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('forgotPassword.passwordsNoMatch'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('forgotPassword.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.resetPassword(email, code, newPassword);
      if (response.data.success) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          alert(t('forgotPassword.successMessage'));
          window.location.href = '/login';
        } else {
          Alert.alert('', t('forgotPassword.successMessage'), [
            { text: 'OK', onPress: () => router.replace('/login') }
          ]);
        }
        return;
      } else {
        setError(response.data.message || t('common.error'));
        setIsLoading(false);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: any) => e.msg || '').join(', ') : t('common.error');
      setError(message);
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, step === 'email' && styles.stepDotActive]} />
      <View style={styles.stepLine} />
      <View style={[styles.stepDot, step === 'code' && styles.stepDotActive]} />
      <View style={styles.stepLine} />
      <View style={[styles.stepDot, step === 'newPassword' && styles.stepDotActive]} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (step === 'email') {
                router.back();
              } else if (step === 'code') {
                setStep('email');
                setError('');
              } else {
                setStep('code');
                setError('');
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="key-outline" size={32} color="#7C3AED" />
            </View>
            <Text style={styles.title}>
              {step === 'email' && t('forgotPassword.title')}
              {step === 'code' && t('forgotPassword.verification')}
              {step === 'newPassword' && t('forgotPassword.newPassword')}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'email' && t('forgotPassword.enterEmail')}
              {step === 'code' && t('forgotPassword.enterCode')}
              {step === 'newPassword' && t('forgotPassword.choosePassword')}
            </Text>
          </View>

          {renderStepIndicator()}

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#FF4757" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#00D9A5" />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {step === 'email' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t('forgotPassword.email')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#8B8B9E" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="votre@email.com"
                      placeholderTextColor="#5A5A6E"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleRequestCode}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>{t('forgotPassword.sendCode')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === 'code' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t('forgotPassword.verificationCode')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="keypad-outline" size={20} color="#8B8B9E" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      placeholder="000000"
                      placeholderTextColor="#5A5A6E"
                      value={code}
                      onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>{t('forgotPassword.verifyCode')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleRequestCode}
                  disabled={isLoading}
                >
                  <Text style={styles.resendText}>{t('forgotPassword.resendCode')}</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'newPassword' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t('forgotPassword.newPasswordLabel')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#8B8B9E" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('forgotPassword.minChars')}
                      placeholderTextColor="#5A5A6E"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#8B8B9E"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t('forgotPassword.confirmPasswordLabel')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#8B8B9E" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('forgotPassword.retypePassword')}
                      placeholderTextColor="#5A5A6E"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>{t('forgotPassword.resetPassword')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === 'success' && (
              <View style={styles.successScreen}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={80} color="#00D9A5" />
                </View>
                <Text style={styles.successTitle}>{t('forgotPassword.success')}</Text>
                <Text style={styles.successSubtitle}>
                  {t('forgotPassword.successMessage')}
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>{t('forgotPassword.login')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {step !== 'success' && (
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.loginLinkText}>{t('forgotPassword.backToLogin')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8B8B9E',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2A2A4E',
  },
  stepDotActive: {
    backgroundColor: '#7C3AED',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#2A2A4E',
    marginHorizontal: 8,
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  errorText: {
    color: '#FF4757',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 165, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.3)',
  },
  successText: {
    color: '#00D9A5',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  eyeButton: {
    padding: 16,
  },
  button: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 32,
  },
  loginLinkText: {
    color: '#8B8B9E',
    fontSize: 14,
  },
  // Success screen styles
  successScreen: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#8B8B9E',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
});
