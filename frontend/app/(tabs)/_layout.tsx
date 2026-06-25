import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Animated, TouchableOpacity, Text, Pressable, PanResponder, Dimensions, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from '../../store/languageStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import InstallPWAPrompt from '../../components/InstallPWAPrompt';

interface TabIconProps {
  color: string;
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  isVip?: boolean;
}

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

function AnimatedTabIcon({ color, focused, icon, labelKey, isVip }: TabIconProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: -4,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  return (
    <Animated.View style={[
      styles.tabIconContainer,
      { transform: [{ scale: scaleAnim }, { translateY: translateYAnim }] }
    ]}>
      {isVip && focused ? (
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          style={styles.tabIconBgActive}
        >
          <Ionicons name={icon} size={22} color="#1A0A2E" />
        </LinearGradient>
      ) : focused ? (
        <View style={[styles.tabIconBgActive, { backgroundColor: '#7C3AED' }]}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
      ) : (
        <Ionicons name={icon} size={22} color={isVip ? '#FFD700' : color} />
      )}
    </Animated.View>
  );
}

// Modern Floating Action Menu - draggable with glass-morphism
const FAB_SIZE = 52;
const FAB_STORAGE_KEY = 'fab_position_v3';
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 70;
const SAFE_MARGIN = 16;
const MENU_ITEM_SIZE = 44;
const MENU_RADIUS = 72;

