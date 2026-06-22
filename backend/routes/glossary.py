"""
Glossary route – serves crypto glossary terms with definitions and examples in FR/EN/ES.
"""
from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/glossary", tags=["glossary"])

GLOSSARY = [
    {
        "term": {"fr": "Blockchain", "en": "Blockchain", "es": "Blockchain"},
        "definition": {
            "fr": "Un registre numerique distribue et immuable qui enregistre toutes les transactions de maniere transparente et securisee.",
            "en": "A distributed and immutable digital ledger that records all transactions transparently and securely.",
            "es": "Un libro digital distribuido e inmutable que registra todas las transacciones de manera transparente y segura."
        },
        "example": {
            "fr": "Bitcoin utilise une blockchain pour enregistrer chaque transfert de BTC entre utilisateurs, sans banque intermediaire.",
            "en": "Bitcoin uses a blockchain to record every BTC transfer between users, without an intermediary bank.",
            "es": "Bitcoin utiliza una blockchain para registrar cada transferencia de BTC entre usuarios, sin un banco intermediario."
        }
    },
    {
        "term": {"fr": "Bitcoin", "en": "Bitcoin", "es": "Bitcoin"},
        "definition": {
            "fr": "La premiere et plus connue des cryptomonnaies, creee en 2009 par Satoshi Nakamoto. Souvent appelee 'or numerique'.",
            "en": "The first and most well-known cryptocurrency, created in 2009 by Satoshi Nakamoto. Often called 'digital gold'.",
            "es": "La primera y mas conocida criptomoneda, creada en 2009 por Satoshi Nakamoto. A menudo llamada 'oro digital'."
        },
        "example": {
            "fr": "En 2021, le Bitcoin a atteint un sommet historique de 69 000$. Beaucoup l'utilisent comme reserve de valeur.",
            "en": "In 2021, Bitcoin reached an all-time high of $69,000. Many use it as a store of value.",
            "es": "En 2021, Bitcoin alcanzo un maximo historico de $69,000. Muchos lo usan como reserva de valor."
        }
    },
    {
        "term": {"fr": "Ethereum", "en": "Ethereum", "es": "Ethereum"},
        "definition": {
            "fr": "Plateforme de contrats intelligents et deuxieme plus grande cryptomonnaie. Permet de creer des applications decentralisees (dApps).",
            "en": "Smart contract platform and second largest cryptocurrency. Allows creating decentralized applications (dApps).",
            "es": "Plataforma de contratos inteligentes y segunda criptomoneda mas grande. Permite crear aplicaciones descentralizadas (dApps)."
        },
        "example": {
            "fr": "Uniswap, un exchange decentralise, fonctionne sur la blockchain Ethereum grace aux smart contracts.",
            "en": "Uniswap, a decentralized exchange, runs on the Ethereum blockchain thanks to smart contracts.",
            "es": "Uniswap, un exchange descentralizado, funciona en la blockchain de Ethereum gracias a los smart contracts."
        }
    },
    {
        "term": {"fr": "Wallet", "en": "Wallet", "es": "Wallet"},
        "definition": {
            "fr": "Un portefeuille numerique qui stocke les cles privees permettant d'acceder a vos cryptomonnaies et d'effectuer des transactions.",
            "en": "A digital wallet that stores the private keys allowing you to access your cryptocurrencies and make transactions.",
            "es": "Una billetera digital que almacena las claves privadas que le permiten acceder a sus criptomonedas y realizar transacciones."
        },
        "example": {
            "fr": "MetaMask est un wallet populaire qui s'installe comme extension de navigateur pour interagir avec Ethereum.",
            "en": "MetaMask is a popular wallet that installs as a browser extension to interact with Ethereum.",
            "es": "MetaMask es una billetera popular que se instala como extension de navegador para interactuar con Ethereum."
        }
    },
    {
        "term": {"fr": "DeFi", "en": "DeFi", "es": "DeFi"},
        "definition": {
            "fr": "Finance Decentralisee. Ensemble de services financiers (prets, echanges, epargne) fonctionnant sur la blockchain sans intermediaire traditionnel.",
            "en": "Decentralized Finance. A set of financial services (loans, exchanges, savings) operating on the blockchain without traditional intermediaries.",
            "es": "Finanzas Descentralizadas. Un conjunto de servicios financieros (prestamos, intercambios, ahorros) que operan en la blockchain sin intermediarios tradicionales."
        },
        "example": {
            "fr": "Sur Aave (protocole DeFi), tu peux deposer de l'ETH et gagner des interets sans passer par une banque.",
            "en": "On Aave (DeFi protocol), you can deposit ETH and earn interest without going through a bank.",
            "es": "En Aave (protocolo DeFi), puedes depositar ETH y ganar intereses sin pasar por un banco."
        }
    },
    {
        "term": {"fr": "NFT", "en": "NFT", "es": "NFT"},
        "definition": {
            "fr": "Non-Fungible Token. Jeton numerique unique sur la blockchain representant la propriete d'un actif (art, musique, collectible).",
            "en": "Non-Fungible Token. A unique digital token on the blockchain representing ownership of an asset (art, music, collectible).",
            "es": "Token No Fungible. Un token digital unico en la blockchain que representa la propiedad de un activo (arte, musica, coleccionable)."
        },
        "example": {
            "fr": "Les Bored Ape Yacht Club sont des NFTs celebres : chaque image de singe est unique et s'est vendue pour des milliers de dollars.",
            "en": "Bored Ape Yacht Club are famous NFTs: each monkey image is unique and has sold for thousands of dollars.",
            "es": "Los Bored Ape Yacht Club son NFTs famosos: cada imagen de mono es unica y se ha vendido por miles de dolares."
        }
    },
    {
        "term": {"fr": "Smart Contract", "en": "Smart Contract", "es": "Smart Contract"},
        "definition": {
            "fr": "Programme auto-executable stocke sur la blockchain qui s'execute automatiquement lorsque des conditions predefinies sont remplies.",
            "en": "Self-executing program stored on the blockchain that automatically executes when predefined conditions are met.",
            "es": "Programa autoejecutado almacenado en la blockchain que se ejecuta automaticamente cuando se cumplen condiciones predefinidas."
        },
        "example": {
            "fr": "Un smart contract peut automatiquement envoyer un paiement a un vendeur quand l'acheteur confirme la reception du produit.",
            "en": "A smart contract can automatically send payment to a seller when the buyer confirms receipt of the product.",
            "es": "Un smart contract puede enviar automaticamente un pago al vendedor cuando el comprador confirma la recepcion del producto."
        }
    },
    {
        "term": {"fr": "Staking", "en": "Staking", "es": "Staking"},
        "definition": {
            "fr": "Action de verrouiller ses cryptomonnaies pour participer a la validation du reseau et gagner des recompenses en retour.",
            "en": "The action of locking your cryptocurrencies to participate in network validation and earn rewards in return.",
            "es": "La accion de bloquear sus criptomonedas para participar en la validacion de la red y ganar recompensas a cambio."
        },
        "example": {
            "fr": "En stakant 32 ETH, tu deviens validateur sur Ethereum et tu gagnes environ 4% d'interets annuels.",
            "en": "By staking 32 ETH, you become a validator on Ethereum and earn approximately 4% annual interest.",
            "es": "Al hacer staking de 32 ETH, te conviertes en validador en Ethereum y ganas aproximadamente un 4% de interes anual."
        }
    },
    {
        "term": {"fr": "Altcoin", "en": "Altcoin", "es": "Altcoin"},
        "definition": {
            "fr": "Toute cryptomonnaie autre que Bitcoin. Inclut Ethereum, Solana, Cardano et des milliers d'autres projets.",
            "en": "Any cryptocurrency other than Bitcoin. Includes Ethereum, Solana, Cardano and thousands of other projects.",
            "es": "Cualquier criptomoneda que no sea Bitcoin. Incluye Ethereum, Solana, Cardano y miles de otros proyectos."
        },
        "example": {
            "fr": "Solana (SOL) est un altcoin rapide et peu couteux, souvent utilise pour les NFTs et les applications DeFi.",
            "en": "Solana (SOL) is a fast and low-cost altcoin, often used for NFTs and DeFi applications.",
            "es": "Solana (SOL) es un altcoin rapido y de bajo costo, frecuentemente utilizado para NFTs y aplicaciones DeFi."
        }
    },
    {
        "term": {"fr": "Halving", "en": "Halving", "es": "Halving"},
        "definition": {
            "fr": "Evenement programmé qui divise par deux la recompense des mineurs Bitcoin, environ tous les 4 ans. Reduit l'inflation du BTC.",
            "en": "A programmed event that halves the Bitcoin miners' reward, approximately every 4 years. Reduces BTC inflation.",
            "es": "Un evento programado que reduce a la mitad la recompensa de los mineros de Bitcoin, aproximadamente cada 4 anos. Reduce la inflacion de BTC."
        },
        "example": {
            "fr": "Apres le halving d'avril 2024, la recompense est passee de 6.25 BTC a 3.125 BTC par bloc. Historiquement, les prix montent apres un halving.",
            "en": "After the April 2024 halving, the reward went from 6.25 BTC to 3.125 BTC per block. Historically, prices rise after a halving.",
            "es": "Despues del halving de abril 2024, la recompensa paso de 6.25 BTC a 3.125 BTC por bloque. Historicamente, los precios suben despues de un halving."
        }
    },
    {
        "term": {"fr": "HODL", "en": "HODL", "es": "HODL"},
        "definition": {
            "fr": "Argot crypto signifiant 'Hold On for Dear Life'. Strategie consistant a garder ses cryptos a long terme malgre la volatilite.",
            "en": "Crypto slang meaning 'Hold On for Dear Life'. A strategy of keeping your crypto long-term despite volatility.",
            "es": "Argot cripto que significa 'Hold On for Dear Life'. Una estrategia de mantener tus criptomonedas a largo plazo a pesar de la volatilidad."
        },
        "example": {
            "fr": "Ceux qui ont HODL le Bitcoin depuis 2017 a 5 000$ l'ont vu monter a plus de 100 000$ en 2025.",
            "en": "Those who HODLed Bitcoin since 2017 at $5,000 saw it rise to over $100,000 in 2025.",
            "es": "Quienes hicieron HODL con Bitcoin desde 2017 a $5,000 lo vieron subir a mas de $100,000 en 2025."
        }
    },
    {
        "term": {"fr": "Gas", "en": "Gas", "es": "Gas"},
        "definition": {
            "fr": "Frais payes pour executer des transactions ou des smart contracts sur Ethereum. Mesure en Gwei.",
            "en": "Fees paid to execute transactions or smart contracts on Ethereum. Measured in Gwei.",
            "es": "Tarifas pagadas para ejecutar transacciones o smart contracts en Ethereum. Se mide en Gwei."
        },
        "example": {
            "fr": "Un swap sur Uniswap peut couter entre 5$ et 50$ de gas selon la congestion du reseau Ethereum.",
            "en": "A swap on Uniswap can cost between $5 and $50 in gas depending on Ethereum network congestion.",
            "es": "Un intercambio en Uniswap puede costar entre $5 y $50 de gas segun la congestion de la red Ethereum."
        }
    },
    {
        "term": {"fr": "Token", "en": "Token", "es": "Token"},
        "definition": {
            "fr": "Unite numerique creee sur une blockchain existante (ex: ERC-20 sur Ethereum). Peut representer une monnaie, un droit de vote, etc.",
            "en": "A digital unit created on an existing blockchain (e.g., ERC-20 on Ethereum). Can represent a currency, voting rights, etc.",
            "es": "Una unidad digital creada en una blockchain existente (ej: ERC-20 en Ethereum). Puede representar una moneda, derechos de voto, etc."
        },
        "example": {
            "fr": "USDT (Tether) est un token ERC-20 sur Ethereum dont la valeur est indexee sur le dollar americain (stablecoin).",
            "en": "USDT (Tether) is an ERC-20 token on Ethereum whose value is pegged to the US dollar (stablecoin).",
            "es": "USDT (Tether) es un token ERC-20 en Ethereum cuyo valor esta vinculado al dolar estadounidense (stablecoin)."
        }
    },
    {
        "term": {"fr": "Stablecoin", "en": "Stablecoin", "es": "Stablecoin"},
        "definition": {
            "fr": "Cryptomonnaie dont la valeur est adossee a un actif stable comme le dollar. Offre la stabilite dans un marche volatile.",
            "en": "A cryptocurrency whose value is pegged to a stable asset like the dollar. Offers stability in a volatile market.",
            "es": "Una criptomoneda cuyo valor esta vinculado a un activo estable como el dolar. Ofrece estabilidad en un mercado volatil."
        },
        "example": {
            "fr": "USDC et USDT sont des stablecoins populaires. 1 USDC = 1 dollar, ce qui permet de securiser ses gains sans quitter le monde crypto.",
            "en": "USDC and USDT are popular stablecoins. 1 USDC = 1 dollar, allowing you to secure gains without leaving the crypto world.",
            "es": "USDC y USDT son stablecoins populares. 1 USDC = 1 dolar, lo que permite asegurar ganancias sin salir del mundo cripto."
        }
    },
    {
        "term": {"fr": "Mining", "en": "Mining", "es": "Mineria"},
        "definition": {
            "fr": "Processus de validation des transactions sur une blockchain Proof-of-Work en resolvant des calculs complexes. Recompense en crypto.",
            "en": "The process of validating transactions on a Proof-of-Work blockchain by solving complex calculations. Rewarded in crypto.",
            "es": "El proceso de validacion de transacciones en una blockchain Proof-of-Work resolviendo calculos complejos. Recompensado en cripto."
        },
        "example": {
            "fr": "Les mineurs de Bitcoin utilisent des machines specialisees (ASICs) qui consomment beaucoup d'electricite pour valider les blocs.",
            "en": "Bitcoin miners use specialized machines (ASICs) that consume a lot of electricity to validate blocks.",
            "es": "Los mineros de Bitcoin usan maquinas especializadas (ASICs) que consumen mucha electricidad para validar bloques."
        }
    },
    {
        "term": {"fr": "Whale", "en": "Whale", "es": "Ballena"},
        "definition": {
            "fr": "Investisseur ou entite detenant une tres grande quantite de cryptomonnaie, capable d'influencer le marche.",
            "en": "An investor or entity holding a very large amount of cryptocurrency, capable of influencing the market.",
            "es": "Un inversor o entidad que posee una cantidad muy grande de criptomonedas, capaz de influir en el mercado."
        },
        "example": {
            "fr": "Quand une whale deplace 10 000 BTC vers un exchange, le marche peut paniquer car cela suggere une vente massive.",
            "en": "When a whale moves 10,000 BTC to an exchange, the market can panic as it suggests a massive sell-off.",
            "es": "Cuando una ballena mueve 10,000 BTC a un exchange, el mercado puede entrar en panico ya que sugiere una venta masiva."
        }
    },
    {
        "term": {"fr": "Bull Market", "en": "Bull Market", "es": "Mercado Alcista"},
        "definition": {
            "fr": "Periode prolongee de hausse des prix sur les marches. L'optimisme domine et les investisseurs achetent massivement.",
            "en": "An extended period of rising prices in markets. Optimism dominates and investors buy massively.",
            "es": "Un periodo prolongado de aumento de precios en los mercados. El optimismo domina y los inversores compran masivamente."
        },
        "example": {
            "fr": "Le bull market de 2020-2021 a vu le Bitcoin passer de 10 000$ a 69 000$ en moins de 18 mois.",
            "en": "The 2020-2021 bull market saw Bitcoin go from $10,000 to $69,000 in less than 18 months.",
            "es": "El mercado alcista de 2020-2021 vio a Bitcoin pasar de $10,000 a $69,000 en menos de 18 meses."
        }
    },
    {
        "term": {"fr": "Bear Market", "en": "Bear Market", "es": "Mercado Bajista"},
        "definition": {
            "fr": "Periode prolongee de baisse des prix. La peur domine et les investisseurs vendent ou attendent.",
            "en": "An extended period of falling prices. Fear dominates and investors sell or wait.",
            "es": "Un periodo prolongado de caida de precios. El miedo domina y los inversores venden o esperan."
        },
        "example": {
            "fr": "Pendant le bear market de 2022, le Bitcoin est passe de 69 000$ a 16 000$. C'est souvent le meilleur moment pour accumuler.",
            "en": "During the 2022 bear market, Bitcoin went from $69,000 to $16,000. It's often the best time to accumulate.",
            "es": "Durante el mercado bajista de 2022, Bitcoin paso de $69,000 a $16,000. A menudo es el mejor momento para acumular."
        }
    },
    {
        "term": {"fr": "ATH", "en": "ATH", "es": "ATH"},
        "definition": {
            "fr": "All-Time High. Le prix le plus eleve jamais atteint par une cryptomonnaie dans son histoire.",
            "en": "All-Time High. The highest price ever reached by a cryptocurrency in its history.",
            "es": "All-Time High. El precio mas alto jamas alcanzado por una criptomoneda en su historia."
        },
        "example": {
            "fr": "En 2025, le Bitcoin a depasse son ATH precedent pour atteindre un nouveau record au-dessus de 100 000$.",
            "en": "In 2025, Bitcoin surpassed its previous ATH to reach a new record above $100,000.",
            "es": "En 2025, Bitcoin supero su ATH anterior para alcanzar un nuevo record por encima de $100,000."
        }
    },
    {
        "term": {"fr": "Liquidation", "en": "Liquidation", "es": "Liquidacion"},
        "definition": {
            "fr": "Cloture forcee d'une position a effet de levier lorsque le prix va contre le trader au-dela de sa marge.",
            "en": "Forced closure of a leveraged position when the price moves against the trader beyond their margin.",
            "es": "Cierre forzado de una posicion apalancada cuando el precio se mueve en contra del trader mas alla de su margen."
        },
        "example": {
            "fr": "Un trader en levier x10 sur le BTC est liquide si le prix baisse de seulement 10%. Le levier amplifie les gains ET les pertes.",
            "en": "A trader with 10x leverage on BTC is liquidated if the price drops by just 10%. Leverage amplifies gains AND losses.",
            "es": "Un trader con apalancamiento 10x en BTC es liquidado si el precio cae solo un 10%. El apalancamiento amplifica ganancias Y perdidas."
        }
    },
]


@router.get("/terms")
async def get_glossary_terms(lang: Optional[str] = "fr"):
    """Return all glossary terms for a given language."""
    result = []
    for entry in GLOSSARY:
        result.append({
            "term": entry["term"].get(lang, entry["term"]["en"]),
            "definition": entry["definition"].get(lang, entry["definition"]["en"]),
            "example": entry["example"].get(lang, entry["example"]["en"]),
        })
    return {"terms": result, "count": len(result)}
