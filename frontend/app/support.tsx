import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from '../store/languageStore';

const supportI18n: Record<string, Record<string, string>> = {
  's.title': { fr: 'Centre d\'aide', en: 'Support Center', es: 'Centro de ayuda' },
  's.subtitle': { fr: 'Nous sommes la pour vous aider a tirer le meilleur parti de Mentova', en: 'We\'re here to help you get the most out of Mentova', es: 'Estamos aqui para ayudarte a aprovechar Mentova al maximo' },
  's.contactTitle': { fr: 'Nous contacter', en: 'Contact Us', es: 'Contactanos' },
  's.contactDesc': { fr: 'Une question, un commentaire ou besoin d\'aide ? Ecrivez-nous et nous vous repondrons sous 24 heures.', en: 'Have a question, feedback, or need help? Reach out to our team and we\'ll get back to you within 24 hours.', es: 'Tienes una pregunta, comentario o necesitas ayuda? Escribenos y te responderemos en 24 horas.' },
  's.responseTime': { fr: 'Reponse sous 24h', en: 'Response within 24h', es: 'Respuesta en 24h' },
  's.languages': { fr: 'FR / EN / ES', en: 'FR / EN / ES', es: 'FR / EN / ES' },
  's.faqTitle': { fr: 'Questions frequentes', en: 'Frequently Asked Questions', es: 'Preguntas frecuentes' },
  's.legalTitle': { fr: 'Mentions legales', en: 'Legal', es: 'Legal' },
  's.terms': { fr: 'Conditions d\'utilisation', en: 'Terms of Service', es: 'Terminos de servicio' },
  's.privacy': { fr: 'Politique de confidentialite', en: 'Privacy Policy', es: 'Politica de privacidad' },
  's.legalDisclaimer': { fr: 'Tout le contenu est fourni a des fins educatives uniquement et ne constitue pas un conseil financier. Le trading de cryptomonnaies comporte des risques importants. Les performances passees ne garantissent pas les resultats futurs.', en: 'All content is provided for educational purposes only and does not constitute financial advice. Trading cryptocurrencies involves significant risk. Past performance is not indicative of future results.', es: 'Todo el contenido se proporciona unicamente con fines educativos y no constituye asesoramiento financiero. El comercio de criptomonedas implica riesgos significativos. El rendimiento pasado no garantiza resultados futuros.' },
};

const faqI18n: Record<string, { q: Record<string, string>; a: Record<string, string> }> = {
  faq1: {
    q: { fr: 'Qu\'est-ce que Mentova ?', en: 'What is Mentova?', es: 'Que es Mentova?' },
    a: { fr: 'Mentova est une plateforme d\'apprentissage crypto alimentee par Caufid, un mentor IA personnalise. Caufid s\'adapte a votre niveau et vous guide a travers des modules structures pour maitriser les cryptomonnaies.', en: 'Mentova is a crypto learning platform powered by Caufid, a personalized AI mentor. Caufid adapts to your level and guides you through structured modules to master cryptocurrencies.', es: 'Mentova es una plataforma de aprendizaje crypto impulsada por Caufid, un mentor IA personalizado. Caufid se adapta a tu nivel y te guia a traves de modulos estructurados para dominar las criptomonedas.' },
  },
  faq2: {
    q: { fr: 'Comment fonctionne Caufid ?', en: 'How does Caufid work?', es: 'Como funciona Caufid?' },
    a: { fr: 'Caufid est votre mentor crypto personnel. Il analyse votre niveau, memorise vos preferences, et cree un parcours d\'apprentissage adapte. Posez-lui n\'importe quelle question sur les cryptos et il vous repondra de maniere pedagogique.', en: 'Caufid is your personal crypto mentor. It analyzes your level, remembers your preferences, and creates a tailored learning path. Ask it any crypto question and it will respond pedagogically.', es: 'Caufid es tu mentor crypto personal. Analiza tu nivel, recuerda tus preferencias y crea un camino de aprendizaje adaptado. Hazle cualquier pregunta sobre criptomonedas y te respondera de manera pedagogica.' },
  },
  faq3: {
    q: { fr: 'Mentova est-il gratuit ?', en: 'Is Mentova free?', es: 'Mentova es gratuito?' },
    a: { fr: 'Oui ! Mentova est actuellement en acces libre. Profitez de toutes les fonctionnalites, y compris Caufid, les donnees de marche en temps reel et les actualites crypto, sans aucun frais.', en: 'Yes! Mentova is currently free to access. Enjoy all features including Caufid, real-time market data, and crypto news at no cost.', es: 'Si! Mentova es actualmente de acceso libre. Disfruta de todas las funciones, incluyendo Caufid, datos de mercado en tiempo real y noticias crypto, sin costo alguno.' },
  },
  faq4: {
    q: { fr: 'Comment suivre ma progression ?', en: 'How do I track my progress?', es: 'Como sigo mi progreso?' },
    a: { fr: 'Rendez-vous dans l\'onglet Caufid, section "Progression". Vous y trouverez votre niveau global, vos competences detaillees, les modules completes et votre historique de quiz.', en: 'Go to the Caufid tab, "Progress" section. You\'ll find your overall level, detailed skills, completed modules, and quiz history.', es: 'Ve a la pestana Caufid, seccion "Progreso". Encontraras tu nivel general, habilidades detalladas, modulos completados e historial de quizzes.' },
  },
  faq5: {
    q: { fr: 'Mes donnees sont-elles securisees ?', en: 'Is my data secure?', es: 'Mis datos estan seguros?' },
    a: { fr: 'Absolument. Nous utilisons le chiffrement aux standards de l\'industrie et des pratiques de securite rigoureuses. Vos donnees personnelles ne sont jamais partagees avec des tiers sans votre consentement explicite.', en: 'Absolutely. We use industry-standard encryption and rigorous security practices. Your personal data is never shared with third parties without your explicit consent.', es: 'Absolutamente. Utilizamos cifrado estandar de la industria y practicas de seguridad rigurosas. Tus datos personales nunca se comparten con terceros sin tu consentimiento explicito.' },
  },
  faq6: {
    q: { fr: 'Comment devenir mentor ou ambassadeur ?', en: 'How do I become a mentor or ambassador?', es: 'Como me convierto en mentor o embajador?' },
    a: { fr: 'Visitez mentova-academy.com pour decouvrir nos programmes de mentorat et d\'ambassadeur. Nous recherchons des passionnes de crypto avec de l\'experience pour rejoindre notre equipe.', en: 'Visit mentova-academy.com to discover our mentorship and ambassador programs. We\'re looking for crypto enthusiasts with experience to join our team.', es: 'Visita mentova-academy.com para descubrir nuestros programas de mentoria y embajador. Buscamos entusiastas de las criptomonedas con experiencia para unirse a nuestro equipo.' },
  },
};

