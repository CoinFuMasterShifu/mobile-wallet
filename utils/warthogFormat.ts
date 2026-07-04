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