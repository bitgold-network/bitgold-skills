# Bitgold Network — Wallets and Faucet

Bitgold Network is an EVM chain, so any wallet that supports custom EVM networks can hold BTG and tBTG. This file gives the exact field values, the add-network steps for MetaMask and Trust Wallet, the testnet faucet flow and its limits, how to verify a funded account on the explorer, and what to do when a balance or a transfer does not appear.

## Network field values

| Field | Mainnet | Testnet |
| --- | --- | --- |
| Network name | Bitgold Mainnet | Bitgold Testnet |
| RPC URL | `https://rpc.bitgold.network` | `https://testnet1.bitgold.network` |
| Chain ID (decimal) | 618 | 617 |
| Chain ID (hex) | 0x26A | 0x269 |
| Currency symbol | BTG | tBTG |
| Currency name | Bitgold | tBitgold |
| Decimals | 18 | 18 |
| Block explorer | `https://www.bitgold.live` | `https://testnet.bitgold.live` |
| Faucet | Not available | `https://faucet.bitgold.network` |
| Monetary value | Market-priced | None |

Alternative RPC hosts exist (`mainnet1`–`mainnet6`, `mainnet-jp`, `mainnet-sg`, `testnet1`–`testnet3`), but `mainnet6`, `testnet2` and `testnet3` did not resolve on 2026-10-30. Keep the primary host in the RPC field and see [./network-and-rpc.md](./network-and-rpc.md) for the verified list.

## MetaMask

1. Open MetaMask and go to **Settings → Networks → Add network → Add a network manually**.
2. Enter the values from the table above for the network you want.
3. Save, then switch to the new network from the network selector.

What goes in each MetaMask field:

| MetaMask field | Mainnet | Testnet |
| --- | --- | --- |
| Network name | Bitgold Mainnet | Bitgold Testnet |
| New RPC URL | `https://rpc.bitgold.network` | `https://testnet1.bitgold.network` |
| Chain ID | 618 | 617 |
| Currency symbol | BTG | tBTG |
| Block explorer URL | `https://www.bitgold.live` | `https://testnet.bitgold.live` |

MetaMask accepts the decimal chain ID and encodes it itself; if you pass hex, use `0x26A` or `0x269`. MetaMask queries the RPC URL and compares the reported chain ID. A "Chain ID does not match" error means the endpoint you typed is not serving that network — check it with the curl test in [./network-and-rpc.md](./network-and-rpc.md) before retrying. dApps can add the network without manual entry by calling `wallet_addEthereumChain` with the JSON parameter block from that same file.

## Trust Wallet

1. Open Trust Wallet and go to **Settings → Network → Add Custom Network**.
2. Enter the values from the table above for the network you want.
3. Save, then select the network from the network list.

| Trust Wallet field | Mainnet | Testnet |
| --- | --- | --- |
| Name | Bitgold Mainnet | Bitgold Testnet |
| RPC URL | `https://rpc.bitgold.network` | `https://testnet1.bitgold.network` |
| Chain ID | 618 | 617 |
| Symbol | BTG | tBTG |
| Block explorer URL | `https://www.bitgold.live` | `https://testnet.bitgold.live` |

Trust Wallet identifies a custom network by its chain ID, so do not create a second entry for 618 or 617; edit the existing one instead, or the two will conflict in the network list.

## Verify the connection

After switching, the wallet's primary balance should be labelled **BTG** on mainnet or **tBTG** on testnet, with 18 decimals. A balance of `0` with the correct symbol means the network is configured and the address is simply unfunded.

Two independent checks:

- Explorer: open `https://www.bitgold.live` or `https://testnet.bitgold.live` and search your address. The explorer shows the native balance and every transaction for that address.
- RPC: query `eth_chainId` and compare with the expected value.

```bash
curl -s -X POST https://testnet1.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

A result of `0x269` confirms testnet, `0x26a` confirms mainnet. If a wallet shows a different symbol or a fiat value that looks wrong, the wrong network is selected, not a wrong balance.

## Testnet faucet

The faucet at `https://faucet.bitgold.network` distributes **tBitgold (tBTG)** for development and testing. tBTG has no monetary value and exists only on Bitgold Testnet (chain ID 617).

Flow:

1. Add Bitgold Testnet to your wallet first, using the fields above.
2. Open `https://faucet.bitgold.network`.
3. Paste the receiving wallet address into the address field. Use a plain `0x` address on chain 617; do not paste a seed phrase or private key.
4. Complete any verification step the faucet shows at that moment.
5. Submit the request and wait for the transaction to confirm.

Requirements and limits:

| Item | Detail |
| --- | --- |
| Network | Testnet only; there is no mainnet faucet |
| Asset | tBTG, 18 decimals, no monetary value |
| Verification | A challenge or check may be required per request; follow what the page shows |
| Amount per request | Set by the faucet service, not published as a fixed number |
| Cooldown | Per-address and per-IP limits are enforced by the service and can change without notice |
| Larger test allocations | Request through the project or team channels published on `https://www.bitgold.network` |

Because the amounts and cooldowns are service-side and can change, do not hardcode an expected drip size in tests or documentation. Read the balance after the transaction confirms instead.

Faucet troubleshooting:

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Balance does not appear | Wallet on another network, or the request transaction failed | Confirm chain ID 617; check the request transaction on `https://testnet.bitgold.live` |
| Request rejected | Per-address or per-IP limit reached | Wait for the cooldown, then retry |
| Tokens sent to the wrong network | Mainnet assets are not testnet assets | tBTG exists only on chain 617; never send mainnet BTG to a testnet address |

## Verify a funded account

