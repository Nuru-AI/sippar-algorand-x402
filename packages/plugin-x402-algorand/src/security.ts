/**
 * Security Validations for x402 Algorand Plugin
 *
 * Protects against:
 * - SSRF attacks via prompt injection
 * - Unapproved token payments (only allowlisted stablecoin ASAs)
 * - Response size attacks
 * - IPv6 mapped address bypasses
 */

import type { X402AlgorandConfig, X402PaymentHeader } from './types.js';
import { resolveAllowedAssetIds } from './assets.js';

/** Private IP ranges to block */
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./, // Link-local
  /^fc00:/i, // IPv6 private
  /^fd[0-9a-f]{2}:/i, // IPv6 ULA
  /^fe80:/i, // IPv6 link-local
  /^::1$/, // IPv6 loopback
  /^::ffff:(127|10|172\.(1[6-9]|2[0-9]|3[0-1])|192\.168)\./i, // IPv6-mapped IPv4 dotted
];

/**
 * Check if an IPv6-mapped IPv4 address (hex format) is a private IP
 * Format: ::ffff:XXYY:ZZWW where XX.YY.ZZ.WW is the IPv4 address
 */
function isPrivateIPv6Mapped(hostname: string): boolean {
  const match = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return false;

  // Convert hex groups to IPv4 octets
  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);
  const octets = [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ];

  const ipv4 = octets.join('.');

  // Check against private IPv4 patterns
  return (
    /^127\./.test(ipv4) ||
    /^10\./.test(ipv4) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ipv4) ||
    /^192\.168\./.test(ipv4) ||
    /^0\./.test(ipv4) ||
    /^169\.254\./.test(ipv4)
  );
}

/**
 * Validate URL against allowed domains
 */
export function validateDomain(
  url: string,
  allowedDomains: string[]
): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Only HTTPS URLs are allowed' };
    }

    // Check against private IP patterns
    // Strip brackets from IPv6 addresses (URL parser keeps them)
    let hostname = parsed.hostname;
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: 'Private/internal IP addresses are blocked' };
      }
    }

    // Check IPv6-mapped IPv4 addresses in hex format (::ffff:XXYY:ZZWW)
    if (isPrivateIPv6Mapped(hostname)) {
      return { valid: false, reason: 'Private/internal IP addresses are blocked' };
    }

    // If allowed domains configured, enforce whitelist
    if (allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((domain) => {
        // Exact match or subdomain match
        return (
          hostname === domain ||
          hostname.endsWith(`.${domain}`)
        );
      });

      if (!isAllowed) {
        return {
          valid: false,
          reason: `Domain ${hostname} not in allowed list`,
        };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * Validate payment header against the allowlisted stablecoin ASAs
 * (USDC plus any configured `allowedAssetIds`, e.g. Quantoz EURQ).
 */
export function validatePaymentHeader(
  header: X402PaymentHeader,
  config: X402AlgorandConfig
): { valid: boolean; reason?: string } {
  // Must be Algorand network (supports 'algorand' or 'algorand:genesis_hash')
  if (!header.network.startsWith('algorand')) {
    return { valid: false, reason: `Unsupported network: ${header.network}` };
  }

  // Asset allowlist validation (multi-stablecoin)
  const assetId = parseInt(header.asset, 10);
  if (isNaN(assetId)) {
    // Could be 'ALGO' for native payments
    if (header.asset.toUpperCase() !== 'ALGO') {
      return { valid: false, reason: `Invalid asset: ${header.asset}` };
    }
  } else {
    const allowed = resolveAllowedAssetIds(config.usdcAssetId, config.allowedAssetIds);
    if (!allowed.has(assetId)) {
      return {
        valid: false,
        reason: `Asset ${assetId} not in allowed list (${[...allowed].join(', ') || 'none'}).`,
      };
    }
  }

  // Validate payment address format
  if (!header.payTo || !isValidAlgorandAddress(header.payTo)) {
    return { valid: false, reason: 'Invalid payment address' };
  }

  // Check expiry if present
  if (header.expiry && Date.now() > header.expiry * 1000) {
    return { valid: false, reason: 'Payment request has expired' };
  }

  return { valid: true };
}

/**
 * Validate Algorand address format
 */
function isValidAlgorandAddress(address: string): boolean {
  // Algorand addresses are 58 characters, base32 encoded
  if (address.length !== 58) {
    return false;
  }

  // Check character set (A-Z, 2-7)
  const base32Regex = /^[A-Z2-7]+$/;
  return base32Regex.test(address);
}

/**
 * Create a response size validator
 */
export function createResponseValidator(
  maxSize: number
): (response: Response) => { valid: boolean; reason?: string } {
  return (response: Response) => {
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > maxSize) {
        return {
          valid: false,
          reason: `Response size ${size} exceeds maximum ${maxSize}`,
        };
      }
    }
    return { valid: true };
  };
}
