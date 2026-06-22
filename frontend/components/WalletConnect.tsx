import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';
import { useTranslation } from '../store/languageStore';

// WalletConnect Project ID
const WALLETCONNECT_PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || 'e899c82be21d4acca2c8aec45e893598';

// Storage keys
const WALLET_STORAGE_KEY = '@mentova_wallet_address';

interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  isConnected: boolean;
}

interface WalletConnectProps {
  onConnect?: (walletInfo: WalletInfo) => void;
  onDisconnect?: () => void;
}

// Supported wallets with deep links
const WALLETS = [
  { 
    id: 'metamask',
    name: 'MetaMask',
    icon: 'logo-bitcoin',
    color: '#E2761B',
    deepLink: 'metamask://',
    webLink: 'https://metamask.io/download/'
  },
  { 
    id: 'rainbow',
    name: 'Rainbow',
    icon: 'color-palette',
    color: '#001E59',
    deepLink: 'rainbow://',
    webLink: 'https://rainbow.me/'
  },
  { 
    id: 'trust',
    name: 'Trust Wallet',
    icon: 'shield-checkmark',
    color: '#3375BB',
    deepLink: 'trust://',
    webLink: 'https://trustwallet.com/'
  },
  { 
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: 'wallet',
    color: '#0052FF',
    deepLink: 'cbwallet://',
    webLink: 'https://www.coinbase.com/wallet'
  },
];

