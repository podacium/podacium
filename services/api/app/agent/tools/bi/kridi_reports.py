"""
BI Kridi Aging Report Tool
Generates structured aging reports for Algerian traditional customer debt (Kridi / Créances Clients):
- Age buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days (Contentieux)
- Probability of default (PD) calculation
- Prioritized debt collection schedule and recovery action recommendations
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult

logger = logging.getLogger("podacium.agent.tools.bi.kridi_reports")


class KridiCustomerEntry(BaseModel):
    customer_id: str
    customer_name: str
    wilaya: str = "16"
    amount_dzd: float = Field(..., gt=0)
    days_overdue: int = Field(..., ge=0)
    last_payment_date: Optional[str] = None


class GenerateKridiAgingReportArgs(BaseModel):
    company_id: Optional[str] = Field(
        default=None, description="Enterprise ID or organization identifier"
    )
    customers: Optional[List[KridiCustomerEntry]] = Field(
        default=None,
        description="Optional list of customer credit records to evaluate. If omitted, sample portfolio is analyzed.",
    )
    max_acceptable_delay_days: int = Field(
        default=60, description="Threshold in days before escalation"
    )


class GenerateKridiAgingReportTool(BaseTool):
    name = "generate_kridi_aging_report"
    description = (
        "Generate Algerian traditional credit (Kridi / créances clients) aging report with 30/60/90+ day buckets, "
        "default risk scoring, and recovery priority recommendations."
    )
    domain = ToolDomain.BI
    access_roles = [
        "USER",
        "BUSINESS",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GenerateKridiAgingReportArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GenerateKridiAgingReportArgs)

        # Default sample records if none provided
        entries = typed_args.customers or [
            KridiCustomerEntry(
                customer_id="CUST-01",
                customer_name="Sarl El Bahia Tech",
                wilaya="31",
                amount_dzd=450000,
                days_overdue=25,
            ),
            KridiCustomerEntry(
                customer_id="CUST-02",
                customer_name="Eurl Numidia Logistique",
                wilaya="16",
                amount_dzd=820000,
                days_overdue=55,
            ),
            KridiCustomerEntry(
                customer_id="CUST-03",
                customer_name="Société Agro Djurdjura",
                wilaya="15",
                amount_dzd=310000,
                days_overdue=85,
            ),
            KridiCustomerEntry(
                customer_id="CUST-04",
                customer_name="Comptoir Biskra Dattes",
                wilaya="07",
                amount_dzd=640000,
                days_overdue=120,
            ),
            KridiCustomerEntry(
                customer_id="CUST-05",
                customer_name="ETS Chlef Distribution",
                wilaya="02",
                amount_dzd=210000,
                days_overdue=14,
            ),
        ]

        buckets: Dict[str, Dict[str, Any]] = {
            "current_0_30": {
                "count": 0,
                "total_dzd": 0.0,
                "risk_level": "FAIBLE",
                "customers": [],
            },
            "overdue_31_60": {
                "count": 0,
                "total_dzd": 0.0,
                "risk_level": "MODERE",
                "customers": [],
            },
            "overdue_61_90": {
                "count": 0,
                "total_dzd": 0.0,
                "risk_level": "ELEVE",
                "customers": [],
            },
            "critical_90_plus": {
                "count": 0,
                "total_dzd": 0.0,
                "risk_level": "CONTENTIEUX",
                "customers": [],
            },
        }

        total_outstanding_dzd = 0.0

        for entry in entries:
            total_outstanding_dzd += entry.amount_dzd
            record = entry.model_dump()
            if entry.days_overdue <= 30:
                b = buckets["current_0_30"]
            elif entry.days_overdue <= 60:
                b = buckets["overdue_31_60"]
            elif entry.days_overdue <= 90:
                b = buckets["overdue_61_90"]
            else:
                b = buckets["critical_90_plus"]

            b["count"] += 1
            b["total_dzd"] += entry.amount_dzd
            b["customers"].append(record)

        # Default risk calculation
        critical_dzd = buckets["critical_90_plus"]["total_dzd"]
        risk_score = round((critical_dzd / max(total_outstanding_dzd, 1)) * 100, 1)

        recommendations = []
        if buckets["critical_90_plus"]["count"] > 0:
            recommendations.append(
                "Mise en demeure formelle avec huissier de justice pour les créances >90 jours."
            )
        if buckets["overdue_61_90"]["count"] > 0:
            recommendations.append(
                "Négociation d'un échéancier de paiement fractionné via protocole d'accord."
            )
        if buckets["overdue_31_60"]["count"] > 0:
            recommendations.append(
                "Relance téléphonique et envoi automatique de rappels WhatsApp certifiés."
            )

        return ToolResult(
            success=True,
            data={
                "report_title": "Rapport d'Analyse du Kridi & Ancienneté des Créances",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_outstanding_dzd": total_outstanding_dzd,
                "total_debtors_count": len(entries),
                "portfolio_risk_index_percent": risk_score,
                "aging_buckets": buckets,
                "action_recommendations": recommendations,
            },
            widget_payload={
                "type": "KRIDI_AGING_CHART",
                "total_dzd": total_outstanding_dzd,
                "buckets": {k: v["total_dzd"] for k, v in buckets.items()},
            },
            metadata={"kridi_report": True},
        )
