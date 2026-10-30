# Bitgold Network — Network and RPC Reference

Bitgold Network is an EVM-compatible Layer 1 with two live networks: mainnet (chain ID 618) and testnet (chain ID 617). This file covers chain identity, consensus and fee behaviour, every published RPC endpoint, the canonical chain-parameter blocks for wallets, and copy-paste smoke tests. Chain parameters and endpoint responses were re-checked against the live networks on 2026-10-30; where the docs and the live chain disagree, the live value is given and the difference is noted.

## What Bitgold Network is

| Property | Value |
| --- | --- |
| Execution layer | EVM, fully compatible with Solidity, Ethereum SDKs and standard tooling |
| Consensus | Proof of Staked Authority (PoSA): elected validators produce blocks in rotation |
| Validator set | Split into Cabinet (highest stake) and Candidate roles; elected by stake |
| Block time | Roughly one second (live measurement: 11 blocks in 10 s) |
| Finality | Fast finality once two-thirds of validators vote; otherwise probabilistic, deepening with confirmations |
| Native asset | BTG — pays gas, bonds stake, carries governance weight |
| Supply | Fixed at 200,000,000 BTG, 18 decimals, no block subsidy |
| Validator reward | Transaction fees only, shared with delegators by commission rate |
| Client | Geth-compatible; forked from the BSC v1.8.1 codebase and continues to follow upstream |

Because execution is the EVM, `eth_call`, `eth_getLogs`, `eth_getStorageAt` and contract deployment behave as on any EVM chain. The differences that matter for integration are the chain IDs, the fee market (see below), and the Bitgold-specific finality and blob extensions.

Fast finality is exposed through the standard `finalized` block tag. For flows that must not be reorged, pass `"finalized"` to methods such as `eth_getBlockByNumber` instead of `"latest"`.

## Bitgold Network vs Bitgold Next

These are separate chains with separate parameters. "Bitgold Next" is a latency-first design in devnet; it is not mainnet or testnet and must not be used for production integration.

| | Bitgold Network | Bitgold Next |
| --- | --- | --- |
| Status | Live mainnet + testnet | Multi-validator devnet; public testnet and mainnet still ahead |
| Chain ID | 618 (mainnet), 617 (testnet) | Not 618 or 617 — do not reuse these IDs |
| Block interval | ~1 s | 200 ms target |
| Finality | Fast finality on 2/3 validator votes | Sub-second BLS fast finality; ~20 ms pre-confirmations |
| Execution | EVM (Geth-compatible) | EVM on a different client stack |
| `eth_getProof` | Standard Geth surface | Unsupported |
| EIP-4844 blobs | Supported | Not supported |
| Gas asset | BTG | BTG bridged from Bitgold Network |

Rule of thumb: if a guide mentions `newl1_*` methods, sub-blocks, or a 200 ms block interval, it is about Bitgold Next and does not apply to chain 618.

## Mainnet vs testnet

| Field | Mainnet | Testnet |
| --- | --- | --- |
| Network name | Bitgold Mainnet | Bitgold Testnet |
| Chain ID (decimal) | 618 | 617 |
| Chain ID (hex) | 0x26A | 0x269 |
| Native coin | Bitgold (BTG) | tBitgold (tBTG) |
| Decimals | 18 | 18 |
| Supply | 200,000,000 BTG | 200,000,000 tBTG |
| RPC | https://rpc.bitgold.network | https://testnet1.bitgold.network |
| Explorer | https://www.bitgold.live | https://testnet.bitgold.live |
| Faucet | None | https://faucet.bitgold.network |
| `net_version` | 618 | 617 |

Testnet tBTG has no monetary value. Mainnet BTG is the only asset with market value; never send mainnet funds to a testnet flow.

## RPC endpoints

`rpc.bitgold.network` is the primary endpoint for wallets, dApps and CI; numbered and region hosts are fallbacks. Every host serves the same chain, so identify a host with `eth_chainId`, never by its name.

