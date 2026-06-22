import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { proAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/languageStore';

const { width } = Dimensions.get('window');

// Countries with phone codes
const COUNTRIES = [
  { code: 'CA', name: 'Canada', phone: '+1' },
  { code: 'US', name: 'États-Unis', phone: '+1' },
  { code: 'FR', name: 'France', phone: '+33' },
  { code: 'BE', name: 'Belgique', phone: '+32' },
  { code: 'CH', name: 'Suisse', phone: '+41' },
  { code: 'GB', name: 'Royaume-Uni', phone: '+44' },
  { code: 'DE', name: 'Allemagne', phone: '+49' },
  { code: 'ES', name: 'Espagne', phone: '+34' },
  { code: 'IT', name: 'Italie', phone: '+39' },
  { code: 'PT', name: 'Portugal', phone: '+351' },
  { code: 'NL', name: 'Pays-Bas', phone: '+31' },
  { code: 'AU', name: 'Australie', phone: '+61' },
  { code: 'JP', name: 'Japon', phone: '+81' },
  { code: 'CN', name: 'Chine', phone: '+86' },
  { code: 'KR', name: 'Corée du Sud', phone: '+82' },
  { code: 'BR', name: 'Brésil', phone: '+55' },
  { code: 'MX', name: 'Mexique', phone: '+52' },
  { code: 'IN', name: 'Inde', phone: '+91' },
  { code: 'RU', name: 'Russie', phone: '+7' },
  { code: 'ZA', name: 'Afrique du Sud', phone: '+27' },
  { code: 'MA', name: 'Maroc', phone: '+212' },
  { code: 'DZ', name: 'Algérie', phone: '+213' },
  { code: 'TN', name: 'Tunisie', phone: '+216' },
  { code: 'SN', name: 'Sénégal', phone: '+221' },
  { code: 'CI', name: 'Côte d\'Ivoire', phone: '+225' },
];

const EXPERTISE_OPTIONS = [
  { id: 'trading', label: 'Trading', icon: 'trending-up' },
  { id: 'defi', label: 'DeFi', icon: 'layers' },
  { id: 'nft', label: 'NFT', icon: 'images' },
  { id: 'blockchain', label: 'Blockchain', icon: 'git-network' },
  { id: 'investment', label: 'Investissement', icon: 'wallet' },
  { id: 'security', label: 'Sécurité', icon: 'shield-checkmark' },
  { id: 'mining', label: 'Mining', icon: 'hardware-chip' },
  { id: 'metaverse', label: 'Metaverse', icon: 'planet' },
];

const SERVICES_OPTIONS = [
  { id: 'mentoring', label: 'Mentorat 1-à-1', icon: 'people' },
  { id: 'courses', label: 'Cours en ligne', icon: 'book' },
  { id: 'qa', label: 'Q&A Premium', icon: 'help-circle' },
  { id: 'live_sessions', label: 'Sessions Live', icon: 'videocam' },
];

const LANGUAGES = ['Français', 'English', 'Español', 'Deutsch', 'Português', '中文', 'العربية'];

export default function ProApplyScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { t } = useTranslation();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proInfo, setProInfo] = useState<any>(null);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<typeof COUNTRIES[0] | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: user?.name || '',
    email: user?.email || '',
    phone: '',
    country: '',
    languages: ['Français'],
    main_expertise: '',
    specializations: [] as string[],
    years_experience: 2,
    bio: '',
    linkedin_url: '',
    twitter_url: '',
    portfolio_url: '',
    certifications: [] as string[],
    video_intro_url: '',
    services_offered: [] as string[],
    hourly_rate: 50,
    course_price_range: '20-100',
    availability: 'part_time',
  });
  
  const [newCertification, setNewCertification] = useState('');
  
  // Validation error states for visual feedback
  const [errors, setErrors] = useState({
    full_name: false,
    country: false,
    phone: false,
    languages: false,
    main_expertise: false,
    bio: false,
    services_offered: false,
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: prev.full_name || user.name || '',
        email: user.email || prev.email || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [infoRes, statusRes] = await Promise.all([
        proAPI.getInfo(),
        isAuthenticated ? proAPI.getApplicationStatus() : Promise.resolve({ data: { data: null } })
      ]);
      
      if (infoRes.data.success) setProInfo(infoRes.data.data);
      if (statusRes.data.data) setExistingApplication(statusRes.data.data);
    } catch (error) {
      console.log('Failed to load pro info:', error);
    }
  };

  const selectCountry = (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country);
    setFormData(prev => ({ ...prev, country: country.name }));
    setShowCountryPicker(false);
  };

  const handleSubmit = async () => {
    console.log('=== SUBMIT CLICKED ===');
    console.log('formData:', JSON.stringify(formData, null, 2));
    
    if (!isAuthenticated) {
      Alert.alert(t('common.loginRequired'), t('common.loginToApply'));
      router.push('/login');
      return;
    }
    
    // Final validation for step 4
    if (!validateStep(4)) {
      return;
    }
    
    console.log('=== VALIDATION PASSED, SUBMITTING ===');
    setLoading(true);
    try {
      const phoneNumber = selectedCountry && formData.phone 
        ? `${selectedCountry.phone}${formData.phone}` 
        : formData.phone || null;
      
      const applicationData = {
        full_name: formData.full_name.trim(),
        phone: phoneNumber,
        country: formData.country,
        city: null,
        languages: formData.languages,
        main_expertise: formData.main_expertise,
        specializations: formData.specializations,
        years_experience: formData.years_experience,
        bio: formData.bio.trim(),
        linkedin_url: formData.linkedin_url.trim() || null,
        twitter_url: formData.twitter_url.trim() || null,
        portfolio_url: formData.portfolio_url.trim() || null,
        certifications: formData.certifications,
        video_intro_url: formData.video_intro_url.trim() || null,
        services_offered: formData.services_offered,
        hourly_rate: formData.hourly_rate,
        course_price_range: formData.course_price_range,
        availability: formData.availability,
      };
      
      console.log('Submitting application:', applicationData);
      const response = await proAPI.apply(applicationData);
      console.log('Response:', response.data);
      
      if (response.data.success) {
        setSubmitted(true);
      } else {
        if (Platform.OS === 'web') {
          window.alert(response.data.error || 'Une erreur est survenue');
        } else {
          Alert.alert(t('catalog.error'), response.data.error || t('catalog.genericError'));
        }
      }
    } catch (error: any) {
      console.error('Application submission error:', error);
      const errorMessage = error.response?.data?.detail || error.message || t('catalog.genericError');
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert(t('catalog.error'), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayItem = (array: string[], item: string, setter: (arr: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  const addCertification = () => {
    if (newCertification.trim()) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification('');
    }
  };

  // Validation for each step - MUST pass before proceeding
  const validateStep = (stepNumber: number): boolean => {
    // Reset errors at start
    const newErrors = { ...errors };
    let isValid = true;
    
    switch (stepNumber) {
      case 1:
        // Check each field
        newErrors.full_name = !formData.full_name || formData.full_name.trim().length === 0;
        newErrors.country = !selectedCountry || !formData.country;
        newErrors.phone = !formData.phone || formData.phone.trim().length < 6;
        newErrors.languages = !formData.languages || formData.languages.length === 0;
        
        if (newErrors.full_name || newErrors.country || newErrors.phone || newErrors.languages) {
          isValid = false;
        }
        break;
        
      case 2:
        newErrors.main_expertise = !formData.main_expertise;
        newErrors.bio = !formData.bio || formData.bio.trim().length < 20;
        
        if (newErrors.main_expertise || newErrors.bio) {
          isValid = false;
        }
        break;
        
      case 3:
        // Step 3 is optional (credibility links)
        break;
        
      case 4:
        newErrors.services_offered = !formData.services_offered || formData.services_offered.length === 0;
        
        if (newErrors.services_offered) {
          isValid = false;
        }
        break;
    }
    
    setErrors(newErrors);
    return isValid;
  };

  // Clear error when user starts typing/selecting
  const clearError = (field: keyof typeof errors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      console.log('Step', step, 'validated, moving to step', step + 1);
      setStep(step + 1);
    }
  };

  // Show existing application status
  if (existingApplication) {
    const statusColors: Record<string, string[]> = {
      pending: ['#F59E0B', '#D97706'],
      approved: ['#10B981', '#059669'],
      rejected: ['#EF4444', '#DC2626'],
      suspended: ['#6B7280', '#4B5563'],
    };
    const statusLabels: Record<string, string> = {
      pending: 'En cours d\'examen',
      approved: t('apply.statusApproved'),
      rejected: t('apply.statusRejected'),
      suspended: 'Suspendue',
    };
    
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ma candidature</Text>
          </View>
          
          <View style={styles.existingAppCard}>
            <LinearGradient
              colors={statusColors[existingApplication.status] || statusColors.pending}
              style={styles.existingAppGradient}
            >
              <Ionicons 
                name={existingApplication.status === 'approved' ? 'checkmark-circle' : existingApplication.status === 'rejected' ? 'close-circle' : 'time'} 
                size={48} 
                color="#FFFFFF" 
              />
              <Text style={styles.existingAppStatus}>
                {statusLabels[existingApplication.status] || 'En attente'}
              </Text>
              <Text style={styles.existingAppDate}>
                Soumise le {new Date(existingApplication.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </LinearGradient>
            
            <View style={styles.existingAppDetails}>
              <Text style={styles.existingAppLabel}>{t("apply.nameLabel")}</Text>
              <Text style={styles.existingAppValue}>{existingApplication.full_name}</Text>
              
              <Text style={styles.existingAppLabel}>{t("apply.expertiseLabel")}</Text>
              <Text style={styles.existingAppValue}>{existingApplication.main_expertise}</Text>
              
              <Text style={styles.existingAppLabel}>Services</Text>
              <Text style={styles.existingAppValue}>{existingApplication.services_offered?.join(', ')}</Text>
              
              {existingApplication.admin_notes && (
                <>
                  <Text style={styles.existingAppLabel}>{t("apply.adminNotesLabel")}</Text>
                  <View style={styles.adminNotesBox}>
                    <Text style={styles.adminNotesText}>{existingApplication.admin_notes}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Success screen after submission
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>{t('apply.successTitle')}</Text>
          <Text style={styles.successMessage}>
            {t('apply.successMsg1')}
          </Text>
          <Text style={styles.successSubMessage}>
            {t('apply.successMsg2')}
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/')}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.successBtnGradient}>
              <Text style={styles.successBtnText}>{t('apply.backToHome')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 1: Profile Info
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informations personnelles</Text>
      <Text style={styles.stepSubtitle}>Vos informations de base pour votre profil mentor</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.full_name && styles.inputLabelError]}>{t("apply.fullNameLabel")}</Text>
        <TextInput
          style={[styles.input, errors.full_name && styles.inputError]}
          value={formData.full_name}
          onChangeText={(text) => {
            setFormData(prev => ({ ...prev, full_name: text }));
            clearError('full_name');
          }}
          placeholder="Votre nom complet"
          placeholderTextColor="#5A5A6E"
        />
        {errors.full_name && <Text style={styles.errorText}>Ce champ est obligatoire</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Adresse courriel</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={formData.email}
          editable={false}
          placeholderTextColor="#5A5A6E"
        />
        <Text style={styles.inputHint}>{t('apply.emailHint')}</Text>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.country && styles.inputLabelError]}>Pays *</Text>
        <TouchableOpacity 
          style={[styles.selectBtn, errors.country && styles.inputError]}
          onPress={() => {
            setShowCountryPicker(true);
            clearError('country');
          }}
          data-testid="country-selector"
        >
          <Text style={selectedCountry ? styles.selectBtnTextActive : styles.selectBtnText}>
            {selectedCountry ? selectedCountry.name : t('apply.selectCountry')}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#8B8B9E" />
        </TouchableOpacity>
        {errors.country && <Text style={styles.errorText}>{t('apply.fieldRequired')}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.phone && styles.inputLabelError]}>{t('apply.phoneLabel')}</Text>
        <View style={[styles.phoneRow, errors.phone && styles.phoneRowError]}>
          <View style={styles.phoneCode}>
            <Text style={styles.phoneCodeText}>
              {selectedCountry ? selectedCountry.phone : '+1'}
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput, errors.phone && styles.inputError]}
            value={formData.phone}
            onChangeText={(text) => {
              setFormData(prev => ({ ...prev, phone: text.replace(/[^0-9]/g, '') }));
              if (errors.phone) setErrors(prev => ({ ...prev, phone: false }));
            }}
            placeholder={t('apply.phonePlaceholder')}
            placeholderTextColor="#5A5A6E"
            keyboardType="phone-pad"
          />
        </View>
        {errors.phone && <Text style={styles.errorText}>{t('apply.phoneError')}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.languages && styles.inputLabelError]}>{t('apply.languagesLabel')}</Text>
        <View style={[styles.chipContainer, errors.languages && styles.chipContainerError]}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[styles.chip, formData.languages.includes(lang) && styles.chipActive]}
              onPress={() => {
                toggleArrayItem(formData.languages, lang, (arr) => setFormData(prev => ({ ...prev, languages: arr })));
                clearError('languages');
              }}
            >
              <Text style={[styles.chipText, formData.languages.includes(lang) && styles.chipTextActive]}>{lang}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.languages && <Text style={styles.errorText}>{t('apply.languagesError')}</Text>}
      </View>
    </View>
  );

  // Step 2: Expertise
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Votre expertise</Text>
      <Text style={styles.stepSubtitle}>{t('apply.stepExpertiseSubtitle')}</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.main_expertise && styles.inputLabelError]}>Domaine principal *</Text>
        <View style={[styles.expertiseGrid, errors.main_expertise && styles.expertiseGridError]}>
          {EXPERTISE_OPTIONS.map((exp) => (
            <TouchableOpacity
              key={exp.id}
              style={[styles.expertiseCard, formData.main_expertise === exp.id && styles.expertiseCardActive]}
              onPress={() => {
                setFormData(prev => ({ ...prev, main_expertise: exp.id }));
                clearError('main_expertise');
              }}
            >
              <Ionicons name={exp.icon as any} size={28} color={formData.main_expertise === exp.id ? '#FFFFFF' : '#7C3AED'} />
              <Text style={[styles.expertiseLabel, formData.main_expertise === exp.id && styles.expertiseLabelActive]}>{exp.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.main_expertise && <Text style={styles.errorText}>{t('apply.expertiseError')}</Text>}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t('apply.experienceYears')}</Text>
        <View style={styles.experienceRow}>
          {[1, 2, 3, 5, 7, 10].map((years) => (
            <TouchableOpacity
              key={years}
              style={[styles.experienceBtn, formData.years_experience === years && styles.experienceBtnActive]}
              onPress={() => setFormData(prev => ({ ...prev, years_experience: years }))}
            >
              <Text style={[styles.experienceBtnText, formData.years_experience === years && styles.experienceBtnTextActive]}>
                {years}+ ans
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.bio && styles.inputLabelError]}>{t('apply.bioLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea, errors.bio && styles.inputError]}
          value={formData.bio}
          onChangeText={(text) => {
            setFormData(prev => ({ ...prev, bio: text }));
            clearError('bio');
          }}
          placeholder={t('apply.bioPlaceholder')}
          placeholderTextColor="#5A5A6E"
          multiline
          numberOfLines={5}
          maxLength={500}
        />
        <View style={styles.charCountRow}>
          {errors.bio && <Text style={styles.errorText}>{t('apply.bioError')}</Text>}
          <Text style={[styles.charCount, errors.bio && formData.bio.length < 20 && styles.charCountError]}>{formData.bio.length}/500</Text>
        </View>
      </View>
    </View>
  );

  // Step 3: Credibility
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('apply.credibilityTitle')}</Text>
      <Text style={styles.stepSubtitle}>{t("apply.addLinksSubtitle")}</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t("apply.linkedinLabel")}</Text>
        <TextInput
          style={styles.input}
          value={formData.linkedin_url}
          onChangeText={(text) => setFormData(prev => ({ ...prev, linkedin_url: text }))}
          placeholder="https://linkedin.com/in/..."
          placeholderTextColor="#5A5A6E"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t("apply.twitterLabel")}</Text>
        <TextInput
          style={styles.input}
          value={formData.twitter_url}
          onChangeText={(text) => setFormData(prev => ({ ...prev, twitter_url: text }))}
          placeholder="https://twitter.com/..."
          placeholderTextColor="#5A5A6E"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Portfolio / Site web</Text>
        <TextInput
          style={styles.input}
          value={formData.portfolio_url}
          onChangeText={(text) => setFormData(prev => ({ ...prev, portfolio_url: text }))}
          placeholder="https://..."
          placeholderTextColor="#5A5A6E"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Certifications</Text>
        <View style={styles.certRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newCertification}
            onChangeText={setNewCertification}
            placeholder={t("apply.certPlaceholder")}
            placeholderTextColor="#5A5A6E"
          />
          <TouchableOpacity style={styles.addCertBtn} onPress={addCertification}>
            <Ionicons name="add" size={24} color="#7C3AED" />
          </TouchableOpacity>
        </View>
        {formData.certifications.length > 0 && (
          <View style={styles.certList}>
            {formData.certifications.map((cert, index) => (
              <View key={index} style={styles.certItem}>
                <Text style={styles.certItemText}>{cert}</Text>
                <TouchableOpacity onPress={() => setFormData(prev => ({ ...prev, certifications: prev.certifications.filter((_, i) => i !== index) }))}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  // Step 4: Services
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Vos services</Text>
      <Text style={styles.stepSubtitle}>Choisissez les services que vous souhaitez proposer</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, errors.services_offered && styles.inputLabelError]}>{t('apply.servicesOfferedLabel')}</Text>
        <View style={[styles.servicesGrid, errors.services_offered && styles.servicesGridError]}>
          {SERVICES_OPTIONS.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[styles.serviceCard, formData.services_offered.includes(service.id) && styles.serviceCardActive]}
              onPress={() => {
                toggleArrayItem(formData.services_offered, service.id, (arr) => setFormData(prev => ({ ...prev, services_offered: arr })));
                clearError('services_offered');
              }}
            >
              <Ionicons name={service.icon as any} size={24} color={formData.services_offered.includes(service.id) ? '#FFFFFF' : '#7C3AED'} />
              <Text style={[styles.serviceLabel, formData.services_offered.includes(service.id) && styles.serviceLabelActive]}>{service.label}</Text>
              {formData.services_offered.includes(service.id) && (
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={styles.serviceCheck} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        {errors.services_offered && <Text style={styles.errorText}>{t("apply.selectService")}</Text>}
      </View>
      
      {formData.services_offered.includes('mentoring') && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tarif horaire (mentorat)</Text>
          <View style={styles.priceRow}>
            {[25, 50, 75, 100, 150, 200].map((price) => (
              <TouchableOpacity
                key={price}
                style={[styles.priceBtn, formData.hourly_rate === price && styles.priceBtnActive]}
                onPress={() => setFormData(prev => ({ ...prev, hourly_rate: price }))}
              >
                <Text style={[styles.priceBtnText, formData.hourly_rate === price && styles.priceBtnTextActive]}>
                  ${price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t("apply.availability")}</Text>
        <View style={styles.availabilityRow}>
          {[
            { id: 'full_time', label: 'Temps plein' },
            { id: 'part_time', label: 'Temps partiel' },
            { id: 'weekends', label: 'Week-ends' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.availabilityBtn, formData.availability === opt.id && styles.availabilityBtnActive]}
              onPress={() => setFormData(prev => ({ ...prev, availability: opt.id }))}
            >
              <Text style={[styles.availabilityBtnText, formData.availability === opt.id && styles.availabilityBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.commissionInfo}>
        <Ionicons name="information-circle" size={20} color="#F59E0B" />
        <Text style={styles.commissionText}>
          {t('pro.commissionNotice') || `Mentova takes a ${(proInfo?.commission_rate || 0.25) * 100}% commission on each transaction.`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("apply.becomeMentor")}</Text>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={styles.progressStep}>
              <View style={[styles.progressDot, step >= s && styles.progressDotActive]}>
                {step > s ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.progressDotText, step >= s && styles.progressDotTextActive]}>{s}</Text>
                )}
              </View>
              {s < 4 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
            </View>
          ))}
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, step >= 1 && styles.progressLabelActive]}>{t("apply.profileStep")}</Text>
          <Text style={[styles.progressLabel, step >= 2 && styles.progressLabelActive]}>{t("apply.expertiseStep")}</Text>
          <Text style={[styles.progressLabel, step >= 3 && styles.progressLabelActive]}>{t("apply.credibilityStep")}</Text>
          <Text style={[styles.progressLabel, step >= 4 && styles.progressLabelActive]}>Services</Text>
        </View>
        
        {/* Step Content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        
        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          {step > 1 && (
            <Pressable 
              style={styles.prevBtn} 
              onPress={() => setStep(step - 1)}
            >
              <Ionicons name="arrow-back" size={20} color="#8B8B9E" />
              <Text style={styles.prevBtnText}>{t("apply.previous")}</Text>
            </Pressable>
          )}
          
          {step < 4 ? (
            <View 
              style={styles.nextBtn}
              // @ts-ignore
              onClick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                const isValid = validateStep(step);
                if (isValid) {
                  setStep(step + 1);
                }
              }}
            >
              <View style={[styles.nextBtnGradient, { backgroundColor: '#7C3AED', cursor: 'pointer' }]}>
                <Text style={styles.nextBtnText}>{t("apply.next")}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            </View>
          ) : (
            <View 
              style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
              // @ts-ignore
              onClick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loading) {
                  const isValid = validateStep(4);
                  if (isValid) {
                    handleSubmit();
                  }
                }
              }}
            >
              <View style={[styles.nextBtnGradient, { backgroundColor: '#10B981', cursor: 'pointer' }]}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.nextBtnText}>Soumettre ma candidature</Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("apply.selectCountryTitle")}</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, selectedCountry?.code === item.code && styles.countryItemActive]}
                  onPress={() => selectCountry(item)}
                >
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCode}>{item.phone}</Text>
                  {selectedCountry?.code === item.code && (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginLeft: 12 },
  
  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 8 },
  progressStep: { flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2A2A4E' },
  progressDotActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  progressDotText: { fontSize: 12, fontWeight: '600', color: '#5A5A6E' },
  progressDotTextActive: { color: '#FFFFFF' },
  progressLine: { width: 40, height: 3, backgroundColor: '#2A2A4E', marginHorizontal: 4 },
  progressLineActive: { backgroundColor: '#7C3AED' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, marginTop: 8 },
  progressLabel: { fontSize: 11, color: '#5A5A6E' },
  progressLabelActive: { color: '#C4C4C4' },
  
  // Step Content
  stepContent: { padding: 20 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: '#8B8B9E', marginBottom: 24 },
  
  // Input
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#C4C4C4', marginBottom: 8 },
  inputLabelError: { color: '#EF4444' },
  input: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#2A2A4E' },
  inputError: { borderColor: '#EF4444', borderWidth: 2 },
  inputDisabled: { opacity: 0.6, backgroundColor: '#15152A' },
  inputHint: { fontSize: 12, color: '#C4C4C4', marginTop: 6 },
  textArea: { height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#5A5A6E', textAlign: 'right', marginTop: 4 },
  charCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  charCountError: { color: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 6 },
  
  // Select Button (Country)
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A2E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#2A2A4E' },
  selectBtnText: { fontSize: 15, color: '#5A5A6E' },
  selectBtnTextActive: { fontSize: 15, color: '#FFFFFF' },
  
  // Phone
  phoneRow: { flexDirection: 'row', gap: 10 },
  phoneRowError: { borderRadius: 12, borderWidth: 2, borderColor: '#EF4444', padding: 2, margin: -2 },
  phoneCode: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#2A2A4E', justifyContent: 'center' },
  phoneCodeText: { fontSize: 15, color: '#7C3AED', fontWeight: '600' },
  phoneInput: { flex: 1 },
  
  // Chips
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipContainerError: { padding: 8, borderRadius: 12, borderWidth: 2, borderColor: '#EF4444', margin: -8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E' },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: 13, color: '#8B8B9E' },
  chipTextActive: { color: '#FFFFFF' },
  
  // Expertise
  expertiseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  expertiseGridError: { padding: 8, borderRadius: 16, borderWidth: 2, borderColor: '#EF4444', margin: -8 },
  expertiseCard: { width: (width - 52) / 2, padding: 16, borderRadius: 14, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E', alignItems: 'center' },
  expertiseCardActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  expertiseLabel: { fontSize: 13, color: '#C4C4C4', marginTop: 8 },
  expertiseLabelActive: { color: '#FFFFFF' },
  
  // Experience
  experienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  experienceBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E' },
  experienceBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  experienceBtnText: { fontSize: 13, color: '#8B8B9E' },
  experienceBtnTextActive: { color: '#FFFFFF' },
  
  // Certifications
  certRow: { flexDirection: 'row', gap: 10 },
  addCertBtn: { width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  certList: { marginTop: 12, gap: 8 },
  certItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A2E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  certItemText: { fontSize: 13, color: '#FFFFFF', flex: 1 },
  
  // Services
  servicesGrid: { gap: 12 },
  servicesGridError: { padding: 8, borderRadius: 16, borderWidth: 2, borderColor: '#EF4444', margin: -8 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E' },
  serviceCardActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  serviceLabel: { fontSize: 15, color: '#C4C4C4', marginLeft: 12, flex: 1 },
  serviceLabelActive: { color: '#FFFFFF' },
  serviceCheck: { marginLeft: 8 },
  
  // Price
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E' },
  priceBtnActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  priceBtnText: { fontSize: 13, color: '#8B8B9E' },
  priceBtnTextActive: { color: '#FFFFFF' },
  
  // Availability
  availabilityRow: { flexDirection: 'row', gap: 10 },
  availabilityBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4E', alignItems: 'center' },
  availabilityBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  availabilityBtnText: { fontSize: 13, color: '#8B8B9E' },
  availabilityBtnTextActive: { color: '#FFFFFF' },
  
  // Commission
  commissionInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, marginTop: 10 },
  commissionText: { flex: 1, fontSize: 13, color: '#F59E0B', lineHeight: 18 },
  
  // Navigation
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, gap: 12 },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20 },
  prevBtnText: { fontSize: 15, color: '#8B8B9E' },
  nextBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  nextBtnTouchable: { borderRadius: 14, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  nextBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A4E' },
  countryItemActive: { backgroundColor: 'rgba(16,185,129,0.1)' },
  countryName: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  countryCode: { fontSize: 14, color: '#7C3AED', marginRight: 12 },
  
  // Existing Application
  existingAppCard: { margin: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1A1A2E' },
  existingAppGradient: { padding: 30, alignItems: 'center' },
  existingAppStatus: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 12 },
  existingAppDate: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  existingAppDetails: { padding: 20 },
  existingAppLabel: { fontSize: 12, color: '#8B8B9E', marginTop: 12 },
  existingAppValue: { fontSize: 15, color: '#FFFFFF', marginTop: 4 },
  adminNotesBox: { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 10, padding: 12, marginTop: 8 },
  adminNotesText: { fontSize: 13, color: '#F59E0B', lineHeight: 18 },
  
  // Success Screen
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 16 },
  successMessage: { fontSize: 16, color: '#C4C4C4', textAlign: 'center', lineHeight: 24, marginBottom: 12 },
  successSubMessage: { fontSize: 14, color: '#8B8B9E', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  successBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  successBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  successBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
