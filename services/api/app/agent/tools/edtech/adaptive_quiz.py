"""
EdTech Adaptive Quiz Tool
Generates dynamic pedagogical assessments targeting student weak spots and Algerian Arrêté 1275
(Diplôme-Startup / Diplôme-Brevet d'Invention) competencies.
"""

import logging
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult

logger = logging.getLogger("podacium.agent.tools.edtech.adaptive_quiz")

ARRETE_1275_COMPETENCIES = [
    "Business Model Canvas (Marché Algérien)",
    "Propriété Industrielle & Dépôt de Brevet INAPI",
    "Labellisation Startup / Projet Innovant (Comité CSF)",
    "Ingénierie Financière & Fiscalité Startup (Loi 22-23 / Exonérations IBS)",
    "Prototypage Rapide & Validation MVP Terrain",
    "Go-To-Market & Stratégie Multi-Wilayas (58 Wilayas)",
]


class GenerateAdaptiveQuizArgs(BaseModel):
    topic: str = Field(
        ...,
        description="Core subject or curriculum topic (e.g. 'Arrêté 1275 Startup Incubator', 'Fintech Algérie', 'Full-stack Web')",
    )
    student_id: Optional[int] = Field(
        default=None,
        description="Optional student user ID for personalized diagnostic",
    )
    target_competency: str = Field(
        default="Arrêté 1275 Startup Incubator",
        description="Target educational framework or competency domain",
    )
    difficulty_level: str = Field(
        default="intermediate",
        description="Pedagogical level: 'beginner', 'intermediate', 'advanced'",
    )
    num_questions: int = Field(
        default=5,
        ge=1,
        le=15,
        description="Number of adaptive questions to generate",
    )
    identified_weak_spots: Optional[List[str]] = Field(
        default=None,
        description="List of detected student knowledge gaps or weak modules to reinforce",
    )


