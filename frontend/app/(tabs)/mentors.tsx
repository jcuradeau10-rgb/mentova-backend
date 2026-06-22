import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../store/languageStore';

export default function MentorsScreen() {
  const { t } = useTranslation();

  const openMentorApplication = () => {
    const url = 'https://mentova-academy.com/fr/mentors';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const features = [
    { icon: 'school-outline', title: t('mentors.feat1_title'), desc: t('mentors.feat1_desc') },
    { icon: 'videocam-outline', title: t('mentors.feat2_title'), desc: t('mentors.feat2_desc') },
    { icon: 'cash-outline', title: t('mentors.feat3_title'), desc: t('mentors.feat3_desc') },
    { icon: 'shield-checkmark-outline', title: t('mentors.feat4_title'), desc: t('mentors.feat4_desc') },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={s.iconWrap}>
            <LinearGradient colors={['#7C3AED', '#A855F7']} style={s.iconBg}>
              <Ionicons name="people" size={40} color="#FFF" />
            </LinearGradient>
          </View>
          <Text style={s.title}>{t('mentors.title')}</Text>
          <View style={s.badge}>
            <Ionicons name="time-outline" size={14} color="#F59E0B" />
            <Text style={s.badgeText}>{t('mentors.badge')}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{t('mentors.recruiting')}</Text>
          <Text style={s.cardDesc}>{t('mentors.recruiting_desc')}</Text>
          <View style={s.features}>
            {features.map((item, i) => (
              <View key={i} style={s.feature}>
                <View style={s.featureIcon}>
                  <Ionicons name={item.icon as any} size={20} color="#A855F7" />
                </View>
                <View style={s.featureText}>
                  <Text style={s.featureTitle}>{item.title}</Text>
                  <Text style={s.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.ctaWrap} onPress={openMentorApplication} activeOpacity={0.85} data-testid="apply-mentor-btn">
          <LinearGradient colors={['#7C3AED', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Ionicons name="rocket-outline" size={20} color="#FFF" />
            <Text style={s.ctaText}>{t('mentors.apply')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={s.infoCard}>
          <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
          <Text style={s.infoText}>{t('mentors.launch_note')}</Text>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#06060F' },
  scroll: { flex: 1 },
  content: { padding: 20, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 20 },
  iconWrap: { marginBottom: 16 },
  iconBg: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },
  card: { width: '100%', backgroundColor: 'rgba(124,58,237,0.06)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)', borderRadius: 20, padding: 24, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  cardDesc: { fontSize: 14, color: '#9CA3AF', lineHeight: 22, marginBottom: 20 },
  features: { gap: 16 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.1)', alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  featureDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  ctaWrap: { width: '100%', marginBottom: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  infoCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: 16 },
  infoText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
});
