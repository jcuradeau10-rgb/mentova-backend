import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { LANGUAGES } from '../../i18n/translations';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const { t, language, setLanguage, loadLanguage } = useTranslation();
  
  // Modal states
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    // Redirect to onboarding page after logout
    router.replace('/');
  };

  const handleMyCourses = () => {
    router.push('/learn');
  };

  const getProgressPercentage = () => {
    const completed = user?.progress?.modules_completed?.length || 0;
    const total = 13;
    return Math.round((completed / total) * 100);
  };

  const getLevelInfo = () => {
    const score = user?.progress?.total_score || 0;
    if (score >= 500) return { text: t('home.advanced'), color: '#FF6B35', icon: 'trophy' };
    if (score >= 100) return { text: t('home.intermediate'), color: '#7C3AED', icon: 'medal' };
    return { text: t('home.beginner'), color: '#00D9A5', icon: 'leaf' };
  };

  const levelInfo = getLevelInfo();

  // Custom Modal Component
  const CustomModal = ({ visible, onClose, title, children, showCloseButton = true }) => (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#8B8B9E" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>{t('nav.profile')}</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => setShowEditModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={16} color="#7C3AED" />
          </TouchableOpacity>
          
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={[styles.levelIndicator, { backgroundColor: levelInfo.color }]}>
              <Ionicons name={levelInfo.icon} size={12} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || t('common.user')}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {user?.role && user.role !== 'user' && (
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#FF4757" />
              <Text style={styles.roleBadgeText}>
                {user.role === 'super_admin' ? t('admin.role.superAdmin') : t('admin.role.admin')}
              </Text>
            </View>
          )}
          <View style={[styles.levelBadge, { backgroundColor: `${levelInfo.color}20` }]}>
            <Text style={[styles.levelBadgeText, { color: levelInfo.color }]}>
              {t('home.level')} {levelInfo.text}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{getProgressPercentage()}%</Text>
            <Text style={styles.statLabel}>{t('learn.progress')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.progress?.modules_completed?.length || 0}</Text>
            <Text style={styles.statLabel}>{t('learn.modules')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.progress?.total_score || 0}</Text>
            <Text style={styles.statLabel}>{t('vip.hub.points')}</Text>
          </View>
        </View>

        {/* VIP Banner */}
        <TouchableOpacity 
          style={styles.vipBanner} 
          onPress={() => router.push('/vip')}
          activeOpacity={0.8}
          data-testid="profile-vip-banner"
        >
          <View style={styles.vipBannerGradient}>
            <View style={styles.vipBannerContent}>
              <View style={styles.vipIconContainer}>
                <Ionicons name="diamond" size={28} color="#FFD700" />
              </View>
              <View style={styles.vipTextContainer}>
                <Text style={styles.vipBannerTitle}>{t('vip.upgrade')}</Text>
                <Text style={styles.vipBannerSubtitle}>{t("profile.unlockFeatures")}</Text>
              </View>
              <View style={styles.vipPriceTag}>
                <Text style={styles.vipPrice}>$9.99</Text>
                <Text style={styles.vipPeriod}>/{t('vip.perMonth')}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {/* Admin Panel - Only for admins */}
          {isAdmin && (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/admin')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FF475720' }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#FF4757" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.adminPanel')}</Text>
                <Text style={styles.menuSubtitle}>
                  {isSuperAdmin ? t('profile.superAdmin') : t('profile.admin')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
            </TouchableOpacity>
          )}

          {/* Professional Section */}
          {user?.is_professional ? (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/pro/dashboard')}
              activeOpacity={0.7}
              data-testid="profile-pro-dashboard-btn"
            >
              <View style={[styles.menuIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="briefcase" size={22} color="#10B981" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.proDashboard')}</Text>
                <Text style={styles.menuSubtitle}>{t('profile.manageServices')}</Text>
              </View>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>MENTOR</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/pro/join')}
              activeOpacity={0.7}
              data-testid="profile-become-pro-btn"
            >
              <View style={[styles.menuIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="school" size={22} color="#F59E0B" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.becomePro')}</Text>
                <Text style={styles.menuSubtitle}>{t('profile.shareExpertise')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
            </TouchableOpacity>
          )}

          {/* Affiliate Dashboard - Only for influencer/mentors */}
          {user?.is_influencer && (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/influencer/dashboard')}
              activeOpacity={0.7}
              data-testid="profile-affiliate-dashboard-btn"
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FFD70020' }]}>
                <Ionicons name="people" size={22} color="#FFD700" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.affiliateDashboard')}</Text>
                <Text style={styles.menuSubtitle}>{t('profile.affiliateSubtitle')}</Text>
              </View>
              <View style={[styles.proBadge, { backgroundColor: '#FFD70020' }]}>
                <Text style={[styles.proBadgeText, { color: '#FFD700' }]}>AFFILIÉ</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
            </TouchableOpacity>
          )}

          {/* My Bookings - VIP Only */}
          {user?.is_vip && (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/bookings')}
              activeOpacity={0.7}
              data-testid="profile-bookings-btn"
            >
              <View style={[styles.menuIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="calendar" size={22} color="#3B82F6" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.myBookings')}</Text>
                <Text style={styles.menuSubtitle}>{t('profile.sessionsWithPros')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleMyCourses}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#7C3AED20' }]}>
              <Ionicons name="book-outline" size={22} color="#7C3AED" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.myCourses')}</Text>
              <Text style={styles.menuSubtitle}>
                {user?.progress?.modules_completed?.length || 0} modules {t('booking.completed').toLowerCase()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/messages')}
            activeOpacity={0.7}
            data-testid="profile-messages-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#06B6D420' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#06B6D4" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.messages')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.directConversations')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/user/' + user?.id)}
            activeOpacity={0.7}
            data-testid="profile-public-view-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#EC489920' }]}>
              <Ionicons name="person-circle-outline" size={22} color="#EC4899" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.publicProfile')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.whatOthersSee')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => setShowAchievementsModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FFD70020' }]}>
              <Ionicons name="trophy-outline" size={22} color="#FFD700" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.achievements')}</Text>
              <Text style={styles.menuSubtitle}>
                {user?.progress?.total_score || 0} points
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => setShowChecklistModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#00D9A520' }]}>
              <Ionicons name="checkbox-outline" size={22} color="#00D9A5" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.investChecklist')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.prepareInvest')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => setShowHelpModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#8B8B9E20' }]}>
              <Ionicons name="help-circle-outline" size={22} color="#8B8B9E" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('profile.helpCenter')}</Text>
              <Text style={styles.menuSubtitle}>{t('profile.faqSupport')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => setShowLanguageModal(true)}
            activeOpacity={0.7}
            data-testid="language-selector-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#06B6D420' }]}>
              <Ionicons name="globe-outline" size={22} color="#06B6D4" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t('settings.language')}</Text>
              <Text style={styles.menuSubtitle}>
                {LANGUAGES.find(l => l.code === language)?.nativeName || 'Français'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
            data-testid="settings-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#64748B20' }]}>
              <Ionicons name="settings-outline" size={22} color="#64748B" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t("profile.settingsTitle")}</Text>
              <Text style={styles.menuSubtitle}>{t("profile.securityProfile")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </TouchableOpacity>

          <Pressable 
            style={styles.menuItem} 
            onPress={() => router.push('/feedback')}
            data-testid="feedback-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#EC489920' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#EC4899" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t("profile.feedback")}</Text>
              <Text style={styles.menuSubtitle}>{t("profile.feedbackSubtitle")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </Pressable>

          <Pressable 
            style={styles.menuItem} 
            onPress={() => router.push('/my-feedback')}
            data-testid="my-feedback-btn"
          >
            <View style={[styles.menuIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="mail-open-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{t("myFeedback.title")}</Text>
              <Text style={styles.menuSubtitle}>{t("myFeedback.viewReply")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
          </Pressable>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#FF4757" />
          <Text style={styles.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appLogoContainer}>
            <Ionicons name="diamond" size={24} color="#7C3AED" />
          </View>
          <Text style={styles.appName}>Mentova</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appDisclaimer}>
            Les informations fournies ne constituent pas des conseils financiers.
            Investissez de manière responsable.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <CustomModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title={t('profile.logout')}
        showCloseButton={false}
      >
        <Text style={styles.modalText}>
          {t('profile.logoutConfirm')}
        </Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity 
            style={styles.modalCancelBtn}
            onPress={() => setShowLogoutModal(false)}
          >
            <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.modalConfirmBtn}
            onPress={handleLogout}
          >
            <Text style={styles.modalConfirmText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>
      </CustomModal>

      {/* Achievements Modal */}
      <CustomModal
        visible={showAchievementsModal}
        onClose={() => setShowAchievementsModal(false)}
        title={`🏆 ${t('profile.achievements')}`}
      >
        <View style={styles.achievementCard}>
          <Ionicons name="star" size={40} color="#FFD700" />
          <Text style={styles.achievementScore}>{user?.progress?.total_score || 0}</Text>
          <Text style={styles.achievementLabel}>{t('profile.pointsAccumulated')}</Text>
        </View>
        
        <View style={styles.achievementCard}>
          <Ionicons name="school" size={40} color="#7C3AED" />
          <Text style={styles.achievementScore}>{user?.progress?.modules_completed?.length || 0}</Text>
          <Text style={styles.achievementLabel}>{t('profile.modulesCompleted')}</Text>
        </View>

        <View style={styles.achievementCard}>
          <Ionicons name="ribbon" size={40} color="#00D9A5" />
          <Text style={styles.achievementScore}>{levelInfo.text}</Text>
          <Text style={styles.achievementLabel}>Niveau actuel</Text>
        </View>

        <Text style={styles.achievementTip}>
          💡 Continuez à apprendre pour débloquer plus de badges et monter en niveau !
        </Text>

        <TouchableOpacity 
          style={styles.modalActionBtn}
          onPress={() => {
            setShowAchievementsModal(false);
            router.push('/learn');
          }}
        >
          <Text style={styles.modalActionText}>{t("profile.continueLearning")}</Text>
        </TouchableOpacity>
      </CustomModal>

      {/* Checklist Modal */}
      <CustomModal
        visible={showChecklistModal}
        onClose={() => setShowChecklistModal(false)}
        title={`✅ ${t('profile.investmentChecklist')}`}
      >
        <Text style={styles.checklistIntro}>
          {t('profile.checklist.intro')}
        </Text>

        {[
          { icon: 'people', text: t('profile.checklist.team'), color: '#7C3AED' },
          { icon: 'document-text', text: t('profile.checklist.whitepaper'), color: '#00D9A5' },
          { icon: 'cube', text: t('profile.checklist.product'), color: '#FF6B35' },
          { icon: 'pie-chart', text: t('profile.checklist.tokenomics'), color: '#FFD700' },
          { icon: 'shield-checkmark', text: t('profile.checklist.audit'), color: '#00D9A5' },
          { icon: 'chatbubbles', text: t('profile.checklist.community'), color: '#7C3AED' },
          { icon: 'bulb', text: t('profile.checklist.problem'), color: '#FF6B35' },
          { icon: 'trending-up', text: t('profile.checklist.partnerships'), color: '#00D9A5' },
        ].map((item, index) => (
          <View key={index} style={styles.checklistItem}>
            <View style={[styles.checklistIcon, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={styles.checklistText}>{item.text}</Text>
          </View>
        ))}

        <View style={styles.warningBox}>
          <Ionicons name="warning" size={20} color="#FF4757" />
          <Text style={styles.warningText}>
            {t('profile.checklist.warning')}
          </Text>
        </View>
      </CustomModal>

      {/* Help Modal */}
      <CustomModal
        visible={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={`❓ ${t('profile.helpCenter')}`}
      >
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>📚 {t('nav.learn')}</Text>
          <Text style={styles.helpText}>
            {t('profile.help.learnDesc')}
          </Text>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>💬 {t('nav.community')}</Text>
          <Text style={styles.helpText}>
            {t('profile.help.communityDesc')}
          </Text>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>🔧 {t('profile.help.technicalIssues')}</Text>
          <Text style={styles.helpText}>
            {t('profile.help.technicalDesc')}
          </Text>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>⚠️ {t('profile.help.warning')}</Text>
          <Text style={styles.helpText}>
            {t('profile.help.warningDesc')}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.modalActionBtn}
          onPress={() => {
            setShowHelpModal(false);
            router.push('/community');
          }}
        >
          <Text style={styles.modalActionText}>{t('profile.help.askQuestion')}</Text>
        </TouchableOpacity>
      </CustomModal>

      {/* Edit Profile Modal */}
      <CustomModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`✏️ ${t('profile.editProfile')}`}
      >
        <View style={styles.editProfileContent}>
          <Ionicons name="construct" size={60} color="#7C3AED" />
          <Text style={styles.comingSoonTitle}>{t('profile.comingSoon')}</Text>
          <Text style={styles.comingSoonText}>
            {t('profile.editProfileDesc')}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.modalActionBtn}
          onPress={() => setShowEditModal(false)}
        >
          <Text style={styles.modalActionText}>{t('common.understood')}</Text>
        </TouchableOpacity>
      </CustomModal>

      {/* Language Selection Modal */}
      <CustomModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title={t('settings.language')}
      >
        <View style={styles.languageList}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageItem,
                language === lang.code && styles.languageItemActive
              ]}
              onPress={() => {
                setLanguage(lang.code);
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <View style={styles.languageInfo}>
                <Text style={[
                  styles.languageName,
                  language === lang.code && styles.languageNameActive
                ]}>
                  {lang.nativeName}
                </Text>
                <Text style={styles.languageNameEn}>{lang.name}</Text>
              </View>
              {language === lang.code && (
                <Ionicons name="checkmark-circle" size={24} color="#7C3AED" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06060F',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7C3AED20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  levelIndicator: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1A1A2E',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF475720',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF4757',
  },
  levelBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  // VIP Banner Styles
  vipBanner: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  vipBannerGradient: {
    backgroundColor: '#1A0A2E',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 16,
  },
  vipBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  vipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  vipBannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFD700',
  },
  vipBannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  vipPriceTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#FFD700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  vipPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A0A2E',
  },
  vipPeriod: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A0A2E',
  },
  menuContainer: {
    marginTop: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF4757',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  appLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appVersion: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  appDisclaimer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 6, 15, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  modalConfirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FF4757',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalActionBtn: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    marginTop: 16,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Achievements Styles
  achievementCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  achievementLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  achievementTip: {
    fontSize: 14,
    color: '#00D9A5',
    textAlign: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 217, 165, 0.1)',
    borderRadius: 12,
  },
  // Checklist Styles
  checklistIntro: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 16,
    lineHeight: 20,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  checklistIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#FF4757',
    fontWeight: '500',
  },
  // Help Styles
  helpSection: {
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  helpText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 20,
  },
  // Edit Profile Styles
  editProfileContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  comingSoonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  // Pro Badge
  proBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Language Modal
  languageList: {
    gap: 8,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
});
