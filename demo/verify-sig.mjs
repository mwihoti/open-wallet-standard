/**
 * OWS Signature Verifier
 *
 * Usage:
 *   node verify-sig.mjs solana <address> <message> <sigHex>
 *   node verify-sig.mjs evm    <address> <message> <sigHex>
 *
 * Example (the hell0 signature from the app):
 *   node verify-sig.mjs solana \
 *     JAHzn5JD4bTmGhVA58PVSwzRQ4QLJgVTW81uBUQka4To \
 *     "hell0" \
 *     "02eb506a5645e29159e10f987df86d526716adaa5716d5add0c778e14f0eec0184c8991044a5031fafcf204b1c183d45951c526354957929d27d26753c21740a"
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const [,, chain, address, message, sigHex] = process.argv;

if (!chain || !address || !message || !sigHex) {
  console.log(`
Usage:
  node verify-sig.mjs <chain> <address> <message> <sigHex>

Chains: solana, evm

Examples:
  node verify-sig.mjs solana JAHzn5JD4bTm... "hell0" "02eb506a..."
  node verify-sig.mjs evm    0xAb16...      "hello" "a1b2c3..."
`);
  process.exit(1);
}

if (chain === 'solana') {
  // ed25519 — Solana address IS the base58-encoded public key
  const bs58 = require('./node_modules/bs58/index.js');

  const pubkeyBytes = bs58.decode(address);
  const msgBytes = Buffer.from(message, 'utf8');
  const sigBytes = Buffer.from(sigHex, 'hex');

  if (sigBytes.length !== 64) {
    console.error(`❌ Expected 64-byte ed25519 signature, got ${sigBytes.length} bytes`);
    process.exit(1);
  }
  if (pubkeyBytes.length !== 32) {
    console.error(`❌ Expected 32-byte public key from address, got ${pubkeyBytes.length}`);
    process.exit(1);
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    console.error('❌ Web Crypto not available — requires Node.js 20+');
    process.exit(1);
  }

  const key = await subtle.importKey('raw', pubkeyBytes, { name: 'Ed25519' }, false, ['verify']);
  const valid = await subtle.verify('Ed25519', key, sigBytes, msgBytes);

  console.log('');
  if (valid) {
    console.log('✅  VALID Solana (ed25519) signature');
  } else {
    console.log('❌  INVALID signature — message or key mismatch');
  }
  console.log('   Chain:    Solana (ed25519)');
  console.log('   Address:  ', address);
  console.log('   Message:  ', JSON.stringify(message));
  console.log('   Sig:      ', sigHex.slice(0, 20) + '…' + sigHex.slice(-8));
  console.log('');

} else if (chain === 'evm') {
  // secp256k1 — recover address from personal_sign hash
  // eth_sign pads: "\x19Ethereum Signed Message:\n" + byteLen + message
  const msgBytes = Buffer.from(message, 'utf8');
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${msgBytes.length}`, 'utf8');
  const prefixed = Buffer.concat([prefix, msgBytes]);

  // Use Node's built-in crypto for SHA3/keccak if available, else load from dep
  let keccak256;
  try {
    const { createHash } = await import('crypto');
    // Node 21.7+ supports keccak256 natively
    keccak256 = (buf) => createHash('sha3-256').update(buf).digest();
  } catch {}

  // Try ethereum-cryptography (often bundled by hardhat/ethers)
  try {
    const mod = require('./node_modules/ethereum-cryptography/keccak.js');
    keccak256 = (buf) => Buffer.from(mod.keccak256(buf));
  } catch {}

  if (!keccak256) {
    console.log('ℹ️  EVM verification needs ethereum-cryptography.');
    console.log('   npm install ethereum-cryptography');
    console.log('   Or verify online at https://etherscan.io/verifySig');
    process.exit(0);
  }

  const hash = keccak256(prefixed);
  const sigBuf = Buffer.from(sigHex.replace(/^0x/, ''), 'hex');

  if (sigBuf.length !== 65) {
    console.error(`❌ Expected 65-byte EVM signature (r+s+v), got ${sigBuf.length}`);
    process.exit(1);
  }

  try {
    const { secp256k1 } = require('./node_modules/ethereum-cryptography/secp256k1.js');
    const { keccak256: k2 } = require('./node_modules/ethereum-cryptography/keccak.js');
    const r = BigInt('0x' + sigBuf.slice(0, 32).toString('hex'));
    const s = BigInt('0x' + sigBuf.slice(32, 64).toString('hex'));
    const v = sigBuf[64];
    const recovery = v >= 27 ? v - 27 : v;
    const sig = secp256k1.Signature.fromCompact(
      sigBuf.slice(0, 64).toString('hex')
    ).addRecoveryBit(recovery);
    const pubkey = sig.recoverPublicKey(hash).toRawBytes(false);
    const addrHash = k2(pubkey.slice(1));
    const recovered = '0x' + Buffer.from(addrHash.slice(12)).toString('hex');
    const match = recovered.toLowerCase() === address.toLowerCase();

    console.log('');
    if (match) {
      console.log('✅  VALID EVM (secp256k1) personal_sign signature');
    } else {
      console.log('❌  INVALID — recovered address does not match');
      console.log('   Recovered:', recovered);
    }
    console.log('   Chain:    EVM / Ethereum');
    console.log('   Address:  ', address);
    console.log('   Message:  ', JSON.stringify(message));
    console.log('   Sig:      ', sigHex.slice(0, 20) + '…' + sigHex.slice(-8));
    console.log('');
  } catch (e) {
    console.error('❌ Verification failed:', e.message);
    console.log('   Try: https://etherscan.io/verifySig');
  }

} else {
  console.error('Unknown chain:', chain, '— supported: solana, evm');
  process.exit(1);
}
