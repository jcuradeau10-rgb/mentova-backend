import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface CryptoPrice {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
}

interface CryptoTickerProps {
  prices: CryptoPrice[];
  onCryptoPress: (crypto: CryptoPrice) => void;
  onViewAll: () => void;
  title: string;
  viewAllText: string;
}

export default function CryptoTicker({
  prices,
  onCryptoPress,
  onViewAll,
  title,
  viewAllText,
}: CryptoTickerProps) {
  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="trending-up" size={18} color="#00D9A5" />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <TouchableOpacity onPress={onViewAll} data-testid="crypto-view-all-btn">
          <Text style={styles.viewAll}>{viewAllText}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tickerScroll}
      >
        {prices.slice(0, 8).map((crypto, index) => {
          const isPositive = crypto.price_change_percentage_24h >= 0;
          return (
            <TouchableOpacity
              key={crypto.id}
              style={styles.cryptoCard}
              onPress={() => onCryptoPress(crypto)}
              activeOpacity={0.8}
              data-testid={`crypto-card-${crypto.symbol}`}
            >
              <LinearGradient
                colors={['rgba(42, 42, 78, 0.8)', 'rgba(26, 26, 46, 0.9)']}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <Image source={{ uri: crypto.image }} style={styles.cryptoIcon} />
                  <View style={styles.cryptoInfo}>
                    <Text style={styles.cryptoSymbol}>{crypto.symbol.toUpperCase()}</Text>
                    <Text style={styles.cryptoName} numberOfLines={1}>{crypto.name}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cryptoPrice}>{formatPrice(crypto.current_price)}</Text>
                  <View style={[
                    styles.changeContainer,
                    { backgroundColor: isPositive ? 'rgba(0, 217, 165, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
                  ]}>
                    <Ionicons
                      name={isPositive ? 'caret-up' : 'caret-down'}
                      size={12}
                      color={isPositive ? '#00D9A5' : '#EF4444'}
                    />
                    <Text style={[
                      styles.changeText,
                      { color: isPositive ? '#00D9A5' : '#EF4444' }
                    ]}>
                      {Math.abs(crypto.price_change_percentage_24h).toFixed(1)}%
                    </Text>
                  </View>
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
    marginTop: 8,
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
    backgroundColor: 'rgba(0, 217, 165, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAll: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '600',
  },
  tickerScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cryptoCard: {
    width: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cryptoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  cryptoInfo: {
    marginLeft: 10,
    flex: 1,
  },
  cryptoSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cryptoName: {
    fontSize: 11,
    color: '#8B8B9E',
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cryptoPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
