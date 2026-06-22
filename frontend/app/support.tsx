import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const FAQ_ITEMS = [
  {
    q: "What is Mentova?",
    a: "Mentova is a premium mentor marketplace connecting certified trading professionals with learners. VIP members get access to exclusive courses, real-time tools, a private community, and curated content from verified mentors."
  },
  {
    q: "How do I become a VIP member?",
    a: "Go to the VIP section in the app and subscribe. VIP unlocks the academy, advanced crypto tools, the private community, the mentor marketplace, and much more."
  },
  {
    q: "How do I contact a mentor?",
    a: "Browse the Marketplace, select an offer, and purchase it. You can also book live sessions or send direct messages to mentors through the app."
  },
  {
    q: "Can I become a mentor on Mentova?",
    a: "Yes! If you have at least 2 years of verifiable trading experience, you can apply through the 'Become a Mentor' section. Our team reviews every application to maintain quality."
  },
  {
    q: "How do payments work?",
    a: "All payments are processed securely through Stripe. Mentors receive payouts directly to their connected Stripe account after a standard processing period."
  },
  {
    q: "Can I get a refund?",
    a: "Refund policies depend on the type of purchase. For subscription issues, contact us at info@mentova-academy.com and we'll assist you promptly."
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use industry-standard encryption and security practices. Your personal data is never shared with third parties without your explicit consent."
  },
];

export default function SupportPage() {
  const router = useRouter();

  const handleEmail = () => {
    if (Platform.OS === 'web') {
      window.open('mailto:info@mentova-academy.com', '_blank');
    } else {
      Linking.openURL('mailto:info@mentova-academy.com');
    }
  };

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
          <Text style={styles.title}>Support Center</Text>
          <Text style={styles.subtitle}>We're here to help you get the most out of Mentova</Text>
        </View>

        {/* Contact Card */}
        <View style={styles.contactCard} data-testid="support-contact-card">
          <Text style={styles.contactTitle}>Contact Us</Text>
          <Text style={styles.contactDesc}>
            Have a question, feedback, or need help? Reach out to our team and we'll get back to you within 24 hours.
          </Text>
          <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} data-testid="support-email-btn">
            <Ionicons name="mail" size={18} color="#fff" />
            <Text style={styles.emailBtnText}>info@mentova-academy.com</Text>
          </TouchableOpacity>
          <View style={styles.contactMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#9CA3AF" />
              <Text style={styles.metaText}>Response within 24h</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="globe-outline" size={14} color="#9CA3AF" />
              <Text style={styles.metaText}>FR / EN / ES</Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection} data-testid="support-faq-section">
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {FAQ_ITEMS.map((item, i) => (
            <View key={i} style={styles.faqItem} data-testid={`faq-item-${i}`}>
              <View style={styles.faqQ}>
                <View style={styles.qDot} />
                <Text style={styles.faqQuestion}>{item.q}</Text>
              </View>
              <Text style={styles.faqAnswer}>{item.a}</Text>
            </View>
          ))}
        </View>

        {/* Legal */}
        <View style={styles.legalSection}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.legalCard}>
            <TouchableOpacity onPress={() => router.push('/terms')} style={styles.legalLink} data-testid="support-terms-link">
              <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
              <Text style={styles.legalLinkText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color="#4B5563" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/privacy')} style={styles.legalLink} data-testid="support-privacy-link">
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color="#4B5563" />
            </TouchableOpacity>
            <Text style={styles.legalText}>
              All mentor content is provided for educational purposes only and does not constitute financial advice.
              Trading cryptocurrencies involves significant risk. Past performance is not indicative of future results.
            </Text>
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
  faqQ: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  qDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED', marginTop: 5 },
  faqQuestion: { fontSize: 14, fontWeight: '700', color: '#E5E7EB', flex: 1 },
  faqAnswer: { fontSize: 13, color: '#9CA3AF', lineHeight: 20, paddingLeft: 18 },
  legalSection: { paddingHorizontal: 16, marginBottom: 28 },
  legalCard: { backgroundColor: '#111128', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 12 },
  legalLink: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  legalLinkText: { fontSize: 14, color: '#E5E7EB', fontWeight: '500', flex: 1 },
  legalText: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginTop: 12 },
  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { fontSize: 12, color: '#4B5563' },
  footerLink: { fontSize: 12, color: '#7C3AED', marginTop: 4 },
});
