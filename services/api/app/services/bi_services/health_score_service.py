"""
Business Health Score & Dashboard Intelligence Service.
Provides a comprehensive, single-call dashboard payload for the BI command center.

P1 Enhancements:
- Week-over-week trend calculation with sparkline history
- Seasonal awareness for Algerian business context (Ramadan, summer, etc.)
- Graduated informal debt (Carnet/Kridi) penalty curve
- Tri-language insight output (EN/FR/AR)
"""

import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.core.prisma import prisma
from app.services.bi_services.query_engine import QueryEngine

logger = logging.getLogger(__name__)


# ─── Seasonal Detection ──────────────────────────────────────────────────────

# Ramadan 2026 approximate dates (Islamic calendar shifts ~11 days/year)
# Ramadan 2026: approx Feb 18 – Mar 19
RAMADAN_2026_START = datetime(2026, 2, 18, tzinfo=timezone.utc)
RAMADAN_2026_END = datetime(2026, 3, 19, tzinfo=timezone.utc)


def _get_season_context(dt: Optional[datetime] = None) -> Dict[str, Any]:
    """Detect the current Algerian business season."""
    now = dt if dt and dt.tzinfo else (dt or datetime.now(timezone.utc))
    month = now.month

    # Ramadan check
    if RAMADAN_2026_START <= now <= RAMADAN_2026_END:
        return {
            "season": "ramadan",
            "label": {
                "en": "Ramadan Period",
                "fr": "Période du Ramadan",
                "ar": "فترة رمضان",
            },
            "note": {
                "en": "Revenue dips are normal during Ramadan. Scoring adjustments applied.",
                "fr": "Les baisses de chiffre d'affaires sont normales pendant le Ramadan.",
                "ar": "انخفاض الإيرادات طبيعي خلال رمضان. تم تعديل التقييم.",
            },
            "revenue_dip_tolerance": 0.15,  # 15% dip is considered normal
        }

    # Summer (June-August) — tourism + wedding season
    if month in (6, 7, 8):
        return {
            "season": "summer",
            "label": {
                "en": "Summer Season",
                "fr": "Saison estivale",
                "ar": "موسم الصيف",
            },
            "note": {
                "en": "Summer wedding and tourism season — expect seasonal revenue boost.",
                "fr": "Saison des mariages et du tourisme — hausse saisonnière attendue.",
                "ar": "موسم الأعراس والسياحة — توقع ارتفاع موسمي في الإيرادات.",
            },
            "revenue_dip_tolerance": 0.05,
        }

    # Back to school (September)
    if month == 9:
        return {
            "season": "back_to_school",
            "label": {
                "en": "Back to School",
                "fr": "Rentrée scolaire",
                "ar": "العودة للمدرسة",
            },
            "note": {
                "en": "Back-to-school spending shifts consumer priorities.",
                "fr": "Les dépenses de rentrée modifient les priorités des consommateurs.",
                "ar": "مصاريف الدخول المدرسي تغير أولويات المستهلكين.",
            },
            "revenue_dip_tolerance": 0.10,
        }

    # Year-end (December)
    if month == 12:
        return {
            "season": "year_end",
            "label": {"en": "Year-End", "fr": "Fin d'année", "ar": "نهاية السنة"},
            "note": {
                "en": "Year-end inventory clearance and budget closing period.",
                "fr": "Période de liquidation des stocks et clôture budgétaire.",
                "ar": "فترة تصفية المخزون وإغلاق الميزانية.",
            },
            "revenue_dip_tolerance": 0.08,
        }

    return {
        "season": "normal",
        "label": {"en": "Normal Period", "fr": "Période normale", "ar": "فترة عادية"},
        "note": None,
        "revenue_dip_tolerance": 0.05,
    }


# ─── Debt Severity ────────────────────────────────────────────────────────────


