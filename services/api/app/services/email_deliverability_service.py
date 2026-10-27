"""
Automated DNS Deliverability Validation Service (SPF, DKIM, DMARC, MX).
Audits and monitors domain email authentication records against enterprise standards.
"""

import logging
from typing import Dict, Any, List, Optional
import dns.resolver
import dns.exception

logger = logging.getLogger("podacium.services.email_deliverability")


class EmailDeliverabilityService:
    def __init__(self, domain: str = "podacium.com"):
        self.domain = domain

    def check_spf(self) -> Dict[str, Any]:
        """Validate SPF (Sender Policy Framework) TXT record."""
        result: Dict[str, Any] = {
            "status": "FAIL",
            "record": None,
            "has_purelymail": False,
            "has_stale_brevo": False,
            "policy": None,
            "warnings": [],
        }
        try:
            answers = dns.resolver.resolve(self.domain, "TXT")
            for rdata in answers:
                txt = "".join(
                    [
                        part.decode("utf-8") if isinstance(part, bytes) else str(part)
                        for part in rdata.strings
                    ]
                )
                if txt.startswith("v=spf1"):
                    result["record"] = txt
                    result["has_purelymail"] = "include:_spf.purelymail.com" in txt
                    result["has_stale_brevo"] = "include:spf.brevo.com" in txt
                    if txt.endswith("~all"):
                        result["policy"] = "SoftFail (~all)"
                    elif txt.endswith("-all"):
                        result["policy"] = "Fail (-all)"
                    else:
                        result["policy"] = "Permissive / Unknown"

                    if result["has_stale_brevo"]:
                        result["warnings"].append(
                            "Legacy 'include:spf.brevo.com' detected. Recommend removing."
                        )
                    if result["has_purelymail"]:
                        result["status"] = (
                            "PASS" if not result["has_stale_brevo"] else "WARNING"
                        )
                    else:
                        result["warnings"].append(
                            "Missing 'include:_spf.purelymail.com'"
                        )
                    break
            if not result["record"]:
                result["warnings"].append(f"No SPF record found on {self.domain}")
        except Exception as e:
            result["warnings"].append(f"DNS query error for SPF: {str(e)}")
        return result

    def check_dkim(self, selectors: Optional[List[str]] = None) -> Dict[str, Any]:
        """Validate DKIM (DomainKeys Identified Mail) public key records."""
        selectors = selectors or ["purelymail1", "purelymail2"]
        result: Dict[str, Any] = {"status": "PASS", "selectors": {}, "warnings": []}
        valid_count = 0

        for sel in selectors:
            sel_domain = f"{sel}._domainkey.{self.domain}"
            sel_res: Dict[str, Any] = {
                "valid": False,
                "key_length_bits": 0,
                "record": None,
                "error": None,
            }
            try:
                answers = dns.resolver.resolve(sel_domain, "TXT")
                for rdata in answers:
                    txt = "".join(
                        [
                            part.decode("utf-8")
                            if isinstance(part, bytes)
                            else str(part)
                            for part in rdata.strings
                        ]
                    )
                    if "v=DKIM1" in txt and "p=" in txt:
                        sel_res["valid"] = True
                        sel_res["record"] = txt[:60] + "..."
                        p_part = [
                            chunk.strip()
                            for chunk in txt.split(";")
                            if chunk.strip().startswith("p=")
                        ]
                        if p_part:
                            pub_b64 = p_part[0][2:].strip()
                            sel_res["key_length_bits"] = (
                                2048 if len(pub_b64) >= 340 else 1024
                            )
                        valid_count += 1
                        break
            except Exception as e:
                sel_res["error"] = str(e)

            result["selectors"][sel] = sel_res
            if not sel_res["valid"] or sel_res["key_length_bits"] < 2048:
                result["status"] = "WARNING"
                result["warnings"].append(
                    f"Selector {sel} missing or below 2048-bit RSA."
                )

        if valid_count == 0:
            result["status"] = "FAIL"

        return result

    def check_dmarc(self) -> Dict[str, Any]:
        """Validate DMARC (Domain-based Message Authentication) TXT policy."""
        result: Dict[str, Any] = {
            "status": "FAIL",
            "record": None,
            "policy": None,
            "rua": None,
            "is_reject": False,
            "warnings": [],
        }
        try:
            answers = dns.resolver.resolve(f"_dmarc.{self.domain}", "TXT")
            for rdata in answers:
                txt = "".join(
                    [
                        part.decode("utf-8") if isinstance(part, bytes) else str(part)
                        for part in rdata.strings
                    ]
                )
                if txt.startswith("v=DMARC1"):
                    result["record"] = txt
                    parts = {
                        k.strip(): v.strip()
                        for k, v in [
                            item.split("=", 1) for item in txt.split(";") if "=" in item
                        ]
                    }
                    result["policy"] = parts.get("p", "none")
                    result["rua"] = parts.get("rua", "")
                    result["is_reject"] = result["policy"] == "reject"

                    if result["policy"] != "reject":
                        result["status"] = "WARNING"
                        result["warnings"].append(
                            f"DMARC policy is '{result['policy']}', target standard is 'reject'."
                        )
                    if "dmarc@podacium.com" not in result["rua"]:
                        result["warnings"].append(
                            f"DMARC rua does not route to dmarc@podacium.com (currently '{result['rua']}')."
                        )
                    if result["is_reject"] and "dmarc@podacium.com" in result["rua"]:
                        result["status"] = "PASS"
                    break
            if not result["record"]:
                result["warnings"].append(
                    f"No DMARC record found on _dmarc.{self.domain}"
                )
        except Exception as e:
            result["warnings"].append(f"DMARC query error: {str(e)}")
        return result

    def check_mx(self) -> Dict[str, Any]:
        """Validate MX (Mail Exchange) routing."""
        result: Dict[str, Any] = {"status": "FAIL", "records": [], "warnings": []}
        try:
            answers = dns.resolver.resolve(self.domain, "MX")
            for rdata in answers:
                exchange = str(rdata.exchange).rstrip(".")
                result["records"].append(
                    {"preference": rdata.preference, "host": exchange}
                )
                if "purelymail.com" in exchange:
                    result["status"] = "PASS"
        except Exception as e:
            result["warnings"].append(f"MX query error: {str(e)}")
        return result

    def full_audit(self) -> Dict[str, Any]:
        """Perform comprehensive DNS deliverability diagnostic audit."""
        spf = self.check_spf()
        dkim = self.check_dkim()
        dmarc = self.check_dmarc()
        mx = self.check_mx()

        active_count = 0
        if spf["status"] in ("PASS", "WARNING"):
            active_count += 1
        if dkim["status"] in ("PASS", "WARNING"):
            active_count += 1
        if dmarc["status"] in ("PASS", "WARNING"):
            active_count += 1

        overall = "PASS"
        if "FAIL" in (spf["status"], dkim["status"], dmarc["status"]):
            overall = "FAIL"
        elif "WARNING" in (spf["status"], dkim["status"], dmarc["status"]):
            overall = "WARNING"

        return {
            "domain": self.domain,
            "overall_status": overall,
            "active_protocols_count": active_count,
            "active_protocols_label": f"{active_count}/3 Protocols Active",
            "is_healthy": overall in ("PASS", "WARNING") and active_count == 3,
            "spf": spf,
            "dkim": dkim,
            "dmarc": dmarc,
            "mx": mx,
        }


deliverability_service = EmailDeliverabilityService()
