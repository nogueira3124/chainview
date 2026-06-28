import { useState, useEffect, useCallback } from "react";

// ─── Network config ───────────────────────────────────────────────────────────
const NETWORKS = {
  Ethereum: { id: "eth-mainnet",     rpc: "eth-mainnet",     chainId: 1,     explorer: "https://etherscan.io",   nativeSymbol: "ETH",  nativeName: "Ethereum",        nativeCoingeckoId: "ethereum" },
  Polygon:  { id: "polygon-mainnet", rpc: "polygon-mainnet", chainId: 137,   explorer: "https://polygonscan.com", nativeSymbol: "POL",  nativeName: "Polygon",         nativeCoingeckoId: "matic-network" },
  Arbitrum: { id: "arb-mainnet",     rpc: "arb-mainnet",     chainId: 42161, explorer: "https://arbiscan.io",    nativeSymbol: "ETH",  nativeName: "Ethereum",        nativeCoingeckoId: "ethereum" },
  Base:     { id: "base-mainnet",    rpc: "base-mainnet",    chainId: 8453,  explorer: "https://basescan.org",   nativeSymbol: "ETH",  nativeName: "Ethereum",        nativeCoingeckoId: "ethereum" },
  Optimism: { id: "opt-mainnet",     rpc: "opt-mainnet",     chainId: 10,    explorer: "https://optimistic.etherscan.io", nativeSymbol: "ETH", nativeName: "Ethereum", nativeCoingeckoId: "ethereum" },
  BSC:      { id: "bnb-mainnet",     rpc: "bnb-mainnet",     chainId: 56,    explorer: "https://bscscan.com",   nativeSymbol: "BNB",  nativeName: "BNB",             nativeCoingeckoId: "binancecoin" },
  Avalanche:{ id: "avax-mainnet",    rpc: "avax-mainnet",    chainId: 43114, explorer: "https://snowtrace.io",  nativeSymbol: "AVAX", nativeName: "Avalanche",       nativeCoingeckoId: "avalanche-2" },
};

// ─── Spam filter ──────────────────────────────────────────────────────────────
const SPAM_PATTERNS = [
  /casino/i, /slot/i, /airdrop/i, /claim.*reward/i, /free.*token/i,
  /www\./i, /\.io/i, /\.com/i, /\.net/i, /\.org/i, /visit/i,
  /\!/i, /bonus/i, /prize/i, /winner/i, /reward.*claim/i,
];

function isSpamToken(token) {
  const name = (token.name || "").toLowerCase();
  const symbol = (token.symbol || "").toLowerCase();
  if (SPAM_PATTERNS.some((p) => p.test(name) || p.test(symbol))) return true;
  if (symbol === "???" || symbol === "") return true;
  if (name.length > 60) return true;
  return false;
}

// ─── CoinGecko ID map ─────────────────────────────────────────────────────────
const COINGECKO_IDS = {
  ETH: "ethereum", WETH: "weth", BTC: "bitcoin", WBTC: "wrapped-bitcoin",
  USDC: "usd-coin", USDT: "tether", DAI: "dai", FRAX: "frax", LUSD: "liquity-usd",
  UNI: "uniswap", AAVE: "aave", LINK: "chainlink", CRV: "curve-dao-token",
  MKR: "maker", SNX: "havven", COMP: "compound-governance-token", BAL: "balancer",
  LDO: "lido-dao", RPL: "rocket-pool", stETH: "staked-ether", rETH: "rocket-pool-eth",
  MATIC: "matic-network", POL: "matic-network", ARB: "arbitrum", OP: "optimism",
  BNB: "binancecoin", AVAX: "avalanche-2", FTM: "fantom", SOL: "solana",
  SHIB: "shiba-inu", PEPE: "pepe", DOGE: "dogecoin", FLOKI: "floki",
  GRT: "the-graph", ENS: "ethereum-name-service", APE: "apecoin",
  SAND: "the-sandbox", MANA: "decentraland", AXS: "axie-infinity",
  SUSHI: "sushi", "1INCH": "1inch", CVX: "convex-finance",
  FXS: "frax-share", LQTY: "liquity", TRIBE: "tribe-2",
  DYDX: "dydx", GMX: "gmx", GNS: "gains-network",
  PENDLE: "pendle", ENA: "ethena", EIGEN: "eigenlayer",
  USDE: "ethena-usde", SUSDE: "ethena-staked-usde",
  CBETH: "coinbase-wrapped-staked-eth", WSTETH: "wrapped-steth",
};

