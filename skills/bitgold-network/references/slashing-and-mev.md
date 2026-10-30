# Slashing and MEV on Bitgold Network

Validator slashing rules, the slash monitor, and the proposer-builder (PBS) MEV market for Bitgold Network: mainnet chain ID `618` (`0x26A`), testnet `617` (`0x269`), ~1 s block time, Geth v1.8.1 client forked from the BSC v1.8.1 codebase.

> Penalties are enforced on chain, the Bitgold documentation is authoritative over this file, and this file is not financial or legal advice.

## Slashing

Slashing is a component of on-chain governance that penalizes malicious or negative validator actions. Anyone may submit a slash transaction, and the submitter pays the transaction fee and supplies the evidence; successful submissions pay a reward that the docs describe as larger than the cost of submitting.

| Offence (docs' term) | Evidence rules and detection window | Documented penalty | Removed from set |
|---|---|---|---|
| **Double Sign** | Two block headers with the same height and the same parent block hash, sealed by the same validator, with two different signatures. Evidence is valid only within **24 hours** of the two blocks. | **200 BTG** slashed from the validator's **self-delegated** BTG; remaining slashed BTG goes to the credit addresses of validators in the next distribution; validator set to `jailed` for **30 days**. | Yes: removed from the active validator set immediately |
| **Malicious Vote** (docs also use "Malicious Fast Finality Vote") | Two conflicting fast-finality votes: target number lags the canonical chain head by no more than **256** blocks; each source number is below its target; source and target hashes differ; target numbers are equal or one vote's span contains the other's; both votes signed by the same voting key with valid signatures; that key must be in the list sent by the last two breathe blocks. | **200 BTG** slashed from **self-delegated** BTG; **5 BTG** to the submitter from the system reward contract if the validator is active at submission time; remaining slashed BTG to validators' credit addresses; `jailed` for **30 days**. | Yes: removed from the active validator set immediately |
| **Unavailability**, reward-loss tier | Missed-block metrics recorded by an internal smart contract; more than **333** missed blocks (governable) in **24 hours**. | Block reward withheld from the validator and shared among better-performing validators. | No |
| **Unavailability**, jailing tier | More than **1000** missed blocks (governable) in **24 hours**. | **10 BTG** (governable) slashed from **self-delegated** BTG, allocated to validators' credit addresses; `jailed` for **2 days**. | Yes: removed from rotation |

Two documented views of the same unavailability signal appear in the docs: the slash-rules page counts missed blocks (333 / 1000 per 24 hours), while the monitor page tracks a contract-side "slash indicator" value (attention above 50, slash above 200, jail above 600). Treat the on-chain contract state and the slash-rules page as authoritative if they appear to disagree.

## How slashing is applied on chain

1. **Reporting is permissionless.** Any account can submit a slash transaction; the reporter needs only gas, the evidence payload, and no validator relationship.
2. **Evidence is submitted to the Bitgold Slash Contract.** For Double Sign the payload is the two conflicting block headers sealed by the offending validator. For Malicious Vote the payload is the two conflicting votes plus the voting key used for the signature.
3. **The contract verifies validity**, then performs the state change itself: deducting the predefined slash amount from self-delegated BTG, marking the validator `jailed`, and removing it from the current validator set when the offence warrants it.
4. **The slashed BTG is redistributed on chain.** The submitter's reward is paid from the slashed amount (Double Sign) or from the system reward contract (Malicious Vote, 5 BTG); the remainder is credited to other validators' credit addresses and passed to their delegators in the same way as block rewards.
5. **What the validator sees.** A jailed record on the validator, removal from rotation (no further proposer turns), and a slash event in the slash contract log - the same log a monitor polls.
6. **Unjailing is a separate transaction.** A jailed validator must wait out the jail period (2 days for unavailability, 30 days for Double Sign or Malicious Vote), then send the unjail transaction from the BTG Staking dApp.

**Impact on delegators.** The docs describe slashing as taken from the validator's *self-delegated* BTG, so delegated principal is not described as being cut. What delegators lose is income: while the validator is jailed and out of the set, neither the validator nor its delegators receive staking rewards, and on the unavailability reward-loss tier the block reward is redirected to other validators entirely. Delegators also lose the uptime signal that made the validator worth delegating to. Because jail entry and exit are on-chain events, a delegator's practical protection is monitoring the same slash contract log the operator does.

## Slash monitor

The docs frame the monitor as a browser workflow on the Bitgold scanner, not as a CLI tool: keep watching the slash contract's event log at `https://www.bitgold.live` and read your validator's slash indicator from that contract.

```text
Monitor target      : event log of the slash contract on the Bitgold scanner
Scanner             : https://www.bitgold.live
Indicator > 50      : pay attention
Indicator > 200     : validator will be slashed
Indicator > 600     : validator will be jailed
Unjail path         : BTG Staking dApp -> "unjail" button, after the jail period elapses
Mainnet staking dApp: https://app.bitgold.network/staking
Testnet             : switch the Bitgold app to Bitgold Testnet (chain ID 617)
```

The monitor page publishes no shell commands, so no CLI is quoted here. Anything scripted around the slash contract is local tooling you own, and the contract address must be read from the scanner rather than copied from an unofficial source.

Operational reading of the page:

- **Routine slashes are availability slashes.** The docs state that without maliciously altering node code or mistakenly running a validator, double-sign and malicious-vote slashes should not occur, so uptime is the metric that matters day to day.
- **Watch the trend, not just the threshold.** Values above 50 are the documented early-warning band; by 200 the slash decision has already been made.
- **The unjail step is manual and time-gated.** Nothing auto-unjails; the operator must return to the staking dApp after the jail duration.

## MEV

Bitgold adopts **Proposer-Builder Separation**. Builders construct blocks and submit them as **block bids** to the in-turn proposer; the proposer picks the most profitable bid, seals it, and pays the builder by appending a payment transaction at the end of the block. A **Sentry** component sits between proposer and builders: it terminates builder traffic, simulates bids, and handles payment, keeping the validator and its payment wallet off the public network. The docs motivate this as stability (one official client, many builders), economy (permissionless builders, more value to validators and delegators), and transparency (published profit distribution).

### Validator-side enablement

The validator runs a current Bitgold node release and adds these sections to `config.toml`, with flags verbatim from the validator integration guide:

```toml
[Eth.Miner.Mev]
Enabled = true # open bid receiving
GreedyMergeTx = true # merge local tx to the MEV bid block
ValidatorCommission = 100 # validator claim 1% from block reward
BidSimulationLeftOver = 50000000 # 50ms, the time left for bid simulation
SentryURL = "http://127.0.0.1:8551" # private URL or IP:Port used by the validator to reach the sentry

# Find builders in the current builder list published by the Bitgold team
[[Eth.Miner.Mev.Builders]]
Address = "0x45EbEBe8...664D59c12" # builder address which validator is willing to receive bid from

[[Eth.Miner.Mev.Builders]]
Address = "0x980A75eC...fc9b863D5" # builder address which validator is willing to receive bid from
```

| Setting | Documented meaning |
|---|---|
| `BidFeeCeil` | Maximum fee the validator will pay for a builder's block; `0` means the validator accepts no builder charges |
| `BidSimulationLeftOver` | How long before block time the validator stops simulating builder blocks; tens of milliseconds is advised, too small risks late broadcast |
| `ValidatorCommission` | Validator's share of block reward (the example `100` is described as 1%) |
| `GreedyMergeTx` | Merges local transactions into the MEV bid block |

Sentry deployment, per the same guide: isolate a private network (validator plus payment wallet) from a NAT network (Sentry, behind a load balancer with DoS safeguards), open the validator's RPC to the Sentry only, expose the Sentry on a domain, and register the validator in `bitgold-mev-info`. Recommended Sentry hardware is **2 CPUs and 4 GB of RAM**. Never place a validator private key in the Sentry config: create a fresh account for bid payments, funded only if `BidFeeCeil` is non-zero. One Sentry can serve multiple validators, routing by `PublicHostName` and reaching each validator on its `PrivateURL`.

### Builder integration path

The builder implements the standard Builder API, holds a **builder account** that signs bids and receives fees, implements `mev_reportIssue` for validator error reports, sends bids **only to the in-turn validator**, and sends **at most 3 block bids at the same height**. Sentry endpoints a builder calls:

| Method | Returns |
|---|---|
| `mev_bestBidGasFee` | The most profitable reward currently held by the validator, computed as `gasFee*(1 - commissionRate) - tipToBuilder` |
| `mev_params` | `BidSimulationLeftOver`, `ValidatorCommission`, `GasCeil`, `BidFeeCeil` for that validator |

A builder stops bidding once the clock passes `block time - BidSimulationLeftOver`, and uses `GasCeil` to know when to stop packing transactions. Bid signing and validator targeting come from config:

```toml
[Eth.Miner.Mev]
BuilderEnabled = true # open bid sending
BuilderAccount = "0x..." # builder address which signs bid, usually it is the same as etherbase address
```

```toml
[[Eth.Miner.Mev.Validators]]
Address = "0x23707D3D...6455B52B3"
URL = "https://sentry1.example.com"

[[Eth.Miner.Mev.Validators]]
Address = "0x52825922...3A1A7A422"
URL = "http://sentry2.example.com"
```

**Bid flow.** Searchers bundle opportunities and submit them to a builder, then the builder assembles an unsealed block, prices it (block reward plus the tip it wants), signs the bid with the builder account, and posts it to the Sentry before the cutoff. The Sentry authenticates the builder address, simulates, and keeps the best bid. The validator compares the bid against its own locally mined block, sealing the bid only if both the block reward and the validator reward are better. Payment to the builder is then appended as the last transaction of the block.

Checking a Sentry's advertised parameters uses the documented `mev_params` method against the documented `SentryURL`; the call below is derived from those two facts and is not printed verbatim in the docs:

```bash
curl -s -X POST "http://127.0.0.1:8551" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"mev_params","params":[]}'
```

### User and dApp side

There is no transaction-level "MEV flag" in the docs. A user opts in by choosing where the transaction is broadcast: a private RPC or builder proxy that hides it from the public mempool, or a wallet's swap MEV-protection toggle. Any provider used for production traffic must explicitly support Bitgold Network (chain ID `618`); availability, fees, and confirmation times vary by provider. Builder proxies broadcast a submitted transaction to all registered builders, which widens inclusion chances and improves censorship resistance. The docs also credit PBS itself with making front-running and sandwiching less likely, since ordering is decided by builders competing on price rather than by a public mempool race.

## Decision table

| I am a ... | Read this | Do that |
|---|---|---|
| **Validator** | Slash rules, slash monitor, validator integration guide | Publish a `BidFeeCeil` and `BidSimulationLeftOver` you can defend, deploy Sentry in a NAT network with a throwaway payment account, register in `bitgold-mev-info`, watch the slash indicator daily, and keep the jail period in mind before promising delegator yields |
| **Builder** | Builder integration guide, `mev_params` / `mev_bestBidGasFee` | Implement `mev_reportIssue`, sign every bid with the builder account, bid only to the in-turn validator, cap at 3 bids per height, and stop at `block time - BidSimulationLeftOver` |
| **dApp user** | MEV user guide, MEV FAQs | Route swaps through a provider that confirms chain ID `618` support, enable wallet MEV protection, and treat inclusion speed as a function of how many validators the provider is integrated with |

## FAQ

**Is MEV mandatory for a validator?** No. MEV support is a per-validator integration: `Enabled = true` in `[Eth.Miner.Mev]` opens bid receiving, and the docs explicitly ask validators to weigh the added maintenance, the network exposure of a public Sentry, and the financial risk of paying builders before switching it on. A validator with MEV disabled simply produces blocks locally.

**How is MEV revenue shared?** The docs describe MEV rewards as distributed among searchers, validators, builders, and BTG stakers. A validator's reward is `gasFee*commissionRate - builderFee`; a builder compares its own economics against `mev_bestBidGasFee`, which is `gasFee*(1 - commissionRate) - tipToBuilder`. `ValidatorCommission` is the parameter that sets the validator's cut.

**Who may become a builder?** Anyone. Bitgold is permission-less and any party implementing the standard builder API can be a builder; the current builder list and endpoints are published by the Bitgold team and the MEV community through official channels.

**How does a validator pick a bid?** On every new bid it compares the bid's reward with the current best; a better bid enters simulation; if simulation finishes before sealing and the bid beats the local block on both block reward and validator reward, the bid is sealed.

**What are the risks, and how does a user avoid sandwiching?** The concrete risk is a bot seeing your swap in the public mempool and trading ahead of it, worsening your price. The documented mitigations are private RPCs, builder proxies, and wallet-level MEV protection: all third-party, all requiring explicit Bitgold support. The docs publish no Bitgold-specific sandwich statistics.

**Where are MEV stats published?** There is no single canonical dashboard in the docs: statistics are published periodically by the Bitgold team and by independent analytics providers, reachable through official Bitgold channels.

## Incident response

First actions only; run the linked runbooks for the full procedure.

| Situation | First actions |
|---|---|
| **Suspected double-sign** | Stop the validator process immediately: two live copies of the same key are the usual cause, so kill the standby before investigating. Preserve the node data directory and logs, confirm whether a second instance or restored snapshot is running, then check the slash contract log for a Double Sign event. A confirmed event means 200 BTG slashed, 30 days jailed, removal from the set. |
| **Validator jailed** | Identify the offence from the slash event (unavailability versus Double Sign / Malicious Vote), fix the root cause (disk, clock, peer count, key handling), confirm the jail duration (2 days or 30 days), then send the `unjail` transaction from the staking dApp. Do not restart into the set expecting the jail to clear. |
| **Missed-block streak** | Compare missed blocks over the last 24 hours against the 333 and 1000 thresholds, and the contract indicator against 50 / 200 / 600. Check peer count, block import lag, and system time sync first; a streak that crosses 1000 in 24 hours is a 10 BTG slash plus a 2-day jail. Notify delegators early: their rewards stop with yours. |
| **MEV relay / Sentry outage** | Check the Sentry process, its domain/DNS, and the builder list; a Sentry outage should degrade to local block building rather than halt the validator. Confirm the payment account balance and that no validator key was ever placed in the Sentry config. If builders report errors, `mev_reportIssue` traffic and Sentry logs are the first evidence to collect. |

See [validators.md](./validators.md) for validator lifecycle and staking operations, and [node-operations.md](./node-operations.md) for node runtime, upgrades, and monitoring.

## Sources

- https://docs.bitgold.network/bitgold-network/slashing/overview/
- https://docs.bitgold.network/bitgold-network/slashing/slash-rules/
- https://docs.bitgold.network/bitgold-network/slashing/monitor/
- https://docs.bitgold.network/bitgold-network/validator/mev/overview/
- https://docs.bitgold.network/bitgold-network/validator/mev/user-guide/
- https://docs.bitgold.network/bitgold-network/validator/mev/validator-integration/
- https://docs.bitgold.network/bitgold-network/validator/mev/builder-integration/
- https://docs.bitgold.network/bitgold-network/validator/mev/faqs/
