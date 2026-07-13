"""
Engram Validator — Storage Challenge Dispatcher

Periodically challenges miners to prove they hold stored CIDs.
Uses the Rust engram_core module for challenge generation and verification.

Challenge records are persisted to SQLite so slash state survives validator
restarts. Without persistence, MIN_CHALLENGES_BEFORE_SLASH must be re-accumulated
from zero after every restart, giving dishonest miners a free grace window.
"""

from __future__ import annotations

import hmac
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from loguru import logger

from engram.config import (
    CHALLENGE_TIMEOUT_SECS,
    MAX_KNOWN_CIDS,
    MIN_CHALLENGES_BEFORE_SLASH,
    SLASH_THRESHOLD,
)

_DEFAULT_CHALLENGE_DB = Path(os.getenv("CHALLENGE_DB_PATH", "data/challenge_records.db"))

# Reject UIDs that could inject content into log lines or exceed reasonable length.
_UID_RE = re.compile(r"^[A-Za-z0-9_\-\.]{1,64}$")

try:
    import engram_core
    _RUST_AVAILABLE = True
except ImportError:
    _RUST_AVAILABLE = False
    logger.error(
        "engram_core (Rust extension) is not installed — storage proof challenges are DISABLED.\n"
        "Miners cannot be verified and will score based on recall/latency only.\n"
        "Build and install engram_core before running on mainnet:\n"
        "  cd engram-core && maturin develop --release"
    )


@dataclass
class MinerProofRecord:
    """Running stats for one miner's storage proof history."""
    uid: str
    total_challenges: int = 0
    passed_challenges: int = 0
    last_challenged_at: float = 0.0

    @property
    def success_rate(self) -> float:
        """
        Fraction of challenges this miner has passed.

        Returns 0.0 when we have no data yet instead of assuming honesty with 1.0.
        This avoids over-rewarding miners that have never been challenged.
        """
        if self.total_challenges == 0:
            return 0.0
        return self.passed_challenges / self.total_challenges

    @property
    def should_slash(self) -> bool:
        return self.total_challenges >= MIN_CHALLENGES_BEFORE_SLASH and self.success_rate < SLASH_THRESHOLD


