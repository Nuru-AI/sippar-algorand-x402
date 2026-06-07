# Backend reference excerpts

These are **excerpts** from Sippar's production backend (which is private), included so hackathon judges can read the code behind the on-chain proofs. They are **not standalone** — they import internal Sippar services (ICP canister client, rate limiters, error sanitizers) and won't compile on their own. No secrets are present; credentials are read from environment variables at runtime.

| File | What it does |
|------|--------------|
| `algorandX402ClientService.ts` | Pays an Algorand x402 "exact" service from a Sippar threshold-derived address, signing the payment with an ICP threshold signature (no private key). Includes a normalizer for V1/body-format 402s. |
| `featherlessService.ts` | Thin OpenAI-compatible client for Featherless AI inference, invoked after an Algorand x402 payment settles. |
| `x402NativeMiddleware.ts` | `@x402-avm/express` route config — advertises USDC **and** Quantoz EURQ on the Algorand mainnet x402 endpoints. |
| `x402NativeRoutes.ts` | Route handlers for the x402-native endpoints (CI agents, AI query, Featherless inference) + threshold-payment diagnostics. |
