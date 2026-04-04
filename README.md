# OWS — Open Wallet Standard

**Local, policy-gated signing and wallet management for every chain.**

[![CI](https://github.com/open-wallet-standard/core/actions/workflows/ci.yml/badge.svg)](https://github.com/open-wallet-standard/core/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@open-wallet-standard/core)](https://www.npmjs.com/package/@open-wallet-standard/core)
[![PyPI](https://img.shields.io/pypi/v/open-wallet-standard)](https://pypi.org/project/open-wallet-standard/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem

Every AI agent that touches crypto faces the same question: *who holds the keys?*

Handing a raw private key to an agent is a security nightmare. Routing every signature through a centralized custody service reintroduces the trust problem you were trying to solve. And building chain-specific signing logic for each network your agent needs to support is a treadmill that never ends.

OWS is a different approach — a local signing standard that keeps private keys in your vault, gates agent access through policies you define, and speaks every chain through one interface.

---

## What OWS Does

- **One mnemonic, every chain.** Create a wallet once and get addresses for EVM, Solana, Bitcoin, Cosmos, Tron, TON, Sui, Filecoin, and XRPL — all derived from the same seed.

- **Keys never leave the vault.** Private keys are encrypted at rest and decrypted only inside the OWS signing path, after all policy checks pass. Key material is wiped from memory after use. OWS never returns raw private keys through its API.

- **Agents get scoped tokens, not keys.** Issue API keys that are bound to specific wallets and constrained by policies — allowed chains, expiry dates, custom executable hooks. The agent signs; it never sees the secret.

- **Policy before signing.** The policy engine runs before decryption. A policy violation means the key is never touched.

- **Built to interoperate.** Any wallet created with one OWS tool works with every other — CLI, Node.js SDK, Python bindings, or the REST demo server.

---

## Install

```bash
# Full install — CLI + Node.js SDK + Python bindings
curl -fsSL https://docs.openwallet.sh/install.sh | bash
```

Or install only what your project needs:

```bash
npm install @open-wallet-standard/core      # Node.js
npm install -g @open-wallet-standard/core   # Node.js + ows CLI
pip install open-wallet-standard             # Python
cd ows && cargo build --workspace --release  # Build from source
```

The language bindings embed the Rust core via native FFI — no separate runtime to manage. Installing the npm package globally also registers the `ows` CLI command.

---

## Quick Start

### CLI

```bash
# Create a wallet — derives addresses for all 9 supported chains
ows wallet create --name "agent-treasury"

# Sign a message
ows sign message --wallet agent-treasury --chain evm --message "hello"

# Sign a transaction
ows sign tx --wallet agent-treasury --chain evm --tx "deadbeef..."
```

### Node.js

```javascript
import { createWallet, signMessage, signTransaction } from "@open-wallet-standard/core";

// One call creates accounts on all 9 chains
const wallet = createWallet("agent-treasury");

const sig = signMessage("agent-treasury", "evm", "hello");
console.log(sig.signature);
```

### Python

```python
from open_wallet_standard import create_wallet, sign_message

wallet = create_wallet("agent-treasury")

sig = sign_message("agent-treasury", "evm", "hello")
print(sig["signature"])
```

---

## Agent Access Control

This is the core of what makes OWS useful for autonomous agents.

### 1. Define a policy

```bash
cat > policy.json << 'EOF'
{
  "id": "base-only",
  "name": "Base chain, expires end of year",
  "version": 1,
  "created_at": "2026-01-01T00:00:00Z",
  "rules": [
    { "type": "allowed_chains", "chain_ids": ["eip155:8453"] },
    { "type": "expires_at", "timestamp": "2026-12-31T23:59:59Z" }
  ],
  "action": "deny"
}
EOF
ows policy create --file policy.json
```

### 2. Issue a scoped API key

```bash
ows key create --name "my-agent" --wallet agent-treasury --policy base-only
# => ows_key_a1b2c3d4...  (save this — shown once)
```

### 3. The agent signs with the token

```bash
# Allowed — Base is in the policy
OWS_PASSPHRASE="ows_key_a1b2c3..." ows sign tx \
  --wallet agent-treasury --chain base --tx 0x02f8...

# Blocked — Ethereum mainnet is not
OWS_PASSPHRASE="ows_key_a1b2c3..." ows sign tx \
  --wallet agent-treasury --chain ethereum --tx 0x02f8...
# error: policy denied: chain eip155:1 not in allowlist
```

```javascript
import { signTransaction } from "@open-wallet-standard/core";

// Agent uses the API token — policy engine runs before the key is touched
const result = signTransaction(
  "agent-treasury", "base", "02f8...",
  "ows_key_a1b2c3..."
);
```

### 4. Revoke instantly

```bash
ows key revoke --id <key-id> --confirm
# Token is dead immediately — no rotation needed
```

---

## Architecture

```
Agent / CLI / App
       │
       │  OWS Interface (SDK / CLI / REST)
       ▼
┌──────────────────────┐
│     Access Layer      │     1. Caller invokes sign()
│  ┌─────────────────┐  │     2. Policy engine evaluates API token
│  │  Policy Engine   │  │     3. Key decrypted in hardened memory
│  │  (pre-signing)   │  │     4. Transaction signed
│  └────────┬────────┘  │     5. Key wiped from memory
│  ┌────────▼────────┐  │     6. Signature returned
│  │  Signing Core    │  │
│  │  (in-process)    │  │     Raw private keys are never
│  └────────┬────────┘  │     returned through the API.
│  ┌────────▼────────┐  │
│  │   Wallet Vault   │  │
│  │ ~/.ows/wallets/  │  │
│  └─────────────────┘  │
└──────────────────────┘
```

---

## Supported Chains

| Chain | Curve | Address Format | Derivation Path |
|---|---|---|---|
| EVM (Ethereum, Base, Polygon, …) | secp256k1 | EIP-55 checksummed hex | `m/44'/60'/0'/0/0` |
| Solana | Ed25519 | base58 | `m/44'/501'/0'/0'` |
| Bitcoin | secp256k1 | BIP-84 bech32 | `m/84'/0'/0'/0/0` |
| Cosmos | secp256k1 | bech32 | `m/44'/118'/0'/0/0` |
| Tron | secp256k1 | base58check | `m/44'/195'/0'/0/0` |
| TON | Ed25519 | raw / bounceable | `m/44'/607'/0'` |
| Sui | Ed25519 | 0x + BLAKE2b-256 | `m/44'/784'/0'/0'/0'` |
| Filecoin | secp256k1 | f1 base32 | `m/44'/461'/0'/0/0` |
| XRPL | secp256k1 | base58check | `m/44'/144'/0'/0/0` |
| Spark (Bitcoin L2) | secp256k1 | spark: prefixed | `m/84'/0'/0'/0/0` |

All chains are first-class — not plugins, not afterthoughts. CAIP-2 and CAIP-10 addressing is used throughout so chain-specific details stay internal to OWS.

---

## CLI Reference

| Command | Description |
|---|---|
| `ows wallet create` | Create a wallet with addresses for all supported chains |
| `ows wallet list` | List all wallets in the vault |
| `ows wallet info` | Show vault path and supported chain details |
| `ows sign message` | Sign a message with chain-appropriate formatting |
| `ows sign tx` | Sign a raw transaction hex |
| `ows pay request` | Make a request to an x402-enabled API, handling payment automatically |
| `ows pay discover` | Discover x402-enabled services |
| `ows fund deposit` | Initiate a deposit to fund a wallet with USDC |
| `ows fund balance` | Check token balances across chains |
| `ows mnemonic generate` | Generate a BIP-39 mnemonic phrase |
| `ows mnemonic derive` | Derive an address from a mnemonic for a given chain |
| `ows policy create` | Register a signing policy from a JSON file |
| `ows policy list` | List all registered policies |
| `ows key create` | Issue a scoped API key for agent access |
| `ows key list` | List all active API keys |
| `ows key revoke` | Revoke an API key immediately |
| `ows update` | Update OWS and its bindings |
| `ows uninstall` | Remove OWS from the system |

---

## Specification

The full specification lives in [`docs/`](docs/) and at [openwallet.sh](https://openwallet.sh).

| Document | Contents |
|---|---|
| [00 — Specification](docs/00-specification.md) | Scope, document classes, conformance, and extension points |
| [01 — Storage Format](docs/01-storage-format.md) | Vault layout, keystore schema, filesystem permissions |
| [02 — Signing Interface](docs/02-signing-interface.md) | sign, signAndSend, and signMessage operations |
| [03 — Policy Engine](docs/03-policy-engine.md) | Pre-signing policies, rule types, and executable hooks |
| [04 — Agent Access Layer](docs/04-agent-access-layer.md) | API key issuance, token format, and access profiles |
| [05 — Key Isolation](docs/05-key-isolation.md) | Deployment guidance for process-level key isolation |
| [06 — Wallet Lifecycle](docs/06-wallet-lifecycle.md) | Creation, import, recovery, deletion, and rotation |
| [07 — Supported Chains](docs/07-supported-chains.md) | Chain families, canonical identifiers, and derivation rules |
| [08 — Conformance and Security](docs/08-conformance-and-security.md) | Interoperability testing and security requirements |

Reference implementation guides:

- [Quickstart](docs/quickstart.md)
- [CLI Reference](docs/sdk-cli.md)
- [Node.js SDK](docs/sdk-node.md)
- [Python SDK](docs/sdk-python.md)
- [Policy Engine Implementation](docs/policy-engine-implementation.md)

---

## Production Roadmap

OWS is functional today as a local signing standard. The path to production hardening is straightforward — the specification is already written for most of it, and the items below are sequenced by the dependency order that makes sense for real deployments.

### Near-term

**Hardware security module (HSM) and TEE support.** The key isolation spec ([05](docs/05-key-isolation.md)) defines the interface. The next step is a production signing enclave — initially targeting AWS Nitro Enclaves and TPM-backed key storage — so that the vault can be deployed on a remote server without the host process ever seeing decrypted key material.

**MPC and threshold signing.** Many agent deployments need multiple signers to authorize a transaction (e.g. 2-of-3 co-signers before a large transfer). A threshold signing layer — initially secp256k1 via FROST, Ed25519 via FROST-Ed25519 — fits naturally above the current signing core without changing the API surface agents see.

**Executable policy improvements.** The policy engine already supports custom executables that receive the signing context and return allow/deny. Planned additions: WebAssembly policy modules (no subprocess overhead, sandboxed), spend-limit rules with on-chain balance checks, and time-window rate limiting.

**Smart account integration.** Native support for ERC-4337 user operations — so an OWS wallet can act as a smart account signer on EVM chains, enabling gas sponsorship and batched transactions without changing how the agent calls sign().

### Medium-term

**Remote vault mode.** A hardened server process that exposes the OWS signing API over mTLS — so agents running in cloud environments can sign without the vault being co-located with the workload. The protocol is already defined; this is the production-hardened implementation.

**Cross-device wallet sync.** Encrypted vault sync via a user-controlled backend (S3, R2, or self-hosted). The format is already stable; sync is additive and doesn't change the on-disk layout.

**Audit log and compliance exports.** Append-only signed signing logs with policy evaluation results — exportable to SIEM systems or compliance pipelines. Useful for any deployment where you need to prove what an agent signed and why.

**Browser extension.** An OWS-compatible browser wallet that shares the vault format with the CLI and SDK, so the same wallet works in a browser context without a separate key management story.

### Longer-term

**x402 payment flow.** The CLI already has `ows pay request` for [x402](https://www.x402.org/) HTTP payment flows. The roadmap item is first-class SDK support and a middleware library so any Node.js or Python HTTP client can handle 402 responses automatically.

**Language bindings beyond Node and Python.** Go, Ruby, and Java are the highest-demand targets based on where agents are being built. The Rust core is stable; adding a binding is a matter of writing the FFI layer.

**Decentralized policy registry.** On-chain policy anchoring — publish a policy hash to a smart contract so multiple parties can independently verify that an agent was operating under a known, auditable policy at the time of signing.

---

## Contributing

The specification is the source of truth. If you're building a compatible implementation, start with [docs/00-specification.md](docs/00-specification.md) and the conformance tests in [docs/08-conformance-and-security.md](docs/08-conformance-and-security.md).

Bug reports and pull requests are welcome. For significant changes, open an issue first to discuss the approach.

---

## License

MIT
