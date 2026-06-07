/**
 * Featherless AI Service
 *
 * Thin client for Featherless AI serverless inference (open-source models).
 * Featherless is OpenAI-compatible and authenticates with an API key — it has
 * NO native x402. This service is invoked AFTER an x402 payment has already been
 * verified + settled on Algorand by the x402-native middleware, so that the
 * Sippar x402 endpoint can deliver the actual inference result.
 *
 * Flow: agent pays on Algorand (x402) → middleware settles → route handler calls
 * this service with Sippar's FEATHERLESS_API_KEY → completion returned to agent.
 *
 * Env:
 *   FEATHERLESS_API_KEY  (required to enable) — Sippar-held key
 *   FEATHERLESS_BASE_URL (default https://api.featherless.ai/v1)
 *   FEATHERLESS_MODEL    (default model when the request omits one)
 *   FEATHERLESS_TIMEOUT_MS (default 60000)
 */

const DEFAULT_BASE_URL = 'https://api.featherless.ai/v1';
// Featherless hosts thousands of OSS models; a small, broadly-available default.
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct';
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_PROMPT_CHARS = 16000;

export interface FeatherlessMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FeatherlessCompletionParams {
  /** Either provide `prompt` (wrapped as a single user message) or full `messages`. */
  prompt?: string;
  messages?: FeatherlessMessage[];
  /** Model id; falls back to FEATHERLESS_MODEL / DEFAULT_MODEL. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface FeatherlessCompletionResult {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function getConfig() {
  return {
    apiKey: process.env.FEATHERLESS_API_KEY,
    baseUrl: process.env.FEATHERLESS_BASE_URL || DEFAULT_BASE_URL,
    defaultModel: process.env.FEATHERLESS_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.FEATHERLESS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}

/** Whether the Featherless wrapper is configured (API key present). */
export function isFeatherlessConfigured(): boolean {
  return !!process.env.FEATHERLESS_API_KEY;
}

/**
 * Call Featherless chat completions (OpenAI-compatible) and return the text.
 * Throws on missing config, invalid input, timeout, or non-2xx upstream.
 */
export async function featherlessChatCompletion(
  params: FeatherlessCompletionParams
): Promise<FeatherlessCompletionResult> {
  const config = getConfig();
  if (!config.apiKey) {
    throw new Error('FEATHERLESS_API_KEY not configured');
  }

  // Build messages from either `messages` or `prompt`
  let messages: FeatherlessMessage[];
  if (Array.isArray(params.messages) && params.messages.length > 0) {
    messages = params.messages;
  } else if (typeof params.prompt === 'string' && params.prompt.trim().length > 0) {
    messages = [{ role: 'user', content: params.prompt }];
  } else {
    throw new Error('Provide a non-empty `prompt` or `messages`');
  }

  // Guard against oversized inputs
  const totalChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  if (totalChars > MAX_PROMPT_CHARS) {
    throw new Error(`Input too large (${totalChars} > ${MAX_PROMPT_CHARS} chars)`);
  }

  const model = params.model || config.defaultModel;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: params.maxTokens ?? 512,
        temperature: params.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Do not surface the upstream body verbatim to callers of this service;
      // the route layer sanitizes. Include status for server-side diagnosis.
      throw new Error(`Featherless upstream error ${response.status}: ${detail.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: FeatherlessCompletionResult['usage'];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Featherless returned no completion content');
    }

    return { content, model: data.model || model, usage: data.usage };
  } finally {
    clearTimeout(timer);
  }
}
