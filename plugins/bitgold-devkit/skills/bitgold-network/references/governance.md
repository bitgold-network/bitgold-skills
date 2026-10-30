# Governance

Bitgold Network governance is an on-chain Governor plus Timelock system: proposals, votes and executions are all recorded on chain, and voting power comes from staked BTG (the governance token is referred to as `govBTG` in the parameter tables). The design follows the OpenZeppelin Governor model. Holders participate through the Bitgold app or any interface that supports the standard Governor ABI.

Contracts: `Governor` at `0x0000000000000000000000000000000000002004`, `GovToken` at `0x0000000000000000000000000000000000002005`, on mainnet chain ID `618` (`0x26A`) and testnet `617` (`0x269`). `GovToken` manages the governance token, syncs balances with staked assets and carries delegation; `Governor` handles proposal creation, voting, queueing and execution. The UI is the governance area of <https://app.bitgold.network>.

> **Risk note:** governance parameters can change through governance itself; the values read from the `Governor` and `GovToken` contracts are authoritative.

## Governance model overview

The docs describe two layers: an off-chain **temperature check** that gauges sentiment, and a binding **on-chain vote** whose result the Timelock executes.

1. **Temperature check** — a sentiment poll in the governance area of the app. Non-binding: a text-only on-chain proposal "has no on-chain action and will not be executed by the network".
2. **Proposal** — `propose(targets, values, calldatas, description)` on `Governor`. A proposal records proposer, target addresses, values, function signatures, calldatas and a description.
3. **Vote** — `castVote(proposalId, support, reason)` during `votingPeriod`. Holders may change their support value throughout the period.
4. **Queue** — `queue(...)` once the proposal succeeds; it then waits out `timelockDelay`.
5. **Execute** — `execute(...)` after the timelock; anyone can trigger it.

Rules that shape participation:

- Only staking credit holders can propose or vote, and **voting power must be delegated** — to yourself, a validator, or a community representative.
- A proposer needs voting power above `proposalThreshold` and may have **only one proposal in an active or pending state** at a time, to prevent spam.
- Voters keep earning staking rewards during the voting period, so participating does not cost yield.
- Execution needs quorum, a passing tally, and the timelock to have expired.

### Parameters

| Parameter | Meaning | Mainnet | Testnet |
| --- | --- | --- | --- |
| `votingDelay` | Fixed delay before voting starts | 0 hour | 0 hour |
| `votingPeriod` | Voting window before tally | 7 days | 1 day |
| `proposalThreshold` | govBTG needed to create a proposal | 200 govBTG | 100 govBTG |
| `quorumNumberRator` | Share of total voting power for a valid result | 10% | 10% |
| `startGovThreshold` | Total gov token supply needed to enable governance | 10M BTG | 10M BTG |
| `minPeriodAfterTheQuorum` | Extra voting time added on reaching quorum | 1 day | 1 hour |
| `timelockDelay` | Timelock before a queued proposal executes | 1 day | 6 hours |

The overview page restates the same mainnet values in prose: minimum stake of 200 BTG to propose, voting period 7 days, quorum 10%, tally threshold where `Yes` must be no less than `No` and reach 50%, timelock 1 day.

The docs specify a **proposal threshold only**; no proposal deposit or bond is documented anywhere in these pages, so an agent must not state one. Treat any deposit figure as read-on-chain or ask the user.

Not documented, therefore left as read-on-chain: the numeric `ProposalState` ordinals, the exact `GovToken` supply at any moment, current quorum in absolute votes, and any per-proposal snapshot block. Query `proposalThreshold()`, `votingPeriod()`, and `quorum(...)`-style getters from the Governor ABI rather than assuming the table above.

## Voter user guide

1. **Stake first.** Voting power derives from staked BTG, so delegate to a validator before participating — see [Staking and Delegation](./staking-and-delegation.md).
2. **Delegate voting power.** Governance area → **My voting power** / **Delegation** → choose a delegate. Delegating to yourself lets you vote and propose directly; delegating to another address lets it act for you.
3. **Open the proposal** in the governance area and click **Vote on chain**.
4. **Choose For, Against, or Abstain**, then sign the transaction.
5. **Queue** a successful proposal, and after the timelock **Execute** it — either step can be sent by anyone.

Voting power is the staking credit amount held when the proposal is submitted, i.e. it is snapshotted at proposal creation. The advocate guide puts the operational consequence plainly: delegate before a proposal is created if you want your weight counted. The temperature-check page additionally lists raw BTG balance as a factor in governance power; the binding on-chain vote uses staked credit, so treat balance-based influence as applying to sentiment polls unless an on-chain read says otherwise.

Timing at a glance: voting opens after `votingDelay` (0 hours today, so effectively immediately), stays open for `votingPeriod` (7 days mainnet, 1 day testnet), may extend by `minPeriodAfterTheQuorum` if quorum is reached late, then waits `timelockDelay` (1 day mainnet, 6 hours testnet) before execution.

## Advocate's guide summary

An "Advocate" is a community leader who aggregates voting power. The docs give two levers: hold more BTG, and receive delegated BTG from the community.

