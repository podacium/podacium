"""
TamWheel Sovereign Ethical Agentic Venture OS — Simulation League Engine.
Implements the Fantasy Startup League (FSL) virtual crowdfunding ledger,
registration grants, atomic virtual pledge execution, and ROI leaderboard ranking.
Strictly zero real-money movement (pure simulation ledger under COSOB 23-01 CIP).
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma.enums import CampaignStatus, AnalystLevel

logger = logging.getLogger(__name__)

INITIAL_SIMULATION_GRANT_DZD = 50_000
DEFAULT_MIN_TICKET_DZD = 5_000


class SimulationEngine:
    """
    Simulation League Engine managing virtual wallets, atomic pledges,
    and Fantasy Startup League (FSL) ROI rankings.
    """

    def __init__(self, initial_grant: int = INITIAL_SIMULATION_GRANT_DZD):
        self.initial_grant = initial_grant

    async def get_user_virtual_balance(self, user_id: int) -> int:
        """
        Compute current available virtual DZD balance.
        Formula: Initial Grant (50,000 DZD) - Sum of all user's virtual pledges.
        """
        pledges = await prisma.virtualpledge.find_many(
            where={"userId": user_id}
        )
        total_pledged = sum(p.amountDzd for p in pledges)
        return max(0, self.initial_grant - total_pledged)

    async def get_user_simulation_wallet(self, user_id: int) -> Dict[str, Any]:
        """
        Retrieve comprehensive simulation wallet details including cash balance,
        active pledges, total portfolio value, and calculated ROI.
        """
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        pledges = await prisma.virtualpledge.find_many(
            where={"userId": user_id},
            include={"campaign": {"include": {"startup": True}}},
        )

        total_pledged = sum(p.amountDzd for p in pledges)
        available_balance = max(0, self.initial_grant - total_pledged)

        # Calculate current valuation of held startup shares
        active_investments_value = 0
        for p in pledges:
            campaign = p.campaign
            if not campaign:
                active_investments_value += p.amountDzd
                continue

            # Performance multiplier based on campaign progress and startup hype score
            target = max(1, campaign.targetAmountDzd)
            progress_ratio = min(2.0, campaign.raisedAmountDzd / target)
            hype = campaign.startup.hypeScore if campaign.startup else 50.0
            hype_factor = 1.0 + (hype / 200.0)  # e.g. 50 hype -> 1.25x

            position_multiplier = 1.0 + (0.5 * (progress_ratio - 0.5)) + (0.5 * (hype_factor - 1.0))
            position_multiplier = max(0.5, position_multiplier)

            active_investments_value += int(p.amountDzd * position_multiplier)

        total_portfolio_value = available_balance + active_investments_value
        roi_pct = round(((total_portfolio_value - self.initial_grant) / self.initial_grant) * 100.0, 2)

        # Determine analyst level based on achievements
        analyst_tier = await self.determine_analyst_tier(user_id, roi_pct)

        return {
            "userId": user_id,
            "fullName": user.fullName,
            "initialGrantDzd": self.initial_grant,
            "availableBalanceDzd": available_balance,
            "totalPledgedDzd": total_pledged,
            "activeInvestmentsValueDzd": active_investments_value,
            "portfolioValueDzd": total_portfolio_value,
            "roiPct": roi_pct,
            "pledgesCount": len(pledges),
            "analystTier": analyst_tier,
        }

    async def determine_analyst_tier(self, user_id: int, roi_pct: float) -> AnalystLevel:
        """
        Evaluate user tier:
        - SCOUT: Passed 5 curriculum modules (or ROI > 15%)
        - ANALYST: Top 10% portfolio ROI or ROI > 30%
        - PARTNER: ROI > 60% with at least 5 successful investments
        - NOVICE: Default baseline
        """
        # Check passed quiz results
        passed_quizzes = await prisma.financialquizresult.count(
            where={"userId": user_id, "passed": True}
        )
        pledges_count = await prisma.virtualpledge.count(
            where={"userId": user_id}
        )

        if roi_pct >= 60.0 and pledges_count >= 5:
            return AnalystLevel.PARTNER
        if roi_pct >= 30.0:
            return AnalystLevel.ANALYST
        if passed_quizzes >= 5 or roi_pct >= 15.0:
            return AnalystLevel.SCOUT

        return AnalystLevel.NOVICE

    async def execute_virtual_pledge(
        self,
        user_id: int,
        campaign_id: str,
        amount_dzd: int,
        equity_share_pct: Optional[float] = None,
    ) -> Any:
        """
        Execute an atomic virtual investment pledge in the TamWheel Simulation League.
        Guarantees:
        - Strictly simulation ledger (NO banking / real fiat API calls)
        - Campaign must be in ACTIVE_SIMULATION status
        - Amount must be >= campaign.minTicketDzd (default 5,000 DZD)
        - User's virtual balance must be >= amount_dzd
        - Campaign raisedAmountDzd is atomically incremented
        - If target is met, campaign status upgrades to FUNDED_SIMULATION
        """
        # Validate campaign existence and state
        campaign = await prisma.campaign.find_unique(where={"id": campaign_id})
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found",
            )

        if campaign.status != CampaignStatus.ACTIVE_SIMULATION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign is not currently accepting simulation pledges",
            )

        min_ticket = campaign.minTicketDzd or DEFAULT_MIN_TICKET_DZD
        if amount_dzd < min_ticket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum ticket size is {min_ticket} DZD",
            )

        # Check virtual balance
        current_balance = await self.get_user_virtual_balance(user_id)
        if current_balance < amount_dzd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient virtual balance. Available: {current_balance} DZD, Requested: {amount_dzd} DZD",
            )

        # Calculate implied equity share if not specified
        calculated_equity = equity_share_pct
        if calculated_equity is None and campaign.targetAmountDzd > 0:
            # Standard nominee ticket: proportion of target assuming 10% pool
            calculated_equity = round((amount_dzd / campaign.targetAmountDzd) * 10.0, 3)

        # Record VirtualPledge (simulation ledger)
        pledge = await prisma.virtualpledge.create(
            data={
                "campaignId": campaign_id,
                "userId": user_id,
                "amountDzd": amount_dzd,
                "equitySharePct": calculated_equity,
            }
        )

        # Increment campaign raisedAmountDzd
        new_raised = campaign.raisedAmountDzd + amount_dzd
        update_data: Dict[str, Any] = {"raisedAmountDzd": new_raised}

        # Check if campaign target reached
        if new_raised >= campaign.targetAmountDzd:
            update_data["status"] = CampaignStatus.FUNDED_SIMULATION

        await prisma.campaign.update(
            where={"id": campaign_id},
            data=update_data,
        )

        logger.info(
            f"Virtual pledge executed: User {user_id} pledged {amount_dzd} DZD to campaign {campaign_id}"
        )
        return pledge

    async def get_leaderboard(
        self,
        limit: int = 50,
        weekly: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Fantasy Startup League Leaderboard Service.
        Aggregates portfolio values across all active simulation managers,
        ranks them dynamically by portfolio value / ROI, and assigns analyst badges.
        """
        # Fetch all virtual pledges
        pledge_filter: Dict[str, Any] = {}
        if weekly:
            one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            pledge_filter["createdAt"] = {"gte": one_week_ago}

        pledges = await prisma.virtualpledge.find_many(
            where=pledge_filter,
            include={
                "user": True,
                "campaign": {"include": {"startup": True}},
            },
        )

        if not pledges:
            return []

        # Group pledges by user
        user_pledges_map: Dict[int, List[Any]] = {}
        user_map: Dict[int, Any] = {}
        for p in pledges:
            uid = p.userId
            user_pledges_map.setdefault(uid, []).append(p)
            if p.user:
                user_map[uid] = p.user

        leaderboard_items = []

        for uid, u_pledges in user_pledges_map.items():
            user = user_map.get(uid)
            full_name = user.fullName if user else f"Manager #{uid}"

            total_pledged = sum(p.amountDzd for p in u_pledges)
            available_balance = max(0, self.initial_grant - total_pledged)

            investments_value = 0
            for p in u_pledges:
                campaign = p.campaign
                if not campaign:
                    investments_value += p.amountDzd
                    continue

                target = max(1, campaign.targetAmountDzd)
                progress_ratio = min(2.0, campaign.raisedAmountDzd / target)
                hype = campaign.startup.hypeScore if campaign.startup else 50.0
                hype_factor = 1.0 + (hype / 200.0)

                multiplier = 1.0 + (0.5 * (progress_ratio - 0.5)) + (0.5 * (hype_factor - 1.0))
                investments_value += int(p.amountDzd * max(0.5, multiplier))

            portfolio_val = available_balance + investments_value
            roi_pct = round(((portfolio_val - self.initial_grant) / self.initial_grant) * 100.0, 2)
            analyst_tier = await self.determine_analyst_tier(uid, roi_pct)

            leaderboard_items.append({
                "userId": uid,
                "fullName": full_name,
                "portfolioValueDzd": portfolio_val,
                "successfulPledgesCount": len(u_pledges),
                "analystBadge": analyst_tier.value,
                "roiPct": roi_pct,
            })

        # Sort dynamically by portfolio value descending
        leaderboard_items.sort(key=lambda x: x["portfolioValueDzd"], reverse=True)

        # Assign dynamic rank
        for idx, item in enumerate(leaderboard_items[:limit], start=1):
            item["rank"] = idx

        return leaderboard_items[:limit]


simulation_engine = SimulationEngine()
