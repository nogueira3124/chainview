import { useState } from "react";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_TOKENS = {
  "0xAbc1...dead": [
    { symbol: "ETH",  name: "Ethereum",    balance: 2.418,   price: 3421.5,  change24h: 2.3  },
    { symbol: "USDC", name: "USD Coin",    balance: 1850.0,  price: 1.0,     change24h: 0.01 },
    { symbol: "LINK", name: "Chainlink",   balance: 45.2,    price: 14.82,   change24h: -1.1 },
  ],
  "0xDef2...cafe": [
    { symbol: "ETH",  name: "Ethereum",    balance: 0.75,    price: 3421.5,  change24h: 2.3  },
    { symbol: "WBTC", name: "Wrapped BTC", balance: 0.012,   price: 67200.0, change24h: 1.8  },
    { symbol: "AAVE", name: "Aave",        balance: 8.3,     price: 88.5,    change24h: -0.5 },
  ],
  "0xFee3...babe": [
    { symbol: "ETH",  name: "Ethereum",    balance: 5.001,   price: 3421.5,  change24h: 2.3  },
    { symbol: "USDT", name: "Tether",      balance: 4200.0,  price: 1.0,     change24h: 0.0  },
    { symbol: "UNI",  name: "Uniswap",     balance: 120.0,   price: 6.74,    change24h: 3.2  },
    { symbol: "CRV",  name: "Curve DAO",   balance: 890.0,   price: 0.41,    change24h: -2.1 },
  ],
};

const MOCK_TXS = {
  "0xAbc1...dead": [
    { hash: "0xaa1b...", type: "Receive", asset: "ETH",  amount: 1.0,    value: 3421.5, from: "0x742d...", to: "0xAbc1...", date: "2024-06-20", status: "confirmed" },
    { hash: "0xaa2c...", type: "Swap",    asset: "USDC", amount: 500.0,  value: 500.0,  from: "0xAbc1...", to: "Uniswap",   date: "2024-06-18", status: "confirmed" },
    { hash: "0xaa3d...", type: "Send",    asset: "LINK", amount: 10.0,   value: 148.2,  from: "0xAbc1...", to: "0x9fc3...", date: "2024-06-15", status: "confirmed" },
  ],
  "0xDef2...cafe": [
    { hash: "0xbb1a...", type: "Receive", asset: "WBTC", amount: 0.012,  value: 806.4,  from: "0xcbex...", to: "0xDef2...", date: "2024-06-21", status: "confirmed" },
    { hash: "0xbb2b...", type: "Stake",   asset: "AAVE", amount: 8.3,    value: 734.6,  from: "0xDef2...", to: "Aave Pool", date: "2024-06-17", status: "confirmed" },
  ],
  "0xFee3...babe": [
    { hash: "0xcc1a...", type: "Add LP",  asset: "ETH/USDT", amount: 2.0, value: 6843.0, from: "0xFee3...", to: "Uniswap V3", date: "2024-06-19", status: "confirmed" },
    { hash: "0xcc2b...", type: "Receive", asset: "CRV",  amount: 890.0,  value: 364.9,  from: "0x3pool...", to: "0xFee3...", date: "2024-06-12", status: "confirmed" },
  ],
};

