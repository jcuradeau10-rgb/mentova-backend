import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Text, View, StyleSheet, Modal, TouchableOpacity, Pressable, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../store/languageStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GlossaryTerm {
  term: string;
  definition: string;
  example: string;
}

interface GlossaryTextProps {
  text: string;
  style?: any;
}

// Static glossary embedded directly — no network fetch needed
const STATIC_GLOSSARY: Record<string, GlossaryTerm[]> = {
  en: [
    { term: "Blockchain", definition: "A distributed and immutable digital ledger that records all transactions transparently and securely.", example: "Bitcoin uses a blockchain to record every BTC transfer between users, without an intermediary bank." },
    { term: "Bitcoin", definition: "The first and most well-known cryptocurrency, created in 2009 by Satoshi Nakamoto. Often called 'digital gold'.", example: "In 2021, Bitcoin reached an all-time high of $69,000. Many use it as a store of value." },
    { term: "Ethereum", definition: "Smart contract platform and second largest cryptocurrency. Allows creating decentralized applications (dApps).", example: "Uniswap, a decentralized exchange, runs on the Ethereum blockchain thanks to smart contracts." },
    { term: "Smart Contract", definition: "Self-executing program stored on the blockchain that automatically executes when predefined conditions are met.", example: "A smart contract can automatically send payment to a seller when the buyer confirms receipt of the product." },
    { term: "Stablecoin", definition: "A cryptocurrency whose value is pegged to a stable asset like the dollar. Offers stability in a volatile market.", example: "USDC and USDT are popular stablecoins. 1 USDC = 1 dollar, allowing you to secure gains without leaving the crypto world." },
    { term: "Bull Market", definition: "An extended period of rising prices in markets. Optimism dominates and investors buy massively.", example: "The 2020-2021 bull market saw Bitcoin go from $10,000 to $69,000 in less than 18 months." },
    { term: "Bear Market", definition: "An extended period of falling prices. Fear dominates and investors sell or wait.", example: "During the 2022 bear market, Bitcoin went from $69,000 to $16,000. It's often the best time to accumulate." },
    { term: "Wallet", definition: "A digital wallet that stores the private keys allowing you to access your cryptocurrencies and make transactions.", example: "MetaMask is a popular wallet that installs as a browser extension to interact with Ethereum." },
    { term: "DeFi", definition: "Decentralized Finance. A set of financial services (loans, exchanges, savings) operating on the blockchain without traditional intermediaries.", example: "On Aave (DeFi protocol), you can deposit ETH and earn interest without going through a bank." },
    { term: "NFT", definition: "Non-Fungible Token. A unique digital token on the blockchain representing ownership of an asset (art, music, collectible).", example: "Bored Ape Yacht Club are famous NFTs: each monkey image is unique and has sold for thousands of dollars." },
    { term: "Staking", definition: "The action of locking your cryptocurrencies to participate in network validation and earn rewards in return.", example: "By staking 32 ETH, you become a validator on Ethereum and earn approximately 4% annual interest." },
    { term: "Altcoin", definition: "Any cryptocurrency other than Bitcoin. Includes Ethereum, Solana, Cardano and thousands of other projects.", example: "Solana (SOL) is a fast and low-cost altcoin, often used for NFTs and DeFi applications." },
    { term: "Halving", definition: "A programmed event that halves the Bitcoin miners' reward, approximately every 4 years. Reduces BTC inflation.", example: "After the April 2024 halving, the reward went from 6.25 BTC to 3.125 BTC per block." },
    { term: "HODL", definition: "Crypto slang meaning 'Hold On for Dear Life'. A strategy of keeping your crypto long-term despite volatility.", example: "Those who HODLed Bitcoin since 2017 at $5,000 saw it rise to over $100,000 in 2025." },
    { term: "Gas", definition: "Fees paid to execute transactions or smart contracts on Ethereum. Measured in Gwei.", example: "A swap on Uniswap can cost between $5 and $50 in gas depending on Ethereum network congestion." },
    { term: "Token", definition: "A digital unit created on an existing blockchain (e.g., ERC-20 on Ethereum). Can represent a currency, voting rights, etc.", example: "USDT (Tether) is an ERC-20 token on Ethereum whose value is pegged to the US dollar." },
    { term: "Mining", definition: "The process of validating transactions on a Proof-of-Work blockchain by solving complex calculations. Rewarded in crypto.", example: "Bitcoin miners use specialized machines (ASICs) that consume a lot of electricity to validate blocks." },
    { term: "Whale", definition: "An investor or entity holding a very large amount of cryptocurrency, capable of influencing the market.", example: "When a whale moves 10,000 BTC to an exchange, the market can panic as it suggests a massive sell-off." },
    { term: "ATH", definition: "All-Time High. The highest price ever reached by a cryptocurrency in its history.", example: "In 2025, Bitcoin surpassed its previous ATH to reach a new record above $100,000." },
    { term: "Liquidation", definition: "Forced closure of a leveraged position when the price moves against the trader beyond their margin.", example: "A trader with 10x leverage on BTC is liquidated if the price drops by just 10%." },
  ],
  fr: [
    { term: "Blockchain", definition: "Un registre numerique distribue et immuable qui enregistre toutes les transactions de maniere transparente et securisee.", example: "Bitcoin utilise une blockchain pour enregistrer chaque transfert de BTC entre utilisateurs, sans banque intermediaire." },
    { term: "Bitcoin", definition: "La premiere et plus connue des cryptomonnaies, creee en 2009 par Satoshi Nakamoto. Souvent appelee 'or numerique'.", example: "En 2021, le Bitcoin a atteint un sommet historique de 69 000$. Beaucoup l'utilisent comme reserve de valeur." },
    { term: "Ethereum", definition: "Plateforme de contrats intelligents et deuxieme plus grande cryptomonnaie. Permet de creer des applications decentralisees (dApps).", example: "Uniswap, un exchange decentralise, fonctionne sur la blockchain Ethereum grace aux smart contracts." },
    { term: "Smart Contract", definition: "Programme auto-executable stocke sur la blockchain qui s'execute automatiquement lorsque des conditions predefinies sont remplies.", example: "Un smart contract peut automatiquement envoyer un paiement a un vendeur quand l'acheteur confirme la reception du produit." },
    { term: "Stablecoin", definition: "Cryptomonnaie dont la valeur est adossee a un actif stable comme le dollar. Offre la stabilite dans un marche volatile.", example: "USDC et USDT sont des stablecoins populaires. 1 USDC = 1 dollar, ce qui permet de securiser ses gains sans quitter le monde crypto." },
    { term: "Bull Market", definition: "Periode prolongee de hausse des prix sur les marches. L'optimisme domine et les investisseurs achetent massivement.", example: "Le bull market de 2020-2021 a vu le Bitcoin passer de 10 000$ a 69 000$ en moins de 18 mois." },
    { term: "Bear Market", definition: "Periode prolongee de baisse des prix. La peur domine et les investisseurs vendent ou attendent.", example: "Pendant le bear market de 2022, le Bitcoin est passe de 69 000$ a 16 000$. C'est souvent le meilleur moment pour accumuler." },
    { term: "Wallet", definition: "Un portefeuille numerique qui stocke les cles privees permettant d'acceder a vos cryptomonnaies et d'effectuer des transactions.", example: "MetaMask est un wallet populaire qui s'installe comme extension de navigateur pour interagir avec Ethereum." },
    { term: "DeFi", definition: "Finance Decentralisee. Ensemble de services financiers (prets, echanges, epargne) fonctionnant sur la blockchain sans intermediaire traditionnel.", example: "Sur Aave (protocole DeFi), tu peux deposer de l'ETH et gagner des interets sans passer par une banque." },
    { term: "NFT", definition: "Non-Fungible Token. Jeton numerique unique sur la blockchain representant la propriete d'un actif (art, musique, collectible).", example: "Les Bored Ape Yacht Club sont des NFTs celebres : chaque image de singe est unique et s'est vendue pour des milliers de dollars." },
    { term: "Staking", definition: "Action de verrouiller ses cryptomonnaies pour participer a la validation du reseau et gagner des recompenses en retour.", example: "En stakant 32 ETH, tu deviens validateur sur Ethereum et tu gagnes environ 4% d'interets annuels." },
    { term: "Altcoin", definition: "Toute cryptomonnaie autre que Bitcoin. Inclut Ethereum, Solana, Cardano et des milliers d'autres projets.", example: "Solana (SOL) est un altcoin rapide et peu couteux, souvent utilise pour les NFTs et les applications DeFi." },
    { term: "Halving", definition: "Evenement programme qui divise par deux la recompense des mineurs Bitcoin, environ tous les 4 ans.", example: "Apres le halving d'avril 2024, la recompense est passee de 6.25 BTC a 3.125 BTC par bloc." },
    { term: "HODL", definition: "Argot crypto signifiant 'Hold On for Dear Life'. Strategie consistant a garder ses cryptos a long terme malgre la volatilite.", example: "Ceux qui ont HODL le Bitcoin depuis 2017 a 5 000$ l'ont vu monter a plus de 100 000$ en 2025." },
    { term: "Gas", definition: "Frais payes pour executer des transactions ou des smart contracts sur Ethereum. Mesure en Gwei.", example: "Un swap sur Uniswap peut couter entre 5$ et 50$ de gas selon la congestion du reseau Ethereum." },
    { term: "Token", definition: "Unite numerique creee sur une blockchain existante (ex: ERC-20 sur Ethereum). Peut representer une monnaie, un droit de vote, etc.", example: "USDT (Tether) est un token ERC-20 sur Ethereum dont la valeur est indexee sur le dollar americain." },
    { term: "Mining", definition: "Processus de validation des transactions sur une blockchain Proof-of-Work en resolvant des calculs complexes.", example: "Les mineurs de Bitcoin utilisent des machines specialisees (ASICs) qui consomment beaucoup d'electricite pour valider les blocs." },
    { term: "Whale", definition: "Investisseur ou entite detenant une tres grande quantite de cryptomonnaie, capable d'influencer le marche.", example: "Quand une whale deplace 10 000 BTC vers un exchange, le marche peut paniquer car cela suggere une vente massive." },
    { term: "ATH", definition: "All-Time High. Le prix le plus eleve jamais atteint par une cryptomonnaie dans son histoire.", example: "En 2025, le Bitcoin a depasse son ATH precedent pour atteindre un nouveau record au-dessus de 100 000$." },
    { term: "Liquidation", definition: "Cloture forcee d'une position a effet de levier lorsque le prix va contre le trader au-dela de sa marge.", example: "Un trader en levier x10 sur le BTC est liquide si le prix baisse de seulement 10%." },
  ],
  es: [
    { term: "Blockchain", definition: "Un libro digital distribuido e inmutable que registra todas las transacciones de manera transparente y segura.", example: "Bitcoin utiliza una blockchain para registrar cada transferencia de BTC entre usuarios, sin un banco intermediario." },
    { term: "Bitcoin", definition: "La primera y mas conocida criptomoneda, creada en 2009 por Satoshi Nakamoto. A menudo llamada 'oro digital'.", example: "En 2021, Bitcoin alcanzo un maximo historico de $69,000. Muchos lo usan como reserva de valor." },
    { term: "Ethereum", definition: "Plataforma de contratos inteligentes y segunda criptomoneda mas grande.", example: "Uniswap funciona en la blockchain de Ethereum gracias a los smart contracts." },
    { term: "DeFi", definition: "Finanzas Descentralizadas. Servicios financieros que operan en la blockchain sin intermediarios tradicionales.", example: "En Aave puedes depositar ETH y ganar intereses sin pasar por un banco." },
    { term: "NFT", definition: "Token No Fungible. Un token digital unico en la blockchain que representa la propiedad de un activo.", example: "Los Bored Ape Yacht Club son NFTs famosos." },
    { term: "Staking", definition: "Bloquear criptomonedas para participar en la validacion de la red y ganar recompensas.", example: "Al hacer staking de 32 ETH, te conviertes en validador en Ethereum." },
    { term: "Wallet", definition: "Una billetera digital que almacena las claves privadas para acceder a tus criptomonedas.", example: "MetaMask es una billetera popular para interactuar con Ethereum." },
    { term: "HODL", definition: "Argot cripto que significa 'Hold On for Dear Life'. Mantener criptomonedas a largo plazo.", example: "Quienes hicieron HODL con Bitcoin desde 2017 lo vieron subir a mas de $100,000." },
    { term: "ATH", definition: "All-Time High. El precio mas alto jamas alcanzado por una criptomoneda.", example: "En 2025, Bitcoin supero su ATH anterior para alcanzar un nuevo record." },
    { term: "Gas", definition: "Tarifas pagadas para ejecutar transacciones en Ethereum. Se mide en Gwei.", example: "Un intercambio en Uniswap puede costar entre $5 y $50 de gas." },
  ],
};