function ts(key: string, lang: string): string {
  return supportI18n[key]?.[lang] || supportI18n[key]?.['en'] || key;
}

export default function SupportPage() {
  const router = useRouter();
  const { language } = useTranslation();
  const lang = language || 'fr';
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const handleEmail = () => {
    if (Platform.OS === 'web') {
      window.open('mailto:info@mentova-academy.com', '_blank');
    } else {
      Linking.openURL('mailto:info@mentova-academy.com');
    }
  };

  const faqKeys = Object.keys(faqI18n);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="support-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Ionicons name="headset" size={28} color="#7C3AED" />
            </View>
          </View>
          <Text style={styles.title} data-testid="support-title">{ts('s.title', lang)}</Text>
          <Text style={styles.subtitle}>{ts('s.subtitle', lang)}</Text>
        </View>

        {/* Contact Card */}
        <View style={styles.contactCard} data-testid="support-contact-card">
          <Text style={styles.contactTitle}>{ts('s.contactTitle', lang)}</Text>
          <Text style={styles.contactDesc}>{ts('s.contactDesc', lang)}</Text>
          <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} data-testid="support-email-btn">
            <Ionicons name="mail" size={18} color="#fff" />
            <Text style={styles.emailBtnText}>info@mentova-academy.com</Text>
          </TouchableOpacity>
          <View style={styles.contactMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#9CA3AF" />
              <Text style={styles.metaText}>{ts('s.responseTime', lang)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="globe-outline" size={14} color="#9CA3AF" />
              <Text style={styles.metaText}>{ts('s.languages', lang)}</Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection} data-testid="support-faq-section">
          <Text style={styles.sectionTitle}>{ts('s.faqTitle', lang)}</Text>
          {faqKeys.map((key, i) => {
            const isExpanded = expandedFaq === key;
            return (
              <TouchableOpacity
                key={key}
                style={styles.faqItem}
                onPress={() => setExpandedFaq(isExpanded ? null : key)}
                activeOpacity={0.7}
                data-testid={`faq-item-${i}`}
              >
                <View style={styles.faqQ}>
                  <View style={styles.qDot} />
                  <Text style={styles.faqQuestion}>{faqI18n[key].q[lang] || faqI18n[key].q['en']}</Text>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#7C3AED" />
                </View>
                {isExpanded && (
                  <Text style={styles.faqAnswer}>{faqI18n[key].a[lang] || faqI18n[key].a['en']}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legal */}
        <View style={styles.legalSection}>
          <Text style={styles.sectionTitle}>{ts('s.legalTitle', lang)}</Text>
          <View style={styles.legalCard}>
            <TouchableOpacity onPress={() => router.push('/terms')} style={styles.legalLink} data-testid="support-terms-link">
              <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
              <Text style={styles.legalLinkText}>{ts('s.terms', lang)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#4B5563" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/privacy')} style={styles.legalLink} data-testid="support-privacy-link">
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <Text style={styles.legalLinkText}>{ts('s.privacy', lang)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#4B5563" />
            </TouchableOpacity>
            <Text style={styles.legalText}>{ts('s.legalDisclaimer', lang)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>&copy; 2026 Mentova Academy</Text>
          <Text style={styles.footerLink}>mentova-academy.com</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { paddingBottom: 60 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 30, paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 20, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center' },
  logoRow: { marginBottom: 16 },
  logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', maxWidth: 300 },
  contactCard: { marginHorizontal: 16, backgroundColor: '#111128', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)', marginBottom: 28 },
  contactTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  contactDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 20, marginBottom: 16 },
  emailBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7C3AED', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', marginBottom: 16 },
  emailBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  contactMeta: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  faqSection: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 16 },
  faqItem: { backgroundColor: '#111128', borderRadius: 12, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  faqQuestion: { fontSize: 14, fontWeight: '700', color: '#E5E7EB', flex: 1 },
  faqAnswer: { fontSize: 13, color: '#9CA3AF', lineHeight: 20, paddingLeft: 18, marginTop: 10 },
  legalSection: { paddingHorizontal: 16, marginBottom: 28 },
  legalCard: { backgroundColor: '#111128', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 12 },
  legalLink: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  legalLinkText: { fontSize: 14, color: '#E5E7EB', fontWeight: '500', flex: 1 },
  legalText: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginTop: 12 },
  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { fontSize: 12, color: '#4B5563' },
  footerLink: { fontSize: 12, color: '#7C3AED', marginTop: 4 },
});
