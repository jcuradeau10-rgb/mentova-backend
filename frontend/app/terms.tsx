import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: 'By downloading, installing, or using the Mentova application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App. Mentova reserves the right to modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms.'
  },
  {
    title: '2. Description of Service',
    content: 'Mentova is a mentor marketplace platform that connects users with verified professionals offering educational content, courses, and mentoring services related to cryptocurrency, trading, and financial markets. The App provides tools including but not limited to: market data visualization, portfolio tracking, educational courses, a community forum, and a marketplace for mentor-created content.'
  },
  {
    title: '3. User Accounts',
    content: 'You must create an account to access certain features of the App. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account. Mentova reserves the right to suspend or terminate accounts that violate these Terms.'
  },
  {
    title: '4. VIP Membership',
    content: 'Mentova offers a VIP membership subscription that provides access to premium features including the Academy, advanced tools, private community, and the mentor marketplace. VIP subscriptions are billed on a recurring basis (monthly or annually) through the Apple App Store. You can cancel your subscription at any time through your Apple ID settings. Cancellation takes effect at the end of the current billing period. No partial refunds are provided for unused portions of a billing period.'
  },
  {
    title: '5. Mentor Marketplace',
    content: 'Mentova hosts content created by independent mentors ("Mentors"). Mentors are verified professionals but operate independently. Mentova does not guarantee the accuracy, quality, or outcomes of any mentor-created content. Purchases made through the marketplace are subject to the refund policy outlined in Section 8. Mentova acts as an intermediary platform and is not responsible for the content or advice provided by Mentors.'
  },
  {
    title: '6. User Conduct',
    content: 'You agree not to: (a) use the App for any unlawful purpose; (b) post or transmit harmful, threatening, abusive, or hateful content; (c) impersonate any person or entity; (d) attempt to gain unauthorized access to the App or its systems; (e) use automated means to access the App without permission; (f) share your account credentials with third parties; (g) upload malicious software or content; (h) harass, bully, or intimidate other users. Violation of these rules may result in immediate account termination.'
  },
  {
    title: '7. Intellectual Property',
    content: 'All content on the App, including but not limited to text, graphics, logos, software, and educational materials, is the property of Mentova or its content creators and is protected by intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any content without express written permission. Mentor-created content remains the intellectual property of the respective Mentor, licensed to Mentova for distribution through the platform.'
  },
  {
    title: '8. Payments and Refunds',
    content: 'All payments are processed securely through Apple In-App Purchases or Stripe. Prices are displayed in your local currency. For VIP subscriptions, you may cancel at any time through your Apple ID settings. For marketplace purchases, refund requests must be submitted within 14 days of purchase to info@mentova-academy.com. Refunds are evaluated on a case-by-case basis. Digital content that has been fully accessed or downloaded may not be eligible for a refund.'
  },
  {
    title: '9. Disclaimer and Financial Risk',
    content: 'IMPORTANT: All content provided through Mentova, including courses, analyses, and mentor advice, is strictly for educational and informational purposes only. Nothing on this platform constitutes financial advice, investment advice, or trading advice. Cryptocurrency and financial markets involve significant risk, including the risk of total loss of capital. Past performance is not indicative of future results. You are solely responsible for your investment decisions. Mentova and its Mentors are not liable for any financial losses incurred as a result of using information obtained through the App.'
  },
  {
    title: '10. Limitation of Liability',
    content: 'To the maximum extent permitted by law, Mentova shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill. Mentova\'s total liability for any claim arising from or related to the App shall not exceed the amount you paid to Mentova in the 12 months preceding the claim. The App is provided "as is" and "as available" without warranties of any kind.'
  },
  {
    title: '11. Termination',
    content: 'Mentova may terminate or suspend your account and access to the App at any time, with or without cause, with or without notice. Upon termination, your right to use the App ceases immediately. Provisions that by their nature should survive termination shall remain in effect, including intellectual property rights, disclaimers, and limitations of liability.'
  },
  {
    title: '12. Governing Law',
    content: 'These Terms shall be governed by and construed in accordance with the laws of Canada. Any disputes arising from these Terms or your use of the App shall be resolved through binding arbitration in accordance with Canadian arbitration rules. You agree to waive any right to a jury trial or to participate in a class action.'
  },
  {
    title: '13. Contact',
    content: 'For any questions or concerns regarding these Terms of Service, please contact us at:\n\nEmail: info@mentova-academy.com\nWebsite: mentova-academy.com\n\nMentova Academy\n© 2026 All rights reserved.'
  },
];

export default function TermsOfService() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="terms-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Ionicons name="document-text" size={28} color="#7C3AED" />
          </View>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.subtitle}>Last updated: March 2026</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Please read these Terms of Service carefully before using the Mentova application. By using our service, you agree to be bound by these terms.
          </Text>
        </View>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section} data-testid={`terms-section-${i}`}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

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
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 20, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center' },
  logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#9CA3AF' },
  introCard: { marginHorizontal: 16, backgroundColor: '#111128', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: 'rgba(124,58,237,0.12)', marginBottom: 24 },
  introText: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#E5E7EB', marginBottom: 8 },
  sectionContent: { fontSize: 13, color: '#9CA3AF', lineHeight: 21 },
  footer: { alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', marginTop: 16, marginHorizontal: 16 },
  footerText: { fontSize: 12, color: '#4B5563' },
  footerLink: { fontSize: 12, color: '#7C3AED', marginTop: 4 },
});
