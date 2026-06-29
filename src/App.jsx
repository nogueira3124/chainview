import { useState, useEffect, useCallback } from "react";

// ─── Network config ───────────────────────────────────────────────────────────
const NETWORKS = {
  Ethereum: { rpc: "eth-mainnet",     explorer: "https://etherscan.io",            nativeSymbol: "ETH",  nativeName: "Ethereum",  nativeCoingeckoId: "ethereum",    color: "#627EEA", emoji: "⟠" },
  Polygon:  { rpc: "polygon-mainnet", explorer: "https://polygonscan.com",          nativeSymbol: "POL",  nativeName: "Polygon",   nativeCoingeckoId: "matic-network", color: "#8247E5", emoji: "⬡" },
  Arbitrum: { rpc: "arb-mainnet",     explorer: "https://arbiscan.io",             nativeSymbol: "ETH",  nativeName: "Ethereum",  nativeCoingeckoId: "ethereum",    color: "#28A0F0", emoji: "🔵" },
  Base:     { rpc: "base-mainnet",    explorer: "https://basescan.org",            nativeSymbol: "ETH",  nativeName: "Ethereum",  nativeCoingeckoId: "ethereum",    color: "#0052FF", emoji: "🔷" },
  Optimism: { rpc: "opt-mainnet",     explorer: "https://optimistic.etherscan.io", nativeSymbol: "ETH",  nativeName: "Ethereum",  nativeCoingeckoId: "ethereum",    color: "#FF0420", emoji: "🔴" },
  BSC:      { rpc: "bnb-mainnet",     explorer: "https://bscscan.com",             nativeSymbol: "BNB",  nativeName: "BNB",       nativeCoingeckoId: "binancecoin", color: "#F3BA2F", emoji: "🟡" },
  Avalanche:{ rpc: "avax-mainnet",    explorer: "https://snowtrace.io",            nativeSymbol: "AVAX", nativeName: "Avalanche", nativeCoingeckoId: "avalanche-2", color: "#E84142", emoji: "🔺" },
};

// ─── Spam filter ──────────────────────────────────────────────────────────────
const SPAM_PATTERNS = [
  /casino/i, /slot/i, /airdrop/i, /claim/i, /free.*token/i,
  /www\./i, /\.io/i, /\.com/i, /\.net/i, /\.org/i, /\.zip/i, /\.xyz/i,
  /\!/i, /bonus/i, /prize/i, /winner/i, /visit/i, /voucher/i,
  /auto.*matic/i, /snowy/i, /owl/i,
];
const WHITELIST = new Set([
  "ETH","WETH","BTC","WBTC","USDC","USDT","DAI","FRAX","LUSD","BUSD","TUSD",
  "UNI","AAVE","LINK","CRV","MKR","SNX","COMP","BAL","LDO","RPL","YFI",
  "MATIC","POL","ARB","OP","BNB","AVAX","FTM","SOL","GRT","ENS",
  "APE","SAND","MANA","AXS","SUSHI","1INCH","CVX","FXS","LQTY",
  "DYDX","GMX","GNS","PENDLE","ENA","EIGEN","USDE","SUSDE",
  "STETH","WSTETH","RETH","CBETH","TRADE","XRP","GAS","CAKE",
]);
function isSpam(token) {
  const sym = (token.symbol || "").toUpperCase();
  if (WHITELIST.has(sym)) return false;
  const name = token.name || "";
  const symbol = token.symbol || "";
  if (SPAM_PATTERNS.some((p) => p.test(name) || p.test(symbol))) return true;
  if (sym === "???" || sym === "") return true;
  if (name.length > 50) return true;
  if (/^auto/i.test(name) && !/^auto.*finance/i.test(name)) return true;
  return false;
}

