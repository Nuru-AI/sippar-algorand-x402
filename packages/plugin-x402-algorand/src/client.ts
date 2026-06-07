/**
 * x402 Algorand Client
 *
 * Wraps fetch to automatically handle 402 Payment Required responses.
 * When a 402 is received, signs an Algorand payment transaction and retries.
 */

import algosdk from 'algosdk';
import type {
  AlgorandSigner,
  X402AlgorandConfig,
  X402PaymentHeader,
  Result,
} from './types.js';
import { GoPlausibleFacilitator } from './facilitator.js';
import {
  validateDomain,
  validatePaymentHeader,
  createResponseValidator,
} from './security.js';

export interface X402FetchOptions extends RequestInit {
  /** Skip x402 payment handling */
  skipPayment?: boolean;
}

/**
 * Create an x402-aware fetch function for Algorand payments
 */
export function createX402Fetch(
  signer: AlgorandSigner,
  config: X402AlgorandConfig
): (url: string, options?: X402FetchOptions) => Promise<Response> {
  const facilitator = new GoPlausibleFacilitator(config);
  const algodClient = new algosdk.Algodv2(
    config.algodToken,
    config.algodUrl,
    ''
  );
  const validateResponseSize = createResponseValidator(config.maxResponseSize);

  return async (url: string, options?: X402FetchOptions): Promise<Response> => {
    // Security: Validate domain before any request
    const domainCheck = validateDomain(url, config.allowedDomains);
    if (!domainCheck.valid) {
      throw new X402SecurityError(domainCheck.reason || 'Domain validation failed');
    }

    // Make initial request
    const initialResponse = await fetchWithTimeout(url, options, config.timeout);

    // If not 402 or payment skipped, return as-is
    if (initialResponse.status !== 402 || options?.skipPayment) {
      return initialResponse;
    }

    // Parse x402 payment header (supports both base64-encoded v2 and JSON formats)
    const paymentHeaderRaw = initialResponse.headers.get('payment-required') ||
      initialResponse.headers.get('X-Payment') ||
      initialResponse.headers.get('Payment-Required');

    if (!paymentHeaderRaw) {
      throw new X402PaymentError('402 response missing payment header');
    }

    // Parse and normalize payment header
    const paymentHeader = parsePaymentHeader(paymentHeaderRaw);

    // Security: Validate payment header
    const headerCheck = validatePaymentHeader(paymentHeader, config);
    if (!headerCheck.valid) {
      throw new X402SecurityError(headerCheck.reason || 'Payment validation failed');
    }

    // Create and sign payment transaction
    const paymentResult = await processPayment(
      signer,
      algodClient,
      facilitator,
      paymentHeader,
      paymentHeaderRaw,
      url,
      config
    );

    if (!paymentResult.success) {
      const errorMsg = paymentResult.error?.message || 'Payment failed';
      throw new X402PaymentError(errorMsg);
    }

    // Retry request with payment proof
    const retryResponse = await fetchWithTimeout(
      url,
      {
        ...options,
        headers: {
          ...options?.headers,
          'X-Payment-Signature': paymentResult.data.receipt,
          'X-Payment-TxId': paymentResult.data.txId,
        },
      },
      config.timeout
    );

    // Security: Validate response size
    const sizeCheck = validateResponseSize(retryResponse);
    if (!sizeCheck.valid) {
      throw new X402SecurityError(sizeCheck.reason || 'Response too large');
    }

    return retryResponse;
  };
}

/** x402 v2 payment accept structure */
interface X402PaymentAccept {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: {
    name?: string;
    decimals?: number;
    feePayer?: string;
  };
}

/**
 * Parse x402 payment header (supports base64-encoded v2 and JSON formats)
 */
