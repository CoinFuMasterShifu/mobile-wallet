import { Address, Wart } from 'warthog-ts';

export interface AddressValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  format?: 'raw' | 'full';
  accountId?: string;
  fullAddress?: string;
  checksumValid?: boolean;
}

/** Validate a Warthog address locally (no node required). */
export function validateWarthogAddressInput(address: string): AddressValidationResult {
  const clean = (address || '').trim().replace(/^0x/i, '').toLowerCase();

  if (!clean) {
    return { valid: false, error: 'Please enter an address' };
  }

  if (!/^[0-9a-f]+$/.test(clean)) {
    return { valid: false, error: 'Address must contain only hexadecimal characters (0-9, a-f)' };
  }

  if (clean.length === 40) {
    const derived = Address.fromRaw(clean);
    if (!derived) {
      return { valid: false, error: 'Invalid 40-character account ID' };
    }
    return {
      valid: true,
      format: 'raw',
      accountId: clean,
      fullAddress: derived.hex,
      checksumValid: true,
      message: 'Valid address',
    };
  }

  if (clean.length === 48) {
    if (!Address.validate(clean)) {
      return {
        valid: false,
        error:
          'Checksum invalid — one or more characters may be wrong in this 48-character address.',
      };
    }
    return {
      valid: true,
      format: 'full',
      fullAddress: clean,
      accountId: clean.slice(0, 40),
      checksumValid: true,
      message: 'Valid address',
    };
  }

  return {
    valid: false,
    error: `Address must be 40 hex characters (account ID) or 48 hex characters (full address with checksum). You entered ${clean.length}.`,
  };
}

const WART_PRECISION = 8;

export function normalizeAssetHash(assetHash: string): string {
  return assetHash.trim().replace(/^0x/i, '').toLowerCase();
}

export function isValidAssetHash(hash: string): boolean {
  const clean = normalizeAssetHash(hash);
  return clean.length === 64 && /^[0-9a-f]+$/.test(clean);
}

export function formatAmountFromRaw(raw: string | number | bigint, precision: number): string {
  const value = BigInt(raw);
  const divisor = 10n ** BigInt(precision);
  const whole = value / divisor;
  const frac = value % divisor;
  if (precision === 0) return whole.toString();
  return `${whole}.${frac.toString().padStart(precision, '0')}`;
}

type BalanceObj = {
  str?: string;
  E8?: number | string | bigint;
  u64?: number | string | bigint;
  amount?: number | string | bigint;
};

export function formatWartBalance(wartObj?: BalanceObj | null): string {
  if (!wartObj) return '0.00000000';
  if (wartObj.str) return wartObj.str;
  if (wartObj.E8 != null) {
    const wart = Wart.fromE8(BigInt(wartObj.E8));
    if (wart) return formatAmountFromRaw(wart.E8, WART_PRECISION);
  }
  return '0.00000000';
}

export function formatTokenBalance(balanceObj?: BalanceObj | null, decimals = 8): string {
  if (!balanceObj) return '0';
  if (balanceObj.str) return balanceObj.str;
  const raw = balanceObj.u64 ?? balanceObj.E8 ?? balanceObj.amount;
  if (raw != null) return formatAmountFromRaw(raw, decimals);
  return '0';
}

export function parseDisplayAmount(value: unknown, fallback = '0'): string {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as BalanceObj & { doubleAdjusted?: number };
    if (obj.str != null) return String(obj.str);
    if (obj.doubleAdjusted != null) return String(obj.doubleAdjusted);
    if (obj.E8 != null) return formatAmountFromRaw(obj.E8, WART_PRECISION);
    if (obj.u64 != null) return String(obj.u64);
  }
  return fallback;
}

export function hasPositiveBalance(balanceInfo?: BalanceObj | null): boolean {
  if (!balanceInfo) return false;
  if (balanceInfo.str != null) {
    const amount = parseFloat(balanceInfo.str);
    return Number.isFinite(amount) && amount > 0;
  }
  if (balanceInfo.u64 != null) {
    try {
      return BigInt(balanceInfo.u64) > 0n;
    } catch {
      return Number(balanceInfo.u64) > 0;
    }
  }
  if (balanceInfo.E8 != null) return Number(balanceInfo.E8) > 0;
  return false;
}