// ─── Alchemy API ──────────────────────────────────────────────────────────────
async function alchemyRpc(network, apiKey, method, params) {
  const net = NETWORKS[network];
  if (!net) throw new Error("Rede desconhecida: " + network);
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

async function fetchNativeBalance(address, network, apiKey) {
  const hex = await alchemyRpc(network, apiKey, "eth_getBalance", [address, "latest"]);
  return parseInt(hex, 16) / 1e18;
}

async function fetchTokenBalances(address, network, apiKey) {
  const result = await alchemyRpc(network, apiKey, "alchemy_getTokenBalances", [address, "erc20"]);
  const nonZero = (result.tokenBalances || []).filter(
    (t) => t.tokenBalance && t.tokenBalance !== "0x" + "0".repeat(64)
  );
  if (!nonZero.length) return [];

  const metaResults = await Promise.allSettled(
    nonZero.map((t) => alchemyRpc(network, apiKey, "alchemy_getTokenMetadata", [t.contractAddress]))
  );

  return nonZero.map((t, i) => {
    const meta = metaResults[i].status === "fulfilled" ? metaResults[i].value : {};
    const decimals = meta.decimals || 18;
    const balance = parseInt(t.tokenBalance, 16) / Math.pow(10, decimals);
    return {
      symbol: meta.symbol || "???",
      name: meta.name || "Unknown",
      balance,
      contractAddress: t.contractAddress,
      decimals,
      price: 0,
      change24h: 0,
      logoURI: meta.logo || null,
    };
  }).filter((t) => t.balance > 0.000001 && !isSpamToken(t));
}

async function fetchTransactions(address, network, apiKey) {
  const [sent, received] = await Promise.all([
    alchemyRpc(network, apiKey, "alchemy_getAssetTransfers", [{
      fromAddress: address, category: ["external", "erc20"],
      maxCount: "0x19", order: "desc", withMetadata: true,
    }]),
    alchemyRpc(network, apiKey, "alchemy_getAssetTransfers", [{
      toAddress: address, category: ["external", "erc20"],
      maxCount: "0x19", order: "desc", withMetadata: true,
    }]),
  ]);

  const all = [
    ...(sent.transfers || []).map((t) => ({ ...t, direction: "Send" })),
    ...(received.transfers || []).map((t) => ({ ...t, direction: "Receive" })),
  ].filter((t) => !isSpamToken({ name: t.asset || "", symbol: t.asset || "" }))
   .sort((a, b) => new Date(b.metadata?.blockTimestamp) - new Date(a.metadata?.blockTimestamp));

  return all.slice(0, 30).map((t) => ({
    hash: t.hash,
    type: t.direction,
    asset: t.asset || "—",
    amount: t.value || 0,
    from: t.from,
    to: t.to,
    date: t.metadata?.blockTimestamp ? new Date(t.metadata.blockTimestamp).toISOString().split("T")[0] : "—",
    status: "confirmed",
  }));
}

// ─── Prices via CoinGecko ─────────────────────────────────────────────────────
async function fetchPrices(symbolsAndIds) {
  // symbolsAndIds: array of { symbol, coingeckoId? }
  const idMap = {}; // coingeckoId -> symbol
  symbolsAndIds.forEach(({ symbol, coingeckoId }) => {
    const id = coingeckoId || COINGECKO_IDS[symbol?.toUpperCase()];
    if (id) idMap[id] = symbol.toUpperCase();
  });
  const ids = Object.keys(idMap);
  if (!ids.length) return {};

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    const data = await res.json();
    const result = {};
    ids.forEach((id) => {
      if (data[id]) {
        const sym = idMap[id];
        result[sym] = { price: data[id].usd || 0, change24h: data[id].usd_24h_change || 0 };
      }
    });
    return result;
  } catch {
    return {};
  }
}