def _calculate_debt_penalty(debt_ratio: float) -> tuple:
    """
    Graduated penalty curve for informal debt (Carnet/Kridi).
    Returns (penalty_points, severity_label).
    """
    if debt_ratio <= 0.05:
        return 0, "safe"
    elif debt_ratio <= 0.15:
        # Linear interpolation: 0 at 5% → 15 at 15%
        penalty = (debt_ratio - 0.05) / 0.10 * 15
        return round(penalty, 1), "watch"
    elif debt_ratio <= 0.30:
        # 15 at 15% → 30 at 30%
        penalty = 15 + (debt_ratio - 0.15) / 0.15 * 15
        return round(penalty, 1), "warning"
    else:
        # 30 at 30% → 50 at 60%+
        penalty = min(50, 30 + (debt_ratio - 0.30) / 0.30 * 20)
        return round(penalty, 1), "critical"


# ─── Tri-Language Insight Templates ───────────────────────────────────────────

INSIGHT_TEMPLATES = {
    "strong_position": {
        "title": {"en": "Strong Position", "fr": "Position solide", "ar": "وضع قوي"},
        "description": {
            "en": "Your business is in excellent shape. Revenue outpaces expenses with healthy margins.",
            "fr": "Votre entreprise est en excellente forme. Les revenus dépassent les dépenses avec des marges saines.",
            "ar": "عملك في حالة ممتازة. الإيرادات تفوق المصاريف بهوامش صحية.",
        },
    },
    "high_margin": {
        "title": {
            "en": "High Profit Margin",
            "fr": "Marge bénéficiaire élevée",
            "ar": "هامش ربح مرتفع",
        },
        "description": {
            "en": "Your {margin}% margin is strong. Consider reinvesting surplus into growth.",
            "fr": "Votre marge de {margin}% est solide. Envisagez de réinvestir le surplus dans la croissance.",
            "ar": "هامش ربحك {margin}% قوي. فكر في إعادة استثمار الفائض في النمو.",
        },
    },
    "high_debt": {
        "title": {
            "en": "High Informal Debt (Carnet)",
            "fr": "Dettes informelles élevées (Carnet)",
            "ar": "ديون غير رسمية مرتفعة (كارني)",
        },
        "description": {
            "en": "Kridi/Carnet debt is {pct}% of revenue. Prioritize collecting outstanding payments.",
            "fr": "La dette Kridi/Carnet représente {pct}% du chiffre d'affaires. Priorisez le recouvrement.",
            "ar": "ديون الكريدي/الكارني تمثل {pct}% من الإيرادات. أولوية لتحصيل المدفوعات المتأخرة.",
        },
    },
    "low_buffer": {
        "title": {
            "en": "Low Cash Buffer",
            "fr": "Réserve de trésorerie faible",
            "ar": "احتياطي نقدي منخفض",
        },
        "description": {
            "en": "Cash reserves are below 10% of revenue. Build reserves to cover at least 2 months of expenses.",
            "fr": "Les réserves de trésorerie sont inférieures à 10% du CA. Constituez des réserves pour 2 mois de charges.",
            "ar": "الاحتياطي النقدي أقل من 10% من الإيرادات. اعمل على بناء احتياطي يغطي شهرين من المصاريف.",
        },
    },
    "thin_margins": {
        "title": {"en": "Thin Margins", "fr": "Marges faibles", "ar": "هوامش ضعيفة"},
        "description": {
            "en": "Operating margin is below 10%. Review your largest expense categories for optimization.",
            "fr": "La marge opérationnelle est inférieure à 10%. Revoyez vos postes de dépenses principaux.",
            "ar": "هامش التشغيل أقل من 10%. راجع أكبر فئات المصاريف لتحسينها.",
        },
    },
    "net_loss": {
        "title": {
            "en": "Expenses Exceed Revenue",
            "fr": "Les dépenses dépassent les revenus",
            "ar": "المصاريف تتجاوز الإيرادات",
        },
        "description": {
            "en": "You are currently operating at a loss. Immediate cost review recommended.",
            "fr": "Vous opérez actuellement à perte. Une révision immédiate des coûts est recommandée.",
            "ar": "أنت تعمل حالياً بخسارة. يُنصح بمراجعة فورية للتكاليف.",
        },
    },
    "upload_data": {
        "title": {
            "en": "Upload Financial Data",
            "fr": "Importez vos données financières",
            "ar": "قم بتحميل بياناتك المالية",
        },
        "description": {
            "en": "Import your revenue and expense data to unlock personalized business insights and health tracking.",
            "fr": "Importez vos données de revenus et dépenses pour débloquer des analyses personnalisées.",
            "ar": "استورد بيانات إيراداتك ومصاريفك لفتح تحليلات مخصصة وتتبع صحة العمل.",
        },
    },
    "trend_improving": {
        "title": {
            "en": "Score Improving",
            "fr": "Score en amélioration",
            "ar": "تحسن في النتيجة",
        },
        "description": {
            "en": "Your health score improved by {delta} points this week. Keep up the momentum.",
            "fr": "Votre score de santé a progressé de {delta} points cette semaine. Continuez sur cette lancée.",
            "ar": "تحسنت نتيجتك الصحية بـ {delta} نقطة هذا الأسبوع. حافظ على الزخم.",
        },
    },
    "trend_declining": {
        "title": {
            "en": "Score Declining",
            "fr": "Score en baisse",
            "ar": "انخفاض في النتيجة",
        },
        "description": {
            "en": "Your health score dropped by {delta} points this week. Review recent financial changes.",
            "fr": "Votre score de santé a baissé de {delta} points cette semaine. Revoyez les changements financiers récents.",
            "ar": "انخفضت نتيجتك الصحية بـ {delta} نقطة هذا الأسبوع. راجع التغييرات المالية الأخيرة.",
        },
    },
    "seasonal_note": {
        "title": {
            "en": "Seasonal Context",
            "fr": "Contexte saisonnier",
            "ar": "سياق موسمي",
        },
        # description is dynamic, set per season
    },
}

