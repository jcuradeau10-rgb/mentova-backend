import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: 'We collect the following types of information:\n\n• Account Information: When you create an account, we collect your name, email address, and password (encrypted).\n\n• Profile Information: Optional information you provide such as your profile picture and bio.\n\n• Usage Data: We collect information about how you use the App, including pages visited, features used, and time spent on the App.\n\n• Device Information: We may collect device type, operating system, and unique device identifiers.\n\n• Payment Information: Payment processing is handled by Apple (In-App Purchases) and Stripe. We do not store your credit card information directly.'
  },
  {
    title: '2. How We Use Your Information',
    content: 'We use the collected information to:\n\n• Provide, maintain, and improve the App and its features\n• Process transactions and send related information\n• Send you technical notices, updates, and support messages\n• Respond to your comments, questions, and customer service requests\n• Monitor and analyze trends, usage, and activities\n• Detect, investigate, and prevent fraudulent transactions and abuse\n• Personalize your experience and deliver relevant content\n• Comply with legal obligations'
  },
  {
    title: '3. Information Sharing',
    content: 'We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:\n\n• With Mentors: When you purchase content or book sessions, relevant information is shared with the Mentor to fulfill the service.\n\n• Service Providers: We use third-party services (Stripe for payments, hosting providers) that may process your data on our behalf under strict confidentiality agreements.\n\n• Legal Requirements: We may disclose your information if required by law, court order, or governmental authority.\n\n• Business Transfers: In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.'
  },
  {
    title: '4. Data Security',
    content: 'We implement industry-standard security measures to protect your personal information, including:\n\n• Encryption of data in transit (TLS/SSL) and at rest\n• Secure password hashing using bcrypt\n• Regular security audits and monitoring\n• Access controls limiting data access to authorized personnel only\n• Secure token-based authentication (JWT)\n\nWhile we strive to protect your information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security.'
  },
  {
    title: '5. Data Retention',
    content: 'We retain your personal information for as long as your account is active or as needed to provide you services. If you request account deletion, we will delete your personal data within 30 days, except where we are required to retain certain information for legal or legitimate business purposes. Anonymized and aggregated data may be retained indefinitely for analytics purposes.'
  },
  {
    title: '6. Your Rights',
    content: 'Depending on your jurisdiction, you may have the following rights regarding your personal data:\n\n• Access: Request a copy of the personal data we hold about you.\n• Correction: Request correction of inaccurate or incomplete data.\n• Deletion: Request deletion of your personal data ("right to be forgotten").\n• Portability: Request a copy of your data in a structured, machine-readable format.\n• Objection: Object to the processing of your personal data for certain purposes.\n• Restriction: Request restriction of processing of your personal data.\n\nTo exercise any of these rights, please contact us at info@mentova-academy.com. We will respond to your request within 30 days.'
  },
  {
    title: '7. Cookies and Tracking',
    content: 'The App may use local storage and similar technologies to enhance your experience. These are used to:\n\n• Remember your language preferences\n• Maintain your login session\n• Store app settings and preferences\n\nWe do not use third-party tracking cookies for advertising purposes. Analytics data is collected in an anonymized form to improve the App.'
  },
  {
    title: '8. Third-Party Services',
    content: 'The App may integrate with or link to third-party services. These include:\n\n• Apple App Store (for subscriptions and payments)\n• Stripe (for payment processing)\n• CoinGecko (for cryptocurrency market data)\n\nThese third-party services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of third-party services.'
  },
  {
    title: '9. Children\'s Privacy',
    content: 'The App is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal data from a child under 18, we will take steps to delete that information promptly. If you believe that a child has provided us with personal information, please contact us at info@mentova-academy.com.'
  },
  {
    title: '10. International Data Transfers',
    content: 'Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. When we transfer your data internationally, we ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy and applicable data protection laws.'
  },
  {
    title: '11. Changes to This Policy',
    content: 'We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically for any changes. Your continued use of the App after changes are posted constitutes your acceptance of the updated Privacy Policy.'
  },
  {
    title: '12. Contact Us',
    content: 'If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:\n\nEmail: info@mentova-academy.com\nWebsite: mentova-academy.com\n\nMentova Academy\n© 2026 All rights reserved.\n\nWe are committed to resolving any privacy concerns promptly and transparently.'
  },
];

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="privacy-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={28} color="#10B981" />
          </View>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.subtitle}>Last updated: March 2026</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            At Mentova, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
          </Text>
        </View>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section} data-testid={`privacy-section-${i}`}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/terms')} data-testid="privacy-terms-link">
            <Text style={styles.footerLink}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/support')} data-testid="privacy-support-link">
            <Text style={styles.footerLink}>Support Center</Text>
          </TouchableOpacity>
          <Text style={styles.footerText}>&copy; 2026 Mentova Academy — mentova-academy.com</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { paddingBottom: 60 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 20, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center' },
  logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#9CA3AF' },
  introCard: { marginHorizontal: 16, backgroundColor: '#111128', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: 'rgba(16,185,129,0.12)', marginBottom: 24 },
  introText: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#E5E7EB', marginBottom: 8 },
  sectionContent: { fontSize: 13, color: '#9CA3AF', lineHeight: 21 },
  footer: { alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', marginTop: 16, marginHorizontal: 16, gap: 10 },
  footerLink: { fontSize: 13, color: '#7C3AED', fontWeight: '500' },
  footerText: { fontSize: 12, color: '#4B5563', marginTop: 4 },
});
