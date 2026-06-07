/**
 * Algorand Signer Tests
 */

import { describe, it, expect } from 'vitest';
import { LocalAlgorandSigner, createSigner } from './signer.js';

// Test mnemonic (DO NOT USE IN PRODUCTION)
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest';

describe('LocalAlgorandSigner', () => {
  it('should create signer from mnemonic', () => {
    const signer = new LocalAlgorandSigner(TEST_MNEMONIC);
    expect(signer).toBeInstanceOf(LocalAlgorandSigner);
  });

  it('should return consistent address', async () => {
    const signer = new LocalAlgorandSigner(TEST_MNEMONIC);
    const address1 = await signer.getAddress();
    const address2 = await signer.getAddress();
    expect(address1).toBe(address2);
    expect(address1.length).toBe(58);
  });

  it('should throw on invalid mnemonic', () => {
    expect(() => {
      new LocalAlgorandSigner('invalid mnemonic words');
    }).toThrow();
  });

  it('should throw on invalid base64 key', () => {
    expect(() => {
      new LocalAlgorandSigner('notbase64');
    }).toThrow(/Invalid secret key length/);
  });
});

describe('createSigner', () => {
  it('should create signer from mnemonic', () => {
    const signer = createSigner(TEST_MNEMONIC);
    expect(signer).toBeDefined();
  });

  it('should throw on empty private key', () => {
    expect(() => {
      createSigner('');
    }).toThrow(/ALGORAND_PRIVATE_KEY is required/);
  });
});