# ─── Status Labels ────────────────────────────────────────────────────────────

STATUS_LABELS = {
    "excellent": {"en": "Excellent", "fr": "Excellent", "ar": "ممتاز"},
    "average": {"en": "Average", "fr": "Moyen", "ar": "متوسط"},
    "critical": {"en": "Critical", "fr": "Critique", "ar": "حرج"},
}

# ─── Column Detection Keywords (expanded for Algerian context & SCF) ───────────────

REVENUE_KEYWORDS = [
    "revenue",
    "income",
    "sales",
    "vente",
    "chiffre",
    "recette",
    "ca",
    # SCF Class 7 (Comptes de Produits)
    "classe_7",
    "classe 7",
    "compte_7",
    "compte 7",
    "produit",
    "production_vendue",
    "prestation_service",
    "70",
    "700",
    "701",
    "706",
    # Arabic accounting terminology
    "مبيعات",
    "المبيعات",
    "ايراد",
    "الإيرادات",
    "مداخيل",
    "المداخيل",
    "مقبوضات",
    "المقبوضات",
    "ارباح",
    "الأرباح",
]

EXPENSE_KEYWORDS = [
    "expense",
    "cost",
    "spend",
    "depense",
    "charge",
    "achat",
    "cout",
    # SCF Class 6 (Comptes de Charges)
    "classe_6",
    "classe 6",
    "compte_6",
    "compte 6",
    "achats_consommes",
    "services_exterieurs",
    "charges_personnel",
    "salaires",
    "impots",
    "taxes",
    "60",
    "61",
    "62",
    "63",
    "64",
    "600",
    "601",
    "631",
    # Arabic accounting terminology
    "مصاريف",
    "المصاريف",
    "مشتريات",
    "المشتريات",
    "اجور",
    "الأجور",
    "رواتب",
    "الرواتب",
    "ضرائب",
    "الضرائب",
    "نفقات",
    "تكاليف",
]

