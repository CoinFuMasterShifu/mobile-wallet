import { Buffer } from 'buffer';
import process from 'process';
import * as ExpoCrypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

// Must run before warthog-ts / crypto-browserify / stream-browserify are imported.
global.Buffer = Buffer;
(global as typeof globalThis & { process: typeof process }).process = process;

if (typeof global.crypto === 'undefined') {
  (global as typeof globalThis & { crypto: Crypto }).crypto = {
    getRandomValues: ExpoCrypto.getRandomValues,
  } as Crypto;
}

CryptoJS.lib.WordArray.random = (nBytes: number) => {
  const bytes = ExpoCrypto.getRandomBytes(nBytes);
  return CryptoJS.lib.WordArray.create(bytes);
};