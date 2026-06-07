/**
 * Security Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateDomain,
  validatePaymentHeader,
  createResponseValidator,
} from './security.js';
import type { X402AlgorandConfig, X402PaymentHeader } from './types.js';

describe('validateDomain', () => {
  it('should allow HTTPS URLs when no whitelist configured', () => {
    const result = validateDomain('https://example.com/api', []);
    expect(result.valid).toBe(true);
  });

  it('should reject HTTP URLs', () => {
    const result = validateDomain('http://example.com/api', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HTTPS');
  });

  it('should block localhost/127.x addresses', () => {
    const result = validateDomain('https://127.0.0.1/api', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Private');
  });

  it('should block 10.x.x.x private range', () => {
    const result = validateDomain('https://10.0.0.1/api', []);
    expect(result.valid).toBe(false);
  });

  it('should block 192.168.x.x private range', () => {
    const result = validateDomain('https://192.168.1.1/api', []);
    expect(result.valid).toBe(false);
  });

  it('should block 172.16-31.x.x private range', () => {
    const result = validateDomain('https://172.16.0.1/api', []);
    expect(result.valid).toBe(false);
  });

  it('should block IPv6 loopback', () => {
    const result = validateDomain('https://[::1]/api', []);
    expect(result.valid).toBe(false);
  });

  it('should block IPv6-mapped IPv4 private addresses', () => {
    const result = validateDomain('https://[::ffff:127.0.0.1]/api', []);
    expect(result.valid).toBe(false);
  });

  it('should allow whitelisted domains', () => {
    const result = validateDomain('https://api.sippar.network/x402', ['sippar.network']);
    expect(result.valid).toBe(true);
  });

  it('should reject non-whitelisted domains', () => {
    const result = validateDomain('https://evil.com/api', ['sippar.network']);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in allowed list');
  });

  it('should allow subdomains of whitelisted domains', () => {
    const result = validateDomain('https://api.sippar.network/x402', ['sippar.network']);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid URL format', () => {
    const result = validateDomain('not-a-url', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid URL');
  });
});

describe('validatePaymentHeader', () => {
  const config: X402AlgorandConfig = {
    facilitatorUrl: 'https://goplausible.com/verify',
    allowedDomains: [],
    usdcAssetId: 31566704,
    algodUrl: 'https://mainnet-api.algonode.cloud',
    algodToken: '',
    maxResponseSize: 4 * 1024 * 1024,
    timeout: 30000,
  };

  it('should accept valid USDC payment header', () => {
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: '31566704',
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    };
    const result = validatePaymentHeader(header, config);
    expect(result.valid).toBe(true);
  });

  it('should accept valid ALGO payment header', () => {
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: 'ALGO',
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    };
    const result = validatePaymentHeader(header, config);
    expect(result.valid).toBe(true);
  });

  it('should reject non-Algorand network', () => {
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'ethereum' as any,
      maxAmountRequired: '1000000',
      asset: '31566704',
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    };
    const result = validatePaymentHeader(header, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unsupported network');
  });

  it('should reject an asset not in the allowlist', () => {
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: '12345678', // Wrong asset
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    };
    const result = validatePaymentHeader(header, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in allowed list');
  });

  it('should accept an additional allowlisted asset (e.g. Quantoz EURQ)', () => {
    const eurqAssetId = 999999; // stand-in for verified EURQ ASA ID
    const multiAssetConfig: X402AlgorandConfig = {
      ...config,
      allowedAssetIds: [eurqAssetId],
    };
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: String(eurqAssetId),
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    };
    const result = validatePaymentHeader(header, multiAssetConfig);
    expect(result.valid).toBe(true);
  });

  it('should ignore unset (<=0) placeholder asset IDs', () => {
    const placeholderConfig: X402AlgorandConfig = {
      ...config,
      allowedAssetIds: [0], // unverified EURQ placeholder must not pass
    };
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: '0',
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    };
    const result = validatePaymentHeader(header, placeholderConfig);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not in allowed list');
  });

  it('should reject invalid Algorand address format', () => {
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: '31566704',
      payTo: 'invalid-address',
    };
    const result = validatePaymentHeader(header, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid payment address');
  });

  it('should reject expired payment requests', () => {
    const header: X402PaymentHeader = {
      scheme: 'exact',
      network: 'algorand',
      maxAmountRequired: '1000000',
      asset: '31566704',
      payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
      expiry: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
    };
    const result = validatePaymentHeader(header, config);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });
});

describe('createResponseValidator', () => {
  it('should accept responses within size limit', () => {
    const validator = createResponseValidator(1024 * 1024); // 1MB
    const response = new Response('test', {
      headers: { 'content-length': '100' },
    });
    const result = validator(response);
    expect(result.valid).toBe(true);
  });

  it('should reject responses exceeding size limit', () => {
    const validator = createResponseValidator(1024); // 1KB
    const response = new Response('test', {
      headers: { 'content-length': '2048' },
    });
    const result = validator(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds maximum');
  });

  it('should accept responses without content-length header', () => {
    const validator = createResponseValidator(1024);
    const response = new Response('test');
    const result = validator(response);
    expect(result.valid).toBe(true);
  });
});
