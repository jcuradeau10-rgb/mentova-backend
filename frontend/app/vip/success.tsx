import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { vipAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

export default function VIPSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage(t('vip.success.checkingPayment'));
    const sessionId = params.session_id as string;
    if (sessionId && isAuthenticated) {
      checkPayment(sessionId);
    } else if (!isAuthenticated) {
      setStatus('error');
      setMessage(t('vip.success.loginToCheck'));
    }
  }, [params.session_id, isAuthenticated]);

  const checkPayment = async (sessionId: string) => {
    try {
      // Poll for payment status
      for (let i = 0; i < 5; i++) {
        const response = await vipAPI.checkPaymentStatus(sessionId);
        
        if (response.data.payment_status === 'paid') {
          setStatus('success');
          setMessage(t('vip.success.subscriptionActive'));
          
          // Redirect to VIP page after 3 seconds
          setTimeout(() => {
            router.replace('/vip');
          }, 3000);
          return;
        } else if (response.data.status === 'expired') {
          setStatus('error');
          setMessage(t('vip.success.sessionExpired'));
          return;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If we get here, payment is still processing
      setStatus('error');
      setMessage(t('vip.success.paymentInProgress'));
    } catch (error) {
      console.error('Error checking payment:', error);
      setStatus('error');
      setMessage(t('vip.success.verificationError'));
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {status === 'loading' && (
            <>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.message}>{message}</Text>
            </>
          )}
          
          {status === 'success' && (
            <>
              <View style={styles.successIcon}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="checkmark" size={64} color="#1A0A2E" />
                </LinearGradient>
              </View>
              <Text style={styles.successTitle}>{t("vip.success.congrats")}</Text>
              <Text style={styles.message}>{message}</Text>
              <Text style={styles.redirectText}>Redirection vers votre espace VIP...</Text>
            </>
          )}
          
          {status === 'error' && (
            <>
              <View style={styles.errorIcon}>
                <Ionicons name="warning" size={64} color="#F59E0B" />
              </View>
              <Text style={styles.errorTitle}>Oops!</Text>
              <Text style={styles.message}>{message}</Text>
              <Text 
                style={styles.linkText}
                onPress={() => router.replace('/vip')}
              >
                {t('vipSuccess.backToVIP')}
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  safeArea: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  
  successIcon: { marginBottom: 24 },
  iconGradient: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 32, fontWeight: '700', color: '#FFD700', marginBottom: 16 },
  
  errorIcon: { marginBottom: 24 },
  errorTitle: { fontSize: 28, fontWeight: '700', color: '#F59E0B', marginBottom: 16 },
  
  message: { fontSize: 18, color: '#C4C4C4', textAlign: 'center', lineHeight: 28, marginBottom: 16 },
  redirectText: { fontSize: 14, color: '#8B8B9E', marginTop: 16 },
  linkText: { fontSize: 16, color: '#7C3AED', marginTop: 24, textDecorationLine: 'underline' },
});
