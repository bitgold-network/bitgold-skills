# Bitgold Network — EVM Development

Bitgold Network runs the EVM, so the Ethereum toolchain you already use deploys and calls contracts on chain 618 (mainnet) and chain 617 (testnet) without a porting project. This file is the copy-paste setup for Hardhat, Foundry, viem, ethers and Remix, plus the one behaviour that will bite you: EIP-1559 is enabled with the base fee pinned at zero, so transactions should carry an explicit legacy `gasPrice` rather than 1559 fee fields. Every parameter and fee claim below was checked against the live chains on 2026-10-30.

## What works out of the box

Solidity compiles and deploys unchanged; the EVM is fully compatible and contracts, opcodes and ABI encoding behave as on any EVM chain. MetaMask and Trust Wallet take the network as a custom network and sign normally. Remix connects through an injected provider or a custom RPC. Hardhat, Foundry, viem and ethers v6 all talk to the public endpoints over HTTP and WebSocket. What you must configure yourself is small and mechanical: the chain IDs, the RPC URLs, and an explicit `gasPrice` on every transaction you send.

| Item | Value |
| --- | --- |
| Mainnet chain ID | `618` (`0x26A`) |
| Testnet chain ID | `617` (`0x269`) |
| Native coin | BTG / tBTG, 18 decimals, supply 200,000,000 |
| Block time | about 1 s (measured: consecutive blocks 1 s apart) |
| Block gas limit | 7,000,000,000 |
| Client | `Geth/v1.8.1`, forked from the BSC v1.8.1 codebase |
| Mainnet RPC | `https://rpc.bitgold.network` |
| Testnet RPC | `https://testnet1.bitgold.network` |
| Explorer | `https://www.bitgold.live`, `https://testnet.bitgold.live` |

## Bitgold Next is not this network

"Bitgold Next" is a separate, in-development devnet: same BTG gas asset, different client, a 200 ms block-interval target, `newl1_*` RPC methods, and no public endpoint yet. It is not mainnet, it is not testnet, and the configurations on this page do not target it. If a guide mentions `newl1_*` methods, sub-blocks or sub-second finality, it is about Bitgold Next; ignore it for chain 618/617. See [./network-and-rpc.md](./network-and-rpc.md).

## Hardhat

`hardhat.config.ts` — both networks, keys from the environment:

```ts
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    bitgold: {
      url: "https://rpc.bitgold.network",
      chainId: 618,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    bitgoldTestnet: {
      url: "https://testnet1.bitgold.network",
      chainId: 617,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
```

Then `npx hardhat run scripts/deploy.ts --network bitgoldTestnet`. A `.js` config is identical apart from the imports: `require("hardhat/config")`, `require("@nomicfoundation/hardhat-toolbox")`, and `module.exports = config`.

Two Hardhat-specific warnings:

- Do **not** rely on default fee logic. ethers' `sendTransaction` inside a Hardhat script populates EIP-1559 fields unless you pass `gasPrice` explicitly — pass the value you read from `eth_gasPrice` (`gasPrice: 5_000_000_000n` is only today's reading) so the transaction goes out as type 0.
- Do **not** add an `etherscan` / `customChains` block for Bitgold yet. That block only works against an Etherscan-compatible verifier API, and the Bitgold docs do not document one. Both explorers present a Blockscout-style interface and an Etherscan-compatible `?module=stats` API did not respond when probed on 2026-10-30. Confirm verification options on the explorer before wiring up `hardhat-verify` or `forge verify-contract`; do not assume an endpoint and do not invent one.

## Foundry

`foundry.toml`:

```toml
[profile.default]
src = "src"
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
bitgold = "https://rpc.bitgold.network"
bitgold_testnet = "https://testnet1.bitgold.network"
```

Deploy one contract, then run a script, then call it:

