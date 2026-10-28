"""
TamWheel Sovereign Ethical Agentic Venture OS — Merkle-CRDT Offline State Channels Engine.
Pillar 2 / Section 22: Offline-First Mobile Financial Synchronization for Low-Connectivity Wilayas
(Adrar, Tindouf, Tamanrasset, In Salah, Illizi, etc.).

Architectural Capabilities:
1. Cryptographic Ed25519 Local Voucher Generation:
   - High-speed elliptic-curve signatures enabling offline commitments on resource-constrained mobile devices.
   - Verifiable canonical payload: (voucher_id, user_id, campaign_id, amount_dzd, nonce, timestamp, wilaya).
2. Binary Merkle Tree & State Channel Fingerprinting:
   - O(1) root hash state comparison between offline client node and server ledger.
   - O(log N) cryptographic inclusion proof generation and verification.
3. Replay Attack Prevention & Nonce Monotonicity:
   - Unique voucher deduplication and strict monotonic nonce checking per user account.
4. Conflict-Free Ledger Reconciliation (CRDT Replay):
   - Replays validated offline vouchers directly onto the Double-Entry Virtual Currency Ledger
     (Debit Campaign Escrow / Credit User Cash) with zero-sum invariant preservation.
"""

import copy
import json
import math
import hashlib
import logging
import threading
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from fastapi import HTTPException, status

from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature

from app.services.simulation_engine import (
    simulation_ledger,
    DoubleEntrySimulationLedger,
    LedgerLine,
    JournalEntry,
)

logger = logging.getLogger(__name__)


# =============================================================================
# DATA MODELS
# =============================================================================

