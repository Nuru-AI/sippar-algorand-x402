/**
 * x402 Algorand Plugin Types
 */

/** Plugin configuration */
export interface X402AlgorandConfig {
  /** Algorand private key (base64 or mnemonic) */
  privateKey?: string;

  /** GoPlausible facilitator URL */
  facilitatorUrl: string;

  /** Allowed domains for x402 payments (SSRF protection) */
  allowedDomains: string[];

  /** USDC Asset ID on Algorand mainnet */
  usdcAssetId: number;

  /**
   * Additional accepted ASA IDs beyond USDC (e.g. Quantoz EURQ/USDQ).
   * Enables multi-stablecoin agentic payments. Unset/<=0 entries are ignored.
   */
  allowedAssetIds?: number[];

  /** Algod API endpoint */
  algodUrl: string;

  /** Algod API token */
  algodToken: string;

  /** Maximum response size in bytes (default: 4MB) */
  maxResponseSize: number;

  /** Request timeout in milliseconds */
  timeout: number;
}

/** Default configuration values */
export const DEFAULT_CONFIG: Partial<X402AlgorandConfig> = {
  facilitatorUrl: 'https://goplausible.com/verify',
  usdcAssetId: 31566704, // Algorand mainnet USDC
  algodUrl: 'https://mainnet-api.algonode.cloud',
  algodToken: '',
  maxResponseSize: 4 * 1024 * 1024, // 4MB
  timeout: 30000,
  allowedDomains: [],
};

/** x402 payment header parsed from 402 response */
export interface X402PaymentHeader {
  /** Payment scheme (e.g., 'exact') */
  scheme: string;

  /** Network identifier (e.g., 'algorand' or 'algorand:genesis_hash') */
  network: string;

  /** Maximum amount required in microALGO or USDC atomic units */
  maxAmountRequired: string;

  /** Asset for payment (ALGO or USDC asset ID) */
  asset: string;

  /** Address to pay */
  payTo: string;

  /** Payment note/memo */
  note?: string;

  /** Expiration timestamp */
  expiry?: number;

  /** Nonce for replay protection */
  nonce?: string;
}

/** Payment result from facilitator */
export interface PaymentResult {
  success: boolean;
  txId?: string;
  receipt?: string;
  error?: string;
}

/** Signer interface for different signing strategies */
export interface AlgorandSigner {
  /** Get the wallet address */
  getAddress(): Promise<string>;

  /** Sign a transaction */
  signTransaction(txnBytes: Uint8Array): Promise<Uint8Array>;
}

/** Result type for operations */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
