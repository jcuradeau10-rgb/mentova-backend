import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useTranslation } from '../../store/languageStore';
import InstallPWAPrompt from '../../components/InstallPWAPrompt';

// Custom tab label component that re-renders when language changes
function TranslatedTabLabel({ labelKey, focused }: { labelKey: string; focused: boolean }) {
  const { t } = useTranslation();
  return (
    <Text style={[
      styles.tabBarLabel,
      { color: focused ? '#7C3AED' : '#5A5A6E' }
    ]}>
      {t(labelKey)}
    </Text>
  );
}

export default function TabLayout() {
  const { t, language, isLoaded } = useTranslation();

  if (!isLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', opacity: 0.5 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InstallPWAPrompt />
      <View style={styles.desktopWrapper}>
      <Tabs
        key={`tabs-${language}`}
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#5A5A6E',
          tabBarItemStyle: styles.tabBarItem,
          tabBarShowLabel: true,
        }}
      >
        {/* ── 1. ACCUEIL ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: t('nav.home'),
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t('nav.home')}</Text>
            ),
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={focused ? '#FFF' : '#5A5A6E'} />
              </View>
            ),
          }}
        />

        {/* ── 2. ATLAS AI ── */}
        <Tabs.Screen
          name="learn"
          options={{
            title: 'Atlas',
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>Atlas</Text>
            ),
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'planet' : 'planet-outline'} size={22} color={focused ? '#FFF' : '#5A5A6E'} />
              </View>
            ),
          }}
        />

        {/* ── 3. MARCHÉ ── */}
        <Tabs.Screen
          name="market"
          options={{
            title: t('nav.market'),
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t('nav.market')}</Text>
            ),
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={22} color={focused ? '#FFF' : '#5A5A6E'} />
              </View>
            ),
          }}
        />

        {/* ── 4. NEWS ── */}
        <Tabs.Screen
          name="news"
          options={{
            title: t('nav.news'),
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t('nav.news')}</Text>
            ),
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={22} color={focused ? '#FFF' : '#5A5A6E'} />
              </View>
            ),
          }}
        />

        {/* ── 5. PROFIL ── */}
        <Tabs.Screen
          name="profile"
          options={{
            title: t('nav.profile'),
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t('nav.profile')}</Text>
            ),
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={focused ? '#FFF' : '#5A5A6E'} />
              </View>
            ),
          }}
        />

        {/* ── HIDDEN TABS (code kept, not visible in tab bar) ── */}
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="ai" options={{ href: null }} />
        <Tabs.Screen name="mentors" options={{ href: null }} />
      </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#06060F',
    ...(Platform.OS === 'web' ? { alignItems: 'center' } : {}),
  },
  desktopWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    ...(Platform.OS === 'web' ? { 
      borderLeftWidth: 1, 
      borderRightWidth: 1, 
      borderColor: 'rgba(124, 58, 237, 0.08)',
    } : {}),
  },
  tabBar: {
    backgroundColor: '#06060F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.08)',
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
    paddingHorizontal: 8,
    elevation: 0,
  },
  tabBarItem: {
    paddingTop: 4,
    paddingBottom: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4A4A5E',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#C4B5FD',
    fontWeight: '700',
  },
  tabIconWrap: {
    width: 40,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4A4A5E',
    marginTop: 2,
  },
});
