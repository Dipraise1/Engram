"""
Engram — Mainnet Registration Dry-Run

Read-only preflight for registering the Engram subnet on Bittensor mainnet
(finney). Checks everything registration needs WITHOUT signing or submitting
any transaction — safe to run repeatedly.

Checks:
  1. Wallet files present (coldkeypub + hotkeys) — no password needed
  2. Mainnet chain connectivity + current block
  3. Subnet registration burn cost (live from chain)
  4. Coldkey balance on mainnet vs burn cost
  5. Post-registration cost preview: neuron recycle-register on an existing
     subnet (uses --reference-netuid, default 1) as a ballpark
  6. Go/no-go summary

Usage:
    python scripts/mainnet_dryrun.py
    python scripts/mainnet_dryrun.py --wallet engram --network finney
"""

import argparse
import sys
from pathlib import Path

import bittensor as bt
from loguru import logger

CHECK = "✓"
CROSS = "✗"


def check_wallet_files(wallet_name: str, hotkeys: list[str]) -> tuple[bool, str | None]:
    """Verify wallet files exist on disk. Returns (ok, coldkeypub_ss58)."""
    base = Path.home() / ".bittensor" / "wallets" / wallet_name
    ok = True

    coldkeypub = base / "coldkeypub.txt"
    if coldkeypub.exists():
        logger.info(f"{CHECK} coldkeypub found: {coldkeypub}")
    else:
        logger.error(f"{CROSS} coldkeypub missing: {coldkeypub}")
        ok = False

    coldkey = base / "coldkey"
    if coldkey.exists():
        logger.info(f"{CHECK} encrypted coldkey present (needed to sign the real registration)")
    else:
        logger.warning(
            f"! coldkey (private) not on this machine — dry-run fine, "
            f"but the real registration must run where the coldkey lives"
        )

    for hk in hotkeys:
        hk_path = base / "hotkeys" / hk
        if hk_path.exists():
            logger.info(f"{CHECK} hotkey '{hk}' found")
        else:
            logger.error(f"{CROSS} hotkey '{hk}' missing: {hk_path}")
            ok = False

    ss58 = None
    if coldkeypub.exists():
        wallet = bt.Wallet(name=wallet_name)
        ss58 = wallet.coldkeypub.ss58_address
        logger.info(f"  coldkey address: {ss58}")

    return ok, ss58


def main() -> None:
    parser = argparse.ArgumentParser(description="Engram mainnet registration dry-run (read-only)")
    parser.add_argument("--wallet", default="engram", help="wallet name (default: engram)")
    parser.add_argument(
        "--hotkeys",
        default="default",
        help="comma-separated hotkeys to check (default: default)",
    )
    parser.add_argument("--network", default="finney", help="chain to check (default: finney = mainnet)")
    parser.add_argument(
        "--reference-netuid",
        type=int,
        default=1,
        help="existing subnet used to preview neuron recycle-register cost (default: 1)",
    )
    args = parser.parse_args()
    hotkeys = [h.strip() for h in args.hotkeys.split(",") if h.strip()]

    logger.info(f"── Engram mainnet dry-run — network={args.network}, wallet={args.wallet} ──")
    failures: list[str] = []

    # 1. Wallet files
    logger.info("[1/5] Wallet files")
    wallet_ok, ss58 = check_wallet_files(args.wallet, hotkeys)
    if not wallet_ok:
        failures.append("wallet files incomplete")

    # 2. Chain connectivity
    logger.info("[2/5] Chain connectivity")
    try:
        subtensor = bt.Subtensor(network=args.network)
        block = subtensor.block
        n_subnets = subtensor.get_total_subnets()
        logger.info(f"{CHECK} connected to {args.network} — block {block}, {n_subnets} subnets live")
    except Exception as exc:
        logger.error(f"{CROSS} cannot reach {args.network}: {exc}")
        failures.append(f"chain unreachable ({exc})")
        _summary(failures)
        sys.exit(1)

    # 3. Subnet registration burn cost
    logger.info("[3/5] Subnet registration burn cost")
    burn_cost = None
    try:
        burn_cost = subtensor.get_subnet_burn_cost()
        logger.info(f"{CHECK} current subnet creation cost: {burn_cost}")
    except Exception as exc:
        logger.error(f"{CROSS} could not query burn cost: {exc}")
        failures.append("burn cost query failed")

    # 4. Balance vs burn cost
    logger.info("[4/5] Coldkey balance")
    if ss58:
        try:
            balance = subtensor.get_balance(ss58)
            logger.info(f"  balance on {args.network}: {balance}")
            if burn_cost is not None:
                if float(balance) >= float(burn_cost):
                    logger.info(f"{CHECK} balance covers subnet creation cost")
                else:
                    shortfall = float(burn_cost) - float(balance)
                    logger.error(
                        f"{CROSS} insufficient: need {burn_cost}, have {balance} "
                        f"(short {shortfall:.4f} TAO)"
                    )
                    failures.append(f"balance short {shortfall:.4f} TAO")
        except Exception as exc:
            logger.error(f"{CROSS} balance query failed: {exc}")
            failures.append("balance query failed")
    else:
        failures.append("no coldkey address to check balance")

    # 5. Neuron registration cost preview (post-subnet-creation step)
    logger.info(f"[5/5] Neuron recycle-register cost preview (reference netuid {args.reference_netuid})")
    try:
        recycle = subtensor.recycle(netuid=args.reference_netuid)
        logger.info(
            f"{CHECK} recycle cost on netuid {args.reference_netuid}: {recycle} "
            f"(your new subnet's neuron registration will be set by its own hyperparameters)"
        )
    except Exception as exc:
        logger.warning(f"! recycle cost preview unavailable: {exc}")

    _summary(failures)
    sys.exit(1 if failures else 0)


def _summary(failures: list[str]) -> None:
    print()
    if failures:
        logger.error(f"NO-GO — {len(failures)} blocker(s):")
        for f in failures:
            logger.error(f"  • {f}")
        logger.info("Fix the blockers above, then re-run this script.")
    else:
        logger.success("GO — all preflight checks passed.")
        logger.info("Real registration (spends TAO, needs coldkey password):")
        logger.info("  btcli subnet create --wallet.name engram --subtensor.network finney")
        logger.info("Then follow docs/mainnet.md for neuron registration and weight-setting.")


if __name__ == "__main__":
    main()
