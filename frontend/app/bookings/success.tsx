import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { proAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

export default function BookingPaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = params.session_id as string;
    const bId = params.booking_id as string;
    
    if (bId) setBookingId(bId);
    
    if (sessionId && isAuthenticated) {
      checkPayment(sessionId);
    } else if (!isAuthenticated) {
      setStatus('error');
      setMessage(t('booking.payment.loginRequired'));
    }
  }, [params.session_id, isAuthenticated]);

  const checkPayment = async (sessionId: string) => {
    try {
      // Poll for payment status
      for (let i = 0; i < 5; i++) {
        const response = await proAPI.getBookingPaymentStatus(sessionId);
        
        if (response.data.payment_status === 'paid') {
          setStatus('success');
          setMessage(t('booking.payment.success'));
          setBookingId(response.data.booking_id);
          return;
        } else if (response.data.payment_status === 'expired') {
          setStatus('error');
          setMessage(t('booking.payment.expired'));
          return;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If we get here, payment is still processing
      setStatus('error');
      setMessage(t('booking.payment.processing'));
    } catch (error) {
      console.error('Error checking payment:', error);
      setStatus('error');
      setMessage(t('booking.payment.error'));
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {status === 'loading' && (
            <>
              <View style={styles.iconContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
              <Text style={styles.title}>{t('booking.payment.verifying')}</Text>
              <Text style={styles.subtitle}>{t('booking.payment.pleaseWait')}</Text>
            </>
          )}

          {status === 'success' && (
            <>
              <View style={[styles.iconContainer, styles.successIcon]}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </View>
              <Text style={styles.title}>{t('booking.payment.confirmed')}</Text>
              <Text style={styles.subtitle}>{message}</Text>
              
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar" size={20} color="#7C3AED" />
                  <Text style={styles.infoText}>{t('booking.payment.bookingConfirmed')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="notifications" size={20} color="#7C3AED" />
                  <Text style={styles.infoText}>{t('booking.payment.proNotified')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={20} color="#7C3AED" />
                  <Text style={styles.infoText}>{t('booking.payment.confirmationSent')}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => router.push(bookingId ? `/bookings/${bookingId}` : '/bookings')}
              >
                <LinearGradient
                  colors={['#7C3AED', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="eye" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>{t('booking.payment.viewBooking')}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.secondaryButtonText}>{t('booking.payment.backToHome')}</Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'error' && (
            <>
              <View style={[styles.iconContainer, styles.errorIcon]}>
                <Ionicons name="alert-circle" size={80} color="#EF4444" />
              </View>
              <Text style={styles.title}>{t('booking.payment.issue')}</Text>
              <Text style={styles.subtitle}>{message}</Text>

              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => router.push('/bookings')}
              >
                <LinearGradient
                  colors={['#7C3AED', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>{t('booking.payment.viewBookings')}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.secondaryButtonText}>{t('booking.payment.backToHome')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  errorIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    maxWidth: 300,
  },
  infoCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#D1D5DB',
    marginLeft: 12,
    flex: 1,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
