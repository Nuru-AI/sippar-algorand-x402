/**
 * X402 Native Route Handlers
 *
 * These routes are protected by the x402 native middleware.
 * When a request reaches these handlers, payment has already been verified and settled.
 *
 * The x402 middleware handles:
 * - Returning 402 Payment Required for unpaid requests
 * - Verifying PAYMENT-SIGNATURE headers
 * - Settling payments via the facilitator
 * - Adding PAYMENT-RESPONSE headers on success
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ciAgentService } from '../services/ciAgentService.js';
import { featherlessChatCompletion, isFeatherlessConfigured } from '../services/featherlessService.js';
import { callAlgorandX402Service, optInReserveToEurq } from '../services/algorandX402ClientService.js';
import { getX402NativeConfig } from '../middleware/x402NativeMiddleware.js';
import { validateAgentServiceParams } from '../middleware/inputValidation.js';
import { createRateLimiter, createStrictRateLimiter } from '../middleware/rateLimiter.js';
import { createErrorResponse, logError } from '../middleware/errorSanitizer.js';

// Rate limiters for x402-native routes
// Even though users pay per request, we still rate limit to prevent abuse
const x402AgentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 60,        // 60 requests per minute per IP
  maxConcurrent: 5        // 5 concurrent requests per IP
});

const x402QueryRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 100,       // 100 queries per minute
  maxConcurrent: 10       // 10 concurrent queries
});

// Cryptographically secure session ID generator
function generateSecureSessionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(8).toString('hex')}`;
}

const router = Router();

/**
 * CI Agent invocation via x402 native
 *
 * POST /api/sippar/x402-native/ci-agents/:agent/:service
 *
 * Payment is verified by middleware BEFORE reaching this handler.
 * If we get here, payment has been successfully settled on Algorand.
 */
router.post('/ci-agents/:agent/:service', x402AgentRateLimiter, validateAgentServiceParams, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { agent, service } = req.params;
  const { sessionId, prompt, requirements, principal } = req.body;

  try {
    // Validate required fields
    if (!prompt && !requirements) {
      return res.status(400).json({
        success: false,
        error: 'Either prompt or requirements is required',
        hint: 'Provide a prompt string or requirements object in the request body',
      });
    }

    // Reject empty prompts
    const effectivePrompt = prompt ||
      (typeof requirements === 'string' ? requirements : JSON.stringify(requirements));

    if (!effectivePrompt || effectivePrompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt cannot be empty',
      });
    }

    // Generate session ID if not provided (cryptographically secure)
    const effectiveSessionId = sessionId || generateSecureSessionId('x402-native');

    // Invoke the CI agent
    const result = await ciAgentService.callAgent({
      agent,
      task: service,
      sessionId: effectiveSessionId,
      requirements: effectivePrompt,
      principal: principal || 'anonymous',
      paymentVerified: true,  // Payment verified by x402 middleware
    });

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      result,
      metadata: {
        agent,
        service,
        sessionId: effectiveSessionId,
        processingTimeMs: duration,
        paymentMethod: 'x402-native',
        protocol: 'x402-v2',
        network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
      },
    });
  } catch (error) {
    // Security: Log full error server-side, send sanitized response to client
    logError(`X402-Native-CI-Agent [${agent}/${service}]`, error instanceof Error ? error : new Error(String(error)));

    const errorResponse = createErrorResponse(error instanceof Error ? error : new Error(String(error)), 'AGENT_INVOCATION_FAILED');
    return res.status(500).json({
      ...errorResponse,
      metadata: {
        agent,
        service,
        paymentMethod: 'x402-native',
      },
    });
  }
});

/**
 * AI query via x402 native
 *
 * POST /api/sippar/x402-native/ai/query
 *
 * Payment verified by middleware before reaching here.
 */
router.post('/ai/query', x402QueryRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { query, model, options } = req.body;

  try {
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        hint: 'Provide a query string in the request body',
      });
    }

    if (query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query cannot be empty',
      });
    }

    // Route to CI agent for AI query
    // Using 'athena' agent for general queries
    const result = await ciAgentService.callAgent({
      agent: 'athena',
      task: 'knowledge-synthesis',
      sessionId: generateSecureSessionId('x402-ai'),
      requirements: query,
      principal: 'anonymous',
      paymentVerified: true,  // Payment verified by x402 middleware
    });

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      response: result.result || result,
      model: model || 'grok',
      processingTimeMs: duration,
      paymentMethod: 'x402-native',
      protocol: 'x402-v2',
    });
  } catch (error) {
    // Security: Log full error server-side, send sanitized response to client
    logError('X402-Native-AI-Query', error instanceof Error ? error : new Error(String(error)));

    return res.status(500).json(createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      'QUERY_FAILED'
    ));
  }
});

/**
 * Enhanced AI query via x402 native
 *
 * POST /api/sippar/x402-native/ai/enhanced-query
 *
 * Higher price point for premium models and extended processing.
 */