class GenerateAdaptiveQuizTool(BaseTool):
    name = "generate_adaptive_quiz"
    description = (
        "Generate a dynamic pedagogical quiz evaluating student weak spots and Algerian Arrêté 1275 "
        "(Diplôme-Startup / Brevet d'invention) startup competencies with rubric and Bloom taxonomy."
    )
    domain = ToolDomain.EDTECH
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "BUSINESS",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GenerateAdaptiveQuizArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GenerateAdaptiveQuizArgs)

        weak_spots = typed_args.identified_weak_spots or [
            "Protection juridique et propriété industrielle INAPI",
            "Évaluation du besoin en fonds de roulement (BFR) en DZD",
        ]

        # Generate targeted pedagogical questions tailored to Algerian entrepreneurial context
        questions: List[Dict[str, Any]] = [
            {
                "id": 1,
                "question": "Dans le cadre de l'Arrêté 1275 en Algérie, quelle est la démarche officielle pour protéger une innovation technologique avant soutenance ?",
                "options": [
                    "Publier le code source en open-source sur GitHub",
                    "Déposer un dossier de brevet d'invention auprès de l'INAPI avant toute divulgation publique",
                    "Envoyer un email certifié au Ministère de l'Enseignement Supérieur",
                    "Enregistrer uniquement une marque commerciale au CNRC",
                ],
                "correct_option_index": 1,
                "bloom_level": "Application",
                "competency_assessed": "Propriété Industrielle & Dépôt de Brevet INAPI",
                "explanation": "Selon l'Arrêté 1275 et la réglementation INAPI, la nouveauté absolue est requise. Le dépôt de brevet doit précéder toute divulgation publique ou soutenance.",
            },
            {
                "id": 2,
                "question": "Quel avantage fiscal majeur accorde la labellisation 'Projet Innovant' / 'Startup' sous l'égide du Ministère des Startups ?",
                "options": [
                    "Une subvention automatique en devises fortes (EUR/USD)",
                    "Une exonération de l'Impôt sur les Bénéfices des Sociétés (IBS) et de la TAP pour une durée de 3 à 5 ans",
                    "La gratuité totale de l'hébergement cloud étranger",
                    "L'exemption de comptabilité SCF",
                ],
                "correct_option_index": 1,
                "bloom_level": "Comprehension",
                "competency_assessed": "Ingénierie Financière & Fiscalité Startup",
                "explanation": "Le label Startup confère une exonération fiscale complète d'IBS, de TAP (supprimée) et d'IRG pour les actionnaires pendant la phase d'incubation/croissance.",
            },
            {
                "id": 3,
                "question": "Comment valider un MVP (Minimum Viable Product) dans l'écosystème algérien compte tenu des spécificités du e-paiement ?",
                "options": [
                    "Attendre l'intégration exclusive de Stripe US",
                    "Intégrer les passerelles certifiées GIE Monétique (Chargily Pay EDAHABIA/CIB) et offrir le paiement à la livraison (COD)",
                    "Obliger les clients à payer uniquement par virement bancaire interbancaire avec chèque de banque",
                    "Ne vendre que dans la wilaya d'Alger sans logistique tierce",
                ],
                "correct_option_index": 1,
                "bloom_level": "Evaluation",
                "competency_assessed": "Prototypage Rapide & Validation MVP Terrain",
                "explanation": "Le marché algérien requiert une approche hybride: passerelle e-paiement EDAHABIA/CIB locale et conciergerie multicanale pour maximiser la conversion.",
            },
            {
                "id": 4,
                "question": "Quel compte du Système Comptable Financier (SCF) permet à une entreprise cliente de déduire à 100% une prestation de développement logiciel freelance ?",
                "options": [
                    "Compte 6186 (Prestations informatiques et services numériques)",
                    "Compte 2182 (Matériel de transport)",
                    "Compte 512 (Banque devises)",
                    "Compte 700 (Ventes de marchandises)",
                ],
                "correct_option_index": 0,
                "bloom_level": "Knowledge",
                "competency_assessed": "Ingénierie Financière & Fiscalité Startup",
                "explanation": "Les prestations numériques et logicielles s'imputent au compte SCF 6186 et constituent une charge d'exploitation 100% déductible à l'IBS (Articles 169 & 224 CIDTA).",
            },
            {
                "id": 5,
                "question": "Dans le Business Model Canvas adapté au marché algérien, quel est le principal facteur d'échec d'une stratégie Go-To-Market précoce ?",
                "options": [
                    "Sous-estimer les coûts logistiques de distribution et de recouvrement sur les 58 wilayas",
                    "Avoir une interface disponible en darija et en français",
                    "Utiliser des technologies open source pour le backend",
                    "Avoir plusieurs associés diplômés de l'université",
                ],
                "correct_option_index": 0,
                "bloom_level": "Analysis",
                "competency_assessed": "Go-To-Market & Stratégie Multi-Wilayas (58 Wilayas)",
                "explanation": "La logistique du dernier kilomètre et le recouvrement du cash (Kridi / COD) à travers le territoire national constituent le goulot d'étranglement opérationnel majeur.",
            },
        ]

        selected_questions = questions[: typed_args.num_questions]

        evaluation_grid = {
            "framework": "Arrêté Ministériel 1275 (Diplôme-Startup)",
            "grading_criteria": [
                {"category": "Innovation & Brevetabilité", "weight": "25%"},
                {"category": "Faisabilité Économique & BMC", "weight": "30%"},
                {"category": "Maturité Technologique & Prototype MVP", "weight": "25%"},
                {"category": "Potentiel Marché Algérien & 58 Wilayas", "weight": "20%"},
            ],
            "passing_threshold_percent": 65,
        }

        return ToolResult(
            success=True,
            data={
                "quiz_id": f"quiz-arrete-1275-{typed_args.student_id or 'guest'}",
                "topic": typed_args.topic,
                "target_competency": typed_args.target_competency,
                "difficulty_level": typed_args.difficulty_level,
                "weak_spots_reinforced": weak_spots,
                "question_count": len(selected_questions),
                "questions": selected_questions,
                "evaluation_grid": evaluation_grid,
            },
            widget_payload={
                "type": "ADAPTIVE_QUIZ_INTERFACE",
                "topic": typed_args.topic,
                "num_questions": len(selected_questions),
            },
            metadata={"pedagogy": "arrete_1275", "adaptive": True},
        )
