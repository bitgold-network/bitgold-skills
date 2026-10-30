# Bitgold Validators

Reference for a Bitgold Network validator: a PoSA (Proof of Staked Authority)
EVM L1, mainnet chain ID `618` (`0x26A`), testnet `617` (`0x269`), ~1 s blocks,
block `gasLimit` `7,000,000,000`, `baseFeePerGas` `0x0`, on a Geth v1.8.1 client
forked from the BSC v1.8.1 codebase.

Requirements are enforced on chain; the official docs and staking app are
authoritative where this summary differs from them.

## What a validator is

A validator produces blocks, votes in consensus, and earns fees plus delegator
commission in BTG; participation is elected:

- A daily election after `00:00 UTC` ranks stake: the top 45 are active, split
  into 21 **Cabinets** (highest stake) and 24 **Candidates**.
- Each epoch draws 18 Cabinets and 3 Candidates into a 21-validator consensus
  set; both are slashed when offline on their turn.
- Self-delegation is mandatory: 2000 BTG on chain, at least `2001` in the create
  form (2000 BTG plus 1 BTG locked to a dead address).
- A **validator** is a registered record with keys and self-stake; a **candidate**
  is ranked but not drawn into that epoch's consensus set.

Seats are capped by `maxElectedValidators` on the StakeHub contract
`0x0000000000000000000000000000000000002002`, published as 45 mainnet and 8
testnet. Treat those as the protocol ceiling, not the current set size: the live
set is visible at <https://app.bitgold.network/staking/validators>, and
`parlia_getSnapshot` returns it directly from the RPC (the mainnet snapshot on
2026-10-30 held 6 validators, with `epoch_length` 600 and `block_interval`
1000 ms).

## Prerequisites

| Item | Mainnet | Testnet |
| --- | --- | --- |
| CPU | `i7i.8xlarge` or `i7ie.6xlarge` class (HyperThread off, worth 10 %+), or >=400 mgasps | AMD Gen 3 or newer, or Intel Ice Lake or newer |
| Memory | 128 GB | 16 GB |
| Disk | 7 TB NVMe SSD, 40k IOPS, 500 MB/s, read latency <1 ms | 1.5 TB SSD (gp3), 8k IOPS, 250 MB/s |
| Bandwidth | >=512 Mbps | >=128 Mbps |
| Stake | >2001 BTG in the operator account; >=2000 BTG self-delegated | same rules |
| Keys | operator, consensus, BLS vote, BLS proof | same |
| Network | P2P reachable (geth default 30303 TCP/UDP; the shipped `config.toml` may bind 30311 - open what your config binds); JSON-RPC 8545 not public | same |

## Lifecycle

1. **Prepare the node:** binary, `genesis.json`, `config.toml`, optional
   snapshot; see [node-operations.md](./node-operations.md).
2. **Generate keys:** consensus account, BLS vote account, and a BLS proof.
3. **Fund the operator account** above 2001 BTG for self-delegation and fees.
4. **Create the validator** in the staking dApp, signed by the operator address.
5. **Self-delegate** at least `2001` in the same form.
6. **Start producing** with `--mine --vote` and the consensus etherbase.
7. **Monitor** latency, slash count, and the validator list.
8. **Update or exit:** edit commission, `miner.stop()`, undelegate, or unjail.

## Creating a validator

No CLI is documented; the staking dApp form, signed by the operator address,
builds the StakeHub call.

1. Connect the **operator address** (Trust Wallet, MetaMask, or WalletConnect)
   holding more than 2001 BTG, and select `Become a Validator`.
2. Fill name (3-9 alphanumeric characters, no special characters), website,
   description, and optional avatar.
3. Fill consensus address, vote address, BLS proof, and optional `Identity`
   (only to associate with an existing record, e.g. a migration).
4. Set commission rate, max rate, and max change rate per epoch (1 day).
5. Set self-delegation to at least `2001`, press `Submit`, and sign.

Inputs: operator address (immutable once set), consensus address, vote address,
BLS proof, optional identity, name, three commission fields, self-delegation.

```bash
geth bls account generate-proof --datadir ${DATA_DIR} --chain-id ${BITGOLD_CHAIN_ID} ${OPERATOR_ADDRESS} ${VOTE_ADDRESS}
```