| Endpoint | Network | Role | Verified reachable (2026-10-30) |
| --- | --- | --- | --- |
| `https://rpc.bitgold.network` | Mainnet | Primary, load-balanced | Yes — `0x26a` |
| `https://mainnet1.bitgold.network` | Mainnet | Fallback backend | Yes — `0x26a` |
| `https://mainnet2.bitgold.network` | Mainnet | Fallback backend | Yes — `0x26a` |
| `https://mainnet3.bitgold.network` | Mainnet | Fallback backend | Yes — `0x26a` |
| `https://mainnet4.bitgold.network` | Mainnet | Fallback backend | Yes — `0x26a` |
| `https://mainnet5.bitgold.network` | Mainnet | Fallback backend | Yes — `0x26a` |
| `https://mainnet6.bitgold.network` | Mainnet | Documented backend | No — DNS NXDOMAIN |
| `https://mainnet-jp.bitgold.network` | Mainnet | Region fallback, Japan | Yes — `0x26a` |
| `https://mainnet-sg.bitgold.network` | Mainnet | Region fallback, Singapore | Yes — `0x26a` |
| `https://testnet1.bitgold.network` | Testnet | Primary testnet | Yes — `0x269` |
| `https://testnet2.bitgold.network` | Testnet | Documented backend | No — DNS NXDOMAIN |
| `https://testnet3.bitgold.network` | Testnet | Documented backend | No — DNS NXDOMAIN |

`mainnet6`, `testnet2` and `testnet3` are documented but not resolving at time of writing — expect them to come online; do not build hard dependencies on them. Never present an unresolvable host as a working default: mainnet defaults to `rpc.bitgold.network`, testnet to `testnet1.bitgold.network`, and the region hosts (`mainnet-jp`, `mainnet-sg`) are latency fallbacks for APAC traffic, not replacements for the primary.

DNS records and listeners change without notice, so verify with `eth_chainId` before use and keep at least two working hosts configured. Mainnet must answer `0x26a`, testnet `0x269`; any other value means the host is stale, misconfigured, or fronting a different chain.

Every endpoint accepts both HTTP and WebSocket JSON-RPC. The WebSocket form uses the same hostname with the `wss://` scheme and **no path suffix**: `wss://rpc.bitgold.network` works, `wss://rpc.bitgold.network/ws` fails the handshake. Subscriptions are WebSocket-only — `eth_subscribe` sent over HTTPS POST returns `-32601 notifications not supported`.

### Connectivity limits

| Method | Observed limit | Workaround |
| --- | --- | --- |
| `eth_getLogs` | 5,000-block maximum range per call; wider spans fail with `-32602 exceed maximum block range 5000` | Paginate in windows of 5,000 blocks or fewer |
| `eth_subscribe` | HTTPS POST: rejected with `-32601 notifications not supported`. `wss://<host>` (root path): works, returns a subscription id | Use `wss://` for live heads/logs, or poll `eth_blockNumber` + `eth_getLogs` |
| `eth_chainId` | No practical limit | Call it once per host before trusting it |

A bounded window is the only form that works, so step the range instead of asking for the whole chain:

```bash
curl -s -X POST https://rpc.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getLogs","params":[{"fromBlock":"0x3c000","toBlock":"0x3cfff","address":"0xTokenContractAddress"}],"id":1}'
```

## Chain parameters for wallets

These are the canonical fields for `wallet_addEthereumChain` (and for a manual add in any EVM wallet). Mainnet:

```json
{
  "chainId": "0x26A",
  "chainName": "Bitgold Mainnet",
  "rpcUrls": ["https://rpc.bitgold.network"],
  "nativeCurrency": {
    "name": "Bitgold",
    "symbol": "BTG",
    "decimals": 18
  },
  "blockExplorerUrls": ["https://www.bitgold.live"]
}
```

Testnet:

```json
{
  "chainId": "0x269",
  "chainName": "Bitgold Testnet",
  "rpcUrls": ["https://testnet1.bitgold.network"],
  "nativeCurrency": {
    "name": "tBitgold",
    "symbol": "tBTG",
    "decimals": 18
  },
  "blockExplorerUrls": ["https://testnet.bitgold.live"]
}
```