// ─── CoinGecko map (symbol → id) ─────────────────────────────────────────────
const CG = {
  ETH:"ethereum", WETH:"weth", BTC:"bitcoin", WBTC:"wrapped-bitcoin",
  USDC:"usd-coin", USDT:"tether", DAI:"dai", FRAX:"frax", LUSD:"liquity-usd", BUSD:"binance-usd",
  UNI:"uniswap", AAVE:"aave", LINK:"chainlink", CRV:"curve-dao-token",
  MKR:"maker", SNX:"havven", COMP:"compound-governance-token", BAL:"balancer", YFI:"yearn-finance",
  LDO:"lido-dao", RPL:"rocket-pool", STETH:"staked-ether", RETH:"rocket-pool-eth",
  MATIC:"matic-network", POL:"matic-network", ARB:"arbitrum", OP:"optimism",
  BNB:"binancecoin", AVAX:"avalanche-2", FTM:"fantom", SOL:"solana", CAKE:"pancakeswap-token",
  SHIB:"shiba-inu", PEPE:"pepe", DOGE:"dogecoin", FLOKI:"floki",
  GRT:"the-graph", ENS:"ethereum-name-service",
  SAND:"the-sandbox", MANA:"decentraland", AXS:"axie-infinity",
  SUSHI:"sushi", "1INCH":"1inch", CVX:"convex-finance",
  FXS:"frax-share", LQTY:"liquity", DYDX:"dydx", GMX:"gmx", GNS:"gains-network",
  PENDLE:"pendle", ENA:"ethena", EIGEN:"eigenlayer",
  USDE:"ethena-usde", SUSDE:"ethena-staked-usde",
  CBETH:"coinbase-wrapped-staked-eth", WSTETH:"wrapped-steth",
  XRP:"ripple",
};

// Known official contract addresses — tokens with same symbol but different
// contract will NOT receive a price (prevents fake token value inflation)
const KNOWN_CONTRACTS = {
  "0x4d224452801aced8b2f0aebe155379bb5d594381": "APE",
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "AAVE",
  "0x514910771af9ca656af840dff83e8264ecf986ca": "LINK",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": "USDC",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": "USDC",
};

// Symbols that commonly have fake versions on other chains
const AMBIGUOUS_SYMBOLS = new Set(["APE","PEPE","SHIB","DOGE","FLOKI","XRP","SOL","BTC"]);

function isKnownFake(token) {
  if (!token.contractAddress) return false;
  const addr = token.contractAddress.toLowerCase();
  const sym = token.symbol.toUpperCase();
  // If this is an ambiguous symbol AND the contract is not in our known list
  if (AMBIGUOUS_SYMBOLS.has(sym) && !KNOWN_CONTRACTS[addr]) return true;
  // If the contract IS known but maps to a different symbol
  if (KNOWN_CONTRACTS[addr] && KNOWN_CONTRACTS[addr] !== sym) return true;
  return false;
}

// ─── Alchemy API ──────────────────────────────────────────────────────────────
async function alchemyRpc(networkKey, apiKey, method, params) {
  const net = NETWORKS[networkKey];
  const url = `https://${net.rpc}.g.alchemy.com/v2/${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function fetchNetworkTokens(address, networkKey, apiKey) {
  const net = NETWORKS[networkKey];
  try {
    const [hexBal, erc20Result] = await Promise.all([
      alchemyRpc(networkKey, apiKey, "eth_getBalance", [address, "latest"]),
      alchemyRpc(networkKey, apiKey, "alchemy_getTokenBalances", [address, "erc20"]),
    ]);

    const nativeBal = parseInt(hexBal, 16) / 1e18;
    const nonZero = (erc20Result.tokenBalances || []).filter(
      (t) => t.tokenBalance && t.tokenBalance !== "0x" + "0".repeat(64)
    );

    const metaResults = nonZero.length
      ? await Promise.allSettled(nonZero.map((t) => alchemyRpc(networkKey, apiKey, "alchemy_getTokenMetadata", [t.contractAddress])))
      : [];

    const erc20Tokens = nonZero.map((t, i) => {
      const meta = metaResults[i]?.status === "fulfilled" ? metaResults[i].value : {};
      const decimals = meta.decimals || 18;
      const balance = parseInt(t.tokenBalance, 16) / Math.pow(10, decimals);
      return { symbol: meta.symbol || "???", name: meta.name || "Unknown", balance, contractAddress: t.contractAddress, logoURI: meta.logo || null, network: networkKey, price: 0, change24h: 0 };
    }).filter((t) => t.balance > 0.000001 && !isSpam(t) && !isKnownFake(t));

    const tokens = [
      { symbol: net.nativeSymbol, name: net.nativeName, balance: nativeBal, contractAddress: null, logoURI: null, network: networkKey, price: 0, change24h: 0, coingeckoId: net.nativeCoingeckoId },
      ...erc20Tokens,
    ];

    return { networkKey, tokens, error: null };
  } catch (e) {
    return { networkKey, tokens: [], error: e.message };
  }
}

async function fetchAllNetworks(address, apiKey) {
  const results = await Promise.allSettled(
    Object.keys(NETWORKS).map((nk) => fetchNetworkTokens(address, nk, apiKey))
  );
  return results.map((r) => r.status === "fulfilled" ? r.value : { networkKey: "?", tokens: [], error: r.reason?.message });
}

// ─── Global price cache (5 min TTL) ──────────────────────────────────────────
const PRICE_CACHE = { data: {}, ts: 0, pending: null };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// All known CoinGecko IDs we ever want to fetch — loaded once
const ALL_CG_IDS = [...new Set(Object.values(CG))];

async function fetchAllPricesOnce() {
  const now = Date.now();
  // Return cached if still fresh
  if (now - PRICE_CACHE.ts < CACHE_TTL && Object.keys(PRICE_CACHE.data).length > 0) {
    return PRICE_CACHE.data;
  }
  // If already fetching, wait for that promise
  if (PRICE_CACHE.pending) return PRICE_CACHE.pending;

  PRICE_CACHE.pending = (async () => {
    const BATCH = 50;
    const result = {};
    for (let i = 0; i < ALL_CG_IDS.length; i += BATCH) {
      const batch = ALL_CG_IDS.slice(i, i + BATCH);
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${batch.join(",")}&vs_currencies=usd&include_24hr_change=true`;
        let res = await fetch(url);
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 3000));
          res = await fetch(url);
        }
        if (res.ok) {
          const data = await res.json();
          Object.assign(result, data);
        }
      } catch { /* skip batch on error */ }
      if (i + BATCH < ALL_CG_IDS.length) await new Promise((r) => setTimeout(r, 500));
    }
    // Build symbol -> { price, change24h } map
    const priceMap = {};
    Object.entries(CG).forEach(([sym, id]) => {
      if (result[id]) {
        priceMap[sym.toUpperCase()] = { price: result[id].usd || 0, change24h: result[id].usd_24h_change || 0 };
      }
    });
    PRICE_CACHE.data = priceMap;
    PRICE_CACHE.ts = Date.now();
    PRICE_CACHE.pending = null;
    return priceMap;
  })();

  return PRICE_CACHE.pending;
}