On chain this writes a validator record with all of the above. It enters the
ranking at once but is not guaranteed a seat; confirm the transaction succeeded,
then watch the validator list after the next `00:00 UTC` election, since a record
below the cut stays a candidate.

## Running the validator

Documented startup command, run where the binary and `config.toml` live:

```bash
geth --config ./config.toml --datadir ./node \
  -unlock {accounts to sign txs, including your mining account at least} \
  --miner.etherbase {the address of your mining account} \
  --password password.txt --blspassword blspassword.txt \
  --mine --vote --allow-insecure-unlock \
  --cache 18000 \
  --history.transactions 0 --history.logs.disable
```

`--mine`/`--vote` produce blocks and fast finality votes, `--miner.etherbase`
names the consensus account that receives rewards, `--password`/`--blspassword`
supply the two password files, and `--cache 18000` sizes the state cache.

Do not expose RPC endpoints publicly. Directory and key-file layout:

```text
working dir/
  geth, config.toml     binary and chain configuration
  password.txt          consensus account password
  blspassword.txt       BLS wallet password
  node/                 --datadir
    keystore/           consensus key files (UTC--...)
    geth/               chaindata, geth.ipc, logs
    bls/                BLS wallet material for the vote key
```

Passwords are written by plain redirection; production stops and starts with
`miner.stop()` and `miner.start()`.

## Key management

Only the consensus and BLS keys belong on the node host.

| Key | Used for | Where it lives | Custody |
| --- | --- | --- | --- |
| Operator | Create/edit validator, self-delegate, undelegate | Wallet / dApp session | Hardware, Safe, or MPC; cannot change later |
| Staking | Delegate, redelegate, claim rewards | Wallet | Optional; hardware, Safe, or MPC |
| Consensus | Sign proposed blocks | `node/keystore/` | Hot wallet; no funds |
| BLS vote | Sign fast finality votes | BLS wallet under `--datadir` | Hot wallet; no funds |

Generation and import commands, exactly as documented:

```bash
geth account new --datadir ${DATA_DIR}
geth bls account new --datadir ${DATA_DIR}
geth bls account list --datadir ${DATA_DIR}
geth account import --datadir ${DATA_DIR}
geth bls account import ${KEY_FILE} --datadir ${DATA_DIR}
```

Consensus and operator must differ, and the consensus address appears in slash
transactions. **Fee and reward address:** no separate fee-recipient key is
documented; fees and rewards are distributed by stake and commission, and
`--miner.etherbase` must be the consensus account. **Backup rule:** back up
offline, before producing a block, the consensus key file (or seed phrase), the
BLS key file, and both password files. **Rotation:** no in-place rotation is
documented, and the operator address can never change; a new consensus or BLS key
means a new validator record linked via the optional `Identity` field. No
rotation runbook is published, so confirm the current procedure in the docs
before rotating keys on a live validator.

## Security

- **Sentry architecture.** Sentries are full nodes in private address space that
  shield the validator, can change IP, and keep proposals and votes flowing.
- **Hide the validator.** Set `NoDiscovery = true` and list only sentries as
  static peers, then verify with `admin.peers`.
- **Firewall.** Open the P2P listener (TCP) and discovery (UDP) ports, normally
  30303; keep TCP 8545 (JSON-RPC) closed, or admin calls become reachable.
- **No keys on hot web servers.** Consensus and BLS keys stay on the validator
  host; the operator key belongs in a hardware, Safe, or MPC wallet.
- **DDoS posture.** A public validator IP is fine only with the HTTP module
  disabled and node details private; otherwise use sentries.

## EVN

The Enhanced Validator Network is a network-layer optimization, not a new P2P
network: it reuses the existing P2P layer to cut core consensus message latency
by mapping consensus identity onto network identity.

- **NodeID registration.** List EVN NodeIDs in `config.toml`; the node signs a registration transaction that records them on chain.
- **Peer identification.** Validators and sentries mark peers whose on-chain registrations match as EVN peers.
- **Broadcast optimization.** Transaction broadcast is off between EVN peers; mined blocks go to all connected EVN peers, other blocks still gossip.

Sentry mode, validator side, registering the sentry NodeIDs:

```toml
[Eth]
EVNNodeIDsToAdd = ["sentryNodeID1", "sentryNodeID2"]
[Node]
EnableEVNFeatures = true
EnableQuickBlockFetching = true
[Node.P2P]
StaticNodes = ["<validator enodes>", "<fullnode enodes>", "<sentry enodes>"]
```

