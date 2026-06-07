/**
 * @sippar/plugin-x402-algorand
 *
 * ElizaOS plugin for x402 payments on Algorand via GoPlausible facilitator.
 *
 * Features:
 * - Automatic 402 Payment Required handling
 * - Multi-stablecoin allowlist (USDC + opt-in ASAs e.g. Quantoz EURQ/USDQ)
 * - SSRF protection via domain allowlisting
 * - Response size limits
 *
 * @example
 * ```typescript
 * import { x402AlgorandPlugin } from '@sippar/plugin-x402-algorand';
 *
 * const agent = new Agent({
 *   plugins: [x402AlgorandPlugin],
 *   settings: {
 *     secrets: {
 *       ALGORAND_PRIVATE_KEY: 'your-mnemonic-or-base64-key'
 *     },
 *     x402_algorand: {
 *       allowedDomains: ['sippar.network', 'nuru.network']
 *     }
 *   }
 * });
 * ```
 */

// Define minimal types compatible with ElizaOS Plugin interface
// This avoids requiring @elizaos/core as a build-time dependency

interface PluginAction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (runtime: unknown, ...args: unknown[]) => Promise<unknown>;
}

interface Plugin {
  name: string;
  description: string;
  init?: (runtime: unknown, settings: unknown) => Promise<void>;
  actions?: PluginAction[];
  evaluators?: unknown[];
  providers?: unknown[];
}
import { createSigner } from './signer.js';
import { createX402Fetch } from './client.js';
import type { X402AlgorandConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

// Re-export types
export type {
  X402AlgorandConfig,
  X402PaymentHeader,
  AlgorandSigner,
  PaymentResult,
  Result,
} from './types.js';

// Re-export classes
export { LocalAlgorandSigner, createSigner } from './signer.js';
export { createX402Fetch, X402PaymentError, X402SecurityError } from './client.js';
export { GoPlausibleFacilitator } from './facilitator.js';
export {
  validateDomain,
  validatePaymentHeader,
  createResponseValidator,
} from './security.js';
export {
  ALGORAND_MAINNET_STABLECOINS,
  resolveAllowedAssetIds,
} from './assets.js';
export type { StablecoinAsset } from './assets.js';

/** State stored per runtime instance */
interface PluginState {
  signer: ReturnType<typeof createSigner>;
  x402Fetch: ReturnType<typeof createX402Fetch>;
  config: X402AlgorandConfig;
}

/** WeakMap for runtime-specific state */
const runtimeState = new WeakMap<object, PluginState>();

/**
 * Initialize the x402 Algorand plugin for a runtime
 */
function initializePlugin(runtime: object, settings: Record<string, unknown>): PluginState {
  // Check for existing state
  const existing = runtimeState.get(runtime);
  if (existing) {
    return existing;
  }

  // Extract configuration from settings
  const secrets = (settings.secrets || {}) as Record<string, string>;
  const x402Config = (settings.x402_algorand || {}) as Partial<X402AlgorandConfig>;

  // Get private key from secrets
  const privateKey = secrets.ALGORAND_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'ALGORAND_PRIVATE_KEY not found in settings.secrets. ' +
      'Provide a 25-word mnemonic or base64-encoded secret key.'
    );
  }

  // Merge with defaults
  const config: X402AlgorandConfig = {
    ...DEFAULT_CONFIG,
    ...x402Config,
    privateKey,
  } as X402AlgorandConfig;

  // Validate required fields
  if (!config.allowedDomains || config.allowedDomains.length === 0) {
    console.warn(
      '[x402-algorand] Warning: No allowedDomains configured. ' +
      'All HTTPS domains will be allowed. Configure allowedDomains for SSRF protection.'
    );
    config.allowedDomains = [];
  }

  // Create signer and fetch wrapper
  const signer = createSigner(privateKey);
  const x402Fetch = createX402Fetch(signer, config);

  // Store state
  const state: PluginState = { signer, x402Fetch, config };
  runtimeState.set(runtime, state);

  return state;
}

/**
 * Get x402 fetch function for a runtime
 */
export function getX402Fetch(runtime: object): ReturnType<typeof createX402Fetch> | null {
  const state = runtimeState.get(runtime);
  return state?.x402Fetch || null;
}

/**
 * Get wallet address for a runtime
 */
export async function getWalletAddress(runtime: object): Promise<string | null> {
  const state = runtimeState.get(runtime);
  if (!state) return null;
  return state.signer.getAddress();
}

/**
 * ElizaOS Plugin Definition
 */
export const x402AlgorandPlugin: Plugin = {
  name: 'x402-algorand',
  description: 'x402 payments on Algorand via GoPlausible facilitator',

  // Plugin initialization
  async init(runtime: unknown, settings: unknown) {
    try {
      const state = initializePlugin(runtime as object, settings as Record<string, unknown>);
      const address = await state.signer.getAddress();
      console.log(`[x402-algorand] Initialized with wallet: ${address}`);
      console.log(`[x402-algorand] Facilitator: ${state.config.facilitatorUrl}`);
      console.log(`[x402-algorand] Allowed domains: ${state.config.allowedDomains.length || 'all'}`);
    } catch (error) {
      console.error('[x402-algorand] Initialization failed:', error);
      throw error;
    }
  },

  // Plugin actions (can be extended)
  actions: [
    {
      name: 'x402_pay_algorand',
      description: 'Make an x402 payment request to an Algorand-enabled service',
      parameters: {
        url: {
          type: 'string',
          description: 'Target URL that requires x402 payment',
          required: true,
        },
        method: {
          type: 'string',
          description: 'HTTP method (GET, POST, etc.)',
          default: 'GET',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST/PUT)',
        },
        headers: {
          type: 'object',
          description: 'Additional request headers',
        },
      },
      async handler(runtime: unknown, params: unknown) {
        const p = params as Record<string, unknown>;
        const x402Fetch = getX402Fetch(runtime as object);
        if (!x402Fetch) {
          throw new Error('x402-algorand plugin not initialized');
        }

        const url = p.url as string;
        const method = (p.method as string) || 'GET';
        const body = p.body as string | undefined;
        const headers = (p.headers as Record<string, string>) || {};

        const response = await x402Fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body,
        });

        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await response.text(),
        };
      },
    },
    {
      name: 'x402_get_wallet',
      description: 'Get the Algorand wallet address used for x402 payments',
      parameters: {},
      async handler(runtime: unknown) {
        const address = await getWalletAddress(runtime as object);
        if (!address) {
          throw new Error('x402-algorand plugin not initialized');
        }
        return { address };
      },
    },
  ],

  // Plugin evaluators (none for now)
  evaluators: [],

  // Plugin providers (none for now)
  providers: [],
};

// Default export for ESM
export default x402AlgorandPlugin;
