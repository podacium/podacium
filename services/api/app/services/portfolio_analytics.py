"""
TamWheel Sovereign Ethical Agentic Venture OS — Portfolio Analytics Engine.
Pillar 2: Mathematical Performance Analytics, Time-Weighted Return (TWR),
Money-Weighted Return (MWR / IRR), Sharpe Ratio Simulator, and 58-Wilaya Diversification.

Mathematical Foundations:
1. Time-Weighted Return (TWR):
   Eliminates cash flow distortion to measure pure investment selection skill:
   TWR = Product(1 + R_t) - 1, where R_t = (V_t_end - (V_t_start + C_t)) / (V_t_start + C_t).
2. Money-Weighted Return (MWR / Internal Rate of Return):
   Solves for r where Net Present Value:
   NPV = Sum(CF_t / (1 + r)^t) + V_terminal / (1 + r)^T = 0.
3. Sharpe Ratio Simulator:
   Sharpe = (R_p - R_f) / sigma_p, where R_f is the simulated risk-free rate (3.5% Algerian Sovereign T-Bond proxy).
4. Sovereign Wilaya Diversification Index (Decree 19-12 58 Wilayas):
   Calculates capital allocation share s_w across all 58 Algerian Wilayas.
   Herfindahl-Hirschman Index: HHI = Sum(s_w^2).
   Normalized Diversification Score (0 - 100):
   Score = 100 * (1 - (HHI - 1/58) / (1 - 1/58)), clamped to [0, 100].
   Shannon Entropy: H = -Sum(s_w * ln(s_w)) / ln(58).
"""

import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

logger = logging.getLogger(__name__)

NUM_ALGERIAN_WILAYAS: int = 58
DEFAULT_RISK_FREE_RATE: float = 0.035  # 3.5% Algerian sovereign rate proxy

# 58 Official Algerian Wilayas (Decree 19-12 of Dec 2019)
WILAYA_NAMES_DZ: Dict[int, str] = {
    1: "Adrar", 2: "Chlef", 3: "Laghouat", 4: "Oum El Bouaghi", 5: "Batna",
    6: "Béjaïa", 7: "Biskra", 8: "Béchar", 9: "Blida", 10: "Bouira",
    11: "Tamanrasset", 12: "Tébessa", 13: "Tlemcen", 14: "Tiaret", 15: "Tizi Ouzou",
    16: "Alger", 17: "Djelfa", 18: "Jijel", 19: "Sétif", 20: "Saïda",
    21: "Skikda", 22: "Sidi Bel Abbès", 23: "Annaba", 24: "Guelma", 25: "Constantine",
    26: "Médéa", 27: "Mostaganem", 28: "M'Sila", 29: "Mascara", 30: "Ouargla",
    31: "Oran", 32: "El Bayadh", 33: "Illizi", 34: "Bordj Bou Arréridj", 35: "Boumerdès",
    36: "El Tarf", 37: "Tindouf", 38: "Tissemsilt", 39: "El Oued", 40: "Khenchela",
    41: "Souk Ahras", 42: "Tipaza", 43: "Mila", 44: "Aïn Defla", 45: "Naâma",
    46: "Aïn Témouchent", 47: "Ghardaïa", 48: "Relizane", 49: "Timimoun", 50: "Bordj Badji Mokhtar",
    51: "Ouled Djellal", 52: "Béni Abbès", 53: "In Salah", 54: "In Guezzam", 55: "Touggourt",
    56: "Djanet", 57: "El M'Ghair", 58: "El Meniaa",
}


class CashFlowPeriod(BaseModel):
    """Sub-period cash flow and valuation for TWR and MWR calculations."""
    period_index: int
    start_value: float
    end_value: float
    cash_inflow: float = 0.0  # External pledge or starter grant
    cash_outflow: float = 0.0


