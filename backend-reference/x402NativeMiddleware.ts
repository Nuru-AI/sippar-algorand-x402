/**
 * X402 Native Protocol Middleware
 *
 * Wraps @x402-avm/express for native x402 protocol support on Algorand.
 * This is SEPARATE from the existing JWT-based x402Service.
 *
 * Phase 1: Uses GoPlausible facilitator for USDC payments
 */

import { paymentMiddleware, x402ResourceServer } from "@x402-avm/express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402-avm/core/server";
import { ExactAvmScheme, registerExactAvmScheme } from "@x402-avm/avm/exact/server";

// Algorand network identifiers (CAIP-2 format) - these are constants, safe at top level
const ALGORAND_MAINNET = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=";
const ALGORAND_TESTNET = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

// USDC ASA ID on Algorand mainnet (for reference)
const USDC_MAINNET_ASA_ID = "31566704";

// Quantoz EURQ — MiCA-compliant EUR e-money token (Algorand mainnet ASA).
const EURQ_MAINNET_ASA_ID = "2768422954";
// EURQ payments settle to the threshold-derived reserve (principal known, so it
// can be opted into the EURQ ASA). Override via X402_EURQ_PAYTO if needed.
const EURQ_PAYTO =
  process.env.X402_EURQ_PAYTO ||
  "7WHJSM3GSCZ3F4MXQ4G7ADIVABWC7BLJS5HX76JW2A7CPLXKKSEPTH7MIA";

/**
 * Get environment configuration at runtime (after dotenv has loaded)
 */
function getEnvConfig() {
  return {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://facilitator.goplausible.xyz",
    usdcAddress: process.env.X402_USDC_ADDRESS,
  };
}

/**
 * Route configurations for x402-native endpoints
 * These are SEPARATE from existing JWT routes
 *
 * Pricing is in USD, converted to USDC (6 decimals)
 */
function getRouteConfig(usdcAddress: string): RoutesConfig {
  return {
    // CI Agent routes with USDC pricing
    // Note: x402-avm uses bracket notation [param] for route parameters, NOT Express-style :param
    // The ExactAvmScheme automatically converts USD prices to USDC on Algorand
    "POST /ci-agents/[agent]/[service]": {
      accepts: [{
        scheme: "exact",
        price: "$0.10",  // 0.10 USDC
        network: ALGORAND_MAINNET,
        payTo: usdcAddress,
      }],
      description: "CI Agent service invocation via x402 native protocol",
      mimeType: "application/json",
    },

    // AI query endpoint
    "POST /ai/query": {
      accepts: [{
        scheme: "exact",
        price: "$0.01",  // 0.01 USDC
        network: ALGORAND_MAINNET,
        payTo: usdcAddress,
      }],
      description: "AI query with x402 payment",
      mimeType: "application/json",
    },

    // Enhanced AI query (higher price for premium models)
    "POST /ai/enhanced-query": {
      accepts: [{
        scheme: "exact",
        price: "$0.05",  // 0.05 USDC
        network: ALGORAND_MAINNET,
        payTo: usdcAddress,
      }],
      description: "Enhanced AI query with premium models",
      mimeType: "application/json",
    },

    // Open-source LLM inference served by Featherless AI (hackathon hero demo).
    // Featherless has no native x402 — after this Algorand payment settles, the
    // route handler calls api.featherless.ai with Sippar's key and returns the
    // completion (see services/featherlessService.ts).
    "POST /ai/inference": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.05",  // 0.05 USDC (auto-converted to USDC ASA)
          network: ALGORAND_MAINNET,
          payTo: usdcAddress,
        },
        {
          // EUR-denominated option (Quantoz bonus). Explicit AssetAmount so the
          // 402 advertises EURQ (not USDC): 50000 base units = €0.05 (6 decimals).
          // payTo is the EURQ-opted-in reserve. The client picks USDC or EURQ.
          scheme: "exact",
          price: { asset: EURQ_MAINNET_ASA_ID, amount: "50000", extra: { name: "EURQ", decimals: 6 } },
          network: ALGORAND_MAINNET,
          payTo: EURQ_PAYTO,
        },
      ],
      description: "Open-source LLM inference (Featherless AI) via x402 on Algorand",
      mimeType: "application/json",
    },
  };
}

/**
 * Create the x402 native middleware
 *
 * @returns Express middleware for x402 native protocol, or null if not configured
 */
export function createX402NativeMiddleware() {
  const config = getEnvConfig();

  if (!config.usdcAddress) {
    console.warn("⚠️ X402_USDC_ADDRESS not set - x402 native middleware disabled");
    return null;
  }

  try {
    // Create HTTP facilitator client
    const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl });

    // Create resource server and register Algorand scheme
    const resourceServer = new x402ResourceServer(facilitatorClient);

    // Register the AVM exact scheme for Algorand
    registerExactAvmScheme(resourceServer, {
      networks: [ALGORAND_MAINNET],
    });

    // Get route configuration
    const routes = getRouteConfig(config.usdcAddress);

    console.log("🔐 X402 Native middleware initialized");
    console.log(`   Facilitator: ${config.facilitatorUrl}`);
    console.log(`   Network: ${ALGORAND_MAINNET}`);
    console.log(`   Receive address: ${config.usdcAddress}`);
    console.log(`   Protected routes: ${Object.keys(routes).length}`);

    // Create and return the middleware
    return paymentMiddleware(routes, resourceServer);

  } catch (error) {
    console.error("❌ Failed to create x402 native middleware:", error);
    return null;
  }
}

/**
 * Check if x402 native is properly configured
 */
export function isX402NativeConfigured(): boolean {
  return !!getEnvConfig().usdcAddress;
}

/**
 * Get x402 native configuration info (for debugging/status endpoints)
 */
export function getX402NativeConfig() {
  const config = getEnvConfig();
  return {
    configured: !!config.usdcAddress,
    facilitatorUrl: config.facilitatorUrl,
    network: ALGORAND_MAINNET,
    receiveAddress: config.usdcAddress || "(not configured)",
    usdcAsaId: USDC_MAINNET_ASA_ID,
  };
}
