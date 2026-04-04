'use strict';
const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const ows = require('../bindings/node/index.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VAULT = path.join(os.homedir(), '.ows-wallet');
fs.mkdirSync(VAULT, { recursive: true });

// ── Chain registry ────────────────────────────────────────────────────────────
// testnet: true  → shown in testnet mode
// testnet: false → shown in mainnet mode

const CHAINS = {
  // ── MAINNETS ──────────────────────────────────────────────────────────────
  'eip155:1': {
    name: 'Ethereum', symbol: 'ETH', decimals: 18, type: 'evm', testnet: false,
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    txHistory: 'https://eth.blockscout.com/api/v2/addresses/{addr}/transactions',
    color: '#627EEA',
  },
  'eip155:8453': {
    name: 'Base', symbol: 'ETH', decimals: 18, type: 'evm', testnet: false,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    txHistory: 'https://base.blockscout.com/api/v2/addresses/{addr}/transactions',
    color: '#0052FF',
  },
  'eip155:137': {
    name: 'Polygon', symbol: 'POL', decimals: 18, type: 'evm', testnet: false,
    rpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    txHistory: 'https://polygon.blockscout.com/api/v2/addresses/{addr}/transactions',
    color: '#8247E5',
  },
  'eip155:42161': {
    name: 'Arbitrum', symbol: 'ETH', decimals: 18, type: 'evm', testnet: false,
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    txHistory: 'https://arbitrum.blockscout.com/api/v2/addresses/{addr}/transactions',
    color: '#28A0F0',
  },
  'eip155:10': {
    name: 'Optimism', symbol: 'ETH', decimals: 18, type: 'evm', testnet: false,
    rpc: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    txHistory: 'https://optimism.blockscout.com/api/v2/addresses/{addr}/transactions',
    color: '#FF0420',
  },
  'eip155:56': {
    name: 'BNB Chain', symbol: 'BNB', decimals: 18, type: 'evm', testnet: false,
    rpc: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    txHistory: 'https://bsc.blockscout.com/api/v2/addresses/{addr}/transactions',
    color: '#F3BA2F',
  },

  // ── TESTNETS ──────────────────────────────────────────────────────────────
  // NOTE: EVM testnet addresses are identical to mainnet — same private key,
  // same 0x... address. Just look it up on the testnet explorer instead.
  'eip155:11155111': {
    name: 'Sepolia', symbol: 'ETH', decimals: 18, type: 'evm', testnet: true,
    rpc: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    txHistory: 'https://eth-sepolia.blockscout.com/api/v2/addresses/{addr}/transactions',
    faucets: [
      { name: 'Alchemy Faucet', url: 'https://sepoliafaucet.com' },
      { name: 'Chainlink Faucet', url: 'https://faucets.chain.link/sepolia' },
      { name: 'Infura Faucet', url: 'https://www.infura.io/faucet/sepolia' },
    ],
    color: '#627EEA',
    evmEquivalent: 'eip155:1',  // same address as Ethereum mainnet
  },
  'eip155:84532': {
    name: 'Base Sepolia', symbol: 'ETH', decimals: 18, type: 'evm', testnet: true,
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    txHistory: 'https://base-sepolia.blockscout.com/api/v2/addresses/{addr}/transactions',
    faucets: [
      { name: 'Coinbase Faucet', url: 'https://portal.cdp.coinbase.com/products/faucet' },
      { name: 'Superchain Faucet', url: 'https://app.optimism.io/faucet' },
    ],
    color: '#0052FF',
    evmEquivalent: 'eip155:1',
  },
  'eip155:80002': {
    name: 'Amoy (Polygon)', symbol: 'POL', decimals: 18, type: 'evm', testnet: true,
    rpc: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    txHistory: 'https://polygon-amoy.blockscout.com/api/v2/addresses/{addr}/transactions',
    faucets: [
      { name: 'Polygon Faucet', url: 'https://faucet.polygon.technology' },
    ],
    color: '#8247E5',
    evmEquivalent: 'eip155:1',
  },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
    name: 'Solana', symbol: 'SOL', decimals: 9, type: 'solana', testnet: false,
    rpc: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://solscan.io',
    explorerPath: '/account/{addr}',
    txHistory: 'solana_rpc',
    color: '#9945FF',
  },
  'solana:devnet': {
    name: 'Solana Devnet', symbol: 'SOL', decimals: 9, type: 'solana', testnet: true,
    rpc: 'https://api.devnet.solana.com',
    explorer: 'https://solscan.io',
    explorerPath: '/account/{addr}?cluster=devnet',
    txHistory: 'solana_rpc',
    faucets: [
      { name: 'Solana Faucet', url: 'https://faucet.solana.com' },
      { name: 'solfaucet.com', url: 'https://solfaucet.com' },
    ],
    color: '#9945FF',
    solanaEquivalent: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // same address
  },
  'bip122:000000000019d6689c085ae165831e93': {
    name: 'Bitcoin', symbol: 'BTC', decimals: 8, type: 'bitcoin', testnet: false,
    rpc: 'https://mempool.space/api',
    explorer: 'https://mempool.space',
    explorerPath: '/address/{addr}',
    txHistory: 'https://mempool.space/api/address/{addr}/txs',
    color: '#F7931A',
  },
  'cosmos:cosmoshub-4': {
    name: 'Cosmos', symbol: 'ATOM', decimals: 6, type: 'cosmos',
    rpc: 'https://cosmos-rest.publicnode.com',
    explorer: 'https://www.mintscan.io/cosmos',
    explorerPath: '/address/{addr}',
    txHistory: 'cosmos_lcd',
    color: '#2E3148',
  },
  'tron:mainnet': {
    name: 'Tron', symbol: 'TRX', decimals: 6, type: 'tron',
    rpc: 'https://api.trongrid.io',
    explorer: 'https://tronscan.org/#',
    explorerPath: '/address/{addr}',
    txHistory: 'https://api.trongrid.io/v1/accounts/{addr}/transactions?limit=20',
    color: '#FF0013',
  },
  'ton:mainnet': {
    name: 'TON', symbol: 'TON', decimals: 9, type: 'ton',
    rpc: 'https://toncenter.com/api/v2',
    explorer: 'https://tonscan.org',
    explorerPath: '/address/{addr}',
    txHistory: 'https://toncenter.com/api/v2/getTransactions?address={addr}&limit=20',
    color: '#0098EA',
  },
  'fil:mainnet': {
    name: 'Filecoin', symbol: 'FIL', decimals: 18, type: 'filecoin',
    rpc: 'https://api.node.glif.io/rpc/v1',
    explorer: 'https://filfox.info/en',
    explorerPath: '/address/{addr}',
    txHistory: 'https://filfox.info/api/v1/address/{addr}/messages?pageSize=20',
    color: '#0090FF',
  },
  'sui:mainnet': {
    name: 'Sui', symbol: 'SUI', decimals: 9, type: 'sui',
    rpc: 'https://fullnode.mainnet.sui.io:443',
    explorer: 'https://suiscan.xyz/mainnet',
    explorerPath: '/account/{addr}',
    txHistory: 'sui_rpc',
    color: '#6FBCF0',
  },
  'xrpl:mainnet': {
    name: 'XRPL', symbol: 'XRP', decimals: 6, type: 'xrpl', testnet: false,
    rpc: 'https://s1.ripple.com:51234',
    explorer: 'https://livenet.xrpl.org',
    explorerPath: '/accounts/{addr}',
    txHistory: 'xrpl_rpc',
    color: '#00B4E4',
  },
  'xrpl:testnet': {
    name: 'XRPL Testnet', symbol: 'XRP', decimals: 6, type: 'xrpl', testnet: true,
    rpc: 'https://s.altnet.rippletest.net:51234',
    explorer: 'https://testnet.xrpl.org',
    explorerPath: '/accounts/{addr}',
    txHistory: 'xrpl_rpc',
    faucets: [
      { name: 'XRPL Faucet', url: 'https://xrpl.org/resources/dev-tools/xrp-faucets' },
    ],
    color: '#00B4E4',
  },
};

