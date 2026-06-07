/**
 * Algorand x402 Client Service (threshold-signed)
 *
 * Pays an Algorand x402 "exact" service from a Sippar threshold-derived address,
 * signing the payment transaction with ICP threshold signatures — NO private key,
 * NO custodian. This is the demo-critical path: "agent pays an Algorand service
 * over x402, settled by an ICP-distributed key."
 *
 * Sippar's existing x402 client (x402ClientService) covers EVM/Solana/Stellar but
 * not Algorand; this service fills that gap using the @x402-avm client SDK with a
 * custom signer that delegates to icpCanisterService.signAlgorandTransaction.
 *
 * Flow: GET/POST service -> 402 -> @x402-avm builds the AVM exact payment ->
 * our ThresholdAvmSigner threshold-signs it -> retry with PAYMENT header ->
 * GoPlausible facilitator broadcasts/verifies -> service response returned.
 *
 * Env overrides:
 *   X402_ALGO_PAYER_PRINCIPAL / X402_ALGO_PAYER_ADDRESS — the threshold-derived
 *     payer (must hold USDC + ALGO). Defaults to the ETH-Agent reserve.
 *   ALGOD_MAINNET_URL — algod endpoint (default AlgoNode).
 */

import algosdk from 'algosdk';
// @x402-avm client SDK (same package family the server middleware already uses).
// Types are loose; cast where the SDK's d.ts is structural-only.
import { x402Client, x402HTTPClient } from '@x402-avm/core/client';
import { registerExactAvmScheme } from '@x402-avm/avm/exact/client';
import { icpCanisterService } from './icpCanisterService.js';
import { algorandMainnet } from './algorandService.js';

const ALGORAND_MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=';
const ALGOD_URL = process.env.ALGOD_MAINNET_URL || 'https://mainnet-api.algonode.cloud';
const EURQ_ASA_ID = Number(process.env.X402_EURQ_ASA_ID || 2768422954);

// ETH-Agent reserve: threshold-derived address that already holds a USDC reserve
// (see instantSettlementService). Used here as the x402 payer.
const PAYER_PRINCIPAL =
  process.env.X402_ALGO_PAYER_PRINCIPAL ||
  'wnw46-hqpz3-jng5w-mtc3m-6ymds-kibjk-pzqv3-rh4ak-kmes3-er2je-dqe';
const PAYER_ADDRESS =
  process.env.X402_ALGO_PAYER_ADDRESS ||
  '7WHJSM3GSCZ3F4MXQ4G7ADIVABWC7BLJS5HX76JW2A7CPLXKKSEPTH7MIA';

// Some Algorand x402 services (e.g. AlgoVoi) return a body-based 402 using the V1
// "simple" network format (`algorand-mainnet`) and `maxAmountRequired` instead of
// CAIP-2 + `amount` — which the standard @x402-avm client parser rejects. Normalize
// those into the canonical shape so the same threshold flow handles both. Idempotent
// for already-canonical (CAIP-2 + amount) responses like Carbon & Cashmere.
const V1_NETWORK_TO_CAIP2: Record<string, string> = {
  'algorand-mainnet': 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
  'algorand-testnet': 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
};
function normalizeAlgorandPaymentRequired(body: any): any | null {
  if (!body || typeof body !== 'object' || !Array.isArray(body.accepts)) return null;
  const accepts = body.accepts.map((a: any) => {
    const net = String(a?.network ?? '');
    return {
      ...a,
      network: V1_NETWORK_TO_CAIP2[net] || net,
      amount: a?.amount ?? a?.maxAmountRequired,
    };
  });
  return { ...body, x402Version: body.x402Version ?? 2, accepts };
}

export interface AlgorandX402Result {
  success: boolean;
  status?: number;
  response?: any;
  paymentTx?: string;
  payer?: string;
  error?: string;
}