/** Raw integer units from a node amount object (`u64` / `E8` / `amount`). */
export function rawAmountUnits(amountObj?: BalanceObj | null): bigint {
  if (!amountObj || typeof amountObj !== 'object') return 0n;
  const raw = amountObj.u64 ?? amountObj.E8 ?? amountObj.amount;
  if (raw === undefined || raw === null || raw === '') return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export type BalanceParts = {
  total: BalanceObj | null;
  locked: BalanceObj | null;
  mempool: BalanceObj | null;
};

/**
 * Normalize node balance containers into total / locked / mempool parts.
 * Accepts `data.balance`, `data.wart`, or a bare amount object.
 */
export function pickBalanceParts(container: unknown): BalanceParts {
  if (!container || typeof container !== 'object') {
    return { total: null, locked: null, mempool: null };
  }
  const c = container as Record<string, unknown>;
  if (c.total != null || c.locked != null || c.mempool != null) {
    return {
      total: (c.total as BalanceObj) ?? null,
      locked: (c.locked as BalanceObj) ?? null,
      mempool: (c.mempool as BalanceObj) ?? null,
    };
  }
  // Bare amount: treat as total free balance
  if (c.str != null || c.u64 != null || c.E8 != null || c.amount != null) {
    return { total: c as BalanceObj, locked: null, mempool: null };
  }
  return { total: null, locked: null, mempool: null };
}

export type BalanceBreakdown = {
  total: string;
  locked: string;
  mempool: string;
  available: string;
  totalRaw: bigint;
  lockedRaw: bigint;
  mempoolRaw: bigint;
  availableRaw: bigint;
  lockedOrPending: bigint;
  hasLocked: boolean;
};

/**
 * Format total / locked / mempool / available from a node balance container.
 * Available = max(0, total − locked − mempool) in integer units.
 */
export function formatBalanceBreakdown(
  container: unknown,
  options: { kind?: 'wart' | 'token'; decimals?: number } = {}
): BalanceBreakdown {
  const kind = options.kind === 'wart' ? 'wart' : 'token';
  const decimals =
    kind === 'wart'
      ? WART_PRECISION
      : Math.min(Math.max(parseInt(String(options.decimals ?? 8), 10) || 8, 0), 18);

  const parts = pickBalanceParts(container);
  const totalRaw = rawAmountUnits(parts.total);
  const lockedRaw = rawAmountUnits(parts.locked);
  const mempoolRaw = rawAmountUnits(parts.mempool);
  let availableRaw = totalRaw - lockedRaw - mempoolRaw;
  if (availableRaw < 0n) availableRaw = 0n;

  const formatOne = (obj: BalanceObj | null, rawFallback: bigint): string => {
    if (obj) {
      if (kind === 'wart') return formatWartBalance(obj);
      return formatTokenBalance(obj, decimals);
    }
    return formatAmountFromRaw(rawFallback, decimals);
  };

  const total = formatOne(parts.total, totalRaw);
  const locked = formatOne(parts.locked, lockedRaw);
  const mempool = formatOne(parts.mempool, mempoolRaw);
  const available = formatAmountFromRaw(availableRaw, decimals);
  const lockedOrPending = lockedRaw + mempoolRaw;

  return {
    total,
    locked,
    mempool,
    available,
    totalRaw,
    lockedRaw,
    mempoolRaw,
    availableRaw,
    lockedOrPending,
    hasLocked: lockedOrPending > 0n,
  };
}

/** True when `amountStr` exceeds free balance (string compare via decimal parse). */
export function amountExceedsAvailable(amountStr: unknown, availableStr: unknown): boolean {
  const amount = Number(String(amountStr ?? '').trim().replace(',', '.'));
  const available = Number(String(availableStr ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isFinite(available)) return false;
  // Small epsilon for float display noise
  return amount > available + 1e-12;
}

/**
 * Human message when an order/send exceeds free balance.
 * @example "Only 279057.82 free; 230470.95 locked in open orders."
 */
export function insufficientFreeBalanceMessage(opts: {
  available?: string | number | null;
  locked?: string | number | null;
  unit?: string;
}): string {
  const free = String(opts.available ?? '0');
  const lock = String(opts.locked ?? '0');
  const suffix = opts.unit ? ` ${opts.unit}` : '';
  return `Only ${free}${suffix} free; ${lock}${suffix} locked in open orders.`;
}

/** True when a locked amount string/number is meaningfully > 0. */
export function hasPositiveLocked(locked: unknown): boolean {
  if (locked == null || locked === '') return false;
  if (typeof locked === 'object') {
    const obj = locked as BalanceObj;
    const n = parseFloat(String(obj.str ?? obj.E8 ?? obj.u64 ?? '0'));
    return Number.isFinite(n) && n > 0;
  }
  const n = parseFloat(String(locked));
  return Number.isFinite(n) && n > 0;
}