The sentry enables the same two `[Node]` flags and adds `EVNNodeIdsWhitelist`
(optional, node-local) plus `ProxyedValidatorAddresses` naming the validator it
shields, which tells it whose blocks to broadcast to all EVN peers. Simple mode
applies the same settings to the validator itself, with no sentry hop.

Reference latency between AWS regions: AP to EU ~100 ms, AP to US ~80 ms, US to
EU ~35 ms; treat these as the floor when benchmarking links.

EVN FAQ: get a NodeID with
`./geth --exec "admin.nodeInfo.id" attach ./geth.ipc`; validators may share
sentries in the same region; only validators can register EVN NodeIDs, and each
validator may register 5 NodeIDs by default.

### Network monitor

Monitor at `quantile=0.95`; peer latency is `RoundTripTime/2`:

```text
p2p_peers_latency{quantile="$quantile", job=~"$jobs"}
chain_delay_block_send{quantile="$quantile", job=~"$jobs"}
chain_delay_block_insert{quantile="$quantile", job=~"$jobs"}
chain_delay_vote_majority{quantile="$quantile", job=~"$jobs"}
chain_delay_block_mining{quantile="$quantile", job=~"$jobs"}
```

All `chain_delay_*` values are relative to `Header.MilliTimestamp`; insert and
vote-majority delays explain slow block or vote reception, while block-send and
block-mining delays show whether your own blocks arrive on time.

## Monitoring and alerting

Missing-block signals:

- **Slashes.** More than three in a day warrants investigation; 50 moves the
  validator into maintenance mode and then jail.
- **Rewards.** More than 50 missed blocks in 24 hours forfeits the day's reward;
  more than 150 in 24 hours is a downtime slash.
- **Delay.** p95 `chain_delay_block_mining` or `chain_delay_block_send` rising
  while `chain_delay_block_insert` stays flat points at the local node.
- **Logs.** Missing `Imported new chain segment` lines, or a stalled block
  `number`, means the node cannot sign.

`node getslashcount.js --Rpc https://rpc.bitgold.network` (in `cmd/jsutils` of the
node source) dumps slashes per validator.

First three things to check: head and peers against
`https://rpc.bitgold.network` and `admin.peers`; `--mine --vote`,
`--miner.etherbase` matching the registered consensus address, and `miner.start()`
after any `miner.stop()`; the unlock with `password.txt`, the BLS wallet with
`blspassword.txt`, and the key matching the registration.

After a penalty, exit maintenance mode and unjail once the jail ends:

```console
geth attach geth.ipc
web3.eth.sendTransaction({from: "0x...", to: "0x0000000000000000000000000000000000001000", data: "0x04c4fec6"})
```

Jail lasts 30 days for double sign or malicious vote, and 2 days for downtime or
low self-delegation.

## Don't do this

- **Never run the same consensus key on two machines:** a double-sign slash of 200 BTG plus 30 days of jail.
- **Never duplicate consensus plus BLS keys across hosts:** the malicious vote slash, also 200 BTG and 30 days.
- **Never share keys** between operators, environments, or a local network.
- **Never expose JSON-RPC, the console, or the admin API** with unlocked accounts behind a public port.
- **Never let a backup node sign while the primary is alive:** a cold spare starts only after the primary stops.
- **Never drop below 2000 BTG self-delegated:** 2 days of jail.
- **Never assume registration equals a seat:** election ranking decides.

See [slashing-and-mev.md](./slashing-and-mev.md) and
[node-operations.md](./node-operations.md).

## Sources

- <https://docs.bitgold.network/bitgold-network/validator/overview/>
- <https://docs.bitgold.network/bitgold-network/validator/create-val/>
- <https://docs.bitgold.network/bitgold-network/validator/run-val/>
- <https://docs.bitgold.network/bitgold-network/validator/manage-keys/>
- <https://docs.bitgold.network/bitgold-network/validator/security/>
- <https://docs.bitgold.network/bitgold-network/validator/evn/overview/>
- <https://docs.bitgold.network/bitgold-network/validator/evn/best-practice/>
- <https://docs.bitgold.network/bitgold-network/validator/evn/network-monitor/>
- <https://docs.bitgold.network/bitgold-network/validator/evn/faqs/>
- <https://docs.bitgold.network/bitgold-network/developers/node_operators/full_node/>