/**
 * Build a ClientAvmSigner backed by ICP threshold signatures.
 *
 * @x402-avm hands us msgpack-encoded UNSIGNED transactions and expects
 * msgpack-encoded SIGNED transactions ({ sig, txn }) back — exactly the
 * wallet-adapter contract. We decode, take the canonical bytesToSign(), have the
 * threshold_signer canister sign them, and re-encode the signed blob. Mirrors the
 * proven sign path in instantSettlementService.
 */
function createThresholdSigner(address: string, principal: string) {
  return {
    address,
    async signTransactions(
      txns: Uint8Array[],
      indexesToSign?: number[],
    ): Promise<(Uint8Array | null)[]> {
      const out: (Uint8Array | null)[] = [];
      for (let i = 0; i < txns.length; i++) {
        // The facilitator may co-sign other group members (e.g. a fee txn); only
        // sign the indexes we're asked to (or all, if unspecified).
        if (indexesToSign && !indexesToSign.includes(i)) {
          out.push(null);
          continue;
        }
        const txn = algosdk.decodeUnsignedTransaction(txns[i]);
        const toSign = txn.bytesToSign();
        const signed = await icpCanisterService.signAlgorandTransaction(
          principal,
          new Uint8Array(toSign),
        );
        const blob = algosdk.encodeObj({
          sig: new Uint8Array(signed.signature),
          txn: (txn as any).get_obj_for_encoding(),
        });
        out.push(new Uint8Array(blob));
      }
      return out;
    },
  };
}

/**
 * Call an Algorand x402 service, paying via ICP threshold signature.
 */
export async function callAlgorandX402Service(params: {
  serviceUrl: string;
  payload?: any;
  method?: 'GET' | 'POST';
  extraHeaders?: Record<string, string>;
  /** Hard cap on what we'll pay, in USDC. Defaults to $0.10. */
  maxAmountUSDC?: number;
  timeoutMs?: number;
}): Promise<AlgorandX402Result> {
  const {
    serviceUrl,
    payload,
    method = 'POST',
    extraHeaders = {},
    maxAmountUSDC = 0.1,
    timeoutMs = 60000,
  } = params;

  const signer = createThresholdSigner(PAYER_ADDRESS, PAYER_PRINCIPAL);
  const client = new x402Client();
  registerExactAvmScheme(client as any, {
    signer: signer as any,
    algodConfig: { algodUrl: ALGOD_URL, algodToken: '' },
    networks: [ALGORAND_MAINNET as any],
  });
  const httpClient = new x402HTTPClient(client);

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  const body =
    method === 'POST' && payload !== undefined ? JSON.stringify(payload) : undefined;

  const doFetch = (headers: Record<string, string>) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(serviceUrl, { method, headers, body, signal: controller.signal }).finally(
      () => clearTimeout(t),
    );
  };

  try {
    // 1) Initial request — expect 402.
    const first = await doFetch(baseHeaders);
    if (first.status !== 402) {
      const text = await first.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      return {
        success: first.ok,
        status: first.status,
        response: parsed,
        payer: PAYER_ADDRESS,
        error: first.ok ? undefined : `Expected 402, got ${first.status}`,
      };
    }

    // 2) Parse payment requirements (header-first, body fallback).
    const firstText = await first.text();
    let firstBody: any;
    try {
      firstBody = JSON.parse(firstText);
    } catch {
      firstBody = undefined;
    }
    let paymentRequired: any;
    try {
      paymentRequired = httpClient.getPaymentRequiredResponse(
        (name: string) => first.headers.get(name),
        firstBody,
      );
    } catch (parseErr) {
      // Non-standard body-based 402 (e.g. AlgoVoi: V1 network + maxAmountRequired).
      const normalized = normalizeAlgorandPaymentRequired(firstBody);
      if (!normalized) throw parseErr;
      paymentRequired = normalized;
    }
    // Normalize V1 network / maxAmountRequired into canonical CAIP-2 + amount so the
    // AVM scheme can build the payment (idempotent for already-canonical responses).
    paymentRequired = normalizeAlgorandPaymentRequired(paymentRequired) || paymentRequired;

    // Budget guard: reject if any selected option exceeds our cap.
    const accepts = (paymentRequired as any)?.accepts || [];
    const algoOpt = accepts.find((a: any) =>
      String(a?.network || '').startsWith('algorand'),
    );
    if (algoOpt) {
      const amountUSDC = Number(algoOpt.amount ?? algoOpt.maxAmountRequired ?? 0) / 1_000_000;
      if (amountUSDC > maxAmountUSDC) {
        return {
          success: false,
          status: 402,
          payer: PAYER_ADDRESS,
          error: `Required ${amountUSDC} USDC exceeds cap ${maxAmountUSDC}`,
        };
      }
    }

    // 3) Build + threshold-sign the payment payload.
    const paymentPayload = await (client as any).createPaymentPayload(paymentRequired);
    const payHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

    // 4) Retry with the payment header — facilitator verifies + settles.
    const second = await doFetch({ ...baseHeaders, ...payHeaders });
    const secondText = await second.text();
    let secondBody: any;
    try {
      secondBody = JSON.parse(secondText);
    } catch {
      secondBody = secondText;
    }

    // 5) Extract settlement tx id from the PAYMENT-RESPONSE header if present.
    let paymentTx: string | undefined;
    try {
      const settle: any = httpClient.getPaymentSettleResponse((name: string) =>
        second.headers.get(name),
      );
      paymentTx =
        settle?.transaction || settle?.txHash || settle?.txId || settle?.payer || undefined;
    } catch {
      /* settlement header absent or unparseable — non-fatal */
    }

    return {
      success: second.ok,
      status: second.status,
      response: secondBody,
      paymentTx,
      payer: PAYER_ADDRESS,
      error: second.ok ? undefined : `Service returned ${second.status} after payment`,
    };
  } catch (error: any) {
    return {
      success: false,
      payer: PAYER_ADDRESS,
      error: error?.message || String(error),
    };
  }
}