async function fetchPrices(tokens) {
  const priceMap = await fetchAllPricesOnce();
  const result = {};
  tokens.forEach((t) => {
    if (isKnownFake(t)) return;
    const sym = t.symbol?.toUpperCase();
    // Native tokens use coingeckoId directly
    if (t.coingeckoId && priceMap[sym]) {
      result[sym] = priceMap[sym];
    } else if (priceMap[sym]) {
      result[sym] = priceMap[sym];
    }
  });
  return result;
}

async function fetchTransactions(address, networkKey, apiKey) {
  try {
    const [sent, received] = await Promise.all([
      alchemyRpc(networkKey, apiKey, "alchemy_getAssetTransfers", [{ fromAddress: address, category: ["external","erc20"], maxCount: "0x14", order: "desc", withMetadata: true }]),
      alchemyRpc(networkKey, apiKey, "alchemy_getAssetTransfers", [{ toAddress: address, category: ["external","erc20"], maxCount: "0x14", order: "desc", withMetadata: true }]),
    ]);
    const all = [
      ...(sent.transfers||[]).map((t) => ({ ...t, direction: "Send" })),
      ...(received.transfers||[]).map((t) => ({ ...t, direction: "Receive" })),
    ].filter((t) => !isSpam({ name: t.asset||"", symbol: t.asset||"" }))
     .sort((a,b) => new Date(b.metadata?.blockTimestamp) - new Date(a.metadata?.blockTimestamp));
    return all.slice(0,30).map((t) => ({
      hash: t.hash, type: t.direction, asset: t.asset||"—", amount: t.value||0,
      from: t.from, to: t.to, network: networkKey,
      date: t.metadata?.blockTimestamp ? new Date(t.metadata.blockTimestamp).toISOString().split("T")[0] : "—",
    }));
  } catch { return []; }
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_NETWORKS = {
  Ethereum: [
    { symbol:"ETH", name:"Ethereum", balance:2.418, price:3421.5, change24h:2.3, network:"Ethereum", contractAddress:null },
    { symbol:"USDC", name:"USD Coin", balance:1850, price:1.0, change24h:0.01, network:"Ethereum", contractAddress:null },
    { symbol:"LINK", name:"Chainlink", balance:45.2, price:14.82, change24h:-1.1, network:"Ethereum", contractAddress:null },
  ],
  Polygon: [
    { symbol:"POL", name:"Polygon", balance:218, price:0.42, change24h:-0.5, network:"Polygon", contractAddress:null },
    { symbol:"USDC", name:"USD Coin", balance:938, price:1.0, change24h:0.01, network:"Polygon", contractAddress:null },
  ],
  Arbitrum: [
    { symbol:"ETH", name:"Ethereum", balance:0.5, price:3421.5, change24h:2.3, network:"Arbitrum", contractAddress:null },
    { symbol:"ARB", name:"Arbitrum", balance:120, price:0.82, change24h:1.2, network:"Arbitrum", contractAddress:null },
  ],
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n, d=2) => new Intl.NumberFormat("en-US", { minimumFractionDigits:d, maximumFractionDigits:d }).format(n??0);
const fmtUSD = (n) => "$" + fmt(n);
const shortAddr = (a) => a?.length > 12 ? `${a.slice(0,6)}…${a.slice(-4)}` : (a||"—");

// ─── Small components ─────────────────────────────────────────────────────────
const NetworkPill = ({ network }) => {
  const net = NETWORKS[network];
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: net?.color + "22", color: net?.color, border: `1px solid ${net?.color}44` }}>
      {net?.emoji} {network}
    </span>
  );
};

