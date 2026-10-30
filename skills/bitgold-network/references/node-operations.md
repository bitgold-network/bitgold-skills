# Bitgold Network node operations

Bitgold Network is an EVM-compatible L1, forked from the BSC v1.8.1 codebase, running a Geth-based client. A deployment is the `geth` binary plus two per-network files: `config.toml` (network, P2P, storage settings) and `genesis.json` (genesis and chain config).

| Property | Mainnet | Testnet |
|---|---|---|
| Chain ID | 618 (`0x26A`) | 617 (`0x269`) |
| Client string (verified live 2026-10-30) | `Geth/v1.8.1-46e00601-20261026/linux-amd64/go1.25.10` | same binary |
| Block time | ~1 s | ~1 s |
| Block `gasLimit` | 7,000,000,000 | 7,000,000,000 |
| `baseFeePerGas` | `0x0` | `0x0` |

`baseFeePerGas` is `0x0`: no base-fee burn on inclusion, so do not budget node load or user cost around burned base fees.

## Which node type do I need

| Node type | Stores | Sync mode and key flags | Disk (documented) | Use case |
|---|---|---|---|---|
| Full | Full world state for recent blocks; executes and validates new blocks | `--syncmode snap` for the initial sync, then `full` automatically | 3 TB SSD | RPC serving, state proofs, validator candidate — the default choice |
| Archive | All historical state since genesis | `--gcmode archive --syncmode full` | 10 TB SSD/NVMe | `eth_call` against old blocks, `debug_trace*` over full history, backtesting, exchange history |
| Fast | Full chain history, **no trie data** | `--tries-verify-mode none` | 2 TB SSD | Highest-throughput RPC at the lowest disk and RAM cost. **Cannot be converted back**: restoring full-node behaviour means re-downloading a snapshot |
| Bootnode | No chain state | Discovery on, no block production | ~20 GB | Peer discovery; 2 cores / 2 GB is enough for a small deployment |

Syncing a full node from genesis is explicitly not recommended because of historical data size — start from a snapshot. Public bootnodes are maintained by the Bitgold team; contact them through the official channels to have one added to the published list.

## Hardware recommendations

Figures come from the node best-practices page. It gives one set with no mainnet/testnet split, so the same sizing applies to both networks.

| Node type | CPU | RAM | Disk | Network |
|---|---|---|---|---|
| Fast (recommended configuration) | Minimum 16-core | At least 32 GB | SSD, minimum 2 TB | Stable, high-speed, minimum 5 MBps |
| Archive | Minimum 16-core | At least 128 GB | SSD, minimum 10 TB; NVMe recommended | Stable, high-speed, minimum 5 MBps |
| Full | Minimum 16-core | At least 64 GB | SSD, minimum 3 TB | Stable, high-speed, minimum 5 MBps |
| Bootnode | 2 cores | 2 GB | ~20 GB | Not stated |

- The archive page says "32 GB or more is a practical starting point" for RAM while best practices says 128 GB. Size to 128 GB; treat 32 GB as a lab floor.
- Maintenance page disk spec: 3 TB free, SSD, gp3, 8k IOPS, 500 MB/s, read latency under 1 ms — NVMe if starting with snap sync. Disk figures cover the current chain only; check current snapshot sizes before provisioning, and give the cache about one third of physical RAM (`--cache 20000` for a 64 GB host).

## Install and run

