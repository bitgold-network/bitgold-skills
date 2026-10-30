# Bitgold Network — JSON-RPC Reference

Bitgold Network speaks standard Ethereum JSON-RPC 2.0. This file lists the endpoints, the transports, the methods that actually answer on the public RPC, worked request/response pairs, the operational limits, and how to read the errors. Everything marked *verified* was probed against the live endpoints on 2026-10-30; values move, so re-read fees and heights rather than copying them.

## Endpoints

| Network | Chain ID | Primary endpoint | Verified alternates |
| --- | --- | --- | --- |
| Mainnet | `618` (`0x26a`) | `https://rpc.bitgold.network` | `mainnet1`–`mainnet5`, `mainnet-jp`, `mainnet-sg` |
| Testnet | `617` (`0x269`) | `https://testnet1.bitgold.network` | none confirmed |

`mainnet6.bitgold.network`, `testnet2.bitgold.network` and `testnet3.bitgold.network` appear in the docs but did not resolve in DNS at the time of writing. Keep a fallback list and confirm identity with `eth_chainId` before trusting any host — see [./network-and-rpc.md](./network-and-rpc.md) for the full endpoint table.

## Transports

| Transport | URL form | Notes |
| --- | --- | --- |
| HTTPS POST | `https://rpc.bitgold.network` | `Content-Type: application/json`; JSON-RPC 2.0 batch arrays are accepted (verified) |
| WebSocket | `wss://rpc.bitgold.network` | **Root path, no suffix** — `/ws` fails the handshake; required for `eth_subscribe` |
| Local node IPC | `geth attach geth.ipc` | Only on a node you run yourself |

`eth_subscribe` over HTTPS POST is rejected with `-32601 notifications not supported`. Over `wss://` it works and returns a subscription id. Everything else works on both transports.

## Request and response shape

```json
{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}
```

```json
{"jsonrpc":"2.0","id":1,"result":"0x26a"}
```

Rules that matter for this chain:

- Quantities are hex strings without leading zeros (`0x0`, `0x26a`, `0x12a05f200`). Addresses and hashes are lowercase hex.
- `latest`, `pending`, `safe` and `finalized` are all accepted as block tags; use `finalized` when a reorg would be unacceptable.
- Amounts are wei at the boundary: 1 BTG = `1e18` wei. Block time is ~1 s and a block holds up to `7,000,000,000` gas.

## Method inventory

### web3_ / net_

| Method | Params | Returns | Verified |
| --- | --- | --- | --- |
| `web3_clientVersion` | none | `"Geth/v1.8.1-46e00601-20261026/linux-amd64/go1.25.10"` | yes |
| `web3_sha3` | data | keccak256 hash | yes |
| `net_version` | none | `"618"` / `"617"` | yes |
| `net_listening` | none | boolean | yes |
| `net_peerCount` | none | hex quantity | yes |

### eth_ — chain and accounts

| Method | Params | Notes |
| --- | --- | --- |
| `eth_chainId` | none | `0x26a` mainnet, `0x269` testnet. Always verify first |
| `eth_blockNumber` | none | Head height; advances ~1 per second |
| `eth_syncing` | none | `false` when the node is at head, otherwise a progress object |
| `eth_gasPrice` | none | Currently `0x12a05f200` (5 gwei). Read it, do not hardcode |
| `eth_maxPriorityFeePerGas` | none | Answers (echoes 5 gwei) even though no 1559 market exists — see the fee note below |
| `eth_feeHistory` | `blockCount`, `newestBlock`, `rewardPercentiles` | Responds, but `baseFeePerGas` is all zeros and `reward` all zeros |
| `eth_accounts` | none | Returns the **RPC operator's** account, not yours. Never send from it |
| `eth_mining` | none | `true` on the public node |

### eth_ — blocks and transactions

