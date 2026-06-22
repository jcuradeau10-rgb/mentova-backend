import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CryptoCardProps {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  image: string;
  marketCap: number;
}

export default function CryptoCard({ name, symbol, price, change24h, image, marketCap }: CryptoCardProps) {
  const isPositive = change24h >= 0;

  const formatPrice = (value: number) => {
    if (value >= 1) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${value.toFixed(6)}`;
  };

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Image source={{ uri: image }} style={styles.icon} />
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.symbol}>{symbol.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <View style={[styles.changeContainer, isPositive ? styles.positive : styles.negative]}>
          <Ionicons 
            name={isPositive ? 'trending-up' : 'trending-down'} 
            size={12} 
            color={isPositive ? '#00D9A5' : '#FF4757'} 
          />
          <Text style={[styles.change, isPositive ? styles.positiveText : styles.negativeText]}>
            {isPositive ? '+' : ''}{change24h.toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nameContainer: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  symbol: {
    color: '#8B8B9E',
    fontSize: 13,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positive: {
    backgroundColor: 'rgba(0, 217, 165, 0.15)',
  },
  negative: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  change: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  positiveText: {
    color: '#00D9A5',
  },
  negativeText: {
    color: '#FF4757',
  },
});
