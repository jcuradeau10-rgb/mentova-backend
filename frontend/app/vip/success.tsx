import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const tr: Record<string, Record<string, string>> = {
  checking: { fr: 'Vérification du paiement...', en: 'Checking payment...', es: 'Verificando pago...' },
  congrats: { fr: 'Félicitations!', en: 'Congratulations!', es: '¡Felicidades!' },
  activated: { fr: 'Votre abonnement VIP est maintenant actif!', en: 'Your VIP subscription is now active!', es: '¡Tu suscripción VIP está activa!' },
  enjoy: { fr: 'Vous bénéficiez maintenant de toutes les fonctionnalités premium:', en: 'You now have access to all premium features:', es: 'Ahora tienes acceso a todas las funciones premium:' },
  redirect: { fr: "Redirection vers l'app...", en: 'Redirecting to app...', es: 'Redirigiendo a la app...' },
  errorTitle: { fr: 'Oops!', en: 'Oops!', es: '¡Ups!' },
  verifyError: { fr: 'Erreur lors de la vérification du paiement', en: 'Error verifying payment', es: 'Error al verificar el pago' },
  processing: { fr: 'Paiement en cours de traitement...', en: 'Payment being processed...', es: 'Pago en proceso...' },
  loginNeeded: { fr: 'Connectez-vous pour vérifier votre paiement', en: 'Log in to verify your payment', es: 'Inicia sesión para verificar tu pago' },
  backVip: { fr: 'Retour à la page VIP', en: 'Back to VIP page', es: 'Volver a la página VIP' },
};

const FEATURES: Record<string, Array<{icon: string; color: string; text: string}>> = {
  fr: [
    { icon: 'cloud', color: '#7C3AED', text: 'Mémoire persistante de Caufid' },
    { icon: 'bar-chart', color: '#3B82F6', text: 'Analyse de graphiques avancée' },
    { icon: 'globe', color: '#10B981', text: 'Intelligence de marché en temps réel' },
    { icon: 'school', color: '#F59E0B', text: 'Apprentissage personnalisé adaptatif' },
    { icon: 'today', color: '#EF4444', text: 'Briefing quotidien personnalisé' },
    { icon: 'rocket', color: '#EC4899', text: 'Accès anticipé aux nouvelles fonctionnalités' },
  ],
  en: [
    { icon: 'cloud', color: '#7C3AED', text: 'Persistent Caufid memory' },
    { icon: 'bar-chart', color: '#3B82F6', text: 'Advanced chart analysis' },
    { icon: 'globe', color: '#10B981', text: 'Real-time market intelligence' },
    { icon: 'school', color: '#F59E0B', text: 'Adaptive personalized learning' },
    { icon: 'today', color: '#EF4444', text: 'Personalized daily briefing' },
    { icon: 'rocket', color: '#EC4899', text: 'Early access to new features' },
  ],
  es: [
    { icon: 'cloud', color: '#7C3AED', text: 'Memoria persistente de Caufid' },
    { icon: 'bar-chart', color: '#3B82F6', text: 'Análisis de gráficos avanzado' },
    { icon: 'globe', color: '#10B981', text: 'Inteligencia de mercado en tiempo real' },
    { icon: 'school', color: '#F59E0B', text: 'Aprendizaje personalizado adaptativo' },
    { icon: 'today', color: '#EF4444', text: 'Briefing diario personalizado' },
    { icon: 'rocket', color: '#EC4899', text: 'Acceso anticipado a nuevas funciones' },
  ],
};

function t(key: string, lang: string): string {
  return tr[key]?.[lang] || tr[key]?.['en'] || key;
}

export default function VIPSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, isAuthenticated } = useAuthStore();
  const { language } = useTranslation();
  const lang = language || 'fr';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);

  // Wait for auth to be ready — restore token from storage if needed
  useEffect(() => {
    const resolveAuth = async () => {
      if (token) {
        setResolvedToken(token);
        setAuthReady(true);
        return;
      }
      // Token not in state yet — try to get it from AsyncStorage
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const stored = await AsyncStorage.getItem('token');
        if (stored) {
          setResolvedToken(stored);
          setAuthReady(true);
          return;
        }
      } catch {}
      // No token at all
      setAuthReady(true);
    };
    resolveAuth();
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    setMessage(t('checking', lang));
    const sessionId = params.session_id as string;
    if (sessionId && resolvedToken) {
      checkPayment(sessionId);
    } else if (!resolvedToken) {
      setStatus('error');
      setMessage(t('loginNeeded', lang));
    }
  }, [authReady, resolvedToken, params.session_id]);

  const checkPayment = async (sessionId: string) => {
    try {
      for (let i = 0; i < 10; i++) {
        const res = await fetch(`${API}/api/vip/checkout/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${resolvedToken}` },
        });
        const data = await res.json();

        if (data.payment_status === 'paid') {
          setStatus('success');
          setMessage(t('activated', lang));
          setTimeout(() => { router.replace('/(tabs)/learn'); }, 4000);
          return;
        } else if (data.status === 'expired') {
          setStatus('error');
          setMessage(t('verifyError', lang));
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      setStatus('error');
      setMessage(t('processing', lang));
    } catch (error) {
      console.error('Error checking payment:', error);
      setStatus('error');
      setMessage(t('verifyError', lang));
    }
  };

  const features = FEATURES[lang] || FEATURES.fr;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A1A', '#1A0A2E', '#0F0520']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {status === 'loading' && (
            <View style={styles.content}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.message}>{message}</Text>
            </View>
          )}

          {status === 'success' && (
            <View style={styles.content}>
              <View style={styles.successIcon}>
                <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.iconGradient}>
                  <Ionicons name="checkmark" size={56} color="#1A0A2E" />
                </LinearGradient>
              </View>
              <Text style={styles.successTitle} data-testid="vip-success-title">{t('congrats', lang)}</Text>
              <Text style={styles.message}>{message}</Text>

              <Text style={styles.enjoyText}>{t('enjoy', lang)}</Text>

              <View style={styles.featuresList} data-testid="vip-success-features">
                {features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <View style={[styles.featureIconWrap, { backgroundColor: f.color + '20' }]}>
                      <Ionicons name={f.icon as any} size={18} color={f.color} />
                    </View>
                    <Text style={styles.featureText}>{f.text}</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  </View>
                ))}
              </View>

              <Text style={styles.redirectText}>{t('redirect', lang)}</Text>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.content}>
              <View style={styles.errorIcon}>
                <Ionicons name="warning" size={56} color="#F59E0B" />
              </View>
              <Text style={styles.errorTitle}>{t('errorTitle', lang)}</Text>
              <Text style={styles.message}>{message}</Text>
              <Text style={styles.linkText} onPress={() => router.replace('/vip')} data-testid="vip-success-back">
                {t('backVip', lang)}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center' },
  successIcon: { marginBottom: 24 },
  iconGradient: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 30, fontWeight: '800', color: '#FFD700', marginBottom: 8 },
  errorIcon: { marginBottom: 24 },
  errorTitle: { fontSize: 28, fontWeight: '700', color: '#F59E0B', marginBottom: 12 },
  message: { fontSize: 16, color: '#C4C4C4', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  enjoyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  featuresList: { width: '100%', gap: 8, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  featureIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13, color: '#E2E8F0', fontWeight: '500' },
  redirectText: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  linkText: { fontSize: 16, color: '#7C3AED', marginTop: 24, textDecorationLine: 'underline' },
});