function explorerAddressUrl(chainId, address) {
  const c = CHAINS[chainId];
  if (!c) return null;
  const path = c.explorerPath ? c.explorerPath.replace('{addr}', address) : `/address/${address}`;
  return c.explorer + path;
}

function explorerTxUrl(chainId, txHash) {
  const c = CHAINS[chainId];
  if (!c) return null;
  if (c.type === 'solana') return `${c.explorer}/tx/${txHash}`;
  if (c.type === 'bitcoin') return `${c.explorer}/tx/${txHash}`;
  if (c.type === 'cosmos') return `${c.explorer}/txs/${txHash}`;
  if (c.type === 'tron') return `${c.explorer}/transaction/${txHash}`;
  if (c.type === 'ton') return `${c.explorer}/tx/${txHash}`;
  if (c.type === 'filecoin') return `${c.explorer}/message/${txHash}`;
  if (c.type === 'sui') return `${c.explorer.replace('/account','')}/tx/${txHash}`;
  if (c.type === 'xrpl') return `${c.explorer}/transactions/${txHash}`;
  return `${c.explorer}/tx/${txHash}`;
}

// ── Balance fetching ──────────────────────────────────────────────────────────

async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function getBalance(chainId, address) {
  const c = CHAINS[chainId];
  if (!c) return null;

  try {
    if (c.type === 'evm') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'OWS-Wallet/1.0' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
      });
      const text = await res.text();
      let j;
      try { j = JSON.parse(text); } catch { return { error: 'RPC parse error', formatted: '—', symbol: c.symbol }; }
      if (j.result) {
        const wei = BigInt(j.result);
        return { raw: wei.toString(), formatted: formatUnits(wei, 18), symbol: c.symbol };
      }
      if (j.error) return { error: j.error.message, formatted: '—', symbol: c.symbol };
    }

    if (c.type === 'solana') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      });
      const j = await res.json();
      if (j.result !== undefined) {
        const lamports = BigInt(j.result.value ?? j.result);
        return { raw: lamports.toString(), formatted: formatUnits(lamports, 9), symbol: 'SOL' };
      }
    }

    if (c.type === 'bitcoin') {
      // Try mempool.space first, fall back to blockstream.info
      const urls = [`${c.rpc}/address/${address}`, `https://blockstream.info/api/address/${address}`];
      for (const url of urls) {
        try {
          const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (!res.ok) continue;
          const j = await res.json();
          const sat = BigInt((j.chain_stats?.funded_txo_sum ?? 0) - (j.chain_stats?.spent_txo_sum ?? 0));
          return { raw: sat.toString(), formatted: formatUnits(sat, 8), symbol: 'BTC' };
        } catch { continue; }
      }
      return { error: 'unavailable', formatted: '—', symbol: 'BTC' };
    }

    if (c.type === 'cosmos') {
      const res = await fetchWithTimeout(`${c.rpc}/cosmos/bank/v1beta1/balances/${address}`);
      const j = await res.json();
      const uatom = BigInt(j.balances?.find(b => b.denom === 'uatom')?.amount ?? 0);
      return { raw: uatom.toString(), formatted: formatUnits(uatom, 6), symbol: 'ATOM' };
    }

    if (c.type === 'tron') {
      const res = await fetchWithTimeout(`${c.rpc}/v1/accounts/${address}`);
      const j = await res.json();
      const sun = BigInt(j.data?.[0]?.balance ?? 0);
      return { raw: sun.toString(), formatted: formatUnits(sun, 6), symbol: 'TRX' };
    }

    if (c.type === 'ton') {
      const res = await fetchWithTimeout(`${c.rpc}/getAddressBalance?address=${encodeURIComponent(address)}`);
      const j = await res.json();
      const nano = BigInt(j.result ?? 0);
      return { raw: nano.toString(), formatted: formatUnits(nano, 9), symbol: 'TON' };
    }

    if (c.type === 'filecoin') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'Filecoin.WalletBalance', params: [address] }),
      });
      const j = await res.json();
      const attoFil = BigInt(j.result ?? 0);
      return { raw: attoFil.toString(), formatted: formatUnits(attoFil, 18), symbol: 'FIL' };
    }

    if (c.type === 'sui') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_getBalance', params: [address, '0x2::sui::SUI'] }),
      });
      const j = await res.json();
      const mist = BigInt(j.result?.totalBalance ?? 0);
      return { raw: mist.toString(), formatted: formatUnits(mist, 9), symbol: 'SUI' };
    }

    if (c.type === 'xrpl') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'account_info', params: [{ account: address, ledger_index: 'current' }] }),
      });
      const j = await res.json();
      const drops = BigInt(j.result?.account_data?.Balance ?? 0);
      return { raw: drops.toString(), formatted: formatUnits(drops, 6), symbol: 'XRP' };
    }
  } catch (e) {
    return { error: e.message, formatted: '—', symbol: c?.symbol };
  }
  return null;
}