class ChallengeDispatcher:
    """
    Issues storage proof challenges to miners and tracks their results.
    The validator calls `run_challenge_round()` on a timer.

    Challenge records are persisted to SQLite so accumulated proof history and
    slash state survive validator restarts.
    """

    def __init__(
        self,
        validator_hotkey_hex: str = "0" * 64,
        db_path: Path = _DEFAULT_CHALLENGE_DB,
    ) -> None:
        self._records: dict[str, MinerProofRecord] = {}
        self._known_cids: list[str] = []
        self._known_cids_set: set[str] = set()
        self._used_nonces: dict[str, float] = {}
        # 64-char hex SR25519 public key — binds every HMAC proof to this validator identity
        self._validator_hotkey_hex = validator_hotkey_hex
        self._db = self._open_db(db_path)
        self._load_records()

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _open_db(self, db_path: Path) -> sqlite3.Connection:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS challenge_records (
                uid                TEXT PRIMARY KEY,
                total_challenges   INTEGER NOT NULL DEFAULT 0,
                passed_challenges  INTEGER NOT NULL DEFAULT 0,
                last_challenged_at REAL NOT NULL DEFAULT 0
            )
        """)
        conn.commit()
        return conn

    def _load_records(self) -> None:
        rows = self._db.execute(
            "SELECT uid, total_challenges, passed_challenges, last_challenged_at "
            "FROM challenge_records"
        ).fetchall()
        for uid, total, passed, last in rows:
            self._records[uid] = MinerProofRecord(
                uid=uid,
                total_challenges=total,
                passed_challenges=passed,
                last_challenged_at=last,
            )
        if self._records:
            logger.info(f"Challenge records loaded | miners={len(self._records)}")

    def _save_record(self, record: MinerProofRecord) -> None:
        self._db.execute("""
            INSERT INTO challenge_records
                (uid, total_challenges, passed_challenges, last_challenged_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                total_challenges   = excluded.total_challenges,
                passed_challenges  = excluded.passed_challenges,
                last_challenged_at = excluded.last_challenged_at
        """, (record.uid, record.total_challenges, record.passed_challenges, record.last_challenged_at))
        self._db.commit()

    def register_cid(self, cid: str) -> None:
        """Register a CID that the validator can use for challenges."""
        if cid not in self._known_cids_set:
            if len(self._known_cids) >= MAX_KNOWN_CIDS:
                logger.warning("MAX_KNOWN_CIDS reached; dropping oldest CID to make room.")
                removed = self._known_cids.pop(0)
                self._known_cids_set.discard(removed)
            self._known_cids.append(cid)
            self._known_cids_set.add(cid)

    def get_record(self, uid: str) -> MinerProofRecord:
        if not _UID_RE.match(uid):
            raise ValueError(f"Invalid miner UID: {uid!r}")
        if uid not in self._records:
            self._records[uid] = MinerProofRecord(uid=uid)
        return self._records[uid]

    def all_success_rates(self) -> dict[str, float]:
        return {uid: r.success_rate for uid, r in self._records.items()}

    def slashable_miners(self) -> list[str]:
        return [uid for uid, r in self._records.items() if r.should_slash]

    def build_challenge(self, cid: str):  # type: ignore[return]
        if not _RUST_AVAILABLE:
            return None
        return engram_core.generate_challenge(cid, CHALLENGE_TIMEOUT_SECS, self._validator_hotkey_hex)  # type: ignore[name-defined]

    def verify_response(
        self,
        challenge: Any,
        response_embedding_hash: str,
        response_proof: str,
        expected_embedding: list[float],
    ) -> bool:
        if not _RUST_AVAILABLE:
            return False

        now = time.time()

        # Enforce expiration before doing any expensive checks.
        if now > challenge.expires_at:
            logger.warning("Received storage proof after challenge expiry.")
            return False

        # Reject replayed nonces — purge expired ones first, then check.
        self._purge_expired_nonces(now)
        if challenge.nonce_hex in self._used_nonces:
            logger.warning(f"Rejected replayed nonce: {challenge.nonce_hex[:16]}…")
            return False
        self._used_nonces[challenge.nonce_hex] = challenge.expires_at

        # Generate the expected response from the known embedding, then compare
        # using constant-time digest comparison to prevent timing oracle attacks.
        try:
            expected_response = engram_core.generate_response(challenge, expected_embedding)  # type: ignore[name-defined]
        except (TypeError, ValueError) as exc:
            logger.warning(f"Storage proof verification failed on malformed challenge: {exc}")
            return False
        hash_ok  = hmac.compare_digest(expected_response.embedding_hash, response_embedding_hash)
        proof_ok = hmac.compare_digest(expected_response.proof, response_proof)
        return hash_ok and proof_ok

    def _purge_expired_nonces(self, now: float) -> None:
        """Remove nonces whose TTL has passed to keep memory bounded."""
        expired = [n for n, exp in self._used_nonces.items() if now > exp]
        for n in expired:
            del self._used_nonces[n]

    def record_result(self, uid: str, passed: bool) -> None:
        record = self.get_record(uid)  # validates uid
        record.total_challenges += 1
        record.last_challenged_at = time.time()
        safe_uid = uid  # already validated as alphanumeric by get_record
        if passed:
            record.passed_challenges += 1
            logger.debug(f"Challenge PASSED | miner={safe_uid} | rate={record.success_rate:.2f}")
        else:
            logger.warning(f"Challenge FAILED | miner={safe_uid} | rate={record.success_rate:.2f}")
            if record.should_slash:
                logger.error(f"SLASH THRESHOLD HIT | miner={safe_uid}")
        self._save_record(record)

    def pick_random_cid(self) -> str | None:
        if not self._known_cids:
            return None
        return secrets.choice(self._known_cids)
