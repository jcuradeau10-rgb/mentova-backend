import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category?: string;
  impact?: 'bullish' | 'bearish' | 'neutral';
  image_url?: string;
  published_at: string;
  link?: string;
}

interface NewsFeedProps {
  news: NewsItem[];
  onNewsPress: (news: NewsItem) => void;
  onViewAll: () => void;
  title: string;
  viewAllText: string;
}

const IMPACT_CONFIG = {
  bullish: { color: '#00D9A5', icon: 'trending-up' as const, label: 'Haussier' },
  bearish: { color: '#EF4444', icon: 'trending-down' as const, label: 'Baissier' },
  neutral: { color: '#8B8B9E', icon: 'remove' as const, label: 'Neutre' },
};

export default function NewsFeed({
  news,
  onNewsPress,
  onViewAll,
  title,
  viewAllText,
}: NewsFeedProps) {
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}j`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMins > 0) return `${diffMins}min`;
    return 'maintenant';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="newspaper" size={18} color="#FF6B35" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN DIRECT</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onViewAll} data-testid="news-view-all-btn">
          <Text style={styles.viewAll}>{viewAllText}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.newsScroll}
      >
        {news.slice(0, 5).map((item, index) => {
          const impactConfig = item.impact ? IMPACT_CONFIG[item.impact] : null;
          return (
            <TouchableOpacity
              key={item.id || index}
              style={styles.newsCard}
              onPress={() => onNewsPress(item)}
              activeOpacity={0.8}
              data-testid={`news-card-${index}`}
            >
              <LinearGradient
                colors={['rgba(42, 42, 78, 0.8)', 'rgba(26, 26, 46, 0.95)']}
                style={styles.cardGradient}
              >
                {item.image_url && (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.newsImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.newsContent}>
                  <View style={styles.newsMetaRow}>
                    <Text style={styles.newsSource}>{item.source}</Text>
                    <Text style={styles.newsTime}>{formatTimeAgo(item.published_at)}</Text>
                  </View>
                  <Text style={styles.newsTitle} numberOfLines={3}>
                    {item.title}
                  </Text>
                  {impactConfig && (
                    <View style={[styles.impactBadge, { backgroundColor: `${impactConfig.color}15` }]}>
                      <Ionicons name={impactConfig.icon} size={12} color={impactConfig.color} />
                      <Text style={[styles.impactText, { color: impactConfig.color }]}>
                        {impactConfig.label}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  viewAll: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '600',
  },
  newsScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  newsCard: {
    width: 280,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGradient: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.15)',
    overflow: 'hidden',
  },
  newsImage: {
    width: '100%',
    height: 120,
  },
  newsContent: {
    padding: 14,
  },
  newsMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newsSource: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newsTime: {
    fontSize: 11,
    color: '#8B8B9E',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 10,
  },
  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  impactText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