class WilayaAllocation(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    wilaya_code: int
    wilaya_name: str
    amount_dzd: int
    share_pct: float
    startups_count: int


class PortfolioAnalyticsResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    user_id: int
    initial_capital_dzd: int
    current_portfolio_value_dzd: int
    net_profit_dzd: int
    simple_roi_pct: float
    time_weighted_return_pct: float
    money_weighted_return_pct: float
    sharpe_ratio: float
    portfolio_volatility_pct: float
    risk_free_rate_pct: float
    wilaya_diversification_score: float  # 0 to 100
    hhi_index: float
    shannon_entropy_ratio: float
    active_wilayas_count: int
    total_wilayas_count: int = NUM_ALGERIAN_WILAYAS
    top_wilaya_allocations: List[WilayaAllocation]
    calculated_at: str


class PortfolioAnalyticsEngine:
    """
    Mathematical engine for computing high-fidelity institutional analytics on virtual portfolios:
    - Time-Weighted Return (TWR)
    - Money-Weighted Return (MWR / IRR)
    - Sharpe Ratio with Volatility Simulation
    - 58-Wilaya Sovereign Diversification Index (HHI & Shannon Entropy)
    """

    @staticmethod
    def calculate_time_weighted_return(sub_periods: List[CashFlowPeriod]) -> float:
        """
        Calculates Time-Weighted Return (TWR):
        TWR = Product(1 + R_t) - 1.
        R_t = (end_value - (start_value + net_flow)) / (start_value + net_flow).
        """
        if not sub_periods:
            return 0.0

        product = 1.0
        for p in sub_periods:
            base = p.start_value + p.cash_inflow - p.cash_outflow
            if base <= 0:
                continue
            r_t = (p.end_value - base) / base
            product *= (1.0 + r_t)

        twr = (product - 1.0) * 100.0
        return round(twr, 2)

    @staticmethod
    def calculate_money_weighted_return(
        cash_flows: List[Tuple[float, float]],  # list of (time_in_years, cash_flow)
        terminal_value: float,
        terminal_time: float,
    ) -> float:
        """
        Approximates Money-Weighted Return (MWR / IRR) using Newton-Raphson method:
        NPV(r) = Sum(CF_t / (1 + r)^t) + V_terminal / (1 + r)^T = 0.
        """
        if terminal_value <= 0 and not cash_flows:
            return 0.0

        # Initial guess r = 0.10 (10%)
        r = 0.10
        max_iter = 50
        tolerance = 1e-4

        for _ in range(max_iter):
            npv = 0.0
            d_npv = 0.0

            for t, cf in cash_flows:
                denom = (1.0 + r) ** t
                if denom == 0:
                    continue
                npv += cf / denom
                d_npv -= (t * cf) / ((1.0 + r) ** (t + 1))

            # Add terminal value
            denom_term = (1.0 + r) ** terminal_time
            if denom_term != 0:
                npv += terminal_value / denom_term
                d_npv -= (terminal_time * terminal_value) / ((1.0 + r) ** (terminal_time + 1))

            if abs(npv) < tolerance:
                break

            if d_npv == 0:
                break

            r_new = r - (npv / d_npv)
            if r_new <= -0.99:
                r_new = -0.90
            r = r_new

        return round(r * 100.0, 2)

    @staticmethod
    def calculate_sharpe_ratio(
        periodic_returns: List[float],
        risk_free_rate: float = DEFAULT_RISK_FREE_RATE,
        annualization_factor: float = 12.0,  # 12 gameweeks / monthly
    ) -> Tuple[float, float]:
        """
        Calculates the simulated annualized Sharpe Ratio:
        Sharpe = (Mean Return - Risk Free Rate) / Std Dev.
        Returns: (sharpe_ratio, annualized_volatility_pct).
        """
        if len(periodic_returns) < 2:
            return 0.0, 0.0

        n = len(periodic_returns)
        mean_r = sum(periodic_returns) / n
        variance = sum((r - mean_r) ** 2 for r in periodic_returns) / (n - 1)
        std_dev = math.sqrt(variance)

        if std_dev == 0:
            return 0.0, 0.0

        annualized_return = mean_r * annualization_factor
        annualized_volatility = std_dev * math.sqrt(annualization_factor)

        sharpe = (annualized_return - risk_free_rate) / annualized_volatility
        return round(sharpe, 2), round(annualized_volatility * 100.0, 2)

    @staticmethod
    def calculate_wilaya_diversification(
        allocations_by_wilaya: Dict[int, int],  # wilaya_code (1-58) -> amount_dzd
    ) -> Dict[str, Any]:
        """
        Computes the sovereign 58-Wilaya Diversification Index:
        1. HHI = Sum(s_w^2).
        2. Normalized Diversification Score (0 - 100):
           Score = 100 * (1 - (HHI - 1/58) / (1 - 1/58)).
        3. Normalized Shannon Entropy: H = -Sum(s_w * ln(s_w)) / ln(58).
        """
        total_amount = sum(allocations_by_wilaya.values())
        if total_amount <= 0:
            return {
                "score": 0.0,
                "hhi": 1.0,
                "entropy_ratio": 0.0,
                "active_wilayas": 0,
                "breakdown": [],
            }

        shares: Dict[int, float] = {}
        for w, amt in allocations_by_wilaya.items():
            if amt > 0:
                shares[w] = amt / total_amount

        # 1. Herfindahl-Hirschman Index (HHI)
        hhi = sum(s ** 2 for s in shares.values())

        # Baseline minimum HHI for perfect diversification across 58 wilayas: 1/58
        min_hhi = 1.0 / NUM_ALGERIAN_WILAYAS
        max_hhi = 1.0  # complete concentration in 1 wilaya

        # Normalized Diversification Score (0 = 100% concentrated, 100 = uniformly spread across all 58 wilayas)
        if max_hhi == min_hhi:
            score = 100.0
        else:
            raw_score = 100.0 * (1.0 - (hhi - min_hhi) / (max_hhi - min_hhi))
            score = max(0.0, min(100.0, raw_score))

        # 2. Shannon Entropy Ratio
        entropy = -sum(s * math.log(s) for s in shares.values() if s > 0)
        max_entropy = math.log(NUM_ALGERIAN_WILAYAS)
        entropy_ratio = round(entropy / max_entropy, 3)

        # Build detailed allocation breakdown
        breakdown: List[WilayaAllocation] = []
        for w, amt in sorted(allocations_by_wilaya.items(), key=lambda x: x[1], reverse=True):
            if amt > 0:
                breakdown.append(
                    WilayaAllocation(
                        wilaya_code=w,
                        wilaya_name=WILAYA_NAMES_DZ.get(w, f"Wilaya {w}"),
                        amount_dzd=amt,
                        share_pct=round(shares[w] * 100.0, 2),
                        startups_count=1,
                    )
                )

        return {
            "score": round(score, 2),
            "hhi": round(hhi, 4),
            "entropy_ratio": entropy_ratio,
            "active_wilayas": len(shares),
            "breakdown": breakdown,
        }

    @classmethod
    def evaluate_portfolio(
        cls,
        user_id: int,
        initial_grant_dzd: int,
        holdings: List[Dict[str, Any]],  # [{"amount_dzd": int, "wilaya": int, "current_value_dzd": int}]
        cash_balance_dzd: int,
    ) -> PortfolioAnalyticsResult:
        """
        Generates full institutional analytics pack for a user's simulation portfolio.
        """
        invested_total = sum(h.get("amount_dzd", 0) for h in holdings)
        holdings_value = sum(h.get("current_value_dzd", h.get("amount_dzd", 0)) for h in holdings)
        portfolio_val = cash_balance_dzd + holdings_value
        net_profit = portfolio_val - initial_grant_dzd
        simple_roi = round((net_profit / max(1, initial_grant_dzd)) * 100.0, 2)

        # 1. Time-Weighted Return (sub-periods approximation)
        sub_periods = [
            CashFlowPeriod(
                period_index=1,
                start_value=float(initial_grant_dzd),
                end_value=float(portfolio_val),
                cash_inflow=0.0,
            )
        ]
        twr = cls.calculate_time_weighted_return(sub_periods)

        # 2. Money-Weighted Return
        cash_flows = [(0.0, -float(initial_grant_dzd))]
        mwr = cls.calculate_money_weighted_return(
            cash_flows=cash_flows,
            terminal_value=float(portfolio_val),
            terminal_time=1.0,
        )

        # 3. Simulated Sharpe Ratio based on position return dispersion
        position_returns = []
        for h in holdings:
            cost = max(1, h.get("amount_dzd", 1))
            val = h.get("current_value_dzd", cost)
            ret = (val - cost) / cost
            position_returns.append(ret)

        if not position_returns:
            position_returns = [0.0, 0.0]
        elif len(position_returns) == 1:
            position_returns.append(0.0)

        sharpe, vol_pct = cls.calculate_sharpe_ratio(position_returns)

        # 4. Wilaya Diversification
        wilaya_allocs: Dict[int, int] = {}
        for h in holdings:
            w = h.get("wilaya", 16)  # Default Algiers if omitted
            amt = h.get("current_value_dzd", h.get("amount_dzd", 0))
            wilaya_allocs[w] = wilaya_allocs.get(w, 0) + amt

        wilaya_div = cls.calculate_wilaya_diversification(wilaya_allocs)

        return PortfolioAnalyticsResult(
            user_id=user_id,
            initial_capital_dzd=initial_grant_dzd,
            current_portfolio_value_dzd=portfolio_val,
            net_profit_dzd=net_profit,
            simple_roi_pct=simple_roi,
            time_weighted_return_pct=twr,
            money_weighted_return_pct=mwr,
            sharpe_ratio=sharpe,
            portfolio_volatility_pct=vol_pct,
            risk_free_rate_pct=round(DEFAULT_RISK_FREE_RATE * 100.0, 2),
            wilaya_diversification_score=wilaya_div["score"],
            hhi_index=wilaya_div["hhi"],
            shannon_entropy_ratio=wilaya_div["entropy_ratio"],
            active_wilayas_count=wilaya_div["active_wilayas"],
            total_wilayas_count=NUM_ALGERIAN_WILAYAS,
            top_wilaya_allocations=wilaya_div["breakdown"][:10],
            calculated_at=datetime.now(timezone.utc).isoformat(),
        )


# Global Singleton Analytics Engine Instance
portfolio_analytics_engine = PortfolioAnalyticsEngine()