router.post('/ai/enhanced-query', x402AgentRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { query, model, options } = req.body;

  try {
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    // Use developer agent for enhanced queries
    const result = await ciAgentService.callAgent({
      agent: 'developer',
      task: 'code-generation',
      sessionId: generateSecureSessionId('x402-enhanced'),
      requirements: query,
      principal: 'anonymous',
      paymentVerified: true,  // Payment verified by x402 middleware
    });

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      response: result.result || result,
      model: model || 'grok-enhanced',
      quality_score: result.quality_score,
      processingTimeMs: duration,
      paymentMethod: 'x402-native',
      protocol: 'x402-v2',
      tier: 'enhanced',
    });
  } catch (error) {
    // Security: Log full error server-side, send sanitized response to client
    logError('X402-Native-Enhanced-Query', error instanceof Error ? error : new Error(String(error)));

    return res.status(500).json(createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      'ENHANCED_QUERY_FAILED'
    ));
  }
});

/**
 * Open-source LLM inference via x402 native (Featherless AI wrapper)
 *
 * POST /api/sippar/x402-native/ai/inference
 *
 * Hackathon hero demo: payment is verified + settled on Algorand by the x402
 * middleware BEFORE this handler runs. Featherless has no native x402, so once
 * the Algorand payment clears we call Featherless with Sippar's key and return
 * the completion — the agent paid on Algorand and got open-source inference.
 *
 * Body: { prompt?: string, messages?: [{role,content}], model?, maxTokens?, temperature? }
 */
router.post('/ai/inference', x402QueryRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { prompt, messages, model, maxTokens, temperature } = req.body;

  try {
    if (!isFeatherlessConfigured()) {
      // Payment already settled but we cannot deliver — surface clearly (500),
      // do NOT pretend success.
      logError('X402-Native-Inference', new Error('FEATHERLESS_API_KEY not configured'));
      return res.status(503).json({
        success: false,
        error: 'Inference provider not configured',
        hint: 'Set FEATHERLESS_API_KEY on the backend to enable this endpoint',
      });
    }

    const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0;
    const hasMessages = Array.isArray(messages) && messages.length > 0;
    if (!hasPrompt && !hasMessages) {
      return res.status(400).json({
        success: false,
        error: 'Either prompt or messages is required',
        hint: 'Provide a non-empty `prompt` string or `messages` array',
      });
    }

    const completion = await featherlessChatCompletion({
      prompt: hasPrompt ? prompt : undefined,
      messages: hasMessages ? messages : undefined,
      model,
      maxTokens,
      temperature,
    });

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      response: completion.content,
      model: completion.model,
      usage: completion.usage,
      processingTimeMs: duration,
      paymentMethod: 'x402-native',
      protocol: 'x402-v2',
      provider: 'featherless',
      network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    });
  } catch (error) {
    // Security: log full error server-side, sanitized response to client.
    logError('X402-Native-Inference', error instanceof Error ? error : new Error(String(error)));
    return res.status(502).json(createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      'INFERENCE_FAILED'
    ));
  }
});

/**
 * Threshold-signed EURQ opt-in (prep for the EUR-denominated beat).
 *
 * POST /api/sippar/x402-native/_selftest/optin-eurq?confirm=optin
 *
 * Opts the payer reserve into the Quantoz EURQ ASA via ICP threshold signature,
 * so it can receive EURQ. Idempotent. Costs ~0.001 ALGO fee + raises the reserve's
 * min-balance by 0.1 ALGO. Stealth-gated; requires ?confirm=optin.
 */
router.post('/_selftest/optin-eurq', x402AgentRateLimiter, async (req: Request, res: Response) => {
  if (req.query.confirm !== 'optin') {
    return res.status(400).json({
      success: false,
      error: 'Refusing to opt in without ?confirm=optin',
      hint: 'Opts the reserve into EURQ ASA 2768422954 (raises min-balance by 0.1 ALGO)',
    });
  }
  try {
    const result = await optInReserveToEurq();
    return res.status(result.success ? 200 : 502).json(result);
  } catch (error) {
    logError('X402-Native-OptInEURQ', error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json(createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      'OPTIN_FAILED',
    ));
  }
});

/**
 * Threshold-signed test-pay of a REAL third-party Algorand x402 service.
 *
 * POST /api/sippar/x402-native/_selftest/third-party?confirm=spend&target=<key>
 *
 * Proves Sippar pays an EXTERNAL Algorand x402 service (not just our own endpoint)
 * via ICP threshold signatures. Restricted to a hardcoded allowlist of cheap,
 * verified mainnet targets so it cannot drain the reserve to arbitrary addresses.
 * Stealth-gated; requires ?confirm=spend.
 */
