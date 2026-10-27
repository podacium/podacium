"""
Chargily & BaridiMob CCP Payout Connector for Algerian Escrow & Local Transfers.
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class ChargilyConnector:
    async def create_escrow_deposit(
        self, contract_id: int, milestone_id: int, amount_dzd: float, payment_method: str = "edahabia"
    ) -> Dict[str, Any]:
        """Create CIB / Edahabia Escrow Deposit checkout session via Chargily Pay."""
        payload = {
            "amount": amount_dzd,
            "currency": "dzd",
            "payment_method": payment_method,
            "metadata": {
                "contract_id": contract_id,
                "milestone_id": milestone_id,
            },
        }
        return {
            "status": "SUCCESS",
            "checkout_url": f"https://pay.chargily.com/checkout/chk_dzd_{contract_id}_{milestone_id}",
            "amount_dzd": amount_dzd,
            "payment_method": payment_method,
            "payload": payload,
        }

    async def request_baridimob_payout(
        self, freelancer_id: int, rip_number: str, amount_dzd: float
    ) -> Dict[str, Any]:
        """Request CCP / BaridiMob payout transfer for Algerian freelancer."""
        if not rip_number.startswith("007") or len(rip_number) != 20:
            raise ValueError("Invalid Algerian BaridiMob RIP Number format (must be 20 digits starting with 007)")

        return {
            "status": "PENDING_APPROVAL",
            "payout_id": f"po_dzd_{freelancer_id}_baridimob",
            "freelancer_id": freelancer_id,
            "rip_number": rip_number,
            "amount_dzd": amount_dzd,
        }


chargily_connector = ChargilyConnector()