function formatUnits(value, decimals) {
  const bigVal = BigInt(value);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = bigVal / divisor;
  const frac = bigVal % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

// ── Transaction history ───────────────────────────────────────────────────────

async function getTxHistory(chainId, address) {
  const c = CHAINS[chainId];
  if (!c) return [];

  try {
    // Blockscout for EVM chains
    if (c.type === 'evm' && c.txHistory) {
      const url = c.txHistory.replace('{addr}', address);
      const res = await fetchWithTimeout(url);
      const j = await res.json();
      return (j.items || []).slice(0, 20).map(tx => ({
        hash: tx.hash,
        from: tx.from?.hash,
        to: tx.to?.hash,
        value: tx.value ? formatUnits(BigInt(tx.value), 18) + ' ' + c.symbol : '0',
        timestamp: tx.timestamp,
        status: tx.status === 'ok' ? 'success' : 'failed',
        explorerUrl: explorerTxUrl(chainId, tx.hash),
      }));
    }

    if (c.type === 'bitcoin') {
      const url = c.txHistory.replace('{addr}', address);
      const res = await fetchWithTimeout(url);
      const txs = await res.json();
      return (txs || []).slice(0, 20).map(tx => {
        const received = tx.vout.filter(v => v.scriptpubkey_address === address).reduce((s, v) => s + v.value, 0);
        const sent = tx.vin.filter(v => v.prevout?.scriptpubkey_address === address).reduce((s, v) => s + v.prevout.value, 0);
        const net = received - sent;
        return {
          hash: tx.txid,
          value: (net >= 0 ? '+' : '') + formatUnits(BigInt(Math.abs(net)), 8) + ' BTC',
          timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
          status: tx.status.confirmed ? 'confirmed' : 'pending',
          explorerUrl: explorerTxUrl(chainId, tx.txid),
        };
      });
    }

    if (c.type === 'solana') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [address, { limit: 20 }] }),
      });
      const j = await res.json();
      return (j.result || []).map(tx => ({
        hash: tx.signature,
        timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
        status: tx.err ? 'failed' : 'success',
        memo: tx.memo,
        explorerUrl: explorerTxUrl(chainId, tx.signature),
      }));
    }

    if (c.type === 'xrpl') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'account_tx', params: [{ account: address, limit: 20 }] }),
      });
      const j = await res.json();
      return (j.result?.transactions || []).map(({ tx, meta }) => ({
        hash: tx.hash,
        from: tx.Account,
        to: tx.Destination,
        value: tx.Amount ? formatUnits(BigInt(tx.Amount), 6) + ' XRP' : '—',
        timestamp: tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : null,
        status: meta?.TransactionResult === 'tesSUCCESS' ? 'success' : 'failed',
        explorerUrl: explorerTxUrl(chainId, tx.hash),
      }));
    }

    if (c.type === 'tron') {
      const url = c.txHistory.replace('{addr}', address);
      const res = await fetchWithTimeout(url);
      const j = await res.json();
      return (j.data || []).slice(0, 20).map(tx => ({
        hash: tx.txID,
        timestamp: tx.block_timestamp ? new Date(tx.block_timestamp).toISOString() : null,
        status: tx.ret?.[0]?.contractRet === 'SUCCESS' ? 'success' : 'failed',
        explorerUrl: explorerTxUrl(chainId, tx.txID),
      }));
    }

    if (c.type === 'ton') {
      const url = c.txHistory.replace('{addr}', address);
      const res = await fetchWithTimeout(url);
      const j = await res.json();
      return (j.result || []).slice(0, 20).map(tx => ({
        hash: tx.transaction_id?.hash,
        timestamp: tx.utime ? new Date(tx.utime * 1000).toISOString() : null,
        value: tx.in_msg?.value ? formatUnits(BigInt(tx.in_msg.value), 9) + ' TON' : '—',
        status: 'confirmed',
        explorerUrl: tx.transaction_id?.hash ? explorerTxUrl(chainId, tx.transaction_id.hash) : null,
      }));
    }

    if (c.type === 'cosmos') {
      const res = await fetchWithTimeout(
        `${c.rpc}/cosmos/tx/v1beta1/txs?events=transfer.sender%3D%27${address}%27&pagination.limit=20`
      );
      const j = await res.json();
      return (j.txs || []).map((tx, i) => ({
        hash: j.tx_responses?.[i]?.txhash,
        timestamp: j.tx_responses?.[i]?.timestamp,
        status: j.tx_responses?.[i]?.code === 0 ? 'success' : 'failed',
        explorerUrl: j.tx_responses?.[i]?.txhash ? explorerTxUrl(chainId, j.tx_responses[i].txhash) : null,
      }));
    }

    if (c.type === 'filecoin') {
      const url = c.txHistory.replace('{addr}', address);
      const res = await fetchWithTimeout(url);
      const j = await res.json();
      return (j.messages || []).map(msg => ({
        hash: msg.cid,
        from: msg.from,
        to: msg.to,
        value: msg.value ? formatUnits(BigInt(msg.value), 18) + ' FIL' : '—',
        timestamp: msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : null,
        status: msg.exitCode === 0 ? 'success' : 'failed',
        explorerUrl: explorerTxUrl(chainId, msg.cid),
      }));
    }

    if (c.type === 'sui') {
      const res = await fetchWithTimeout(c.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'suix_queryTransactionBlocks',
          params: [{ filter: { FromAddress: address } }, null, 20, true],
        }),
      });
      const j = await res.json();
      return (j.result?.data || []).map(tx => ({
        hash: tx.digest,
        timestamp: tx.timestampMs ? new Date(Number(tx.timestampMs)).toISOString() : null,
        status: tx.errors?.length ? 'failed' : 'success',
        explorerUrl: explorerTxUrl(chainId, tx.digest),
      }));
    }
  } catch (e) {
    return [{ error: e.message }];
  }
  return [];
}