const ChangeCell = ({ v }) => (
  <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>
    {v >= 0 ? "▲" : "▼"} {Math.abs(v??0).toFixed(2)}%
  </span>
);

const TokenIcon = ({ symbol, logo }) =>
  logo ? (
    <img src={logo} alt={symbol} className="w-7 h-7 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display="none"; }} />
  ) : (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
      {(symbol||"?")[0].toUpperCase()}
    </div>
  );

const Spinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    {text && <p className="text-slate-500 text-sm">{text}</p>}
  </div>
);

const TxBadge = ({ type }) => {
  const map = { Receive:"bg-emerald-900/40 text-emerald-300 border-emerald-700/40", Send:"bg-red-900/40 text-red-300 border-red-700/40", Swap:"bg-blue-900/40 text-blue-300 border-blue-700/40" };
  const cls = map[type] || "bg-slate-800 text-slate-300 border-slate-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${cls}`}>{type}</span>;
};

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose, apiKey, setApiKey }) {
  const [key, setKey] = useState(apiKey);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-semibold text-lg">Configurações de API</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        <label className="block text-slate-400 text-sm mb-1">Alchemy API Key</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ex: kwM-2vnGHr2dttI0vMdOl"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 mb-3" />
        <p className="text-slate-500 text-xs mb-5 leading-relaxed">Guardada apenas no teu browser. Sem chave, a app usa dados simulados.</p>
        <div className="flex gap-3">
          <button onClick={() => { setApiKey(key); onClose(); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors">Guardar</button>
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Wallet Modal ─────────────────────────────────────────────────────────
function AddWalletModal({ onClose, onAdd }) {
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const valid = /^0x[a-fA-F0-9]{40}$/.test(addr);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-semibold text-lg">Adicionar Carteira</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        <p className="text-slate-400 text-xs mb-4 leading-relaxed bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          🔍 A app vai pesquisar <strong className="text-slate-300">todas as redes automaticamente</strong> — Ethereum, Polygon, Arbitrum, Base, Optimism, BSC e Avalanche.
        </p>
        <label className="block text-slate-400 text-sm mb-1">Endereço EVM</label>
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x..."
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 mb-1" />
        {addr && !valid && <p className="text-red-400 text-xs mb-3">Endereço inválido.</p>}
        {(!addr || valid) && <div className="mb-3" />}
        <label className="block text-slate-400 text-sm mb-1">Etiqueta (opcional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: DeFi Principal"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-5" />
        <div className="flex gap-3">
          <button disabled={!valid} onClick={() => { onAdd({ address: addr, label: label || shortAddr(addr) }); onClose(); }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors">
            Adicionar e Pesquisar
          </button>
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── useMultiChainWallet hook ─────────────────────────────────────────────────
function useMultiChainWallet(wallet, apiKey) {
  const [networkData, setNetworkData] = useState({}); // { networkKey: { tokens, loading, error } }
  const [txs, setTxs] = useState([]);
  const [txNetwork, setTxNetwork] = useState("Ethereum");
  const [txLoading, setTxLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!wallet) return;
    setGlobalLoading(true);

    // Init all networks as loading
    const init = {};
    Object.keys(NETWORKS).forEach((nk) => { init[nk] = { tokens: [], loading: true, error: null }; });
    setNetworkData(init);

    if (!apiKey) {
      // Mock mode
      await new Promise((r) => setTimeout(r, 400));
      const mock = {};
      Object.keys(NETWORKS).forEach((nk) => {
        mock[nk] = { tokens: MOCK_NETWORKS[nk] || [], loading: false, error: null };
      });
      setNetworkData(mock);
      setGlobalLoading(false);
      return;
    }

    // Fetch all networks in parallel, update each as it arrives
    const promises = Object.keys(NETWORKS).map(async (nk) => {
      try {
        const result = await fetchNetworkTokens(wallet.address, nk, apiKey);
        // Fetch prices for this network's tokens
        const prices = await fetchPrices(result.tokens);
        const tokensWithPrices = result.tokens.map((t) => ({
          ...t,
          price: prices[t.symbol?.toUpperCase()]?.price || 0,
          change24h: prices[t.symbol?.toUpperCase()]?.change24h || 0,
        })).filter((t) => t.balance > 0).sort((a,b) => b.balance*b.price - a.balance*a.price);

        setNetworkData((prev) => ({ ...prev, [nk]: { tokens: tokensWithPrices, loading: false, error: result.error } }));
      } catch (e) {
        setNetworkData((prev) => ({ ...prev, [nk]: { tokens: [], loading: false, error: e.message } }));
      }
    });

    await Promise.allSettled(promises);
    setGlobalLoading(false);
  }, [wallet?.address, apiKey]);

  const loadTxs = useCallback(async (nk) => {
    if (!wallet || !apiKey) return;
    setTxNetwork(nk);
    setTxLoading(true);
    const data = await fetchTransactions(wallet.address, nk, apiKey);
    setTxs(data);
    setTxLoading(false);
  }, [wallet?.address, apiKey]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // All tokens across all networks
  const allTokens = Object.entries(networkData).flatMap(([nk, nd]) =>
    (nd.tokens || []).map((t) => ({ ...t, network: nk }))
  );
  const totalValue = allTokens.reduce((s, t) => s + t.balance * t.price, 0);

  return { networkData, allTokens, totalValue, globalLoading, txs, txNetwork, txLoading, loadTxs, reload: loadAll };
}

// ─── Wallet Card ──────────────────────────────────────────────────────────────
function WalletCard({ wallet, selected, onClick, onRemove, totalValue, loading }) {
  return (
    <div onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${selected ? "border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-900/20" : "border-slate-700 bg-slate-800/50 hover:border-slate-500"}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-white font-medium text-sm truncate">{wallet.label}</p>
          <p className="text-slate-500 text-xs font-mono mt-0.5 truncate">{wallet.address}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(wallet.address); }} className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0">✕</button>
      </div>
      <p className="text-xl font-bold text-white">{loading ? <span className="text-slate-500 text-sm">a carregar…</span> : fmtUSD(totalValue)}</p>
      <p className="text-slate-500 text-xs mt-0.5">7 redes · multi-chain</p>
    </div>
  );
}

// ─── Wallet Detail ────────────────────────────────────────────────────────────
function WalletDetail({ wallet, apiKey }) {
  const { networkData, allTokens, totalValue, globalLoading, txs, txNetwork, txLoading, loadTxs, reload } = useMultiChainWallet(wallet, apiKey);
  const [view, setView] = useState("tokens"); // tokens | by-network | transactions
  const [filterNetwork, setFilterNetwork] = useState("all");
  const net = NETWORKS[wallet?.network];

  const networksWithBalance = Object.entries(networkData)
    .map(([nk, nd]) => ({ nk, value: (nd.tokens||[]).reduce((s,t) => s + t.balance*t.price, 0), count: (nd.tokens||[]).length, loading: nd.loading, error: nd.error }))
    .filter((n) => n.value > 0 || n.loading)
    .sort((a,b) => b.value - a.value);

  const displayTokens = filterNetwork === "all"
    ? allTokens
    : allTokens.filter((t) => t.network === filterNetwork);

  // Aggregate by symbol for "all" view
  const aggregated = {};
  displayTokens.forEach((t) => {
    const key = t.symbol.toUpperCase();
    if (!aggregated[key]) aggregated[key] = { ...t, totalBalance: 0, totalValue: 0, networks: [] };
    aggregated[key].totalBalance += t.balance;
    aggregated[key].totalValue += t.balance * t.price;
    if (!aggregated[key].networks.includes(t.network)) aggregated[key].networks.push(t.network);
  });
  const tokenList = Object.values(aggregated).sort((a,b) => b.totalValue - a.totalValue);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0">
            <p className="text-white font-semibold">{wallet.label}</p>
            <p className="text-slate-500 text-xs font-mono mt-0.5 truncate">{wallet.address}</p>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <p className="text-2xl font-bold text-white">{globalLoading ? "…" : fmtUSD(totalValue)}</p>
            <button onClick={reload} className="text-slate-500 text-xs hover:text-slate-300 transition-colors">↻ atualizar</button>
          </div>
        </div>

        {/* Network breakdown pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {networksWithBalance.map(({ nk, value, loading: nl }) => (
            <button key={nk} onClick={() => { setFilterNetwork(nk === filterNetwork ? "all" : nk); setView("tokens"); }}
              className={`text-xs px-2 py-1 rounded-lg transition-all border ${filterNetwork === nk ? "border-blue-500 bg-blue-950/40" : "border-slate-700 bg-slate-800 hover:border-slate-500"}`}>
              <span style={{ color: NETWORKS[nk]?.color }}>{NETWORKS[nk]?.emoji} {nk}</span>
              <span className="text-slate-400 ml-1">{nl ? "…" : fmtUSD(value)}</span>
            </button>
          ))}
          {filterNetwork !== "all" && (
            <button onClick={() => setFilterNetwork("all")} className="text-xs px-2 py-1 rounded-lg border border-slate-600 text-slate-400 hover:text-white transition-colors">
              × ver todas
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {["tokens","transactions"].map((t) => (
            <button key={t} onClick={() => { setView(t); if(t==="transactions") loadTxs(filterNetwork==="all"?"Ethereum":filterNetwork); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${view===t ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
              {t === "tokens" ? "Tokens" : "Transações"}
            </button>
          ))}
        </div>
      </div>

      {/* Tokens */}
      {view === "tokens" && (
        globalLoading ? <Spinner text="A pesquisar todas as redes…" /> :
        tokenList.length === 0 ? <p className="text-slate-500 text-sm p-6 text-center">Nenhum token encontrado.</p> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                <th className="text-left py-2 px-4">Token</th>
                {filterNetwork === "all" && <th className="text-left py-2 px-4">Redes</th>}
                <th className="text-right py-2 px-4">Saldo</th>
                <th className="text-right py-2 px-4">Preço</th>
                <th className="text-right py-2 px-4">Valor</th>
                <th className="text-right py-2 px-4">24h</th>
              </tr>
            </thead>
            <tbody>
              {tokenList.map((t) => (
                <tr key={t.symbol + (t.contractAddress||"")} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={t.symbol} logo={t.logoURI} />
                      <div>
                        <p className="text-white font-medium">{t.symbol}</p>
                        <p className="text-slate-500 text-xs">{t.name}</p>
                      </div>
                    </div>
                  </td>
                  {filterNetwork === "all" && (
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {t.networks.map((nk) => <NetworkPill key={nk} network={nk} />)}
                      </div>
                    </td>
                  )}
                  <td className="py-3 px-4 text-right text-slate-300 font-mono">{fmt(t.totalBalance, 4)}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{t.price > 0 ? fmtUSD(t.price) : "—"}</td>
                  <td className="py-3 px-4 text-right text-white font-semibold">{t.totalValue > 0 ? fmtUSD(t.totalValue) : "—"}</td>
                  <td className="py-3 px-4 text-right">{t.price > 0 ? <ChangeCell v={t.change24h} /> : <span className="text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {view === "transactions" && (
        <div>
          <div className="px-4 py-2 border-b border-slate-800 flex gap-1 flex-wrap">
            {Object.keys(NETWORKS).map((nk) => (
              <button key={nk} onClick={() => loadTxs(nk)}
                className={`text-xs px-2 py-1 rounded-lg border transition-all ${txNetwork===nk ? "border-blue-500 bg-blue-950/40 text-white" : "border-slate-700 text-slate-400 hover:text-white"}`}>
                {NETWORKS[nk].emoji} {nk}
              </button>
            ))}
          </div>
          {txLoading ? <Spinner text={`A carregar transações ${txNetwork}…`} /> :
           txs.length === 0 ? <p className="text-slate-500 text-sm p-6 text-center">Nenhuma transação encontrada em {txNetwork}.</p> :
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
               <thead>
                 <tr className="text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                   <th className="text-left py-2 px-4">Tipo</th>
                   <th className="text-left py-2 px-4">Ativo</th>
                   <th className="text-right py-2 px-4">Quantidade</th>
                   <th className="text-left py-2 px-4">De / Para</th>
                   <th className="text-left py-2 px-4">Data</th>
                   <th className="text-left py-2 px-4">Hash</th>
                 </tr>
               </thead>
               <tbody>
                 {txs.map((tx) => {
                   const explorer = NETWORKS[tx.network]?.explorer;
                   return (
                     <tr key={tx.hash} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                       <td className="py-3 px-4"><TxBadge type={tx.type} /></td>
                       <td className="py-3 px-4 text-slate-300 font-medium">{tx.asset}</td>
                       <td className="py-3 px-4 text-right text-white font-mono">{fmt(tx.amount, 6)}</td>
                       <td className="py-3 px-4">
                         <p className="text-slate-400 text-xs font-mono">{shortAddr(tx.from)}</p>
                         <p className="text-slate-500 text-xs">→ {shortAddr(tx.to)}</p>
                       </td>
                       <td className="py-3 px-4 text-slate-400 text-xs">{tx.date}</td>
                       <td className="py-3 px-4">
                         {explorer ? <a href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 text-xs font-mono hover:underline">{shortAddr(tx.hash)}</a>
                           : <span className="text-slate-500 text-xs font-mono">{shortAddr(tx.hash)}</span>}
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>}
        </div>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewView({ wallets, walletsData, apiKey }) {
  const allTokens = {};
  let grand = 0;
  wallets.forEach((w) => {
    (walletsData[w.address] || []).forEach((t) => {
      const val = t.balance * t.price;
      grand += val;
      const key = t.symbol.toUpperCase();
      if (!allTokens[key]) allTokens[key] = { ...t, totalBalance:0, totalValue:0 };
      allTokens[key].totalBalance += t.balance;
      allTokens[key].totalValue += val;
    });
  });
  const tokenList = Object.values(allTokens).sort((a,b) => b.totalValue - a.totalValue);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-950/60 to-purple-950/60 border border-blue-800/40 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm mb-1">Portfólio Total</p>
            <p className="text-4xl font-bold text-white mb-4">{fmtUSD(grand)}</p>
          </div>
          {!apiKey && <span className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 px-2 py-1 rounded-full">Dados demo</span>}
        </div>
        <div className="flex gap-8">
          <div><p className="text-slate-400 text-xs">Carteiras</p><p className="text-blue-300 font-semibold">{wallets.length}</p></div>
          <div><p className="text-slate-400 text-xs">Tokens únicos</p><p className="text-slate-300 font-semibold">{tokenList.length}</p></div>
          <div><p className="text-slate-400 text-xs">Redes</p><p className="text-slate-300 font-semibold">7</p></div>
        </div>
      </div>

      {tokenList.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Tokens Agregados</h3>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
                  <th className="text-left py-2 px-4">Token</th>
                  <th className="text-right py-2 px-4">Saldo Total</th>
                  <th className="text-right py-2 px-4">Valor</th>
                  <th className="text-right py-2 px-4">% Portfolio</th>
                  <th className="text-right py-2 px-4">24h</th>
                </tr>
              </thead>
              <tbody>
                {tokenList.map((t) => {
                  const pct = grand > 0 ? (t.totalValue/grand)*100 : 0;
                  return (
                    <tr key={t.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={t.symbol} logo={t.logoURI} />
                          <div><span className="text-white font-medium">{t.symbol}</span><p className="text-slate-500 text-xs">{t.name}</p></div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 font-mono">{fmt(t.totalBalance, 4)}</td>
                      <td className="py-3 px-4 text-right text-white font-semibold">{t.totalValue > 0 ? fmtUSD(t.totalValue) : "—"}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width:`${Math.min(pct,100)}%` }} />
                          </div>
                          <span className="text-slate-400 text-xs w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">{t.price > 0 ? <ChangeCell v={t.change24h} /> : <span className="text-slate-600">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tokenList.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">👛</p>
          <p>Adiciona carteiras para ver o teu portfólio agregado.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [wallets, setWallets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chainview_wallets") || "[]"); } catch { return []; }
  });
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [tab, setTab] = useState("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("chainview_api_key") || "");
  const [walletsData, setWalletsData] = useState({});

  useEffect(() => { localStorage.setItem("chainview_wallets", JSON.stringify(wallets)); }, [wallets]);

  // Load overview data for all wallets
  useEffect(() => {
    wallets.forEach(async (w) => {
      if (walletsData[w.address]) return;
      if (!apiKey) {
        // Different mock data per wallet to avoid duplicate display
        const idx = wallets.findIndex((x) => x.address === w.address);
        const networkKeys = Object.keys(MOCK_NETWORKS);
        const mock = networkKeys.flatMap((nk) =>
          (MOCK_NETWORKS[nk] || []).map((t) => ({
            ...t,
            // Vary balance slightly per wallet
            balance: t.balance * (0.5 + idx * 0.3),
          }))
        );
        setWalletsData((p) => ({ ...p, [w.address]: mock }));
        return;
      }
      try {
        // Fetch tokens from all networks for this wallet
        const results = await fetchAllNetworks(w.address, apiKey);
        const allTokens = results.flatMap((r) => r.tokens);
        // Use global price cache — fetched once, shared across all wallets
        const prices = await fetchPrices(allTokens);
        const withPrices = allTokens
          .map((t) => ({
            ...t,
            price: prices[t.symbol?.toUpperCase()]?.price || 0,
            change24h: prices[t.symbol?.toUpperCase()]?.change24h || 0,
          }))
          .filter((t) => t.balance > 0);
        // Store keyed by address so each wallet has its own data
        setWalletsData((p) => ({ ...p, [w.address]: withPrices }));
      } catch (e) {
        console.error("Error loading wallet", w.address, e);
        setWalletsData((p) => ({ ...p, [w.address]: [] }));
      }
    });
  }, [wallets, apiKey]);

  const saveApiKey = (key) => {
    setApiKey(key);
    setWalletsData({});
    if (key) localStorage.setItem("chainview_api_key", key);
    else localStorage.removeItem("chainview_api_key");
  };

  const addWallet = (w) => {
    setWallets((prev) => prev.find((x) => x.address === w.address) ? prev : [...prev, w]);
    setSelectedWallet(w.address);
    setTab("wallets");
  };

  const removeWallet = (addr) => {
    setWallets((prev) => {
      const next = prev.filter((w) => w.address !== addr);
      if (selectedWallet === addr) setSelectedWallet(next[0]?.address || null);
      return next;
    });
    setWalletsData((p) => { const n={...p}; delete n[addr]; return n; });
  };

  const selectedWalletObj = wallets.find((w) => w.address === selectedWallet);
  const totalOverview = Object.values(walletsData).flat().reduce((s,t) => s + t.balance*t.price, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={saveApiKey} />}
      {showAddWallet && <AddWalletModal onClose={() => setShowAddWallet(false)} onAdd={addWallet} />}

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold select-none">◈</div>
          <span className="font-semibold text-white text-lg tracking-tight">ChainView</span>
          {!apiKey && (
            <span onClick={() => setShowSettings(true)} className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full hidden sm:inline cursor-pointer hover:bg-amber-900/60 transition-colors">
              Modo demo — clica para ligar API
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {[{id:"overview",label:"Visão Geral"},{id:"wallets",label:"Carteiras"}].map((n) => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab===n.id ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>
                {n.label}
              </button>
            ))}
          </nav>
          <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">⚙</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {tab === "overview" && <OverviewView wallets={wallets} walletsData={walletsData} apiKey={apiKey} />}

        {tab === "wallets" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Carteiras</h2>
                <button onClick={() => setShowAddWallet(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Adicionar</button>
              </div>
              {wallets.map((w) => (
                <WalletCard key={w.address} wallet={w} selected={selectedWallet===w.address}
                  onClick={() => setSelectedWallet(w.address)} onRemove={removeWallet}
                  totalValue={(walletsData[w.address]||[]).reduce((s,t)=>s+t.balance*t.price,0)}
                  loading={!walletsData[w.address]} />
              ))}
              {wallets.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  <p className="text-3xl mb-2">👛</p>
                  <p className="text-sm">Nenhuma carteira adicionada.</p>
                  <button onClick={() => setShowAddWallet(true)} className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">+ Adicionar carteira</button>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              {selectedWalletObj
                ? <WalletDetail wallet={selectedWalletObj} apiKey={apiKey} />
                : <div className="flex items-center justify-center h-48 text-slate-500">
                    <p>{wallets.length > 0 ? "Seleciona uma carteira." : "Adiciona uma carteira para começar."}</p>
                  </div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
