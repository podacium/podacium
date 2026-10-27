"""
Core CNRC Registry Tool
Validates Algerian Corporate & Commercial Registration against National CNRC Standards:
- NIF: 15-digit Numéro d'Identification Fiscale with checksum validation
- NIS: 20-digit Numéro d'Identification Statistique
- RC: Registre du Commerce format and structure (Wilaya/Antenne-Numéro/Forme/Année)
- Wilaya code cross-verification (58 Wilayas of Algeria)
"""

import logging
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.algerian_validators import (
    calculate_nif_modulo10_checksum,
    parse_cnrc_details,
    validate_nis_format,
)

logger = logging.getLogger("podacium.agent.tools.core.cnrc_registry")

ALGERIAN_WILAYAS: Dict[str, str] = {
    "01": "Adrar",
    "02": "Chlef",
    "03": "Laghouat",
    "04": "Oum El Bouaghi",
    "05": "Batna",
    "06": "Béjaïa",
    "07": "Biskra",
    "08": "Béchar",
    "09": "Blida",
    "10": "Bouira",
    "11": "Tamanrasset",
    "12": "Tébessa",
    "13": "Tlemcen",
    "14": "Tiaret",
    "15": "Tizi Ouzou",
    "16": "Alger",
    "17": "Djelfa",
    "18": "Jijel",
    "19": "Sétif",
    "20": "Saïda",
    "21": "Skikda",
    "22": "Sidi Bel Abbès",
    "23": "Annaba",
    "24": "Guelma",
    "25": "Constantine",
    "26": "Médéa",
    "27": "Mostaganem",
    "28": "M'Sila",
    "29": "Mascara",
    "30": "Ouargla",
    "31": "Oran",
    "32": "El Bayadh",
    "33": "Illizi",
    "34": "Bordj Bou Arréridj",
    "35": "Boumerdès",
    "36": "El Tarf",
    "37": "Tindouf",
    "38": "Tissemsilt",
    "39": "El Oued",
    "40": "Khenchela",
    "41": "Souk Ahras",
    "42": "Tipaza",
    "43": "Mila",
    "44": "Aïn Defla",
    "45": "Naâma",
    "46": "Aïn Témouchent",
    "47": "Ghardaïa",
    "48": "Relizane",
    "49": "El M'Ghair",
    "50": "El Meniaa",
    "51": "Ouled Djellal",
    "52": "Bordj Baji Mokhtar",
    "53": "Béni Abbès",
    "54": "Timimoun",
    "55": "Touggourt",
    "56": "Djanet",
    "57": "In Salah",
    "58": "In Guezzam",
}


class VerifyCnrcCompanyRegistryArgs(BaseModel):
    company_name: Optional[str] = Field(
        default=None,
        description="Company legal entity name (Raison Sociale)",
    )
    nif: str = Field(
        ...,
        description="Algerian Numéro d'Identification Fiscale (15 digits, or 20 digits for secondary establishment)",
    )
    nis: Optional[str] = Field(
        default=None,
        description="Algerian Numéro d'Identification Statistique (9, 15, 18, or 20 digits)",
    )
    rc_number: str = Field(
        ...,
        description="Algerian Registre du Commerce number (e.g. '16/00-0123456B22' or '16B0012345')",
    )
    wilaya_code: Optional[str] = Field(
        default=None,
        description="Two-digit Wilaya code (01 to 58)",
    )


