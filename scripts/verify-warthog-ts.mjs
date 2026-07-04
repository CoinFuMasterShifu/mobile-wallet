/**
 * Smoke-test local warthog-ts integration without running the Expo app.
 * Run: npm run verify:warthog-ts
 */
import { Buffer } from 'buffer';
import {
  Account,
  Address,
  Wart,
  Funds,
  TokenPrecision,
  NonceId,
  RoundedFee,
  WarthogApi,
  TransactionContext,
  normalizeChainPin,
  serializeForApi,
  encodeLimitPrice,
  isValidAssetHash,
  Liquidity,
} from 'warthog-ts';

globalThis.Buffer = Buffer;

const pk = '966a71a98bb5d13e9116c0dffa3f1a7877e45c6f563897b96cfd5c59bf0803e0';
const account = Account.fromPrivateKeyHex(pk);
const recipient = Address.fromHex('3661579d61abde5837a8686dc4d65348a2fc61b1fe5f4093');

if (!recipient) throw new Error('recipient address invalid');
if (!Address.validate(account.address.hex)) throw new Error('account address invalid');

const wart = Wart.parse('0.1');
if (!wart) throw new Error('wart parse failed');

const fee = wart.roundedFee(true);
const nonce = NonceId.fromNumber(1);
if (!nonce) throw new Error('nonce invalid');

const ctx = new TransactionContext(
  { pinHash: 'a'.repeat(64), pinHeight: 100 },
  fee,
  nonce
);
const tx = ctx.transferWart(account, recipient, wart);
if (tx.signature65.length !== 130) throw new Error('bad signature length');

const serialized = serializeForApi(tx);
if (typeof serialized.wartE8 !== 'number') throw new Error('serializeForApi failed');

const supply = Funds.parse('1000000', TokenPrecision.WART);
if (!supply) throw new Error('Funds parse failed');
const assetTx = ctx.createAssets(account, supply, TokenPrecision.WART, 'HOG');
if (assetTx.decimals !== 8) throw new Error('assetCreation must expose decimals field for node API');
if (assetTx.precision !== undefined) throw new Error('assetCreation must not use precision field');

const limitHex = encodeLimitPrice('1.0', 8, { ceil: false });
if (limitHex.length !== 6) throw new Error('encodeLimitPrice failed');

const assetHash = 'f45b113119c7f7c000234f1090d5d181ab60b8b24526f1edd2f563aa1ca329f2';
if (!isValidAssetHash(assetHash)) throw new Error('isValidAssetHash failed');

const lp = Liquidity.parse('1.5');
if (!lp) throw new Error('Liquidity parse failed');

const nested = normalizeChainPin({
  chainHead: { pinHash: 'bb'.repeat(32), height: 42 },
});
if (nested.pinHeight !== 42) throw new Error('normalizeChainPin failed');

const api = new WarthogApi('https://node.example.com');
if (typeof api.getMinFee !== 'function') throw new Error('WarthogApi missing getMinFee');
if (typeof api.getDexMarket !== 'function') throw new Error('WarthogApi missing getDexMarket');

console.log('warthog-ts integration OK');
console.log('  account:', account.address.hex.slice(0, 12) + '...');
console.log('  tx type:', tx.type);
console.log('  limit hex:', limitHex);
console.log('  liquidity E8:', lp.E8.toString());