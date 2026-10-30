# Staking and Delegation

Bitgold Network runs Proof-of-Staked-Authority (PoSA): a stake-elected validator set produces blocks in a Proof-of-Authority rotation, and BTG holders delegate behind validators to share the transaction fees those validators earn. This reference covers the mechanics, the delegator workflow, the risks, and the contract interface an agent or dApp must call.

Mainnet chain ID `618` (`0x26A`), testnet `617` (`0x269`), coin `Bitgold (BTG)` 18 decimals, fixed supply 200,000,000 BTG, ~1 s blocks, client Geth v1.8.1, forked from the BSC v1.8.1 codebase.

> **Risk note:** staking parameters can change; the values returned by the on-chain contracts, not this page, are authoritative.

## How PoSA staking works

- Blocks are produced by a limited validator set; validators take turns in a PoA manner.
- Validator membership is elected in and out by stake: a validator's weight is its own stake plus everything delegated to it.
- The top validators by stake form the active set; the rest are standby and can enter when their stake rises or an active validator drops out.
- Anyone can join by creating a validator on-chain and attracting delegations, and can leave by withdrawing all delegations.
- Validators can also be removed by slashing, the penalty for misbehaving or being offline.

### Validator set roles

| Role | Rank by stake | Block production | Documented size |
| --- | --- | --- | --- |
| Cabinet | Top K | Highest chance | K = 21 ("currently 21") |
| Candidate | Between K and K + NumOfCandidates | Smaller chance | `(21, 45]` |
| Inactive | Remaining validators | None | — |

Roles are recomputed every 24 hours from the latest staking information; after UTC 00:00 the consensus engine sorts validators and updates the set.

K = 21 and the `(21, 45]` candidate band are the **documented protocol design**, not the current headcount: the live mainnet consensus set held 6 validators on 2026-10-30 (`parlia_getSnapshot`). Read the current set before quoting a size - see [./validators.md](./validators.md).

### System contracts

| Contract | Role (as documented) |
| --- | --- |
| Validator Set Contract | Periodically elects the validator set; vault for rewards pending distribution |
| System Reward Contract | Collects part of transaction fees for public purposes, e.g. fast-finality rewards |
| Slash Contract | Tracks unavailability and triggers penalties at a threshold; also handles double signing and malicious fast-finality voting |
| Stake Hub `0x0000000000000000000000000000000000002002` | Entry point for validator and delegation management; executes slashing, and forwards delegate/undelegate/redelegate to the validator's implementation contract |

### Credit contracts (`st{{moniker}}`)

Each validator gets a credit contract, deployed by `StakeHub` at creation. It is ERC-20 compatible, cannot be upgraded or replaced by the operator, and holds that validator's staked BTG plus accrued rewards. Delegating BTG mints credit; undelegating burns credit and releases BTG.

| Property | Documented value |
| --- | --- |
| Token name | `Stake{{validator moniker}}Credit` |
| Token symbol | `st{{validator moniker}}` (validator `ExampleValidator` → `stExampleValidator`) |
| Transferable | No; non-transferable between addresses, unique per validator |
| Rewards | Auto-compounding: credit value rises as the pool earns |

### Reward mechanics

- Rewards come from transaction fees: when a block is produced, the majority of the block fee goes to the proposing validator.
- Once per day part of the collected reward is sent to the validator operator as commission; the remainder goes to the credit contract, raising every credit token's value (auto-compound).
- Reward is distributed to each validator's BTG pool at `00:00:00 UTC` daily; `StakeHub` keeps per-day totals so APR/APY can be computed off-chain.
- When a user undelegates and claims, the accumulated reward plus the original stake is returned.

Your credit value in BTG, per the documented formula:

```text
BTG value = (stCreditAmount × totalPooledBTG) ÷ totalSupply()
```

Documented example: 100 stCredit against a 10,000 BTG / 10,000 supply pool is 100 BTG; the same 100 stCredit against 11,000 BTG / 10,000 supply is 110 BTG (+10%).

### Documented parameters and minimums

| Parameter | Value stated in the docs | Notes |
| --- | --- | --- |
| Validator minimum self-delegation | 2000 BTG | Required to become a validator |
| Validator creation lock | 1 BTG | Locked in addition to self-delegation |
| Total value on `createValidator` | 2001 BTG | "lock amount plus any self-delegation, in total 2001 BTG" |
| Redelegation fee | 0.002% | Charged to discourage frequent switching; read the live value from `StakeHub` before quoting it to a user |
| Unbonding period | 7 days ("currently 7 days") | Before undelegated stake can be claimed |
| Reward distribution | Daily, 00:00:00 UTC | Commission to operator, remainder to pool |
| Validator set refresh | Every 24 h, after UTC 00:00 | Cabinet K = 21, candidates `(21, 45]` |

