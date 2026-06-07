# @sippar/plugin-x402-algorand

ElizaOS plugin for x402 payments on Algorand via GoPlausible facilitator.

## Features

- **Automatic 402 handling**: Intercepts HTTP 402 responses, signs payment, retries
- **Multi-stablecoin allowlist**: USDC by default, plus opt-in ASAs (Quantoz EURQ/USDQ) via `allowedAssetIds`
- **SSRF protection**: Domain allowlisting, private IP blocking
- **Response limits**: Configurable max response size (default 4MB)

## Installation

```bash
npm install @sippar/plugin-x402-algorand
```

## Quick Start

```typescript
import { Agent } from '@elizaos/core';
import { x402AlgorandPlugin } from '@sippar/plugin-x402-algorand';

const agent = new Agent({
  plugins: [x402AlgorandPlugin],
  settings: {
    secrets: {
      ALGORAND_PRIVATE_KEY: 'your-25-word-mnemonic-or-base64-key'
    },
    x402_algorand: {
      allowedDomains: ['sippar.network', 'nuru.network']
    }
  }
});
```

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ALGORAND_PRIVATE_KEY` | string | required | 25-word mnemonic or base64 secret key |
| `facilitatorUrl` | string | `https://goplausible.com/verify` | GoPlausible facilitator endpoint |
| `allowedDomains` | string[] | `[]` | Domains allowed for x402 payments |
| `usdcAssetId` | number | `31566704` | USDC asset ID on Algorand |
| `allowedAssetIds` | number[] | `[]` | Additional accepted ASA IDs beyond USDC (e.g. Quantoz EURQ) |
| `algodUrl` | string | `https://mainnet-api.algonode.cloud` | Algod API endpoint |
| `maxResponseSize` | number | `4194304` | Max response size (4MB) |
| `timeout` | number | `30000` | Request timeout in ms |

### Multi-stablecoin payments (USDC + EURQ)

By default only USDC (`31566704`) is accepted. To accept additional stablecoins —
for example **Quantoz EURQ**, the MiCA-compliant euro e-money token on Algorand —
add their verified ASA IDs to `allowedAssetIds`:

```typescript
x402_algorand: {
  allowedDomains: ['sippar.network'],
  usdcAssetId: 31566704,
  allowedAssetIds: [2768422954], // Quantoz EURQ (mainnet ASA)
}
```

The registry in `src/assets.ts` (`ALGORAND_MAINNET_STABLECOINS`) tracks known
stablecoins with verified mainnet ASA IDs — USDC (`31566704`), Quantoz EURQ
(`2768422954`) and USDQ (`2768603795`). Unset/`<= 0` entries are always rejected,
so unverified placeholders never pass.

## Actions

### `x402_pay_algorand`

Make an x402 payment request to an Algorand-enabled service.

```typescript
const result = await agent.execute('x402_pay_algorand', {
  url: 'https://sippar.network/api/sippar/x402-native/ci-agents/developer/code-generation',
  method: 'POST',
  body: JSON.stringify({ prompt: 'Write a function...' })
});
```

### `x402_get_wallet`

Get the Algorand wallet address used for payments.

```typescript
const { address } = await agent.execute('x402_get_wallet', {});
console.log(`Wallet: ${address}`);
```

## Security

### SSRF Protection

Configure `allowedDomains` to restrict which services can receive payments:

```typescript
{
  x402_algorand: {
    allowedDomains: ['sippar.network', 'trusted-service.com']
  }
}
```

Without configuration, all HTTPS domains are allowed (warning logged).

### Blocked IPs

The plugin automatically blocks:
- `127.x.x.x`, `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`
- IPv6 loopback (`::1`) and link-local (`fe80::`)
- IPv6-mapped IPv4 addresses (`::ffff:127.0.0.1`)

### Token Whitelist

USDC (asset ID `31566704`) and native ALGO are accepted by default. Additional
stablecoin ASAs — e.g. Quantoz EURQ (`2768422954`) / USDQ (`2768603795`) — are
accepted only when explicitly added to `allowedAssetIds`. Unset/`<= 0` IDs are
always rejected.

## Programmatic Usage

```typescript
import { createSigner, createX402Fetch } from '@sippar/plugin-x402-algorand';

const signer = createSigner(process.env.ALGORAND_PRIVATE_KEY!);
const x402Fetch = createX402Fetch(signer, {
  facilitatorUrl: 'https://goplausible.com/verify',
  allowedDomains: ['sippar.network'],
  usdcAssetId: 31566704,
  algodUrl: 'https://mainnet-api.algonode.cloud',
  algodToken: '',
  maxResponseSize: 4 * 1024 * 1024,
  timeout: 30000,
});

// Automatically handles 402 responses
const response = await x402Fetch('https://sippar.network/api/sippar/x402-native/ci-agents/developer');
const data = await response.json();
```

## License

MIT
