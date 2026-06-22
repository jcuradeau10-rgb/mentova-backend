import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../store/languageStore';
import { LANGUAGES } from '../i18n/translations';

export default function LanguageSelector() {
  const { language, setLanguage } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const currentLang = LANGUAGES.find(l => l.code === language);

  useEffect(() => {
    if (showModal) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [showModal]);

  const handleSelectLanguage = async (code: string) => {
    await setLanguage(code as any);
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
        data-testid="language-selector-btn"
      >
        <Ionicons name="globe-outline" size={18} color="#7C3AED" />
        <Text style={styles.triggerText}>{language.toUpperCase()}</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <Animated.View style={[styles.dropdown, { opacity: fadeAnim }]}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.option,
                  language === lang.code && styles.optionActive,
                ]}
                onPress={() => handleSelectLanguage(lang.code)}
                data-testid={`language-option-${lang.code}`}
              >
                <Text style={styles.flag}>{lang.flag}</Text>
                <Text style={[
                  styles.optionText,
                  language === lang.code && styles.optionTextActive,
                ]}>
                  {lang.nativeName}
                </Text>
                {language === lang.code && (
                  <Ionicons name="checkmark" size={16} color="#7C3AED" />
                )}
              </TouchableOpacity>
            ))}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  triggerText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 70,
    paddingRight: 16,
  },
  dropdown: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A4E',
    overflow: 'hidden',
    minWidth: 180,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4E',
  },
  optionActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  flag: {
    fontSize: 18,
  },
  optionText: {
    color: '#C0C0D0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  optionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
});