Values the docs do **not** state are left to on-chain reads rather than guessed: the minimum delegation a delegator may open with, commission bounds (`maxRate`, `maxChangeRate`), per-validator APR/APY, and the unbonding queue length. Pull them from `StakeHub` (`getValidatorBasicInfo`, `getValidatorCommission`), from the validator's credit contract, or from the app; the exact field layout comes from the ABI, not from this page.

## Delegator user guide

App: <https://app.bitgold.network/staking> (switch to testnet for chain ID `617`); validator list at <https://app.bitgold.network/staking/validators>.

1. **Connect a wallet.** MetaMask, TrustWallet, or any WalletConnect-compatible wallet; confirm it is on the correct Bitgold network first.
2. **Pick a validator.** The validator page shows commission, total stake, and performance history.
3. **Delegate.** Click **Delegate**, enter the BTG amount, confirm in the wallet. The delegation appears under **My Staking** with its transaction hash.
4. **Watch rewards accrue.** You hold `st{{moniker}}` credit and its BTG value rises with the pool; there is no manual compounding step.
5. **Redelegate if needed.** **My Staking** → **Redelegate** → new validator and amount (all or part); a 0.002% fee applies.
6. **Undelegate.** **Undelegate** → full or partial amount; the stake is locked for the unbonding period (currently 7 days).
7. **Claim.** After unbonding, click **Claim** to receive stake plus rewards.

There is **no standalone "claim rewards" transaction documented**. Rewards live inside the credit pool and are realized on undelegate + claim, so an agent should not promise a separate reward-claim step.

## Risks

- **Downtime and slashing exposure.** The Slash Contract tracks unavailability and penalizes past a threshold, and a slashed validator can be removed from the set; delegated stake sits behind that behavior. See [Slashing and MEV](./slashing-and-mev.md).
- **Lock-up.** Undelegated stake is illiquid for the unbonding period (currently 7 days), and claiming is a separate transaction afterwards.
- **No guaranteed return.** Reward is a share of fees, so APR/APY varies per validator and per day; the docs publish no fixed rate. Commission can change via `editCommissionRate` within the bounds the validator committed to.
- **Precision loss.** Integer division means undelegating 1 BTG immediately returns `0.99...99` BTG (about `1e-18` BTG lost); round display values.
- **Credit is non-transferable**, so a delegation cannot be sold or moved to another address; only `redelegate` changes validator.

## Developer guide

`StakeHub` at `0x0000000000000000000000000000000000002002` is the entry point; the full ABI ships as a file alongside the docs. Signatures below are exactly as documented.

```solidity
function createValidator(address consensusAddress, bytes calldata voteAddress, bytes calldata blsProof, Commission calldata commission, Description calldata description) external payable
function editConsensusAddress(address newConsensusAddress) external
function editCommissionRate(uint64 newCommissionRate) external
function editDescription(Description memory newDescription) external
function editVoteAddress(bytes calldata newVoteAddress, bytes calldata blsProof) external
function delegate(address operatorAddress, bool delegateVotePower) external payable
function undelegate(address operatorAddress, uint256 shares) external
function redelegate(address srcValidator, address dstValidator, uint256 shares, bool delegateVotePower) external
function claim(address operatorAddress, uint256 requestNumber) external
function claimBatch(address[] calldata operatorAddresses, uint256[] calldata requestNumbers) external
```

- `delegate` and `redelegate` take `delegateVotePower`, which hands governance voting power to that validator; pass `false` if the user votes themselves (see [Governance](./governance.md)).
- `undelegate` and `redelegate` take **shares** (credit units), not BTG — convert with `getSharesByPooledBTG` first.
- `claim` takes `requestNumber`, where `0` claims from all unbonding requests.

