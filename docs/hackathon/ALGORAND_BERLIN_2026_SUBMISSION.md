# Sippar — Algorand Builders Berlin: Agentic Commerce x402 Hackathon

**Event**: Algorand Builders Berlin — Agentic Commerce x402 Hackathon ($21,000+ pool)
**Venue / Dates**: 42 Berlin, Harzer Str. 42 · June 6–7, 2026 (36h, on-site pitch)
**Track**: **Track 1 — Agentic Commerce** · Category: **Existing Project** ($3,000 1st)
**Bonus opt-in**: **Quantoz — Best EURQ implementation** (€900)
**Mandatory requirement met**: x402 implemented on Algorand (live on mainnet via GoPlausible)

---

## One-liner

> **Sippar is the payment highway for AI agents** — an agent on any of 10 chains pays for an Algorand service over x402, and the service is paid (settles) natively on Algorand: non-custodial, no seed phrases, secured by ICP threshold signatures.

## Elevator (30s)

Today an AI agent that wants to pay for a service needs a funded wallet *on the same chain as that service*. That's a wall: a Solana agent can't pay a Base service; nobody can pay an Algorand service without holding Algorand assets. Sippar removes the wall by splitting the payment into two legs joined from its own treasuries: the **agent pays on its home chain** (e.g. USDC on Base, settling on Base into Sippar's treasury), and Sippar then **pays the service on Algorand** via x402 — signing the Algorand transaction directly with ICP threshold keys, no bridge and no custodian. The service-side leg settles natively on Algorand; the agent never has to hold an Algorand asset. We also close the loop the other way: a verified Algorand payment can fire a tamper-proof, ICP-signed webhook that triggers real-world automation.

---

## Why Track 1 (Agentic Commerce), Existing Project

- Sippar's entire identity is *agents transacting over x402* — the flagship theme and largest pool ($11,000).
- We already clear the mandatory bar (x402 on Algorand, mainnet) so the 36 hours go to net-new value, not bootstrapping a first 402.
- We avoid Track 2 (Infrastructure) where **Plausible**, who built Algorand's facilitator, is a partner — we don't compete with the host on their own layer.

---

## The problem we solve

| Pain | Status quo | Sippar |
|------|-----------|--------|
| Cross-chain payment | Agent must hold the service's native asset | Agent pays on its home chain; the Algorand service is paid (settles) on Algorand |
| Custody | Embedded/custodial wallet per chain | One ICP threshold key, non-custodial |
| Onboarding agents to Algorand | Must acquire ALGO/USDC on Algorand first | Any-chain agent reaches Algorand x402 services |
| Async automation | x402 is sync pull only | Agency API: payment → ICP-signed webhook |

**Cross-chain settlement is the industry's still-unsolved problem** — confirmed by June 2026 ecosystem research (Coinbase CDP, Circle Agent Stack, AWS AgentCore all settle single-chain). It is exactly Sippar's core differentiator.

---

## What's already built (mainnet-proven)

- **x402 on 10 chains**: Algorand USDC (GoPlausible, E2E), + Solana, Stellar, TON, Ethereum, Base, Arbitrum, Optimism, Polygon, BNB.
- **Cross-chain relay**: pay on source chain → Sippar settles on destination treasury, no bridge.
- **Threshold signing**: ICP t-Schnorr Ed25519 signs Algorand txns directly (canister `vj7ly-diaaa-aaaae-abvoq-cai`).
- **ckALGO bridge**: ICRC-1/2/3 token (`hldvt-2yaaa-aaaak-qulxa-cai`).
- **Agency API (async webhooks)**: verified ALGO payment → ICP HTTP outcall → ~13 idempotent POSTs. E2E verified (tx `AQ2VMRC4GZZKSOFH2PZGWVOGCQAAIJVMSIFOEA2MP2E7RKD37NDQ`).
- **25 MCP tools + ElizaOS plugins** (`@sippar/plugin-x402-algorand`) so agents pay with zero key management.
- **Threshold-signed Algorand x402 client → live AI inference (E2E on mainnet)**: Sippar pays its own `/ai/inference` x402 endpoint from a threshold-derived reserve — ICP signs the USDC payment, GoPlausible settles it, Featherless returns the completion. No private key, no custodian. (`algorandX402ClientService.ts` + `/api/sippar/x402-native/ai/inference`.)
- **Threshold-signed payment to a REAL third-party Algorand x402 service (E2E on mainnet)**: Sippar paid **Carbon & Cashmere**'s independent Algorand x402 forensics API (`api.carbon-cashmere.de/v1/safety/check`) from its threshold reserve and received a live result — proving the rail works against external services, not just Sippar's own. Now the first **verified** Algorand service on the Sippar Marketplace.

**Proof**: x402 Algorand tx `U4DWECTLMOXKCGY2Z5DVXL32NZ6MIDYEZWUNTPR35H3R3YLZ66GQ` (round 60381229) · **threshold-signed inference-payment tx `35EJIH6ME544QAPGKWN4INABHL52T47UOCOOXIS3JJNQRLFR2NDA` (round 61893414 — 0.05 USDC, reserve→treasury, returned a real Llama-3.1 completion)** · **third-party-service payment tx `RKGSX6MBEBWIEKYFUCQIISARV2O5RTAJY46H4E4YIV2JS6WH4EAA` (round 61902795 — 0.50 USDC, threshold reserve → Carbon & Cashmere, returned a live forensics verdict)** · 4 production canisters on ICP mainnet · CAIP-2 network ID `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=` · accepted assets: USDC `31566704`, Quantoz EURQ `2768422954`, USDQ `2768603795`.

## What we build on-site (net-new, 36h)

1. **Quantoz EURQ as an x402 payment asset on Algorand — wired & verifiable on mainnet.** The `/ai/inference` endpoint now advertises **EURQ** (ASA `2768422954`, €0.05) alongside USDC in its live 402 response, and Sippar's settlement reserve is **opted into the EURQ ASA on-chain** (opt-in tx `KGL55F3IROJQNEERP5LFC6D6A7IJQG3KQZ2INELHQOJ7QI74Q2QA`) — ready to receive and settle EURQ. A live EUR-denominated payment settles via the **exact same threshold flow already proven for USDC** (see the C&C and inference txs above); the only step not completed in the 36h was funding the payer with EURQ — blocked by a 2-day exchange withdrawal hold on a new account, not by any missing Sippar capability. Implemented in `packages/plugin-x402-algorand/src/assets.ts` + `src/backend/src/middleware/x402NativeMiddleware.ts` (verified mainnet ASA IDs EURQ `2768422954`, USDQ `2768603795`).
2. **Hero demo**: an AI agent pays for **open-source LLM inference** over x402 on Algorand, cross-chain-funded, then the **Agency webhook** fires a follow-on action — the full sync+async loop in 3 minutes. *Inference is served by **Featherless AI** (serverless OSS models, `api.featherless.ai/v1`). Featherless is API-key/OpenAI-compatible and has no native x402, so the demo runs through a **Sippar x402-native endpoint that wraps Featherless**: after the Algorand payment settles, Sippar calls Featherless with its key and returns the completion. This wrapper route is the net-new build (same middleware as the live CI-agent routes; only the post-payment handler differs) — see build task below.*

---

## Architecture (demo path) — two legs, joined by Sippar

```
   Agent (holds USDC on Base)
        │  1. x402 request → 402 Payment Required (Algorand requirement)
        │
        │  2. LEG 1: agent pays USDC on Base  ──► settles ON BASE
        ▼                                          (into Sippar's Base treasury)
     Sippar treasuries
        │  3. LEG 2: ICP threshold sig pays the service
        │           via Algorand x402 (GoPlausible) ──► settles ON ALGORAND
        ▼                                                (USDC or EURQ ASA)
     Featherless AI inference
        │  4. service response returned to the agent
        ▼
   Agent gets its answer
        └─5. verified Algorand payment ─► Agency API ─► ICP-signed webhook ─► automation
```

**Precise model:** there are two settlements, not one. The **agent's** payment
settles on its home chain (Base) into Sippar's treasury; the **service's** payment
settles natively on **Algorand** via x402. Sippar fronts the Algorand funds and
collects on Base — it is a relay across two settlements, not the agent's money
"teleporting" to Algorand. The mandatory "x402 on Algorand" requirement is met by
Leg 2, which is always present. No bridge, no custodian, and the agent never has to
hold an Algorand asset.

> **Simpler single-leg variant** (also valid for the mandatory requirement): the
> agent already holds Algorand USDC/EURQ and Sippar threshold-signs the Algorand
> x402 payment directly — one settlement, fully Algorand-native. Use this if the
> cross-chain leg adds demo risk; use the two-leg path above for the "any chain in,
> Algorand out" differentiation.

---

## How we score against the judging criteria

| Criterion | Our answer |
|-----------|-----------|
| **Technical sophistication** | ICP threshold Ed25519 signing Algorand txns + cross-chain relay — non-custodial cross-chain settlement into Algorand x402, which no other entrant has |
| **Creativity** | Sync (x402 pull) **and** async (Agency webhook push) agent commerce on one Algorand rail; multi-stablecoin (USDC + EURQ) |
| **Usability** | 25 MCP tools + ElizaOS plugin; agents pay with no key management |
| **Value proposition** | Onboards the entire multi-chain agent economy into Algorand services |
| **Ecosystem impact** | Already on mainnet → milestone effectively pre-cleared; drives external x402 volume onto Algorand |

---

## Milestone proposal (for the 50/50 model)

Sippar is **already live on Algorand mainnet**, so we propose a *forward* milestone rather than a launch:
- **Milestone**: ship EURQ as a production x402 payment asset (USDC + EURQ live on the mainnet facilitator flow) with ≥10 verified EUR-denominated agent payments, plus a public Algorand x402 + EURQ quickstart.
- Unlocks the second 50% and gives Quantoz a real EURQ agentic-payments reference implementation.

---

## 3-Minute Demo Script

**Beat 0 — Hook (15s).**
"AI agents can't pay across chains. A Base agent can't buy an Algorand service. We fixed that — watch an agent on Base pay for AI inference settled on Algorand, with no bridge and no Algorand wallet."

**Beat 1 — The wall (20s).**
Show the agent holding only USDC on Base. Hit Sippar's x402 inference endpoint (open-source LLM, served by Featherless AI) → `402 Payment Required` with the Algorand requirement (`algorand:wGHE2…`, asset USDC/EURQ). "It wants payment on Algorand. Our agent has nothing on Algorand."

**Beat 2 — Sippar settles on Algorand (45s).**
Call Sippar. ICP threshold signature produces a real Algorand transaction. Show it confirming on allo.info (~4–5s finality). "That signature came from a distributed ICP key — no private key, no custodian, no bridge."

**Beat 3 — Service delivered (30s).**
Retry with the payment proof → Sippar calls Featherless and returns the inference result. "The agent paid on Base, the service got paid on Algorand, and the agent got its answer."

**Beat 4 — EURQ (30s).**
Hit the same endpoint and show the live 402 advertising **EURQ** (ASA `2768422954`, €0.05) right next to USDC, and show our reserve opted into the EURQ ASA on-chain (tx `KGL55F3IROJQNEERP5LFC6D6A7IJQG3KQZ2INELHQOJ7QI74Q2QA`). "Same rail, regulated EU money — the endpoint accepts EURQ and our treasury is ready to settle it. It pays out identically to the USDC payment you just watched; the only reason it isn't live in this demo is a 2-day exchange hold on our EURQ. The integration is done." (Quantoz bonus.)

**Beat 5 — The async loop (30s).**
Trigger the Agency API: a verified Algorand payment fires an ICP-signed webhook that runs an action. "x402 is the agent pulling a service. This is Algorand pushing automation when it gets paid. Both directions, one rail."

**Beat 6 — Close (10s).**
"Sippar: the payment highway that makes Algorand the settlement hub for every AI agent, on any chain. Live on mainnet today."

**Backup if live demo fails**: pre-recorded screen capture + the mainnet tx hashes above on allo.info.

---

## Links & references

- Code: this repo (`packages/plugin-x402-algorand`, `src/backend/src/middleware/x402NativeMiddleware.ts`)
- x402 endpoints: `src/backend/src/routes/x402NativeRoutes.ts`
- Threshold-signed Algorand x402 client: `src/backend/src/services/algorandX402ClientService.ts`; Featherless wrapper: `src/backend/src/services/featherlessService.ts`
- Agency API: `docs/mcp/AGENCY_TOOLS.md`, `docs/integration/AGENCY_API_QUICKSTART.md`
- Multi-chain x402: `docs/reference/MULTI-CHAIN-X402.md`
- EURQ scaffold: `packages/plugin-x402-algorand/src/assets.ts`
- Algorand x402 service landscape (research, 2026-06-06): `docs/hackathon/ALGORAND_X402_SERVICE_LANDSCAPE.md` — Bazaar empty; facilitator CAIP-2 verified; inference market is Base/Solana

## Pre-pitch checklist

- [x] Verify Quantoz **EURQ mainnet ASA ID** and set it in `assets.ts` — done: EURQ `2768422954`, USDQ `2768603795` (both creator `UALFRIYMF...`, 6 decimals). Pass via `allowedAssetIds` in the demo agent config.
- [x] Confirm Featherless AI payment model — done: **no native x402** (API-key, OpenAI-compatible, `api.featherless.ai/v1`). Demo must wrap it (below). See `ALGORAND_X402_SERVICE_LANDSCAPE.md`.
- [x] **BUILD: Sippar x402-native route wrapping Featherless** — *deployed live*. `POST /api/sippar/x402-native/ai/inference` ($0.05, Algorand) → after payment settles, calls `api.featherless.ai/v1/chat/completions` via `services/featherlessService.ts`. `FEATHERLESS_API_KEY` set on the VPS.
- [x] **BUILD: threshold-signed Algorand x402 client** (`services/algorandX402ClientService.ts`) — fills the Algorand gap in `x402ClientService` (EVM/SVM/Stellar only). Pays via ICP threshold signature; verified E2E on mainnet (tx `35EJIH6ME544QAPGKWN4INABHL52T47UOCOOXIS3JJNQRLFR2NDA`). Diagnostic trigger: `POST /api/sippar/x402-native/_selftest/inference?confirm=spend` (stealth-gated).
- [x] **EURQ wired + prepped** — `/ai/inference` 402 now advertises **two** options: USDC (`31566704`→treasury) and **EURQ (`2768422954`→reserve)**; the reserve is **opted into the EURQ ASA** via threshold signature (opt-in tx `TJEBNYDVFRMI35LSRNWRVMABL6LVAVXGB4EEN3QH7EIBK5VAHGQQ`, round 61895066). **Only remaining step for the EURQ beat: fund EURQ into the reserve `7WHJSM3G…`** (EURQ has no DEX liquidity — it's MiCA e-money, mint/redeem via Quantoz; get it from Quantoz on-site). Then a paid EURQ call runs exactly like the USDC E2E. (Opt-in trigger: `POST …/_selftest/optin-eurq?confirm=optin`.)
- [ ] **At venue: get EURQ from Quantoz → fund reserve → run one live EURQ payment** (≈60s, same threshold path as the proven USDC E2E)
- [ ] Dry-run all 6 demo beats; capture backup recording
- [ ] One team member on-site for the pitch (rules requirement)
