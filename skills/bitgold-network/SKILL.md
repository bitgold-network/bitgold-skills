---
name: bitgold-network
displayName: Bitgold Network
version: 1.0.0
description: Bitgold Network developer knowledge for AI coding agents. Bitgold is an EVM-compatible Layer 1 forked from the BSC v1.8.1 codebase — mainnet chain ID 618 (0x26A), testnet 617 (0x269), native coin BTG with a fixed 200,000,000 supply and 18 decimals. Covers network parameters and RPC endpoints, wallet configuration and the tBTG faucet, the JSON-RPC surface, Hardhat/Foundry/viem/ethers contract development and deployment, full/archive/fast node operation, BTG staking and delegation, the validator lifecycle, slashing and MEV, on-chain governance, the EOA paymaster, and the cross-chain bridge. Use whenever the user wants to connect to, query, deploy on, stake on, validate, run a node for, or troubleshoot Bitgold Network.
---

# Bitgold Network

Bitgold Network is a high-performance, EVM-compatible Layer 1 forked from the BSC v1.8.1 codebase. It keeps the Ethereum address format, the Solidity contract model, and the standard JSON-RPC surface, while producing a block roughly every second and settling gas in its native coin, **Bitgold (BTG)** — fixed supply 200,000,000, 18 decimals. Consensus is Proof of Staked Authority (PoSA): an elected validator set produces blocks and BTG holders delegate to it. Staking, the validator set, and protocol parameters are managed on chain.

Because the chain is EVM-equivalent, **no Bitgold-specific SDK is required**. Everything in this skill is standard Ethereum tooling pointed at a Bitgold endpoint, plus the network-specific parameters and operational details collected in `references/`.

## Network at a glance

| | **Mainnet** | **Testnet** |
|---|---|---|
| Network name | Bitgold Mainnet | Bitgold Testnet |
| Chain ID | `618` (`0x26A`) | `617` (`0x269`) |
| Native coin | Bitgold (BTG), 18 decimals | tBitgold (tBTG), 18 decimals |
| Supply | 200,000,000 BTG | 200,000,000 tBTG |
| RPC | `https://rpc.bitgold.network`, `https://mainnet1`–`mainnet6.bitgold.network`, `mainnet-jp`, `mainnet-sg` | `https://testnet1`–`testnet3.bitgold.network` |
| Explorer | `https://www.bitgold.live` | `https://testnet.bitgold.live` |
| Faucet | — | `https://faucet.bitgold.network` |
| Staking / validators | `https://app.bitgold.network/staking/validators` | — |

`mainnet6`, `testnet2` and `testnet3` are published in the docs but did not resolve in DNS when last checked — use `rpc.bitgold.network` and `testnet1.bitgold.network` as primaries.

Block gas limit is `7,000,000,000`, block time is about one second, and `baseFeePerGas` is `0x0` on every block. EIP-1559 is enabled but neutralised: the base fee is pinned at zero, nothing is burned, and the whole fee reaches the validator — so send **legacy type-0 transactions with an explicit `gasPrice`**. Full parameter detail lives in [references/network-and-rpc.md](references/network-and-rpc.md).

## Before you act

- **No install step.** There is no Bitgold CLI and no Bitgold MCP server to install. Use `curl`, `cast`, `viem`, `ethers`, Hardhat, or Foundry against the RPC endpoints.
- **Verify the chain before writing.** Call `eth_chainId` and require `0x26a` for mainnet or `0x269` for testnet. A mainnet/testnet mix-up is unrecoverable, so confirm the target network with the user rather than defaulting.
- **Read-only first.** `eth_chainId`, `eth_blockNumber`, `eth_getBalance`, `eth_call`, `eth_getLogs`, `eth_estimateGas` are safe. Anything that signs, broadcasts, stakes, delegates, or votes moves real value and needs explicit user confirmation of network, address, amount, and validator.
- **Never handle key material.** Do not ask the user to paste a seed phrase or private key into chat, and never write one into a file or an env var you create. Let the user sign in their wallet, a hardware device, or a local keystore they control.
- **Stale values are not facts.** Fees, minimum stake, slash penalties, and governance thresholds are on-chain values that change. Read them, or cite the docs you fetched, instead of recalling them.