function parsePaymentHeader(headerRaw: string): X402PaymentHeader {
  let parsed: unknown;

  // Try base64 decoding first (Algorand x402-avm uses base64)
  try {
    const decoded = Buffer.from(headerRaw, 'base64').toString('utf8');
    parsed = JSON.parse(decoded);
  } catch {
    // Fall back to direct JSON parsing
    try {
      parsed = JSON.parse(headerRaw);
    } catch {
      throw new X402PaymentError('Invalid payment header format (neither base64 nor JSON)');
    }
  }

  const obj = parsed as Record<string, unknown>;

  // Check for x402 v2 format: { x402Version: 2, accepts: [...] }
  if (obj.x402Version === 2 && Array.isArray(obj.accepts) && obj.accepts.length > 0) {
    // Find Algorand-compatible payment option
    const algoAccept = (obj.accepts as X402PaymentAccept[]).find(
      (a) => a.network.startsWith('algorand')
    ) || (obj.accepts[0] as X402PaymentAccept);

    return {
      scheme: algoAccept.scheme,
      network: 'algorand',
      maxAmountRequired: algoAccept.amount,
      asset: algoAccept.asset,
      payTo: algoAccept.payTo,
      expiry: algoAccept.maxTimeoutSeconds
        ? Math.floor(Date.now() / 1000) + algoAccept.maxTimeoutSeconds
        : undefined,
    };
  }

  // Legacy format: direct X402PaymentHeader
  if (obj.payTo && obj.asset) {
    return {
      scheme: (obj.scheme as string) || 'exact',
      network: (obj.network as string) || 'algorand',
      maxAmountRequired: (obj.maxAmountRequired as string) || (obj.amount as string) || '0',
      asset: obj.asset as string,
      payTo: obj.payTo as string,
      note: obj.note as string | undefined,
      expiry: obj.expiry as number | undefined,
      nonce: obj.nonce as string | undefined,
    };
  }

  throw new X402PaymentError('Unrecognized payment header format');
}

/**
 * Process the x402 payment
 */
async function processPayment(
  signer: AlgorandSigner,
  algodClient: algosdk.Algodv2,
  facilitator: GoPlausibleFacilitator,
  paymentHeader: X402PaymentHeader,
  paymentHeaderRaw: string,
  targetUrl: string,
  config: X402AlgorandConfig
): Promise<Result<{ txId: string; receipt: string }>> {
  try {
    // Get sender address
    const senderAddress = await signer.getAddress();

    // Get suggested params
    const suggestedParams = await algodClient.getTransactionParams().do();

    // Parse amount (in atomic units)
    const amount = BigInt(paymentHeader.maxAmountRequired);

    // Create transaction based on asset type
    let txn: algosdk.Transaction;

    if (paymentHeader.asset.toUpperCase() === 'ALGO') {
      // Native ALGO payment
      txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: senderAddress,
        receiver: paymentHeader.payTo,
        amount: amount,
        note: paymentHeader.note
          ? new TextEncoder().encode(paymentHeader.note)
          : undefined,
        suggestedParams,
      });
    } else {
      // ASA (USDC) transfer
      const assetId = parseInt(paymentHeader.asset, 10);
      txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: senderAddress,
        receiver: paymentHeader.payTo,
        amount: amount,
        assetIndex: assetId,
        note: paymentHeader.note
          ? new TextEncoder().encode(paymentHeader.note)
          : undefined,
        suggestedParams,
      });
    }

    // Sign transaction
    const txnBytes = txn.toByte();
    const signedTxnBytes = await signer.signTransaction(txnBytes);

    // Submit to facilitator for verification
    const verifyResult = await facilitator.verify({
      signedTxn: Buffer.from(signedTxnBytes).toString('base64'),
      paymentHeader: paymentHeaderRaw,
      targetUrl,
    });

    if (!verifyResult.success) {
      return { success: false, error: new Error(verifyResult.error) };
    }

    return {
      success: true,
      data: {
        txId: verifyResult.txId!,
        receipt: verifyResult.receipt!,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit | undefined,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'error', // Security: Prevent redirect-based SSRF
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * x402 Payment Error
 */
export class X402PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'X402PaymentError';
  }
}

/**
 * x402 Security Error
 */
export class X402SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'X402SecurityError';
  }
}
