"""
Auto-Insight Engine (P1-B)
Generates human-readable, localized, contextual insights from analytics results.

Supports 9 detection patterns × 3 languages (EN/FR/AR) with seasonal
awareness for the Algerian business context.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ─── Insight Pattern Templates ────────────────────────────────────────────────
# Each pattern has title, body templates, severity mapping, and action text
# in EN/FR/AR/KAB. Variables use {curly_brace} interpolation.

PATTERNS: Dict[str, Dict[str, Any]] = {
    "revenue_spike": {
        "title": {
            "en": "Revenue Surge Detected",
            "fr": "Hausse de revenus détectée",
            "ar": "ارتفاع ملحوظ في الإيرادات",
            "kab": "Asali n tedrimt yettwazmel",
        },
        "body": {
            "en": "Revenue jumped {pct}% this period compared to the previous, driven primarily by the '{segment}' segment.",
            "fr": "Le chiffre d'affaires a bondi de {pct}% par rapport à la période précédente, principalement grâce au segment '{segment}'.",
            "ar": "قفزت الإيرادات بنسبة {pct}% مقارنة بالفترة السابقة، مدفوعة بشكل أساسي بقطاع '{segment}'.",
            "kab": "Tadrimt yekcmen tuli s {pct}% deg tallit-a ɣef tin yezrin, s tmentilt n uḥric '{segment}'.",
        },
        "severity": "opportunity",
        "action": {
            "en": "Consider increasing inventory for high-demand items.",
            "fr": "Envisagez d'augmenter le stock pour les articles à forte demande.",
            "ar": "فكر في زيادة المخزون للمنتجات ذات الطلب المرتفع.",
            "kab": "Mmeyyet ɣef terniwt n uselɣas i tɣawsiwin yettwasutren aṭas.",
        },
    },
    "revenue_drop": {
        "title": {
            "en": "Revenue Decline Alert",
            "fr": "Alerte : Baisse de revenus",
            "ar": "تنبيه: انخفاض في الإيرادات",
            "kab": "Alɣu: Asubbu n tedrimt yekcmen",
        },
        "body": {
            "en": "Revenue declined {pct}% compared to the previous period. {context}",
            "fr": "Le chiffre d'affaires a baissé de {pct}% par rapport à la période précédente. {context}",
            "ar": "انخفضت الإيرادات بنسبة {pct}% مقارنة بالفترة السابقة. {context}",
            "kab": "Tadrimt yekcmen tenqes s {pct}% ɣef tallit yezrin. {context}",
        },
        "severity": "warning",
        "action": {
            "en": "Review pricing strategy and customer acquisition channels.",
            "fr": "Revoyez la stratégie tarifaire et les canaux d'acquisition clients.",
            "ar": "راجع استراتيجية التسعير وقنوات اكتساب العملاء.",
            "kab": "Ssekked tastratijit n ssuma d yiberdan n tmerniwt n yimsaduren.",
        },
    },
    "expense_surge": {
        "title": {
            "en": "Expense Spike Warning",
            "fr": "Alerte : Hausse des dépenses",
            "ar": "تحذير: ارتفاع في المصاريف",
            "kab": "Alɣu: Asali n tedrimt yeffɣen",
        },
        "body": {
            "en": "Expenses increased by {pct}% this period. Largest contributor: '{category}'.",
            "fr": "Les dépenses ont augmenté de {pct}% cette période. Principal contributeur : '{category}'.",
            "ar": "ارتفعت المصاريف بنسبة {pct}% هذه الفترة. أكبر مساهم: '{category}'.",
            "kab": "Tadrimt yeffɣen tuli s {pct}% deg tallit-a. Amur ameqran d: '{category}'.",
        },
        "severity": "warning",
        "action": {
            "en": "Audit the top 3 expense categories for optimization opportunities.",
            "fr": "Auditez les 3 principaux postes de dépenses pour des opportunités d'optimisation.",
            "ar": "راجع أكبر 3 فئات مصاريف للبحث عن فرص تحسين.",
            "kab": "Ssefqed krad n yiḥricen imeqranen n tedrimt yeffɣen i wakken ad tent-tṣeggmeḍ.",
        },
    },
    "margin_compression": {
        "title": {
            "en": "Margin Under Pressure",
            "fr": "Marge sous pression",
            "ar": "هامش الربح تحت ضغط",
            "kab": "Afrag n rrbeḥ yuder",
        },
        "body": {
            "en": "Profit margin compressed from {prev}% to {current}%. Revenue growth is not keeping pace with costs.",
            "fr": "La marge bénéficiaire s'est comprimée de {prev}% à {current}%. La croissance du CA ne suit pas les coûts.",
            "ar": "انضغط هامش الربح من {prev}% إلى {current}%. نمو الإيرادات لا يواكب التكاليف.",
            "kab": "Afrag n rrbeḥ yenqes seg {prev}% ɣer {current}%. Asali n tedrimt yekcmen ur iḍfir ara tisqamin.",
        },
        "severity": "critical",
        "action": {
            "en": "Focus on high-margin products and negotiate supplier costs.",
            "fr": "Concentrez-vous sur les produits à forte marge et négociez les coûts fournisseurs.",
            "ar": "ركز على المنتجات ذات الهامش المرتفع وتفاوض على تكاليف الموردين.",
            "kab": "Rres ɣef yifarsen yesɛan afrag ɛlayen tmeslayeḍ ɣef tisqamin n yimafaren.",
        },
    },
    "seasonal_opportunity": {
        "title": {
            "en": "Seasonal Opportunity",
            "fr": "Opportunité saisonnière",
            "ar": "فرصة موسمية",
            "kab": "Tagnit n tsemhuyt",
        },
        "body": {
            "en": "{season_name} is approaching. Historical data suggests a {pct}% revenue shift during this period.",
            "fr": "{season_name} approche. Les données historiques suggèrent une variation de {pct}% du CA durant cette période.",
            "ar": "{season_name} قادم. البيانات التاريخية تشير إلى تغيّر بنسبة {pct}% في الإيرادات خلال هذه الفترة.",
            "kab": "{season_name} yettqerrib-d. Isefka n umezruy skanen-d abeddel n {pct}% deg tedrimt deg tallit-a.",
        },
        "severity": "info",
        "action": {
            "en": "Prepare inventory and marketing for the seasonal shift.",
            "fr": "Préparez le stock et le marketing pour le changement saisonnier.",
            "ar": "جهّز المخزون والتسويق للتحول الموسمي.",
            "kab": "Hegget aselɣas d usnuzu i ubeddel n tsemhuyt.",
        },
    },
    "debt_to_cashflow_alert": {
        "title": {
            "en": "Debt-to-Cashflow Warning",
            "fr": "Alerte dette/trésorerie",
            "ar": "تحذير: الدين مقابل التدفق النقدي",
            "kab": "Alɣu: Ameṛwas mgal tadrimt n tnezzut",
        },
        "body": {
            "en": "Informal debt (Carnet/Kridi) represents {pct}% of your cash flow. Collection risk is {risk}.",
            "fr": "La dette informelle (Carnet/Kridi) représente {pct}% de votre trésorerie. Le risque de recouvrement est {risk}.",
            "ar": "الديون غير الرسمية (كارني/كريدي) تمثل {pct}% من تدفقك النقدي. خطر التحصيل {risk}.",
            "kab": "Ameṛwas n lkarniyen (Kridi) d {pct}% seg tedrimt n tnezzut-inek. Imihi n uselken d {risk}.",
        },
        "severity": "warning",
        "action": {
            "en": "Implement a 30-day collection follow-up process.",
            "fr": "Mettez en place un processus de relance à 30 jours.",
            "ar": "طبّق عملية متابعة تحصيل كل 30 يوم.",
            "kab": "Sbedd amur n uḍfar n usefqed yal 30 n wussan.",
        },
    },
    "top_segment_shift": {
        "title": {
            "en": "Top Segment Shift",
            "fr": "Changement de segment principal",
            "ar": "تغيّر في القطاع الرائد",
            "kab": "Abeddel deg uḥric ameqran",
        },
        "body": {
            "en": "Your top revenue segment shifted from '{prev}' to '{current}', representing {pct}% of total.",
            "fr": "Votre segment principal est passé de '{prev}' à '{current}', représentant {pct}% du total.",
            "ar": "تحول قطاعك الرئيسي من '{prev}' إلى '{current}'، ويمثل {pct}% من الإجمالي.",
            "kab": "Aḥric ameqran n tedrimt yekcmen ibeddle seg '{prev}' ɣer '{current}', i yewwḍen {pct}% seg umata.",
        },
        "severity": "info",
        "action": {
            "en": "Investigate what drove the segment change.",
            "fr": "Recherchez ce qui a provoqué ce changement de segment.",
            "ar": "ابحث عن أسباب تغيّر القطاع.",
            "kab": "Nadi ɣef wayen yeglan s ubeddel-a n uḥric.",
        },
    },
    "anomaly_cluster": {
        "title": {
            "en": "Anomaly Cluster Detected",
            "fr": "Cluster d'anomalies détecté",
            "ar": "تم اكتشاف مجموعة شذوذ",
            "kab": "Tagrawt n tuccḍiwin tettwazmel",
        },
        "body": {
            "en": "Detected {count} statistical anomalies in '{column}'. These outliers may indicate data errors or unusual business events.",
            "fr": "Détecté {count} anomalies statistiques dans '{column}'. Ces valeurs aberrantes peuvent indiquer des erreurs de données.",
            "ar": "تم اكتشاف {count} شذوذ إحصائي في '{column}'. قد تشير هذه القيم الشاذة إلى أخطاء في البيانات.",
            "kab": "Nufa-d {count} n tuccḍiwin tussnanin deg '{column}'. Isefka-agi zemren ad ssekknen tuccḍiwin neɣ tidyanin ur nemyeccad ara.",
        },
        "severity": "warning",
        "action": {
            "en": "Review the flagged records for data quality issues.",
            "fr": "Revoyez les enregistrements signalés pour des problèmes de qualité.",
            "ar": "راجع السجلات المُعلَّمة للتحقق من جودة البيانات.",
            "kab": "Ssekked ikalasen yettwafernen i wakken ad twaliḍ taɣara n yisefka.",
        },
    },
    "forecast_deviation": {
        "title": {
            "en": "Forecast Deviation",
            "fr": "Écart par rapport aux prévisions",
            "ar": "انحراف عن التوقعات",
            "kab": "Abeddel ɣef wayen yettwarjan",
        },
        "body": {
            "en": "Actual {metric} deviated {pct}% from the forecast. {direction} trend detected.",
            "fr": "{metric} réel a dévié de {pct}% par rapport aux prévisions. Tendance {direction} détectée.",
            "ar": "{metric} الفعلي انحرف بنسبة {pct}% عن التوقعات. تم اكتشاف اتجاه {direction}.",
            "kab": "{metric} n tidett ibeddel s {pct}% ɣef wayen yettwarjan. Tanila {direction} tettwazmel.",
        },
        "severity": "info",
        "action": {
            "en": "Update forecasting models with the latest data.",
            "fr": "Mettez à jour les modèles prévisionnels avec les dernières données.",
            "ar": "حدّث نماذج التنبؤ بأحدث البيانات.",
            "kab": "Mudd isefka imaynuten i tarrayin n ussegzi n yimal.",
        },
    },
}

# Alias for external API / test compatibility
INSIGHT_TEMPLATES = PATTERNS

# Risk level translations
RISK_LABELS = {
    "low": {"en": "low", "fr": "faible", "ar": "منخفض", "kab": "afessas"},
    "medium": {"en": "moderate", "fr": "modéré", "ar": "متوسط", "kab": "alemmas"},
    "high": {"en": "high", "fr": "élevé", "ar": "مرتفع", "kab": "ɛlayen"},
}

# Direction translations
DIRECTION_LABELS = {
    "up": {"en": "upward", "fr": "haussière", "ar": "صاعد", "kab": "asawen"},
    "down": {"en": "downward", "fr": "baissière", "ar": "هابط", "kab": "akessar"},
    "stable": {"en": "stable", "fr": "stable", "ar": "مستقر", "kab": "urkic"},
}


class InsightEngine:
    """Generates human-readable, localized insights from analytics results."""

    @classmethod
    def generate(
        cls,
        analytics: Dict[str, Any],
        health_metrics: Optional[Dict[str, Any]] = None,
        locale: str = "en",
    ) -> List[Dict[str, Any]]:
        """
        Generate natural language insights from analytics output.

        Args:
            analytics: Result from AnalyticsCore.run_all_analytics()
            health_metrics: Optional metrics from HealthScoreService
            locale: Language code (en, fr, ar)

        Returns:
            List of insight dicts with title, body, severity, action, pattern
        """
        locale = locale if locale in ("en", "fr", "ar", "kab") else "en"
        insights: List[Dict[str, Any]] = []

        # ─── Extract analytics components ─────────────────────────────────
        trend = analytics.get("trend", {})
        comparative = analytics.get("comparative", {})
        segmentation = analytics.get("segmentation", {})
        anomaly = analytics.get("anomaly", {})
        forecasting = analytics.get("forecasting", {})
        profitability = analytics.get("profitability", {})

        # ─── 1. Revenue/Expense trend insights ───────────────────────────
        if trend.get("data"):
            growth = trend.get("growth_rate", 0)
            trend.get("trajectory", "STABLE")

            if growth > 15:
                insights.append(
                    cls._build_insight(
                        "revenue_spike",
                        locale,
                        pct=round(growth),
                        segment=cls._get_top_segment(segmentation),
                    )
                )
            elif growth < -10:
                context = cls._get_seasonal_context_note(locale)
                insights.append(
                    cls._build_insight(
                        "revenue_drop", locale, pct=round(abs(growth)), context=context
                    )
                )

        # ─── 2. Expense surge detection ──────────────────────────────────
        if comparative.get("mom_change") and comparative["mom_change"] > 20:
            insights.append(
                cls._build_insight(
                    "expense_surge",
                    locale,
                    pct=round(comparative["mom_change"]),
                    category=comparative.get("top_category", "—"),
                )
            )

        # ─── 3. Margin compression ───────────────────────────────────────
        if profitability.get("margin") is not None:
            current_margin = profitability["margin"]
            prev_margin = profitability.get("previous_margin", current_margin)
            if prev_margin - current_margin > 5:  # >5pp compression
                insights.append(
                    cls._build_insight(
                        "margin_compression",
                        locale,
                        prev=round(prev_margin, 1),
                        current=round(current_margin, 1),
                    )
                )

        # ─── 4. Debt-to-cashflow alert ───────────────────────────────────
        if health_metrics:
            debt = health_metrics.get("debt", 0)
            revenue = health_metrics.get("revenue", 0)
            if debt > 0 and revenue > 0:
                debt_pct = round((debt / revenue) * 100)
                if debt_pct > 10:
                    risk = (
                        "high"
                        if debt_pct > 30
                        else ("medium" if debt_pct > 15 else "low")
                    )
                    risk_label = RISK_LABELS[risk][locale]
                    insights.append(
                        cls._build_insight(
                            "debt_to_cashflow_alert",
                            locale,
                            pct=debt_pct,
                            risk=risk_label,
                        )
                    )

        # ─── 5. Anomaly detection ────────────────────────────────────────
        if anomaly.get("anomalies"):
            for anom in anomaly["anomalies"][:2]:  # Top 2 anomalies
                insights.append(
                    cls._build_insight(
                        "anomaly_cluster",
                        locale,
                        count=anom.get("count", 0),
                        column=anom.get("column", "—"),
                    )
                )

        # ─── 6. Forecast deviation ───────────────────────────────────────
        if forecasting.get("deviation_pct") and abs(forecasting["deviation_pct"]) > 10:
            direction_key = "up" if forecasting["deviation_pct"] > 0 else "down"
            direction_label = DIRECTION_LABELS[direction_key][locale]
            insights.append(
                cls._build_insight(
                    "forecast_deviation",
                    locale,
                    metric=forecasting.get("metric_name", "value"),
                    pct=round(abs(forecasting["deviation_pct"])),
                    direction=direction_label,
                )
            )

        # ─── 7. Top segment shift ────────────────────────────────────────
        if segmentation.get("shift_detected"):
            insights.append(
                cls._build_insight(
                    "top_segment_shift",
                    locale,
                    prev=segmentation.get("previous_top", "—"),
                    current=segmentation.get("current_top", "—"),
                    pct=round(segmentation.get("current_share", 0)),
                )
            )

        # ─── 8. Seasonal opportunity ─────────────────────────────────────
        season = cls._detect_upcoming_season()
        if season:
            insights.append(
                cls._build_insight(
                    "seasonal_opportunity",
                    locale,
                    season_name=season["label"].get(locale, season["label"]["en"]),
                    pct=season.get("expected_shift", "±5"),
                )
            )

        return insights

    @classmethod
    def _build_insight(cls, pattern: str, locale: str, **kwargs) -> Dict[str, Any]:
        """Build a single localized insight from a pattern template."""
        tpl = PATTERNS.get(pattern, {})
        title = tpl.get("title", {}).get(locale, pattern)
        body_tpl = tpl.get("body", {}).get(locale, "")
        action = tpl.get("action", {}).get(locale, "")
        severity = tpl.get("severity", "info")

        try:
            body = body_tpl.format(**kwargs) if kwargs else body_tpl
        except (KeyError, IndexError):
            body = body_tpl

        return {
            "pattern": pattern,
            "title": title,
            "body": body,
            "severity": severity,
            "action": action,
            "locale": locale,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    def _get_top_segment(cls, segmentation: Dict[str, Any]) -> str:
        """Extract the top segment name from segmentation analytics."""
        segments = segmentation.get("segments", [])
        if segments and isinstance(segments, list) and len(segments) > 0:
            return str(segments[0].get("name", segments[0].get("label", "—")))
        return segmentation.get("current_top", "—")

    @classmethod
    def _get_seasonal_context_note(cls, locale: str) -> str:
        """Get a contextual note if we're in a known seasonal period."""
        from app.services.bi_services.health_score_service import _get_season_context

        season = _get_season_context()
        if season["season"] != "normal" and season.get("note"):
            return season["note"].get(locale, "")
        return ""

    @classmethod
    def _detect_upcoming_season(cls) -> Optional[Dict[str, Any]]:
        """Detect if a notable season is approaching within the next 30 days."""
        now = datetime.now(timezone.utc)
        month = now.month

        # Check if summer is approaching (May → summer starts June)
        if month == 5:
            return {
                "label": {
                    "en": "Summer Season",
                    "fr": "Saison estivale",
                    "ar": "موسم الصيف",
                    "kab": "Anebdu",
                },
                "expected_shift": "+15",
            }
        # Back to school approaching (August → September)
        if month == 8:
            return {
                "label": {
                    "en": "Back to School",
                    "fr": "Rentrée scolaire",
                    "ar": "العودة للمدرسة",
                    "kab": "Tuɣalin ɣer uɣerbaz",
                },
                "expected_shift": "-8",
            }
        # Year-end approaching (November → December)
        if month == 11:
            return {
                "label": {
                    "en": "Year-End",
                    "fr": "Fin d'année",
                    "ar": "نهاية السنة",
                    "kab": "Tagara n useggas",
                },
                "expected_shift": "+10",
            }

        return None

    @classmethod
    async def generate_and_store(
        cls,
        organization_id: int,
        dataset_id: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Background job: compute and store insights for a dataset.
        Saves to the Insight Prisma model for instant loading.
        """
        try:
            # 1. Fetch dataset
            from app.services.bi_services.ingestion_service import IngestionService
            from app.services.bi_services.analytics_core import AnalyticsCore
            from app.services.bi_services.query_engine import QueryEngine
            from app.services.bi_services.health_score_service import HealthScoreService
            from app.core.prisma import prisma

            dataset = await IngestionService.get_dataset(
                dataset_id=dataset_id,
                organization_id=str(organization_id),
                user_id=str(user_id) if user_id is not None else "",
            )

            file_path = dataset.get("file_path")
            if not file_path:
                return []

            # 2. Run core analytics
            schema = QueryEngine.get_dataset_schema(file_path)
            analytics = AnalyticsCore.run_all_analytics(file_path, schema)

            # 3. Get health metrics context
            health_metrics = await HealthScoreService.calculate_health_score(
                organization_id, locale
            )

            # 4. Generate insights
            insights = cls.generate(analytics, health_metrics.get("metrics"), locale)

            # 5. Store insights in DB (attached to an auto-generated dashboard or loosely)
            # Since Insight requires a dashboardId, we'll find or create a default system dashboard
            dashboard = await prisma.dashboard.find_first(
                where={
                    "organizationId": organization_id,
                    "name": "System Auto Dashboard",
                }
            )

            if not dashboard:
                dashboard = await prisma.dashboard.create(
                    data={
                        "organizationId": organization_id,
                        "name": "System Auto Dashboard",
                        "description": "System generated dashboard for insights",
                        "layoutType": "grid",
                        "isPublic": False,
                    }
                )

            # Clear old generated insights
            await prisma.insight.delete_many(where={"dashboardId": dashboard.id})

            # Store new insights
            from app.generated.prisma import Json

            for insight in insights:
                await prisma.insight.create(
                    data={
                        "dashboardId": dashboard.id,
                        "userId": user_id,
                        "content": insight["title"],
                        "metadata": Json(insight),
                    }
                )

            return insights

        except Exception as e:
            logger.exception("Insight generation failed: %s", str(e))
            return []
