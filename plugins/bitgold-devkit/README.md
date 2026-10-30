# Bitgold Devkit plugin

This plugin is a **generated snapshot**. Do not edit files under `plugins/bitgold-devkit/skills/` directly — edit `skills/bitgold-network/` at the repository root and run:

```bash
node scripts/build-plugin.mjs
```

Plugin version: `1.0.0`. It ships the `bitgold-network` skill and its `references/` playbooks. There is no runtime or CLI dependency: the skill drives standard JSON-RPC and ordinary Ethereum tooling, so installing the plugin never pulls an executable or asks for a wallet key.

`distribution.json` records the SHA-256 of every payload file plus a single payload digest. Native plugin clients do not verify this file; it exists so a reviewer can confirm that the published plugin matches the reviewed skill source. Any content change requires a new plugin version so installed clients receive the update.

Licensed under MIT; see [LICENSE](LICENSE). The hosting repository uses the same license for the rest of its content.

## Claude Code

```text
/plugin marketplace add bitgold-network/bitgold-skills
/plugin install bitgold-devkit@bitgold-skills
```

## Cursor

Open **Customize → Plugins**, select the Bitgold Network marketplace, and install **Bitgold Devkit**.

## Codex

```bash
codex plugin marketplace add bitgold-network/bitgold-skills
codex plugin add bitgold-devkit@bitgold-skills
```

Restart or open a new session after installation.

## Local testing before publication

```bash
claude plugin marketplace add /absolute/path/to/bitgold-skills
claude plugin install bitgold-devkit@bitgold-skills
```

```bash
codex plugin marketplace add /absolute/path/to/bitgold-skills
codex plugin add bitgold-devkit@bitgold-skills
```

## What it covers

| Reference | Content |
|---|---|
| `SKILL.md` | Entry point: network table, decision tree, safety rules, smoke test |
| `references/network-and-rpc.md` | Chain IDs, RPC endpoints, add-network JSON, connectivity checks |
| `references/wallets-and-faucet.md` | MetaMask/Trust setup, tBTG faucet, token recovery |
| `references/evm-development.md` | Hardhat, Foundry, viem, ethers, deployment, fees |
| `references/json-rpc.md` | Method inventory, examples, error codes |
| `references/node-operations.md` | Full, archive, fast, and boot nodes; snapshots; upgrades |
| `references/staking-and-delegation.md` | PoSA staking, delegation, staking dApps |
| `references/validators.md` | Create, run, secure, monitor a validator; EVN |
| `references/slashing-and-mev.md` | Slash rules, monitoring, MEV |
| `references/governance.md` | Proposals, voting, governance APIs |
| `references/account-abstraction-and-bridge.md` | EOA paymaster, cross-chain bridge |

This is a community package, not an official Bitgold release.
