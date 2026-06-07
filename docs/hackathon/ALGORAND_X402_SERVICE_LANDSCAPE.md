# Algorand x402 Service Landscape (research, 2026-06-06)

Research snapshot for the Algorand Builders Berlin x402 hackathon. Goal: know exactly
what paid x402 services exist *on Algorand* today, so the Sippar demo and pitch are
grounded in verifiable fact.

## TL;DR

- **The Algorand x402 service catalog is effectively empty.** The GoPlausible facilitator's
  Bazaar discovery endpoint returns **0 services** (verified `2026-06-06`).
- The only live Algorand x402 *endpoints* today are GoPlausible's own demo resources
  (`example.x402.goplausible.xyz/avm/weather`, `/avm/protected`, $0.001 each).
- **All third-party AI-inference x402 services settle on Base or Solana — none on Algorand.**
- **Featherless AI does not expose an x402 endpoint** (API-key, OpenAI-compatible). To demo
  "agent pays for Featherless inference, settled on Algorand," Sippar must *wrap* Featherless
  behind its own x402-native route. This is net-new work (see submission doc build task).
- Net effect: Sippar bringing real paid services + cross-chain volume onto Algorand x402 is a
  **genuine first-mover claim**, not marketing. The flip side is there is no third-party
  Algorand x402 service to demo against — the demo must use a Sippar-owned endpoint.

## GoPlausible facilitator (the Algorand x402 rail)

Base URL: `https://facilitator.goplausible.xyz` · docs at `/docs`

`GET /supported` (verified `2026-06-06`):
- **Networks**: Base (`eip155:8453` / `84532`), Solana (mainnet/devnet), **Algorand mainnet
  `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=`**, Algorand testnet
  `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=`.
- **Scheme**: `exact` · **x402 versions**: v1 + v2.
- **Algorand settlement signer**: `ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA`.
- Sippar's configured mainnet CAIP-2 ID **matches exactly** — no drift.

`GET /discovery/resources` (Bazaar): `{"x402Version":2,"items":[],"pagination":{"total":0}}`
→ **no services registered.**

## Live Algorand x402 endpoints found

| Service | Endpoint | Network | Price | Notes |
|---------|----------|---------|-------|-------|
| GoPlausible demo — weather | `example.x402.goplausible.xyz/avm/weather` | algorand-mainnet | $0.001 | Reference/toy |
| GoPlausible demo — protected | `example.x402.goplausible.xyz/avm/protected` | algorand-mainnet | $0.001 | Reference/toy |
| **Sippar CI agents** | `sippar.network/api/sippar/x402-native/ci-agents/:agent/:service` | `algorand:wGHE2…` | $0.10 | Live; routes to CI agents (early-stage) |
| **Sippar AI query** | `sippar.network/api/sippar/x402-native/ai/query` | `algorand:wGHE2…` | $0.01 | Live |
| **Sippar enhanced query** | `…/ai/enhanced-query` | `algorand:wGHE2…` | $0.05 | Live |

Sippar's three x402-native endpoints are, as of this research, **among the only non-demo paid
x402 services settling on Algorand.** They currently serve Sippar CI agents — not Featherless.

## AI-inference x402 services (all off-Algorand)

From the `awesome-x402` index — relevant because they are exactly the services a cross-chain
relay can reach, and proof the inference market is on Base/Solana, not Algorand yet:

| Service | Settles on | What |
|---------|-----------|------|
| tx402.ai | Base | 20+ EU-hosted models (DeepSeek, Qwen, Llama, GLM, Mixtral) |
| GPU-Bridge | Base | 30-service GPU inference API |
| zeroreader x402 AI API | Base | 29 Cloudflare Workers AI models |
| Deepnets | Solana | 13+ token-intelligence endpoints |
| SwarmX | Solana | Multi-agent orchestration |

**Featherless AI**: serverless OSS inference, API-key auth, OpenAI-compatible at
`https://api.featherless.ai/v1`. **No x402 / HTTP 402 support.** Partner for AI hackathons
(serverless inference), not a native x402 endpoint.

## Other Algorand x402 ecosystem players

- **AlgoVoi** (`api1.ilovechicken.co.uk`) — competing multi-chain facilitator spanning EVM
  (Base, Tempo), SVM (Solana), AVM (Algorand, VOI), Stellar, Hedera on one endpoint; implements
  MPP and AP2. Closest landscape competitor to Sippar's multi-chain relay framing.
- **Akita wallet** — on-chain, plugin-based agentic payment wallet that can produce x402
  payment means via smart wallets (Algorand).
- **UltravioletDAO** — integrated Algorand x402 (facilitator + SDKs).
- Tooling: `@x402-avm/extensions` (npm), GoPlausible Algorand x402 docs, Algorand MCP server,
  Claude Code / OpenClaw plugins.

## Implications for the Sippar demo & pitch

1. **Pitch strength** — "Sippar brings the first real paid services + cross-chain volume to
   Algorand x402" is verifiably true (Bazaar empty; inference market lives on Base/Solana).
   Sippar's cross-chain relay reaching Base/Solana inference and settling on Algorand is the
   differentiator no other entrant has.
2. **Demo reality** — there is no third-party Algorand x402 service to call. The hero demo must
   use a **Sippar-owned** x402-native endpoint. To honor the Featherless partner narrative,
   build a thin x402-native route that, after Algorand payment, calls `api.featherless.ai/v1`
   with a Sippar-held key and returns the completion. Same middleware as the CI-agent routes;
   only the post-payment handler changes.
3. **EURQ** — facilitator accepts ASA payments under scheme `exact`; EURQ (`2768422954`) is a
   valid ASA, so a EUR-denominated x402 payment on the same rail is straightforward once the
   demo agent opts into the ASA.

## Sources

- [GoPlausible Algorand x402 integration](https://x402.goplausible.xyz/) · facilitator `https://facilitator.goplausible.xyz`
- [Algorand — x402 agentic commerce](https://algorand.co/agentic-commerce/x402) · [for developers](https://algorand.co/agentic-commerce/x402/developers)
- [Algorand Foundation: x402 fully supported (facilitator live, Bazaar running)](https://x.com/AlgoFoundation/status/2022000856015811027)
- [x402 Bazaar discovery layer](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)
- [awesome-x402 (xpaysh)](https://github.com/xpaysh/awesome-x402)
- [Featherless getting started](https://featherless.ai/docs/getting-started) (API-key, OpenAI-compatible; no x402)
- Live checks `2026-06-06`: `facilitator.goplausible.xyz/supported` and `/discovery/resources`
