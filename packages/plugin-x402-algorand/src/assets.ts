/**
 * Known Algorand Standard Asset (ASA) stablecoins for x402 payments.
 *
 * Asset IDs are network-specific and MUST be verified on-chain before use in
 * production (e.g. https://allo.info or https://explorer.perawallet.app).
 * Entries with `assetId === 0` are placeholders and are treated as disabled
 * until a verified ID is supplied (via config `allowedAssetIds`).
 */

export interface StablecoinAsset {
  /** Ticker symbol */
  symbol: string;
  /** Algorand mainnet ASA ID (0 = unverified / disabled) */
  assetId: number;
  /** Decimal places */
  decimals: number;
  /** Human-readable description */
  description: string;
}

/**
 * Mainnet stablecoin registry.
 *
 * USDC and Quantoz EURQ/USDQ (MiCA-compliant e-money tokens, launched on
 * Algorand 2025-04-03) are verified on-chain. To accept EURQ/USDQ in the
 * payment-header allowlist, pass their asset IDs via config `allowedAssetIds`.
 */
export const ALGORAND_MAINNET_STABLECOINS: Record<string, StablecoinAsset> = {
  USDC: {
    symbol: 'USDC',
    assetId: 31566704,
    decimals: 6,
    description: 'Circle USD Coin (verified mainnet ASA)',
  },
  EURQ: {
    symbol: 'EURQ',
    assetId: 2768422954, // Verified mainnet ASA (creator UALFRIYMF..., name "Quantoz EURQ")
    decimals: 6,
    description: 'Quantoz EURQ — MiCA-compliant EUR e-money token.',
  },
  USDQ: {
    symbol: 'USDQ',
    assetId: 2768603795, // Verified mainnet ASA (creator UALFRIYMF..., name "Quantoz USDQ")
    decimals: 6,
    description: 'Quantoz USDQ — MiCA-compliant USD e-money token.',
  },
} as const;

/**
 * Resolve the set of accepted ASA IDs from configuration.
 *
 * Combines the primary USDC asset with any additional `allowedAssetIds`
 * (e.g. Quantoz EURQ for the EUR agentic-payment flow), dropping unset
 * (`<= 0`) and non-finite entries so placeholders never accidentally pass.
 */
export function resolveAllowedAssetIds(
  usdcAssetId: number,
  allowedAssetIds?: number[]
): Set<number> {
  return new Set(
    [usdcAssetId, ...(allowedAssetIds ?? [])].filter(
      (id) => Number.isFinite(id) && id > 0
    )
  );
}