// ── API helpers ───────────────────────────────────────────────────────────────

function wrap(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      res.json({ ok: true, data: result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  };
}

// ── Wallet endpoints ──────────────────────────────────────────────────────────

app.get('/api/wallets', wrap(() => ows.listWallets(VAULT)));

app.post('/api/wallets', wrap((req) => {
  const { name, passphrase, words } = req.body;
  if (!name) throw new Error('name is required');
  return ows.createWallet(name, passphrase ?? null, words ?? 12, VAULT);
}));

app.post('/api/wallets/import/mnemonic', wrap((req) => {
  const { name, mnemonic, passphrase } = req.body;
  if (!name || !mnemonic) throw new Error('name and mnemonic are required');
  return ows.importWalletMnemonic(name, mnemonic, passphrase ?? null, null, VAULT);
}));

app.get('/api/wallets/:nameOrId', wrap((req) => ows.getWallet(req.params.nameOrId, VAULT)));

app.delete('/api/wallets/:nameOrId', wrap((req) => {
  ows.deleteWallet(req.params.nameOrId, VAULT);
  return 'deleted';
}));

app.patch('/api/wallets/:nameOrId/rename', wrap((req) => {
  const { newName } = req.body;
  if (!newName) throw new Error('newName is required');
  ows.renameWallet(req.params.nameOrId, newName, VAULT);
  return 'renamed';
}));

// ── Balance endpoint (live, all accounts in one call) ─────────────────────────

app.get('/api/wallets/:nameOrId/balances', wrap(async (req) => {
  const wallet = ows.getWallet(req.params.nameOrId, VAULT);
  const results = await Promise.all(
    wallet.accounts.map(async (account) => {
      const balance = await getBalance(account.chainId, account.address);
      const chain = CHAINS[account.chainId];
      return {
        chainId: account.chainId,
        address: account.address,
        chainName: chain?.name ?? account.chainId,
        symbol: chain?.symbol ?? '',
        color: chain?.color ?? '#888',
        explorerUrl: explorerAddressUrl(account.chainId, account.address),
        balance,
      };
    })
  );
  return results;
}));

// ── Transaction history ───────────────────────────────────────────────────────

app.get('/api/wallets/:nameOrId/txs/:chainId', wrap(async (req) => {
  const wallet = ows.getWallet(req.params.nameOrId, VAULT);
  const chainId = decodeURIComponent(req.params.chainId);
  const account = wallet.accounts.find(a => a.chainId === chainId);
  if (!account) throw new Error(`Chain ${chainId} not found in wallet`);
  return getTxHistory(chainId, account.address);
}));

// ── Mnemonic endpoints ────────────────────────────────────────────────────────

app.post('/api/mnemonic/generate', wrap((req) => {
  return ows.generateMnemonic(req.body.words ?? 12);
}));

app.post('/api/mnemonic/derive', wrap((req) => {
  const { mnemonic, chain, index } = req.body;
  if (!mnemonic || !chain) throw new Error('mnemonic and chain are required');
  return ows.deriveAddress(mnemonic, chain, index ?? 0);
}));

// ── Signing endpoints ─────────────────────────────────────────────────────────

app.post('/api/sign/message', wrap((req) => {
  const { wallet, chain, message, apiKey } = req.body;
  if (!wallet || !chain || !message) throw new Error('wallet, chain, and message are required');
  return ows.signMessage(wallet, chain, message, apiKey ?? null, null, null, VAULT);
}));

app.post('/api/sign/transaction', wrap((req) => {
  const { wallet, chain, txHex, apiKey } = req.body;
  if (!wallet || !chain || !txHex) throw new Error('wallet, chain, and txHex are required');
  return ows.signTransaction(wallet, chain, txHex, apiKey ?? null, null, VAULT);
}));

app.post('/api/sign/typed-data', wrap((req) => {
  const { wallet, chain, typedData, apiKey } = req.body;
  if (!wallet || !chain || !typedData) throw new Error('wallet, chain, and typedData are required');
  return ows.signTypedData(wallet, chain, JSON.stringify(typedData), apiKey ?? null, null, VAULT);
}));

// ── Policies & API keys ───────────────────────────────────────────────────────

app.get('/api/policies', wrap(() => ows.listPolicies(VAULT)));
app.post('/api/policies', wrap((req) => {
  ows.createPolicy(JSON.stringify(req.body), VAULT);
  return 'created';
}));
app.delete('/api/policies/:id', wrap((req) => {
  ows.deletePolicy(req.params.id, VAULT);
  return 'deleted';
}));

app.get('/api/keys', wrap(() => ows.listApiKeys(VAULT)));
app.post('/api/keys', wrap((req) => {
  const { name, walletIds, policyIds, expiresAt } = req.body;
  if (!name || !walletIds?.length) throw new Error('name and walletIds are required');
  return ows.createApiKey(name, walletIds, policyIds ?? [], '', expiresAt ?? null, VAULT);
}));
app.delete('/api/keys/:id', wrap((req) => {
  ows.revokeApiKey(req.params.id, VAULT);
  return 'revoked';
}));

// ── Network config (for frontend) ────────────────────────────────────────────

app.get('/api/networks', (req, res) => {
  const testnet = req.query.testnet === 'true';
  const filtered = Object.fromEntries(
    Object.entries(CHAINS).filter(([, c]) => (c.testnet ?? false) === testnet)
  );
  res.json(filtered);
});

// ── Testnet accounts: maps a wallet's mainnet addresses to testnet chains ─────
// EVM address is the same on all EVM networks (same private key).
// Solana address is the same on devnet.

app.get('/api/wallets/:nameOrId/testnet-accounts', wrap(async (req) => {
  const wallet = ows.getWallet(req.params.nameOrId, VAULT);
  const evmAccount  = wallet.accounts.find(a => a.chainId === 'eip155:1');
  const solAccount  = wallet.accounts.find(a => a.chainId.startsWith('solana:'));
  const xrplAccount = wallet.accounts.find(a => a.chainId === 'xrpl:mainnet');

  const testnetChains = Object.entries(CHAINS).filter(([, c]) => c.testnet);

  const results = await Promise.all(testnetChains.map(async ([chainId, chain]) => {
    let address = null;
    if (chain.type === 'evm')        address = evmAccount?.address  ?? null;
    if (chain.solanaEquivalent)      address = solAccount?.address  ?? null;
    if (chainId === 'xrpl:testnet')  address = xrplAccount?.address ?? null;
    if (!address) return null;

    // Fetch live balance from the testnet RPC
    const balance = await getBalance(chainId, address);

    return {
      chainId,
      chainName: chain.name,
      symbol: chain.symbol,
      color: chain.color,
      address,
      explorerUrl: explorerAddressUrl(chainId, address),
      faucets: chain.faucets ?? [],
      balance,
    };
  }));

  return results.filter(Boolean);
}));

// ── Send ──────────────────────────────────────────────────────────────────────

// Get live balance for a single address on a specific chain (for pre-send check)
app.get('/api/balance', wrap(async (req) => {
  const { chainId, address } = req.query;
  if (!chainId || !address) throw new Error('chainId and address required');
  const balance = await getBalance(chainId, address);
  return balance;
}));

// Send SOL (devnet or mainnet)
app.post('/api/send/sol', wrap(async (req) => {
  const { fromWallet, toAddress, amount, testnet } = req.body;
  if (!fromWallet || !toAddress || !amount) throw new Error('fromWallet, toAddress, and amount are required');

  const rpcUrl = testnet ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
  const lamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
  if (lamports <= 0) throw new Error('Amount must be greater than 0');

  // Resolve sender address
  const wallet = ows.getWallet(fromWallet, VAULT);
  const solAccount = wallet.accounts.find(a => a.chainId.startsWith('solana:'));
  if (!solAccount) throw new Error('No Solana account in this wallet');

  const connection = new Connection(rpcUrl, 'confirmed');
  const fromPubkey = new PublicKey(solAccount.address);
  const toPubkey   = new PublicKey(toAddress);

  // Fetch a fresh blockhash right before signing
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey });
  tx.add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports }));

  // Serialise with zero sig placeholder — OWS strips this, signs the message, returns signature hex
  tx.signatures = [{ publicKey: fromPubkey, signature: Buffer.alloc(64) }];
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const rawHex = serialized.toString('hex');

  // OWS signs the Solana message and returns the 64-byte signature
  const signResult = ows.signTransaction(fromWallet, 'solana', rawHex, null, null, VAULT);
  const sigBytes = Buffer.from(signResult.signature, 'hex');
  if (sigBytes.length !== 64) throw new Error(`Unexpected signature length: ${sigBytes.length}`);

  // Patch the signature into the serialised transaction (byte 1..64 is the sig slot)
  const signedBuf = Buffer.from(serialized);
  sigBytes.copy(signedBuf, 1);

  // Broadcast — don't await confirmation so the HTTP response returns fast.
  // The client can track status via the explorer URL.
  const txSig = await connection.sendRawTransaction(signedBuf, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 5,
  });

  // Fire-and-forget confirmation in background
  connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
    .then(() => console.log(`SOL tx confirmed: ${txSig}`))
    .catch(e => console.error(`SOL tx confirm failed: ${e.message}`));

  const explorerUrl = testnet
    ? `https://solscan.io/tx/${txSig}?cluster=devnet`
    : `https://solscan.io/tx/${txSig}`;

  return { txHash: txSig, explorerUrl, from: solAccount.address, to: toAddress, amount, lamports };
}));

