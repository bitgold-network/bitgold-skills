<p align="center">
  <img src="https://cdn.bitgold.network/images/brand/bitgold_icon_256.png" alt="Bitgold Network" width="96" height="96" />
</p>

# Bitgold Network Skills

> Agent skills and a marketplace plugin for building on [Bitgold Network](https://www.bitgold.network) — an EVM-compatible Layer 1.

## Introduction

Bitgold Network Skills teaches AI coding agents (Claude Code, Cursor, Codex) how to work with Bitgold Network without guessing: network parameters, RPC endpoints, wallet setup, the JSON-RPC surface, contract development, node operation, staking, validators, slashing, MEV, governance, the EOA paymaster, and the cross-chain bridge.

Bitgold is EVM-equivalent, so there is **nothing Bitgold-specific to install** — no CLI, no SDK, no MCP server. The skill supplies the parameters and procedures, and your agent drives standard Ethereum tooling (`curl`, `cast`, Hardhat, Foundry, viem, ethers) against a Bitgold endpoint.

| | **Mainnet** | **Testnet** |
|---|---|---|
| Network name | Bitgold Mainnet | Bitgold Testnet |
| Chain ID | `618` (`0x26A`) | `617` (`0x269`) |
| Native coin | Bitgold (BTG), 18 decimals | tBitgold (tBTG), 18 decimals |
| Supply | 200,000,000 BTG | 200,000,000 tBTG |
| RPC | `rpc.bitgold.network`, `mainnet1`–`mainnet6.bitgold.network`, `mainnet-jp`, `mainnet-sg` | `testnet1`–`testnet3.bitgold.network` |
| Explorer | [www.bitgold.live](https://www.bitgold.live) | [testnet.bitgold.live](https://testnet.bitgold.live) |
| Faucet | — | [faucet.bitgold.network](https://faucet.bitgold.network) |

## Marketplace plugin

| Plugin | Description |
|--------|-------------|
| **bitgold-devkit** | One installable plugin that ships the full `bitgold-network` skill: network, RPC, wallet, development, node, staking, validator, governance, paymaster, and bridge references. |

### Claude Code

```text
/plugin marketplace add bitgold-network/bitgold-skills
/plugin install bitgold-devkit@bitgold-skills
```

### Cursor

Open **Customize → Plugins**, select the Bitgold Network marketplace, and install **Bitgold Devkit**.

### Codex

```bash
codex plugin marketplace add bitgold-network/bitgold-skills
codex plugin add bitgold-devkit@bitgold-skills
```

Restart or open a new session after installing.

Locally, before the repository is reachable from your client, point the marketplace at a checkout instead:

```bash
claude plugin marketplace add /absolute/path/to/bitgold-skills
codex plugin marketplace add /absolute/path/to/bitgold-skills
```

The plugin is a versioned snapshot of `skills/bitgold-network`. See [`plugins/bitgold-devkit`](plugins/bitgold-devkit) for its version, payload checksums, and sync procedure.

## Standalone skills

The same skill can be installed directly, without registering a marketplace plugin.

| Skill | Description |
|-------|-------------|
| **bitgold-network** | Bitgold Network end-to-end: network and RPC, wallets and faucet, JSON-RPC, contract development, nodes, staking, validators, slashing and MEV, governance, paymaster and bridge. |

```bash
npx skills add bitgold-network/bitgold-skills --skill bitgold-network
```

Quick install (all skills in this repository):

```bash
npx skills add bitgold-network/bitgold-skills
```

Install globally (available across all projects):

```bash
npx skills add bitgold-network/bitgold-skills -g
```

### Manual install (Cursor / Claude Code)

Personal skill — available across all projects:

```bash
git clone https://github.com/bitgold-network/bitgold-skills.git
cp -r bitgold-skills/skills/* ~/.cursor/skills/
```

Project skill — current project only:

```bash
git clone https://github.com/bitgold-network/bitgold-skills.git
cp -r bitgold-skills/skills/* .cursor/skills/
```

For Claude Code, copy into `~/.claude/skills/` or `<project>/.claude/skills/` instead.

## Using the skill

Once installed, the agent picks the skill up when you ask it to:

- Add Bitgold mainnet or testnet to a wallet, or claim tBTG from the faucet
- Query blocks, transactions, balances, logs, or contracts over Bitgold JSON-RPC
- Deploy and interact with Solidity contracts using Hardhat, Foundry, viem, or ethers
- Run and monitor a full, archive, or fast node
- Stake or delegate BTG, or operate and secure a validator
- Understand slashable offences, MEV enablement, or governance proposals
- Sponsor gas through the EOA paymaster, or move assets over the bridge

Example prompts:

- "Add Bitgold testnet to MetaMask and get me some tBTG."
- "Write a Hardhat config for Bitgold mainnet and deploy this ERC-20."
- "Which JSON-RPC methods does Bitgold expose for logs, and what are the params?"
- "My node is 200 blocks behind — walk me through the checks."
- "What are the slashable offences on Bitgold and their penalties?"
- "Show me the staking contract calls I need to read pending rewards."

## Skill structure

```
bitgold-skills/
├── skills/
│   └── bitgold-network/
│       ├── SKILL.md                          # Entry point, network table, decision tree, safety rules
│       └── references/
│           ├── network-and-rpc.md            # Chain parameters, RPC endpoints, add-network JSON
│           ├── wallets-and-faucet.md         # MetaMask/Trust setup, faucet, token recovery
│           ├── evm-development.md            # Hardhat/Foundry/viem/ethers, deploy, gas
│           ├── json-rpc.md                   # Method inventory, examples, errors
│           ├── node-operations.md            # Full/archive/fast/boot nodes, snapshots, upgrades
│           ├── staking-and-delegation.md     # PoSA staking, delegation, staking dApps
│           ├── validators.md                 # Create/run/secure/monitor a validator
│           ├── slashing-and-mev.md           # Slash rules, monitoring, MEV
│           ├── governance.md                 # Proposals, voting, governance APIs
│           └── account-abstraction-and-bridge.md  # EOA paymaster, bridge
├── plugins/
│   └── bitgold-devkit/                       # Marketplace plugin snapshot of the skill
├── scripts/
│   ├── build-plugin.mjs                      # Rebuilds the plugin snapshot + checksums
│   └── check-repo.mjs                        # JSON, frontmatter, link, branding and drift checks
├── .claude-plugin/marketplace.json
├── .cursor-plugin/marketplace.json
├── .agents/plugins/marketplace.json
├── .github/workflows/checks.yml              # CI: snapshot drift + repository checks
├── .gitattributes                            # Forces LF so payload hashes match on every OS
├── LICENSE
└── README.md
```

## Maintaining the plugin snapshot

`plugins/bitgold-devkit` mirrors `skills/bitgold-network` byte for byte. After editing anything under `skills/`, rebuild the snapshot and refresh the checksums:

```bash
node scripts/build-plugin.mjs          # copy the skill and rewrite distribution.json
node scripts/build-plugin.mjs --check  # verify only; non-zero exit on drift
node scripts/check-repo.mjs            # JSON validity, SKILL.md frontmatter, links, branding
```

The build script copies the skill, recomputes the per-file and payload SHA-256 values in `plugins/bitgold-devkit/distribution.json`, and `--check` fails if the two trees drift. Native plugin clients do not verify `distribution.json`; it exists so a reviewer can confirm the published plugin matches the reviewed skill source.

`check-repo.mjs` also enforces the rule this repository exists for: no branding, endpoints, or product names from the upstream ecosystem this project was adapted from survive anywhere in the content. CI runs both scripts on every push and pull request.

## References

- **Docs:** https://docs.bitgold.network
- **Website:** https://www.bitgold.network
- **App (staking, validators):** https://app.bitgold.network
- **Explorers:** https://www.bitgold.live · https://testnet.bitgold.live
- **Faucet:** https://faucet.bitgold.network
- **GitHub:** https://github.com/bitgold-network

## Disclaimer

This is a community skills package. It is not published, reviewed, or endorsed by the Bitgold core team, and it grants no privileged RPC access. Network parameters, third-party endpoints, and on-chain values can change; the chain itself and the official documentation are authoritative. Nothing here is financial, legal, or investment advice.

## License

MIT License — see [LICENSE](LICENSE) for details.
