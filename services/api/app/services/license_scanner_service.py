"""
ONDA Suspensive Copyright Steganography & Viral License Scanner Service.

1. Viral copyleft license detection (GPL-2.0, GPL-3.0, AGPL, SSPL) to protect enterprise IP.
2. Injects tamper-evident ONDA_METADATA.json manifest signed with HMAC linking contract ID,
   client NIF, freelancer ANAE ID, and settlement timestamp under Algerian Ordonnance n° 03-05.
"""

import hmac
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.core.config import setting

logger = logging.getLogger(__name__)

# Strict copyleft / viral licenses requiring warning/rejection for proprietary enterprise deliverables
COPYLEFT_LICENSES = {
    "GPL-2.0",
    "GPL-2.0-only",
    "GPL-2.0-or-later",
    "GPL-3.0",
    "GPL-3.0-only",
    "GPL-3.0-or-later",
    "AGPL-3.0",
    "AGPL-3.0-only",
    "AGPL-3.0-or-later",
    "SSPL",
    "EUPL-1.2",
    "CC-BY-SA-4.0",
}

PERMISSIVE_LICENSES = {
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unlicense",
    "CC0-1.0",
    "PROPRIETARY",
}


class DependencyLicenseInfo(BaseModel):
    package_name: str
    license_type: str
    is_viral_copyleft: bool
    is_permissive: bool


class LicenseClearanceReport(BaseModel):
    is_clear_for_commercial_handover: bool
    total_dependencies: int
    viral_license_count: int
    risk_level: str  # "CLEAN", "WARNING", "HIGH_RISK_COPYLEFT"
    flagged_dependencies: List[DependencyLicenseInfo]
    permissive_dependencies: List[DependencyLicenseInfo]
    report_generated_at: str


class LicenseScannerService:
    """Scans repository dependencies for viral licenses and embeds ONDA copyright steganography."""

    def __init__(self):
        self._secret = (
            setting.SECRET_KEY or "podacium_onda_copyright_manifest_salt"
        ).encode("utf-8")

    def classify_license(self, raw_license: str) -> tuple[bool, bool]:
        """Returns (is_viral_copyleft, is_permissive)."""
        cleaned = raw_license.strip().upper()
        for viral in COPYLEFT_LICENSES:
            if viral.upper() in cleaned:
                return True, False
        for perm in PERMISSIVE_LICENSES:
            if perm.upper() in cleaned:
                return False, True
        # Unknown/Custom
        return False, False

    def scan_manifest_dependencies(
        self,
        dependencies: Dict[str, str],  # name -> license
    ) -> LicenseClearanceReport:
        """
        Scans a dict of dependencies and their declared licenses (from package.json / requirements / Cargo.lock).
        """
        flagged: List[DependencyLicenseInfo] = []
        permissive: List[DependencyLicenseInfo] = []
        viral_count = 0

        for pkg, lic in dependencies.items():
            is_viral, is_perm = self.classify_license(lic)
            info = DependencyLicenseInfo(
                package_name=pkg,
                license_type=lic,
                is_viral_copyleft=is_viral,
                is_permissive=is_perm,
            )
            if is_viral:
                viral_count += 1
                flagged.append(info)
            else:
                permissive.append(info)

        risk_level = "CLEAN"
        if viral_count > 0:
            risk_level = "HIGH_RISK_COPYLEFT"
        elif len(dependencies) > 0 and len(permissive) < len(dependencies):
            risk_level = "WARNING"

        is_clear = viral_count == 0

        return LicenseClearanceReport(
            is_clear_for_commercial_handover=is_clear,
            total_dependencies=len(dependencies),
            viral_license_count=viral_count,
            risk_level=risk_level,
            flagged_dependencies=flagged,
            permissive_dependencies=permissive,
            report_generated_at=datetime.now(timezone.utc).isoformat(),
        )

    def generate_onda_copyright_manifest(
        self,
        contract_id: int,
        milestone_id: int,
        client_name: str,
        client_nif: Optional[str],
        freelancer_name: str,
        freelancer_anae_id: str,
        deliverable_sha256: str,
    ) -> Dict[str, Any]:
        """
        Generates tamper-evident ONDA (Office National des Droits d'Auteur) metadata manifest.
        Pursuant to Algerian Ordonnance n° 03-05 relative aux droits d'auteur et droits voisins.
        """
        now_ts = datetime.now(timezone.utc).isoformat()
        payload = {
            "legal_framework": "Ordonnance n° 03-05 du 19 Joumada El Oula 1424 (19 juillet 2003) - ONDA Algérie",
            "jurisdiction": "République Algérienne Démocratique et Populaire",
            "contract_id": contract_id,
            "milestone_id": milestone_id,
            "creator_author": {
                "name": freelancer_name,
                "anae_id": freelancer_anae_id,
                "role": "Auteur / Concepteur",
            },
            "economic_rights_assignee": {
                "name": client_name,
                "nif": client_nif or "NON-RENSEIGNÉ",
                "role": "Cessionnaire des Droits Patrimoniaux",
            },
            "deliverable_sha256": deliverable_sha256,
            "assignment_scope": "Cession totale des droits d'exploitation commerciale, modification et reproduction",
            "settlement_timestamp": now_ts,
        }

        canonical_json = json.dumps(payload, sort_keys=True).encode("utf-8")
        manifest_hmac = hmac.new(
            self._secret, canonical_json, hashlib.sha256
        ).hexdigest()

        return {
            "onda_manifest": payload,
            "manifest_hmac_sha256": manifest_hmac,
            "watermark_tag": f"PODACIUM-ONDA-CTR{contract_id}-MS{milestone_id}-{manifest_hmac[:12].upper()}",
        }


license_scanner_service = LicenseScannerService()
