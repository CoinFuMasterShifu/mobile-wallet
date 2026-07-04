import { isValidAddress } from './crypto';

/** Extract a Warthog address from scanned QR payload text. */
export function parseAddressFromQr(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;

  value = value.replace(/^(wart|warthog):/i, '');

  const direct = value.trim().replace(/^0x/i, '');
  if (isValidAddress(direct)) return direct.toLowerCase();

  const match = value.match(/(?:0x)?([0-9a-fA-F]{40,48})/);
  if (match) {
    const candidate = match[1].toLowerCase();
    if (isValidAddress(candidate)) return candidate;
  }

  return null;
}