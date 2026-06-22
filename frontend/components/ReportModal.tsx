import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { reportAPI } from '../utils/api';
import { useTranslation } from '../store/languageStore';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  contextType?: string;
  contextId?: string;
}

interface ReportReason {
  id: string;
  label: string;
}

export default function ReportModal({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  contextType,
  contextId,
}: ReportModalProps) {
  const { t } = useTranslation();
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(true);

  useEffect(() => {
    if (visible) {
      loadReasons();
    }
  }, [visible]);

  const loadReasons = async () => {
    try {
      setLoadingReasons(true);
      const res = await reportAPI.getReasons();
      if (res.data.success) {
        setReasons(res.data.reasons);
      }
    } catch (error) {
      console.error('Failed to load report reasons:', error);
    } finally {
      setLoadingReasons(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert(t('report.error'), t('report.selectReason'));
      return;
    }

    setLoading(true);
    try {
      const res = await reportAPI.createReport({
        reported_user_id: reportedUserId,
        reason: selectedReason,
        details: details.trim() || undefined,
        context_type: contextType,
        context_id: contextId,
      });

      if (res.data.success) {
        Alert.alert(t('report.sent'), res.data.message);
        handleClose();
      }
    } catch (error: any) {
      Alert.alert(t('report.error'), error.response?.data?.detail || t('report.sendError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setDetails('');
    onClose();
  };

  const getReasonIcon = (reasonId: string) => {
    const icons: Record<string, string> = {
      spam: 'mail-unread',
      harassment: 'warning',
      inappropriate_content: 'eye-off',
      fraud: 'alert-circle',
      impersonation: 'person-remove',
      other: 'help-circle',
    };
    return icons[reasonId] || 'flag';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="flag" size={24} color="#EF4444" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('report.title')}</Text>
              <Text style={styles.subtitle}>{t('report.reportUser', { name: reportedUserName })}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#8B8B9E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Reason Selection */}
            <Text style={styles.sectionTitle}>{t('report.reasonTitle')}</Text>
            
            {loadingReasons ? (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.reasonsGrid}>
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.id}
                    style={[
                      styles.reasonCard,
                      selectedReason === reason.id && styles.reasonCardActive,
                    ]}
                    onPress={() => setSelectedReason(reason.id)}
                    data-testid={`report-reason-${reason.id}`}
                  >
                    <Ionicons
                      name={getReasonIcon(reason.id) as any}
                      size={22}
                      color={selectedReason === reason.id ? '#FFFFFF' : '#8B8B9E'}
                    />
                    <Text
                      style={[
                        styles.reasonLabel,
                        selectedReason === reason.id && styles.reasonLabelActive,
                      ]}
                    >
                      {reason.label}
                    </Text>
                    {selectedReason === reason.id && (
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Details */}
            <Text style={styles.sectionTitle}>{t('report.additionalDetails')}</Text>
            <TextInput
              style={styles.textArea}
              placeholder={t('report.detailsPlaceholder')}
              placeholderTextColor="#5A5A6E"
              multiline
              numberOfLines={4}
              value={details}
              onChangeText={setDetails}
              maxLength={500}
              data-testid="report-details-input"
            />
            <Text style={styles.charCount}>{details.length}/500</Text>

            {/* Warning */}
            <View style={styles.warningBox}>
              <Ionicons name="information-circle" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>
                {t('report.warning')}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>{t('report.cancel')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedReason || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading}
              data-testid="report-submit-btn"
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.submitBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="flag" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>{t('report.send')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0A0A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#8B8B9E',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C4C4C4',
    marginBottom: 12,
    marginTop: 8,
  },
  reasonsGrid: {
    gap: 10,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  reasonCardActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  reasonLabel: {
    fontSize: 14,
    color: '#C4C4C4',
    marginLeft: 12,
    flex: 1,
  },
  reasonLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 8,
  },
  textArea: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A4E',
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#5A5A6E',
    textAlign: 'right',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 30,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B8B9E',
  },
  submitBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