export default function WalletConnectComponent({ onConnect, onDisconnect }: WalletConnectProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved wallet on mount
  useEffect(() => {
    loadSavedWallet();
  }, []);

  const loadSavedWallet = async () => {
    try {
      const savedAddress = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      if (savedAddress && ethers.utils.isAddress(savedAddress)) {
        const balance = await fetchBalance(savedAddress);
        const info: WalletInfo = {
          address: savedAddress,
          balance,
          chainId: 1,
          isConnected: true,
        };
        setWalletInfo(info);
        onConnect?.(info);
      }
    } catch (err) {
      console.log('No saved wallet found');
    }
  };

  const fetchBalance = async (address: string): Promise<string> => {
    try {
      // Use public RPC endpoint
      const provider = new ethers.providers.JsonRpcProvider(process.env.EXPO_PUBLIC_ETH_RPC_URL || 'https://eth.llamarpc.com');
      const balance = await provider.getBalance(address);
      return ethers.utils.formatEther(balance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      return '0';
    }
  };

  const handleWalletSelect = async (wallet: typeof WALLETS[0]) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check if app is installed
      const canOpen = await Linking.canOpenURL(wallet.deepLink);
      
      if (canOpen) {
        // Open wallet app
        await Linking.openURL(wallet.deepLink);
        // Note: Real WalletConnect implementation would use URI scheme
        // For now, show manual input
        setShowManualInput(true);
      } else {
        // Redirect to download
        if (Platform.OS === 'web') {
          window.open(wallet.webLink, '_blank');
        } else {
          await Linking.openURL(wallet.webLink);
        }
      }
    } catch (err) {
      setError('Impossible de connecter le wallet. Essayez l\'option manuelle.');
      setShowManualInput(true);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualConnect = async () => {
    if (!manualAddress) {
      setError('Veuillez entrer une adresse de wallet');
      return;
    }

    // Validate address
    if (!ethers.utils.isAddress(manualAddress)) {
      setError('Adresse de wallet invalide');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const checksumAddress = ethers.utils.getAddress(manualAddress);
      const balance = await fetchBalance(checksumAddress);
      
      const info: WalletInfo = {
        address: checksumAddress,
        balance,
        chainId: 1,
        isConnected: true,
      };

      // Save to storage
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, checksumAddress);
      
      setWalletInfo(info);
      setShowModal(false);
      setShowManualInput(false);
      setManualAddress('');
      onConnect?.(info);
    } catch (err) {
      setError(t('wallet.connectionError'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
      setWalletInfo(null);
      onDisconnect?.();
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (walletInfo?.address) {
      if (Platform.OS === 'web') {
        navigator.clipboard.writeText(walletInfo.address);
      } else {
        Clipboard.setString(walletInfo.address);
      }
    }
  };

  // Connected state
  if (walletInfo?.isConnected) {
    return (
      <View style={styles.connectedContainer}>
        <LinearGradient
          colors={['rgba(0, 217, 165, 0.15)', 'rgba(0, 217, 165, 0.05)']}
          style={styles.connectedGradient}
        >
          <View style={styles.connectedHeader}>
            <View style={styles.connectedIcon}>
              <Ionicons name="wallet" size={24} color="#00D9A5" />
            </View>
            <View style={styles.connectedInfo}>
              <Text style={styles.connectedLabel}>{t('wallet.connected')}</Text>
              <TouchableOpacity onPress={copyAddress} style={styles.addressRow}>
                <Text style={styles.connectedAddress}>{formatAddress(walletInfo.address)}</Text>
                <Ionicons name="copy-outline" size={14} color="#8B8B9E" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance ETH</Text>
            <Text style={styles.balanceValue}>
              {parseFloat(walletInfo.balance).toFixed(4)} ETH
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.disconnectBtn}
            onPress={handleDisconnect}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.disconnectText}>{t('wallet.disconnect')}</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // Disconnected state
  return (
    <>
      <TouchableOpacity 
        style={styles.connectBtn}
        onPress={() => setShowModal(true)}
        data-testid="wallet-connect-btn"
      >
        <LinearGradient
          colors={['#7C3AED', '#9F7AEA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.connectGradient}
        >
          <Ionicons name="wallet-outline" size={20} color="#FFF" />
          <Text style={styles.connectText}>{t('wallet.connectWallet')}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Wallet Selection Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('wallet.connectTitle')}</Text>
              <TouchableOpacity onPress={() => {
                setShowModal(false);
                setShowManualInput(false);
                setError(null);
              }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={18} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!showManualInput ? (
              <>
                <Text style={styles.modalSubtitle}>
                  {t('wallet.selectWallet')}
                </Text>

                <View style={styles.walletList}>
                  {WALLETS.map((wallet) => (
                    <TouchableOpacity
                      key={wallet.id}
                      style={styles.walletItem}
                      onPress={() => handleWalletSelect(wallet)}
                      disabled={isConnecting}
                    >
                      <View style={[styles.walletIcon, { backgroundColor: `${wallet.color}20` }]}>
                        <Ionicons name={wallet.icon as any} size={24} color={wallet.color} />
                      </View>
                      <Text style={styles.walletName}>{wallet.name}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#5A5A6E" />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.manualBtn}
                  onPress={() => setShowManualInput(true)}
                >
                  <Text style={styles.manualBtnText}>
                    {t("wallet.enterManually")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>
                  {t("wallet.enterEthAddress")}
                </Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="wallet-outline" size={20} color="#8B8B9E" />
                  <View style={styles.textInputWrapper}>
                    {Platform.OS === 'web' ? (
                      <input
                        type="text"
                        placeholder="0x..."
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#FFF',
                          fontSize: 14,
                          outline: 'none',
                          fontFamily: 'monospace',
                        }}
                      />
                    ) : (
                      <Text style={styles.inputText}>{manualAddress || '0x...'}</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, isConnecting && styles.submitBtnDisabled]}
                  onPress={handleManualConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.submitBtnText}>{t('wallet.connectBtn')}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => {
                    setShowManualInput(false);
                    setError(null);
                  }}
                >
                  <Text style={styles.backBtnText}>{t('wallet.backToWallets')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  connectBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  connectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  connectText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  connectedContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  connectedGradient: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.3)',
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectedIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 217, 165, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedInfo: {
    marginLeft: 12,
    flex: 1,
  },
  connectedLabel: {
    fontSize: 12,
    color: '#00D9A5',
    fontWeight: '600',
    marginBottom: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectedAddress: {
    fontSize: 14,
    color: '#FFF',
    fontFamily: 'monospace',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#8B8B9E',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  disconnectText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8B8B9E',
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
  walletList: {
    gap: 12,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(42, 42, 78, 0.6)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 14,
  },
  manualBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  manualBtnText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(42, 42, 78, 0.6)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    marginBottom: 16,
    gap: 12,
  },
  textInputWrapper: {
    flex: 1,
  },
  inputText: {
    color: '#8B8B9E',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#8B8B9E',
    fontSize: 14,
  },
});