```bash
forge create src/MyContract.sol:MyContract --rpc-url bitgold_testnet \
  --private-key "$PRIVATE_KEY" --legacy --gas-price 5gwei

forge script script/Deploy.s.sol:Deploy --rpc-url bitgold_testnet \
  --private-key "$PRIVATE_KEY" --legacy --gas-price 5gwei --broadcast

cast call 0xYourContract "totalSupply()(uint256)" --rpc-url bitgold
cast send 0xYourContract "transfer(address,uint256)" 0xRecipient 1000000000000000000 \
  --rpc-url bitgold_testnet --private-key "$PRIVATE_KEY" --legacy --gas-price 5gwei
```

`--legacy` is what forces a type-0 transaction; without it Foundry builds an EIP-1559 transaction. These commands read `$PRIVATE_KEY` from your environment — export it in the shell rather than pasting a key into a command you save.

## viem

```ts
import { createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const bitgold = defineChain({
  id: 618,
  name: "Bitgold",
  nativeCurrency: { name: "Bitgold", symbol: "BTG", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.bitgold.network"] } },
  blockExplorers: {
    default: { name: "Bitgold Explorer", url: "https://www.bitgold.live" },
  },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const client = createWalletClient({ account, chain: bitgold, transport: http() });
const hash = await client.sendTransaction({
  to: "0xRecipient", value: parseEther("0.01"),
  gasPrice: 5_000_000_000n, type: "legacy",
});
```

Pass `gasPrice` together with `type: "legacy"`. If you leave both out, viem's fee estimation returns EIP-1559 fields built from a zero base fee and a 5 gwei tip, which is not the transaction shape this chain expects.

## ethers v6

```ts
import { JsonRpcProvider, Wallet, parseEther } from "ethers";

const provider = new JsonRpcProvider("https://rpc.bitgold.network", 618, {
  staticNetwork: true,
});
const wallet = new Wallet(process.env.PRIVATE_KEY as string, provider);

const tx = await wallet.sendTransaction({
  to: "0xRecipient", value: parseEther("0.01"), gasLimit: 21000n,
  gasPrice: 5_000_000_000n, type: 0,
});
const receipt = await tx.wait();
```

Setting `gasPrice` makes ethers v6 build a legacy transaction; adding `type: 0` states that explicitly so nothing overrides it. Read-only calls (`contract.balanceOf(...)`) need none of this.

## Remix

1. Open `https://remix.ethereum.org` and compile as usual — no Bitgold-specific compiler settings.
2. With a browser wallet, pick **Injected Provider - MetaMask** under *Deploy & Run Transactions* and switch the wallet to Bitgold mainnet or testnet first.
3. Without a wallet, choose **Custom - External Http Provider** and enter `https://rpc.bitgold.network` or `https://testnet1.bitgold.network`; Remix derives the chain ID from the endpoint.
4. If a deployment stalls on fee fields, set the gas price to `5` gwei manually in the transaction panel and set the gas limit yourself instead of accepting a padded value.

## Gas and fees

EIP-1559 is enabled but inert: the base fee is pinned at zero, so there is no burn and no dynamic fee market to reason about. Verified on both chains on 2026-10-30:

- `eth_gasPrice` returns `0x12a05f200`, i.e. **5 gwei**, on mainnet and testnet. Treat 5 gwei as a reading, not a constant.
- `eth_maxPriorityFeePerGas` is accepted and echoes the same `0x12a05f200`. The method existing does not mean a real 1559 market exists.
- `baseFeePerGas` is `0x0` in the header of every block sampled.
- `eth_feeHistory` over the last two blocks returns `baseFeePerGas: ["0x0", "0x0"]` and `reward: [["0x0", "0x0", "0x0"]]`. There is no base fee, so nothing is burned.

The literals `5_000_000_000n` and `--gas-price 5gwei` in the snippets below are today's readings used as examples; read `eth_gasPrice` at send time instead of hardcoding them.

Reproduce the fee-history check yourself:

