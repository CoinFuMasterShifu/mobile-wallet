import { ethers } from 'ethers';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate a Warthog wallet address
 * Supports multiple address formats:
 * - 40 chars: Raw hex (no prefix, no checksum)
 * - 42 chars: 0x prefixed (Ethereum style)
 * - 48 chars: Warthog native format with checksum
 */
export const validateWarthogAddress = (address: string): ValidationResult => {
  // Normalize: remove any whitespace
  const normalized = address.trim();

  // Length checks
  if (normalized.length === 40) {
    // Raw hex format
    if (!/^[0-9a-fA-F]{40}$/.test(normalized)) {
      return {
        isValid: false,
        error: 'Address contains invalid characters (must be hexadecimal)'
      };
    }
    return { isValid: true };
  } else if (normalized.length === 42) {
    // Ethereum-style format
    if (!normalized.startsWith('0x')) {
      return {
        isValid: false,
        error: 'Address must start with 0x'
      };
    }

    const hexPattern = /^0x[0-9a-fA-F]{40}$/;
    if (!hexPattern.test(normalized)) {
      return {
        isValid: false,
        error: 'Address contains invalid characters (must be hexadecimal)'
      };
    }

    // Optional checksum validation (EIP-55 style)
    try {
      const checksumAddress = ethers.getAddress(normalized);
      if (checksumAddress !== normalized && normalized !== normalized.toLowerCase()) {
        return {
          isValid: false,
          error: 'Invalid address checksum'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid address format'
      };
    }

    return { isValid: true };
  } else if (normalized.length === 48) {
    // Warthog native format with checksum
    if (!/^[0-9a-fA-F]{48}$/.test(normalized)) {
      return {
        isValid: false,
        error: 'Address contains invalid characters (must be hexadecimal)'
      };
    }

    // Checksum validation
    const ripemdHex = normalized.slice(0, 40);
    const checksumHex = normalized.slice(40);
    const computedChecksum = ethers.sha256('0x' + ripemdHex).slice(2, 10);

    if (computedChecksum !== checksumHex) {
      return {
        isValid: false,
        error: 'Invalid address checksum'
      };
    }

    return { isValid: true };
  } else {
    return {
      isValid: false,
      error: 'Address must be 40, 42, or 48 characters long'
    };
  }
};

/**
 * Normalize an address to lowercase for consistent storage and comparison
 */
export const normalizeAddress = (address: string): string => {
  return address.toLowerCase();
};

/**
 * Check if an address is a valid checksum address
 */
export const isChecksumAddress = (address: string): boolean => {
  try {
    const checksumAddress = ethers.getAddress(address);
    return checksumAddress === address;
  } catch {
    return false;
  }
};

/**
 * Convert an address to its checksummed version
 */
export const toChecksumAddress = (address: string): string => {
  try {
    return ethers.getAddress(address);
  } catch (error) {
    throw new Error('Invalid address format');
  }
};

/**
 * Validate contact name
 */
export const validateContactName = (name: string): ValidationResult => {
  const trimmedName = name.trim();

  // Required check
  if (!trimmedName) {
    return {
      isValid: false,
      error: 'Name is required'
    };
  }

  // Length check
  if (trimmedName.length < 1) {
    return {
      isValid: false,
      error: 'Name cannot be empty'
    };
  }

  if (trimmedName.length > 50) {
    return {
      isValid: false,
      error: 'Name cannot be longer than 50 characters'
    };
  }

  // Character validation (alphanumeric + common chars)
  const namePattern = /^[a-zA-Z0-9\s\-_.,]+$/;
  if (!namePattern.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Name can only contain letters, numbers, spaces, and these characters: - _ . ,'
    };
  }

  return { isValid: true };
};

/**
 * Validate contact notes
 */
export const validateContactNotes = (notes?: string): ValidationResult => {
  if (!notes) {
    return { isValid: true }; // Optional field
  }

  const trimmedNotes = notes.trim();

  // Length check
  if (trimmedNotes.length > 200) {
    return {
      isValid: false,
      error: 'Notes cannot be longer than 200 characters'
    };
  }

  return { isValid: true };
};

/**
 * Comprehensive contact data validation
 */
export const validateContactData = (data: {
  name: string;
  address: string;
  notes?: string;
}): ValidationResult => {
  // Validate name
  const nameValidation = validateContactName(data.name);
  if (!nameValidation.isValid) {
    return nameValidation;
  }

  // Validate address
  const addressValidation = validateWarthogAddress(data.address);
  if (!addressValidation.isValid) {
    return addressValidation;
  }

  // Validate notes
  const notesValidation = validateContactNotes(data.notes);
  if (!notesValidation.isValid) {
    return notesValidation;
  }

  return { isValid: true };
};

/**
 * Generate a short address display (first 6 + last 4 chars)
 */
export const shortenAddress = (address: string): string => {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Test addresses for validation (development helper)
 */
export const testAddresses = [
  // Valid addresses
  '742d35cc6634c0532925a3b844bc454e4438f44e', // 40 chars, raw hex
  '0x742d35cc6634c0532925a3b844bc454e4438f44e', // 42 chars, 0x prefixed
  '0x742D35CC6634C0532925A3B844BC454E4438F44E', // 42 chars, checksummed
  '742d35cc6634c0532925a3b844bc454e4438f44e4438f44e', // 48 chars, Warthog format

  // Invalid addresses
  '0x742d35cc6634c0532925a3b844bc454e4438f44', // Too short (41)
  '0x742d35cc6634c0532925a3b844bc454e4438f44e00', // Too long (43)
  '742d35cc6634c0532925a3b844bc454e4438f44', // Invalid length (39)
  '742d35cc6634c0532925a3b844bc454e4438f44e4438f44e00', // Too long (49)
  '742d35cc6634c0532925a3b844bc454e4438f44g', // Invalid char 'g'
  '0x742d35cc6634c0532925a3b844bc454e4438f44g', // Invalid char 'g'
] as const;
