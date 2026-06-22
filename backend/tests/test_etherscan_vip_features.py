"""
Test file for VIP Etherscan Integration Features
Tests:
1. Smart Money API returns real Etherscan transactions with tx_hash, whale_address, etherscan_tx_url
2. Copy Trading API returns traders with wallet_address and etherscan_url
3. Both APIs include 'coming_soon' message
"""
import pytest
import requests
import os

# Use the public URL from frontend env
BASE_URL = "https://academy-preview-11.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "admin@cryptonai.com"
TEST_PASSWORD = "Admin123!"

class TestEtherscanVIPFeatures:
    """Tests for real Etherscan integration in VIP features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token for VIP user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.is_authenticated = True
            self.user = login_response.json().get("user", {})
        else:
            self.is_authenticated = False
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ==================== SMART MONEY TESTS ====================
    
    def test_smart_money_api_returns_200(self):
        """Test that smart-money API returns 200 for VIP user"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Smart Money API returns 200 OK")
    
    def test_smart_money_has_coming_soon_message(self):
        """Test that smart-money API includes coming_soon message"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        assert "coming_soon" in data, "Response should include 'coming_soon' field"
        assert "whales" in data["coming_soon"].lower() or "traders" in data["coming_soon"].lower(), \
            f"coming_soon message should mention whales or traders: {data['coming_soon']}"
        print(f"✓ Smart Money coming_soon message: '{data['coming_soon']}'")
    
    def test_smart_money_returns_transactions_with_tx_hash(self):
        """Test that smart-money returns transactions with tx_hash (verifiable on Etherscan)"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data, "Response should include 'data' field"
        transactions = data["data"]
        
        if len(transactions) > 0:
            # Check first transaction has required fields
            tx = transactions[0]
            assert "tx_hash" in tx, "Transaction should have tx_hash field"
            assert tx["tx_hash"], "tx_hash should not be empty"
            assert tx["tx_hash"].startswith("0x"), f"tx_hash should start with 0x: {tx['tx_hash']}"
            assert len(tx["tx_hash"]) == 66, f"tx_hash should be 66 characters: {tx['tx_hash']}"
            print(f"✓ Found transaction with tx_hash: {tx['tx_hash']}")
        else:
            print("⚠ No transactions returned (possibly rate limited or no recent activity)")
    
    def test_smart_money_returns_whale_address(self):
        """Test that smart-money returns transactions with whale_address"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", [])
        
        if len(transactions) > 0:
            tx = transactions[0]
            assert "whale_address" in tx, "Transaction should have whale_address field"
            assert tx["whale_address"], "whale_address should not be empty"
            assert tx["whale_address"].startswith("0x"), f"whale_address should start with 0x: {tx['whale_address']}"
            assert len(tx["whale_address"]) == 42, f"whale_address should be 42 characters: {tx['whale_address']}"
            print(f"✓ Found whale_address: {tx['whale_address']}")
        else:
            print("⚠ No transactions returned")
    
    def test_smart_money_returns_etherscan_tx_url(self):
        """Test that smart-money returns etherscan_tx_url for verification"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", [])
        
        if len(transactions) > 0:
            tx = transactions[0]
            assert "etherscan_tx_url" in tx, "Transaction should have etherscan_tx_url field"
            assert tx["etherscan_tx_url"].startswith("https://etherscan.io/tx/"), \
                f"etherscan_tx_url should be valid Etherscan URL: {tx['etherscan_tx_url']}"
            print(f"✓ Etherscan TX URL: {tx['etherscan_tx_url']}")
        else:
            print("⚠ No transactions returned")
    
    def test_smart_money_returns_real_transactions(self):
        """Test that transactions are marked as real (is_real_transaction field)"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", [])
        
        if len(transactions) > 0:
            tx = transactions[0]
            assert tx.get("is_real_transaction") == True, \
                "Transaction should be marked as real (is_real_transaction=True)"
            print("✓ Transactions are marked as real (is_real_transaction=True)")
        else:
            print("⚠ No transactions returned")
    
    def test_smart_money_returns_known_whale_names(self):
        """Test that smart-money returns known whale names like Vitalik, Binance, etc"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check the whales list in response
        assert "whales" in data, "Response should include 'whales' list"
        whales = data["whales"]
        
        whale_names = [w["name"] for w in whales]
        known_names = ["Vitalik Buterin", "Binance Hot Wallet", "Binance Cold Wallet", 
                       "Coinbase Prime", "Kraken Hot Wallet"]
        
        found_known = [name for name in known_names if name in whale_names]
        assert len(found_known) >= 3, f"Should have at least 3 known whales, found: {found_known}"
        print(f"✓ Found known whales: {found_known}")
    
    def test_smart_money_summary_contains_volumes(self):
        """Test that smart-money returns buy/sell volume summary"""
        response = self.session.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data, "Response should include 'summary' field"
        
        summary = data["summary"]
        assert "total_buy_volume" in summary, "Summary should have total_buy_volume"
        assert "total_sell_volume" in summary, "Summary should have total_sell_volume"
        assert "sentiment" in summary, "Summary should have sentiment"
        
        print(f"✓ Summary: buy_vol=${summary['total_buy_volume']:,.2f}, sell_vol=${summary['total_sell_volume']:,.2f}, sentiment={summary['sentiment']}")
    
    # ==================== COPY TRADING TESTS ====================
    
    def test_copy_traders_api_returns_200(self):
        """Test that copy-trading/traders API returns 200 for VIP user"""
        response = self.session.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Copy Traders API returns 200 OK")
    
    def test_copy_traders_has_coming_soon_message(self):
        """Test that copy-trading API includes coming_soon message"""
        response = self.session.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code == 200
        
        data = response.json()
        assert "coming_soon" in data, "Response should include 'coming_soon' field"
        assert "traders" in data["coming_soon"].lower(), \
            f"coming_soon message should mention traders: {data['coming_soon']}"
        print(f"✓ Copy Traders coming_soon message: '{data['coming_soon']}'")
    
    def test_copy_traders_returns_wallet_address(self):
        """Test that traders have wallet_address field (real Ethereum addresses)"""
        response = self.session.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code == 200
        
        data = response.json()
        traders = data.get("data", [])
        
        assert len(traders) > 0, "Should have at least one trader"
        
        for trader in traders:
            assert "wallet_address" in trader, f"Trader {trader.get('username')} should have wallet_address"
            assert trader["wallet_address"].startswith("0x"), \
                f"wallet_address should start with 0x: {trader['wallet_address']}"
            assert len(trader["wallet_address"]) == 42, \
                f"wallet_address should be 42 characters: {trader['wallet_address']}"
        
        print(f"✓ All {len(traders)} traders have valid wallet_address")
        for t in traders[:3]:
            print(f"  - {t['username']}: {t['wallet_address']}")
    
    def test_copy_traders_returns_etherscan_url(self):
        """Test that traders have etherscan_url field"""
        response = self.session.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code == 200
        
        data = response.json()
        traders = data.get("data", [])
        
        assert len(traders) > 0, "Should have at least one trader"
        
        for trader in traders:
            assert "etherscan_url" in trader, f"Trader {trader.get('username')} should have etherscan_url"
            assert trader["etherscan_url"].startswith("https://etherscan.io/address/"), \
                f"etherscan_url should be valid: {trader['etherscan_url']}"
            # Verify URL contains the wallet address
            assert trader["wallet_address"] in trader["etherscan_url"], \
                f"etherscan_url should contain wallet_address"
        
        print(f"✓ All {len(traders)} traders have valid etherscan_url")
        for t in traders[:3]:
            print(f"  - {t['username']}: {t['etherscan_url']}")
    
    def test_copy_traders_returns_recent_trades(self):
        """Test that traders have recent_trades array"""
        response = self.session.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code == 200
        
        data = response.json()
        traders = data.get("data", [])
        
        assert len(traders) > 0, "Should have at least one trader"
        
        traders_with_trades = [t for t in traders if "recent_trades" in t and len(t.get("recent_trades", [])) > 0]
        assert len(traders_with_trades) > 0, "At least one trader should have recent_trades"
        
        # Verify trade structure
        trader = traders_with_trades[0]
        trade = trader["recent_trades"][0]
        assert "type" in trade, "Trade should have type"
        assert "symbol" in trade, "Trade should have symbol"
        assert "amount" in trade, "Trade should have amount"
        assert "price" in trade, "Trade should have price"
        assert "date" in trade, "Trade should have date"
        
        print(f"✓ {len(traders_with_trades)} traders have recent_trades")
        print(f"  Sample trade: {trade}")
    
    def test_copy_traders_includes_famous_traders(self):
        """Test that copy traders include famous crypto traders"""
        response = self.session.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code == 200
        
        data = response.json()
        traders = data.get("data", [])
        
        usernames = [t["username"] for t in traders]
        famous_traders = ["Tetranode", "Cobie", "Arthur Hayes", "GCR", "Light"]
        
        found_famous = [name for name in famous_traders if any(name in u for u in usernames)]
        assert len(found_famous) >= 3, f"Should have at least 3 famous traders, found: {found_famous}"
        print(f"✓ Found famous traders: {found_famous}")


class TestVIPAccessControl:
    """Test that VIP endpoints require authentication and VIP status"""
    
    def test_smart_money_requires_auth(self):
        """Test that smart-money API requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/smart-money")
        assert response.status_code in [401, 403], \
            f"Should require auth, got {response.status_code}"
        print("✓ Smart Money API requires authentication")
    
    def test_copy_traders_requires_auth(self):
        """Test that copy-trading API requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vip/copy-trading/traders")
        assert response.status_code in [401, 403], \
            f"Should require auth, got {response.status_code}"
        print("✓ Copy Traders API requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