function getTerms(lang: string): GlossaryTerm[] {
  return STATIC_GLOSSARY[lang] || STATIC_GLOSSARY['en'];
}

export default function GlossaryText({ text, style }: GlossaryTextProps) {
  const { language } = useTranslation();
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);

  const terms = useMemo(() => getTerms(language || 'en'), [language]);

  const segments = useMemo(() => {
    if (!terms.length || !text) return null;

    const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
    const result: { text: string; term: GlossaryTerm | null }[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      let earliestIdx = remaining.length;
      let matchedTerm: GlossaryTerm | null = null;
      let matchLen = 0;

      for (const t of sorted) {
        const lowerRemaining = remaining.toLowerCase();
        const lowerTerm = t.term.toLowerCase();
        const idx = lowerRemaining.indexOf(lowerTerm);
        if (idx !== -1 && idx < earliestIdx) {
          const charBefore = idx > 0 ? remaining[idx - 1] : ' ';
          const charAfter = idx + t.term.length < remaining.length ? remaining[idx + t.term.length] : ' ';
          const isBoundaryStart = /[\s.,;:!?()"\-'/\n*#_`\[\]]/.test(charBefore) || idx === 0;
          const isBoundaryEnd = /[\s.,;:!?()"\-'/\n*#_`\[\]]/.test(charAfter) || (idx + t.term.length === remaining.length);
          if (isBoundaryStart && isBoundaryEnd) {
            earliestIdx = idx;
            matchedTerm = t;
            matchLen = t.term.length;
          }
        }
      }

      if (!matchedTerm) {
        result.push({ text: remaining, term: null });
        break;
      }

      if (earliestIdx > 0) {
        result.push({ text: remaining.slice(0, earliestIdx), term: null });
      }
      result.push({ text: remaining.slice(earliestIdx, earliestIdx + matchLen), term: matchedTerm });
      remaining = remaining.slice(earliestIdx + matchLen);
    }
    return result.length > 1 ? result : null;
  }, [text, terms]);

  if (!segments) {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <>
      <Text style={style}>
        {segments.map((seg, i) =>
          seg.term ? (
            <Text
              key={`g${i}`}
              style={gs.highlighted}
              onPress={() => setSelectedTerm(seg.term)}
            >
              {seg.text}
            </Text>
          ) : (
            <Text key={`p${i}`}>{seg.text}</Text>
          )
        )}
      </Text>

      {selectedTerm && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedTerm(null)}
        >
          <Pressable style={gs.overlay} onPress={() => setSelectedTerm(null)}>
            <Pressable style={gs.popup} onPress={(e) => e.stopPropagation()}>
              <LinearGradient colors={['#1A1A2E', '#16213E']} style={gs.popupInner}>
                <View style={gs.popupHeader}>
                  <View style={gs.termBadge}>
                    <Ionicons name="book" size={16} color="#7C3AED" />
                    <Text style={gs.termText}>{selectedTerm.term}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedTerm(null)} style={gs.closeBtn}>
                    <Ionicons name="close" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <Text style={gs.defLabel}>
                  {language === 'fr' ? 'Definition' : language === 'es' ? 'Definicion' : 'Definition'}
                </Text>
                <Text style={gs.defText}>{selectedTerm.definition}</Text>

                <View style={gs.exampleBox}>
                  <Ionicons name="bulb" size={16} color="#F59E0B" />
                  <Text style={gs.exampleLabel}>
                    {language === 'fr' ? 'Exemple concret' : language === 'es' ? 'Ejemplo concreto' : 'Concrete example'}
                  </Text>
                </View>
                <Text style={gs.exampleText}>{selectedTerm.example}</Text>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const gs = StyleSheet.create({
  highlighted: {
    color: '#A78BFA',
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popup: {
    width: Math.min(SCREEN_WIDTH - 48, 400),
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  popupInner: { padding: 20 },
  popupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  termBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  termText: { color: '#A78BFA', fontSize: 17, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  defLabel: { color: '#6B7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  defText: { color: '#E5E7EB', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  exampleBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  exampleLabel: { color: '#F59E0B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleText: { color: '#9CA3AF', fontSize: 13, lineHeight: 20, fontStyle: 'italic', backgroundColor: 'rgba(245,158,11,0.06)', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#F59E0B', overflow: 'hidden' },
});