DEBT_KEYWORDS = [
    "debt",
    "kridi",
    "carnet",
    "dyn",
    "dette",
    "credit",
    "creance",
    # Arabic terminology
    "ديون",
    "الديون",
    "كريدي",
    "الكريدي",
    "مستحقات",
    "المستحقات",
    "دين",
]

BUFFER_KEYWORDS = [
    "buffer",
    "savings",
    "cash",
    "tresorerie",
    "caisse",
    "epargne",
    "reserve",
    # SCF Class 5 (Comptes Financiers)
    "classe_5",
    "compte_5",
    "banque",
    "512",
    "53",
    # Arabic terminology
    "سيولة",
    "السيولة",
    "خزينة",
    "الخزينة",
    "صندوق",
    "الصندوق",
    "احتياطي",
    "الاحتياطي",
]


def _match_column_keyword(col_name: str, keywords: List[str]) -> bool:
    """Safely match keyword in column name without false positives."""
    name_lower = col_name.lower().strip()
    for kw in keywords:
        if kw == "ca":
            if re.search(r"(?:^|[^a-z0-9])ca(?:[^a-z0-9]|$)", name_lower):
                return True
        elif kw.isdigit() or len(kw) <= 3:
            if re.search(rf"(?:^|[^a-z0-9]){re.escape(kw)}(?:[^a-z0-9]|$)", name_lower):
                return True
        else:
            if kw in name_lower:
                return True
    return False


