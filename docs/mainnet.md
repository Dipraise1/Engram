# Mainnet Registration Runbook

How to take Engram from testnet (subnet 450) to Bittensor mainnet (finney).
Every step that spends TAO is marked **💸 SPENDS TAO** — everything else is
read-only and safe to repeat.

## 0. Preflight (read-only)

Run the dry-run until it says GO:

```bash
python scripts/mainnet_dryrun.py
```

It verifies wallet files, finney connectivity, the live subnet-creation cost,
and coldkey balance. As of July 2026 the subnet creation cost is ~τ1,050 and
moves with demand — always check the live number, never budget from this doc.

## 1. Fund the coldkey

The `engram` coldkey (`5FHGPfixYME1CK3EN5YGJzFvXBgtrEqrCnUPLCbvW4RG233k`) needs
the burn cost plus a margin (the cost can rise between checking and
submitting — fund ~10% over). Transfer real TAO from an exchange or OTC to the
coldkey address, then re-run the dry-run to confirm the balance landed.

## 2. Create the subnet — 💸 SPENDS TAO (~τ1,050, non-refundable)

Must run on the machine that holds the encrypted coldkey; you'll be prompted
for the coldkey password:

```bash
btcli subnet create --wallet.name engram --subtensor.network finney
```

Record the assigned `netuid` — everything below uses it. The creating hotkey
is auto-registered as owner (uid 0).

## 3. Set subnet identity + hyperparameters

```bash
btcli subnet set-identity --netuid <NETUID> --wallet.name engram --subtensor.network finney
# name: Engram, url: https://theengram.space, github: https://github.com/Dipraise1/Engram
```

Review hyperparameters before opening registration (defaults are usually fine
to start; owner can tune later):

```bash
btcli subnet hyperparameters --netuid <NETUID> --subtensor.network finney
```

## 4. Register validator + miner hotkeys — 💸 SPENDS TAO (recycle cost each)

```bash
btcli subnet register --netuid <NETUID> --wallet.name engram --wallet.hotkey validator --subtensor.network finney
btcli subnet register --netuid <NETUID> --wallet.name engram --wallet.hotkey miner --subtensor.network finney
```

## 5. Point the deployment at mainnet

On the VPS, edit `/opt/engram/.env.miner*` and `/opt/engram/.env.validator`:

```diff
-SUBTENSOR_NETWORK=test
-NETUID=450
+SUBTENSOR_NETWORK=finney
+NETUID=<NETUID>
```

Also flip the security gates that were relaxed on testnet:

```diff
-REQUIRE_HOTKEY_SIG=false
-REQUIRE_METAGRAPH_REG=false
+REQUIRE_HOTKEY_SIG=true
+REQUIRE_METAGRAPH_REG=true
```

Then restart:

```bash
systemctl restart engram-miner engram-validator
journalctl -u engram-validator -f   # watch for successful metagraph sync + weight-set
```

## 6. Verify weight-setting is live

```bash
btcli subnet metagraph --netuid <NETUID> --subtensor.network finney
```

Confirm the validator's hotkey shows a validator permit and non-zero weights
after the first epoch (~72 min). The dashboard at theengram.space should be
switched to read the mainnet netuid once weights flow.

## Rollback / safety notes

- Subnet creation is **not reversible** — the burn is spent even if you never
  use the subnet. Do it once, deliberately.
- Keep testnet 450 running until mainnet weights have flowed for at least a
  few epochs; it's the staging environment for future upgrades.
- The coldkey should never live on the VPS. Registration happens from the
  machine holding the coldkey; the VPS only needs hotkeys.
- Validator consensus, slashing, and the staking gate are already merged
  (see ROADMAP Phase 2) — mainnet inherits them via the same env config.
