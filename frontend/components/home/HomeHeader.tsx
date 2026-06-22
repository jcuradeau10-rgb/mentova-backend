import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface HomeHeaderProps {
  userName: string;
  userAvatar?: string;
  isVip?: boolean;
  isPro?: boolean;
  greeting: string;
  onNotificationPress: () => void;
  onProfilePress: () => void;
}

export default function HomeHeader({
  userName,
  userAvatar,
  isVip,
  isPro,
  greeting,
  onNotificationPress,
  onProfilePress,
}: HomeHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.profileSection} onPress={onProfilePress}>
        <View style={styles.avatarContainer}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={['#7C3AED', '#9F7AEA']}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarInitial}>
                {userName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
          )}
          {isVip && (
            <View style={styles.vipBadge}>
              <Ionicons name="diamond" size={10} color="#FFD700" />
            </View>
          )}
        </View>
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {userName || 'User'}
            </Text>
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.notificationBtn} 
        onPress={onNotificationPress}
        data-testid="home-notification-btn"
      >
        <View style={styles.notificationIconContainer}>
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vipBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 3,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  greetingContainer: {
    marginLeft: 14,
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#8B8B9E',
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 150,
  },
  proBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  notificationBtn: {
    marginLeft: 12,
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
});
