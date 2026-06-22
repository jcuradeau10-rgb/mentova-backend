import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface VipBannerProps {
  isVip: boolean;
  daysRemaining?: number;
  onPress: () => void;
  vipTitle: string;
  vipSubtitle: string;
  becomeVipText: string;
  accessHubText: string;
  daysRemainingText: string;
}

export default function VipBanner({
  isVip,
  daysRemaining,
  onPress,
  vipTitle,
  vipSubtitle,
  becomeVipText,
  accessHubText,
  daysRemainingText,
}: VipBannerProps) {
  if (isVip) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.9}
        data-testid="vip-banner-active"
      >
        <LinearGradient
          colors={['#FFD700', '#FFA500', '#FF8C00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.vipGradient}
        >
          <View style={styles.vipContent}>
            <View style={styles.vipIconContainer}>
              <Ionicons name="diamond" size={28} color="#1A0A2E" />
            </View>
            <View style={styles.vipTextContainer}>
              <Text style={styles.vipTitle}>{vipTitle}</Text>
              {daysRemaining && (
                <Text style={styles.vipDays}>
                  {daysRemaining} {daysRemainingText}
                </Text>
              )}
            </View>
            <View style={styles.accessBtn}>
              <Text style={styles.accessBtnText}>{accessHubText}</Text>
              <Ionicons name="arrow-forward" size={16} color="#1A0A2E" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
      data-testid="vip-banner-promo"
    >
      <LinearGradient
        colors={['rgba(124, 58, 237, 0.2)', 'rgba(159, 122, 234, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.promoGradient}
      >
        <View style={styles.promoContent}>
          <View style={styles.promoIconContainer}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.promoIconGradient}
            >
              <Ionicons name="diamond" size={24} color="#1A0A2E" />
            </LinearGradient>
          </View>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>{becomeVipText}</Text>
            <Text style={styles.promoSubtitle}>{vipSubtitle}</Text>
          </View>
          <View style={styles.promoArrow}>
            <Ionicons name="chevron-forward" size={24} color="#FFD700" />
          </View>
        </View>
        
        {/* Decorative elements */}
        <View style={styles.glowEffect} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  vipGradient: {
    padding: 20,
    borderRadius: 20,
  },
  vipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vipIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 10, 46, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  vipTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A0A2E',
  },
  vipDays: {
    fontSize: 13,
    color: '#1A0A2E',
    opacity: 0.8,
    marginTop: 2,
  },
  accessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 10, 46, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  accessBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A0A2E',
  },
  promoGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoIconContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  promoIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  promoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  promoSubtitle: {
    fontSize: 13,
    color: '#8B8B9E',
    marginTop: 3,
  },
  promoArrow: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowEffect: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
});
