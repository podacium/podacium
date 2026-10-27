"""
TamWheel Sovereign Ethical Agentic Venture OS — Darija Financial Literacy Curriculum & Label Diagnostic.
Implements the 5-module educational curriculum with ESE Oran, automated quiz grading,
analyst tier promotion (NOVICE -> SCOUT), and the Executive Decree 20-254 Startup Label Diagnostic.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.generated.prisma.enums import AnalystLevel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/curriculum", tags=["Financial Literacy & Curriculum"])

PASSING_SCORE_THRESHOLD = 70

# =============================================================================
# CURRICULUM MODULE DEFINITIONS (ESE Oran & TamWheel)
# =============================================================================

MODULES_DATA = [
    {
        "index": 1,
        "titleAr": "شنو هي ستارت أب؟",
        "titleEn": "What is a Startup?",
        "durationMinutes": 25,
        "descriptionAr": "الفرق بين المؤسسة الناشئة والمؤسسة التقليدية، مخاطر الابتكار، ونماذج النمو السريع في الجزائر.",
        "descriptionEn": "Distinguishing scalable startups from traditional SMEs; innovation models and failure risk mitigation.",
        "prerequisiteTier": "NOVICE",
        "questions": [
            {
                "id": "m1_q1",
                "questionAr": "واش هو الفرق الجوهري بين ستارت أب ومؤسسة مصغرة تقليدية (SME)؟",
                "optionsAr": [
                    "الستارت أب تهدف إلى نمو قابل للتكرار والتوسع السريع عبر التكنولوجيا",
                    "الستارت أب تحتاج سجل تجاري فقط",
                    "المؤسسة المصغرة تصدر دائماً للخارج",
                    "لا يوجد أي فرق بينهما",
                ],
                "correctAnswerIndex": 0,
            },
            {
                "id": "m1_q2",
                "questionAr": "واش يعني TRL في تقييم نضج التكنولوجيا للشركة الناشئة؟",
                "optionsAr": [
                    "مستوى الجاهزية التكنولوجية (Technology Readiness Level)",
                    "الضريبة على الأرباح التجارية",
                    "رقم التعريف الوطني للمؤسس",
                    "تاريخ تسجيل براءة الاختراع",
                ],
                "correctAnswerIndex": 0,
            },
        ],
    },
    {
        "index": 2,
        "titleAr": "كيفاش تعمل الكراودفندينغ؟",
        "titleEn": "How Does Crowdfunding Work?",
        "durationMinutes": 30,
        "descriptionAr": "آليات الاستثمار التشاركي، شركة المساهمة الوسيطة (Nominee SPV)، وحماية المستثمر حسب نظام COSOB 23-01.",
        "descriptionEn": "Participatory investment mechanisms, nominee SPVs, and retail investor protection under COSOB 23-01.",
        "prerequisiteTier": "NOVICE",
        "questions": [
            {
                "id": "m2_q1",
                "questionAr": "واش هو دور حساب الحجز المصرفي (Compte de Cantonnement) في حملات التمويل الجماعي؟",
                "optionsAr": [
                    "تجميد الأموال في البنك وعدم صرفها إلا عند تحقيق الهدف الكامل للحملة",
                    "إرسال الأموال مباشرة إلى حساب المؤسس الشخصي",
                    "دفع ضرائب المنصة مسبقاً",
                    "تحويل العملة إلى الدولار",
                ],
                "correctAnswerIndex": 0,
            },
            {
                "id": "m2_q2",
                "questionAr": "حسب تنظيم COSOB 23-01، واش هو الحد الأدنى لتذكرة الاستثمار التشاركي المقترح؟",
                "optionsAr": [
                    "5,000 دج",
                    "500,000 دج",
                    "10,000,000 دج",
                    "50 دج",
                ],
                "correctAnswerIndex": 0,
            },
        ],
    },
    {
        "index": 3,
        "titleAr": "كيفاش تقرا ملف ستارت أب؟",
        "titleEn": "How to Read a Startup Dossier",
        "durationMinutes": 35,
        "descriptionAr": "قراءة مؤشرات الاقتصاد الجزئي: CAC، LTV، معدل الحرق المالي (Burn Rate)، وفترة النجاة النقدية (Runway).",
        "descriptionEn": "Deciphering unit economics, customer acquisition cost (CAC), LTV, burn rate, and cash runway.",
        "prerequisiteTier": "NOVICE",
        "questions": [
            {
                "id": "m3_q1",
                "questionAr": "إذا كانت تكلفة اكتساب العميل (CAC) 1,500 دج والقيمة الدائمة (LTV) 6,000 دج، واش رأيك في المؤشر؟",
                "optionsAr": [
                    "مؤشر ممتاز (نسبة LTV/CAC = 4x تدل على نموذج ربحي مستدام)",
                    "مؤشر خطير يدل على إفلاس وشيك",
                    "يجب إيقاف التسويق فوراً",
                    "النسبة لا تعني شيئاً بدون براءة اختراع",
                ],
                "correctAnswerIndex": 0,
            },
            {
                "id": "m3_q2",
                "questionAr": "واش يعني الـ Runway في إدارة السيولة النقدية للستارت أب؟",
                "optionsAr": [
                    "عدد الأشهر المتبقية للشركة قبل نفاد السيولة النقدية مع معدل الحرق الحالي",
                    "مدرج الإقلاع في المطار",
                    "سرعة نمو عدد الموظفين",
                    "مدة العرض الترويجي للمنتج",
                ],
                "correctAnswerIndex": 0,
            },
        ],
    },
    {
        "index": 4,
        "titleAr": "البورتفويو: التنويع واش معناه؟",
        "titleEn": "Portfolio Diversification",
        "durationMinutes": 25,
        "descriptionAr": "توزيع المخاطر الاستثمارية عبر القطاعات (FinTech، AgTech، HealthTech) والولايات الجزائرية الـ 58.",
        "descriptionEn": "Risk distribution across diversified sectors, stages, and geographic Wilayas in Algeria.",
        "prerequisiteTier": "SCOUT",
        "questions": [
            {
                "id": "m4_q1",
                "questionAr": "علاش لازم مستثمر تمويل ينوع المحفظة الافتراضية تاعه وما يحطش كلش في شركة واحدة؟",
                "optionsAr": [
                    "لأن معظم الشركات الناشئة في مرحلة البذرة تواجه احتمالية تعثر عالية، فالتنويع يحمي رأس المال",
                    "لأن النظام يمنع الاستثمار في شركة واحدة",
                    "لتفادي الضرائب على الأرباح",
                    "للحصول على نقاط XP فقط",
                ],
                "correctAnswerIndex": 0,
            },
            {
                "id": "m4_q2",
                "questionAr": "في دوري الفانتازي (FSL)، واش هي قاعدة التوزيع الجغرافي للروستر؟",
                "optionsAr": [
                    "أقصى حد شركتين من نفس الولاية لتشجيع استكشاف كامل ولايات الوطن الـ 58",
                    "جميع الشركات يجب أن تكون من الجزائر العاصمة",
                    "لا يسمح باختيار شركات من الجنوب",
                    "شركة واحدة فقط لكل مستثمر",
                ],
                "correctAnswerIndex": 0,
            },
        ],
    },
    {
        "index": 5,
        "titleAr": "العائد: كيفاش نحسبو؟",
        "titleEn": "Calculating Investment Returns",
        "durationMinutes": 30,
        "descriptionAr": "التخفيف (Dilution)، مضاعفات التقييم، أفق التخارج (Exit Horizon)، وتوزيعات الأرباح التشاركية.",
        "descriptionEn": "Valuation multiples, dilution math, exit horizon timing, and sovereign profit-sharing.",
        "prerequisiteTier": "SCOUT",
        "questions": [
            {
                "id": "m5_q1",
                "questionAr": "إذا استثمرت 50,000 دج في جولة بذرة بتقييم 50,000,000 دج، واش هي حصتك المبدئية قبل التخفيف؟",
                "optionsAr": [
                    "0.1% من رأس مال الشركة",
                    "10% من رأس مال الشركة",
                    "1% من رأس مال الشركة",
                    "5% من رأس مال الشركة",
                ],
                "correctAnswerIndex": 0,
            },
            {
                "id": "m5_q2",
                "questionAr": "واش يعني مصطلح مضاعف التخارج (Exit Multiple)؟",
                "optionsAr": [
                    "نسبة القيمة المحققة عند بيع الحصة مقارنة برأس المال المستثمر في البداية",
                    "مضاعفة عدد الموظفين عند البيع",
                    "دفع غرامة التخارج المبكر",
                    "معدل الفائدة المصرفية السنوية",
                ],
                "correctAnswerIndex": 0,
            },
        ],
    },
]

# =============================================================================
# SCHEMAS
# =============================================================================

class QuestionResponse(BaseModel):
    id: str
    questionAr: str
    optionsAr: List[str]


class ModuleResponse(BaseModel):
    index: int
    titleAr: str
    titleEn: str
    durationMinutes: int
    descriptionAr: str
    descriptionEn: str
    prerequisiteTier: str
    questionsCount: int
    passed: bool = False
    latestScore: Optional[int] = None


class QuizSubmissionRequest(BaseModel):
    moduleIndex: int = Field(..., ge=1, le=5)
    answers: Optional[Dict[str, int]] = Field(
        None,
        description="Dictionary mapping question ID to selected answer index (0-based)"
    )
    directScore: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Direct test score (0-100) if submitted via external proctor"
    )


class QuizSubmissionResponse(BaseModel):
    moduleIndex: int
    score: int
    passed: bool
    completedModulesCount: int
    allModulesCompleted: bool
    promotedToScout: bool
    analystTier: str
    feedback: str


class LabelDiagnosticRequest(BaseModel):
    startupName: str = Field(..., min_length=2)
    sector: str = Field(..., min_length=2)
    wilaya: int = Field(..., ge=1, le=58)
    # 5 Pillars of Executive Decree 20-254
    innovationScore: int = Field(..., ge=0, le=30, description="Innovation pillar (max 30 pts)")
    scalabilityScore: int = Field(..., ge=0, le=25, description="Scalability pillar (max 25 pts)")
    teamScore: int = Field(..., ge=0, le=20, description="Team complementarity (max 20 pts)")
    ipScore: int = Field(..., ge=0, le=15, description="Patents & INAPI IP (max 15 pts)")
    tractionScore: int = Field(..., ge=0, le=10, description="Commercial traction & LOIs (max 10 pts)")


class LabelDiagnosticResponse(BaseModel):
    startupName: str
    totalScore: int
    eligibilityStatus: str  # LABEL_READY, CANDIDATE, EARLY_STAGE
    isEligibleForDecree20254: bool
    gapAnalysis: List[str]
    recommendations: List[str]


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/modules", response_model=List[ModuleResponse])
async def list_modules(current_user: dict = Depends(get_current_active_user)):
    """
    Retrieve all 5 Darija Financial Literacy curriculum modules with user completion status.
    """
    quiz_results = await prisma.financialquizresult.find_many(
        where={"userId": current_user.id}
    )

    passed_modules = {r.moduleIndex: r.score for r in quiz_results if r.passed}
    latest_scores = {r.moduleIndex: r.score for r in quiz_results}

    modules_response = []
    for m in MODULES_DATA:
        idx = m["index"]
        modules_response.append(
            ModuleResponse(
                index=idx,
                titleAr=m["titleAr"],
                titleEn=m["titleEn"],
                durationMinutes=m["durationMinutes"],
                descriptionAr=m["descriptionAr"],
                descriptionEn=m["descriptionEn"],
                prerequisiteTier=m["prerequisiteTier"],
                questionsCount=len(m["questions"]),
                passed=idx in passed_modules,
                latestScore=latest_scores.get(idx),
            )
        )
    return modules_response


@router.get("/modules/{module_index}")
async def get_module_detail(
    module_index: int,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Retrieve module contents and quiz questions for learning and verification.
    """
    if module_index < 1 or module_index > len(MODULES_DATA):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module {module_index} not found",
        )

    module = MODULES_DATA[module_index - 1]
    # Return questions with sanitized answer options
    questions = [
        QuestionResponse(
            id=q["id"],
            questionAr=q["questionAr"],
            optionsAr=q["optionsAr"],
        )
        for q in module["questions"]
    ]

    return {
        "index": module["index"],
        "titleAr": module["titleAr"],
        "titleEn": module["titleEn"],
        "durationMinutes": module["durationMinutes"],
        "descriptionAr": module["descriptionAr"],
        "descriptionEn": module["descriptionEn"],
        "questions": questions,
    }


