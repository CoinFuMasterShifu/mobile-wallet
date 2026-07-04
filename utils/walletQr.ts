/** Prefix for encrypted wallet export QR codes (wartbunker → mobile import). */
export const WALLET_QR_PREFIX = 'wartwallet:';

export const WALLET_QR_MAX_LENGTH = 2200;

export function encodeWalletQrPayload(encrypted: string): string {
  return `${WALLET_QR_PREFIX}${encrypted}`;
}

export function parseWalletQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith(WALLET_QR_PREFIX)) {
    const payload = trimmed.slice(WALLET_QR_PREFIX.length).trim();
    return payload || null;
  }

  if (/^U2FsdGVkX1[\w+/=]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function isWalletQrPayload(raw: string): boolean {
  return parseWalletQrPayload(raw) != null;
}