import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mentova_pwa_install_dismissed';

function isIOSDevice() {
  if (Platform.OS !== 'web') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /iPhone|iPad|iPod/i.test(ua);
}

function isAndroidDevice() {
  if (Platform.OS !== 'web') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /Android/i.test(ua);
}

function isStandalone() {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return true;
  return (window as any).matchMedia?.('(display-mode: standalone)')?.matches
    || (window.navigator as any)?.standalone === true;
}

export default function InstallPWAPrompt() {
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const isIOS = isIOSDevice();
  const isAndroid = isAndroidDevice();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isStandalone()) return;

    const checkDismissed = async () => {
      const dismissed = await AsyncStorage.getItem(STORAGE_KEY);
      if (dismissed === 'permanent') return;
      setTimeout(() => {
        setVisible(true);
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
          Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 2500);
    };
    checkDismissed();
  }, []);

  const dismiss = async () => {
    if (dontShow) {
      await AsyncStorage.setItem(STORAGE_KEY, 'permanent');
    }
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <View style={styles.overlay} data-testid="pwa-install-prompt">
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.appIcon}>
            <Text style={styles.appIconText}>M</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Installer Mentova</Text>
            <Text style={styles.subtitle}>Pour une meilleure experience</Text>
          </View>
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn} data-testid="pwa-prompt-close">
            <Ionicons name="close" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Benefits */}
        <View style={styles.benefits}>
          <View style={styles.benefitRow}>
            <Ionicons name="flash" size={18} color="#7C3AED" />
            <Text style={styles.benefitText}>Acces rapide depuis l'ecran d'accueil</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="notifications" size={18} color="#00D9A5" />
            <Text style={styles.benefitText}>Notifications en temps reel</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="phone-portrait" size={18} color="#06B6D4" />
            <Text style={styles.benefitText}>Experience plein ecran comme une app native</Text>
          </View>
        </View>

        {/* Platform-specific instructions */}
        {isIOS ? (
          <View style={styles.steps}>
            <Text style={styles.stepsTitle}>Comment installer :</Text>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>
                Appuyez sur <Ionicons name="share-outline" size={16} color="#007AFF" /> <Text style={styles.bold}>Partager</Text> en bas de Safari
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>
                Selectionnez <Ionicons name="add-outline" size={16} color="#007AFF" /> <Text style={styles.bold}>Sur l'ecran d'accueil</Text>
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepText}>
                Appuyez <Text style={styles.bold}>Ajouter</Text> en haut a droite
              </Text>
            </View>
          </View>
        ) : isAndroid ? (
          <View style={styles.steps}>
            <Text style={styles.stepsTitle}>Comment installer :</Text>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>
                Appuyez sur <Ionicons name="ellipsis-vertical" size={16} color="#888" /> <Text style={styles.bold}>Menu</Text> en haut de Chrome
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>
                Selectionnez <Text style={styles.bold}>Ajouter a l'ecran d'accueil</Text>
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepText}>
                Confirmez en appuyant <Text style={styles.bold}>Installer</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.steps}>
            <Text style={styles.stepsTitle}>Comment installer :</Text>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>
                Ouvrez le <Text style={styles.bold}>menu</Text> de votre navigateur
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>
                Selectionnez <Text style={styles.bold}>Ajouter a l'ecran d'accueil</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Upcoming app store note */}
        <View style={styles.appStoreNote}>
          <Ionicons name="logo-apple" size={16} color="#888" />
          <Ionicons name="logo-google-playstore" size={16} color="#888" style={{ marginLeft: 6 }} />
          <Text style={styles.appStoreText}>App Store & Google Play bientot disponible</Text>
        </View>

        {/* Don't show again checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setDontShow(!dontShow)}
          activeOpacity={0.7}
          data-testid="pwa-prompt-dont-show"
        >
          <View style={[styles.checkbox, dontShow && styles.checkboxChecked]}>
            {dontShow && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
          <Text style={styles.checkboxLabel}>Ne plus afficher</Text>
        </TouchableOpacity>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} onPress={dismiss} activeOpacity={0.8} data-testid="pwa-prompt-ok">
          <Text style={styles.ctaText}>J'ai compris !</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    fontFamily: Platform.OS === 'web' ? "'Unbounded', cursive" : undefined,
  },
  headerText: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  benefits: {
    backgroundColor: '#12121F',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#CCC',
    flex: 1,
  },
  steps: {
    marginBottom: 16,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#AAA',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#7C3AED20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  stepText: {
    fontSize: 14,
    color: '#CCC',
    flex: 1,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#FFF',
  },
  appStoreNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 12,
    gap: 4,
  },
  appStoreText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#888',
  },
  ctaBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
