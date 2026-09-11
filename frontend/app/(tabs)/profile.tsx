import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';
import { LANGUAGES } from '../../i18n/translations';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function api(path: string, token: string) {
  return fetch(`${API}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  }).then(r => r.ok ? r.json() : null).catch(() => null);
}

const profileI18n: Record<string, Record<string, string>> = {
  'p.learning': { fr: 'Mon apprentissage', en: 'My learning', es: 'Mi aprendizaje' },
  'p.modules': { fr: 'Modules', en: 'Modules', es: 'Modulos' },
  'p.mastered': { fr: 'Maitrise', en: 'Mastered', es: 'Dominado' },
  'p.level': { fr: 'Niveau', en: 'Level', es: 'Nivel' },
  'p.atlasProgress': { fr: 'Progression Atlas', en: 'Atlas Progress', es: 'Progreso Atlas' },
  'p.goToAtlas': { fr: 'Continuer avec Atlas', en: 'Continue with Atlas', es: 'Continuar con Atlas' },
  'p.settings': { fr: 'Parametres', en: 'Settings', es: 'Ajustes' },
  'p.language': { fr: 'Langue', en: 'Language', es: 'Idioma' },
  'p.support': { fr: 'Aide et support', en: 'Help & support', es: 'Ayuda y soporte' },
  'p.faq': { fr: 'FAQ et assistance', en: 'FAQ and support', es: 'FAQ y asistencia' },
  'p.admin': { fr: 'Administration', en: 'Administration', es: 'Administracion' },
  'p.logout': { fr: 'Deconnexion', en: 'Logout', es: 'Cerrar sesion' },
  'p.logoutConfirm': { fr: 'Es-tu sur de vouloir te deconnecter ?', en: 'Are you sure you want to log out?', es: 'Estas seguro de querer cerrar sesion?' },
  'p.cancel': { fr: 'Annuler', en: 'Cancel', es: 'Cancelar' },
  'p.confirm': { fr: 'Confirmer', en: 'Confirm', es: 'Confirmar' },
  'p.notEvaluated': { fr: 'Non evalue', en: 'Not evaluated', es: 'No evaluado' },
  'p.beginner': { fr: 'Debutant', en: 'Beginner', es: 'Principiante' },
  'p.intermediate': { fr: 'Intermediaire', en: 'Intermediate', es: 'Intermedio' },
  'p.advanced': { fr: 'Avance', en: 'Advanced', es: 'Avanzado' },
  'p.expert': { fr: 'Expert', en: 'Expert', es: 'Experto' },
  'p.checklist': { fr: 'Checklist investisseur', en: 'Investor checklist', es: 'Checklist del inversor' },
  'p.prepareInvest': { fr: 'Preparer ton investissement', en: 'Prepare your investment', es: 'Prepara tu inversion' },
  'p.achievements': { fr: 'Reussites', en: 'Achievements', es: 'Logros' },
  'p.selectLanguage': { fr: 'Choisir la langue', en: 'Select language', es: 'Elegir idioma' },
  'p.vipHub': { fr: 'Espace VIP', en: 'VIP Hub', es: 'Espacio VIP' },
  'p.vipHubDesc': { fr: 'Briefing, outils, analyses', en: 'Briefing, tools, analyses', es: 'Briefing, herramientas, analisis' },
  'p.vip': { fr: 'Devenir VIP', en: 'Become VIP', es: 'Ser VIP' },
  'p.vipDesc': { fr: 'Debloquez Atlas premium', en: 'Unlock premium Atlas', es: 'Desbloquea Atlas premium' },
};

function tp(key: string, lang: string): string {
  return profileI18n[key]?.[lang] || profileI18n[key]?.['en'] || key;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, token, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const { t, language, setLanguage, loadLanguage } = useTranslation();
  const lang = language || 'fr';
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [atlasProfile, setAtlasProfile] = useState<any>(null);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => { loadLanguage(); }, []);

  useEffect(() => {
    if (token) {
      api('/api/atlas/profile', token).then(d => { if (d) setAtlasProfile(d); });
      api('/api/vip/permissions', token).then(d => { if (d) setIsVip(!!d.is_vip); });
    }
  }, [token]);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/');
  };

  const levelMap: Record<string, { label: string; color: string }> = {
    unknown: { label: tp('p.notEvaluated', lang), color: '#6B7280' },
    beginner: { label: tp('p.beginner', lang), color: '#10B981' },
    intermediate: { label: tp('p.intermediate', lang), color: '#F59E0B' },
    advanced: { label: tp('p.advanced', lang), color: '#EF4444' },
    expert: { label: tp('p.expert', lang), color: '#7C3AED' },
  };

  const profile = atlasProfile?.profile || {};
  const stats = atlasProfile?.stats || {};
  const lvl = levelMap[profile.overall_level || 'unknown'] || levelMap.unknown;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle} data-testid="profile-title">{t('nav.profile')}</Text>

        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
            </View>
          </View>
          <Text style={s.userName}>{user?.name || 'Utilisateur'}</Text>
          <Text style={s.userEmail}>{user?.email || ''}</Text>
          {user?.role && user.role !== 'user' && (
            <View style={s.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#7C3AED" />
              <Text style={s.roleBadgeText}>{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</Text>
            </View>
          )}
          {isVip && (
            <View style={[s.roleBadge, { backgroundColor: 'rgba(255,215,0,0.12)', borderColor: 'rgba(255,215,0,0.25)', borderWidth: 1 }]} data-testid="vip-badge">
              <Ionicons name="diamond" size={12} color="#FFD700" />
              <Text style={[s.roleBadgeText, { color: '#FFD700' }]}>VIP</Text>
            </View>
          )}
          <View style={[s.levelBadge, { backgroundColor: lvl.color + '20' }]}>
            <Text style={[s.levelBadgeText, { color: lvl.color }]}>{tp('p.level', lang)} : {lvl.label}</Text>
          </View>
        </View>

        {/* Atlas Progress Card */}
        <View style={s.atlasCard} data-testid="atlas-progress-card">
          <View style={s.atlasCardHeader}>
            <Ionicons name="planet" size={20} color="#7C3AED" />
            <Text style={s.atlasCardTitle}>{tp('p.atlasProgress', lang)}</Text>
          </View>
          <View style={s.atlasStats}>
            <View style={s.atlasStat}>
              <Text style={s.atlasStatNum}>{stats.total_modules || 0}</Text>
              <Text style={s.atlasStatLabel}>{tp('p.modules', lang)}</Text>
            </View>
            <View style={s.atlasStatDivider} />
            <View style={s.atlasStat}>
              <Text style={s.atlasStatNum}>{stats.mastered_modules || 0}</Text>
              <Text style={s.atlasStatLabel}>{tp('p.mastered', lang)}</Text>
            </View>
            <View style={s.atlasStatDivider} />
            <View style={s.atlasStat}>
              <Text style={s.atlasStatNum}>{stats.in_progress_modules || 0}</Text>
              <Text style={s.atlasStatLabel}>{tp('p.learning', lang)}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.atlasBtn} onPress={() => router.push('/(tabs)/learn')} data-testid="go-to-atlas-btn">
            <Ionicons name="chatbubbles" size={16} color="#FFF" />
            <Text style={s.atlasBtnText}>{tp('p.goToAtlas', lang)}</Text>
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={s.menuWrap}>
          {/* VIP Hub or Become VIP */}
          {isVip ? (
            <MenuItem icon="diamond-outline" color="#FFD700" label={tp('p.vipHub', lang)} subtitle={tp('p.vipHubDesc', lang)} onPress={() => router.push('/vip/hub')} testId="vip-hub-btn" />
          ) : (
            <MenuItem icon="diamond-outline" color="#FFD700" label={tp('p.vip', lang)} subtitle={tp('p.vipDesc', lang)} onPress={() => router.push('/vip')} testId="vip-upgrade-btn" />
          )}

          {/* Admin */}
          {isAdmin && (
            <MenuItem icon="shield-checkmark-outline" color="#EF4444" label={tp('p.admin', lang)} subtitle={isSuperAdmin ? 'Super Admin' : 'Admin'} onPress={() => router.push('/admin')} />
          )}

          {/* Achievements */}
          <MenuItem icon="trophy-outline" color="#F59E0B" label={tp('p.achievements', lang)} subtitle={`${user?.progress?.total_score || 0} points`} onPress={() => {}} />

          {/* Checklist */}
          <MenuItem icon="checkbox-outline" color="#10B981" label={tp('p.checklist', lang)} subtitle={tp('p.prepareInvest', lang)} onPress={() => {}} />

          {/* Language */}
          <MenuItem icon="globe-outline" color="#06B6D4" label={tp('p.language', lang)} subtitle={LANGUAGES.find(l => l.code === language)?.nativeName || 'Francais'} onPress={() => setShowLanguageModal(true)} testId="language-selector-btn" />

          {/* Settings */}
          <MenuItem icon="settings-outline" color="#64748B" label={tp('p.settings', lang)} onPress={() => router.push('/settings')} testId="settings-btn" />

          {/* Support */}
          <MenuItem icon="help-circle-outline" color="#8B8B9E" label={tp('p.support', lang)} subtitle={tp('p.faq', lang)} onPress={() => router.push('/support')} />

          {/* Logout */}
          <TouchableOpacity style={[s.menuItem, { marginTop: 16, borderColor: 'rgba(239,68,68,0.15)' }]} onPress={() => setShowLogoutModal(true)} data-testid="logout-btn">
            <View style={[s.menuIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </View>
            <Text style={[s.menuLabel, { color: '#EF4444' }]}>{tp('p.logout', lang)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{tp('p.logout', lang)}</Text>
            <Text style={s.modalDesc}>{tp('p.logoutConfirm', lang)}</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowLogoutModal(false)}>
                <Text style={s.modalBtnCancelText}>{tp('p.cancel', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={handleLogout} data-testid="confirm-logout-btn">
                <Text style={s.modalBtnConfirmText}>{tp('p.confirm', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{tp('p.selectLanguage', lang)}</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langItem, language === l.code && s.langItemActive]}
                onPress={() => { setLanguage(l.code); setShowLanguageModal(false); }}
              >
                <Text style={s.langFlag}>{l.flag}</Text>
                <Text style={[s.langName, language === l.code && { color: '#7C3AED', fontWeight: '700' }]}>{l.nativeName}</Text>
                {language === l.code && <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.modalBtnCancel, { marginTop: 12 }]} onPress={() => setShowLanguageModal(false)}>
              <Text style={s.modalBtnCancelText}>{tp('p.cancel', lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Reusable menu item
function MenuItem({ icon, color, label, subtitle, onPress, testId }: any) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7} data-testid={testId}>
      <View style={[s.menuIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.menuLabel}>{label}</Text>
        {subtitle && <Text style={s.menuSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#4B5563" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0914' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#E2E8F0', marginBottom: 20 },

  // Profile card
  profileCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, marginBottom: 16 },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  userName: { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: '#7C3AED' },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  levelBadgeText: { fontSize: 13, fontWeight: '600' },

  // Atlas card
  atlasCard: { backgroundColor: 'rgba(124,58,237,0.06)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)', borderRadius: 16, padding: 16, marginBottom: 16 },
  atlasCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  atlasCardTitle: { fontSize: 15, fontWeight: '700', color: '#E2E8F0' },
  atlasStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  atlasStat: { alignItems: 'center' },
  atlasStatNum: { fontSize: 22, fontWeight: '800', color: '#E2E8F0' },
  atlasStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  atlasStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  atlasBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12 },
  atlasBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Menu
  menuWrap: { gap: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.02)' },
  menuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  menuSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  modalBtnConfirm: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center' },
  modalBtnConfirmText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Language
  langItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, marginBottom: 4 },
  langItemActive: { backgroundColor: 'rgba(124,58,237,0.1)' },
  langFlag: { fontSize: 20 },
  langName: { flex: 1, fontSize: 14, color: '#E2E8F0' },
});