@router.post("/quiz", response_model=QuizSubmissionResponse)
async def submit_curriculum_quiz(
    submission: QuizSubmissionRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Submit and automatically grade a Financial Literacy module quiz.
    Upon passing all 5 modules, automatically promotes analyst tier to SCOUT.
    """
    module_idx = submission.moduleIndex
    if module_idx < 1 or module_idx > len(MODULES_DATA):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid module index {module_idx}",
        )

    module = MODULES_DATA[module_idx - 1]
    final_score = 0

    if submission.directScore is not None:
        final_score = submission.directScore
    elif submission.answers:
        # Grade submitted answers against curriculum key
        correct_count = 0
        total_questions = len(module["questions"])
        for q in module["questions"]:
            qid = q["id"]
            if qid in submission.answers and submission.answers[qid] == q["correctAnswerIndex"]:
                correct_count += 1
        final_score = int((correct_count / max(1, total_questions)) * 100)
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either 'answers' or 'directScore' must be provided",
        )

    passed = final_score >= PASSING_SCORE_THRESHOLD

    # Record in database
    await prisma.financialquizresult.create(
        data={
            "userId": current_user.id,
            "moduleIndex": module_idx,
            "score": final_score,
            "passed": passed,
        }
    )

    # Check overall curriculum progress for this user
    all_passed_records = await prisma.financialquizresult.find_many(
        where={"userId": current_user.id, "passed": True}
    )
    passed_indices = set(r.moduleIndex for r in all_passed_records)
    completed_count = len(passed_indices)
    all_completed = completed_count >= 5

    promoted = False
    current_tier = AnalystLevel.NOVICE.value

    if all_completed:
        promoted = True
        current_tier = AnalystLevel.SCOUT.value
        feedback = "مبروك! كملت جميع الوحدات الخمسة وتمت ترقيتك إلى رتبة كشاف مالي معتمد (SCOUT)."
    elif passed:
        feedback = f"ممتاز! اجتزت الوحدة {module_idx} بنجاح بمعدل {final_score}%."
    else:
        feedback = f"للأسف لم تتجاوز عتبة النجاح (70%). درجتك: {final_score}%. يرجى إعادة المحاولة."

    return QuizSubmissionResponse(
        moduleIndex=module_idx,
        score=final_score,
        passed=passed,
        completedModulesCount=completed_count,
        allModulesCompleted=all_completed,
        promotedToScout=promoted,
        analystTier=current_tier,
        feedback=feedback,
    )


@router.post("/label-diagnostic", response_model=LabelDiagnosticResponse)
async def evaluate_startup_label_diagnostic(
    diagnostic: LabelDiagnosticRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Startup Label Readiness Diagnostic based on Executive Decree 20-254 (National Startup Label).
    Pillars: Innovation (30%), Scalability (25%), Team (20%), IP (15%), Traction (10%).
    """
    total_score = (
        diagnostic.innovationScore
        + diagnostic.scalabilityScore
        + diagnostic.teamScore
        + diagnostic.ipScore
        + diagnostic.tractionScore
    )

    gap_analysis = []
    recommendations = []

    if diagnostic.innovationScore < 20:
        gap_analysis.append("درجة الابتكار غير كافية لإثبات الأسبقية التكنولوجية والحل الجذري.")
        recommendations.append("توثيق القيمة التكنولوجية المضافة ونموذج العمل الرقمي بدقة للجنة الوطنية.")

    if diagnostic.scalabilityScore < 18:
        gap_analysis.append("قابلية التوسع السريع محلياً وإقليمياً غير مبرهنة كفاية.")
        recommendations.append("توضيح آلية التوسع في الـ 58 ولاية وتخفيض التكاليف الهامشية لكل مستخدم جديد.")

    if diagnostic.ipScore < 8:
        gap_analysis.append("غياب الحماية القانونية للملكية الفكرية أو إيداع براءة اختراع لدى INAPI.")
        recommendations.append("إيداع ملف تسجيل العلامة التجارية أو براءة الاختراع لدى المعهد الوطني للملكية الصناعية (INAPI).")

    if diagnostic.teamScore < 14:
        gap_analysis.append("فريق العمل يفتقر إلى التكامل بين الشق التقني والتجاري.")
        recommendations.append("ضم شريك مؤسس تقني (CTO) ذو خبرة مثبتة لإقناع لجنة الاعتماد.")

    if total_score >= 75:
        status_category = "LABEL_READY"
        is_eligible = True
        recommendations.insert(0, "المشروع مؤهل تماماً للتقديم على علامة 'مؤسسة ناشئة' عبر منصة startup.dz.")
    elif total_score >= 50:
        status_category = "CANDIDATE"
        is_eligible = False
        recommendations.insert(0, "المشروع في مرحلة مرشح متقدم. معالجة الثغرات أعلاه ضرورية قبل التقديم الرسمي.")
    else:
        status_category = "EARLY_STAGE"
        is_eligible = False
        recommendations.insert(0, "المشروع بحاجة إلى إنضاج النموذج الأولي وتوثيق الجدوى قبل التقديم للجنة.")

    return LabelDiagnosticResponse(
        startupName=diagnostic.startupName,
        totalScore=total_score,
        eligibilityStatus=status_category,
        isEligibleForDecree20254=is_eligible,
        gapAnalysis=gap_analysis,
        recommendations=recommendations,
    )