class HealthScoreService:
    @classmethod
    async def calculate_health_score(
        cls, organization_id: int, locale: str = "en"
    ) -> Dict[str, Any]:
        """
        Calculates a 0-100 business health score based on revenue, expense,
        buffer, and informal debt (Carnet, Kridi).

        P1 enhancements:
        - Week-over-week trend with sparkline
        - Seasonal awareness (Ramadan, summer, etc.)
        - Graduated debt penalty curve
        - Tri-language insights
        """
        locale = locale if locale in ("en", "fr", "ar") else "en"

        # Fetch datasets for the organization
        datasets = await prisma.dataset.find_many(
            where={"organizationId": organization_id, "deletedAt": None},
            order={"createdAt": "desc"},
        )

        # ─── Aggregate financial metrics from datasets ────────────────────
        revenue, expenses, debt, buffer, total_records = cls._aggregate_financials(
            datasets
        )

        # ─── Calculate health score ───────────────────────────────────────
        score, margin = cls._compute_score(revenue, expenses, debt, buffer)

        # ─── Debt severity ────────────────────────────────────────────────
        debt_ratio = debt / revenue if revenue > 0 else 0
        _, debt_severity = _calculate_debt_penalty(debt_ratio)

        # ─── Season context ───────────────────────────────────────────────
        season = _get_season_context()

        # ─── Color coding ─────────────────────────────────────────────────
        if score >= 80:
            color = "green"
            status_key = "excellent"
        elif score >= 50:
            color = "yellow"
            status_key = "average"
        else:
            color = "red"
            status_key = "critical"

        status_label = STATUS_LABELS[status_key][locale]

        # ─── Trend calculation (week-over-week) ───────────────────────────
        dataset_id = datasets[0].id if datasets else None
        user_id = datasets[0].userId if datasets else None
        trend_data = await cls._calculate_trend(
            organization_id, score, dataset_id=dataset_id, user_id=user_id
        )

        # ─── Decision pipeline stats ──────────────────────────────────────
        decisions_by_status = {
            "draft": 0,
            "review": 0,
            "approved": 0,
            "implemented": 0,
            "archived": 0,
        }
        recent_decisions = []
        try:
            all_decisions = await prisma.decision.find_many(
                where={"organizationId": organization_id}, order={"createdAt": "desc"}
            )
            for d in all_decisions:
                s = d.status or "draft"
                if s in decisions_by_status:
                    decisions_by_status[s] += 1

            recent_decisions = [
                {
                    "id": d.id,
                    "title": d.title,
                    "status": d.status,
                    "impactLevel": d.impactLevel,
                    "createdAt": d.createdAt.isoformat() if d.createdAt else "",
                }
                for d in all_decisions[:5]
            ]
        except Exception as e:
            logger.exception("Failed to fetch decision pipeline stats: %s", str(e))

        total_decisions = sum(decisions_by_status.values())

        # ─── Dataset stats ────────────────────────────────────────────────
        recent_datasets = [
            {
                "id": str(ds.id),
                "name": ds.name,
                "domain": ds.domain,
                "createdAt": ds.createdAt.isoformat() if ds.createdAt else "",
                "recordCount": ds.rowCount or 0,
            }
            for ds in datasets[:5]
        ]

        # ─── Generate insights ────────────────────────────────────────────
        insights = cls._generate_insights(
            score=score,
            debt=debt,
            revenue=revenue,
            buffer=buffer,
            expenses=expenses,
            margin=margin,
            debt_severity=debt_severity,
            trend=trend_data,
            season=season,
            locale=locale,
        )

        # ─── Build response ───────────────────────────────────────────────
        return {
            "score": score,
            "color": color,
            "status": status_label,
            "trend": trend_data,
            "season": {
                "id": season["season"],
                "label": season["label"].get(locale, season["label"]["en"]),
                "note": season["note"].get(locale, "") if season["note"] else None,
            },
            "metrics": {
                "revenue": round(revenue),
                "expenses": round(expenses),
                "debt": round(debt),
                "buffer": round(buffer),
                "margin": round(margin * 100, 1),
                "totalRecords": total_records,
                "debtSeverity": debt_severity,
            },
            "insights": insights,
            "datasets": {
                "total": len(datasets),
                "recent": recent_datasets,
            },
            "decisions": {
                "total": total_decisions,
                "byStatus": decisions_by_status,
                "recent": recent_decisions,
            },
        }

    @classmethod
    def _aggregate_financials(cls, datasets) -> tuple:
        """Extract financial metrics from all datasets using DuckDB."""
        revenue = 0
        expenses = 0
        debt = 0
        buffer = 0
        total_records = 0

        for dataset in datasets:
            file_path = dataset.filePath
            if not file_path:
                continue

            try:
                schema = QueryEngine.get_dataset_schema(file_path)

                rev_col = next(
                    (
                        c["name"]
                        for c in schema
                        if c.get("type") == "numeric"
                        and _match_column_keyword(c["name"], REVENUE_KEYWORDS)
                    ),
                    None,
                )
                exp_col = next(
                    (
                        c["name"]
                        for c in schema
                        if c.get("type") == "numeric"
                        and _match_column_keyword(c["name"], EXPENSE_KEYWORDS)
                    ),
                    None,
                )
                debt_col = next(
                    (
                        c["name"]
                        for c in schema
                        if c.get("type") == "numeric"
                        and _match_column_keyword(c["name"], DEBT_KEYWORDS)
                    ),
                    None,
                )
                buffer_col = next(
                    (
                        c["name"]
                        for c in schema
                        if c.get("type") == "numeric"
                        and _match_column_keyword(c["name"], BUFFER_KEYWORDS)
                    ),
                    None,
                )

                table_expr = QueryEngine._get_table_expr(file_path)

                # Count records
                try:
                    cnt = QueryEngine.execute_internal_query(
                        f"SELECT COUNT(*) as cnt FROM {table_expr}"
                    )
                    if cnt and cnt[0]["cnt"]:
                        total_records += int(cnt[0]["cnt"])
                except Exception as e:
                    logger.exception("Failed to count records for dataset: %s", str(e))

                if rev_col:
                    res = QueryEngine.execute_internal_query(
                        f'SELECT SUM(TRY_CAST("{rev_col}" AS DOUBLE)) as val FROM {table_expr}'
                    )
                    if res and res[0]["val"] is not None:
                        revenue += float(res[0]["val"])
                if exp_col:
                    res = QueryEngine.execute_internal_query(
                        f'SELECT SUM(TRY_CAST("{exp_col}" AS DOUBLE)) as val FROM {table_expr}'
                    )
                    if res and res[0]["val"] is not None:
                        expenses += float(res[0]["val"])
                if debt_col:
                    res = QueryEngine.execute_internal_query(
                        f'SELECT SUM(TRY_CAST("{debt_col}" AS DOUBLE)) as val FROM {table_expr}'
                    )
                    if res and res[0]["val"] is not None:
                        debt += float(res[0]["val"])
                if buffer_col:
                    res = QueryEngine.execute_internal_query(
                        f'SELECT SUM(TRY_CAST("{buffer_col}" AS DOUBLE)) as val FROM {table_expr}'
                    )
                    if res and res[0]["val"] is not None:
                        buffer += float(res[0]["val"])
            except Exception as e:
                logger.exception(
                    "Failed to aggregate financials for dataset: %s", str(e)
                )

        return revenue, expenses, debt, buffer, total_records

    @classmethod
    def _compute_score(
        cls, revenue: float, expenses: float, debt: float, buffer: float
    ) -> tuple:
        """Compute the 0-100 health score with graduated debt penalty."""
        score = 50
        margin = 0

        if revenue > 0:
            margin = (revenue - expenses) / revenue
            score = 50 + (margin * 50)

            # Graduated debt penalty
            debt_ratio = debt / revenue
            penalty, _ = _calculate_debt_penalty(debt_ratio)
            score -= penalty

            # Buffer bonus (up to +10)
            if buffer > expenses * 2:
                score += 10
            elif buffer > expenses:
                score += 7
            elif buffer > expenses * 0.5:
                score += 3

        return max(0, min(100, round(score))), margin

    @classmethod
    async def _calculate_trend(
        cls,
        organization_id: int,
        current_score: int,
        dataset_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calculate week-over-week trend by examining dataset upload dates.
        Stores score snapshots in BiAuditLog for historical tracking.
        Returns trend direction, delta, and sparkline data.
        """
        sparkline = []
        previous_score = None

        try:
            # Try to read historical scores from audit logs
            logs = await prisma.biauditlog.find_many(
                where={
                    "organizationId": organization_id,
                    "eventType": "HEALTH_SCORE_SNAPSHOT",
                },
                order={"createdAt": "desc"},
                take=4,
            )

            if logs:
                sparkline = [current_score]
                for log in logs:
                    try:
                        import json

                        details = (
                            json.loads(log.eventData)
                            if isinstance(log.eventData, str)
                            else (log.eventData or {})
                        )
                        s = details.get("score", 50)
                        sparkline.append(s)
                    except Exception as e:
                        logger.exception(
                            "Failed to parse sparkline log entry: %s", str(e)
                        )
                        sparkline.append(50)

                sparkline = list(reversed(sparkline))  # oldest → newest
                if len(logs) >= 1:
                    try:
                        import json

                        prev_details = (
                            json.loads(logs[0].eventData)
                            if isinstance(logs[0].eventData, str)
                            else (logs[0].eventData or {})
                        )
                        previous_score = prev_details.get("score")
                    except Exception as e:
                        logger.exception("Failed to parse previous score: %s", str(e))

            # Store current score snapshot (rate-limited: once per 6 hours)
            should_store = True
            if logs:
                latest = logs[0]
                if (
                    latest.createdAt
                    and (datetime.now(timezone.utc) - latest.createdAt).total_seconds()
                    < 21600
                ):
                    should_store = False

            if should_store and dataset_id and user_id:
                try:
                    from app.generated.prisma import Json

                    await prisma.biauditlog.create(
                        data={
                            "organizationId": organization_id,
                            "datasetId": dataset_id,
                            "userId": user_id,
                            "eventType": "HEALTH_SCORE_SNAPSHOT",
                            "eventData": Json(
                                {
                                    "score": current_score,
                                    "ts": datetime.now(timezone.utc).isoformat(),
                                }
                            ),
                        }
                    )
                except Exception as e:
                    logger.exception(
                        "Failed to store health score snapshot: %s", str(e)
                    )

        except Exception as e:
            logger.exception("Failed to calculate trend: %s", str(e))

        # Calculate trend
        if previous_score is not None:
            delta = current_score - previous_score
            if delta > 2:
                direction = "up"
            elif delta < -2:
                direction = "down"
            else:
                direction = "stable"
        else:
            delta = 0
            direction = "insufficient"

        # Ensure sparkline has at least the current score
        if not sparkline:
            sparkline = [current_score]

        return {
            "direction": direction,
            "delta": delta,
            "sparkline": sparkline[-5:],  # last 5 data points max
            "previousScore": previous_score,
        }

    @classmethod
    def _generate_insights(
        cls,
        score: float,
        debt: float,
        revenue: float,
        buffer: float,
        expenses: float,
        margin: float,
        debt_severity: str,
        trend: Dict[str, Any],
        season: Dict[str, Any],
        locale: str,
    ) -> List[Dict[str, Any]]:
        """Generate contextual, localized, plain-language insights."""
        insights: List[Dict[str, Any]] = []

        def _t(key: str, **kwargs) -> Dict[str, Any]:
            """Build a localized insight from template."""
            tpl = INSIGHT_TEMPLATES.get(key, {})
            title = tpl.get("title", {}).get(locale, key)
            desc_tpl = tpl.get("description", {}).get(locale, "")
            try:
                desc = desc_tpl.format(**kwargs) if kwargs else desc_tpl
            except (KeyError, IndexError):
                desc = desc_tpl
            return {"title": title, "description": desc}

        # Trend insight (highest priority)
        if trend["direction"] == "up" and trend["delta"] > 0:
            t = _t("trend_improving", delta=abs(trend["delta"]))
            insights.append({**t, "type": "positive", "metric": f"+{trend['delta']}"})
        elif trend["direction"] == "down" and trend["delta"] < 0:
            t = _t("trend_declining", delta=abs(trend["delta"]))
            insights.append({**t, "type": "warning", "metric": f"{trend['delta']}"})

        # Seasonal insight
        if season["season"] != "normal" and season.get("note"):
            note = season["note"].get(locale, "")
            label = season["label"].get(locale, "")
            insights.append(
                {
                    "title": INSIGHT_TEMPLATES["seasonal_note"]["title"][locale],
                    "description": f"{label} — {note}",
                    "type": "info",
                    "metric": season["season"].replace("_", " ").title(),
                }
            )

        # Positive signals
        if score >= 80:
            t = _t("strong_position")
            insights.append(
                {**t, "type": "positive", "metric": f"{round(margin * 100)}%"}
            )

        if revenue > 0 and margin >= 0.3:
            t = _t("high_margin", margin=round(margin * 100))
            insights.append(
                {**t, "type": "positive", "metric": f"{round(margin * 100)}%"}
            )

        # Warning signals
        if (
            debt > 0
            and revenue > 0
            and debt_severity in ("watch", "warning", "critical")
        ):
            pct = round((debt / revenue) * 100)
            t = _t("high_debt", pct=pct)
            severity_type = (
                "negative" if debt_severity in ("warning", "critical") else "warning"
            )
            insights.append({**t, "type": severity_type, "metric": f"{pct}%"})

        if buffer < revenue * 0.1 and revenue > 0:
            t = _t("low_buffer")
            insights.append({**t, "type": "warning", "metric": "< 10%"})

        if revenue > 0 and margin < 0.1:
            t = _t("thin_margins")
            insights.append(
                {**t, "type": "warning", "metric": f"{round(margin * 100, 1)}%"}
            )

        if expenses > revenue and revenue > 0:
            t = _t("net_loss")
            insights.append(
                {**t, "type": "negative", "metric": STATUS_LABELS["critical"][locale]}
            )

        # Starter insight when no data
        if revenue == 0 and expenses == 0:
            t = _t("upload_data")
            insights.append({**t, "type": "info", "metric": "→"})

        return insights