1. Copy the address from the wallet and confirm the wallet is on Bitgold Testnet.
2. Open `https://testnet.bitgold.live` and search the address.
3. Check the native balance is non-zero and denominated in tBTG.
4. Open the faucet transaction from the address history and confirm its status is successful.

The same balance from the RPC, which avoids relying on the explorer UI:

```bash
curl -s -X POST https://testnet1.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYourAddressHere","latest"],"id":1}'
```

The result is a hex quantity in wei. `0xde0b6b3a7640000` is 1 tBTG; divide the decimal value by 1e18 to compare with what the wallet shows. A successful faucet request whose `eth_getBalance` stays at `0x0` means the funds went to a different address than the one you queried.

## Tokens not showing in wallet

Native BTG and tBTG appear automatically. Contract tokens do not: a wallet shows a token only after its contract is registered locally, unless the wallet already ships a token list for chain 618 or 617.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Balance missing entirely | Wrong network selected | Switch to Bitgold Mainnet (618) or Testnet (617) |
| Transaction confirmed, token absent | Token contract never imported | Add the token manually by contract address |
| Token imported, still zero | Imported on the wrong chain, or the transfer went to another address | Re-check the tx on the explorer for recipient and chain |
| Airdrop not visible | Distribution still pending | Check the project's announced distribution timeline |
| NFT missing | Wallet does not render that token standard | View it on an NFT-capable platform, or use a wallet that supports the standard |
| Bridged token missing | Bridge transaction not final on both sides | Re-open the bridge UI and check status; add the token manually once final |

Custom-token import:

1. Open `https://www.bitgold.live` (or `https://testnet.bitgold.live` on testnet) and search the token name or symbol.
2. Open the token's contract page and copy the contract address. Use the address from the explorer or the project itself, never one sent in a direct message.
3. In the wallet choose **Add Token** (MetaMask) or **Import Token** (Trust Wallet).
4. Paste the contract address and let the wallet fill symbol and decimals, or enter them manually. Most tokens on this chain use 18 decimals, but always use the value the contract reports.

Confirm the decimals from the contract rather than from a screenshot. `decimals()` is selector `0x313ce567`:

```bash
curl -s -X POST https://rpc.bitgold.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0xTokenContractAddress","data":"0x313ce567"},"latest"],"id":1}'
```

A result of `0x12` is 18 decimals. Importing a token with the wrong decimals shows a balance off by powers of ten; the on-chain balance is unaffected.

## Recovering tokens sent to the wrong chain or address

Recovery depends on one thing: whether you control the key of the address that received the tokens. Every EVM chain uses the same address format, so a Bitgold address is a valid address on other EVM chains and vice versa — which is exactly why this mistake happens.

| Scenario | Do you control the recipient? | Outcome |
| --- | --- | --- |
| Sent to another chain, to your own address | Yes | Recoverable by switching networks and importing the token there |
| Sent to a different address you own | Yes | Recoverable by importing that address and sending back |
| Sent to an exchange deposit address | No | Only the exchange can help; many decline unsupported networks |
| Sent to a stranger's address | No | Not recoverable without the recipient's cooperation |

Wrong chain, address you control:

1. Open the wallet that holds the key for the recipient address.
2. Switch to the network the tokens were actually sent on.
3. If the token is not visible there, add it manually using its contract address on that network.
4. The balance now appears in the correct chain context and can be moved back through a bridge or exchange that supports both networks.

Wrong address, key you control:

1. Import the recipient address into a wallet using its private key or recovery phrase.
2. Switch to the network the tokens were sent on.
3. Add the token contract if it is not shown.
4. Send the tokens back to your main address, then stop using the imported key in that wallet if it was a one-off recovery.

If you do not control the address, contact the receiving platform with the transaction hash, the sending and receiving addresses, the network used, and the token name. There is no protocol-level reversal on Bitgold Network or any EVM chain, so a transfer cannot be cancelled or clawed back once it is finalized.

## Wallet safety

- Never paste a seed phrase or private key into a website, faucet, form, chat, or "support" agent. No legitimate faucet, explorer, or RPC endpoint ever asks for one.
- Use a dedicated throwaway wallet for testnet work. Treat testnet keys as public, and never reuse a mainnet key on chain 617.
- Import a recovery phrase only into wallet software you have verified, and only on a device you control.
- Verify token contract addresses from the explorer or the project's own site. Anyone can deploy a token with the same name and symbol as a real one.
- Check the chain ID before signing. A wallet connected to the wrong network will happily sign a transaction that spends nothing or sends value on the wrong chain.
- Keep mainnet BTG in a hardware wallet or a wallet whose keys never touch a browser page, and review token approvals periodically.

## Read next

- [./network-and-rpc.md](./network-and-rpc.md) — chain IDs, all RPC endpoints, wallet chain-parameter JSON, fee behaviour.
- [./evm-development.md](./evm-development.md) — deploy contracts and connect Hardhat, Foundry, ethers.js or viem.
- [./json-rpc.md](./json-rpc.md) — method-level RPC reference, including finality and blob extensions.
- [./node-operations.md](./node-operations.md) — run a full node or validator.

## Sources

- https://docs.bitgold.network/bitgold-network/developers/wallet-configuration/
- https://docs.bitgold.network/bitgold-network/developers/faucet/
- https://docs.bitgold.network/bitgold-network/developers/quick-guide/
- https://docs.bitgold.network/bitgold-network/faq/
- https://docs.bitgold.network/bitgold-network/faq/tokens-not-showing-in-wallet/
- https://docs.bitgold.network/bitgold-network/faq/recovering-tokens-sent-to-wrong-chain-or-address/