class OfflineVoucher(BaseModel):
    """Offline investment commitment voucher signed locally via Ed25519."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    voucher_id: str = Field(..., description="Unique client voucher UUID/ID")
    user_id: int = Field(..., description="Committing user ID")
    campaign_id: str = Field(..., description="Target Campaign UUID")
    amount_dzd: int = Field(..., ge=1000, description="Virtual commitment in DZD (Sim)")
    nonce: int = Field(..., ge=1, description="Strictly monotonic user nonce")
    timestamp: str = Field(..., description="ISO-8601 offline creation timestamp")
    wilaya: int = Field(16, ge=1, le=58, description="Origin Algerian Wilaya (Decree 19-12)")
    public_key: str = Field(..., description="Ed25519 public key hex string")
    signature: str = Field(..., description="Ed25519 signature hex string")

    def canonical_bytes(self) -> bytes:
        """Deterministic serialization payload for Ed25519 signing and verification."""
        payload = f"{self.voucher_id}:{self.user_id}:{self.campaign_id}:{self.amount_dzd}:{self.nonce}:{self.timestamp}:{self.wilaya}"
        return payload.encode("utf-8")

    def leaf_hash(self) -> str:
        """Cryptographic SHA-256 leaf digest for Merkle tree insertion."""
        content = f"{self.voucher_id}:{self.canonical_bytes().decode('utf-8')}:{self.signature}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()


class MerkleProofStep(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    position: str = Field(..., description="'left' or 'right'")
    hash: str = Field(..., description="Sibling hash digest")


class MerkleProof(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    leaf_hash: str
    root_hash: str
    voucher_id: str
    proof: List[MerkleProofStep]


class OfflineReconciliationResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    status: str  # CONVERGED | PARTIALLY_CONVERGED | REJECTED
    merkle_root: str
    total_vouchers: int
    accepted_count: int
    rejected_count: int
    reconciled_amount_dzd: int
    settled_entries: List[Dict[str, Any]]
    errors: List[Dict[str, str]]
    reconciled_at: str


# =============================================================================
# MERKLE TREE IMPLEMENTATION
# =============================================================================

class MerkleTree:
    """
    Cryptographic Binary Merkle Tree implementation:
    - O(N) tree construction
    - O(1) root hash lookup
    - O(log N) inclusion proof generation and verification
    """

    def __init__(self, leaf_hashes: List[str]):
        if not leaf_hashes:
            self.root: str = "0" * 64
            self.levels: List[List[str]] = [[]]
            return

        self.levels: List[List[str]] = [[h for h in leaf_hashes]]
        self._build_tree()
        self.root: str = self.levels[-1][0] if self.levels[-1] else "0" * 64

    def _hash_pair(self, left: str, right: str) -> str:
        combined = (left + right).encode("utf-8")
        return hashlib.sha256(combined).hexdigest()

    def _build_tree(self) -> None:
        current_level = self.levels[0]
        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                if i + 1 < len(current_level):
                    right = current_level[i + 1]
                else:
                    # Odd leaf duplication as per standard Bitcoin/Ethereum Merkle tree pattern
                    right = left
                parent = self._hash_pair(left, right)
                next_level.append(parent)
            self.levels.append(next_level)
            current_level = next_level

    def get_proof(self, leaf_index: int) -> List[MerkleProofStep]:
        """Generates an inclusion proof path for a given leaf index."""
        if not (0 <= leaf_index < len(self.levels[0])):
            raise IndexError("Leaf index out of bounds")

        proof: List[MerkleProofStep] = []
        index = leaf_index

        for level in self.levels[:-1]:
            is_right_child = (index % 2 == 1)
            sibling_index = index - 1 if is_right_child else index + 1

            if sibling_index < len(level):
                sibling_hash = level[sibling_index]
            else:
                sibling_hash = level[index]  # Duplicated odd node

            proof.append(
                MerkleProofStep(
                    position="left" if is_right_child else "right",
                    hash=sibling_hash,
                )
            )
            index = index // 2

        return proof

    @staticmethod
    def verify_proof(leaf_hash: str, proof: List[MerkleProofStep], root_hash: str) -> bool:
        """Verifies a Merkle inclusion proof from leaf to root."""
        current = leaf_hash
        for step in proof:
            if step.position == "left":
                current = hashlib.sha256((step.hash + current).encode("utf-8")).hexdigest()
            else:
                current = hashlib.sha256((current + step.hash).encode("utf-8")).hexdigest()
        return current.lower() == root_hash.lower()


# =============================================================================
# MERKLE-CRDT OFFLINE ENGINE
# =============================================================================

class MerkleCRDTOfflineEngine:
    """
    Sovereign Merkle-CRDT State Channels Engine for low-bandwidth Algerian Wilayas.
    Supports local voucher creation, Ed25519 signature checks, Merkle tree batching,
    and automatic conflict-free ledger reconciliation with replay attack mitigation.
    """

    def __init__(self, ledger: Optional[DoubleEntrySimulationLedger] = None):
        self._lock = threading.RLock()
        self.ledger: DoubleEntrySimulationLedger = ledger or simulation_ledger

        # Replay prevention and state channel registries
        self._settled_vouchers: Set[str] = set()           # voucher_id deduplication
        self._processed_nonces: Dict[int, Set[int]] = {}   # user_id -> set of settled nonces
        self._highest_nonce: Dict[int, int] = {}           # user_id -> highest sequential nonce
        self._client_nonces: Dict[int, int] = {}           # user_id -> client allocated sequential nonces
        self._user_keypairs: Dict[int, Tuple[str, str]] = {}  # user_id -> (priv_hex, pub_hex) for simulated clients

    # -------------------------------------------------------------------------
    # Cryptographic Key & Voucher Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def generate_keypair() -> Tuple[str, str]:
        """Generates a new Ed25519 keypair, returning (private_key_hex, public_key_hex)."""
        priv_key = ed25519.Ed25519PrivateKey.generate()
        pub_key = priv_key.public_key()

        priv_bytes = priv_key.private_bytes_raw()
        pub_bytes = pub_key.public_bytes_raw()

        return priv_bytes.hex(), pub_bytes.hex()

    @staticmethod
    def sign_payload(private_key_hex: str, payload_bytes: bytes) -> str:
        """Signs arbitrary payload bytes with an Ed25519 private key."""
        priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(private_key_hex))
        signature = priv_key.sign(payload_bytes)
        return signature.hex()

    @staticmethod
    def verify_signature(public_key_hex: str, payload_bytes: bytes, signature_hex: str) -> bool:
        """Cryptographically verifies an Ed25519 signature."""
        try:
            pub_key = ed25519.Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))
            pub_key.verify(bytes.fromhex(signature_hex), payload_bytes)
            return True
        except (InvalidSignature, ValueError, Exception):
            return False

    def create_offline_voucher(
        self,
        user_id: int,
        campaign_id: str,
        amount_dzd: int,
        wilaya: int = 16,
        nonce: Optional[int] = None,
        private_key_hex: Optional[str] = None,
        public_key_hex: Optional[str] = None,
        voucher_id: Optional[str] = None,
    ) -> OfflineVoucher:
        """
        Creates and signs a valid offline investment voucher.
        If keys are omitted, generates and binds a persistent test keypair for the user.
        Allocates strictly increasing sequential client nonces to avoid collision.
        """
        with self._lock:
            if not private_key_hex or not public_key_hex:
                if user_id not in self._user_keypairs:
                    self._user_keypairs[user_id] = self.generate_keypair()
                private_key_hex, public_key_hex = self._user_keypairs[user_id]

            # Monotonic client nonce allocation
            if nonce is not None:
                assigned_nonce = nonce
            else:
                last_nonce = max(
                    self._client_nonces.get(user_id, 0),
                    self._highest_nonce.get(user_id, 0),
                )
                assigned_nonce = last_nonce + 1
            self._client_nonces[user_id] = assigned_nonce

            v_id = voucher_id or f"vch-{user_id}-{assigned_nonce}-{hashlib.sha256(str(datetime.now()).encode()).hexdigest()[:8]}"
            timestamp = datetime.now(timezone.utc).isoformat()

            raw_voucher = OfflineVoucher(
                voucher_id=v_id,
                user_id=user_id,
                campaign_id=campaign_id,
                amount_dzd=amount_dzd,
                nonce=assigned_nonce,
                timestamp=timestamp,
                wilaya=wilaya,
                public_key=public_key_hex,
                signature="",  # compute below
            )

            signature = self.sign_payload(private_key_hex, raw_voucher.canonical_bytes())
            raw_voucher.signature = signature

            return raw_voucher

    # -------------------------------------------------------------------------
    # Merkle Root & Proof Calculations
    # -------------------------------------------------------------------------

    @staticmethod
    def build_merkle_tree(vouchers: List[OfflineVoucher]) -> MerkleTree:
        """Builds a MerkleTree instance over a list of offline vouchers."""
        leaf_hashes = [v.leaf_hash() for v in vouchers]
        return MerkleTree(leaf_hashes)

    def generate_merkle_proof(
        self, vouchers: List[OfflineVoucher], target_voucher_id: str
    ) -> MerkleProof:
        """Generates an inclusion proof for a target voucher within a batch."""
        leaf_hashes = [v.leaf_hash() for v in vouchers]
        target_index = -1
        for idx, v in enumerate(vouchers):
            if v.voucher_id == target_voucher_id:
                target_index = idx
                break

        if target_index == -1:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Voucher '{target_voucher_id}' not found in provided batch.",
            )

        tree = MerkleTree(leaf_hashes)
        proof_steps = tree.get_proof(target_index)

        return MerkleProof(
            leaf_hash=leaf_hashes[target_index],
            root_hash=tree.root,
            voucher_id=target_voucher_id,
            proof=proof_steps,
        )

    # -------------------------------------------------------------------------
    # Replay & CRDT Reconciliation Engine
    # -------------------------------------------------------------------------

    def reconcile_offline_batch(
        self,
        user_id: int,
        vouchers: List[OfflineVoucher],
        claimed_merkle_root: Optional[str] = None,
    ) -> OfflineReconciliationResult:
        """
        Reconciles and settles a batch of offline vouchers onto the sovereign ledger:
        1. Cryptographic Merkle Root Verification
        2. Ed25519 Digital Signature Verification
        3. Monotonic Nonce & Replay Attack Prevention
        4. Overdraft & Balance Validation
        5. Atomic Journal Entry Recording (Debit Campaign / Credit User Cash)
        """
        if not vouchers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No vouchers provided for offline reconciliation.",
            )

        with self._lock:
            # 1. Compute and verify Merkle root
            tree = self.build_merkle_tree(vouchers)
            if claimed_merkle_root and tree.root.lower() != claimed_merkle_root.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Merkle root mismatch. Claimed: {claimed_merkle_root}, Calculated: {tree.root}",
                )

            # Ensure starter grant exists in simulation ledger
            self.ledger.issue_starter_grant(user_id)
            current_balance = self.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")

            accepted_entries: List[Dict[str, Any]] = []
            errors: List[Dict[str, str]] = []
            reconciled_amount = 0

            # Sort vouchers by nonce to maintain causal order
            sorted_vouchers = sorted(vouchers, key=lambda v: v.nonce)

            user_nonces = self._processed_nonces.setdefault(user_id, set())
            highest_nonce = self._highest_nonce.get(user_id, 0)

            for v in sorted_vouchers:
                # 2. Duplicate voucher ID check
                if v.voucher_id in self._settled_vouchers:
                    errors.append({
                        "voucherId": v.voucher_id,
                        "reason": "Duplicate voucher ID: Voucher already settled.",
                    })
                    continue

                # 3. Monotonic Nonce & Replay check
                if v.nonce in user_nonces or v.nonce <= highest_nonce:
                    errors.append({
                        "voucherId": v.voucher_id,
                        "reason": f"Replay attack detected: Nonce {v.nonce} already processed.",
                    })
                    continue

                # 4. Ed25519 Signature check
                if not self.verify_signature(v.public_key, v.canonical_bytes(), v.signature):
                    errors.append({
                        "voucherId": v.voucher_id,
                        "reason": "Cryptographic signature invalid: Ed25519 verification failed.",
                    })
                    continue

                # 5. Overdraft protection check
                if current_balance < v.amount_dzd:
                    errors.append({
                        "voucherId": v.voucher_id,
                        "reason": f"Insufficient virtual cash balance: Need {v.amount_dzd} DZD, have {current_balance} DZD.",
                    })
                    continue

                # 6. Replay onto Double-Entry Simulation Ledger
                journal_lines = [
                    LedgerLine(
                        account=f"CAMPAIGN:{v.campaign_id}:ESCROW_HOLDING",
                        debit=v.amount_dzd,
                        credit=0,
                        wilaya=v.wilaya,
                    ),
                    LedgerLine(
                        account=f"USER:{v.user_id}:VIRTUAL_CASH",
                        debit=0,
                        credit=v.amount_dzd,
                        wilaya=v.wilaya,
                    ),
                ]

                try:
                    entry = self.ledger.record_journal_entry(
                        action="OFFLINE_MERKLE_CRDT_SETTLEMENT",
                        idempotency_key=f"offline-{v.voucher_id}",
                        lines=journal_lines,
                        user_id=v.user_id,
                        campaign_id=v.campaign_id,
                        metadata={"voucherId": v.voucher_id, "wilaya": v.wilaya},
                    )

                    # Update in-memory sync state
                    self._settled_vouchers.add(v.voucher_id)
                    user_nonces.add(v.nonce)
                    highest_nonce = max(highest_nonce, v.nonce)
                    self._highest_nonce[user_id] = highest_nonce

                    current_balance -= v.amount_dzd
                    reconciled_amount += v.amount_dzd

                    accepted_entries.append({
                        "voucherId": v.voucher_id,
                        "journalEntryId": entry.entry_id,
                        "entryHash": entry.entry_hash,
                        "amountDzd": v.amount_dzd,
                        "campaignId": v.campaign_id,
                        "wilaya": v.wilaya,
                        "settledAt": entry.timestamp,
                    })
                except Exception as ex:
                    logger.error(f"Failed to settle voucher {v.voucher_id}: {str(ex)}")
                    errors.append({
                        "voucherId": v.voucher_id,
                        "reason": f"Ledger settlement error: {str(ex)}",
                    })

            # Determine convergence status
            if len(accepted_entries) == len(vouchers):
                status_label = "CONVERGED"
            elif accepted_entries:
                status_label = "PARTIALLY_CONVERGED"
            else:
                status_label = "REJECTED"

            return OfflineReconciliationResult(
                status=status_label,
                merkle_root=tree.root,
                total_vouchers=len(vouchers),
                accepted_count=len(accepted_entries),
                rejected_count=len(errors),
                reconciled_amount_dzd=reconciled_amount,
                settled_entries=accepted_entries,
                errors=errors,
                reconciled_at=datetime.now(timezone.utc).isoformat(),
            )

    def get_sync_status(self, user_id: int) -> Dict[str, Any]:
        """Returns the offline state channel sync status for a user."""
        with self._lock:
            highest = self._highest_nonce.get(user_id, 0)
            settled_count = len(self._processed_nonces.get(user_id, set()))
            balance = self.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")
            return {
                "userId": user_id,
                "highestSettledNonce": highest,
                "settledVouchersCount": settled_count,
                "availableVirtualCashDzd": balance,
                "channelStatus": "READY",
            }


# Global Singleton Instance
merkle_crdt_offline_engine = MerkleCRDTOfflineEngine()
