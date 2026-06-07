/**
 * GoPlausible Facilitator Integration
 *
 * Handles payment verification and receipt generation for Algorand x402 payments.
 */

import type { PaymentResult, X402AlgorandConfig } from './types.js';

export interface FacilitatorRequest {
  /** Signed transaction bytes (base64) */
  signedTxn: string;

  /** Original payment header from 402 response */
  paymentHeader: string;

  /** Target service URL */
  targetUrl: string;
}

export interface FacilitatorResponse {
  success: boolean;
  txId?: string;
  receipt?: string;
  error?: string;
  message?: string;
}

/**
 * GoPlausible Algorand x402 Facilitator Client
 */
export class GoPlausibleFacilitator {
  private readonly facilitatorUrl: string;
  private readonly timeout: number;

  constructor(config: X402AlgorandConfig) {
    this.facilitatorUrl = config.facilitatorUrl;
    this.timeout = config.timeout;
  }

  /**
   * Submit signed transaction for verification and get payment receipt
   */
  async verify(request: FacilitatorRequest): Promise<PaymentResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.facilitatorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          signedTransaction: request.signedTxn,
          paymentHeader: request.paymentHeader,
          targetUrl: request.targetUrl,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Facilitator error (${response.status}): ${errorText}`,
        };
      }

      const result = (await response.json()) as FacilitatorResponse;

      if (!result.success) {
        return {
          success: false,
          error: result.error || result.message || 'Verification failed',
        };
      }

      return {
        success: true,
        txId: result.txId,
        receipt: result.receipt,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Facilitator request timed out' };
        }
        return { success: false, error: error.message };
      }

      return { success: false, error: 'Unknown facilitator error' };
    }
  }

  /**
   * Check facilitator health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.facilitatorUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
