// utils/api.ts - Blockchain API via local warthog-ts

import {
  WarthogApi,
  normalizeChainPin,
  Wart,
  RoundedFee,
  serializeForApi,
  type TransactionJson,
} from 'warthog-ts';

import { API_ENDPOINTS, DEFAULT_FEE, SATOSHI_MULTIPLIER } from '../constants';
import { AccountBalance, BlockData, Transaction } from '../types';
import { isDefiNode } from './nodes';
import { formatBalanceBreakdown } from './warthogFormat';

export function createWarthogApi(node: string): WarthogApi {
  return new WarthogApi(node.replace(/\/$/, ''));
}

// Fetch chain head (current block height + pin)
export const fetchChainHead = async (node: string): Promise<BlockData> => {
  const api = createWarthogApi(node);
  const result = await api.getChainHead();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch chain head');
  }

  const pin = normalizeChainPin(result.data);
  const data = result.data as BlockData & { chainHead?: BlockData };

  return {
    height: Number(data.height ?? pin.pinHeight ?? 0),
    pinHeight: pin.pinHeight,
    pinHash: pin.pinHash,
    timestamp: data.timestamp,
    utc: data.utc,
  };
};

type WartBalancePayload = {
  wart?: unknown;
  account?: { nonceId?: number | string };
};

type MainnetBalancePayload = {
  balance?: unknown;
  balanceE8?: number | string;
  nonceId?: number | string;
};

function parseDisplayNumber(str: string): number {
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toAccountBalance(
  breakdown: ReturnType<typeof formatBalanceBreakdown>,
  nonceId: number
): AccountBalance {
  return {
    balance: parseDisplayNumber(breakdown.total),
    available: parseDisplayNumber(breakdown.available),
    locked: parseDisplayNumber(breakdown.locked),
    balanceStr: breakdown.total,
    availableStr: breakdown.available,
    lockedStr: breakdown.locked,
    hasLocked: breakdown.hasLocked,
    nonceId,
  };
}

// Fetch account balance (mainnet: /balance, DeFi testnet: /wart_balance)
// Returns total / available / locked so UIs can show free vs open-order locks.
export const fetchAccountBalance = async (
  node: string,
  address: string
): Promise<AccountBalance> => {
  const api = createWarthogApi(node);

  if (isDefiNode(node)) {
    const result = await api.getAccountWartBalance(address);
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch account balance');
    }

    const data = result.data as WartBalancePayload;
    const breakdown = formatBalanceBreakdown(data.wart, { kind: 'wart' });
    return toAccountBalance(breakdown, Number(data.account?.nonceId ?? 0));
  }

  const result = await api.getAccountBalance(address);
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch account balance');
  }

  const data = result.data as MainnetBalancePayload;
  // Mainnet may return bare number/E8 or a total/locked container under balance
  let container: unknown = data.balance;
  if (container == null && data.balanceE8 != null) {
    container = { E8: data.balanceE8 };
  } else if (typeof container === 'number' || typeof container === 'string') {
    const n = parseFloat(String(container));
    if (Number.isFinite(n)) {
      container = { str: String(container), E8: Math.round(n * SATOSHI_MULTIPLIER) };
    }
  }

  const breakdown = formatBalanceBreakdown(container, { kind: 'wart' });
  return toAccountBalance(breakdown, Number(data.nonceId || 0));
};

// Fetch USD price from CoinGecko (unchanged — not a node API)
export const fetchUsdPrice = async (): Promise<number> => {
  try {
    const res = await fetch(API_ENDPOINTS.coingeckoPrice);
    const data = await res.json();
    return data.warthog?.usd || 0;
  } catch {
    return 0;
  }
};

// Resolve a valid rounded fee E8 using warthog-ts + node minimum
export const fetchFeeE8 = async (node: string, feeWart: string): Promise<number> => {
  const feeStr = feeWart.trim() || DEFAULT_FEE;
  const wartFee = Wart.parse(feeStr);
  if (!wartFee) {
    throw new Error('Invalid fee amount');
  }

  const fee = wartFee.roundedFee(true);
  const api = createWarthogApi(node);
  const minRes = await api.getMinFee();

  if (minRes.success) {
    const minE8 = BigInt(minRes.data.minFee.E8);
    if (fee.E8 < minE8) {
      const minStr = minRes.data.minFee.str || 'node minimum';
      throw new Error(`Fee must be at least ${minStr}`);
    }
  }

  return Number(fee.E8);
};

// Submit a signed transaction built by TransactionContext
export const submitWarthogTransaction = async (
  node: string,
  tx: TransactionJson
): Promise<{ txHash: string }> => {
  const api = createWarthogApi(node);
  const result = await api.submitTransaction(serializeForApi(tx) as TransactionJson);

  if (!result.success) {
    throw new Error(result.error || 'Node rejected transaction');
  }

  return {
    txHash: result.data.txHash || 'pending',
  };
};

// Fetch transaction by hash
export const fetchTransaction = async (
  node: string,
  txid: string
): Promise<Transaction | null> => {
  try {
    const api = createWarthogApi(node);
    const result = await api.getNodePath(`/transaction/lookup/${txid}`);
    if (!result.success) {
      return null;
    }

    const data = result.data as { transaction?: Transaction };
    return data.transaction ?? null;
  } catch {
    return null;
  }
};

// Fetch block by height
export const fetchBlock = async (
  node: string,
  height: number
): Promise<BlockData | null> => {
  try {
    const api = createWarthogApi(node);
    const result = await api.getBlock(height);
    if (!result.success) {
      return null;
    }

    const data = result.data as BlockData & {
      header?: { timestamp?: number; time?: { timestamp?: number } };
    };

    return {
      height: Number(data.height || height),
      pinHeight: Number(data.pinHeight || height),
      pinHash: data.pinHash || '',
      timestamp: data.timestamp || data.header?.timestamp || data.header?.time?.timestamp,
      utc: data.utc,
    };
  } catch {
    return null;
  }
};