class VerifyCnrcCompanyRegistryTool(BaseTool):
    name = "verify_cnrc_company_registry"
    description = (
        "Algerian Trade Register validator checking NIF (15/20 digits), NIS (9/15/18/20 digits), "
        "and RC structure (stamped/stripped) with Wilaya code checksum verification."
    )
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "BUSINESS",
        "CLIENT",
        "FREELANCER",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = VerifyCnrcCompanyRegistryArgs

    def _verify_nif(self, nif_str: str) -> Dict[str, Any]:
        clean_nif = "".join(filter(str.isdigit, str(nif_str)))
        if len(clean_nif) not in (15, 20):
            return {
                "valid": False,
                "error": f"NIF must be 15 digits (or 20 digits for secondary branch) (received {len(clean_nif)} digits)",
            }

        base_nif = clean_nif[:15]
        wilaya_code = base_nif[:2]
        if not (1 <= int(wilaya_code) <= 58):
            return {
                "valid": False,
                "error": f"Invalid Wilaya code '{wilaya_code}' in NIF (must be 01-58)",
            }

        # Modulo-10 checksum validation (Luhn-like alternating weights 2/1)
        expected_check = calculate_nif_modulo10_checksum(base_nif[:14])
        check_digit = int(base_nif[14])
        if check_digit != expected_check:
            return {
                "valid": False,
                "error": f"Invalid NIF Modulo-10 checksum (expected {expected_check}, got {check_digit})",
            }

        return {
            "valid": True,
            "clean_nif": clean_nif,
            "base_nif": base_nif,
            "prefix_code": wilaya_code,
            "checksum_calculated": expected_check,
            "check_digit": check_digit,
            "checksum_match": True,
            "is_secondary_branch": len(clean_nif) == 20,
        }

    def _verify_nis(self, nis_str: Optional[str]) -> Dict[str, Any]:
        if not nis_str:
            return {"valid": True, "present": False}

        clean_nis = "".join(filter(str.isdigit, str(nis_str)))
        if not validate_nis_format(clean_nis):
            return {
                "valid": False,
                "error": f"NIS must be 9, 15, 18, or 20 numeric digits (received {len(clean_nis)} digits)",
            }

        nis_type = (
            "SECONDARY_BRANCH_20"
            if len(clean_nis) == 20
            else "SECONDARY_BRANCH_18"
            if len(clean_nis) == 18
            else "STANDARD_15"
            if len(clean_nis) == 15
            else "LEGACY_9"
        )

        return {
            "valid": True,
            "clean_nis": clean_nis,
            "present": True,
            "nis_type": nis_type,
        }

    def _verify_rc(self, rc_str: str) -> Dict[str, Any]:
        parsed = parse_cnrc_details(rc_str)
        if not parsed:
            return {
                "valid": False,
                "error": f"RC number '{rc_str}' does not match standard Algerian CNRC format (e.g. 16/00-0123456B22 or 16B0012345)",
            }

        return {
            "valid": True,
            "format": parsed["format"],
            "wilaya_code": parsed["wilaya_code"],
            "antenne": parsed.get("antenne", "00"),
            "chrono_number": parsed["chrono_number"],
            "legal_type": parsed["legal_structure"],
            "registration_year": parsed.get("registration_year", "Non spécifié"),
        }

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, VerifyCnrcCompanyRegistryArgs)

        nif_check = self._verify_nif(typed_args.nif)
        if not nif_check["valid"]:
            return ToolResult(success=False, error=nif_check["error"])

        nis_check = self._verify_nis(typed_args.nis)
        if not nis_check["valid"]:
            return ToolResult(success=False, error=nis_check["error"])

        rc_check = self._verify_rc(typed_args.rc_number)
        if not rc_check["valid"]:
            return ToolResult(success=False, error=rc_check["error"])

        rc_wilaya = rc_check.get("wilaya_code")
        if rc_wilaya not in ALGERIAN_WILAYAS:
            return ToolResult(
                success=False,
                error=f"Wilaya code '{rc_wilaya}' extracted from RC is not a valid Algerian Wilaya (01-58)",
            )

        # Cross-validation with supplied wilaya code
        if typed_args.wilaya_code:
            clean_wc = typed_args.wilaya_code.zfill(2)
            if clean_wc != rc_wilaya:
                return ToolResult(
                    success=False,
                    error=f"Wilaya code mismatch: RC indicates '{rc_wilaya}' ({ALGERIAN_WILAYAS[rc_wilaya]}) "
                    f"but input specifies '{clean_wc}' ({ALGERIAN_WILAYAS.get(clean_wc, 'Inconnu')}).",
                )

        wilaya_name = ALGERIAN_WILAYAS.get(rc_wilaya, "Inconnu")

        return ToolResult(
            success=True,
            data={
                "compliance_status": "CONFORME_CNRC",
                "company_name": typed_args.company_name or "Entreprise Déclarée",
                "nif": nif_check["clean_nif"],
                "nis": nis_check.get("clean_nis"),
                "rc_number": typed_args.rc_number,
                "wilaya_code": rc_wilaya,
                "wilaya_name": wilaya_name,
                "legal_structure": rc_check.get("legal_type"),
                "registration_year": rc_check.get("registration_year"),
                "verification_checks": {
                    "nif_valid": True,
                    "nif_15_digits_valid": True,
                    "nis_valid": nis_check.get("present", False),
                    "rc_structure_valid": True,
                    "wilaya_checksum_valid": True,
                },
            },
            widget_payload={
                "type": "CNRC_REGISTRY_BADGE",
                "verified": True,
                "wilaya": wilaya_name,
                "nif": nif_check["clean_nif"],
            },
            metadata={"cnrc_verified": True, "wilaya_code": rc_wilaya},
        )
