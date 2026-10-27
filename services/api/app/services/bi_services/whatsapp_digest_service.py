"""
WhatsApp Digest Service (P1-D)
Generates clean, emoji-rich, formatted text summaries of business health
and insights designed specifically for sharing via WhatsApp.
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class WhatsAppDigestService:
    """Generates localized WhatsApp summaries for sharing."""

    @classmethod
    async def generate_health_digest(
        cls, 
        organization_id: int, 
        locale: str = "en"
    ) -> str:
        """
        Generate a WhatsApp summary of the business health score.
        """
        from app.services.bi_services.health_score_service import HealthScoreService
        from app.core.prisma import prisma
        import json
        
        # 1. Fetch Health Score
        health = await HealthScoreService.calculate_health_score(organization_id, locale)
        score = health.get("score", 0)
        metrics = health.get("metrics", {})
        trend = health.get("trend", {})
        
        # 2. Fetch recent insights
        dashboard = await prisma.dashboard.find_first(
            where={"organizationId": organization_id, "title": "System Auto Dashboard"}
        )
        
        insights_data = []
        if dashboard:
            insights_records = await prisma.insight.find_many(
                where={"dashboardId": dashboard.id},
                order={"createdAt": "desc"},
                take=3
            )
            for r in insights_records:
                try:
                    data = json.loads(r.metadata) if isinstance(r.metadata, str) else (r.metadata or {})
                    if data.get("locale") == locale or not data.get("locale"):
                        insights_data.append(data)
                except Exception as e:
                    logger.exception("Failed to parse insight metadata: %s", str(e))

        # 3. Format based on locale
        if locale == "ar":
            return cls._format_ar(score, metrics, trend, insights_data)
        elif locale == "fr":
            return cls._format_fr(score, metrics, trend, insights_data)
        else:
            return cls._format_en(score, metrics, trend, insights_data)

    @classmethod
    def _get_trend_emoji(cls, trend: Dict[str, Any]) -> str:
        if not trend or trend.get("delta", 0) == 0:
            return "➖"
        return "📈" if trend.get("direction") == "up" else "📉"

    @classmethod
    def _format_en(cls, score: int, metrics: Dict[str, Any], trend: Dict[str, Any], insights: List[Dict[str, Any]]) -> str:
        trend_emoji = cls._get_trend_emoji(trend)
        trend_str = f" ({trend_emoji} {'+' if trend.get('delta', 0) > 0 else ''}{trend.get('delta', 0)})" if trend.get("delta", 0) != 0 else ""
        
        lines = [
            "📊 *Podacium Business Update*",
            f"📅 {datetime.now().strftime('%Y-%m-%d')}",
            "",
            f"🎯 *Health Score:* {score}/100{trend_str}",
            f"💰 *Margin:* {metrics.get('margin', 0)}%",
        ]
        
        if insights:
            lines.append("")
            lines.append("💡 *Top Insights:*")
            for ins in insights[:2]:
                lines.append(f"• {ins.get('title')}: {ins.get('body')}")
                
        return "\n".join(lines)

    @classmethod
    def _format_fr(cls, score: int, metrics: Dict[str, Any], trend: Dict[str, Any], insights: List[Dict[str, Any]]) -> str:
        trend_emoji = cls._get_trend_emoji(trend)
        trend_str = f" ({trend_emoji} {'+' if trend.get('delta', 0) > 0 else ''}{trend.get('delta', 0)})" if trend.get("delta", 0) != 0 else ""
        
        lines = [
            "📊 *Mise à jour Podacium*",
            f"📅 {datetime.now().strftime('%d/%m/%Y')}",
            "",
            f"🎯 *Score de Santé:* {score}/100{trend_str}",
            f"💰 *Marge:* {metrics.get('margin', 0)}%",
        ]
        
        if insights:
            lines.append("")
            lines.append("💡 *Insights Principaux:*")
            for ins in insights[:2]:
                lines.append(f"• {ins.get('title')}: {ins.get('body')}")
                
        return "\n".join(lines)

    @classmethod
    def _format_ar(cls, score: int, metrics: Dict[str, Any], trend: Dict[str, Any], insights: List[Dict[str, Any]]) -> str:
        trend_emoji = cls._get_trend_emoji(trend)
        trend_str = f" ({trend_emoji} {'+' if trend.get('delta', 0) > 0 else ''}{trend.get('delta', 0)})" if trend.get("delta", 0) != 0 else ""
        
        lines = [
            "📊 *تحديث أعمال Podacium*",
            f"📅 {datetime.now().strftime('%Y-%m-%d')}",
            "",
            f"🎯 *درجة الصحة:* {score}/100{trend_str}",
            f"💰 *هامش الربح:* {metrics.get('margin', 0)}%",
        ]
        
        if insights:
            lines.append("")
            lines.append("💡 *أهم الرؤى:*")
            for ins in insights[:2]:
                lines.append(f"• {ins.get('title')}: {ins.get('body')}")
                
        return "\n".join(lines)