const THIRD_PARTY_TARGETS: Record<string, { url: string; method: 'GET' | 'POST'; payload?: unknown; maxUSDC: number }> = {
  'algovoi-smoke': { url: 'https://api.algovoi.co.uk/r/fl2-vp6f/smoke-test', method: 'GET', maxUSDC: 0.05 },
  'cc-safety': { url: 'https://api.carbon-cashmere.de/v1/safety/check', method: 'POST', payload: { input: 'https://example.com' }, maxUSDC: 0.60 },
};
router.post('/_selftest/third-party', x402AgentRateLimiter, async (req: Request, res: Response) => {
  if (req.query.confirm !== 'spend') {
    return res.status(400).json({ success: false, error: 'Refusing to spend without ?confirm=spend' });
  }
  const key = String(req.query.target || 'algovoi-smoke');
  const target = THIRD_PARTY_TARGETS[key];
  if (!target) {
    return res.status(400).json({ success: false, error: `Unknown target. Allowed: ${Object.keys(THIRD_PARTY_TARGETS).join(', ')}` });
  }
  const startTime = Date.now();
  try {
    // Allow the request to override the forwarded payload (so we can iterate on a
    // service's expected body schema without redeploying).
    const overridePayload = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
      ? req.body
      : target.payload;
    const result = await callAlgorandX402Service({
      serviceUrl: target.url,
      method: target.method,
      payload: overridePayload,
      maxAmountUSDC: target.maxUSDC,
      timeoutMs: 90000,
    });
    return res.status(result.success ? 200 : 502).json({
      ...result,
      target: key,
      processingTimeMs: Date.now() - startTime,
      note: 'Threshold-signed Algorand x402 payment to a third-party service',
    });
  } catch (error) {
    logError('X402-Native-ThirdParty', error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json(createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      'THIRDPARTY_FAILED',
    ));
  }
});

/**
 * Threshold-signed self-test: pay our OWN /ai/inference via ICP threshold sig.
 *
 * POST /api/sippar/x402-native/_selftest/inference?confirm=spend
 *
 * Diagnostic for the demo-critical path (agent pays an Algorand x402 service with
 * an ICP-distributed key). Spends real USDC (~$0.05) from the threshold reserve,
 * so it only runs with ?confirm=spend. NOT payment-protected (not in the x402
 * route config) but still behind the stealth gate. Reuses the request's own
 * X-Sippar-Access token to call back through the gate to /ai/inference.
 */
router.post('/_selftest/inference', x402AgentRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  if (req.query.confirm !== 'spend') {
    return res.status(400).json({
      success: false,
      error: 'Refusing to spend without ?confirm=spend',
      hint: 'This triggers a real ~$0.05 USDC threshold-signed payment on Algorand mainnet',
    });
  }

  const accessToken =
    (req.headers['x-sippar-access'] as string) || process.env.SIPPAR_ACCESS_TOKEN || '';
  const port = process.env.PORT || '3004';
  const selfUrl = `http://127.0.0.1:${port}/api/sippar/x402-native/ai/inference`;
  const prompt = (req.body && req.body.prompt) || 'Reply with one short sentence confirming you are reachable.';

  try {
    const result = await callAlgorandX402Service({
      serviceUrl: selfUrl,
      method: 'POST',
      payload: { prompt },
      extraHeaders: accessToken ? { 'X-Sippar-Access': accessToken } : {},
      maxAmountUSDC: 0.1,
      timeoutMs: 90000,
    });

    return res.status(result.success ? 200 : 502).json({
      ...result,
      processingTimeMs: Date.now() - startTime,
      note: 'Threshold-signed Algorand x402 payment to Sippar /ai/inference',
    });
  } catch (error) {
    logError('X402-Native-SelfTest', error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json(createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      'SELFTEST_FAILED',
    ));
  }
});

/**
 * Health check for x402 native endpoints
 *
 * GET /api/sippar/x402-native/health
 *
 * This endpoint is NOT protected by payment middleware.
 * Must remain free for monitoring and health checks.
 */
router.get('/health', (req: Request, res: Response) => {
  const config = getX402NativeConfig();

  // SECURITY: Only expose non-sensitive health info
  // Do NOT expose: facilitator URL (security hardening)
  res.status(200).json({
    success: true,
    status: 'healthy',
    protocol: 'x402-v2',
    implementation: 'x402-avm',
    version: '2.2.1',
    network: config.network,
    configured: config.configured,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Status/info endpoint for x402 native
 *
 * GET /api/sippar/x402-native/status
 *
 * Returns configuration and capability information.
 * NOT protected by payment middleware.
 */
router.get('/status', (req: Request, res: Response) => {
  const config = getX402NativeConfig();

  // SECURITY: Only expose non-sensitive configuration
  // Do NOT expose: facilitatorUrl, treasury addresses, ASA IDs
  res.status(200).json({
    success: true,
    x402Native: {
      enabled: config.configured,
      protocol: 'x402-v2',
      implementation: '@x402-avm/express',
      network: config.network,
      // Removed: facilitator URL and asset details (security hardening)
    },
    endpoints: {
      protected: [
        'POST /api/sippar/x402-native/ci-agents/:agent/:service',
        'POST /api/sippar/x402-native/ai/query',
        'POST /api/sippar/x402-native/ai/enhanced-query',
        'POST /api/sippar/x402-native/ai/inference',
      ],
      free: [
        'GET /api/sippar/x402-native/health',
        'GET /api/sippar/x402-native/status',
      ],
    },
    pricing: {
      'ci-agents': '$0.10 USDC',
      'ai/query': '$0.01 USDC',
      'ai/enhanced-query': '$0.05 USDC',
      'ai/inference': '$0.05 USDC',
    },
    documentation: 'https://docs.x402.org',
  });
});

export default router;