- **Educate and advocate** — explain why on-chain governance matters and what delegating to you buys the community.
- **Share proposals and insights** — comment on upcoming proposals and their impact.
- **Simplify delegation** — publish clear, step-by-step instructions.
- **Communicate transparently** — state how you intend to use delegated power and why you vote as you do.
- **Build trust** — show consistent alignment with your community and the network.

Delegation steps to hand to followers: open the governance area → connect wallet → **Delegation** → **Delegate** → choose **delegate to self** or **delegate to another address** (enter it) → review, sign → verify under **Votes** or **My Delegates**. Delegations can be removed again from the same **Delegation** screen.

## Temperature check

The temperature check is the informal first step of the two-step process; a proposal that draws enough support moves to the final decision vote where staked BTG decides.

- Anyone staking BTG can create one.
- Fields: title, description, and a discussion link, plus the voting system, the vote options, and the duration — the proposer chooses all three, so allow enough time for holders to participate.
- BTG delegators vote; use the same address you use for staking so your weight is counted.
- Delegating and undelegating voting power are both available from **Delegation**.
- Factors the page lists: BTG balance, staked BTG (as validator or delegator), and delegated power.

A temperature check has no on-chain effect by itself. Agents should describe it as sentiment only, and never report its outcome as an executed change.

## Governance APIs

No hosted REST governance API is documented. The "Governance APIs" page specifies the **contract interface**, so "endpoints" here are JSON-RPC calls against the RPC node plus signed transactions for writes.

| Contract | Function (as documented) |
| --- | --- |
| `Governor` | `function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) public returns (uint256 proposalId)` |
| `Governor` | `function castVote(uint256 proposalId, uint8 support, string memory reason) public returns (uint256)` |
| `Governor` | `function state(uint256 proposalId) public view returns (ProposalState)` |
| `Governor` | `function queue(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public returns (uint256 proposalId)` |
| `Governor` | `function execute(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public payable returns (uint256)` |
| `GovToken` | `function delegateVote(address delegator, address delegatee) external` |

Reads via `eth_call` (build calldata with `cast calldata` so no selector is invented by hand):

```bash
export RPC=https://rpc.bitgold.network
export GOV=0x0000000000000000000000000000000000002004

DATA=$(cast calldata "state(uint256)" 42)
curl -s $RPC -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"'$GOV'","data":"'$DATA'"},"latest"]}'
```

Response shape — a single 32-byte word, decoded as the `ProposalState` ordinal:

```json
{"jsonrpc":"2.0","id":1,"result":"0x0000000000000000000000000000000000000000000000000000000000000003"}
```

```bash
# human-readable reads
cast call $GOV "proposalThreshold()(uint256)" --rpc-url $RPC
cast call $GOV "votingPeriod()(uint256)" --rpc-url $RPC
cast call 0x0000000000000000000000000000000000002005 "delegates(address)(address)" $VOTER --rpc-url $RPC

# writes
cast send 0x0000000000000000000000000000000000002005 "delegateVote(address,address)" $VOTER $DELEGATEE --rpc-url $RPC --private-key $PK
cast send $GOV "castVote(uint256,uint8,string)" 42 1 "in favor" --rpc-url $RPC --private-key $PK
```

`support` is the vote choice ordinal (for, against, abstain); confirm the mapping from the Governor ABI before writing it into a product, since the docs give it by name rather than by number. `delegateVote` is documented as taking both the delegator and the delegatee address.

## Proposal states and agent actions

`state(proposalId)` returns the `ProposalState` enum. The docs do not enumerate its ordinals — read them from the Governor ABI, and key behavior off the lifecycle below rather than off guessed numbers.

| Stage | How to detect | What an agent should do |
| --- | --- | --- |
| Temperature check | Off-chain poll in the app; no proposal ID | Summarize sentiment, link the discussion, never claim it is binding |
| Proposed / pending | Proposal exists, `votingDelay` not elapsed | Report the snapshot voting power and the start time; do not offer voting yet |
| Active | Voting is open within `votingPeriod` | Read state, help the user pick For/Against/Abstain, submit `castVote` with a reason |
| Defeated | Voting closed, quorum or tally not met | Report the tally and stop; a new proposal is required |
| Succeeded | Quorum and tally met, not queued | Offer `queue(...)`, which needs the description hash |
| Queued | In `timelockDelay` | Report the exact execution time; execution is permissionless once it expires |
| Executed | Timelock elapsed and `execute(...)` mined | Report the transaction and the resulting state change |
| Canceled | Proposer canceled while pending | Stop; the proposer may publish again |

Practical guardrails: a proposer can hold only one active or pending proposal, so check for an existing one before building a `propose` transaction; text-only proposals will never be executed; and every write needs a signer, so an agent without keys can prepare calldata and hand it over.

## Related references

- [Staking and Delegation](./staking-and-delegation.md) — how voting power is minted, delegated, and undelegated.
- [Validators](./validators.md) — validator set, operator duties, and why validators are common delegatees.

## Sources

- <https://docs.bitgold.network/bitgold-network/governance/overview/>
- <https://docs.bitgold.network/bitgold-network/governance/user-guide/>
- <https://docs.bitgold.network/bitgold-network/governance/advocate-guide/>
- <https://docs.bitgold.network/bitgold-network/governance/temp-check/>
- <https://docs.bitgold.network/bitgold-network/governance/apis/>