| Method | Params | Notes |
| --- | --- | --- |
| `eth_getBlockByNumber` | tag, `fullTx` | Header includes `milliTimestamp`, `withdrawalsRoot`, blob fields |
| `eth_getBlockByHash` | hash, `fullTx` | |
| `eth_getBlockTransactionCountByNumber` | tag | `0x0` on an empty block |
| `eth_getTransactionByHash` | hash | `null` for an unknown hash |
| `eth_getTransactionReceipt` | hash | `status` `0x1` success, `0x0` revert |
| `eth_getBlockReceipts` | tag or hash | Array of receipts when the block has any; `null` for a block with no receipts (empty block, genesis, unknown height). Verified: block `0x1` returns 7 system-transaction receipts, `latest` returns `null` |
| `eth_getUncleCountByBlockNumber` | tag | `0x0` |
| `eth_getProof` | address, slots, tag | Supported (account + storage proofs) |

### eth_ — execution and state

| Method | Params | Notes |
| --- | --- | --- |
| `eth_call` | tx object, tag | Read-only execution; a revert surfaces as an error, see below |
| `eth_estimateGas` | tx object, optional tag | Needs a funded `from` (see limits) |
| `eth_createAccessList` | tx object, tag | Exists; still needs a funded `from` |
| `eth_getCode` | address, tag | `0x` means EOA — the reliable contract check |
| `eth_getBalance` | address, tag | hex wei |
| `eth_getStorageAt` | address, slot, tag | |
| `eth_getTransactionCount` | address, tag | Use `pending` for the next nonce |
| `eth_sendRawTransaction` | signed raw tx | The only write path; returns the tx hash |

### eth_ — logs

| Method | Params | Notes |
| --- | --- | --- |
| `eth_getLogs` | filter object | **5,000-block maximum range** per call |
| `eth_newFilter` | filter object (same shape as `eth_getLogs`) | Returns a filter id |
| `eth_getFilterChanges` | filter id | New entries since the previous poll |
| `eth_uninstallFilter` | filter id | Frees the server-side filter |

### Subscriptions (WebSocket only)

`eth_subscribe` with `newHeads`, `logs`, `newPendingTransactions` or `syncing`, plus `eth_unsubscribe`. Example with the Node.js global `WebSocket` (Node 22+), no dependencies:

```js
const ws = new WebSocket("wss://rpc.bitgold.network");
ws.onopen = () =>
  ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newHeads"] }));
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id === 1) console.log("subscription id", msg.result);
  else if (msg.params?.result?.number) console.log("new head", parseInt(msg.params.result.number, 16));
};
```

### txpool_ and node namespaces

| Namespace | Status | Verified detail |
| --- | --- | --- |
| `txpool_status` | available | `{"pending":"0x0","queued":"0x0"}` |
| `txpool_content`, `txpool_inspect` | available | Standard geth shapes |
| `parlia_getSnapshot` | available | Bitgold-specific consensus extension; returns `epoch_length`, `block_interval` (ms), `turn_length`, `validators`, `recents` |
| `parlia_getEpoch`, `parlia_getValidators` | available | |
| `admin_nodeInfo` | available | Read-only node identity and genesis config; do not assume `admin_*` writes exist |
| `miner_*`, `personal_*` | **not available** | `-32601`, e.g. `miner_start does not exist/is not available` |
| `debug_*`, `trace_*` | **not available** | `-32601`, e.g. `debug_traceCall`, `trace_block` |
| `eth_protocolVersion`, `eth_hashrate` | **not available** | `-32601` |

`parlia_getSnapshot` is the practical way to see the live consensus set without an explorer:

```bash
curl -s -X POST https://rpc.bitgold.network -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"parlia_getSnapshot","params":["latest"]}'
```

`block_interval` is in milliseconds (currently `1000`), which is how you confirm the ~1 s block time from the node itself.

## Worked examples

Balance:

```bash
curl -s -X POST https://rpc.bitgold.network -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xYourAddress","latest"]}'
# {"jsonrpc":"2.0","id":1,"result":"0xde0b6b3a7640000"}   -> 1 BTG
```