const MOCK_DEFI = [
  { id: 1, protocol: "Aave V3",     type: "Lending",        asset: "ETH",       value: 5132.25, apy: 3.2,  wallet: "0xDef2...cafe", network: "Ethereum" },
  { id: 2, protocol: "Uniswap V3",  type: "Liquidity Pool", asset: "ETH/USDT",  value: 6843.0,  apy: 18.5, wallet: "0xFee3...babe", network: "Ethereum" },
  { id: 3, protocol: "Curve 3pool", type: "Staking",        asset: "3CRV",      value: 892.1,   apy: 5.8,  wallet: "0xFee3...babe", network: "Ethereum" },
  { id: 4, protocol: "Lido",        type: "Staking",        asset: "stETH",     value: 2737.2,  apy: 4.1,  wallet: "0xAbc1...dead", network: "Ethereum" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtUSD = (n) => "$" + fmt(n);
const shortAddr = (a) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const walletValue = (addr) =>
  (MOCK_TOKENS[addr] || []).reduce((s, t) => s + t.balance * t.price, 0);

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
    {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%
  </span>
);

const TokenIcon = ({ symbol }) => (
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
    {symbol[0]}
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
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Insere a tua chave Alchemy..."
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 mb-3"
        />
        <p className="text-slate-500 text-xs mb-5 leading-relaxed">
          A chave é guardada apenas no browser (localStorage) e nunca enviada para servidores externos.
          Sem chave, a app usa dados simulados para demonstração.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setApiKey(key); onClose(); }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
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
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x..."
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 mb-1"
        />
        {addr && !valid && (
          <p className="text-red-400 text-xs mb-3">Endereço inválido — deve ser 0x seguido de 40 caracteres hex.</p>
        )}
        {(!addr || valid) && <div className="mb-3" />}
        <label className="block text-slate-400 text-sm mb-1">Etiqueta (opcional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex: DeFi Principal"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-3"
        />
        <label className="block text-slate-400 text-sm mb-1">Rede</label>
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-5"
        >
          {["Ethereum", "Polygon", "Arbitrum", "Optimism", "Base"].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <div className="flex gap-3">
          <button
            disabled={!valid}
            onClick={() => { onAdd({ address: addr, label: label || shortAddr(addr), network }); onClose(); }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
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

// ─── Token Table ──────────────────────────────────────────────────────────────
function TokenTable({ address }) {
  const tokens = MOCK_TOKENS[address] || [];
  if (!tokens.length)
    return <p className="text-slate-500 text-sm p-6 text-center">Nenhum token encontrado.</p>;
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
            <tr key={t.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={t.symbol} />
                  <div>
                    <p className="text-white font-medium">{t.symbol}</p>
                    <p className="text-slate-500 text-xs">{t.name}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-right text-slate-300 font-mono">{fmt(t.balance, 4)}</td>
              <td className="py-3 px-4 text-right text-slate-300">{fmtUSD(t.price)}</td>
              <td className="py-3 px-4 text-right text-white font-semibold">{fmtUSD(t.balance * t.price)}</td>
              <td className="py-3 px-4 text-right"><ChangeCell v={t.change24h} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── TX Table ─────────────────────────────────────────────────────────────────
function TxTable({ address }) {
  const txs = MOCK_TXS[address] || [];
  if (!txs.length)
    return <p className="text-slate-500 text-sm p-6 text-center">Nenhuma transação encontrada.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800 text-xs uppercase tracking-wider">
            <th className="text-left py-2 px-4">Tipo</th>
            <th className="text-left py-2 px-4">Ativo</th>
            <th className="text-right py-2 px-4">Valor</th>
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
              <td className="py-3 px-4 text-right">
                <p className="text-white font-semibold">{fmtUSD(tx.value)}</p>
                <p className="text-slate-500 text-xs font-mono">{typeof tx.amount === "number" ? fmt(tx.amount, 4) : "—"}</p>
              </td>
              <td className="py-3 px-4">
                <p className="text-slate-400 text-xs font-mono">{shortAddr(tx.from)}</p>
                <p className="text-slate-500 text-xs">→ {shortAddr(tx.to)}</p>
              </td>
              <td className="py-3 px-4 text-slate-400 text-xs">{tx.date}</td>
              <td className="py-3 px-4 text-blue-400 text-xs font-mono cursor-pointer hover:underline">{tx.hash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Wallet Card ──────────────────────────────────────────────────────────────
function WalletCard({ wallet, selected, onClick, onRemove }) {
  const tokens = MOCK_TOKENS[wallet.address] || [];
  const value = walletValue(wallet.address);
  const ethToken = tokens.find((t) => t.symbol === "ETH");
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${
        selected
          ? "border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-900/20"
          : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-white font-medium text-sm truncate">{wallet.label}</p>
          <p className="text-slate-500 text-xs font-mono mt-0.5 truncate">{wallet.address}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(wallet.address); }}
          className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0"
        >✕</button>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xl font-bold text-white">{fmtUSD(value)}</p>
          <p className="text-slate-500 text-xs mt-0.5">{tokens.length} tokens · {wallet.network}</p>
        </div>
        {ethToken && (
          <div className="text-right">
            <ChangeCell v={ethToken.change24h} />
            <p className="text-slate-500 text-xs">ETH 24h</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Overview View ────────────────────────────────────────────────────────────
function OverviewView({ wallets }) {
  const walletsTotal = wallets.reduce((s, w) => s + walletValue(w.address), 0);
  const defiTotal = MOCK_DEFI.reduce((s, p) => s + p.value, 0);
  const grand = walletsTotal + defiTotal;

  const allTokens = {};
  wallets.forEach((w) => {
    (MOCK_TOKENS[w.address] || []).forEach((t) => {
      if (!allTokens[t.symbol]) allTokens[t.symbol] = { ...t, balance: 0 };
      allTokens[t.symbol].balance += t.balance;
    });
  });
  const tokenList = Object.values(allTokens).sort((a, b) => b.balance * b.price - a.balance * a.price);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-950/60 to-purple-950/60 border border-blue-800/40 rounded-2xl p-6">
        <p className="text-slate-400 text-sm mb-1">Portfólio Total</p>
        <p className="text-4xl font-bold text-white mb-4">{fmtUSD(grand)}</p>
        <div className="flex gap-8">
          <div>
            <p className="text-slate-400 text-xs">Carteiras</p>
            <p className="text-blue-300 font-semibold">{fmtUSD(walletsTotal)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">DeFi</p>
            <p className="text-purple-300 font-semibold">{fmtUSD(defiTotal)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Nº Carteiras</p>
            <p className="text-slate-300 font-semibold">{wallets.length}</p>
          </div>
        </div>
      </div>

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
                const val = t.balance * t.price;
                const pct = grand > 0 ? (val / grand) * 100 : 0;
                return (
                  <tr key={t.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={t.symbol} />
                        <span className="text-white font-medium">{t.symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300 font-mono">{fmt(t.balance, 4)}</td>
                    <td className="py-3 px-4 text-right text-white font-semibold">{fmtUSD(val)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-slate-400 text-xs w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right"><ChangeCell v={t.change24h} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── DeFi View ────────────────────────────────────────────────────────────────
function DeFiView({ wallets }) {
  const walletAddrs = new Set(wallets.map((w) => w.address));
  const positions = MOCK_DEFI.filter((p) => walletAddrs.has(p.wallet));
  const total = positions.reduce((s, p) => s + p.value, 0);
  const totalYearly = positions.reduce((s, p) => s + (p.value * p.apy) / 100, 0);
  const typeColors = { Lending: "blue", "Liquidity Pool": "purple", Staking: "amber" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-400 text-xs mb-1">Total em DeFi</p>
          <p className="text-2xl font-bold text-white">{fmtUSD(total)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-400 text-xs mb-1">Yield Anual Estimado</p>
          <p className="text-2xl font-bold text-emerald-400">{fmtUSD(totalYearly)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-400 text-xs mb-1">Posições Ativas</p>
          <p className="text-2xl font-bold text-white">{positions.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {positions.map((p) => (
          <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-700 to-blue-700 flex items-center justify-center text-white font-bold">
                  {p.protocol[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{p.protocol}</p>
                    <Badge color={typeColors[p.type] || "slate"}>{p.type}</Badge>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{p.asset} · {p.network} · {shortAddr(p.wallet)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">{fmtUSD(p.value)}</p>
                <p className="text-emerald-400 text-sm">{p.apy}% APY</p>
              </div>
            </div>
          </div>
        ))}
        {positions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-4xl mb-3">🌾</p>
            <p>Nenhuma posição DeFi encontrada nas carteiras adicionadas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [wallets, setWallets] = useState([
    { address: "0xAbc1...dead", label: "DeFi Principal", network: "Ethereum" },
    { address: "0xDef2...cafe", label: "Aave / Lending",  network: "Ethereum" },
    { address: "0xFee3...babe", label: "LP & Yield",      network: "Ethereum" },
  ]);
  const [selectedWallet, setSelectedWallet] = useState("0xAbc1...dead");
  const [tab, setTab] = useState("overview");
  const [walletTab, setWalletTab] = useState("tokens");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("chainview_api_key") || "");

  const saveApiKey = (key) => {
    setApiKey(key);
    if (key) localStorage.setItem("chainview_api_key", key);
    else localStorage.removeItem("chainview_api_key");
  };

  const addWallet = (w) => {
    setWallets((prev) => [...prev, w]);
    setSelectedWallet(w.address);
    setTab("wallets");
  };

  const removeWallet = (addr) => {
    setWallets((prev) => {
      const next = prev.filter((w) => w.address !== addr);
      if (selectedWallet === addr && next.length) setSelectedWallet(next[0].address);
      return next;
    });
  };

  const navItems = [
    { id: "overview", label: "Visão Geral" },
    { id: "wallets",  label: "Carteiras"   },
    { id: "defi",     label: "DeFi"        },
  ];

  const selectedWalletObj = wallets.find((w) => w.address === selectedWallet);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={saveApiKey} />
      )}
      {showAddWallet && (
        <AddWalletModal onClose={() => setShowAddWallet(false)} onAdd={addWallet} />
      )}

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold select-none">
            ◈
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">ChainView</span>
          {!apiKey && (
            <span className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full hidden sm:inline">
              Modo demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === n.id ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Configurações"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {tab === "overview" && <OverviewView wallets={wallets} />}

        {tab === "wallets" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Carteiras</h2>
                <button
                  onClick={() => setShowAddWallet(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Adicionar
                </button>
              </div>
              {wallets.map((w) => (
                <WalletCard
                  key={w.address}
                  wallet={w}
                  selected={selectedWallet === w.address}
                  onClick={() => setSelectedWallet(w.address)}
                  onRemove={removeWallet}
                />
              ))}
              {wallets.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  <p className="text-3xl mb-2">👛</p>
                  <p className="text-sm">Nenhuma carteira adicionada.</p>
                  <button
                    onClick={() => setShowAddWallet(true)}
                    className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    + Adicionar carteira
                  </button>
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2">
              {selectedWalletObj ? (
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0">
                        <p className="text-white font-semibold">{selectedWalletObj.label}</p>
                        <p className="text-slate-500 text-xs font-mono mt-0.5 truncate">{selectedWallet}</p>
                      </div>
                      <p className="text-xl font-bold text-white ml-4 flex-shrink-0">
                        {fmtUSD(walletValue(selectedWallet))}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {["tokens", "transactions"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setWalletTab(t)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            walletTab === t ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {t === "tokens" ? "Tokens" : "Transações"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {walletTab === "tokens" && <TokenTable address={selectedWallet} />}
                  {walletTab === "transactions" && <TxTable address={selectedWallet} />}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-500">
                  <p>Seleciona uma carteira para ver os detalhes.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "defi" && <DeFiView wallets={wallets} />}
      </main>
    </div>
  );
}