/**
 * Threshold-signed ASA opt-in: a 0-amount self-transfer of `assetId`, signed by
 * the address's ICP principal and submitted to mainnet. Idempotent — if the
 * address is already opted in, returns alreadyOptedIn:true. Required before an
 * address can receive a given ASA (e.g. EURQ before the EUR-denominated beat).
 */
export async function optInToAsa(params: {
  address: string;
  principal: string;
  assetId: number;
}): Promise<{ success: boolean; txId?: string; alreadyOptedIn?: boolean; error?: string }> {
  const { address, principal, assetId } = params;
  try {
    const suggestedParams = await algorandMainnet.getSuggestedParams();
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: address,
      to: address,
      amount: 0,
      assetIndex: assetId,
      suggestedParams,
    });
    const toSign = optInTxn.bytesToSign();
    const signed = await icpCanisterService.signAlgorandTransaction(
      principal,
      new Uint8Array(toSign),
    );
    const blob = algosdk.encodeObj({
      sig: new Uint8Array(signed.signature),
      txn: (optInTxn as any).get_obj_for_encoding(),
    });
    const sub: any = await algorandMainnet.submitTransaction(new Uint8Array(blob));
    return { success: true, txId: sub?.txId };
  } catch (error: any) {
    const msg = error?.message || String(error);
    // Algorand rejects a duplicate opt-in; treat as success (already opted in).
    if (/already opted in|has already opted|asset .* already/i.test(msg)) {
      return { success: true, alreadyOptedIn: true };
    }
    return { success: false, error: msg };
  }
}

/** Opt the default payer reserve into the EURQ ASA (prep for the EUR beat). */
export async function optInReserveToEurq() {
  return optInToAsa({ address: PAYER_ADDRESS, principal: PAYER_PRINCIPAL, assetId: EURQ_ASA_ID });
}