function FloatingMenu({ isVip, isPro, router }: { isVip: boolean; isPro: boolean; router: any }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const defaultLeft = screenW - FAB_SIZE - SAFE_MARGIN;
  const defaultTop = screenH - FAB_SIZE - TAB_BAR_HEIGHT - SAFE_MARGIN - 8;
  const posX = useRef(new Animated.Value(defaultLeft)).current;
  const posY = useRef(new Animated.Value(defaultTop)).current;
  const currentPos = useRef({ x: defaultLeft, y: defaultTop });
  const dragStarted = useRef(false);
  const longPressTimer = useRef<any>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const lastTapTime = useRef(0);

  // Robust bounds - FAB always fully visible with margin
  const minX = SAFE_MARGIN;
  const maxX = screenW - FAB_SIZE - SAFE_MARGIN;
  const minY = SAFE_MARGIN + (Platform.OS === 'ios' ? 50 : 40);
  const maxY = screenH - FAB_SIZE - TAB_BAR_HEIGHT - SAFE_MARGIN;

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  // Subtle pulse animation when idle
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2000, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Glow animation
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  // Load saved position + validate against current screen
  useEffect(() => {
    AsyncStorage.getItem(FAB_STORAGE_KEY).then(saved => {
      if (saved) {
        try {
          const { x, y } = JSON.parse(saved);
          // Always re-clamp to current screen bounds
          const safeX = clamp(x, minX, maxX);
          const safeY = clamp(y, minY, maxY);
          posX.setValue(safeX);
          posY.setValue(safeY);
          currentPos.current = { x: safeX, y: safeY };
        } catch {
          resetToDefault();
        }
      } else {
        resetToDefault();
      }
    });
  }, [screenW, screenH]);

  // Re-clamp when screen dimensions change (rotation, resize)
  useEffect(() => {
    const { x, y } = currentPos.current;
    const safeX = clamp(x, minX, maxX);
    const safeY = clamp(y, minY, maxY);
    if (safeX !== x || safeY !== y) {
      Animated.spring(posX, { toValue: safeX, friction: 6, tension: 80, useNativeDriver: false }).start();
      Animated.spring(posY, { toValue: safeY, friction: 6, tension: 80, useNativeDriver: false }).start();
      savePosition(safeX, safeY);
    }
  }, [screenW, screenH]);

  const resetToDefault = () => {
    const defX = clamp(screenW - FAB_SIZE - SAFE_MARGIN, minX, maxX);
    const defY = clamp(screenH - FAB_SIZE - TAB_BAR_HEIGHT - SAFE_MARGIN - 8, minY, maxY);
    posX.setValue(defX);
    posY.setValue(defY);
    currentPos.current = { x: defX, y: defY };
    AsyncStorage.setItem(FAB_STORAGE_KEY, JSON.stringify({ x: defX, y: defY }));
  };

  const savePosition = (x: number, y: number) => {
    currentPos.current = { x, y };
    AsyncStorage.setItem(FAB_STORAGE_KEY, JSON.stringify({ x, y }));
  };

  const snapToEdge = (x: number, y: number) => {
    const snapX = x < screenW / 2 ? SAFE_MARGIN : screenW - FAB_SIZE - SAFE_MARGIN;
    const snapY = clamp(y, minY, maxY);
    Animated.spring(posX, { toValue: snapX, friction: 6, tension: 80, useNativeDriver: false }).start();
    Animated.spring(posY, { toValue: snapY, friction: 6, tension: 80, useNativeDriver: false }).start();
    savePosition(snapX, snapY);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return dragStarted.current && (Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3);
      },
      onPanResponderGrant: () => {
        dragOffset.current = { x: currentPos.current.x, y: currentPos.current.y };
        hasMoved.current = false;
      },
      onPanResponderMove: (_, gs) => {
        if (!dragStarted.current) return;
        hasMoved.current = true;
        setIsDragging(true);
        const newX = clamp(dragOffset.current.x + gs.dx, minX, maxX);
        const newY = clamp(dragOffset.current.y + gs.dy, minY, maxY);
        posX.setValue(newX);
        posY.setValue(newY);
        currentPos.current = { x: newX, y: newY };
      },
      onPanResponderRelease: (_, gs) => {
        if (dragStarted.current && hasMoved.current) {
          const finalX = clamp(dragOffset.current.x + gs.dx, minX, maxX);
          const finalY = clamp(dragOffset.current.y + gs.dy, minY, maxY);
          snapToEdge(finalX, finalY);
        }
        dragStarted.current = false;
        setIsDragging(false);
        hasMoved.current = false;
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: false }).start();
      },
    })
  ).current;

  const handlePressIn = () => {
    longPressTimer.current = setTimeout(() => {
      dragStarted.current = true;
      Animated.spring(scaleAnim, { toValue: 1.2, friction: 5, useNativeDriver: false }).start();
    }, 300);
  };

  const handlePressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!dragStarted.current && !isDragging && !hasMoved.current) {
      // Double-tap to reset position
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        resetToDefault();
        lastTapTime.current = 0;
        return;
      }
      lastTapTime.current = now;
      toggle();
    }
  };

  const toggle = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animValue, { toValue, friction: 5, tension: 100, useNativeDriver: false }).start();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
    Animated.spring(animValue, { toValue: 0, friction: 5, useNativeDriver: false }).start();
  };

  const navigateAndClose = (path: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    closeMenu();
    router.push(path);
  };

  // Build menu items
  const items: { icon: string; label: string; color: string; path: string; testId: string }[] = [];
  if (isVip) items.push({ icon: 'diamond', label: 'VIP Hub', color: '#FFD700', path: '/vip/hub', testId: 'fab-vip' });
  if (isPro) items.push({ icon: 'briefcase', label: 'Mentor', color: '#10B981', path: '/pro/dashboard', testId: 'fab-pro' });
  if (!isPro) items.push({ icon: 'school', label: 'Devenir Pro', color: '#8B5CF6', path: '/pro/join', testId: 'fab-mentor' });

  if (items.length === 0) return null;

  // Determine if FAB is on the left or right side, and if near top or bottom
  const fabCenterX = currentPos.current.x + FAB_SIZE / 2;
  const fabCenterY = currentPos.current.y + FAB_SIZE / 2;
  const isOnRight = fabCenterX > screenW / 2;
  const isNearBottom = fabCenterY > screenH * 0.6;

  // Calculate radial positions for menu items based on FAB position
  const getItemPosition = (index: number, total: number) => {
    // Arc direction: items always expand AWAY from nearest corner
    // Angles in screen coords: 0=right, 90=down, 180=left, 270=up
    const startAngle = isOnRight
      ? (isNearBottom ? 225 : 135) // bottom-right: up-left, top-right: down-left
      : (isNearBottom ? 315 : 45); // bottom-left: up-right, top-left: down-right
    const spreadAngle = total <= 2 ? 40 : 35;
    const angle = startAngle + (index * spreadAngle);
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * MENU_RADIUS,
      y: Math.sin(rad) * MENU_RADIUS,
    };
  };

  const accentColor = isVip ? '#FFD700' : isPro ? '#10B981' : '#7C3AED';
  const accentDark = isVip ? '#B8860B' : isPro ? '#059669' : '#5B21B6';

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <>
      {isOpen && !isDragging && (
        <Pressable style={fabStyles.backdrop} onPress={closeMenu} />
      )}

      <Animated.View
        style={[
          fabStyles.container,
          {
            left: posX,
            top: posY,
            transform: [{ scale: isDragging ? scaleAnim : (isOpen ? scaleAnim : pulseAnim) }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Glow ring behind FAB */}
        {!isDragging && !isOpen && (
          <Animated.View style={[fabStyles.glowRing, {
            backgroundColor: accentColor,
            opacity: glowOpacity,
          }]} />
        )}

        {/* Radial menu items */}
        {!isDragging && items.map((item, index) => {
          const pos = getItemPosition(index, items.length);
          const tX = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, pos.x] });
          const tY = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, pos.y] });
          const sc = animValue.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.3, 1] });
          return (
            <Animated.View
              key={item.testId}
              style={[
                fabStyles.menuItemRadial,
                {
                  transform: [{ translateX: tX }, { translateY: tY }, { scale: sc }],
                  opacity: animValue,
                },
              ]}
            >
              <Pressable
                onPress={() => navigateAndClose(item.path)}
                data-testid={item.testId}
                style={fabStyles.menuItemPressable}
              >
                <View style={[fabStyles.menuItemCircle, { backgroundColor: item.color + '20', borderColor: item.color + '60' }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Animated.View style={[fabStyles.menuLabelPill, { opacity: animValue }]}>
                  <Text style={[fabStyles.menuLabelText, { color: item.color }]}>{item.label}</Text>
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Main FAB button */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={fabStyles.mainBtn}
          data-testid="fab-main-toggle"
        >
          <View style={[
            fabStyles.mainOuter,
            { borderColor: accentColor + '40' },
            isDragging && fabStyles.dragging,
          ]}>
            <LinearGradient
              colors={[accentColor, accentDark] as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={fabStyles.mainGradient}
            >
              <Animated.View style={{
                transform: [{
                  rotate: animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] })
                }]
              }}>
                <Ionicons
                  name={isDragging ? 'move' : 'add'}
                  size={24}
                  color={isVip ? '#1A0A2E' : '#FFF'}
                />
              </Animated.View>
            </LinearGradient>
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}

const fabStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  glowRing: {
    position: 'absolute',
    width: FAB_SIZE + 16,
    height: FAB_SIZE + 16,
    borderRadius: (FAB_SIZE + 16) / 2,
    top: -8,
    left: -8,
  },
  mainBtn: {
    zIndex: 10,
  },
  mainOuter: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 2,
    padding: 2,
    overflow: 'hidden',
  },
  mainGradient: {
    flex: 1,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragging: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  menuItemRadial: {
    position: 'absolute',
    zIndex: 5,
    alignItems: 'center',
  },
  menuItemPressable: {
    alignItems: 'center',
    gap: 4,
  },
  menuItemCircle: {
    width: MENU_ITEM_SIZE,
    height: MENU_ITEM_SIZE,
    borderRadius: MENU_ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(10,10,26,0.85)',
  },
  menuLabelPill: {
    backgroundColor: 'rgba(10,10,26,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default function TabLayout() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { t, language, isLoaded } = useTranslation();
  
  const isVip = user?.is_vip || false;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isPro = user?.is_professional || false;

  // Wait for language to be loaded
  if (!isLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', opacity: 0.5 }} />
      </View>
    );
  }

  // Define tab labels with translations - these will update when language changes
  const tabLabels = {
    home: t('nav.home'),
    market: t('nav.market'),
    news: t('nav.news'),
    community: t('nav.community'),
    learn: t('nav.learn'),
    ai: t('nav.ai'),
    profile: t('nav.profile'),
  };

  // More menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;

  const toggleMoreMenu = () => {
    if (showMoreMenu) {
      closeMoreMenu();
    } else {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowMoreMenu(true);
      Animated.parallel([
        Animated.spring(moreMenuAnim, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      // Staggered item animations
      itemAnims.forEach((anim, i) => {
        anim.setValue(0);
        Animated.spring(anim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
          delay: i * 60,
        }).start();
      });
    }
  };

  const closeMoreMenu = () => {
    Animated.parallel([
      Animated.timing(moreMenuAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowMoreMenu(false));
    itemAnims.forEach(anim => anim.setValue(0));
  };

  const navigateMore = (path: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeMoreMenu();
    router.push(path as any);
  };

  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = false; // Disabled - using CSS phone frame instead

  return (
    <View style={styles.container}>
      <InstallPWAPrompt />
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
        {/* LEFT SIDE */}
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
        <Tabs.Screen
          name="mentors"
          options={{
            title: t('nav.mentors') || 'Mentors',
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t('nav.mentors') || 'Mentors'}</Text>
            ),
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={focused ? '#FFF' : '#5A5A6E'} />
              </View>
            ),
          }}
        />

        {/* CENTER - More button placeholder tab */}
        <Tabs.Screen
          name="market"
          options={{
            title: 'More',
            tabBarLabel: () => null,
            tabBarIcon: () => null,
            tabBarButton: () => (
              <View style={styles.centerBtnSpace}>
                <TouchableOpacity
                  style={styles.centerBtn}
                  onPress={toggleMoreMenu}
                  activeOpacity={0.8}
                  data-testid="center-more-btn"
                >
                  <LinearGradient
                    colors={showMoreMenu ? ['#5B21B6', '#7C3AED'] : ['#7C3AED', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.centerBtnGradient}
                  >
                    <Animated.View style={{
                      transform: [{
                        rotate: moreMenuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] })
                      }]
                    }}>
                      <Ionicons name="add" size={28} color="#FFF" />
                    </Animated.View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        {/* RIGHT SIDE */}
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

        {/* Hidden tabs */}
        <Tabs.Screen name="news" options={{ href: null }} />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="ai" options={{ href: null }} />
      </Tabs>

      {/* Premium More Menu Overlay */}
      {showMoreMenu && (
        <>
          <Animated.View style={[styles.moreBackdrop, { opacity: backdropAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMoreMenu} />
          </Animated.View>
          <Animated.View style={[
            styles.moreMenuContainer,
            {
              opacity: moreMenuAnim,
              transform: [
                { translateY: moreMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
              ],
            },
          ]}>
            {/* Menu Header */}
            <View style={styles.moreMenuHeader}>
              <View style={styles.moreMenuHandle} />
              <Text style={styles.moreMenuTitle}>Menu</Text>
            </View>

            {/* Menu Grid */}
            <View style={styles.moreGrid}>
              {[
                { icon: 'chatbubble-ellipses', label: 'Messages', gradient: ['#7C3AED', '#A855F7'] as [string, string], path: '/messages', testId: 'more-messages' },
                { icon: 'newspaper', label: t('nav.news'), gradient: ['#2563EB', '#3B82F6'] as [string, string], path: '/(tabs)/news', testId: 'more-news' },
                { icon: 'chatbubbles', label: 'Forum', gradient: ['#DB2777', '#EC4899'] as [string, string], path: '/(tabs)/community', testId: 'more-forum' },
                { icon: 'school', label: t('nav.learn'), gradient: ['#D97706', '#F59E0B'] as [string, string], path: '/(tabs)/learn', testId: 'more-learn' },
                { icon: 'storefront', label: 'Shop', gradient: ['#7C3AED', '#A855F7'] as [string, string], path: '/marketplace', testId: 'more-marketplace' },
                ...(isVip ? [{ icon: 'diamond', label: 'VIP Hub', gradient: ['#B8860B', '#FFD700'] as [string, string], path: '/vip/hub', testId: 'more-vip' }] : []),
                ...(isPro ? [{ icon: 'briefcase', label: 'Mentor', gradient: ['#059669', '#10B981'] as [string, string], path: '/mentor-dashboard', testId: 'more-mentor' }] : []),
                ...(isAdmin ? [{ icon: 'shield-checkmark', label: 'Admin', gradient: ['#DC2626', '#EF4444'] as [string, string], path: '/admin', testId: 'more-admin' }] : []),
              ].map((item, index) => (
                <Animated.View
                  key={item.testId}
                  style={{
                    opacity: itemAnims[index] || new Animated.Value(1),
                    transform: [
                      { scale: (itemAnims[index] || new Animated.Value(1)).interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                      { translateY: (itemAnims[index] || new Animated.Value(1)).interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                    ],
                  }}
                >
                  <TouchableOpacity
                    style={styles.moreGridItem}
                    onPress={() => navigateMore(item.path)}
                    testID={item.testId}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={item.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.moreGridIconGradient}
                    >
                      <Ionicons name={item.icon as any} size={24} color="#FFF" />
                    </LinearGradient>
                    <Text style={styles.moreGridLabel}>{item.label}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  tabBar: {
    backgroundColor: '#06060F',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
    paddingHorizontal: 4,
    elevation: 0,
    borderTopColor: 'rgba(124, 58, 237, 0.06)',
    borderTopWidth: 1,
  },
  tabBarItem: {
    paddingTop: 6,
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

  // Center More Button
  centerBtnSpace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -14,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 16px rgba(124, 58, 237, 0.5)',
    } : {}),
  },
  centerBtnGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#06060F',
  },

  // More Menu - Premium Design
  moreBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 998,
  },
  moreMenuContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(12, 12, 32, 0.95)',
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    zIndex: 999,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 0px 40px rgba(124, 58, 237, 0.15), 0px 20px 60px rgba(0,0,0,0.5)',
    } : {}),
  },
  moreMenuHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  moreMenuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    marginBottom: 12,
  },
  moreMenuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  moreGridItem: {
    alignItems: 'center',
    width: 72,
    gap: 8,
  },
  moreGridIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D0D0E0',
    letterSpacing: 0.3,
  },

  // Legacy (unused but kept for reference)
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconBgActive: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


const desktopStyles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: '#0a0a14',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    paddingTop: 20,
    paddingBottom: 20,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  sidebarNav: {
    paddingHorizontal: 10,
    gap: 4,
  },
  sidebarItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  sidebarLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500' as const,
  },
  sidebarLabelActive: {
    color: '#FFF',
    fontWeight: '700' as const,
  },
  sidebarVip: {
    paddingHorizontal: 16,
    marginTop: 'auto' as any,
    paddingTop: 16,
  },
  sidebarVipGrad: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sidebarVipText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#000',
  },
  mainContent: {
    maxWidth: 600,
    marginHorizontal: 'auto' as any,
  },
});
