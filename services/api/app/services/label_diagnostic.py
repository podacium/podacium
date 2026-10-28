"""
TamWheel Sovereign Ethical Agentic Venture OS — Startup Label Diagnostic Engine.
Pillar 6: Algerian Executive Decree 20-254 (Décret exécutif n° 20-254 du 15 septembre 2020)
National Startup Label readiness diagnostic, multi-pillar gap analysis,
official readiness bands (Not Ready, Candidate, Highly Recommended), and submission action plan.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Decree 20-254 Maximum Pillar Allocations
MAX_INNOVATION_SCORE = 30
MAX_SCALABILITY_SCORE = 25
MAX_TEAM_SCORE = 20
MAX_IP_SCORE = 15
MAX_TRACTION_SCORE = 10

# Minimum thresholds for eligibility
LABEL_READY_THRESHOLD = 75
CANDIDATE_THRESHOLD = 50


class StartupLabelDiagnosticEngine:
    """
    Evaluates venture compliance with Algerian Executive Decree 20-254
    regulating the National Startup Label (Comité National de Labellisation / ASF).
    """

    def evaluate(
        self,
        startup_name: str,
        sector: str,
        wilaya: int,
        innovation_score: int,
        scalability_score: int,
        team_score: int,
        ip_score: int,
        traction_score: int,
    ) -> Dict[str, Any]:
        """
        Calculates Decree 20-254 composite index, official readiness band,
        gap analysis, and actionable steps before submission to the National Commission.
        """
        # Clamp inputs within legal pillar ceilings
        inn = max(0, min(MAX_INNOVATION_SCORE, int(innovation_score)))
        sca = max(0, min(MAX_SCALABILITY_SCORE, int(scalability_score)))
        tea = max(0, min(MAX_TEAM_SCORE, int(team_score)))
        ip = max(0, min(MAX_IP_SCORE, int(ip_score)))
        tra = max(0, min(MAX_TRACTION_SCORE, int(traction_score)))

        total_score = inn + sca + tea + ip + tra

        # Gap analysis across pillars
        gap_analysis: List[str] = []
        recommendations: List[str] = []
        action_plan: List[Dict[str, Any]] = []

        # Pillar 1: Innovation (30%)
        if inn < 20:
            gap_analysis.append(
                f"ضعف مؤشر الابتكار ({inn}/{MAX_INNOVATION_SCORE}): الحل التكنولوجي أو نموذج العمل يفتقر إلى التمايز الجذري عن المنافسين التقليديين."
            )
            recommendations.append(
                "توثيق الميزة التكنولوجية الفريدة (Proprietary Algorithm / DeepTech) وتحديد القيمة المضافة الرقمية بوضوح."
            )
            action_plan.append({
                "phase": "INNOVATION_REFINEMENT",
                "milestone": "إعداد ملف الجدوى التكنولوجية والأسبقية التقنية لمشروع الحل الرقمي",
                "deadlineDays": 14,
            })

        # Pillar 2: Scalability (25%)
        if sca < 18:
            gap_analysis.append(
                f"محدودية قابلية التوسع ({sca}/{MAX_SCALABILITY_SCORE}): تكلفة التوسع في الـ 58 ولاية لا تبرهن على انخفاض التكاليف الهامشية (Low Marginal Cost)."
            )
            recommendations.append(
                "تطوير خطة توسع تعتمد على الأتمتة السحابية ونموذج أعمال قابل للتكرار السريع في مختلف الولايات الجزائرية والأسواق الإقليمية."
            )
            action_plan.append({
                "phase": "SCALABILITY_BLUEPRINT",
                "milestone": "نمذجة اقتصاديات الوحدة (CAC vs LTV) للتوسع الوطني خارج ولاية التأسيس",
                "deadlineDays": 21,
            })

        # Pillar 3: Team Complementarity (20%)
        if tea < 14:
            gap_analysis.append(
                f"فجوة تكامل الفريق المؤسس ({tea}/{MAX_TEAM_SCORE}): غياب التوازن بين الكفاءة التقنية (CTO) والخبرة التجارية وتطوير الأعمال (BizDev)."
            )
            recommendations.append(
                "ضم شريك مؤسس تقني متفرغ أو تعزيز الفريق بكفاءات خريجي المعاهد الوطنية الكبرى (ESI, USTHB, ESE)."
            )
            action_plan.append({
                "phase": "TEAM_ALIGNMENT",
                "milestone": "إعادة هيكلة الفريق وتوقيع اتفاقية الشركاء المؤسسين (Founders' Agreement)",
                "deadlineDays": 30,
            })

        # Pillar 4: Intellectual Property & INAPI (15%)
        if ip < 8:
            gap_analysis.append(
                f"غياب حماية الملكية الفكرية ({ip}/{MAX_IP_SCORE}): عدم وجود إيداع براءة اختراع، حماية برمجيات لدى ONDA، أو علامة مسجلة لدى INAPI."
            )
            recommendations.append(
                "إيداع ملف حماية الملكية الصناعية فوراً لدى المعهد الوطني الجزائري للملكية الصناعية (INAPI) لتأمين الأسبقية القانونية."
            )
            action_plan.append({
                "phase": "IP_PROTECTION",
                "milestone": "إيداع العلامة التجارية والكود المصدري لدى INAPI و ONDA والحصول على وصل الإيداع الرسمي",
                "deadlineDays": 10,
            })

        # Pillar 5: Traction & Commercial Proof (10%)
        if tra < 6:
            gap_analysis.append(
                f"نقص الجر التجاري ({tra}/{MAX_TRACTION_SCORE}): غياب خطابات نوايا (LOIs) أو مستخدمين نشطين يثبتون الطلب الفعلي على الخدمة."
            )
            recommendations.append(
                "الحصول على خطابات نوايا غير ملزمة (LOIs) من مؤسسات جزائرية أو تشغيل نسخة تجريبية مع 100 مستخدم حقيقي."
            )
            action_plan.append({
                "phase": "TRACTION_VALIDATION",
                "milestone": "توقيع 3 خطابات نوايا (LOIs) أو إطلاق تجربة ميدانية تجريبية (Pilot Test)",
                "deadlineDays": 28,
            })

        # Readiness Bands per Decree 20-254
        if total_score >= LABEL_READY_THRESHOLD:
            readiness_band = "Highly Recommended"
            eligibility_status = "LABEL_READY"
            is_eligible = True
            recommendations.insert(
                0,
                "المشروع يستوفي شروط المرسوم التنفيذي 20-254 بامتياز ومؤهل تماماً للتقديم عبر البوابة الوطنية startup.dz."
            )
            action_plan.insert(
                0,
                {
                    "phase": "OFFICIAL_SUBMISSION",
                    "milestone": "تقديم الملف الرقمي المكتمل مباشرة إلى اللجنة الوطنية لمنح علامة مؤسسة ناشئة",
                    "deadlineDays": 5,
                }
            )
        elif total_score >= CANDIDATE_THRESHOLD:
            readiness_band = "Candidate"
            eligibility_status = "CANDIDATE"
            is_eligible = False
            recommendations.insert(
                0,
                "المشروع في مرحلة مرشح واعد. معالجة الثغرات التكنولوجية والقانونية الموضحة في الخطة ضرورية لضمان القبول أمام اللجنة."
            )
        else:
            readiness_band = "Not Ready"
            eligibility_status = "EARLY_STAGE"
            is_eligible = False
            recommendations.insert(
                0,
                "المشروع ما يزال في مرحلة النشوء المبكرة. ينصح بالالتحاق بحاضنة أعمال معتمدة لإنضاج النموذج قبل التقديم الرسمي."
            )

        return {
            "startupName": startup_name,
            "sector": sector,
            "wilaya": wilaya,
            "totalScore": total_score,
            "readinessBand": readiness_band,
            "eligibilityStatus": eligibility_status,
            "isEligibleForDecree20254": is_eligible,
            "pillarBreakdown": {
                "innovation": {"score": inn, "max": MAX_INNOVATION_SCORE, "weightPct": 30},
                "scalability": {"score": sca, "max": MAX_SCALABILITY_SCORE, "weightPct": 25},
                "team": {"score": tea, "max": MAX_TEAM_SCORE, "weightPct": 20},
                "ip": {"score": ip, "max": MAX_IP_SCORE, "weightPct": 15},
                "traction": {"score": tra, "max": MAX_TRACTION_SCORE, "weightPct": 10},
            },
            "gapAnalysis": gap_analysis,
            "recommendations": recommendations,
            "actionPlan": action_plan,
        }


# Singleton diagnostic engine instance
label_diagnostic_engine = StartupLabelDiagnosticEngine()
