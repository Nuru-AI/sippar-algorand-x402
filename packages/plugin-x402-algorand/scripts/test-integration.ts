#!/usr/bin/env npx tsx
/**
 * Integration test for @sippar/plugin-x402-algorand
 *
 * Tests the plugin against real Sippar x402 endpoints.
 *
 * Prerequisites:
 * - Set ALGORAND_PRIVATE_KEY environment variable (mnemonic or base64 key)
 * - Ensure wallet has USDC balance on Algorand mainnet
 *
 * Usage:
 *   ALGORAND_PRIVATE_KEY="your-mnemonic" npx tsx scripts/test-integration.ts
 */

import { createSigner, createX402Fetch, getWalletAddress } from '../src/index.js';
import type { X402AlgorandConfig } from '../src/types.js';

const SIPPAR_X402_ENDPOINT = 'https://sippar.network/api/sippar/x402-native';

async function main() {
  console.log('='.repeat(60));
  console.log('@sippar/plugin-x402-algorand Integration Test');
  console.log('='.repeat(60));

  // Check for private key
  const privateKey = process.env.ALGORAND_PRIVATE_KEY;
  if (!privateKey) {
    console.error('\nError: ALGORAND_PRIVATE_KEY environment variable not set');
    console.error('Usage: ALGORAND_PRIVATE_KEY="your-mnemonic" npx tsx scripts/test-integration.ts');
    process.exit(1);
  }

  // Create signer
  console.log('\n[1/5] Creating Algorand signer...');
  const signer = createSigner(privateKey);
  const address = await signer.getAddress();
  console.log(`  Wallet address: ${address}`);

  // Configure x402 client
  const config: X402AlgorandConfig = {
    facilitatorUrl: 'https://goplausible.com/verify',
    allowedDomains: ['sippar.network'],
    usdcAssetId: 31566704,
    algodUrl: 'https://mainnet-api.algonode.cloud',
    algodToken: '',
    maxResponseSize: 4 * 1024 * 1024,
    timeout: 30000,
  };

  // Create x402 fetch wrapper
  console.log('\n[2/5] Creating x402 fetch wrapper...');
  const x402Fetch = createX402Fetch(signer, config);
  console.log('  Facilitator:', config.facilitatorUrl);
  console.log('  Allowed domains:', config.allowedDomains.join(', '));

  // Test 1: Health check (no payment required)
  console.log('\n[3/5] Testing health endpoint (no payment)...');
  try {
    const healthResponse = await fetch(`${SIPPAR_X402_ENDPOINT}/health`);
    const healthData = await healthResponse.json();
    console.log('  Status:', healthResponse.status);
    console.log('  Response:', JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.error('  Error:', error instanceof Error ? error.message : error);
  }

  // Test 2: Pricing endpoint
  console.log('\n[4/5] Testing pricing endpoint...');
  try {
    const pricingResponse = await fetch(`${SIPPAR_X402_ENDPOINT}/pricing`);
    const pricingData = await pricingResponse.json();
    console.log('  Status:', pricingResponse.status);
    console.log('  Pricing:', JSON.stringify(pricingData, null, 2));
  } catch (error) {
    console.error('  Error:', error instanceof Error ? error.message : error);
  }

  // Test 3: Protected endpoint (requires payment)
  console.log('\n[5/5] Testing protected endpoint (x402 payment flow)...');
  console.log('  Endpoint:', `${SIPPAR_X402_ENDPOINT}/ci-agents/developer`);
  console.log('  This will attempt a real payment if the endpoint returns 402.');

  // First, check if we get a 402 without payment
  try {
    const testResponse = await fetch(`${SIPPAR_X402_ENDPOINT}/ci-agents/developer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello, test query' }),
    });

    console.log('  Initial response:', testResponse.status);

    if (testResponse.status === 402) {
      const paymentHeader = testResponse.headers.get('X-Payment') ||
        testResponse.headers.get('Payment-Required');
      console.log('  Payment header:', paymentHeader);

      // Now test with x402Fetch (this would actually make a payment)
      console.log('\n  To complete the payment, uncomment the x402Fetch call below.');
      console.log('  WARNING: This will spend real USDC from your wallet.');

      /*
      // Uncomment to test actual payment:
      const paidResponse = await x402Fetch(`${SIPPAR_X402_ENDPOINT}/ci-agents/developer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello, test query' }),
      });
      console.log('  Paid response:', paidResponse.status);
      const paidData = await paidResponse.json();
      console.log('  Response data:', JSON.stringify(paidData, null, 2));
      */
    } else if (testResponse.status === 200) {
      console.log('  Response (no payment needed):', await testResponse.text());
    } else {
      console.log('  Unexpected status:', testResponse.status);
      console.log('  Body:', await testResponse.text());
    }
  } catch (error) {
    console.error('  Error:', error instanceof Error ? error.message : error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Integration test complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
