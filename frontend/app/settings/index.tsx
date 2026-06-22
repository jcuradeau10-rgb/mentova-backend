import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { LANGUAGES } from '../../i18n/translations';
import api from '../../utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();

  // Modal states
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Profile edit form
  const [editName, setEditName] = useState(user?.name || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Notification & privacy settings
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // 2FA states
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [show2FADisableModal, setShow2FADisableModal] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{ qr_code: string; secret: string; backup_codes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [notifications, setNotifications] = useState({
    new_message: true,
    new_booking: true,
    booking_confirmed: true,
    new_review: true,
    community_reply: true,
    price_alerts: true,
    promotions: false,
  });
  const [privacy, setPrivacy] = useState({
    profile_public: true,
    show_activity: true,
    show_portfolio: false,
  });

  // Load user settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('/users/me/settings');
        if (res.data?.data) {
          if (res.data.data.notifications) setNotifications(res.data.data.notifications);
          if (res.data.data.privacy) setPrivacy(res.data.data.privacy);
        }
      } catch {}
      try {
        const res2fa = await api.get('/auth/2fa/status');
        if (res2fa.data) {
          setTwoFAEnabled(res2fa.data.enabled || false);
          setBiometricEnabled(res2fa.data.biometric_enabled || false);
        }
      } catch {}
    };
    loadSettings();
  }, []);

  const handle2FASetup = async () => {
    setTwoFALoading(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      setSetupData(res.data);
      setShow2FAModal(true);
    } catch (e: any) {
      Alert.alert(t('settings.error'), e.response?.data?.detail || 'Error setting up 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handle2FAVerify = async () => {
    if (verifyCode.length !== 6) return;
    setTwoFALoading(true);
    try {
      const res = await api.post('/auth/2fa/verify-setup', { code: verifyCode });
      setTwoFAEnabled(true);
      setBackupCodes(res.data.backup_codes || []);
      setShowBackupCodes(true);
      setShow2FAModal(false);
      setSetupData(null);
      setVerifyCode('');
    } catch (e: any) {
      Alert.alert(t('settings.error'), e.response?.data?.detail || 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handle2FADisable = async () => {
    setTwoFALoading(true);
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword });
      setTwoFAEnabled(false);
      setShow2FADisableModal(false);
      setDisablePassword('');
      Alert.alert(t('settings.success') || 'Success', t('settings.2faDisabled') || '2FA disabled');
    } catch (e: any) {
      Alert.alert(t('settings.error'), e.response?.data?.detail || 'Invalid password');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', t('settings.biometricMobileOnly') || 'Biometric authentication is only available on mobile devices');
      return;
    }
    try {
      await api.post('/auth/biometric/toggle', { enabled: value });
      setBiometricEnabled(value);
    } catch {
      Alert.alert(t('settings.error'), t('settings.saveError'));
    }
  };

  const saveNotifications = async (newNotifs: typeof notifications) => {
    setNotifications(newNotifs);
    try {
      await api.put('/users/me/settings', { notifications: newNotifs });
    } catch {
      Alert.alert(t('settings.error'), t('settings.saveError'));
    }
  };

  const savePrivacy = async (newPrivacy: typeof privacy) => {
    setPrivacy(newPrivacy);
    try {
      await api.put('/users/me/settings', { privacy: newPrivacy });
    } catch {
      Alert.alert(t('settings.error'), t('settings.saveError'));
    }
  };

  const handleDownloadData = async () => {
    try {
      setSettingsLoading(true);
      const res = await api.get('/users/me/export');
      if (res.data?.data) {
        const dataStr = JSON.stringify(res.data.data, null, 2);
        if (Platform.OS === 'web') {
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mentova_data_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          Alert.alert(t('settings.success'), t('settings.dataExported'));
        } else {
          Alert.alert(t('settings.success'), t('settings.dataExported'));
        }
      }
    } catch {
      Alert.alert(t('settings.error'), t('settings.exportError'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('settings.error'), t('settings.fillAllFields'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('settings.error'), t('settings.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('settings.error'), t('settings.passwordMismatch'));
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      Alert.alert(t('settings.success'), t('settings.passwordChanged'));
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert(t('settings.error'), error.response?.data?.detail || t('settings.passwordChangeError'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert(t('settings.error'), t('settings.nameEmpty'));
      return;
    }

    setProfileLoading(true);
    try {
      await api.put('/users/me/profile', { name: editName.trim() });
      Alert.alert(t('settings.success'), t('settings.profileUpdated'));
      setShowProfileModal(false);
    } catch (error: any) {
      Alert.alert(t('settings.error'), error.response?.data?.detail || t('settings.profileUpdateError'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/users/me');
              await logout();
              router.replace('/');
            } catch (error) {
              Alert.alert(t('settings.error'), t('settings.deleteError'));
            }
          },
        },
      ]
    );
  };

  const SettingsItem = ({ icon, iconColor, title, subtitle, onPress, rightElement, danger = false }: any) => (
    <TouchableOpacity
      style={[styles.settingsItem, danger && styles.settingsItemDanger]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingsIcon, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.settingsContent}>
        <Text style={[styles.settingsTitle, danger && styles.settingsTitleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.header')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <SectionHeader title={t('settings.sectionProfile')} />
        <View style={styles.section}>
          <SettingsItem
            icon="person"
            iconColor="#7C3AED"
            title={t('settings.editProfile')}
            subtitle={user?.name || t('settings.notSet')}
            onPress={() => {
              setEditName(user?.name || '');
              setShowProfileModal(true);
            }}
          />
          <SettingsItem
            icon="mail"
            iconColor="#3B82F6"
            title={t('settings.email')}
            subtitle={user?.email}
            onPress={() => Alert.alert('Info', t('settings.emailLocked'))}
            rightElement={<Ionicons name="lock-closed" size={18} color="#5A5A6E" />}
          />
        </View>

        {/* Security Section */}
        <SectionHeader title={t('settings.sectionSecurity')} />
        <View style={styles.section}>
          <SettingsItem
            icon="key"
            iconColor="#F59E0B"
            title={t('settings.changePassword')}
            subtitle={t('settings.lastModified')}
            onPress={() => setShowPasswordModal(true)}
          />
          <SettingsItem
            icon="shield-checkmark"
            iconColor="#10B981"
            title={t('settings.2fa')}
            subtitle={twoFAEnabled ? t('settings.enabled') || 'Enabled' : t('settings.notEnabled')}
            onPress={() => twoFAEnabled ? setShow2FADisableModal(true) : handle2FASetup()}
            data-testid="2fa-settings-btn"
          />
          <SettingsItem
            icon="finger-print"
            iconColor="#EC4899"
            title={t('settings.biometric')}
            subtitle={Platform.OS === 'web' ? (t('settings.mobileOnly') || 'Mobile only') : (biometricEnabled ? t('settings.enabled') || 'Enabled' : t('settings.notEnabled'))}
            onPress={() => handleBiometricToggle(!biometricEnabled)}
            data-testid="biometric-settings-btn"
          />
        </View>

        {/* Preferences Section */}
        <SectionHeader title={t('settings.sectionPreferences')} />
        <View style={styles.section}>
          <SettingsItem
            icon="globe"
            iconColor="#06B6D4"
            title={t('settings.language')}
            subtitle={LANGUAGES.find(l => l.code === language)?.nativeName || 'Français'}
            onPress={() => setShowLanguageModal(true)}
          />
          <SettingsItem
            icon="notifications"
            iconColor="#8B5CF6"
            title={t('settings.notifications')}
            subtitle={t('settings.notifSubtitle')}
            onPress={() => setShowNotificationsModal(true)}
          />
          <SettingsItem
            icon="moon"
            iconColor="#6366F1"
            title={t('settings.theme')}
            subtitle={t('settings.themeSubtitle')}
            onPress={() => Alert.alert('Info', t('settings.themeInfo'))}
          />
        </View>

        {/* Privacy Section */}
        <SectionHeader title={t('settings.sectionPrivacy')} />
        <View style={styles.section}>
          <SettingsItem
            icon="eye-off"
            iconColor="#64748B"
            title={t('settings.profilePrivacy')}
            subtitle={privacy.profile_public ? t('settings.public') : t('settings.private')}
            onPress={() => setShowPrivacyModal(true)}
          />
          <SettingsItem
            icon="download"
            iconColor="#0EA5E9"
            title={t('settings.downloadData')}
            subtitle={t('settings.downloadDataSub')}
            onPress={handleDownloadData}
          />
        </View>

        {/* Danger Zone */}
        <SectionHeader title={t('settings.dangerZone')} />
        <View style={styles.section}>
          <SettingsItem
            icon="trash"
            iconColor="#EF4444"
            title={t('settings.deleteAccount')}
            subtitle={t('settings.deleteIrreversible')}
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        {/* Legal */}
        <SectionHeader title={t('settings.legal') || 'Legal'} />
        <View style={styles.section}>
          <SettingsItem
            icon="document-text"
            iconColor="#7C3AED"
            title={t('register.terms')}
            subtitle={t('settings.termsSubtitle') || 'Read our terms of service'}
            onPress={() => router.push('/terms')}
          />
          <SettingsItem
            icon="shield-checkmark"
            iconColor="#10B981"
            title={t('register.privacy')}
            subtitle={t('settings.privacySubtitle') || 'How we protect your data'}
            onPress={() => router.push('/privacy')}
          />
          <SettingsItem
            icon="headset"
            iconColor="#0EA5E9"
            title={t('settings.support') || 'Support'}
            subtitle={t('settings.supportSubtitle') || 'FAQ & contact us'}
            onPress={() => router.push('/support')}
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Mentova v1.0.0</Text>
          <Text style={styles.appCopyright}>{t("settings.copyright")}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={showLanguageModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.chooseLanguage')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.languageItem, language === lang.code && styles.languageItemActive]}
                  onPress={() => {
                    setLanguage(lang.code);
                    setShowLanguageModal(false);
                  }}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <View style={styles.languageInfo}>
                    <Text style={[styles.languageName, language === lang.code && styles.languageNameActive]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={styles.languageNameEn}>{lang.name}</Text>
                  </View>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={24} color="#7C3AED" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.passwordModalTitle')}</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Current Password */}
              <Text style={styles.inputLabel}>{t('settings.currentPassword')}</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  secureTextEntry={!showCurrentPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#5A5A6E"
                  />
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <Text style={styles.inputLabel}>{t('settings.newPassword')}</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('settings.newPasswordPlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#5A5A6E"
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <Text style={styles.inputLabel}>{t('settings.confirmPassword')}</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('settings.confirmPasswordPlaceholder')}
                  placeholderTextColor="#5A5A6E"
                  secureTextEntry={!showNewPassword}
                />
              </View>

              {/* Password strength hints */}
              <View style={styles.passwordHints}>
                <View style={styles.hintItem}>
                  <Ionicons
                    name={newPassword.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={newPassword.length >= 6 ? '#10B981' : '#5A5A6E'}
                  />
                  <Text style={[styles.hintText, newPassword.length >= 6 && styles.hintTextValid]}>
                    {t('settings.min6chars')}
                  </Text>
                </View>
                <View style={styles.hintItem}>
                  <Ionicons
                    name={newPassword === confirmPassword && newPassword.length > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={newPassword === confirmPassword && newPassword.length > 0 ? '#10B981' : '#5A5A6E'}
                  />
                  <Text style={[styles.hintText, newPassword === confirmPassword && newPassword.length > 0 && styles.hintTextValid]}>
                    {t('settings.passwordsMatch')}
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, passwordLoading && styles.submitButtonDisabled]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="key" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>{t("settings.changePassword")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.editProfile')}</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Avatar Preview */}
              <View style={styles.avatarPreview}>
                <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{editName.charAt(0)?.toUpperCase() || 'U'}</Text>
                </LinearGradient>
                <TouchableOpacity style={styles.changeAvatarBtn}>
                  <Ionicons name="camera" size={16} color="#7C3AED" />
                  <Text style={styles.changeAvatarText}>{t('settings.changePhoto')}</Text>
                </TouchableOpacity>
              </View>

              {/* Name Input */}
              <Text style={styles.inputLabel}>{t('settings.fullName')}</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('settings.yourName')}
                placeholderTextColor="#5A5A6E"
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, profileLoading && styles.submitButtonDisabled]}
                onPress={handleUpdateProfile}
                disabled={profileLoading}
              >
                {profileLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>{t('settings.save')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotificationsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.notifications')}</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {[
                { key: 'new_message', icon: 'chatbubble', label: t('settings.notifNewMessage') },
                { key: 'new_booking', icon: 'calendar', label: t('settings.notifNewBooking') },
                { key: 'booking_confirmed', icon: 'checkmark-circle', label: t('settings.notifBookingConfirmed') },
                { key: 'new_review', icon: 'star', label: t('settings.notifNewReview') },
                { key: 'community_reply', icon: 'people', label: t('settings.notifCommunityReply') },
                { key: 'price_alerts', icon: 'notifications', label: t('settings.notifPriceAlerts') },
                { key: 'promotions', icon: 'megaphone', label: t('settings.notifPromotions') },
              ].map((item) => (
                <View key={item.key} style={styles.notifRow} data-testid={`notif-toggle-${item.key}`}>
                  <View style={styles.notifInfo}>
                    <Ionicons name={item.icon as any} size={20} color="#7C3AED" />
                    <Text style={styles.notifLabel}>{item.label}</Text>
                  </View>
                  <Switch
                    value={(notifications as any)[item.key]}
                    onValueChange={(val) => {
                      const updated = { ...notifications, [item.key]: val };
                      saveNotifications(updated);
                    }}
                    trackColor={{ false: '#2A2A3E', true: '#7C3AED' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.profilePrivacy')}</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {[
                { key: 'profile_public', icon: 'eye', label: t('settings.privacyProfilePublic') },
                { key: 'show_activity', icon: 'pulse', label: t('settings.privacyShowActivity') },
                { key: 'show_portfolio', icon: 'wallet', label: t('settings.privacyShowPortfolio') },
              ].map((item) => (
                <View key={item.key} style={styles.notifRow} data-testid={`privacy-toggle-${item.key}`}>
                  <View style={styles.notifInfo}>
                    <Ionicons name={item.icon as any} size={20} color="#64748B" />
                    <Text style={styles.notifLabel}>{item.label}</Text>
                  </View>
                  <Switch
                    value={(privacy as any)[item.key]}
                    onValueChange={(val) => {
                      const updated = { ...privacy, [item.key]: val };
                      savePrivacy(updated);
                    }}
                    trackColor={{ false: '#2A2A3E', true: '#7C3AED' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 2FA Setup Modal */}
      <Modal visible={show2FAModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShow2FAModal(false); setSetupData(null); setVerifyCode(''); }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('settings.setup2fa') || 'Setup 2FA'}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ alignItems: 'center' }}>
              {setupData && (
                <>
                  <Text style={styles.modalSubtext}>{t('settings.scan2faQR') || 'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)'}</Text>
                  {Platform.OS === 'web' && setupData.qr_code ? (
                    <img src={setupData.qr_code} style={{ width: 200, height: 200, borderRadius: 12, margin: 16 }} />
                  ) : (
                    <View style={{ width: 200, height: 200, backgroundColor: '#2A2A3E', borderRadius: 12, justifyContent: 'center', alignItems: 'center', margin: 16 }}>
                      <Ionicons name="qr-code" size={80} color="#8B8B9E" />
                    </View>
                  )}
                  <Text style={styles.modalSubtext}>{t('settings.orEnterManually') || 'Or enter this key manually:'}</Text>
                  <View style={styles.secretKeyBox}>
                    <Text style={styles.secretKeyText} selectable>{setupData.secret}</Text>
                  </View>
                  <Text style={[styles.modalSubtext, { marginTop: 24 }]}>{t('settings.enter6digitCode') || 'Enter the 6-digit code from your app:'}</Text>
                  <TextInput
                    style={styles.totpInput}
                    value={verifyCode}
                    onChangeText={setVerifyCode}
                    placeholder="000000"
                    placeholderTextColor="#4B5563"
                    keyboardType="number-pad"
                    maxLength={6}
                    data-testid="2fa-setup-code-input"
                  />
                  <TouchableOpacity
                    style={[styles.modalBtn, verifyCode.length !== 6 && { opacity: 0.5 }]}
                    onPress={handle2FAVerify}
                    disabled={verifyCode.length !== 6 || twoFALoading}
                    data-testid="2fa-verify-btn"
                  >
                    {twoFALoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalBtnText}>{t('settings.activate2fa') || 'Activate 2FA'}</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 2FA Disable Modal */}
      <Modal visible={show2FADisableModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShow2FADisableModal(false); setDisablePassword(''); }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('settings.disable2fa') || 'Disable 2FA'}</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtext}>{t('settings.confirmPasswordToDisable') || 'Enter your password to disable 2FA'}</Text>
              <TextInput
                style={styles.totpInput}
                value={disablePassword}
                onChangeText={setDisablePassword}
                placeholder={t('auth.password') || 'Password'}
                placeholderTextColor="#4B5563"
                secureTextEntry
                data-testid="2fa-disable-password"
              />
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#EF4444' }, !disablePassword && { opacity: 0.5 }]}
                onPress={handle2FADisable}
                disabled={!disablePassword || twoFALoading}
                data-testid="2fa-disable-btn"
              >
                {twoFALoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalBtnText}>{t('settings.disable2fa') || 'Disable 2FA'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Backup Codes Modal */}
      <Modal visible={showBackupCodes} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ width: 24 }} />
              <Text style={styles.modalTitle}>{t('settings.backupCodes') || 'Backup Codes'}</Text>
              <TouchableOpacity onPress={() => { setShowBackupCodes(false); setBackupCodes([]); }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Ionicons name="shield-checkmark" size={48} color="#10B981" style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={[styles.modalSubtext, { color: '#10B981', fontWeight: '700', fontSize: 16, textAlign: 'center' }]}>
                {t('settings.2faActivated') || '2FA Successfully Activated!'}
              </Text>
              <Text style={[styles.modalSubtext, { textAlign: 'center', marginBottom: 16 }]}>
                {t('settings.saveBackupCodes') || 'Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator.'}
              </Text>
              <View style={styles.backupCodesGrid}>
                {backupCodes.map((code, i) => (
                  <View key={i} style={styles.backupCodeItem}>
                    <Text style={styles.backupCodeText} selectable>{code}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => { setShowBackupCodes(false); setBackupCodes([]); }}
                data-testid="backup-codes-done-btn"
              >
                <Text style={styles.modalBtnText}>{t('common.done') || 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B8B9E',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  section: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4E',
  },
  settingsItemDanger: {
    borderBottomWidth: 0,
  },
  settingsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsContent: {
    flex: 1,
    marginLeft: 14,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsTitleDanger: {
    color: '#EF4444',
  },
  settingsSubtitle: {
    fontSize: 12,
    color: '#8B8B9E',
    marginTop: 2,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
  },
  appVersion: {
    fontSize: 14,
    color: '#5A5A6E',
  },
  appCopyright: {
    fontSize: 12,
    color: '#3A3A5E',
    marginTop: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 20,
  },
  // Language Modal
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0A0A1A',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A4E',
    gap: 14,
  },
  languageItemActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderColor: '#7C3AED',
  },
  languageFlag: {
    fontSize: 28,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  languageNameActive: {
    color: '#A78BFA',
  },
  languageNameEn: {
    fontSize: 13,
    color: '#8B8B9E',
    marginTop: 2,
  },
  // Input Styles
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#0A0A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: 16,
  },
  passwordHints: {
    marginTop: 16,
    gap: 8,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#5A5A6E',
  },
  hintTextValid: {
    color: '#10B981',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Avatar Preview
  avatarPreview: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  changeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 8,
  },
  changeAvatarText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  notifInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  notifLabel: {
    fontSize: 15,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#8B8B9E',
    marginBottom: 12,
    lineHeight: 20,
  },
  secretKeyBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  secretKeyText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  totpInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D3F',
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginVertical: 16,
  },
  modalBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    marginTop: 8,
  },
  modalBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backupCodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 16,
    width: '100%',
  },
  backupCodeItem: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '48%',
    alignItems: 'center',
  },
  backupCodeText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