ERC-20 `decimals()` read (selector `0x313ce567`):

```bash
curl -s -X POST https://rpc.bitgold.network -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0xTokenAddress","data":"0x313ce567"},"latest"]}'
# {"jsonrpc":"2.0","id":1,"result":"0x0000000000000000000000000000000000000000000000000000000000000012"}  -> 18
```

Logs, correctly windowed:

```bash
curl -s -X POST https://rpc.bitgold.network -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"fromBlock":"0x3c000","toBlock":"0x3cfff","address":"0xTokenAddress"}]}'
```

Sending a transaction is two steps: sign offline (ethers, viem, foundry `cast wallet sign`, hardware wallet), then `eth_sendRawTransaction` with the resulting hex. A legacy type-0 transaction with an explicit `gasPrice` is the shape this chain expects.

## Fee note

`baseFeePerGas` is `0x0` in every block and `eth_feeHistory` reports all-zero base fees and rewards, so there is no base fee and nothing is burned: the whole `gasPrice` reaches the validator. `eth_maxPriorityFeePerGas` still answers with 5 gwei, which makes fee-detecting libraries believe an EIP-1559 market exists. Send legacy **type-0** transactions with an explicit `gasPrice` from `eth_gasPrice`. Full context in [./evm-development.md](./evm-development.md).

## Operational limits

| Limit | Behaviour | Workaround |
| --- | --- | --- |
| `eth_getLogs` range | >5,000 blocks → `-32602 exceed maximum block range 5000` | Paginate in ≤5,000-block windows |
| `eth_subscribe` over HTTP | `-32601 notifications not supported` | Use `wss://` or poll |
| `eth_estimateGas` / `eth_createAccessList` with an empty sender | `-32000 insufficient funds for gas * price + value` | Pass the real funded sender, or omit `value` |
| Public node accounting | `eth_accounts` exposes the operator's address; `eth_mining` is `true` | Ignore both; you cannot sign with that account |

## Errors

| Code | Meaning | What to do |
| --- | --- | --- |
| `-32600` | Invalid request | Check the JSON-RPC envelope |
| `-32601` | Method not found / not available | The namespace is not exposed here — pick another method, do not retry |
| `-32602` | Invalid params | Check arity and types; e.g. `missing value for required argument 0`, or the log range cap |
| `-32000` | Server error: insufficient funds, nonce too low, underpriced, RLP/signature problem | Treat the message as authoritative; fix the transaction, do not blindly retry |
| `3` | `execution reverted` on `eth_call` | Decode `data` for a custom error, otherwise the call would fail on chain |

A revert on a system contract looks like:

```json
{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted: 0x","data":"0x"}}
```

`eth_getCode` returning `0x` is the reliable "this is not a contract" test. `eth_call` against a precompile (for example `0x…0002`, SHA-256) happily returns data, so a non-empty result does not prove a contract exists.

## Endpoint health checklist

1. `eth_chainId` → `0x26a` (mainnet) or `0x269` (testnet), never anything else.
2. `net_version` → `618` / `617`, matching the chain id.
3. `eth_blockNumber` twice, 5 s apart → the number must advance by roughly 5.
4. `eth_gasPrice` → a non-zero hex quantity.
5. `parlia_getSnapshot` → `block_interval` around `1000` and a non-empty `validators` map.
6. `eth_getLogs` over a 1,000-block window → an array, proving the endpoint is not rate-limited into failure.

If 1–3 pass but 6 fails, you are being rate-limited rather than talking to a broken node. Cache reads, batch independent calls, and keep at least two hosts configured.

## Sources

- <https://docs.bitgold.network/bitgold-network/developers/json_rpc/json-rpc-endpoint/>
- <https://docs.bitgold.network/bitgold-network/developers/json_rpc/bitgold-api-list/>
- <https://docs.bitgold.network/bitgold-network/developers/quick-guide/>
- <https://docs.bitgold.network/bitgold-network/overview/>