`chainId` is hex in this payload, decimal 618 and 617 elsewhere. `eth_chainId` returns lowercase (`0x26a`, `0x269`); comparisons should be case-insensitive. Add extra hosts to `rpcUrls` if you want the wallet to fail over, and keep the explorer URL because wallets use it for the "view on explorer" link.

## Smoke test

Mainnet, chain ID and head:

```bash
curl -s -X POST https://rpc.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

curl -s -X POST https://rpc.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Testnet, same two calls:

```bash
curl -s -X POST https://testnet1.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

curl -s -X POST https://testnet1.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Expected shape, one response per call (values move):

```text
{"jsonrpc":"2.0","id":1,"result":"0x26a"}
{"jsonrpc":"2.0","id":1,"result":"0x3c3fb"}
```

If `eth_chainId` returns `0x26a` you are on mainnet; `0x269` means testnet. A block number that stops advancing while a public explorer keeps advancing points at your endpoint, not the chain.

## Live chain parameters

Measured against `https://rpc.bitgold.network` and `https://testnet1.bitgold.network` on 2026-10-30.

| Parameter | Value | How observed |
| --- | --- | --- |
| Client version | `Geth/v1.8.1-46e00601-20261026/linux-amd64/go1.25.10` | `web3_clientVersion` |
| Block time | ~1 s | 11 blocks over a 10 s sample; docs say "roughly every second" |
| Block gas limit | 7,000,000,000 | `gasLimit` = `0x1a13b8600` |
| Base fee | 0 | `baseFeePerGas` = `0x0` |
| Gas price | 5 gwei | `eth_gasPrice` = `0x12a05f200` |
| Priority fee | 5 gwei | `eth_maxPriorityFeePerGas` = `0x12a05f200` |
| Transaction pricing | Zero base fee, no burn | `baseFeePerGas` = `0x0` on every block |

EIP-1559 is active but neutralised: the header carries `baseFeePerGas` and it is always `0x0`, so nothing is burned and the whole fee reaches the validator. In practice a **legacy type-0 transaction with an explicit `gasPrice`** is the simplest correct choice, and a type-2 transaction whose `maxFeePerGas` and `maxPriorityFeePerGas` both come from `eth_gasPrice` is equally valid. Do not hardcode 5 gwei — read it at send time. The gas *limit* above is per block, not per transaction; a normal transfer needs 21,000 gas.

The docs describe fees only qualitatively ("low fees", gas paid in BTG) and publish no gas price, gas limit or base-fee figure, so treat the numbers above as measured state rather than documented constants.

## Explorers, app and brand assets

| Resource | URL |
| --- | --- |
| Mainnet explorer | https://www.bitgold.live |
| Testnet explorer | https://testnet.bitgold.live |
| App (staking, validators, ecosystem) | https://app.bitgold.network |
| Validator list | https://app.bitgold.network/staking/validators |
| Testnet faucet | https://faucet.bitgold.network |
| Brand icon (256 px) | https://cdn.bitgold.network/images/brand/bitgold_icon_256.png |
| Favicon | https://cdn.bitgold.network/images/brand/favicon.png |
| Source organisation | https://github.com/bitgold-network |

## Read next

- [./wallets-and-faucet.md](./wallets-and-faucet.md) — add the network to MetaMask or Trust Wallet, claim tBTG, fix missing balances.
- [./evm-development.md](./evm-development.md) — deploy and interact with contracts using standard EVM tooling.
- [./json-rpc.md](./json-rpc.md) — method-level reference, finality and blob extensions.
- [./node-operations.md](./node-operations.md) — run a full node or validator, snapshots and monitoring.

## Sources

- https://docs.bitgold.network/bitgold-network/overview/
- https://docs.bitgold.network/bitgold-network/introduction/
- https://docs.bitgold.network/bitgold-network/developers/json_rpc/json-rpc-endpoint/
- https://docs.bitgold.network/bitgold-network/faq/
- https://docs.bitgold.network/bitgold-network/benchmark/design-reference/
- https://docs.bitgold.network/bitgold-next/overview/