## Decision tree — which reference to read next

References are plain markdown files installed beside this file in `references/`. When a row matches, **read that file before acting** — do not answer from memory.

| User intent | Read |
|---|---|
| Chain parameters, RPC endpoints, add-network JSON, connectivity checks | [references/network-and-rpc.md](references/network-and-rpc.md) |
| Add Bitgold to MetaMask/Trust Wallet, get tBTG, missing-token or wrong-chain recovery | [references/wallets-and-faucet.md](references/wallets-and-faucet.md) |
| Hardhat/Foundry/viem/ethers setup, deploy a contract, gas and fee handling, EVM differences | [references/evm-development.md](references/evm-development.md) |
| Which JSON-RPC methods exist, request/response shapes, error codes, endpoint health checks | [references/json-rpc.md](references/json-rpc.md) |
| Run a full, archive, fast, or boot node; snapshots, ports, monitoring, upgrades | [references/node-operations.md](references/node-operations.md) |
| Stake or delegate BTG, claim rewards, build a staking dApp | [references/staking-and-delegation.md](references/staking-and-delegation.md) |
| Create, run, secure, or monitor a validator; key management; EVN | [references/validators.md](references/validators.md) |
| Slashable offences and penalties, slash monitoring, MEV enablement and builder flow | [references/slashing-and-mev.md](references/slashing-and-mev.md) |
| Proposals, voting, temperature checks, governance APIs | [references/governance.md](references/governance.md) |
| Gas sponsorship through the EOA paymaster, cross-chain bridge routes and flows | [references/account-abstraction-and-bridge.md](references/account-abstraction-and-bridge.md) |

If two rows match, read both — they are written to be orthogonal.

## Non-negotiables

1. **Confirm the network before every write.** Testnet is `0x269`; mainnet is `0x26a`. Do not silently pick one.
2. **Send legacy transactions.** With `baseFeePerGas` at `0x0`, set an explicit `gasPrice` (about 5 gwei at time of writing). Do not build EIP-1559 `maxFeePerGas` logic on top of `eth_feeHistory` — it reports zero base fees.
3. **Use documented endpoints only.** The hosts in [references/network-and-rpc.md](references/network-and-rpc.md) are the complete list. Do not invent a host name. The WebSocket form is `wss://<host>` with no path suffix; `mainnet6`, `testnet2` and `testnet3` currently do not resolve.
4. **Keep Bitgold Network and Bitgold Next apart.** *Bitgold Next* is a separate in-development devnet documented at `docs.bitgold.network/bitgold-next/`. It is not mainnet and not testnet; never point production or tutorial configs at it.
5. **Amounts are wei at the RPC boundary.** BTG has 18 decimals; parse and format with `parseEther` / `formatEther` rather than string math.
6. **Cite what you read.** When you state a fee, penalty, minimum stake, or governance threshold, say where it came from — an on-chain call or a docs page. Never present a recalled number as current.

## Quick smoke test

```bash
RPC=https://rpc.bitgold.network

curl -s -X POST $RPC -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# {"jsonrpc":"2.0","id":1,"result":"0x26a"}

curl -s -X POST $RPC -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"eth_blockNumber","params":[]}'
```

For testnet, swap in `RPC=https://testnet1.bitgold.network` and expect `0x269`.

## Scope and status

This is a community skills package: it is not published or endorsed by the Bitgold core team, and it grants no special RPC access. Network behaviour, third-party endpoints (paymaster, bridge), and on-chain parameters can change without notice — the chain and the official docs at `docs.bitgold.network` are authoritative. Nothing here is financial, legal, or investment advice.

## Sources

- Bitgold docs home — https://docs.bitgold.network
- Network overview — https://docs.bitgold.network/bitgold-network/overview/
- Website — https://www.bitgold.network
- App (staking, validators) — https://app.bitgold.network
