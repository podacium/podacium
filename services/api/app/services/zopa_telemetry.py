"""
TamWheel Sovereign Ethical Agentic Venture OS — ZOPA Telemetry Generator.
Generates multi-dimensional radar, 2D contour, and 3D surface coordinates
for frontend rendering of the Zone of Possible Agreement (ZOPA) and Nash Bargaining Frontier.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.services.maut_negotiation import (
    DealOffer,
    NegotiationRound,
    NegotiationSessionState,
    MAUTUtilityCalculator,
    DEFAULT_BATNA_FOUNDER,
    DEFAULT_BATNA_INVESTOR,
)

logger = logging.getLogger(__name__)


# =============================================================================
# SCHEMAS
# =============================================================================

class Point2D(BaseModel):
    x: float = Field(..., description="Pre-Money Valuation in DZD")
    y: float = Field(..., description="Investment Ticket / Amount in DZD")


class Polygon2D(BaseModel):
    label: str
    fill_color: str
    stroke_color: str
    vertices: List[Point2D]


class ConcessionTrajectoryPoint(BaseModel):
    round_number: int
    founder_point: Point2D
    investor_point: Point2D
    gap_pct: float
    in_zopa: bool


class ZOPAContour2D(BaseModel):
    valuation_min_dzd: float
    valuation_max_dzd: float
    ticket_min_dzd: float
    ticket_max_dzd: float
    founder_region: Polygon2D
    investor_region: Polygon2D
    zopa_intersection: Optional[Polygon2D] = None
    nash_equilibrium_point: Optional[Point2D] = None
    trajectory: List[ConcessionTrajectoryPoint] = Field(default_factory=list)


class RadarAxisValue(BaseModel):
    axis: str
    founder_score: float
    investor_score: float
    zopa_min: float
    zopa_max: float
    agreed_score: Optional[float] = None


class ZOPARadar5D(BaseModel):
    axes: List[str]
    axis_data: List[RadarAxisValue]
    founder_polygon: List[float]
    investor_polygon: List[float]
    agreed_polygon: Optional[List[float]] = None
    zopa_envelope_min: List[float]
    zopa_envelope_max: List[float]


class SurfacePoint3D(BaseModel):
    valuation_dzd: float
    ticket_dzd: float
    nash_product: float


class ZOPASurface3D(BaseModel):
    grid_points: List[SurfacePoint3D]
    optimal_peak: Optional[SurfacePoint3D] = None


class CompleteZOPATelemetryResponse(BaseModel):
    session_id: str
    startup_name: str
    has_viable_zopa: bool
    zopa_overlap_dzd: float
    contour_2d: ZOPAContour2D
    radar_5d: ZOPARadar5D
    surface_3d: ZOPASurface3D


# =============================================================================
# ZOPA TELEMETRY GENERATOR
# =============================================================================

class ZOPATelemetryGenerator:
    """
    Generates multi-dimensional telemetry for interactive visual analytics:
    - 2D Valuation vs Ticket contour maps
    - 5D MAUT attribute radar charts
    - 3D Nash product surface grids
    """

    RADAR_AXES = [
        "Pre-Money Valuation",
        "Investment Ticket",
        "Equity Percentage",
        "Milestone Tranches",
        "Governance Rights",
    ]

    def generate_telemetry(self, session: NegotiationSessionState) -> CompleteZOPATelemetryResponse:
        f_init = session.founder_initial
        i_init = session.investor_initial
        f_res = session.founder_reservation_val
        i_res = session.investor_reservation_val
        agreed = session.agreed_term_sheet

        has_zopa = i_res >= f_res
        zopa_overlap = max(0.0, i_res - f_res)

        # ---------------------------------------------------------------------
        # 1. 2D CONTOUR MESH (Pre-Money Valuation vs Investment Ticket)
        # ---------------------------------------------------------------------
        val_min = min(i_init.pre_money_valuation_dzd, f_res) * 0.85
        val_max = max(f_init.pre_money_valuation_dzd, i_res) * 1.15
        ticket_min = min(f_init.investment_ticket_dzd, i_init.investment_ticket_dzd) * 0.85
        ticket_max = max(f_init.investment_ticket_dzd, i_init.investment_ticket_dzd) * 1.15

        # Founder Acceptable Region: [f_res, val_max] x [ticket_min, ticket_max]
        founder_poly = Polygon2D(
            label="Founder Acceptance Region",
            fill_color="rgba(59, 130, 246, 0.15)",
            stroke_color="#3B82F6",
            vertices=[
                Point2D(x=f_res, y=ticket_min),
                Point2D(x=val_max, y=ticket_min),
                Point2D(x=val_max, y=ticket_max),
                Point2D(x=f_res, y=ticket_max),
            ],
        )

        # Investor Acceptable Region: [val_min, i_res] x [ticket_min, ticket_max]
        investor_poly = Polygon2D(
            label="Investor Acceptance Region",
            fill_color="rgba(16, 185, 129, 0.15)",
            stroke_color="#10B981",
            vertices=[
                Point2D(x=val_min, y=ticket_min),
                Point2D(x=i_res, y=ticket_min),
                Point2D(x=i_res, y=ticket_max),
                Point2D(x=val_min, y=ticket_max),
            ],
        )

        # ZOPA Intersection Polygon: [f_res, i_res] x [ticket_min, ticket_max]
        zopa_poly = None
        if has_zopa:
            zopa_poly = Polygon2D(
                label="Zone of Possible Agreement (ZOPA)",
                fill_color="rgba(245, 158, 11, 0.25)",
                stroke_color="#F59E0B",
                vertices=[
                    Point2D(x=f_res, y=ticket_min),
                    Point2D(x=i_res, y=ticket_min),
                    Point2D(x=i_res, y=ticket_max),
                    Point2D(x=f_res, y=ticket_max),
                ],
            )

        # Trajectory points from rounds
        trajectory: List[ConcessionTrajectoryPoint] = []
        for r in session.rounds:
            trajectory.append(
                ConcessionTrajectoryPoint(
                    round_number=r.round_number,
                    founder_point=Point2D(
                        x=r.founder_offer.pre_money_valuation_dzd,
                        y=r.founder_offer.investment_ticket_dzd,
                    ),
                    investor_point=Point2D(
                        x=r.investor_offer.pre_money_valuation_dzd,
                        y=r.investor_offer.investment_ticket_dzd,
                    ),
                    gap_pct=r.zopa_gap_pct,
                    in_zopa=r.in_zopa,
                )
            )

        nash_pt = None
        if agreed:
            nash_pt = Point2D(x=agreed.pre_money_valuation_dzd, y=agreed.investment_ticket_dzd)

        contour_2d = ZOPAContour2D(
            valuation_min_dzd=val_min,
            valuation_max_dzd=val_max,
            ticket_min_dzd=ticket_min,
            ticket_max_dzd=ticket_max,
            founder_region=founder_poly,
            investor_region=investor_poly,
            zopa_intersection=zopa_poly,
            nash_equilibrium_point=nash_pt,
            trajectory=trajectory,
        )

        # ---------------------------------------------------------------------
        # 2. 5D MAUT RADAR CHART
        # ---------------------------------------------------------------------
        val_bounds = (val_min, val_max)
        target_ticket = f_init.investment_ticket_dzd
        max_budget = ticket_max

        u_f_init = MAUTUtilityCalculator.evaluate_founder_utility(
            offer=f_init, val_bounds=val_bounds, target_ticket=target_ticket
        )
        u_i_init = MAUTUtilityCalculator.evaluate_investor_utility(
            offer=i_init, val_bounds=val_bounds, max_budget=max_budget
        )

        u_agreed_f = None
        if agreed:
            u_agreed_f = MAUTUtilityCalculator.evaluate_founder_utility(
                offer=agreed, val_bounds=val_bounds, target_ticket=target_ticket
            )

        radar_axis_data = [
            RadarAxisValue(
                axis="Pre-Money Valuation",
                founder_score=u_f_init.pre_money_valuation,
                investor_score=u_i_init.pre_money_valuation,
                zopa_min=0.30,
                zopa_max=0.75,
                agreed_score=u_agreed_f.pre_money_valuation if u_agreed_f else None,
            ),
            RadarAxisValue(
                axis="Investment Ticket",
                founder_score=u_f_init.investment_ticket,
                investor_score=u_i_init.investment_ticket,
                zopa_min=0.50,
                zopa_max=0.90,
                agreed_score=u_agreed_f.investment_ticket if u_agreed_f else None,
            ),
            RadarAxisValue(
                axis="Equity Percentage",
                founder_score=u_f_init.equity_percentage,
                investor_score=u_i_init.equity_percentage,
                zopa_min=0.40,
                zopa_max=0.80,
                agreed_score=u_agreed_f.equity_percentage if u_agreed_f else None,
            ),
            RadarAxisValue(
                axis="Milestone Tranches",
                founder_score=u_f_init.milestone_tranches,
                investor_score=u_i_init.milestone_tranches,
                zopa_min=0.60,
                zopa_max=0.90,
                agreed_score=u_agreed_f.milestone_tranches if u_agreed_f else None,
            ),
            RadarAxisValue(
                axis="Governance Rights",
                founder_score=u_f_init.governance_rights,
                investor_score=u_i_init.governance_rights,
                zopa_min=0.50,
                zopa_max=0.85,
                agreed_score=u_agreed_f.governance_rights if u_agreed_f else None,
            ),
        ]

        f_poly_scores = [d.founder_score for d in radar_axis_data]
        i_poly_scores = [d.investor_score for d in radar_axis_data]
        agreed_poly_scores = [d.agreed_score for d in radar_axis_data] if agreed else None
        zopa_min_scores = [d.zopa_min for d in radar_axis_data]
        zopa_max_scores = [d.zopa_max for d in radar_axis_data]

        radar_5d = ZOPARadar5D(
            axes=self.RADAR_AXES,
            axis_data=radar_axis_data,
            founder_polygon=f_poly_scores,
            investor_polygon=i_poly_scores,
            agreed_polygon=agreed_poly_scores,
            zopa_envelope_min=zopa_min_scores,
            zopa_envelope_max=zopa_max_scores,
        )

        # ---------------------------------------------------------------------
        # 3. 3D SURFACE GRID (Valuation, Ticket, NashProduct)
        # ---------------------------------------------------------------------
        grid_points: List[SurfacePoint3D] = []
        max_nash = 0.0
        peak_pt: Optional[SurfacePoint3D] = None

        v_steps = 6
        t_steps = 6
        v_span = (val_max - val_min) / (v_steps - 1)
        t_span = (ticket_max - ticket_min) / (t_steps - 1)

        for vi in range(v_steps):
            v_val = val_min + vi * v_span
            for ti in range(t_steps):
                t_val = ticket_min + ti * t_span
                probe_offer = DealOffer(
                    pre_money_valuation_dzd=v_val,
                    investment_ticket_dzd=t_val,
                )
                u_f_probe = MAUTUtilityCalculator.evaluate_founder_utility(
                    offer=probe_offer, val_bounds=val_bounds, target_ticket=target_ticket
                ).composite_utility
                u_i_probe = MAUTUtilityCalculator.evaluate_investor_utility(
                    offer=probe_offer, val_bounds=val_bounds, max_budget=max_budget
                ).composite_utility

                nash = max(0.0, u_f_probe - DEFAULT_BATNA_FOUNDER) * max(0.0, u_i_probe - DEFAULT_BATNA_INVESTOR)
                nash = round(nash, 4)

                pt = SurfacePoint3D(
                    valuation_dzd=round(v_val, -3),
                    ticket_dzd=round(t_val, -3),
                    nash_product=nash,
                )
                grid_points.append(pt)
                if nash > max_nash:
                    max_nash = nash
                    peak_pt = pt

        surface_3d = ZOPASurface3D(grid_points=grid_points, optimal_peak=peak_pt)

        return CompleteZOPATelemetryResponse(
            session_id=session.session_id,
            startup_name=session.startup_name,
            has_viable_zopa=has_zopa,
            zopa_overlap_dzd=round(zopa_overlap, 2),
            contour_2d=contour_2d,
            radar_5d=radar_5d,
            surface_3d=surface_3d,
        )


zopa_telemetry_generator = ZOPATelemetryGenerator()