```bash
curl -s -X POST https://rpc.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_feeHistory","params":["0x2","latest",[10,50,90]]}'
```

What that means in practice:

- Send **legacy type-0 transactions with an explicit `gasPrice`**. 5 gwei is what the node reports as the current price.
- `eth_estimateGas` plus a `gasPrice` is sufficient. Estimate the limit, add your usual margin, set the price; there is no tip-versus-base split to reason about.
- With `baseFeePerGas` pinned to zero there is no base fee to burn, so the whole `gasPrice` goes to the validator. Cost is predictable and does not move with block fullness.
- If a library sends an EIP-1559 transaction anyway, the client's decoder does recognise the type-2 envelope: a type-2 payload is parsed as `types.DynamicFeeTx` and fails later on structure, not with an "unsupported transaction type" rejection. We did not broadcast a funded type-2 transaction, so acceptance at execution time is unconfirmed — pin transactions to type 0 with an explicit `gasPrice`. With a zero base fee a 1559 transaction would in effect pay only its priority fee, which is exactly the silent surprise to avoid.
- The block gas limit is 7,000,000,000, so block fullness is never your constraint; per-transaction limits and your own estimation are.

## Differences from Ethereum you must handle

| Difference | Bitgold | What to do |
| --- | --- | --- |
| Fee market | Base fee pinned at `0x0`; nothing burned; `eth_gasPrice` currently 5 gwei | Send type-0 transactions with an explicit `gasPrice` read at send time |
| Block time | About 1 s | Never hardcode 12 s per block; one day is ~86,400 blocks |
| Block gas limit | 7,000,000,000 | Never assume a 30M ceiling; still cap your own gas per transaction |
| Chain IDs | 618 mainnet, 617 testnet | Set `chainId` explicitly and reject mismatches |
| Receipts and history | Read from `bitgold.live`, not Etherscan | Use `https://www.bitgold.live` / `https://testnet.bitgold.live` |
| Contract verification | No documented verifier API | Confirm options on the explorer before configuring a plugin |
| Tooling defaults | `eth_maxPriorityFeePerGas` answers, so tools assume 1559 | Force legacy transactions; do not trust auto-detected fee mode |

## Smoke test with cast

Against testnet, in order:

```bash
export RPC=https://testnet1.bitgold.network
export ADDRESS=0xYourAddress

cast chain-id     --rpc-url "$RPC"    # expect 617
cast block-number --rpc-url "$RPC"    # advances by ~1 per second
cast balance      "$ADDRESS" --rpc-url "$RPC"
cast gas-price    --rpc-url "$RPC"    # expect 5000000000
```

Repeat with `RPC=https://rpc.bitgold.network` and expect `618`. A balance of `0` on a fresh testnet address is normal: claim tBTG from `https://faucet.bitgold.network` first. To confirm a deploy landed, run `cast receipt <hash> --rpc-url "$RPC"` and check `status` is `1`.

## Read next

- [./network-and-rpc.md](./network-and-rpc.md) — chain identity, consensus, every endpoint, wallet parameter blocks.
- [./json-rpc.md](./json-rpc.md) — method-level reference, including finality and blob extensions.
- [./wallets-and-faucet.md](./wallets-and-faucet.md) — add the network to MetaMask or Trust Wallet and claim tBTG.

## Sources

- https://docs.bitgold.network/bitgold-network/developers/quick-guide/
- https://docs.bitgold.network/bitgold-network/developers/json_rpc/json-rpc-endpoint/
- https://docs.bitgold.network/bitgold-network/overview/
- https://docs.bitgold.network/bitgold-network/developers/wallet-configuration/

The Bitgold Next pages (`/bitgold-next/overview/`, `/bitgold-next/get-started/migrate-from-bitgold/`) were consulted only to state that Bitgold Next is a separate devnet; nothing in them describes chain 618 or 617, so none of their values are used above.
