# Sippar — Pitch Deck
### Algorand Builders Berlin · Agentic Commerce x402 Hackathon

---

## 1 · Sippar — the payment highway for AI agents

**Pay any Algorand x402 service from any chain, via ICP threshold signatures.**

No bridge. No custodian. No seed phrase.

*Track 1 — Agentic Commerce · Existing Project · Quantoz EURQ bonus*

---

## 2 · The problem: agents can't pay across chains

- An AI agent can only pay for a service on the chain where it already holds funds.
- **Nobody can pay an Algorand x402 service without first holding Algorand assets** — a hard wall for cross-chain agent commerce.
- Cross-chain settlement is the industry's unsolved problem — Coinbase CDP, Circle Agent Stack, and AWS AgentCore all settle single-chain.

---

## 3 · The solution: Sippar settles on Algorand for any-chain agents

- The agent pays on **its home chain**; Sippar pays the service **natively on Algorand** via x402.
- **ICP threshold signatures sign the Algorand transaction directly** — no private key exists, no custodian, no bridge.
- Closes the loop the other way too: a verified Algorand payment fires a tamper-proof, ICP-signed webhook (Agency API).

---

## 4 · Proven live on Algorand mainnet

| Proof | Transaction |
|---|---|
| Threshold-paid a **real third-party** Algorand x402 service (Carbon & Cashmere) — got a live result | `RKGSX6MB…WH4EAA` |
| Threshold-paid our own AI inference (Featherless) | `35EJIH6M…RF2Q` |
| First **VERIFIED** Algorand x402 service on the Sippar Marketplace | — |

Also live: x402 on **10 chains** + cross-chain relay · 4 production ICP canisters · GoPlausible facilitator (`algorand:wGHE2…it8=`).

---

## 5 · Quantoz EURQ — wired & verifiable (bonus)

- `/ai/inference` advertises **EURQ** (ASA `2768422954`, €0.05) alongside USDC in its live 402.
- Settlement reserve **opted into the EURQ ASA on-chain** — tx `KGL55F3I…74Q2QA`.
- A live EUR payment settles via the **identical proven threshold flow**; only token funding is pending (2-day exchange hold).
- **Ask Quantoz:** a redemption relationship turns EURQ into a two-way agentic-payment rail.

---

## 6 · Algorand becomes the settlement hub for every agent

- Brings the **first real paid-service volume** onto Algorand x402 (the public catalog was empty).
- Non-custodial cross-chain settlement into Algorand — **which no other entrant has**.
- **Live on mainnet today.**

`github.com/Nuru-AI/sippar-algorand-x402` · `sippar.network`
