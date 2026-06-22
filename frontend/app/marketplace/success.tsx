import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import api from '../../utils/api';
import { useTranslation } from '../../store/languageStore';

export default function PurchaseSuccessPage() {
  const router = useRouter();
  const { purchase_id } = useLocalSearchParams<{ purchase_id: string }>();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    email_sent?: boolean;
    has_meeting_links?: boolean;
    meeting_links_count?: number;
    already_confirmed?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchase_id) {
      setError(t('purchaseSuccess.missingId'));
      setLoading(false);
      return;
    }

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    confirmPurchase();
  }, [purchase_id, isAuthenticated]);

  const confirmPurchase = async () => {
    try {
      const response = await api.post(`/marketplace/confirm-purchase/${purchase_id}`);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('purchaseSuccess.confirmError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>{t('purchaseSuccess.confirming')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
          </View>
          <Text style={styles.title}>{t('purchaseSuccess.error')}</Text>
          <Text style={styles.message}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/marketplace')}
          >
            <Text style={styles.buttonText}>{t('purchaseSuccess.backToMarketplace')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconWrapper}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.iconGradient}
          >
            <Ionicons name="checkmark" size={48} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {result?.already_confirmed ? t('purchaseSuccess.alreadyConfirmed') : t('purchaseSuccess.confirmed')}
        </Text>
        <Text style={styles.message}>
          {result?.message || t('purchaseSuccess.defaultMessage')}
        </Text>

        {/* Email Sent Info */}
        {result?.has_meeting_links && (
          <View style={styles.emailInfo}>
            <View style={styles.emailIconWrapper}>
              <Ionicons name="mail" size={24} color="#7C3AED" />
            </View>
            <View style={styles.emailTextWrapper}>
              <Text style={styles.emailTitle}>
                {result.email_sent ? t('purchaseSuccess.emailSent') : t('purchaseSuccess.sessionLinks')}
              </Text>
              <Text style={styles.emailDesc}>
                {result.email_sent 
                  ? t('purchaseSuccess.emailSentMsg', { count: String(result.meeting_links_count) })
                  : t('purchaseSuccess.accessFromPurchases')}
              </Text>
            </View>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            {t('purchaseSuccess.findPurchases')}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/vip/purchases')}
          >
            <LinearGradient
              colors={['#7C3AED', '#5B21B6']}
              style={styles.buttonGradient}
            >
              <Ionicons name="bag" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>{t('purchaseSuccess.viewPurchases')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/marketplace')}
          >
            <Text style={styles.secondaryButtonText}>{t('purchaseSuccess.continueShopping')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#7C3AED30',
  },
  emailIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  emailTextWrapper: {
    flex: 1,
  },
  emailTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  emailDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#3B82F615',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    width: '100%',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7C3AED',
  },
  button: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
  },
});