// Send ETH on any EVM chain (testnet or mainnet)
app.post('/api/send/evm', wrap(async (req) => {
  const { fromWallet, toAddress, amount, chainId } = req.body;
  if (!fromWallet || !toAddress || !amount || !chainId) {
    throw new Error('fromWallet, toAddress, amount, and chainId are required');
  }
  const chain = CHAINS[chainId];
  if (!chain || chain.type !== 'evm') throw new Error(`Unknown EVM chain: ${chainId}`);

  const wallet = ows.getWallet(fromWallet, VAULT);
  const evmAccount = wallet.accounts.find(a => a.chainId === 'eip155:1');
  if (!evmAccount) throw new Error('No EVM account in this wallet');

  // Get nonce and gas price
  async function evmCall(method, params) {
    const res = await fetchWithTimeout(chain.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
  }

  const nonce = parseInt(await evmCall('eth_getTransactionCount', [evmAccount.address, 'latest']), 16);
  const gasPrice = BigInt(await evmCall('eth_gasPrice', []));
  const chainIdNum = parseInt(chainId.split(':')[1]);
  const value = BigInt(Math.round(parseFloat(amount) * 1e18));

  // Build EIP-1559 tx (type 2) — encode with RLP
  const { encode: rlpEncode } = (() => {
    function encode(input) {
      if (Array.isArray(input)) {
        const payload = Buffer.concat(input.map(encode));
        return Buffer.concat([encodeLength(payload.length, 0xc0), payload]);
      }
      const buf = toBuffer(input);
      if (buf.length === 1 && buf[0] < 0x80) return buf;
      return Buffer.concat([encodeLength(buf.length, 0x80), buf]);
    }
    function encodeLength(len, offset) {
      if (len < 56) return Buffer.from([len + offset]);
      const hexLen = len.toString(16).padStart(2, '0');
      const bLen = Buffer.from(hexLen.length % 2 ? '0' + hexLen : hexLen, 'hex');
      return Buffer.concat([Buffer.from([offset + 55 + bLen.length]), bLen]);
    }
    function toBuffer(v) {
      if (typeof v === 'bigint') {
        if (v === 0n) return Buffer.alloc(0);
        let h = v.toString(16);
        if (h.length % 2) h = '0' + h;
        return Buffer.from(h, 'hex');
      }
      if (typeof v === 'number') return toBuffer(BigInt(v));
      if (typeof v === 'string' && v.startsWith('0x')) return Buffer.from(v.slice(2) || '', 'hex');
      if (Buffer.isBuffer(v)) return v;
      return Buffer.alloc(0);
    }
    return { encode };
  })();

  const maxFeePerGas = gasPrice * 2n;
  const maxPriorityFeePerGas = 1500000000n; // 1.5 gwei

  // EIP-1559 signing payload: 0x02 || rlp([chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList])
  const toAddr = toAddress.startsWith('0x') ? toAddress : '0x' + toAddress;
  const signingPayload = Buffer.concat([
    Buffer.from([0x02]),
    rlpEncode([chainIdNum, nonce, maxPriorityFeePerGas, maxFeePerGas, 21000n, toAddr, value, Buffer.alloc(0), []]),
  ]);

  const signResult = ows.signTransaction(fromWallet, 'evm', signingPayload.toString('hex'), null, null, VAULT);
  // OWS returns the full signed tx hex for EVM
  const rawTx = '0x' + signResult.signature;

  const txHash = await evmCall('eth_sendRawTransaction', [rawTx]);
  const explorerUrl = explorerTxUrl(chainId, txHash);

  return { txHash, explorerUrl, from: evmAccount.address, to: toAddress, amount, chainId };
}));

// ── Signature verification ────────────────────────────────────────────────────
app.post('/api/verify', wrap(async (req) => {
  const { chain, address, message, signature } = req.body;
  if (!chain || !address || !message || !signature) {
    throw new Error('chain, address, message, and signature are required');
  }

  const sigBytes = Buffer.from(signature, 'hex');

  if (chain === 'solana') {
    const bs58 = require('bs58');
    const pubkeyBytes = bs58.decode(address);
    if (pubkeyBytes.length !== 32) throw new Error('Invalid Solana address (expected 32 bytes)');
    if (sigBytes.length !== 64) throw new Error('Invalid ed25519 signature length (expected 64 bytes)');
    const msgBytes = Buffer.from(message, 'utf8');
    const { subtle } = globalThis.crypto;
    const key = await subtle.importKey('raw', pubkeyBytes, { name: 'Ed25519' }, false, ['verify']);
    const valid = await subtle.verify('Ed25519', key, sigBytes, msgBytes);
    return { valid, chain: 'solana', address, message };
  }

  if (chain === 'evm' || chain === 'base' || chain === 'ethereum') {
    // personal_sign hash: keccak256("\x19Ethereum Signed Message:\n" + len + message)
    let keccak256, secp256k1;
    try {
      ({ keccak256 } = require('ethereum-cryptography/keccak.js'));
      ({ secp256k1 } = require('ethereum-cryptography/secp256k1.js'));
    } catch {
      return {
        valid: null,
        chain: 'evm',
        message: 'ethereum-cryptography not installed. Run: npm install ethereum-cryptography',
        tip: 'Verify manually at https://etherscan.io/verifySig',
      };
    }
    const msgBytes = Buffer.from(message, 'utf8');
    const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${msgBytes.length}`, 'utf8');
    const hash = keccak256(Buffer.concat([prefix, msgBytes]));
    if (sigBytes.length !== 65) throw new Error('Invalid EVM signature length (expected 65 bytes)');
    const v = sigBytes[64];
    const recovery = v >= 27 ? v - 27 : v;
    const sig = secp256k1.Signature
      .fromCompact(sigBytes.slice(0, 64).toString('hex'))
      .addRecoveryBit(recovery);
    const pubkey = sig.recoverPublicKey(hash).toRawBytes(false);
    const addrHash = keccak256(pubkey.slice(1));
    const recovered = '0x' + Buffer.from(addrHash.slice(12)).toString('hex');
    const valid = recovered.toLowerCase() === address.toLowerCase();
    return { valid, chain: 'evm', address, recovered, message };
  }

  throw new Error(`Verification not supported for chain: ${chain}. Supported: solana, evm`);
}));

// ── Import from private key (via API) ────────────────────────────────────────
app.post('/api/wallets/import/privatekey', wrap((req) => {
  const { name, privateKey, curve } = req.body;
  if (!name || !privateKey) throw new Error('name and privateKey are required');
  return ows.importWalletPrivateKey(name, privateKey, null, VAULT, curve ?? 'evm');
}));

// ── Health check (for Render / load balancers) ────────────────────────────────
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  OWS Wallet running at http://0.0.0.0:${PORT}`);
  console.log(`  Vault: ${VAULT}\n`);
});