// ─── Load full wallet data ────────────────────────────────────────────────────
async function loadWalletData(wallet, apiKey) {
  const net = NETWORKS[wallet.network];
  const [nativeBal, erc20Tokens] = await Promise.all([
    fetchNativeBalance(wallet.address, wallet.network, apiKey),
    fetchTokenBalances(wallet.address, wallet.network, apiKey),
  ]);

  const nativeToken = {
    symbol: net.nativeSymbol,
    name: net.nativeName,
    balance: nativeBal,
    contractAddress: null,
    price: 0,
    change24h: 0,
    logoURI: null,
    coingeckoId: net.nativeCoingeckoId,
  };

  const allTokens = [nativeToken, ...erc20Tokens];

  const priceData = await fetchPrices(allTokens.map((t) => ({
    symbol: t.symbol,
    coingeckoId: t.coingeckoId || null,
  })));

  return allTokens.map((t) => ({
    ...t,
    price: priceData[t.symbol.toUpperCase()]?.price || 0,
    change24h: priceData[t.symbol.toUpperCase()]?.change24h || 0,
  })).sort((a, b) => b.balance * b.price - a.balance * a.price);
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_TOKENS = [
  { symbol: "ETH",  name: "Ethereum",  balance: 2.418,  price: 3421.5, change24h: 2.3,  contractAddress: null },
  { symbol: "USDC", name: "USD Coin",  balance: 1850.0, price: 1.0,    change24h: 0.01, contractAddress: null },
  { symbol: "LINK", name: "Chainlink", balance: 45.2,   price: 14.82,  change24h: -1.1, contractAddress: null },
];
const MOCK_TXS = [
  { hash: "0xaa1b...", type: "Receive", asset: "ETH",  amount: 1.0,   from: "0x742d…35cc", to: "0xAbc1…dead", date: "2024-06-20", status: "confirmed" },
  { hash: "0xaa2c...", type: "Send",    asset: "USDC", amount: 500.0, from: "0xAbc1…dead", to: "0x9fc3…11ab", date: "2024-06-18", status: "confirmed" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n ?? 0);
const fmtUSD = (n) => "$" + fmt(n);
const shortAddr = (a) => a?.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a || "—");

// ─── Small components ─────────────────────────────────────────────────────────
const Badge = ({ children, color = "slate" }) => {
  const colors = {
    green:  "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",
    red:    "bg-red-900/40 text-red-300 border border-red-700/40",
    blue:   "bg-blue-900/40 text-blue-300 border border-blue-700/40",
    purple: "bg-purple-900/40 text-purple-300 border border-purple-700/40",
    amber:  "bg-amber-900/40 text-amber-300 border border-amber-700/40",
    slate:  "bg-slate-800 text-slate-300 border border-slate-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${colors[color]}`}>{children}</span>;
};

const TxTypeBadge = ({ type }) => {
  const map = { Receive: "green", Send: "red", Swap: "blue", Stake: "purple", "Add LP": "amber" };
  return <Badge color={map[type] || "slate"}>{type}</Badge>;
};

const ChangeCell = ({ v }) => (
  <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>
    {v >= 0 ? "▲" : "▼"} {Math.abs(v ?? 0).toFixed(2)}%
  </span>
);

const TokenIcon = ({ symbol, logo }) =>
  logo ? (
    <img src={logo} alt={symbol} className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      onError={(e) => { e.target.style.display = "none"; }} />
  ) : (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
      {(symbol || "?")[0].toUpperCase()}
    </div>
  );

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

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
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="ex: kwM-2vnGHr2dttI0vMdOl"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 mb-3" />
        <p className="text-slate-500 text-xs mb-5 leading-relaxed">
          A chave é guardada apenas no teu browser e nunca enviada para servidores externos.
          Sem chave, a app usa dados simulados.
        </p>
        <div className="flex gap-3">
          <button onClick={() => { setApiKey(key); onClose(); }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            Guardar
          </button>
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Wallet Modal ─────────────────────────────────────────────────────────
function AddWalletModal({ onClose, onAdd }) {
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [network, setNetwork] = useState("Ethereum");
  const valid = /^0x[a-fA-F0-9]{40}$/.test(addr);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-semibold text-lg">Adicionar Carteira</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        <label className="block text-slate-400 text-sm mb-1">Endereço EVM</label>
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x..."
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 mb-1" />
        {addr && !valid && <p className="text-red-400 text-xs mb-3">Endereço inválido.</p>}
        {(!addr || valid) && <div className="mb-3" />}
        <label className="block text-slate-400 text-sm mb-1">Etiqueta (opcional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: DeFi Principal"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-3" />
        <label className="block text-slate-400 text-sm mb-1">Rede</label>
        <select value={network} onChange={(e) => setNetwork(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-5">
          {Object.keys(NETWORKS).map((n) => <option key={n}>{n}</option>)}
        </select>
        <div className="flex gap-3">
          <button disabled={!valid}
            onClick={() => { onAdd({ address: addr, label: label || shortAddr(addr), network }); onClose(); }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors">
            Adicionar
          </button>
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-sm transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── useWalletData hook ───────────────────────────────────────────────────────
function useWalletData(wallet, apiKey) {
  const [tokens, setTokens] = useState(null);
  const [txs, setTxs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 200));
      setTokens(MOCK_TOKENS);
      setTxs(MOCK_TXS);
      setLoading(false);
      return;
    }
    try {
      const [tokenData, txData] = await Promise.all([
        loadWalletData(wallet, apiKey),
        fetchTransactions(wallet.address, wallet.network, apiKey),
      ]);
      setTokens(tokenData);
      setTxs(txData);
    } catch (e) {
      setError(e.message);
      setTokens(MOCK_TOKENS);
      setTxs(MOCK_TXS);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address, wallet?.network, apiKey]);

  useEffect(() => { load(); }, [load]);
  return { tokens, txs, loading, error, reload: load };
}

// ─── Token Table ──────────────────────────────────────────────────────────────
function TokenTable({ tokens, loading }) {
  if (loading) return <Spinner />;
  if (!tokens?.length) return <p className="text-slate-500 text-sm p-6 text-center">Nenhum token encontrado.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
            <th className="text-left py-2 px-4">Token</th>
            <th className="text-right py-2 px-4">Saldo</th>
            <th className="text-right py-2 px-4">Preço</th>
            <th className="text-right py-2 px-4">Valor</th>
            <th className="text-right py-2 px-4">24h</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.symbol + (t.contractAddress || "")} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={t.symbol} logo={t.logoURI} />
                  <div>
                    <p className="text-white font-medium">{t.symbol}</p>
                    <p className="text-slate-500 text-xs">{t.name}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-right text-slate-300 font-mono">{fmt(t.balance, 4)}</td>
              <td className="py-3 px-4 text-right text-slate-300">{t.price > 0 ? fmtUSD(t.price) : "—"}</td>
              <td className="py-3 px-4 text-right text-white font-semibold">{t.price > 0 ? fmtUSD(t.balance * t.price) : "—"}</td>
              <td className="py-3 px-4 text-right">{t.price > 0 ? <ChangeCell v={t.change24h} /> : <span className="text-slate-600">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── TX Table ─────────────────────────────────────────────────────────────────
function TxTable({ txs, loading, wallet }) {
  if (loading) return <Spinner />;
  if (!txs?.length) return <p className="text-slate-500 text-sm p-6 text-center">Nenhuma transação encontrada.</p>;
  const net = NETWORKS[wallet?.network];
  return (
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
          {txs.map((tx) => (
            <tr key={tx.hash} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-3 px-4"><TxTypeBadge type={tx.type} /></td>
              <td className="py-3 px-4 text-slate-300 font-medium">{tx.asset}</td>
              <td className="py-3 px-4 text-right text-white font-mono">{fmt(tx.amount, 6)}</td>
              <td className="py-3 px-4">
                <p className="text-slate-400 text-xs font-mono">{shortAddr(tx.from)}</p>
                <p className="text-slate-500 text-xs">→ {shortAddr(tx.to)}</p>
              </td>
              <td className="py-3 px-4 text-slate-400 text-xs">{tx.date}</td>
              <td className="py-3 px-4">
                {net ? (
                  <a href={`${net.explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                    className="text-blue-400 text-xs font-mono hover:underline">{shortAddr(tx.hash)}</a>
                ) : (
                  <span className="text-slate-500 text-xs font-mono">{shortAddr(tx.hash)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Wallet Card ──────────────────────────────────────────────────────────────
function WalletCard({ wallet, selected, onClick, onRemove, tokens }) {
  const value = (tokens || []).reduce((s, t) => s + t.balance * t.price, 0);
  const nativeToken = tokens?.[0];
  return (
    <div onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${selected ? "border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-900/20" : "border-slate-700 bg-slate-800/50 hover:border-slate-500"}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-white font-medium text-sm truncate">{wallet.label}</p>
          <p className="text-slate-500 text-xs font-mono mt-0.5 truncate">{wallet.address}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(wallet.address); }} className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0">✕</button>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xl font-bold text-white">{tokens ? fmtUSD(value) : "…"}</p>
          <p className="text-slate-500 text-xs mt-0.5">{tokens ? `${tokens.length} tokens` : "a carregar…"} · {wallet.network}</p>
        </div>
        {nativeToken && nativeToken.change24h !== 0 && (
          <div className="text-right">
            <ChangeCell v={nativeToken.change24h} />
            <p className="text-slate-500 text-xs">{nativeToken.symbol} 24h</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Wallet Detail ────────────────────────────────────────────────────────────
function WalletDetail({ wallet, apiKey }) {
  const { tokens, txs, loading, error, reload } = useWalletData(wallet, apiKey);
  const [walletTab, setWalletTab] = useState("tokens");
  const value = (tokens || []).reduce((s, t) => s + t.balance * t.price, 0);
  const net = NETWORKS[wallet?.network];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0">
            <p className="text-white font-semibold">{wallet.label}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-500 text-xs font-mono truncate">{wallet.address}</p>
              {net && <a href={`${net.explorer}/address/${wallet.address}`} target="_blank" rel="noreferrer"
                className="text-blue-400 text-xs hover:underline flex-shrink-0">↗ explorer</a>}
            </div>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <p className="text-xl font-bold text-white">{tokens ? fmtUSD(value) : "…"}</p>
            <button onClick={reload} className="text-slate-500 text-xs hover:text-slate-300 transition-colors">↻ atualizar</button>
          </div>
        </div>
        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2 mb-3">
            <p className="text-red-300 text-xs">Erro ao carregar dados — a mostrar demo. Verifica a tua API key nas configurações.</p>
          </div>
        )}
        <div className="flex gap-1">
          {["tokens", "transactions"].map((t) => (
            <button key={t} onClick={() => setWalletTab(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${walletTab === t ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
              {t === "tokens" ? "Tokens" : "Transações"}
            </button>
          ))}
        </div>
      </div>
      {walletTab === "tokens" && <TokenTable tokens={tokens} loading={loading} />}
      {walletTab === "transactions" && <TxTable txs={txs} loading={loading} wallet={wallet} />}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewView({ wallets, walletsTokens, apiKey }) {
  const allTokens = {};
  let grand = 0;
  wallets.forEach((w) => {
    (walletsTokens[w.address] || []).forEach((t) => {
      const val = t.balance * t.price;
      grand += val;
      const key = t.symbol.toUpperCase();
      if (!allTokens[key]) allTokens[key] = { ...t, totalBalance: 0, totalValue: 0 };
      allTokens[key].totalBalance += t.balance;
      allTokens[key].totalValue += val;
    });
  });
  const tokenList = Object.values(allTokens).sort((a, b) => b.totalValue - a.totalValue);

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
          <div><p className="text-slate-400 text-xs">Tokens</p><p className="text-slate-300 font-semibold">{tokenList.length}</p></div>
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
                  const pct = grand > 0 ? (t.totalValue / grand) * 100 : 0;
                  return (
                    <tr key={t.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={t.symbol} logo={t.logoURI} />
                          <div>
                            <span className="text-white font-medium">{t.symbol}</span>
                            <p className="text-slate-500 text-xs">{t.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 font-mono">{fmt(t.totalBalance, 4)}</td>
                      <td className="py-3 px-4 text-right text-white font-semibold">{t.totalValue > 0 ? fmtUSD(t.totalValue) : "—"}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
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
  const [walletsTokens, setWalletsTokens] = useState({});

  useEffect(() => { localStorage.setItem("chainview_wallets", JSON.stringify(wallets)); }, [wallets]);

  // Load tokens for all wallets (for overview)
  useEffect(() => {
    wallets.forEach(async (w) => {
      if (walletsTokens[w.address + w.network]) return;
      if (!apiKey) {
        setWalletsTokens((p) => ({ ...p, [w.address + w.network]: MOCK_TOKENS }));
        return;
      }
      try {
        const data = await loadWalletData(w, apiKey);
        setWalletsTokens((p) => ({ ...p, [w.address + w.network]: data }));
      } catch {
        setWalletsTokens((p) => ({ ...p, [w.address + w.network]: MOCK_TOKENS }));
      }
    });
  }, [wallets, apiKey]);

  const saveApiKey = (key) => {
    setApiKey(key);
    setWalletsTokens({});
    if (key) localStorage.setItem("chainview_api_key", key);
    else localStorage.removeItem("chainview_api_key");
  };

  const addWallet = (w) => {
    setWallets((prev) => prev.find((x) => x.address === w.address && x.network === w.network) ? prev : [...prev, w]);
    setSelectedWallet(w.address + w.network);
    setTab("wallets");
  };

  const removeWallet = (addr, network) => {
    setWallets((prev) => {
      const next = prev.filter((w) => !(w.address === addr && w.network === network));
      if (selectedWallet === addr + network) setSelectedWallet(next[0] ? next[0].address + next[0].network : null);
      return next;
    });
    setWalletsTokens((p) => { const n = { ...p }; delete n[addr + network]; return n; });
  };

  const selectedWalletObj = wallets.find((w) => w.address + w.network === selectedWallet);

  // Build walletsTokens map keyed by address for overview
  const overviewTokens = {};
  Object.entries(walletsTokens).forEach(([key, tokens]) => {
    const wallet = wallets.find((w) => w.address + w.network === key);
    if (wallet) overviewTokens[wallet.address] = tokens;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={saveApiKey} />}
      {showAddWallet && <AddWalletModal onClose={() => setShowAddWallet(false)} onAdd={addWallet} />}

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold select-none">◈</div>
          <span className="font-semibold text-white text-lg tracking-tight">ChainView</span>
          {!apiKey && (
            <span onClick={() => setShowSettings(true)}
              className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full hidden sm:inline cursor-pointer hover:bg-amber-900/60 transition-colors">
              Modo demo — clica para ligar API
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {[{ id: "overview", label: "Visão Geral" }, { id: "wallets", label: "Carteiras" }].map((n) => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === n.id ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>
                {n.label}
              </button>
            ))}
          </nav>
          <button onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">⚙</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {tab === "overview" && <OverviewView wallets={wallets} walletsTokens={overviewTokens} apiKey={apiKey} />}

        {tab === "wallets" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Carteiras</h2>
                <button onClick={() => setShowAddWallet(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Adicionar</button>
              </div>
              {wallets.map((w) => (
                <WalletCard key={w.address + w.network} wallet={w}
                  selected={selectedWallet === w.address + w.network}
                  onClick={() => setSelectedWallet(w.address + w.network)}
                  onRemove={(addr) => removeWallet(addr, w.network)}
                  tokens={walletsTokens[w.address + w.network]} />
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