The docs publish no download URL and no registry path; binary, config files, and snapshots come from the official Bitgold channels, with [www.bitgold.network](https://www.bitgold.network) as the entry point, under a path shaped like `<OFFICIAL-DISTRIBUTION-CHANNEL>/geth-v1.8.1-<os>-<arch>` (placeholder — no URL is documented). Building from source is documented as `make geth`.

Place the config files next to the binary. Layout uses the paths the docs reference (`geth.log`, `geth/nodes`, `geth/nodekey`, `chaindata/ancient`, `geth.ipc`):

```text
/opt/bitgold/
├── geth                 # binary
├── genesis.json
├── config.toml
└── node/                # --datadir: geth.log, geth.ipc, keystore/
    └── geth/{chaindata/ancient,nodekey,nodes}/
```

### Full and archive nodes

```bash
# Full node. Replace <datadir> with the path to your data directory.
./geth --config ./config.toml --datadir <datadir> \
  --cache 10000 --rpc.allow-unprotected-txs \
  --history.transactions 0 --history.logs 576000

# Archive node: same command plus archive mode over the full chain.
./geth --config ./config.toml --datadir <datadir> \
  --gcmode archive --syncmode full \
  --cache 10000 --rpc.allow-unprotected-txs \
  --history.transactions 0 --history.logs 576000
```

Add `--history.logs.disable` for better performance, at the cost of slower `eth_getLogs`.

### Fast node

```bash
./geth db delete-trie-state --datadir ./node   # once, after extracting the snapshot

./geth --tries-verify-mode none --rpc.allow-unprotected-txs \
  --cache 10000 --history.transactions 360000 \
  --datadir <datadir> --http.corsdomain '*' \
  --config ./config.toml --history.logs 576000
```

### Bootnode

```bash
./geth --config ./config.toml --datadir <datadir> \
  --cache 1024 --maxpeers 200 --nodiscover=false
```

### Adding an HTTP endpoint

No page documents a production `--http` line. The HTTP flags that appear are `--http.addr`, `--http.port`, `--http.vhosts`, `--http.corsdomain` (fast node), and the note that `--http --http.addr 0.0.0.0` enables RPC (Docker). Two placeholders are unavoidable: `--http.api` (no page lists a namespace set — enable only what consumers need) and `--ws.*` (WebSocket flags appear on no node-operator page; check `geth --help`). A local-only variant:

```bash
./geth --config ./config.toml --datadir <datadir> \
  --cache 10000 --rpc.allow-unprotected-txs \
  --history.transactions 0 --history.logs 576000 \
  --http --http.addr 127.0.0.1 --http.port <rpc-port> \
  --http.vhosts 'localhost,127.0.0.1' --http.api <namespaces>
```

## config.toml

Only the `[Eth]` and `[Node.P2P]` keys below are documented. Other keys exist in the shipped file but are undescribed — keep the copy from your release rather than writing one by hand from this excerpt.

```toml
# ---- mainnet ----
[Eth]
NetworkId = 618              # chain ID 0x26A
SyncMode = "snap"            # documented values: "snap" | "full"
TrieTimeout = <duration>     # documented key, no published value; governs replay after a hard kill

[Node.P2P]
ListenAddr = ":30311"
MaxPeers = 200
NoDiscovery = false
StaticNodes = []             # mainnet needs none: bootnodes ship with the client
```

```toml
# ---- testnet ----
[Eth]
NetworkId = 617              # chain ID 0x269
SyncMode = "snap"

[Node.P2P]
ListenAddr = ":30311"
MaxPeers = 200
NoDiscovery = false
# Testnet still requires manual static nodes; copy the list from the latest
# release config.toml. Enodes are not published in the docs, hence the placeholder.
StaticNodes = ["<enode-from-release-config.toml>"]
```

Mainnet needs no static nodes: remove the `BootstrapNodes` field so the release's built-in bootnodes are used. Genesis and chain config belong to `genesis.json`, which the docs ship per network but never reproduce — do not hand-author it; take it from the same release as `config.toml`.

## Docker

The image name and tag are not published; commands use `${BITGOLD_IMAGE}` from the official channels. Pull it with `docker pull ${BITGOLD_IMAGE}`, then run:

```bash
docker run -v $(pwd)/config:/bitgold/config -v $(pwd)/data/node:/bitgold/node \
  -p 8575:8575 --rm --name bitgold -it ${BITGOLD_IMAGE} \
  --http.addr 0.0.0.0 --http.port 8575 --http.vhosts '*' \
  --verbosity 5 --history.logs 576000
```

| Mount | Host | Container |
|---|---|---|
| Blockchain data | `data/node` | `/bitgold/node` |
| Config files | `config` | `/bitgold/config` |

`BITGOLD_HOME=/bitgold`, `DATA_DIR=/data`; config is read from `${BITGOLD_HOME}/config/config.toml`, genesis from `${BITGOLD_HOME}/config/genesis.json`.

- Port **8575** is the testnet RPC default; mainnet uses **8545** — adjust `-p` and `--http.port`. `--http.addr 0.0.0.0` is correct inside the container because the published port is the boundary; a host binary should bind `127.0.0.1`.
- Checks: `geth attach http://localhost:8575`, `docker exec -it bitgold bash`, `geth attach ipc:node/geth.ipc > eth.syncing`, `tail -f node/geth.log`. Ubuntu host setup after install: `systemctl enable docker.service`, `systemctl enable containerd.service`, `usermod -aG docker ubuntu`.

## Snapshots and initial sync

Snapshot-first is the documented path for every node type except a from-genesis full sync.

1. Download the latest chaindata snapshot from the official channels. No URL pattern, filename convention, or checksum is published: `<OFFICIAL-DISTRIBUTION-CHANNEL>/<chaindata-snapshot>`.
2. Extract so the extracted `chaindata` folder is what `--datadir` points at ("your `--datadir` flag must point to the extracted chaindata folder").
3. Fast nodes only: run `./geth db delete-trie-state --datadir ./node` — a fast node never regenerates trie data. Then start the node with its type's command and confirm block import in the log.

There are no published checksums or signatures and no resume guidance: verify the archive against the channel you fetched it from, and record snapshot height and date beside the datadir so a rollback is reproducible. Bitgold uses PBSS with PebbleDB, and the docs' snapshots and guidance cover PBSS/PebbleDB only — HashBased/LevelDB snapshots are explicitly out of scope.

## Ports and firewall

| Purpose | Port | Protocol | Source |
|---|---|---|---|
| P2P listener | 30311 | TCP | `ListenAddr = ":30311"` in the shipped config |
| P2P discovery | 30311, or 30303 | UDP | Same block; the firewall page cites geth defaults of 30303 TCP/UDP |
| JSON-RPC mainnet | 8545 | TCP | Docker page ("mainnet uses 8545") |
| JSON-RPC testnet | 8575 | TCP | Docker page ("default RPC port for testnet") |
| WebSocket | not documented | — | No `--ws` flag appears on any node-operator page |
| Metrics | not documented | — | The monitoring page names alerts but no endpoint or port |
| IPC | `geth.ipc` under the datadir | Unix socket | Docker page (`ipc:node/geth.ipc`) |

The 30311/30303 discrepancy is real: the firewall section repeats geth defaults while the shipped config sets `ListenAddr = ":30311"`. Open whatever your deployed config actually binds. Do not expose RPC publicly — admin operations are reachable there, and the JSON-RPC port "should not be opened to the outside world". Bind `127.0.0.1` or a private interface and front it with a reverse proxy for remote access; only the container example binds `0.0.0.0`, where the published port is the boundary. Firewall P2P to the internet and keep 8545/8575 closed except for the proxy or VPN range.

## Monitoring and maintenance

Logs are written under the data directory. Watch the import line, where `mgasps` is the sync-speed metric — the docs expect roughly 100 and attribute persistent shortfalls to disk rather than network. Documented alert thresholds: tx pool above 5000 transactions, block import above 3 s, RPC latency above 100 ms.

```bash
tail -f <datadir>/geth.log
# lvl=info msg="Imported new chain segment" blocks=1 txs=177 mgas=17.317 elapsed=31.131ms number=21,153,429 hash=0x42e6... dirty="0.00 B"
```

Health checks, from `geth attach ipc:<datadir>/geth.ipc`:

```javascript
eth.syncing          // false when caught up; an object while syncing
eth.blockNumber      // should advance about once per second
net.peerCount        // 0 means a networking or config problem
admin.peers          // confirm the peers you expect
admin.nodeInfo.enode // your enode, for sentry or static-node wiring
```

### Disk growth

- Archive mode keeps every historical state, and a full node degrades at high storage volume (1.5 TB was cited as an experimental threshold; the docs note the number needs updating). Alert well before capacity — a full disk halts the node — and keep storage light by pruning.
- Prune state: stop the node, `nohup geth snapshot prune-state --datadir {datadir} &` (3–5 hours), then start it.
- Prune ancient blocks: `./geth snapshot prune-block --datadir /server/node --datadir.ancient ./chaindata/ancient --block-amount-reserved 1024`. Related: `--pruneancient` keeps only the latest 90000 blocks of ancient data, one-way — once enabled, that data is unrecoverable and the node will not start without the flag. Keep spare nodes for pruning windows.

### Upgrade procedure

1. Get the release: pre-built binary from the official channel, or build from source with `make geth`.
2. Stop the node cleanly and wait for exit:

   ```bash
   pid=`ps -ef | grep geth | grep -v grep | awk '{print $2}'`
   kill $pid
   ```

3. Back up the old binary and config, then move the new `geth` into place. Keep `genesis.json` and `config.toml` unless release notes say otherwise.
4. Restart with the same command as before the upgrade (see Full and archive nodes above), then confirm block import resumes.

Read release notes first: some releases need a config change or a coordinated hard fork, and the upgrade must land before the announced fork block. For planned stops the docs recommend `kill -HUP $(pgrep geth)`.

### Node falls behind or the chain appears stalled

1. Check for a wrong chain ID, config file, or config directory — the most common cause of a node that will not peer.
2. Update `config.toml` to the latest release version; a stale file is a documented peer failure. On testnet, do not use bootnodes (not required there); keep `StaticNodes` from the release.
3. Delete `geth/nodes` and `geth/nodekey`, then restart, to force fresh discovery.
4. Re-download the snapshot if state import is stuck.

After a force-kill (`kill -9` or a crash) a node resumes from a block minutes to hours old, because in-memory state must be replayed from the last flush; the window is set by `TrieTimeout` in `config.toml`. Only archive nodes are expected to re-synchronise quickly after abrupt termination. Register `geth` as a systemd service so it starts on boot, run a backup node in archive mode, and shut down gracefully so failover is routine.

## Operations checklist

- [ ] Disk alert at 20% free, page at 10% — a full disk halts the node and archive state grows monotonically.
- [ ] Pin the client version (`Geth/v1.8.1-46e00601-20261026`) and record it beside the datadir; upgrade deliberately, after release notes and ahead of fork blocks.
- [ ] Keep one snapshot of known height and date as a fallback, plus matching `config.toml` and `genesis.json`; test the restore path before you need it.
- [ ] Bind RPC to `127.0.0.1`, expose it only behind a reverse proxy, never open 8545/8575 to the internet.
- [ ] Verify `admin.peers` and `eth.syncing` from monitoring, not by eye.
- [ ] Never run validator signing keys on an internet-exposed node; keys belong behind sentry nodes on a private network — see [validators.md](./validators.md).

## Sources

- https://docs.bitgold.network/bitgold-network/developers/node_operators/full_node/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/archive_node/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/fast_node/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/boot_node/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/docker/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/node_best_practices/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/node_maintenance/
- https://docs.bitgold.network/bitgold-network/developers/node_operators/upgrade_geth/