| Contract | Read function | Returns |
| --- | --- | --- |
| Credit | `balanceOf(address)` | Delegator's credit balance (shares) |
| Credit | `getPooledBTG(address)` | Delegator's BTG value in the pool |
| Credit | `getPooledBTGByShares(uint256)` | BTG for a given amount of shares |
| Credit | `getSharesByPooledBTG(uint256)` | Shares for a given BTG amount |
| Credit | `totalSupply()` | Total credit supply, needed for the value formula |
| Credit | `pendingUnbondingRequests(address)` | Count of unbonding requests (called `pendingUnbondRequest` in the docs FAQ) |
| Credit | `unbondRequest(address,uint256)` | Details of one unbond request; decode the struct from the ABI |
| Credit | `claimableUnbondRequest(address)` | Count of claimable requests |
| Credit | `lockedBTGs(address,uint256)` | BTG locked across the first `number` requests; `0` = all |
| StakeHub | `getValidators()` | All validators, including operator and credit contract addresses |
| StakeHub | `getValidatorCreditContract`, `getValidatorConsensusAddress`, `getValidatorVoteAddress` | Single-value getters |
| StakeHub | `getValidatorBasicInfo`, `getValidatorDescription`, `getValidatorCommission` | Struct getters |
| StakeHub | `getValidatorTotalPooledBTGRecord(address,uint256)` | Pooled BTG record for a day index |
| StakeHub | `getValidatorRewardRecord(address,uint256)` | Reward record for the same day index |
| StakeHub | `BREATHEBLOCKINTERVAL` | Blocks per day interval, for the index math |

Confirm `pendingUnbondingRequests` against the deployed ABI (the docs use both spellings), and never hard-code return shapes for `getValidatorBasicInfo`, `getValidatorCommission`, `unbondRequest` or `getValidators` — decode them from the ABI.

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.bitgold.network');
const STAKE_HUB = '0x0000000000000000000000000000000000002002';
const OPERATOR = '0x...';                 // validator operator address
const DELEGATOR = '0x...';                // your account

const hub = new ethers.Contract(STAKE_HUB, [
  'function getValidatorCreditContract(address) view returns (address)',
], provider);

const credit = new ethers.Contract(
  await hub.getValidatorCreditContract(OPERATOR),
  [
    'function balanceOf(address) view returns (uint256)',
    'function getPooledBTG(address) view returns (uint256)',
    'function claimableUnbondRequest(address) view returns (uint256)',
  ],
  provider,
);

console.log('shares', (await credit.balanceOf(DELEGATOR)).toString());
console.log('BTG value', ethers.formatEther(await credit.getPooledBTG(DELEGATOR)));
console.log('claimable', (await credit.claimableUnbondRequest(DELEGATOR)).toString());
```

Reward accounting is off-chain arithmetic: contracts do not store the initial delegation, so track what you delegated and subtract it from the current `getPooledBTG` value.

```bash
export RPC=https://rpc.bitgold.network
export HUB=0x0000000000000000000000000000000000002002
export CREDIT=$(cast call $HUB "getValidatorCreditContract(address)(address)" $OPERATOR --rpc-url $RPC)

# delegate 10 BTG, keeping voting power
cast send $HUB "delegate(address,bool)" $OPERATOR false --value 10ether --rpc-url $RPC --private-key $PK
# undelegate 5 BTG worth of shares, then claim all unbonding requests once unbonded
cast send $HUB "undelegate(address,uint256)" $OPERATOR $(cast call $CREDIT "getSharesByPooledBTG(uint256)(uint256)" 5ether --rpc-url $RPC) --rpc-url $RPC --private-key $PK
cast send $HUB "claim(address,uint256)" $OPERATOR 0 --rpc-url $RPC --private-key $PK
```

APR/APY per the docs: read `BREATHEBLOCKINTERVAL`, take a block header timestamp as `index = headerTime / interval`, then `rate = getValidatorRewardRecord(op, index) / getValidatorTotalPooledBTGRecord(op, index)` and `APY = (1 + rate) ^ 365 - 1`. Each validator has its own rate and the app surfaces the same figures.

## Task → where to do it

| Task | App UI | Contract call | CLI |
| --- | --- | --- | --- |
| Browse validators, commission, performance | `/staking/validators` | `getValidators()` + per-validator getters | `cast call` |
| Delegate | **Delegate** on validator page | `delegate(address,bool)` payable | `cast send` |
| Move stake between validators | **My Staking** → **Redelegate** | `redelegate(address,address,uint256,bool)` | `cast send` |
| Undelegate / start unbonding | **My Staking** → **Undelegate** | `undelegate(address,uint256)` with shares | `cast send` |
| Claim after unbonding | **My Staking** → **Claim** | `claim(address,uint256)` / `claimBatch` | `cast send` |
| Check my stake value | **My Staking** | credit `getPooledBTG(address)` | `cast call` |
| Check unbonding status | Not always surfaced | `claimableUnbondRequest`, `lockedBTGs` | `cast call` |
| Create a validator (2001 BTG) | Not in the staking app | `createValidator(...)` payable | `cast send` |

## Sources

- <https://docs.bitgold.network/bitgold-network/staking/overview/>
- <https://docs.bitgold.network/bitgold-network/staking/user-guide/>
- <https://docs.bitgold.network/bitgold-network/staking/developer-guide/>
